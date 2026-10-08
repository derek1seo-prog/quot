import { NextRequest, NextResponse } from "next/server";
import { getInquiries } from "@/lib/data-store";
import { adminSummary } from "@/lib/inquiries";
import { requireAdmin } from "@/lib/session";

/** Admin 문의함: every thread (newest activity first) + total unread. */
export async function GET(req: NextRequest) {
  const forbidden = requireAdmin(req);
  if (forbidden) return forbidden;
  const threads = (await getInquiries()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return NextResponse.json({
    threads: threads.map(adminSummary),
    totalUnread: threads.reduce((n, t) => n + t.unreadForAdmin, 0),
  });
}
