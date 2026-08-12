import { useCallback, useEffect, useState } from "react";
import ComicList from "./components/ComicList";
import PdfViewer from "./components/PdfViewer";
import StealthOverlay from "./components/StealthOverlay";
import { fetchComics, comicStreamUrl } from "./api";
import type { Comic } from "./types";

export default function App() {
  const [comics, setComics] = useState<Comic[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [current, setCurrent] = useState<Comic | null>(null);
  const [listOpen, setListOpen] = useState(true);
  const [stealth, setStealth] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const list = await fetchComics();
      setComics(list);
    } catch (e: any) {
      setErr(e?.message || "加载列表失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ---- stealth toggle: Esc / Space (capture, so it wins over reader) ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "Escape") {
        if (current) {
          e.preventDefault();
          e.stopPropagation();
          setStealth((s) => !s);
        }
        return;
      }
      if (e.code === "Space" || e.key === " ") {
        if (current) {
          e.preventDefault();
          e.stopPropagation();
          setStealth((s) => !s);
        }
        return;
      }
      if (e.key === "l" || e.key === "L") {
        e.preventDefault();
        e.stopPropagation();
        setListOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [current]);

  const selectComic = useCallback((c: Comic) => {
    setCurrent(c);
    setStealth(false);
  }, []);

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* sidebar */}
      <aside
        className={`h-full shrink-0 border-r border-white/10 transition-[width] duration-200 ${
          listOpen ? "w-72" : "w-0"
        } overflow-hidden`}
      >
        <div className="h-full w-72">
          <ComicList
            comics={comics}
            currentPath={current?.path ?? null}
            onSelect={selectComic}
            onClose={() => setListOpen(false)}
          />
        </div>
      </aside>

      {/* main */}
      <main className="relative flex h-full flex-1 flex-col">
        {/* top strip */}
        <div className="flex h-9 items-center gap-2 border-b border-white/10 bg-[#222] px-2 text-xs text-neutral-400">
          <button
            onClick={() => setListOpen((v) => !v)}
            className="rounded px-2 py-1 hover:bg-white/10"
            title="切换列表 (L)"
          >
            {listOpen ? "☰ 隐藏列表" : "☰ 显示列表"}
          </button>
          <span className="truncate">
            {current ? current.name : "钉钉文档"}
          </span>
          <span className="ml-auto">
            <button
              onClick={load}
              className="rounded px-2 py-1 hover:bg-white/10"
              title="刷新"
            >
              ⟳
            </button>
            <button
              onClick={() => setStealth(true)}
              className="ml-1 rounded px-2 py-1 hover:bg-white/10"
              title="摸鱼模式 (Esc/空格)"
            >
              🕶 摸鱼
            </button>
          </span>
        </div>

        <div className="relative flex-1 overflow-hidden">
          {loading ? (
            <div className="flex h-full items-center justify-center text-neutral-500">
              加载漫画列表…
            </div>
          ) : err ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-neutral-400">
              <div className="text-red-400">{err}</div>
              <button
                onClick={load}
                className="rounded bg-white/10 px-3 py-1 hover:bg-white/20"
              >
                重试
              </button>
            </div>
          ) : !current ? (
            <div className="flex h-full items-center justify-center text-neutral-500">
              {comics.length === 0
                ? "未发现文档，请将 .pdf 放入 comics 目录后刷新"
                : "从左侧选择一份文档打开"}
            </div>
          ) : (
            <PdfViewer
              key={current.path}
              url={comicStreamUrl(current.path)}
              comicPath={current.path}
              onClose={() => setCurrent(null)}
              onRequestStealth={() => setStealth(true)}
            />
          )}
        </div>
      </main>

      {/* stealth overlay (topmost) */}
      <StealthOverlay visible={stealth} onExit={() => setStealth(false)} />
    </div>
  );
}
