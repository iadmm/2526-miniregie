// Internal pipeline types — not shared with clients

export interface RawFile {
  originalname: string;
  mimetype:     string;
  size:         number; // bytes
}

export type RawInput =
  | { type: 'note';      text: string }
  | { type: 'ticker';    text: string }
  | { type: 'link';      url: string }
  | { type: 'youtube';   url: string }
  | { type: 'giphy';     url: string }
  | { type: 'photo';     file: RawFile; filePath?: string }
  | { type: 'gif';       file: RawFile; filePath?: string }
  | { type: 'clip';      file: RawFile; filePath?: string }
  | { type: 'interview'; segments: Array<{ file: RawFile; filePath?: string } | { textOnly: string }> }

export type ValidatedInput =
  | { type: 'note';      text: string }
  | { type: 'ticker';    text: string }
  | { type: 'link';      url: string }
  | { type: 'youtube';   url: string; youtubeId: string; caption?: string }
  | { type: 'giphy';     url: string; giphyId: string;   caption?: string }
  | { type: 'photo';     mimetype: string; size: number }
  | { type: 'photo-url'; url: string; caption?: string } // direct link to image file
  | { type: 'gif';       mimetype: string; size: number }
  | { type: 'gif-url';   url: string; caption?: string } // direct link to GIF file
  | { type: 'clip';      mimetype: string; size: number } // duration checked by ffprobe in RESOLVE
  | { type: 'interview'; segments: Array<{ mimetype: string; size: number } | { textOnly: string }> }

export type SanitizeResult =
  | { ok: true;  validated: ValidatedInput }
  | { ok: false; error: string }
