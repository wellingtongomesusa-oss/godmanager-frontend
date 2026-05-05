import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';

export interface StatementPDFProps {
  lang: 'pt' | 'en';
  property: {
    code: string;
    address: string;
    ownerName: string | null;
    securityDeposit: string;
    clientName: string | null;
  };
  period: {
    yearMonth: string;
    label: string;
  };
  statementNumber: string;
  issuedAt: string;
  payout: {
    totalIncome: string;
    totalExpenses: string;
    netPayout: string;
    lineItems: Array<{
      lineType: string;
      description: string;
      amount: string;
    }>;
  };
}

const I18N = {
  pt: {
    statementTitle: 'DEMONSTRATIVO DO PROPRIETARIO',
    period: 'PERIODO',
    issued: 'EMISSAO',
    statementNumber: 'DEMONSTRATIVO #',
    propertyAddress: 'ENDERECO DO IMOVEL',
    owner: 'PROPRIETARIO',
    securityDeposit: 'DEPOSITO DE SEGURANCA',
    statementPeriod: 'PERIODO DO DEMONSTRATIVO',
    incomes: 'RECEITAS (CREDITOS)',
    expenses: 'DESPESAS (DEBITOS)',
    description: 'DESCRICAO',
    amount: 'VALOR',
    totalIncomes: 'Total de Receitas',
    totalExpenses: 'Total de Despesas',
    netPayoutTitle: 'REPASSE LIQUIDO',
    netPayoutSubtitle: 'Valor a Repassar ao Proprietario',
    propertyManagerLabel: 'GESTOR DA PROPRIEDADE',
    ownerLabel: 'PROPRIETARIO',
    footerCompany:
      'Servicos de Administracao de Imoveis · Florida',
    footerNote:
      'Este demonstrativo reflete todas as transacoes referentes ao imovel acima durante o periodo indicado. Em caso de divergencia, favor entrar em contato em ate 30 dias da data de emissao.',
  },
  en: {
    statementTitle: 'OWNER STATEMENT',
    period: 'PERIOD',
    issued: 'ISSUED',
    statementNumber: 'STATEMENT #',
    propertyAddress: 'PROPERTY ADDRESS',
    owner: 'OWNER',
    securityDeposit: 'SECURITY DEPOSIT ON FILE',
    statementPeriod: 'STATEMENT PERIOD',
    incomes: 'INCOME (CREDITS)',
    expenses: 'EXPENSES (DEBITS)',
    description: 'DESCRIPTION',
    amount: 'AMOUNT',
    totalIncomes: 'Total Income',
    totalExpenses: 'Total Expenses',
    netPayoutTitle: 'NET PAYOUT',
    netPayoutSubtitle: 'Amount Due to Owner',
    propertyManagerLabel: 'PROPERTY MANAGER',
    ownerLabel: 'OWNER',
    footerCompany: 'Property Management Services · Florida',
    footerNote:
      'This statement reflects all transactions related to the property above during the period indicated. In case of any discrepancy, please contact us within 30 days of the issue date.',
  },
} as const;

const COLORS = {
  ink: '#0F1116',
  inkSoft: '#3a3f4b',
  cream: '#FFFBF1',
  amberLine: '#E5B43E',
  gold: '#D4A843',
  income: '#0a7a3a',
  expense: '#a32020',
  border: '#E1D9C7',
  muted: '#6b7280',
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingBottom: 50,
    paddingHorizontal: 36,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: COLORS.ink,
    backgroundColor: '#ffffff',
  },
  header: {
    backgroundColor: COLORS.ink,
    color: '#ffffff',
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  brandBlock: { flexDirection: 'column' },
  brandLabel: {
    color: COLORS.gold,
    fontSize: 9,
    letterSpacing: 1.2,
    fontFamily: 'Helvetica-Bold',
  },
  brandTitle: {
    color: '#ffffff',
    fontSize: 14,
    marginTop: 4,
    fontFamily: 'Helvetica-Bold',
  },
  metaBlock: { flexDirection: 'column', alignItems: 'flex-end' },
  metaLabel: {
    color: COLORS.gold,
    fontSize: 7,
    letterSpacing: 0.8,
    fontFamily: 'Helvetica-Bold',
  },
  metaValue: { color: '#ffffff', fontSize: 9, marginBottom: 4 },
  amberStrip: { backgroundColor: COLORS.amberLine, height: 4 },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 14,
    marginBottom: 14,
  },
  infoCell: {
    width: '50%',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.gold,
    marginBottom: 8,
  },
  infoLabel: {
    color: COLORS.muted,
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.6,
  },
  infoValue: {
    color: COLORS.ink,
    fontSize: 11,
    marginTop: 4,
    fontFamily: 'Helvetica-Bold',
  },
  sectionHeader: {
    backgroundColor: COLORS.ink,
    color: '#ffffff',
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginTop: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F4EFE0',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  tableHeaderCellLabel: {
    fontSize: 8,
    color: COLORS.muted,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.6,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  tableTotalRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gold,
    backgroundColor: '#FFF8E2',
  },
  cellDesc: { flex: 1, fontSize: 10, color: COLORS.ink },
  cellAmount: { width: 100, fontSize: 10, textAlign: 'right' },
  cellAmountIncome: { color: COLORS.income, fontFamily: 'Helvetica-Bold' },
  cellAmountExpense: { color: COLORS.expense, fontFamily: 'Helvetica-Bold' },
  totalLabel: { flex: 1, fontSize: 10, fontFamily: 'Helvetica-Bold' },
  totalAmount: {
    width: 100,
    fontSize: 11,
    textAlign: 'right',
    fontFamily: 'Helvetica-Bold',
  },
  netBanner: {
    marginTop: 18,
    backgroundColor: COLORS.ink,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  netLabel: {
    color: COLORS.gold,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1,
  },
  netSubtitle: {
    color: '#ffffff',
    fontSize: 11,
    marginTop: 2,
    fontFamily: 'Helvetica-Bold',
  },
  netAmount: { color: COLORS.gold, fontSize: 22, fontFamily: 'Helvetica-Bold' },
  footer: {
    marginTop: 30,
    fontSize: 8,
    color: COLORS.muted,
    lineHeight: 1.5,
  },
  footerSignatureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  footerSignBlock: {
    flexDirection: 'column',
    width: '45%',
  },
  footerSignLabel: {
    fontSize: 8,
    color: COLORS.muted,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.6,
  },
  footerSignValue: {
    fontSize: 10,
    color: COLORS.ink,
    marginTop: 4,
    fontFamily: 'Helvetica-Bold',
  },
});

