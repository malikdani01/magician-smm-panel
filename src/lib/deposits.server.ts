import { createHmac, randomBytes } from "node:crypto";
import { creditCustomer, publicGateways } from "@/lib/admin.server";
import { getSql } from "@/lib/db";

const USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

type Gate = {
  id: string;
  name: string;
  account_title: string;
  account_number: string;
  ifsc: string;
  instructions: string;
  min_paise: number;
  max_paise: number;
  pay_kind: string;
  pay_mode: string;
  pay_currency?: string;
  network: string;
};

export type DepositRow = {
  id: string;
  gateway: string;
  amount_paise: number;
  pay_amount: string;
  pay_currency: string;
  address: string;
  rate: number;
  reference: string;
  status: string;
  provider_ref: string;
  expires_at: string | null;
  created_at: string;
};

async function sql() {
  const db = await getSql();
  await db`
    create table if not exists wallet_deposits (
      id text primary key,
      user_id text not null,
      gateway text not null,
      amount_paise integer not null,
      pay_amount text not null default '',
      pay_currency text not null default 'INR',
      address text not null default '',
      rate numeric not null default 0,
      reference text not null default '',
      screenshot text not null default '',
      provider_ref text not null default '',
      status text not null default 'open',
      expires_at timestamptz,
      created_at timestamptz not null default now()
    )
  `;
  return db;
}

function depositId() {
  return `DEP${randomBytes(6).toString("hex").toUpperCase()}`;
}

function usdtAddress(gate: Gate) {
  const direct = gate.account_number.trim();
  if (/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(direct)) return direct;
  for (const line of (gate.network || "").split("\n")) {
    const parts = line.split("|").map((part) => part.trim());
    const address = parts[2] || parts[0] || "";
    if (/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)) return address;
  }
  return "";
}

function usdtRate(gate: Gate) {
  const fromIfsc = Number(gate.ifsc);
  if (fromIfsc >= 1 && fromIfsc <= 10000) return fromIfsc;
  const match = `${gate.instructions} ${gate.network}`.match(/(\d+(?:\.\d+)?)/);
  const parsed = Number(match?.[1]);
  if (parsed >= 1 && parsed <= 10000) return parsed;
  return 90;
}

async function gates() {
  return (await publicGateways()) as Gate[];
}

export async function depositConfig() {
  const rows = await gates();
  const razor = rows.find((row) => row.pay_kind === "razorpay" || row.account_number.startsWith("rzp_"));
  const usdt = rows.find((row) => row.pay_kind === "usdt") || rows.find((row) => row.pay_kind === "crypto" && usdtAddress(row));
  const rate = usdt ? usdtRate(usdt) : 90;
  return {
    razorpay: Boolean(razor?.account_number && razor.instructions.trim()),
    razorMin: razor && razor.pay_currency === "INR" ? razor.min_paise / 100 : 100,
    razorMax: razor ? razor.max_paise / 100 : 100000,
    usdtAddress: usdt ? usdtAddress(usdt) : "",
    usdtRate: rate,
    usdtMin: usdt?.pay_currency === "USD" ? Math.max(5, usdt.min_paise / 100) : 5,
    usdtMaxInr: usdt ? usdt.max_paise / 100 : 500000,
  };
}

export async function listDeposits(userId: string) {
  const db = await sql();
  await db`update wallet_deposits set status = 'expired' where user_id = ${userId} and status = 'open' and expires_at < now()`;
  return db<DepositRow>`
    select id, gateway, amount_paise, pay_amount, pay_currency, address, rate::float as rate, reference, status,
           provider_ref, expires_at::text as expires_at, created_at::text as created_at
    from wallet_deposits
    where user_id = ${userId}
    order by created_at desc
    limit 30
  `;
}

