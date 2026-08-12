/**
 * localStorage progress persistence.
 * Keyed by comic relative path -> last page number (1-based).
 */

const KEY_PREFIX = "cr:page:";

export function saveProgress(path: string, page: number): void {
  try {
    localStorage.setItem(KEY_PREFIX + path, String(page));
  } catch {
    /* ignore quota errors */
  }
}

export function loadProgress(path: string): number {
  try {
    const v = localStorage.getItem(KEY_PREFIX + path);
    return v ? Math.max(1, parseInt(v, 10) || 1) : 1;
  } catch {
    return 1;
  }
}
