/**
 * Comic Reader — Cloudflare Worker reverse proxy.
 * - /api/*  -> forwarded to BACKEND_ORIGIN (stream + range aware)
 * - /health -> forwarded to BACKEND_ORIGIN
 * - everything else -> served from ASSETS (built SPA)
 */

interface Env {
  ASSETS: Fetcher;
  BACKEND_ORIGIN: string;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    // API + health pass-through to the backend.
    if (url.pathname.startsWith("/api/") || url.pathname === "/health") {
      const origin = env.BACKEND_ORIGIN;
      if (!origin) {
        return new Response("BACKEND_ORIGIN not configured", { status: 502 });
      }
      const target = new URL(url.pathname + url.search, origin);
      // Build a streaming request preserving method/headers/body.
      const init: RequestInit = {
        method: req.method,
        headers: req.headers,
        redirect: "manual",
      };
      if (req.method !== "GET" && req.method !== "HEAD") {
        init.body = req.body;
        // @ts-expect-error duplex is required for streaming body in Workers
        init.duplex = "half";
      }
      try {
        const upstream = await fetch(new Request(target, req), init);
        // Re-stream the response back.
        return new Response(upstream.body, {
          status: upstream.status,
          statusText: upstream.statusText,
          headers: upstream.headers,
        });
      } catch (e: any) {
        return new Response(`upstream error: ${e?.message || e}`, {
          status: 502,
        });
      }
    }

    // Static assets (SPA, with not_found_handling = single-page-application in toml).
    return env.ASSETS.fetch(req);
  },
};
