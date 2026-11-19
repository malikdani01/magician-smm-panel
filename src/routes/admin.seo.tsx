import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Authed, StaffOnly } from "@/components/gate";
import { inputClass } from "@/components/shell";
import {
  adminBulkSeo,
  adminCreateGuide,
  adminDeleteGuide,
  adminMarkSitemap,
  adminNewIndexKey,
  adminProbeSite,
  adminRunAudit,
  adminSaveSeo,
  adminSaveSeoPage,
  adminSeo,
  adminSubmitIndexNow,
} from "@/lib/seo.functions";

export const Route = createFileRoute("/admin/seo")({
  component: () => (
    <Authed>
      <StaffOnly>
        <SeoDesk />
      </StaffOnly>
    </Authed>
  ),
});

type Desk = Awaited<ReturnType<typeof adminSeo>>;
type Seo = Desk["seo"];
type Page = Desk["pages"][number];

const empty: Seo = {
  panelName: "Magician SMM",
  country: "",
  mainUrl: "",
  title: "",
  description: "",
  h1: "",
  homeText: "",
  keywords: "",
  extraKeywords: "",
  googleCode: "",
  bingCode: "",
  shareImage: "",
  twitterImage: "",
  ogTitle: "",
  ogDescription: "",
  gaId: "",
  gtmId: "",
  indexNowKey: "",
  robotsOverride: "",
  links: { instagram: "", youtube: "", telegram: "", whatsapp: "", facebook: "", twitter: "" },
  flags: {
    seoTags: true,
    platformPages: true,
    footerLinks: true,
    hidePrivate: true,
    homeHeading: true,
    guides: true,
    indexNow: false,
    hostCompression: false,
    homeIndex: true,
  },
};

function previewCopy(form: Seo) {
  const place = form.country ? ` in ${form.country}` : "";
  const title = form.title || `${form.panelName || "SMM"} - SMM Panel${place} | Instagram, YouTube, TikTok`;
  const description = form.description || `${form.panelName || "This panel"} is an SMM panel${place}. Live prices per 1,000. Orders start from a public link.`;
  return { title, description, h1: form.h1 || `${form.panelName || "SMM"} - SMM Panel${place}` };
}

