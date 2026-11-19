import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Bookmark,
  Camera,
  Eye,
  EyeOff,
  Heart,
  KeyRound,
  LogOut,
  MessageCircle,
  Repeat2,
  Plus,
  Save,
  Settings as SettingsIcon,
  Share2,
  Shield,
  Sparkles,
  User,
  Users,
} from "lucide-react";
import { signOut } from "@/lib/auth/client";
import { Authed } from "@/components/gate";
import { changeAdminLogin, addPanelAdmin, listPanelAdmins, removePanelAdmin, changeDeskPassword, getMoneyConfig, getPrefs, refreshFx, saveBaseCurrency, saveDeskLook, saveDisplayCurrency, savePrefs } from "@/lib/panel.functions";
import { getDeskRole, adminSetAuthGate, publicAuthGate } from "@/lib/admin.functions";
import { applyBase, applyDisplay, applyFx, CURRENCIES, findCurrency, moneyState, type DeskCurrency } from "@/lib/money";
import { THEMES, MOTIONS, saveTheme, saveMotion, savedTheme, savedMotion, type DeskTheme } from "@/lib/theme";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/settings")({
  component: () => (
    <Authed>
      <Settings />
    </Authed>
  ),
});

const DEFAULTS: Record<string, number> = {
  views: 100,
  likes: 5,
  comments: 2,
  saves: 1,
  shares: 1,
  reposts: 0.5,
  followers: 2,
  subscribers: 3,
  watch_hours: 5,
  retweets: 4,
};

