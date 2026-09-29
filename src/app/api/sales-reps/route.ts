import { NextRequest, NextResponse } from "next/server";
import { addSalesRep, deleteSalesRep, getSalesReps, updateSalesRep } from "@/lib/data-store";
import { generateId } from "@/lib/id";
import { requireAdmin } from "@/lib/session";
import type { SalesRep } from "@/lib/types";

export async function GET(req: NextRequest) {
  const forbidden = requireAdmin(req);
  if (forbidden) return forbidden;
  return NextResponse.json(await getSalesReps());
}

export async function POST(req: NextRequest) {
  const forbidden = requireAdmin(req);
  if (forbidden) return forbidden;

  const body = (await req.json()) as Partial<SalesRep>;
  if (!body.name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const rep: SalesRep = {
    id: generateId("rep"),
    name: body.name,
    email: body.email,
    phone: body.phone,
    createdAt: new Date().toISOString(),
  };
  await addSalesRep(rep);
  return NextResponse.json(rep, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const forbidden = requireAdmin(req);
  if (forbidden) return forbidden;

  const body = (await req.json()) as Partial<SalesRep> & { id: string };
  if (!body.id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  const existing = (await getSalesReps()).find((r) => r.id === body.id);
  if (!existing) {
    return NextResponse.json({ error: "sales rep not found" }, { status: 404 });
  }
  const updated: SalesRep = {
    ...existing,
    name: body.name ?? existing.name,
    email: body.email ?? existing.email,
    phone: body.phone ?? existing.phone,
  };
  await updateSalesRep(updated);
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const forbidden = requireAdmin(req);
  if (forbidden) return forbidden;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  await deleteSalesRep(id);
  return NextResponse.json({ ok: true });
}
