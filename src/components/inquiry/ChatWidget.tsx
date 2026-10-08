"use client";

import { cn } from "@/lib/cn";
import { ChevronDown, Loader2, MessageCircle, SendHorizontal, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

interface Msg {
  id: string;
  from: "visitor" | "admin";
  text: string;
  at: string;
  authorName?: string;
}
interface Profile {
  company?: string;
  contactName?: string;
  contact?: string;
}
interface MeResponse {
  messages: Msg[];
  profile: Profile | null;
  unread: number;
}

const OPEN_POLL_MS = 4000;
const CLOSED_POLL_MS = 30000;

function timeLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const hm = d.toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" });
  return d.toDateString() === today.toDateString() ? hm : `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
}

/** Floating "실시간 상담하기" chat for visitors (guests / 화주). Messages land
 * in the admin 문의함 (/inquiries), one thread per visitor browser; admin
 * replies show up here via polling. */
export function ChatWidget({ companyName }: { companyName: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<MeResponse>({ messages: [], profile: null, unread: 0 });
  const [text, setText] = useState("");
  const [profile, setProfile] = useState<Profile>({});
  const [showProfile, setShowProfile] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async (seen: boolean) => {
    try {
      const res = await fetch(`/api/inquiries/me${seen ? "?seen=1" : ""}`, { cache: "no-store" });
      if (!res.ok) return;
      const next = (await res.json()) as MeResponse;
      setData(next);
    } catch {
      // offline - try again on the next tick
    }
  }, []);

  // Poll: often while open (and mark replies seen), rarely while closed (for the badge).
  useEffect(() => {
    const first = setTimeout(() => load(open), 0);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load(open);
    }, open ? OPEN_POLL_MS : CLOSED_POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [open, load]);

  // Keep the newest message in view.
  useLayoutEffect(() => {
    if (open && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [open, data.messages.length]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  const hasProfile = Boolean(data.profile);
  const isFirst = data.messages.length === 0;

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/inquiries/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: body, ...(hasProfile ? {} : profile) }),
      });
      const json = (await res.json().catch(() => null)) as (MeResponse & { error?: string }) | null;
      if (!res.ok || !json) {
        setError(json?.error ?? "전송하지 못했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }
      setData(json);
      setText("");
      setShowProfile(false);
    } catch {
      setError("전송하지 못했습니다. 네트워크를 확인해 주세요.");
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div className="no-print">
      {/* Launcher */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "상담 창 닫기" : "실시간 상담하기"}
        className={cn(
          "fixed z-[45] bottom-5 right-5 sm:bottom-6 sm:right-6 h-12 inline-flex items-center gap-2 rounded-full bg-[var(--accent)] text-white shadow-[0_10px_30px_-8px_rgba(37,99,235,0.6)] transition-all duration-300 hover:brightness-110 active:scale-[0.97]",
          open ? "w-12 justify-center px-0" : "pl-4 pr-5",
        )}
      >
        {open ? (
          <ChevronDown size={20} />
        ) : (
          <>
            <MessageCircle size={18} className="fill-white/20" />
            <span className="text-[14px] font-semibold">실시간 상담하기</span>
          </>
        )}
        {!open && data.unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-[#ef4444] text-[11px] font-bold leading-5 text-center ring-2 ring-white">
            {data.unread}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          role="dialog"
          aria-label="실시간 상담"
          className="fixed z-[46] inset-0 sm:inset-auto sm:bottom-[88px] sm:right-6 sm:w-[370px] sm:h-[min(600px,calc(100vh-120px))] flex flex-col bg-[#f8fafc] sm:rounded-[20px] sm:border sm:border-[var(--border-subtle)] shadow-[0_24px_60px_-12px_rgba(15,23,42,0.35)] overflow-hidden animate-modal-panel"
        >
          <div className="shrink-0 px-5 pt-5 pb-4 bg-gradient-to-br from-[var(--accent)] to-[#3b5bdb] text-white">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-full bg-white/15 ring-1 ring-white/25 flex items-center justify-center">
                  <MessageCircle size={19} />
                </span>
                <div>
                  <p className="text-[15.5px] font-semibold leading-tight">{companyName}</p>
                  <p className="text-[12px] text-white/75 mt-0.5 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80]" />
                    담당자가 확인 후 답변드려요
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="닫기"
                className="w-8 h-8 -mr-1.5 -mt-1 rounded-full inline-flex items-center justify-center text-white/80 hover:bg-white/15 hover:text-white"
              >
                <X size={17} />
              </button>
            </div>
          </div>

          <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            <Bubble from="admin" authorName={companyName}>
              안녕하세요 😊 견적·운임·스케줄 등 궁금하신 점을 남겨주세요. 확인 후 이 창에서 바로 답변드립니다.
            </Bubble>
            {data.messages.map((m, i) => {
              const prev = data.messages[i - 1];
              const showTime = !prev || prev.from !== m.from || Date.parse(m.at) - Date.parse(prev.at) > 5 * 60_000;
              return (
                <Bubble key={m.id} from={m.from} authorName={m.from === "admin" ? (m.authorName ?? companyName) : undefined} time={showTime ? timeLabel(m.at) : undefined}>
                  {m.text}
                </Bubble>
              );
            })}
          </div>

          <div className="shrink-0 border-t border-[var(--border-subtle)] bg-white px-3 pt-3 pb-3 sm:pb-3 [padding-bottom:max(12px,env(safe-area-inset-bottom))]">
            {isFirst && !hasProfile && showProfile && (
              <div className="mb-2.5 rounded-[12px] bg-[#f8fafc] border border-[var(--border-subtle)] p-2.5">
                <div className="flex items-center justify-between mb-2 px-0.5">
                  <p className="text-[12px] font-medium text-[var(--foreground)]">
                    답변 받으실 정보 <span className="font-normal text-[var(--muted)]">(선택)</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowProfile(false)}
                    className="text-[11.5px] text-[var(--muted)] hover:text-[var(--foreground)]"
                  >
                    건너뛰기
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <MiniInput placeholder="회사명" value={profile.company ?? ""} onChange={(v) => setProfile((p) => ({ ...p, company: v }))} />
                  <MiniInput placeholder="담당자명" value={profile.contactName ?? ""} onChange={(v) => setProfile((p) => ({ ...p, contactName: v }))} />
                  <MiniInput
                    className="col-span-2"
                    placeholder="연락처 또는 이메일"
                    value={profile.contact ?? ""}
                    onChange={(v) => setProfile((p) => ({ ...p, contact: v }))}
                  />
                </div>
              </div>
            )}
            {error && <p className="mb-2 px-1 text-[12px] text-[var(--danger)]">{error}</p>}
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={text}
                rows={1}
                maxLength={2000}
                onChange={(e) => {
                  setText(e.target.value);
                  const el = e.target;
                  el.style.height = "auto";
                  el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
                }}
                onKeyDown={(e) => {
                  // Enter sends; Shift+Enter is a newline. Ignore Enter while
                  // a Korean syllable is still being composed.
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="메시지를 입력하세요"
                aria-label="메시지"
                className="flex-1 resize-none max-h-[120px] min-h-[42px] px-3.5 py-[10px] rounded-[14px] border border-[var(--border)] bg-white text-[14px] leading-[1.45] text-[var(--foreground)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
              />
              <button
                type="button"
                onClick={send}
                disabled={!text.trim() || sending}
                aria-label="보내기"
                className="shrink-0 w-[42px] h-[42px] rounded-[14px] inline-flex items-center justify-center bg-[var(--accent)] text-white transition-all disabled:bg-[#cbd5e1] hover:brightness-110 active:scale-95"
              >
                {sending ? <Loader2 size={17} className="animate-spin" /> : <SendHorizontal size={17} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Bubble({
  from,
  authorName,
  time,
  children,
}: {
  from: "visitor" | "admin";
  authorName?: string;
  time?: string;
  children: React.ReactNode;
}) {
  const mine = from === "visitor";
  return (
    <div className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
      {(time || (!mine && authorName)) && (
        <p className="mb-1 px-1 text-[11px] text-[var(--muted)]">
          {!mine && authorName && <span className="font-medium text-[#475569]">{authorName}</span>}
          {!mine && authorName && time && " · "}
          {time}
        </p>
      )}
      <div
        className={cn(
          "max-w-[82%] px-3.5 py-2.5 text-[13.5px] leading-[1.55] whitespace-pre-wrap break-words",
          mine
            ? "rounded-[16px] rounded-br-[6px] bg-[var(--accent)] text-white"
            : "rounded-[16px] rounded-bl-[6px] bg-white text-[var(--foreground)] border border-[var(--border-subtle)] shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
        )}
      >
        {children}
      </div>
    </div>
  );
}

function MiniInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={80}
      className={cn(
        "h-9 px-2.5 rounded-[9px] border border-[var(--border)] bg-white text-[13px] outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]",
        className,
      )}
    />
  );
}
