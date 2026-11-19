import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { attachShot, cancelDeposit, checkUsdt, confirmRazorpay, depositConfig, listDeposits, openUsdt, startRazorpay } from "@/lib/deposits.server";

export const getDepositDesk = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => ({ config: await depositConfig(), deposits: await listDeposits(context.userId) }));

export const openUsdtDeposit = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { inr: number }) => {
    const inr = Math.round(Number(input?.inr));
    if (!Number.isFinite(inr) || inr < 1) throw new Error("Enter a valid amount.");
    return { inr };
  })
  .handler(async ({ context, data }) => openUsdt(context.userId, data.inr));

export const cancelWalletDeposit = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => {
    if (!input?.id) throw new Error("Missing deposit.");
    return { id: String(input.id) };
  })
  .handler(async ({ context, data }) => cancelDeposit(context.userId, data.id));

export const checkWalletDeposit = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; txid?: string }) => ({ id: String(input?.id || ""), txid: String(input?.txid || "").trim() }))
  .handler(async ({ context, data }) => {
    if (!data.id) throw new Error("Missing deposit.");
    return checkUsdt(context.userId, data.id, data.txid);
  });

export const saveDepositShot = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; screenshot: string }) => {
    if (!input?.id) throw new Error("Missing deposit.");
    return { id: String(input.id), screenshot: String(input.screenshot || "") };
  })
  .handler(async ({ context, data }) => attachShot(context.userId, data.id, data.screenshot));

export const startRazorpayDeposit = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { inr: number }) => {
    const inr = Math.round(Number(input?.inr));
    if (!Number.isFinite(inr) || inr < 1) throw new Error("Enter a valid amount.");
    return { inr };
  })
  .handler(async ({ context, data }) => startRazorpay(context.userId, data.inr));

export const confirmRazorpayDeposit = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; orderId: string; paymentId: string; signature: string }) => ({
    id: String(input?.id || ""),
    orderId: String(input?.orderId || ""),
    paymentId: String(input?.paymentId || ""),
    signature: String(input?.signature || ""),
  }))
  .handler(async ({ context, data }) => confirmRazorpay(context.userId, data.id, data.orderId, data.paymentId, data.signature));
