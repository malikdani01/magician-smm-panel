import { createFileRoute } from "@tanstack/react-router";
import { readSupportFile } from "@/lib/support.server";

export const Route = createFileRoute("/api/support-file/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const file = await readSupportFile(String(params.id || ""));
        if (!file) return new Response("Not found", { status: 404 });
        return new Response(new Uint8Array(file.bytes), {
          headers: {
            "content-type": file.mime,
            "content-disposition": `inline; filename="${file.name}"`,
            "cache-control": "private, max-age=86400",
          },
        });
      },
    },
  },
});
