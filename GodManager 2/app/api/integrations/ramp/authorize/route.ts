import { NextResponse } from 'next/server';

/** OAuth Ramp — requer RAMP_CLIENT_ID, RAMP_REDIRECT_URI (ou QUICKBOOKS pattern: documentar no README) */
export function GET() {
  const clientId = process.env.RAMP_CLIENT_ID;
  const redirectUri = process.env.RAMP_REDIRECT_URI ?? process.env.QUICKBOOKS_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { erro: 'Configure RAMP_CLIENT_ID e RAMP_REDIRECT_URI em .env.local' },
      { status: 500 },
    );
  }
  const url = new URL('https://api.ramp.com/v1/oauth/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', 'godmanager-ramp');
  return NextResponse.redirect(url.toString());
}
