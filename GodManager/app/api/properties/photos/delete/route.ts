import { NextRequest, NextResponse } from "next/server";
import { deleteObject } from "@/lib/r2";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { key } = body || {};

    if (!key || typeof key !== "string") {
      return NextResponse.json({ error: "key is required" }, { status: 400 });
    }

    if (!key.startsWith("properties/")) {
      return NextResponse.json(
        { error: "key must start with 'properties/'" },
        { status: 400 }
      );
    }

    if (key.includes("..") || key.includes("//")) {
      return NextResponse.json({ error: "invalid key" }, { status: 400 });
    }

    await deleteObject(key);

    return NextResponse.json({ ok: true, deleted: key });
  } catch (err: any) {
    console.error("[photos/delete] Error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Internal error" },
      { status: 500 }
    );
  }
}
