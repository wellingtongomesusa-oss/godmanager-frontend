import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const debug = searchParams.get('debug')
  const fromDate = searchParams.get('from_date')

  const clientId = process.env.RAMP_CLIENT_ID || ''
  const clientSecret = process.env.RAMP_CLIENT_SECRET || ''

  // Debug mode - mostra primeiros chars das credenciais
  if (debug === '1') {
    return NextResponse.json({
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      clientIdPrefix: clientId.substring(0, 15),
      clientSecretPrefix: clientSecret.substring(0, 15),
    })
  }

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'Missing env vars' }, { status: 500 })
  }

  // Tenta com credenciais no BODY (alternativa ao Basic Auth)
  const tokenRes = await fetch('https://api.ramp.com/developer/v1/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'transactions:read',
    }).toString(),
  })

  const tokenData = await tokenRes.json()

  let accessToken: string | undefined = tokenData.access_token

  if (!accessToken) {
    // Se falhou, tenta com Basic
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
    const basicRes = await fetch('https://api.ramp.com/developer/v1/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials&scope=transactions:read',
    })
    const basicData = await basicRes.json()
    accessToken = basicData.access_token
    if (!accessToken) {
      return NextResponse.json(
        {
          error: 'Token failed',
          bodyAttempt: { httpStatus: tokenRes.status, detail: tokenData },
          basicAttempt: { httpStatus: basicRes.status, detail: basicData },
        },
        { status: 500 },
      )
    }
  }

  const url = new URL('https://api.ramp.com/developer/v1/transactions')
  url.searchParams.set('page_size', '100')
  if (fromDate) url.searchParams.set('from_date', fromDate)

  const txRes = await fetch(url.toString(), {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  })

  const data = await txRes.json()
  return NextResponse.json(data)
}
