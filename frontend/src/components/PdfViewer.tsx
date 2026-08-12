import { useCallback, useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { PDFDocumentProxy } from "pdfjs-dist";
import PdfPage from "./PdfPage";
import { loadProgress, saveProgress } from "../storage";
import type { ReadMode } from "../types";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

interface Props {
  url: string;
  comicPath: string;
  onClose: () => void;
  onRequestStealth: () => void;
}

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.15;

export default function PdfViewer({
  url,
  comicPath,
  onClose,
  onRequestStealth,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number }[]>([]);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [mode, setMode] = useState<ReadMode>("scroll");
  const [zoom, setZoom] = useState(1);
  const [fit, setFit] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toolbarVisible, setToolbarVisible] = useState(true);

  // ---- load PDF ----
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPdf(null);
    setDims([]);
    setNumPages(0);

    const startPage = loadProgress(comicPath);

    (async () => {
      try {
        const doc = await pdfjsLib.getDocument({
          url,
          // range requests handled natively by the backend
          disableAutoFetch: false,
          disableStream: false,
        }).promise;
        if (cancelled) {
          try {
            doc.destroy();
          } catch {
            /* noop */
          }
          return;
        }
        setPdf(doc);
        setNumPages(doc.numPages);

        // preload page dimensions progressively for stable layout
        const all: { w: number; h: number }[] = [];
        for (let i = 1; i <= doc.numPages; i++) {
          if (cancelled) return;
          const p = await doc.getPage(i);
          const v = p.getViewport({ scale: 1 });
          all[i - 1] = { w: v.width, h: v.height };
          setDims([...all]);
        }
        const clampedStart = Math.min(Math.max(1, startPage), doc.numPages);
        setPage(clampedStart);
        setLoading(false);
        // jump to saved page after layout settles
        requestAnimationFrame(() => {
          jumpToPage(clampedStart);
        });
      } catch (e: any) {
        if (cancelled) return;
        console.error(e);
        setError(e?.message || "加载 PDF 失败");
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, comicPath]);

  // ---- container width (for fit / sizing) ----
  const [containerW, setContainerW] = useState(900);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setContainerW(el.clientWidth);
    });
    ro.observe(el);
    setContainerW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // compute display width per page based on zoom / fit
  const baseWidth = containerW - 32; // padding
  const displayWidth = (() => {
    if (mode === "single") {
      // single: fit to height-ish width, but allow zoom
      const w = fit ? Math.min(baseWidth, 1000) : baseWidth * zoom;
      return Math.max(200, w);
    }
    // scroll: zoom multiplies base width
    return Math.max(200, baseWidth * zoom);
  })();

  // per-page height at display scale
  const heightFor = useCallback(
    (i: number) => {
      const d = dims[i];
      if (!d) return displayWidth * 1.4;
      return (d.h / d.w) * displayWidth;
    },
    [dims, displayWidth]
  );

  // ---- progress save (debounced) ----
  useEffect(() => {
    if (!pdf || page < 1) return;
    const t = setTimeout(() => saveProgress(comicPath, page), 400);
    return () => clearTimeout(t);
  }, [page, comicPath, pdf]);

  // save on unmount
  useEffect(() => {
    return () => {
      if (numPages > 0) saveProgress(comicPath, page);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comicPath]);

  // ---- navigation ----
  const jumpToPage = useCallback(
    (n: number) => {
      const target = Math.min(Math.max(1, n), Math.max(1, numPages));
      setPage(target);
      if (mode === "scroll") {
        const el = scrollRef.current?.querySelector(
          `[data-page="${target}"]`
        ) as HTMLElement | null;
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    },
    [mode, numPages]
  );

  const next = useCallback(
    () => jumpToPage(page + 1),
    [jumpToPage, page]
  );
  const prev = useCallback(
    () => jumpToPage(page - 1),
    [jumpToPage, page]
  );

  // ---- toolbar auto-hide ----
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let timer: number | undefined;
    const show = () => {
      setToolbarVisible(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setToolbarVisible(false), 2600);
    };
    el.addEventListener("mousemove", show);
    el.addEventListener("touchstart", show, { passive: true });
    show();
    return () => {
      el.removeEventListener("mousemove", show);
      el.removeEventListener("touchstart", show);
      window.clearTimeout(timer);
    };
  }, []);

  // ---- keyboard ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      switch (e.key) {
        case "ArrowRight":
        case "d":
          if (mode === "single") {
            e.preventDefault();
            next();
          }
          break;
        case "ArrowLeft":
        case "a":
          if (mode === "single") {
            e.preventDefault();
            prev();
          }
          break;
        case "ArrowDown":
        case " ":
          if (mode === "scroll") {
            // let default scroll happen
          }
          break;
        case "+":
        case "=":
          e.preventDefault();
          setFit(false);
          setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)));
          break;
        case "-":
        case "_":
          e.preventDefault();
          setFit(false);
          setZoom((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)));
          break;
        case "f":
        case "F":
          toggleFullscreen();
          break;
        case "m":
        case "M":
          setMode((m) => (m === "scroll" ? "single" : "scroll"));
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, next, prev]);

  // ---- fullscreen ----
  const [isFs, setIsFs] = useState(false);
  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().then(() => setIsFs(true)).catch(() => {});
    } else {
      document.exitFullscreen?.();
    }
  }, []);
  useEffect(() => {
    const onFs = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const zoomIn = () => {
    setFit(false);
    setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)));
  };
  const zoomOut = () => {
    setFit(false);
    setZoom((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)));
  };
  const resetZoom = () => {
    setFit(true);
    setZoom(1);
  };

  // ---- rendering ----
  const onEnter = useCallback((n: number) => setPage(n), []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-neutral-400">
        <div className="animate-pulse text-lg">加载中…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-neutral-400">
        <div className="text-red-400">{error}</div>
        <button
          onClick={onClose}
          className="rounded bg-white/10 px-3 py-1 text-sm hover:bg-white/20"
        >
          返回列表
        </button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full bg-[#2b2b2b]"
      onWheel={(e) => {
        if (e.ctrlKey) {
          e.preventDefault();
          setFit(false);
          setZoom((z) =>
            Math.min(
              ZOOM_MAX,
              Math.max(ZOOM_MIN, +(z - e.deltaY * 0.002).toFixed(2))
            )
          );
        }
      }}
    >
      {/* ---- reader body ---- */}
      {mode === "scroll" ? (
        <div
          ref={scrollRef}
          className="scroll-thin h-full overflow-y-auto px-4 py-2"
        >
          {pdf &&
            Array.from({ length: numPages }, (_, i) => i + 1).map((n) => {
              const idx = n - 1;
              const active = Math.abs(n - page) <= 2;
              return (
                <PdfPage
                  key={n}
                  pdf={pdf}
                  pageNumber={n}
                  width={displayWidth}
                  height={heightFor(idx)}
                  active={active}
                  onEnter={onEnter}
                />
              );
            })}
          <div className="h-12" />
        </div>
      ) : (
        <div className="relative h-full w-full select-none">
          {pdf && (
            <PdfPage
              key={page}
              pdf={pdf}
              pageNumber={page}
              width={displayWidth}
              height={heightFor(page - 1)}
              active={true}
            />
          )}
          {/* click zones */}
          <button
            aria-label="上一页"
            onClick={prev}
            disabled={page <= 1}
            className="absolute left-0 top-0 h-full w-[28%] cursor-w-resize disabled:opacity-0"
          />
          <button
            aria-label="下一页"
            onClick={next}
            disabled={page >= numPages}
            className="absolute right-0 top-0 h-full w-[28%] cursor-e-resize disabled:opacity-0"
          />
        </div>
      )}

      {/* ---- auto-hide toolbar ---- */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 z-30 transition-opacity duration-300 ${
          toolbarVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="pointer-events-auto mx-auto mt-2 flex max-w-3xl items-center gap-2 rounded-xl border border-white/10 bg-[#1f1f1f]/95 px-3 py-2 text-sm text-neutral-200 shadow-lg backdrop-blur">
          <button
            onClick={onClose}
            className="rounded px-2 py-1 hover:bg-white/10"
            title="返回列表"
          >
            ‹ 返回
          </button>
          <div className="mx-1 h-5 w-px bg-white/10" />

          <button
            onClick={prev}
            disabled={page <= 1}
            className="rounded px-2 py-1 hover:bg-white/10 disabled:opacity-40"
            title="上一页 (←)"
          >
            ◀
          </button>
          <div className="tabular-nums">
            <input
              type="number"
              value={page}
              min={1}
              max={numPages || 1}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!Number.isNaN(v)) jumpToPage(v);
              }}
              className="w-12 rounded bg-black/40 px-1 py-0.5 text-center outline-none"
            />
            <span className="mx-1 text-neutral-500">/ {numPages}</span>
          </div>
          <button
            onClick={next}
            disabled={page >= numPages}
            className="rounded px-2 py-1 hover:bg-white/10 disabled:opacity-40"
            title="下一页 (→)"
          >
            ▶
          </button>

          <div className="mx-1 h-5 w-px bg-white/10" />

          <button
            onClick={zoomOut}
            className="rounded px-2 py-1 hover:bg-white/10"
            title="缩小 (-)"
          >
            －
          </button>
          <button
            onClick={resetZoom}
            className="w-14 rounded px-1 py-1 text-center tabular-nums hover:bg-white/10"
            title="重置缩放"
          >
            {Math.round((fit ? 1 : zoom) * 100)}%
          </button>
          <button
            onClick={zoomIn}
            className="rounded px-2 py-1 hover:bg-white/10"
            title="放大 (+)"
          >
            ＋
          </button>

          <div className="mx-1 h-5 w-px bg-white/10" />

          <button
            onClick={() => setMode((m) => (m === "scroll" ? "single" : "scroll"))}
            className="rounded px-2 py-1 hover:bg-white/10"
            title="切换模式 (M)"
          >
            {mode === "scroll" ? "连续" : "单页"}
          </button>
          <button
            onClick={toggleFullscreen}
            className="rounded px-2 py-1 hover:bg-white/10"
            title="全屏 (F)"
          >
            {isFs ? "⤢" : "⛶"}
          </button>
          <button
            onClick={onRequestStealth}
            className="rounded px-2 py-1 text-neutral-400 hover:bg-white/10 hover:text-white"
            title="摸鱼模式 (Esc / 空格)"
          >
            🕶
          </button>
        </div>
      </div>

      {/* ---- hint footer ---- */}
      <div
        className={`pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/40 px-3 py-1 text-xs text-neutral-400 transition-opacity duration-300 ${
          toolbarVisible ? "opacity-0" : "opacity-100"
        }`}
      >
        {page} / {numPages}
      </div>
    </div>
  );
}
