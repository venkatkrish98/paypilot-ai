import { NextResponse } from "next/server";
import { db } from "@/packages/database";

export async function GET() {
  try {
    const memories = db.getMemories();
    return NextResponse.json({ memories });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error fetching memories" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { key, value, category } = await req.json();
    if (!value) {
      return NextResponse.json({ error: "Value is required" }, { status: 400 });
    }
    const memory = db.addMemory(key || "custom_rule", value, category || "preference");
    return NextResponse.json({ memory, memories: db.getMemories() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error adding memory" },
      { status: 500 }
    );
  }
}
