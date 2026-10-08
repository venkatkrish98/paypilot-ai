import { NextResponse } from "next/server";
import { db } from "@/packages/database";

export async function GET() {
  try {
    const recommendations = db.getRecommendations();
    return NextResponse.json({ recommendations });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error fetching recommendations" },
      { status: 500 }
    );
  }
}

import { checkWriteAuthorization } from "@/packages/security/auth";

export async function POST(req: Request) {
  try {
    const auth = checkWriteAuthorization(req);
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
