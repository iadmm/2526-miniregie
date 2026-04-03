import { extname } from 'node:path';
import getId from 'get-youtube-id';
import type { RawFile, RawInput, SanitizeResult, ValidatedInput } from './types.js';

const IMAGE_EXTS: Record<string, 'photo-url' | 'gif-url'> = {
  '.jpg': 'photo-url', '.jpeg': 'photo-url', '.png': 'photo-url', '.webp': 'photo-url',
  '.gif': 'gif-url',
};

function detectImageUrl(url: string): 'photo-url' | 'gif-url' | null {
  try {
    const ext = extname(new URL(url).pathname).toLowerCase();
    return IMAGE_EXTS[ext] ?? null;
  } catch {
    return null;
  }
}

const MB = 1024 * 1024;


// ─── Giphy URL → ID extraction ────────────────────────────────────────────────
//
// Supported formats:
//   https://giphy.com/gifs/some-title-GIF_ID
//   https://giphy.com/gifs/GIF_ID
//   https://media.giphy.com/media/GIF_ID/giphy.gif
//   https://media.giphy.com/media/GIF_ID/giphy.mp4

function extractGiphyId(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    if (url.hostname === 'media.giphy.com' || url.hostname === 'media0.giphy.com') {
      // /media/GIF_ID/giphy.gif
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts[0] === 'media' && parts.length >= 2) return parts[1] ?? null;
    }
    if (url.hostname === 'giphy.com' || url.hostname === 'www.giphy.com') {
      // /gifs/some-title-GIF_ID
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts[0] === 'gifs' && parts.length >= 2) {
        const slug = parts[1]!;
        const lastDash = slug.lastIndexOf('-');
        return lastDash >= 0 ? slug.slice(lastDash + 1) : slug;
      }
    }
    return null;
  } catch {
    return null;
  }
}

const PHOTO_MIMES = new Set(['image/jpeg', 'image/png']);
const GIF_MIMES   = new Set(['image/gif']);
const CLIP_MIMES  = new Set(['video/mp4', 'video/quicktime', 'video/webm']);

function validateFile(
  file: RawFile,
  allowedMimes: Set<string>,
  maxBytes: number,
): { ok: true } | { ok: false; error: string } {
  if (!allowedMimes.has(file.mimetype)) {
    return { ok: false, error: `Invalid MIME type: ${file.mimetype}. Allowed: ${[...allowedMimes].join(', ')}` };
  }
  if (file.size > maxBytes) {
    return { ok: false, error: `File size ${file.size} exceeds limit of ${maxBytes} bytes` };
  }
  return { ok: true };
}

function validateClipFile(file: RawFile): { ok: true } | { ok: false; error: string } {
  return validateFile(file, CLIP_MIMES, 50 * MB);
}

export function sanitize(input: RawInput): SanitizeResult {
  switch (input.type) {
    case 'photo': {
      const check = validateFile(input.file, PHOTO_MIMES, 10 * MB);
      if (!check.ok) return check;
      return { ok: true, validated: { type: 'photo', mimetype: input.file.mimetype, size: input.file.size } };
    }

    case 'gif': {
      const check = validateFile(input.file, GIF_MIMES, 10 * MB);
      if (!check.ok) return check;
      return { ok: true, validated: { type: 'gif', mimetype: input.file.mimetype, size: input.file.size } };
    }

    case 'note': {
      const text = input.text.trim();
      if (text.length === 0) return { ok: false, error: 'Note text cannot be empty' };
      if (text.length > 500) return { ok: false, error: 'Note exceeds 500 characters' };

      // Auto-detect YouTube or Giphy URL anywhere in the text.
      // The URL is one whitespace-delimited word; the rest becomes the caption.
      const words = text.split(/\s+/);
      const urlWord = words.find(w => /^https?:\/\//i.test(w));
      if (urlWord) {
        const rawUrl = urlWord.replace(/[.,;!?)"']+$/, ''); // strip trailing punctuation
        const captionWords = words.filter(w => w !== urlWord);
        const caption = captionWords.join(' ').trim() || undefined;

        const youtubeId = getId(rawUrl);
        if (youtubeId) return { ok: true, validated: { type: 'youtube', url: rawUrl, youtubeId, caption } };

        const giphyId = extractGiphyId(rawUrl);
        if (giphyId) return { ok: true, validated: { type: 'giphy', url: rawUrl, giphyId, caption } };

        const imageType = detectImageUrl(rawUrl);
        if (imageType) return { ok: true, validated: { type: imageType, url: rawUrl, caption } };
      }

      return { ok: true, validated: { type: 'note', text } };
    }

    case 'ticker': {
      const text = input.text.trim();
      if (text.length === 0)  return { ok: false, error: 'Ticker text cannot be empty' };
      if (text.length > 120)  return { ok: false, error: 'Ticker exceeds 120 characters' };
      return { ok: true, validated: { type: 'ticker', text } };
    }

    case 'youtube': {
      const youtubeId = getId(input.url);
      if (!youtubeId) return { ok: false, error: 'Could not extract a valid YouTube video ID from URL' };
      return { ok: true, validated: { type: 'youtube', url: input.url, youtubeId } };
    }

    case 'giphy': {
      const giphyId = extractGiphyId(input.url);
      if (!giphyId) return { ok: false, error: 'Could not extract a valid Giphy GIF ID from URL' };
      return { ok: true, validated: { type: 'giphy', url: input.url, giphyId } };
    }

    case 'link': {
      let url: URL;
      try { url = new URL(input.url); } catch {
        return { ok: false, error: 'Invalid URL' };
      }
      if (url.protocol !== 'https:') return { ok: false, error: 'URL must use https' };
      return { ok: true, validated: { type: 'link', url: input.url } };
    }

    case 'clip': {
      const check = validateClipFile(input.file);
      if (!check.ok) return check;
      return { ok: true, validated: { type: 'clip', mimetype: input.file.mimetype, size: input.file.size } };
    }

    case 'interview': {
      if (input.segments.length === 0) return { ok: false, error: 'Interview must have at least one segment' };

      const validatedSegments: ValidatedInput & { type: 'interview' } extends { segments: infer S } ? S : never = [];
      for (const segment of input.segments) {
        if ('textOnly' in segment) {
          validatedSegments.push({ textOnly: segment.textOnly });
        } else {
          const check = validateClipFile(segment.file);
          if (!check.ok) return check;
          validatedSegments.push({ mimetype: segment.file.mimetype, size: segment.file.size });
        }
      }
      return { ok: true, validated: { type: 'interview', segments: validatedSegments } };
    }
  }
}
