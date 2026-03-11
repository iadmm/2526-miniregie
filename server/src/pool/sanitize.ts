import type { RawFile, RawInput, SanitizeResult, ValidatedInput } from './types.js';

const MB = 1024 * 1024;

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
      if (text.length === 0)   return { ok: false, error: 'Note text cannot be empty' };
      if (input.text.length > 280) return { ok: false, error: 'Note exceeds 280 characters' };
      return { ok: true, validated: { type: 'note', text: input.text } };
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
