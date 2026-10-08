import { NextResponse } from "next/server";
import { db } from "@/packages/database";

import {
  checkReadAuthorization,
  checkWriteAuthorization,
  isRequestAdmin,
  resolveVisitorIdentity,
  attachVisitorCookie,
  scopeMemoriesForRequester,
} from "@/packages/security/auth";

export async function GET(req: Request) {
  try {
    const readScope = checkReadAuthorization(req);
    if (!readScope.authorized) {
      return NextResponse.json(
        { error: readScope.reason || "Unauthorized" },
        { status: readScope.statusCode || 401 }
      );
    }

    const memories = scopeMemoriesForRequester(db.getMemories(), readScope.isAdmin, readScope.visitorId);
    const response = NextResponse.json({ memories });
    return attachVisitorCookie(response, readScope.newVisitorCookie, readScope.isAdmin);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error fetching memories" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const isAdmin = isRequestAdmin(req);
    const { visitorId, newCookieToken } = resolveVisitorIdentity(req);
    const auth = checkWriteAuthorization(req, {
      isSimulated: true,
      action: "create",
    });
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.reason || "Unauthorized" }, { status: auth.statusCode || 401 });
    }

    const { key, value, category } = await req.json();
    if (!value) {
      return NextResponse.json({ error: "Value is required" }, { status: 400 });
    }
    const memory = db.addMemory(
      (key || "custom_rule").slice(0, 100),
      String(value).slice(0, 500),
      category || "preference",
      isAdmin ? undefined : visitorId
    );
    const visibleMemories = scopeMemoriesForRequester(db.getMemories(), isAdmin, visitorId);
    const response = NextResponse.json({ memory, memories: visibleMemories });
    return attachVisitorCookie(response, newCookieToken, isAdmin);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error adding memory" },
      { status: 500 }
    );
  }
}
