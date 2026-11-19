import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Authed } from "@/components/gate";
import { DealChat } from "@/components/deal-chat";
import { myDeals } from "@/lib/market.functions";

export const Route = createFileRoute("/deals")({
  component: () => (
    <Authed>
      <MyDeals />
    </Authed>
  ),
});

type Deal = { id: string; status: string; listing_name: string; price: number; image: string; topic: string };

function MyDeals() {
  const [rows, setRows] = useState<Deal[]>([]);
  const [active, setActive] = useState<Deal | null>(null);
  function load() { myDeals().then((list) => setRows(list as Deal[])).catch(() => setRows([])); }
  useEffect(() => {
    load();
    const timer = window.setInterval(load, 5000);
    return () => window.clearInterval(timer);
  }, []);
  if (active?.status === "open") {
    return (
      <div className="mx-auto grid max-w-xl gap-3">
        <button type="button" className="text-left text-[13px] text-violet-300" onClick={() => setActive(null)}>Back</button>
        <h1 className="text-[24px] font-bold">{active.listing_name}</h1>
        <DealChat dealId={active.id} asAdmin={false} />
      </div>
    );
  }
  return (
    <div className="mx-auto grid max-w-xl gap-3">
      <h1 className="text-[28px] font-bold">Deals</h1>
      {rows.map((row) => (
        <button key={row.id} type="button" className="flex items-center gap-3 rounded-3xl border p-3 text-left" style={{ borderColor: "var(--desk-line)" }} onClick={() => row.status === "open" && setActive(row)}>
          {row.image ? <img src={row.image} alt="" className="size-14 rounded-2xl object-cover" /> : <span className="grid size-14 place-items-center rounded-2xl bg-violet-900 text-[11px]">DP</span>}
          <span>
            <b className="block">{row.listing_name}</b>
            <span className="block text-[12px] text-[#94a3b8]">{row.topic} · ${row.price}</span>
            <span className="mt-1 block text-[12px] font-bold uppercase text-violet-300">{row.status === "pending" ? "Pending — waiting for admin" : "Accepted — open chat"}</span>
          </span>
        </button>
      ))}
      {!rows.length && <p className="text-[13px] text-[#94a3b8]">You have no open deals.</p>}
    </div>
  );
}
