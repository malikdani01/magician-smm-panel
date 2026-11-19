import { useEffect, useRef, useState, type PointerEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, FileText, Image as ImageIcon, Mic, Paperclip, Pause, Play, Send } from "lucide-react";
import { Authed } from "@/components/gate";
import { getDeskRole } from "@/lib/admin.functions";
import { adminTicketAction, adminTickets, myTicketMessages, myTickets, openMyTicket, sendTicketMessage, supportFace } from "@/lib/support.functions";

type TicketRow = { id: string; subject: string; status: string; email: string; name: string; avatar: string; body?: string; created_at?: string; unread?: boolean };
type MessageRow = { id: string; sender: string; kind: string; body: string; file_name: string; created_at?: string };
type Face = { name: string; avatar: string };

export const Route = createFileRoute("/support")({
  component: () => (
    <Authed>
      <Support />
    </Authed>
  ),
});

const EMOJI = ["😀", "😁", "😂", "🤣", "😊", "😍", "😘", "🙏", "👍", "👎", "🔥", "❤️", "💯", "🎉", "😢", "😮", "🤔", "😎", "✅", "❌", "⚠️", "📎"];
const FAQ = [
  ["How fast is delivery?", "Orders stay on your ledger and drip by the schedule you set."],
  ["Why is Place Order disabled?", "The wallet has to cover the total. Add funds on the wallet page."],
  ["Can I change ratios?", "Yes. Settings stores your organic ratios, and the order page has a per-type Settings panel."],
];

function Support() {
  const [admin, setAdmin] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    getDeskRole().then((role) => setAdmin(role === "admin")).catch(() => setAdmin(false)).finally(() => setReady(true));
  }, []);
  if (!ready) return null;
  return admin ? <AdminDesk /> : <UserDesk />;
}

