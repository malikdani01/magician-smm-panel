import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, Bot, Shield, Sparkles, Wallet } from "lucide-react";
import { Authed } from "@/components/gate";

export const Route = createFileRoute("/telegram-bot")({
  component: () => (
    <Authed>
      <Page />
    </Authed>
  ),
});

const CARDS = [
  [Sparkles, "Place Orders", "Instagram links par views, likes aur comments ke orders Telegram se place karein."],
  [Wallet, "Wallet Balance", "Apna live wallet balance aur recent transactions turant check karein."],
  [Bell, "Live Order Updates", "Processing, completed aur failed orders ki instant notifications paayein."],
  [Bot, "Manage Instagram Posts", "Recent posts dekhein aur Telegram ke andar se quick boost apply karein."],
  [Sparkles, "Auto Order Presets", "Default quantity aur auto/manual mode ko simple commands se control karein."],
  [Shield, "Secure Account Linking", "One-time verification ke saath apna Magiciansmm account safely connect karein."],
];

function Page() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center justify-between text-[13px]">
        <span>Telegram Bot</span>
        <Link to="/dashboard">Home</Link>
      </div>
      <section className="rounded-3xl border border-[#e7eef6] bg-white px-6 py-10 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-[#eef4ff] text-[#3b82f6]"><Bot /></span>
        <p className="mt-3 text-[12px] text-[#3b82f6]">In Development</p>
        <h1 className="mt-2 font-['Playfair_Display',Georgia,serif] text-[34px] leading-none">Telegram Bot Coming Soon</h1>
        <p className="mx-auto mt-3 max-w-md text-[13px] text-[#64748b]">Magiciansmm panel ko Telegram se manage karna aur bhi fast hone wala hai. Hamari team ek secure aur powerful bot experience tayyar kar rahi hai.</p>
        <p className="mt-4 inline-flex rounded-full bg-[#eef4ff] px-3 py-1 text-[12px] text-[#2458c5]">The launch update will show on your dashboard</p>
      </section>
      <div className="text-center">
        <h2 className="font-['Playfair_Display',Georgia,serif] text-[28px]">What's Coming</h2>
        <p className="text-[13px] text-[#64748b]">Telegram par milne wale powerful features</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {CARDS.map(([Icon, title, body]) => (
          <article key={String(title)} className="rounded-2xl border border-[#e7eef6] bg-white p-4">
            <Icon className="size-4 text-[#3b82f6]" />
            <p className="mt-2 font-semibold">{String(title)}</p>
            <p className="text-[12px] text-[#64748b]">{String(body)}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
