import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Clock, Home, Link2, Search, Zap } from "lucide-react";
import { Authed } from "@/components/gate";
import { browseLiveServices, getWallet, placeSingleOrder } from "@/lib/panel.functions";
import { adminDeleteProvider, adminFetchProvider, adminProviders, adminSaveProvider, adminSingleBalances, getDeskRole } from "@/lib/admin.functions";
import { usdQtyToPaise } from "@/lib/fx";
import { convertMajor, currencySnapshot, formatMajor, inr, moneyState, subscribeCurrency } from "@/lib/money";
import { lineCount, serviceForm } from "@/lib/service-form";

export const Route = createFileRoute("/single-order")({
  component: () => (
    <Authed>
      <SingleOrder />
    </Authed>
  ),
});

const PLATFORMS = ["instagram", "tiktok", "youtube", "facebook", "twitter", "telegram", "whatsapp", "spotify", "linkedin", "discord", "twitch", "snapchat", "kwai"] as const;

type LiveCard = {
  id: number;
  category: string;
  name: string;
  min: number;
  max: number;
  rateUsd: number;
  note: string;
  dripAllowed?: boolean;
  averageMinutes?: number;
  serviceType?: string;
  managedId?: string;
  providerName?: string;
  platform?: string;
};
function plain(value: string) {
  const amp = "&" + "amp;";
  const lt = "&" + "lt;";
  const gt = "&" + "gt;";
  const quot = "&" + "quot;";
  const apos = "&" + "#39;";
  return value.split(amp).join("&").split(lt).join("<").split(gt).join(">").split(quot).join("\"").split(apos).join("'");
}

function serviceRank(service: LiveCard, query: string) {
  const needle = query.trim().toLowerCase();
  const id = String(service.id);
  const name = plain(service.name).toLowerCase();
  if (!needle) return name;
  if (id === needle) return `0${name}`;
  if (id.startsWith(needle)) return `1${name}`;
  if (name.startsWith(needle)) return `2${name}`;
  return `3${name}`;
}

