import { NextRequest, NextResponse } from "next/server";
import { getContainers, getVesselWatches, saveContainers, saveVesselWatches } from "@/lib/data-store";
import { generateId } from "@/lib/id";
import { requireAdmin } from "@/lib/session";
import type { ContainerShipment, VesselWatch } from "@/lib/types";
import { isScheduleDate } from "@/lib/vessels";

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const opt = (v: unknown, max: number) => text(v, max) || undefined;
const day = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
const time = (v: unknown) => (typeof v === "string" && /^\d{2}:\d{2}$/.test(v) ? v : undefined);

/** The editable fields of a container, cleaned. Absent keys stay absent so
 * a PUT only touches what it sends. */
function fields(raw: Record<string, unknown>): Partial<ContainerShipment> {
  const out: Partial<ContainerShipment> = {};
  // English is kept in capitals, like the team's Excel sheet.
  if ("importer" in raw) out.importer = text(raw.importer, 60).toUpperCase();
  if ("exporter" in raw) out.exporter = text(raw.exporter, 80).toUpperCase();
  if ("size" in raw) out.size = raw.size === "20" ? "20" : "40";
  if ("containerNo" in raw) out.containerNo = text(raw.containerNo, 20).toUpperCase();
  if ("hbl" in raw) out.hbl = text(raw.hbl, 30).toUpperCase();
  if ("freeTimeUntil" in raw) out.freeTimeUntil = day(raw.freeTimeUntil);
  if ("deliveryDate" in raw) out.deliveryDate = day(raw.deliveryDate);
  if ("deliveryTime" in raw) out.deliveryTime = time(raw.deliveryTime);
  if ("surrendered" in raw) out.surrendered = raw.surrendered === true;
  if ("settled" in raw) out.settled = raw.settled === true;
  if ("memo" in raw) out.memo = opt(raw.memo, 200)?.toUpperCase();
  return out;
}

export async function GET(req: NextRequest) {
  const forbidden = requireAdmin(req);
  if (forbidden) return forbidden;
  const [containers, vessels] = await Promise.all([getContainers(), getVesselWatches()]);
  return NextResponse.json({ containers, vessels });
}

interface PostBody {
  /** An existing 선박 스케줄 voyage... */
  vesselWatchId?: string;
  /** ...or a new one (matched to an existing voyage by name + 항차 first). */
  vessel?: { vesselName?: string; voyage?: string; pol?: string; pod?: string; etd?: string; eta?: string };
  containers?: Record<string, unknown>[];
}

/** Adds one or more containers (typically one HB/L's boxes) on a vessel,
 * creating the vessel's 선박 스케줄 entry when it isn't tracked yet. */
export async function POST(req: NextRequest) {
  const forbidden = requireAdmin(req);
  if (forbidden) return forbidden;
  const body = ((await req.json().catch(() => null)) ?? {}) as PostBody;
  const rows = Array.isArray(body.containers) ? body.containers.slice(0, 50) : [];
  if (rows.length === 0) return NextResponse.json({ error: "컨테이너를 입력해 주세요." }, { status: 400 });

  const [containers, vessels] = await Promise.all([getContainers(), getVesselWatches()]);
  const now = new Date().toISOString();
  let vessel: VesselWatch | undefined = vessels.find((v) => v.id === body.vesselWatchId);
  let createdVessel: VesselWatch | null = null;

  if (!vessel) {
    const name = text(body.vessel?.vesselName, 60).toUpperCase();
    const voyage = text(body.vessel?.voyage, 30).toUpperCase();
    if (!name) return NextResponse.json({ error: "선박명을 입력해 주세요." }, { status: 400 });
    vessel = vessels.find(
      (v) => v.vesselName.toUpperCase() === name && v.voyage.toUpperCase() === voyage && v.status === "active",
    );
    if (!vessel) {
      const etd = body.vessel?.etd;
      const eta = body.vessel?.eta;
      createdVessel = {
        id: generateId("vsl"),
        vesselName: name,
        voyage,
        calls: [
          { id: generateId("call"), portName: text(body.vessel?.pol, 40) || "선적지", kind: "POL", etd: isScheduleDate(etd) ? etd : undefined, history: [] },
          { id: generateId("call"), portName: text(body.vessel?.pod, 40) || "양하지", kind: "POD", eta: isScheduleDate(eta) ? eta : undefined, history: [] },
        ],
        status: "active",
        source: "manual",
        createdAt: now,
        updatedAt: now,
      };
      vessel = createdVessel;
      await saveVesselWatches([createdVessel, ...vessels]);
    }
  }

  const created: ContainerShipment[] = rows.map((raw) => ({
    importer: "",
    exporter: "",
    size: "40",
    containerNo: "",
    hbl: "",
    surrendered: false,
    settled: false,
    ...fields(raw),
    id: generateId("cntr"),
    vesselWatchId: vessel.id,
    createdAt: now,
    updatedAt: now,
  }));
  await saveContainers([...containers, ...created]);
  return NextResponse.json({ containers: created, vessel: createdVessel }, { status: 201 });
}

