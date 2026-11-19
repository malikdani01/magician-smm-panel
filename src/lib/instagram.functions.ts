import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { requireAdmin } from "@/lib/admin.server";
import { getSql } from "@/lib/db";

export const listInstagramConnections = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    const rows = await sql<{ id: string; username: string; ig_user_id: string; expires_at: string | null }>`
      select id, username, ig_user_id, expires_at::text as expires_at
      from instagram_oauth
      where user_id = ${context.userId}
      order by created_at desc
    `;
    return {
      ready: Boolean(process.env.INSTAGRAM_APP_ID?.trim() && process.env.INSTAGRAM_APP_SECRET?.trim()),
      accounts: rows,
    };
  });
