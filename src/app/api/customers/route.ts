import { NextResponse } from "next/server";
import { db } from "@/packages/database";

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
    const body = await req.json();
    const customer = db.saveCustomer(body);
    return NextResponse.json({ customer });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error saving customer" },
      { status: 500 }
    );
  }
}
