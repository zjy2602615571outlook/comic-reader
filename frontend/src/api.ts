import type { Comic, ComicListResponse } from "./types";

const BASE = "";

export async function fetchComics(): Promise<Comic[]> {
  const r = await fetch(`${BASE}/api/comics`, {
    headers: { "x-client-platform": "web" },
  });
  if (!r.ok) throw new Error(`list failed: ${r.status}`);
  const data: ComicListResponse = await r.json();
  return data.comics;
}

/** Build the streaming URL for a given comic relative path. */
export function comicStreamUrl(relPath: string): string {
  const q = encodeURIComponent(relPath);
  return `${BASE}/api/comics/stream?path=${q}`;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
