import { NextResponse } from "next/server";
import { clearPortalSession } from "@/lib/portalSession";
import { wrongOrigin } from "@/lib/guard";

export async function POST(request: Request) {
  const bad = wrongOrigin();
  if (bad) return bad;

  clearPortalSession();
  return NextResponse.redirect(new URL("/portal", request.url), { status: 303 });
}
