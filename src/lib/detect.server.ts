import { getSql } from "@/lib/db";

type MediaRow = {
  id: string;
  caption?: string;
  media_type?: string;
  permalink?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
  thumbnail_url?: string;
};

type InsightValue = { name: string; values?: { value: number }[]; value?: number };

async function tokenFor(userId: string) {
  const sql = await getSql();
  const rows = await sql<{ access_token: string; username: string }>`
    select access_token, username from instagram_oauth
    where user_id = ${userId}
    order by created_at desc
    limit 1
  `;
  const row = rows[0];
  if (!row?.access_token) throw new Error("Pehle Instagram Accounts se account connect karo.");
  return row;
}

export async function listConnectedMedia(userId: string) {
  const { access_token, username } = await tokenFor(userId);
  const url = new URL("https://graph.instagram.com/me/media");
  url.searchParams.set(
    "fields",
    "id,caption,media_type,permalink,timestamp,like_count,comments_count,thumbnail_url",
  );
  url.searchParams.set("access_token", access_token);
  url.searchParams.set("limit", "12");
  const res = await fetch(url);
  const body = (await res.json().catch(() => ({}))) as { data?: MediaRow[]; error?: { message?: string } };
  if (!res.ok) throw new Error(body.error?.message || "Instagram media list nahi mili.");
  return { username, media: body.data ?? [] };
}

export async function mediaInsights(userId: string, mediaId: string) {
  const { access_token } = await tokenFor(userId);
  const metrics = ["reach", "likes", "comments", "saved", "shares", "views", "impressions", "total_interactions"];
  const counts: Record<string, number> = {};
  for (const metric of metrics) {
    const url = new URL(`https://graph.instagram.com/${mediaId}/insights`);
    url.searchParams.set("metric", metric);
    url.searchParams.set("access_token", access_token);
    const res = await fetch(url);
    const body = (await res.json().catch(() => ({}))) as {
      data?: InsightValue[];
      error?: { message?: string };
    };
    if (!res.ok) continue;
    for (const item of body.data ?? []) {
      const value = item.values?.[0]?.value ?? item.value ?? 0;
      counts[item.name] = Number(value) || 0;
    }
  }
  if (Object.keys(counts).length === 0) throw new Error("Is post ke insights nahi mile. Account professional hona chahiye.");
  return counts;
}
