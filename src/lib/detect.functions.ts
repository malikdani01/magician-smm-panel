import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { requireAdmin } from "@/lib/admin.server";
import { listConnectedMedia, mediaInsights } from "@/lib/detect.server";

export const detectMedia = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    return listConnectedMedia(context.userId);
  });

export const detectInsights = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((mediaId: string) => {
    const id = String(mediaId ?? "").trim();
    if (!/^\d+$/.test(id)) throw new Error("Media id galat hai.");
    return id;
  })
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    return mediaInsights(context.userId, data);
  });
