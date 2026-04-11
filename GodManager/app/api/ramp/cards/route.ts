import { NextResponse } from "next/server";

export async function GET() {
  try {
    const clientId = process.env.RAMP_CLIENT_ID;
    const clientSecret = process.env.RAMP_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: "Missing credentials" }, { status: 500 });
    }
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const tokenRes = await fetch("https://api.ramp.com/developer/v1/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials&scope=cards:read",
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      return NextResponse.json(
        { error: "Token failed", status: tokenRes.status, detail: tokenData },
        { status: 502 },
      );
    }
    const res = await fetch("https://api.ramp.com/developer/v1/cards?page_size=100", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: "Ramp cards request failed", status: res.status, detail: data },
        { status: 502 },
      );
    }
    return NextResponse.json(data);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