function Settings() {
  const { user } = useCurrentUserState();
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState("");
  const [organic, setOrganic] = useState(false);
  const [ratios, setRatios] = useState<Record<string, number>>(DEFAULTS);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminConfirm, setAdminConfirm] = useState("");
  const [panelAdmins, setPanelAdmins] = useState<{ id: string; email: string }[]>([]);
  const [adminDrafts, setAdminDrafts] = useState([{ key: "1", email: "", password: "" }]);
  const [showPassword, setShowPassword] = useState(false);
  const [key, setKey] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [theme, setTheme] = useState<DeskTheme>(THEMES[0]);
  const [motion, setMotion] = useState("rise");
  const [admin, setAdmin] = useState(false);
  const [authOpen, setAuthOpenState] = useState(true);
  const [currency, setCurrency] = useState<DeskCurrency>(CURRENCIES[0]);
  const [baseCode, setBaseCode] = useState("INR");
  const [fxNote, setFxNote] = useState("");

  useEffect(() => {
    setTheme(savedTheme());
    setMotion(savedMotion());
  }, []);

  useEffect(() => {
    getPrefs()
      .then((prefs) => {
        setName(prefs.full_name || user?.displayName || "");
        setPhoto(prefs.avatar_url || "");
        setOrganic(Boolean(prefs.organic_enabled));
        setKey(prefs.api_key || "");
        try {
          setRatios({ ...DEFAULTS, ...JSON.parse(prefs.ratios_json || "{}") });
        } catch {
          setRatios(DEFAULTS);
        }
      })
      .catch(() => setNote("Settings could not load."));
    getDeskRole().then((role) => setAdmin(role === "admin")).catch(() => setAdmin(false));
    publicAuthGate().then((gate) => setAuthOpenState(gate.open)).catch(() => undefined);
    getMoneyConfig()
      .then((config) => {
        applyBase(findCurrency(config.base));
        applyFx(config);
        setBaseCode(config.base);
        const shown = findCurrency(config.display || config.base);
        setCurrency(shown);
        applyDisplay(shown);
        const when = config.updatedAt ? new Date(config.updatedAt).toLocaleString() : "not loaded";
        setFxNote(config.stale ? `Last saved rates ${when}. Live feed did not answer.` : `Rates updated ${when}.`);
      })
      .catch(() => undefined);
  }, [user?.displayName]);

  function setRatio(id: string, value: number) {
    setRatios((current) => ({ ...current, [id]: value }));
  }

  async function onPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setNote("Choose a photo.");
      return;
    }
    try {
      const data = await compressPhoto(file);
      setPhoto(data);
      setNote("Photo ready. Press Save Changes to keep it.");
    } catch (err: unknown) {
      setNote(err instanceof Error ? err.message : "Could not open the photo.");
    }
  }

  async function saveName() {
    setBusy("profile");
    try {
      await savePrefs({
        data: {
          full_name: name,
          ...(photo.startsWith("data:image/") ? { avatar_url: photo } : {}),
        },
      });
      setNote("Profile saved. Name and photo are stored.");
    } catch (err: unknown) {
      setNote(err instanceof Error ? err.message : "Could not save profile.");
    } finally {
      setBusy("");
    }
  }

  async function saveCurrency(next: DeskCurrency) {
    setCurrency(next);
    applyDisplay(next);
    setBusy("currency");
    try {
      await saveDisplayCurrency({ data: next.code });
      setNote(`${next.code} is now the panel currency. Stored wallet balances were not rewritten.`);
    } catch (err: unknown) {
      setNote(err instanceof Error ? err.message : "Could not save the currency.");
    } finally {
      setBusy("");
    }
  }

  async function saveBase(code: string) {
    setBusy("base");
    try {
      const saved = await saveBaseCurrency({ data: code });
      applyBase(findCurrency(saved.base));
      applyFx(saved);
      setBaseCode(saved.base);
      setFxNote(`Base ${saved.base}. Rates refreshed. Existing wallet numbers were not rewritten.`);
    } catch (err: unknown) {
      setNote(err instanceof Error ? err.message : "Could not save the base currency.");
    } finally {
      setBusy("");
    }
  }

  async function reloadRates() {
    setBusy("fx");
    try {
      const saved = await refreshFx();
      applyFx(saved);
      const when = saved.updatedAt ? new Date(saved.updatedAt).toLocaleString() : "now";
      setFxNote(saved.stale ? `Feed fail. Last rates ${when}.` : `Rates refreshed ${when}.`);
    } catch (err: unknown) {
      setNote(err instanceof Error ? err.message : "Could not refresh rates.");
    } finally {
      setBusy("");
    }
  }

  async function toggleOrganic() {
    const next = !organic;
    setOrganic(next);
    await savePrefs({ data: { organic_enabled: next } });
    setNote(next ? "AI Organic Automation enabled." : "AI Organic Automation disabled.");
  }

  async function saveRatios() {
    setBusy("ratios");
    try {
      await savePrefs({ data: { organic_enabled: organic, ratios_json: JSON.stringify(ratios) } });
      setNote("AI configuration saved on this desk. No outside model is connected.");
    } catch (err: unknown) {
      setNote(err instanceof Error ? err.message : "Could not save configuration.");
    } finally {
      setBusy("");
    }
  }

  useEffect(() => {
    if (user?.primaryEmail) setAdminEmail(user.primaryEmail);
  }, [user?.primaryEmail]);

  async function toggleAuthGate() {
    const next = !authOpen;
    setBusy("auth-gate");
    try {
      const saved = await adminSetAuthGate({ data: next });
      setAuthOpenState(saved.open);
      setNote(saved.open ? "Login and registration are on." : "Login and registration are off. Existing customers are signed out. Admin login still works.");
    } catch (err: unknown) {
      setNote(err instanceof Error ? err.message : "Could not update login access.");
    } finally {
      setBusy("");
    }
  }

  async function saveAdminLogin() {
    const email = adminEmail.trim().toLowerCase();
    const nextPassword = adminPassword.trim();
    if (!nextPassword || nextPassword.length < 8) {
      setNote("Naya password likho, kam se kam 8 characters.");
      return;
    }
    if (nextPassword !== adminConfirm.trim()) {
      setNote("Password aur confirm password same hone chahiye.");
      return;
    }
    if (!email) {
      setNote("Admin email likho.");
      return;
    }
    setBusy("admin-login");
    try {
      const saved = await changeAdminLogin({ data: { email, password: nextPassword } });
      setAdminEmail(saved.email);
      setAdminPassword("");
      setAdminConfirm("");
      setNote("Admin login updated. Use this email and password next time.");
    } catch (err: unknown) {
      setNote(err instanceof Error ? err.message : "Could not update the admin login.");
    } finally {
      setBusy("");
    }
  }

  function loadPanelAdmins() {
    listPanelAdmins().then(setPanelAdmins).catch(() => setPanelAdmins([]));
  }

  useEffect(() => {
    if (admin) loadPanelAdmins();
  }, [admin]);

  async function saveExtraAdmin(key: string) {
    const draft = adminDrafts.find((item) => item.key === key);
    const email = draft?.email.trim().toLowerCase() || "";
    const password = draft?.password.trim() || "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setNote("Extra admin ka email sahi likho.");
      return;
    }
    if (password.length < 8) {
      setNote("Extra admin ka password kam se kam 8 characters ka ho.");
      return;
    }
    setBusy(`extra-${key}`);
    try {
      await addPanelAdmin({ data: { email, password } });
      setAdminDrafts((current) => current.map((item) => (item.key === key ? { ...item, email: "", password: "" } : item)));
      loadPanelAdmins();
      setNote(`${email} ab admin panel login kar sakta hai.`);
    } catch (err: unknown) {
      setNote(err instanceof Error ? err.message : "Could not save the extra admin.");
    } finally {
      setBusy("");
    }
  }

  async function dropExtraAdmin(id: string, email: string) {
    setBusy(`drop-${id}`);
    try {
      await removePanelAdmin({ data: id });
      loadPanelAdmins();
      setNote(`${email} ka admin access hata diya.`);
    } catch (err: unknown) {
      setNote(err instanceof Error ? err.message : "Could not remove admin access.");
    } finally {
      setBusy("");
    }
  }

  async function changePassword() {
    if (password.length < 8) {
      setNote("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setNote("New password and confirm password do not match.");
      return;
    }
    setBusy("password");
    try {
      await changeDeskPassword({ data: password });
      setPassword("");
      setConfirm("");
      setNote("Password updated. Use it the next time you sign in.");
    } catch (err: unknown) {
      setNote(err instanceof Error ? err.message : "Could not change password.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-16">
      <section className="flex items-center gap-3 rounded-3xl border border-[#e7eef6] bg-white px-5 py-4">
        <span className="grid size-11 place-items-center rounded-2xl bg-[#2563eb] text-white">
          <SettingsIcon className="size-5" />
        </span>
        <div>
          <h1 className="text-[22px] font-bold text-[#0f172a]">Settings</h1>
          <p className="text-[13px] text-[#64748b]">Manage your account and preferences</p>
        </div>
      </section>

      {admin && (
        <section className="rounded-3xl border border-[#e7eef6] bg-white p-5">
          <p className="flex items-center gap-2 font-semibold"><Shield className="size-4 text-violet-500" /> Login and registration</p>
          <p className="mt-1 text-[12px] text-[#94a3b8]">Off means no customer can sign in or create an account. On opens it again. Your admin login stays available so you can turn it back on.</p>
          <button type="button" disabled={busy === "auth-gate"} onClick={toggleAuthGate} className={`mt-4 inline-flex h-10 items-center rounded-xl px-4 text-[13px] font-semibold text-white disabled:opacity-60 ${authOpen ? "bg-rose-600" : "bg-emerald-600"}`}>
            {busy === "auth-gate" ? "Saving…" : authOpen ? "Turn login and registration off" : "Turn login and registration on"}
          </button>
          <p className="mt-2 text-[12px] font-semibold text-[#334155]">{authOpen ? "Currently on" : "Currently off"}</p>
        </section>
      )}

      {admin && (
        <section className="rounded-3xl border border-[#e7eef6] bg-white p-5">
          <p className="flex items-center gap-2 font-semibold"><Shield className="size-4 text-violet-500" /> Admin login</p>
          <p className="text-[12px] text-[#94a3b8]">The email and password you save here are stored in the database. The previous admin login stops working after that.</p>
          <label className="mt-3 block text-[13px] font-medium">
            Admin email
            <input type="email" value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} placeholder="admin@email.com" className="mt-1 h-11 w-full rounded-xl bg-[#e7f0f8] px-3 outline-none" />
          </label>
          <label className="mt-3 block text-[13px] font-medium">
            Naya password
            <input type={showPassword ? "text" : "password"} value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} placeholder="Naya password, kam se kam 8 characters" className="mt-1 h-11 w-full rounded-xl bg-[#e7f0f8] px-3 outline-none" />
          </label>
          <label className="mt-3 block text-[13px] font-medium">
            Confirm password
            <input type={showPassword ? "text" : "password"} value={adminConfirm} onChange={(event) => setAdminConfirm(event.target.value)} placeholder="Password dobara likho" className="mt-1 h-11 w-full rounded-xl bg-[#e7f0f8] px-3 outline-none" />
          </label>
          <button type="button" disabled={busy === "admin-login"} onClick={saveAdminLogin} className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-[#2563eb] px-4 text-[13px] font-semibold text-white disabled:opacity-60">
            <KeyRound className="size-3.5" /> {busy === "admin-login" ? "Saving…" : "Save admin login"}
          </button>
        </section>
      )}

      {admin && (
        <section className="rounded-3xl border border-[#e7eef6] bg-white p-5">
          <p className="flex items-center gap-2 font-semibold"><Users className="size-4 text-violet-500" /> Extra admin access</p>
          <p className="text-[12px] text-[#94a3b8]">Save an email and password. That login also gets the admin panel. You can add as many as you need.</p>
          {panelAdmins.length > 0 && (
            <ul className="mt-3 space-y-2">
              {panelAdmins.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2 rounded-xl bg-[#e7f0f8] px-3 py-2 text-[13px]">
                  <span className="truncate font-semibold">{item.email}</span>
                  {item.id === user?.id ? <span className="text-[11px] text-[#64748b]">You</span> : (
                    <button type="button" disabled={busy === `drop-${item.id}`} onClick={() => dropExtraAdmin(item.id, item.email)} className="text-[12px] font-semibold text-rose-600 disabled:opacity-60">Remove</button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 space-y-3">
            {adminDrafts.map((draft, index) => (
              <div key={draft.key} className="rounded-2xl border border-[#e7eef6] p-3">
                <p className="text-[12px] font-semibold text-[#64748b]">Admin {index + 1}</p>
                <label className="mt-2 block text-[13px] font-medium">
                  Email
                  <input type="email" value={draft.email} onChange={(event) => setAdminDrafts((current) => current.map((item) => item.key === draft.key ? { ...item, email: event.target.value } : item))} placeholder="admin2@email.com" className="mt-1 h-11 w-full rounded-xl bg-[#e7f0f8] px-3 outline-none" />
                </label>
                <label className="mt-3 block text-[13px] font-medium">
                  Password
                  <input type={showPassword ? "text" : "password"} value={draft.password} onChange={(event) => setAdminDrafts((current) => current.map((item) => item.key === draft.key ? { ...item, password: event.target.value } : item))} placeholder="Kam se kam 8 characters" className="mt-1 h-11 w-full rounded-xl bg-[#e7f0f8] px-3 outline-none" />
                </label>
                <button type="button" disabled={busy === `extra-${draft.key}`} onClick={() => saveExtraAdmin(draft.key)} className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl bg-[#2563eb] px-4 text-[13px] font-semibold text-white disabled:opacity-60">
                  <Save className="size-3.5" /> {busy === `extra-${draft.key}` ? "Saving…" : "Save admin"}
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setAdminDrafts((current) => [...current, { key: crypto.randomUUID(), email: "", password: "" }])} className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl border border-[#c7d2fe] px-4 text-[13px] font-semibold text-[#4338ca]">
            <Plus className="size-3.5" /> Add another admin
          </button>
        </section>
      )}

      {admin && (
      <section className="rounded-3xl border p-5">
        <p className="font-semibold">Theme</p>
        <p className="text-[12px] text-[#94a3b8]">Preset ya custom colour. Save ke baad poora panel change hota hai, refresh ke baad bhi.</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {THEMES.map((item) => (
            <button key={item.id} type="button" onClick={() => { setTheme(item); saveTheme(item); }} className={`rounded-2xl border p-3 text-left text-[12px] font-semibold ${theme.id === item.id ? "ring-2 ring-violet-400" : ""}`} style={{ background: item.card, color: item.text }}>
              <span className="mb-2 block h-2 rounded-full" style={{ background: `linear-gradient(90deg, ${item.primary}, ${item.accent})` }} />
              {item.name}
            </button>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {([
            ["primary", "Primary"],
            ["accent", "Accent"],
            ["bg", "Background"],
            ["card", "Card"],
            ["sidebar", "Sidebar"],
            ["text", "Text"],
          ] as const).map(([key, label]) => (
            <label key={key} className="text-[12px] font-semibold">
              {label}
              <input type="color" value={theme[key].startsWith("#") ? theme[key] : "#7c3aed"} onChange={(event) => setTheme((current) => ({ ...current, id: "custom", name: "Custom", [key]: event.target.value }))} className="mt-1 h-10 w-full rounded-lg bg-transparent" />
            </label>
          ))}
        </div>
        <button type="button" onClick={() => {
          const next = { ...theme, id: theme.id || "custom", name: theme.name || "Custom" };
          saveTheme(next);
          saveDeskLook({ data: { theme: JSON.stringify(next), motion } }).catch(() => setNote("Theme is saved on this browser. Server save failed."));
        }} className="mt-4 h-10 rounded-xl bg-[#2563eb] px-4 text-[13px] font-semibold text-white">Save theme</button>
      </section>
      )}

      {false && (
      <section className="rounded-3xl border p-5">
        <p className="font-semibold">Your currency</p>
        <p className="text-[12px] text-[#94a3b8]">Prices across the panel use this currency. Wallets and orders stay in the base currency in the database.</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CURRENCIES.map((item) => (
            <button
              key={item.code}
              type="button"
              disabled={busy === "currency"}
              onClick={() => saveCurrency(item)}
              className={`h-14 rounded-xl border px-3 text-left text-[12px] font-semibold ${currency.code === item.code ? "ring-2 ring-violet-400" : ""}`}
            >
              <span className="block">{item.flag} {item.code}</span>
              <span className="block text-[10px] font-medium opacity-70">{item.name}</span>
            </button>
          ))}
        </div>
        {fxNote && <p className="mt-3 text-[12px] text-[#a5b4fc]">{fxNote} {moneyState().fxStale ? "Using last good rates." : ""}</p>}
      </section>
      )}

      {admin && (
        <section className="rounded-3xl border p-5">
          <p className="font-semibold">Base currency</p>
          <p className="text-[12px] text-[#94a3b8]">This is the currency stored prices use. Changing it does not rewrite old wallets, orders, or payments. Change it only if prices were entered in this currency.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {CURRENCIES.slice(0, 12).map((item) => (
              <button key={item.code} type="button" disabled={busy === "base"} onClick={() => saveBase(item.code)} className={`h-10 rounded-xl border px-3 text-[12px] font-bold ${baseCode === item.code ? "ring-2 ring-violet-400" : ""}`}>
                {item.flag} {item.code}
              </button>
            ))}
          </div>
          <button type="button" disabled={busy === "fx"} onClick={reloadRates} className="mt-3 h-10 rounded-xl bg-[#2563eb] px-4 text-[13px] font-semibold text-white disabled:opacity-50">Refresh exchange rates</button>
        </section>
      )}

      {admin && (
      <section className="rounded-3xl border p-5">
        <p className="font-semibold">Page animation</p>
        <p className="text-[12px] text-[#94a3b8]">The option you select plays on every page change: dashboard, engagement, settings, and login.</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {MOTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setMotion(item.id);
                saveMotion(item.id);
                saveDeskLook({ data: { theme: JSON.stringify(theme), motion: item.id } }).catch(() => setNote("Animation is saved on this browser. Server save failed."));
              }}
              className={`page-motion rounded-2xl border px-3 py-3 text-left text-[13px] font-semibold ${motion === item.id ? "ring-2 ring-violet-400" : ""}`}
            >
              {item.name}
            </button>
          ))}
        </div>
      </section>
      )}

      <section className="rounded-3xl border border-[#e7eef6] bg-white p-5">
        <p className="flex items-center gap-2 font-semibold"><User className="size-4 text-[#64748b]" /> Profile Information</p>
        <p className="text-[12px] text-[#94a3b8]">Update your personal details</p>
        <div className="mt-4 flex items-center gap-3">
          <span className="relative grid size-14 place-items-center overflow-hidden rounded-2xl bg-[#e8f1ff] text-[#64748b]">
            {photo ? <img src={photo} alt="" className="size-full object-cover" /> : <User className="size-6" />}
            <label className="absolute -bottom-1 -right-1 grid size-6 cursor-pointer place-items-center rounded-full bg-[#2563eb] text-white">
              <Camera className="size-3" />
              <input type="file" accept="image/*" className="hidden" onChange={onPhoto} />
            </label>
          </span>
          <div>
            <p className="font-semibold">{name || "Member"}</p>
            <p className="text-[12px] text-[#64748b]">{user?.primaryEmail}</p>
            <label className="cursor-pointer text-[12px] font-semibold text-[#2563eb]">
              Upload photo
              <input type="file" accept="image/*" className="hidden" onChange={onPhoto} />
            </label>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-[13px] font-medium text-[#334155]">
            Full Name
            <input value={name} onChange={(event) => setName(event.target.value)} className="mt-1 h-11 w-full rounded-xl bg-[#e7f0f8] px-3 outline-none" />
          </label>
          <label className="text-[13px] font-medium text-[#334155]">
            Email Address
            <input value={user?.primaryEmail || ""} disabled className="mt-1 h-11 w-full rounded-xl bg-[#e7f0f8] px-3 text-[#64748b] outline-none" />
            <span className="mt-1 block text-[11px] font-normal text-[#94a3b8]">Email cannot be changed</span>
          </label>
        </div>
        <button type="button" disabled={busy === "profile"} onClick={saveName} className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-[#2563eb] px-4 text-[13px] font-semibold text-white disabled:opacity-60">
          <Save className="size-4" /> Save Changes
        </button>
      </section>

      <section className="rounded-3xl border border-[#e7eef6] bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 font-semibold">
              <Sparkles className="size-4 text-[#2563eb]" /> AI Organic Automation
              <span className="rounded-full bg-[#efe7ff] px-2 py-0.5 text-[10px] font-bold text-[#7c3aed]">PREMIUM</span>
            </p>
            <p className="text-[12px] text-[#94a3b8]">Configure your default organic settings</p>
          </div>
          <button type="button" onClick={toggleOrganic} className="inline-flex items-center gap-2 text-[11px] font-bold tracking-wide text-[#64748b]">
            {organic ? "ENABLED" : "DISABLED"}
            <span className={`relative h-7 w-12 rounded-full ${organic ? "bg-[#2563eb]" : "bg-[#dbe4ee]"}`}>
              <span className={`absolute top-0.5 size-6 rounded-full bg-white shadow ${organic ? "left-5" : "left-0.5"}`} />
            </span>
          </button>
        </div>
        <div className="mt-4 rounded-2xl border border-[#dbeafe] bg-[#f8fbff] p-3 text-[13px] text-[#334155]">
          <p className="font-semibold"><Sparkles className="mr-1 inline size-3.5 text-[#2563eb]" /> What is Organic Mode?</p>
          <p className="mt-1 text-[12px] leading-relaxed text-[#64748b]">When enabled, all your new orders will automatically use AI-generated delivery patterns. This creates unique growth curves for every order to look 100% natural to social algorithms.</p>
        </div>

        <div className="mt-4 flex items-center gap-2 text-[13px] font-semibold">
          <span className="text-[#64748b]">%</span> AI Organic Ratios — Universal
          <span className="rounded-full bg-[#e0e7ff] px-2 py-0.5 text-[10px] font-bold text-[#3730a3]">ALL PLATFORMS</span>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Ratio icon={<Eye className="size-3.5" />} label="VIEWS RATIO" value={ratios.views} tone="text-[#2563eb]" onChange={(value) => setRatio("views", value)} />
          <Ratio icon={<Heart className="size-3.5 text-rose-500" />} label="LIKES RATIO" value={ratios.likes} tone="text-rose-500" onChange={(value) => setRatio("likes", value)} />
          <Ratio icon={<MessageCircle className="size-3.5 text-[#94a3b8]" />} label="COMMENTS RATIO" value={ratios.comments} tone="text-[#64748b]" onChange={(value) => setRatio("comments", value)} />
        </div>

        <p className="mb-2 mt-4 flex items-center gap-2 text-[13px] font-semibold">
          Instagram & TikTok <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">IG + TT</span>
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Ratio icon={<Bookmark className="size-3.5 text-sky-500" />} label="SAVES" value={ratios.saves} tone="text-emerald-500" onChange={(value) => setRatio("saves", value)} />
          <Ratio icon={<Share2 className="size-3.5 text-sky-500" />} label="SHARES" value={ratios.shares} tone="text-[#2563eb]" onChange={(value) => setRatio("shares", value)} />
          <Ratio icon={<Repeat2 className="size-3.5 text-sky-500" />} label="REPOSTS" value={ratios.reposts} tone="text-[#2563eb]" onChange={(value) => setRatio("reposts", value)} />
        </div>
        <div className="mt-3 max-w-sm">
          <Ratio icon={<Users className="size-3.5 text-violet-500" />} label="FOLLOWERS" value={ratios.followers} tone="text-violet-500" onChange={(value) => setRatio("followers", value)} />
        </div>

        <p className="mb-2 mt-4 text-[13px] font-semibold">YouTube <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-500">YT</span></p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Ratio icon={<span className="text-[12px]">▶</span>} label="SUBSCRIBERS" value={ratios.subscribers} tone="text-rose-500" onChange={(value) => setRatio("subscribers", value)} />
          <Ratio icon={<span className="text-[12px]">◷</span>} label="WATCH HOURS" value={ratios.watch_hours} tone="text-rose-500" onChange={(value) => setRatio("watch_hours", value)} />
        </div>

        <p className="mb-2 mt-4 text-[13px] font-semibold">Twitter / X <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-600">X</span></p>
        <div className="max-w-sm">
          <Ratio icon={<Repeat2 className="size-3.5 text-sky-500" />} label="RETWEETS" value={ratios.retweets} tone="text-[#2563eb]" onChange={(value) => setRatio("retweets", value)} />
        </div>

        <p className="mt-4 rounded-2xl bg-[#f8fbff] p-3 text-[12px] leading-relaxed text-[#64748b]">
          <Shield className="mr-1 inline size-3.5" /> Ratios are calculated relative to your "Base Quantity". For example, if Views are 100% and Likes are 5%, an order of 10,000 Views will auto-generate 500 Likes. These apply to ALL your orders across all platforms.
        </p>
        <button type="button" disabled={busy === "ratios"} onClick={saveRatios} className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#2563eb] text-[14px] font-semibold text-white disabled:opacity-60">
          <Save className="size-4" /> {busy === "ratios" ? "Saving…" : "Save AI Configuration"}
        </button>
      </section>

      <section className="rounded-3xl border border-[#e7eef6] bg-white p-5">
        <p className="flex items-center gap-2 font-semibold"><KeyRound className="size-4 text-amber-500" /> Change Password</p>
        <p className="text-[12px] text-[#94a3b8]">Update your account password</p>
        <label className="mt-3 block text-[13px] font-medium">
          New Password
          <span className="relative mt-1 block">
            <input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter new password" className="h-11 w-full rounded-xl bg-[#e7f0f8] px-3 pr-10 outline-none" />
            <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-3 text-[#94a3b8]" aria-label="Show password">
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </span>
        </label>
        <label className="mt-3 block text-[13px] font-medium">
          Confirm New Password
          <input type={showPassword ? "text" : "password"} value={confirm} onChange={(event) => setConfirm(event.target.value)} placeholder="Confirm new password" className="mt-1 h-11 w-full rounded-xl bg-[#e7f0f8] px-3 outline-none" />
        </label>
        <button type="button" disabled={busy === "password"} onClick={changePassword} className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl border border-[#e7eef6] px-4 text-[13px] font-semibold disabled:opacity-60">
          <KeyRound className="size-3.5" /> {busy === "password" ? "Updating…" : "Change Password"}
        </button>
      </section>

      <section className="rounded-3xl border border-[#e7eef6] bg-white p-5">
        <p className="flex items-center gap-2 font-semibold"><KeyRound className="size-4 text-emerald-500" /> API Key</p>
        <p className="text-[12px] text-[#94a3b8]">Manage your API access key for integrations</p>
        <p className="mt-3 text-[13px] font-medium">Your API Key</p>
        <input readOnly value={key || "••••••••••••••••••••"} className="mt-1 h-11 w-full rounded-xl bg-[#f8fafc] px-3 font-mono text-[13px] outline-none" />
        <p className="mt-1 text-[11px] text-[#94a3b8]">Keep your API key secret. Do not share it publicly.</p>
        <button
          type="button"
          onClick={async () => {
            const next = await savePrefs({ data: { rotateKey: true } });
            setKey(next?.api_key || "");
            setNote("New API key generated. It does not call a provider yet.");
          }}
          className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl border border-[#e7eef6] px-4 text-[13px] font-semibold"
        >
          <KeyRound className="size-3.5" /> Generate API Key
        </button>
      </section>

      <section className="flex items-center justify-between rounded-3xl border border-[#e7eef6] bg-white p-5">
        <div>
          <p className="font-semibold">Sign Out</p>
          <p className="text-[12px] text-[#94a3b8]">Sign out from your account on this device</p>
        </div>
        <button type="button" onClick={() => signOut("/login")} className="inline-flex items-center gap-2 rounded-xl bg-[#ef4444] px-4 py-2 text-[13px] font-semibold text-white">
          <LogOut className="size-4" /> Sign Out
        </button>
      </section>
      {note && <p className="text-center text-[13px] text-[#334155]">{note}</p>}
    </div>
  );
}

function Ratio({ icon, label, value, tone, onChange }: { icon: ReactNode; label: string; value: number; tone: string; onChange: (value: number) => void }) {
  const [text, setText] = useState(() => String(value));
  const editing = useRef(false);

  useEffect(() => {
    if (!editing.current) setText(value === 0 ? "" : String(value));
  }, [value]);

  function apply(raw: string) {
    const cleaned = raw.replace(/[^\d.]/g, "");
    const parts = cleaned.split(".");
    const next = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : cleaned;
    setText(next);
    if (next === "" || next === ".") {
      onChange(0);
      return;
    }
    const num = Number(next);
    if (Number.isFinite(num)) onChange(Math.min(100, Math.max(0, num)));
  }

  return (
    <div className="block rounded-2xl border border-[#eef2f6] bg-white p-3">
      <span className="flex items-center justify-between gap-2 text-[11px] font-semibold tracking-wide text-[#64748b]">
        <span className="inline-flex items-center gap-1">{icon} {label}</span>
        <span className="inline-flex items-center gap-1">
          <input
            inputMode="decimal"
            value={text}
            placeholder="0"
            onFocus={() => { editing.current = true; }}
            onBlur={() => {
              editing.current = false;
              if (text.trim() === "" || text === ".") {
                onChange(0);
                setText("");
                return;
              }
              const num = Math.min(100, Math.max(0, Number(text)));
              if (!Number.isFinite(num)) {
                setText(String(value));
                return;
              }
              onChange(num);
              setText(String(num));
            }}
            onChange={(event) => apply(event.target.value)}
            className={`h-8 w-16 rounded-lg border border-[#e7eef6] bg-[#f8fafc] text-center text-[13px] font-bold outline-none focus:border-[#93c5fd] ${tone}`}
          />
          <b className={tone}>%</b>
        </span>
      </span>
      <input type="range" min={0} max={100} step={0.5} value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-3 w-full accent-[#111827]" />
      <span className="mt-1 flex justify-between text-[10px] text-[#94a3b8]"><span>0%</span><span>50%</span><span>100%</span></span>
    </div>
  );
}

function compressPhoto(file: File) {
  return new Promise<string>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const size = 256;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Could not read that photo."));
        return;
      }
      const scale = Math.max(size / img.width, size / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.72));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that photo."));
    };
    img.src = url;
  });
}
