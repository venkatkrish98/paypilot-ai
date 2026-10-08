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

    let memories = db.getMemories();
    if (readScope.scope === "demo_only") {
      const canonicalIds = new Set(["mem_1", "mem_2", "mem_3"]);
      memories = memories.filter((m) => canonicalIds.has(m.id));
    }
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