/** `{ id, ...fields }` edits one container; `{ hbl, surrendered | settled }`
 * flips that flag on every container of the HB/L (the sheet's merged cell);
 * `{ updates: [{ id, ...fields }] }` applies many edits in one write (the
 * spreadsheet editor's paste / clear). */
export async function PUT(req: NextRequest) {
  const forbidden = requireAdmin(req);
  if (forbidden) return forbidden;
  const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const containers = await getContainers();
  const now = new Date().toISOString();

  if (Array.isArray(body.updates)) {
    const vesselIds = new Set((await getVesselWatches()).map((v) => v.id));
    const changed: ContainerShipment[] = [];
    for (const raw of (body.updates as Record<string, unknown>[]).slice(0, 2000)) {
      const index = containers.findIndex((c) => c.id === raw?.id);
      if (index < 0) continue;
      const next: ContainerShipment = { ...containers[index], ...fields(raw), updatedAt: now };
      if (typeof raw.vesselWatchId === "string" && vesselIds.has(raw.vesselWatchId)) next.vesselWatchId = raw.vesselWatchId;
      containers[index] = next;
      changed.push(next);
    }
    await saveContainers(containers);
    return NextResponse.json({ containers: changed });
  }

  if (typeof body.hbl === "string" && !body.id) {
    const hbl = body.hbl.trim().toUpperCase();
    const patch: Partial<ContainerShipment> = {};
    if ("surrendered" in body) patch.surrendered = body.surrendered === true;
    if ("settled" in body) patch.settled = body.settled === true;
    if (!hbl || Object.keys(patch).length === 0) return NextResponse.json({ error: "invalid" }, { status: 400 });
    const updated = containers.map((c) => (c.hbl === hbl ? { ...c, ...patch, updatedAt: now } : c));
    await saveContainers(updated);
    return NextResponse.json({ containers: updated.filter((c) => c.hbl === hbl) });
  }

  const index = containers.findIndex((c) => c.id === body.id);
  if (index < 0) return NextResponse.json({ error: "not found" }, { status: 404 });
  const next: ContainerShipment = { ...containers[index], ...fields(body), updatedAt: now };
  if (typeof body.vesselWatchId === "string" && body.vesselWatchId) {
    const vessels = await getVesselWatches();
    if (vessels.some((v) => v.id === body.vesselWatchId)) next.vesselWatchId = body.vesselWatchId;
  }
  containers[index] = next;
  await saveContainers(containers);
  return NextResponse.json({ containers: [next] });
}

export async function DELETE(req: NextRequest) {
  const forbidden = requireAdmin(req);
  if (forbidden) return forbidden;
  // ?id=a or ?ids=a,b (the editor's 행 삭제)
  const ids = new Set(
    [req.nextUrl.searchParams.get("id"), ...(req.nextUrl.searchParams.get("ids")?.split(",") ?? [])].filter(Boolean),
  );
  const containers = await getContainers();
  await saveContainers(containers.filter((c) => !ids.has(c.id)));
  return NextResponse.json({ ok: true });
}
