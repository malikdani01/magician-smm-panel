import { Link } from "@tanstack/react-router";
import { Mark } from "@/components/shell";

export type PublicService = { name: string; category: string; price: number; min: number; max: number };
export type PublicLink = { path: string; title: string; kind?: string };

export function moneyPerK(paise: number) {
  const amount = (Number(paise) || 0) / 100;
  return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export function absUrl(origin: string, path: string) {
  if (!origin) return path;
  return `${origin.replace(/\/$/, "")}${path}`;
}

export function SeoFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#070312] text-white">
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4">
        <Mark />
        <nav className="flex flex-wrap justify-end gap-3 text-[13px] text-white/80">
          <Link to="/smm-panel" className="hover:text-white">Services</Link>
          <Link to="/smm-panel/guide" className="hover:text-white">Guides</Link>
          <Link to="/login" className="hover:text-white">Sign in</Link>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-16">{children}</main>
    </div>
  );
}

export function Crumbs({ items }: { items: { href: string; label: string }[] }) {
  return (
    <nav className="mb-4 text-[12px] text-white/60" aria-label="Breadcrumb">
      {items.map((item, index) => (
        <span key={item.href}>
          {index > 0 && <span className="px-1">/</span>}
          {index === items.length - 1 ? <span className="text-white/90">{item.label}</span> : <a className="hover:text-white" href={item.href}>{item.label}</a>}
        </span>
      ))}
    </nav>
  );
}

export function PriceTable({ title, services }: { title: string; services: PublicService[] }) {
  const rows = [...services].sort((a, b) => a.price - b.price).slice(0, 40);
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10">
      <table className="w-full min-w-[520px] text-left text-[13px]">
        <caption className="px-3 py-3 text-left text-[15px] font-semibold text-white">{title}</caption>
        <thead className="bg-white/5 text-white/60">
          <tr>
            <th className="px-3 py-2 font-medium">Service</th>
            <th className="px-3 py-2 font-medium">Per 1,000</th>
            <th className="px-3 py-2 font-medium">Min</th>
            <th className="px-3 py-2 font-medium">Max</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.name}-${row.min}-${row.price}`} className="border-t border-white/10">
              <td className="px-3 py-2">{row.name}</td>
              <td className="px-3 py-2 font-semibold">{moneyPerK(row.price)}</td>
              <td className="px-3 py-2">{row.min.toLocaleString("en-IN")}</td>
              <td className="px-3 py-2">{row.max.toLocaleString("en-IN")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function parsePublicFaqs(raw: string, h1: string, panelName: string) {
  const custom = raw.split("\n").map((line) => {
    const [q, ...rest] = line.split("||");
    return { q: (q || "").trim(), a: rest.join("||").trim() };
  }).filter((item) => item.q && item.a);
  if (custom.length > 0) return custom.slice(0, 8);
  return [
    { q: `What is ${h1.toLowerCase()}?`, a: `${h1} is a service on ${panelName}. You choose a quantity and send it to a public link.` },
    { q: "Do I need to share my password?", a: "No. A real order only needs the public profile, post or video link." },
    { q: "Which price should I pick?", a: "The table is cheapest first. Read the minimum, maximum and description before you order." },
  ];
}

export function FaqList({ items }: { items: { q: string; a: string }[] }) {
  if (items.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="text-[22px] font-bold">Questions</h2>
      <div className="mt-3 divide-y divide-white/10 rounded-2xl border border-white/10">
        {items.map((item) => (
          <details key={item.q} className="px-4 py-3">
            <summary className="cursor-pointer font-semibold">{item.q}</summary>
            <p className="mt-2 text-[14px] leading-6 text-white/75">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function RelatedLinks({ links }: { links: PublicLink[] }) {
  if (links.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="text-[18px] font-bold">Related</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {links.map((link) => (
          <a key={link.path} href={link.path} className="rounded-full border border-white/15 px-3 py-1.5 text-[13px] text-white/85 hover:bg-white/10">{link.title}</a>
        ))}
      </div>
    </section>
  );
}

export function PlatformView({
  panelName,
  country,
  page,
  services,
  related,
}: {
  panelName: string;
  country: string;
  page: { path: string; title: string; description: string; h1: string; body: string; faqs: string; count: number };
  services: PublicService[];
  related: PublicLink[];
}) {
  const cheapest = [...services].sort((a, b) => a.price - b.price)[0];
  const place = country ? ` in ${country}` : "";
  const faqs = parsePublicFaqs(page.faqs, page.h1, panelName);
  const intro = page.body || `${panelName} lists ${page.count} live ${page.h1.toLowerCase()} services${place}. The cheapest starts at ${cheapest ? moneyPerK(cheapest.price) : "the current book price"} per 1,000. Orders use a public link. No password is asked.`;
  return (
    <SeoFrame>
      <Crumbs items={[{ href: "/", label: panelName }, { href: "/smm-panel", label: "SMM Panel" }, { href: page.path, label: page.h1 }]} />
      <h1 className="text-[34px] font-extrabold leading-tight">{page.h1}</h1>
      <p className="mt-3 max-w-3xl text-[15px] leading-7 text-white/75">{intro}</p>
      <div className="mt-4 flex flex-wrap gap-2 text-[12px] text-white/70">
        <span className="rounded-full bg-white/10 px-3 py-1">{page.count} services</span>
        {cheapest && <span className="rounded-full bg-white/10 px-3 py-1">From {moneyPerK(cheapest.price)} / 1,000</span>}
        <span className="rounded-full bg-white/10 px-3 py-1">No password</span>
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        <a href="/login" className="inline-flex h-11 items-center rounded-full bg-violet-600 px-4 text-[13px] font-semibold">Create free account</a>
        <a href="/smm-panel" className="inline-flex h-11 items-center rounded-full border border-white/20 px-4 text-[13px] font-semibold">All platforms</a>
      </div>
      <div className="mt-8">
        <PriceTable title={`${page.h1} — cheapest first`} services={services} />
      </div>
      <section className="mt-8">
        <h2 className="text-[22px] font-bold">How to order</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-[14px] leading-6 text-white/75">
          <li>Create an account and add funds to the wallet.</li>
          <li>Open the service, read the minimum, maximum and description.</li>
          <li>Paste the public link, set the quantity, and place the order.</li>
        </ol>
      </section>
      <FaqList items={faqs} />
      <RelatedLinks links={related} />
    </SeoFrame>
  );
}

export function SeoFooter({ pages, show }: { pages: { path: string; title: string; kind: string }[]; show: boolean }) {
  if (!show || pages.length === 0) return null;
  const platforms = pages.filter((page) => page.kind === "platform" && page.path.split("/").length === 3);
  const guides = pages.filter((page) => page.kind === "guide").slice(0, 6);
  return (
    <footer className="mt-10 border-t border-white/10 pt-6 text-[13px] text-white/70">
      <div className="flex flex-wrap gap-2">
        {platforms.map((page) => (
          <a key={page.path} href={page.path} className="rounded-full border border-white/15 px-3 py-1 hover:text-white">{page.title}</a>
        ))}
        <a href="/smm-panel" className="rounded-full border border-white/15 px-3 py-1 hover:text-white">All services</a>
        <a href="/smm-panel/guide" className="rounded-full border border-white/15 px-3 py-1 hover:text-white">SMM guides</a>
      </div>
      {guides.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-3">
          {guides.map((page) => (
            <a key={page.path} href={page.path} className="hover:text-white">{page.title}</a>
          ))}
        </div>
      )}
    </footer>
  );
}
