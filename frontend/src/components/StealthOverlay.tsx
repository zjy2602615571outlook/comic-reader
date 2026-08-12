import { useMemo } from "react";

/**
 * A convincing VS Code-style disguise overlay (摸鱼 mode).
 * Fills the whole viewport with a busy editor: title bar, activity bar,
 * file explorer, tab bar, line-numbered syntax-highlighted code, status bar.
 * Toggle off with Esc / Space (handled in App).
 */

const KEYWORDS = new Set([
  "import", "export", "from", "const", "let", "var", "function", "return",
  "if", "else", "for", "while", "do", "new", "await", "async", "extends",
  "implements", "interface", "type", "class", "default", "true", "false",
  "null", "undefined", "void", "this", "typeof", "instanceof", "in", "of",
  "try", "catch", "finally", "throw", "break", "continue", "switch", "case",
  "public", "private", "protected", "readonly", "static", "enum", "namespace",
  "as", "satisfies",
]);
const CONTROL = new Set([
  "if", "else", "for", "while", "do", "return", "await", "async", "try",
  "catch", "finally", "throw", "break", "continue", "switch", "case", "new",
]);
const TYPE_RE = /^[A-Z][A-Za-z0-9_]*$/;

const TOKEN_RE =
  /(\/\/.*$)|(`(?:\\.|[^`])*`|"(?:\\.|[^"])*"|'(?:\\.|[^'])*')|([A-Za-z_$][\w$]*)|(\d+(?:\.\d+)?)|([{}()[\]<>;,=:?.&|*+\-/!%])/g;

function colorize(line: string, base: string) {
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(line)) !== null) {
    if (m.index > last) {
      out.push(<span key={base + "p" + k++}>{line.slice(last, m.index)}</span>);
    }
    const tok = m[0];
    let cls = "text-[#d4d4d4]";
    if (m[1]) cls = "text-[#6a9955]";
    else if (m[2]) cls = "text-[#ce9178]";
    else if (m[3]) {
      const id = m[3];
      if (KEYWORDS.has(id)) {
        cls = CONTROL.has(id) ? "text-[#c586c0]" : "text-[#569cd6]";
      } else if (TYPE_RE.test(id)) {
        cls = "text-[#4ec9b0]";
      } else if (line[TOKEN_RE.lastIndex] === "(") {
        cls = "text-[#dcdcaa]";
      } else {
        cls = "text-[#9cdcfe]";
      }
    } else if (m[4]) cls = "text-[#b5cea8]";
    else if (m[5]) cls = "text-[#d4d4d4]";
    out.push(
      <span key={base + "t" + k++} className={cls}>
        {tok}
      </span>
    );
    last = TOKEN_RE.lastIndex;
  }
  if (last < line.length) {
    out.push(<span key={base + "e" + k}>{line.slice(last)}</span>);
  }
  return out;
}

const CODE = `import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Comic, ReadMode } from "../types";
import { fetchComics, comicStreamUrl, formatBytes } from "../api";
import { loadProgress, saveProgress } from "../storage";

interface ReaderState {
  comics: Comic[];
  current: Comic | null;
  page: number;
  mode: ReadMode;
  zoom: number;
  loading: boolean;
  error: string | null;
}

const DEFAULT_STATE: ReaderState = {
  comics: [],
  current: null,
  page: 1,
  mode: "scroll",
  zoom: 1,
  loading: true,
  error: null,
};

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;

