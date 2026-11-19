import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Authed } from "@/components/gate";
import { adminPaymentClaims, adminReviewPayment, adminSaveGateway } from "@/lib/admin.functions";
import { inr } from "@/lib/money";

export const Route = createFileRoute("/admin/payments")({
  component: () => (
    <Authed>
      <Payments />
    </Authed>
  ),
});

type Claim = {
  id: string;
  email: string;
  name: string;
  amount_paise: number;
  pay_amount?: number;
  pay_currency?: string;
  screenshot: string;
  reference: string;
  status: string;
  created_at: string;
  gateway_name?: string;
  reject_reason?: string;
};

function claimMoney(claim: Claim) {
  const face = Number(claim.pay_amount) || 0;
  const cur = (claim.pay_currency || "").toUpperCase();
  const name = claim.gateway_name || "";
  const method = /jazz/i.test(name) ? "JazzCash" : /crypto|usdt/i.test(name) ? "Crypto" : /upi|razor/i.test(name) ? "UPI" : name || "Payment";
  const amount = face >= 1 && cur ? `${face % 1 === 0 ? face.toFixed(0) : face.toFixed(2)} ${cur}` : inr(claim.amount_paise);
  return `${amount} · ${method}`;
}

type Gate = { id: string; name: string; account_title: string; account_number: string; ifsc: string; instructions: string; qr_image: string; min_paise: number; max_paise: number; enabled: boolean; archived: boolean; pay_mode: string; pay_currency: string; network: string; pay_kind: string };

const EMPTY: Gate = { id: "", name: "", account_title: "", account_number: "", ifsc: "", instructions: "", qr_image: "", min_paise: 10000, max_paise: 10000000, enabled: true, archived: false, pay_mode: "manual", pay_currency: "INR", network: "", pay_kind: "upi" };

function shrink(file: File) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 900 / image.width);
      canvas.width = Math.max(1, image.width * scale);
      canvas.height = Math.max(1, image.height * scale);
      canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.72));
    };
    image.onerror = () => reject(new Error("Could not read that image."));
    image.src = URL.createObjectURL(file);
  });
}

type Addr = { network: string; address: string };

function parseAddrs(network: string, fallback: string): Addr[] {
  const rows = network.split("\n").map((line) => {
    const [net, address] = line.split("|").map((part) => part.trim());
    return address ? { network: net || "TRC20", address } : null;
  }).filter((row): row is Addr => Boolean(row));
  if (rows.length === 0 && fallback) rows.push({ network: "TRC20", address: fallback });
  return rows.length ? rows : [{ network: "TRC20", address: "" }];
}

