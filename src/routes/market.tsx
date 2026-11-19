import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Authed } from "@/components/gate";
import { accountsForSale } from "@/lib/market.functions";

export const Route = createFileRoute("/market")({
  component: () => (
    <Authed>
      <Market />
    </Authed>
  ),
});

type Card = { id: string; name: string; topic: string; price: number; followers: number; image: string; platform: string };

function Market() {
  const [rows, setRows] = useState<Card[]>([]);
  useEffect(() => { accountsForSale().then((list) => setRows(list as Card[])).catch(() => setRows([])); }, []);
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-[28px] font-bold">Account Marketplace</h1>
      <p className="mb-4 text-[13px] text-[#94a3b8]">Social accounts listed by the panel. No extra fee to open a deal.</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {rows.map((row) => (
          <Link key={row.id} to="/market/$id" params={{ id: row.id }} className="overflow-hidden rounded-3xl border" style={{ borderColor: "var(--desk-line)", background: "var(--desk-card)" }}>
            <div className="relative h-32 bg-black">
              {row.image ? <img src={row.image} alt="" className="size-full object-cover" /> : null}
              <span className="absolute right-2 top-2 rounded-lg bg-orange-500 px-2 py-1 text-[10px] font-bold text-white">PREMIUM</span>
            </div>
            <div className="space-y-1 p-3 text-center">
              <b className="block truncate">{row.name}</b>
              <p className="text-[12px] text-[#94a3b8]">{row.topic}</p>
              <p className="text-[22px] font-bold">${Number(row.price).toLocaleString("en-US")}</p>
              <p className="text-[12px] text-[#94a3b8]">{Number(row.followers).toLocaleString("en-US")} subs</p>
            </div>
          </Link>
        ))}
      </div>
      {!rows.length && <p className="text-[13px] text-[#94a3b8]">No accounts are listed yet.</p>}
    </div>
  );
}
