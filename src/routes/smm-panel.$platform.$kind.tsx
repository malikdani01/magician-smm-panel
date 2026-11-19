import { createFileRoute, notFound } from "@tanstack/react-router";
import { publicPlatform } from "@/lib/seo.functions";
import { PlatformView, absUrl, parsePublicFaqs } from "@/components/seo-public";

export const Route = createFileRoute("/smm-panel/$platform/$kind")({
  loader: async ({ params }) => {
    const data = await publicPlatform({ data: { platform: params.platform, kind: params.kind } });
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Not found" }] };
    const canonical = loaderData.page.canonical || absUrl(loaderData.origin, loaderData.page.path);
    const image = loaderData.page.image || loaderData.seo.shareImage;
    const faqs = parsePublicFaqs(loaderData.page.faqs, loaderData.page.h1, loaderData.seo.panelName);
    const tags = loaderData.seo.flags.seoTags;
    return {
      meta: [
        { title: loaderData.page.title },
        { name: "description", content: loaderData.page.description },
        { name: "robots", content: loaderData.page.noindex ? "noindex, follow" : "index, follow" },
        ...(tags && image ? [
          { property: "og:title", content: loaderData.page.title },
          { property: "og:description", content: loaderData.page.description },
          { property: "og:image", content: image },
          { name: "twitter:card", content: "summary_large_image" },
          { name: "twitter:image", content: loaderData.seo.twitterImage || image },
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
                { "@type": "ListItem", position: 1, name: loaderData.seo.panelName, item: absUrl(loaderData.origin, "/") },
                { "@type": "ListItem", position: 2, name: "SMM Panel", item: absUrl(loaderData.origin, "/smm-panel") },
                { "@type": "ListItem", position: 3, name: loaderData.page.h1, item: canonical },
              ],
            },
            {
              "@type": "Service",
              name: loaderData.page.h1,
              description: loaderData.page.description,
              provider: { "@type": "Organization", name: loaderData.seo.panelName },
              offers: {
                "@type": "AggregateOffer",
                priceCurrency: "INR",
                lowPrice: Math.min(...loaderData.services.map((item) => item.price)) / 100,
                offerCount: loaderData.services.length,
              },
            },
            {
              "@type": "FAQPage",
              mainEntity: faqs.map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } })),
            },
          ],
        }),
      }],
    };
  },
  component: Page,
});

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
