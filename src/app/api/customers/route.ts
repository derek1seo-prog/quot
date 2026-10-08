import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { addCustomer, deleteCustomer, getCustomers, updateCustomer } from "@/lib/data-store";
import { generateId } from "@/lib/id";
import { requireAdmin } from "@/lib/session";
import type { Customer } from "@/lib/types";

// A customer's whole self-service data isolation rests on this token being
// unguessable, so it comes from node:crypto (not src/lib/id.ts's
// Math.random()-based generateId, which is fine for ordinary record ids
// but not a bearer credential).
function generateAccessToken(): string {
  return randomBytes(24).toString("base64url");
}

export async function GET(req: NextRequest) {
  const forbidden = requireAdmin(req);
  if (forbidden) return forbidden;
  return NextResponse.json(await getCustomers());
}

export async function POST(req: NextRequest) {
  const forbidden = requireAdmin(req);
  if (forbidden) return forbidden;

  const body = (await req.json()) as { [K in keyof Customer]?: Customer[K] | null };
  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const customer: Customer = {
    id: generateId("cust"),
    name,
    contactName: body.contactName || undefined,
    phone: body.phone || undefined,
    salesRepId: body.salesRepId || undefined,
    incotermsDefault: body.incotermsDefault || undefined,
    incheonTruckingRate20ft: body.incheonTruckingRate20ft ?? undefined,
    incheonTruckingRate40hq: body.incheonTruckingRate40hq ?? undefined,
    busanTruckingRate20ft: body.busanTruckingRate20ft ?? undefined,
    busanTruckingRate40hq: body.busanTruckingRate40hq ?? undefined,
    pyeongtaekTruckingRate20ft: body.pyeongtaekTruckingRate20ft ?? undefined,
    pyeongtaekTruckingRate40hq: body.pyeongtaekTruckingRate40hq ?? undefined,
    createdAt: new Date().toISOString(),
    accessToken: generateAccessToken(),
  };
  await addCustomer(customer);
  return NextResponse.json(customer, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const forbidden = requireAdmin(req);
  if (forbidden) return forbidden;

  const body = (await req.json()) as { [K in keyof Customer]?: Customer[K] | null } & { id: string };
  if (!body.id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  const existing = (await getCustomers()).find((c) => c.id === body.id);
  if (!existing) {
    return NextResponse.json({ error: "customer not found" }, { status: 404 });
  }
  // A field present in the body (even as null / "") replaces the stored
  // value, so the edit dialog can clear it; absent fields are left as is.
  const pick = <K extends keyof Customer>(key: K): Customer[K] =>
    key in body ? ((body[key] ?? undefined) as Customer[K]) : existing[key];
  const updated: Customer = {
    ...existing,
    name: body.name?.trim() || existing.name,
    contactName: pick("contactName") || undefined,
    phone: pick("phone") || undefined,
    salesRepId: pick("salesRepId") || undefined,
    incotermsDefault: pick("incotermsDefault") || undefined,
    incheonTruckingRate20ft: pick("incheonTruckingRate20ft"),
    incheonTruckingRate40hq: pick("incheonTruckingRate40hq"),
    busanTruckingRate20ft: pick("busanTruckingRate20ft"),
    busanTruckingRate40hq: pick("busanTruckingRate40hq"),
    pyeongtaekTruckingRate20ft: pick("pyeongtaekTruckingRate20ft"),
    pyeongtaekTruckingRate40hq: pick("pyeongtaekTruckingRate40hq"),
    // Backfills a token for any customer created before this feature -
    // every customer ends up with one the next time an admin touches them.
    accessToken: existing.accessToken ?? generateAccessToken(),
  };
  await updateCustomer(updated);
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const forbidden = requireAdmin(req);
  if (forbidden) return forbidden;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  await deleteCustomer(id);
  return NextResponse.json({ ok: true });
}
