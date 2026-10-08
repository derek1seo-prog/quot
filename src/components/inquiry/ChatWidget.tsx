"use client";

import { cn } from "@/lib/cn";
import { ArrowDown, Check, CircleAlert, FileText, Loader2, MessageCircle, RotateCw, SendHorizontal, Ship, Wallet, X } from "lucide-react";
import Image from "next/image";
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

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
  seenByAdmin: boolean;
}
/** A message shown immediately while it's being sent (or after it failed). */
interface Pending {
  tempId: string;
  text: string;
  status: "sending" | "failed";
}

const OPEN_POLL_MS = 4000;
const CLOSED_POLL_MS = 30000;
const NUDGE_KEY = "quot:chatNudgeDismissed";

const QUICK_STARTS = [
  { icon: Wallet, label: "운임 문의", text: "운임 문의드립니다.\n출발항: \n도착항: \n컨테이너: " },
  { icon: Ship, label: "스케줄 문의", text: "선적 스케줄 문의드립니다.\n출발항: \n도착항: \n희망 선적일: " },
  { icon: FileText, label: "견적서 요청", text: "견적서 요청드립니다.\n회사명: \n구간: \n컨테이너/수량: " },
];

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" });
}

export function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "오늘";
  if (d.toDateString() === yesterday.toDateString()) return "어제";
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/** Floating "실시간 상담하기" chat for visitors (guests / 화주). Messages land
 * in the admin 문의함 (/inquiries), one thread per visitor browser; admin
 * replies show up here via polling. */
