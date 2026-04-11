import { NextResponse } from 'next/server'

export async function GET() {
  const clientId = process.env.RAMP_CLIENT_ID
  const clientSecret = process.env.RAMP_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'Missing env vars', hasId: !!clientId, hasSecret: !!clientSecret }, { status: 500 })
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const tokenRes = await fetch('https://api.ramp.com/developer/v1/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=cards:read',
  })

  const tokenData = await tokenRes.json()

  if (!tokenData.access_token) {
    return NextResponse.json({ error: 'Token failed', detail: tokenData, httpStatus: tokenRes.status }, { status: 500 })
  }

  const cardRes = await fetch('https://api.ramp.com/developer/v1/cards?page_size=100', {
    headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
  })

  const data = await cardRes.json()
  return NextResponse.json(data)
}