function formatAverage(minutes: number) {
  const total = Math.max(0, Math.round(minutes));
  if (total <= 0) return "";
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const mins = total % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days} day${days === 1 ? "" : "s"}`);
  if (hours) parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
  if (mins) parts.push(`${mins} minute${mins === 1 ? "" : "s"}`);
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

function serviceDescription(value: string) {
  const text = plain(value || "").trim();
  if (!text || /^no extra note/i.test(text)) return "";
  return text;
}

function serviceHit(service: LiveCard, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const id = String(service.id);
  if (/^\d+$/.test(needle)) return id === needle || id.startsWith(needle);
  const blob = `${plain(service.name)} ${plain(service.category)} ${service.platform || ""}`.toLowerCase();
  return needle.split(/\s+/).filter(Boolean).every((word) => blob.includes(word));
}
const ICONS = {
  instagram: InstagramMark,
  tiktok: TikTokMark,
  youtube: YoutubeMark,
  facebook: FacebookMark,
  twitter: XMark,
  telegram: TelegramMark,
  whatsapp: WhatsAppMark,
  spotify: SpotifyMark,
  linkedin: LinkedInMark,
  discord: DiscordMark,
  twitch: TwitchMark,
  snapchat: SnapchatMark,
  kwai: KwaiMark,
} as const;

const HOUR = 60 * 60 * 1000;
type SavedCatalog = { at: number; categories: string[]; services: LiveCard[] };
let memoryCatalog: SavedCatalog | null = null;

function readCatalog(): SavedCatalog | null {
  if (memoryCatalog?.services.length) return memoryCatalog;
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem("mg-single-catalog");
    const parsed = raw ? JSON.parse(raw) as SavedCatalog : null;
    if (!parsed?.services?.length) return null;
    memoryCatalog = parsed;
    return parsed;
  } catch {
    return null;
  }
}

function writeCatalog(next: SavedCatalog) {
  memoryCatalog = next;
  try { sessionStorage.setItem("mg-single-catalog", JSON.stringify(next)); } catch { /* keep the memory copy */ }
}

function SingleOrder() {
  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number] | "all">("all");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState<string[]>(() => memoryCatalog?.categories ?? []);
  const [services, setServices] = useState<LiveCard[]>(() => memoryCatalog?.services ?? []);
  const [serviceId, setServiceId] = useState("");
  const [balanceUsd, setBalanceUsd] = useState<number | null>(null);
  const [balanceCurrency, setBalanceCurrency] = useState("USD");
  const [balances, setBalances] = useState<{ amount: number; currency: string }[]>([]);
  const [link, setLink] = useState("");
  const [amount, setAmount] = useState("");
  const [drip, setDrip] = useState(false);
  const [runs, setRuns] = useState("");
  const [intervalMinutes, setIntervalMinutes] = useState("");
  const [comments, setComments] = useState("");
  const [usernames, setUsernames] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [username, setUsername] = useState("");
  const [hashtag, setHashtag] = useState("");
  const [media, setMedia] = useState("");
  const [answer, setAnswer] = useState("");
  const [subMin, setSubMin] = useState("");
  const [subMax, setSubMax] = useState("");
  const [posts, setPosts] = useState("");
  const [delay, setDelay] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(() => !memoryCatalog?.services.length);
  const [refreshing, setRefreshing] = useState(false);
  const [pending, setPending] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [keys, setKeys] = useState([{ name: "Provider 1", api_url: "https://yoyomedia.in/api/v2", api_key: "" }]);
  const [savedApis, setSavedApis] = useState<{ id: string; name: string; api_url: string; enabled: boolean }[]>([]);
  const [apiBalances, setApiBalances] = useState<Record<string, { balance: number; currency: string; error: string; low: boolean }>>({});
  const [keyNote, setKeyNote] = useState("");
  const [keyBusy, setKeyBusy] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    getDeskRole().then((role) => setAdmin(role === "admin")).catch(() => setAdmin(false));
    adminProviders().then((rows) => setSavedApis(rows.map((row) => ({ id: row.id, name: row.name, api_url: row.api_url, enabled: row.enabled })))).catch(() => setSavedApis([]));
  }, []);

  useEffect(() => {
    if (!admin) return;
    let stop = false;
    const tick = () => {
      adminSingleBalances()
        .then((rows) => {
          if (stop) return;
          setApiBalances(Object.fromEntries(rows.map((row) => [row.id, row])));
        })
        .catch(() => undefined);
    };
    tick();
    const timer = window.setInterval(tick, 3000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [admin, savedApis.length]);

  useLayoutEffect(() => {
    const saved = readCatalog();
    const fresh = Boolean(saved && Date.now() - saved.at < HOUR);
    if (fresh && saved && reload === 0) {
      setCategories(saved.categories);
      setServices(saved.services);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    let cancel = false;
    if (saved?.services.length) {
      setCategories(saved.categories);
      setServices(saved.services);
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    browseLiveServices({ data: { platform: "all", category: "", query: "" } })
      .then((result) => {
        if (cancel) return;
        writeCatalog({ at: Date.now(), categories: result.categories, services: result.services });
        setCategories(result.categories);
        setServices(result.services);
        setBalanceUsd(result.balanceUsd);
        setBalanceCurrency(result.currency || "USD");
        setBalances(result.balances || []);
        setNote("");
      })
      .catch((err: unknown) => {
        if (!cancel) setNote(err instanceof Error ? err.message : "Could not load services.");
      })
      .finally(() => {
        if (!cancel) {
          setLoading(false);
          setRefreshing(false);
        }
      });
    return () => {
      cancel = true;
    };
  }, [reload]);

  useEffect(() => {
    const timer = window.setInterval(() => setReload((value) => value + 1), 60 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  const moneyTick = useSyncExternalStore(subscribeCurrency, currencySnapshot, currencySnapshot);
  const displayCode = moneyState().display.code;
  const liveRows = Object.entries(apiBalances).filter(([, row]) => !row.error);
  const balanceText = (amount: number, currency: string) => {
    const converted = convertMajor(amount, currency || "USD", displayCode);
    return converted == null ? `${currency || "USD"} ${amount}` : formatMajor(converted);
  };
  const apiBalanceLabel = liveRows.length
    ? liveRows.map(([id, row]) => `${savedApis.find((item) => item.id === id)?.name || "API"} ${balanceText(row.balance, row.currency)}`).join(" · ")
    : "—";
  void moneyTick;
  const platformRows = platform === "all" ? services : services.filter((item) => item.platform === platform);
  const categoryNames: string[] = [];
  for (const item of platformRows) {
    if (item.category && !categoryNames.includes(item.category)) categoryNames.push(item.category);
  }
  const listed = platformRows.filter((item) => !category || category === "All categories" || item.category === category);
  const hits = query.trim()
    ? services.filter((item) => serviceHit(item, query)).sort((a, b) => {
        const exact = Number(String(a.id) === query.trim()) - Number(String(b.id) === query.trim());
        return exact || a.id - b.id;
      })
    : [];
  const service = services.find((item) => item.managedId === serviceId) ?? null;
  const dripAllowed = Boolean(service?.dripAllowed) && serviceForm(service?.serviceType || "", service?.name || "").kind === "default";
  const dripOn = drip && dripAllowed;
  const averageLabel = formatAverage(service?.averageMinutes || 0);
  const description = serviceDescription(service?.note || "");
  const form = serviceForm(service?.serviceType || "", service?.name || "");
  const runCount = Math.max(1, Math.floor(Number(runs) || 0));
  const qty = Math.floor(Number(amount));
  const writtenLines = form.comments ? lineCount(comments) : form.usernames ? lineCount(usernames) : 0;
  const orderQty = form.hideQuantity ? Math.max(1, service?.min || 1) : form.quantityFromLines && writtenLines > 0 ? writtenLines : qty;
  const totalQty = dripOn && runCount > 0 ? orderQty * runCount : orderQty;
  const charge = service && Number.isFinite(orderQty) && orderQty > 0 ? usdQtyToPaise(service.rateUsd, totalQty) : 0;
  const inRange = Boolean(service) && Number.isFinite(orderQty) && orderQty >= (service?.min ?? 0) && (form.hideQuantity || orderQty <= (service?.max ?? 0));

  function pickSearch(item: LiveCard) {
    if (item.platform && (PLATFORMS as readonly string[]).includes(item.platform)) setPlatform(item.platform as (typeof PLATFORMS)[number]);
    setCategory(item.category);
    setServiceId(item.managedId || String(item.id));
    setQuery("");
    setComments("");
    setUsernames("");
    setHashtags("");
    setUsername("");
    setHashtag("");
    setMedia("");
    setAnswer("");
  }

  function pickPlatform(next: (typeof PLATFORMS)[number] | "all") {
    setPlatform(next);
    setCategory("");
    setQuery("");
    setServiceId("");
    setComments("");
    setUsernames("");
    setHashtags("");
    setUsername("");
    setHashtag("");
    setMedia("");
    setAnswer("");
  }

  async function submit() {
    if (!service) return;
    if (!inRange) {
      setNote(`Amount must be between ${service.min.toLocaleString("en-IN")} and ${service.max.toLocaleString("en-IN")}.`);
      return;
    }
    setPending(true);
    setNote("");
    try {
      const wallet = await getWallet();
      if (wallet.balance_paise < charge) {
        setNote("Panel wallet does not cover this order. Add credit first.");
        return;
      }
      const result = await placeSingleOrder({
        data: {
          serviceId: service.id,
          managedId: service.managedId,
          link,
          amount: orderQty,
          drip: dripOn,
          runs: dripOn ? runCount : 1,
          intervalMinutes: Math.max(1, Math.floor(Number(intervalMinutes) || 1)),
          comments,
          usernames,
          hashtags,
          username,
          hashtag,
          media,
          answer,
          subMin,
          subMax,
          posts,
          delay,
        },
      });
      setNote(dripOn ? `${result.order_number} drip started. First run is placing now, next runs follow the interval.` : `${result.order_number} is placed #${result.provider_order_id} · ${inr(result.total_paise)}. Delivery abhi live track hogi.`);
      setLink("");
      setAmount("");
    } catch (err: unknown) {
      setNote(err instanceof Error ? err.message : "Order failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl pb-16">
      {admin && (
        <section className="mb-4 rounded-[28px] border border-[#dbeafe] bg-white p-4 shadow-sm">
          <h2 className="text-[16px] font-bold">Single order APIs</h2>
          <p className="mt-1 text-[12px] text-[#64748b]">Add the API URL and key. Balances update live. Removing a provider also removes its balance.</p>
          {savedApis.length > 0 && (
            <ul className="mt-3 space-y-2">
              {savedApis.map((row) => {
                const live = apiBalances[row.id];
                const converted = live && !live.error ? balanceText(live.balance, live.currency) : "";
                return (
                <li key={row.id} className="flex items-center justify-between gap-2 rounded-xl bg-[#f8fafc] px-3 py-2 text-[12px]">
                  <span className="min-w-0">
                    <span className="block truncate"><b>{row.name}</b> · {row.api_url}</span>
                    <span className={`mt-0.5 block font-semibold ${live?.error ? "text-rose-500" : live?.low ? "text-amber-600" : "text-emerald-600"}`}>
                      {live ? (live.error || `Balance ${converted}`) : "Checking balance…"}
                    </span>
                  </span>
                  <button type="button" disabled={keyBusy} onClick={async () => {
                    setKeyBusy(true);
                    try {
                      await adminDeleteProvider({ data: row.id });
                      setSavedApis((current) => current.filter((item) => item.id !== row.id));
                      setKeyNote(`${row.name} removed. Its services are removed from Single order.`);
                      setReload((value) => value + 1);
                    } catch (err: unknown) {
                      setKeyNote(err instanceof Error ? err.message : "Could not remove.");
                    } finally {
                      setKeyBusy(false);
                    }
                  }} className="shrink-0 font-semibold text-rose-600">Remove</button>
                </li>
                );
              })}
            </ul>
          )}
          <div className="mt-3 grid gap-3">
            {keys.map((item, index) => (
              <div key={index} className="grid gap-2 rounded-2xl bg-[#f8fafc] p-3">
                <div className="flex items-center justify-between">
                  <p className="text-[12px] font-semibold">API {index + 1}</p>
                  {keys.length > 1 && <button type="button" onClick={() => setKeys(keys.filter((_, itemIndex) => itemIndex !== index))} className="text-[12px] font-semibold text-[#b91c1c]">Remove</button>}
                </div>
                <input value={item.api_url} onChange={(event) => setKeys(keys.map((row, itemIndex) => itemIndex === index ? { ...row, api_url: event.target.value } : row))} placeholder="API URL" className="h-11 rounded-xl border border-[#e7eef6] bg-white px-3 text-[13px] outline-none" />
                <input value={item.api_key} onChange={(event) => setKeys(keys.map((row, itemIndex) => itemIndex === index ? { ...row, api_key: event.target.value } : row))} placeholder="API key" className="h-11 rounded-xl border border-[#e7eef6] bg-white px-3 text-[13px] outline-none" />
              </div>
            ))}
            <button type="button" onClick={() => setKeys([...keys, { name: `Provider ${keys.length + 1}`, api_url: "https://yoyomedia.in/api/v2", api_key: "" }])} className="h-10 rounded-xl bg-[#f3f6fa] text-[12px] font-bold text-[#1d4ed8]">Add another API</button>
            <button
              type="button"
              disabled={keyBusy}
              onClick={async () => {
                const filled = keys.filter((item) => item.api_key.trim());
                if (!filled.length) {
                  setKeyNote("Enter an API key.");
                  return;
                }
                setKeyBusy(true);
                setKeyNote("");
                const notes: string[] = [];
                for (const item of filled) {
                  try {
                    const saved = await adminSaveProvider({ data: { name: item.name || "Provider", api_url: item.api_url, api_key: item.api_key, enabled: true } });
                    const result = await adminFetchProvider({ data: saved.id });
                    notes.push(`${result.total.toLocaleString("en-IN")} services`);
                  } catch (err: unknown) {
                    notes.push(err instanceof Error ? err.message : "Save failed");
                  }
                }
                setKeyNote(notes.join(" · ") + " · services loaded.");
                setSavedApis(await adminProviders().then((rows) => rows.map((row) => ({ id: row.id, name: row.name, api_url: row.api_url, enabled: row.enabled }))).catch(() => savedApis));
                setReload((value) => value + 1);
                setKeyBusy(false);
              }}
              className="h-11 rounded-xl bg-[#2563eb] text-[13px] font-bold text-white disabled:opacity-60"
            >
              {keyBusy ? "Saving…" : "Save APIs and load services"}
            </button>
            {keyNote && <p className="text-[12px] text-[#1e3a8a]">{keyNote}</p>}
          </div>
        </section>
      )}
      <section className="rounded-[28px] border border-[#e7eef6] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-label="All platforms"
            onClick={() => pickPlatform("all")}
            className={`grid size-11 place-items-center rounded-2xl border ${platform === "all" ? "border-[#2563eb] bg-[#2563eb] text-white ring-2 ring-[#2563eb]" : "border-[#e7eef6] bg-[#eef3f8] text-[#334155]"}`}
          >
            <Home className="size-5" />
          </button>
          {PLATFORMS.map((id) => {
            const Icon = ICONS[id];
            const on = platform === id;
            return (
              <button
                key={id}
                type="button"
                aria-label={id}
                onClick={() => pickPlatform(id)}
                className={`grid size-11 place-items-center rounded-2xl border ${on ? "border-[#2563eb] bg-white ring-2 ring-[#2563eb]" : "border-[#e7eef6] bg-white"}`}
              >
                <Icon />
              </button>
            );
          })}
        </div>
        {admin && <p className="mt-3 text-[12px] text-[#64748b]">{loading && !services.length ? "Loading services…" : `API balance ${apiBalanceLabel}`}</p>}

        <label className="mt-4 block text-[13px] font-semibold text-[#334155]">
          Search for a service...
          <span className="mt-1 flex h-11 items-center gap-2 overflow-hidden rounded-xl bg-[#e7f0f8] px-3 text-[#94a3b8]">
            <Search className="size-4 shrink-0" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Service ID, TikTok views, Instagram shares" className="min-w-0 w-full bg-transparent text-[14px] text-[#0f172a] outline-none" />
          </span>
          <span className="mt-1 block text-[11px] font-normal text-[#94a3b8]">{(loading && !services.length) || refreshing ? "Opening saved services…" : `${listed.length.toLocaleString("en-IN")} of ${services.length.toLocaleString("en-IN")} services`}</span>
          {query.trim() && (
            <div className="mt-2 max-h-72 overflow-y-auto rounded-2xl border border-[#c4b5fd] bg-[#1b1438] shadow-2xl">
              {hits.slice(0, 40).map((item) => (
                <button key={item.managedId || item.id} type="button" onClick={() => pickSearch(item)} className="block w-full break-words border-b border-[#31265f] px-3 py-2.5 text-left last:border-b-0">
                  <span className="block text-[13px] font-semibold text-[#f8f5ff]">{item.id} · {plain(item.name)}</span>
                  <span className="mt-0.5 block text-[11px] text-[#c4b5fd]">{plain(item.category)}</span>
                </button>
              ))}
              {hits.length === 0 && <p className="px-3 py-3 text-[13px] text-[#c4b5fd]">No service found</p>}
              {hits.length > 40 && <p className="px-3 py-2 text-[11px] text-[#c4b5fd]">Showing 40 of {hits.length.toLocaleString("en-IN")}. Type more to narrow it.</p>}
            </div>
          )}
        </label>

        <DropList
          label="Category"
          value={category}
          placeholder="All categories"
          options={[{ id: "", label: "All categories" }, ...categoryNames.map((item) => ({ id: item, label: plain(item) }))]}
          onPick={(next) => { setCategory(next); setServiceId(""); }}
        />

        <DropList
          label="Service"
          value={service?.managedId ?? ""}
          placeholder="Select a service"
          options={listed.map((item) => ({
            id: item.managedId || String(item.id),
            label: `${item.id} · ${plain(item.name)}`,
          }))}
          onPick={(id) => {
            const picked = listed.find((item) => (item.managedId || String(item.id)) === id);
            setServiceId(id);
            if (picked) setCategory(picked.category);
            setComments(""); setUsernames(""); setHashtags(""); setUsername(""); setHashtag(""); setMedia(""); setAnswer("");
          }}
        />

        {averageLabel && (
          <div className="mt-4">
            <p className="text-[13px] font-semibold text-[#334155]">Average Time</p>
            <div className="mt-1 flex items-center gap-3 rounded-xl border border-[#e7eef6] bg-[#f8fbff] px-3 py-3">
              <span className="grid size-9 place-items-center rounded-full bg-[#fff4e5] text-[#ea7a14]"><Clock className="size-4" /></span>
              <div>
                <p className="text-[15px] font-semibold text-[#0f172a]">{averageLabel}</p>
                <p className="text-[12px] text-[#64748b]">Average completion time for this service</p>
              </div>
            </div>
          </div>
        )}

        {description && (
          <div className="mt-4">
            <p className="text-[13px] font-semibold text-[#334155]">Description</p>
            <div className="mt-1 whitespace-pre-line rounded-xl border border-[#e7eef6] bg-[#f8fbff] px-3 py-3 text-[13px] leading-6 text-[#0f172a]">{description}</div>
          </div>
        )}

        {service && (
          <p className="mt-3 text-[12px] text-[#64748b]">{inr(Math.round(service.rateUsd * 84 * 100))} per 1,000</p>
        )}

        <label className="mt-4 block text-[13px] font-semibold text-[#334155]">
          Enter Link
          <span className="mt-1 flex h-11 items-center gap-2 rounded-xl border border-[#e7eef6] px-3">
            <Link2 className="size-4 text-[#94a3b8]" />
            <input value={link} onChange={(event) => setLink(event.target.value)} placeholder="Paste your link here" className="w-full bg-transparent text-[14px] outline-none" />
          </span>
        </label>

        {form.comments && (
          <label className="mt-4 block text-[13px] font-semibold text-[#334155]">
            Comments....
            <textarea value={comments} onChange={(event) => setComments(event.target.value)} placeholder="1 comment per line" rows={5} className="mt-1 w-full rounded-xl border border-[#e7eef6] px-3 py-2 text-[14px] outline-none" />
            <span className="mt-1 block text-[12px] font-normal text-[#94a3b8]">{writtenLines.toLocaleString("en-IN")} comment{writtenLines === 1 ? "" : "s"}. These exact comments are delivered.</span>
          </label>
        )}
        {form.usernames && (
          <label className="mt-4 block text-[13px] font-semibold text-[#334155]">
            Usernames
            <textarea value={usernames} onChange={(event) => setUsernames(event.target.value)} placeholder="1 username per line" rows={4} className="mt-1 w-full rounded-xl border border-[#e7eef6] px-3 py-2 text-[14px] outline-none" />
          </label>
        )}
        {form.hashtags && (
          <label className="mt-4 block text-[13px] font-semibold text-[#334155]">
            Hashtags
            <textarea value={hashtags} onChange={(event) => setHashtags(event.target.value)} placeholder="1 hashtag per line" rows={3} className="mt-1 w-full rounded-xl border border-[#e7eef6] px-3 py-2 text-[14px] outline-none" />
          </label>
        )}
        {form.hashtag && (
          <label className="mt-4 block text-[13px] font-semibold text-[#334155]">
            Hashtag
            <input value={hashtag} onChange={(event) => setHashtag(event.target.value)} placeholder="#hashtag" className="mt-1 h-11 w-full rounded-xl border border-[#e7eef6] px-3 text-[14px] outline-none" />
          </label>
        )}
        {form.username && (
          <label className="mt-4 block text-[13px] font-semibold text-[#334155]">
            Username
            <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="username" className="mt-1 h-11 w-full rounded-xl border border-[#e7eef6] px-3 text-[14px] outline-none" />
          </label>
        )}
        {form.media && (
          <label className="mt-4 block text-[13px] font-semibold text-[#334155]">
            Media URL
            <input value={media} onChange={(event) => setMedia(event.target.value)} placeholder="https://..." className="mt-1 h-11 w-full rounded-xl border border-[#e7eef6] px-3 text-[14px] outline-none" />
          </label>
        )}
        {form.answer && (
          <label className="mt-4 block text-[13px] font-semibold text-[#334155]">
            Answer number
            <input value={answer} inputMode="numeric" onChange={(event) => setAnswer(event.target.value.replace(/[^\d]/g, ""))} placeholder="1" className="mt-1 h-11 w-full rounded-xl border border-[#e7eef6] px-3 text-[14px] outline-none" />
          </label>
        )}
        {form.subscription && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <label className="text-[13px] font-semibold text-[#334155]">Min<input value={subMin} inputMode="numeric" onChange={(event) => setSubMin(event.target.value.replace(/[^\d]/g, ""))} className="mt-1 h-11 w-full rounded-xl border border-[#e7eef6] px-3 text-[14px] outline-none" /></label>
            <label className="text-[13px] font-semibold text-[#334155]">Max<input value={subMax} inputMode="numeric" onChange={(event) => setSubMax(event.target.value.replace(/[^\d]/g, ""))} className="mt-1 h-11 w-full rounded-xl border border-[#e7eef6] px-3 text-[14px] outline-none" /></label>
            <label className="text-[13px] font-semibold text-[#334155]">Posts<input value={posts} inputMode="numeric" onChange={(event) => setPosts(event.target.value.replace(/[^\d]/g, ""))} className="mt-1 h-11 w-full rounded-xl border border-[#e7eef6] px-3 text-[14px] outline-none" /></label>
            <label className="text-[13px] font-semibold text-[#334155]">Delay<input value={delay} inputMode="numeric" onChange={(event) => setDelay(event.target.value.replace(/[^\d]/g, ""))} placeholder="minutes" className="mt-1 h-11 w-full rounded-xl border border-[#e7eef6] px-3 text-[14px] outline-none" /></label>
          </div>
        )}

        {!form.hideQuantity && (
        <label className="mt-4 block text-[13px] font-semibold text-[#334155]">
          Amount
          <input
            value={form.quantityFromLines ? (writtenLines ? String(writtenLines) : "") : amount}
            inputMode="numeric"
            readOnly={form.quantityFromLines}
            onChange={(event) => setAmount(event.target.value.replace(/[^\d]/g, ""))}
            placeholder="Enter amount"
            className="mt-1 h-11 w-full rounded-xl border border-[#e7eef6] px-3 text-[14px] outline-none"
          />
          <span className="mt-1 block text-[12px] font-normal text-[#94a3b8]">Min: {service?.min.toLocaleString("en-IN") ?? "—"} · Max: {service?.max.toLocaleString("en-IN") ?? "—"}</span>
          {amount !== "" && !form.quantityFromLines && service && qty < service.min && <p className="mt-1 text-[12px] font-semibold text-rose-600">Below {service.min.toLocaleString("en-IN")} not allowed</p>}
          {amount !== "" && !form.quantityFromLines && service && qty > service.max && <p className="mt-1 text-[12px] font-semibold text-rose-600">Above {service.max.toLocaleString("en-IN")} not allowed</p>}
        </label>
        )}

        {dripAllowed ? (
          <div className="mt-4 rounded-2xl border border-violet-400/40 bg-[#241c48] p-3">
            <label className="flex items-center justify-between gap-3 text-[14px] font-semibold">
              <span>Drip-feed</span>
              <button type="button" role="switch" aria-checked={drip} onClick={() => setDrip((value) => !value)} className={`relative h-7 w-12 rounded-full ${drip ? "bg-violet-500" : "bg-[#3a335f]"}`}>
                <span className={`absolute top-0.5 size-6 rounded-full bg-white shadow ${drip ? "left-5" : "left-0.5"}`} />
              </button>
            </label>
            <p className="mt-2 text-[12px] text-[#c4b5fd]">Runs are placed on the interval you set.</p>
            {dripOn && (
              <div className="mt-3 grid gap-3">
                <label className="block text-[13px] font-semibold">
                  Runs
                  <input value={runs} inputMode="numeric" onChange={(event) => setRuns(event.target.value.replace(/[^\d]/g, ""))} placeholder="How many orders" className="mt-1 h-11 w-full rounded-xl px-3 text-[14px] outline-none" />
                  {runs !== "" && Number(runs) < 1 && <p className="mt-1 text-[12px] font-semibold text-rose-300">Below 1 not allowed</p>}
                </label>
                <label className="block text-[13px] font-semibold">
                  Intervals (in minutes)
                  <input value={intervalMinutes} inputMode="numeric" onChange={(event) => setIntervalMinutes(event.target.value.replace(/[^\d]/g, ""))} placeholder="Minutes between runs" className="mt-1 h-11 w-full rounded-xl px-3 text-[14px] outline-none" />
                  {intervalMinutes !== "" && Number(intervalMinutes) < 1 && <p className="mt-1 text-[12px] font-semibold text-rose-300">Below 1 not allowed</p>}
                </label>
                <label className="block text-[13px] font-semibold">
                  Total quantity
                  <input readOnly value={Number.isFinite(totalQty) ? totalQty : 0} className="mt-1 h-11 w-full rounded-xl px-3 text-[14px] outline-none" />
                </label>
              </div>
            )}
          </div>
        ) : null}

        <div className="mt-4 flex items-center justify-between text-[14px]">
          <span className="font-semibold">Charge</span>
          <span className="font-bold text-[#2563eb]">{inr(charge)}</span>
        </div>

        <button type="button" disabled={pending || !service} onClick={submit} className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#2563eb] text-[14px] font-bold tracking-wide text-white disabled:opacity-60">
          <Zap className="size-4" /> {pending ? "SUBMITTING…" : "SUBMIT ORDER"}
        </button>
        {note && <p className="mt-3 text-center text-[13px] text-[#334155]">{note}</p>}
      </section>
    </div>
  );
}

