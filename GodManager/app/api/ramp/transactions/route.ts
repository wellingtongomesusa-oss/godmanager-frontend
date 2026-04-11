import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fromDate = searchParams.get("from_date");
  const clientId = process.env.RAMP_CLIENT_ID;
  const clientSecret = process.env.RAMP_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "Ramp credentials not configured" }, { status: 500 });
  }
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const tokenRes = await fetch("https://api.ramp.com/developer/v1/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials&scope=transactions:read",
  });
  const { access_token } = await tokenRes.json();
  const url = new URL("https://api.ramp.com/developer/v1/transactions");
  url.searchParams.set("page_size", "100");
  if (fromDate) url.searchParams.set("from_date", fromDate);
  const txRes = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  const data = await txRes.json();
  return NextResponse.json(data);
}