// Central hook that owns all reader state and persistence.
export function useReaderState() {
  const [state, setState] = useState<ReaderState>(DEFAULT_STATE);
  const persistTimer = useRef<number | undefined>(undefined);

  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const comics = await fetchComics();
      comics.sort((a, b) => a.name.localeCompare(b.name, "zh"));
      setState((s) => ({ ...s, comics, loading: false }));
    } catch (e: any) {
      const message = e?.message ?? "failed to load comic list";
      setState((s) => ({ ...s, loading: false, error: message }));
    }
  }, []);

  const open = useCallback((comic: Comic) => {
    const restored = loadProgress(comic.path);
    setState((s) => ({ ...s, current: comic, page: restored, error: null }));
  }, []);

  const setPage = useCallback((next: number) => {
    setState((s) => {
      const page = Math.min(Math.max(1, next), 9999);
      return { ...s, page };
    });
  }, []);

  const setMode = useCallback((mode: ReadMode) => {
    setState((s) => ({ ...s, mode }));
  }, []);

  const setZoom = useCallback((delta: number) => {
    setState((s) => {
      const zoom = Math.min(
        ZOOM_MAX,
        Math.max(ZOOM_MIN, +(s.zoom + delta).toFixed(2))
      );
      return { ...s, zoom };
    });
  }, []);

  const close = useCallback(() => {
    setState((s) => ({ ...s, current: null }));
  }, []);

  // Debounced progress persistence per comic path.
  useEffect(() => {
    const { current } = state;
    if (!current) return;
    window.clearTimeout(persistTimer.current);
    persistTimer.current = window.setTimeout(() => {
      saveProgress(current.path, state.page);
    }, 400);
    return () => window.clearTimeout(persistTimer.current);
  }, [state.current, state.page]);

  // Initial list load on mount only.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const url = useMemo(
    () => (state.current ? comicStreamUrl(state.current.path) : null),
    [state.current]
  );

  const total = state.comics.length;
  const sizeLabel = state.current ? formatBytes(state.current.size) : "";

  return {
    ...state,
    url,
    total,
    sizeLabel,
    refresh,
    open,
    setPage,
    setMode,
    setZoom,
    close,
  };
}