function UserDesk() {
  const [rows, setRows] = useState<TicketRow[]>([]);
  const [face, setFace] = useState<Face>({ name: "Admin", avatar: "" });
  const [open, setOpen] = useState(false);
  const [faq, setFaq] = useState(false);
  const [active, setActive] = useState<TicketRow | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [note, setNote] = useState("");

  function load() {
    myTickets().then((list) => {
      const openRows = list.filter((row) => row.status !== "closed");
      setRows(openRows);
      setActive((current) => current ? openRows.find((row) => row.id === current.id) || null : null);
    }).catch(() => setRows([]));
  }
  useEffect(() => {
    load();
    supportFace().then(setFace).catch(() => undefined);
    const timer = window.setInterval(load, 4000);
    return () => window.clearInterval(timer);
  }, []);

  async function send() {
    try {
      await openMyTicket({ data: { subject, body } });
      setSubject("");
      setBody("");
      setOpen(false);
      setNote("Ticket sent. It stays pending until Admin accepts it.");
      load();
    } catch (err: unknown) {
      setNote(err instanceof Error ? err.message : "Could not open the ticket.");
    }
  }

  if (active) return <Chat ticket={active} mine face={face} onClose={() => { setActive(null); load(); }} />;

  const pending = rows.filter((row) => row.status === "pending").length;
  const live = rows.filter((row) => row.status === "open").length;

  return (
    <div className="mx-auto max-w-xl space-y-4 pb-8">
      <section className="desk-card flex items-center justify-between gap-3 p-4">
        <div>
          <h1 className="text-[22px] font-bold text-white">Support Center</h1>
          <p className="text-[13px] text-white/60">Orders, payments, and account help</p>
        </div>
        <button type="button" onClick={() => setOpen(true)} className="shrink-0 rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-violet-500/30">+ New Ticket</button>
      </section>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[["Total", rows.length], ["Waiting", pending], ["Live", live]].map(([label, value]) => (
          <article key={String(label)} className="desk-card p-3">
            <p className="text-[18px] font-bold text-white">{value}</p>
            <p className="text-[11px] text-white/50">{label}</p>
          </article>
        ))}
      </div>
      <section className="desk-card p-4">
        <p className="font-semibold text-white">Your tickets</p>
        {rows.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-[13px] text-white/55">No tickets yet. Tell us what happened and Admin will open the chat.</p>
            <button type="button" onClick={() => setOpen(true)} className="mt-3 h-10 rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 px-4 text-[13px] font-semibold text-white">Create your first ticket</button>
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {rows.map((row) => (
              <li key={row.id}>
                <button type="button" onClick={() => setActive(row)} className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-left">
                  <FaceMark face={row.status === "open" ? face : { name: "A", avatar: "" }} letter={row.status === "open" ? "A" : row.subject.slice(0, 1)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-white">{row.status === "open" ? "Admin" : row.subject}</span>
                    <span className="block truncate text-[12px] text-white/50">{row.status === "open" ? "Accepted. Tap to chat." : row.status === "closed" ? "This ticket is closed." : "Your ticket is pending."}</span>
                  </span>
                  <Status status={row.status} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="desk-card flex items-center justify-between gap-3 p-4">
        <div>
          <p className="font-semibold text-white">Need quick help?</p>
          <p className="text-[12px] text-white/50">Read the short answers before you open a ticket.</p>
        </div>
        <button type="button" onClick={() => setFaq((value) => !value)} className="rounded-full border border-white/15 px-3 py-2 text-[12px] font-semibold text-white">View FAQ</button>
      </section>
      {faq && FAQ.map(([q, a]) => <article key={q} className="desk-card p-3 text-[13px]"><b className="text-white">{q}</b><p className="text-white/60">{a}</p></article>)}
      {open && (
        <section className="desk-card p-4">
          <p className="font-semibold text-white">New ticket</p>
          <input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Subject" className="field mt-3" />
          <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="What happened?" className="field mt-2 h-24 py-3" />
          <button type="button" onClick={send} className="mt-3 h-11 w-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 text-[13px] font-semibold text-white">Send ticket</button>
        </section>
      )}
      {note && <p className="text-center text-[13px] text-amber-200">{note}</p>}
      <DeskStyle />
    </div>
  );
}

function AdminDesk() {
  const [rows, setRows] = useState<TicketRow[]>([]);
  const [active, setActive] = useState<TicketRow | null>(null);
  const [note, setNote] = useState("");
  const [face, setFace] = useState<Face>({ name: "Admin", avatar: "" });
  const [filter, setFilter] = useState<"all" | "new" | "unread">("all");

  function load() {
    adminTickets().then((list) => {
      const openRows = list.filter((row) => row.status !== "closed");
      setRows(openRows);
      setActive((current) => current ? openRows.find((row) => row.id === current.id) || null : null);
    }).catch(() => setRows([]));
  }
  useEffect(() => {
    load();
    supportFace().then(setFace).catch(() => undefined);
    const timer = window.setInterval(load, 4000);
    return () => window.clearInterval(timer);
  }, []);

  async function act(id: string, status: "open" | "closed") {
    try {
      await adminTicketAction({ data: { id, status } });
      setNote(status === "open" ? "Ticket accepted. The user can chat now." : "Ticket closed. It is gone for you and the user.");
      if (status === "closed") setActive(null);
      load();
    } catch (err: unknown) {
      setNote(err instanceof Error ? err.message : "Could not update the ticket.");
    }
  }

  if (active) {
    return (
      <Chat
        ticket={active}
        face={face}
        onClose={() => { setActive(null); load(); }}
        onAccept={active.status === "pending" ? () => act(active.id, "open") : undefined}
        onEnd={active.status === "open" ? () => act(active.id, "closed") : undefined}
      />
    );
  }

  const shown = rows.filter((row) => {
    if (filter === "new") return !!row.created_at && Date.now() - new Date(row.created_at).getTime() < 24 * 60 * 60 * 1000;
    if (filter === "unread") return !!row.unread;
    return true;
  });

  return (
    <div className="mx-auto max-w-xl space-y-3 pb-8">
      <section className="desk-card p-4">
        <h1 className="text-[22px] font-bold text-white">Support inbox</h1>
        <p className="text-[13px] text-white/60">Accept a ticket to start the chat. End it when the complaint is solved.</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {([["all", "All"], ["new", "New"], ["unread", "Unread"]] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setFilter(id)} className={`h-10 rounded-full text-[13px] font-semibold ${filter === id ? "bg-gradient-to-r from-violet-500 to-cyan-400 text-white" : "border border-white/15 text-white"}`}>{label}</button>
          ))}
        </div>
      </section>
      {shown.length === 0 && <p className="desk-card p-8 text-center text-[13px] text-white/50">{filter === "new" ? "No tickets in the last 24 hours." : filter === "unread" ? "No unread messages." : "No complaints yet."}</p>}
      {shown.map((row) => (
        <button key={row.id} type="button" onClick={() => { setRows((list) => list.map((item) => item.id === row.id ? { ...item, unread: false } : item)); setActive(row); }} className="desk-card flex w-full items-center gap-3 p-3 text-left">
          <FaceMark face={{ name: row.name, avatar: row.avatar }} letter={row.name.slice(0, 1)} />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 font-semibold text-white">{row.name}{row.unread && <span className="size-2 rounded-full bg-cyan-300" />}</span>
            <span className="block truncate text-[12px] text-white/45">{row.email}</span>
            <span className="mt-0.5 block truncate text-[12px] text-violet-200">{row.subject || "New message"}</span>
          </span>
          <Status status={row.status} />
        </button>
      ))}
      {note && <p className="text-center text-[13px] text-amber-200">{note}</p>}
      <DeskStyle />
    </div>
  );
}

function Chat({ ticket, onClose, mine = false, face, onAccept, onEnd }: { ticket: TicketRow; onClose: () => void; mine?: boolean; face: Face; onAccept?: () => void; onEnd?: () => void }) {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [attach, setAttach] = useState(false);
  const [queue, setQueue] = useState<File[]>([]);
  const [queueKind, setQueueKind] = useState("image");
  const [photo, setPhoto] = useState("");
  const imageOne = useRef<HTMLInputElement>(null);
  const imageMany = useRef<HTMLInputElement>(null);
  const fileOne = useRef<HTMLInputElement>(null);
  const fileMany = useRef<HTMLInputElement>(null);
  const holdMenu = useRef(0);
  const heldMenu = useRef(false);
  const [canceling, setCanceling] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const holding = useRef(false);
  const drop = useRef(false);
  const startX = useRef(0);
  const ticks = useRef(0);
  const box = useRef<HTMLDivElement>(null);
  const title = mine ? (ticket.status === "open" ? "Admin" : ticket.subject) : ticket.name;
  const sub = mine ? ticket.status === "pending" ? "Waiting for Admin" : ticket.status === "open" ? "Live chat" : "Closed" : ticket.email;

  async function load() {
    setMessages(await myTicketMessages({ data: ticket.id }).catch(() => []));
  }
  useEffect(() => {
    load();
    const timer = window.setInterval(load, 4000);
    return () => window.clearInterval(timer);
  }, [ticket.id]);
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }); }, [messages.length]);

  async function send(kind: string, body: string, fileName = "") {
    try {
      await sendTicketMessage({ data: { ticketId: ticket.id, kind, body, fileName } });
      setText("");
      setNote("");
      load();
    } catch (err: unknown) {
      setNote(err instanceof Error ? err.message : "Could not send.");
    }
  }

  function pickFile(file: File, kind: string) {
    const reader = new FileReader();
    reader.onload = () => send(kind, String(reader.result || ""), file.name);
    reader.onerror = () => setNote("That file could not be read.");
    reader.readAsDataURL(file);
  }

  function takeFiles(list: FileList | null, kind: string) {
    const files = Array.from(list || []);
    setAttach(false);
    if (!files.length) return;
    if (files.length === 1) { pickFile(files[0], kind); return; }
    setQueueKind(kind);
    setQueue(files);
  }

  function sendQueue() {
    queue.forEach((file) => pickFile(file, queueKind));
    setQueue([]);
  }

  function armMenu(openMany: () => void) {
    heldMenu.current = false;
    window.clearTimeout(holdMenu.current);
    holdMenu.current = window.setTimeout(() => {
      heldMenu.current = true;
      setAttach(false);
      openMany();
    }, 420);
  }

  function tapMenu(openOne: () => void) {
    window.clearTimeout(holdMenu.current);
    if (heldMenu.current) return;
    setAttach(false);
    openOne();
  }

  async function pressMic(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (recorder.current) return;
    holding.current = true;
    drop.current = false;
    startX.current = event.clientX;
    setCanceling(false);
    event.currentTarget.setPointerCapture(event.pointerId);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
    if (!stream || !holding.current) {
      stream?.getTracks().forEach((track) => track.stop());
      if (!stream) setNote("Allow the microphone to send a voice note.");
      return;
    }
    const chunks: Blob[] = [];
    const media = new MediaRecorder(stream);
    const started = Date.now();
    media.ondataavailable = (item) => { if (item.data.size) chunks.push(item.data); };
    media.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      window.clearInterval(ticks.current);
      setRecording(false);
      setSeconds(0);
      setCanceling(false);
      recorder.current = null;
      const taken = Math.max(1, Math.round((Date.now() - started) / 1000));
      if (drop.current || Date.now() - started < 400 || !chunks.length) return;
      const blob = new Blob(chunks, { type: media.mimeType || "audio/webm" });
      const reader = new FileReader();
      reader.onload = () => send("voice", String(reader.result || ""), `voice|${taken}`);
      reader.readAsDataURL(blob);
    };
    media.start(200);
    recorder.current = media;
    setRecording(true);
    setSeconds(0);
    ticks.current = window.setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 200);
  }

  function slideMic(event: PointerEvent<HTMLButtonElement>) {
    const away = startX.current - event.clientX > 70;
    drop.current = away;
    setCanceling(away);
  }

  function releaseMic() {
    holding.current = false;
    const media = recorder.current;
    if (media && media.state === "recording") media.stop();
  }

  return (
    <section className="desk-card mx-auto flex min-h-[70vh] max-w-xl flex-col">
      <header className="flex items-center gap-3 border-b border-white/10 px-3 py-3">
        <button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-full bg-white/10 text-white" aria-label="Back"><ArrowLeft className="size-4" /></button>
        <FaceMark face={mine ? face : { name: ticket.name, avatar: ticket.avatar }} letter={mine ? "A" : ticket.name.slice(0, 1)} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-white">{title}</p>
          <p className="truncate text-[12px] text-white/50">{sub}</p>
        </div>
        {onAccept && <button type="button" onClick={onAccept} className="h-9 rounded-full bg-emerald-500 px-3 text-[12px] font-bold text-white">Accept</button>}
        {onEnd && <button type="button" onClick={onEnd} className="h-9 rounded-full bg-rose-500 px-3 text-[12px] font-bold text-white">End</button>}
      </header>
      <div ref={box} className="flex-1 space-y-3 overflow-y-auto px-3 py-4" style={{ background: "radial-gradient(circle at top, rgba(124,58,237,.18), transparent 55%)" }}>
        {messages.map((item) => {
          const own = mine ? item.sender === "user" : item.sender === "admin";
          const fromAdmin = item.sender === "admin";
          const who = fromAdmin ? face : { name: ticket.name || "Member", avatar: ticket.avatar || "" };
          return (
            <div key={item.id} className={`flex items-end gap-2 ${own ? "justify-end" : "justify-start"}`}>
              {!own && <FaceMark face={who} letter={(who.name || "M").slice(0, 1)} small />}
              <div className="max-w-[78%]">
                <p className={`mb-1 px-1 text-[11px] font-semibold ${own ? "text-right text-violet-200" : "text-cyan-200"}`}>{fromAdmin ? "Admin" : who.name}</p>
                <div className="rounded-2xl px-3 py-2 text-[14px] leading-5 shadow-md" style={own ? { background: "linear-gradient(135deg,#7c3aed,#0891b2)", color: "#fff", borderBottomRightRadius: 6 } : { background: "color-mix(in oklab, var(--desk-text) 8%, var(--desk-card))", color: "var(--desk-text)", border: "1px solid var(--desk-line)", borderBottomLeftRadius: 6 }}>
                  {item.kind === "image" && <button type="button" onClick={() => setPhoto(item.body)} className="block"><img src={item.body} alt="" className="max-h-52 rounded-xl" /></button>}
                  {item.kind === "voice" && <VoiceNote src={item.body} stored={voiceSeconds(item.file_name)} />}
                  {item.kind === "file" && <FileChip body={item.body} name={item.file_name || "File"} />}
                  {item.kind === "text" && <p className="chat-text whitespace-pre-wrap break-words">{item.body}</p>}
                  {item.created_at && <p className="mt-1 text-right text-[10px] opacity-70">{clock(item.created_at)}</p>}
                </div>
              </div>
              {own && <FaceMark face={who} letter={(who.name || "A").slice(0, 1)} small />}
            </div>
          );
        })}
      </div>
      {ticket.status !== "open" && <p className="px-4 pb-3 text-center text-[12px] text-amber-200">{ticket.status === "pending" ? (mine ? "Your ticket is pending. Chat opens after Admin accepts it." : "Accept the ticket to start chatting.") : "This ticket is closed."}</p>}
      {ticket.status === "open" && (
        <div className="relative border-t border-white/10 p-2">
          {queue.length > 0 && (
            <div className="mb-2 flex items-center gap-2 overflow-x-auto rounded-2xl border border-white/10 p-2">
              {queue.map((file) => <span key={file.name + file.size} className="shrink-0 rounded-xl bg-white/10 px-2 py-1 text-[11px]">{queueKind === "image" ? "Image" : "File"} · {file.name.slice(0, 18)}</span>)}
              <button type="button" onClick={sendQueue} className="btn-gradient ml-auto h-9 shrink-0 rounded-full px-3 text-[12px] font-bold text-white">Send {queue.length}</button>
              <button type="button" onClick={() => setQueue([])} className="h-9 shrink-0 rounded-full px-3 text-[12px]">Cancel</button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <div className="flex min-w-0 flex-1 items-center rounded-full border border-white/10 bg-white/5 px-2">
              <button type="button" onClick={() => { setEmojiOpen((value) => !value); setAttach(false); }} className="emoji-key shrink-0" aria-label="Emoji">😊</button>
              {recording ? (
                <p className={`flex-1 px-2 text-[13px] font-semibold ${canceling ? "text-rose-300" : ""}`}>{canceling ? "Release to cancel" : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}  ·  slide left to cancel`}</p>
              ) : (
                <input value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && text.trim()) send("text", text.trim()); }} placeholder="Message" className="chat-write" />
              )}
              {!recording && (
                <div className="relative z-40">
                  {attach && <button type="button" className="fixed inset-0 z-30 cursor-default" aria-label="Close attach menu" onClick={() => setAttach(false)} />}
                  <button type="button" onClick={() => { setAttach((value) => !value); setEmojiOpen(false); }} className="relative z-40 grid size-9 shrink-0 place-items-center rounded-full" aria-label="Attach"><Paperclip className="size-4" /></button>
                  {attach && (
                    <div className="absolute bottom-12 right-0 z-40 w-40 overflow-hidden rounded-2xl border border-white/15 bg-[var(--desk-card)] text-[var(--desk-text)] shadow-2xl">
                      <button type="button" onPointerDown={() => armMenu(() => imageMany.current?.click())} onPointerUp={() => tapMenu(() => imageOne.current?.click())} className="flex w-full items-center gap-2 px-3 py-3 text-left text-[13px] font-semibold"><ImageIcon className="size-4" /> Image</button>
                      <button type="button" onPointerDown={() => armMenu(() => fileMany.current?.click())} onPointerUp={() => tapMenu(() => fileOne.current?.click())} className="flex w-full items-center gap-2 border-t border-white/10 px-3 py-3 text-left text-[13px] font-semibold"><FileText className="size-4" /> File</button>
                    </div>
                  )}
                </div>
              )}
            </div>
            {text.trim() && !recording ? (
              <button type="button" onClick={() => send("text", text.trim())} className="btn-gradient grid size-12 shrink-0 place-items-center rounded-full text-white" aria-label="Send"><Send className="size-4" /></button>
            ) : (
              <button type="button" onPointerDown={pressMic} onPointerMove={slideMic} onPointerUp={releaseMic} onPointerCancel={releaseMic} onContextMenu={(event) => event.preventDefault()} className={`btn-gradient grid size-12 shrink-0 place-items-center rounded-full text-white ${recording ? "scale-110" : ""}`} aria-label="Hold to record"><Mic className="size-5" /></button>
            )}
          </div>
          <input ref={imageOne} type="file" accept="image/*" className="hidden" onChange={(event) => { takeFiles(event.target.files, "image"); event.target.value = ""; }} />
          <input ref={imageMany} type="file" accept="image/*" multiple className="hidden" onChange={(event) => { takeFiles(event.target.files, "image"); event.target.value = ""; }} />
          <input ref={fileOne} type="file" className="hidden" onChange={(event) => { takeFiles(event.target.files, "file"); event.target.value = ""; }} />
          <input ref={fileMany} type="file" multiple className="hidden" onChange={(event) => { takeFiles(event.target.files, "file"); event.target.value = ""; }} />
          {emojiOpen && (
            <div className="emoji-pop">
              {EMOJI.map((item) => (
                <button key={item} type="button" className="emoji-key" onClick={() => setText((value) => `${value}${item}`)}>{item}</button>
              ))}
            </div>
          )}
        </div>
      )}
      {note && <p className="px-4 pb-3 text-center text-[12px] text-rose-300">{note}</p>}
      {photo && (
        <button type="button" onClick={() => setPhoto("")} className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" aria-label="Close image">
          <img src={photo} alt="" className="max-h-[85vh] max-w-full rounded-2xl" />
        </button>
      )}
      <DeskStyle />
    </section>
  );
}

function openSaved(body: string, name: string, download: boolean) {
  if (!body.startsWith("data:")) {
    const link = document.createElement("a");
    link.href = body;
    if (download) link.download = name || "file";
    else link.target = "_blank";
    link.rel = "noopener";
    link.click();
    return;
  }
  const parts = body.split(",");
  const mime = parts[0].match(/data:(.*?);/)?.[1] || "application/octet-stream";
  const binary = atob(parts[1] || "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  if (download) {
    const link = document.createElement("a");
    link.href = url;
    link.download = name || "file";
    link.click();
  } else window.open(url, "_blank", "noopener");
  window.setTimeout(() => URL.revokeObjectURL(url), 20000);
}

function FileChip({ body, name }: { body: string; name: string }) {
  return (
    <span className="flex items-center gap-2">
      <button type="button" onClick={() => openSaved(body, name, false)} className="underline">{name}</button>
      <button type="button" onClick={() => openSaved(body, name, true)} className="rounded-full bg-white/20 px-2 py-1 text-[11px] font-bold">Download</button>
    </span>
  );
}

function voiceSeconds(name: string) {
  const hit = /^voice\|(\d+)/.exec(name || "");
  return hit ? Number(hit[1]) : 0;
}

function clock(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function fmt(total: number) {
  const safe = Number.isFinite(total) && total > 0 && total < 3600 ? Math.round(total) : 0;
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

export function VoiceNote({ src, stored }: { src: string; stored: number }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [on, setOn] = useState(false);
  const [at, setAt] = useState(0);
  const [total, setTotal] = useState(stored);

  useEffect(() => {
    const el = audio.current;
    if (!el) return;
    const read = () => {
      const length = el.duration;
      if (Number.isFinite(length) && length > 0 && length < 3600) setTotal(Math.round(length));
    };
    const onMeta = () => {
      read();
      if (Number.isFinite(el.duration) && el.duration < 3600) return;
      const once = () => {
        el.removeEventListener("timeupdate", once);
        read();
        try { el.currentTime = 0; } catch { /* ignore */ }
      };
      el.addEventListener("timeupdate", once);
      try { el.currentTime = 1e101; } catch { /* ignore */ }
    };
    const onTime = () => setAt(el.currentTime || 0);
    const onEnd = () => { setOn(false); setAt(0); };
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("durationchange", read);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("ended", onEnd);
    return () => {
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("durationchange", read);
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("ended", onEnd);
    };
  }, [src]);

  const span = total || stored || 0;
  const ratio = span ? Math.min(1, at / span) : 0;
  return (
    <div className="flex min-w-[180px] items-center gap-2">
      <audio ref={audio} src={src} preload="metadata" className="hidden" />
      <button type="button" onClick={() => { const el = audio.current; if (!el) return; if (el.paused) { void el.play(); setOn(true); } else { el.pause(); setOn(false); } }} className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-[#4c1d95]" aria-label={on ? "Pause" : "Play"}>
        {on ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
      </button>
      <span className="flex h-6 flex-1 items-center gap-[2px]">
        {Array.from({ length: 16 }, (_, index) => <span key={index} className="w-[3px] rounded-full bg-current" style={{ height: 5 + ((index * 5) % 14), opacity: index / 16 <= ratio ? 1 : 0.35 }} />)}
      </span>
      <span className="w-9 text-right text-[11px] tabular-nums">{fmt(on && at > 0 ? at : span)}</span>
    </div>
  );
}

function FaceMark({ face, letter, small = false }: { face: Face; letter: string; small?: boolean }) {
  const size = small ? "size-8 text-[11px]" : "size-11 text-[14px]";
  if (face.avatar) return <img src={face.avatar} alt="" className={`${size} shrink-0 rounded-full object-cover ring-2 ring-violet-400/50`} />;
  return <span className={`${size} grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 font-bold text-white`}>{letter.toUpperCase()}</span>;
}

function Status({ status }: { status: string }) {
  const live = status === "open";
  const closed = status === "closed";
  const label = live ? "Live" : closed ? "Closed" : "Pending";
  const color = live ? "#34d399" : closed ? "#94a3b8" : "#fbbf24";
  return <span className="rounded-full px-2 py-1 text-[10px] font-bold uppercase" style={{ color, background: `${color}22` }}>{label}</span>;
}

function DeskStyle() {
  return (
    <style>{`
      .desk-card { border-radius: 24px; border: 1px solid var(--desk-line); background: var(--desk-card); color: var(--desk-text); }
      .desk-card [class*="text-white"] { color: var(--desk-text) !important; }
      .desk-card [class*="bg-gradient"],
      .desk-card [class*="bg-emerald"],
      .desk-card [class*="bg-rose"] { color: #fff !important; }
      .field { height: 44px; width: 100%; border-radius: 16px; border: 1px solid var(--desk-line); background: color-mix(in oklab, var(--desk-card) 82%, transparent); padding: 0 12px; color: var(--desk-text); outline: none; }
      .chat-bar { display: flex; align-items: center; width: 100%; overflow: hidden; border-radius: 999px; border: 1px solid var(--desk-line); background: color-mix(in oklab, var(--desk-card) 72%, black 28%); padding: 4px 4px 4px 16px; }
      .chat-write { flex: 1 1 auto !important; width: 100% !important; min-width: 0 !important; height: 42px !important; margin: 0 !important; padding: 0 8px 0 0 !important; border: 0 !important; border-radius: 999px !important; background: transparent !important; box-shadow: none !important; outline: none !important; color: var(--desk-text) !important; }
    `}</style>
  );
}
