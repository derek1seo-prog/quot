import { NextRequest, NextResponse } from "next/server";
import { addCustomer, deleteCustomer, getCustomerByLoginId, getCustomers, updateCustomer } from "@/lib/data-store";
import { generateId } from "@/lib/id";
import { hashPassword } from "@/lib/auth/password";
import { requireAdmin } from "@/lib/auth/require";
import type { Customer, PublicCustomer } from "@/lib/types";

/** Never let passwordHash reach a client, including the admin's own browser. */
function toPublicCustomer(c: Customer): PublicCustomer {
  const { passwordHash, ...rest } = c;
  return { ...rest, hasLoginAccount: Boolean(c.loginId && passwordHash) };
}

export async function GET() {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;
  return NextResponse.json((await getCustomers()).map(toPublicCustomer));
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  const body = (await req.json()) as Partial<Customer> & { password?: string };
  if (!body.name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (body.loginId && (await getCustomerByLoginId(body.loginId))) {
    return NextResponse.json({ error: "이미 사용 중인 로그인 ID입니다." }, { status: 409 });
  }
  const customer: Customer = {
    id: generateId("cust"),
    name: body.name,
    contactName: body.contactName,
    phone: body.phone,
    incotermsDefault: body.incotermsDefault,
    incheonTruckingRate20ft: body.incheonTruckingRate20ft,
    incheonTruckingRate40hq: body.incheonTruckingRate40hq,
    busanTruckingRate20ft: body.busanTruckingRate20ft,
    busanTruckingRate40hq: body.busanTruckingRate40hq,
    createdAt: new Date().toISOString(),
    loginId: body.loginId || undefined,
    passwordHash: body.loginId && body.password ? hashPassword(body.password) : undefined,
  };
  await addCustomer(customer);
  return NextResponse.json(toPublicCustomer(customer), { status: 201 });
}

export async function PUT(req: NextRequest) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  const body = (await req.json()) as Partial<Customer> & { id: string; password?: string };
  if (!body.id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  const existing = (await getCustomers()).find((c) => c.id === body.id);
  if (!existing) {
    return NextResponse.json({ error: "customer not found" }, { status: 404 });
  }
  if (body.loginId && body.loginId !== existing.loginId) {
    const conflict = await getCustomerByLoginId(body.loginId);
    if (conflict && conflict.id !== existing.id) {
      return NextResponse.json({ error: "이미 사용 중인 로그인 ID입니다." }, { status: 409 });
    }
  }
  const updated: Customer = {
    ...existing,
    name: body.name ?? existing.name,
    contactName: body.contactName ?? existing.contactName,
    phone: body.phone ?? existing.phone,
    incotermsDefault: body.incotermsDefault ?? existing.incotermsDefault,
    incheonTruckingRate20ft: body.incheonTruckingRate20ft ?? existing.incheonTruckingRate20ft,
    incheonTruckingRate40hq: body.incheonTruckingRate40hq ?? existing.incheonTruckingRate40hq,
    busanTruckingRate20ft: body.busanTruckingRate20ft ?? existing.busanTruckingRate20ft,
    busanTruckingRate40hq: body.busanTruckingRate40hq ?? existing.busanTruckingRate40hq,
    loginId: body.loginId ?? existing.loginId,
    passwordHash: body.password ? hashPassword(body.password) : existing.passwordHash,
  };
  await updateCustomer(updated);
  return NextResponse.json(toPublicCustomer(updated));
}

export async function DELETE(req: NextRequest) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  await deleteCustomer(id);
  return NextResponse.json({ ok: true });
}