function DropList({ label, value, placeholder, options, onPick, forceOpen = false }: { label: string; value: string; placeholder: string; options: { id: string; label: string }[]; onPick: (id: string) => void; forceOpen?: boolean }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen, options.length]);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  const current = options.find((item) => item.id === value)?.label || placeholder;
  return (
    <div ref={box} className="relative mt-4">
      <p className="text-[13px] font-semibold">{label}</p>
      <button type="button" onClick={() => setOpen((on) => !on)} className="mt-1 flex h-12 w-full min-w-0 items-center justify-between gap-2 overflow-hidden rounded-2xl border border-[#c4b5fd] bg-[#241c48] px-3 text-left text-[13px] text-[#f8f5ff]">
        <span className="min-w-0 flex-1 truncate">{current}</span>
        <span className="shrink-0 text-[#c4b5fd]">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div className="absolute z-40 mt-1 w-full overflow-hidden rounded-2xl border border-[#c4b5fd] bg-[#1b1438] shadow-2xl">
          <ul className="max-h-72 overflow-y-auto overscroll-contain py-1">
            {options.map((item) => (
              <li key={item.id || item.label}>
                <button type="button" onClick={() => { onPick(item.id); setOpen(false); }} className={`block w-full break-words px-3 py-2.5 text-left text-[13px] leading-snug text-[#f8f5ff] ${item.id === value ? "bg-[#31265f] font-semibold" : ""}`}>
                  {item.label}
                </button>
              </li>
            ))}
            {options.length === 0 && <li className="px-3 py-2 text-[13px] text-[#c4b5fd]">Nothing here</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

function InstagramMark() {
  return (
    <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
      <defs>
        <radialGradient id="ig" cx="30%" cy="110%" r="120%">
          <stop offset="0%" stopColor="#f9ce34" />
          <stop offset="40%" stopColor="#ee2a7b" />
          <stop offset="100%" stopColor="#6228d7" />
        </radialGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#ig)" />
      <rect x="8" y="8" width="16" height="16" rx="5" fill="none" stroke="#fff" strokeWidth="2" />
      <circle cx="16" cy="16" r="4" fill="none" stroke="#fff" strokeWidth="2" />
      <circle cx="21.5" cy="10.5" r="1.2" fill="#fff" />
    </svg>
  );
}

function TikTokMark() {
  return (
    <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#111" />
      <path d="M18 8c.6 2.4 2.2 4 4.6 4.4v2.4c-1.6 0-3.1-.5-4.4-1.4v6.4a5.8 5.8 0 1 1-5-5.7v2.6a3.3 3.3 0 1 0 2.4 3.1V8H18z" fill="#25f4ee" transform="translate(-.6 .4)" />
      <path d="M18 8c.6 2.4 2.2 4 4.6 4.4v2.4c-1.6 0-3.1-.5-4.4-1.4v6.4a5.8 5.8 0 1 1-5-5.7v2.6a3.3 3.3 0 1 0 2.4 3.1V8H18z" fill="#fe2c55" transform="translate(.6 -.2)" />
      <path d="M18 8c.6 2.4 2.2 4 4.6 4.4v2.4c-1.6 0-3.1-.5-4.4-1.4v6.4a5.8 5.8 0 1 1-5-5.7v2.6a3.3 3.3 0 1 0 2.4 3.1V8H18z" fill="#fff" />
    </svg>
  );
}

function YoutubeMark() {
  return (
    <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#ff0033" />
      <path d="M13 11.5v9l8-4.5-8-4.5z" fill="#fff" />
    </svg>
  );
}

function FacebookMark() {
  return (
    <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#1877f2" />
      <path d="M18.2 16.8H16v8h-3.2v-8H11v-2.7h1.8v-1.8c0-2.2 1-3.5 3.6-3.5h2.2v2.7h-1.4c-.8 0-1 .3-1 .9v1.7h2.5l-.5 2.7z" fill="#fff" />
    </svg>
  );
}

function XMark() {
  return (
    <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#111" />
      <path d="M9 9.5h3.2l3.2 4.3 3.6-4.3H22l-5 5.8L22.4 22h-3.1l-3.5-4.6L12 22H9.2l5.3-6.2L9 9.5z" fill="#fff" />
    </svg>
  );
}

function TelegramMark() {
  return (
    <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
      <circle cx="16" cy="16" r="14" fill="#2aa3e0" />
      <path d="M8 15.6 22.2 10l-2.2 12.2-4.6-3.4-2.4 2.3.2-3.6 8.2-7.4-10.2 6.1L8 15.6z" fill="#fff" />
    </svg>
  );
}

function WhatsAppMark() {
  return (
    <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
      <circle cx="16" cy="16" r="14" fill="#25d366" />
      <path d="M16 8.2a7.6 7.6 0 0 0-6.5 11.5L8.6 23l3.4-.9A7.6 7.6 0 1 0 16 8.2zm4.3 10.7c-.2.5-1 .9-1.4 1-.4 0-.8.2-2.7-.6-2.3-.9-3.7-3.2-3.8-3.4-.1-.2-1-1.3-1-2.5s.6-1.8.9-2c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .5.4.2.5.7 1.8.7 1.9.1.1 0 .3-.1.5l-.3.4c-.1.1-.2.3-.1.5.2.3.7 1.2 1.5 1.9 1 .9 1.8 1.1 2.1 1.3.2.1.4.1.5-.1l.6-.7c.2-.2.3-.2.5-.1l1.6.8c.2.1.4.2.4.3 0 .2-.1.8-.4 1.1z" fill="#fff" />
    </svg>
  );
}

function SpotifyMark() {
  return (
    <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
      <circle cx="16" cy="16" r="14" fill="#1db954" />
      <path d="M10 13.2c3.6-1.1 8-.8 11.2 1.1" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M11 16.4c2.8-.8 6.2-.6 8.6.8" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 19.4c2.1-.5 4.4-.3 6 .6" fill="none" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function LinkedInMark() {
  return (
    <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
      <rect width="32" height="32" rx="6" fill="#0a66c2" />
      <path d="M9 13h3v10H9zM10.5 8.2a1.7 1.7 0 1 1 0 3.4 1.7 1.7 0 0 1 0-3.4zM15 13h2.9v1.4h.1c.4-.8 1.4-1.6 2.9-1.6 3.1 0 3.6 2 3.6 4.6V23H21v-4.8c0-1.1 0-2.6-1.6-2.6s-1.8 1.2-1.8 2.5V23H15v-10z" fill="#fff" />
    </svg>
  );
}

function DiscordMark() {
  return (
    <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#5865f2" />
      <path d="M21.6 11.2a10 10 0 0 0-2.5-1l-.2.5a8 8 0 0 1 2.2.8 11 11 0 0 0-8.2 0 8 8 0 0 1 2.2-.8l-.2-.5a10 10 0 0 0-2.5 1C9.4 13.6 8.8 16 8.6 18.3c1.3 1 2.6 1.6 3.9 2l.8-1.2a6 6 0 0 1-1.2-.6l.3-.2c2.4 1.1 5 1.1 7.3 0l.3.2c-.4.2-.8.4-1.2.6l.8 1.2c1.3-.4 2.6-1 3.9-2-.3-2.4-1-4.8-2.9-7.1zM13.6 17.2c-.6 0-1.1-.6-1.1-1.3s.5-1.3 1.1-1.3 1.1.6 1.1 1.3-.5 1.3-1.1 1.3zm4.8 0c-.6 0-1.1-.6-1.1-1.3s.5-1.3 1.1-1.3 1.1.6 1.1 1.3-.5 1.3-1.1 1.3z" fill="#fff" />
    </svg>
  );
}

function TwitchMark() {
  return (
    <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#9146ff" />
      <path d="M10 8h12v10l-3 3h-3l-2 2h-2v-2H10V8zm3 2v6h1.5V10H13zm4 0v6H18.5V10H17z" fill="#fff" />
    </svg>
  );
}

function KwaiMark() {
  return (
    <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#ff4906" />
      <path d="M9 22V10h3.2l3.3 6.2L18.8 10H22v12h-2.6v-6.8L16.4 22h-1.7l-3.1-6.8V22H9z" fill="#fff" />
    </svg>
  );
}

function SnapchatMark() {
  return (
    <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#fffc00" />
      <path d="M16 7.5c2.2 0 3.6 1.6 3.6 3.8 0 1.2-.2 2.2 0 2.8.3.6 1.4.7 2 .9.4.1.3.6-.2.7-.8.1-1.3.5-1.4 1.1 0 .3.4.5 1.1.7.5.2.7.5.4.8-.6.5-1.6.6-2.2 1.2-.3.3-.2.7.4 1 .8.4 1.6 1 1.2 1.6-.5.7-2 .4-3.1.2-.4 0-.7.3-.8.7-.2.8-1 1.3-1.9 1.3s-1.7-.5-1.9-1.3c-.1-.4-.4-.7-.8-.7-1.1.2-2.6.5-3.1-.2-.4-.6.4-1.2 1.2-1.6.6-.3.7-.7.4-1-.6-.6-1.6-.7-2.2-1.2-.3-.3-.1-.6.4-.8.7-.2 1.1-.4 1.1-.7-.1-.6-.6-1-1.4-1.1-.5-.1-.6-.6-.2-.7.6-.2 1.7-.3 2-.9.2-.6 0-1.6 0-2.8 0-2.2 1.4-3.8 3.6-3.8z" fill="#111" />
    </svg>
  );
}
