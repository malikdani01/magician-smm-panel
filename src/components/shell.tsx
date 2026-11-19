import { useEffect, useState, useSyncExternalStore, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  Handshake,
  LayoutDashboard,
  Library,
  LifeBuoy,
  ListPlus,
  Menu,
  MessageCircle,
  Megaphone,
  Moon,
  PlusSquare,
  Receipt,
  Settings,
  Wallet,
  Wand2,
  Users,
  Boxes,
  KeyRound,
  QrCode,
  Search,
  Store,
  Sun,
  X,
} from "lucide-react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getMoneyConfig, getPrefs, getWallet, getDeskLook, saveDisplayCurrency } from "@/lib/panel.functions";
import { applyBase, applyDisplay, applyFx, currencySnapshot, findCurrency, inr, moneyState, savedDisplayCode, subscribeCurrency, CURRENCIES, type DeskCurrency } from "@/lib/money";
import { getDeskRole } from "@/lib/admin.functions";
import { getAnnouncement, type AnnouncementBar } from "@/lib/announcement.functions";
import { applyTheme, applyMotion, savedTheme, saveTheme, THEMES, type DeskTheme } from "@/lib/theme";
import hat from "@/assets/hat.png";
import { Starfield } from "@/components/stars";

const walletCache = { at: 0, value: null as number | null };

const LINKS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, hot: false },
  { to: "/engagement-order", label: "Full Engagement", icon: Wand2, hot: false },
  { to: "/single-order", label: "Single Order", icon: PlusSquare, hot: false },
  { to: "/mass", label: "Mass Order", icon: ListPlus, hot: true },
  { to: "/engagement-orders", label: "All Orders", icon: Receipt, hot: false },
] as const;

const STAFF_LINKS = [
  { to: "/instagram", label: "Instagram Accounts", icon: Library, hot: false },
  { to: "/tiktok", label: "TikTok Accounts", icon: Library, hot: false },
  { to: "/detect", label: "Bot Detection", icon: Activity, hot: false },
] as const;

const MARKET_LINKS = [
  { to: "/market", label: "Account Marketplace", icon: Store, hot: false },
  { to: "/deals", label: "Deals", icon: Handshake, hot: false },
] as const;

const TAIL_LINKS = [
  { to: "/wallet", label: "Wallet", icon: Wallet, hot: false },
  { to: "/telegram-bot", label: "Telegram Bot", icon: MessageCircle, hot: false },
  { to: "/support", label: "Support", icon: LifeBuoy, hot: false },
  { to: "/settings", label: "Settings", icon: Settings, hot: false },
] as const;

const ADMIN_LINKS = [
  { to: "/admin/seo", label: "SEO", icon: Search, hot: false },
  { to: "/admin/announcement", label: "Announcement bar", icon: Megaphone, hot: false },
  { to: "/admin/services", label: "Services", icon: Boxes, hot: false },
  { to: "/admin/engagement", label: "Engagement APIs", icon: KeyRound, hot: false },
  { to: "/admin/payments", label: "Payments", icon: QrCode, hot: false },
  { to: "/admin/customers", label: "Customers", icon: Users, hot: false },
  { to: "/admin/sell", label: "Start selling", icon: Store, hot: false },
  { to: "/admin/deals", label: "Deals", icon: Handshake, hot: false },
] as const;

export function Mark({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2">
      <span className="hat-wrap">
        <img src={hat} alt="Magician SMM" className={`hat-magic w-auto ${compact ? "h-9" : "h-12"}`} />
        <i className="hat-glare" style={{ top: 0, right: 2 }} />
        <i className="hat-glare g2" style={{ bottom: 6, left: 0 }} />
        <i className="hat-glare g3" style={{ top: "38%", right: -2 }} />
      </span>
      {!compact && (
        <span className="leading-none">
          <span className="block text-[15px] font-extrabold tracking-tight">Magician</span>
          <span className="block text-[12px] font-bold text-fuchsia-400">SMM Panel</span>
        </span>
      )}
    </Link>
  );
}

export function Wordmark() {
  return <Mark />;
}

