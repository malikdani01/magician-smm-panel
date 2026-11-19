export type VideoCounts = {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  at: number;
};

const KEYS = ["views", "likes", "comments", "shares", "saves"] as const;

export async function readVideoCounts(link: string): Promise<VideoCounts | null> {
  if (!/tiktok\.com/i.test(link)) return null;
  const response = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(link)}`, {
    signal: AbortSignal.timeout(8000),
    headers: { "user-agent": "Mozilla/5.0" },
  });
  if (!response.ok) return null;
  const json = await response.json();
  const data = json?.data;
  if (!data || typeof data !== "object") return null;
  return {
    views: Number(data.play_count) || 0,
    likes: Number(data.digg_count) || 0,
    comments: Number(data.comment_count) || 0,
    shares: Number(data.share_count) || 0,
    saves: Number(data.collect_count) || 0,
    at: Date.now(),
  };
}

export function parseCounts(raw: string | null | undefined): VideoCounts | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<VideoCounts>;
    if (!value || typeof value !== "object") return null;
    return {
      views: Number(value.views) || 0,
      likes: Number(value.likes) || 0,
      comments: Number(value.comments) || 0,
      shares: Number(value.shares) || 0,
      saves: Number(value.saves) || 0,
      at: Number(value.at) || 0,
    };
  } catch {
    return null;
  }
}

export function countKeys() {
  return KEYS;
}
