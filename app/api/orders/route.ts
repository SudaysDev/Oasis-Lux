import { NextResponse } from "next/server";

// TODO: implement (see plan / AboutTheProject)
export async function GET() {
  return NextResponse.json({ ok: true, route: "orders", todo: true });
}
