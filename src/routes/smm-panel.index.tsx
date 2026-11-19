import { createFileRoute } from "@tanstack/react-router";
import { publicHubData } from "@/lib/seo.functions";
import { SeoFrame, moneyPerK } from "@/components/seo-public";

export const Route = createFileRoute("/smm-panel/")({
  loader: () => publicHubData(),
  head: ({ loaderData }) => {
    const title = loaderData?.copy.title || "SMM Panel";
    const description = loaderData?.copy.description || "";
    const origin = loaderData?.seo.mainUrl || "";
    const canonical = loaderData?.seo.flags.seoTags && origin ? `${origin}/smm-panel` : undefined;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "robots", content: "index, follow" },
      ],
      links: canonical ? [{ rel: "canonical", href: canonical }] : [],
      scripts: [{
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: loaderData?.seo.panelName || "SMM Panel",
          url: canonical || "/smm-panel",
        }),
      }],
    };
  },
  component: HubPage,
});

function HubPage() {
  const data = Route.useLoaderData();
  const platforms = data?.platforms || [];
  const guides = data?.guides || [];
  return (
    <SeoFrame>
      <p className="text-[12px] uppercase tracking-[0.16em] text-fuchsia-300">{data?.seo.panelName}</p>
      <h1 className="mt-2 text-[36px] font-extrabold leading-tight">{data?.copy.h1 || "SMM Panel"}</h1>
      <p className="mt-3 max-w-3xl text-[15px] leading-7 text-white/75">{data?.copy.description}</p>
      <section className="mt-8">
        <h2 className="text-[22px] font-bold">Choose a platform</h2>
        {platforms.length === 0 ? (
          <p className="mt-3 text-[14px] text-white/70">No public platform pages yet. Enable services in the admin panel, then turn on platform pages.</p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {platforms.map((item) => (
              <a key={item.path} href={item.path} className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10">
                <h3 className="text-[18px] font-bold">{item.title}</h3>
                <p className="mt-1 text-[13px] text-white/70">{item.count} services · from {moneyPerK(item.cheapest)} / 1,000</p>
                <p className="mt-2 text-[12px] text-white/50">{item.kinds.map((kind) => kind.title).slice(0, 4).join(" · ")}</p>
              </a>
            ))}
          </div>
        )}
      </section>
      {guides.length > 0 && (
        <section className="mt-8">
          <h2 className="text-[22px] font-bold">Guides</h2>
          <div className="mt-3 grid gap-2">
            {guides.map((guide) => (
              <a key={guide.path} href={guide.path} className="rounded-xl border border-white/10 px-4 py-3 hover:bg-white/5">
                <span className="font-semibold">{guide.title}</span>
                <span className="mt-1 block text-[12px] text-white/60">{guide.description}</span>
              </a>
            ))}
          </div>
        </section>
      )}
    </SeoFrame>
  );
}
