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

import { checkWriteAuthorization } from "@/packages/security/auth";

export async function POST(req: Request) {
  try {
    const auth = checkWriteAuthorization(req);
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
      category || "preference"
    );
    return NextResponse.json({ memory, memories: db.getMemories() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error adding memory" },
      { status: 500 }
    );
  }
}
