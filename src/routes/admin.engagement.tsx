import { useEffect, useState, useSyncExternalStore } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Authed } from "@/components/gate";
import { adminBindings, adminSaveBindings, adminSaveServiceLimit, adminServiceLimit } from "@/lib/admin.functions";
import { currencySnapshot, formatMajor, fromMinor, moneyState, subscribeCurrency, toBaseMinor } from "@/lib/money";

export const Route = createFileRoute("/admin/engagement")({
  component: () => (
    <Authed>
      <EngagementApis />
    </Authed>
  ),
});

const TYPES = ["views", "likes", "saves", "shares", "reposts", "comments"] as const;

function trimMajor(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "";
  const rounded = Math.round(value * 100) / 100;
  return String(rounded);
}

type ProviderKey = { api_url: string; api_key: string };
type Row = {
  slot: string;
  api_url: string;
  api_key: string;
  service_id: string;
  pick_mode: string;
  pinned_ids: string[];
  min_quantity: number;
  price_per_1k_paise: number;
  rate_min_units: number;
  rate_max_units: number;
  section_enabled: boolean;
  providers: ProviderKey[];
};

function EngagementApis() {
  const [rows, setRows] = useState<Row[]>([]);
  const [platform, setPlatform] = useState<"instagram" | "tiktok">("instagram");
  const [note, setNote] = useState("");
  const [rateText, setRateText] = useState<Record<string, string>>({});
  const [bandText, setBandText] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [activeLimit, setActiveLimit] = useState("1");
  useSyncExternalStore(subscribeCurrency, currencySnapshot, currencySnapshot);
  const money = moneyState().display;
  const symbol = money.symbol.trim();

  useEffect(() => {
    adminBindings()
      .then((list) => setRows(list.filter((row) => row.slot !== "single") as Row[]))
      .catch((err: unknown) => setNote(err instanceof Error ? err.message : "Could not load."));
    adminServiceLimit().then((row) => setActiveLimit(String(row.limit))).catch(() => setActiveLimit("1"));
  }, []);

  function patch(slot: string, next: Partial<Row>) {
    setRows((current) => current.map((row) => (row.slot === slot ? { ...row, ...next } : row)));
  }

  function setProvider(slot: string, index: number, next: Partial<ProviderKey>) {
    setRows((current) => current.map((row) => {
      if (row.slot !== slot) return row;
      const providers = row.providers.length ? [...row.providers] : [{ api_url: "", api_key: "" }];
      providers[index] = { ...providers[index], ...next };
      const first = providers.find((item) => item.api_key.trim()) || providers[0];
      return { ...row, providers, api_url: first?.api_url || "", api_key: first?.api_key || "" };
    }));
  }

  function setPin(slot: string, index: number, value: string) {
    setRows((current) => current.map((row) => {
      if (row.slot !== slot) return row;
      const pinned_ids = [...(row.pinned_ids?.length ? row.pinned_ids : [""])];
      pinned_ids[index] = value.replace(/[^\d]/g, "").slice(0, 20);
      return { ...row, pinned_ids };
    }));
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#2563eb]">Admin</p>
        <h1 className="text-[28px] font-bold">Full engagement APIs</h1>
        <p className="text-[13px] text-[#64748b]">Set each provider here, and the panel rate per 1,000. The service comes from the provider. The price is yours.</p>
      </header>
      <div className="grid grid-cols-2 gap-2">
        {(["instagram", "tiktok"] as const).map((item) => (
          <button key={item} type="button" onClick={() => setPlatform(item)} className={`h-11 rounded-xl text-[13px] font-bold uppercase ${platform === item ? "bg-[#2563eb] text-white" : "bg-white text-[#334155]"}`}>
            {item}
          </button>
        ))}
      </div>
      {TYPES.map((type) => {
        const slot = `${platform}:${type}`;
        const row = rows.find((item) => item.slot === slot);
        if (!row) return null;
        const providers = row.providers.length ? row.providers : [{ api_url: row.api_url || "", api_key: row.api_key || "" }];
        const idsMode = row.pick_mode === "ids";
        const pins = row.pinned_ids?.length ? row.pinned_ids : [""];
        return (
          <section key={slot} className="rounded-[24px] border border-[#e7eef6] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold capitalize">{type}</h2>
              <button type="button" role="switch" aria-checked={row.section_enabled !== false} onClick={() => patch(slot, { section_enabled: row.section_enabled === false })} className={`relative h-7 w-12 rounded-full ${row.section_enabled === false ? "bg-[#3a335f]" : "bg-violet-500"}`}>
                <span className={`absolute top-0.5 size-6 rounded-full bg-white shadow ${row.section_enabled === false ? "left-0.5" : "left-5"}`} />
              </button>
            </div>
            <p className={`mt-1 text-[11px] font-bold uppercase ${row.section_enabled === false ? "text-rose-400" : "text-emerald-400"}`}>{row.section_enabled === false ? "Hidden on Full Engagement" : "Showing on Full Engagement"}</p>
            <div className="mt-3 grid gap-3">
              {providers.map((provider, index) => (
                <div key={`${slot}-${index}`} className="grid gap-2 rounded-2xl bg-[#f8fafc] p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[12px] font-semibold text-[#334155]">API provider {index + 1}</p>
                    {providers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => patch(slot, { providers: providers.filter((_, item) => item !== index) })}
                        className="text-[12px] font-semibold text-[#b91c1c]"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <input value={provider.api_url} onChange={(event) => setProvider(slot, index, { api_url: event.target.value })} placeholder="Provider API URL" className="h-11 rounded-xl border border-[#e7eef6] bg-white px-3 text-[13px] outline-none" />
                  <input value={provider.api_key} onChange={(event) => setProvider(slot, index, { api_key: event.target.value })} placeholder="API key" className="h-11 rounded-xl border border-[#e7eef6] bg-white px-3 text-[13px] outline-none" />
                </div>
              ))}
              <button
                type="button"
                onClick={() => patch(slot, { providers: [...providers, { api_url: "", api_key: "" }] })}
                className="h-10 rounded-xl bg-[#f3f6fa] text-[12px] font-bold text-[#1d4ed8]"
              >
                Add another API
              </button>
              <label className="block text-[12px] font-semibold text-[#334155]">
                Panel rate per 1,000 ({symbol} {money.code})
                <input
                  inputMode="decimal"
                  value={rateText[slot] ?? (row.price_per_1k_paise ? trimMajor(fromMinor(row.price_per_1k_paise)) : "")}
                  onChange={(event) => {
                    const raw = event.target.value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
                    setRateText((current) => ({ ...current, [slot]: raw }));
                    const amount = Number(raw);
                    patch(slot, { price_per_1k_paise: raw === "" || !Number.isFinite(amount) ? 0 : toBaseMinor(amount) });
                  }}
                  placeholder={`e.g. 15 ${money.code}`}
                  className="mt-1 h-11 w-full rounded-xl border border-[#e7eef6] px-3 text-[13px] outline-none"
                />
              </label>
              <p className="text-[11px] text-[#64748b]">This box uses the currency selected in the header. Type 15 while {money.code} is selected and Full Engagement charges {formatMajor(15)} per 1,000. Leave it empty to keep the current bundle rate.</p>
              <label className="block text-[12px] font-semibold text-[#334155]">
                Minimum quantity
                <input
                  inputMode="numeric"
                  value={row.min_quantity ? String(row.min_quantity) : ""}
                  onChange={(event) => {
                    const raw = event.target.value.replace(/[^\d]/g, "");
                    patch(slot, { min_quantity: raw === "" ? 0 : Number(raw) });
                  }}
                  className="mt-1 h-11 w-full rounded-xl border border-[#e7eef6] px-3 text-[13px] outline-none"
                />
              </label>
              <div className="rounded-2xl border border-[#e7eef6] bg-[#f8fafc] p-3">
                <p className="text-[12px] font-semibold text-[#334155]">Provider rate range per 1,000</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input
                    inputMode="decimal"
                    value={bandText[`${slot}:min`] ?? (row.rate_min_units ? String(row.rate_min_units / 1000000) : "")}
                    onChange={(event) => {
                      const raw = event.target.value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
                      setBandText((current) => ({ ...current, [`${slot}:min`]: raw }));
                      const amount = Number(raw);
                      patch(slot, { rate_min_units: raw === "" || !Number.isFinite(amount) ? 0 : Math.round(amount * 1000000) });
                    }}
                    placeholder="Min 0.05"
                    className="h-11 rounded-xl border border-[#e7eef6] bg-white px-3 text-[13px] outline-none"
                  />
                  <input
                    inputMode="decimal"
                    value={bandText[`${slot}:max`] ?? (row.rate_max_units ? String(row.rate_max_units / 1000000) : "")}
                    onChange={(event) => {
                      const raw = event.target.value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
                      setBandText((current) => ({ ...current, [`${slot}:max`]: raw }));
                      const amount = Number(raw);
                      patch(slot, { rate_max_units: raw === "" || !Number.isFinite(amount) ? 0 : Math.round(amount * 1000000) });
                    }}
                    placeholder="Max 0.40"
                    className="h-11 rounded-xl border border-[#e7eef6] bg-white px-3 text-[13px] outline-none"
                  />
                </div>
                <p className="mt-2 text-[11px] leading-5 text-[#64748b]">This is the API service rate, like 0.05 or 0.40 in the list, not the panel price. Orders use only service IDs inside this range. Higher rates are skipped. Leave one side empty to use only the other limit. Leave both empty and Auto picks the best service with no price limit.</p>
              </div>
              <div className="rounded-2xl border border-[#e7eef6] bg-[#f8fafc] p-3">
                <p className="text-[12px] font-semibold text-[#334155]">Order mode</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => patch(slot, { pick_mode: "auto" })} className={`h-11 rounded-xl text-[12px] font-bold ${idsMode ? "bg-white text-[#334155]" : "bg-[#2563eb] text-white"}`}>
                    Auto
                  </button>
                  <button
                    type="button"
                    onClick={() => patch(slot, { pick_mode: "ids", pinned_ids: pins })}
                    className={`h-11 rounded-xl text-[12px] font-bold ${idsMode ? "bg-[#2563eb] text-white" : "bg-white text-[#334155]"}`}
                  >
                    Only use service ID
                  </button>
                </div>
                {idsMode ? (
                  <div className="mt-3 grid gap-2">
                    {pins.map((pin, index) => (
                      <div key={`${slot}-pin-${index}`} className="flex items-center gap-2">
                        <input
                          inputMode="numeric"
                          value={pin}
                          onChange={(event) => setPin(slot, index, event.target.value)}
                          placeholder={`Service ID ${index + 1}`}
                          className="h-11 min-w-0 flex-1 rounded-xl border border-[#e7eef6] bg-white px-3 text-[13px] outline-none"
                        />
                        {pins.length > 1 && (
                          <button type="button" onClick={() => patch(slot, { pinned_ids: pins.filter((_, item) => item !== index) })} className="h-11 shrink-0 rounded-xl px-3 text-[12px] font-semibold text-[#b91c1c]">
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                    <button type="button" onClick={() => patch(slot, { pinned_ids: [...pins, ""] })} className="h-10 rounded-xl bg-white text-[12px] font-bold text-[#1d4ed8]">
                      Add another service ID
                    </button>
                    <p className="text-[11px] leading-5 text-[#64748b]">Keywords are off in this mode. Orders use only these service IDs. The first run uses the first ID, the next run uses the next ID. An ID that is Pending or In Progress is skipped. After the API marks that order complete, the same ID can be used again in 50 seconds.</p>
                  </div>
                ) : (
                  <p className="mt-2 text-[11px] leading-5 text-[#64748b]">Auto is on. First choice is Guaranteed or Lifetime Guaranteed with the lowest average time. If those are busy or the order does not place, 30 Days Guaranteed is used.</p>
                )}
              </div>
              {!idsMode && (
                <>
                  <p className="text-[11px] text-[#94a3b8]">Views, likes, shares, saves, comments, and reposts use the same rule on Full Engagement and Mass Order. First: Guaranteed or Lifetime Guaranteed, lowest average completion time, no drop percentage. Third: 30 Days Guaranteed, only when the first two are missing, busy, or the provider rejects the order.</p>
                  <p className="text-[11px] text-[#94a3b8]">Also rejected: High Drop, Refill Only, Slow Start, Delayed Start, Gradual Delivery, Drip Feed, Unknown, Unstable, Low Quality, Start 12 Hours, Start 24 Hours. A service ID that is Pending or In Progress is skipped. After the API marks it complete, the same ID can be used again in 50 seconds.</p>
                </>
              )}
            </div>
          </section>
        );
      })}
      <label className="block rounded-2xl border border-[#e7eef6] bg-white p-4 text-[13px] font-semibold text-[#334155]">
        Max active orders per Service ID
        <input inputMode="numeric" value={activeLimit} onChange={(event) => setActiveLimit(event.target.value.replace(/[^\d]/g, ""))} className="mt-2 h-11 w-full rounded-xl border border-[#e7eef6] px-3 text-[13px] outline-none" />
        <p className="mt-1 text-[11px] font-normal text-[#94a3b8]">Default is 1. A service ID that is Pending or In Progress is skipped. If every ID is busy, the one with the lowest load is used. After it completes, that ID can be used again.</p>
      </label>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setNote("");
          try {
            const current = await adminBindings();
            const single = current.find((row) => row.slot === "single");
            await adminSaveBindings({ data: single ? [...rows, single as Row] : rows });
            await adminSaveServiceLimit({ data: { limit: Math.max(1, Number(activeLimit) || 1) } });
            setNote(`${platform} configuration saved.`);
          } catch (err: unknown) {
            setNote(err instanceof Error ? err.message : "Save failed.");
          } finally {
            setBusy(false);
          }
        }}
        className="h-12 w-full rounded-xl bg-[#2563eb] text-[14px] font-bold text-white disabled:opacity-60"
      >
        {busy ? "Saving…" : `Save ${platform} configuration`}
      </button>
      {note && <p className="text-center text-[13px] text-[#1e3a8a]">{note}</p>}
    </div>
  );
}