export function Shell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (state) => state.location.pathname });
  const { user, isPending } = useCurrentUserState();
  const [balance, setBalance] = useState<number | null>(null);
  const [admin, setAdmin] = useState(false);
  const [open, setOpen] = useState(false);
  const [avatar, setAvatar] = useState("");
  const [deskName, setDeskName] = useState("");
  useSyncExternalStore(subscribeCurrency, currencySnapshot, currencySnapshot);

  useEffect(() => {
    applyTheme(savedTheme());
    applyMotion();
    const local = savedDisplayCode();
    if (local) applyDisplay(findCurrency(local));
    getMoneyConfig()
      .then((config) => {
        applyBase(findCurrency(config.base));
        applyFx(config);
        const chosen = config.display || local || config.base;
        applyDisplay(findCurrency(chosen));
      })
      .catch(() => undefined);
    getDeskLook()
      .then((look) => {
        if (look.theme && !localStorage.getItem("magiciansmm-theme")) {
          try { applyTheme(JSON.parse(look.theme) as DeskTheme); } catch { /* keep local */ }
        }
        if (look.motion) applyMotion(look.motion);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    setOpen(false);
    getDeskRole().then((role) => setAdmin(role === "admin")).catch(() => setAdmin(false));
    getPrefs()
      .then((prefs) => {
        setAvatar(prefs.avatar_url || "");
        setDeskName(prefs.full_name || "");
      })
      .catch(() => undefined);
    if (walletCache.value != null && Date.now() - walletCache.at < 20000) {
      setBalance(walletCache.value);
      return;
    }
    getWallet()
      .then((wallet) => {
        walletCache.at = Date.now();
        walletCache.value = wallet.balance_paise;
        setBalance(wallet.balance_paise);
      })
      .catch(() => setBalance(null));
  }, [path]);

  const links = admin ? [...LINKS, ...STAFF_LINKS, ...TAIL_LINKS, ...ADMIN_LINKS] : [...LINKS, ...MARKET_LINKS, ...TAIL_LINKS];
  const initial = (deskName || user?.displayName || user?.primaryEmail || "M").slice(0, 1).toUpperCase();
  const activeOf = (to: string) => path === to || (to !== "/dashboard" && path.startsWith(`${to}/`));

  const menu = (
    <>
      <div className="mx-4 mb-3 flex items-center gap-2.5 rounded-2xl border border-white/60 bg-white/70 px-3 py-2.5 shadow-sm">
        <div className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-indigo-500 to-cyan-400 text-[12px] font-bold text-white">
          {avatar ? <img src={avatar} alt="" className="size-full object-cover" /> : initial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold">{deskName || user?.displayName || "Member"}</p>
          <p className="truncate text-[10px] text-mute">{user?.primaryEmail || "Signed in"}</p>
        </div>
        <span className="pulse-dot" />
      </div>
      <div className="wallet-card mx-4 mb-4 rounded-2xl p-4">
        <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider">
          <Wallet className="size-3" /> Wallet balance
        </p>
        <p className="mb-3 text-[26px] font-extrabold tracking-tight">{balance == null ? "—" : inr(balance)}</p>
        <Link to="/wallet" className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl text-[12px] font-semibold">
          <Wallet className="size-3.5" /> Add credit
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 pb-6">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-mute">Menu</p>
        {links.map((link) => {
          const active = activeOf(link.to);
          const Icon = link.icon;
          return (
            <Link
              key={link.to}
              to={link.to}
              className={
                "nav-item mb-1 flex min-h-11 items-center gap-2.5 rounded-2xl px-3 py-2 text-[13px] " +
                (active ? "bg-indigo-50 font-semibold text-indigo-600 shadow-sm" : "text-slate-600 hover:bg-white/80")
              }
            >
              <Icon className="size-4" />
              <span className="flex-1">{link.label}</span>
              {link.hot && !active && (
                <span className="rounded-full bg-gradient-to-r from-rose-500 to-orange-400 px-1.5 py-0.5 text-[8px] font-bold text-white">HOT</span>
              )}
            </Link>
          );
        })}
      </nav>
    </>
  );

  return (
    <div className="relative min-h-screen md:grid md:grid-cols-[272px_minmax(0,1fr)]">
      <Starfield />
      <aside className="sticky top-0 z-10 hidden h-screen flex-col border-r md:flex" style={{ background: "var(--desk-sidebar)", borderColor: "var(--desk-line)" }}>
        <div className="flex items-center justify-between px-5 pb-3 pt-5">
          <Mark />
        </div>
        {menu}
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <aside className="drawer relative flex h-full w-[min(86vw,320px)] flex-col pt-4 shadow-2xl" style={{ background: "var(--desk-sidebar)" }}>
            <div className="mb-3 flex items-center justify-between px-5">
              <Mark />
              <button type="button" onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-full bg-white text-slate-600 shadow-sm" aria-label="Close">
                <X className="size-4" />
              </button>
            </div>
            {menu}
          </aside>
        </div>
      )}

      <div className="relative z-10 min-w-0 pb-28 md:pb-0">
        <div className="sticky top-0 z-20">
          <header className="flex items-center justify-between border-b px-3 py-3 backdrop-blur-xl" style={{ background: "color-mix(in oklab, var(--desk-header) 88%, transparent)", borderColor: "var(--desk-line)" }}>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setOpen(true)} className="grid size-10 place-items-center rounded-2xl bg-white text-slate-700 shadow-sm md:hidden" aria-label="Open menu">
                <Menu className="size-5" />
              </button>
              <span className="md:hidden"><Mark compact /></span>
            </div>
            <div className="flex items-center gap-2">
              <ModeMenu />
              <CurrencyMenu />
              {isPending ? <div className="size-10" /> : (
                <Link to="/settings" aria-label="Account settings" className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 text-[13px] font-bold text-white ring-2 ring-violet-300/40">
                  {(avatar || user?.profileImageUrl) ? <img src={avatar || user?.profileImageUrl || ""} alt="" className="size-full object-cover" /> : initial}
                </Link>
              )}
            </div>
          </header>
          {path === "/dashboard" && <AnnounceBar />}
        </div>
        <main key={path} className="page-motion mx-auto max-w-6xl px-4 py-5 md:px-8 md:py-8">{children}</main>
      </div>

      {path === "/dashboard" && (
        <Link
          to="/support"
          className="fixed bottom-24 right-4 z-30 grid size-14 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-cyan-400 text-white shadow-2xl shadow-indigo-500/30 md:bottom-6"
          aria-label="Support"
        >
          <MessageCircle className="size-6" />
        </Link>
      )}

      <nav className="dock md:hidden" aria-label="Main">
        <div className="dock-pill">
          <DockLink to="/dashboard" label="Dashboard" icon={LayoutDashboard} active={activeOf("/dashboard")} />
          <DockLink to="/single-order" label="Single" icon={PlusSquare} active={activeOf("/single-order")} />
          <span className="dock-slot">Full</span>
          <DockLink to="/mass" label="Mass" icon={ListPlus} active={activeOf("/mass")} />
          <button type="button" onClick={() => setOpen(true)} className="dock-link">
            <Menu className="size-4" />
            More
          </button>
        </div>
        <Link to="/engagement-order" className={"dock-fab " + (activeOf("/engagement-order") ? "is-active" : "")} aria-label="Full">
          <span className="dock-fab-btn"><Wand2 className="size-5" /></span>
        </Link>
      </nav>
    </div>
  );
}

