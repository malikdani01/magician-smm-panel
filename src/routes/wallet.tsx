import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowDownRight, ArrowUpRight, Bitcoin, Calendar, MessageCircle, QrCode, Wallet, Zap } from "lucide-react";
import { Authed } from "@/components/gate";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getWallet, type TxnRow } from "@/lib/panel.functions";
import { listPaymentGateways, myPaymentClaims, submitPaymentClaim } from "@/lib/admin.functions";
import { cancelWalletDeposit, checkWalletDeposit, confirmRazorpayDeposit, getDepositDesk, openUsdtDeposit, saveDepositShot, startRazorpayDeposit } from "@/lib/deposit.functions";
import { convertMajor, formatMajor, fromMinor, inr, moneyCode, moneyState, subscribeCurrency, toBaseMinor, usdtQuote } from "@/lib/money";

export const Route = createFileRoute("/wallet")({
  component: () => (
    <Authed>
      <WalletPage />
    </Authed>
  ),
});

type Gate = {
  id: string;
  name: string;
  account_title: string;
  account_number: string;
  ifsc: string;
  instructions: string;
  qr_image: string;
  min_paise: number;
  max_paise: number;
  pay_mode?: string;
  pay_currency?: string;
  network?: string;
  pay_kind?: string;
};

const PAY_RULES = {
  razorpay: { min: 100, max: 50000, cur: "INR", chips: [100, 250, 500, 1000, 2500, 5000] },
  jazzcash: { min: 100, max: 50000, cur: "PKR", chips: [100, 250, 500, 1000, 2500, 5000] },
  crypto: { min: 2, max: 500, cur: "USD", chips: [2, 5, 10, 25, 50, 100] },
} as const;

function nativeText(cur: string, value: number) {
  const whole = Number.isInteger(value) ? value.toLocaleString("en-US") : value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (cur === "USD") return `$${whole}`;
  if (cur === "INR") return `₹${whole}`;
  if (cur === "PKR") return `Rs ${whole}`;
  return `${whole} ${cur}`;
}
type Coin = { label: string; network: string; address: string };
type SlotId = "upi" | "crypto" | "talk" | "jazzcash";
type Period = "today" | "yesterday" | "7" | "30" | "lifetime" | "custom";

const SLOTS: { id: SlotId; title: string; sub: string; badge: string; hint: string; chips: number[] }[] = [
  { id: "upi", title: "Instant UPI", sub: "GPay · PhonePe · Paytm", badge: "UPI", hint: "Submit proof. The wallet updates after admin approval.", chips: [100, 500, 1000, 2000, 5000] },
  { id: "crypto", title: "Pay with Crypto", sub: "USDT · BTC · TRX · LTC · ETH", badge: "CRYPTO", hint: "Submit the hash. The wallet updates after admin approval.", chips: [90, 500, 1000, 2000, 5000, 10000] },
  { id: "talk", title: "Talk to Admin", sub: "Custom / bulk top-ups on Telegram", badge: "MANUAL", hint: "Message pre-filled · replies in minutes", chips: [100, 500, 1000, 2000, 5000, 10000] },
  { id: "jazzcash", title: "JazzCash", sub: "Account · QR · screenshot", badge: "PK", hint: "Transaction id aur screenshot · admin approve ke baad credit", chips: [100, 500, 1000, 2000, 5000, 10000] },
];

const PERIODS: { id: Period; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "7", label: "Last 7 Days" },
  { id: "30", label: "Last 30 Days" },
  { id: "lifetime", label: "Lifetime" },
  { id: "custom", label: "Custom Range..." },
];

function slotCoinsOf(gate: Gate): Coin[] {
  const lines = (gate.network || "").split("\n").map((line) => line.trim()).filter(Boolean);
  const parsed = lines.map((line) => {
    const [label, network, address] = line.split("|").map((part) => part.trim());
    return { label: label || "USDT", network: network || "", address: address || "" };
  }).filter((row) => row.address);
  if (parsed.length) return parsed;
  if (gate.account_number) return [{ label: gate.pay_currency || "USDT", network: "", address: gate.account_number }];
  return [];
}

