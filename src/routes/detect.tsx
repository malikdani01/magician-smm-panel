import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Activity } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Authed, StaffOnly } from "@/components/gate";
import { detectInsights, detectMedia } from "@/lib/detect.functions";
import { listTikTokVideos } from "@/lib/tiktok.functions";

export const Route = createFileRoute("/detect")({
  component: () => (
    <Authed>
      <StaffOnly>
      <Page />
      </StaffOnly>
    </Authed>
  ),
});

type Media = {
  id: string;
  caption?: string;
  media_type?: string;
  permalink?: string;
  like_count?: number;
  comments_count?: number;
  view_count?: number;
  share_count?: number;
};

type Shape = "organic" | "linear" | "spike" | "flat";

type Verdict = {
  views: number;
  likes: number;
  saves: number;
  shares: number;
  comments: number;
  risk: number;
  approve: number;
  reject: number;
  note: string;
  flags: string[];
  shapes: Record<"views" | "likes" | "saves" | "shares", Shape>;
};

function zoneOf(risk: number) {
  if (risk >= 70) return { key: "red", color: "#fe2c55", fill: "#fe2c55", label: "Red · botting detect ho jayegi" };
  if (risk >= 40) return { key: "orange", color: "#f59e0b", fill: "#f59e0b", label: "Orange · middle detection" };
  return { key: "green", color: "#22c55e", fill: "#22c55e", label: "Green · botting detect hone ka chance sabse kam" };
}

function curve(total: number, kind: Shape) {
  const rows: { label: string; value: number }[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const rise =
      kind === "organic" ? (1 - Math.exp(-3.2 * t)) / (1 - Math.exp(-3.2)) :
      kind === "linear" ? t :
      kind === "spike" ? Math.pow(t, 3.4) :
      Math.pow(t, 5) * 0.25;
    rows.push({
      label: i === 0 ? "0h" : i === 8 ? "2h" : "",
      value: Math.max(0, Math.round(total * rise)),
    });
  }
  return rows;
}

function analyze(raw: Record<string, number>, post?: Media): Verdict {
  const views = raw.views || raw.impressions || raw.reach || 0;
  const likes = Math.max(raw.likes || 0, post?.like_count || 0);
  const saves = raw.saved || 0;
  const shares = raw.shares || 0;
  const comments = Math.max(raw.comments || 0, post?.comments_count || 0);
  const flags: string[] = [];
  const shapes: Verdict["shapes"] = { views: "organic", likes: "organic", saves: "organic", shares: "organic" };
  if (views < 20) {
    return {
      views, likes, saves, shares, comments,
      risk: 0, approve: 0, reject: 0,
      note: "Views bahut kam hain. Score tab banega jab post thodi chale.",
      flags: ["Instagram did not return enough views to judge the graph."],
      shapes,
    };
  }
  const likeRate = likes / views;
  const saveRate = saves / views;
  const shareRate = shares / views;
  const engage = (likes + comments + saves + shares) / views;
  let risk = 12;
  if (engage < 0.0045) {
    risk += 34;
    shapes.views = "linear";
    flags.push("Views ke saath likes, saves, shares almost nahi. Bot views jaisa pattern.");
  } else if (engage < 0.012) {
    risk += 16;
    shapes.views = "linear";
    flags.push("Engagement views se kaafi neeche hai.");
  } else if (engage > 0.12) {
    risk += 22;
    flags.push("Engagement average se bahut upar hai. Bought likes ho sakte hain.");
  }
  if (likeRate > 0.15) {
    risk += 16;
    shapes.likes = "spike";
    flags.push("Like rate organic se bahut upar hai.");
  } else if (likeRate < 0.004 && views > 200) {
    risk += 12;
    shapes.likes = "flat";
    flags.push("Likes views ke against bahut kam hain.");
  }
  if (likes > 20 && saves === 0 && shares === 0) {
    risk += 20;
    shapes.saves = "flat";
    shapes.shares = "flat";
    shapes.likes = shapes.likes === "organic" ? "spike" : shapes.likes;
    flags.push("Sirf likes hain. Saves aur shares zero hain, yeh bought likes jaisa hai.");
  }
  if (saveRate > 0.08 && saves > views) {
    risk += 8;
    flags.push("Saves views se zyada aa rahe hain. Count mismatch, score soft rakha hai.");
  } else if (saveRate > 0.08) {
    risk += 10;
    shapes.saves = "spike";
    flags.push("Save rate unusual high hai.");
  }
  if (shareRate > 0.05) {
    risk += 10;
    shapes.shares = "spike";
    flags.push("Share rate unusual high hai.");
  }
  if (comments === 0 && likes > 40) {
    risk += 6;
    flags.push("Comments zero hain. Likes saste hote hain, comments nahi.");
  }
  if (flags.length === 0) flags.push("Ratios organic range ke paas hain. Line smooth rise phir flat hai.");
  risk = Math.max(8, Math.min(100, Math.round(risk)));
  const zone = zoneOf(risk);
  return {
    views, likes, saves, shares, comments, risk,
    approve: 100 - risk, reject: risk,
    note: zone.label,
    flags, shapes,
  };
}