export function ChatWidget({ companyName }: { companyName: string }) {
  // "closing" keeps the panel mounted while its exit animation plays.
  const [panel, setPanel] = useState<"closed" | "open" | "closing">("closed");
  const open = panel === "open";
  const [data, setData] = useState<MeResponse>({ messages: [], profile: null, unread: 0, seenByAdmin: false });
  const [pending, setPending] = useState<Pending[]>([]);
  const [text, setText] = useState("");
  const [profile, setProfile] = useState<Profile>({});
  const [showProfile, setShowProfile] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nudge, setNudge] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [newBelow, setNewBelow] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Messages that should appear without the pop-in: the history shown when
  // the panel opens, and a server copy replacing an already-shown pending one.
  // (New ones animate on mount only, so polling never replays it.)
  const [quietIds, setQuietIds] = useState<Set<string>>(new Set());
  const tempSeq = useRef(0);
  const jumpToBottom = useRef(true);

  const load = useCallback(async (seen: boolean) => {
    try {
      const res = await fetch(`/api/inquiries/me${seen ? "?seen=1" : ""}`, { cache: "no-store" });
      if (res.ok) setData((await res.json()) as MeResponse);
    } catch {
      // offline - try again on the next tick
    }
  }, []);

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

  // One-time greeting bubble next to the launcher for first-time visitors.
  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(NUDGE_KEY) === "1";
    } catch {
      // storage blocked - just show it
    }
    if (dismissed) return;
    const t = setTimeout(() => setNudge(true), 2500);
    return () => clearTimeout(t);
  }, []);

  function dismissNudge() {
    setNudge(false);
    try {
      localStorage.setItem(NUDGE_KEY, "1");
    } catch {
      // ignore
    }
  }

  function openPanel() {
    dismissNudge();
    setQuietIds(new Set(data.messages.map((m) => m.id)));
    jumpToBottom.current = true;
    setPanel("open");
    setNewBelow(false);
    setTimeout(() => inputRef.current?.focus(), 200);
  }

  const closePanel = useCallback(() => {
    setPanel("closing");
    setTimeout(() => setPanel("closed"), 180);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closePanel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closePanel]);

  const messageCount = data.messages.length + pending.length;

  // Follow new messages when the reader is at the bottom; otherwise offer a pill.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el || panel !== "open") return;
    if (jumpToBottom.current) {
      el.scrollTop = el.scrollHeight;
      jumpToBottom.current = false;
    } else if (atBottom) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    } else {
      requestAnimationFrame(() => setNewBelow(true));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageCount, panel]);

  function onScroll() {
    const el = listRef.current;
    if (!el) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setAtBottom(bottom);
    if (bottom) setNewBelow(false);
  }

  function scrollToBottom() {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    setNewBelow(false);
  }

  const hasProfile = Boolean(data.profile);
  const isEmpty = messageCount === 0;

  async function deliver(item: Pending) {
    setPending((p) => p.map((x) => (x.tempId === item.tempId ? { ...x, status: "sending" } : x)));
    try {
      const res = await fetch("/api/inquiries/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: item.text, ...(hasProfile ? {} : profile) }),
      });
      const json = (await res.json().catch(() => null)) as (MeResponse & { error?: string }) | null;
      if (!res.ok || !json) {
        setError(json?.error ?? null);
        setPending((p) => p.map((x) => (x.tempId === item.tempId ? { ...x, status: "failed" } : x)));
        return;
      }
      // The server copy replaces the optimistic one - mark it as already
      // shown so it doesn't animate in a second time.
      const sent = json.messages[json.messages.length - 1];
      if (sent) setQuietIds((q) => new Set(q).add(sent.id));
      setData(json);
      setPending((p) => p.filter((x) => x.tempId !== item.tempId));
      setShowProfile(false);
      setError(null);
    } catch {
      setPending((p) => p.map((x) => (x.tempId === item.tempId ? { ...x, status: "failed" } : x)));
    }
  }

  function send() {
    const body = text.trim();
    if (!body) return;
    tempSeq.current += 1;
    const item: Pending = { tempId: `tmp-${tempSeq.current}`, text: body, status: "sending" };
    setPending((p) => [...p, item]);
    setText("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    setAtBottom(true);
    deliver(item);
    inputRef.current?.focus();
  }

  function applyQuickStart(template: string) {
    setText(template);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
      // Cursor at the end of the first blank (after "출발항: ").
      const pos = template.indexOf(": ") + 2;
      el.setSelectionRange(pos, pos);
    });
  }

  // Last visitor-sent message (server copy) gets the 전송됨 / 읽음 receipt.
  const lastVisitorIdx = data.messages.map((m) => m.from).lastIndexOf("visitor");
  const lastIsVisitor = lastVisitorIdx >= 0 && lastVisitorIdx === data.messages.length - 1;

  return (
    <div className="no-print">
      {/* Greeting nudge */}
      {nudge && panel === "closed" && (
        <div className="fixed z-[45] bottom-[84px] right-5 sm:right-6 max-w-[240px] animate-chat-nudge-in">
          <div className="relative rounded-[16px] rounded-br-[6px] bg-white px-4 py-3 pr-8 shadow-[0_12px_32px_-8px_rgba(15,23,42,0.25)] border border-[var(--border-subtle)]">
            <button type="button" onClick={openPanel} className="text-left">
              <p className="text-[13px] font-semibold text-[var(--foreground)]">궁금한 점이 있으신가요? 👋</p>
              <p className="mt-0.5 text-[12px] text-[var(--muted)]">운임·스케줄 무엇이든 편하게 물어보세요.</p>
            </button>
            <button
              type="button"
              onClick={dismissNudge}
              aria-label="안내 닫기"
              className="absolute top-2 right-2 w-6 h-6 inline-flex items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--sidebar-bg)]"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Launcher - morphs between the labelled pill and a round close button */}
      <button
        type="button"
        onClick={() => (open ? closePanel() : openPanel())}
        aria-label={open ? "상담 창 닫기" : "실시간 상담하기"}
        aria-expanded={open}
        className={cn(
          "fixed z-[45] bottom-5 right-5 sm:bottom-6 sm:right-6 h-12 rounded-full bg-gradient-to-br from-[var(--accent)] to-[#3b5bdb] text-white shadow-[0_12px_30px_-8px_rgba(37,99,235,0.65)] transition-[width,padding,filter,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:brightness-110 active:scale-[0.96] animate-chat-launcher-in",
          open ? "w-12 px-0" : "w-[166px] px-4",
          !open && data.unread > 0 && "animate-chat-pulse",
          panel !== "closed" && "max-sm:hidden",
        )}
      >
        <span className="relative flex h-full items-center justify-center gap-2 overflow-hidden whitespace-nowrap">
          <span className="relative w-5 h-5 shrink-0">
            <MessageCircle
              size={19}
              className={cn(
                "absolute inset-0 m-auto fill-white/20 transition-all duration-300",
                open ? "opacity-0 rotate-90 scale-50" : "opacity-100 rotate-0 scale-100",
              )}
            />
            <X
              size={20}
              className={cn(
                "absolute inset-0 m-auto transition-all duration-300",
                open ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-50",
              )}
            />
          </span>
          <span className={cn("text-[14px] font-semibold transition-all duration-200", open ? "w-0 opacity-0" : "opacity-100")}>
            실시간 상담하기
          </span>
        </span>
        {!open && data.unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-[#ef4444] text-[11px] font-bold leading-5 text-center ring-2 ring-white animate-chat-msg-in">
            {data.unread}
          </span>
        )}
      </button>

      {/* Panel */}
      {panel !== "closed" && (
        <div
          role="dialog"
          aria-label="실시간 상담"
          className={cn(
            "fixed z-[46] inset-0 sm:inset-auto sm:bottom-[88px] sm:right-6 sm:w-[372px] sm:h-[min(620px,calc(100vh-120px))] flex flex-col bg-[#f8fafc] sm:rounded-[22px] sm:border sm:border-black/[0.06] shadow-[0_28px_70px_-14px_rgba(15,23,42,0.38)] overflow-hidden",
            panel === "closing" ? "animate-chat-panel-out" : "animate-chat-panel-in",
          )}
        >
          {/* Header */}
          <div className="relative shrink-0 px-5 pt-5 pb-5 bg-gradient-to-br from-[var(--accent)] via-[#2f5fe0] to-[#3b5bdb] text-white overflow-hidden">
            <div aria-hidden className="pointer-events-none absolute -right-10 -top-12 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
            <div className="relative flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="relative w-11 h-11 rounded-full bg-white shadow-[0_4px_14px_-4px_rgba(0,0,0,0.3)] flex items-center justify-center">
                  <Image src="/logo.png" alt="" width={28} height={28} className="object-contain" />
                  <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#22c55e] ring-2 ring-[#2f5fe0]" />
                </span>
                <div>
                  <p className="text-[15.5px] font-semibold leading-tight tracking-[-0.01em]">{companyName}</p>
                  <p className="text-[12px] text-white/75 mt-0.5">평일 업무시간 내 빠르게 답변드려요</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closePanel}
                aria-label="닫기"
                className="w-8 h-8 -mr-1.5 -mt-1 rounded-full inline-flex items-center justify-center text-white/80 hover:bg-white/15 hover:text-white transition-colors"
              >
                <X size={17} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="relative flex-1 min-h-0">
            <div ref={listRef} onScroll={onScroll} className="h-full overflow-y-auto overscroll-contain px-4 py-4 space-y-2.5">
              <Bubble from="admin" authorName={companyName}>
                안녕하세요 😊 견적·운임·스케줄 등 궁금하신 점을 남겨주세요. 확인 후 이 창에서 바로 답변드립니다.
              </Bubble>

              {isEmpty && (
                <div className="pt-1 pb-2 flex flex-wrap gap-2 animate-chat-msg-in" style={{ animationDelay: "120ms" }}>
                  {QUICK_STARTS.map(({ icon: Icon, label, text: template }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => applyQuickStart(template)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent)]/25 bg-white px-3 py-1.5 text-[12.5px] font-medium text-[var(--accent)] shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:bg-[var(--accent-soft)] hover:-translate-y-px active:translate-y-0"
                    >
                      <Icon size={13} />
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {data.messages.map((m, i) => {
                const prev = data.messages[i - 1];
                const newDay = !prev || dayLabel(prev.at) !== dayLabel(m.at);
                const showMeta = newDay || prev.from !== m.from || Date.parse(m.at) - Date.parse(prev.at) > 5 * 60_000;
                return (
                  <Fragment key={m.id}>
                    {newDay && <DayDivider label={dayLabel(m.at)} />}
                    <Bubble
                      from={m.from}
                      authorName={m.from === "admin" ? (m.authorName ?? companyName) : undefined}
                      time={showMeta ? timeLabel(m.at) : undefined}
                      animate={!quietIds.has(m.id)}
                      receipt={
                        i === lastVisitorIdx && lastIsVisitor && pending.length === 0
                          ? data.seenByAdmin
                            ? "read"
                            : "sent"
                          : undefined
                      }
                    >
                      {m.text}
                    </Bubble>
                  </Fragment>
                );
              })}

              {pending.map((p) => (
                <Bubble key={p.tempId} from="visitor" animate pendingStatus={p.status} onRetry={() => deliver(p)}>
                  {p.text}
                </Bubble>
              ))}
            </div>

            {newBelow && (
              <button
                type="button"
                onClick={scrollToBottom}
                className="absolute bottom-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-[var(--foreground)] px-3 py-1.5 text-[12px] font-medium text-white shadow-lg animate-chat-msg-in"
              >
                <ArrowDown size={13} />새 메시지
              </button>
            )}
          </div>

          {/* Composer */}
          <div className="shrink-0 border-t border-black/[0.06] bg-white px-3 pt-3 [padding-bottom:max(10px,env(safe-area-inset-bottom))]">
            {isEmpty && !hasProfile && showProfile && (
              <div className="mb-2.5 rounded-[14px] bg-[#f8fafc] border border-[var(--border-subtle)] p-2.5">
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
            {error && (
              <p className="mb-2 px-1 flex items-center gap-1 text-[12px] text-[var(--danger)]">
                <CircleAlert size={12} />
                {error}
              </p>
            )}
            <div className="flex items-end gap-2">
              <div className="relative flex-1">
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
                    // Enter sends; Shift+Enter is a newline. Ignore Enter while a
                    // Korean syllable is still being composed.
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder="메시지를 입력하세요"
                  aria-label="메시지"
                  className="block w-full resize-none max-h-[120px] min-h-[44px] px-4 py-[11px] rounded-[22px] border border-[var(--border)] bg-[#f8fafc] text-[14px] leading-[1.45] text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted)] focus:bg-white focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
                />
                {text.length > 1800 && (
                  <span className="absolute -top-5 right-2 text-[11px] text-[var(--muted)] tabular-nums">{text.length}/2000</span>
                )}
              </div>
              <button
                type="button"
                onClick={send}
                disabled={!text.trim()}
                aria-label="보내기"
                className={cn(
                  "shrink-0 w-11 h-11 rounded-full inline-flex items-center justify-center text-white transition-all duration-200",
                  text.trim()
                    ? "bg-[var(--accent)] shadow-[0_6px_16px_-6px_rgba(37,99,235,0.7)] hover:brightness-110 active:scale-90"
                    : "bg-[#cbd5e1] scale-95",
                )}
              >
                <SendHorizontal size={17} />
              </button>
            </div>
            <p className="mt-1.5 px-1 text-[10.5px] text-[#94a3b8] max-sm:hidden">Enter 전송 · Shift+Enter 줄바꿈</p>
          </div>
        </div>
      )}
    </div>
  );
}

export function DayDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-1.5" role="separator">
      <span className="h-px flex-1 bg-[var(--border-subtle)]" />
      <span className="text-[11px] font-medium text-[#94a3b8]">{label}</span>
      <span className="h-px flex-1 bg-[var(--border-subtle)]" />
    </div>
  );
}

function Bubble({
  from,
  authorName,
  time,
  animate,
  receipt,
  pendingStatus,
  onRetry,
  children,
}: {
  from: "visitor" | "admin";
  authorName?: string;
  time?: string;
  animate?: boolean;
  receipt?: "sent" | "read";
  pendingStatus?: "sending" | "failed";
  onRetry?: () => void;
  children: React.ReactNode;
}) {
  const mine = from === "visitor";
  return (
    <div className={cn("flex flex-col", mine ? "items-end" : "items-start", animate && "animate-chat-msg-in")}>
      {(time || (!mine && authorName)) && (
        <p className="mb-1 px-1 text-[11px] text-[var(--muted)]">
          {!mine && authorName && <span className="font-medium text-[#475569]">{authorName}</span>}
          {!mine && authorName && time && " · "}
          {time}
        </p>
      )}
      <div
        className={cn(
          "max-w-[82%] px-3.5 py-2.5 text-[13.5px] leading-[1.55] whitespace-pre-wrap break-words transition-opacity",
          mine
            ? "rounded-[18px] rounded-br-[6px] bg-gradient-to-br from-[var(--accent)] to-[#3b5bdb] text-white shadow-[0_4px_12px_-6px_rgba(37,99,235,0.6)]"
            : "rounded-[18px] rounded-bl-[6px] bg-white text-[var(--foreground)] border border-black/[0.05] shadow-[0_1px_3px_rgba(15,23,42,0.06)]",
          pendingStatus && "opacity-65",
        )}
      >
        {children}
      </div>
      {pendingStatus === "sending" && (
        <p className="mt-1 px-1 flex items-center gap-1 text-[10.5px] text-[#94a3b8]">
          <Loader2 size={10} className="animate-spin" />
          전송 중
        </p>
      )}
      {pendingStatus === "failed" && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 px-1 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--danger)] hover:underline"
        >
          <RotateCw size={11} />
          전송 실패 · 다시 보내기
        </button>
      )}
      {receipt && (
        <p className="mt-1 px-1 inline-flex items-center gap-0.5 text-[10.5px] text-[#94a3b8]">
          {receipt === "read" ? (
            <span className="font-medium text-[var(--accent)]">읽음</span>
          ) : (
            <>
              <Check size={10} />
              전송됨
            </>
          )}
        </p>
      )}
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
        "h-9 px-2.5 rounded-[10px] border border-[var(--border)] bg-white text-[13px] outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]",
        className,
      )}
    />
  );
}
