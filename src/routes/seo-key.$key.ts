import { createFileRoute } from "@tanstack/react-router";
import { loadSeo } from "@/lib/seo.server";

export const Route = createFileRoute("/seo-key/$key")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const seo = await loadSeo();
        const key = String(params.key || "");
        if (!seo.indexNowKey || seo.indexNowKey !== key) {
          return new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
        }
        return new Response(seo.indexNowKey, {
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
