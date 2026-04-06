import { NextResponse } from 'next/server';

/**
 * GET /api/landing-export
 * Retorna a página inicial como um arquivo HTML autocontido para download.
 */
export async function GET() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Godroox Pro</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Inter, system-ui, sans-serif; color: #1c1917; background: #fff; min-height: 100vh; }
    .ticker { background: #1c1917; color: #fff; padding: 8px 0; overflow: hidden; border-bottom: 1px solid #e7e5e4; }
    .ticker-inner { display: flex; gap: 2rem; width: max-content; animation: tick 40s linear infinite; }
    .ticker span { white-space: nowrap; font-size: 0.875rem; }
    .ticker .sym { font-weight: 600; }
    .ticker .up { color: #16a34a; }
    .ticker .dn { color: #dc2626; }
    @keyframes tick { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
    .header { position: fixed; top: 40px; left: 0; right: 0; z-index: 50; height: 64px; border-bottom: 1px solid #e7e5e4; background: rgba(255,255,255,0.95); display: flex; align-items: center; justify-content: space-between; padding: 0 1.5rem; max-width: 1280px; margin: 0 auto; }
    .logo { display: flex; align-items: center; gap: 8px; text-decoration: none; color: #1c1917; font-weight: 600; font-size: 1.125rem; }
    .logo-dot { width: 32px; height: 32px; border-radius: 8px; background: #f97316; }
    nav { display: flex; gap: 2rem; }
    nav a { color: #57534e; text-decoration: none; font-size: 0.875rem; }
    nav a:hover { color: #1c1917; }
    .header-btns { display: flex; gap: 12px; align-items: center; }
    .btn { display: inline-flex; align-items: center; justify-content: center; padding: 0 1.5rem; height: 44px; border-radius: 8px; font-weight: 600; font-size: 1rem; cursor: pointer; text-decoration: none; border: 2px solid #e7e5e4; background: #fff; color: #1c1917; }
    .btn-primary { background: #f97316; color: #fff; border-color: #f97316; }
    .btn-primary:hover { background: #ea580c; }
    .lang-btn { padding: 6px 12px; font-size: 0.875rem; }
    main { padding-top: 104px; padding-bottom: 4rem; }
    .hero { border-bottom: 1px solid #f5f5f4; background: #fff; padding: 4rem 1.5rem; max-width: 1280px; margin: 0 auto; }
    .hero-inner { display: grid; gap: 3rem; max-width: 1100px; margin: 0 auto; }
    @media (min-width: 1024px) { .hero-inner { grid-template-columns: 1fr 1fr; align-items: center; } }
    .hero h1 { font-size: clamp(2.25rem, 5vw, 3.75rem); font-weight: 700; letter-spacing: -0.025em; margin-bottom: 1rem; }
    .hero p { font-size: 1.125rem; color: #57534e; margin-bottom: 2rem; max-width: 32rem; }
    .hero-cta { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
    .hero-cta input { height: 48px; min-width: 260px; padding: 0 1rem; border: 1px solid #d6d3d1; border-radius: 8px; font-size: 1rem; }
    .hero-cta input:focus { outline: none; border-color: #f97316; box-shadow: 0 0 0 2px rgba(249,115,22,0.2); }
    .hero-link { display: inline-flex; align-items: center; gap: 8px; margin-top: 1rem; font-size: 0.875rem; font-weight: 500; color: #ea580c; text-decoration: none; }
    .hero-link:hover { color: #c2410c; }
    .section { max-width: 1280px; margin: 0 auto; padding: 3rem 1.5rem; border-top: 1px solid #f5f5f4; }
    .section h2 { font-size: 1.875rem; font-weight: 700; margin-bottom: 2rem; }
    .cards { display: grid; gap: 1.5rem; max-width: 900px; }
    @media (min-width: 1024px) { .cards { grid-template-columns: 1fr 1fr; } }
    .card { border: 1px solid #e7e5e4; border-radius: 1rem; background: #fff; padding: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .card h3 { font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; }
    .card p { color: #57534e; margin-bottom: 1.5rem; font-size: 1rem; }
    .chat-wrap { position: fixed; bottom: 24px; right: 24px; z-index: 100; }
    .chat-panel { width: 340px; max-width: calc(100vw - 48px); border: 1px solid #e7e5e4; border-radius: 1rem; background: #fff; padding: 1rem; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); margin-bottom: 12px; display: none; }
    .chat-panel.open { display: block; }
    .chat-panel h4 { font-weight: 600; margin-bottom: 4px; }
    .chat-panel .q { font-size: 0.875rem; color: #57534e; margin-bottom: 1rem; }
    .chat-panel a, .chat-panel button { display: block; width: 100%; padding: 10px 1rem; margin-bottom: 8px; border: 2px solid #e7e5e4; border-radius: 8px; background: #fff; font-size: 0.875rem; font-weight: 500; color: #1c1917; text-decoration: none; text-align: center; cursor: pointer; }
    .chat-panel a:hover, .chat-panel button:hover { border-color: #f97316; background: #fff7ed; }
    .chat-panel .disclaimer { font-size: 0.75rem; color: #78716c; margin-top: 12px; }
    .chat-btn { width: 56px; height: 56px; border-radius: 50%; background: #f97316; color: #fff; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 15px -3px rgba(249,115,22,0.3); }
    .chat-btn:hover { background: #ea580c; }
    footer { border-top: 1px solid #e7e5e4; padding: 1.5rem; text-align: left; max-width: 1280px; margin: 0 auto; font-size: 0.875rem; color: #78716c; }
  </style>
</head>
<body>
  <div class="ticker">
    <div class="ticker-inner">
      <span class="sym">AAPL</span><span> $228.42</span><span class="up">+0.84%</span>
      <span class="sym">MSFT</span><span> $415.50</span><span class="dn">-0.32%</span>
      <span class="sym">GOOGL</span><span> $171.20</span><span class="up">+1.12%</span>
      <span class="sym">BTC</span><span> $43,250</span><span class="up">+2.1%</span>
      <span class="sym">ETH</span><span> $2,280</span><span class="dn">-0.8%</span>
      <span class="sym">NVDA</span><span> $495.00</span><span class="up">+1.45%</span>
      <span class="sym">AAPL</span><span> $228.42</span><span class="up">+0.84%</span>
      <span class="sym">MSFT</span><span> $415.50</span><span class="dn">-0.32%</span>
      <span class="sym">GOOGL</span><span> $171.20</span><span class="up">+1.12%</span>
      <span class="sym">BTC</span><span> $43,250</span><span class="up">+2.1%</span>
      <span class="sym">ETH</span><span> $2,280</span><span class="dn">-0.8%</span>
      <span class="sym">NVDA</span><span> $495.00</span><span class="up">+1.45%</span>
    </div>
  </div>
  <header class="header">
    <a href="/" class="logo"><span class="logo-dot"></span>Godroox Pro</a>
    <nav>
      <a href="#how">How it works</a>
      <a href="#prices">Prices</a>
      <a href="#faq">FAQ</a>
    </nav>
    <div class="header-btns">
      <button type="button" class="btn lang-btn" id="langBtn" aria-label="Language">PT</button>
      <a href="/admin/painel" class="btn">Sign in</a>
      <a href="#access" class="btn btn-primary">Get started</a>
    </div>
  </header>
  <main>
    <section class="hero">
      <div class="hero-inner">
        <div>
          <h1 id="heroTitle">Finance built for speed and control.</h1>
          <p id="heroSub">Modern cards, banking, expenses, accounting, and more — in 120+ countries.</p>
          <div class="hero-cta">
            <input type="email" id="email" placeholder="contato@godroox.com" />
            <a href="#access" class="btn btn-primary">Get started</a>
          </div>
          <a href="#access" class="hero-link">See Godroox in action →</a>
        </div>
        <div style="background:#fafaf9;border:1px solid #e7e5e4;border-radius:1rem;padding:2rem;min-height:200px;">
          <p style="color:#78716c;font-size:0.875rem;">Godroox card • Wallet</p>
        </div>
      </div>
    </section>
    <section class="section" id="access">
      <h2 id="accessTitle">Get access</h2>
      <div class="cards">
        <div class="card">
          <h3 id="freeLabel">Free trial</h3>
          <p>Start with the free plan — no card required.</p>
          <a href="/admin/painel" class="btn btn-primary">Free trial</a>
        </div>
        <div class="card">
          <h3>Godroox Pro</h3>
          <p>Advanced features, 7-day free trial. Cancel anytime.</p>
          <a href="/admin/painel" class="btn btn-primary">Try Pro for 7 days</a>
        </div>
      </div>
    </section>
    <section class="section" id="how">
      <h2 id="nextTitle">Next steps</h2>
      <ol style="list-style:decimal inside;color:#57534e;line-height:1.8;">
        <li>Get started / Free trial or Try Pro</li>
        <li>Sign in</li>
        <li>Use invoices and features (free)</li>
        <li>Unlock Pro in the app (after trial)</li>
      </ol>
    </section>
    <section class="section" id="prices">
      <h2 id="pricesTitle">Prices</h2>
      <p style="color:#57534e;max-width:42rem;" id="pricesText">Free plan: unlimited basic features. Pro: 7-day trial; then monthly subscription. Cancel anytime.</p>
    </section>
    <section class="section" id="faq">
      <h2 id="faqTitle">FAQ</h2>
      <p style="color:#57534e;max-width:42rem;" id="faqText">Questions about trial or Pro? Contact us via the dashboard or support email.</p>
    </section>
  </main>
  <footer>© ${new Date().getFullYear()} Godroox</footer>
  <div class="chat-wrap">
    <div class="chat-panel" id="chatPanel">
      <h4 id="chatWelcome">Welcome 👋</h4>
      <p class="q" id="chatQ">Looking for corporate cards, banking, expenses, or travel?</p>
      <a href="/admin/painel">Talk to our AI Sales Rep</a>
      <a href="#access">Sign up for Godroox</a>
      <a href="#access">Schedule a demo</a>
      <button type="button">Customer support</button>
      <p class="disclaimer" id="chatDisc">This chat may be recorded as described in our Privacy Policy.</p>
    </div>
    <button type="button" class="chat-btn" id="chatBtn" aria-label="Open chat">💬</button>
  </div>
  <script>
    (function() {
      var lang = 'en';
      var texts = {
        en: {
          heroTitle: 'Finance built for speed and control.',
          heroSub: 'Modern cards, banking, expenses, accounting, and more — in 120+ countries.',
          accessTitle: 'Get access',
          freeLabel: 'Free trial',
          nextTitle: 'Next steps',
          pricesTitle: 'Prices',
          pricesText: 'Free plan: unlimited basic features. Pro: 7-day trial; then monthly subscription. Cancel anytime.',
          faqTitle: 'FAQ',
          faqText: 'Questions about trial or Pro? Contact us via the dashboard or support email.',
          chatWelcome: 'Welcome 👋',
          chatQ: 'Looking for corporate cards, banking, expenses, or travel?',
          chatDisc: 'This chat may be recorded as described in our Privacy Policy.'
        },
        pt: {
          heroTitle: 'Finanças com velocidade e controle.',
          heroSub: 'Cartões, banking, despesas, contabilidade e mais — em mais de 120 países.',
          accessTitle: 'Acesso',
          freeLabel: 'Teste grátis',
          nextTitle: 'Próximos passos',
          pricesTitle: 'Preços',
          pricesText: 'Plano gratuito: recursos básicos ilimitados. Pro: trial de 7 dias; depois assinatura mensal. Cancele quando quiser.',
          faqTitle: 'FAQ',
          faqText: 'Dúvidas sobre trial ou Pro? Entre em contato pelo painel ou e-mail de suporte.',
          chatWelcome: 'Bem-vindo 👋',
          chatQ: 'Procurando cartões corporativos, banking, despesas ou viagens?',
          chatDisc: 'Este chat pode ser gravado conforme nossa Política de Privacidade.'
        }
      };
      function applyLang() {
        var t = texts[lang];
        document.getElementById('heroTitle').textContent = t.heroTitle;
        document.getElementById('heroSub').textContent = t.heroSub;
        document.getElementById('accessTitle').textContent = t.accessTitle;
        document.getElementById('freeLabel').textContent = t.freeLabel;
        document.getElementById('nextTitle').textContent = t.nextTitle;
        document.getElementById('pricesTitle').textContent = t.pricesTitle;
        document.getElementById('pricesText').textContent = t.pricesText;
        document.getElementById('faqTitle').textContent = t.faqTitle;
        document.getElementById('faqText').textContent = t.faqText;
        document.getElementById('chatWelcome').textContent = t.chatWelcome;
        document.getElementById('chatQ').textContent = t.chatQ;
        document.getElementById('chatDisc').textContent = t.chatDisc;
        document.getElementById('langBtn').textContent = lang === 'en' ? 'PT' : 'EN';
      }
      document.getElementById('langBtn').onclick = function() {
        lang = lang === 'en' ? 'pt' : 'en';
        applyLang();
      };
      document.getElementById('chatBtn').onclick = function() {
        document.getElementById('chatPanel').classList.toggle('open');
      };
    })();
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': 'attachment; filename="godroox-landing.html"',
    },
  });
}
