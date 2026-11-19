import { useEffect, useRef, useState, type PointerEvent } from "react";
import { FileText, Image as ImageIcon, Mic, Paperclip, Send } from "lucide-react";
import { readDealChat, sendDealChat } from "@/lib/market.functions";

type Message = { id: string; sender: string; kind: string; body: string; file_name: string };

export function DealChat({ dealId, asAdmin }: { dealId: string; asAdmin: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [attach, setAttach] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const holding = useRef(false);
  const ticks = useRef(0);

  async function load() {
    setMessages((await readDealChat({ data: dealId }).catch(() => [])) as Message[]);
  }
  useEffect(() => {
    load();
    const timer = window.setInterval(load, 4000);
    return () => window.clearInterval(timer);
  }, [dealId]);
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }); }, [messages.length]);

  async function send(kind: string, body: string, fileName = "") {
    try {
      await sendDealChat({ data: { dealId, kind, body, fileName, asAdmin } });
      setText("");
      setAttach(false);
      setNote("");
      load();
    } catch (err: unknown) {
      setNote(err instanceof Error ? err.message : "Could not send.");
    }
  }

  function pick(file: File, kind: string) {
    const reader = new FileReader();
    reader.onload = () => send(kind, String(reader.result || ""), file.name);
    reader.readAsDataURL(file);
  }

  async function pressMic(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (recorder.current) return;
    holding.current = true;
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
      const taken = Math.max(1, Math.round((Date.now() - started) / 1000));
      if (Date.now() - started < 400 || !chunks.length) return;
      const blob = new Blob(chunks, { type: media.mimeType || "audio/webm" });
      const reader = new FileReader();
      reader.onload = () => send("voice", String(reader.result || ""), `voice|${taken}`);
      reader.readAsDataURL(blob);
    };
    media.start();
    recorder.current = media;
    setRecording(true);
    ticks.current = window.setInterval(() => setSeconds(Math.round((Date.now() - started) / 1000)), 250);
  }

  function releaseMic() {
    holding.current = false;
    if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
  }

  return (
    <div className="overflow-hidden rounded-3xl border" style={{ borderColor: "var(--desk-line)", background: "var(--desk-card)" }}>
      <div ref={box} className="grid max-h-[420px] min-h-64 gap-2 overflow-y-auto p-3">
        {messages.map((message) => {
          const mine = (asAdmin && message.sender === "admin") || (!asAdmin && message.sender === "user");
          return (
            <div key={message.id} className={"max-w-[80%] rounded-2xl px-3 py-2 text-[13px] " + (mine ? "ml-auto bg-violet-600 text-white" : "bg-white/10")}>
              <p className="mb-1 text-[10px] font-bold opacity-70">{message.sender === "admin" ? "Admin" : "Buyer"}</p>
              {message.kind === "image" ? <a href={message.body} target="_blank" rel="noreferrer"><img src={message.body} alt="" className="max-h-48 rounded-xl" /></a> : null}
              {message.kind === "file" ? <a href={message.body} target="_blank" rel="noreferrer" className="underline">{message.file_name || "File"}</a> : null}
              {message.kind === "voice" ? <audio controls src={message.body} className="max-w-full" /> : null}
              {message.kind === "text" ? <p className="whitespace-pre-wrap">{message.body}</p> : null}
            </div>
          );
        })}
        {!messages.length && <p className="text-[12px] text-[#94a3b8]">No messages yet.</p>}
      </div>
      {attach && (
        <div className="flex gap-2 border-t px-3 py-2" style={{ borderColor: "var(--desk-line)" }}>
          <button type="button" className="rounded-xl border px-3 py-2 text-[12px] font-semibold" onClick={() => imageRef.current?.click()}><ImageIcon className="mr-1 inline size-3.5" /> Image</button>
          <button type="button" className="rounded-xl border px-3 py-2 text-[12px] font-semibold" onClick={() => fileRef.current?.click()}><FileText className="mr-1 inline size-3.5" /> File</button>
        </div>
      )}
      <div className="flex items-center gap-2 border-t p-2" style={{ borderColor: "var(--desk-line)" }}>
        <button type="button" className="grid size-10 place-items-center rounded-full bg-violet-600 text-white" onClick={() => setAttach((value) => !value)} aria-label="Attach"><Paperclip className="size-4" /></button>
        <input ref={imageRef} hidden type="file" accept="image/*" multiple onChange={(event) => { Array.from(event.target.files || []).forEach((file) => pick(file, "image")); event.target.value = ""; }} />
        <input ref={fileRef} hidden type="file" multiple onChange={(event) => { Array.from(event.target.files || []).forEach((file) => pick(file, "file")); event.target.value = ""; }} />
        <input className="h-10 flex-1 rounded-full border bg-transparent px-3 text-[13px] outline-none" style={{ borderColor: "var(--desk-line)" }} value={text} placeholder="Message" onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && text.trim()) send("text", text.trim()); }} />
        <button type="button" className={"grid size-10 place-items-center rounded-full text-white " + (recording ? "bg-rose-500" : "bg-violet-600")} aria-label="Voice note" onPointerDown={pressMic} onPointerUp={releaseMic} onPointerLeave={releaseMic}><Mic className="size-4" /></button>
        <button type="button" className="grid size-10 place-items-center rounded-full bg-violet-600 text-white" aria-label="Send" onClick={() => text.trim() && send("text", text.trim())}><Send className="size-4" /></button>
      </div>
      {(recording || note) && <p className="px-3 pb-2 text-[12px] text-[#94a3b8]">{recording ? `Recording ${seconds}s` : note}</p>}
    </div>
  );
}
