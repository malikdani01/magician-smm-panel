import { createFileRoute } from "@tanstack/react-router";
import { readMarketFile } from "@/lib/market.server";

export const Route = createFileRoute("/api/market-file/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const file = await readMarketFile(String(params.id || ""));
        if (!file) return new Response("Not found", { status: 404 });
        return new Response(new Uint8Array(file.bytes), {
          headers: {
            "content-type": file.mime,
            "content-disposition": `inline; filename="${file.name.replace(/"/g, "")}"`,
            "cache-control": "private, max-age=86400",
          },
        });
      },
    },
  },
});
