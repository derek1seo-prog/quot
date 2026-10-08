import { NextRequest, NextResponse } from "next/server";
import { getCustomerById, getInquiries, saveInquiries } from "@/lib/data-store";
import { generateId } from "@/lib/id";
import {
  clientIp,
  MAX_MESSAGE_LENGTH,
  MAX_MESSAGES_PER_THREAD,
  newVisitorId,
  readVisitorId,
  setVisitorCookie,
  visitorView,
} from "@/lib/inquiries";
import { getSessionFromRequest } from "@/lib/session";
import type { InquiryThread } from "@/lib/types";

/** The calling visitor's own 문의 thread. `?seen=1` (widget open) also
 * clears their unread-reply count. */
export async function GET(req: NextRequest) {
  const visitorId = readVisitorId(req);
  if (!visitorId) return NextResponse.json(visitorView(undefined));
  const threads = await getInquiries();
  const thread = threads.find((t) => t.visitorId === visitorId);
  if (thread && thread.unreadForVisitor > 0 && req.nextUrl.searchParams.get("seen") === "1") {
    thread.unreadForVisitor = 0;
    await saveInquiries(threads);
  }
  return NextResponse.json(visitorView(thread));
}

/** Send a message (and optionally the visitor's company / contact). */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    text?: string;
    company?: string;
    contactName?: string;
    contact?: string;
  } | null;
  const text = body?.text?.trim() ?? "";
  if (!text) return NextResponse.json({ error: "메시지를 입력해 주세요." }, { status: 400 });
  if (text.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: `메시지는 ${MAX_MESSAGE_LENGTH}자까지 보낼 수 있습니다.` }, { status: 400 });
  }

  let visitorId = readVisitorId(req);
  const isNewVisitor = !visitorId;
  if (!visitorId) visitorId = newVisitorId();

  const now = new Date().toISOString();
  const threads = await getInquiries();
  let thread = threads.find((t) => t.visitorId === visitorId);
  if (!thread) {
    thread = {
      id: generateId("inq"),
      visitorId,
      messages: [],
      createdAt: now,
      updatedAt: now,
      unreadForAdmin: 0,
      unreadForVisitor: 0,
    } satisfies InquiryThread;
    threads.push(thread);
  }
  if (thread.messages.length >= MAX_MESSAGES_PER_THREAD) {
    return NextResponse.json({ error: "대화가 너무 길어졌습니다. 전화로 문의해 주세요." }, { status: 429 });
  }

  const clip = (v: unknown, n = 80) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : undefined);
  thread.company = clip(body?.company) ?? thread.company;
  thread.contactName = clip(body?.contactName) ?? thread.contactName;
  thread.contact = clip(body?.contact) ?? thread.contact;
  // A 화주 who came in through their own link is identified automatically.
  const session = getSessionFromRequest(req);
  if (session?.role === "customer" && session.customerId) {
    const customer = await getCustomerById(session.customerId);
    if (customer) {
      thread.customerId = customer.id;
      thread.company = thread.company ?? customer.name;
      thread.contactName = thread.contactName ?? customer.contactName;
    }
  }
  thread.ip = clientIp(req) ?? thread.ip;
  thread.userAgent = req.headers.get("user-agent")?.slice(0, 200) ?? thread.userAgent;
  thread.messages.push({ id: generateId("msg"), from: "visitor", text, at: now });
  thread.updatedAt = now;
  thread.unreadForAdmin += 1;
  await saveInquiries(threads);

  const res = NextResponse.json(visitorView(thread), { status: 201 });
  if (isNewVisitor) setVisitorCookie(res, visitorId);
  return res;
}