function clock(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function dayStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function chipLabel(chip: number) {
  const symbol = moneyState().display.symbol;
  return `${symbol}${chip >= 1000 ? `${chip / 1000}k` : chip}`;
}

function WalletPage() {
  const { user } = useCurrentUserState();
  const [balance, setBalance] = useState(0);
  const [rows, setRows] = useState<TxnRow[]>([]);
  const [amount, setAmount] = useState(100);
  const [gateways, setGateways] = useState<Gate[]>([]);
  const [slot, setSlot] = useState<SlotId>("upi");
  const [filter, setFilter] = useState("All");
  const [period, setPeriod] = useState<Period>("lifetime");
  const [periodOpen, setPeriodOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [shot, setShot] = useState("");
  const [reference, setReference] = useState("");
  const [claims, setClaims] = useState<{ id: string; amount_paise: number; status: string; created_at: string; pay_amount?: number; pay_currency?: string; gateway_name?: string }[]>([]);
  const [checkout, setCheckout] = useState(false);
  const [left, setLeft] = useState(600);
  const [coin, setCoin] = useState(0);
  const [copied, setCopied] = useState("");
  const [method, setMethod] = useState<"razorpay" | "crypto" | "jazzcash">("razorpay");
  const [payNet, setPayNet] = useState(0);
  const [desk, setDesk] = useState({ razorpay: false, razorMin: 200, razorMax: 100000, usdtAddress: "", usdtRate: 90, usdtMin: 10, usdtMaxInr: 500000 });
  const [ledger, setLedger] = useState<{ id: string; gateway: string; amount_paise: number; pay_amount: string; pay_currency: string; address: string; rate: number; reference: string; status: string; expires_at: string | null; created_at: string }[]>([]);
  const [banner, setBanner] = useState("");
  const [txid, setTxid] = useState("");
  const [shotName, setShotName] = useState("");
  const [payOpen, setPayOpen] = useState(false);
  const [moneyTick, setMoneyTick] = useState(0);

  function load() {
    getWallet().then((wallet) => {
      setBalance(wallet.balance_paise);
      setRows(wallet.transactions);
    });
    listPaymentGateways().then((next) => setGateways(next as Gate[])).catch(() => setGateways([]));
    myPaymentClaims().then(setClaims).catch(() => setClaims([]));
    getDepositDesk().then((result) => {
      setDesk(result.config);
      setLedger(result.deposits);
    }).catch(() => undefined);
  }
  useEffect(load, []);
  useEffect(() => {
    const stop = subscribeCurrency(() => setMoneyTick((value) => value + 1));
    return () => { stop(); };
  }, []);
  useEffect(() => {
    if (!checkout) return;
    setLeft(600);
    const timer = window.setInterval(() => setLeft((value) => (value > 0 ? value - 1 : 0)), 1000);
    return () => window.clearInterval(timer);
  }, [checkout, slot]);

  const gate = useMemo(() => {
    const match = (kind: string) => gateways.find((item) => item.pay_kind === kind || (kind === "jazzcash" && /jazz/i.test(item.name)));
    return match(slot);
  }, [gateways, slot]);
  const visibleSlots = SLOTS.filter((item) => item.id !== "jazzcash" || gateways.some((row) => row.pay_kind === "jazzcash" || /jazz/i.test(row.name)));
  const meta = SLOTS.find((item) => item.id === slot) ?? SLOTS[0];
  const kind = gate?.pay_kind || slot;
  const slotCoins = gate ? slotCoinsOf(gate) : [];
  const chosen = slotCoins[coin] || slotCoins[0];
  const paise = toBaseMinor(amount);
  const symbol = moneyState().display.symbol;
  const minMajor = gate ? gate.min_paise / 100 : slot === "crypto" ? 90 : slot === "talk" ? 100 : 50;
  const maxMajor = gate ? gate.max_paise / 100 : slot === "upi" ? 100000 : 540000;

  const ranged = useMemo(() => {
    const now = new Date();
    const today = dayStart(now);
    return rows.filter((row) => {
      const at = new Date(row.created_at).getTime();
      if (!Number.isFinite(at)) return period === "lifetime";
      if (period === "today") return at >= today;
      if (period === "yesterday") return at >= today - 86400000 && at < today;
      if (period === "7") return at >= today - 6 * 86400000;
      if (period === "30") return at >= today - 29 * 86400000;
      if (period === "custom") {
        const start = from ? dayStart(new Date(from)) : 0;
        const end = to ? dayStart(new Date(to)) + 86400000 : Number.POSITIVE_INFINITY;
        return at >= start && at < end;
      }
      return true;
    });
  }, [rows, period, from, to]);

  const deposits = ranged.filter((row) => row.amount_paise > 0 && row.kind !== "refund").reduce((sum, row) => sum + row.amount_paise, 0);
  const spent = Math.abs(ranged.filter((row) => row.amount_paise < 0).reduce((sum, row) => sum + row.amount_paise, 0));
  const shown = ranged.filter((row) => {
    if (filter === "Deposit") return row.amount_paise > 0 && row.kind !== "refund";
    if (filter === "Order") return row.amount_paise < 0;
    if (filter === "Refund") return row.kind === "refund" || /^refund/i.test(row.note);
    return true;
  });
  const periodLabel = PERIODS.find((item) => item.id === period)?.label ?? "Lifetime";

  function withinLimit() {
    if (amount < minMajor || amount > maxMajor) {
      setNote(`Amount must be between ${formatMajor(minMajor)} and ${formatMajor(maxMajor)}.`);
      return false;
    }
    return true;
  }

  function openCheckout() {
    setNote("");
    if (!gate) {
      setNote("This payment method is turned off.");
      return;
    }
    if (!withinLimit()) return;
    if (kind === "talk") return;
    if (kind === "crypto" && !chosen?.address) {
      setNote("No crypto address is saved yet.");
      return;
    }
    setCheckout(true);
  }

  function talk() {
    setNote("");
    if (!gate) {
      setNote("No Telegram link is saved yet.");
      return;
    }
    if (!withinLimit()) return;
    const who = (user?.primaryEmail || user?.displayName || "user").slice(0, 80);
    const text = encodeURIComponent(`Wallet top-up\nUser: ${who}\nAmount: ${amount} ${moneyCode()}\nPanel: ${window.location.origin}`);
    const raw = gate.account_number.trim();
    const href = /^https?:\/\//.test(raw) ? raw : `https://t.me/${raw.replace(/^@/, "")}?text=${text}`;
    window.open(href, "_blank", "noopener,noreferrer");
  }

  async function pay() {
    if (!gate || left <= 0) {
      setNote("This payment window expired. Start again.");
      return;
    }
    const ref = reference.trim();
    if (kind === "upi" && !/^\d{12}$/.test(ref)) {
      setNote("Enter the 12-digit UTR.");
      return;
    }
    const needsShot = kind === "jazzcash" || /jazz/i.test(gate.name);
    if (needsShot && (ref.length < 6 || !shot)) {
      setNote("Transaction id aur payment screenshot dono chahiye.");
      return;
    }
    if (kind === "crypto" && ref.length < 8) {
      setNote("Enter the transaction hash.");
      return;
    }
    if (kind === "other" && ref.length < 6) {
      setNote("Enter the transaction reference.");
      return;
    }
    setPending(true);
    setNote("");
    try {
      const result = await submitPaymentClaim({ data: { amountPaise: paise, displayMajor: amount, screenshot: shot, reference: ref, gatewayId: gate.id } });
      setNote(`${result.id} pending. The wallet increases after an admin approves this proof.`);
      setShot("");
      setReference("");
      setCheckout(false);
      load();
    } catch (err: unknown) {
      setNote(err instanceof Error ? err.message : "Could not send the payment.");
    } finally {
      setPending(false);
    }
  }

  const openUsdt = ledger.find((row) => row.gateway === "USDT" && row.status === "open");
  useEffect(() => {
    if (!openUsdt) return;
    const timer = window.setInterval(() => {
      checkWalletDeposit({ data: { id: openUsdt.id } }).then((result) => {
        if (result.status === "paid") {
          setBanner("USDT payment confirmed. Wallet credited.");
          load();
        }
      }).catch(() => undefined);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [openUsdt?.id]);

  function copyText(value: string) {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(value);
      window.setTimeout(() => setCopied(""), 1400);
    }).catch(() => setNote("Could not copy. Select the number and copy it."));
  }

  function pickSlot(next: SlotId) {
    setSlot(next);
    setCheckout(false);
    setCoin(0);
    setNote("");
  }

  const Icon = slot === "crypto" ? Bitcoin : slot === "talk" ? MessageCircle : slot === "jazzcash" ? QrCode : Zap;
  void moneyTick;
  const code = moneyCode();
  const razorGate = gateways.find((item) => item.pay_kind === "razorpay" || item.pay_kind === "upi");
  const jazzGate = gateways.find((item) => item.pay_kind === "jazzcash" || /jazz/i.test(item.name));
  const cryptoGate = gateways.find((item) => item.pay_kind === "crypto" || item.pay_kind === "usdt");
  const payGate = method === "jazzcash" ? jazzGate : method === "crypto" ? cryptoGate : razorGate;
  const limits = PAY_RULES[method];
  const quote = usdtQuote(code);
  const creditMajor = method === "crypto"
    ? (quote != null ? Math.round(amount * quote * 100) / 100 : null)
    : convertMajor(amount, limits.cur, code);
  const payCoins = (cryptoGate?.network || "").split("\n").map((line) => {
    const [network, address] = line.split("|").map((part) => part.trim());
    return address ? { network, address } : null;
  }).filter((row): row is { network: string; address: string } => Boolean(row));
  if (payCoins.length === 0 && cryptoGate?.account_number) payCoins.push({ network: "TRC20", address: cryptoGate.account_number });
  const picked = payCoins[Math.min(payNet, Math.max(payCoins.length - 1, 0))];

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-8">
      <section className="rounded-[28px] border bg-[#12182b]/80 p-4">
        <div className="flex items-center gap-4">
          <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-violet-500/15 text-violet-200">
            <Wallet className="size-7" />
          </span>
          <div>
            <p className="text-[12px] font-semibold tracking-[0.16em] text-violet-200">WALLET BALANCE</p>
            <p className="text-[34px] font-bold leading-tight">{inr(balance)}</p>
          </div>
        </div>
        <p className="mt-4 flex items-center gap-2 text-[13px] text-cyan-300">
          <span className="size-2 rounded-full bg-cyan-400" /> Updates in real-time
        </p>
      </section>

      <section className="rounded-[28px] border bg-[#12182b]/80 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[22px] font-bold">Add Balance</h2>
            <p className="text-[13px] text-[#a5b4fc]">Select payment method and specify deposit amount.</p>
          </div>
          <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[11px] font-bold text-emerald-300">0% Processing Fees</span>
        </div>
        {banner && <p className="mt-3 rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-[13px] text-cyan-100">{banner}</p>}

        {payOpen ? (
          <div className="mt-4">
            <button type="button" onClick={() => setPayOpen(false)} className="text-[13px] font-semibold text-cyan-300">Back</button>
            <p className="mt-3 text-[18px] font-bold">{method === "jazzcash" ? "JazzCash" : method === "crypto" ? "Crypto" : "UPI"} · {nativeText(limits.cur, amount)}</p>
            {!payGate && <p className="mt-3 text-[13px] text-amber-300">Payment details for this method are not saved yet. Turn the gateway on in Payments.</p>}
            {payGate && (
              <div className="mt-3 space-y-3 rounded-2xl border bg-black/20 p-3 text-[13px]">
                <p className="text-[12px] font-semibold tracking-wide text-[#a5b4fc]">PAYMENT INFORMATION</p>
                {payGate.account_title && <p className="text-[16px] font-semibold">{payGate.account_title}</p>}
                {method === "crypto" ? (
                  payCoins.length === 0 || !picked ? <p className="text-amber-200">No crypto address is saved yet.</p> : (
                    <div className="space-y-2">
                      <label className="block text-[12px] font-semibold">Network
                        <select value={Math.min(payNet, payCoins.length - 1)} onChange={(event) => setPayNet(Number(event.target.value))} className="mt-1 h-11 w-full rounded-xl border bg-[#0f172a] px-3 text-[14px] text-white">
                          {payCoins.map((row, index) => <option key={`${row.network}-${index}`} value={index}>{row.network}</option>)}
                        </select>
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 break-all">{picked.address}</span>
                        <button type="button" onClick={() => copyText(picked.address)} className="h-8 shrink-0 rounded-full border border-violet-400/40 px-3 text-[12px] font-semibold text-violet-200">{copied === picked.address ? "Copied" : "Copy"}</button>
                      </div>
                      <p className="text-[12px] text-[#c4b5fd]">Send the payment only on the {picked.network} network.</p>
                    </div>
                  )
                ) : payGate.account_number && (
                  <div className="flex items-center gap-2">
                    <span className="break-all">{method === "jazzcash" ? "JazzCash" : "UPI"} <b>{payGate.account_number}</b></span>
                    <button type="button" onClick={() => copyText(payGate.account_number)} className="h-8 shrink-0 rounded-full border border-violet-400/40 px-3 text-[12px] font-semibold text-violet-200">{copied === payGate.account_number ? "Copied" : "Copy"}</button>
                  </div>
                )}
                {method === "jazzcash" && payGate.ifsc && <p>IBAN <b>{payGate.ifsc}</b> <button type="button" onClick={() => copyText(payGate.ifsc)} className="ml-2 font-semibold text-cyan-300">{copied === payGate.ifsc ? "Copied" : "Copy"}</button></p>}
                {payGate.instructions && <p className="text-[#c4b5fd]">{payGate.instructions}</p>}
                {method === "crypto" && <p className="font-semibold text-cyan-200">Send {amount} USDT. 1 USDT = {quote != null ? formatMajor(quote) : "the rate shown"}. Send it only on the network shown.</p>}
                {payGate.qr_image ? <img src={payGate.qr_image} alt="Payment QR" className="mx-auto h-[280px] w-full max-w-[320px] rounded-2xl bg-white object-contain p-3" /> : <p className="text-[12px] text-amber-200">No QR is set. Use the account above.</p>}
              </div>
            )}
            <label className="mt-3 block text-[12px] font-semibold">Transaction ID
              <input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="UTR / JazzCash TID / TXID" className="mt-1 h-11 w-full rounded-xl border bg-black/20 px-3 text-[14px] outline-none" />
            </label>
            <label className="mt-3 flex h-11 cursor-pointer items-center justify-center rounded-xl border text-[13px] font-semibold">
              {shot ? "Screenshot ready" : "Upload payment screenshot"}
              <input type="file" accept="image/*" className="hidden" onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file || file.size > 8_000_000) return;
                const image = new Image();
                image.onload = () => {
                  const canvas = document.createElement("canvas");
                  const scale = Math.min(1, 900 / image.width);
                  canvas.width = Math.max(1, image.width * scale);
                  canvas.height = Math.max(1, image.height * scale);
                  canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
                  setShot(canvas.toDataURL("image/jpeg", 0.72));
                };
                image.src = URL.createObjectURL(file);
              }} />
            </label>
            <button type="button" disabled={pending || !payGate} onClick={async () => {
              if (!payGate) return;
              setPending(true);
              setBanner("");
              try {
                const result = await submitPaymentClaim({ data: { amountPaise: creditMajor != null ? toBaseMinor(creditMajor) : toBaseMinor(amount), displayMajor: creditMajor ?? amount, nativeMajor: amount, nativeCurrency: limits.cur, screenshot: shot, reference, gatewayId: payGate.id } });
                setBanner(`${result.id} pending. Admin approve karega to amount wallet mein add ho jayegi.`);
                setShot("");
                setReference("");
                setPayOpen(false);
                load();
              } catch (err: unknown) {
                setBanner(err instanceof Error ? err.message : "Could not submit the payment.");
              } finally { setPending(false); }
            }} className="mt-3 h-12 w-full rounded-2xl bg-gradient-to-r from-violet-600 to-cyan-500 text-[15px] font-semibold text-white disabled:opacity-60">{pending ? "Sending…" : "Submit for approval"}</button>
          </div>
        ) : (
          <>
            <p className="mt-4 text-[14px] font-semibold">1. Select Payment Method</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-3">
              {([
                ["razorpay", "UPI", "INDIA", ""],
                ["crypto", "Crypto", "GLOBAL", quote != null ? `1 USDT = ${formatMajor(quote)}` : "USDT"],
                ["jazzcash", "JazzCash", "PAKISTAN", "Account · IBAN · QR"],
              ] as const).map(([id, title, badge, sub]) => {
                const row = PAY_RULES[id];
                return (
                  <button key={id} type="button" onClick={() => { setMethod(id); setAmount(row.min); setPayOpen(false); }} className={`rounded-3xl border p-4 text-left shadow-sm ${method === id ? "btn-gradient border-transparent bg-gradient-to-br from-violet-600 to-cyan-500 text-white shadow-lg shadow-violet-500/25" : "border-white/10 bg-black/20"}`}>
                    <span className={`text-[10px] font-bold tracking-[0.16em] ${method === id ? "text-white/80" : "text-cyan-200"}`}>{badge}</span>
                    <b className="mt-1 block text-[18px]">{title}</b>
                    {sub ? <span className={`mt-1 block text-[12px] ${method === id ? "text-white/85" : "text-[#c4b5fd]"}`}>{sub}</span> : null}
                    <span className={`mt-2 inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${method === id ? "bg-white/15 text-white" : "bg-white/5 text-cyan-200"}`}>Min {nativeText(row.cur, row.min)} · Max {nativeText(row.cur, row.max)}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-4">
              <p className="text-[14px] font-semibold">2. Choose Deposit Amount</p>
              <p className="mt-1 text-[12px] font-semibold text-cyan-300">Min {nativeText(limits.cur, limits.min)} · Max {nativeText(limits.cur, limits.max)}</p>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {limits.chips.map((chip) => (
                <button key={chip} type="button" onClick={() => setAmount(chip)} className={`h-12 rounded-2xl text-[14px] font-bold ${amount === chip ? "btn-gradient bg-gradient-to-r from-violet-600 to-cyan-500 text-white shadow-md shadow-violet-500/30" : "border border-white/10 bg-black/20"}`}>{nativeText(limits.cur, chip)}</button>
              ))}
            </div>
            <p className="mt-3 text-[13px] font-semibold">Amount in {limits.cur}</p>
            <div className="mt-1 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4">
              <span className="text-[20px] font-bold text-[#c4b5fd]">{limits.cur === "USD" ? "$" : limits.cur === "INR" ? "₹" : "Rs"}</span>
              <input value={amount || ""} inputMode="decimal" onChange={(event) => setAmount(Number(event.target.value.replace(/[^\d.]/g, "")) || 0)} className="h-14 w-full bg-transparent text-[26px] font-bold outline-none" />
            </div>
            {method === "crypto" ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">Rate</p>
                  <p className="mt-1 text-[15px] font-bold">1 USDT = {quote != null ? formatMajor(quote) : "…"}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">Wallet credit</p>
                  <p className="mt-1 text-[15px] font-bold">{creditMajor != null ? formatMajor(creditMajor) : "…"}</p>
                </div>
              </div>
            ) : creditMajor != null && limits.cur !== code ? <p className="mt-2 text-[13px] font-semibold text-cyan-200">Wallet credit {formatMajor(creditMajor)}</p> : null}
            <button type="button" onClick={() => {
              setBanner("");
              if (amount < limits.min || amount > limits.max) {
                setBanner(`Amount ${nativeText(limits.cur, limits.min)} se ${nativeText(limits.cur, limits.max)} ke beech honi chahiye.`);
                return;
              }
              setPayOpen(true);
            }} className="btn-gradient mt-4 h-12 w-full rounded-2xl bg-gradient-to-r from-violet-600 to-cyan-500 text-[16px] font-semibold text-white">Pay {nativeText(limits.cur, amount)}</button>
            <p className="mt-2 text-center text-[12px] text-[#94a3b8]">After you pay, the next page asks for the transaction ID and screenshot.</p>
          </>
        )}
      </section>

      <section className="rounded-[28px] border bg-[#12182b]/80 p-4">
        <h2 className="text-[22px] font-bold">Wallet Analytics</h2>
        <p className="text-[13px] text-[#94a3b8]">Deposits & spending for the selected period</p>
        <div className="relative mt-3">
          <button type="button" onClick={() => setPeriodOpen((open) => !open)} className="inline-flex h-10 items-center gap-2 rounded-full border px-4 text-[13px] font-semibold">
            <Calendar className="size-4 text-violet-300" /> {periodLabel}
          </button>
          {periodOpen && (
            <div className="absolute z-20 mt-2 w-48 overflow-hidden rounded-2xl border bg-[#0f172a] py-1 shadow-2xl">
              {PERIODS.map((item) => (
                <button key={item.id} type="button" onClick={() => { setPeriod(item.id); setPeriodOpen(false); }} className={`block w-full px-4 py-2 text-left text-[14px] ${period === item.id ? "font-semibold text-cyan-300" : "text-white"}`}>
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {period === "custom" && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="h-10 rounded-xl border bg-black/20 px-3 text-[13px]" />
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="h-10 rounded-xl border bg-black/20 px-3 text-[13px]" />
          </div>
        )}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Stat label="TOTAL DEPOSIT" value={inr(deposits)} foot={periodLabel} icon={<ArrowUpRight className="size-4" />} tone="text-emerald-300" />
          <Stat label="TOTAL SPENT" value={inr(spent)} foot={periodLabel} icon={<ArrowDownRight className="size-4" />} tone="text-rose-300" />
          <Stat label="CURRENT BALANCE" value={inr(balance)} foot="Live · not filtered" icon={<Wallet className="size-4" />} tone="text-violet-200" />
          <Stat label="TRANSACTIONS" value={String(ranged.length)} foot={periodLabel} icon={<span className="text-[14px]">∿</span>} tone="text-cyan-200" />
        </div>
      </section>

      <section className="rounded-[28px] border bg-[#12182b]/80 p-4">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-[22px] font-bold">Transactions</h2>
          <span className="text-[12px] text-[#94a3b8]">Filtered by selected period</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {["All", "Deposit", "Order", "Refund"].map((item) => (
            <button key={item} type="button" onClick={() => setFilter(item)} className={`h-9 rounded-full px-4 text-[13px] font-semibold ${filter === item ? "bg-[#111827] text-white" : "bg-white/10 text-[#e2e8f0]"}`}>{item}</button>
          ))}
        </div>
        {claims.length > 0 && (
          <ul className="mt-3 space-y-2 text-[13px]">
            {claims.map((claim) => (
              <li key={claim.id} className="flex justify-between gap-2 rounded-2xl border px-3 py-3">
                <span className="truncate">{claim.id}</span>
                <span className="shrink-0">{(() => {
                  const face = Number(claim.pay_amount) || 0;
                  const cur = (claim.pay_currency || "").toUpperCase();
                  const name = claim.gateway_name || "";
                  const method = /jazz/i.test(name) ? "JazzCash" : /crypto|usdt/i.test(name) ? "Crypto" : /upi|razor/i.test(name) ? "UPI" : "";
                  const amount = face >= 1 && cur ? `${face % 1 === 0 ? face.toFixed(0) : face.toFixed(2)} ${cur}` : inr(claim.amount_paise);
                  return `${amount}${method ? ` · ${method}` : ""} · ${claim.status === "declined" ? "rejected" : claim.status}`;
                })()}</span>
              </li>
            ))}
          </ul>
        )}
        {shown.length === 0 ? (
          <div className="px-4 py-14 text-center">
            <span className="mx-auto grid size-16 place-items-center rounded-full bg-violet-500/15 text-violet-200">
              <Wallet className="size-7" />
            </span>
            <p className="mt-4 text-[18px] font-semibold">No wallet activity found</p>
            <p className="mt-1 text-[13px] text-[#94a3b8]">Nothing here for the selected date range.</p>
          </div>
        ) : (
          <ul className="mt-3 space-y-2 text-[13px]">
            {shown.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 rounded-2xl border px-3 py-3">
                <span>{row.note}</span>
                <span className={`shrink-0 font-semibold ${row.amount_paise < 0 ? "text-rose-300" : "text-emerald-300"}`}>{inr(row.amount_paise)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, foot, icon, tone }: { label: string; value: string; foot: string; icon: ReactNode; tone: string }) {
  return (
    <div className="rounded-2xl border bg-black/20 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold tracking-wide text-[#94a3b8]">{label}</p>
        <span className={`grid size-7 place-items-center rounded-full bg-white/10 ${tone}`}>{icon}</span>
      </div>
      <p className="mt-3 text-[20px] font-bold">{value}</p>
      <p className="mt-1 text-[12px] text-[#64748b]">{foot}</p>
    </div>
  );
}
