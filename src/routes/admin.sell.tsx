import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Authed, StaffOnly } from "@/components/gate";
import { Field, Panel, PrimaryButton, inputClass } from "@/components/shell";
import { marketTopics, mySaleListings, publishListing, saleListing, uploadMarketShots } from "@/lib/market.functions";

export const Route = createFileRoute("/admin/sell")({
  component: () => (
    <Authed>
      <StaffOnly>
        <SellDesk />
      </StaffOnly>
    </Authed>
  ),
});

type Form = {
  id: string;
  url: string;
  showLink: boolean;
  name: string;
  image: string;
  followers: number;
  topic: string;
  price: string;
  description: string;
  content: string;
  income: string;
  expense: string;
  incomeNote: string;
  expenseNote: string;
  promotion: string;
  maintain: string;
  monetized: string;
  screenshots: string[];
  verifyCode: string;
  closeDms: boolean;
};

const blank = (code = ""): Form => ({
  id: "", url: "", showLink: true, name: "", image: "", followers: 0, topic: "", price: "", description: "", content: "",
  income: "", expense: "", incomeNote: "", expenseNote: "", promotion: "", maintain: "", monetized: "", screenshots: [], verifyCode: code, closeDms: false,
});

function SellDesk() {
  const [rows, setRows] = useState<{ id: string; name: string; topic: string; price: number; followers: number; image: string; status: string }[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [topics, setTopics] = useState<string[]>([]);
  const [contents, setContents] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  function load() {
    mySaleListings().then((list) => setRows(list as typeof rows)).catch(() => setRows([]));
  }
  useEffect(() => { load(); }, []);

  async function startNew() {
    const meta = await marketTopics();
    setTopics(meta.topics);
    setContents(meta.contents);
    setForm(blank(meta.code));
    setNote("");
  }

  async function edit(id: string) {
    const meta = await marketTopics();
    const row = await saleListing({ data: id });
    setTopics(meta.topics);
    setContents(meta.contents);
    if (!row) return;
    setForm({
      id: row.id, url: row.url, showLink: row.show_link !== false, name: row.name, image: row.image, followers: Number(row.followers) || 0,
      topic: row.topic, price: String(row.price || ""), description: row.description || "", content: row.content || "", income: row.income || "",
      expense: row.expense || "", incomeNote: row.income_note || "", expenseNote: row.expense_note || "", promotion: row.promotion || "",
      maintain: row.maintain || "", monetized: row.monetized || "", screenshots: row.screenshots || [], verifyCode: row.verify_code || meta.code, closeDms: Boolean(row.close_dms),
    });
  }

  async function setPhoto(file: File | undefined) {
    if (!form || !file) return;
    setBusy(true);
    const body = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Could not read that image."));
      reader.readAsDataURL(file);
    });
    try {
      const urls = await uploadMarketShots({ data: [{ body, name: file.name }] });
      setForm({ ...form, image: urls[0] || form.image });
      setNote("Profile photo set.");
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Could not set the photo.");
    } finally {
      setBusy(false);
    }
  }

  async function addShots(list: FileList | null) {
    if (!form || !list?.length) return;
    setBusy(true);
    const files = await Promise.all(Array.from(list).map((file) => new Promise<{ body: string; name: string }>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ body: String(reader.result || ""), name: file.name });
      reader.onerror = () => reject(new Error("Could not read an image."));
      reader.readAsDataURL(file);
    })));
    try {
      const urls = await uploadMarketShots({ data: files });
      setForm({ ...form, screenshots: [...form.screenshots, ...urls] });
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Could not upload.");
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!form) return;
    setBusy(true);
    setNote("");
    try {
      await publishListing({
        data: { ...form, price: Number(form.price) || 0, showLink: true },
      });
      setForm(null);
      setNote("Listed. It is now on Account Marketplace.");
      load();
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Could not list this account.");
    } finally {
      setBusy(false);
    }
  }

  if (!form) {
    return (
      <div className="mx-auto grid max-w-4xl gap-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-[28px] font-bold">Start selling</h1>
            <p className="text-[13px] text-[#94a3b8]">Accounts you have listed for sale.</p>
          </div>
          <PrimaryButton type="button" onClick={startNew}>Start selling</PrimaryButton>
        </div>
        {note && <p className="text-[13px] text-[#94a3b8]">{note}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((row) => (
            <article key={row.id} className="overflow-hidden rounded-3xl border" style={{ borderColor: "var(--desk-line)", background: "var(--desk-card)" }}>
              {row.image ? <img src={row.image} alt="" className="h-36 w-full object-cover" /> : <div className="h-36 bg-violet-950" />}
              <div className="space-y-1 p-4">
                <b>{row.name}</b>
                <p className="text-[12px] text-[#94a3b8]">{row.topic} · {Number(row.followers).toLocaleString("en-US")} · ${row.price}</p>
                <p className="text-[11px] font-bold uppercase text-violet-300">{row.status}</p>
                <button type="button" className="text-[13px] font-semibold text-violet-300" onClick={() => edit(row.id)}>Edit</button>
              </div>
            </article>
          ))}
          {!rows.length && <p className="text-[13px] text-[#94a3b8]">No listings yet.</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <button type="button" className="text-left text-[13px] text-violet-300" onClick={() => setForm(null)}>Back to listings</button>
      <h1 className="text-[28px] font-bold">{form.id ? "Edit listing" : "Creating a new listing"}</h1>
      <Panel className="grid gap-3">
        <Field label="Account link">
          <input className={inputClass} value={form.url} placeholder="Paste the YouTube, Instagram, TikTok, or other link" onChange={(event) => setForm({ ...form, url: event.target.value })} />
        </Field>
        <Field label="Name">
          <input className={inputClass} value={form.name} placeholder="Account name" onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </Field>
        <Field label="Followers or subscribers">
          <input className={inputClass} inputMode="numeric" value={String(form.followers || "")} onChange={(event) => setForm({ ...form, followers: Number(event.target.value.replace(/[^\d]/g, "")) || 0 })} />
        </Field>
        <div>
          <p className="mb-2 text-[13px] font-semibold">Profile image</p>
          <label className="flex cursor-pointer items-center gap-3">
            {form.image ? <img src={form.image} alt="" className="size-20 rounded-full object-cover ring-2 ring-violet-400" /> : <span className="grid size-20 place-items-center rounded-full border border-dashed text-[11px] text-[#94a3b8]">Photo</span>}
            <span className="text-[13px] font-semibold text-violet-300">Choose profile image</span>
            <input hidden type="file" accept="image/*" onChange={(event) => setPhoto(event.target.files?.[0])} />
          </label>
        </div>
        <Field label="Topic">
          <select className={inputClass} value={form.topic} onChange={(event) => setForm({ ...form, topic: event.target.value })}>
            <option value="">Select a topic</option>
            {topics.map((topic) => <option key={topic}>{topic}</option>)}
          </select>
        </Field>
        <Field label="Price (USD)">
          <input className={inputClass} inputMode="numeric" value={form.price} placeholder="Enter the price ($)" onChange={(event) => setForm({ ...form, price: event.target.value.replace(/[^\d]/g, "") })} />
        </Field>
      </Panel>
      <Panel className="grid gap-3">
        <p className="font-bold">Optional fields</p>
        <textarea className={inputClass} rows={3} placeholder="Listing description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        <select className={inputClass} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })}>
          <option value="">Main content of the asset</option>
          {contents.map((item) => <option key={item}>{item}</option>)}
        </select>
        <input className={inputClass} placeholder="Income ($/mo)" value={form.income} onChange={(event) => setForm({ ...form, income: event.target.value })} />
        <input className={inputClass} placeholder="Expense ($/mo)" value={form.expense} onChange={(event) => setForm({ ...form, expense: event.target.value })} />
        <textarea className={inputClass} rows={2} placeholder="Describe the income sources" value={form.incomeNote} onChange={(event) => setForm({ ...form, incomeNote: event.target.value })} />
        <textarea className={inputClass} rows={2} placeholder="Describe the expense sources" value={form.expenseNote} onChange={(event) => setForm({ ...form, expenseNote: event.target.value })} />
        <textarea className={inputClass} rows={2} placeholder="Tell how the asset was promoted" value={form.promotion} onChange={(event) => setForm({ ...form, promotion: event.target.value })} />
        <textarea className={inputClass} rows={2} placeholder="What is needed to maintain the asset?" value={form.maintain} onChange={(event) => setForm({ ...form, maintain: event.target.value })} />
        <select className={inputClass} value={form.monetized} onChange={(event) => setForm({ ...form, monetized: event.target.value })}>
          <option value="">Is monetization enabled?</option>
          <option>Yes</option>
          <option>No</option>
        </select>
        <div>
          <p className="mb-2 text-[13px] font-bold">Attach screenshots</p>
          <label className="grid h-28 cursor-pointer place-items-center rounded-2xl border border-dashed text-[13px] text-[#94a3b8]">
            Add images
            <input hidden type="file" accept="image/*" multiple onChange={(event) => addShots(event.target.files)} />
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            {form.screenshots.map((shot) => <img key={shot} src={shot} alt="" className="size-16 rounded-xl object-cover" />)}
          </div>
        </div>
        <PrimaryButton type="button" disabled={busy} onClick={publish}>{busy ? "Saving…" : "Start the sale"}</PrimaryButton>
        {note && <p className="text-[13px] text-[#94a3b8]">{note}</p>}
      </Panel>
    </div>
  );
}