// Helper used by the list footer to render a stable summary.
export function describe(comic: Comic): string {
  return \`\${comic.name} · \${formatBytes(comic.size)}\`;
}

// TODO: extract zoom logic into a dedicated reducer for testability.
// REVIEW: ensure progress is flushed on tab close as well as on unmount.
`;

const LINES = CODE.split("\n");

const FILES = [
  { name: "App.tsx", depth: 1 },
  { name: "main.tsx", depth: 1 },
  { name: "index.css", depth: 1 },
  { name: "hooks", depth: 1, dir: true },
  { name: "useReaderState.ts", depth: 2, active: true },
  { name: "useStealth.ts", depth: 2 },
  { name: "components", depth: 1, dir: true },
  { name: "ComicList.tsx", depth: 2 },
  { name: "PdfViewer.tsx", depth: 2 },
  { name: "StealthOverlay.tsx", depth: 2 },
  { name: "api.ts", depth: 1 },
  { name: "storage.ts", depth: 1 },
  { name: "types.ts", depth: 1 },
];

function FileTree() {
  return (
    <div className="text-[12px] leading-5 text-[#cccccc]/80">
      <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#cccccc]/60">
        Explorer
      </div>
      <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#cccccc]/60">
        Comic-Reader
      </div>
      {FILES.map((f, i) => (
        <div
          key={i}
          className={`flex items-center gap-1 px-2 ${
            f.active ? "bg-[#37373d] text-white" : "hover:bg-[#2a2d2e]"
          }`}
          style={{ paddingLeft: `${8 + f.depth * 12}px` }}
        >
          <span className="text-[#90a4ae]">{f.dir ? "▾" : "·"}</span>
          <span className={f.dir ? "text-[#c5c5c5]" : "text-[#9cdcfe]"}>
            {f.name}
          </span>
        </div>
      ))}
    </div>
  );
}

function ActivityBar() {
  const icons = [
    { i: "▤", t: "Explorer" },
    { i: "⌕", t: "Search" },
    { i: "⑂", t: "Source Control" },
    { i: "▶", t: "Run" },
    { i: "▦", t: "Extensions" },
  ];
  return (
    <div className="flex w-12 shrink-0 flex-col items-center gap-5 bg-[#333333] pt-2 text-[18px] text-[#858585]">
      {icons.map((x, i) => (
        <div
          key={i}
          className={`flex h-10 w-12 items-center justify-center ${
            i === 0 ? "border-l-2 border-white text-white" : "hover:text-white"
          }`}
          title={x.t}
        >
          {x.i}
        </div>
      ))}
    </div>
  );
}

export default function StealthOverlay({
  visible,
  onExit,
}: {
  visible: boolean;
  onExit: () => void;
}) {
  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[#1e1e1e] text-[#d4d4d4]"
      style={{
        fontFamily:
          "'Cascadia Code','Fira Code',Consolas,'Courier New',monospace",
      }}
    >
      {/* Title bar */}
      <div className="flex h-8 shrink-0 items-center bg-[#3c3c3c] text-[12px] text-[#cccccc]">
        <div className="flex items-center gap-3 pl-3 pr-4">
          <span className="text-[#9cdcfe]">●</span>
          <span>File</span>
          <span>Edit</span>
          <span>Selection</span>
          <span>View</span>
          <span>Go</span>
          <span>Run</span>
          <span>Terminal</span>
          <span>Help</span>
        </div>
        <div className="flex flex-1 items-center justify-center gap-2 opacity-80">
          <span className="text-[#cccccc]/70">comic-reader</span>
          <span className="text-[#cccccc]/40">—</span>
          <span>useReaderState.ts</span>
        </div>
        <div className="flex items-center gap-4 pr-4 text-[#cccccc]/70">
          <span>—</span>
          <span>▢</span>
          <span>✕</span>
        </div>
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1">
        <ActivityBar />
        <div className="w-56 shrink-0 overflow-y-auto border-r border-black/30 bg-[#252526]">
          <FileTree />
        </div>

        {/* Editor */}
        <div className="flex min-w-0 flex-1 flex-col bg-[#1e1e1e]">
          {/* Tabs */}
          <div className="flex h-9 shrink-0 items-center bg-[#2d2d2d] text-[12px]">
            <div className="flex h-full items-center gap-2 border-r border-black/30 bg-[#1e1e1e] px-4 text-[#cccccc]">
              <span className="text-[#519aba]">•</span>
              <span>useReaderState.ts</span>
              <span className="ml-2 text-[#cccccc]/50">×</span>
            </div>
            <div className="flex h-full items-center gap-2 px-4 text-[#cccccc]/60">
              <span className="text-[#519aba]">•</span>
              <span>PdfViewer.tsx</span>
              <span className="ml-2 text-[#cccccc]/40">×</span>
            </div>
          </div>

          {/* Code area: fills remaining height, scrolls internally */}
          <div className="min-h-0 flex-1 overflow-y-auto bg-[#1e1e1e] px-2 py-2 text-[13px] leading-5">
            {LINES.map((line, i) => (
              <div key={i} className="flex">
                <span className="w-12 shrink-0 select-none pr-4 text-right text-[#858585]">
                  {i + 1}
                </span>
                <span className="whitespace-pre">
                  {line === "" ? "\u00A0" : colorize(line, "l" + i)}
                </span>
              </div>
            ))}
          </div>

          {/* Status bar */}
          <div
            className="flex h-6 shrink-0 items-center gap-4 px-3 text-[12px] text-white/90"
            style={{ background: "#007acc" }}
          >
            <span>⑂ main</span>
            <span className="opacity-80">0↑ 1↓</span>
            <span className="ml-1">Ln {LINES.length - 6}, Col 18</span>
            <span className="opacity-80">Spaces: 2</span>
            <span className="opacity-80">UTF-8</span>
            <span>TypeScript</span>
            <span className="ml-auto cursor-pointer opacity-90" onClick={onExit} title="返回阅读 (Esc / 空格)">
              按 Esc 返回
            </span>
            <span>🔔</span>
          </div>
        </div>
      </div>
    </div>
  );
}
