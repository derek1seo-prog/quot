import { NextRequest, NextResponse } from "next/server";
import { addCustomer, getCustomers } from "@/lib/data-store";
import { generateId } from "@/lib/id";
import type { Customer } from "@/lib/types";

export async function GET() {
  return NextResponse.json(getCustomers());
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
    createdAt: new Date().toISOString(),
  };
  addCustomer(customer);
  return NextResponse.json(customer, { status: 201 });
}
