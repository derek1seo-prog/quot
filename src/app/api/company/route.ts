import { NextResponse } from "next/server";
import { getCompany } from "@/lib/data-store";

export async function GET() {
  return NextResponse.json(getCompany());
}
