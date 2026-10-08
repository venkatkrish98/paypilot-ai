import { NextResponse } from "next/server";
import { db } from "@/packages/database";
import { checkWriteAuthorization } from "@/packages/security/auth";

export async function GET() {
  try {
    const customers = db.getCustomers();
    return NextResponse.json({ customers });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error fetching customers" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const auth = checkWriteAuthorization(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.reason || "Unauthorized" }, { status: auth.statusCode || 401 });
    }

    const body = await req.json();
    if (!body.name || typeof body.name !== "string" || body.name.trim().length === 0) {
      return NextResponse.json({ error: "Customer name is required" }, { status: 400 });
    }

    const customer = db.saveCustomer({
      id: body.id || `cust_${Date.now()}`,
      name: body.name.trim().slice(0, 100),
      email: (body.email || `${body.name.toLowerCase().replace(/[^a-z0-9]/g, "")}@example.com`).slice(0, 100),
      outstandingAmount: typeof body.outstandingAmount === "number" ? Math.max(0, body.outstandingAmount) : 0,
      riskIndicators: Array.isArray(body.riskIndicators) ? body.riskIndicators.slice(0, 10) : [],
      isNewRecipient: Boolean(body.isNewRecipient),
      notes: (body.notes || "").slice(0, 500),
      paymentHistory: Array.isArray(body.paymentHistory) ? body.paymentHistory : [],
      isDemoFixture: false,
    });
    return NextResponse.json({ customer });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error saving customer" },
      { status: 500 }
    );
  }
}
