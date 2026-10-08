import { NextResponse } from "next/server";
import { db } from "@/packages/database";

import {
  checkReadAuthorization,
  checkWriteAuthorization,
  isRequestAdmin,
  resolveVisitorIdentity,
  attachVisitorCookie,
  scopeRecommendationsForRequester,
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

    const recommendations = scopeRecommendationsForRequester(
      db.getRecommendations(),
      readScope.isAdmin,
      readScope.visitorId
    );
    const response = NextResponse.json({ recommendations });
    return attachVisitorCookie(response, readScope.newVisitorCookie, readScope.isAdmin);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error fetching recommendations" },
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
      action: "update",
    });
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.reason || "Unauthorized" }, { status: auth.statusCode || 401 });
    }

    const { id, action } = await req.json();
    if (action === "dismiss" && id) {
      db.dismissRecommendation(id);
    }
    const visibleRecs = scopeRecommendationsForRequester(
      db.getRecommendations(),
      isAdmin,
      visitorId
    );
    const response = NextResponse.json({
      success: true,
      recommendations: visibleRecs,
    });
    return attachVisitorCookie(response, newCookieToken, isAdmin);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error handling recommendation" },
      { status: 500 }
    );
  }
}
