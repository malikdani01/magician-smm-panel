export type SingleService = {
  id: number;
  platform: string;
  category: string;
  name: string;
  min: number;
  max: number;
  ratePer1kPaise: number;
  averageMinutes: number;
};

function row(
  id: number,
  platform: string,
  category: string,
  name: string,
  min: number,
  max: number,
  ratePer1kPaise: number,
  averageMinutes: number,
): SingleService {
  return { id, platform, category, name, min, max, ratePer1kPaise, averageMinutes };
}

export const SINGLE_SERVICES: SingleService[] = [
  row(7048, "instagram", "Instagram Followers [ Working in Update ]", "Instagram - Followers [ Start: 12-24H ] - [ Speed: 5-10K/D ] - [ Drop: 10-20% ] - [ R: 30D ] - Lifetime", 10, 50000, 8900, 66 * 60 + 49),
  row(7051, "instagram", "Instagram Followers [ Working in Update ]", "Instagram - Followers [ Start: 0-1H ] - [ Speed: 1-5K/D ] - [ No Drop ] - [ R: 30D ]", 10, 20000, 14900, 18 * 60),
  row(7060, "instagram", "Instagram Followers [ Working in Update ]", "Instagram - Followers [ Start: 0-6H ] - [ Speed: 500-2K/D ] - [ Drop: 0-5% ]", 20, 10000, 19900, 36 * 60),
  row(7102, "instagram", "Instagram Likes", "Instagram - Likes [ Start: 0-1H ] - [ Speed: 10K/D ] - [ No Drop ]", 10, 20000, 1200, 45),
  row(7108, "instagram", "Instagram Likes", "Instagram - Likes [ Start: 0-30M ] - [ Speed: 20K/D ] - [ Drop: 0-5% ]", 20, 50000, 900, 25),
  row(7201, "instagram", "Instagram Views", "Instagram - Views [ Start: 0-1H ] - [ Speed: 50K/D ] - [ Lifetime ]", 100, 1000000, 180, 90),
  row(7214, "instagram", "Instagram Views", "Instagram - Reel Views [ Start: 0-30M ] - [ Speed: 100K/D ]", 500, 5000000, 120, 40),
  row(7303, "instagram", "Instagram Comments", "Instagram - Custom Comments [ Start: 0-6H ] - [ Speed: 200/D ]", 5, 500, 4900, 6 * 60),
  row(7402, "instagram", "Instagram Shares", "Instagram - Shares [ Start: 0-1H ] - [ Speed: 5K/D ]", 10, 10000, 2200, 2 * 60),
  row(7411, "instagram", "Instagram Saves", "Instagram - Saves [ Start: 0-1H ] - [ Speed: 3K/D ]", 10, 10000, 2500, 3 * 60),

  row(8101, "tiktok", "TikTok Followers", "TikTok - Followers [ Start: 0-1H ] - [ Speed: 2-5K/D ] - [ Drop: 0-10% ]", 10, 50000, 9900, 12 * 60),
  row(8108, "tiktok", "TikTok Followers", "TikTok - Followers [ Start: 0-6H ] - [ Speed: 10K/D ] - [ No Refill ]", 50, 100000, 6900, 20 * 60),
  row(8204, "tiktok", "TikTok Likes", "TikTok - Likes [ Start: 0-30M ] - [ Speed: 20K/D ]", 20, 100000, 700, 30),
  row(8302, "tiktok", "TikTok Views", "TikTok - Views [ Start: 0-1H ] - [ Speed: 100K/D ]", 500, 10000000, 80, 60),
  row(8401, "tiktok", "TikTok Shares", "TikTok - Shares [ Start: 0-1H ] - [ Speed: 5K/D ]", 10, 20000, 1600, 2 * 60),

  row(9102, "youtube", "YouTube Views", "YouTube - Views [ Start: 0-6H ] - [ Speed: 5-10K/D ] - [ Retention ]", 100, 1000000, 2500, 24 * 60),
  row(9110, "youtube", "YouTube Views", "YouTube - Views [ Start: 0-1H ] - [ Speed: 50K/D ]", 500, 5000000, 1800, 8 * 60),
  row(9201, "youtube", "YouTube Subscribers", "YouTube - Subscribers [ Start: 0-12H ] - [ Speed: 200-500/D ] - [ R: 30D ]", 10, 10000, 24900, 48 * 60),
  row(9304, "youtube", "YouTube Likes", "YouTube - Likes [ Start: 0-1H ] - [ Speed: 5K/D ]", 10, 50000, 1900, 90),
  row(9402, "youtube", "YouTube Watchtime", "YouTube - Watch Hours [ Start: 0-24H ] - [ Speed: slow ]", 10, 5000, 39900, 72 * 60),

  row(10102, "facebook", "Facebook Page Likes", "Facebook - Page Likes [ Start: 0-6H ] - [ Speed: 1K/D ]", 20, 20000, 7900, 18 * 60),
  row(10120, "facebook", "Facebook Followers", "Facebook - Profile Followers [ Start: 0-12H ] - [ Drop: 5-10% ]", 20, 20000, 8900, 24 * 60),
  row(10204, "facebook", "Facebook Post Likes", "Facebook - Post Likes [ Start: 0-1H ] - [ Speed: 5K/D ]", 10, 20000, 1400, 70),
  row(10301, "facebook", "Facebook Views", "Facebook - Video Views [ Start: 0-1H ] - [ Speed: 20K/D ]", 100, 1000000, 300, 3 * 60),

  row(11101, "twitter", "Twitter Followers", "Twitter / X - Followers [ Start: 0-6H ] - [ Speed: 1-2K/D ] - [ R: 30D ]", 10, 20000, 12900, 16 * 60),
  row(11204, "twitter", "Twitter Likes", "Twitter / X - Likes [ Start: 0-1H ] - [ Speed: 5K/D ]", 10, 20000, 1800, 50),
  row(11302, "twitter", "Twitter Retweets", "Twitter / X - Retweets [ Start: 0-1H ] - [ Speed: 2K/D ]", 10, 10000, 3200, 2 * 60),

  row(12101, "telegram", "Telegram Members", "Telegram - Channel Members [ Start: 0-1H ] - [ Speed: 5K/D ]", 50, 50000, 4900, 6 * 60),
  row(12202, "telegram", "Telegram Views", "Telegram - Post Views [ Start: 0-30M ] - [ Speed: 20K/D ]", 100, 500000, 200, 40),
  row(12301, "telegram", "Telegram Reactions", "Telegram - Reactions [ Start: 0-1H ]", 10, 10000, 1500, 90),

  row(13101, "whatsapp", "WhatsApp Channel", "WhatsApp - Channel Followers [ Start: 0-12H ] - [ Speed: 500/D ]", 20, 10000, 15900, 30 * 60),
  row(13201, "whatsapp", "WhatsApp Views", "WhatsApp - Status Views [ Start: 0-1H ]", 100, 100000, 400, 2 * 60),

  row(14102, "spotify", "Spotify Plays", "Spotify - Plays [ Start: 0-6H ] - [ Speed: 2-5K/D ]", 100, 100000, 2200, 12 * 60),
  row(14201, "spotify", "Spotify Followers", "Spotify - Followers [ Start: 0-12H ] - [ Speed: 500/D ]", 10, 10000, 9900, 24 * 60),
  row(14301, "spotify", "Spotify Saves", "Spotify - Playlist Saves [ Start: 0-6H ]", 10, 5000, 4500, 10 * 60),

  row(15101, "linkedin", "LinkedIn Followers", "LinkedIn - Followers [ Start: 0-24H ] - [ Speed: 100-300/D ]", 10, 5000, 29900, 48 * 60),
  row(15202, "linkedin", "LinkedIn Likes", "LinkedIn - Post Likes [ Start: 0-6H ]", 10, 5000, 6900, 8 * 60),

  row(16101, "discord", "Discord Members", "Discord - Server Members [ Start: 0-1H ] - [ Online mix ]", 20, 20000, 5900, 5 * 60),
  row(16201, "discord", "Discord Boosts", "Discord - Server Boosts [ Start: 0-12H ]", 2, 14, 149900, 12 * 60),

  row(17101, "twitch", "Twitch Followers", "Twitch - Followers [ Start: 0-6H ] - [ Speed: 500/D ]", 10, 10000, 11900, 18 * 60),
  row(17201, "twitch", "Twitch Views", "Twitch - Live Views [ Start: 0-15M ]", 50, 20000, 3500, 30),

  row(18101, "snapchat", "Snapchat Followers", "Snapchat - Followers [ Start: 0-12H ] - [ Speed: 200/D ]", 10, 5000, 18900, 36 * 60),
  row(18201, "snapchat", "Snapchat Views", "Snapchat - Story Views [ Start: 0-1H ]", 100, 100000, 500, 2 * 60),
];

export const SINGLE_PLATFORMS = [
  "instagram",
  "tiktok",
  "youtube",
  "facebook",
  "twitter",
  "telegram",
  "whatsapp",
  "spotify",
  "linkedin",
  "discord",
  "twitch",
  "snapchat",
] as const;

export function singleService(id: number) {
  return SINGLE_SERVICES.find((service) => service.id === id) ?? null;
}

export function singleCharge(service: SingleService, amount: number) {
  return Math.max(1, Math.round((amount * service.ratePer1kPaise) / 1000));
}

export function formatAverage(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours <= 0) return `${rest} minutes`;
  if (rest === 0) return `${hours} hours`;
  return `${hours} hours and ${rest} minutes`;
}