function StudioChart({ title, total, color, kind, hint }: { title: string; total: number; color: string; kind: Shape; hint: string }) {
  const id = `fill-${title}`;
  return (
    <section className="rounded-2xl border border-[#eceff3] bg-white p-4">
      <p className="text-[13px] text-[#6b7280]">{title}</p>
      <p className="text-[28px] font-semibold leading-none tracking-tight">{total.toLocaleString("en-IN")}</p>
      <p className="mb-2 mt-1 text-[11px] text-[#9ca3af]">{hint}</p>
      <div className="h-36">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={curve(total, kind)} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
            <YAxis orientation="right" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={36} />
            <Tooltip />
            <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#${id})`} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function Page() {
  const [platform, setPlatform] = useState<"instagram" | "tiktok">("instagram");
  const [username, setUsername] = useState("");
  const [media, setMedia] = useState<Media[]>([]);
  const [selected, setSelected] = useState<Media | null>(null);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tt") === "connected") {
      setPlatform("tiktok");
      setNote("TikTok connected. Open a video.");
    }
    if (params.get("tt") === "error") setNote(params.get("reason") || "TikTok connect fail.");
  }, []);

  useEffect(() => {
    setMedia([]);
    setSelected(null);
    setCounts(null);
    if (platform === "instagram") {
      detectMedia()
        .then((result) => {
          setUsername(result.username);
          setMedia(result.media);
        })
        .catch((err: unknown) => setNote(err instanceof Error ? err.message : "Could not load media."));
      return;
    }
    listTikTokVideos()
      .then((result) => {
        setUsername(result.username);
        setMedia(result.videos.map((video) => ({
          id: video.id,
          caption: video.caption,
          permalink: video.permalink,
          like_count: video.like_count,
          comments_count: video.comments_count,
          view_count: video.view_count,
          share_count: video.share_count,
        })));
        if (!result.connected) setNote("");
      })
      .catch((err: unknown) => setNote(err instanceof Error ? err.message : "Could not load TikTok videos."));
  }, [platform]);

  async function check(item: Media) {
    setSelected(item);
    setBusy(true);
    setNote("");
    try {
      if (platform === "tiktok") {
        setCounts({
          views: item.view_count ?? 0,
          likes: item.like_count ?? 0,
          comments: item.comments_count ?? 0,
          shares: item.share_count ?? 0,
          saved: 0,
        });
        return;
      }
      setCounts(await detectInsights({ data: item.id }));
    } catch (err: unknown) {
      setCounts(null);
      setNote(err instanceof Error ? err.message : "Insights fail.");
    } finally {
      setBusy(false);
    }
  }

  const verdict = counts ? analyze(counts, selected ?? undefined) : null;
  const zone = verdict && verdict.views >= 20 ? zoneOf(verdict.risk) : null;
  const scoreLine = verdict ? curve(verdict.risk, verdict.risk >= 70 ? "spike" : verdict.risk >= 40 ? "linear" : "organic").map((row, i, all) => ({
    ...row,
    label: i === 0 ? "0" : i === all.length - 1 ? String(verdict.risk) : row.label === "2h" ? "" : "",
  })) : [];

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <section className="rounded-2xl border border-[#eceff3] bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 text-[20px] font-semibold">
            <span className="grid size-9 place-items-center rounded-xl bg-[#111827] text-white"><Activity className="size-4" /></span>
            Video analysis
          </h1>
          <div className="flex rounded-full bg-[#f3f4f6] p-1 text-[13px] font-semibold">
            <button type="button" onClick={() => { setPlatform("instagram"); setCounts(null); setSelected(null); }} className={`rounded-full px-3 py-1.5 ${platform === "instagram" ? "bg-white" : "text-[#6b7280]"}`}>Instagram</button>
            <button type="button" onClick={() => { setPlatform("tiktok"); setCounts(null); setSelected(null); setNote(""); }} className={`rounded-full px-3 py-1.5 ${platform === "tiktok" ? "bg-white" : "text-[#6b7280]"}`}>TikTok</button>
          </div>
        </div>
        <p className="mt-2 text-[12px] text-[#6b7280]">
          {platform === "instagram"
            ? `@${username || "account"} · the line shape shows whether delivery looks organic or automated. Instagram does not send hourly history.`
            : username
              ? `@${username} · TikTok public videos. The API does not include saves.`
              : "Connect TikTok. Public videos appear here after you allow access."}
        </p>
      </section>

      {platform === "tiktok" && media.length === 0 ? (
        <section className="rounded-2xl border border-[#eceff3] bg-white p-6 text-center">
          <p className="text-[13px] text-[#6b7280]">TikTok is not connected.</p>
          <a href="/api/tiktok/start" className="mt-3 inline-flex h-11 items-center rounded-xl bg-[#111827] px-4 text-[13px] font-bold text-white">Connect TikTok</a>
          {note && <p className="mt-3 text-[12px] text-rose-600">{note}</p>}
        </section>
      ) : (
        <section className="rounded-2xl border border-[#eceff3] bg-white p-4">
          <p className="text-[12px] font-medium text-[#6b7280]">Recent posts</p>
          <ul className="mt-2 space-y-2">
            {media.map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => check(item)} className={`w-full rounded-xl px-3 py-2 text-left ${selected?.id === item.id ? "bg-[#f3f4f6]" : "hover:bg-[#fafafa]"}`}>
                  <p className="text-[13px] font-medium">{item.caption?.slice(0, 90) || item.permalink || item.id}</p>
                  <p className="text-[11px] text-[#9ca3af]">{item.media_type} · {item.like_count ?? 0} likes</p>
                </button>
              </li>
            ))}
          </ul>
          {note && <p className="mt-3 text-[12px] text-rose-600">{note}</p>}
        </section>
      )}

      {busy && <p className="text-[13px] text-[#6b7280]">Graph ban raha hai...</p>}

      {verdict && zone && (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <StudioChart title="Views" total={verdict.views} color="#2b7fff" kind={verdict.shapes.views} hint={verdict.shapes.views === "organic" ? "Smooth rise, phir slow" : "Seedha ya sudden rise · bot jaisa"} />
            <StudioChart title="Likes" total={verdict.likes} color="#fe2c55" kind={verdict.shapes.likes} hint={verdict.shapes.likes === "flat" ? "Flat · did not follow the views" : verdict.shapes.likes === "spike" ? "Spike at the end" : "Moves with the views"} />
            <StudioChart title="Saves" total={verdict.saves} color="#22c55e" kind={verdict.shapes.saves} hint={verdict.shapes.saves === "flat" ? "Zero ya flat" : "Save curve"} />
            <StudioChart title="Shares" total={verdict.shares} color="#f59e0b" kind={verdict.shapes.shares} hint={verdict.shapes.shares === "flat" ? "Zero ya flat" : "Share curve"} />
          </div>
          <section className="rounded-2xl border border-[#eceff3] bg-white p-4">
            <p className="text-[13px] text-[#6b7280]">Bot score</p>
            <p className="text-[28px] font-semibold" style={{ color: zone.color }}>{verdict.risk}%</p>
            <p className="text-[12px]" style={{ color: zone.color }}>{zone.label}</p>
            <p className="text-[12px] text-[#6b7280]">Approve {verdict.approve}% · Reject {verdict.reject}% · Comments {verdict.comments}</p>
            <div className="mt-2 h-44">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={scoreLine} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={zone.color} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={zone.color} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                  <YAxis orientation="right" domain={[0, 100]} ticks={[30, 60, 100]} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={32} />
                  <Tooltip />
                  <Area type="monotone" dataKey="value" stroke={zone.color} strokeWidth={2} fill="url(#scoreFill)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-2 list-disc pl-5 text-[12px] text-[#4b5563]">
              {verdict.flags.map((flag) => <li key={flag}>{flag}</li>)}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
