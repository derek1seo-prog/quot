import { NextRequest, NextResponse } from "next/server";
import { addCustomer, deleteCustomer, getCustomers, updateCustomer } from "@/lib/data-store";
import { generateId } from "@/lib/id";
import type { Customer } from "@/lib/types";

export async function GET() {
  return NextResponse.json(await getCustomers());
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Partial<Customer>;
  if (!body.name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const customer: Customer = {
    id: generateId("cust"),
    name: body.name,
    contactName: body.contactName,
    email: body.email,
    phone: body.phone,
    incotermsDefault: body.incotermsDefault,
    deliveryLocation: body.deliveryLocation,
    incheonTruckingRate20ft: body.incheonTruckingRate20ft,
    incheonTruckingRate40hq: body.incheonTruckingRate40hq,
    busanTruckingRate20ft: body.busanTruckingRate20ft,
    busanTruckingRate40hq: body.busanTruckingRate40hq,
    createdAt: new Date().toISOString(),
  };
  await addCustomer(customer);
  return NextResponse.json(customer, { status: 201 });
}

export async function PUT(req: NextRequest) {
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
    email: body.email ?? existing.email,
    phone: body.phone ?? existing.phone,
    incotermsDefault: body.incotermsDefault ?? existing.incotermsDefault,
    deliveryLocation: body.deliveryLocation ?? existing.deliveryLocation,
    incheonTruckingRate20ft: body.incheonTruckingRate20ft ?? existing.incheonTruckingRate20ft,
    incheonTruckingRate40hq: body.incheonTruckingRate40hq ?? existing.incheonTruckingRate40hq,
    busanTruckingRate20ft: body.busanTruckingRate20ft ?? existing.busanTruckingRate20ft,
    busanTruckingRate40hq: body.busanTruckingRate40hq ?? existing.busanTruckingRate40hq,
  };
  await updateCustomer(updated);
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  await deleteCustomer(id);
  return NextResponse.json({ ok: true });
}