export async function openUsdt(userId: string, inr: number) {
  const config = await depositConfig();
  if (!config.usdtAddress) throw new Error("Admin ne TRC-20 wallet address save nahi kiya. Payments mein USDT gateway ka account number address hona chahiye.");
  const rupees = Math.round(inr);
  const minInr = Math.round(config.usdtMin * config.usdtRate);
  if (rupees < minInr) throw new Error(`Minimum deposit is $${config.usdtMin} (${minInr} INR).`);
  if (rupees > config.usdtMaxInr) throw new Error("Amount is above the gateway limit.");
  const db = await sql();
  const open = await db<{ id: string }>`select id from wallet_deposits where user_id = ${userId} and gateway = 'USDT' and status = 'open' limit 1`;
  if (open[0]) throw new Error("Pehle wala USDT deposit cancel karo, phir naya kholo.");
  const used = await db<{ pay_amount: string }>`select pay_amount from wallet_deposits where address = ${config.usdtAddress} and status = 'open'`;
  const taken = new Set(used.map((row) => row.pay_amount));
  const base = Math.round((rupees / config.usdtRate) * 100) / 100;
  let exact = base;
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const cents = 1 + Math.floor(Math.random() * 99);
    const next = Math.round((base + cents / 100) * 100) / 100;
    if (!taken.has(next.toFixed(2))) {
      exact = next;
      break;
    }
  }
  const credit = Math.round(exact * config.usdtRate * 100);
  const id = depositId();
  await db`
    insert into wallet_deposits (id, user_id, gateway, amount_paise, pay_amount, pay_currency, address, rate, status, expires_at)
    values (${id}, ${userId}, 'USDT', ${credit}, ${exact.toFixed(2)}, 'USDT', ${config.usdtAddress}, ${config.usdtRate}, 'open', now() + interval '3 hours')
  `;
  const rows = await listDeposits(userId);
  const row = rows.find((item) => item.id === id);
  if (!row) throw new Error("Deposit could not be opened.");
  return row;
}

export async function cancelDeposit(userId: string, id: string) {
  const db = await sql();
  const rows = await db<{ id: string }>`
    update wallet_deposits set status = 'cancelled'
    where id = ${id} and user_id = ${userId} and status = 'open'
    returning id
  `;
  if (!rows[0]) throw new Error("This deposit is already closed.");
  return { ok: true as const };
}

export async function attachShot(userId: string, id: string, screenshot: string) {
  if (!screenshot.startsWith("data:image/") || screenshot.length > 700000) throw new Error("Screenshot is too large.");
  const db = await sql();
  const rows = await db<{ id: string }>`
    update wallet_deposits set screenshot = ${screenshot.slice(0, 700000)}
    where id = ${id} and user_id = ${userId} and status = 'open'
    returning id
  `;
  if (!rows[0]) throw new Error("This deposit is already closed.");
  return { ok: true as const };
}

type TronTransfer = { transaction_id?: string; to?: string; value?: string; block_timestamp?: number; token_info?: { symbol?: string } };

async function tronTransfers(address: string) {
  const url = `https://api.trongrid.io/v1/accounts/${address}/transactions/trc20?only_to=true&limit=40&contract_address=${USDT_CONTRACT}`;
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error("TRON network check failed. Thodi der baad Check payment dabao.");
  const body = await response.json() as { data?: TronTransfer[] };
  return body.data || [];
}

