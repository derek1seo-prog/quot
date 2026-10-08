"use client";

import { DayDivider, dayLabel } from "@/components/inquiry/ChatWidget";
import { MonoAvatar } from "@/components/ui/Avatar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { IconAction } from "@/components/ui/IconAction";
import { Input } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { matchesSearch } from "@/lib/hangul";
import type { InquirySummary } from "@/lib/inquiries";
import type { InquiryThread } from "@/lib/types";
import { ArrowLeft, Building2, Globe, Inbox, Loader2, Phone, Search, SendHorizontal, Trash2, UserRound } from "lucide-react";
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

const POLL_MS = 4000;
const LAST_SALES_REP_KEY = "quot:lastSalesRepId";

function titleOf(t: { company?: string; contactName?: string; id: string }) {
  return t.company || t.contactName || `방문자 ${t.id.slice(-4).toUpperCase()}`;
}

function relTime(iso: string) {
  const diff = Date.now() - Date.parse(iso);
  if (diff < 60_000) return "방금";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return d.toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" });
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function stamp(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" })}`;
}

function timeOnly(iso: string) {
  return new Date(iso).toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" });
}

function notifyChanged() {
  window.dispatchEvent(new Event("inquiries:changed"));
}

/** Admin 문의함: visitor threads on the left (newest activity first, unread
 * counts), the selected conversation + reply box on the right. Polls so new
 * messages show up without reloading. */
export function InquiryInbox() {
  const [threads, setThreads] = useState<InquirySummary[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [thread, setThread] = useState<InquiryThread | null>(null);
  const [query, setQuery] = useState("");
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const replyRef = useRef<HTMLTextAreaElement>(null);
  // A thread's existing history appears without the pop-in; messages that
  // arrive afterwards animate (on mount only, so polling never replays it).
  const [quietIds, setQuietIds] = useState<Set<string>>(new Set());
  const lastLoadedId = useRef<string | null>(null);

  const loadList = useCallback(async () => {
    try {
      const res = await fetch("/api/inquiries", { cache: "no-store" });
      if (res.ok) setThreads(((await res.json()) as { threads: InquirySummary[] }).threads);
    } catch {
      // next poll
    }
  }, []);

  const loadThread = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/inquiries/${id}`, { cache: "no-store" });
      if (!res.ok) return;
      const t = (await res.json()) as InquiryThread;
      // First load of a thread: its history appears without animation.
      if (lastLoadedId.current !== id) {
        setQuietIds(new Set(t.messages.map((m) => m.id)));
        lastLoadedId.current = id;
      }
      setThread((cur) => (cur?.id === id || !cur ? t : cur));
      // Opening marks it read on the server - reflect that in the list + nav badge.
      setThreads((list) => list?.map((x) => (x.id === id ? { ...x, unreadForAdmin: 0 } : x)) ?? list);
      notifyChanged();
    } catch {
      // next poll
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(loadList, 0);
    const timer = setInterval(() => document.visibilityState === "visible" && loadList(), POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [loadList]);

  useEffect(() => {
    if (!selectedId) return;
    const first = setTimeout(() => loadThread(selectedId), 0);
    const timer = setInterval(() => document.visibilityState === "visible" && loadThread(selectedId), POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [selectedId, loadThread]);

  useLayoutEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [thread?.id, thread?.messages.length]);

  const visible = useMemo(
    () =>
      (threads ?? []).filter((t) =>
        matchesSearch([t.company, t.contactName, t.contact, t.ip, t.lastMessage?.text].filter(Boolean).join(" "), query),
      ),
    [threads, query],
  );

  function open(id: string) {
    setSelectedId(id);
    setThread(null);
    setReply("");
    setTimeout(() => replyRef.current?.focus(), 100);
  }

  async function sendReply() {
    const text = reply.trim();
    if (!text || !selectedId || sending) return;
    setSending(true);
    try {
      let salesRepId: string | undefined;
      try {
        salesRepId = localStorage.getItem(LAST_SALES_REP_KEY) ?? undefined;
      } catch {
        // storage blocked - reply without a name
      }
      const res = await fetch(`/api/inquiries/${selectedId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, salesRepId }),
      });
      if (res.ok) {
        setThread((await res.json()) as InquiryThread);
        setReply("");
        if (replyRef.current) replyRef.current.style.height = "auto";
        loadList();
      }
    } finally {
      setSending(false);
      replyRef.current?.focus();
    }
  }

  async function confirmDelete() {
    if (!selectedId) return;
    setDeleting(true);
    try {
      await fetch(`/api/inquiries/${selectedId}`, { method: "DELETE" });
      setThreads((list) => list?.filter((t) => t.id !== selectedId) ?? list);
      setSelectedId(null);
      setThread(null);
      notifyChanged();
    } finally {
      setDeleting(false);
      setPendingDelete(false);
    }
  }

  const selectedSummary = threads?.find((t) => t.id === selectedId);

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.08)] overflow-hidden h-[calc(100vh-220px)] min-h-[520px] flex">
      {/* Thread list */}
      <aside
        className={cn(
          "w-full md:w-[320px] shrink-0 border-r border-[var(--border-subtle)] flex flex-col",
          selectedId && "hidden md:flex",
        )}
      >
        <div className="p-3 border-b border-[var(--border-subtle)]">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="회사명·담당자·내용 검색" aria-label="문의 검색" className="pl-9" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {threads === null ? (
            <div className="py-16 flex justify-center text-[var(--muted)]">
              <Loader2 size={18} className="animate-spin" />
            </div>
          ) : visible.length === 0 ? (
            <div className="py-16 px-6 text-center">
              <span className="mx-auto mb-3 w-11 h-11 rounded-full bg-[var(--sidebar-bg)] flex items-center justify-center text-[var(--muted)]">
                <Inbox size={20} />
              </span>
              <p className="text-[13.5px] font-medium">{threads.length === 0 ? "아직 받은 문의가 없습니다." : "검색 결과가 없습니다."}</p>
              {threads.length === 0 && (
                <p className="text-[12.5px] text-[var(--muted)] mt-1">방문자가 우측 하단 상담 창으로 보낸 메시지가 여기에 쌓입니다.</p>
              )}
            </div>
          ) : (
            <ul>
              {visible.map((t) => {
                const active = t.id === selectedId;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => open(t.id)}
                      className={cn(
                        "w-full text-left flex items-start gap-3 px-4 py-3.5 border-b border-[var(--border-subtle)] transition-colors",
                        active ? "bg-[var(--accent-soft)]" : "hover:bg-[#f8fafc]",
                      )}
                    >
                      <MonoAvatar name={titleOf(t)} highlighted={t.unreadForAdmin > 0} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className={cn("truncate text-[13.5px]", t.unreadForAdmin > 0 ? "font-semibold" : "font-medium")}>
                            {titleOf(t)}
                          </p>
                          <span className="shrink-0 text-[11px] text-[var(--muted)]">{t.lastMessage ? relTime(t.lastMessage.at) : ""}</span>
                        </div>
                        <div className="mt-0.5 flex items-center justify-between gap-2">
                          <p className={cn("truncate text-[12.5px]", t.unreadForAdmin > 0 ? "text-[var(--foreground)]" : "text-[var(--muted)]")}>
                            {t.lastMessage?.from === "admin" && <span className="text-[var(--muted)]">답변: </span>}
                            {t.lastMessage?.text}
                          </p>
                          {t.unreadForAdmin > 0 && (
                            <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-[#ef4444] text-white text-[10.5px] font-bold leading-[18px] text-center">
                              {t.unreadForAdmin}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* Conversation */}
      <section className={cn("flex-1 min-w-0 flex flex-col bg-[#f8fafc]", !selectedId && "hidden md:flex")}>
        {!selectedId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <span className="mb-3 w-12 h-12 rounded-full bg-white border border-[var(--border-subtle)] flex items-center justify-center text-[var(--muted)]">
              <Inbox size={22} />
            </span>
            <p className="text-[14px] font-medium">대화를 선택하세요</p>
            <p className="text-[12.5px] text-[var(--muted)] mt-1">왼쪽 목록에서 문의를 열면 내용 확인과 답변을 할 수 있습니다.</p>
          </div>
        ) : (
          <>
            <header className="shrink-0 bg-white border-b border-[var(--border-subtle)] px-4 sm:px-5 py-3.5 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                aria-label="목록으로"
                className="md:hidden w-8 h-8 -ml-1 inline-flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--muted)] hover:bg-[var(--sidebar-bg)]"
              >
                <ArrowLeft size={17} />
              </button>
              <MonoAvatar name={titleOf(thread ?? selectedSummary ?? { id: selectedId })} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 min-w-0">
                  <p className="text-[14.5px] font-semibold truncate">{titleOf(thread ?? selectedSummary ?? { id: selectedId })}</p>
                  {(thread?.customerId ?? selectedSummary?.customerId) && (
                    <span className="shrink-0 rounded-full bg-[var(--accent-soft)] px-2 py-[1px] text-[11px] font-semibold text-[var(--accent)]">등록 화주</span>
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-[var(--muted)]">
                  {thread?.company && thread.contactName && (
                    <span className="inline-flex items-center gap-1"><UserRound size={11} />{thread.contactName}</span>
                  )}
                  {thread?.contact && (
                    <span className="inline-flex items-center gap-1"><Phone size={11} />{thread.contact}</span>
                  )}
                  {thread?.ip && (
                    <span className="inline-flex items-center gap-1 tabular-nums"><Globe size={11} />{thread.ip}</span>
                  )}
                  {thread && (
                    <span className="inline-flex items-center gap-1"><Building2 size={11} />첫 문의 {stamp(thread.createdAt)}</span>
                  )}
                </div>
              </div>
              <IconAction label="대화 삭제" tooltip="삭제" side="bottom" onClick={() => setPendingDelete(true)} hoverClass="hover:text-[var(--danger)] hover:bg-red-50">
                <Trash2 size={15} />
              </IconAction>
            </header>

            <div ref={listRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-3">
              {!thread ? (
                <div className="py-16 flex justify-center text-[var(--muted)]">
                  <Loader2 size={18} className="animate-spin" />
                </div>
              ) : (
                thread.messages.map((m, i) => {
                  const prev = thread.messages[i - 1];
                  const newDay = !prev || dayLabel(prev.at) !== dayLabel(m.at);
                  const showTime = newDay || prev.from !== m.from || Date.parse(m.at) - Date.parse(prev.at) > 5 * 60_000;
                  const mine = m.from === "admin";
                  const fresh = !quietIds.has(m.id);
                  return (
                    <Fragment key={m.id}>
                    {newDay && <DayDivider label={dayLabel(m.at)} />}
                    <div className={cn("flex flex-col", mine ? "items-end" : "items-start", fresh && "animate-chat-msg-in")}>
                      {showTime && (
                        <p className="mb-1 px-1 text-[11px] text-[var(--muted)]">
                          {mine && m.authorName && <span className="font-medium text-[#475569]">{m.authorName} · </span>}
                          {timeOnly(m.at)}
                        </p>
                      )}
                      <div
                        className={cn(
                          "max-w-[75%] px-3.5 py-2.5 text-[13.5px] leading-[1.55] whitespace-pre-wrap break-words",
                          mine
                            ? "rounded-[18px] rounded-br-[6px] bg-gradient-to-br from-[var(--accent)] to-[#3b5bdb] text-white shadow-[0_4px_12px_-6px_rgba(37,99,235,0.6)]"
                            : "rounded-[18px] rounded-bl-[6px] bg-white border border-black/[0.05] shadow-[0_1px_3px_rgba(15,23,42,0.06)]",
                        )}
                      >
                        {m.text}
                      </div>
                    </div>
                    </Fragment>
                  );
                })
              )}
            </div>

            <div className="shrink-0 bg-white border-t border-[var(--border-subtle)] p-3 flex items-end gap-2">
              <textarea
                ref={replyRef}
                value={reply}
                rows={1}
                maxLength={2000}
                onChange={(e) => {
                  setReply(e.target.value);
                  const el = e.target;
                  el.style.height = "auto";
                  el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    sendReply();
                  }
                }}
                placeholder="답변을 입력하세요 (Enter 전송, Shift+Enter 줄바꿈)"
                aria-label="답변"
                className="flex-1 resize-none max-h-[140px] min-h-[42px] px-3.5 py-[10px] rounded-[14px] border border-[var(--border)] bg-white text-[14px] leading-[1.45] outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
              />
              <button
                type="button"
                onClick={sendReply}
                disabled={!reply.trim() || sending}
                aria-label="답변 보내기"
                className="shrink-0 w-[42px] h-[42px] rounded-[14px] inline-flex items-center justify-center bg-[var(--accent)] text-white transition-all disabled:bg-[#cbd5e1] hover:brightness-110 active:scale-95"
              >
                {sending ? <Loader2 size={17} className="animate-spin" /> : <SendHorizontal size={17} />}
              </button>
            </div>
          </>
        )}
      </section>

      <ConfirmDialog
        open={pendingDelete}
        title="이 대화를 삭제할까요?"
        description="대화 내용이 영구적으로 삭제됩니다. 방문자 화면의 대화도 함께 사라집니다."
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(false)}
      />
    </div>
  );
}
