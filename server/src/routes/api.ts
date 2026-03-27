import { Router } from "express";
import { randomUUID } from "node:crypto";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
  getAllItems,
  updateStatus,
  updatePriority,
  updateContent,
  deleteItem,
  getItemById,
  searchParticipants,
  setBanned,
  getParticipantById,
  setParticipantRole,
  getScheduleEntries,
  insertScheduleEntry,
  updateScheduleEntry,
  deleteScheduleEntry,
} from "../db/queries.js";
import type { MediaStatus, AppId, MediaItem, JamConfig, AuthorStats } from "@shared/types";
import type { BroadcastManager } from "../broadcast";
import type { PoolManager } from "../pool";
import { getJamConfig, updateJamConfig } from "../jam-config.js";
import { applyDevSeed } from "../db/dev-seed.js";

const VALID_STATUSES: MediaStatus[] = ["pending", "ready", "evicted"];
const ADMIN_AUTHOR: MediaItem["author"] = {
  participantId: "system:admin",
  displayName: "Admin",
  team: "",
  role: "admin",
};

export default function createApiRouter(broadcast: BroadcastManager, pool: PoolManager): Router {
  const router = Router();

  // All API routes require admin role
  router.use(requireAuth, requireRole("admin"));

  // ─── JAM control ─────────────────────────────────────────────────────────────

  router.post("/jam/start", (_req, res) => {
    try {
      broadcast.startJam();
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.post("/jam/end", (_req, res) => {
    broadcast.endJam();
    res.json({ ok: true });
  });

  router.post("/jam/reset", (_req, res) => {
    broadcast.reset();
    applyDevSeed();
    res.json({ ok: true });
  });

  router.post("/jam/panic", (_req, res) => {
    broadcast.panic("manual");
    res.json({ ok: true });
  });

  router.patch("/jam/panic", (req, res) => {
    const { message } = req.body as { message?: unknown };
    if (typeof message !== "string") {
      res.status(400).json({ error: "message must be a string" });
      return;
    }
    broadcast.setPanicMessage(message);
    res.json({ ok: true });
  });

  router.delete("/jam/panic", (req, res) => {
    const { resumeAppId } = req.body as { resumeAppId?: unknown };
    if (typeof resumeAppId !== "string" || resumeAppId.trim().length === 0) {
      res.status(400).json({ error: "resumeAppId is required" });
      return;
    }
    broadcast.clearPanic(resumeAppId.trim() as AppId);
    res.json({ ok: true });
  });

  // ─── Config ───────────────────────────────────────────────────────────────────

  router.get("/config", (_req, res) => {
    res.json(getJamConfig());
  });

  router.patch("/config", (req, res) => {
    try {
      const patch = req.body as Partial<JamConfig>;
      const updated = updateJamConfig(patch);
      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: String(err) });
    }
  });

  // ─── Broadcast ────────────────────────────────────────────────────────────────

  router.post("/broadcast/dispatch", (req, res) => {
    const { appId } = req.body as { appId?: unknown };
    if (typeof appId !== "string" || appId.trim().length === 0) {
      res.status(400).json({ error: "appId is required" });
      return;
    }
    broadcast.dispatch({ type: "market", appId: appId.trim() as AppId, source: "admin" });
    res.json({ ok: true });
  });

  router.get("/broadcast/schedule", (_req, res) => {
    res.json(broadcast.getSchedule());
  });

  // ─── Schedule CRUD ────────────────────────────────────────────────────────────

  router.get("/schedule", (_req, res) => {
    res.json(getScheduleEntries());
  });

  router.post("/schedule", (req, res) => {
    const { at, app, label } = req.body as { at?: unknown; app?: unknown; label?: unknown };
    if (typeof at !== "string" || at.trim().length === 0) {
      res.status(400).json({ error: "at is required" });
      return;
    }
    if (typeof app !== "string" || app.trim().length === 0) {
      res.status(400).json({ error: "app is required" });
      return;
    }
    const entry = insertScheduleEntry(at.trim(), app.trim(), typeof label === "string" ? label.trim() || undefined : undefined);
    broadcast.reloadSchedule();
    res.status(201).json(entry);
  });

  router.put("/schedule/:id", (req, res) => {
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    const { at, app, label, status } = req.body as { at?: unknown; app?: unknown; label?: unknown; status?: unknown };
    const patch: Parameters<typeof updateScheduleEntry>[1] = {};
    if (typeof at === "string" && at.trim())     patch.at     = at.trim();
    if (typeof app === "string" && app.trim())   patch.app    = app.trim();
    if (typeof label === "string")               patch.label  = label.trim() || null;
    if (status === "pending" || status === "fired" || status === "skipped") patch.status = status;
    updateScheduleEntry(id, patch);
    broadcast.reloadSchedule();
    res.json({ ok: true });
  });

  router.delete("/schedule/:id", (req, res) => {
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    deleteScheduleEntry(id);
    broadcast.reloadSchedule();
    res.json({ ok: true });
  });

  router.post("/schedule/reload", (_req, res) => {
    broadcast.reloadSchedule();
    res.json({ ok: true });
  });

  // ─── State ────────────────────────────────────────────────────────────────────

  router.get("/state", (_req, res) => {
    res.json(broadcast.getState());
  });

  // ─── Items ────────────────────────────────────────────────────────────────────

  router.post("/items/create", (req, res) => {
    const { type, text, label } = req.body as {
      type?: unknown;
      text?: unknown;
      label?: unknown;
    };

    if (type !== "note" && type !== "ticker") {
      res.status(400).json({ error: "type must be note or ticker" });
      return;
    }
    if (typeof text !== "string" || text.trim().length === 0) {
      res.status(400).json({ error: "text is required" });
      return;
    }
    if (text.trim().length > 280) {
      res.status(400).json({ error: "text must be 280 characters or fewer" });
      return;
    }

    // priority is DB-only: ticker=80, note=100. Passed to addDirectItem separately.
    const itemPriority = type === "ticker" ? 80 : 100;
    const item: MediaItem = {
      id:            randomUUID(),
      type,
      content:       type === "ticker"
        ? { text: text.trim(), ...(typeof label === "string" && label.trim() ? { label: label.trim() } : {}) }
        : { text: text.trim() },
      queuePosition: null,
      status:        "ready",
      submittedAt:   Date.now(),
      author:        ADMIN_AUTHOR,
    };

    pool.addDirectItem(item, itemPriority);
    res.status(201).json(item);
  });

  router.get("/items", (req, res) => {
    const { status, authorId, scored } = req.query as {
      status?: string;
      authorId?: string;
      scored?: string;
    };

    const statusFilter = VALID_STATUSES.includes(status as MediaStatus)
      ? (status as MediaStatus)
      : undefined;

    // scored=true + status=ready → return ScoredMediaItem[] with scores and cooldowns
    if (scored === "true" && statusFilter === "ready") {
      res.json(pool.getScoredQueue());
      return;
    }

    const items = getAllItems({
      ...(statusFilter !== undefined && { status: statusFilter }),
      ...(typeof authorId === "string" && { authorId }),
    });
    res.json(items);
  });

  router.patch("/items/:id/status", (req, res) => {
    const { id } = req.params as { id: string };
    const { status } = req.body as { status?: unknown };

    if (
      typeof status !== "string" ||
      !VALID_STATUSES.includes(status as MediaStatus)
    ) {
      res.status(400).json({ error: "Invalid status value" });
      return;
    }

    updateStatus(id, status as MediaStatus);
    res.json({ ok: true });
  });

  router.delete("/items/:id", (req, res) => {
    const { id } = req.params as { id: string };
    deleteItem(id);
    res.json({ ok: true });
  });

  router.post("/items/:id/skip", (req, res) => {
    const { id } = req.params as { id: string };
    pool.markSkipped(id, "admin");
    res.json({ ok: true });
  });

  router.get("/items/played", (_req, res) => {
    res.json(pool.getPlayedItems());
  });

  router.post("/items/:id/requeue", (req, res) => {
    const { id } = req.params as { id: string };
    pool.requeue(id);
    res.json({ ok: true });
  });

  router.patch("/items/:id", (req, res) => {
    const { id } = req.params as { id: string };
    const { priority, caption, text } = req.body as {
      priority?: unknown;
      caption?: unknown;
      text?: unknown;
    };

    const item = getItemById(id);
    if (!item) {
      res.status(404).json({ error: "Item not found" });
      return;
    }

    if (priority !== undefined) {
      if (typeof priority !== "number" || priority < 0 || priority > 999) {
        res.status(400).json({ error: "priority must be a number between 0 and 999" });
        return;
      }
      updatePriority(id, priority);
    }

    if (caption !== undefined || text !== undefined) {
      const content = { ...item.content } as Record<string, unknown>;
      if (typeof caption === "string" && "caption" in content) {
        content.caption = caption.trim() || null;
      }
      if (typeof text === "string" && "text" in content) {
        content.text = text;
      }
      updateContent(id, content as unknown as MediaItem["content"]);
    }

    res.json({ ok: true });
  });

  // ─── Pool ─────────────────────────────────────────────────────────────────────

  router.get("/pool/authors", (_req, res) => {
    const scored = pool.getScoredQueue();

    // Aggregate per-author stats from the scored queue
    const map = new Map<string, AuthorStats>();

    for (const item of scored) {
      const { participantId, displayName, team } = item.author;
      let entry = map.get(participantId);
      if (entry === undefined) {
        // Look up ban status synchronously from DB on first encounter
        const participant = getParticipantById(participantId);
        entry = {
          id:             participantId,
          displayName,
          team,
          readyCount:     0,
          displayedCount: 0,
          skippedCount:   0,
          banned:         participant?.banned ?? false,
        };
        map.set(participantId, entry);
      }
      entry.readyCount     += 1;
      // displayedCount and skippedCount on ScoredMediaItem are per-item totals;
      // accumulate across all items by this author to get author-level totals
      entry.displayedCount += item.displayedCount;
      entry.skippedCount   += item.skippedCount;
    }

    // Sort by readyCount desc (most active authors first)
    const result = [...map.values()].sort((a, b) => b.readyCount - a.readyCount);
    res.json(result);
  });

  // ─── Participants ─────────────────────────────────────────────────────────────

  router.get("/participants", (req, res) => {
    const { q } = req.query as { q?: string };
    const results = searchParticipants(
      typeof q === "string" && q.length > 0 ? q : undefined,
    );
    res.json(results);
  });

  router.patch("/participants/:id/role", (req, res) => {
    const { id } = req.params as { id: string };
    const { admin } = req.body as { admin?: unknown };

    if (typeof admin !== "boolean") {
      res.status(400).json({ error: "admin must be a boolean" });
      return;
    }

    if (id.startsWith("system:")) {
      res.status(400).json({ error: "Cannot modify system accounts" });
      return;
    }

    if (!admin && req.participant!.id === id) {
      res.status(403).json({ error: "Cannot remove your own admin privileges" });
      return;
    }

    const participant = getParticipantById(id);
    if (!participant) {
      res.status(404).json({ error: "Participant not found" });
      return;
    }

    setParticipantRole(id, admin ? "admin" : "participant");
    res.json({ ok: true });
  });

  router.post("/participants/:id/ban", (req, res) => {
    const { id } = req.params as { id: string };
    const { reason } = req.body as { reason?: unknown };

    setBanned(id, true, Date.now(), typeof reason === "string" ? reason : null);
    res.json({ ok: true });
  });

  router.delete("/participants/:id/ban", (req, res) => {
    const { id } = req.params as { id: string };
    setBanned(id, false, null, null);
    res.json({ ok: true });
  });

  return router;
}
