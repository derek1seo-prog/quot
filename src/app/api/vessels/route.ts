import { NextRequest, NextResponse } from "next/server";
import { getVesselWatches, saveVesselWatches } from "@/lib/data-store";
import { generateId } from "@/lib/id";
import { requireAdmin } from "@/lib/session";
import type { VesselPortCall, VesselWatch } from "@/lib/types";
import { isScheduleDate, MAX_PORT_CALLS } from "@/lib/vessels";

type Body = Partial<Omit<VesselWatch, "calls">> & {
  calls?: Partial<VesselPortCall>[];
  /** Name recorded on each date change (the picked 담당자). */
  by?: string;
};

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const opt = (v: unknown, max: number) => text(v, max) || undefined;

/** Normalizes the request's calls, carrying over each existing call's
 * history and appending an entry for every eta/etd that changed. */
function buildCalls(raw: Body["calls"], existing: VesselPortCall[], by: string | undefined, now: string) {
  if (!Array.isArray(raw)) return null;
  const calls: VesselPortCall[] = [];
  for (const c of raw.slice(0, MAX_PORT_CALLS)) {
    const portName = text(c.portName, 40);
    if (!portName) continue;
    const prev = existing.find((e) => e.id === c.id);
    const call: VesselPortCall = {
      id: prev?.id ?? generateId("call"),
      portName,
      kind: c.kind === "POL" || c.kind === "POD" ? c.kind : "VIA",
      eta: isScheduleDate(c.eta) ? c.eta : undefined,
      etd: isScheduleDate(c.etd) ? c.etd : undefined,
      history: prev ? [...prev.history] : [],
    };
    for (const field of ["eta", "etd"] as const) {
      const from = prev?.[field];
      const to = call[field];
      // A brand-new call's first dates aren't "changes" - they're the baseline.
      if (prev && from !== to) call.history.push({ at: now, field, from, to, by });
    }
    calls.push(call);
  }
  return calls;
}

export async function GET(req: NextRequest) {
  const forbidden = requireAdmin(req);
  if (forbidden) return forbidden;
  return NextResponse.json(await getVesselWatches());
}

export async function POST(req: NextRequest) {
  const forbidden = requireAdmin(req);
  if (forbidden) return forbidden;
  const body = ((await req.json().catch(() => null)) ?? {}) as Body;
  const vesselName = text(body.vesselName, 60);
  if (!vesselName) return NextResponse.json({ error: "선박명을 입력해 주세요." }, { status: 400 });
  const now = new Date().toISOString();
  const watch: VesselWatch = {
    id: generateId("vsl"),
    vesselName,
    voyage: text(body.voyage, 30),
    carrier: opt(body.carrier, 40),
    customerName: opt(body.customerName, 60),
    memo: opt(body.memo, 300),
    calls: buildCalls(body.calls, [], undefined, now) ?? [],
    status: "active",
    source: "manual",
    createdAt: now,
    updatedAt: now,
  };
  const watches = await getVesselWatches();
  await saveVesselWatches([watch, ...watches]);
  return NextResponse.json(watch, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const forbidden = requireAdmin(req);
  if (forbidden) return forbidden;
  const body = ((await req.json().catch(() => null)) ?? {}) as Body;
  const watches = await getVesselWatches();
  const index = watches.findIndex((w) => w.id === body.id);
  if (index < 0) return NextResponse.json({ error: "not found" }, { status: 404 });
  const existing = watches[index];
  const now = new Date().toISOString();
  const by = opt(body.by, 40);
  const updated: VesselWatch = {
    ...existing,
    vesselName: "vesselName" in body ? text(body.vesselName, 60) || existing.vesselName : existing.vesselName,
    voyage: "voyage" in body ? text(body.voyage, 30) : existing.voyage,
    carrier: "carrier" in body ? opt(body.carrier, 40) : existing.carrier,
    customerName: "customerName" in body ? opt(body.customerName, 60) : existing.customerName,
    memo: "memo" in body ? opt(body.memo, 300) : existing.memo,
    calls: buildCalls(body.calls, existing.calls, by, now) ?? existing.calls,
    status: body.status === "done" || body.status === "active" ? body.status : existing.status,
    updatedAt: now,
  };
  watches[index] = updated;
  await saveVesselWatches(watches);
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const forbidden = requireAdmin(req);
  if (forbidden) return forbidden;
  const id = req.nextUrl.searchParams.get("id");
  const watches = await getVesselWatches();
  await saveVesselWatches(watches.filter((w) => w.id !== id));
  return NextResponse.json({ ok: true });
}