const fmtUSD = (raw: string) => {
  const n = parseFloat(raw);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(n);
};

const fmtUSDNeg = (raw: string) => {
  const n = parseFloat(raw);
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(n);
  return `(${formatted})`;
};

export function StatementPDF({
  lang,
  property,
  period,
  statementNumber,
  issuedAt,
  payout,
}: StatementPDFProps) {
  const t = I18N[lang];
  const incomes = payout.lineItems.filter((l) => l.lineType === 'income');
  const expenses = payout.lineItems.filter((l) => l.lineType === 'expense');

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.brandBlock}>
            <Text style={styles.brandLabel}>
              {(property.clientName ?? 'MANAGER PROP').toUpperCase()}
            </Text>
            <Text style={styles.brandTitle}>{t.statementTitle}</Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>{t.period}</Text>
            <Text style={styles.metaValue}>{period.label}</Text>
            <Text style={styles.metaLabel}>{t.issued}</Text>
            <Text style={styles.metaValue}>{issuedAt}</Text>
            <Text style={styles.metaLabel}>{t.statementNumber}</Text>
            <Text style={styles.metaValue}>{statementNumber}</Text>
          </View>
        </View>
        <View style={styles.amberStrip} />

        <View style={styles.infoGrid}>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>{t.propertyAddress}</Text>
            <Text style={styles.infoValue}>{property.address}</Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>{t.owner}</Text>
            <Text style={styles.infoValue}>{property.ownerName ?? '—'}</Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>{t.securityDeposit}</Text>
            <Text style={styles.infoValue}>{property.securityDeposit}</Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>{t.statementPeriod}</Text>
            <Text style={styles.infoValue}>{period.label}</Text>
          </View>
        </View>

        <Text style={styles.sectionHeader}>{t.incomes}</Text>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCellLabel, { flex: 1 }]}>
            {t.description}
          </Text>
          <Text
            style={[styles.tableHeaderCellLabel, { width: 100, textAlign: 'right' }]}
          >
            {t.amount}
          </Text>
        </View>
        {incomes.map((li, i) => (
          <View key={`in-${i}`} style={styles.tableRow}>
            <Text style={styles.cellDesc}>{li.description}</Text>
            <Text style={[styles.cellAmount, styles.cellAmountIncome]}>
              {fmtUSD(li.amount)}
            </Text>
          </View>
        ))}
        <View style={styles.tableTotalRow}>
          <Text style={styles.totalLabel}>{t.totalIncomes}</Text>
          <Text style={[styles.totalAmount, { color: COLORS.income }]}>
            {fmtUSD(payout.totalIncome)}
          </Text>
        </View>

        <Text style={styles.sectionHeader}>{t.expenses}</Text>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCellLabel, { flex: 1 }]}>
            {t.description}
          </Text>
          <Text
            style={[styles.tableHeaderCellLabel, { width: 100, textAlign: 'right' }]}
          >
            {t.amount}
          </Text>
        </View>
        {expenses.map((li, i) => (
          <View key={`ex-${i}`} style={styles.tableRow}>
            <Text style={styles.cellDesc}>{li.description}</Text>
            <Text style={[styles.cellAmount, styles.cellAmountExpense]}>
              {fmtUSDNeg(li.amount)}
            </Text>
          </View>
        ))}
        <View style={styles.tableTotalRow}>
          <Text style={styles.totalLabel}>{t.totalExpenses}</Text>
          <Text style={[styles.totalAmount, { color: COLORS.expense }]}>
            {fmtUSDNeg(payout.totalExpenses)}
          </Text>
        </View>

        <View style={styles.netBanner}>
          <View>
            <Text style={styles.netLabel}>{t.netPayoutTitle}</Text>
            <Text style={styles.netSubtitle}>{t.netPayoutSubtitle}</Text>
          </View>
          <Text style={styles.netAmount}>{fmtUSD(payout.netPayout)}</Text>
        </View>

        <View style={styles.footer}>
          <View style={styles.footerSignatureRow}>
            <View style={styles.footerSignBlock}>
              <Text style={styles.footerSignLabel}>
                {t.propertyManagerLabel}
              </Text>
              <Text style={styles.footerSignValue}>
                {property.clientName ?? 'Manager Prop LLC'}
              </Text>
            </View>
            <View style={styles.footerSignBlock}>
              <Text style={styles.footerSignLabel}>{t.ownerLabel}</Text>
              <Text style={styles.footerSignValue}>
                {property.ownerName ?? '—'}
              </Text>
            </View>
          </View>
          <Text>
            {property.clientName ?? 'Manager Prop LLC'} · {t.footerCompany}
          </Text>
          <Text style={{ marginTop: 6 }}>{t.footerNote}</Text>
        </View>
      </Page>
    </Document>
  );
}
