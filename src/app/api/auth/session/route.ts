import { NextResponse } from "next/server";
import { generateDemoSessionToken } from "@/packages/security/auth";

export async function GET() {
  const sessionToken = generateDemoSessionToken();
  const response = NextResponse.json({
    authenticated: true,
    sessionToken,
    mode: process.env.NODE_ENV === "production" ? "production_demo" : "development",
  });

  // Set HTTP-Only Cookie for seamless same-origin mutation authorization
  response.cookies.set({
    name: "paypilot_session",
    value: sessionToken,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24, // 24 hours
  });

  return response;
}
