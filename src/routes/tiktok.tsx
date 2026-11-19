import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Authed, StaffOnly } from "@/components/gate";
import { listTikTokVideos } from "@/lib/tiktok.functions";

export const Route = createFileRoute("/tiktok")({
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
  const [connected, setConnected] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tt") === "connected") setNote("TikTok connect ho gaya.");
    if (params.get("tt") === "error") setNote(params.get("reason") || "Connect fail.");
    listTikTokVideos()
      .then((result) => {
        setConnected(result.connected);
        setUsername(result.username);
      })
      .catch((err: unknown) => setNote(err instanceof Error ? err.message : "Check fail."));
  }, []);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <section className="rounded-3xl bg-gradient-to-r from-[#f3f4f6] to-white p-4">
        <h1 className="flex items-center gap-2 text-[22px] font-bold">
          <span className="grid size-9 place-items-center rounded-xl bg-[#111827] text-white text-[16px]">♪</span>
          TikTok Accounts
        </h1>
        <p className="text-[13px] text-[#64748b]">Allow the sandbox target user. Their public videos will show in Bot Detection.</p>
      </section>
      <section className="rounded-3xl border border-[#e7eef6] bg-white p-4">
        <p className="text-[11px] font-semibold tracking-widest text-[#94a3b8]">CONNECT TIKTOK</p>
        <p className="mt-1 text-[12px] text-[#64748b]">Cloudflare tunnel chalu hona chahiye, aur .env mein TIKTOK_CLIENT_KEY, SECRET aur REDIRECT_URI hona chahiye.</p>
        <a href="/api/tiktok/start" className="mt-3 inline-flex h-11 items-center rounded-xl bg-[#111827] px-4 text-[13px] font-bold text-white">Connect TikTok</a>
        {connected && (
          <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-[13px] font-semibold text-emerald-800">Connected {username || "TikTok account"}</p>
        )}
        {note && <p className="mt-2 text-[12px]">{note}</p>}
        <Link to="/detect" className="mt-3 block text-[12px] font-semibold text-[#2563eb]">Bot Detection pe jaao →</Link>
      </section>
    </div>
  );
}
