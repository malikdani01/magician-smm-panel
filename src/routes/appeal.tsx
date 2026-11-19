import { useEffect, useRef, useState, type PointerEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, FileText, Image as ImageIcon, Mic, Paperclip, Send } from "lucide-react";
import { VoiceNote } from "@/routes/support";
import { Mark, inputClass } from "@/components/shell";
import { Starfield } from "@/components/stars";
import { lockedDesk, lockedMessages, lockedSend, raiseTicket } from "@/lib/support.functions";

export const Route = createFileRoute("/appeal")({ component: Appeal });

type Ticket = { id: string; subject: string; status: string; body: string };
type Msg = { id: string; sender: string; kind: string; body: string; file_name: string };
type Face = { name: string; avatar: string };

function Appeal() {
  const [email, setEmail] = useState("");
  const [lock, setLock] = useState("");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [face, setFace] = useState<Face>({ name: "Admin", avatar: "" });
  const [active, setActive] = useState<Ticket | null>(null);
  const [subject, setSubject] = useState("Account complaint");
  const [body, setBody] = useState("");
  const [note, setNote] = useState("");
  const [accepted, setAccepted] = useState("");

  async function load(address: string) {
    const desk = await lockedDesk({ data: address });
    setLock(desk.lock);
    setFace(desk.face);
    setTickets(desk.tickets);
    setActive((current) => current ? desk.tickets.find((row) => row.id === current.id) || current : null);
    const live = desk.tickets.find((row) => row.status === "open");
    if (live) setAccepted("Admin accepted your ticket. You can chat now.");
  }

  useEffect(() => {
    const address = sessionStorage.getItem("appeal-email") || "";
    setEmail(address);
    if (!address) return;
    load(address).catch((err: unknown) => setNote(err instanceof Error ? err.message : "Support chat is closed."));
    const timer = window.setInterval(() => load(address).catch(() => undefined), 4000);
    return () => window.clearInterval(timer);
  }, []);

  async function sendTicket() {
    try {
      await raiseTicket({ data: { email, name: email.split("@")[0] || "Member", subject, body } });
      setBody("");
      setNote("Your ticket is pending.");
      await load(email);
    } catch (err: unknown) {
      setNote(err instanceof Error ? err.message : "Could not send the ticket.");
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-6 text-white">
      <Starfield />
      <div className="relative z-10 mx-auto w-full max-w-md">
        <Link to="/login" className="inline-flex items-center gap-2 text-sm text-white/80"><ArrowLeft className="size-4" /> Back to login</Link>
        <div className="mb-4 mt-6 flex justify-center"><Mark /></div>
        <section className="glass-card rounded-3xl border p-5">
          <h1 className="text-2xl font-semibold">Support chat</h1>
          <p className="mt-1 text-sm text-white/70">{lock === "blocked" ? "You are blocked. Only this chat is open until an admin unblocks you." : lock === "suspended" ? "You are suspended. Only this chat is open until an admin unsuspends you." : "This page is only for a suspended or blocked account."}</p>
          {!email && <p className="mt-3 text-sm text-red-400">Sign in on the login page first. The support button appears after the account is blocked or suspended.</p>}
          {email && (
            <>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-white/50">Raise a ticket</p>
              <input value={subject} onChange={(event) => setSubject(event.target.value)} className={`${inputClass} mt-2`} placeholder="Subject" />
              <textarea value={body} onChange={(event) => setBody(event.target.value)} className={`${inputClass} mt-2 h-24 py-2`} placeholder="What happened?" />
              <button type="button" onClick={sendTicket} className="mt-2 h-10 w-full rounded-xl bg-amber-300 text-sm font-semibold text-slate-950">Send ticket</button>
            </>
          )}
          {accepted && <p className="mt-3 rounded-xl bg-emerald-500/15 px-3 py-2 text-sm text-emerald-200">{accepted}</p>}
          {note && <p className="mt-3 text-sm text-white/80">{note}</p>}
        </section>
        <div className="mt-3 space-y-2">
          {tickets.map((ticket) => (
            <article key={ticket.id} className="glass-card rounded-2xl border p-3">
              {ticket.status === "pending" && <p className="text-sm text-amber-200">Your ticket is pending.</p>}
              {ticket.status === "closed" && <p className="text-sm text-white/60">This ticket is closed. Raise a new one if you still need help.</p>}
              {ticket.status === "open" ? (
                <button type="button" onClick={() => setActive(ticket)} className="flex w-full items-center gap-3 text-left">
                  {face.avatar ? <img src={face.avatar} alt="" className="size-11 rounded-full object-cover" /> : <span className="grid size-11 place-items-center rounded-full bg-violet-500 text-sm font-bold">A</span>}
                  <span>
                    <span className="block font-semibold">Admin</span>
                    <span className="block text-xs text-emerald-200">Tap to open the chat</span>
                  </span>
                </button>
              ) : <p className="mt-1 text-sm text-white/80">{ticket.subject}</p>}
            </article>
          ))}
        </div>
        {active && email && <LockedChat email={email} ticket={active} face={face} onClose={() => setActive(null)} />}
      </div>
    </main>
  );
}

function LockedChat({ email, ticket, face, onClose }: { email: string; ticket: Ticket; face: Face; onClose: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [attach, setAttach] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const holding = useRef(false);
  const ticks = useRef(0);
  const box = useRef<HTMLDivElement>(null);

  async function load() {
    setMessages(await lockedMessages({ data: { email, ticketId: ticket.id } }).catch(() => []));
  }
  useEffect(() => {
    load();
    const timer = window.setInterval(load, 4000);
    return () => window.clearInterval(timer);
  }, [ticket.id]);
  useEffect(() => { box.current?.scrollTo(0, box.current.scrollHeight); }, [messages.length]);

  async function send(kind: string, body: string, fileName = "") {
    try {
      await lockedSend({ data: { email, ticketId: ticket.id, kind, body, fileName } });
      setText("");
      setNote("");
      load();
    } catch (err: unknown) {
      setNote(err instanceof Error ? err.message : "Could not send.");
    }
  }

  function pick(file: File, kind: string) {
    const reader = new FileReader();
    reader.onload = () => send(kind, String(reader.result || ""), file.name);
    reader.onerror = () => setNote("That file could not be read.");
    reader.readAsDataURL(file);
  }

  async function pressMic(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (recorder.current) return;
    holding.current = true;
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
      recorder.current = null;
      if (Date.now() - started < 400 || !chunks.length) return;
      const blob = new Blob(chunks, { type: media.mimeType || "audio/webm" });
      const reader = new FileReader();
      reader.onload = () => send("voice", String(reader.result || ""), `voice|${Math.max(1, Math.round((Date.now() - started) / 1000))}`);
      reader.readAsDataURL(blob);
    };
    media.start(200);
    recorder.current = media;
    setRecording(true);
    setSeconds(0);
    ticks.current = window.setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 200);
  }

  function releaseMic() {
    holding.current = false;
    const media = recorder.current;
    if (media && media.state === "recording") media.stop();
  }

  return (
    <section className="glass-card mt-3 rounded-3xl border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {face.avatar ? <img src={face.avatar} alt="" className="size-9 rounded-full object-cover" /> : <span className="grid size-9 place-items-center rounded-full bg-violet-500 text-xs font-bold">A</span>}
          <p className="font-semibold">Admin</p>
        </div>
        <button type="button" onClick={onClose} className="text-xs text-white/60">Close</button>
      </div>
      <div ref={box} className="mt-3 max-h-80 space-y-2 overflow-y-auto">
        {messages.map((item) => (
          <div key={item.id} className={`flex ${item.sender === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[78%] rounded-3xl px-3.5 py-2.5 text-sm leading-5 ${item.sender === "user" ? "bg-gradient-to-br from-violet-600 to-cyan-500 text-white" : "border border-white/15 bg-white/10 text-white"}`}>
              {item.sender === "admin" && <p className="mb-1 text-[11px] font-semibold text-amber-200">Admin</p>}
              {item.kind === "image" && <img src={item.body} alt="" className="max-h-40 rounded-xl" />}
              {item.kind === "voice" && <VoiceNote src={item.body} stored={Number((item.file_name || "").split("|")[1]) || 0} />}
              {item.kind === "file" && <a href={item.body} download={item.file_name || "file"} className="underline">{item.file_name || "File"}</a>}
              {item.kind === "text" && <p className="whitespace-pre-wrap">{item.body}</p>}
            </div>
          </div>
        ))}
      </div>
      {ticket.status !== "open" && <p className="mt-3 text-xs text-amber-200">{ticket.status === "pending" ? "Your ticket is pending." : "This ticket is closed."}</p>}
      {ticket.status === "open" && (
        <div className="relative mt-3">
          {attach && (
            <div className="absolute bottom-14 right-14 z-10 w-36 overflow-hidden rounded-2xl border border-white/10 bg-[#120c22]">
              <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm"><ImageIcon className="size-4" /> Image<input type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; setAttach(false); if (file) pick(file, "image"); event.target.value = ""; }} /></label>
              <label className="flex cursor-pointer items-center gap-2 border-t border-white/10 px-3 py-2 text-sm"><FileText className="size-4" /> File<input type="file" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; setAttach(false); if (file) pick(file, "file"); event.target.value = ""; }} /></label>
            </div>
          )}
          <div className="flex items-end gap-2">
            <div className="flex min-w-0 flex-1 items-center rounded-full border border-white/10 px-2">
              {recording ? <p className="flex-1 px-2 text-sm">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")} · release to send</p> : <input value={text} onChange={(event) => setText(event.target.value)} placeholder="Message" className="chat-write" />}
              {!recording && <button type="button" onClick={() => setAttach((value) => !value)} className="grid size-9 place-items-center" aria-label="Attach"><Paperclip className="size-4" /></button>}
            </div>
            {text.trim() && !recording ? (
              <button type="button" onClick={() => send("text", text.trim())} className="btn-gradient grid size-12 place-items-center rounded-full text-white" aria-label="Send"><Send className="size-4" /></button>
            ) : (
              <button type="button" onPointerDown={pressMic} onPointerUp={releaseMic} onPointerCancel={releaseMic} onContextMenu={(event) => event.preventDefault()} className="btn-gradient grid size-12 place-items-center rounded-full text-white" aria-label="Hold to record"><Mic className="size-5" /></button>
            )}
          </div>
        </div>
      )}
      {note && <p className="mt-2 text-xs text-red-300">{note}</p>}
    </section>
  );
}
