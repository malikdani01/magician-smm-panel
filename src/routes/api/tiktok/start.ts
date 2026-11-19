import { createFileRoute } from "@tanstack/react-router";
import { getSessionUser } from "@/lib/auth/verify.server";
import { saveTikTokState, tiktokAuthorizeUrl } from "@/lib/tiktok-oauth.server";

export const Route = createFileRoute("/api/tiktok/start")({
  server: {
    handlers: {
      GET: async () => {
        const user = await getSessionUser();
        if (!user) return Response.redirect("https://localhost:8080/login", 302);
        const state = crypto.randomUUID();
        try {
          await saveTikTokState(state, user.id);
          return Response.redirect(tiktokAuthorizeUrl(state), 302);
        } catch (err) {
          const reason = err instanceof Error ? err.message : "TikTok start fail";
          return Response.redirect(`https://localhost:8080/detect?tt=error&reason=${encodeURIComponent(reason)}`, 302);
        }
      },
    },
  },
});
