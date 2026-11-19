import { createFileRoute } from "@tanstack/react-router";
import { exchangeTikTokCode, saveTikTokConnection, takeTikTokState } from "@/lib/tiktok-oauth.server";

function fail(reason: string) {
  return Response.redirect(`https://localhost:8080/detect?tt=error&reason=${encodeURIComponent(reason)}`, 302);
}

export const Route = createFileRoute("/api/tiktok/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const denied = url.searchParams.get("error_description") || url.searchParams.get("error");
        if (denied) return fail(denied);
        const code = url.searchParams.get("code") || "";
        const state = url.searchParams.get("state") || "";
        if (!code || !state) return fail("TikTok ne code nahi diya. Connect dubara dabao.");
        const userId = await takeTikTokState(state);
        if (!userId) return fail("Login state match nahi hua. Panel pe login karke Connect dubara dabao.");
        try {
          const connected = await exchangeTikTokCode(code);
          await saveTikTokConnection({ userId, ...connected });
        } catch (err) {
          return fail(err instanceof Error ? err.message : "TikTok connect fail.");
        }
        return Response.redirect("https://localhost:8080/tiktok?tt=connected", 302);
      },
    },
  },
});
