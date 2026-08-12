import { useEffect, useRef } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

interface Props {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  width: number; // target CSS width
  height: number; // target CSS height
  active: boolean; // render only when visible (lazy)
  onEnter?: (pageNumber: number) => void;
}

/**
 * Renders a single PDF page to a canvas.
 * - Reserves exact size from parent (no layout shift).
 * - Only paints when `active` is true (IntersectionObserver-driven).
 * - Cancels & clears when scrolled away to keep memory low.
 * - Renders at devicePixelRatio for crisp output.
 */
export default function PdfPage({
  pdf,
  pageNumber,
  width,
  height,
  active,
  onEnter,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);

  // Visibility reporting for current-page tracking (scroll mode).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !onEnter) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) onEnter(pageNumber);
        }
      },
      // thin band across the vertical center
      { root: null, rootMargin: "-45% 0px -45% 0px", threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [pageNumber, onEnter]);

  // Render / clear.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!active) {
      // free memory
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
        const cssW = width;
        const cssH = height;
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = cssW / baseViewport.width;
        const viewport = page.getViewport({ scale: scale * dpr });

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${cssW}px`;
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
        const task = page.render({
          canvasContext: ctx,
          viewport,
        });
        renderTaskRef.current = task;
        await task.promise;
      } catch (e: any) {
        if (e?.name !== "RenderingCancelledException") {
          // eslint-disable-next-line no-console
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
  }, [pdf, pageNumber, width, height, active]);

  return (
    <div
      ref={wrapRef}
      data-page={pageNumber}
      className="mx-auto my-2 flex items-center justify-center"
      style={{ width, height }}
    >
      <canvas ref={canvasRef} className="pdf-canvas" />
    </div>
  );
}
