"""
Comic Reader - FastAPI backend
Minimal, no-auth, read-only PDF comic server.

Endpoints:
  GET /api/comics                 -> recursive scan of COMICS_DIR for .pdf
  GET /api/comics/stream?path=... -> stream PDF with HTTP Range support
  GET /health                     -> {"status": "ok"}
"""

from __future__ import annotations

import os
import mimetypes
from datetime import datetime, timezone
from pathlib import Path
from typing import List

from fastapi import FastAPI, Header, Request, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

# --------------------------------------------------------------------------- #
# Config
# --------------------------------------------------------------------------- #
COMICS_DIR = Path(os.environ.get("COMICS_DIR", "/app/comics"))
PORT = int(os.environ.get("PORT", "8999"))

# Allowed client platforms (x-client-platform middleware). Empty = allow all.
ALLOWED_PLATFORMS = os.environ.get("ALLOWED_PLATFORMS", "web").split(",")
ALLOWED_PLATFORMS = [p.strip() for p in ALLOWED_PLATFORMS if p.strip()]


app = FastAPI(title="Comic Reader API", version="1.0.0")

# Permissive CORS: no auth, open access.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=[
        "Content-Type",
        "Content-Length",
        "Content-Range",
        "Accept-Ranges",
    ],
)


# --------------------------------------------------------------------------- #
# Middleware: x-client-platform check (soft). Empty ALLOWED_PLATFORMS = open.
# --------------------------------------------------------------------------- #
@app.middleware("http")
async def platform_guard(request: Request, call_next):
    if ALLOWED_PLATFORMS:
        platform = request.headers.get("x-client-platform", "")
        # Only enforce on /api routes; static/stream also covered.
        if platform and platform not in ALLOWED_PLATFORMS:
            return JSONResponse(
                status_code=403,
                content={"detail": f"platform '{platform}' not allowed"},
            )
    return await call_next(request)


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def _safe_resolve(rel_path: str) -> Path:
    """Resolve a relative path under COMICS_DIR, preventing traversal escapes."""
    if not rel_path:
        raise HTTPException(status_code=400, detail="path is required")
    # Normalize separators (incoming may use backslashes).
    rel_path = rel_path.replace("\\", "/").lstrip("/")
    base = COMICS_DIR.resolve()
    target = (base / rel_path).resolve()
    try:
        target.relative_to(base)
    except ValueError:
        raise HTTPException(status_code=403, detail="path outside comics root")
    return target


def scan_comics(root: Path) -> List[dict]:
    """Recursively find all .pdf files under root."""
    results: List[dict] = []
    if not root.exists():
        return results
    for p in sorted(root.rglob("*.pdf"), key=lambda x: str(x).lower()):
        if not p.is_file():
            continue
        rel = p.relative_to(root).as_posix()
        st = p.stat()
        results.append(
            {
                "path": rel,
                "name": p.name,
                "size": st.st_size,
                "modified": datetime.fromtimestamp(st.st_mtime, tz=timezone.utc).isoformat(),
                "dir": p.relative_to(root).parent.as_posix(),
            }
        )
    return results


# --------------------------------------------------------------------------- #
# Routes
# --------------------------------------------------------------------------- #
@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/api/comics")
async def list_comics():
    comics = scan_comics(COMICS_DIR)
    return {"total": len(comics), "comics": comics}


@app.get("/api/comics/stream")
async def stream_comic(path: str = Query(..., description="relative path to PDF")):
    target = _safe_resolve(path)
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="file not found")
    if target.suffix.lower() != ".pdf":
        raise HTTPException(status_code=400, detail="only .pdf allowed")

    media = mimetypes.guess_type(target.name)[0] or "application/pdf"
    # FileResponse natively supports Range requests (accepts Range header).
    return FileResponse(
        path=str(target),
        media_type=media,
        filename=target.name,
        stat_result=target.stat(),
    )


@app.get("/")
async def root():
    return {
        "service": "comic-reader-api",
        "docs": "/docs",
        "health": "/health",
        "comics": "/api/comics",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=PORT)
