import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { requireAdmin } from "@/lib/admin.server";
import {
  bulkPlatforms,
  buyTarget,
  createGuide,
  freshIndexKey,
  guideBySlug,
  loadSeo,
  pageByPath,
  probeSite,
  publicHead,
  publicHub,
  removePage,
  resolveRedirect,
  robotsText,
  runAudit,
  savePage,
  saveSeo,
  seoDesk,
  sitemapText,
  submitPublicUrls,
  type SeoSettings,
} from "@/lib/seo.server";

export const publicSeoHead = createServerFn({ method: "GET" }).handler(async () => publicHead());

export const publicSeoMeta = createServerFn({ method: "GET" }).handler(async () => {
  const seo = await loadSeo();
  const { indexNowKey: _key, ...safe } = seo;
  return safe;
});

export const publicHubData = createServerFn({ method: "GET" }).handler(async () => publicHub());

export const adminSeo = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    return seoDesk();
  });

export const adminSaveSeo = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: Partial<SeoSettings>) => input)
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    await saveSeo(data);
    return seoDesk();
  });

export const adminSaveSeoPage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: {
    slug: string;
    title: string;
    description: string;
    h1: string;
    body: string;
    published: boolean;
    noindex: boolean;
    canonical?: string;
    image?: string;
    faqs?: string;
    category?: string;
    tags?: string;
    author?: string;
    publishedAt?: string;
    newSlug?: string;
  }) => input)
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    await savePage(data);
    return seoDesk();
  });

export const adminCreateGuide = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { title: string; body: string }) => ({
    title: String(input?.title || ""),
    body: String(input?.body || ""),
  }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    await createGuide(data);
    return seoDesk();
  });

export const adminDeleteGuide = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { slug: string }) => ({ slug: String(input?.slug || "") }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    await removePage(data.slug);
    return seoDesk();
  });

export const adminBulkSeo = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { mode: "publish" | "hide" | "index" | "noindex" }) => input)
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    await bulkPlatforms(data.mode);
    return seoDesk();
  });

export const adminNewIndexKey = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const seo = await loadSeo();
    await saveSeo({ ...seo, indexNowKey: freshIndexKey() });
    return seoDesk();
  });

export const adminSubmitIndexNow = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { urls?: string }) => ({ urls: String(input?.urls || "") }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const extra = data.urls.split(/\s+/).filter(Boolean);
    const result = await submitPublicUrls(extra);
    const desk = await seoDesk();
    return { ...desk, indexNow: result };
  });

export const adminProbeSite = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { origin?: string }) => ({ origin: String(input?.origin || "") }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const probe = await probeSite(data.origin);
    const desk = await seoDesk();
    return { ...desk, probe };
  });

export const adminRunAudit = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { origin?: string }) => ({ origin: String(input?.origin || "") }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    return runAudit(data.origin);
  });

export const adminMarkSitemap = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { origin?: string }) => ({ origin: String(input?.origin || "") }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const seo = await loadSeo();
    const xml = await sitemapText(data.origin || seo.mainUrl || "");
    const robots = robotsText(data.origin || seo.mainUrl || "", seo);
    let indexNow: { ok: boolean; detail: string } | null = null;
    if (seo.flags.indexNow) indexNow = await submitPublicUrls();
    const desk = await seoDesk();
    return {
      ...desk,
      made: {
        ok: xml.includes("<urlset") && robots.includes("User-agent"),
        detail: indexNow
          ? `robots.txt and sitemap.xml are live. ${indexNow.detail}`
          : "robots.txt and sitemap.xml are live. IndexNow was not submitted because that option is off.",
        indexNow,
      },
    };
  });

export const publicPlatform = createServerFn({ method: "GET" })
  .validator((input: { platform: string; kind?: string }) => ({
    platform: String(input?.platform || "").toLowerCase(),
    kind: input?.kind ? String(input.kind).toLowerCase() : "",
  }))
  .handler(async ({ data }) => pageByPath(data.platform, data.kind || undefined));

export const publicGuide = createServerFn({ method: "GET" })
  .validator((input: { slug: string }) => ({ slug: String(input?.slug || "").toLowerCase() }))
  .handler(async ({ data }) => guideBySlug(data.slug));

export const publicRedirect = createServerFn({ method: "GET" })
  .validator((input: { path: string }) => ({ path: String(input?.path || "") }))
  .handler(async ({ data }) => ({ to: await resolveRedirect(data.path) }));

export const publicBuy = createServerFn({ method: "GET" })
  .validator((input: { slug: string }) => ({ slug: String(input?.slug || "") }))
  .handler(async ({ data }) => {
    const target = buyTarget(data.slug);
    if (!target) return null;
    return pageByPath(target.platform, target.kind);
  });

export const publicRobots = createServerFn({ method: "GET" })
  .validator((input: { origin: string }) => ({ origin: String(input?.origin || "") }))
  .handler(async ({ data }) => {
    const seo = await loadSeo();
    return robotsText(data.origin, seo);
  });

export const publicSitemap = createServerFn({ method: "GET" })
  .validator((input: { origin: string }) => ({ origin: String(input?.origin || "") }))
  .handler(async ({ data }) => sitemapText(data.origin));

export const publicIndexKey = createServerFn({ method: "GET" })
  .validator((input: { key: string }) => ({ key: String(input?.key || "") }))
  .handler(async ({ data }) => {
    const seo = await loadSeo();
    return seo.indexNowKey && seo.indexNowKey === data.key ? seo.indexNowKey : "";
  });
