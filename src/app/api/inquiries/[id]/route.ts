import { NextRequest, NextResponse } from "next/server";
import { getInquiries, getSalesRepById, saveInquiries } from "@/lib/data-store";
import { generateId } from "@/lib/id";
import { MAX_MESSAGE_LENGTH } from "@/lib/inquiries";
import { requireAdmin } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

/** Full thread; opening it marks the visitor's messages as read. */
export async function GET(req: NextRequest, { params }: Ctx) {
  const forbidden = requireAdmin(req);
  if (forbidden) return forbidden;
  const { id } = await params;
  const threads = await getInquiries();
  const thread = threads.find((t) => t.id === id);
  if (!thread) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (thread.unreadForAdmin > 0) {
    thread.unreadForAdmin = 0;
    await saveInquiries(threads);
  }
  return NextResponse.json(thread);
}

/** Admin reply. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const forbidden = requireAdmin(req);
  if (forbidden) return forbidden;
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { text?: string; salesRepId?: string } | null;
  const text = body?.text?.trim() ?? "";
  if (!text || text.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: "invalid message" }, { status: 400 });
  }
  const threads = await getInquiries();
  const thread = threads.find((t) => t.id === id);
  if (!thread) return NextResponse.json({ error: "not found" }, { status: 404 });
  const rep = body?.salesRepId ? await getSalesRepById(body.salesRepId) : undefined;
  const now = new Date().toISOString();
  thread.messages.push({ id: generateId("msg"), from: "admin", text, at: now, authorName: rep?.name });
  thread.updatedAt = now;
  thread.unreadForAdmin = 0;
  thread.unreadForVisitor += 1;
  await saveInquiries(threads);
  return NextResponse.json(thread, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const forbidden = requireAdmin(req);
  if (forbidden) return forbidden;
  const { id } = await params;
  const threads = await getInquiries();
  await saveInquiries(threads.filter((t) => t.id !== id));
  return NextResponse.json({ ok: true });
}
