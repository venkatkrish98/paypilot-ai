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

export async function POST(req: Request) {
  try {
    const { id, action } = await req.json();
    if (action === "dismiss") {
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
