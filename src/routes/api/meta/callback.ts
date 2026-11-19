import { createFileRoute } from "@tanstack/react-router";
import { getSessionUser } from "@/lib/auth/verify.server";
import { exchangeInstagramCode, saveInstagramConnection } from "@/lib/instagram-oauth.server";

function fail(reason: string) {
  return Response.redirect(`https://localhost:8080/instagram?ig=error&reason=${encodeURIComponent(reason)}`, 302);
}

export const Route = createFileRoute("/api/meta/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const denied = url.searchParams.get("error_description") || url.searchParams.get("error");
        if (denied) return fail(denied);
        const code = url.searchParams.get("code") || "";
        const state = url.searchParams.get("state") || "";
        const cookie = request.headers.get("cookie") || "";
        const saved = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith("ig_oauth_state="))?.slice("ig_oauth_state=".length);
        if (!code || !state || !saved || saved !== state) return fail("Login state match nahi hua. Connect dubara dabao.");
        const user = await getSessionUser();
        if (!user) return fail("Pehle panel mein login karo, phir Connect dabao.");
        try {
          const connected = await exchangeInstagramCode(code);
          await saveInstagramConnection({ userId: user.id, ...connected });
        } catch (err) {
          return fail(err instanceof Error ? err.message : "Instagram connect fail.");
        }
        return new Response(null, {
          status: 302,
          headers: {
            location: "https://localhost:8080/instagram?ig=connected",
            "set-cookie": "ig_oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0",
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});
