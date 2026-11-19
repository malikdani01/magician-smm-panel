export type DeskTheme = {
  id: string;
  name: string;
  bg: string;
  card: string;
  text: string;
  mute: string;
  line: string;
  primary: string;
  accent: string;
  sidebar: string;
  header: string;
  radius: string;
  glow: string;
};

export const THEMES: DeskTheme[] = [
  { id: "midnight", name: "Midnight Magic", bg: "#07081a", card: "#14162e", text: "#f5f7ff", mute: "#a5b4fc", line: "rgba(255,255,255,.1)", primary: "#7c3aed", accent: "#22d3ee", sidebar: "#0b0d1f", header: "#0e1028", radius: "18px", glow: "0.45" },
  { id: "aurora", name: "Aurora", bg: "#061018", card: "#10202c", text: "#f0fdfa", mute: "#99f6e4", line: "rgba(255,255,255,.1)", primary: "#14b8a6", accent: "#818cf8", sidebar: "#07141c", header: "#0b1c26", radius: "16px", glow: "0.4" },
  { id: "royal", name: "Royal Violet", bg: "#120818", card: "#241033", text: "#faf5ff", mute: "#e9d5ff", line: "rgba(255,255,255,.12)", primary: "#c026d3", accent: "#f472b6", sidebar: "#160a1e", header: "#1b0d26", radius: "20px", glow: "0.5" },
  { id: "light", name: "Clean Light", bg: "#f4f7ff", card: "#ffffff", text: "#0f172a", mute: "#64748b", line: "#e2e8f0", primary: "#4f46e5", accent: "#06b6d4", sidebar: "#ffffff", header: "#ffffff", radius: "16px", glow: "0.15" },
];

const KEY = "magiciansmm-theme";

export function savedTheme(): DeskTheme {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return THEMES[0];
    const parsed = JSON.parse(raw) as DeskTheme;
    return { ...THEMES[0], ...parsed };
  } catch {
    return THEMES[0];
  }
}

export function applyTheme(theme: DeskTheme) {
  const root = document.documentElement;
  root.style.setProperty("--desk-bg", theme.bg);
  root.style.setProperty("--desk-card", theme.card);
  root.style.setProperty("--desk-text", theme.text);
  root.style.setProperty("--desk-mute", theme.mute);
  root.style.setProperty("--desk-line", theme.line);
  root.style.setProperty("--desk-primary", theme.primary);
  root.style.setProperty("--desk-accent", theme.accent);
  root.style.setProperty("--desk-sidebar", theme.sidebar);
  root.style.setProperty("--desk-header", theme.header);
  root.style.setProperty("--desk-radius", theme.radius);
  root.style.setProperty("--desk-glow", theme.glow);
  root.dataset.theme = theme.id;
  root.dataset.mode = theme.id === "light" ? "light" : "dark";
  root.style.colorScheme = root.dataset.mode;
}

export function saveTheme(theme: DeskTheme) {
  localStorage.setItem(KEY, JSON.stringify(theme));
  applyTheme(theme);
}

export const MOTIONS = [
  { id: "rise", name: "Rise" },
  { id: "fade", name: "Fade" },
  { id: "slide-left", name: "Slide left" },
  { id: "slide-right", name: "Slide right" },
  { id: "slide-up", name: "Slide up" },
  { id: "zoom-in", name: "Zoom in" },
  { id: "zoom-out", name: "Zoom out" },
  { id: "flip", name: "Flip" },
  { id: "blur", name: "Blur in" },
  { id: "bounce", name: "Bounce" },
  { id: "swing", name: "Swing" },
  { id: "drop", name: "Drop" },
  { id: "glow", name: "Glow pop" },
  { id: "wipe", name: "Wipe" },
  { id: "magic", name: "Magic spin" },
] as const;

const MKEY = "magiciansmm-motion";

export function savedMotion() {
  try {
    const id = localStorage.getItem(MKEY) || "rise";
    return MOTIONS.some((item) => item.id === id) ? id : "rise";
  } catch {
    return "rise";
  }
}

export function applyMotion(id = savedMotion()) {
  document.documentElement.dataset.motion = id;
}

export function saveMotion(id: string) {
  localStorage.setItem(MKEY, id);
  applyMotion(id);
}
