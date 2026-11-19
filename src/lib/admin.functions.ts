import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import {
  addCustomService,
  adminGateways,
  creditCustomer,
  deskRole,
  displayMajorToMinor,
  listBindings,
  listClaims,
  listCustomers,
  toggleCustomerAccess,
  authOpen,
  setAuthOpen,
  listManaged,
  setServiceListed,
  myClaims,
  paymentDesk,
  publicGateways,
  removeCustomer,
  requireAdmin,
  reviewClaim,
  saveBindings,
  saveServiceActiveLimit,
  serviceActiveLimit,
  saveGateway,
  saveManaged,
  savePaymentDesk,
  saveProvider,
  deleteProvider,
  listProviders,
  syncProviderCatalog,
  submitClaim,
  syncManagedServices,
  type Binding,
} from "@/lib/admin.server";

export const getDeskRole = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => deskRole(context.userId));

export const adminBindings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    return listBindings();
  });

export const adminSaveBindings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: Binding[]) => {
    if (!Array.isArray(input)) throw new Error("Missing configuration.");
    return input.slice(0, 20).map((row) => ({
      slot: String(row.slot || ""),
      api_url: String(row.api_url || ""),
      api_key: String(row.api_key || ""),
      service_id: "",
      pick_mode: row.pick_mode === "ids" ? "ids" : "auto",
      pinned_ids: Array.isArray(row.pinned_ids) ? row.pinned_ids.map((item) => String(item || "")).slice(0, 12) : [],
      min_quantity: Math.max(1, Math.floor(Number(row.min_quantity) || 1)),
      price_per_1k_paise: Math.max(0, Math.round(Number(row.price_per_1k_paise) || 0)),
      rate_min_units: Math.max(0, Math.round(Number(row.rate_min_units) || 0)),
      rate_max_units: Math.max(0, Math.round(Number(row.rate_max_units) || 0)),
      section_enabled: row.section_enabled !== false,
      providers: (Array.isArray(row.providers) ? row.providers : [])
        .slice(0, 8)
        .map((item) => ({
          api_url: String(item?.api_url || ""),
          api_key: String(item?.api_key || ""),
        }))
        .filter((item) => item.api_key.trim()),
    }));
  })
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    await saveBindings(data);
    return { ok: true as const };
  });

export const adminServiceLimit = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    return { limit: await serviceActiveLimit() };
  });

export const adminSaveServiceLimit = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { limit: number }) => ({ limit: Math.max(1, Math.min(20, Math.floor(Number(input?.limit) || 1))) }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    return { limit: await saveServiceActiveLimit(data.limit) };
  });

export const adminProviders = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    return listProviders();
  });

export const adminSingleBalances = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const { listSingleOrderBalances } = await import("@/lib/providers.server");
    return listSingleOrderBalances();
  });

export const adminSaveProvider = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id?: string; name: string; api_url: string; api_key: string; enabled: boolean }) => input)
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const id = await saveProvider(data);
    return { id };
  });

export const adminDeleteProvider = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => {
    if (!id) throw new Error("Missing provider.");
    return String(id);
  })
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    await deleteProvider(data);
    return { ok: true as const };
  });

export const adminFetchProvider = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => {
    if (!id) throw new Error("Missing provider.");
    return String(id);
  })
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    return syncProviderCatalog(data);
  });

export const adminServices = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((query: string) => String(query || "").slice(0, 80))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    return listManaged(data);
  });

export const adminSetServiceListed = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; listed: boolean }) => ({
    id: String(input?.id || "").trim(),
    listed: Boolean(input?.listed),
  }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    if (!data.id) throw new Error("Missing service.");
    await setServiceListed(data.id, data.listed);
    return { ok: true as const };
  });

export const adminSyncServices = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    return syncManagedServices();
  });

export const adminSaveService = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: {
    id: string;
    provider_service_id: string;
    platform: string;
    category: string;
    name: string;
    description: string;
    price_per_1k_paise: number;
    min_quantity: number;
    max_quantity: number;
    drip_allowed: boolean;
    enabled: boolean;
  }) => input)
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    await saveManaged(data);
    return { ok: true as const };
  });

export const adminAddService = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: {
    provider_service_id: string;
    platform: string;
    category: string;
    name: string;
    description: string;
    price_per_1k_paise: number;
    min_quantity: number;
    max_quantity: number;
    drip_allowed: boolean;
    enabled: boolean;
  }) => {
    if (!input?.name?.trim() || !input?.provider_service_id?.trim()) throw new Error("Service id and name are required.");
    return input;
  })
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const id = await addCustomService(data);
    return { id };
  });

export const adminCustomers = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    return listCustomers();
  });

