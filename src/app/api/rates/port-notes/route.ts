import { NextRequest, NextResponse } from "next/server";
import { getPortCarrierNotes, upsertPortCarrierNote } from "@/lib/data-store";
import { todayIso } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import type { CarrierEntry, PortCarrierNote } from "@/lib/types";

export async function GET(req: NextRequest) {
  const forbidden = requireAdmin(req);
  if (forbidden) return forbidden;
  return NextResponse.json(await getPortCarrierNotes());
}

export async function PUT(req: NextRequest) {
  const forbidden = requireAdmin(req);
  if (forbidden) return forbidden;

  const body = (await req.json()) as { portId: string; notes: string; entries?: CarrierEntry[] };
  const updated: PortCarrierNote = {
    portId: body.portId,
    notes: typeof body.notes === "string" ? body.notes : "",
    entries: Array.isArray(body.entries) ? body.entries.map(sanitizeEntry) : undefined,
    updatedAt: todayIso(),
  };
  await upsertPortCarrierNote(updated);
  return NextResponse.json(updated);
}

function sanitizeEntry(e: CarrierEntry): CarrierEntry {
  return {
    id: String(e.id ?? ""),
    destinationPortIds: Array.isArray(e.destinationPortIds) ? e.destinationPortIds.map(String) : [],
    carrier: String(e.carrier ?? "").trim(),
    date: typeof e.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(e.date) ? e.date : undefined,
    remark: typeof e.remark === "string" && e.remark.trim() ? e.remark.trim() : undefined,
  };
}
