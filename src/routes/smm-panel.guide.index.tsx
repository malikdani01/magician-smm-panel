import { createFileRoute } from "@tanstack/react-router";
import { publicHubData } from "@/lib/seo.functions";
import { SeoFrame } from "@/components/seo-public";

export const Route = createFileRoute("/smm-panel/guide/")({
  loader: () => publicHubData(),
  head: ({ loaderData }) => ({
    meta: [
      { title: `SMM guides - ${loaderData?.seo.panelName || "SMM Panel"}` },
      { name: "description", content: "Short practical guides about SMM panels, ordering, and safety." },
      { name: "robots", content: loaderData?.seo.flags.guides ? "index, follow" : "noindex, follow" },
    ],
    links: loaderData?.seo.mainUrl ? [{ rel: "canonical", href: `${loaderData.seo.mainUrl}/smm-panel/guide` }] : [],
  }),
  component: Guides,
});

function Guides() {
  const data = Route.useLoaderData();
  const guides = data?.guides || [];
  return (
    <SeoFrame>
      <p className="text-[12px] text-white/50">{data?.seo.panelName} / Guides</p>
      <h1 className="mt-2 text-[36px] font-extrabold">SMM guides</h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-7 text-white/75">Short, practical notes. Read them before a large order. They are not a promise of ranking or growth.</p>
      {guides.length === 0 ? (
        <p className="mt-6 text-white/70">No published guides yet.</p>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {guides.map((guide) => (
            <a key={guide.path} href={guide.path} className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10">
              <p className="text-[11px] uppercase tracking-wide text-fuchsia-300">{guide.category}</p>
              <h2 className="mt-1 text-[18px] font-bold">{guide.title}</h2>
              <p className="mt-2 text-[13px] leading-6 text-white/70">{guide.description}</p>
            </a>
          ))}
        </div>
      )}
    </SeoFrame>
  );
}
