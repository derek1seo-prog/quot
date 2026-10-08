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

  const body = (await req.json()) as Partial<Customer>;
  if (!body.name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const customer: Customer = {
    id: generateId("cust"),
    name: body.name,
    contactName: body.contactName,
    phone: body.phone,
    salesRepId: body.salesRepId || undefined,
    incotermsDefault: body.incotermsDefault,
    incheonTruckingRate20ft: body.incheonTruckingRate20ft,
    incheonTruckingRate40hq: body.incheonTruckingRate40hq,
    busanTruckingRate20ft: body.busanTruckingRate20ft,
    busanTruckingRate40hq: body.busanTruckingRate40hq,
    pyeongtaekTruckingRate20ft: body.pyeongtaekTruckingRate20ft,
    pyeongtaekTruckingRate40hq: body.pyeongtaekTruckingRate40hq,
    createdAt: new Date().toISOString(),
    accessToken: generateAccessToken(),
  };
  await addCustomer(customer);
  return NextResponse.json(customer, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const forbidden = requireAdmin(req);
  if (forbidden) return forbidden;

  const body = (await req.json()) as Partial<Customer> & { id: string };
  if (!body.id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  const existing = (await getCustomers()).find((c) => c.id === body.id);
  if (!existing) {
    return NextResponse.json({ error: "customer not found" }, { status: 404 });
  }
  const updated: Customer = {
    ...existing,
    name: body.name ?? existing.name,
    contactName: body.contactName ?? existing.contactName,
    phone: body.phone ?? existing.phone,
    // "" clears the assignment, so check presence rather than ??.
    salesRepId: "salesRepId" in body ? body.salesRepId || undefined : existing.salesRepId,
    incotermsDefault: body.incotermsDefault ?? existing.incotermsDefault,
    incheonTruckingRate20ft: body.incheonTruckingRate20ft ?? existing.incheonTruckingRate20ft,
    incheonTruckingRate40hq: body.incheonTruckingRate40hq ?? existing.incheonTruckingRate40hq,
    busanTruckingRate20ft: body.busanTruckingRate20ft ?? existing.busanTruckingRate20ft,
    busanTruckingRate40hq: body.busanTruckingRate40hq ?? existing.busanTruckingRate40hq,
    pyeongtaekTruckingRate20ft: body.pyeongtaekTruckingRate20ft ?? existing.pyeongtaekTruckingRate20ft,
    pyeongtaekTruckingRate40hq: body.pyeongtaekTruckingRate40hq ?? existing.pyeongtaekTruckingRate40hq,
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
