import { createFileRoute } from "@tanstack/react-router";
import { loadSeo, robotsText } from "@/lib/seo.server";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const seo = await loadSeo();
        const body = robotsText(new URL(request.url).origin, seo);
        return new Response(body, {
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "public, max-age=300",
          },
        });
      },
    },
  },
});
