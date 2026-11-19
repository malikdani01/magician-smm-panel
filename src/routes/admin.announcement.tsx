import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Authed, StaffOnly } from "@/components/gate";
import { Field, Panel, PrimaryButton, inputClass } from "@/components/shell";
import { announcementFallback, getAnnouncement, saveAnnouncement, type AnnouncementBar } from "@/lib/announcement.functions";

export const Route = createFileRoute("/admin/announcement")({
  component: () => (
    <Authed>
      <StaffOnly>
        <AnnouncementDesk />
      </StaffOnly>
    </Authed>
  ),
});

const FONTS = ["Outfit", "Inter", "Playfair Display"];
const SPEEDS = [10, 20, 30, 45];

function AnnouncementDesk() {
  const [form, setForm] = useState<AnnouncementBar>(announcementFallback);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getAnnouncement().then(setForm).catch(() => setNote("Could not load the announcement bar."));
  }, []);

  function patch(next: Partial<AnnouncementBar>) {
    setForm((current) => ({ ...current, ...next }));
  }

  async function save() {
    setBusy(true);
    setNote("");
    try {
      const saved = await saveAnnouncement({ data: form });
      setForm(saved);
      setNote("Saved. The bar updates on the next page open.");
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-4">
      <div>
        <h1 className="text-[28px] font-bold">Announcement bar</h1>
        <p className="mt-1 text-[13px] text-[#94a3b8]">One scrolling line under the header. Add as many texts as you want. They move together.</p>
      </div>
      <Panel>
        <label className="flex items-center justify-between gap-3 text-[14px] font-semibold">
          Show announcement bar
          <input type="checkbox" checked={form.enabled} onChange={(event) => patch({ enabled: event.target.checked })} />
        </label>
      </Panel>
      <Panel className="overflow-hidden p-0">
        <p className="px-5 pt-4 text-[13px] font-bold">Preview</p>
        <div className="announce mt-3" style={{ background: form.background || undefined, color: form.color || undefined, fontFamily: `${form.font}, Outfit, sans-serif` }}>
          <div className="announce-track" style={{ animationDuration: `${Math.max(4, form.seconds || 18)}s`, animationDirection: form.direction === "right" ? "reverse" : "normal" }}>
            {[0, 1].map((copy) => (
              <span className="announce-set" key={copy}>
                {Array.from({ length: 6 }, () => form.texts.map((line) => line.trim()).filter(Boolean)).flat().map((line, index) => (
                  <span className="announce-item" key={`${copy}-${index}`}>
                    <i className="announce-star">✦</i>
                    {line}
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>
      </Panel>
      <Panel className="grid gap-3">
        <p className="text-[13px] font-bold">Texts</p>
        {form.texts.map((line, index) => (
          <div key={index} className="flex gap-2">
            <input className={inputClass} value={line} placeholder="Write an announcement" onChange={(event) => {
              const texts = [...form.texts];
              texts[index] = event.target.value;
              patch({ texts });
            }} />
            {form.texts.length > 1 && (
              <button type="button" className="rounded-xl border px-3 text-[12px] font-semibold" style={{ borderColor: "var(--desk-line)" }} onClick={() => patch({ texts: form.texts.filter((_, item) => item !== index) })}>Remove</button>
            )}
          </div>
        ))}
        <button type="button" className="h-10 rounded-xl border text-[13px] font-semibold" style={{ borderColor: "var(--desk-line)" }} onClick={() => patch({ texts: [...form.texts, ""] })}>Add another text</button>
      </Panel>
      <Panel className="grid gap-4">
        <Field label="Scroll side">
          <div className="flex gap-2">
            {(["left", "right"] as const).map((side) => (
              <button key={side} type="button" onClick={() => patch({ direction: side })} className={"h-10 flex-1 rounded-xl border text-[13px] font-semibold " + (form.direction === side ? "bg-violet-600 text-white" : "")} style={{ borderColor: "var(--desk-line)" }}>
                {side === "left" ? "Scroll left" : "Scroll right"}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Speed in seconds">
          <div className="mb-2 flex flex-wrap gap-2">
            {SPEEDS.map((seconds) => (
              <button key={seconds} type="button" onClick={() => patch({ seconds })} className={"h-9 rounded-xl border px-3 text-[12px] font-semibold " + (form.seconds === seconds ? "bg-violet-600 text-white" : "")} style={{ borderColor: "var(--desk-line)" }}>{seconds}s</button>
            ))}
          </div>
          <input className={inputClass} type="number" min={4} max={180} value={form.seconds} onChange={(event) => patch({ seconds: Number(event.target.value) })} />
        </Field>
        <Field label="Font">
          <select className={inputClass} value={form.font} onChange={(event) => patch({ font: event.target.value })}>
            {FONTS.map((font) => <option key={font} value={font}>{font}</option>)}
          </select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Background color">
            <input className={inputClass} type="color" value={form.background || "#1a1030"} onChange={(event) => patch({ background: event.target.value })} />
          </Field>
          <Field label="Text color">
            <input className={inputClass} type="color" value={form.color || "#f5f3ff"} onChange={(event) => patch({ color: event.target.value })} />
          </Field>
        </div>
        <PrimaryButton type="button" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save announcement"}</PrimaryButton>
        {note && <p className="text-[13px] text-[#94a3b8]">{note}</p>}
      </Panel>
    </div>
  );
}
