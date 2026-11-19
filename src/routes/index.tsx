import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Headphones, Home as HomeIcon, Rocket, ShieldCheck, Wallet, Zap } from "lucide-react";
import { Mark } from "@/components/shell";
import { Starfield } from "@/components/stars";
import { SeoFooter } from "@/components/seo-public";
import { publicSeoHead } from "@/lib/seo.functions";
import hero from "@/assets/hero-guy.jpg";
import heroMobile from "@/assets/hero-mobile.jpg";
import ig from "@/assets/logo-ig.png";
import yt from "@/assets/logo-yt.png";
import tt from "@/assets/logo-tt.png";
import fb from "@/assets/logo-fb.png";

export const Route = createFileRoute("/")({
  loader: () => publicSeoHead().catch(() => null),
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Magician SMM Panel" }] };
    const tags = loaderData.flags.seoTags;
    const image = loaderData.shareImage;
    const canonical = loaderData.mainUrl ? `${loaderData.mainUrl}/` : "";
    const keywords = [loaderData.keywords, loaderData.extraKeywords].filter(Boolean).join(", ");
    return {
      meta: [
        { title: loaderData.title },
        { name: "description", content: loaderData.description },
        { name: "robots", content: loaderData.flags.homeIndex ? "index, follow" : "noindex, follow" },
        ...(keywords ? [{ name: "keywords", content: keywords }] : []),
        ...(tags ? [
          { property: "og:title", content: loaderData.ogTitle || loaderData.title },
          { property: "og:description", content: loaderData.ogDescription || loaderData.description },
          { property: "og:type", content: "website" },
          ...(image ? [{ property: "og:image", content: image }] : []),
          { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
          { name: "twitter:title", content: loaderData.ogTitle || loaderData.title },
          { name: "twitter:description", content: loaderData.ogDescription || loaderData.description },
          ...(loaderData.twitterImage || image ? [{ name: "twitter:image", content: loaderData.twitterImage || image }] : []),
        ] : []),
      ],
      links: canonical ? [{ rel: "canonical", href: canonical }] : [],
      scripts: [{
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: loaderData.panelName,
          url: canonical || "/",
          sameAs: Object.values(loaderData.links).filter(Boolean),
        }),
      }],
    };
  },
  component: Home,
});

const LOGOS = [
  { name: "Instagram", src: ig },
  { name: "YouTube", src: yt },
  { name: "TikTok", src: tt },
  { name: "Facebook", src: fb },
];

const NAV = [
  { label: "Home", to: "/" as const },
  { label: "Services", to: "/catalog" as const },
  { label: "API", to: "/catalog" as const },
  { label: "Contact", to: "/support" as const },
];

