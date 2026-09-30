import { NextRequest, NextResponse } from "next/server";
import { getPortCarrierNotes, upsertPortCarrierNote } from "@/lib/data-store";
import { requireAdmin } from "@/lib/session";
import type { PortCarrierNote } from "@/lib/types";

export async function GET(req: NextRequest) {
  const forbidden = requireAdmin(req);
  if (forbidden) return forbidden;
  return NextResponse.json(await getPortCarrierNotes());
}

export async function PUT(req: NextRequest) {
  const forbidden = requireAdmin(req);
  if (forbidden) return forbidden;

  const body = (await req.json()) as { portId: string; notes: string };
  const updated: PortCarrierNote = {
    portId: body.portId,
    notes: body.notes,
    updatedAt: new Date().toISOString().slice(0, 10),
  };
  await upsertPortCarrierNote(updated);
  return NextResponse.json(updated);
}