function DockLink({ to, label, icon: Icon, active }: { to: "/dashboard" | "/single-order" | "/mass"; label: string; icon: typeof LayoutDashboard; active: boolean }) {
  return (
    <Link to={to} className={"dock-link " + (active ? "is-on" : "")}>
      <Icon className="size-4" />
      {label}
      {active && <i className="dock-dot" />}
    </Link>
  );
}

function AnnounceBar() {
  const [bar, setBar] = useState<AnnouncementBar | null>(null);
  useEffect(() => {
    getAnnouncement().then(setBar).catch(() => setBar(null));
  }, []);
  const lines = (bar?.texts || []).map((line) => line.trim()).filter(Boolean);
  if (!bar?.enabled || !lines.length) return null;
  const reel = Array.from({ length: 8 }, () => lines).flat();
  return (
    <div className="announce" style={{ background: bar.background || undefined, color: bar.color || undefined, fontFamily: `${bar.font}, Outfit, sans-serif` }}>
      <div className="announce-track" style={{ animationDuration: `${bar.seconds}s`, animationDirection: bar.direction === "right" ? "reverse" : "normal" }}>
        {[0, 1].map((copy) => (
          <span className="announce-set" key={copy} aria-hidden={copy === 1}>
            {reel.map((line, index) => (
              <span className="announce-item" key={`${copy}-${index}`}>
                <i className="announce-star" aria-hidden="true">✦</i>
                {line}
              </span>
            ))}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ModeMenu() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"dark" | "light">("dark");
  useEffect(() => {
    setMode(savedTheme().id === "light" ? "light" : "dark");
  }, []);
  function pick(next: "dark" | "light") {
    const theme = next === "light" ? THEMES.find((item) => item.id === "light") || THEMES[0] : THEMES[0];
    saveTheme(theme);
    setMode(next);
    setOpen(false);
  }
  const dark = mode === "dark";
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((value) => !value)} className="inline-flex h-10 items-center gap-1 rounded-xl border px-2 text-[12px] font-bold" style={{ borderColor: "var(--desk-line)" }} aria-label="Color mode">
        {dark ? <Moon className="size-3.5" /> : <Sun className="size-3.5" />}
        <span>{dark ? "Dark" : "Light"}</span>
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-36 rounded-2xl border p-1.5 shadow-2xl" style={{ background: "var(--desk-card)", borderColor: "var(--desk-line)" }}>
          <button type="button" onClick={() => pick("dark")} className={`flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-[12px] font-semibold ${dark ? "bg-violet-500/20" : ""}`}><Moon className="size-3.5" /> Dark</button>
          <button type="button" onClick={() => pick("light")} className={`flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-[12px] font-semibold ${dark ? "" : "bg-violet-500/20"}`}><Sun className="size-3.5" /> Light</button>
        </div>
      )}
    </div>
  );
}

