/**
 * GAAP Statement — Manager Prop
 * localStorage: mp_gaap_data_v2
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'mp_gaap_data_v2';

  var SECTIONS = [
    { id: 'recv', num: '1', asc: 'ASC 606', title: 'TOTAL CASH RECEIPTS FROM GUESTS AND CHANNELS', sign: '+', color: '#2d7252' },
    { id: 'income', num: '2', asc: 'ASC 606', title: 'INCOME', sign: '+', color: '#2d7252' },
    { id: 'cogs', num: '3', asc: 'ASC 330', title: 'COST OF REVENUE — COGS', sign: '-', color: '#b83030' },
    { id: 'sga', num: '4', asc: 'ASC 720', title: 'OPERATING EXPENSES — SG&A', sign: '-', color: '#b83030' },
    { id: 'other', num: '5', asc: 'ASC 225', title: 'OTHER INCOME / EXPENSE', sign: '+/-', color: '#22558c' },
    { id: 'cash', num: '6', asc: 'ASC 230', title: 'CASH FLOW SUMMARY', sign: '+/-', color: '#22558c' },
    { id: 'tax', num: '7', asc: 'FL Tax', title: 'TAX LIABILITIES — FLORIDA', sign: '-', color: '#b83030' },
    { id: 'dp', num: '8', asc: 'Details', title: 'DAMAGE PROTECTION — DETAILS', sign: '+/-', color: '#6b5c48' }
  ];

  var SECTION_MAP = [
    { re: /TOTAL CASH RECEIPT/i, id: 'recv' },
    { re: /^Income$/i, id: 'income' },
    { re: /COGS|Cost of Revenue/i, id: 'cogs' },
    { re: /SG&A|Operating Expenses/i, id: 'sga' },
    { re: /OTHER INCOME|OTHER EXPENSE|ASC 225/i, id: 'other' },
    { re: /Cash Flow Statement|CASH FLOW SUMMARY/i, id: 'cash' },
    { re: /Damage Protection.*Detail/i, id: 'dp' },
    { re: /Details Expenses|TAX LIABILITIES|FLORIDA/i, id: 'tax' }
  ];

  var state = {
    period: 'Dec /25',
    savedAt: null,
    sections: {}
  };

  var nextRowId = 1;
  var editing = null;
  var pendingNew = null;

  function ensureSections() {
    SECTIONS.forEach(function (s) {
      if (!state.sections[s.id]) state.sections[s.id] = { rows: [] };
    });
  }

  function fmtMoney(v) {
    var n = Number(v);
    if (!isFinite(n)) n = 0;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
  }

  function parseMoney(s) {
    if (s == null || s === '') return 0;
    var t = String(s).replace(/\$/g, '').replace(/,/g, '').replace(/\s/g, '').trim();
    var x = parseFloat(t);
    return isFinite(x) ? x : 0;
  }

  function sectionTotal(secId) {
    var sec = state.sections[secId];
    if (!sec || !sec.rows) return 0;
    var t = 0;
    sec.rows.forEach(function (r) {
      var a = Math.abs(parseFloat(r.amt) || 0);
      if (r.sign === '-') t -= a;
      else t += a;
    });
    return t;
  }

  function calcKpis() {
    var recv = sectionTotal('recv');
    var income = sectionTotal('income');
    var cogs = sectionTotal('cogs');
    var sga = sectionTotal('sga');
    var other = sectionTotal('other');
    var cash = sectionTotal('cash');
    var totalRecv = recv + income;
    var gross = totalRecv + cogs;
    var opinc = gross + sga + other;
    var net = opinc;
    var fcf = cash !== 0 ? cash : 0;
    var grossPct = totalRecv !== 0 ? (gross / totalRecv) * 100 : 0;
    var opPct = totalRecv !== 0 ? (opinc / totalRecv) * 100 : 0;
    var netPct = totalRecv !== 0 ? (net / totalRecv) * 100 : 0;
    return {
      recv: recv,
      income: income,
      totalRecv: totalRecv,
      gross: gross,
      opinc: opinc,
      net: net,
      fcf: fcf,
      grossPct: grossPct,
      opPct: opPct,
      netPct: netPct
    };
  }

  function renderKpis() {
    var k = calcKpis();
    var ph = document.getElementById('gaap-period-header');
    if (ph) ph.textContent = 'Manager Prop · Period: ' + (state.period || '—');

    function set(id, val, sub) {
      var el = document.getElementById(id);
      if (el) el.textContent = val;
      var s = document.getElementById(id + '-sub');
      if (s && sub != null) s.textContent = sub;
    }

    set('kpi-total-rev', fmtMoney(k.totalRecv), 'ASC 606');
    set('kpi-income', fmtMoney(k.income), 'Operating revenue');
    set('kpi-gross', fmtMoney(k.gross), 'Margin ' + k.grossPct.toFixed(1) + '% · ASC 330');
    set('kpi-op', fmtMoney(k.opinc), 'Margin ' + k.opPct.toFixed(1) + '% · ASC 720/225');
    set('kpi-net', fmtMoney(k.net), 'Margin ' + k.netPct.toFixed(1) + '%');
    set('kpi-fcf', fmtMoney(k.fcf), 'ASC 230');
  }

  function buildTbody(sec, rows) {
    var html = '';
    var st = sectionTotal(sec.id);
    rows.forEach(function (r) {
      var isEdit = editing && editing.secId === sec.id && editing.rowId === r.id;
      if (isEdit) {
        html +=
          '<tr class="gaap-row-edit" data-row-id="' +
          r.id +
          '"><td><input type="text" class="form-control form-control-sm gaap-inp-desc" value="' +
          esc(r.desc) +
          '" /></td><td><select class="form-select form-select-sm gaap-inp-sign"><option value="+"' +
          (r.sign !== '-' ? ' selected' : '') +
          '>+</option><option value="-"' +
          (r.sign === '-' ? ' selected' : '') +
          '>-</option></select></td><td class="gaap-td-amt"><input type="text" class="form-control form-control-sm gaap-inp-amt" value="' +
          esc(String(r.amt)) +
          '" /></td><td><div class="gaap-actions"><button type="button" class="btn btn-sm btn-success" onclick="window.gConfirmEdit(\'' +
          sec.id +
          "', " +
          r.id +
          ')">Save</button> <button type="button" class="btn btn-sm btn-outline-secondary" onclick="window.gCancelEdit(\'' +
          sec.id +
          "', " +
          r.id +
          ')">Cancel</button></div></td></tr>';
      } else {
        html +=
          '<tr data-row-id="' +
          r.id +
          '"><td>' +
          esc(r.desc) +
          '</td><td>' +
          esc(r.sign) +
          '</td><td class="gaap-td-amt">' +
          fmtMoney(r.amt) +
          '</td><td><div class="gaap-actions">' +
          '<button type="button" class="gaap-btn-ok ' +
          (r.ok ? '' : 'is-off') +
          '" onclick="window.gToggleOk(\'' +
          sec.id +
          "', " +
          r.id +
          ', this)" title="OK"><i class="fa-solid fa-check"></i></button> ' +
          '<button type="button" class="btn btn-sm btn-outline-primary py-0" onclick="window.gEditRow(\'' +
          sec.id +
          "', " +
          r.id +
          ')">Edit</button> ' +
          '<button type="button" class="btn btn-sm btn-outline-danger py-0" onclick="window.gDelRow(\'' +
          sec.id +
          "', " +
          r.id +
          ')">Del</button> ' +
          '<button type="button" class="btn btn-sm btn-outline-secondary py-0" onclick="window.gAddRowBelow(\'' +
          sec.id +
          "', " +
          r.id +
          ')">+</button></div></td></tr>';
      }
    });

    if (pendingNew && pendingNew.secId === sec.id) {
      html +=
        '<tr class="gaap-row-new" id="gaap-new-row"><td><input type="text" id="gaap-new-desc" class="form-control form-control-sm" placeholder="Description" /></td><td><select id="gaap-new-sign" class="form-select form-select-sm"><option value="+">+</option><option value="-">-</option></select></td><td class="gaap-td-amt"><input type="text" id="gaap-new-amt" class="form-control form-control-sm" placeholder="0.00" /></td><td><button type="button" class="btn btn-sm btn-success" onclick="window.gConfirmNew(\'' +
        sec.id +
        "', " +
        pendingNew.newId +
        ')">Add</button> <button type="button" class="btn btn-sm btn-outline-secondary" onclick="window.gCancelNew(\'' +
        sec.id +
        "', " +
        pendingNew.newId +
        ')">Cancel</button></td></tr>';
    }

    html +=
      '<tr class="gaap-subtotal-row"><td colspan="2">Subtotal · ' +
      esc(sec.asc) +
      '</td><td class="gaap-td-amt">' +
      fmtMoney(st) +
      '</td><td><button type="button" class="btn btn-sm btn-outline-primary" onclick="window.gAddRowBottom(\'' +
      sec.id +
      '\')">Add line</button></td></tr>';
    return html;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  function renderSection(sec) {
    var meta = SECTIONS.filter(function (x) {
      return x.id === sec.id;
    })[0];
    if (!meta) return;
    var rows = state.sections[sec.id].rows.slice();
    var wrap = document.getElementById('gaap-sec-' + sec.id);
    if (!wrap) return;
    var head = wrap.querySelector('.gaap-sec-head');
    var body = wrap.querySelector('.gaap-sec-body');
    var totalEl = wrap.querySelector('.gaap-sec-total');
    if (totalEl) totalEl.textContent = fmtMoney(sectionTotal(sec.id));
    var tb = body.querySelector('tbody');
    if (tb) tb.innerHTML = buildTbody(meta, rows);
  }

  function renderAll() {
    ensureSections();
    renderKpis();
    SECTIONS.forEach(function (s) {
      renderSection({ id: s.id });
    });
  }

  function saveState() {
    state.savedAt = new Date().toISOString();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      toast('Could not save: ' + e.message, false);
    }
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        ensureSections();
        return;
      }
      var o = JSON.parse(raw);
      if (o && o.sections) {
        state = o;
        ensureSections();
        state.sections &&
          Object.keys(state.sections).forEach(function (sid) {
            state.sections[sid].rows.forEach(function (r) {
              if (r.id >= nextRowId) nextRowId = r.id + 1;
            });
          });
      }
    } catch (e) {
      ensureSections();
    }
  }

  function toast(msg, ok) {
    var el = document.getElementById('gaap-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'gaap-toast';
      el.className = 'gaap-toast';
      document.body.appendChild(el);
    }
    el.className = 'gaap-toast ' + (ok ? 'ok' : 'err');
    el.textContent = msg;
    el.style.display = 'block';
    clearTimeout(el._t);
    el._t = setTimeout(function () {
      el.style.display = 'none';
    }, 3200);
  }

  function gToggle(secId) {
    var wrap = document.getElementById('gaap-sec-' + secId);
    if (!wrap) return;
    var head = wrap.querySelector('.gaap-sec-head');
    var body = wrap.querySelector('.gaap-sec-body');
    head.classList.toggle('is-collapsed');
    body.style.display = head.classList.contains('is-collapsed') ? 'none' : '';
  }

  function gToggleOk(secId, rowId, btn) {
    var rows = state.sections[secId].rows;
    var r = rows.filter(function (x) {
      return x.id === rowId;
    })[0];
    if (!r) return;
    if (r.ok === undefined) r.ok = true;
    r.ok = !r.ok;
    btn.classList.toggle('is-off', !r.ok);
    saveState();
  }

  function gDelRow(secId, rowId) {
    state.sections[secId].rows = state.sections[secId].rows.filter(function (x) {
      return x.id !== rowId;
    });
    saveState();
    renderAll();
  }

  function gEditRow(secId, rowId) {
    editing = { secId: secId, rowId: rowId };
    pendingNew = null;
    renderAll();
  }

  function gConfirmEdit(secId, rowId) {
    var tr = document.querySelector('#gaap-sec-' + secId + ' tr.gaap-row-edit');
    if (!tr) return;
    var d = tr.querySelector('.gaap-inp-desc');
    var s = tr.querySelector('.gaap-inp-sign');
    var a = tr.querySelector('.gaap-inp-amt');
    var r = state.sections[secId].rows.filter(function (x) {
      return x.id === rowId;
    })[0];
    if (!r) return;
    r.desc = (d && d.value) || '';
    r.sign = (s && s.value) || '+';
    r.amt = parseMoney(a && a.value);
    editing = null;
    saveState();
    renderAll();
  }

  function gCancelEdit(secId, rowId) {
    editing = null;
    renderAll();
  }

  function gAddRowBelow(secId, afterId) {
    pendingNew = { secId: secId, newId: nextRowId++, afterId: afterId };
    editing = null;
    renderAll();
  }

  function gAddRowBottom(secId) {
    pendingNew = { secId: secId, newId: nextRowId++, afterId: null };
    editing = null;
    renderAll();
  }

  function gConfirmNew(secId, newId) {
    var afterId = pendingNew && pendingNew.afterId != null ? pendingNew.afterId : null;
    var d = document.getElementById('gaap-new-desc');
    var s = document.getElementById('gaap-new-sign');
    var a = document.getElementById('gaap-new-amt');
    var desc = (d && d.value.trim()) || 'Line';
    var sign = (s && s.value) || '+';
    var amt = parseMoney(a && a.value);
    var row = { id: newId, desc: desc, sign: sign, amt: amt, ok: true };
    var rows = state.sections[secId].rows;
    if (afterId == null) {
      rows.push(row);
    } else {
      var ix = -1;
      rows.forEach(function (r, i) {
        if (r.id === afterId) ix = i;
      });
      if (ix >= 0) rows.splice(ix + 1, 0, row);
      else rows.push(row);
    }
    pendingNew = null;
    saveState();
    renderAll();
    toast('Row added', true);
  }

  function gCancelNew(secId, newId) {
    pendingNew = null;
    renderAll();
  }

  function updateSectionTotal(secId) {
    renderSection({ id: secId });
    renderKpis();
  }

  function expandAll(open) {
    SECTIONS.forEach(function (s) {
      var wrap = document.getElementById('gaap-sec-' + s.id);
      if (!wrap) return;
      var head = wrap.querySelector('.gaap-sec-head');
      var body = wrap.querySelector('.gaap-sec-body');
      if (open) {
        head.classList.remove('is-collapsed');
        body.style.display = '';
      } else {
        head.classList.add('is-collapsed');
        body.style.display = 'none';
      }
    });
  }

  function exportCsv() {
    ensureSections();
    var lines = ['\uFEFFSection,Description,Sign,Amount,OK'];
    SECTIONS.forEach(function (s) {
      (state.sections[s.id].rows || []).forEach(function (r) {
        lines.push([s.id, '"' + String(r.desc).replace(/"/g, '""') + '"', r.sign, r.amt, r.ok ? 'Y' : 'N'].join(','));
      });
    });
    var blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'gaap-export-' + (state.period || 'period').replace(/\s/g, '_') + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
    toast('CSV exported', true);
  }

  function processCSV(text, fileName) {
    var period = state.period;
    var m = (fileName && fileName.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[_\s-]?(\d{2,4})/i)) || null;
    if (m) period = m[0].replace(/_/g, ' ');
    var lines = text.split(/\r?\n/);
    var cur = 'recv';
    var n = 0;
    ensureSections();
    Object.keys(state.sections).forEach(function (k) {
      state.sections[k].rows = [];
    });

    lines.forEach(function (line) {
      var raw = line.trim();
      if (!raw || /^total|subtotal|header|^--/i.test(raw)) return;
      if (/period ended/i.test(raw)) {
        var pm = raw.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
        if (pm) period = pm[1];
        return;
      }
      for (var i = 0; i < SECTION_MAP.length; i++) {
        if (SECTION_MAP[i].re.test(raw)) {
          cur = SECTION_MAP[i].id;
          return;
        }
      }
      var parts = raw.split(/[,;\t]/).map(function (p) {
        return p.trim();
      });
      if (parts.length < 2) return;
      var label = parts[0];
      var valStr = parts[parts.length - 1];
      if (!/\d/.test(valStr)) return;
      var amt = parseMoney(valStr);
      if (!isFinite(amt) || amt === 0) return;
      var sign = amt < 0 ? '-' : '+';
      if (parts.length >= 3 && (parts[1] === '+' || parts[1] === '-')) sign = parts[1];
      state.sections[cur].rows.push({
        id: nextRowId++,
        desc: label,
        sign: sign,
        amt: Math.abs(amt),
        ok: true
      });
      n++;
    });
    state.period = period;
    saveState();
    renderAll();
    toast('Imported ' + n + ' rows · ' + period, true);
  }

  function onFile(ev) {
    var f = ev.target.files && ev.target.files[0];
    var btn = document.getElementById('gaap-btn-process');
    if (btn) btn.disabled = !f;
  }

  function gaapReprocess() {
    var inp = document.getElementById('gaap-csv-input');
    if (!inp || !inp.files || !inp.files[0]) {
      toast('Selecione um ficheiro CSV.', false);
      return;
    }
    var f = inp.files[0];
    var r = new FileReader();
    r.onload = function () {
      processCSV(String(r.result || ''), f.name);
    };
    r.readAsText(f, 'UTF-8');
  }

  function resetAll() {
    if (!confirm('Clear all GAAP data in this browser?')) return;
    localStorage.removeItem(STORAGE_KEY);
    state = { period: 'Dec /25', savedAt: null, sections: {} };
    nextRowId = 1;
    ensureSections();
    renderAll();
    toast('Reset complete', true);
  }

  window.fmtMoney = fmtMoney;
  window.parseMoney = parseMoney;
  window.sectionTotal = sectionTotal;
  window.calcKpis = calcKpis;
  window.renderKpis = renderKpis;
  window.renderAll = renderAll;
  window.renderSection = renderSection;
  window.buildTbody = buildTbody;
  window.gToggle = gToggle;
  window.gToggleOk = gToggleOk;
  window.gDelRow = gDelRow;
  window.gEditRow = gEditRow;
  window.gConfirmEdit = gConfirmEdit;
  window.gCancelEdit = gCancelEdit;
  window.gAddRowBelow = gAddRowBelow;
  window.gAddRowBottom = gAddRowBottom;
  window.insertNewRowInput = function () {};
  window.gConfirmNew = gConfirmNew;
  window.gCancelNew = gCancelNew;
  window.updateSectionTotal = updateSectionTotal;
  window.saveState = saveState;
  window.loadState = loadState;
  window.processCSV = processCSV;
  window.gaapToast = toast;
  window.toast = toast;
  window.gaapExpandAll = function () {
    expandAll(true);
  };
  window.gaapCollapseAll = function () {
    expandAll(false);
  };
  window.gaapExportCsv = exportCsv;
  window.gaapReset = resetAll;
  window.gaapOnFile = onFile;
  window.gaapReprocess = gaapReprocess;

  document.addEventListener('DOMContentLoaded', function () {
    loadState();
    ensureSections();
    var host = document.getElementById('gaap-sections-host');
    if (host) {
      host.innerHTML = SECTIONS.map(function (s) {
        return (
          '<div class="gaap-section" id="gaap-sec-' +
          s.id +
          '">' +
          '<div class="gaap-sec-head" onclick="window.gToggle(\'' +
          s.id +
          '\')"><span class="gaap-chev">▶</span> <span class="gaap-sec-num">' +
          s.num +
          '</span> <span class="gaap-sec-title">' +
          esc(s.title) +
          '</span> <span class="gaap-asc-badge">' +
          esc(s.asc) +
          '</span> <span class="gaap-sec-total">' +
          fmtMoney(sectionTotal(s.id)) +
          '</span></div>' +
          '<div class="gaap-sec-body"><div class="gaap-table-wrap"><table class="gaap-table"><thead><tr><th style="width:45%">Description</th><th style="width:8%">Sign</th><th style="width:20%">Amount</th><th style="width:27%">Actions</th></tr></thead><tbody></tbody></table></div></div></div>'
        );
      }).join('');
    }
    renderAll();
    var inp = document.getElementById('gaap-csv-input');
    if (inp) inp.addEventListener('change', onFile);
    var proc = document.getElementById('gaap-btn-process');
    if (proc) proc.addEventListener('click', gaapReprocess);
  });
})();
