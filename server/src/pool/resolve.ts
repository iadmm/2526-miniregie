import { execFile } from 'node:child_process';
import { basename } from 'node:path';
import type { MediaItem } from '../../../shared/types.js';
import type { ValidatedInput } from './types.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildUploadUrl(filePath: string): string {
  // filePath is the multer disk path, e.g. "./uploads/uuid.jpg"
  // Expose it as "/uploads/uuid.jpg"
  const filename = basename(filePath);
  return `/uploads/${filename}`;
}

function ffprobeDuration(filePath: string): Promise<number | null> {
  return new Promise((resolve) => {
    execFile(
      'ffprobe',
      [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        filePath,
      ],
      { timeout: 10_000 },
      (err, stdout) => {
        if (err) {
          resolve(null);
          return;
        }
        const seconds = parseFloat(stdout.trim());
        resolve(isNaN(seconds) ? null : Math.round(seconds * 1000));
      },
    );
  });
}

async function fetchLinkMeta(url: string): Promise<{
  title: string | null;
  thumbnail: string | null;
  siteName: string | null;
}> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);

    let html: string;
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'MiniRegie/1.0' },
      });
      html = await res.text();
    } finally {
      clearTimeout(timeout);
    }

    // Extract og:title
    const titleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);

    // Extract og:image
    const imageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);

    // Extract og:site_name
    const siteMatch = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i);

    return {
      title:    titleMatch?.[1] ?? null,
      thumbnail: imageMatch?.[1] ?? null,
      siteName:  siteMatch?.[1] ?? null,
    };
  } catch {
    return { title: null, thumbnail: null, siteName: null };
  }
}

// ─── Main resolve function ─────────────────────────────────────────────────────

export async function resolve(item: {
  type: ValidatedInput['type'];
  content: ValidatedInput['content'];
  filePath?: string;
}): Promise<MediaItem['content']> {
  switch (item.type) {
    case 'photo': {
      if (!item.filePath) {
        return { url: '', caption: null };
      }
      const url = buildUploadUrl(item.filePath);
      return { url, caption: null };
    }

    case 'gif': {
      if (!item.filePath) {
        return { url: '', caption: null };
      }
      const url = buildUploadUrl(item.filePath);
      return { url, caption: null };
    }

    case 'clip': {
      if (!item.filePath) {
        return { url: '', duration: 0, mimeType: '', caption: null };
      }
      const url = buildUploadUrl(item.filePath);
      const validated = item.content as { mimetype: string; size: number };

      // ffprobe returns ms; fallback to 0 if unavailable — never crash the pipeline
      const durationMs = await ffprobeDuration(item.filePath) ?? 0;

      return {
        url,
        duration: durationMs,
        mimeType: validated.mimetype,
        caption: null,
      };
    }

    case 'link': {
      const validated = item.content as { url: string };
      const meta = await fetchLinkMeta(validated.url);
      return {
        url:         validated.url,
        title:       meta.title,
        description: null,
        thumbnail:   meta.thumbnail,
        siteName:    meta.siteName,
        caption:     null,
      };
    }

    case 'note': {
      const validated = item.content as { text: string };
      return { text: validated.text };
    }

    case 'youtube': {
      // YouTube ID is already present in content from sanitize/enrich — no file resolution needed
      const validated = item.content as {
        url: string;
        youtubeId: string;
        title: string;
        duration: number;
        thumbnail: string;
      };
      return {
        url:       validated.url       ?? '',
        youtubeId: validated.youtubeId ?? '',
        title:     validated.title     ?? '',
        duration:  validated.duration  ?? 0,
        thumbnail: validated.thumbnail ?? '',
        caption:   null,
      };
    }

    case 'interview': {
      // Interview resolution is a future concern — return empty structure for now
      return {
        segments: [],
        subject: {
          type: 'manual',
          participantId: null,
          displayName: '',
          team: '',
          role: '',
        },
      };
    }
  }
}
