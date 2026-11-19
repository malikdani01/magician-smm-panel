import { createFileRoute } from "@tanstack/react-router";
import { getSessionUser } from "@/lib/auth/verify.server";
import { instagramAuthorizeUrl } from "@/lib/instagram-oauth.server";

export const Route = createFileRoute("/api/meta/start")({
  server: {
    handlers: {
      GET: async () => {
        const user = await getSessionUser();
        if (!user) return Response.redirect(new URL("/login", "https://localhost:8080"), 302);
        const state = crypto.randomUUID();
        let location: string;
        try {
          location = instagramAuthorizeUrl(state);
        } catch (err) {
          const reason = err instanceof Error ? err.message : "Instagram app id missing";
          return Response.redirect(`https://localhost:8080/instagram?ig=error&reason=${encodeURIComponent(reason)}`, 302);
        }
        return new Response(null, {
          status: 302,
          headers: {
            location,
            "set-cookie": `ig_oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`,
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});
