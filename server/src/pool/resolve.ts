import { execFile } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { createRequire } from 'node:module';
import { basename } from 'node:path';
import { fetchYoutubeMeta } from './youtube.js';
import { fetchGiphyMeta } from './giphy.js';
import type { MediaItem } from '../../../shared/types.js';
import type { ValidatedInput } from './types.js';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const probe = require('probe-image-size') as typeof import('probe-image-size');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildUploadUrl(filePath: string): string {
  // filePath is the multer disk path, e.g. "./uploads/uuid.jpg"
  // Expose it as "/uploads/uuid.jpg"
  const filename = basename(filePath);
  return `/uploads/${filename}`;
}

interface FfprobeInfo {
  durationMs:  number | null;
  aspectRatio: number | null;
}

function ffprobeInfo(filePath: string): Promise<FfprobeInfo> {
  return new Promise((resolve) => {
    execFile(
      'ffprobe',
      ['-v', 'quiet', '-print_format', 'json', '-show_streams', '-show_format', filePath],
      { timeout: 10_000 },
      (err, stdout) => {
        if (err) { resolve({ durationMs: null, aspectRatio: null }); return; }
        try {
          const data = JSON.parse(stdout) as {
            format?:  { duration?: string };
            streams?: Array<{ codec_type?: string; width?: number; height?: number }>;
          };
          const durationMs = data.format?.duration
            ? Math.round(parseFloat(data.format.duration) * 1000)
            : null;
          const video = data.streams?.find(s => s.codec_type === 'video');
          const aspectRatio = video?.width && video?.height ? video.width / video.height : null;
          resolve({ durationMs: isNaN(durationMs ?? NaN) ? null : durationMs, aspectRatio });
        } catch {
          resolve({ durationMs: null, aspectRatio: null });
        }
      },
    );
  });
}

async function probeImageAspect(filePath: string): Promise<number | null> {
  try {
    const result = await probe(createReadStream(filePath));
    return result.width && result.height ? result.width / result.height : null;
  } catch {
    return null;
  }
}

async function probeImageAspectFromUrl(url: string): Promise<number | null> {
  try {
    const result = await probe(url);
    return result.width && result.height ? result.width / result.height : null;
  } catch {
    return null;
  }
}

async function fetchLinkMeta(url: string): Promise<{
  title: string | null;
  thumbnail: string | null;
  siteName: string | null;
}> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);

    const MAX_BYTES = 256 * 1024; // 256 KB — enough for any <head> section
    let html: string;
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'MiniRegie/1.0' },
      });
      const buf = await res.arrayBuffer();
      html = new TextDecoder().decode(buf.slice(0, MAX_BYTES));
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
  } catch (err) {
    console.warn('[resolve] fetchLinkMeta failed for', url, err instanceof Error ? err.message : err);
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
        return { url: '', aspectRatio: null, caption: null };
      }
      const url = buildUploadUrl(item.filePath);
      const aspectRatio = await probeImageAspect(item.filePath);
      return { url, aspectRatio, caption: null };
    }

    case 'gif': {
      if (!item.filePath) {
        return { url: '', aspectRatio: null, caption: null };
      }
      const url = buildUploadUrl(item.filePath);
      const aspectRatio = await probeImageAspect(item.filePath);
      return { url, aspectRatio, caption: null };
    }

    case 'photo-url': {
      const validated = item.content as { url: string; caption?: string };
      const aspectRatio = await probeImageAspectFromUrl(validated.url);
      return { url: validated.url, aspectRatio, caption: validated.caption ?? null };
    }

    case 'gif-url': {
      const validated = item.content as { url: string; caption?: string };
      const aspectRatio = await probeImageAspectFromUrl(validated.url);
      return { url: validated.url, aspectRatio, caption: validated.caption ?? null };
    }

    case 'clip': {
      if (!item.filePath) {
        return { url: '', duration: 0, mimeType: '', aspectRatio: null, caption: null };
      }
      const url = buildUploadUrl(item.filePath);
      const validated = item.content as { mimetype: string; size: number };
      const info = await ffprobeInfo(item.filePath);

      return {
        url,
        duration:    info.durationMs ?? 0,
        mimeType:    validated.mimetype,
        aspectRatio: info.aspectRatio,
        caption:     null,
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

    case 'giphy': {
      const validated = item.content as { url: string; giphyId: string; caption?: string };
      const meta = await fetchGiphyMeta(validated.giphyId);
      return {
        giphyId:     validated.giphyId,
        url:         meta.url,
        mp4Url:      meta.mp4Url,
        title:       meta.title,
        aspectRatio: meta.aspectRatio,
        caption:     validated.caption ?? null,
      };
    }

    case 'note': {
      const validated = item.content as { text: string };
      return { text: validated.text };
    }

    case 'youtube': {
      const validated = item.content as { url: string; youtubeId: string; caption?: string };
      const meta = await fetchYoutubeMeta(validated.youtubeId);
      return {
        url:         validated.url,
        youtubeId:   validated.youtubeId,
        title:       meta.title,
        duration:    meta.duration,
        thumbnail:   meta.thumbnail,
        aspectRatio: meta.aspectRatio,
        caption:     validated.caption ?? null,
      };
    }

    case 'ticker': {
      const validated = item.content as { text: string };
      return { text: validated.text };
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
