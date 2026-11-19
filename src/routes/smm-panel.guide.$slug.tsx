import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { publicGuide, publicRedirect } from "@/lib/seo.functions";
import { absUrl, parsePublicFaqs, SeoFrame } from "@/components/seo-public";

export const Route = createFileRoute("/smm-panel/guide/$slug")({
  loader: async ({ params }) => {
    const data = await publicGuide({ data: { slug: params.slug } });
    if (data) return data;
    const hop = await publicRedirect({ data: { path: `/smm-panel/guide/${params.slug}` } });
    if (hop.to) throw redirect({ href: hop.to, statusCode: 301 });
    throw notFound();
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Not found" }] };
    const canonical = loaderData.page.canonical || absUrl(loaderData.origin, loaderData.page.path);
    const image = loaderData.page.image || loaderData.seo.shareImage;
    const tags = loaderData.seo.flags.seoTags;
    return {
      meta: [
        { title: loaderData.page.title },
        { name: "description", content: loaderData.page.description },
        { name: "robots", content: loaderData.page.noindex ? "noindex, follow" : "index, follow" },
        ...(tags ? [
          { property: "og:type", content: "article" },
          { property: "og:title", content: loaderData.page.title },
          { property: "og:description", content: loaderData.page.description },
          ...(image ? [{ property: "og:image", content: image }, { name: "twitter:card", content: "summary_large_image" }, { name: "twitter:image", content: loaderData.seo.twitterImage || image }] : []),
        ] : []),
      ],
      links: tags && canonical.startsWith("http") ? [{ rel: "canonical", href: canonical }] : [],
      scripts: [{
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: loaderData.page.h1,
          description: loaderData.page.description,
          author: { "@type": "Organization", name: loaderData.page.author || loaderData.seo.panelName },
          mainEntityOfPage: canonical,
        }),
      }],
    };
  },
  component: GuidePage,
});

function GuidePage() {
  const data = Route.useLoaderData();
  const faqs = parsePublicFaqs(data.page.faqs, data.page.h1, data.seo.panelName).filter((item) => data.page.faqs.includes("||"));
  const paragraphs = (data.page.body || data.page.description).split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  return (
    <SeoFrame>
      <p className="text-[12px] text-white/50"><a href="/smm-panel">SMM Panel</a> / <a href="/smm-panel/guide">Guides</a></p>
      <h1 className="mt-3 text-[34px] font-extrabold leading-tight">{data.page.h1}</h1>
      <p className="mt-2 text-[12px] text-white/50">{data.page.category} · {data.page.author || data.seo.panelName}</p>
      {data.page.image && <img src={data.page.image} alt={data.page.h1} width={1200} height={630} className="mt-4 w-full rounded-2xl object-cover" />}
      <article className="mt-6 max-w-3xl space-y-4 text-[15px] leading-7 text-white/80">
        {paragraphs.map((part) => <p key={part.slice(0, 40)}>{part}</p>)}
      </article>
      {faqs.length > 0 && (
        <section className="mt-8 max-w-3xl">
          <h2 className="text-[20px] font-bold">Questions</h2>
          {faqs.map((item) => (
            <details key={item.q} className="mt-2 rounded-xl border border-white/10 px-4 py-3">
              <summary className="cursor-pointer font-semibold">{item.q}</summary>
              <p className="mt-2 text-[14px] text-white/75">{item.a}</p>
            </details>
          ))}
        </section>
      )}
      {data.related.length > 0 && (
        <section className="mt-8">
          <h2 className="text-[18px] font-bold">More guides</h2>
          <div className="mt-3 flex flex-col gap-2">
            {data.related.map((item) => <a key={item.path} href={item.path} className="text-fuchsia-300 hover:underline">{item.title}</a>)}
          </div>
        </section>
      )}
    </SeoFrame>
  );
}
