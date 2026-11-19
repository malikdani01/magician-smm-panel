import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { requireAdmin } from "@/lib/admin.server";
import { getSql } from "@/lib/db";

export type AnnouncementBar = {
  enabled: boolean;
  texts: string[];
  direction: "left" | "right";
  seconds: number;
  font: string;
  background: string;
  color: string;
};

const FONTS = ["Outfit", "Inter", "Playfair Display"] as const;

export const announcementFallback: AnnouncementBar = {
  enabled: true,
  texts: ["Welcome to Magician SMM", "Fast delivery", "Views, likes, shares and saves"],
  direction: "left",
  seconds: 22,
  font: "Outfit",
  background: "",
  color: "",
};

function cleanColor(value: string) {
  const color = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : "";
}

export function cleanAnnouncement(input: Partial<AnnouncementBar> | null | undefined): AnnouncementBar {
  const texts = (Array.isArray(input?.texts) ? input.texts : [])
    .map((line) => String(line || "").replace(/\s+/g, " ").trim().slice(0, 180))
    .filter(Boolean)
    .slice(0, 12);
  const seconds = Math.round(Number(input?.seconds) || announcementFallback.seconds);
  const font = FONTS.includes(input?.font as (typeof FONTS)[number]) ? String(input?.font) : announcementFallback.font;
  return {
    enabled: input?.enabled !== false,
    texts: texts.length ? texts : announcementFallback.texts,
    direction: input?.direction === "right" ? "right" : "left",
    seconds: Math.min(180, Math.max(4, seconds)),
    font,
    background: cleanColor(String(input?.background || "")),
    color: cleanColor(String(input?.color || "")),
  };
}

async function readAnnouncement() {
  const sql = await getSql();
  await sql`create table if not exists desk_meta (key text primary key, value text not null default '')`;
  const rows = await sql<{ value: string }>`select value from desk_meta where key = 'announcement_bar' limit 1`;
  if (!rows[0]?.value) return announcementFallback;
  try {
    return cleanAnnouncement(JSON.parse(rows[0].value) as Partial<AnnouncementBar>);
  } catch {
    return announcementFallback;
  }
}

export const getAnnouncement = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => readAnnouncement());

export const saveAnnouncement = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: Partial<AnnouncementBar>) => cleanAnnouncement(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    const packed = JSON.stringify(data);
    await sql`
      insert into desk_meta (key, value) values ('announcement_bar', ${packed})
      on conflict (key) do update set value = excluded.value
    `;
    return data;
  });
