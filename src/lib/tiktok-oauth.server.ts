import { getSql } from "@/lib/db";

const SCOPES = "user.info.basic,video.list";

function clientKey() {
  const key = process.env.TIKTOK_CLIENT_KEY?.trim();
  if (!key) throw new Error("TIKTOK_CLIENT_KEY .env mein nahi hai.");
  return key;
}

function clientSecret() {
  const secret = process.env.TIKTOK_CLIENT_SECRET?.trim();
  if (!secret) throw new Error("TIKTOK_CLIENT_SECRET .env mein nahi hai.");
  return secret;
}

export function tiktokRedirect() {
  const uri = process.env.TIKTOK_REDIRECT_URI?.trim();
  if (!uri) throw new Error("TIKTOK_REDIRECT_URI .env mein nahi hai.");
  return uri;
}

export function tiktokAuthorizeUrl(state: string) {
  const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
  url.searchParams.set("client_key", clientKey());
  url.searchParams.set("redirect_uri", tiktokRedirect());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("state", state);
  return url.toString();
}

export async function saveTikTokState(state: string, userId: string) {
  const sql = await getSql();
  await sql`delete from tiktok_oauth_state where created_at < now() - interval '15 minutes'`;
  await sql`insert into tiktok_oauth_state (state, user_id) values (${state}, ${userId})`;
}

export async function takeTikTokState(state: string) {
  const sql = await getSql();
  const rows = await sql<{ user_id: string }>`
    delete from tiktok_oauth_state
    where state = ${state} and created_at > now() - interval '15 minutes'
    returning user_id
  `;
  return rows[0]?.user_id || "";
}

type TokenBody = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  open_id?: string;
  error?: string;
  error_description?: string;
};

export async function exchangeTikTokCode(code: string) {
  const form = new URLSearchParams({
    client_key: clientKey(),
    client_secret: clientSecret(),
    code,
    grant_type: "authorization_code",
    redirect_uri: tiktokRedirect(),
  });
  const tokenRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const token = (await tokenRes.json().catch(() => ({}))) as TokenBody;
  if (!tokenRes.ok || !token.access_token) {
    throw new Error(token.error_description || token.error || "TikTok token nahi mila.");
  }

  const meRes = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name", {
    headers: { authorization: `Bearer ${token.access_token}` },
  });
  const me = (await meRes.json().catch(() => ({}))) as {
    data?: { user?: { open_id?: string; display_name?: string } };
    error?: { message?: string };
  };
  const openId = me.data?.user?.open_id || token.open_id || "";
  const username = me.data?.user?.display_name || openId;
  return {
    openId,
    username,
    accessToken: token.access_token,
    refreshToken: token.refresh_token || "",
    expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null,
  };
}

export async function saveTikTokConnection(input: {
  userId: string;
  openId: string;
  username: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string | null;
}) {
  const sql = await getSql();
  const existing = await sql<{ id: string }>`
    select id from tiktok_oauth
    where user_id = ${input.userId} and open_id = ${input.openId}
    limit 1
  `;
  if (existing[0]) {
    await sql`
      update tiktok_oauth
      set username = ${input.username},
          access_token = ${input.accessToken},
          refresh_token = ${input.refreshToken},
          expires_at = ${input.expiresAt}
      where id = ${existing[0].id}
    `;
    return existing[0].id;
  }
  const id = crypto.randomUUID();
  await sql`
    insert into tiktok_oauth (id, user_id, open_id, username, access_token, refresh_token, expires_at)
    values (${id}, ${input.userId}, ${input.openId}, ${input.username}, ${input.accessToken}, ${input.refreshToken}, ${input.expiresAt})
  `;
  return id;
}
