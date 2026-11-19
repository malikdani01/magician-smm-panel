import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { requireAdmin } from "@/lib/admin.server";
import { getSql } from "@/lib/db";

export type TikTokVideo = {
  id: string;
  caption?: string;
  permalink?: string;
  like_count?: number;
  comments_count?: number;
  view_count?: number;
  share_count?: number;
};

export const listTikTokVideos = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    const rows = await sql<{ access_token: string; username: string }>`
      select access_token, username from tiktok_oauth
      where user_id = ${context.userId}
      order by created_at desc
      limit 1
    `;
    const row = rows[0];
    if (!row?.access_token) {
      return { connected: false, username: "", videos: [] as TikTokVideo[] };
    }
    const res = await fetch(
      "https://open.tiktokapis.com/v2/video/list/?fields=id,title,video_description,share_url,like_count,comment_count,share_count,view_count",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${row.access_token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ max_count: 20 }),
      },
    );
    const body = (await res.json().catch(() => ({}))) as {
      data?: { videos?: { id: string; title?: string; video_description?: string; share_url?: string; like_count?: number; comment_count?: number; share_count?: number; view_count?: number }[] };
      error?: { message?: string; code?: string };
    };
    if (!res.ok || (body.error?.code && body.error.code !== "ok")) {
      throw new Error(body.error?.message || "TikTok videos nahi mili.");
    }
    const videos = (body.data?.videos ?? []).map((video) => ({
      id: video.id,
      caption: video.video_description || video.title || "",
      permalink: video.share_url,
      like_count: video.like_count ?? 0,
      comments_count: video.comment_count ?? 0,
      view_count: video.view_count ?? 0,
      share_count: video.share_count ?? 0,
    }));
    return { connected: true, username: row.username, videos };
  });
