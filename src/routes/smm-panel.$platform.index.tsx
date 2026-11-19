import { createFileRoute, notFound } from "@tanstack/react-router";
import { publicPlatform } from "@/lib/seo.functions";
import { PlatformView, absUrl, parsePublicFaqs } from "@/components/seo-public";

export const Route = createFileRoute("/smm-panel/$platform/")({
  loader: async ({ params }) => {
    const data = await publicPlatform({ data: { platform: params.platform } });
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Not found" }] };
    return headFor(loaderData);
  },
  component: Page,
});

function headFor(data: Awaited<ReturnType<typeof publicPlatform>>) {
  if (!data) return { meta: [{ title: "Not found" }] };
  const canonical = data.page.canonical || absUrl(data.origin, data.page.path);
  const image = data.page.image || data.seo.shareImage;
  const faqs = parsePublicFaqs(data.page.faqs, data.page.h1, data.seo.panelName);
  const tags = data.seo.flags.seoTags;
  return {
    meta: [
      { title: data.page.title },
      { name: "description", content: data.page.description },
      { name: "robots", content: data.page.noindex ? "noindex, follow" : "index, follow" },
      ...(tags && image ? [
        { property: "og:title", content: data.page.title },
        { property: "og:description", content: data.page.description },
        { property: "og:image", content: image },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: data.page.title },
        { name: "twitter:description", content: data.page.description },
        { name: "twitter:image", content: data.seo.twitterImage || image },
      ] : []),
    ],
    links: tags && canonical.startsWith("http") ? [{ rel: "canonical", href: canonical }] : [],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: data.seo.panelName, item: absUrl(data.origin, "/") },
              { "@type": "ListItem", position: 2, name: "SMM Panel", item: absUrl(data.origin, "/smm-panel") },
              { "@type": "ListItem", position: 3, name: data.page.h1, item: canonical },
            ],
          },
          {
            "@type": "FAQPage",
            mainEntity: faqs.map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } })),
          },
        ],
      }),
    }],
  };
}

function Page() {
  const data = Route.useLoaderData();
  return (
    <PlatformView
      panelName={data.seo.panelName}
      country={data.seo.country}
      page={data.page}
      services={data.services}
      related={data.related}
    />
  );
}
