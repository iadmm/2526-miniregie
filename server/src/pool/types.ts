// Internal pipeline types — not shared with clients

export interface RawFile {
  originalname: string;
  mimetype:     string;
  size:         number; // bytes
}

export type RawInput =
  | { type: 'note';      text: string }
  | { type: 'link';      url: string }
  | { type: 'photo';     file: RawFile }
  | { type: 'gif';       file: RawFile }
  | { type: 'clip';      file: RawFile }
  | { type: 'interview'; segments: Array<{ file: RawFile } | { textOnly: string }> }

export type ValidatedInput =
  | { type: 'note';      text: string }
  | { type: 'link';      url: string }
  | { type: 'photo';     mimetype: string; size: number }
  | { type: 'gif';       mimetype: string; size: number }
  | { type: 'clip';      mimetype: string; size: number } // duration checked by ffprobe in RESOLVE
  | { type: 'interview'; segments: Array<{ mimetype: string; size: number } | { textOnly: string }> }

export type SanitizeResult =
  | { ok: true;  validated: ValidatedInput }
  | { ok: false; error: string }
