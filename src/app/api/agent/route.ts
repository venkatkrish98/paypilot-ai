import { NextResponse } from "next/server";
import { defaultOrchestrator } from "@/packages/agent";
import { checkWriteAuthorization, isRequestAdmin } from "@/packages/security/auth";
import { defaultPayPalClient } from "@/packages/paypal";

export async function POST(req: Request) {
  try {
    const isAdmin = isRequestAdmin(req);
    const isSimulationOnly = !isAdmin || !defaultPayPalClient.isConfigured();

    const auth = checkWriteAuthorization(req, {
      isSimulated: isSimulationOnly,
      action: "create",
    });
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.reason || "Unauthorized" }, { status: auth.statusCode || 401 });
    }

    const body = await req.json();
    const query = body?.query || body?.message || body?.goal;

    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    const result = await defaultOrchestrator.execute(query, {
      isSimulationOnly,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Agent execution error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Agent Error" },
      { status: 500 }
    );
  }
}