function HomePage() {
  const data = Route.useLoaderData();
  const seoOn = Boolean(data?.flags.homeHeading);
  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      <img src={hero} alt="" className="pointer-events-none absolute inset-0 hidden h-full w-full object-cover object-[70%_center] md:block" />
      <img src={heroMobile} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover object-top md:hidden" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#070312] via-[#070312]/80 to-[#070312]/5" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#070312] via-[#070312]/20 to-[#070312]/45 md:to-transparent" />
      <Starfield />

      <header className="relative z-10 px-3 py-3 sm:px-6">
        <div className="flex items-center justify-between gap-2">
          <span className="sm:hidden"><Mark compact /></span>
          <span className="hidden sm:block"><Mark /></span>
          <div className="flex shrink-0 items-center gap-1.5">
            <Link to="/login" className="btn-pop inline-flex h-10 items-center rounded-full bg-violet-600 px-3 text-[12px] font-semibold sm:px-4 sm:text-[13px]">Login</Link>
            <Link to="/login" className="btn-live inline-flex h-10 items-center gap-1 rounded-full bg-gradient-to-r from-violet-500 to-sky-500 px-3 text-[12px] font-semibold sm:px-4 sm:text-[13px]">
              <Rocket className="size-3.5" /> Register
            </Link>
          </div>
        </div>
        <nav className="mt-2 flex gap-1.5 overflow-x-auto pb-1 text-[12px] [-ms-overflow-style:none] [scrollbar-width:none] lg:justify-center [&::-webkit-scrollbar]:hidden">
          <Link to="/" className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-violet-600 px-3 font-semibold">
            <HomeIcon className="size-3.5" /> Home
          </Link>
          {NAV.slice(1).map((item) => (
            <Link key={item.label} to={item.to} className="inline-flex h-9 shrink-0 items-center rounded-full border border-white/15 bg-black/40 px-3 font-semibold text-white/90">
              {item.label}
            </Link>
          ))}
          <a href="#features" className="inline-flex h-9 shrink-0 items-center rounded-full border border-white/15 bg-black/40 px-3 font-semibold text-white/90">Blog</a>
        </nav>
      </header>

      <main className="relative z-10 flex flex-col px-4 pb-8 pt-4 sm:px-8 md:max-w-[680px] md:min-h-[calc(100vh-120px)] md:justify-center lg:px-12">
        <p className="rise-in mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-black/40 px-3 py-1 text-[12px] text-white/80">
          <Rocket className="size-3.5 text-fuchsia-300" /> Fast · Secure · Affordable
        </p>
        {seoOn ? (
          <p className="rise-in rise-d1 text-[40px] font-extrabold leading-[0.92] tracking-tight text-white sm:text-[64px]">
            Magician
            <span className="block bg-gradient-to-r from-fuchsia-400 to-violet-300 bg-clip-text text-transparent">SMM Panel</span>
          </p>
        ) : (
          <h1 className="rise-in rise-d1 text-[40px] font-extrabold leading-[0.92] tracking-tight text-white sm:text-[64px]">
            Magician
            <span className="block bg-gradient-to-r from-fuchsia-400 to-violet-300 bg-clip-text text-transparent">SMM Panel</span>
          </h1>
        )}
        <p className="rise-in rise-d2 mt-3 text-[18px] font-semibold text-white sm:text-[22px]">
          Grow Your Social Media
          <span className="block text-fuchsia-300">Faster & Smarter</span>
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Link to="/dashboard" className="btn-live inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-sky-500 px-4 text-[14px] font-semibold shadow-lg shadow-violet-600/40 sm:w-auto">
            <Rocket className="size-4" /> Open the Panel <ArrowRight className="size-4" />
          </Link>
          <Link to="/wallet" className="btn-pop rise-d4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-white/25 bg-black/30 px-4 text-[14px] font-semibold backdrop-blur sm:w-auto">
            <Wallet className="size-4" /> Add Credit
          </Link>
        </div>

        <div className="mt-6 rounded-[24px] border border-white/10 bg-black/50 p-3 backdrop-blur-md sm:p-4">
          <p className="mb-3 text-center text-[11px] font-semibold tracking-[0.22em] text-white/70">ALL SOCIAL NETWORKS</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex justify-center gap-3">
              {LOGOS.map((item) => (
                <img key={item.name} src={item.src} alt={item.name} title={item.name} className="logo-3d size-11 rounded-xl object-contain sm:size-12" />
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2 text-[11px] sm:text-[12px]">
              <p className="flex items-center gap-1.5"><Zap className="size-4 shrink-0 text-amber-300" /><span><b className="block">Instant</b>Delivery</span></p>
              <p className="flex items-center gap-1.5"><ShieldCheck className="size-4 shrink-0 text-emerald-300" /><span><b className="block">100%</b>Safe & Secure</span></p>
              <p className="flex items-center gap-1.5"><Headphones className="size-4 shrink-0 text-violet-300" /><span><b className="block">24/7</b>Support</span></p>
            </div>
          </div>
          <p className="mt-3 text-center text-[12px] leading-5 text-white/80">Instagram, TikTok, YouTube, Facebook, Telegram, X, Spotify and every other network with a live service.</p>
        </div>

        <section id="features" className="mt-4 grid gap-2 sm:grid-cols-3">
          {[
            ["Staged drip", "Runs spread over time so the graph looks natural."],
            ["Own rates", "Set per-1,000 prices. Orders use your rates."],
            ["One wallet", "Credit once, spend on views, likes, saves and shares."],
          ].map(([title, body]) => (
            <article key={title} className="rounded-2xl border border-white/10 bg-black/40 p-3 backdrop-blur">
              <h2 className="text-[15px] font-bold text-white">{title}</h2>
              <p className="mt-1 text-[12px] text-white/75">{body}</p>
            </article>
          ))}
        </section>
        {seoOn && data && (
          <section className="mt-8 rounded-[24px] border border-white/10 bg-black/45 p-5 backdrop-blur">
            <h1 className="text-[28px] font-extrabold leading-tight sm:text-[34px]">{data.h1}</h1>
            <p className="mt-3 text-[14px] leading-6 text-white/80">{data.homeText}</p>
            <SeoFooter pages={data.pages} show={data.flags.footerLinks} />
          </section>
        )}
      </main>
    </div>
  );
}

function Home() {
  return <HomePage />;
}
