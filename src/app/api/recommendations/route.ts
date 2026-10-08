import { NextResponse } from "next/server";
import { db } from "@/packages/database";

import { checkReadAuthorization, checkWriteAuthorization } from "@/packages/security/auth";

export async function GET(req: Request) {
  try {
    const readScope = checkReadAuthorization(req);
    if (!readScope.authorized) {
      return NextResponse.json(
        { error: readScope.reason || "Unauthorized" },
        { status: readScope.statusCode || 401 }
      );
    }

    let recommendations = db.getRecommendations();
    if (readScope.scope === "demo_only") {
      const canonicalIds = new Set(["rec_1", "rec_2"]);
      recommendations = recommendations.filter((r) => canonicalIds.has(r.id));
    }
    return NextResponse.json({ recommendations });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error fetching recommendations" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
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
    return NextResponse.json({
      success: true,
      recommendations: db.getRecommendations(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error handling recommendation" },
      { status: 500 }
    );
  }
}
