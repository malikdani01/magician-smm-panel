import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Instagram } from "lucide-react";
import { Authed, StaffOnly } from "@/components/gate";
import { linkInstagram, listInstagram } from "@/lib/panel.functions";
import { listInstagramConnections } from "@/lib/instagram.functions";

export const Route = createFileRoute("/instagram")({
  component: () => (
    <Authed>
      <StaffOnly>
      <Page />
      </StaffOnly>
    </Authed>
  ),
});

function Page() {
  const [username, setUsername] = useState("");
  const [rows, setRows] = useState<{ id: string; username: string }[]>([]);
  const [connected, setConnected] = useState<{ id: string; username: string; ig_user_id: string }[]>([]);
  const [ready, setReady] = useState(false);
  const [note, setNote] = useState("");

  function load() {
    listInstagram().then(setRows).catch(() => setRows([]));
    listInstagramConnections()
      .then((result) => {
        setReady(result.ready);
        setConnected(result.accounts);
      })
      .catch(() => setConnected([]));
  }
  useEffect(load, []);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("ig") === "connected") setNote("Instagram connect ho gaya. Ab is account ke counts padhe ja sakte hain.");
    if (params.get("ig") === "error") setNote(params.get("reason") || "Connect fail.");
  }, []);

  async function link() {
    setNote("");
    try {
      await linkInstagram({ data: username });
      setUsername("");
      setNote("Username saved. Use Connect Instagram below to load counts.");
      load();
    } catch (err: unknown) {
      setNote(err instanceof Error ? err.message : "Could not link.");
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <section className="rounded-3xl bg-gradient-to-r from-[#eef4ff] to-white p-4">
        <h1 className="flex items-center gap-2 text-[22px] font-bold"><span className="grid size-9 place-items-center rounded-xl bg-[#3b82f6] text-white"><Instagram className="size-4" /></span> Instagram Accounts</h1>
        <p className="text-[13px] text-[#64748b]">Professional account Allow karega, tab views, likes, saves aur shares usi account se aayenge.</p>
      </section>
      <section className="rounded-3xl border border-[#e7eef6] bg-white p-4">
        <p className="text-[11px] font-semibold tracking-widest text-[#94a3b8]">CONNECT INSTAGRAM</p>
        <p className="mt-1 text-[12px] text-[#64748b]">Abhi sirf tester account connect hoga. `sannaraj` se Instagram pe Allow dabana.</p>
        <a href="/api/meta/start" className="mt-3 inline-flex h-11 items-center rounded-xl bg-[#2563eb] px-4 text-[13px] font-bold text-white">Connect Instagram</a>
        {!ready && <p className="mt-2 text-[12px] text-rose-600">INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET are missing in .env. Restart the server.</p>}
        {connected.length > 0 && (
          <ul className="mt-3 space-y-2">
            {connected.map((row) => (
              <li key={row.id} className="rounded-xl bg-emerald-50 px-3 py-2 text-[13px] font-semibold text-emerald-800">
                Connected @{row.username || row.ig_user_id}
              </li>
            ))}
          </ul>
        )}
        {note && <p className="mt-2 text-[12px]">{note}</p>}
      </section>
      <section className="rounded-3xl border border-[#e7eef6] bg-white p-4">
        <p className="text-[11px] font-semibold tracking-widest text-[#94a3b8]">ADD INSTAGRAM USERNAME</p>
        <div className="mt-2 flex gap-2">
          <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="@ your_username" className="h-11 flex-1 rounded-xl bg-[#f8fafc] px-3 outline-none" />
          <button type="button" onClick={link} className="rounded-xl bg-[#60a5fa] px-4 font-semibold text-white">+ Link</button>
        </div>
        <p className="mt-2 text-[12px] text-[#94a3b8]">Yeh sirf naam save karta hai. Counts Connect wale account se aate hain.</p>
        <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-[12px] text-emerald-700">{rows.length}/5 links used · {Math.max(0, 5 - rows.length)} more accounts can be linked in this 30-day window.</p>
      </section>
      <section className="rounded-3xl border border-[#e7eef6] bg-white p-8 text-center text-[13px] text-[#64748b]">
        {rows.length === 0 ? "No username saved yet." : (
          <ul className="space-y-2 text-left">
            {rows.map((row) => <li key={row.id} className="rounded-xl bg-[#f8fafc] px-3 py-2 font-semibold">@{row.username}</li>)}
          </ul>
        )}
      </section>
    </div>
  );
}