export function CurrencyMenu() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  useSyncExternalStore(subscribeCurrency, currencySnapshot, currencySnapshot);
  const current = moneyState().display;
  const list = CURRENCIES.filter((item) => `${item.code} ${item.name}`.toLowerCase().includes(query.trim().toLowerCase()));
  async function pick(item: DeskCurrency) {
    applyDisplay(item);
    setOpen(false);
    setQuery("");
    try { await saveDisplayCurrency({ data: item.code }); } catch { /* local choice still shows */ }
  }
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((value) => !value)} className="inline-flex h-10 items-center gap-1 rounded-xl border px-2 text-[12px] font-bold" style={{ borderColor: "var(--desk-line)" }}>
        <span>{current.flag}</span>
        <span>{current.code}</span>
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-64 rounded-2xl border p-2 shadow-2xl" style={{ background: "var(--desk-card)", borderColor: "var(--desk-line)" }}>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search currency" className="mb-2 h-10 w-full rounded-xl px-3 text-[13px] outline-none" />
          <div className="max-h-64 overflow-y-auto">
            {list.map((item) => (
              <button key={item.code} type="button" onClick={() => pick(item)} className={`flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-[12px] ${item.code === current.code ? "bg-violet-500/20" : ""}`}>
                <span>{item.flag}</span>
                <span className="font-bold">{item.code}</span>
                <span className="truncate opacity-70">{item.name}</span>
                <span className="ml-auto">{item.symbol}</span>
              </button>
            ))}
          </div>
          <p className="px-2 pt-2 text-[10px] opacity-60">{moneyState().fxStale ? "Last saved rates" : "Live rates"} · stored in {moneyState().base.code}</p>
        </div>
      )}
    </div>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`glass-card p-5 ${className}`}>{children}</section>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-semibold tracking-wide text-mute">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-line bg-white/90 px-4 py-3 text-sm text-foreground outline-none focus:border-indigo-400";

export function PrimaryButton({ children, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...props} className={"btn-gradient inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold disabled:opacity-50 " + className}>
      {children}
    </button>
  );
}

export function GhostButton({ children, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...props} className={"inline-flex min-h-11 items-center justify-center rounded-xl border border-line bg-white px-5 text-sm font-semibold text-foreground " + className}>
      {children}
    </button>
  );
}
