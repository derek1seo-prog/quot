import { randomBytes } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import type { InquiryThread } from "@/lib/types";

/** Long-lived per-browser visitor id for 문의 threads (httpOnly, 1 year). */
export const VISITOR_COOKIE = "quot_vid";
const VISITOR_MAX_AGE = 60 * 60 * 24 * 365;

export const MAX_MESSAGE_LENGTH = 2000;
/** Hard cap per thread so a runaway client can't grow the store forever. */
export const MAX_MESSAGES_PER_THREAD = 500;

export function readVisitorId(req: NextRequest): string | null {
  const v = req.cookies.get(VISITOR_COOKIE)?.value;
  return v && /^[A-Za-z0-9_-]{16,64}$/.test(v) ? v : null;
}

export function newVisitorId(): string {
  return randomBytes(18).toString("base64url");
}

export function setVisitorCookie(res: NextResponse, id: string) {
  res.cookies.set(VISITOR_COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: VISITOR_MAX_AGE,
  });
}

export function clientIp(req: NextRequest): string | undefined {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || undefined;
}

/** What the visitor's own widget may see - never IP / user agent. */
export function visitorView(t: InquiryThread | undefined) {
  if (!t) return { messages: [], profile: null, unread: 0 };
  return {
    messages: t.messages.map(({ id, from, text, at, authorName }) => ({ id, from, text, at, authorName })),
    profile: t.company || t.contactName || t.contact ? { company: t.company, contactName: t.contactName, contact: t.contact } : null,
    unread: t.unreadForVisitor,
  };
}

/** Admin list item: everything but the full message history. */
export function adminSummary(t: InquiryThread) {
  const last = t.messages[t.messages.length - 1];
  return {
    id: t.id,
    company: t.company,
    contactName: t.contactName,
    contact: t.contact,
    customerId: t.customerId,
    ip: t.ip,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    unreadForAdmin: t.unreadForAdmin,
    lastMessage: last ? { from: last.from, text: last.text.slice(0, 140), at: last.at } : null,
    messageCount: t.messages.length,
  };
}
export type InquirySummary = ReturnType<typeof adminSummary>;
