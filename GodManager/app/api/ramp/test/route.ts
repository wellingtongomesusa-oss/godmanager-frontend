import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.RAMP_CLIENT_ID;
  const clientSecret = process.env.RAMP_CLIENT_SECRET;
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const tokenRes = await fetch("https://api.ramp.com/developer/v1/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials&scope=transactions:read cards:read",
  });
  const tokenData = await tokenRes.json();
  return NextResponse.json({ clientId, hasSecret: !!clientSecret, tokenData });
}
