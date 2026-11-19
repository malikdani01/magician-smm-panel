import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Authed } from "@/components/gate";
import { adminAddService, adminDeleteProvider, adminFetchProvider, adminProviders, adminSaveProvider, adminSaveService, adminServices, adminSetServiceListed } from "@/lib/admin.functions";
import { inr } from "@/lib/money";

export const Route = createFileRoute("/admin/services")({
  component: () => (
    <Authed>
      <ServicesDesk />
    </Authed>
  ),
});

type Row = {
  id: string;
  source: string;
  provider_service_id: string;
  platform: string;
  category: string;
  name: string;
  description: string;
  price_per_1k_paise: number;
  min_quantity: number;
  max_quantity: number;
  drip_allowed: boolean;
  enabled: boolean;
};

const blank = {
  provider_service_id: "",
  platform: "instagram",
  category: "",
  name: "",
  description: "",
  price_per_1k_paise: 100,
  min_quantity: 10,
  max_quantity: 100000,
  drip_allowed: false,
  enabled: true,
};

function ServicesDesk() {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<Row | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(blank);
  const [providers, setProviders] = useState<{ id: string; name: string; api_url: string; api_key: string; enabled: boolean; last_error: string; last_sync: string | null }[]>([]);
  const [drafts, setDrafts] = useState([{ name: "", api_url: "https://yoyomedia.in/api/v2", api_key: "", enabled: true }]);

  function load(next = query) {
    adminServices({ data: next }).then((result) => {
      setRows(result.services);
      setTotal(result.total);
    }).catch((err: unknown) => setNote(err instanceof Error ? err.message : "Could not load services."));
  }

  useEffect(() => {
    load("");
    adminProviders().then(setProviders).catch(() => setProviders([]));
  }, []);

  async function saveAndFetchAll() {
    const filled = drafts.filter((item) => item.api_key.trim() && item.api_url.trim());
    if (filled.length === 0) {
      setNote("Kam se kam ek Enter an API key.");
      return;
    }
    setBusy(true);
    setNote("");
    const notes: string[] = [];
    for (const provider of filled) {
      try {
        const saved = await adminSaveProvider({ data: { ...provider, name: provider.name.trim() || "Provider" } });
        const result = await adminFetchProvider({ data: saved.id });
        notes.push(`${provider.name || "Provider"}: ${result.total.toLocaleString("en-IN")} services`);
      } catch (err: unknown) {
        notes.push(`${provider.name || "Provider"} failed: ${err instanceof Error ? err.message : "fetch failed"}`);
      }
    }
    setDrafts([{ name: "", api_url: "https://yoyomedia.in/api/v2", api_key: "", enabled: true }]);
    setProviders(await adminProviders().catch(() => providers));
    load(query);
    setNote(notes.join(" · "));
    setBusy(false);
  }

  async function toggleListed(row: Row) {
    const next = !row.enabled;
    setBusy(true);
    try {
      await adminSetServiceListed({ data: { id: row.id, listed: next } });
      setRows((current) => current.map((item) => (item.id === row.id ? { ...item, enabled: next } : item)));
      setNote(next ? `${row.name} is on. It shows on Single order.` : `${row.name} is off. It is hidden on Single order.`);
    } catch (err: unknown) {
      setNote(err instanceof Error ? err.message : "Could not update the service.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#2563eb]">Admin</p>
        <h1 className="text-[28px] font-bold text-[#0f172a]">Services</h1>
        <p className="text-[13px] text-[#64748b]">{total.toLocaleString("en-IN")} on the book. User single order only shows enabled rows.</p>
      </header>
      <section className="rounded-[24px] border border-[#dbeafe] bg-white p-4 shadow-sm">
        <h2 className="font-semibold">Single order providers</h2>
        <p className="mt-1 text-[12px] text-[#64748b]">Add each provider API here. After fetch, every service shows on Single Order for Home, Instagram, Facebook, Twitter and the rest. The order is sent to the provider of the service you select.</p>
        <ul className="mt-3 space-y-2">
          {providers.map((provider) => (
            <li key={provider.id} className="rounded-xl bg-[#f8fafc] px-3 py-2 text-[12px]">
              <b>{provider.name}</b> · {provider.enabled ? "on" : "off"} {provider.last_error ? `· ${provider.last_error}` : ""}
              <div className="mt-1">
              <button type="button" disabled={busy} onClick={async () => {
                setBusy(true);
                try {
                  const result = await adminFetchProvider({ data: provider.id });
                  setNote(`${provider.name}: ${result.total.toLocaleString("en-IN")} services refreshed.`);
                  load(query);
                } catch (err: unknown) {
                  setNote(err instanceof Error ? err.message : "Fetch failed.");
                } finally {
                  setBusy(false);
                }
              }} className="font-semibold text-[#0f766e]">Fetch again</button>
              <button type="button" disabled={busy} onClick={async () => {
                setBusy(true);
                try {
                  await adminDeleteProvider({ data: provider.id });
                  setProviders((current) => current.filter((item) => item.id !== provider.id));
                  setNote(`${provider.name} removed. It is also gone from the API balance.`);
                  load(query);
                } catch (err: unknown) {
                  setNote(err instanceof Error ? err.message : "Could not remove.");
                } finally {
                  setBusy(false);
                }
              }} className="ml-3 font-semibold text-rose-600">Remove</button>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-3 grid gap-3">
          {drafts.map((draft, index) => (
            <div key={index} className="grid gap-2 rounded-2xl bg-[#f8fafc] p-3">
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-semibold">API provider {index + 1}</p>
                {drafts.length > 1 && (
                  <button type="button" onClick={() => setDrafts(drafts.filter((_, item) => item !== index))} className="text-[12px] font-semibold text-[#b91c1c]">Remove</button>
                )}
              </div>
              <input value={draft.name} onChange={(event) => setDrafts(drafts.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} placeholder="Provider name" className="h-11 rounded-xl border border-[#e7eef6] bg-white px-3 text-[13px] outline-none" />
              <input value={draft.api_url} onChange={(event) => setDrafts(drafts.map((item, itemIndex) => itemIndex === index ? { ...item, api_url: event.target.value } : item))} placeholder="API URL" className="h-11 rounded-xl border border-[#e7eef6] bg-white px-3 text-[13px] outline-none" />
              <input value={draft.api_key} onChange={(event) => setDrafts(drafts.map((item, itemIndex) => itemIndex === index ? { ...item, api_key: event.target.value } : item))} placeholder="API key" className="h-11 rounded-xl border border-[#e7eef6] bg-white px-3 text-[13px] outline-none" />
            </div>
          ))}
          <button type="button" onClick={() => setDrafts([...drafts, { name: "", api_url: "https://yoyomedia.in/api/v2", api_key: "", enabled: true }])} className="h-10 rounded-xl bg-[#f3f6fa] text-[12px] font-bold text-[#1d4ed8]">Add another API</button>
          <button type="button" disabled={busy} onClick={saveAndFetchAll} className="h-11 rounded-xl bg-[#2563eb] text-[13px] font-bold text-white disabled:opacity-60">{busy ? "Fetching…" : "Save and fetch all services"}</button>
        </div>
      </section>
      <div className="flex gap-2">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search id, name, category" className="h-11 flex-1 rounded-xl border border-[#e7eef6] px-3 text-[13px] outline-none" />
        <button type="button" onClick={() => load(query)} className="rounded-xl border bg-white px-4 text-[13px] font-semibold">Search</button>
        <button type="button" onClick={() => setAdding((value) => !value)} className="rounded-xl bg-[#0f172a] px-4 text-[13px] font-semibold text-white">Add service</button>
      </div>
      {adding && (
        <form
          className="grid gap-2 rounded-[24px] border border-[#e7eef6] bg-white p-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            try {
              await adminAddService({ data: draft });
              setDraft(blank);
              setAdding(false);
              load(query);
            } catch (err: unknown) {
              setNote(err instanceof Error ? err.message : "Could not add.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <p className="font-semibold">Custom service</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <input required value={draft.provider_service_id} onChange={(event) => setDraft({ ...draft, provider_service_id: event.target.value })} placeholder="Service ID" className="h-10 rounded-xl border px-3 text-[13px]" />
            <input required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Service title" className="h-10 rounded-xl border px-3 text-[13px]" />
            <input value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} placeholder="Category" className="h-10 rounded-xl border px-3 text-[13px]" />
            <input value={draft.platform} onChange={(event) => setDraft({ ...draft, platform: event.target.value })} placeholder="Platform" className="h-10 rounded-xl border px-3 text-[13px]" />
            <input value={draft.price_per_1k_paise} onChange={(event) => setDraft({ ...draft, price_per_1k_paise: Number(event.target.value) })} placeholder="Price per 1k in paise" className="h-10 rounded-xl border px-3 text-[13px]" />
            <input value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Description" className="h-10 rounded-xl border px-3 text-[13px]" />
            <input value={draft.min_quantity} onChange={(event) => setDraft({ ...draft, min_quantity: Number(event.target.value) })} placeholder="Minimum" className="h-10 rounded-xl border px-3 text-[13px]" />
            <input value={draft.max_quantity} onChange={(event) => setDraft({ ...draft, max_quantity: Number(event.target.value) })} placeholder="Maximum" className="h-10 rounded-xl border px-3 text-[13px]" />
          </div>
          <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={draft.drip_allowed} onChange={(event) => setDraft({ ...draft, drip_allowed: event.target.checked })} /> Drip-feed allowed</label>
          <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} /> Enabled</label>
          <button className="h-10 rounded-xl bg-[#2563eb] text-[13px] font-bold text-white">Save custom service</button>
        </form>
      )}
      {note && <p className="rounded-xl bg-[#eff6ff] px-3 py-2 text-[13px] text-[#1e3a8a]">{note}</p>}
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="rounded-2xl border border-[#e7eef6] bg-white p-3">
            {edit?.id === row.id ? (
              <EditForm
                row={edit}
                onChange={setEdit}
                onCancel={() => setEdit(null)}
                onSave={async () => {
                  if (!edit) return;
                  await adminSaveService({ data: edit });
                  setEdit(null);
                  load(query);
                }}
              />
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[13px] font-semibold">{row.name}</p>
                  <p className="text-[12px] text-[#64748b]">#{row.provider_service_id} · {row.platform} · {row.category}</p>
                  <p className="text-[12px] text-[#334155]">{inr(row.price_per_1k_paise)} / 1k · {row.min_quantity}–{row.max_quantity} · {row.enabled ? "enabled" : "disabled"}</p>
                  <p className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${row.drip_allowed ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-[#a5b4fc]"}`}>{row.drip_allowed ? "Drip on" : "Drip off"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={row.enabled}
                    aria-label={row.enabled ? "Service on" : "Service off"}
                    disabled={busy}
                    onClick={() => toggleListed(row)}
                    className={`relative h-7 w-12 rounded-full ${row.enabled ? "bg-emerald-500" : "bg-[#3a335f]"}`}
                  >
                    <span className={`absolute top-0.5 size-6 rounded-full bg-white shadow ${row.enabled ? "left-5" : "left-0.5"}`} />
                  </button>
                  <button type="button" onClick={() => setEdit(row)} className="rounded-lg border px-3 py-1 text-[12px] font-semibold">Edit</button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function EditForm({ row, onChange, onSave, onCancel }: { row: Row; onChange: (row: Row) => void; onSave: () => void; onCancel: () => void }) {
  return (
    <div className="grid gap-2">
      <input value={row.name} onChange={(event) => onChange({ ...row, name: event.target.value })} className="h-10 rounded-xl border px-3 text-[13px]" />
      <input value={row.category} onChange={(event) => onChange({ ...row, category: event.target.value })} className="h-10 rounded-xl border px-3 text-[13px]" />
      <textarea value={row.description} onChange={(event) => onChange({ ...row, description: event.target.value })} className="min-h-16 rounded-xl border px-3 py-2 text-[13px]" />
      <div className="grid grid-cols-3 gap-2">
        <input value={row.price_per_1k_paise} onChange={(event) => onChange({ ...row, price_per_1k_paise: Number(event.target.value) })} className="h-10 rounded-xl border px-3 text-[13px]" />
        <input value={row.min_quantity} onChange={(event) => onChange({ ...row, min_quantity: Number(event.target.value) })} className="h-10 rounded-xl border px-3 text-[13px]" />
        <input value={row.max_quantity} onChange={(event) => onChange({ ...row, max_quantity: Number(event.target.value) })} className="h-10 rounded-xl border px-3 text-[13px]" />
      </div>
      <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={row.enabled} onChange={(event) => onChange({ ...row, enabled: event.target.checked })} /> Service enabled</label>
      <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={row.drip_allowed} onChange={(event) => onChange({ ...row, drip_allowed: event.target.checked })} /> User can use drip-feed</label>
      <div className="flex gap-2">
        <button type="button" onClick={onSave} className="h-10 rounded-xl bg-[#2563eb] px-4 text-[13px] font-bold text-white">Save</button>
        <button type="button" onClick={onCancel} className="h-10 rounded-xl border px-4 text-[13px]">Cancel</button>
      </div>
    </div>
  );
}
