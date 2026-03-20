# Admin UI — Development Plan

## Overview

Six independent steps. Steps 3–6 can be parallelized once the shell (step 2) is in place.

| # | Step | Depends on |
|---|---|---|
| 1 | Auth | — |
| 2 | Shell | 1 |
| 3 | JAM Control & Panic | 2 |
| 4 | Queue | 2 |
| 5 | Scheduler / Timeline | 2 |
| 6 | jam-mode Config | 2 |

---

## Step 1 — Auth

**Scope:** Login/logout, session cookie, admin flag, account promotion.

**Success criteria:**
- [ ] Column `admin INTEGER DEFAULT 0` on `participants` table, seed `system:admin` with `admin=1`
- [ ] `POST /api/auth/login` → 200 + session cookie if credentials valid, 401 otherwise
- [ ] `POST /api/auth/logout` → clears the cookie
- [ ] Admin middleware on all `/api/admin/*` routes → 401 if not authenticated
- [ ] UI: login form, redirects to dashboard on success
- [ ] UI: admin checkbox on the participant list (toggle promotion/demotion)
- [ ] Self-demotion blocked server-side (lock-out protection)

**Notes:**
- Session cookie: standard browser behavior (no explicit expiry, expires on browser close)
- Auth: signed cookie via `crypto.createHmac` (already in arch decisions)
- No OAuth, no Passport

---

## Step 2 — Shell

**Scope:** Base layout, navigation, route protection.

**Success criteria:**
- [ ] Permanent top bar: JAM state indicator, active app selector, panic button (layout only, not wired)
- [ ] Main zone with horizontal tabs: **Queue** | **Timeline**
- [ ] Tab navigation without page reload
- [ ] Side panel: empty placeholder (low priority, out of initial scope)
- [ ] Access protected — redirect to login if cookie absent
- [ ] Svelte 5 + Vite builds cleanly

**Notes:**
- Top bar always visible regardless of active tab — broadcast tool convention (vMix/ATEM style)
- Tabs at top of main content zone

---

## Step 3 — JAM Control & Panic

**Scope:** Real-time JAM state, active app override, panic button with configurable message.

**Success criteria:**
- [ ] JAM state indicator updates in real time (pre / live / post) via Socket.io
- [ ] Active app selector — list of available apps, manual override emits to BroadcastManager
- [ ] Panic message textarea always visible in top bar, editable at any time (before or during panic)
- [ ] Panic button → immediate emit, UI switches to a distinct "PANIC" visual state
- [ ] Cancel panic button → returns to normal state
- [ ] Panic state and message persisted (page reload preserves state)

---

## Step 4 — Queue

**Scope:** Real-time pool display, reordering, per-item actions, metadata editing, unban.

**Success criteria:**
- [ ] Real-time item list (score, type, author, thumbnail for photos) via Socket.io
- [ ] Reordering: drag & drop (`svelte-dnd-action`, evaluate first) or ↑↓ arrows as fallback — item moved to top = immediate injection
- [ ] Per-item actions: **pin**, **skip**, **evict** (confirmation dialog for evict)
- [ ] Metadata edit drawer: title, priority, duration — save updates DB
- [ ] Unban participant from list (no log)
- [ ] Real-time updates via Socket.io (no polling)

---

## Step 5 — Scheduler / Timeline

**Scope:** Scripted event timeline, event creation and editing.

**Success criteria:**
- [ ] Horizontal scrollable timeline displaying scripted events (evaluate `vis-timeline` or `svelte-gantt`; fallback: scrollable list)
- [ ] "Now" indicator visible with auto-scroll to present
- [ ] Event creation: click on empty slot → modal with 5 event types:
  1. Change active app
  2. Trigger a transition
  3. Add an item to the queue
  4. Add a ticker message
  5. Trigger a layout (jam-mode only)
- [ ] Edit / delete existing event
- [ ] Persisted in DB, reload preserves state
- [ ] Server scheduler picks up new events without restart

---

## Step 6 — jam-mode Config

**Scope:** Scene composer, lower thirds config, ticker config, absurd tags.

**Success criteria:**
- [ ] Scene composer: choose layout (5 types), fill slots from pool picker or direct input (text/URL), inject as pinned item in pool
- [ ] Absurd tags: editable list (add, remove, reorder)
- [ ] Lower thirds: configurable appearance delay and visibility duration
- [ ] Ticker: configurable N (loop count) and V (speed)
- [ ] All config persisted in DB, reloadable without server restart

**Notes:**
- Lower thirds and layout rendering belong to the broadcast client (vanilla JS SPA), not the admin
- This step only covers the admin-side configuration that the broadcast client will read