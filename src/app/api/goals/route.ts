import { NextResponse } from "next/server";
import { db } from "@/packages/database";

export async function GET() {
  try {
    const goals = db.getGoals();
    const metrics = db.getMetrics();
    return NextResponse.json({ goals, metrics });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error fetching goals" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const goal = db.saveGoal(body);
    return NextResponse.json({ goal, metrics: db.getMetrics() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error creating goal" },
      { status: 500 }
    );
  }
}
