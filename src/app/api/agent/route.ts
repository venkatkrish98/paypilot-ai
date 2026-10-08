import { NextResponse } from "next/server";
import { defaultOrchestrator } from "@/packages/agent";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const query = body?.query || body?.message || body?.goal;

    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    const result = await defaultOrchestrator.execute(query);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Agent execution error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Agent Error" },
      { status: 500 }
    );
  }
}
