import { createFileRoute } from "@tanstack/react-router";
import { sitemapText } from "@/lib/seo.server";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const body = await sitemapText(new URL(request.url).origin);
        return new Response(body, {
          headers: {
            "content-type": "application/xml; charset=utf-8",
            "cache-control": "public, max-age=300",
          },
        });
      },
    },
  },
});
