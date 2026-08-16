import { NextResponse } from "next/server";
import { clearPortalSession } from "@/lib/portalSession";

export async function POST(request: Request) {
  clearPortalSession();
  return NextResponse.redirect(new URL("/portal", request.url), { status: 303 });
}
