import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

interface Props {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  width: number; // target CSS width
  estimatedHeight: number; // slot height until real dims known (page1 ratio * width)
  active: boolean; // render only when visible (lazy)
  onEnter?: (pageNumber: number) => void;
  onReady?: (pageNumber: number, height: number) => void;
}

/**
 * Renders a single PDF page to a canvas.
 * - Slot reserves `estimatedHeight` until the page's real ratio is known,
 *   then snaps to the real height (no distortion — canvas always uses the
 *   page's true aspect ratio).
 * - Only paints when `active` is true (IntersectionObserver-driven window).
 * - Cancels & clears when scrolled away to keep memory low.
 */
export default function PdfPage({
  pdf,
  pageNumber,
  width,
  estimatedHeight,
  active,
  onEnter,
  onReady,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const [actualH, setActualH] = useState<number | null>(null);

  // current-page tracking (scroll mode)
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !onEnter) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) onEnter(pageNumber);
        }
      },
      { root: null, rootMargin: "-45% 0px -45% 0px", threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [pageNumber, onEnter]);

  const slotHeight = actualH ?? estimatedHeight;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!active) {
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          /* noop */
        }
        renderTaskRef.current = null;
      }
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.width = 0;
      canvas.height = 0;
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const page = await pdf.getPage(pageNumber);
        if (cancelled) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        const base = page.getViewport({ scale: 1 });
        const scale = width / base.width; // CSS scale
        const cssH = base.height * scale; // true CSS height for this width
        if (actualH === null || Math.abs(cssH - actualH) > 1) {
          setActualH(cssH);
          onReady?.(pageNumber, cssH);
        }
        const viewport = page.getViewport({ scale: scale * dpr });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${cssH}px`;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch {
            /* noop */
          }
        }
        const task = page.render({ canvasContext: ctx, viewport });
        renderTaskRef.current = task;
        await task.promise;
      } catch (e: any) {
        if (e?.name !== "RenderingCancelledException") {
          console.warn("render page failed", pageNumber, e);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          /* noop */
        }
        renderTaskRef.current = null;
      }
    };
  }, [pdf, pageNumber, width, active]);

  return (
    <div
      ref={wrapRef}
      data-page={pageNumber}
      className="mx-auto my-2 flex items-center justify-center"
      style={{ width, height: slotHeight }}
    >
      <canvas ref={canvasRef} className="pdf-canvas" />
    </div>
  );
}
