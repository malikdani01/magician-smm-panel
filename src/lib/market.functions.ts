import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { deskRole } from "@/lib/admin.server";
import {
  addDealMessage,
  adminListings,
  CONTENTS,
  createDeal,
  dealMessages,
  dealsForAdmin,
  dealsForUser,
  newCode,
  oneListing,
  previewAsset,
  publicListings,
  saveListing,
  saveShots,
  setDeal,
  TOPICS,
  type ListingInput,
} from "@/lib/market.server";

export const marketTopics = createServerFn({ method: "GET" }).handler(async () => ({ topics: TOPICS, contents: CONTENTS, code: newCode() }));

export const previewMarketLink = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((url: string) => String(url || "").slice(0, 500))
  .handler(async ({ data, context }) => {
    if ((await deskRole(context.userId)) !== "admin") throw new Error("Admin only.");
    return previewAsset(data);
  });

export const uploadMarketShots = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((files: { body: string; name: string }[]) => (Array.isArray(files) ? files : []).slice(0, 24))
  .handler(async ({ data, context }) => {
    if ((await deskRole(context.userId)) !== "admin") throw new Error("Admin only.");
    return saveShots(data);
  });

export const publishListing = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: ListingInput) => input)
  .handler(async ({ data, context }) => saveListing(context.userId, data));

export const mySaleListings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => adminListings(context.userId));

export const saleListing = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => String(id || ""))
  .handler(async ({ data, context }) => {
    const admin = (await deskRole(context.userId)) === "admin";
    const row = await oneListing(data, admin);
    if (!row || admin) return row;
    return { ...row, verify_code: "", owner_id: "" };
  });

export const accountsForSale = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => publicListings());

export const openDeal = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((listingId: string) => String(listingId || ""))
  .handler(async ({ data, context }) => createDeal(context.userId, data));

export const adminDeals = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => dealsForAdmin(context.userId));

export const myDeals = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => dealsForUser(context.userId));

export const dealAction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; action: "accept" | "decline" | "confirm" }) => input)
  .handler(async ({ data, context }) => setDeal(context.userId, data.id, data.action));

export const readDealChat = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => String(id || ""))
  .handler(async ({ data, context }) => {
    const admin = (await deskRole(context.userId)) === "admin";
    return dealMessages(context.userId, data, admin);
  });

export const sendDealChat = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { dealId: string; kind: string; body: string; fileName: string; asAdmin: boolean }) => input)
  .handler(async ({ data, context }) => {
    const admin = (await deskRole(context.userId)) === "admin";
    await addDealMessage({
      userId: context.userId,
      dealId: data.dealId,
      sender: data.asAdmin && admin ? "admin" : "user",
      kind: data.kind,
      body: data.body,
      fileName: data.fileName,
    });
  });
