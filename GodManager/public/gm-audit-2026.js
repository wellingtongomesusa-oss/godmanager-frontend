/** Auditoria 2026 — AppFolio General Ledger (browser). Sem localStorage. */
(function () {
  'use strict';

  var AUD_ACC = {
    3150: 'Owner Contribution',
    3250: 'Owner Distribution',
    4100: 'Rent Income',
    4101: 'Section 8 Rent',
    4300: 'Association Income',
    4410: 'NSF Fees',
    4420: 'Tax Passthru',
    4430: 'Pet Fee-Non Refundable',
    4440: 'Application Fee',
    4450: 'Insurance Services',
    4460: 'Late Fee',
    4470: 'Utility Reimbursement Fee',
    4480: 'Month-to-Month Fee',
    4500: 'Deposit Forfeit',
    4550: 'Laundry Income',
    4700: 'Miscellaneous Income',
    4800: 'Convenience Fee',
    4850: 'Admin Fee Income',
    4860: 'Renewal Fee Income',
    6050: 'Advertising',
    6061: 'Travel',
    6062: 'Mileage',
    6063: 'Meals',
    6071: 'Carpet Cleaning',
    6072: 'Janitorial',
    6073: 'General Maintenance Labor',
    6074: 'Landscaping',
    6075: 'HOA Dues',
    6076: 'Cleaning and Maintenance-Other',
    6091: 'Property Insurance',
    6101: 'Legal',
    6102: 'Accounting',
    6103: 'Other',
    6111: 'Management Fees',
    6112: 'Tenant Placement Fees',
    6113: 'Vendor Discounts',
    6114: 'Renewal Lease Fee',
    6121: 'Mortgage Interest',
    6122: 'Mortgage Principal',
    6141: 'Painting',
    6142: 'Plumbing',
    6143: 'Flooring',
    6144: 'HVAC',
    6145: 'Key/Lock Replacement',
    6146: 'Roof Repair',
    6147: 'Repairs-Other',
    6150: 'Supplies',
    6161: 'Property Tax',
    6171: 'Electricity',
    6172: 'Gas',
    6173: 'Water',
    6174: 'Sewer',
    6175: 'Garbage',
    6191: 'Security Service',
    6192: 'Bank Fees',
    6193: 'Equipment Rental',
    7010: 'Appliances',
    7020: 'Equipment/Tools',
    7030: 'Remodel',
    7040: 'New Roof',
    7050: 'Furniture',
  };

  function accLabel(gl) {
    return AUD_ACC[gl] || 'Conta GL ' + gl;
  }

  function round2(n) {
    return Math.round(Number(n || 0) * 100) / 100;
  }

  function money(cell) {
    var s = String(cell == null ? '' : cell).trim();
    if (!s) return 0;
    s = s.replace(/^["']+|["']+$/g, '');
    s = s.replace(/[$\u00a0\s]/g, '');
    var par = /^\(.*\)$/.test(s);
    if (par) s = s.slice(1, -1);
    var x = parseFloat(s.replace(/,/g, ''));
    if (!isFinite(x)) return 0;
    if (par) x = -x;
    return round2(x);
  }

  function glHeader(txt) {
    var m = String(txt || '').match(/^\s*->\s*(\d{4})\s*-\s*(.+?)\s*$/);
    if (!m) return null;
    return { gl: m[1], name: String(m[2]).trim() };
  }

  function rowVal(row, keys) {
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (
        Object.prototype.hasOwnProperty.call(row, k) &&
        row[k] !== undefined &&
        row[k] !== null &&
        row[k] !== ''
      )
        return row[k];
    }
    return '';
  }

  function parseAppfolioGeneralLedger(csvText) {
    if (typeof Papa === 'undefined') throw new Error('PapaParse indisponivel (CDN)');
    var p = Papa.parse(csvText.trim(), {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: function (h) {
        return String(h || '').trim();
      },
    });
    var rows = p.data || [];
    var propKey = rowVal.bind(null, ['Property', 'property']);
    var dateKey = rowVal.bind(null, ['Date', 'date']);
    var payKey = rowVal.bind(null, ['Payee / Payer', 'Payee/Payer', 'Payee']);
    var typeKey = rowVal.bind(null, ['Type', 'type']);
    var refKey = rowVal.bind(null, ['Reference', 'reference']);
    var debitKey = rowVal.bind(null, ['Debit', 'debit']);
    var creditKey = rowVal.bind(null, ['Credit', 'credit']);
    var descKey = rowVal.bind(null, ['Description', 'description']);

    var curGl = '';
    var curName = '';
    var properties = {};
    var propOrder = [];

    function ensureProp(key) {
      if (!properties[key]) {
        properties[key] = {
          txs: [],
          income4: 0,
          expense67: 0,
          net4100c: 0,
          debit3250: 0,
          credit3150: 0,
          debit6111: 0,
          ownerHints: [],
        };
        propOrder.push(key);
      }
      return properties[key];
    }

    for (var ri = 0; ri < rows.length; ri++) {
      var row = rows[ri];
      if (!row || typeof row !== 'object') continue;
      var pcol = propKey(row);
      var pstr = String(pcol == null ? '' : pcol);
      var desc = String(descKey(row) || '');
      var typeV = String(typeKey(row) || '');

      var gh = glHeader(pstr);
      if (gh) {
        curGl = gh.gl;
        curName = gh.name || accLabel(curGl);
        continue;
      }

      if (/starting\s+balance/i.test(pstr) || /starting\s+balance/i.test(typeV + ' ' + desc)) continue;

      var propTrim = pstr.trim();
      if (!propTrim || /^->/.test(propTrim)) continue;
      if (!curGl) continue;

      var debit = money(debitKey(row));
      var credit = money(creditKey(row));
      if (!debit && !credit && !desc && !typeV) continue;

      var blob = ensureProp(propTrim);
      var tx = {
        gl: curGl,
        glLabel: curName || accLabel(curGl),
        date: String(dateKey(row) || '').trim(),
        payee: String(payKey(row) || '').trim(),
        type: typeV,
        ref: String(refKey(row) || '').trim(),
        debit: debit,
        credit: credit,
        description: desc,
      };
      blob.txs.push(tx);

      var g = curGl;
      if (/^4/.test(g)) blob.income4 = round2(blob.income4 + credit);
      if (/^6|^7/.test(g)) blob.expense67 = round2(blob.expense67 + debit);
      if (g === '4100') blob.net4100c = round2(blob.net4100c + credit);
      if (g === '3250') {
        blob.debit3250 = round2(blob.debit3250 + debit);
        if (tx.payee && blob.ownerHints.indexOf(tx.payee) < 0) blob.ownerHints.push(tx.payee);
      }
      if (g === '3150') blob.credit3150 = round2(blob.credit3150 + credit);
      if (g === '6111') blob.debit6111 = round2(blob.debit6111 + debit);
    }

    var keysSorted = propOrder.slice().sort(function (a, b) {
      return a.localeCompare(b);
    });
    var idxMap = {};
    for (var j = 0; j < keysSorted.length; j++) idxMap[keysSorted[j]] = j + 1;

    var enriched = {};
    for (var ks = 0; ks < keysSorted.length; ks++) {
      var key = keysSorted[ks];
      var pb = properties[key];
      var rent = pb.net4100c || 0;
      var pct = rent > 0 ? round2((pb.debit6111 / rent) * 100) : null;
      var feeBand = pct == null ? 'na' : pct <= 8 ? 'good' : pct <= 10 ? 'warn' : 'bad';
      enriched[key] = {
        key: key,
        txs: pb.txs,
        income4: pb.income4,
        expense67: pb.expense67,
        rent4100: pb.net4100c,
        dist3250: pb.debit3250,
        cont3150: pb.credit3150,
        fee6111: pb.debit6111,
        feePct: pct,
        feeBand: feeBand,
        ownerHints: pb.ownerHints,
        seqIdx: idxMap[key],
      };
    }

    var gRent = 0,
      g3250 = 0,
      g6111 = 0,
      gInc4 = 0,
      gExp67 = 0;
    for (var qi = 0; qi < keysSorted.length; qi++) {
      var ek = enriched[keysSorted[qi]];
      gRent += ek.rent4100;
      g3250 += ek.dist3250;
      g6111 += ek.fee6111;
      gInc4 += ek.income4;
      gExp67 += ek.expense67;
    }
    var globalFeePct = gRent > 0 ? round2((g6111 / gRent) * 100) : null;

    return {
      properties: enriched,
      totals: {
        rent4100: round2(gRent),
        dist3250: round2(g3250),
        fee6111: round2(g6111),
        income4: round2(gInc4),
        expense67: round2(gExp67),
        globalFeePct: globalFeePct,
        props: keysSorted.length,
      },
      seqKeys: keysSorted,
    };
  }

  function fmtUsd(n) {
    return Number(n || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function feeBadgeClass(band) {
    if (band === 'good')
      return 'background:var(--green-bg);color:var(--green);border:1px solid var(--green-bd)';
    if (band === 'warn')
      return 'background:var(--amber-bg);color:var(--amber);border:1px solid var(--amber-bd)';
    if (band === 'bad') return 'background:var(--red-bg);color:var(--red);border:1px solid var(--red-bd)';
    return 'background:var(--cream);color:var(--ink3);border:1px solid var(--border)';
  }

  function parseAddr(propKey) {
    var ix = propKey.lastIndexOf(' - ');
    if (ix <= 0) return { title: propKey.trim(), addr: '' };
    return { title: propKey.slice(0, ix).trim(), addr: propKey.slice(ix + 3).trim() };
  }

  function periodFromTxs(txs) {
    var ds = txs
      .map(function (t) {
        return t.date;
      })
      .filter(Boolean)
      .sort();
    if (!ds.length) return '\u2014';
    var a = ds[0].slice(0, 10);
    var z = ds[ds.length - 1].slice(0, 10);
    if (a === z) return a;
    return a + ' \u2014 ' + z;
  }

  function labelLine(tx) {
    return accLabel(tx.gl) + ' (' + tx.gl + ')';
  }

  function buildPdfBlob(propKey, ctx) {
    var p = ctx.properties[propKey];
    if (!p) throw new Error('Propriedade nao encontrada');
    if (!window.jspdf || !window.jspdf.jsPDF) throw new Error('jsPDF ausente');

    var doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'letter' });
    var navy = '#1a3a5c';
    var cream = '#f5ead8';
    var gold = '#c9a96e';

    var wpt = doc.internal.pageSize.getWidth();
    var pageH = doc.internal.pageSize.getHeight();
    var m = 40;
    var yy = m;

    doc.setFillColor(navy);
    doc.rect(0, 0, wpt, 78, 'F');
    doc.setTextColor('#ffffff');
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('MANAGER PROP', m, yy);
    yy += 18;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('OWNER STATEMENT — Auditoria GL 2026', m, yy);

    yy = 94;
    doc.setTextColor('#1a1a1c');

    var now = new Date();
    var mm = String(now.getMonth() + 1).padStart(2, '0');
    var seq = String(p.seqIdx || 1).padStart(3, '0');
    var cert = 'GM-AUD-2026-MP-' + seq + '-' + mm;

    doc.setDrawColor(gold);
    doc.setFillColor(cream);
    doc.roundedRect(m, yy, wpt - m * 2, 62, 4, 4, 'FD');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(navy);
    doc.text('Certificate of Audit', m + 14, yy + 22);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor('#4a4540');
    doc.text(cert + ' · AppFolio General Ledger (GodManager Auditoria 2026)', m + 14, yy + 40);

    yy += 80;
    doc.setFontSize(9);
    doc.setTextColor('#1a1a1c');
    var ad = parseAddr(propKey);

    doc.setFont('helvetica', 'bold');
    doc.text('Property', m, yy);
    doc.setFont('helvetica', 'normal');
    doc.text(ad.title + ' — ' + ad.addr, m + 80, yy);
    yy += 14;

    var og = (p.ownerHints && p.ownerHints[0]) || '(a definir)';
    doc.setFont('helvetica', 'bold');
    doc.text('Owner', m, yy);
    doc.setFont('helvetica', 'normal');
    doc.text(og, m + 80, yy);
    yy += 14;

    doc.setFont('helvetica', 'bold');
    doc.text('Period', m, yy);
    doc.setFont('helvetica', 'normal');
    doc.text(periodFromTxs(p.txs), m + 80, yy);
    yy += 26;

    var incTot = 0;
    yy += 4;
    doc.setFillColor('#edeae4');
    doc.rect(m, yy - 6, wpt - m * 2, 16, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('INCOME (CREDITS)', m + 8, yy + 6);
    yy += 22;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);

    var xi = 0;
    for (; xi < p.txs.length; xi++) {
      var tx = p.txs[xi];
      if (!/^4/.test(tx.gl) || tx.credit <= 0) continue;
      if (yy > pageH - 90) {
        doc.addPage();
        yy = m;
      }
      incTot = round2(incTot + tx.credit);
      var l =
        (tx.date || '').slice(0, 12) +
        ' · ' +
        labelLine(tx) +
        ' · ' +
        (tx.description || '').slice(0, 74);
      doc.text(l, m + 6, yy);
      doc.text('$ ' + fmtUsd(tx.credit), wpt - m - 6, yy, { align: 'right' });
      yy += 11;
    }
    doc.setFont('helvetica', 'bold');
    doc.text('Total Income', m + 6, yy + 6);
    doc.text('$ ' + fmtUsd(incTot), wpt - m - 6, yy + 6, { align: 'right' });
    yy += 28;

    var expTot = 0;
    doc.setFillColor('#edeae4');
    doc.rect(m, yy - 6, wpt - m * 2, 16, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('EXPENSES (DEBITS)', m + 8, yy + 6);
    yy += 22;
    doc.setFont('helvetica', 'normal');
    var xj = 0;
    for (; xj < p.txs.length; xj++) {
      var txe = p.txs[xj];
      if (!/^6|^7/.test(txe.gl) || txe.debit <= 0) continue;
      if (yy > pageH - 90) {
        doc.addPage();
        yy = m;
      }
      expTot = round2(expTot + txe.debit);
      var l3 =
        (txe.date || '').slice(0, 12) +
        ' · ' +
        labelLine(txe) +
        ' · ' +
        (txe.description || '').slice(0, 74);
      doc.text(l3, m + 6, yy);
      doc.text('$ ' + fmtUsd(txe.debit), wpt - m - 6, yy, { align: 'right' });
      yy += 11;
    }
    doc.setFont('helvetica', 'bold');
    doc.text('Total Expenses', m + 6, yy + 6);
    doc.text('$ ' + fmtUsd(expTot), wpt - m - 6, yy + 6, { align: 'right' });
    yy += 30;

    var netVia = round2(p.income4 - p.expense67);
    var carry = round2(p.dist3250 - netVia);

    if (yy > pageH - 170) {
      doc.addPage();
      yy = m;
    }

    doc.setFillColor(cream);
    doc.roundedRect(m, yy - 10, wpt - m * 2, 124, 4, 4, 'FD');
    doc.setDrawColor(gold);
    doc.roundedRect(m, yy - 10, wpt - m * 2, 124, 4, 4, 'S');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('NET PAYOUT (3250 Owner Distribution)', m + 14, yy + 8);
    doc.setFontSize(18);
    doc.text('$ ' + fmtUsd(p.dist3250), m + 14, yy + 34);

    yy += 64;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor('#4a4540');
    doc.text('Total Income (4xxx · credit)= $ ' + fmtUsd(p.income4), m + 14, yy);
    yy += 11;
    doc.text('Total Expenses (6xxx/7xxx · debit)= $ ' + fmtUsd(p.expense67), m + 14, yy);
    yy += 11;
    doc.text('Income menos Expenses = $ ' + fmtUsd(netVia), m + 14, yy);
    yy += 11;
    if (Math.abs(carry) >= 0.02)
      doc.text('(\xb1) Saldo retido / carry-over: $ ' + fmtUsd(-carry), m + 14, yy);
    else doc.text('Carry-over: $ 0,00', m + 14, yy);

    yy = pageH - 54;
    doc.setFontSize(8);
    doc.setTextColor('#8a8580');
    doc.text('Manager Prop LLC · Property Management Services · Florida · godmanager.com', m, yy);

    return doc.output('blob');
  }

  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () {
        var data = fr.result || '';
        var ix = String(data).indexOf(',');
        resolve(ix >= 0 ? String(data).slice(ix + 1) : String(data));
      };
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  }

  function gmEscQuote(s) {
    return String(s || '')
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'");
  }

  function escHtml(t) {
    return String(t || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  function render(ctx) {
    var q = '';
    try {
      q = (document.getElementById('aud2026-filter').value || '').toLowerCase().trim();
    } catch (_) {}

    var tbody = document.getElementById('aud2026-tbody');
    if (!tbody) return;

    var keys = ctx.seqKeys.filter(function (k) {
      return !q || String(k || '').toLowerCase().indexOf(q) >= 0;
    });

    keys.sort(function (a, b) {
      return (ctx.properties[b].rent4100 || 0) - (ctx.properties[a].rent4100 || 0);
    });

    var sumR = 0,
      sumD = 0,
      sumF = 0,
      wtN = 0,
      wtD = 0;
    var rows = '';
    window.__AUD_ROW_KEYS = keys;
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var pv = ctx.properties[key];
      sumR += pv.rent4100;
      sumD += pv.dist3250;
      sumF += pv.fee6111;
      if (pv.rent4100 > 0) {
        wtD += pv.rent4100;
        wtN += pv.fee6111;
      }
      var pctStr = pv.feePct == null ? '\u2014' : pv.feePct.toFixed(2).replace('.', ',') + '%';
      var pctStyle = feeBadgeClass(pv.feeBand);
      var kEsc = gmEscQuote(key);
      rows +=
        '<tr><td>' +
        escHtml(key.length > 160 ? key.slice(0, 157) + '\u2026' : key) +
        '</td>' +
        '<td style="font-family:JetBrains Mono,monospace">$ ' +
        fmtUsd(pv.rent4100) +
        '</td>' +
        '<td style="font-family:JetBrains Mono,monospace">$ ' +
        fmtUsd(pv.dist3250) +
        '</td>' +
        '<td style="font-family:JetBrains Mono,monospace">$ ' +
        fmtUsd(pv.fee6111) +
        '</td>' +
        '<td><span style="padding:3px 9px;border-radius:20px;font-size:10px;font-weight:600;' +
        pctStyle +
        '">' +
        pctStr +
        '</span></td>' +
        '<td style="white-space:nowrap">' +
        '<button type="button" class="cl-btn-sec" style="padding:7px 10px;font-weight:600" onclick="gmAuditPdfByKeySafe(\'' +
        kEsc +
        '\')">PDF</button> ' +
        '<button type="button" class="cl-btn-sec" style="padding:7px 10px" onclick="gmAuditEmailByKey(\'' +
        kEsc +
        '\')">E-mail</button> ' +
        '<button type="button" class="cl-btn-sec" style="padding:7px 10px" onclick="gmAuditWaByKey(\'' +
        kEsc +
        '\')">WhatsApp</button></td>' +
        '</tr>';
    }
    tbody.innerHTML =
      rows || '<tr><td colspan="6">Sem dados. Carregue um CSV AppFolio General Ledger.</td></tr>';

    var kpi = ctx.totals;
    function setTxt(id, t) {
      var el = document.getElementById(id);
      if (el) el.textContent = t;
    }
    setTxt('aud2026-kpi-rent4100', '$ ' + fmtUsd(kpi.rent4100));
    setTxt('aud2026-kpi-3250', '$ ' + fmtUsd(kpi.dist3250));
    setTxt('aud2026-kpi-6111', '$ ' + fmtUsd(kpi.fee6111));
    setTxt(
      'aud2026-kpi-global-pct',
      kpi.globalFeePct == null ? '\u2014' : kpi.globalFeePct.toFixed(2).replace('.', ',') + '%',
    );
    setTxt('aud2026-kpi-props', String(kpi.props));

    var fr = document.getElementById('aud2026-foot-rent4100');
    var fd = document.getElementById('aud2026-foot-3250');
    var ff = document.getElementById('aud2026-foot-6111');
    var fp = document.getElementById('aud2026-foot-pct');
    if (fr) fr.textContent = '$ ' + fmtUsd(sumR);
    if (fd) fd.textContent = '$ ' + fmtUsd(sumD);
    if (ff) ff.textContent = '$ ' + fmtUsd(sumF);
    if (fp)
      fp.textContent =
        wtD > 0 ? round2((wtN / wtD) * 100).toFixed(2).replace('.', ',') + '% (filtro)' : '\u2014';

    window.__AUD_TOTALS_NOTE = ctx.totals;
  }

  function csvMoneyEn(dollars) {
    var x = round2(Number(dollars || 0));
    var s =
      x >= 0
        ? Number(x.toFixed(2)).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : '(' +
          Number(Math.abs(x).toFixed(2)).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }) +
          ')';
    return '"' + s + '"';
  }

  function qaSplitTotals(totalUsd, propCount) {
    var cents = Math.round(Number(totalUsd) * 100);
    var base = Math.floor(cents / propCount);
    var rem = cents - base * propCount;
    var out = [];
    for (var i = 0; i < propCount; i++) out.push(round2((base + (i < rem ? 1 : 0)) / 100));
    return out;
  }

  function qaFixtureCsv() {
    var P = '241 Lasso Drive - 241 Lasso Drive Kissimmee, FL 34747';
    var lines = [
      'Property,Date,Payee / Payer,Type,Reference,Debit,Credit,Balance,Description',
      '-> 4100 - Rent Income,,,,,,,',
      'Starting Balance,,,,,,,0 ,',
      [
        '"' + P + '"',
        '2026-05-05',
        'Tenant',
        'Charge',
        'RNT-1',
        '',
        csvMoneyEn(17500.0),
        '0',
        'Rent 4100',
      ].join(','),
      '-> 4800 - Convenience Fee,,,,,,,',
      [
        '"' + P + '"',
        '2026-05-05',
        'Tenant',
        'Fee',
        'CF',
        '',
        csvMoneyEn(0.6),
        '0',
        'Fee',
      ].join(','),
      '-> 3150 - Owner Contribution,,,,,,,',
      [
        '"' + P + '"',
        '2026-05-06',
        'Maria Owner',
        'Contribution',
        'CTB',
        '',
        csvMoneyEn(290),
        '',
        'Owner Contribution',
      ].join(','),
      '-> 6111 - Management Fees,,,,,,,',
      [
        '"' + P + '"',
        '2026-05-10',
        'Manager Prop LLC',
        'Expense',
        'MGMT',
        csvMoneyEn(1400.0),
        '',
        '',
        'Management Fees',
      ].join(','),
      '-> 6075 - HOA Dues,,,,,,,',
      [
        '"' + P + '"',
        '2026-05-12',
        'HOA',
        'Bill',
        'HOA',
        csvMoneyEn(8601.69),
        '',
        '',
        'HOA Dues bundle',
      ].join(','),
      '-> 3250 - Owner Distribution,,,,,,,',
      [
        '"' + P + '"',
        '2026-05-15',
        'Maria Owner',
        'Payout',
        'OWN',
        csvMoneyEn(6580.01),
        '',
        '',
        'Owner disbursement',
      ].join(','),
    ];

    var rents = qaSplitTotals(763559.47, 85);
    var dists = qaSplitTotals(564332.07, 85);
    var fees = qaSplitTotals(42610.15, 85);
    for (var n = 0; n < 85; n++) {
      var addr =
        'Prop Extra ' +
        String(n).padStart(2, '0') +
        ' - 100 Main St Orlando, FL 32801';
      lines.push('-> 4100 - Rent Income,,,,,,,');
      lines.push(['"' + addr + '"', '2026-05-01', 'T', '', 'R', '', csvMoneyEn(rents[n]), '', 'rent'].join(','));
      lines.push('-> 3250 - Owner Distribution,,,,,,,');
      lines.push(['"' + addr + '"', '2026-05-05', 'Owner', 'P', 'O', csvMoneyEn(dists[n]), '', '', 'dist'].join(','));
      lines.push('-> 6111 - Management Fees,,,,,,,');
      lines.push(['"' + addr + '"', '2026-05-03', 'PM', 'E', 'M', csvMoneyEn(fees[n]), '', '', 'mgmt'].join(','));
    }
    return lines.join('\n');
  }

  /** Totais globais fixture: 570912.08 · 781059.47 · 44010.15 · 86 props */
  window.gmAudit2026FixtureGlobal = function () {
    var csv = qaFixtureCsv();
    window.__AUD2026_LAST_TEXT = csv;
    var pk = parseAppfolioGeneralLedger(csv);
    window.__AUD2026_CTX = pk;
    render(pk);
    var chk =
      Math.abs(pk.totals.dist3250 - 570912.08) < 0.02 &&
      Math.abs(pk.totals.rent4100 - 781059.47) < 0.02 &&
      Math.abs(pk.totals.fee6111 - 44010.15) < 0.02 &&
      pk.totals.props === 86;
    alert(
      (chk ? 'Globais QA OK (~86 propriedades alvo).\n' : 'Globais divergentes:\n') +
        '3250 total=' +
        fmtUsd(pk.totals.dist3250) +
        '\n4100 total=' +
        fmtUsd(pk.totals.rent4100) +
        '\n6111 total=' +
        fmtUsd(pk.totals.fee6111) +
        '\nprops=' +
        pk.totals.props,
    );
  };

  window.gmAudit2026Fixture241 = function () {
    try {
      var csv = qaFixtureCsv();
      var pk = parseAppfolioGeneralLedger(csv);
      window.__AUD2026_LAST_TEXT = csv;
      window.__AUD2026_CTX = pk;
      render(pk);
      var lk = '';
      for (var ki in pk.properties)
        if (/241\s+Lasso/i.test(ki)) {
          lk = ki;
          break;
        }
      if (!lk) return alert('241 Lasso nao encontrada na fixture.');
      var p241 = pk.properties[lk];
      var okInc = Math.abs(p241.income4 - 17500.6) < 0.06;
      var okExp = Math.abs(p241.expense67 - 10001.69) < 0.06;
      var okD = Math.abs(p241.dist3250 - 6580.01) < 0.06;
      var okMg = Math.abs(p241.fee6111 - 1400) < 0.06;
      var okPct = p241.feePct != null && Math.abs(p241.feePct - 8) < 0.05;
      var okRent410 = Math.abs(p241.rent4100 - 17500) < 0.02;
      var okCt315 = Math.abs(p241.cont3150 - 290) < 0.02;
      alert(
        (okInc && okExp && okD && okMg && okPct && okRent410 && okCt315 ? '241 Lasso QA OK.\n' : '241 parcial:\n') +
          '4100 Rent=' +
          fmtUsd(p241.rent4100) +
          ' Income(4xxx)=' +
          fmtUsd(p241.income4) +
          ' Exp(6/7)=' +
          fmtUsd(p241.expense67) +
          ' 3250=' +
          fmtUsd(p241.dist3250) +
          ' 3150=' +
          fmtUsd(p241.cont3150) +
          ' 6111=' +
          fmtUsd(p241.fee6111) +
          ' %=' +
          (p241.feePct != null ? p241.feePct.toFixed(2) : '\u2014'),
      );
    } catch (e) {
      alert('QA: ' + (e && e.message));
    }
  };

  window.gmAuditPdfByKeySafe = function (keyStr) {
    var ctx = window.__AUD2026_CTX;
    if (!ctx || !ctx.properties[keyStr]) return;
    try {
      var blob = buildPdfBlob(keyStr, ctx);
      var url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 120000);
    } catch (e) {
      alert(e && e.message);
    }
  };

  window.gmAuditEmailByKey = function (keyStr) {
    var ctx = window.__AUD2026_CTX;
    if (!ctx || !ctx.properties[keyStr]) return;
    var pv = ctx.properties[keyStr];
    var guessed = (pv.ownerHints && pv.ownerHints[0]) || '';
    var to = '';
    try {
      to = prompt('E-mail do owner:', guessed || '');
    } catch (_) {
      return;
    }
    if (!to || String(to).indexOf('@') < 0) return;
    Promise.resolve(buildPdfBlob(keyStr, ctx))
      .then(blobToBase64)
      .then(function (b64) {
        return fetch('/api/audit-2026/send-email', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: String(to).trim(),
            pdfBase64: b64,
            propertyLabel: keyStr,
            periodLabel: periodFromTxs(pv.txs),
            ownerName: guessed,
            netUsd: pv.dist3250,
          }),
        }).then(function (r) {
          return r.json().then(function (j) {
            return { r: r, j: j };
          });
        });
      })
      .then(function (_ref) {
        if (_ref.r.ok && _ref.j.ok)
          alert(
            'E-mail enviado. Caixa efetiva: ' +
              (_ref.j.sentTo || '') +
              (_ref.j.testMode ? ' (modo teste Resend)' : ''),
          );
        else alert((_ref.j && _ref.j.error) || 'Erro ' + _ref.r.status);
      })
      .catch(function (err) {
        alert('Erro: ' + (err && err.message));
      });
  };

  window.gmAuditWaByKey = function (keyStr) {
    var ctx = window.__AUD2026_CTX;
    if (!ctx || !ctx.properties[keyStr]) return;
    var pwa = ctx.properties[keyStr];
    var owner = ((pwa.ownerHints && pwa.ownerHints[0]) || 'Owner').trim();
    var adWa = parseAddr(keyStr);
    var msg =
      'Ola ' +
      owner +
      ', segue o Owner Statement de ' +
      adWa.title +
      ' do periodo ' +
      periodFromTxs(pwa.txs) +
      '. Net payout (3250): $ ' +
      fmtUsd(pwa.dist3250) +
      '. Por favor utilize o botao PDF no GodManager para anexar o documento.';
    window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank', 'noopener');
  };

  function wireOnce() {
    if (window.__gmAudit2026Wired) return;
    window.__gmAudit2026Wired = 1;
    var inp = document.getElementById('aud2026-csv-input');
    var btn = document.getElementById('aud2026-csv-load');
    if (inp && btn) {
      btn.addEventListener('click', function () {
        inp.click();
      });
      inp.addEventListener('change', function (ev) {
        var f = ev.target.files && ev.target.files[0];
        if (!f) return;
        var r = new FileReader();
        r.onload = function () {
          try {
            window.__AUD2026_LAST_TEXT = String(r.result || '');
            var parsed = parseAppfolioGeneralLedger(window.__AUD2026_LAST_TEXT);
            window.__AUD2026_CTX = parsed;
            render(parsed);
          } catch (ex) {
            console.warn('[Audit2026]', ex);
            alert('Erro CSV: ' + (ex && ex.message));
          }
        };
        r.readAsText(f, 'UTF-8');
      });
    }
    var flt = document.getElementById('aud2026-filter');
    if (flt)
      flt.addEventListener('input', function () {
        if (window.__AUD2026_CTX) render(window.__AUD2026_CTX);
      });
    var qg = document.getElementById('aud2026-qa-global');
    var q241 = document.getElementById('aud2026-qa-241');
    if (qg)
      qg.addEventListener('click', function () {
        gmAudit2026FixtureGlobal();
      });
    if (q241)
      q241.addEventListener('click', function () {
        gmAudit2026Fixture241();
      });
  }

  window.gmAudit2026NavInit = wireOnce;
})();