function Payments() {
  const [gates, setGates] = useState<Gate[]>([]);
  const [form, setForm] = useState<Gate>(EMPTY);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [message, setMessage] = useState("");
  const [reason, setReason] = useState("");
  const [filter, setFilter] = useState("pending");
  const [openShot, setOpenShot] = useState("");
  const [razor, setRazor] = useState({ id: "", title: "", upi: "", qr: "", min: 100, max: 50000 });
  const [jazz, setJazz] = useState({ id: "", title: "", number: "", iban: "", qr: "", min: 100, max: 50000 });
  const [crypto, setCrypto] = useState({ id: "", rate: 90, min: 2, max: 500, qr: "", addresses: [{ network: "TRC20", address: "" }, { network: "BEP20", address: "" }] as Addr[] });

  function load() {
    adminPaymentClaims().then((result) => {
      setGates(result.gateways);
      setClaims(result.claims);
      const razorGate = result.gateways.find((gate) => gate.pay_kind === "razorpay");
      if (razorGate) setRazor({ id: razorGate.id, title: razorGate.account_title, upi: razorGate.account_number, qr: razorGate.qr_image, min: 100, max: 50000 });
      const jazzGate = result.gateways.find((gate) => gate.pay_kind === "jazzcash");
      if (jazzGate) setJazz({ id: jazzGate.id, title: jazzGate.account_title, number: jazzGate.account_number, iban: jazzGate.ifsc, qr: jazzGate.qr_image, min: 100, max: 50000 });
      const cryptoGate = result.gateways.find((gate) => gate.pay_kind === "crypto" || gate.pay_kind === "usdt");
      if (cryptoGate) setCrypto({ id: cryptoGate.id, rate: Number(cryptoGate.ifsc) || 90, min: 2, max: 500, qr: cryptoGate.qr_image, addresses: parseAddrs(cryptoGate.network, cryptoGate.account_number) });
    }).catch((err: unknown) => setMessage(err instanceof Error ? err.message : "Could not load payments."));
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="pay-desk mx-auto w-full min-w-0 max-w-3xl space-y-4">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#2563eb]">Admin</p>
        <h1 className="text-[28px] font-bold">Payments</h1>
        <p className="text-[13px] text-[#64748b]">Set Razorpay, JazzCash, and Crypto here. Minimum and maximum are saved in that currency. When a customer pays, they see the QR, account, and addresses. The wallet is credited after approval.</p>
      </header>
      <section className="pay-card space-y-3 rounded-[24px] border border-[#e7eef6] bg-white p-3 sm:p-4">
        <h2 className="font-semibold">Deposit methods</h2>
        <div className="pay-card rounded-2xl border p-3">
          <p className="font-semibold">Razorpay</p>
          <p className="text-[12px] text-[#64748b]">Min default 100 INR</p>
          <div className="mt-2 grid gap-2">
            <input value={razor.title} onChange={(event) => setRazor({ ...razor, title: event.target.value })} placeholder="Account name" className="h-11 rounded-xl border px-3 text-[13px]" />
            <input value={razor.upi} onChange={(event) => setRazor({ ...razor, upi: event.target.value })} placeholder="UPI number" className="h-11 rounded-xl border px-3 text-[13px]" />
            <div className="grid grid-cols-2 gap-2">
              <input value={razor.min} onChange={(event) => setRazor({ ...razor, min: Number(event.target.value) || 0 })} placeholder="Min INR" className="h-11 rounded-xl border px-3 text-[13px]" />
              <input value={razor.max} onChange={(event) => setRazor({ ...razor, max: Number(event.target.value) || 0 })} placeholder="Max INR" className="h-11 rounded-xl border px-3 text-[13px]" />
            </div>
            <label className="flex h-11 cursor-pointer items-center rounded-xl border px-3 text-[13px] font-semibold">Upload UPI QR
              <input type="file" accept="image/*" className="hidden" onChange={async (event) => { const file = event.target.files?.[0]; if (file) setRazor({ ...razor, qr: await shrink(file) }); }} />
            </label>
            {razor.qr && <img src={razor.qr} alt="" className="h-24 w-24 rounded-xl border object-contain" />}
            <button type="button" onClick={async () => {
              await adminSaveGateway({ data: { id: razor.id, name: "Razorpay", account_title: razor.title, account_number: razor.upi, ifsc: "", instructions: "Pay this UPI, then submit the transaction id and screenshot.", qr_image: razor.qr, min_rupees: 100, max_rupees: 50000, enabled: true, archived: false, pay_mode: "manual", pay_currency: "INR", network: "", pay_kind: "razorpay" } });
              setMessage("Razorpay saved. Min 100 INR, max 50,000 INR.");
              load();
            }} className="h-11 rounded-xl bg-[#2563eb] text-[13px] font-bold text-white">Save Razorpay</button>
          </div>
        </div>
        <div className="pay-card rounded-2xl border p-3">
          <p className="font-semibold">JazzCash</p>
          <p className="text-[12px] text-[#64748b]">Min default 100 PKR</p>
          <div className="mt-2 grid gap-2">
            <input value={jazz.title} onChange={(event) => setJazz({ ...jazz, title: event.target.value })} placeholder="Account name" className="h-11 rounded-xl border px-3 text-[13px]" />
            <input value={jazz.number} onChange={(event) => setJazz({ ...jazz, number: event.target.value })} placeholder="JazzCash number" className="h-11 rounded-xl border px-3 text-[13px]" />
            <input value={jazz.iban} onChange={(event) => setJazz({ ...jazz, iban: event.target.value })} placeholder="IBAN" className="h-11 rounded-xl border px-3 text-[13px]" />
            <div className="grid grid-cols-2 gap-2">
              <input value={jazz.min} onChange={(event) => setJazz({ ...jazz, min: Number(event.target.value) || 0 })} placeholder="Min PKR" className="h-11 rounded-xl border px-3 text-[13px]" />
              <input value={jazz.max} onChange={(event) => setJazz({ ...jazz, max: Number(event.target.value) || 0 })} placeholder="Max PKR" className="h-11 rounded-xl border px-3 text-[13px]" />
            </div>
            <label className="flex h-11 cursor-pointer items-center rounded-xl border px-3 text-[13px] font-semibold">Upload JazzCash QR
              <input type="file" accept="image/*" className="hidden" onChange={async (event) => { const file = event.target.files?.[0]; if (file) setJazz({ ...jazz, qr: await shrink(file) }); }} />
            </label>
            {jazz.qr && <img src={jazz.qr} alt="" className="h-24 w-24 rounded-xl border object-contain" />}
            <button type="button" onClick={async () => {
              await adminSaveGateway({ data: { id: jazz.id, name: "JazzCash", account_title: jazz.title, account_number: jazz.number, ifsc: jazz.iban, instructions: "Pay with JazzCash, then submit the TID and a screenshot.", qr_image: jazz.qr, min_rupees: 100, max_rupees: 50000, enabled: true, archived: false, pay_mode: "manual", pay_currency: "PKR", network: "", pay_kind: "jazzcash" } });
              setMessage("JazzCash saved. Min 100 PKR, max 50,000 PKR.");
              load();
            }} className="h-11 rounded-xl bg-[#2563eb] text-[13px] font-bold text-white">Save JazzCash</button>
          </div>
        </div>
        <div className="pay-card rounded-2xl border p-3">
          <p className="font-semibold">Crypto</p>
          <p className="text-[12px] text-[#64748b]">Min $2, max $500. Customer rate live USD se 8 PKR kam hai.</p>
          <div className="mt-2 grid min-w-0 gap-2">
            {crypto.addresses.map((row, index) => (
              <div key={index} className="grid min-w-0 gap-2">
                <div className="grid min-w-0 grid-cols-[1fr_auto] gap-2">
                  <input value={row.network} onChange={(event) => setCrypto({ ...crypto, addresses: crypto.addresses.map((item, at) => at === index ? { ...item, network: event.target.value.toUpperCase() } : item) })} placeholder="TRC20" className="h-11 min-w-0 rounded-xl border px-3 text-[13px]" />
                  <button type="button" onClick={() => setCrypto({ ...crypto, addresses: crypto.addresses.filter((_, at) => at !== index) })} className="h-11 rounded-xl border px-3 text-[12px]">Remove</button>
                </div>
                <input value={row.address} onChange={(event) => setCrypto({ ...crypto, addresses: crypto.addresses.map((item, at) => at === index ? { ...item, address: event.target.value.trim() } : item) })} placeholder="Wallet address" className="h-11 min-w-0 w-full rounded-xl border px-3 text-[13px]" />
              </div>
            ))}
            <button type="button" onClick={() => setCrypto({ ...crypto, addresses: [...crypto.addresses, { network: "BEP20", address: "" }] })} className="h-10 w-full rounded-xl border text-[12px] font-semibold">Add another address</button>
            <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3">
              <input value={crypto.rate} onChange={(event) => setCrypto({ ...crypto, rate: Number(event.target.value) || 0 })} placeholder="INR per 1 USDT" className="h-11 rounded-xl border px-3 text-[13px]" />
              <input value={crypto.min} onChange={(event) => setCrypto({ ...crypto, min: Number(event.target.value) || 0 })} placeholder="Min USD" className="h-11 rounded-xl border px-3 text-[13px]" />
              <input value={crypto.max} onChange={(event) => setCrypto({ ...crypto, max: Number(event.target.value) || 0 })} placeholder="Max USD" className="h-11 rounded-xl border px-3 text-[13px]" />
            </div>
            <label className="flex h-11 cursor-pointer items-center rounded-xl border px-3 text-[13px] font-semibold">Upload crypto QR
              <input type="file" accept="image/*" className="hidden" onChange={async (event) => { const file = event.target.files?.[0]; if (file) setCrypto({ ...crypto, qr: await shrink(file) }); }} />
            </label>
            {crypto.qr && <img src={crypto.qr} alt="" className="h-24 w-24 rounded-xl border object-contain" />}
            <button type="button" onClick={async () => {
              const addresses = crypto.addresses.filter((row) => row.address);
              await adminSaveGateway({ data: { id: crypto.id, name: "Crypto", account_title: "Crypto", account_number: addresses[0]?.address || "", ifsc: String(crypto.rate || 90), instructions: "Send only on the network written next to the address.", qr_image: crypto.qr, min_rupees: 2, max_rupees: 500, enabled: true, archived: false, pay_mode: "manual", pay_currency: "USD", network: addresses.map((row) => `${row.network || "TRC20"} | ${row.address}`).join("\n"), pay_kind: "crypto" } });
              setMessage("Crypto saved. Min $" + (crypto.min || 5) + ".");
              load();
            }} className="h-11 rounded-xl bg-[#2563eb] text-[13px] font-bold text-white">Save Crypto</button>
          </div>
        </div>
      </section>
      <section className="pay-card rounded-[24px] border border-[#e7eef6] bg-white p-3 sm:p-4">
        <h2 className="font-semibold">{form.id ? "Edit gateway" : "Add payment gateway"}</h2>
        <div className="mt-3 grid gap-2">
          <select value={form.pay_kind || "other"} onChange={(event) => setForm({ ...form, pay_kind: event.target.value })} className="h-11 rounded-xl border px-3 text-[13px]">
            <option value="upi">Instant UPI</option>
            <option value="razorpay">Razorpay — Key ID in account number, Key Secret in instructions</option>
            <option value="usdt">USDT TRC-20 — address in account number, INR rate in IFSC (90)</option>
            <option value="jazzcash">JazzCash</option>
            <option value="crypto">Pay with Crypto</option>
            <option value="talk">Talk to Admin</option>
            <option value="other">Other manual</option>
          </select>
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Name shown to the user" className="h-11 rounded-xl border px-3 text-[13px]" />
          <input value={form.account_title} onChange={(event) => setForm({ ...form, account_title: event.target.value })} placeholder="Account title" className="h-11 rounded-xl border px-3 text-[13px]" />
          <input value={form.account_number} onChange={(event) => setForm({ ...form, account_number: event.target.value })} placeholder="Account / wallet number" className="h-11 rounded-xl border px-3 text-[13px]" />
          <input value={form.ifsc} onChange={(event) => setForm({ ...form, ifsc: event.target.value })} placeholder="IFSC, bank ke liye" className="h-11 rounded-xl border px-3 text-[13px]" />
          <input value={form.instructions} onChange={(event) => setForm({ ...form, instructions: event.target.value })} placeholder="Instructions" className="h-11 rounded-xl border px-3 text-[13px]" />
          <div className="grid grid-cols-2 gap-2">
            <select value={form.pay_mode || "manual"} onChange={(event) => setForm({ ...form, pay_mode: event.target.value })} className="h-11 rounded-xl border px-3 text-[13px]">
              <option value="manual">Manual — admin approves</option>
              <option value="auto">Automatic gateway</option>
            </select>
            <input value={form.pay_currency || "INR"} onChange={(event) => setForm({ ...form, pay_currency: event.target.value.toUpperCase() })} placeholder="Currency INR / USD / USDT" className="h-11 rounded-xl border px-3 text-[13px]" />
          </div>
          <textarea value={form.network || ""} onChange={(event) => setForm({ ...form, network: event.target.value })} placeholder="Extra note" className="h-20 w-full min-w-0 rounded-xl border px-3 py-2 text-[13px]" />
          <div className="grid grid-cols-2 gap-2">
            <input value={form.min_paise / 100} onChange={(event) => setForm({ ...form, min_paise: Math.floor(Number(event.target.value) || 0) * 100 })} placeholder="Min ₹" className="h-11 rounded-xl border px-3 text-[13px]" />
            <input value={form.max_paise / 100} onChange={(event) => setForm({ ...form, max_paise: Math.floor(Number(event.target.value) || 0) * 100 })} placeholder="Max ₹" className="h-11 rounded-xl border px-3 text-[13px]" />
          </div>
          <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} /> Enabled</label>
          <label className="flex h-11 cursor-pointer items-center rounded-xl border px-3 text-[13px] font-semibold">
            Upload QR
            <input type="file" accept="image/*" className="hidden" onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setForm({ ...form, qr_image: await shrink(file) });
            }} />
          </label>
          {form.qr_image && <img src={form.qr_image} alt="" className="h-32 w-32 rounded-xl border object-contain" />}
        </div>
        <button type="button" onClick={async () => {
          await adminSaveGateway({ data: { ...form, min_rupees: form.min_paise / 100, max_rupees: form.max_paise / 100, archived: form.archived } });
          setForm(EMPTY);
          setMessage("Gateway saved.");
          load();
        }} className="mt-3 h-11 w-full rounded-xl bg-[#2563eb] text-[13px] font-bold text-white">Save gateway</button>
        <button type="button" onClick={() => setForm(EMPTY)} className="mt-2 h-10 w-full rounded-xl border text-[12px] font-semibold">Add another</button>
        <ul className="mt-3 space-y-2 text-[13px]">
          {gates.map((gate) => (
            <li key={gate.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl bg-[#f8fafc] px-3 py-2">
              <span className="pay-break min-w-0">{gate.name} · {gate.enabled ? "on" : "off"} {gate.archived ? "· archived" : ""}</span>
              <span className="flex gap-2">
                <button type="button" onClick={() => setForm(gate)} className="font-semibold text-[#2563eb]">Edit</button>
                <button type="button" onClick={async () => { await adminSaveGateway({ data: { ...gate, min_rupees: gate.min_paise / 100, max_rupees: gate.max_paise / 100, archived: true, enabled: false, qr_image: "" } }); load(); }} className="font-semibold text-rose-600">Archive</button>
              </span>
            </li>
          ))}
        </ul>
      </section>
      {message && <p className="rounded-xl bg-[#eff6ff] px-3 py-2 text-[13px]">{message}</p>}
      <div className="flex flex-wrap gap-2">
        {["pending", "approved", "declined", "all"].map((item) => (
          <button key={item} type="button" onClick={() => setFilter(item)} className={`rounded-full px-3 py-1 text-[12px] font-semibold ${filter === item ? "bg-[#2563eb] text-white" : "bg-white"}`}>{item}</button>
        ))}
      </div>
      <ul className="space-y-3">
        {claims.filter((claim) => filter === "all" || claim.status === filter).map((claim) => (
          <li key={claim.id} className="rounded-2xl border border-[#e7eef6] bg-white p-4">
            <div className="flex gap-3">
              <button type="button" onClick={() => setOpenShot(claim.screenshot)}><img src={claim.screenshot} alt="" className="h-28 w-24 rounded-xl object-cover" /></button>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{claim.name}</p>
                <p className="truncate text-[12px] text-[#64748b]">{claim.email} · {claim.gateway_name || "Gateway"}</p>
                <p className="mt-1 text-[14px] font-bold">{claimMoney(claim)} · {claim.id}</p>
                <p className="text-[12px] text-[#64748b]">{claim.reference || "No UTR"} · {claim.status} · {new Date(claim.created_at).toLocaleString("en-IN", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                {claim.reject_reason && <p className="text-[12px] text-rose-600">{claim.reject_reason}</p>}
                {claim.status === "pending" && (
                  <div className="mt-2 space-y-2">
                    <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reject reason" className="h-9 w-full rounded-lg border px-2 text-[12px]" />
                    <div className="flex gap-2">
                      <button type="button" onClick={async () => { await adminReviewPayment({ data: { id: claim.id, approve: true } }); load(); }} className="h-9 rounded-lg bg-emerald-600 px-3 text-[12px] font-bold text-white">Approve</button>
                      <button type="button" onClick={async () => { await adminReviewPayment({ data: { id: claim.id, approve: false, reason } }); load(); }} className="h-9 rounded-lg border border-rose-200 px-3 text-[12px] font-bold text-rose-600">Decline</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </li>
        ))}
        {claims.length === 0 && <p className="text-center text-[13px] text-[#94a3b8]">No payment screenshots yet.</p>}
      </ul>
      {openShot && <button type="button" onClick={() => setOpenShot("")} className="fixed inset-0 z-40 grid place-items-center bg-black/70 p-6"><img src={openShot} alt="Payment proof" className="max-h-[80vh] rounded-2xl" /></button>}
    </div>
  );
}
