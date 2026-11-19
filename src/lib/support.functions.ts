import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { deskRole, requireAdmin } from "@/lib/admin.server";
import { addMessage, adminFace, createTicket, markTicketRead, requireLocked, setTicketStatus, ticketMessages, ticketsForAdmin, ticketsForUser } from "@/lib/support.server";

async function accountOf(userId: string) {
  const sql = await getSql();
  const rows = await sql<{ email: string; name: string }>`select email, name from "user" where id = ${userId} limit 1`;
  return { email: rows[0]?.email || "", name: rows[0]?.name || "" };
}

export const raiseTicket = createServerFn({ method: "POST" })
  .validator((input: { email?: string; name?: string; subject?: string; body?: string }) => ({
    email: String(input?.email || "").trim().toLowerCase().slice(0, 160),
    name: String(input?.name || "").trim().slice(0, 80),
    subject: String(input?.subject || "Account complaint").trim().slice(0, 120),
    body: String(input?.body || "").trim().slice(0, 2000),
  }))
  .handler(async ({ data }) => {
    await requireLocked(data.email);
    return createTicket({ userId: "", email: data.email, name: data.name || "Member", subject: data.subject, body: data.body });
  });

export const lockedDesk = createServerFn({ method: "POST" })
  .validator((email: string) => String(email || "").trim().toLowerCase().slice(0, 160))
  .handler(async ({ data }) => {
    const lock = await requireLocked(data);
    const tickets = await ticketsForUser("", data);
    const face = await adminFace();
    return { lock, tickets, face };
  });

export const lockedMessages = createServerFn({ method: "POST" })
  .validator((input: { email?: string; ticketId?: string }) => ({
    email: String(input?.email || "").trim().toLowerCase().slice(0, 160),
    ticketId: String(input?.ticketId || ""),
  }))
  .handler(async ({ data }) => {
    await requireLocked(data.email);
    const mine = await ticketsForUser("", data.email);
    if (!mine.some((row) => row.id === data.ticketId)) throw new Error("Ticket not found.");
    return ticketMessages(data.ticketId);
  });

export const lockedSend = createServerFn({ method: "POST" })
  .validator((input: { email?: string; ticketId?: string; kind?: string; body?: string; fileName?: string }) => ({
    email: String(input?.email || "").trim().toLowerCase().slice(0, 160),
    ticketId: String(input?.ticketId || ""),
    kind: String(input?.kind || "text"),
    body: String(input?.body || ""),
    fileName: String(input?.fileName || ""),
  }))
  .handler(async ({ data }) => {
    await requireLocked(data.email);
    return addMessage({ ticketId: data.ticketId, sender: "user", kind: data.kind, body: data.body, fileName: data.fileName, email: data.email });
  });

export const supportFace = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => adminFace());

export const myTickets = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const account = await accountOf(context.userId);
    return ticketsForUser(context.userId, account.email);
  });

export const openMyTicket = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { subject?: string; body?: string }) => ({
    subject: String(input?.subject || "").trim().slice(0, 120),
    body: String(input?.body || "").trim().slice(0, 2000),
  }))
  .handler(async ({ context, data }) => {
    const account = await accountOf(context.userId);
    return createTicket({ userId: context.userId, email: account.email, name: account.name, subject: data.subject, body: data.body });
  });

export const myTicketMessages = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => String(id || ""))
  .handler(async ({ context, data }) => {
    const account = await accountOf(context.userId);
    const mine = await ticketsForUser(context.userId, account.email);
    if (!mine.some((row) => row.id === data) && (await deskRole(context.userId)) !== "admin") throw new Error("Ticket not found.");
    if ((await deskRole(context.userId)) === "admin") await markTicketRead(data);
    return ticketMessages(data);
  });

export const sendTicketMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { ticketId?: string; kind?: string; body?: string; fileName?: string }) => ({
    ticketId: String(input?.ticketId || ""),
    kind: String(input?.kind || "text"),
    body: String(input?.body || ""),
    fileName: String(input?.fileName || ""),
  }))
  .handler(async ({ context, data }) => {
    const admin = (await deskRole(context.userId)) === "admin";
    const account = await accountOf(context.userId);
    return addMessage({
      ticketId: data.ticketId,
      sender: admin ? "admin" : "user",
      kind: data.kind,
      body: data.body,
      fileName: data.fileName,
      userId: context.userId,
      email: account.email,
    });
  });

export const adminTickets = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    return ticketsForAdmin();
  });

export const adminTicketAction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id?: string; status?: string }) => {
    const status = input?.status === "closed" ? "closed" : input?.status === "open" ? "open" : "";
    if (!input?.id || !status) throw new Error("Missing ticket.");
    return { id: String(input.id), status: status as "open" | "closed" };
  })
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    return setTicketStatus(data.id, data.status);
  });