export const adminCredit = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { userId: string; amount?: number; rupees?: number; currency?: string }) => {
    const amount = Math.floor(Number(input?.amount ?? input?.rupees));
    const currency = String(input?.currency || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 8);
    if (!input?.userId || !Number.isFinite(amount) || amount < 1 || amount > 10_000_000) throw new Error("Enter a credit between 1 and 10,000,000.");
    return { userId: String(input.userId), amount, currency };
  })
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const minor = await displayMajorToMinor(data.amount, data.currency);
    const code = data.currency || "selected currency";
    await creditCustomer(data.userId, minor, `Admin credit ${data.amount} ${code}.`);
    return { ok: true as const };
  });

export const publicAuthGate = createServerFn({ method: "GET" }).handler(async () => {
  return { open: await authOpen() };
});

export const adminAuthGate = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    return { open: await authOpen() };
  });

export const adminSetAuthGate = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((open: boolean) => Boolean(open))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    return setAuthOpen(data);
  });

export const adminSetCustomerAccess = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { userId?: string; kind?: string }) => {
    const userId = String(input?.userId || "");
    const kind = input?.kind === "blocked" ? "blocked" : input?.kind === "suspended" ? "suspended" : "";
    if (!userId || !kind) throw new Error("Missing customer.");
    return { userId, kind: kind as "suspended" | "blocked" };
  })
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    return toggleCustomerAccess(context.userId, data.userId, data.kind);
  });

export const adminDeleteCustomer = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((userId: string) => {
    if (!userId) throw new Error("Missing customer.");
    return String(userId);
  })
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    await removeCustomer(context.userId, data);
    return { ok: true as const };
  });

export const getPaymentDesk = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    const desk = await paymentDesk();
    return { upi_id: desk.upi_id, note: desk.note, qr_image: desk.qr_image };
  });

export const listPaymentGateways = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => publicGateways());

export const submitPaymentClaim = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { amountPaise: number; screenshot: string; reference: string; gatewayId: string; displayMajor?: number; nativeMajor?: number; nativeCurrency?: string }) => {
    const amountPaise = Math.floor(Number(input?.amountPaise));
    const displayMajor = Math.round((Number(input?.displayMajor) || 0) * 100) / 100;
    const nativeMajor = Math.round((Number(input?.nativeMajor) || 0) * 100) / 100;
    const nativeCurrency = String(input?.nativeCurrency || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 8);
    const screenshot = String(input?.screenshot || "");
    if (nativeMajor < 1 && displayMajor < 1 && amountPaise < 100) throw new Error("Enter a valid amount.");
    if (screenshot && (!screenshot.startsWith("data:image/") || screenshot.length > 700000)) throw new Error("Screenshot is too large.");
    if (!input?.gatewayId) throw new Error("Choose a payment method.");
    return { amountPaise: Math.max(0, amountPaise), screenshot, reference: String(input?.reference || "").slice(0, 80), gatewayId: String(input.gatewayId), displayMajor, nativeMajor, nativeCurrency };
  })
  .handler(async ({ context, data }) => {
    const id = await submitClaim(context.userId, data.amountPaise, data.screenshot, data.reference, data.gatewayId, data.displayMajor, data.nativeMajor, data.nativeCurrency);
    return { id };
  });

export const myPaymentClaims = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => myClaims(context.userId));

export const adminSaveQr = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { qr_image: string; upi_id: string; note: string }) => input)
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    await savePaymentDesk(data);
    return { ok: true as const };
  });

export const adminPaymentClaims = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const [desk, claims, gateways] = await Promise.all([paymentDesk(), listClaims(), adminGateways()]);
    return { desk, claims, gateways };
  });

export const adminSaveGateway = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: {
    id: string;
    name: string;
    account_title: string;
    account_number: string;
    ifsc: string;
    instructions: string;
    qr_image: string;
    min_rupees: number;
    max_rupees: number;
    enabled: boolean;
    archived: boolean;
    pay_mode?: string;
    pay_currency?: string;
    network?: string;
    pay_kind?: string;
  }) => input)
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    if (!data.name?.trim()) throw new Error("Gateway name is required.");
    const id = await saveGateway({
      id: data.id || crypto.randomUUID(),
      name: data.name.trim(),
      account_title: data.account_title || "",
      account_number: data.account_number || "",
      ifsc: data.ifsc || "",
      instructions: data.instructions || "",
      qr_image: data.qr_image || "",
      min_paise: Math.max(100, Math.floor(Number(data.min_rupees) || 100) * 100),
      max_paise: Math.max(100, Math.floor(Number(data.max_rupees) || 100000) * 100),
      enabled: Boolean(data.enabled),
      sort_order: 0,
      archived: Boolean(data.archived),
      pay_mode: data.pay_mode === "auto" ? "auto" : "manual",
      pay_currency: String(data.pay_currency || "INR"),
      network: String(data.network || ""),
      pay_kind: String(data.pay_kind || "other"),
    });
    return { id };
  });

export const adminReviewPayment = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; approve: boolean; reason?: string }) => ({
    id: String(input?.id || ""),
    approve: Boolean(input?.approve),
    reason: String(input?.reason || "").slice(0, 180),
  }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    await reviewClaim(data.id, data.approve, data.reason);
    return { ok: true as const };
  });