export async function checkUsdt(userId: string, id: string, txid = "") {
  const db = await sql();
  const rows = await db<DepositRow & { user_id: string }>`
    select id, user_id, gateway, amount_paise, pay_amount, pay_currency, address, rate::float as rate, reference, status,
           provider_ref, expires_at::text as expires_at, created_at::text as created_at
    from wallet_deposits
    where id = ${id} and user_id = ${userId}
    limit 1
  `;
  const row = rows[0];
  if (!row) throw new Error("Deposit not found.");
  if (row.status === "paid") return { status: "paid" as const, credited: row.amount_paise };
  if (row.status !== "open") throw new Error("This deposit is closed.");
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    await db`update wallet_deposits set status = 'expired' where id = ${id} and status = 'open'`;
    throw new Error("This deposit expired. Naya amount choose karke dubara kholo.");
  }
  const transfers = await tronTransfers(row.address);
  const wanted = txid.trim();
  const expected = String(Math.round(Number(row.pay_amount) * 1_000_000));
  const opened = new Date(row.created_at).getTime() - 120000;
  const hit = transfers.find((tx) => {
    if ((tx.token_info?.symbol || "USDT") !== "USDT") return false;
    if (tx.to !== row.address) return false;
    if ((tx.block_timestamp || 0) < opened) return false;
    if (wanted) return tx.transaction_id === wanted;
    return tx.value === expected;
  });
  if (!hit?.transaction_id) {
    return { status: "waiting" as const, message: wanted ? "Ye TXID abhi is address pe nahi mila. Ek minute baad phir check karo." : "Payment abhi chain pe nahi dikha. Exact amount bhejo, phir Check payment dabao." };
  }
  const dup = await db<{ id: string }>`select id from wallet_deposits where reference = ${hit.transaction_id} and status = 'paid' limit 1`;
  if (dup[0]) throw new Error("Ye TXID pehle hi credit ho chuka hai.");
  const received = Number(hit.value || 0) / 1_000_000;
  const credit = wanted ? Math.round(received * Number(row.rate) * 100) : row.amount_paise;
  if (credit < 100) throw new Error("Received amount is too small.");
  const locked = await db<{ id: string }>`
    update wallet_deposits
    set status = 'paid', reference = ${hit.transaction_id}, amount_paise = ${credit}, pay_amount = ${received.toFixed(2)}
    where id = ${id} and status = 'open'
    returning id
  `;
  if (!locked[0]) return { status: "paid" as const, credited: credit };
  await creditCustomer(userId, credit, `USDT deposit ${id}`);
  return { status: "paid" as const, credited: credit };
}

export async function startRazorpay(userId: string, inr: number) {
  const rows = await gates();
  const gate = rows.find((row) => row.pay_kind === "razorpay" || row.account_number.startsWith("rzp_"));
  const key = gate?.account_number.trim() || "";
  const secret = gate?.instructions.trim() || "";
  if (!key.startsWith("rzp_") || secret.length < 8) throw new Error("Admin ne Razorpay Key ID aur Key Secret save nahi kiye. Payments mein account number = Key ID, instructions = Key Secret.");
  const rupees = Math.round(inr);
  const min = Math.max(200, (gate?.min_paise || 20000) / 100);
  const max = (gate?.max_paise || 10000000) / 100;
  if (rupees < min || rupees > max) throw new Error(`Amount must be between ₹${min} and ₹${max}.`);
  const paise = rupees * 100;
  const id = depositId();
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ amount: paise, currency: "INR", receipt: id, notes: { userId } }),
  });
  const order = await response.json() as { id?: string; error?: { description?: string } };
  if (!response.ok || !order.id) throw new Error(order.error?.description || "Razorpay order could not be created.");
  const db = await sql();
  await db`
    insert into wallet_deposits (id, user_id, gateway, amount_paise, pay_amount, pay_currency, provider_ref, status, expires_at)
    values (${id}, ${userId}, 'Razorpay', ${paise}, ${rupees.toFixed(2)}, 'INR', ${order.id}, 'open', now() + interval '30 minutes')
  `;
  return { id, key, orderId: order.id, amount: paise, currency: "INR" };
}

export async function confirmRazorpay(userId: string, id: string, orderId: string, paymentId: string, signature: string) {
  const rows = await gates();
  const gate = rows.find((row) => row.pay_kind === "razorpay" || row.account_number.startsWith("rzp_"));
  const secret = gate?.instructions.trim() || "";
  const expected = createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  if (expected !== signature) throw new Error("Razorpay signature did not match.");
  const db = await sql();
  const locked = await db<{ amount_paise: number }>`
    update wallet_deposits
    set status = 'paid', reference = ${paymentId.slice(0, 80)}
    where id = ${id} and user_id = ${userId} and provider_ref = ${orderId} and status = 'open'
    returning amount_paise
  `;
  const row = locked[0];
  if (!row) return { status: "paid" as const };
  await creditCustomer(userId, row.amount_paise, `Razorpay ${id}`);
  return { status: "paid" as const, credited: row.amount_paise };
}
