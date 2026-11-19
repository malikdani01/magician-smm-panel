import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Authed } from "@/components/gate";
import { getCatalog, type ServiceRow } from "@/lib/panel.functions";
import { inr } from "@/lib/money";

export const Route = createFileRoute("/catalog")({
  component: () => (
    <Authed>
      <Catalog />
    </Authed>
  ),
});

function Catalog() {
  const [rows, setRows] = useState<ServiceRow[]>([]);
  useEffect(() => {
    getCatalog().then((catalog) => setRows(catalog.services)).catch(() => setRows([]));
  }, []);
  return (
    <div className="mx-auto max-w-xl space-y-3">
      <h1 className="text-[26px] font-bold">All Services</h1>
      <p className="text-[13px] text-[#64748b]">Browse catalog. Prices are on your book. Nothing is bought from a provider.</p>
      {rows.map((row) => (
        <article key={row.id} className="flex items-center justify-between rounded-2xl border border-[#e7eef6] bg-white p-4">
          <div>
            <p className="font-semibold capitalize">{row.platform} · {row.name}</p>
            <p className="text-[12px] text-[#94a3b8]">Min {row.min_quantity.toLocaleString("en-IN")} · Max {row.max_quantity.toLocaleString("en-IN")}</p>
          </div>
          <p className="font-semibold">{inr(row.price_per_10k_paise)} / 10k</p>
        </article>
      ))}
    </div>
  );
}
