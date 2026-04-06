import { NextResponse } from 'next/server';

/**
 * Inicia OAuth 2.0 Intuit — redireciona para autorização QuickBooks Online.
 * Requer QUICKBOOKS_CLIENT_ID, QUICKBOOKS_REDIRECT_URI
 */
export function GET() {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID;
  const redirectUri = process.env.QUICKBOOKS_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { erro: 'Configure QUICKBOOKS_CLIENT_ID e QUICKBOOKS_REDIRECT_URI em .env.local' },
      { status: 500 },
    );
  }
  const scope = 'com.intuit.quickbooks.accounting';
  const url = new URL('https://appcenter.intuit.com/connect/oauth2');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', scope);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', 'godmanager-qbo');
  return NextResponse.redirect(url.toString());
}
