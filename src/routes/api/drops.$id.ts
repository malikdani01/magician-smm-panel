import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { listOrderDrops } from "@/lib/drip.server";
import { getSessionUser } from "@/lib/auth/verify.server";

export const Route = createFileRoute("/api/drops/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const user = await getSessionUser();
        if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
        const id = String(params.id || "");
        if (id.length < 8) return Response.json({ error: "Missing order" }, { status: 400 });
        const drops = await listOrderDrops(user.id, id);
        const sql = await getSql();
        const orders = await sql<{ status: string }>`select status from engagement_orders where id = ${id} and user_id = ${user.id}`;
        const placed = drops.filter((d) => d.status === "placed").length;
        console.log(`[drops] poll order ${id.slice(0, 8)} → ${drops.length} runs, ${placed} placed`);
        return Response.json(
          { drops, status: orders[0]?.status ?? "processing", at: Date.now() },
          { headers: { "cache-control": "no-store, max-age=0" } },
        );
      },
    },
  },
});