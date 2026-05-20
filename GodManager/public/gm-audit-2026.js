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

  function rowVal(keys, row) {
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

  /** AppFolio Date: MM/DD/YYYY ou prefixo ISO YYYY-MM-DD */
  function parseYmFromAppfolioDate(ds) {
    var s = String(ds == null ? '' : ds).trim();
    var iso = s.match(/^(\d{4})-(\d{2})-/);
    if (iso) return iso[1] + '-' + iso[2];
    var md = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!md) return null;
    var M = parseInt(md[1], 10);
    var Y = parseInt(md[3], 10);
    if (!Number.isFinite(M) || !Number.isFinite(Y) || M < 1 || M > 12) return null;
    return Y + '-' + String(M).padStart(2, '0');
  }

  function ymToShortPtBR(ym) {
    var p = String(ym).split('-');
    var y = parseInt(p[0], 10);
    var mo = parseInt(p[1], 10) - 1;
    if (!Number.isFinite(y) || !Number.isFinite(mo) || mo < 0 || mo > 11) return ym;
    try {
      return new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric', timeZone: 'UTC' })
        .format(new Date(Date.UTC(y, mo, 1)))
        .replace('.', '');
    } catch (_) {
      return ym;
    }
  }

  /**
   * Extrai "(10.00% of $3,500.00)" da descrição AppFolio 6111 quando existir.
   */
  function parseMgmtFeeDeclFromDescription(description) {
    var s = String(description == null ? '' : description);
    var m = s.match(/\(\s*([\d.]+)\s*%\s*of\s*\$?\s*([\d,]+(?:\.\d+)?)\s*\)/i);
    if (!m) return null;
    var pct = parseFloat(m[1]);
    var base = parseFloat(String(m[2]).replace(/,/g, ''));
    if (!isFinite(pct) || !isFinite(base) || base < 0) return null;
    return { pctAplicada: round2(pct), base: round2(base) };
  }

  /** Agrega lista de lançamentos 6111 já extraídos. */
  function buildMgmtFeeAuditFromTxns(fee6111Txns) {
    fee6111Txns = fee6111Txns || [];
    var freq = {};
    var i;
    for (i = 0; i < fee6111Txns.length; i++) {
      var te = fee6111Txns[i];
      if (te.pctAplicada == null || te.base == null) continue;
      var zk = Number(te.pctAplicada).toFixed(2);
      freq[zk] = (freq[zk] || 0) + 1;
    }
    var sk = Object.keys(freq);
    var pctPredominante = null;
    if (sk.length >= 1) {
      sk.sort(function (a, b) {
        var ca = freq[a];
        var cb = freq[b];
        if (cb !== ca) return cb - ca;
        return parseFloat(b) - parseFloat(a);
      });
      pctPredominante = round2(parseFloat(sk[0]));
    }
    return {
      feeTxns: fee6111Txns.slice(),
      pctAplicadaPredominante: pctPredominante,
      pctVariavel: sk.length >= 2,
      sugestaoPctContratada: pctPredominante != null ? round2(pctPredominante) : null,
    };
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
    var monthlyScratch = {};

    function ensureProp(key) {
      if (!properties[key]) {
        properties[key] = {
          txs: [],
          income4: 0,
          expense67: 0,
          exp67Ex611: 0,
          exp6075: 0,
          expRepair60736: 0,
          net4100c: 0,
          debit3250: 0,
          credit3150: 0,
          debit6111: 0,
          ownerHints: [],
          owner3250ByPayee: {},
          fee6111Txns: [],
        };
        propOrder.push(key);
      }
      return properties[key];
    }

    /** Payee predominante em 3250 por soma de débito. */
    function ownerPred3250Totals(mapPayeeToUsd) {
      if (!mapPayeeToUsd || typeof mapPayeeToUsd !== 'object') return '(a definir)';
      var best = '(a definir)';
      var bestAmt = -1;
      var k;
      for (k in mapPayeeToUsd) {
        if (!Object.prototype.hasOwnProperty.call(mapPayeeToUsd, k)) continue;
        var amt = Number(mapPayeeToUsd[k]);
        if (!isFinite(amt)) continue;
        if (amt > bestAmt || (Math.abs(amt - bestAmt) < 1e-6 && k.localeCompare(best) < 0)) {
          bestAmt = amt;
          best = k;
        }
      }
      return bestAmt < 0.01 ? '(a definir)' : best;
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
      if (/^6|^7/.test(g)) {
        blob.expense67 = round2(blob.expense67 + debit);
        if (g !== '6111') {
          blob.exp67Ex611 = round2(blob.exp67Ex611 + debit);
          if (g === '6075') blob.exp6075 = round2(blob.exp6075 + debit);
          else if (g === '6073' || g === '6076')
            blob.expRepair60736 = round2(blob.expRepair60736 + debit);
        }
      }
      if (g === '4100') blob.net4100c = round2(blob.net4100c + credit);
      if (g === '3250') {
        blob.debit3250 = round2(blob.debit3250 + debit);
        if (tx.payee && blob.ownerHints.indexOf(tx.payee) < 0) blob.ownerHints.push(tx.payee);
        if (debit > 0.009) {
          var pyLbl = tx.payee || '(sem identifica\u00e7\u00e3o)';
          blob.owner3250ByPayee[pyLbl] = round2(
            (blob.owner3250ByPayee[pyLbl] || 0) + debit,
          );
        }
      }
      if (g === '3150') blob.credit3150 = round2(blob.credit3150 + credit);
      if (g === '6111') {
        blob.debit6111 = round2(blob.debit6111 + debit);
        if (debit > 1e-9) {
          var declPart = parseMgmtFeeDeclFromDescription(desc);
          blob.fee6111Txns.push({
            date: String(dateKey(row) || '').trim(),
            pctAplicada: declPart ? declPart.pctAplicada : null,
            base: declPart ? declPart.base : null,
            feeCobrado: round2(debit),
            desc: desc,
          });
        }
      }

      var ymKey = parseYmFromAppfolioDate(tx.date);
      if (ymKey) {
        if (!monthlyScratch[ymKey]) {
          monthlyScratch[ymKey] = {
            rent4100: 0,
            ownerDist3250: 0,
            mgmtFee6111: 0,
          };
        }
        var mog = monthlyScratch[ymKey];
        if (g === '4100') mog.rent4100 = round2(mog.rent4100 + credit);
        else if (g === '3250') mog.ownerDist3250 = round2(mog.ownerDist3250 + debit);
        else if (g === '6111') mog.mgmtFee6111 = round2(mog.mgmtFee6111 + debit);
      }
    }

    var monthKeysSorted = Object.keys(monthlyScratch).sort();
    var monthly = monthKeysSorted.map(function (yk) {
      var mo = monthlyScratch[yk];
      var pctMo = mo.rent4100 > 0 ? round2((mo.mgmtFee6111 / mo.rent4100) * 100) : null;
      return {
        ym: yk,
        rent: mo.rent4100,
        ownerDist: mo.ownerDist3250,
        mgmtFee: mo.mgmtFee6111,
        pct: pctMo,
      };
    });

    var detectedPeriodStart = monthKeysSorted.length ? monthKeysSorted[0] : null;
    var detectedPeriodEnd =
      monthKeysSorted.length ? monthKeysSorted[monthKeysSorted.length - 1] : null;
    var detectedPeriodLabel = '';
    if (monthKeysSorted.length) {
      detectedPeriodLabel =
        ymToShortPtBR(monthKeysSorted[0]) +
        ' \u2013 ' +
        ymToShortPtBR(monthKeysSorted[monthKeysSorted.length - 1]);
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
      var mfaudit = buildMgmtFeeAuditFromTxns(pb.fee6111Txns || []);
      var despNA = pb.exp67Ex611 || 0;
      var h6075 = pb.exp6075 || 0;
      var rep60736 = pb.expRepair60736 || 0;
      var predOwner = ownerPred3250Totals(pb.owner3250ByPayee || {});
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
        ownerPredPayee: predOwner,
        ownerAuditExpenseEx611: round2(despNA),
        ownerAudit6075: round2(h6075),
        ownerAuditRepair: round2(rep60736),
        ownerAuditOtherExp: round2(despNA - h6075 - rep60736),
        seqIdx: idxMap[key],
        mgmtFeeAudit: mfaudit,
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
      monthly: monthly,
      detectedPeriodStart: detectedPeriodStart,
      detectedPeriodEnd: detectedPeriodEnd,
      detectedPeriodLabel: detectedPeriodLabel,
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
    gmAuditRenderMonthlyAnalysis(ctx.monthly || []);
    try {
      gmAudit2026FeeRenderAfterGl(ctx);
    } catch (_) {}
  }

  var AUD2026_MONTHLY_SERIES_EXPECT = {
    '2026-01': [128362.54, 106171.04, 8942.55],
    '2026-02': [144171.71, 95552.06, 10357.51],
    '2026-03': [161284.58, 134855.02, 10600.82],
    '2026-04': [176271.25, 112806.5, 13858.5],
    '2026-05': [170969.39, 121527.46, 250.77],
  };

  window.gmAudit2026VerifyMonthlyBench = function () {
    var pk = window.__AUD2026_CTX;
    if (!pk || !pk.monthly || !pk.totals) return alert('Carregue CSV antes.');
    var lines = [];
    var sumR = 0,
      sumD = 0,
      sumM = 0;
    var mm = pk.monthly;
    var mi = {};
    for (var i = 0; i < mm.length; i++) mi[String(mm[i].ym)] = mm[i];

    function near(a, b) {
      return Math.abs(Number(a) - Number(b)) < 0.06;
    }

    Object.keys(AUD2026_MONTHLY_SERIES_EXPECT).forEach(function (ym) {
      var ex = AUD2026_MONTHLY_SERIES_EXPECT[ym];
      var got = mi[ym];
      if (!got) {
        lines.push('FAIL mes ' + ym + ': falta serie');
        return;
      }
      var ok =
        near(got.rent, ex[0]) && near(got.ownerDist, ex[1]) && near(got.mgmtFee, ex[2]);
      lines.push(
        (ok ? 'OK ' : 'FAIL ') + ym + ': rent=' + got.rent + ' dist=' + got.ownerDist + ' mgmt=' + got.mgmtFee,
      );
      sumR += got.rent;
      sumD += got.ownerDist;
      sumM += got.mgmtFee;
    });

    var okSum =
      near(sumR, pk.totals.rent4100) &&
      near(sumD, pk.totals.dist3250) &&
      near(sumM, pk.totals.fee6111);
    lines.push(
      (okSum ? 'OK ' : 'FAIL ') +
        'Soma mensal vs totais globais (' +
        sumR.toFixed(2) +
        ' vs ' +
        pk.totals.rent4100 +
        ' rent).',
    );
    alert(lines.join('\n'));
  };

  function gmAuditRenderMonthlyRowHtml(rw) {
    var pctS = rw.pct == null ? '\u2014' : rw.pct.toFixed(2).replace('.', ',') + '%';
    return (
      '<tr><td style="padding:8px 10px;font-family:JetBrains Mono,monospace;font-size:11px">' +
      rw.ym +
      '</td>' +
      '<td style="padding:8px 10px;text-align:right;font-family:JetBrains Mono,monospace">$ ' +
      fmtUsd(rw.rent) +
      '</td>' +
      '<td style="padding:8px 10px;text-align:right;font-family:JetBrains Mono,monospace">$ ' +
      fmtUsd(rw.ownerDist) +
      '</td>' +
      '<td style="padding:8px 10px;text-align:right;font-family:JetBrains Mono,monospace">$ ' +
      fmtUsd(rw.mgmtFee) +
      '</td>' +
      '<td style="padding:8px 10px;text-align:center;font-size:11px">' +
      pctS +
      '</td></tr>'
    );
  }

  function gmAuditRenderMonthlyAnalysis(monthlyRows) {
    var tb = document.getElementById('aud2026-monthly-tbody');
    if (!tb) return;
    if (!monthlyRows || !monthlyRows.length) {
      tb.innerHTML =
        '<tr><td colspan="5" style="padding:10px 12px;color:var(--ink3)">\u2014 sem dados mensais no CSV carregado</td></tr>';
      return;
    }
    var hr = '';
    for (var h = 0; h < monthlyRows.length; h++) hr += gmAuditRenderMonthlyRowHtml(monthlyRows[h]);
    tb.innerHTML = hr;
  }

  function gmAuditHistRenderMonthlyTable(monthlyRows) {
    var tb = document.getElementById('aud2026-hist-monthly-tbody');
    if (!tb) return;
    if (!monthlyRows || !monthlyRows.length) {
      tb.innerHTML = '<tr><td colspan="5">Sem meses neste arquivo.</td></tr>';
      return;
    }
    var hr = '';
    for (var h = 0; h < monthlyRows.length; h++) hr += gmAuditRenderMonthlyRowHtml(monthlyRows[h]);
    tb.innerHTML = hr;
  }

  function gmAuditEffectiveClientId() {
    try {
      var u = window.__gmCurrentUser;
      if (!u) return '';
      var role = String(u.role || '').toLowerCase();
      if (role === 'super_admin') {
        if (typeof getActiveClient === 'function') {
          var ac = getActiveClient();
          if (ac && ac.id) return String(ac.id);
        }
        return '';
      }
      return u.clientId ? String(u.clientId) : '';
    } catch (_) {
      return '';
    }
  }

  /** Detalhe / DELETE snapshots: sempre com clientId para alinhar multi-tenant. */
  function gmAuditSnapshotsApiUrl(id) {
    var cid = gmAuditEffectiveClientId();
    var base = '/api/audit-2026/snapshots/' + encodeURIComponent(id);
    if (!cid) return base;
    return base + '?clientId=' + encodeURIComponent(cid);
  }

  function gmAuditBuildSnapshotTotals(ctx) {
    return {
      rent: ctx.totals.rent4100,
      ownerDist: ctx.totals.dist3250,
      mgmtFee: ctx.totals.fee6111,
      propertyCount: ctx.totals.props,
      pct: ctx.totals.globalFeePct,
    };
  }

  function gmAuditBuildSnapshotPerProp(ctx) {
    var pp = [];
    for (var i = 0; i < ctx.seqKeys.length; i++) {
      var key = ctx.seqKeys[i];
      var p = ctx.properties[key];
      pp.push({
        property: key,
        rent: p.rent4100,
        ownerDist: p.dist3250,
        mgmtFee: p.fee6111,
        pct: p.feePct,
      });
    }
    return pp;
  }

  function gmAuditDestroyHistoryChart() {
    try {
      var can = document.getElementById('aud2026-hist-chart');
      if (!can || typeof Chart === 'undefined') return;
      if (Chart.getChart) {
        var cx = Chart.getChart(can);
        if (cx && typeof cx.destroy === 'function') cx.destroy();
      }
    } catch (_) {}
  }

  function gmAuditDrawHistoryChart(monthlyRows) {
    var can = document.getElementById('aud2026-hist-chart');
    if (!can || typeof Chart === 'undefined' || !monthlyRows || !monthlyRows.length) return;
    gmAuditDestroyHistoryChart();
    var labels = monthlyRows.map(function (r) {
      return r.ym;
    });
    window.__aud2026Chart = new Chart(can, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Rent (4100)',
            data: monthlyRows.map(function (r) {
              return Number(r.rent || 0);
            }),
            borderColor: '#c9a96e',
            backgroundColor: 'rgba(201,169,110,0.12)',
            tension: 0.2,
            yAxisID: 'yUsd',
          },
          {
            label: 'Owner Dist (3250)',
            data: monthlyRows.map(function (r) {
              return Number(r.ownerDist || 0);
            }),
            borderColor: '#2d7252',
            backgroundColor: 'rgba(45,114,82,0.08)',
            tension: 0.2,
            yAxisID: 'yUsd',
          },
          {
            label: 'Mgmt (6111)',
            data: monthlyRows.map(function (r) {
              return Number(r.mgmtFee || 0);
            }),
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37,99,235,0.08)',
            tension: 0.2,
            yAxisID: 'yUsd',
          },
          {
            label: '% (6111/4100)',
            data: monthlyRows.map(function (r) {
              return r.pct == null ? NaN : Number(r.pct);
            }),
            borderColor: '#8a8580',
            borderDash: [4, 3],
            tension: 0.2,
            spanGaps: true,
            yAxisID: 'yPct',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 2.7,
        plugins: {
          legend: { labels: { font: { family: 'DM Sans', size: 11 } } },
        },
        scales: {
          yUsd: {
            type: 'linear',
            position: 'left',
            ticks: { font: { family: 'JetBrains Mono', size: 10 } },
          },
          yPct: {
            type: 'linear',
            position: 'right',
            grid: { drawOnChartArea: false },
            ticks: {
              font: { family: 'JetBrains Mono', size: 10 },
              callback: function (v) {
                return v + '%';
              },
            },
          },
        },
      },
    });
  }

  window.gmAudit2026ArchiveCurrent = function () {
    var ctx = window.__AUD2026_CTX;
    if (!ctx || !ctx.totals.props) return alert('Carregue um CSV primeiro.');
    var cid = gmAuditEffectiveClientId();
    if (!cid)
      return alert(
        'Selecione um cliente na GodManager (super_admin: modo cliente ativo) ou confirme a sua empresa.',
      );
    var defLab = ctx.detectedPeriodLabel || 'Auditoria GL';
    var labelOk = '';
    try {
      labelOk = prompt('Nome deste arquivo (label)', defLab);
    } catch (_) {
      return;
    }
    if (labelOk === null || !String(labelOk).trim()) return;
    var body = {
      clientId: cid,
      label: String(labelOk).trim(),
      periodStart: ctx.detectedPeriodStart || null,
      periodEnd: ctx.detectedPeriodEnd || null,
      totals: gmAuditBuildSnapshotTotals(ctx),
      monthly: ctx.monthly || [],
      perProperty: gmAuditBuildSnapshotPerProp(ctx),
    };
    var fb = document.getElementById('aud2026-feedback');
    if (fb) {
      fb.style.display = 'block';
      fb.style.color = 'var(--ink3)';
      fb.textContent = 'A gravar...';
    }
    fetch('/api/audit-2026/snapshots', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(function (r) {
        return r.json().then(function (j) {
          return { r: r, j: j };
        });
      })
      .then(function (x) {
        if (fb) {
          fb.style.display = 'block';
          if (x.r.ok && x.j.ok)
            fb.textContent =
              'Upload arquivado. ID: ' +
              String((x.j.snapshot && x.j.snapshot.id) || x.j.id || '').slice(0, 14) +
              '\u2026 Ver em Hist\u00f3rico.';
          else fb.textContent = (x.j && x.j.error) || 'Erro ' + x.r.status;
          fb.style.color = x.r.ok ? 'var(--green)' : 'var(--red)';
        }
      })
      .catch(function (err) {
        if (fb) {
          fb.style.display = 'block';
          fb.style.color = 'var(--red)';
          fb.textContent = err.message || String(err);
        }
      });
  };

  window.gmAudit2026SnapshotsRefresh = function () {
    var cid = gmAuditEffectiveClientId();
    if (!cid) {
      alert('Selecione o cliente ativo (super_admin) ou confirme sess\u00e3o.');
      return;
    }
    var tb = document.getElementById('aud2026-snapshots-tbody');
    var selA = document.getElementById('aud2026-compare-a');
    var selB = document.getElementById('aud2026-compare-b');
    if (tb)
      tb.innerHTML =
        '<tr><td colspan="5" style="padding:10px;color:var(--ink3)">A carregar...</td></tr>';
    fetch('/api/audit-2026/snapshots?clientId=' + encodeURIComponent(cid), { credentials: 'same-origin' })
      .then(function (r) {
        return r.json().then(function (j) {
          return { r: r, j: j };
        });
      })
      .then(function (x) {
        if (!tb) return;
        if (!x.r.ok || !x.j.ok || !Array.isArray(x.j.snapshots)) {
          tb.innerHTML =
            '<tr><td colspan="5">' + escHtml((x.j && x.j.error) || 'Erro') + '</td></tr>';
          return;
        }
        window.__AUD2026_SNAPSHOT_METAS = x.j.snapshots;
        var rr = '';
        for (var i = 0; i < x.j.snapshots.length; i++) {
          var sn = x.j.snapshots[i];
          var idEsc = gmEscQuote(String(sn.id));
          rr +=
            '<tr style="cursor:pointer" onclick=\"gmAudit2026SelectSnapshot(\'' +
            idEsc +
            '\')">' +
            '<td style=\"padding:8px 10px;font-size:11px;font-family:JetBrains Mono,monospace\">' +
            String(sn.id).slice(0, 10) +
            '\u2026</td>' +
            '<td style=\"padding:8px 10px\">' +
            escHtml(sn.label || '\u2014') +
            '</td>' +
            '<td style=\"padding:8px 10px;font-family:JetBrains Mono,monospace;font-size:10px\">' +
            escHtml((sn.periodStart || '') + ' \u2192 ' + (sn.periodEnd || '')) +
            '</td>' +
            '<td style=\"padding:8px 10px;font-family:JetBrains Mono,monospace;font-size:10px\">' +
            String(sn.uploadedAt || '').slice(0, 16).replace('T', ' ') +
            '</td>' +
            '<td style=\"padding:8px 10px;text-align:right;font-family:JetBrains Mono,monospace\">$ ' +
            fmtUsd(sn.totals ? sn.totals.rent : 0) +
            '</td></tr>';
        }
        tb.innerHTML =
          rr || '<tr><td colspan="5">Nenhum arquivo ainda para este cliente.</td></tr>';
        function fill(sel) {
          if (!sel) return;
          var cur = sel.value;
          sel.innerHTML = '<option value="">Selecionar snapshot...</option>';
          for (var j = 0; j < x.j.snapshots.length; j++) {
            var sn2 = x.j.snapshots[j];
            var op = document.createElement('option');
            op.value = sn2.id;
            op.textContent = (
              sn2.label ||
              sn2.id
            ).slice(0, 45);
            sel.appendChild(op);
          }
          if (cur) sel.value = cur;
        }
        fill(selA);
        fill(selB);
      })
      .catch(function (e) {
        if (tb) tb.innerHTML = '<tr><td colspan="5">' + escHtml(e.message) + '</td></tr>';
      });
  };

  window.gmAudit2026SelectSnapshot = function (id) {
    if (!id) return;
    gmAuditDestroyHistoryChart();
    var monthlyTb = document.getElementById('aud2026-hist-monthly-tbody');
    if (monthlyTb)
      monthlyTb.innerHTML = '<tr><td colspan="5">A carregar...</td></tr>';
    fetch(gmAuditSnapshotsApiUrl(id), { credentials: 'same-origin' })
      .then(function (r) {
        return r.json().then(function (j) {
          return { r: r, j: j };
        });
      })
      .then(function (x) {
        if (!x.r.ok || !x.j.ok) {
          alert((x.j && x.j.error) || 'Erro');
          return;
        }
        var mon = Array.isArray(x.j.monthly) ? x.j.monthly : [];
        gmAuditHistRenderMonthlyTable(mon);
        gmAuditDrawHistoryChart(mon);
      })
      .catch(function (err) {
        alert(err.message || String(err));
      });
  };

  window.gmAudit2026CompareTwo = function () {
    var a = document.getElementById('aud2026-compare-a');
    var b = document.getElementById('aud2026-compare-b');
    var out = document.getElementById('aud2026-compare-result');
    if (!a || !b || !out || !a.value || !b.value || a.value === b.value) return;
    Promise.all([
      fetch(gmAuditSnapshotsApiUrl(a.value), {
        credentials: 'same-origin',
      }).then(function (r) {
        return r.json().then(function (j) {
          return { okHttp: r.ok, j: j };
        });
      }),
      fetch(gmAuditSnapshotsApiUrl(b.value), {
        credentials: 'same-origin',
      }).then(function (r) {
        return r.json().then(function (j) {
          return { okHttp: r.ok, j: j };
        });
      }),
    ]).then(function (arr) {
      var xa = arr[0].j;
      var xb = arr[1].j;
      var taJson = xa.totals;
      var tbJson = xb.totals;
      if (!arr[0].okHttp || !arr[1].okHttp || !xa.ok || !xb.ok || !taJson || !tbJson) {
        out.textContent = 'Erro ao comparar snapshots.';
        return;
      }
      function d(k) {
        return round2(Number(tbJson[k] || 0) - Number(taJson[k] || 0));
      }
      out.innerHTML =
        '<div style="font-weight:600;margin-bottom:6px;color:var(--ink)">Delta (B menos A)</div>' +
        '<div style=\"font-family:JetBrains Mono,monospace;font-size:12px;color:var(--ink2)\">Rent: $ ' +
        fmtUsd(d('rent')) +
        '<br>Owner Distribution: $ ' +
        fmtUsd(d('ownerDist')) +
        '<br>Taxa Gest\u00e3o (6111): $ ' +
        fmtUsd(d('mgmtFee')) +
        '</div>';
    });
  };

  /** lookup propertyKey CSV -> pct gravada */
  window.__AUD2026_FEE_LOOKUP = window.__AUD2026_FEE_LOOKUP || {};

  /**
   * Semântica owner: valorOwner = feeEsperado \u2212 feeCobrado ( só quando esperado monetário válido ).
   */
  window.gmAudit2026FeeOwnerBandFromValor = function (v) {
    if (v == null || !isFinite(Number(v))) return 'gray';
    var vn = Number(v);
    if (Math.abs(vn) < 1) return 'blue';
    if (vn > 0) return 'green';
    return 'red';
  };

  /** Texto monetário PT do veredito owner ( Correto | devolver | receber | em dash opcional ). */
  window.gmAudit2026FeeOwnerDisplayFromValor = function (v, opts) {
    var o = opts || {};
    if (v == null || !isFinite(Number(v))) {
      return o.pendente ? 'Pendente' : '\u2014';
    }
    var vn = Number(v);
    if (Math.abs(vn) < 1) return 'Correto';
    if (vn > 0) return 'Owner a devolver $ ' + fmtUsd(vn);
    return 'Owner a receber $ ' + fmtUsd(Math.abs(vn));
  };

  function feeOwnerValCellHtml(valorOwnerOptional) {
    var v = valorOwnerOptional;
    if (v == null || !isFinite(Number(v))) {
      return (
        '<span style="font-family:JetBrains Mono,monospace;font-size:11px;font-weight:700;color:var(--ink3)">\u2014</span>'
      );
    }
    var k = window.gmAudit2026FeeOwnerBandFromValor(v);
    var col =
      k === 'blue'
        ? 'var(--blue)'
        : k === 'green'
          ? 'var(--green)'
          : k === 'red'
            ? 'var(--red)'
            : 'var(--ink3)';
    var txt = window.gmAudit2026FeeOwnerDisplayFromValor(v, {});
    return (
      '<span style="font-family:JetBrains Mono,monospace;font-size:11px;font-weight:700;color:' +
      col +
      '">' +
      escHtml(txt) +
      '</span>'
    );
  }

  function feeOwnerAtualHtml(st) {
    if (st.valorOwner != null && isFinite(Number(st.valorOwner)))
      return feeOwnerValCellHtml(st.valorOwner);
    var s = String(st.status || '').toLowerCase();
    var lbl = s === 'pendente' ? 'Pendente' : 'Revisar';
    return (
      '<span style="font-family:JetBrains Mono,monospace;font-size:11px;font-weight:700;color:var(--ink3)">' +
      escHtml(lbl) +
      '</span>'
    );
  }

  function pctAplicadaForSnapshot(stPc) {
    if (!stPc || stPc.val == null || !isFinite(Number(stPc.val))) return null;
    return Number(stPc.val);
  }

  function feeOwnerPrevEntry(prevMapByKey, propertyKeyStr) {
    var row =
      prevMapByKey &&
      typeof prevMapByKey === 'object' &&
      Object.prototype.hasOwnProperty.call(prevMapByKey, propertyKeyStr)
        ? prevMapByKey[propertyKeyStr]
        : undefined;
    if (!row || typeof row !== 'object') return { prevMissing: true };
    return { prevMissing: false, valorOwner: row.valorOwner == null ? null : Number(row.valorOwner), raw: row };
  }

  function feeOwnerPrevHtml(pe) {
    if (!pe || pe.prevMissing)
      return (
        '<span style="font-family:JetBrains Mono,monospace;font-size:11px;font-weight:700;color:var(--ink3)">\u2014</span>'
      );
    if (pe.valorOwner != null && isFinite(Number(pe.valorOwner)))
      return feeOwnerValCellHtml(Number(pe.valorOwner));
    return (
      '<span style="font-family:JetBrains Mono,monospace;font-size:11px;font-weight:700;color:var(--ink3)">\u2014</span>'
    );
  }

  function feeOwnerVariationInner(currV, prevNum) {
    if (currV == null || !isFinite(Number(currV))) {
      return (
        '<span style="font-family:JetBrains Mono,monospace;font-size:11px;font-weight:700;color:var(--ink3)">\u2014</span>'
      );
    }
    if (prevNum == null || !isFinite(Number(prevNum))) {
      return (
        '<span style="font-family:JetBrains Mono,monospace;font-size:11px;font-weight:700;color:var(--ink3)">\u2014</span>'
      );
    }
    var d = round2(Number(currV) - Number(prevNum));
    if (Math.abs(d) < 1) {
      return (
        '<span style="font-family:JetBrains Mono,monospace;font-size:11px;font-weight:700;color:var(--ink3)">=</span>'
      );
    }
    var signCol = d > 0 ? 'var(--green)' : 'var(--red)';
    var arr = d > 0 ? '\u25b2' : '\u25bc';
    var signedUsd = (d > 0 ? '+' : '\u2212') + '$ ' + fmtUsd(Math.abs(d));
    var pctPart = ' (n/d)';
    if (Math.abs(Number(prevNum)) >= 1) {
      var pPct = round2((d / Math.abs(Number(prevNum))) * 100);
      pctPart =
        ' (' +
        (d > 0 ? '+' : '\u2212') +
        Math.abs(pPct).toFixed(2).replace('.', ',') +
        '%)';
    }
    var fullLine = arr + ' ' + signedUsd + pctPart;
    return (
      '<span style="font-family:JetBrains Mono,monospace;font-size:11px;font-weight:700;color:' +
      signCol +
      '">' +
      escHtml(fullLine) +
      '</span>'
    );
  }

  function feeOwnerVariationHtml(stCurr, prevEntry) {
    if (
      !prevEntry ||
      prevEntry.prevMissing ||
      prevEntry.valorOwner == null ||
      !isFinite(Number(prevEntry.valorOwner))
    ) {
      return (
        '<span style="font-family:JetBrains Mono,monospace;font-size:11px;font-weight:700;color:var(--ink3)">\u2014</span>'
      );
    }
    return feeOwnerVariationInner(stCurr.valorOwner, Number(prevEntry.valorOwner));
  }

  /** QA: cenários numéricos (0 \u2192 Azul Correto; +70 Verde; \u221270 Vermelho) */
  window.gmAudit2026FeeOwnerColorBench = function () {
    var b = window.gmAudit2026FeeOwnerBandFromValor;
    var d = window.gmAudit2026FeeOwnerDisplayFromValor;
    var ok =
      b(0) === 'blue' &&
      String(d(0)).indexOf('Correto') >= 0 &&
      b(70) === 'green' &&
      String(d(70)).indexOf('70') >= 0 &&
      b(-70) === 'red' &&
      String(d(-70)).indexOf('70') >= 0;
    return {
      ok: !!ok,
      zeroAzulCorreto: b(0) === 'blue',
      mais70verde: b(70) === 'green',
      menos70vermelho: b(-70) === 'red',
    };
  };

  /** Construtor map snapshot GET */
  window.gmAudit2026FeeSnapshotRowsToMap = function (snap) {
    var out = {};
    if (!snap || !Array.isArray(snap.results)) return out;
    var j;
    for (j = 0; j < snap.results.length; j++) {
      var rr = snap.results[j];
      if (!rr || typeof rr.propertyKey !== 'string') continue;
      out[String(rr.propertyKey)] = rr;
    }
    return out;
  };

  /**
   * @returns {{status:string,label:string,diff:number|null,esperado:number|null,cobradoTotal:number,baseDisplay:string,detail:string,pctCell:{kind:string,val:any},valorOwner:number|null}}
   */
  window.gmAudit2026ComputeFeeRow = function (
    pv,
    savedPctFromDbOrNull,
    effectiveContractedPctOrNull,
  ) {
    var audit = (pv && pv.mgmtFeeAudit) || { feeTxns: [], pctVariavel: false };
    var feeTxns = audit.feeTxns || [];
    var tolZ = 0.009;
    var cobTotal = 0;
    var unparsedPart = 0;
    var somaBase = 0;
    var declN = 0;
    var i;
    for (i = 0; i < feeTxns.length; i++) {
      var ln = feeTxns[i];
      cobTotal = round2(cobTotal + (ln.feeCobrado || 0));
      if (ln.pctAplicada != null && ln.base != null) {
        somaBase = round2(somaBase + ln.base);
        declN += 1;
      } else if ((ln.feeCobrado || 0) > tolZ) {
        unparsedPart = round2(unparsedPart + ln.feeCobrado);
      }
    }
    var baseStr = declN ? String(round2(somaBase)) : '\u2014';
    var hasSavedDb =
      savedPctFromDbOrNull !== null &&
      savedPctFromDbOrNull !== undefined &&
      isFinite(Number(savedPctFromDbOrNull));

    var pctAppliedCell = function () {
      if (
        audit.pctVariavel &&
        audit.pctAplicadaPredominante != null &&
        isFinite(Number(audit.pctAplicadaPredominante))
      )
        return { kind: 'var', val: audit.pctAplicadaPredominante };
      if (audit.pctAplicadaPredominante == null) return { kind: 'none', val: null };
      return { kind: 'single', val: audit.pctAplicadaPredominante };
    };

    function finalize(stRet) {
      stRet.valorOwner = null;
      if (
        stRet.status !== 'pendente' &&
        stRet.esperado != null &&
        isFinite(Number(stRet.esperado)) &&
        stRet.cobradoTotal != null &&
        isFinite(Number(stRet.cobradoTotal))
      ) {
        stRet.valorOwner = round2(Number(stRet.esperado) - Number(stRet.cobradoTotal));
      }
      return stRet;
    }

    if (feeTxns.length === 0 || cobTotal < tolZ) {
      if (hasSavedDb) {
        return finalize({
          status: 'pendente',
          label: 'Pendente',
          diff: null,
          esperado: null,
          cobradoTotal: cobTotal,
          baseDisplay: baseStr,
          detail: '',
          pctCell: pctAppliedCell(),
        });
      }
      return finalize({
        status: 'revisar',
        label: 'Revisar',
        diff: null,
        esperado: null,
        cobradoTotal: cobTotal,
        baseDisplay: baseStr,
        detail: 'sem_fee_sem_db',
        pctCell: pctAppliedCell(),
      });
    }

    if (declN === 0) {
      return finalize({
        status: 'revisar',
        label: 'Revisar',
        diff: null,
        esperado: null,
        cobradoTotal: cobTotal,
        baseDisplay: '\u2014',
        detail: '6111_sem_pct_na_descricao',
        pctCell: pctAppliedCell(),
      });
    }

    if (unparsedPart > 0.02) {
      return finalize({
        status: 'revisar',
        label: 'Revisar',
        diff: null,
        esperado: null,
        cobradoTotal: cobTotal,
        baseDisplay: baseStr,
        detail: 'linhas_fee_sem_documentacao',
        pctCell: pctAppliedCell(),
      });
    }

    /**
     * Comparação monetária (equivalente a sum_l (pctAplicada_l - pctContratada) * base_l / 100
     * quando feeCobrado_l = pctAplicada_l * base_l / 100):
     * diff = sum feeCobrado - sum (pctContratada * base / 100).
     * Só classifica Correto / A mais / A menos com % contratada gravada no Postgres (não usa só sugestão do GL).
     */
    if (!hasSavedDb) {
      return finalize({
        status: 'revisar',
        label: 'Revisar',
        diff: null,
        esperado: null,
        cobradoTotal: cobTotal,
        baseDisplay: baseStr,
        detail: 'sem_pct_contratada_gravada',
        pctCell: pctAppliedCell(),
      });
    }

    var effPct = effectiveContractedPctOrNull;
    if (effPct == null || !Number.isFinite(Number(effPct)))
      effPct = Number(savedPctFromDbOrNull);
    if (!Number.isFinite(Number(effPct))) {
      return finalize({
        status: 'revisar',
        label: 'Revisar',
        diff: null,
        esperado: null,
        cobradoTotal: cobTotal,
        baseDisplay: baseStr,
        detail: 'pct_contratada_invalida',
        pctCell: pctAppliedCell(),
      });
    }

    var esperado = 0;
    for (i = 0; i < feeTxns.length; i++) {
      var lj = feeTxns[i];
      if (lj.pctAplicada != null && lj.base != null) {
        esperado = round2(esperado + (Number(effPct) / 100) * lj.base);
      }
    }
    var diff = round2(cobTotal - esperado);

    if (Math.abs(diff) < 1) {
      return finalize({
        status: 'correto',
        label: 'Correto',
        diff: diff,
        esperado: esperado,
        cobradoTotal: cobTotal,
        baseDisplay: baseStr,
        detail: '',
        pctCell: pctAppliedCell(),
      });
    }
    if (diff > 0) {
      return finalize({
        status: 'mais',
        label: 'A mais',
        diff: diff,
        esperado: esperado,
        cobradoTotal: cobTotal,
        baseDisplay: baseStr,
        detail: '',
        pctCell: pctAppliedCell(),
      });
    }
    return finalize({
      status: 'menos',
      label: 'A menos',
      diff: diff,
      esperado: esperado,
      cobradoTotal: cobTotal,
      baseDisplay: baseStr,
      detail: '',
      pctCell: pctAppliedCell(),
    });
  };

  function feeAuditStatusBadgeHtml(stObj) {
    var st = stObj.status;
    var diff = stObj.diff;
    var lbl = escHtml(stObj.label || '');
    if (st === 'mais')
      lbl =
        lbl +
        ' $ ' +
        escHtml(fmtUsd(diff != null && diff > 0 ? diff : 0));
    else if (st === 'menos')
      lbl =
        lbl +
        ' $ ' +
        escHtml(fmtUsd(diff != null && diff < 0 ? -diff : 0));
    var bg = 'var(--cream);color:var(--ink3);border:1px solid var(--border)';
    if (st === 'correto')
      bg = 'var(--green-bg);color:var(--green);border:1px solid var(--green)';
    if (st === 'mais') bg = 'var(--red-bg);color:var(--red);border:1px solid var(--red)';
    if (st === 'menos') bg = 'var(--amber-bg);color:var(--amber);border:1px solid var(--amber-bd)';
    if (st === 'revisar')
      bg = 'var(--blue-bg);color:var(--blue);border:1px solid var(--blue)';
    if (st === 'pendente')
      bg = 'var(--slate-bg);color:var(--ink2);border:1px solid var(--border2)';
    return (
      '<span style="padding:3px 9px;border-radius:20px;font-size:10px;font-weight:600;font-family:&quot;DM Sans&quot;,sans-serif;background:' +
      bg +
      '">' +
      lbl +
      '</span>'
    );
  }

  window.gmAudit2026FeeRefreshSummaryFromDom = function () {
    var ctx = window.__AUD2026_CTX;
    var tb = document.getElementById('aud2026-fee-tbody');
    if (!ctx || !tb) return;

    var q = '';
    try {
      q = (document.getElementById('aud2026-filter').value || '').toLowerCase().trim();
    } catch (_) {}

    var inpList = tb.querySelectorAll('[data-audfee-key]');
    var lookupSaved = window.__AUD2026_FEE_LOOKUP || {};
    var maisSum = 0;
    var menosSum = 0;
    var nCorr = 0,
      nRev = 0;
    var z;
    for (z = 0; z < inpList.length; z++) {
      var inp = inpList[z];
      var pkRaw = inp.getAttribute('data-audfee-key');
      var pk = pkRaw || '';
      try {
        pk = decodeURIComponent(pk);
      } catch (_) {}
      if (!pk || !ctx.properties[pk]) continue;
      if (q && String(pk || '').toLowerCase().indexOf(q) < 0) continue;
      var dbv = lookupSaved[pk];
      var dbPct = dbv != null ? Number(dbv) : null;
      var eff = null;
      if (dbv != null && isFinite(Number(dbv))) {
        eff = gmAuditParsePctFlexible(inp.value);
        if (eff == null) eff = Number(dbv);
      }

      var st = gmAudit2026ComputeFeeRow(ctx.properties[pk], dbPct, eff);
      if (st.status === 'correto') {
        nCorr += 1;
        continue;
      }
      if (st.status === 'revisar') {
        nRev += 1;
        continue;
      }
      if (st.status === 'pendente') continue;
      if (st.status === 'mais') maisSum += st.diff || 0;
      if (st.status === 'menos') menosSum += st.diff ? Math.abs(st.diff) : 0;
    }

    function setId(id, t) {
      var el = document.getElementById(id);
      if (el) el.textContent = t;
    }
    setId('aud2026-fee-sum-mais', '$ ' + fmtUsd(maisSum > 0 ? maisSum : 0));
    setId('aud2026-fee-sum-menos', '$ ' + fmtUsd(menosSum > 0 ? menosSum : 0));
    setId('aud2026-fee-sum-corr', String(nCorr));
    setId('aud2026-fee-sum-revisar', String(nRev));
  };

  window.gmAudit2026FeeRenderAfterGl = function (ctx) {
    window.__AUD2026_FEE_LAST_CTX = ctx;
    var pf = document.getElementById('aud2026-panel-fee');
    var po = document.getElementById('aud2026-panel-owner');
    if (pf && pf.style.display !== 'none') window.gmAudit2026FeeRenderTable(ctx);
    if (po && po.style.display !== 'none') window.gmAudit2026OwnerRenderTable(ctx);
  };

  /** pt-BR: aceita vírgula como decimal nos inputs fee */
  function gmAuditParsePctFlexible(raw) {
    var s = String(raw == null ? '' : raw).trim().replace(/\s+/g, '');
    if (s === '') return null;
    s = s.replace(',', '.');
    var v = parseFloat(s);
    return isFinite(v) ? round2(v) : null;
  }

  window.gmAudit2026FeeFetchAndRender = function () {
    var ctx = window.__AUD2026_CTX;
    var cid =
      typeof gmAuditEffectiveClientId === 'function' ? gmAuditEffectiveClientId() : '';
    var fb = document.getElementById('aud2026-fee-feedback');
    if (!ctx) {
      window.__AUD2026_FEE_LAST_SNAPSHOT_RAW = null;
      window.__AUD2026_FEE_LAST_SNAPSHOT_MAP = {};
      if (fb) {
        fb.style.display = 'block';
        fb.style.color = 'var(--ink3)';
        fb.textContent = 'Carregue o CSV na aba «Análise atual» antes.';
      }
      return;
    }
    if (!cid) {
      window.__AUD2026_FEE_LOOKUP = {};
      window.__AUD2026_FEE_LAST_SNAPSHOT_RAW = null;
      window.__AUD2026_FEE_LAST_SNAPSHOT_MAP = {};
      if (fb) {
        fb.style.display = 'block';
        fb.style.color = 'var(--ink3)';
        fb.textContent = 'Selecione o cliente ativo (super_admin) para carregar contratos gravados.';
      }
      gmAudit2026FeeRenderTable(ctx);
      return;
    }
    if (fb) {
      fb.style.display = 'block';
      fb.style.color = 'var(--ink3)';
      fb.textContent = 'A carregar contratos e último resultado de upload gravado...';
    }
    window.__AUD2026_FEE_LAST_SNAPSHOT_RAW = null;
    window.__AUD2026_FEE_LAST_SNAPSHOT_MAP = {};
    Promise.all([
      fetch('/api/audit-2026/fee-contracts?clientId=' + encodeURIComponent(cid), {
        credentials: 'same-origin',
      }).then(function (r) {
        return r.json().then(function (j) {
          return { r: r, j: j };
        });
      }),
      fetch('/api/audit-2026/fee-snapshots?clientId=' + encodeURIComponent(cid), {
        credentials: 'same-origin',
      }).then(function (r) {
        return r.json().then(function (j) {
          return { r: r, j: j };
        });
      }),
    ])
      .then(function (pair) {
        var x = pair[0];
        var xSnap = pair[1];
        window.__AUD2026_FEE_LOOKUP = {};
        window.__AUD2026_FEE_LAST_SNAPSHOT_RAW = null;
        window.__AUD2026_FEE_LAST_SNAPSHOT_MAP = {};
        if (xSnap.r.ok && xSnap.j.ok && xSnap.j.snapshot) {
          window.__AUD2026_FEE_LAST_SNAPSHOT_RAW = xSnap.j.snapshot;
          window.__AUD2026_FEE_LAST_SNAPSHOT_MAP = window.gmAudit2026FeeSnapshotRowsToMap(
            xSnap.j.snapshot,
          );
        }

        if (!x.r.ok || !x.j.ok || !Array.isArray(x.j.contracts)) {
          if (fb)
            fb.textContent = (x.j && x.j.error) || 'Erro ao carregar contratos de fee.';
          if (fb) fb.style.color = 'var(--red)';
          gmAudit2026FeeRenderTable(window.__AUD2026_CTX);
          return;
        }
        for (var h = 0; h < x.j.contracts.length; h++) {
          var rr = x.j.contracts[h];
          if (rr.propertyKey != null && rr.contractedPct != null) {
            window.__AUD2026_FEE_LOOKUP[String(rr.propertyKey)] = Number(rr.contractedPct);
          }
        }
        if (!xSnap.r.ok || !xSnap.j.ok)
          console.warn('[fee-snapshots]', (xSnap.j && xSnap.j.error) || xSnap.r.statusText);
        if (fb) fb.style.display = 'none';
        gmAudit2026FeeRenderTable(window.__AUD2026_CTX);
      })
      .catch(function (err) {
        if (fb) {
          fb.style.display = 'block';
          fb.style.color = 'var(--red)';
          fb.textContent = err.message || String(err);
        }
      });
  };

  window.gmAudit2026FeeTabActivate = function () {
    window.gmAudit2026FeeFetchAndRender();
  };

  window.gmAudit2026FeeRenderTable = function (ctx) {
    ctx = ctx || window.__AUD2026_CTX;
    var tb = document.getElementById('aud2026-fee-tbody');
    if (!tb) return;
    if (!ctx || !ctx.seqKeys || !ctx.seqKeys.length) {
      tb.innerHTML =
        '<tr><td colspan="11" style="padding:14px;color:var(--ink3)">Sem dados GL. Use «Análise atual» para carregar o CSV.</td></tr>';
      return;
    }

    var q = '';
    try {
      q = (document.getElementById('aud2026-filter').value || '').toLowerCase().trim();
    } catch (_) {}

    var keys = ctx.seqKeys
      .filter(function (k) {
        return !q || String(k || '').toLowerCase().indexOf(q) >= 0;
      })
      .sort(function (a, b) {
        return (ctx.properties[b].fee6111 || 0) - (ctx.properties[a].fee6111 || 0);
      });

    var lookupSaved = window.__AUD2026_FEE_LOOKUP || {};
    var snapMap = window.__AUD2026_FEE_LAST_SNAPSHOT_MAP || {};
    var rows = '';
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var pv = ctx.properties[key];
      var sug = pv.mgmtFeeAudit ? pv.mgmtFeeAudit.sugestaoPctContratada : null;
      var sav = lookupSaved[key];
      var hasSav = sav != null && isFinite(Number(sav));
      var initVal =
        hasSav ? String(Number(sav).toFixed(2).replace('.', ',')) : sug != null ? String(sug.toFixed(2).replace('.', ',')) : '';
      var kEscAttr = encodeURIComponent(key).replace(/'/g, '%27');
      var dbNum = hasSav ? Number(sav) : null;
      var effForRow = null;
      if (hasSav) {
        effForRow = gmAuditParsePctFlexible(initVal);
        if (effForRow == null) effForRow = dbNum;
      }
      var st = gmAudit2026ComputeFeeRow(pv, dbNum, effForRow);
      var prevEnt = feeOwnerPrevEntry(snapMap, key);

      var pctCell = '';
      var pc = st.pctCell;
      if (!pc || pc.kind === 'none') pctCell = '\u2014';
      else if (pc.kind === 'single' && pc.val != null)
        pctCell =
          pc.val.toFixed(2).replace('.', ',') +
          '%';
      else if (pc.kind === 'var')
        pctCell =
          (pc.val != null
            ? pc.val.toFixed(2).replace('.', ',') + '% '
            : '') +
          '<span style="margin-left:6px;font-size:9px;padding:2px 7px;border-radius:14px;background:var(--amber-bg);color:var(--amber);border:1px solid var(--amber-bd);font-family:&quot;DM Sans&quot;,sans-serif">% vari\u00e1vel</span>';
      else pctCell = '\u2014';

      var sugHint = !hasSav && sug != null ? ' sug' : '';

      rows +=
        '<tr><td style="padding:8px 10px;max-width:220px;word-break:break-word">' +
        escHtml(key.length > 120 ? key.slice(0, 117) + '\u2026' : key) +
        '</td>' +
        '<td style="padding:8px 10px;text-align:right;white-space:nowrap">' +
        '<input type="text" inputmode="decimal" data-audfee-key="' +
        kEscAttr +
        '" class="aud2026fee-pctinp" value="' +
        escHtml(initVal) +
        '" style="width:74px;text-align:right;padding:6px 8px;font-size:12px;font-family:JetBrains Mono,monospace;border-radius:7px;background:var(--sand);border:1px solid var(--border2);color:var(--ink)' +
        (sugHint ? ';font-style:italic;color:var(--ink3)' : '') +
        '" title="% contratada (edit\u00e1vel)"/>' +
        (!hasSav && sug != null
          ? ' <span style="font-size:9px;color:var(--ink3);font-family:&quot;DM Sans&quot;,sans-serif">sugerido</span>'
          : '') +
        '</td>' +
        '<td style="padding:8px 10px;text-align:center;font-family:JetBrains Mono,monospace;font-size:11px">' +
        pctCell +
        '</td>' +
        '<td style="padding:8px 10px;text-align:right;font-family:JetBrains Mono,monospace">' +
        (st.baseDisplay === '\u2014'
          ? '\u2014'
          : '$ ' + fmtUsd(parseFloat(st.baseDisplay.replace(',', '.')) || 0)) +
        '</td>' +
        '<td style="padding:8px 10px;text-align:right;font-family:JetBrains Mono,monospace">$ ' +
        (st.esperado == null ? '\u2014' : fmtUsd(st.esperado)) +
        '</td>' +
        '<td style="padding:8px 10px;text-align:right;font-family:JetBrains Mono,monospace">$ ' +
        fmtUsd(st.cobradoTotal) +
        '</td>' +
        '<td style="padding:8px 10px;text-align:right;font-family:JetBrains Mono,monospace">$ ' +
        (st.diff == null ? '\u2014' : fmtUsd(st.diff)) +
        '</td>' +
        '<td style="padding:8px 10px;text-align:center">' +
        feeOwnerPrevHtml(prevEnt) +
        '</td>' +
        '<td style="padding:8px 10px;text-align:center">' +
        feeOwnerAtualHtml(st) +
        '</td>' +
        '<td style="padding:8px 10px;text-align:center">' +
        feeOwnerVariationHtml(st, prevEnt) +
        '</td>' +
        '<td style="padding:8px 10px;text-align:center">' +
        feeAuditStatusBadgeHtml(st) +
        '</td></tr>';
    }

    tb.innerHTML =
      rows ||
      '<tr><td colspan="11" style="padding:14px;color:var(--ink3)">Sem linhas neste filtro.</td></tr>';

    tb.oninput = function (ev) {
      if (
        ev.target &&
        ev.target.classList &&
        ev.target.classList.contains('aud2026fee-pctinp')
      ) {
        try {
          var row = ev.target.closest('tr');
          if (!row || !window.__AUD2026_CTX) return;
          var pk = decodeURIComponent(ev.target.getAttribute('data-audfee-key') || '');
          var pvRow = window.__AUD2026_CTX.properties[pk];
          var lookupSavedInner = window.__AUD2026_FEE_LOOKUP || {};
          var savIn = lookupSavedInner[pk];
          var dbN = savIn != null ? Number(savIn) : null;
          var effInline = null;
          if (dbN != null && isFinite(Number(dbN))) {
            effInline = gmAuditParsePctFlexible(ev.target.value);
            if (effInline == null) effInline = Number(dbN);
          }
          var stm = gmAudit2026ComputeFeeRow(pvRow, dbN, effInline);
          row.cells[3].innerHTML =
            '$ ' +
            (stm.baseDisplay === '\u2014'
              ? '\u2014'
              : fmtUsd(parseFloat(stm.baseDisplay.replace(',', '.')) || 0));
          row.cells[4].innerHTML = '$ ' + (stm.esperado == null ? '\u2014' : fmtUsd(stm.esperado));
          row.cells[5].innerHTML = '$ ' + fmtUsd(stm.cobradoTotal);
          row.cells[6].innerHTML =
            '$ ' + (stm.diff == null ? '\u2014' : fmtUsd(stm.diff));
          var pemR = feeOwnerPrevEntry(window.__AUD2026_FEE_LAST_SNAPSHOT_MAP || {}, pk);
          row.cells[8].innerHTML = feeOwnerAtualHtml(stm);
          row.cells[9].innerHTML = feeOwnerVariationHtml(stm, pemR);
          row.cells[10].innerHTML = feeAuditStatusBadgeHtml(stm);
        } catch (_) {}
        window.gmAudit2026FeeRefreshSummaryFromDom();
        try {
          var poX = document.getElementById('aud2026-panel-owner');
          if (poX && poX.style.display !== 'none' && window.__AUD2026_CTX) {
            window.gmAudit2026OwnerRenderTable(window.__AUD2026_CTX);
          }
        } catch (_) {}
      }
    };

    gmAudit2026FeeRefreshSummaryFromDom();
  };

  window.gmAudit2026FeeSaveAll = function () {
    var ctx = window.__AUD2026_CTX;
    var cid =
      typeof gmAuditEffectiveClientId === 'function' ? gmAuditEffectiveClientId() : '';
    var fb = document.getElementById('aud2026-fee-feedback');
    if (!ctx || !cid) return alert('Carregue o GL e selecione o cliente.');
    var tb = document.getElementById('aud2026-fee-tbody');
    if (!tb) return;
    var inpList = tb.querySelectorAll('.aud2026fee-pctinp');
    var batch = [];
    var z;
    for (z = 0; z < inpList.length; z++) {
      var kk = decodeURIComponent(inpList[z].getAttribute('data-audfee-key') || '');
      var pc = gmAuditParsePctFlexible(inpList[z].value);
      if (!kk || pc == null || !Number.isFinite(pc) || pc < 0 || pc > 100) continue;
      batch.push({ propertyKey: kk, contractedPct: pc });
    }
    if (!batch.length) return alert('Nenhuma percentagem v\u00e1lida para gravar.');
    if (fb) {
      fb.style.display = 'block';
      fb.style.color = 'var(--ink3)';
      fb.textContent = 'A gravar...';
    }
    fetch('/api/audit-2026/fee-contracts', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: cid, contracts: batch }),
    })
      .then(function (r) {
        return r.json().then(function (j) {
          return { r: r, j: j };
        });
      })
      .then(function (x) {
        if (fb) {
          fb.style.display = 'block';
          fb.style.color = x.r.ok ? 'var(--green)' : 'var(--red)';
          fb.textContent = x.r.ok ? 'Guardado (' + String(x.j.saved || 0) + ').' : ((x.j && x.j.error) || 'Erro');
        }
        if (x.r.ok) window.gmAudit2026FeeFetchAndRender();
      })
      .catch(function (e) {
        if (fb) {
          fb.style.display = 'block';
          fb.style.color = 'var(--red)';
          fb.textContent = e.message || String(e);
        }
      });
  };

  window.gmAudit2026FeeSaveSnapshotUpload = function () {
    var ctx = window.__AUD2026_CTX;
    var cid =
      typeof gmAuditEffectiveClientId === 'function' ? gmAuditEffectiveClientId() : '';
    var fb = document.getElementById('aud2026-fee-feedback');
    if (!ctx || !ctx.seqKeys || !ctx.seqKeys.length) return alert('Carregue o GL primeiro.');
    if (!cid) return alert('Selecione o cliente ativo.');
    var tb = document.getElementById('aud2026-fee-tbody');
    var lookupSaved = window.__AUD2026_FEE_LOOKUP || {};
    var results = [];
    var si;
    for (si = 0; si < ctx.seqKeys.length; si++) {
      var keyOne = ctx.seqKeys[si];
      var pv0 = ctx.properties[keyOne];
      if (!pv0) continue;
      var savOne = lookupSaved[keyOne];
      var hasSavOne = savOne != null && isFinite(Number(savOne));
      var dbN0 = hasSavOne ? Number(savOne) : null;
      var kEscSel = encodeURIComponent(keyOne).replace(/'/g, '%27');
      var inpOne = tb
        ? tb.querySelector(
            'input.aud2026fee-pctinp[data-audfee-key="' + kEscSel + '"]',
          )
        : null;
      var effOne = null;
      if (dbN0 != null && isFinite(Number(dbN0))) {
        effOne = gmAuditParsePctFlexible(inpOne ? inpOne.value : '');
        if (effOne == null) effOne = Number(dbN0);
      }
      var stSnap = gmAudit2026ComputeFeeRow(pv0, dbN0, effOne);
      var pctContratadaOut = effOne != null ? effOne : dbN0;
      results.push({
        propertyKey: keyOne,
        valorOwner:
          stSnap.valorOwner == null ? null : round2(Number(stSnap.valorOwner)),
        feeEsperado:
          stSnap.esperado == null ? null : round2(Number(stSnap.esperado)),
        feeCobrado: round2(Number(stSnap.cobradoTotal || 0)),
        pctContratada:
          pctContratadaOut != null && isFinite(Number(pctContratadaOut))
            ? round2(Number(pctContratadaOut))
            : null,
        pctAplicada: pctAplicadaForSnapshot(stSnap.pctCell),
      });
    }
    if (!results.length) return alert('CSV sem propriedades para gravar snapshot.');
    if (fb) {
      fb.style.display = 'block';
      fb.style.color = 'var(--ink3)';
      fb.textContent = 'A gravar resultado deste upload...';
    }
    fetch('/api/audit-2026/fee-snapshots', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: cid, label: '', results: results }),
    })
      .then(function (r) {
        return r.json().then(function (j) {
          return { r: r, j: j };
        });
      })
      .then(function (x) {
        if (fb) {
          fb.style.display = 'block';
          fb.style.color = x.r.ok ? 'var(--green)' : 'var(--red)';
          fb.textContent =
            x.r.ok && x.j && x.j.ok
              ? 'Resultado gravado. No pr\u00f3ximo CSV, usar\u00e1 como coluna anterior.'
              : (x.j && x.j.error) || 'Erro ao gravar snapshot.';
        }
        if (x.r.ok && x.j && x.j.ok) window.gmAudit2026FeeFetchAndRender();
      })
      .catch(function (err) {
        if (fb) {
          fb.style.display = 'block';
          fb.style.color = 'var(--red)';
          fb.textContent = err.message || String(err);
        }
      });
  };

  /** === Auditoria do Owner ( distribuição 3250 vs net devido · % gravada · sem localStorage ) === */

  window.__AUD2026_OWNER_SNAPSHOT_RAW = window.__AUD2026_OWNER_SNAPSHOT_RAW || null;
  window.__AUD2026_OWNER_SNAPSHOT_MAP =
    window.__AUD2026_OWNER_SNAPSHOT_MAP || {};

  window.gmAudit2026OwnerSnapshotRowsToMap = function (snap) {
    var out = {};
    if (!snap || !Array.isArray(snap.results)) return out;
    var j;
    for (j = 0; j < snap.results.length; j++) {
      var rr = snap.results[j];
      if (!rr || typeof rr.propertyKey !== 'string') continue;
      out[String(rr.propertyKey)] = rr;
    }
    return out;
  };

  /** @param {number|null|undefined} over */
  window.gmAudit2026OwnerOverVerdictBand = function (hasPct, over) {
    if (!hasPct) return 'gray';
    if (over == null || !isFinite(Number(over))) return 'gray';
    var o = Number(over);
    if (o > 1) return 'red';
    if (o < -1) return 'green';
    return 'blue';
  };

  /** @returns {string} */
  window.gmAudit2026OwnerOverVerdictLabel = function (oa) {
    if (!oa.hasPct || oa.overPayment == null || !isFinite(Number(oa.overPayment))) {
      return 'Revisar';
    }
    var o = Number(oa.overPayment);
    if (Math.abs(o) <= 1) return 'Correto';
    if (o > 1) return 'Devolver $ ' + fmtUsd(o);
    return 'A receber $ ' + fmtUsd(Math.abs(o));
  };

  /** @returns {object} */
  window.gmAudit2026ComputeOwnerAuditDistRow = function (
    pv,
    savedPctFromDbOrNull,
  ) {
    var income = Number(pv.income4 || 0);
    var rent = Number(pv.rent4100 || 0);
    var distribuido = Number(pv.dist3250 || 0);
    var despEx =
      pv.ownerAuditExpenseEx611 != null
        ? Number(pv.ownerAuditExpenseEx611)
        : round2(Number(pv.expense67 || 0) - Number(pv.fee6111 || 0));
    var h6075 =
      pv.ownerAudit6075 != null ? Number(pv.ownerAudit6075) : 0;
    var repair =
      pv.ownerAuditRepair != null ? Number(pv.ownerAuditRepair) : 0;
    var otherExp =
      pv.ownerAuditOtherExp != null
        ? Number(pv.ownerAuditOtherExp)
        : round2(despEx - h6075 - repair);

    var hasPct =
      savedPctFromDbOrNull != null &&
      savedPctFromDbOrNull !== undefined &&
      isFinite(Number(savedPctFromDbOrNull)) &&
      Number(savedPctFromDbOrNull) >= 0 &&
      Number(savedPctFromDbOrNull) <= 100;

    var pctNum = hasPct ? Number(savedPctFromDbOrNull) : null;
    var feeDevido =
      hasPct && rent >= 0
        ? round2((pctNum / 100) * rent)
        : null;
    var otherIncome = round2(income - rent);
    var netDevido =
      hasPct && feeDevido != null
        ? round2(income - feeDevido - despEx)
        : null;
    var overPayment =
      hasPct && netDevido != null ? round2(distribuido - netDevido) : null;

    var ownerLbl =
      (pv.ownerPredPayee && String(pv.ownerPredPayee).trim()) ||
      ((pv.ownerHints && pv.ownerHints[0]) || '(a definir)');

    var band = gmAudit2026OwnerOverVerdictBand(hasPct, overPayment);

    return {
      hasPct: hasPct,
      pctContratada: pctNum,
      rent: rent,
      otherIncome: otherIncome,
      income: income,
      feeDevido: feeDevido,
      despesas: despEx,
      hoa6075: h6075,
      repairs60736: repair,
      otherExp: round2(otherExp),
      netDevido: netDevido,
      distribuido: distribuido,
      overPayment: overPayment,
      ownerLabel: ownerLbl.trim() || '(a definir)',
      band: band,
      resultadoLabel: gmAudit2026OwnerOverVerdictLabel({
        hasPct: hasPct,
        overPayment: overPayment,
      }),
    };
  };

  function ownerAuditPctEffFromInputs(pk, feeTbodyEl, lookupSaved) {
    var savIn = lookupSaved[pk];
    var dbN = savIn != null ? Number(savIn) : null;
    if (dbN == null || !isFinite(Number(dbN))) return null;
    var kEsc = encodeURIComponent(pk).replace(/'/g, '%27');
    var inp =
      feeTbodyEl &&
      feeTbodyEl.querySelector(
        'input.aud2026fee-pctinp[data-audfee-key="' + kEsc + '"]',
      );
    var eff = gmAuditParsePctFlexible(inp ? inp.value : '');
    if (eff == null) eff = Number(dbN);
    return eff != null && isFinite(eff) ? eff : Number(dbN);
  }

  function ownerAuditSnapPrev(prevMapByKey, propertyKeyStr) {
    var row =
      prevMapByKey &&
      typeof prevMapByKey === 'object' &&
      Object.prototype.hasOwnProperty.call(prevMapByKey, propertyKeyStr)
        ? prevMapByKey[propertyKeyStr]
        : undefined;
    if (!row || typeof row !== 'object') return { prevMissing: true };
    return {
      prevMissing: false,
      overPayment: row.overPayment == null ? null : Number(row.overPayment),
    };
  }

  function ownerAuditOverSignedOverCell(hasPctVal, overVal) {
    if (!hasPctVal || overVal == null || !isFinite(Number(overVal))) {
      return (
        '<span style="font-family:JetBrains Mono,monospace;font-size:11px;font-weight:700;color:var(--ink3)">\u2014</span>'
      );
    }
    var b = gmAudit2026OwnerOverVerdictBand(hasPctVal, overVal);
    var col =
      b === 'red'
        ? 'var(--red)'
        : b === 'green'
          ? 'var(--green)'
          : b === 'blue'
            ? 'var(--blue)'
            : 'var(--ink3)';
    var o = Number(overVal);
    var pieces = (o >= 0 ? '+' : '\u2212') + '$ ' + fmtUsd(Math.abs(o));
    return (
      '<span style="font-family:JetBrains Mono,monospace;font-size:11px;font-weight:700;color:' +
      col +
      '">' +
      escHtml(pieces) +
      '</span>'
    );
  }

  function ownerAuditUsdDeltaVariationHtml(currUsd, prevUsd) {
    if (currUsd == null || !isFinite(Number(currUsd))) {
      return (
        '<span style="font-family:JetBrains Mono,monospace;font-size:11px;font-weight:700;color:var(--ink3)">\u2014</span>'
      );
    }
    if (prevUsd == null || !isFinite(Number(prevUsd))) {
      return (
        '<span style="font-family:JetBrains Mono,monospace;font-size:11px;font-weight:700;color:var(--ink3)">\u2014</span>'
      );
    }
    var d = round2(Number(currUsd) - Number(prevUsd));
    if (Math.abs(d) < 1) {
      return (
        '<span style="font-family:JetBrains Mono,monospace;font-size:11px;font-weight:700;color:var(--ink3)">=</span>'
      );
    }
    var signCol = d > 0 ? 'var(--green)' : 'var(--red)';
    var arr = d > 0 ? '\u25b2' : '\u25bc';
    var signedUsd = (d > 0 ? '+' : '\u2212') + '$ ' + fmtUsd(Math.abs(d));
    var pctPart = ' (n/d)';
    if (Math.abs(Number(prevUsd)) >= 1) {
      var pPct = round2((d / Math.abs(Number(prevUsd))) * 100);
      pctPart =
        ' (' +
        (d > 0 ? '+' : '\u2212') +
        Math.abs(pPct).toFixed(2).replace('.', ',') +
        '%)';
    }
    var line = arr + ' ' + signedUsd + pctPart;
    return (
      '<span style="font-family:JetBrains Mono,monospace;font-size:11px;font-weight:700;color:' +
      signCol +
      '">' +
      escHtml(line) +
      '</span>'
    );
  }

  function ownerAuditVariationCell(oa, prevEnt) {
    if (
      !prevEnt ||
      prevEnt.prevMissing ||
      prevEnt.overPayment == null ||
      !isFinite(Number(prevEnt.overPayment))
    ) {
      return (
        '<span style="font-family:JetBrains Mono,monospace;font-size:11px;font-weight:700;color:var(--ink3)">\u2014</span>'
      );
    }
    if (!oa.hasPct || oa.overPayment == null) {
      return (
        '<span style="font-family:JetBrains Mono,monospace;font-size:11px;font-weight:700;color:var(--ink3)">\u2014</span>'
      );
    }
    return ownerAuditUsdDeltaVariationHtml(
      Number(oa.overPayment),
      Number(prevEnt.overPayment),
    );
  }

  window.gmAudit2026OwnerRefreshSummaryCards = function (rowsMeta) {
    var totDevolver = 0;
    var totReceber = 0;
    var nCorr = 0,
      nRev = 0;
    rowsMeta = Array.isArray(rowsMeta) ? rowsMeta : [];
    var r;
    for (r = 0; r < rowsMeta.length; r++) {
      var om = rowsMeta[r];
      if (!om.hasPct) {
        nRev += 1;
        continue;
      }
      if (om.over == null || !isFinite(om.over)) {
        nRev += 1;
        continue;
      }
      if (om.over > 1) totDevolver += om.over;
      else if (om.over < -1) totReceber += Math.abs(om.over);
      else nCorr += 1;
    }
    function setIx(id, t) {
      var el = document.getElementById(id);
      if (el) el.textContent = t;
    }
    setIx('aud2026-owner-sum-devolver', '$ ' + fmtUsd(totDevolver));
    setIx('aud2026-owner-sum-receber', '$ ' + fmtUsd(totReceber));
    setIx('aud2026-owner-sum-corr', String(nCorr));
    setIx('aud2026-owner-sum-revisar', String(nRev));
  };

  window.gmAudit2026OwnerFetchAndRender = function () {
    var ctx = window.__AUD2026_CTX;
    var cid =
      typeof gmAuditEffectiveClientId === 'function' ? gmAuditEffectiveClientId() : '';
    var fb = document.getElementById('aud2026-owner-feedback');
    if (!ctx) {
      window.__AUD2026_OWNER_SNAPSHOT_RAW = null;
      window.__AUD2026_OWNER_SNAPSHOT_MAP = {};
      if (fb) {
        fb.style.display = 'block';
        fb.style.color = 'var(--ink3)';
        fb.textContent = 'Carregue o CSV na aba «Análise atual» antes.';
      }
      return;
    }
    if (!cid) {
      window.__AUD2026_FEE_LOOKUP = {};
      window.__AUD2026_OWNER_SNAPSHOT_RAW = null;
      window.__AUD2026_OWNER_SNAPSHOT_MAP = {};
      if (fb) {
        fb.style.display = 'block';
        fb.style.color = 'var(--ink3)';
        fb.textContent =
          'Selecione o cliente ativo para carregar % contratadas e snapshots.';
      }
      gmAudit2026OwnerRenderTable(ctx);
      return;
    }
    if (fb) {
      fb.style.display = 'block';
      fb.style.color = 'var(--ink3)';
      fb.textContent = 'A carregar dados de auditoria do owner…';
    }
    window.__AUD2026_OWNER_SNAPSHOT_RAW = null;
    window.__AUD2026_OWNER_SNAPSHOT_MAP = {};
    Promise.all([
      fetch('/api/audit-2026/fee-contracts?clientId=' + encodeURIComponent(cid), {
        credentials: 'same-origin',
      }).then(function (r) {
        return r.json().then(function (j) {
          return { r: r, j: j };
        });
      }),
      fetch('/api/audit-2026/owner-snapshots?clientId=' + encodeURIComponent(cid), {
        credentials: 'same-origin',
      }).then(function (r) {
        return r.json().then(function (j) {
          return { r: r, j: j };
        });
      }),
    ])
      .then(function (pair) {
        var x = pair[0];
        var xOs = pair[1];
        window.__AUD2026_FEE_LOOKUP = {};
        window.__AUD2026_OWNER_SNAPSHOT_RAW = null;
        window.__AUD2026_OWNER_SNAPSHOT_MAP = {};
        if (xOs.r.ok && xOs.j.ok && xOs.j.snapshot) {
          window.__AUD2026_OWNER_SNAPSHOT_RAW = xOs.j.snapshot;
          window.__AUD2026_OWNER_SNAPSHOT_MAP =
            gmAudit2026OwnerSnapshotRowsToMap(xOs.j.snapshot);
        }
        if (!x.r.ok || !x.j.ok || !Array.isArray(x.j.contracts)) {
          if (fb)
            fb.textContent = (x.j && x.j.error) || 'Erro ao carregar % contratadas.';
          if (fb) fb.style.color = 'var(--red)';
          gmAudit2026OwnerRenderTable(window.__AUD2026_CTX);
          return;
        }
        var hh;
        for (hh = 0; hh < x.j.contracts.length; hh++) {
          var tr = x.j.contracts[hh];
          if (tr.propertyKey != null && tr.contractedPct != null)
            window.__AUD2026_FEE_LOOKUP[String(tr.propertyKey)] = Number(tr.contractedPct);
        }
        if (!xOs.r.ok || !xOs.j.ok)
          console.warn('[owner-snapshots]', (xOs.j && xOs.j.error) || xOs.r.statusText);
        if (fb) fb.style.display = 'none';
        gmAudit2026OwnerRenderTable(window.__AUD2026_CTX);
      })
      .catch(function (err) {
        if (fb) {
          fb.style.display = 'block';
          fb.style.color = 'var(--red)';
          fb.textContent = err.message || String(err);
        }
      });
  };

  window.gmAudit2026OwnerTabActivate = function () {
    window.gmAudit2026OwnerFetchAndRender();
  };

  /** Subtotal agregados por proprietário predominante na 3250 */
  window.gmAudit2026OwnerRenderTable = function (ctx) {
    ctx = ctx || window.__AUD2026_CTX;
    var tb = document.getElementById('aud2026-owner-tbody');
    if (!tb) return;

    function emptyHtml(msg, colspanN) {
      return (
        '<tr><td colspan="' +
        String(colspanN) +
        '" style="padding:14px;color:var(--ink3)">' +
        escHtml(msg) +
        '</td></tr>'
      );
    }

    if (!ctx || !ctx.seqKeys || !ctx.seqKeys.length) {
      tb.innerHTML = emptyHtml(
        'Sem dados GL. Use «Análise atual» para carregar o CSV.',
        10,
      );
      window.gmAudit2026OwnerRefreshSummaryCards([]);
      return;
    }

    var qRaw = '';
    try {
      qRaw = (document.getElementById('aud2026-filter').value || '').trim();
    } catch (_) {}
    var q = qRaw.toLowerCase();

    var keys = ctx.seqKeys.filter(function (k) {
      return (
        !q || String(k || '').toLowerCase().indexOf(q) >= 0
      );
    });

    if (!keys.length) {
      tb.innerHTML = emptyHtml('Sem linhas neste filtro.', 10);
      window.gmAudit2026OwnerRefreshSummaryCards([]);
      return;
    }

    var lk = window.__AUD2026_FEE_LOOKUP || {};
    var snapM = window.__AUD2026_OWNER_SNAPSHOT_MAP || {};
    var feeTb = document.getElementById('aud2026-fee-tbody');

    var rowObjs = [];
    var ki;
    for (ki = 0; ki < keys.length; ki++) {
      var pk = keys[ki];
      var pvObj = ctx.properties[pk];
      if (!pvObj) continue;
      var peff = ownerAuditPctEffFromInputs(pk, feeTb, lk);
      var oa = gmAudit2026ComputeOwnerAuditDistRow(pvObj, peff);
      var prevE = ownerAuditSnapPrev(snapM, pk);
      rowObjs.push({ key: pk, pv: pvObj, oa: oa, prev: prevE });
    }

    rowObjs.sort(function (a, b) {
      var oa = String(a.oa.ownerLabel || '').localeCompare(String(b.oa.ownerLabel || ''));
      if (oa !== 0) return oa;
      return (b.pv.dist3250 || 0) - (a.pv.dist3250 || 0);
    });

    var groupsMap = {};
    var gi;
    for (gi = 0; gi < rowObjs.length; gi++) {
      var grpKey = rowObjs[gi].oa.ownerLabel || '(a definir)';
      if (!groupsMap[grpKey]) groupsMap[grpKey] = [];
      groupsMap[grpKey].push(rowObjs[gi]);
    }

    var groupKeys = Object.keys(groupsMap).sort(function (x, y) {
      return x.localeCompare(y);
    });

    var rowsHtml = '';
    var metaSum = [];

    function resultadoCellHtml(oa) {
      if (!oa.hasPct) {
        return (
          '<span style="font-family:JetBrains Mono,monospace;font-size:11px;font-weight:700;color:var(--ink3)">Revisar</span>'
        );
      }
      var col =
        oa.band === 'red'
          ? 'var(--red)'
          : oa.band === 'green'
            ? 'var(--green)'
            : oa.band === 'blue'
              ? 'var(--blue)'
              : 'var(--ink3)';
      return (
        '<span style="font-family:JetBrains Mono,monospace;font-size:11px;font-weight:700;color:' +
        col +
        '">' +
        escHtml(oa.resultadoLabel) +
        '</span>'
      );
    }

    function subtotalMessage(sumOver) {
      if (Math.abs(sumOver) <= 1) return 'L\u00edquido correto.';
      if (sumOver > 1)
        return (
          'Total que o propriet\u00e1rio deve devolver: $ ' + fmtUsd(sumOver)
        );
      return (
        'Total que o propriet\u00e1rio tem a receber: $ ' + fmtUsd(Math.abs(sumOver))
      );
    }

    var gkIdx;
    for (gkIdx = 0; gkIdx < groupKeys.length; gkIdx++) {
      var go = groupsMap[groupKeys[gkIdx]];
      var subAgg = 0;
      var hasAny = false;
      var lx;
      for (lx = 0; lx < go.length; lx++) {
        var ro = go[lx];
        if (ro.oa.hasPct && ro.oa.overPayment != null && isFinite(ro.oa.overPayment)) {
          subAgg = round2(subAgg + Number(ro.oa.overPayment));
          hasAny = true;
        }
        metaSum.push({
          hasPct: ro.oa.hasPct,
          over: ro.oa.overPayment,
        });
        rowsHtml +=
          '<tr>' +
          '<td style="padding:8px 10px;max-width:200px;word-break:break-word">' +
          escHtml(ro.key.length > 110 ? ro.key.slice(0, 107) + '\u2026' : ro.key) +
          '</td>' +
          '<td style="padding:8px;text-align:right;font-family:JetBrains Mono,monospace;font-size:11px">$ ' +
          fmtUsd(ro.oa.income) +
          '</td>' +
          '<td style="padding:8px;text-align:right;font-family:JetBrains Mono,monospace;font-size:11px">' +
          (ro.oa.feeDevido == null ? '\u2014' : '$ ' + fmtUsd(ro.oa.feeDevido)) +
          '</td>' +
          '<td style="padding:8px;text-align:right;font-family:JetBrains Mono,monospace;font-size:11px">$ ' +
          fmtUsd(ro.oa.despesas) +
          '</td>' +
          '<td style="padding:8px;text-align:right;font-family:JetBrains Mono,monospace;font-size:11px">' +
          (ro.oa.netDevido == null ? '\u2014' : '$ ' + fmtUsd(ro.oa.netDevido)) +
          '</td>' +
          '<td style="padding:8px;text-align:right;font-family:JetBrains Mono,monospace;font-size:11px">$ ' +
          fmtUsd(ro.oa.distribuido) +
          '</td>' +
          '<td style="padding:8px;text-align:center">' +
          (ro.prev.prevMissing || ro.prev.overPayment == null
            ? '<span style="font-family:JetBrains Mono,monospace;font-size:11px;font-weight:700;color:var(--ink3)">\u2014</span>'
            : ownerAuditOverSignedOverCell(true, ro.prev.overPayment)) +
          '</td>' +
          '<td style="padding:8px;text-align:center">' +
          ownerAuditOverSignedOverCell(ro.oa.hasPct, ro.oa.overPayment) +
          '</td>' +
          '<td style="padding:8px;text-align:center">' +
          ownerAuditVariationCell(ro.oa, ro.prev) +
          '</td>' +
          '<td style="padding:8px 10px;text-align:center">' +
          resultadoCellHtml(ro.oa) +
          '</td></tr>';
      }

      var subTxt = hasAny
        ? '<span style="font-family:JetBrains Mono,monospace;font-size:11px;font-weight:700;color:' +
          (Math.abs(subAgg) <= 1
            ? 'var(--blue)'
            : subAgg > 1
              ? 'var(--red)'
              : 'var(--green)') +
          '">' +
          escHtml(subtotalMessage(subAgg)) +
          '</span>'
        : '';

      rowsHtml +=
        '<tr style="background:var(--cream)">' +
        '<td colspan="10" style="padding:11px 14px;text-align:right;font-size:11px;line-height:1.5;color:var(--ink2);font-family:\'DM Sans\',sans-serif">' +
        '<span style="font-weight:700">' +
        escHtml(String(groupKeys[gkIdx])) +
        '</span> \u00b7 <span style="font-size:10px;color:var(--ink3);text-transform:uppercase">subtotal grupo (payee predominante 3250)</span><br/>' +
        (subTxt ||
          '<span style="font-size:11px;font-weight:700;color:var(--ink3)">\u2014</span>') +
        '</td></tr>';
    }

    tb.innerHTML = rowsHtml || emptyHtml('Sem linhas.', 10);

    window.gmAudit2026OwnerRefreshSummaryCards(metaSum);
  };

  window.gmAudit2026OwnerSaveSnapshotUpload = function () {
    var ctx = window.__AUD2026_CTX;
    var cid =
      typeof gmAuditEffectiveClientId === 'function' ? gmAuditEffectiveClientId() : '';
    var fb = document.getElementById('aud2026-owner-feedback');
    if (!ctx || !ctx.seqKeys || !ctx.seqKeys.length)
      return alert('Carregue o GL primeiro.');
    if (!cid) return alert('Selecione o cliente ativo.');
    var lk = window.__AUD2026_FEE_LOOKUP || {};
    var feeTb = document.getElementById('aud2026-fee-tbody');
    var resultsOut = [];
    var si;
    for (si = 0; si < ctx.seqKeys.length; si++) {
      var k1 = ctx.seqKeys[si];
      var pv1 = ctx.properties[k1];
      if (!pv1) continue;
      var peff1 = ownerAuditPctEffFromInputs(k1, feeTb, lk);
      var oa1 = gmAudit2026ComputeOwnerAuditDistRow(pv1, peff1);
      resultsOut.push({
        propertyKey: k1,
        owner: oa1.ownerLabel,
        overPayment:
          oa1.overPayment == null ? null : round2(Number(oa1.overPayment)),
        netDevido:
          oa1.netDevido == null ? null : round2(Number(oa1.netDevido)),
        distribuido: round2(Number(oa1.distribuido)),
        feeDevido:
          oa1.feeDevido == null ? null : round2(Number(oa1.feeDevido)),
      });
    }
    if (!resultsOut.length)
      return alert('Sem propriedades para gravar snapshot.');
    if (fb) {
      fb.style.display = 'block';
      fb.style.color = 'var(--ink3)';
      fb.textContent = 'A gravar snapshot de auditoria do owner…';
    }
    fetch('/api/audit-2026/owner-snapshots', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: cid, label: '', results: resultsOut }),
    })
      .then(function (r) {
        return r.json().then(function (j) {
          return { r: r, j: j };
        });
      })
      .then(function (x) {
        if (fb) {
          fb.style.display = 'block';
          fb.style.color = x.r.ok ? 'var(--green)' : 'var(--red)';
          fb.textContent =
            x.r.ok && x.j && x.j.ok
              ? 'Snapshot gravado. No pr\u00f3ximo upload aparece na coluna anterior.'
              : (x.j && x.j.error) || 'Erro.';
        }
        if (x.r.ok && x.j && x.j.ok) window.gmAudit2026OwnerFetchAndRender();
      })
      .catch(function (e) {
        if (fb) {
          fb.style.display = 'block';
          fb.style.color = 'var(--red)';
          fb.textContent = e.message || String(e);
        }
      });
  };

  /** Cenários de especificação (221 / 2693 / 7762) com fee 8% */
  window.gmAudit2026BenchOwnerSpecCases = function () {
    var pct = 8;
    var p221 = {
      income4: 23389.04,
      rent4100: 23250,
      ownerAudit6075: 0,
      ownerAuditRepair: 0,
      ownerAuditExpenseEx611: 80,
      ownerAuditOtherExp: 80,
      dist3250: 22033.28,
      ownerPredPayee: 'Owner Celebration',
      ownerHints: [],
    };
    var p2693 = {
      income4: 14000,
      rent4100: 13400,
      ownerAudit6075: 0,
      ownerAuditRepair: 0,
      ownerAuditExpenseEx611: 67.32,
      ownerAuditOtherExp: 67.32,
      dist3250: 13175.61,
      ownerPredPayee: 'Owner Armstrong',
      ownerHints: [],
    };
    var p7762 = {
      income4: 13300,
      rent4100: 13600,
      ownerAudit6075: 0,
      ownerAuditRepair: 0,
      ownerAuditExpenseEx611: 107.45,
      ownerAuditOtherExp: 107.45,
      dist3250: 12982.36,
      ownerPredPayee: 'Owner Syracuse',
      ownerHints: [],
    };
    var r1 = gmAudit2026ComputeOwnerAuditDistRow(p221, pct);
    var r2 = gmAudit2026ComputeOwnerAuditDistRow(p2693, pct);
    var r3 = gmAudit2026ComputeOwnerAuditDistRow(p7762, pct);
    var chk =
      r1.hasPct &&
      Math.abs(Number(r1.feeDevido) - 1860) < 0.06 &&
      Math.abs(Number(r1.netDevido) - 21449.04) < 0.06 &&
      Math.abs(Number(r1.overPayment) - 584.24) < 0.06 &&
      r1.band === 'red' &&
      Math.abs(Number(r2.netDevido) - 12860.68) < 0.06 &&
      Math.abs(Number(r2.overPayment) - 314.93) < 0.06 &&
      r2.band === 'red' &&
      Math.abs(Number(r3.netDevido) - 12104.55) < 0.06 &&
      Math.abs(Number(r3.overPayment) - 877.81) < 0.06 &&
      r3.band === 'red';

    console.log('[gmAudit2026BenchOwnerSpecCases]', {
      caso221: r1,
      caso2693: r2,
      caso7762: r3,
    });
    return { ok: chk, caso221: r1, caso2693: r2, caso7762: r3 };
  };

  window.gmAudit2026SwitchTab = function (tab) {
    var pa = document.getElementById('aud2026-panel-analysis');
    var ph = document.getElementById('aud2026-panel-history');
    var pf = document.getElementById('aud2026-panel-fee');
    var po = document.getElementById('aud2026-panel-owner');
    var ba = document.getElementById('aud2026-tab-analysis');
    var bh = document.getElementById('aud2026-tab-history');
    var bf = document.getElementById('aud2026-tab-fee');
    var bw = document.getElementById('aud2026-tab-owner');
    if (!pa || !ph) return;

    function hideAllPanels() {
      pa.style.display = 'none';
      ph.style.display = 'none';
      if (pf) pf.style.display = 'none';
      if (po) po.style.display = 'none';
      if (ba) ba.classList.remove('aud2026-tab-on');
      if (bh) bh.classList.remove('aud2026-tab-on');
      if (bf) bf.classList.remove('aud2026-tab-on');
      if (bw) bw.classList.remove('aud2026-tab-on');
    }

    if (tab === 'hist') {
      hideAllPanels();
      ph.style.display = 'block';
      if (bh) bh.classList.add('aud2026-tab-on');
      gmAuditDestroyHistoryChart();
      gmAudit2026SnapshotsRefresh();
      return;
    }
    if (tab === 'fee') {
      hideAllPanels();
      if (pf) pf.style.display = 'block';
      if (bf) bf.classList.add('aud2026-tab-on');
      gmAudit2026FeeTabActivate();
      return;
    }
    if (tab === 'owner') {
      hideAllPanels();
      if (po) po.style.display = 'block';
      if (bw) bw.classList.add('aud2026-tab-on');
      gmAudit2026OwnerTabActivate();
      return;
    }

    hideAllPanels();
    pa.style.display = 'block';
    if (ba) ba.classList.add('aud2026-tab-on');
  };

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
        csvMoneyEn(350.0),
        '',
        '',
        'Management Fees (10.00% of $3,500.00)',
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

  /** Totais globais fixture: 570912.08 · 781059.47 · 42960.15 · 86 props */
  window.gmAudit2026FixtureGlobal = function () {
    var csv = qaFixtureCsv();
    window.__AUD2026_LAST_TEXT = csv;
    var pk = parseAppfolioGeneralLedger(csv);
    window.__AUD2026_CTX = pk;
    render(pk);
    var chk =
      Math.abs(pk.totals.dist3250 - 570912.08) < 0.02 &&
      Math.abs(pk.totals.rent4100 - 781059.47) < 0.02 &&
      Math.abs(pk.totals.fee6111 - 42960.15) < 0.02 &&
      pk.totals.props === 86;
    alert(
      (chk ? 'Globais QA OK (~86 propriedades alvo).\n' : 'Globais divergentes:\n') +
        '3250 total=' +
        fmtUsd(pk.totals.dist3250) +
        '\n4100 total=' +
        fmtUsd(pk.totals.rent4100) +
          '\n6111 total=' +
        fmtUsd(pk.totals.fee6111) +
        ' (alvo atual fixture 42960,15)' +
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
      var okMg = Math.abs(p241.fee6111 - 350) < 0.06;
      var feeA = p241.mgmtFeeAudit;
      var okSug =
        feeA &&
        feeA.sugestaoPctContratada != null &&
        Math.abs(feeA.sugestaoPctContratada - 10) < 0.06;
      var rowFeeOk = gmAudit2026ComputeFeeRow(p241, 10, 10);
      var okAuditFee =
        rowFeeOk &&
        rowFeeOk.status === 'correto' &&
        rowFeeOk.esperado != null &&
        Math.abs(rowFeeOk.esperado - 350) < 0.06;
      var okOwnerBand241 =
        rowFeeOk.valorOwner != null &&
        Math.abs(rowFeeOk.valorOwner) < 1 &&
        window.gmAudit2026FeeOwnerBandFromValor(rowFeeOk.valorOwner) === 'blue';
      var okPct = true;
      var okRent410 = Math.abs(p241.rent4100 - 17500) < 0.02;
      var okCt315 = Math.abs(p241.cont3150 - 290) < 0.02;
      alert(
        (okInc &&
        okExp &&
        okD &&
        okMg &&
        okSug &&
        okAuditFee &&
        okOwnerBand241 &&
        okPct &&
        okRent410 &&
        okCt315
          ? '241 Lasso QA OK (+ auditoria fee 10%/350; owner Azul Correto).\n'
          : '241 parcial:\n') +
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
          (p241.feePct != null ? p241.feePct.toFixed(2) : '\u2014') +
          '\nesp\u2212cob (valorOwner)~' +
          (rowFeeOk && rowFeeOk.valorOwner != null ? fmtUsd(rowFeeOk.valorOwner) : '\u2014') +
          ' coresQA=' +
          (window.gmAudit2026FeeOwnerColorBench && window.gmAudit2026FeeOwnerColorBench().ok
            ? 'ok'
            : 'falhou'),
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
        try {
          var poFlt = document.getElementById('aud2026-panel-owner');
          if (poFlt && poFlt.style.display !== 'none' && window.__AUD2026_CTX) {
            window.gmAudit2026OwnerRenderTable(window.__AUD2026_CTX);
          }
        } catch (_) {}
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
    var tabA = document.getElementById('aud2026-tab-analysis');
    var tabH = document.getElementById('aud2026-tab-history');
    if (tabA)
      tabA.addEventListener('click', function () {
        if (typeof window.gmAudit2026SwitchTab === 'function') window.gmAudit2026SwitchTab('ana');
      });
    if (tabH)
      tabH.addEventListener('click', function () {
        if (typeof window.gmAudit2026SwitchTab === 'function') window.gmAudit2026SwitchTab('hist');
      });
    var tabF = document.getElementById('aud2026-tab-fee');
    if (tabF)
      tabF.addEventListener('click', function () {
        if (typeof window.gmAudit2026SwitchTab === 'function') window.gmAudit2026SwitchTab('fee');
      });
    var tabOwn = document.getElementById('aud2026-tab-owner');
    if (tabOwn)
      tabOwn.addEventListener('click', function () {
        if (typeof window.gmAudit2026SwitchTab === 'function')
          window.gmAudit2026SwitchTab('owner');
      });
    var arc = document.getElementById('aud2026-archive-btn');
    if (arc && typeof window.gmAudit2026ArchiveCurrent === 'function')
      arc.addEventListener('click', function () {
        window.gmAudit2026ArchiveCurrent();
      });
    var hRf = document.getElementById('aud2026-hist-refresh');
    if (hRf && typeof window.gmAudit2026SnapshotsRefresh === 'function')
      hRf.addEventListener('click', function () {
        window.gmAudit2026SnapshotsRefresh();
      });
    var cmpB = document.getElementById('aud2026-compare-btn');
    if (cmpB && typeof window.gmAudit2026CompareTwo === 'function')
      cmpB.addEventListener('click', function () {
        window.gmAudit2026CompareTwo();
      });
    var svF = document.getElementById('aud2026-fee-save');
    if (svF && typeof window.gmAudit2026FeeSaveAll === 'function')
      svF.addEventListener('click', function () {
        window.gmAudit2026FeeSaveAll();
      });
    var svSnap = document.getElementById('aud2026-fee-snapshot-save');
    if (svSnap && typeof window.gmAudit2026FeeSaveSnapshotUpload === 'function')
      svSnap.addEventListener('click', function () {
        window.gmAudit2026FeeSaveSnapshotUpload();
      });
    var svOw = document.getElementById('aud2026-owner-snapshot-save');
    if (svOw && typeof window.gmAudit2026OwnerSaveSnapshotUpload === 'function')
      svOw.addEventListener('click', function () {
        window.gmAudit2026OwnerSaveSnapshotUpload();
      });
  }

  window.gmAudit2026NavInit = wireOnce;
})();
