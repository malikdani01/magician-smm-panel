import { useEffect, useState, useSyncExternalStore } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Authed } from "@/components/gate";
import { adminCredit, adminCustomers, adminDeleteCustomer, adminSetCustomerAccess } from "@/lib/admin.functions";
import { currencySnapshot, formatMajor, inr, moneyState, subscribeCurrency } from "@/lib/money";

export const Route = createFileRoute("/admin/customers")({
  component: () => (
    <Authed>
      <Customers />
    </Authed>
  ),
});

type Customer = {
  id: string;
  name: string;
  email: string;
  created_at: string;
  role: string;
  balance_paise: number;
  orders: number;
  suspended: boolean;
  blocked: boolean;
};

function Customers() {
  const [rows, setRows] = useState<Customer[]>([]);
  const [note, setNote] = useState("");
  const [credit, setCredit] = useState<Record<string, string>>({});
  useSyncExternalStore(subscribeCurrency, currencySnapshot, currencySnapshot);
  const money = moneyState().display;

  function load() {
    adminCustomers().then(setRows).catch((err: unknown) => setNote(err instanceof Error ? err.message : "Could not load customers."));
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#2563eb]">Admin</p>
        <h1 className="text-[28px] font-bold">Customers</h1>
        <p className="text-[13px] text-[#64748b]">Who signed in, what they spent, and who to remove.</p>
      </header>
      {note && <p className="rounded-xl bg-[#eff6ff] px-3 py-2 text-[13px]">{note}</p>}
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="rounded-2xl border border-[#e7eef6] bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{row.name} {row.role === "admin" && <span className="rounded-full bg-[#dbeafe] px-2 py-0.5 text-[10px] font-bold text-[#1d4ed8]">ADMIN</span>} {row.suspended && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">SUSPENDED</span>} {row.blocked && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">BLOCKED</span>}</p>
                <p className="text-[12px] text-[#64748b]">{row.email}</p>
                <p className="mt-1 text-[13px]">{inr(row.balance_paise)} · {row.orders} orders · {new Date(row.created_at).toLocaleString(money.locale, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
              </div>
              {row.role !== "admin" && (
                <div className="flex shrink-0 flex-col gap-1">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await adminSetCustomerAccess({ data: { userId: row.id, kind: "suspended" } });
                        load();
                      } catch (err: unknown) {
                        setNote(err instanceof Error ? err.message : "Could not update suspend.");
                      }
                    }}
                    className={`rounded-lg border px-3 py-1 text-[12px] font-semibold ${row.suspended ? "border-amber-300 text-amber-700" : "border-[#e7eef6] text-[#334155]"}`}
                  >
                    {row.suspended ? "Unsuspend" : "Suspend"}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await adminSetCustomerAccess({ data: { userId: row.id, kind: "blocked" } });
                        load();
                      } catch (err: unknown) {
                        setNote(err instanceof Error ? err.message : "Could not update block.");
                      }
                    }}
                    className={`rounded-lg border px-3 py-1 text-[12px] font-semibold ${row.blocked ? "border-rose-300 text-rose-700" : "border-[#e7eef6] text-[#334155]"}`}
                  >
                    {row.blocked ? "Unblock" : "Block"}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm(`Remove ${row.email}?`)) return;
                      await adminDeleteCustomer({ data: row.id });
                      load();
                    }}
                    className="rounded-lg border border-rose-200 px-3 py-1 text-[12px] font-semibold text-rose-600"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <input value={credit[row.id] ?? ""} onChange={(event) => setCredit((current) => ({ ...current, [row.id]: event.target.value.replace(/[^\d]/g, "") }))} placeholder={`Add ${money.symbol.trim()}`} className="h-10 w-28 rounded-xl border px-3 text-[13px]" />
              <button
                type="button"
                onClick={async () => {
                  const amount = Number(credit[row.id] || 0);
                  if (amount < 1) {
                    setNote("Enter at least 1.");
                    return;
                  }
                  try {
                    await adminCredit({ data: { userId: row.id, amount, currency: money.code } });
                    setCredit((current) => ({ ...current, [row.id]: "" }));
                    setNote(`Added ${formatMajor(amount)} (${money.code}) to ${row.email}.`);
                    load();
                  } catch (err: unknown) {
                    setNote(err instanceof Error ? err.message : "Could not add funds.");
                  }
                }}
                className="h-10 rounded-xl bg-[#2563eb] px-3 text-[12px] font-bold text-white"
              >
                Add funds
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