function SeoDesk() {
  const [desk, setDesk] = useState<Desk | null>(null);
  const [form, setForm] = useState<Seo>(empty);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [pageSlug, setPageSlug] = useState("");
  const [draft, setDraft] = useState<Page | null>(null);
  const [guideTitle, setGuideTitle] = useState("");
  const [guideBody, setGuideBody] = useState("");
  const [extraUrls, setExtraUrls] = useState("");
  const sourceSlug = useRef("");

  function apply(next: Desk) {
    setDesk(next);
    setForm(next.seo);
    setDraft((current) => {
      const found = next.pages.find((page) => page.slug === current?.slug) || next.pages.find((page) => page.slug === sourceSlug.current) || next.pages[0] || null;
      if (found) sourceSlug.current = found.slug;
      return found;
    });
  }

  useEffect(() => {
    adminSeo().then(apply).catch((err: unknown) => setNote(err instanceof Error ? err.message : "Could not load SEO."));
  }, []);

  const copy = useMemo(() => previewCopy(form), [form]);
  const host = form.mainUrl ? form.mainUrl.replace(/^https?:\/\//, "") : "your-domain";

  async function run(task: () => Promise<Desk | (Desk & { made?: { detail: string } })>, ok: string) {
    setBusy(true);
    setNote("");
    try {
      const next = await task();
      apply(next);
      setNote(("made" in next && next.made?.detail) || ok);
    } catch (err: unknown) {
      setNote(err instanceof Error ? err.message : "That action failed.");
    } finally {
      setBusy(false);
    }
  }

  function patch<K extends keyof Seo>(key: K, value: Seo[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function patchFlag(key: keyof Seo["flags"], value: boolean) {
    setForm((current) => ({ ...current, flags: { ...current.flags, [key]: value } }));
  }

  function patchLink(key: keyof Seo["links"], value: string) {
    setForm((current) => ({ ...current, links: { ...current.links, [key]: value } }));
  }

  const checks = desk?.checks || [];
  const score = desk?.score || 0;

  return (
    <div className="seo-desk mx-auto max-w-5xl space-y-4">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#2563eb]">Admin</p>
        <h1 className="text-[28px] font-bold text-[#0f172a]">SEO</h1>
        <p className="text-[13px] text-[#64748b]">Real checks only. Nothing here invents Google clicks, impressions, or a ranking.</p>
      </header>

      {note && <p className="rounded-2xl border border-[#dbeafe] bg-white px-4 py-3 text-[13px] text-[#0f172a]">{note}</p>}

      <section className="rounded-[24px] border border-[#dbeafe] bg-white p-4 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[160px_1fr]">
          <ScoreRing score={score} />
          <div className="grid gap-2 sm:grid-cols-2">
            {checks.map((item) => (
              <p key={item.id} className="text-[13px] leading-5 text-[#334155]">
                <Dot level={item.level} /> <b>{item.label}</b>
                <span className="mt-0.5 block text-[12px] text-[#64748b]">{item.detail}</span>
              </p>
            ))}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => run(() => adminMarkSitemap({ data: { origin: window.location.origin } }), "Sitemap refreshed.")} className="h-10 rounded-full bg-[#7c3aed] px-4 text-[13px] font-semibold text-white disabled:opacity-50">Make robots.txt + sitemap.xml</button>
          <button type="button" disabled={busy} onClick={() => run(() => adminProbeSite({ data: { origin: window.location.origin } }), "Site test finished.")} className="h-10 rounded-full border border-[#cbd5e1] bg-white px-4 text-[13px] font-semibold text-[#0f172a] disabled:opacity-50">Test my site</button>
          <button type="button" disabled={busy} onClick={() => run(() => adminRunAudit({ data: { origin: window.location.origin } }), "Audit saved.")} className="h-10 rounded-full border border-[#cbd5e1] bg-white px-4 text-[13px] font-semibold disabled:opacity-50">Run SEO audit</button>
        </div>
        {desk?.probe && (
          <div className="mt-3 rounded-xl bg-[#f8fafc] p-3 text-[12px] text-[#475569]">
            <p>{desk.probe.detail}</p>
            <ul className="mt-2 space-y-1">
              {desk.probe.hits.map((hit) => (
                <li key={hit.path}>{hit.path}: {hit.status || "failed"} · {hit.ms} ms {hit.encoding ? `· ${hit.encoding}` : ""} {hit.error}</li>
              ))}
            </ul>
            <p className="mt-2">Compression is {desk.probe.compressed ? "on (the response had gzip or brotli)." : "not confirmed. Enable gzip or brotli on the host, then test again. This button cannot switch the host on by itself."}</p>
          </div>
        )}
      </section>

      <section className="rounded-[24px] border border-[#dbeafe] bg-white p-4 shadow-sm">
        <h2 className="font-semibold text-[#0f172a]">How your home page looks on Google</h2>
        <p className="mt-1 text-[12px] text-[#64748b]">This is a preview, not a live Google result. It updates as you type.</p>
        <div className="mt-3 max-w-xl rounded-xl border border-white/15 p-4">
          <p className="g-url text-[12px]">{host}</p>
          <p className="g-title text-[18px] leading-snug">{copy.title}</p>
          <p className="g-desc mt-1 text-[13px] leading-5">{copy.description}</p>
        </div>
        <p className="mt-2 text-[12px] text-[#64748b]">Title {copy.title.length} letters (aim 50–65). Description {copy.description.length} letters (aim 120–160).</p>
      </section>

      <section className="rounded-[24px] border border-[#dbeafe] bg-white p-4 shadow-sm">
        <h2 className="font-semibold">Texts and codes</h2>
        <p className="mt-1 text-[12px] text-[#64748b]">Empty title, description and heading boxes use the automatic text. The keywords box is optional. Google does not use the keywords meta tag as a ranking factor.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Panel name"><input className={inputClass} value={form.panelName} onChange={(event) => patch("panelName", event.target.value)} /></Field>
          <Field label="Country (optional, leave empty for worldwide)"><input className={inputClass} value={form.country} onChange={(event) => patch("country", event.target.value)} /></Field>
        </div>
        <div className="mt-3 grid gap-3">
          <Field label={`Home page title (${form.title.length})`}><input className={inputClass} value={form.title} placeholder={copy.title} onChange={(event) => patch("title", event.target.value)} /></Field>
          <Field label={`Home page description (${form.description.length})`}><textarea className={inputClass} rows={3} value={form.description} placeholder={copy.description} onChange={(event) => patch("description", event.target.value)} /></Field>
          <Field label="Home page heading"><input className={inputClass} value={form.h1} placeholder={copy.h1} onChange={(event) => patch("h1", event.target.value)} /></Field>
          <Field label="Home page text"><textarea className={inputClass} rows={4} value={form.homeText} onChange={(event) => patch("homeText", event.target.value)} /></Field>
          <Field label="Open Graph title"><input className={inputClass} value={form.ogTitle} placeholder="Uses the home title when empty" onChange={(event) => patch("ogTitle", event.target.value)} /></Field>
          <Field label="Open Graph description"><textarea className={inputClass} rows={2} value={form.ogDescription} onChange={(event) => patch("ogDescription", event.target.value)} /></Field>
          <Field label="Focus keywords"><input className={inputClass} value={form.keywords} onChange={(event) => patch("keywords", event.target.value)} /></Field>
          <Field label="Extra keywords (optional, not a ranking factor)"><input className={inputClass} value={form.extraKeywords} onChange={(event) => patch("extraKeywords", event.target.value)} /></Field>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Google Search Console code"><input className={inputClass} value={form.googleCode} placeholder='Paste the meta tag or the content value' onChange={(event) => patch("googleCode", event.target.value)} /></Field>
          <Field label="Bing Webmaster code"><input className={inputClass} value={form.bingCode} placeholder="msvalidate.01 content" onChange={(event) => patch("bingCode", event.target.value)} /></Field>
          <Field label="Share picture (1200×630 https URL)"><input className={inputClass} value={form.shareImage} onChange={(event) => patch("shareImage", event.target.value)} /></Field>
          <Field label="Twitter / X image (optional)"><input className={inputClass} value={form.twitterImage} onChange={(event) => patch("twitterImage", event.target.value)} /></Field>
          <Field label="Google Analytics ID"><input className={inputClass} value={form.gaId} placeholder="G-XXXXXXXX" onChange={(event) => patch("gaId", event.target.value)} /></Field>
          <Field label="Google Tag Manager ID"><input className={inputClass} value={form.gtmId} placeholder="GTM-XXXX" onChange={(event) => patch("gtmId", event.target.value)} /></Field>
          <Field label="Main website URL"><input className={inputClass} value={form.mainUrl} placeholder="https://your-domain" onChange={(event) => patch("mainUrl", event.target.value)} /></Field>
          <Field label="IndexNow key"><input className={inputClass} value={form.indexNowKey} readOnly placeholder="Create a key below" /></Field>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {(["instagram", "youtube", "telegram", "whatsapp", "facebook", "twitter"] as const).map((key) => (
            <Field key={key} label={`${key} link`}>
              <input className={inputClass} value={form.links[key]} placeholder="https://" onChange={(event) => patchLink(key, event.target.value)} />
            </Field>
          ))}
        </div>
        <Field label="Custom robots.txt (leave empty to use the generated file)">
          <textarea className={inputClass} rows={6} value={form.robotsOverride} onChange={(event) => patch("robotsOverride", event.target.value)} />
        </Field>
        <div className="mt-3 grid gap-2 text-[13px] text-[#0f172a] sm:grid-cols-2">
          <Check label="SEO tags on public pages" on={form.flags.seoTags} set={(value) => patchFlag("seoTags", value)} />
          <Check label="Platform pages (/smm-panel)" on={form.flags.platformPages} set={(value) => patchFlag("platformPages", value)} />
          <Check label="Links at the bottom of the home page" on={form.flags.footerLinks} set={(value) => patchFlag("footerLinks", value)} />
          <Check label="Hide customer and admin pages from Google" on={form.flags.hidePrivate} set={(value) => patchFlag("hidePrivate", value)} />
          <Check label="Heading and text on the home page" on={form.flags.homeHeading} set={(value) => patchFlag("homeHeading", value)} />
          <Check label="SMM guides (/smm-panel/guide)" on={form.flags.guides} set={(value) => patchFlag("guides", value)} />
          <Check label="Allow home page in Google" on={form.flags.homeIndex} set={(value) => patchFlag("homeIndex", value)} />
          <Check label="Submit public URLs to IndexNow when guides change" on={form.flags.indexNow} set={(value) => patchFlag("indexNow", value)} />
        </div>
        <button type="button" disabled={busy} onClick={() => run(() => adminSaveSeo({ data: form }), "SEO settings saved.")} className="mt-4 h-11 rounded-full bg-[#7c3aed] px-5 text-[14px] font-semibold text-white disabled:opacity-50">Save</button>
      </section>

      <section className="rounded-[24px] border border-[#dbeafe] bg-white p-4 shadow-sm">
        <h2 className="font-semibold">Platform pages ({desk?.pages.filter((page) => page.kind === "platform" && page.published).length || 0})</h2>
        <p className="mt-1 text-[12px] text-[#64748b]">One page per enabled platform and service kind. New services show up on their own. Empty kinds are not published. Aliases such as /buy-instagram-followers redirect here.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(desk?.pages || []).filter((page) => page.kind === "platform").map((page) => (
            <button key={page.slug} type="button" onClick={() => { sourceSlug.current = page.slug; setPageSlug(page.slug); setDraft(page); }} className={"rounded-full border px-3 py-1 text-[12px] " + (draft?.slug === page.slug ? "border-[#7c3aed] bg-[#f5f3ff]" : "border-[#e2e8f0]")}>
              {page.h1} ({page.count}){page.published ? "" : " · hidden"}{page.noindex ? " · noindex" : ""}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={busy} className="h-9 rounded-full border px-3 text-[12px]" onClick={() => run(() => adminBulkSeo({ data: { mode: "publish" } }), "Platform pages published.")}>Publish all</button>
          <button type="button" disabled={busy} className="h-9 rounded-full border px-3 text-[12px]" onClick={() => run(() => adminBulkSeo({ data: { mode: "hide" } }), "Platform pages hidden.")}>Hide all</button>
          <button type="button" disabled={busy} className="h-9 rounded-full border px-3 text-[12px]" onClick={() => run(() => adminBulkSeo({ data: { mode: "index" } }), "Platform pages set to index.")}>Allow index</button>
          <button type="button" disabled={busy} className="h-9 rounded-full border px-3 text-[12px]" onClick={() => run(() => adminBulkSeo({ data: { mode: "noindex" } }), "Platform pages set to noindex.")}>Noindex all</button>
        </div>
        {draft && <PageEditor page={draft} busy={busy} onChange={setDraft} onSave={() => run(() => adminSaveSeoPage({ data: { ...draft, slug: draft.kind === "guide" ? sourceSlug.current || draft.slug : draft.slug, newSlug: draft.kind === "guide" ? draft.slug : undefined } }), "Page saved.")} />}
      </section>

      <section className="rounded-[24px] border border-[#dbeafe] bg-white p-4 shadow-sm">
        <h2 className="font-semibold">Guides</h2>
        <p className="mt-1 text-[12px] text-[#64748b]">New guides start as drafts and noindex. Publish them from the editor. One question per line as Question || Answer.</p>
        <div className="mt-3 grid gap-3">
          <input className={inputClass} placeholder="Guide title" value={guideTitle} onChange={(event) => setGuideTitle(event.target.value)} />
          <textarea className={inputClass} rows={4} placeholder="Guide text" value={guideBody} onChange={(event) => setGuideBody(event.target.value)} />
          <button type="button" disabled={busy} className="h-10 w-fit rounded-full bg-[#0f172a] px-4 text-[13px] font-semibold text-white disabled:opacity-50" onClick={() => run(async () => {
            const next = await adminCreateGuide({ data: { title: guideTitle, body: guideBody } });
            setGuideTitle("");
            setGuideBody("");
            return next;
          }, "Draft guide created.")}>Create guide draft</button>
        </div>
        <ul className="mt-4 space-y-2">
          {(desk?.pages || []).filter((page) => page.kind === "guide").map((page) => (
            <li key={page.slug} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#f8fafc] px-3 py-2 text-[13px]">
              <button type="button" className="text-left font-semibold" onClick={() => { sourceSlug.current = page.slug; setDraft(page); setPageSlug(page.slug.slice(6)); }}>{page.title}</button>
              <span className="text-[12px] text-[#64748b]">{page.published ? "Published" : "Draft"} · {page.noindex ? "noindex" : "index"}</span>
              <button type="button" className="text-[12px] text-rose-600" onClick={() => {
                if (!window.confirm("Delete this guide?")) return;
                run(() => adminDeleteGuide({ data: { slug: page.slug } }), "Guide deleted.");
              }}>Delete</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-[24px] border border-[#dbeafe] bg-white p-4 shadow-sm">
        <h2 className="font-semibold">IndexNow</h2>
        <p className="mt-1 text-[12px] text-[#64748b]">Key file: {form.indexNowKey ? `/seo-key/${form.indexNowKey}` : "not created"}. A successful submit is not indexing.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={busy} className="h-10 rounded-full border px-4 text-[13px] font-semibold" onClick={() => run(() => adminNewIndexKey(), "New IndexNow key saved.")}>New key</button>
          <button type="button" disabled={busy} className="h-10 rounded-full bg-[#0f172a] px-4 text-[13px] font-semibold text-white" onClick={() => run(() => adminSubmitIndexNow({ data: { urls: extraUrls } }), "IndexNow request finished.")}>Submit public URLs</button>
        </div>
        <textarea className={`${inputClass} mt-3`} rows={3} placeholder="Optional extra URLs on your main domain, one per line" value={extraUrls} onChange={(event) => setExtraUrls(event.target.value)} />
        <ul className="mt-3 space-y-1 text-[12px] text-[#475569]">
          {(desk?.indexLog || []).map((row) => <li key={row.id}>{row.ok ? "OK" : "Failed"} · {row.url_count} URLs · {row.detail}</li>)}
        </ul>
      </section>

      <section className="rounded-[24px] border border-[#dbeafe] bg-white p-4 shadow-sm">
        <h2 className="font-semibold">Search performance</h2>
        <p className="mt-2 text-[13px] leading-6 text-[#475569]">Google Search Console and Bing Webmaster APIs are not connected. This page will not show clicks, impressions, average position, or rankings, because none of those numbers were fetched from Google or Bing. After you verify the site, open Search Console and Bing to read the real reports.</p>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-[13px] leading-6 text-[#334155]">
          <li>Open <a className="text-[#1a0dab]" href="https://search.google.com/search-console" target="_blank" rel="noreferrer">search.google.com/search-console</a>. Add the URL prefix, choose the HTML tag, paste it above, Save, then click Verify.</li>
          <li>In Search Console, submit <b>{form.mainUrl || "https://your-domain"}/sitemap.xml</b>. A submitted sitemap is not the same as indexed pages.</li>
          <li>Open <a className="text-[#1a0dab]" href="https://www.bing.com/webmasters" target="_blank" rel="noreferrer">bing.com/webmasters</a>. Import from Google, or paste the Bing code above.</li>
          <li>Use URL Inspection on both sites. If a live test fails, fix the error it shows. Do not assume the page is indexed.</li>
          <li>Get real links from your own profiles and useful pages. Paid spam links are not part of this tool.</li>
          <li>Publish a few useful guides. Each one should say something specific.</li>
          <li>Keep the service list short and the host compressed. Speed is measured by Test my site, not by a checkbox.</li>
          <li>New sites often take weeks. This panel cannot place you first for “smm panel”.</li>
        </ol>
        {desk?.sitemapAt && <p className="mt-3 text-[12px] text-[#64748b]">Sitemap last built: {desk.sitemapAt}</p>}
        {(desk?.redirects || []).length > 0 && (
          <ul className="mt-3 text-[12px] text-[#475569]">
            {desk?.redirects.map((row) => <li key={row.from_path}>{row.from_path} → {row.to_path}</li>)}
          </ul>
        )}
      </section>
    </div>
  );
}

function PageEditor({ page, busy, onChange, onSave }: { page: Page; busy: boolean; onChange: (page: Page) => void; onSave: () => void }) {
  function set<K extends keyof Page>(key: K, value: Page[K]) {
    onChange({ ...page, [key]: value });
  }
  return (
    <div className="mt-4 grid gap-3 border-t border-[#e2e8f0] pt-4">
      <p className="text-[12px] text-[#64748b]">{page.path} · <a className="text-[#1a0dab]" href={page.path}>Preview</a></p>
      <Field label="Title"><input className={inputClass} value={page.title} onChange={(event) => set("title", event.target.value)} /></Field>
      <Field label="Description"><textarea className={inputClass} rows={3} value={page.description} onChange={(event) => set("description", event.target.value)} /></Field>
      <Field label="H1"><input className={inputClass} value={page.h1} onChange={(event) => set("h1", event.target.value)} /></Field>
      <Field label="Content"><textarea className={inputClass} rows={6} value={page.body} onChange={(event) => set("body", event.target.value)} /></Field>
      <Field label="FAQs (Question || Answer)"><textarea className={inputClass} rows={3} value={page.faqs} onChange={(event) => set("faqs", event.target.value)} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Canonical URL"><input className={inputClass} value={page.canonical} onChange={(event) => set("canonical", event.target.value)} /></Field>
        <Field label="Image URL"><input className={inputClass} value={page.image} onChange={(event) => set("image", event.target.value)} /></Field>
        <Field label="Category"><input className={inputClass} value={page.category} onChange={(event) => set("category", event.target.value)} /></Field>
        <Field label="Tags"><input className={inputClass} value={page.tags} onChange={(event) => set("tags", event.target.value)} /></Field>
        <Field label="Author"><input className={inputClass} value={page.author} onChange={(event) => set("author", event.target.value)} /></Field>
        {page.kind === "guide" && <Field label="URL slug"><input className={inputClass} value={page.slug.replace(/^guide\//, "")} onChange={(event) => set("slug", `guide/${event.target.value}`)} /></Field>}
        <Field label="Publish at (optional)"><input className={inputClass} type="datetime-local" value={page.publishedAt ? page.publishedAt.slice(0, 16) : ""} onChange={(event) => set("publishedAt", event.target.value)} /></Field>
      </div>
      <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={page.published} onChange={(event) => set("published", event.target.checked)} /> Published</label>
      <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={page.noindex} onChange={(event) => set("noindex", event.target.checked)} /> Noindex</label>
      <button type="button" disabled={busy} onClick={onSave} className="h-10 w-fit rounded-full bg-[#7c3aed] px-4 text-[13px] font-semibold text-white disabled:opacity-50">Save page</button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mt-3 block text-[12px] font-semibold text-[#334155]">
      {label}
      <span className="mt-1 block font-normal">{children}</span>
    </label>
  );
}

function Check({ label, on, set }: { label: string; on: boolean; set: (value: boolean) => void }) {
  return (
    <label className="flex items-center gap-2">
      <input type="checkbox" checked={on} onChange={(event) => set(event.target.checked)} />
      {label}
    </label>
  );
}

function Dot({ level }: { level: "pass" | "warn" | "fail" }) {
  const color = level === "pass" ? "#16a34a" : level === "warn" ? "#d97706" : "#dc2626";
  return <span className="inline-block size-2.5 rounded-full" style={{ background: color }} />;
}

function ScoreRing({ score }: { score: number }) {
  const radius = 52;
  const circ = 2 * Math.PI * radius;
  const dash = (Math.max(0, Math.min(100, score)) / 100) * circ;
  return (
    <div className="grid place-items-center">
      <svg width="140" height="140" viewBox="0 0 140 140" aria-label={`SEO score ${score}`}>
        <circle cx="70" cy="70" r={radius} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="12" />
        <circle cx="70" cy="70" r={radius} fill="none" stroke="#fb923c" strokeWidth="12" strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round" transform="rotate(-90 70 70)" />
        <text x="70" y="66" textAnchor="middle" fontSize="28" fontWeight="700" fill="#ffffff">{score}</text>
        <text x="70" y="86" textAnchor="middle" fontSize="11" fill="#e0e7ff">SEO score</text>
      </svg>
    </div>
  );
}
