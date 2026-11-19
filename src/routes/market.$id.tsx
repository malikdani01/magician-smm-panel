import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Authed } from "@/components/gate";
import { Panel, PrimaryButton } from "@/components/shell";
import { openDeal, saleListing } from "@/lib/market.functions";

export const Route = createFileRoute("/market/$id")({
  component: () => (
    <Authed>
      <ListingPage />
    </Authed>
  ),
});

type Row = {
  id: string; name: string; topic: string; price: number; followers: number; image: string; url: string; show_link: boolean;
  description: string; content: string; income: string; expense: string; income_note: string; expense_note: string;
  promotion: string; maintain: string; monetized: string; screenshots: string[]; discussions: number; platform: string;
};

function line(label: string, value: string) {
  return <p><b>{label}:</b> {value || "not specified"}</p>;
}

function ListingPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [row, setRow] = useState<Row | null>(null);
  const [deal, setDeal] = useState(false);
  const [shot, setShot] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    saleListing({ data: id }).then((item) => setRow(item as Row | null)).catch(() => setRow(null));
  }, [id]);

  async function create() {
    setNote("");
    try {
      await openDeal({ data: id });
      navigate({ to: "/deals" });
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Could not create the deal.");
    }
  }

  if (!row) return <p className="text-[14px] text-[#94a3b8]">This account is not available.</p>;
  return (
    <div className="mx-auto grid max-w-3xl gap-4">
      {row.image ? <img src={row.image} alt="" className="size-28 rounded-full object-cover ring-4 ring-violet-500/40" /> : null}
      <div>
        <h1 className="text-[32px] font-bold">{row.name}</h1>
        {row.url && <a href={row.url} target="_blank" rel="noreferrer" className="mt-1 block break-all text-[14px] font-semibold text-violet-300 underline">{row.url}</a>}
        <p className="mt-2 text-[14px] text-[#94a3b8]">{row.topic || "No category"}</p>
      </div>
      <div className="border-l-4 border-violet-500 pl-3 text-[14px]">
        <p>{Number(row.followers).toLocaleString("en-US")} — followers</p>
        <p>${row.income || "0"} — income (month)</p>
        <p>${row.expense || "0"} — expense (month)</p>
      </div>
      <p className="text-[40px] font-bold">${Number(row.price).toLocaleString("en-US")}</p>
      {!deal ? (
        <button type="button" className="h-12 rounded-full border text-[14px] font-semibold" style={{ borderColor: "var(--desk-line)" }} onClick={() => setDeal(true)}>Buy this channel</button>
      ) : (
        <Panel className="grid gap-3">
          <h2 className="text-[22px] font-bold">Create a deal</h2>
          <p className="text-[13px] text-[#94a3b8]">No fee. The deal opens a private chat with the panel after it is accepted.</p>
          <p><b>{row.name}</b> · {row.topic} · ${row.price}</p>
          <PrimaryButton type="button" onClick={create}>Create</PrimaryButton>
          {note && <p className="text-[13px] text-rose-300">{note}</p>}
        </Panel>
      )}
      <div className="grid gap-4 md:grid-cols-[1.4fr_.8fr]">
        <div>
          <h2 className="mb-2 font-bold">Listing description</h2>
          <p className="whitespace-pre-wrap text-[14px]">{row.description || "No description."}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {row.screenshots.map((shotUrl) => (
            <button key={shotUrl} type="button" onClick={() => setShot(shotUrl)}>
              <img src={shotUrl} alt="" className="h-24 w-full rounded-xl object-cover" />
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2 text-[14px]">
        {line("Monetization enabled", row.monetized)}
        {line("Promotion methods", row.promotion)}
        {line("Expense sources", row.expense_note)}
        {line("Income sources", row.income_note)}
        {line("To support the channel, you need", row.maintain)}
        {line("Content", row.content)}
      </div>
      <div>
        <p className="font-bold">Discussion: {row.discussions || 0}</p>
        <p className="text-[12px] text-[#94a3b8]">Times a deal was opened on this account.</p>
      </div>
      {shot && (
        <button type="button" className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" onClick={() => setShot("")}>
          <img src={shot} alt="" className="max-h-[90vh] max-w-full rounded-2xl" />
        </button>
      )}
    </div>
  );
}
