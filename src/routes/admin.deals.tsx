import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Authed, StaffOnly } from "@/components/gate";
import { DealChat } from "@/components/deal-chat";
import { PrimaryButton } from "@/components/shell";
import { adminDeals, dealAction } from "@/lib/market.functions";

export const Route = createFileRoute("/admin/deals")({
  component: () => (
    <Authed>
      <StaffOnly>
        <AdminDeals />
      </StaffOnly>
    </Authed>
  ),
});

type Deal = { id: string; status: string; buyer_name: string; buyer_email: string; listing_name: string; price: number; topic: string };

function AdminDeals() {
  const [rows, setRows] = useState<Deal[]>([]);
  const [active, setActive] = useState<Deal | null>(null);
  const [note, setNote] = useState("");
  function load() {
    adminDeals().then((list) => {
      const next = list as Deal[];
      setRows(next);
      setActive((current) => current ? next.find((row) => row.id === current.id) || null : null);
    }).catch(() => setRows([]));
  }
  useEffect(() => {
    load();
    const timer = window.setInterval(load, 5000);
    return () => window.clearInterval(timer);
  }, []);

  async function act(action: "accept" | "decline" | "confirm") {
    if (!active) return;
    setNote("");
    try {
      await dealAction({ data: { id: active.id, action } });
      if (action !== "accept") setActive(null);
      load();
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Could not update the deal.");
    }
  }

  if (active) {
    return (
      <div className="mx-auto grid max-w-xl gap-3">
        <button type="button" className="text-left text-[13px] text-violet-300" onClick={() => setActive(null)}>Back</button>
        <h1 className="text-[24px] font-bold">{active.listing_name}</h1>
        <p className="text-[13px] text-[#94a3b8]">{active.buyer_name} · {active.buyer_email} · ${active.price}</p>
        <div className="flex gap-2">
          {active.status === "pending" && <PrimaryButton type="button" onClick={() => act("accept")}>Accept</PrimaryButton>}
          {active.status === "open" && <PrimaryButton type="button" onClick={() => act("confirm")}>Confirm deal</PrimaryButton>}
          <button type="button" className="h-11 rounded-xl border px-4 text-[13px] font-semibold" onClick={() => act("decline")}>Decline</button>
        </div>
        {note && <p className="text-[13px] text-rose-300">{note}</p>}
        {active.status === "open" && <DealChat dealId={active.id} asAdmin />}
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-xl gap-3">
      <h1 className="text-[28px] font-bold">Deals</h1>
      {rows.map((row) => (
        <button key={row.id} type="button" className="rounded-3xl border p-4 text-left" style={{ borderColor: "var(--desk-line)" }} onClick={() => setActive(row)}>
          <b>{row.buyer_name}</b>
          <p className="text-[12px] text-[#94a3b8]">{row.buyer_email}</p>
          <p className="text-[13px]">{row.listing_name} · ${row.price}</p>
          <p className="text-[11px] font-bold uppercase text-violet-300">{row.status}</p>
        </button>
      ))}
      {!rows.length && <p className="text-[13px] text-[#94a3b8]">No deals yet.</p>}
    </div>
  );
}
