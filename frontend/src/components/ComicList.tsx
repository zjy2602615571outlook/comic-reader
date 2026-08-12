import { useMemo, useState } from "react";
import type { Comic } from "../types";
import { formatBytes } from "../api";

interface Props {
  comics: Comic[];
  currentPath: string | null;
  onSelect: (c: Comic) => void;
  onClose?: () => void;
}

export default function ComicList({
  comics,
  currentPath,
  onSelect,
  onClose,
}: Props) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return comics;
    return comics.filter((c) => c.path.toLowerCase().includes(term));
  }, [q, comics]);

  return (
    <div className="flex h-full flex-col bg-[#1f1f1f] text-neutral-200">
      <div className="flex items-center gap-2 border-b border-white/10 p-2">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索漫画…"
          className="min-w-0 flex-1 rounded bg-black/40 px-2 py-1 text-sm outline-none placeholder:text-neutral-500 focus:ring-1 focus:ring-white/30"
        />
        {onClose && (
          <button
            onClick={onClose}
            className="rounded px-2 py-1 text-sm text-neutral-400 hover:bg-white/10 hover:text-white"
            title="收起列表 (L)"
          >
            ✕
          </button>
        )}
      </div>
      <div className="scroll-thin flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="p-3 text-center text-sm text-neutral-500">
            {comics.length === 0 ? "未找到 PDF 漫画" : "无匹配结果"}
          </div>
        )}
        <ul className="py-1">
          {filtered.map((c) => {
            const active = c.path === currentPath;
            return (
              <li key={c.path}>
                <button
                  onClick={() => onSelect(c)}
                  className={`w-full px-3 py-2 text-left text-sm transition ${
                    active
                      ? "bg-white/15 text-white"
                      : "hover:bg-white/10 text-neutral-300"
                  }`}
                >
                  <div className="truncate font-medium">{c.name}</div>
                  <div className="mt-0.5 flex items-center justify-between text-xs text-neutral-500">
                    <span className="truncate">{c.dir || "/"}</span>
                    <span className="ml-2 shrink-0">{formatBytes(c.size)}</span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="border-t border-white/10 p-2 text-center text-xs text-neutral-500">
        共 {filtered.length} / {comics.length} 本
      </div>
    </div>
  );
}
