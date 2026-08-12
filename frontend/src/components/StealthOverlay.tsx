import { useEffect, useRef } from "react";

/**
 * Fake "code editor" overlay to disguise reading as work.
 * Shown when stealth mode is active (Esc / Space toggle).
 */
const LINES = [
  "import { useState, useEffect } from 'react';",
  "import type { Comic } from './types';",
  "",
  "export function useComicReader(initial: Comic | null) {",
  "  const [comic, setComic] = useState(initial);",
  "  const [page, setPage] = useState(1);",
  "",
  "  useEffect(() => {",
  "    if (!comic) return;",
  "    const stored = localStorage.getItem(`cr:page:${comic.path}`);",
  "    if (stored) setPage(Number(stored));",
  "  }, [comic]);",
  "",
  "  const next = () => setPage((p) => p + 1);",
  "  const prev = () => setPage((p) => Math.max(1, p - 1));",
  "",
  "  return { comic, page, next, prev, setComic };",
  "}",
  "",
  "// TODO: refactor pagination logic into a dedicated hook",
  "// REVIEW: ensure progress is saved on unmount as well",
  "export default useComicReader;",
];

export default function StealthOverlay({
  visible,
  onExit,
}: {
  visible: boolean;
  onExit: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible) return;
    // Catch key so the underlying reader doesn't also react.
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.code === "Space") {
        e.preventDefault();
        e.stopPropagation();
        onExit();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [visible, onExit]);

  if (!visible) return null;

  return (
    <div
      ref={ref}
      className="fixed inset-0 z-50 flex bg-[#1e1e1e] font-mono text-[13px] leading-5 text-[#d4d4d4]"
      onClick={onExit}
    >
      {/* gutter */}
      <div className="select-none bg-[#1e1e1e] px-2 pt-3 text-right text-[#858585]">
        {LINES.map((_, i) => (
          <div key={i}>{i + 1}</div>
        ))}
      </div>
      <div className="flex-1 overflow-hidden pt-3 pr-3">
        {LINES.map((line, i) => (
          <div key={i} className="whitespace-pre">
            <span className="text-[#569cd6]">
              {line.startsWith("import") || line.startsWith("export") ? "" : ""}
            </span>
            {colorize(line)}
          </div>
        ))}
        <div className="mt-1 inline-block h-4 w-2 animate-pulse bg-[#d4d4d4]" />
        <div className="mt-4 text-[#6a9955]">
          // 按 Esc / 空格 返回阅读 · 点击空白处也可
        </div>
      </div>
    </div>
  );
}

function colorize(line: string) {
  // very light syntax tinting
  if (line.trim().startsWith("//")) {
    return <span className="text-[#6a9955]">{line}</span>;
  }
  if (line.startsWith("import") || line.startsWith("export")) {
    return <span className="text-[#569cd6]">{line}</span>;
  }
  return <span>{line}</span>;
}
