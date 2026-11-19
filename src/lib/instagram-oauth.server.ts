import { getSql } from "@/lib/db";

export const IG_REDIRECT = "https://localhost:8080/api/meta/callback";
const SCOPES = "instagram_business_basic,instagram_business_manage_insights";

function appId() {
  const id = process.env.INSTAGRAM_APP_ID?.trim();
  if (!id) throw new Error("INSTAGRAM_APP_ID .env mein nahi hai.");
  return id;
}

function appSecret() {
  const secret = process.env.INSTAGRAM_APP_SECRET?.trim();
  if (!secret) throw new Error("INSTAGRAM_APP_SECRET .env mein nahi hai.");
  return secret;
}

export function instagramAuthorizeUrl(state: string) {
  const url = new URL("https://www.instagram.com/oauth/authorize");
  url.searchParams.set("client_id", appId());
  url.searchParams.set("redirect_uri", IG_REDIRECT);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("state", state);
  return url.toString();
}

type TokenPayload = { access_token?: string; user_id?: string | number; data?: TokenPayload[] };

function pickToken(body: TokenPayload) {
  const row = body.access_token ? body : body.data?.[0];
  const accessToken = row?.access_token?.trim();
  if (!accessToken) throw new Error("Instagram ne access token nahi diya.");
  return { accessToken, igUserId: row?.user_id != null ? String(row.user_id) : "" };
}

export async function exchangeInstagramCode(code: string) {
  const form = new URLSearchParams({
    client_id: appId(),
    client_secret: appSecret(),
    grant_type: "authorization_code",
    redirect_uri: IG_REDIRECT,
    code,
  });
  const tokenRes = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const tokenBody = (await tokenRes.json().catch(() => ({}))) as TokenPayload & { error_message?: string };
  if (!tokenRes.ok) throw new Error(tokenBody.error_message || "Instagram token exchange fail.");
  let { accessToken, igUserId } = pickToken(tokenBody);
  let expiresAt: string | null = null;

  const longUrl = new URL("https://graph.instagram.com/access_token");
  longUrl.searchParams.set("grant_type", "ig_exchange_token");
  longUrl.searchParams.set("client_secret", appSecret());
  longUrl.searchParams.set("access_token", accessToken);
  const longRes = await fetch(longUrl);
  if (longRes.ok) {
    const longBody = (await longRes.json()) as { access_token?: string; expires_in?: number };
    if (longBody.access_token) {
      accessToken = longBody.access_token;
      if (longBody.expires_in) expiresAt = new Date(Date.now() + longBody.expires_in * 1000).toISOString();
    }
  }

  const meUrl = new URL("https://graph.instagram.com/me");
  meUrl.searchParams.set("fields", "id,user_id,username");
  meUrl.searchParams.set("access_token", accessToken);
  const meRes = await fetch(meUrl);
  const me = (await meRes.json().catch(() => ({}))) as { id?: string; user_id?: string; username?: string; error?: { message?: string } };
  if (!meRes.ok) throw new Error(me.error?.message || "Instagram profile nahi mila.");
  return {
    accessToken,
    igUserId: String(me.user_id || me.id || igUserId),
    username: (me.username || "").replace(/^@/, ""),
    expiresAt,
  };
}

export async function saveInstagramConnection(input: {
  userId: string;
  igUserId: string;
  username: string;
  accessToken: string;
  expiresAt: string | null;
}) {
  const sql = await getSql();
  const existing = await sql<{ id: string }>`
    select id from instagram_oauth
    where user_id = ${input.userId} and ig_user_id = ${input.igUserId}
    limit 1
  `;
  if (existing[0]) {
    await sql`
      update instagram_oauth
      set username = ${input.username},
          access_token = ${input.accessToken},
          expires_at = ${input.expiresAt}
      where id = ${existing[0].id}
    `;
    return existing[0].id;
  }
  const id = crypto.randomUUID();
  await sql`
    insert into instagram_oauth (id, user_id, ig_user_id, username, access_token, expires_at)
    values (${id}, ${input.userId}, ${input.igUserId}, ${input.username}, ${input.accessToken}, ${input.expiresAt})
  `;
  return id;
}
