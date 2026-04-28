/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

const NAV = {
  pt: ['Inicio', 'Servicos', 'FAQ', 'Sobre nos', 'Contato', 'Solicitar demo'],
  en: ['Home', 'Services', 'FAQ', 'About', 'Contact', 'Request Demo'],
  es: ['Inicio', 'Servicios', 'FAQ', 'Sobre nosotros', 'Contacto', 'Solicitar demo'],
};

const FOOTER = {
  pt: {
    tagline:
      'Suas financas com precisao — bookkeeping, trust compliance e godmanager.com.',
    links: 'Links',
    faq: 'FAQ',
    calculator: 'Calculadora de poupanca',
    contact: 'Contacto',
  },
  en: {
    tagline:
      'Your finances, handled with precision — bookkeeping, trust compliance & godmanager.com.',
    links: 'Navigate',
    faq: 'FAQ',
    calculator: 'Savings calculator',
    contact: 'Contact',
  },
  es: {
    tagline:
      'Sus finanzas con precision — bookkeeping, trust compliance y godmanager.com.',
    links: 'Enlaces',
    faq: 'FAQ',
    calculator: 'Calculadora de ahorro',
    contact: 'Contacto',
  },
};

function loadJson(rel) {
  const p = path.join(root, rel);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

const locales = ['pt-br', 'en', 'es'];
const map = { 'pt-br': 'pt', en: 'en', es: 'es' };

for (const locale of locales) {
  const key = map[locale];
  const messagesPath = path.join(root, 'messages', `${locale}.json`);
  const j = JSON.parse(fs.readFileSync(messagesPath, 'utf8'));

  const faqPath =
    locale === 'pt-br'
      ? 'scripts/marketing-faq-pt-br.json'
      : locale === 'en'
        ? 'scripts/marketing-faq-en.json'
        : 'scripts/marketing-faq-es.json';
  const savPath =
    locale === 'pt-br'
      ? 'scripts/marketing-savings-pt-br.json'
      : locale === 'en'
        ? 'scripts/marketing-savings-en.json'
        : 'scripts/marketing-savings-es.json';

  const faq = loadJson(faqPath);
  const savingsCalculator = loadJson(savPath);
  const [home, services, faqLab, about, contact, requestDemo] = NAV[key];

  j.nav = { home, services, faq: faqLab, about, contact, requestDemo };
  j.footer = FOOTER[key];
  j.faq = faq;
  j.savingsCalculator = savingsCalculator;
  j.services.calculatorSectionTitle = savingsCalculator.title;
  j.services.previewFaqTitle = faq.previewOnServices;
  j.services.seeAllFaqs = faq.seeAllFaqs;

  fs.writeFileSync(messagesPath, JSON.stringify(j, null, 2) + '\n', 'utf8');
  console.log('merged', locale);
}
