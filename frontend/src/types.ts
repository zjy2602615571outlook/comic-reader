export interface Comic {
  path: string;
  name: string;
  size: number;
  modified: string;
  dir: string;
}

export interface ComicListResponse {
  total: number;
  comics: Comic[];
}

export type ReadMode = "scroll" | "single";
