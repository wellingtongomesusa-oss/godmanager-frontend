/**
 * 1099 / IRS Dashboard — Manager Prop
 * 8 chaves localStorage (prefixo mp_):
 *   mp_1099_bills_by_month_v1, mp_1099_tax_id_records_v1, mp_1099_owners_v1,
 *   mp_1099_hospitality_v1, mp_1099_settings_v1, mp_1099_ui_state_v1,
 *   mp_1099_aggregated_v1, mp_1099_import_meta_v1
 */
(function () {
  'use strict';

  var LS = {
    BILLS_BY_MONTH: 'mp_1099_bills_by_month_v1',
    TAX_ID: 'mp_1099_tax_id_records_v1',
    OWNERS: 'mp_1099_owners_v1',
    HOSPITALITY: 'mp_1099_hospitality_v1',
    SETTINGS: 'mp_1099_settings_v1',
    UI: 'mp_1099_ui_state_v1',
    AGG_1099: 'mp_1099_aggregated_v1',
    META: 'mp_1099_import_meta_v1'
  };

  var COA_1099 = [
    'Advertising & Marketing',
    'Bank Charges & Fees',
    'Business Licenses & Permits',
    'Business Meals',
    'Contract Labor',
    'Dues & Subscriptions',
    'Insurance',
    'Legal & Professional Services',
    'Office Supplies & Software',
    'Rent or Lease',
    'Repairs & Maintenance',
    'Taxes & Licenses',
    'Travel',
    'Utilities',
    'Vehicle Expenses',
    'Other Expenses'
  ];

  var COA_HOSPITALITY = [
    'Cleaning',
    'Cleaning & Laundry',
    'Cleaning Supplies',
    'Guest Supplies',
    'Hospitality Supplies',
    'Laundry',
    'Linen',
    'Linen & Laundry',
    'Linen Service',
    'Maintenance',
    'Maintenance & Repairs',
    'Maintenance Supplies',
    'Pool & Spa',
    'Pool Maintenance',
    'Repairs',
    'Supplies',
    'Toiletries',
    'Welcome Gifts'
  ];

  var state = {
    billsByMonth: {},
    taxIdRecords: [],
    owners: [],
    hospitality: [],
    settings: { threshold: 600, year: new Date().getFullYear() },
    ui: { lastTab: '1099' },
    agg1099: null,
    meta: { lastBillsImport: null, lastTaxIdImport: null }
  };

  var chart1099 = null;

  function loadAll() {
    try {
      state.billsByMonth = JSON.parse(localStorage.getItem(LS.BILLS_BY_MONTH) || '{}');
    } catch (e) { state.billsByMonth = {}; }
    try {
      state.taxIdRecords = JSON.parse(localStorage.getItem(LS.TAX_ID) || '[]');
    } catch (e) { state.taxIdRecords = []; }
    try {
      state.owners = JSON.parse(localStorage.getItem(LS.OWNERS) || '[]');
    } catch (e) { state.owners = []; }
    try {
      state.hospitality = JSON.parse(localStorage.getItem(LS.HOSPITALITY) || '[]');
    } catch (e) { state.hospitality = []; }
    try {
      var s = JSON.parse(localStorage.getItem(LS.SETTINGS) || '{}');
      if (s.threshold != null) state.settings.threshold = Number(s.threshold);
      if (s.year != null) state.settings.year = Number(s.year);
    } catch (e) {}
    try {
      var u = JSON.parse(localStorage.getItem(LS.UI) || '{}');
      if (u.lastTab) state.ui.lastTab = u.lastTab;
    } catch (e) {}
    try {
      state.agg1099 = JSON.parse(localStorage.getItem(LS.AGG_1099) || 'null');
    } catch (e) { state.agg1099 = null; }
    try {
      state.meta = JSON.parse(localStorage.getItem(LS.META) || '{}') || {};
    } catch (e) { state.meta = {}; }
  }

  function save(key, val) {
    localStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val));
  }

  function parseCsv(text) {
    var rows = [];
    var i = 0;
    var field = '';
    var row = [];
    var inQ = false;
    while (i < text.length) {
      var c = text[i];
      if (inQ) {
        if (c === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i += 2;
            continue;
          }
          inQ = false;
          i++;
          continue;
        }
        field += c;
        i++;
        continue;
      }
      if (c === '"') {
        inQ = true;
        i++;
        continue;
      }
      if (c === ',') {
        row.push(field);
        field = '';
        i++;
        continue;
      }
      if (c === '\r') {
        i++;
        continue;
      }
      if (c === '\n') {
        row.push(field);
        field = '';
        if (row.some(function (x) { return String(x).trim() !== ''; })) rows.push(row);
        row = [];
        i++;
        continue;
      }
      field += c;
      i++;
    }
    row.push(field);
    if (row.some(function (x) { return String(x).trim() !== ''; })) rows.push(row);
    return rows;
  }

  function norm(s) {
    return String(s || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function parseMoney(s) {
    if (s == null || s === '') return 0;
    var t = norm(String(s)).replace(/[$€£]/g, '').replace(/,/g, '');
    var n = parseFloat(t);
    return isNaN(n) ? 0 : n;
  }

  function headerIndex(headers, candidates) {
    var lower = headers.map(function (h) { return norm(h).toLowerCase(); });
    for (var c = 0; c < candidates.length; c++) {
      var want = candidates[c].toLowerCase();
      for (var i = 0; i < lower.length; i++) {
        if (lower[i] === want) return i;
      }
    }
    for (var c2 = 0; c2 < candidates.length; c2++) {
      var w = candidates[c2].toLowerCase();
      for (var j = 0; j < lower.length; j++) {
        if (lower[j].indexOf(w) !== -1) return j;
      }
    }
    return -1;
  }

  function rowsToObjects(rows) {
    if (!rows.length) return [];
    var headers = rows[0].map(function (h) { return norm(h); });
    var out = [];
    for (var r = 1; r < rows.length; r++) {
      var line = rows[r];
      if (!line || !line.length) continue;
      var o = {};
      for (var c = 0; c < headers.length; c++) {
        o[headers[c]] = line[c] != null ? line[c] : '';
      }
      out.push(o);
    }
    return out;
  }

  function is1099Row(obj) {
    var cat = norm(obj['Category'] || obj['category'] || '');
    return COA_1099.indexOf(cat) !== -1;
  }

  function isHospitalityRow(obj) {
    var cat = norm(obj['Category'] || obj['category'] || '');
    return COA_HOSPITALITY.indexOf(cat) !== -1;
  }

  function vendorKey(obj) {
    return norm(obj['Vendor'] || obj['vendor'] || obj['Payee'] || '');
  }

  function aggregate1099FromObjects(objs) {
    var map = {};
    for (var i = 0; i < objs.length; i++) {
      var o = objs[i];
      if (!is1099Row(o)) continue;
      var vk = vendorKey(o);
      if (!vk) continue;
      var amt = parseMoney(o['Amount'] || o['amount'] || o['Total'] || 0);
      if (!map[vk]) map[vk] = { vendor: vk, total: 0, count: 0 };
      map[vk].total += amt;
      map[vk].count += 1;
    }
    var list = Object.keys(map).map(function (k) { return map[k]; });
    list.sort(function (a, b) { return b.total - a.total; });
    return { vendors: list, generatedAt: new Date().toISOString() };
  }

  function allBillObjects() {
    var months = Object.keys(state.billsByMonth).sort();
    var all = [];
    for (var m = 0; m < months.length; m++) {
      var pack = state.billsByMonth[months[m]];
      if (pack && pack.rows) all = all.concat(pack.rows);
    }
    return all;
  }

  function computeKpis() {
    var objs = allBillObjects();
    var agg = aggregate1099FromObjects(objs);
    state.agg1099 = agg;
    save(LS.AGG_1099, agg);

    var th = state.settings.threshold || 600;
    var over = 0;
    var sem = 0;
    for (var i = 0; i < agg.vendors.length; i++) {
      var v = agg.vendors[i];
      if (v.total >= th) over++;
      else sem++;
    }

    var taxMap = {};
    for (var t = 0; t < state.taxIdRecords.length; t++) {
      var tr = state.taxIdRecords[t];
      var name = norm(tr.name || tr.Name || '');
      if (name) taxMap[name.toLowerCase()] = tr;
    }

    var taxRisk = 0;
    var taxOk = 0;
    for (var j = 0; j < agg.vendors.length; j++) {
      var vend = agg.vendors[j];
      if (vend.total < th) continue;
      var rec = taxMap[vend.vendor.toLowerCase()];
      var ein = rec && (rec.ein || rec.EIN || rec.taxId || '');
      if (ein && String(ein).replace(/\D/g, '').length >= 9) taxOk++;
      else taxRisk++;
    }

    return {
      vendorCount: agg.vendors.length,
      overThreshold: over,
      underThreshold: sem,
      taxRisk: taxRisk,
      taxOk: taxOk,
      threshold: th
    };
  }

  function renderKpis() {
    var k = computeKpis();
    var el = document.getElementById('k1099');
    if (!el) return;
    el.innerHTML =
      '<div class="ix-kpi"><div class="ix-kpi-label">Fornecedores (1099 COA)</div><div class="ix-kpi-val">' +
      k.vendorCount +
      '</div></div>' +
      '<div class="ix-kpi"><div class="ix-kpi-label">≥ $' +
      k.threshold +
      '</div><div class="ix-kpi-val">' +
      k.overThreshold +
      '</div></div>' +
      '<div class="ix-kpi"><div class="ix-kpi-label">&lt; $' +
      k.threshold +
      '</div><div class="ix-kpi-val">' +
      k.underThreshold +
      '</div></div>' +
      '<div class="ix-kpi"><div class="ix-kpi-label">Tax ID OK (≥ limite)</div><div class="ix-kpi-val">' +
      k.taxOk +
      '</div></div>' +
      '<div class="ix-kpi"><div class="ix-kpi-label">Risco Tax ID</div><div class="ix-kpi-val ix-kpi-tax-risk">' +
      k.taxRisk +
      '</div></div>';
  }

  function render1099Table() {
    var tbody = document.getElementById('tbody1099');
    if (!tbody) return;
    var agg = state.agg1099 && state.agg1099.vendors ? state.agg1099.vendors : [];
    var th = state.settings.threshold || 600;
    var taxMap = {};
    for (var t = 0; t < state.taxIdRecords.length; t++) {
      var tr = state.taxIdRecords[t];
      var name = norm(tr.name || tr.Name || '');
      if (name) taxMap[name.toLowerCase()] = tr;
    }
    tbody.innerHTML = '';
    for (var i = 0; i < agg.length; i++) {
      var v = agg[i];
      var rec = taxMap[v.vendor.toLowerCase()];
      var ein = rec ? norm(rec.ein || rec.EIN || rec.taxId || '') : '';
      var risk = v.total >= th && (!ein || ein.replace(/\D/g, '').length < 9);
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' +
        escapeHtml(v.vendor) +
        '</td><td class="te">' +
        v.total.toFixed(2) +
        '</td><td>' +
        v.count +
        '</td><td>' +
        (v.total >= th ? 'Sim' : 'Não') +
        '</td><td>' +
        escapeHtml(ein || '—') +
        '</td><td><span class="pill">' +
        (risk ? 'Risco' : 'OK') +
        '</span></td>';
      tbody.appendChild(tr);
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderChart1099() {
    var canvas = document.getElementById('chart1099');
    if (!canvas || typeof Chart === 'undefined') return;
    var agg = state.agg1099 && state.agg1099.vendors ? state.agg1099.vendors : [];
    var top = agg.slice(0, 8);
    var labels = top.map(function (x) { return x.vendor.length > 18 ? x.vendor.slice(0, 16) + '…' : x.vendor; });
    var data = top.map(function (x) { return x.total; });
    if (chart1099) chart1099.destroy();
    chart1099 = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [
          {
            data: data,
            backgroundColor: ['#c47b28', '#22558c', '#2d7252', '#b83030', '#6b5c48', '#9e8e7c', '#1a3a5c', '#e2d9cc']
          }
        ]
      },
      options: {
        plugins: { legend: { position: 'bottom' } },
        maintainAspectRatio: true
      }
    });
  }

  function renderOwners() {
    var host = document.getElementById('ownersHost');
    if (!host) return;
    if (!state.owners.length) {
      host.innerHTML = '<p class="ix-muted">Importe owners (CSV) ou adicione manualmente na consola localStorage.</p>';
      return;
    }
    var h = '<table class="t"><thead><tr><th>Nome</th><th>Email</th><th>Unidade</th></tr></thead><tbody>';
    for (var i = 0; i < state.owners.length; i++) {
      var o = state.owners[i];
      h +=
        '<tr><td>' +
        escapeHtml(o.name || '') +
        '</td><td>' +
        escapeHtml(o.email || '') +
        '</td><td>' +
        escapeHtml(o.unit || '') +
        '</td></tr>';
    }
    h += '</tbody></table>';
    host.innerHTML = h;
  }

  function renderHospitality() {
    var bar = document.getElementById('hospMonthBar');
    var host = document.getElementById('hospTableHost');
    if (!bar || !host) return;
    var months = Object.keys(state.billsByMonth).sort();
    if (!months.length) {
      bar.innerHTML = '';
      host.innerHTML = '<p class="ix-muted">Importe Bills CSV por mês.</p>';
      return;
    }
    var cur = state.ui.hospMonth || months[months.length - 1];
    if (months.indexOf(cur) === -1) cur = months[months.length - 1];
    var pills = '';
    for (var i = 0; i < months.length; i++) {
      var mo = months[i];
      pills +=
        '<span class="chip' +
        (mo === cur ? ' on' : '') +
        '" data-mo="' +
        escapeHtml(mo) +
        '">' +
        escapeHtml(mo) +
        '</span>';
    }
    bar.innerHTML = pills;
    bar.querySelectorAll('.chip').forEach(function (el) {
      el.onclick = function () {
        state.ui.hospMonth = el.getAttribute('data-mo');
        renderHospitality();
      };
    });

    var pack = state.billsByMonth[cur];
    var rows = (pack && pack.rows) || [];
    var hosp = [];
    for (var r = 0; r < rows.length; r++) {
      if (isHospitalityRow(rows[r])) hosp.push(rows[r]);
    }
    var sum = 0;
    for (var h = 0; h < hosp.length; h++) {
      sum += parseMoney(hosp[h]['Amount'] || hosp[h]['amount'] || 0);
    }
    var html =
      '<p class="ix-muted">Mês <strong>' +
      escapeHtml(cur) +
      '</strong> — linhas hospitality: ' +
      hosp.length +
      ' — total: <strong>$' +
      sum.toFixed(2) +
      '</strong></p><div class="t-wrap"><table class="t"><thead><tr><th>Data</th><th>Vendor</th><th>Category</th><th class="te">Amount</th></tr></thead><tbody>';
    for (var j = 0; j < hosp.length; j++) {
      var row = hosp[j];
      html +=
        '<tr><td>' +
        escapeHtml(norm(row['Date'] || row['date'] || '')) +
        '</td><td>' +
        escapeHtml(vendorKey(row)) +
        '</td><td>' +
        escapeHtml(norm(row['Category'] || '')) +
        '</td><td class="te">' +
        parseMoney(row['Amount'] || row['amount']).toFixed(2) +
        '</td></tr>';
    }
    html += '</tbody></table></div>';
    host.innerHTML = html;
  }

  function renderTaxTable() {
    var tbody = document.getElementById('tbodyTax');
    if (!tbody) return;
    tbody.innerHTML = '';
    for (var i = 0; i < state.taxIdRecords.length; i++) {
      var r = state.taxIdRecords[i];
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' +
        escapeHtml(r.name || r.Name || '') +
        '</td><td>' +
        escapeHtml(r.ein || r.EIN || r.taxId || '') +
        '</td><td>' +
        escapeHtml(r.type || r.Type || '') +
        '</td><td>' +
        escapeHtml(r.risk || r.Risk || '') +
        '</td>';
      tbody.appendChild(tr);
    }
  }

  function renderBillsMonths() {
    var host = document.getElementById('billsMonthsHost');
    if (!host) return;
    var months = Object.keys(state.billsByMonth).sort();
    if (!months.length) {
      host.innerHTML = '<p class="ix-muted">Nenhum mês importado.</p>';
      return;
    }
    var h = '';
    for (var i = 0; i < months.length; i++) {
      var mo = months[i];
      var p = state.billsByMonth[mo];
      h +=
        '<div style="margin-bottom:12px;padding:12px;background:var(--ix-paper);border:1px solid var(--ix-border);border-radius:8px;"><strong>' +
        escapeHtml(mo) +
        '</strong> — ' +
        (p && p.rows ? p.rows.length : 0) +
        ' linhas';
      if (p && p.fileName) h += ' — ' + escapeHtml(p.fileName);
      h += '</div>';
    }
    host.innerHTML = h;
  }

  function ymFromFilename(name) {
    var m = String(name || '').match(/(20\d{2})[-_](\d{2})/);
    if (m) return m[1] + '-' + m[2];
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  function handleBillsFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var text = String(reader.result || '');
      var rows = parseCsv(text);
      var objs = rowsToObjects(rows);
      var monthKey = ymFromFilename(file.name);
      state.billsByMonth[monthKey] = {
        rows: objs,
        uploadedAt: new Date().toISOString(),
        fileName: file.name
      };
      save(LS.BILLS_BY_MONTH, state.billsByMonth);
      state.meta.lastBillsImport = { at: new Date().toISOString(), month: monthKey, file: file.name };
      save(LS.META, state.meta);
      refreshAll();
    };
    reader.readAsText(file);
  }

  function handleTaxXlsx(file) {
    if (typeof XLSX === 'undefined') {
      alert('SheetJS não carregou.');
      return;
    }
    var reader = new FileReader();
    reader.onload = function (e) {
      var data = new Uint8Array(e.target.result);
      var wb = XLSX.read(data, { type: 'array' });
      var sheet = wb.Sheets[wb.SheetNames[0]];
      var json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      var out = [];
      for (var i = 0; i < json.length; i++) {
        var row = json[i];
        var name = row.Name || row.name || row.Vendor || row.vendor || '';
        var ein = row.EIN || row.ein || row['Tax ID'] || row.TaxID || '';
        var type = row.Type || row.type || '';
        var risk = row.Risk || row.risk || '';
        if (norm(name)) out.push({ name: norm(name), ein: norm(ein), type: norm(type), risk: norm(risk) });
      }
      state.taxIdRecords = out;
      save(LS.TAX_ID, state.taxIdRecords);
      state.meta.lastTaxIdImport = { at: new Date().toISOString(), file: file.name, rows: out.length };
      save(LS.META, state.meta);
      refreshAll();
    };
    reader.readAsArrayBuffer(file);
  }

  function handleOwnersCsv(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var rows = parseCsv(String(reader.result || ''));
      var objs = rowsToObjects(rows);
      var list = [];
      for (var i = 0; i < objs.length; i++) {
        var o = objs[i];
        list.push({
          name: norm(o.Name || o.name || ''),
          email: norm(o.Email || o.email || ''),
          unit: norm(o.Unit || o.unit || '')
        });
      }
      state.owners = list.filter(function (x) { return x.name; });
      save(LS.OWNERS, state.owners);
      refreshAll();
    };
    reader.readAsText(file);
  }

  function postHeight() {
    var h = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'ix-1099-height', height: h }, '*');
      }
    } catch (e) {}
  }

  function switchTab(id) {
    state.ui.lastTab = id;
    save(LS.UI, state.ui);
    document.querySelectorAll('.ix-panel').forEach(function (p) {
      p.classList.toggle('on', p.id === 'tab-' + id);
    });
    document.querySelectorAll('.ix-tabs button').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-tab') === id);
    });
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ source: 'irs1099', type: 'tab', tab: id }, '*');
      try {
        window.parent.postMessage({ type: 'ix-tab-changed', tab: id }, '*');
      } catch (e2) {}
    }
    setTimeout(postHeight, 50);
  }

  function refreshAll() {
    computeKpis();
    renderKpis();
    render1099Table();
    renderChart1099();
    renderOwners();
    renderHospitality();
    renderTaxTable();
    renderBillsMonths();
    setTimeout(postHeight, 80);
  }

  function bindUi() {
    document.querySelectorAll('.ix-tabs button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        switchTab(btn.getAttribute('data-tab'));
      });
    });

    var inpThreshold = document.getElementById('inpThreshold');
    var inpYear = document.getElementById('inpYear');
    if (inpThreshold) {
      inpThreshold.value = state.settings.threshold;
      inpThreshold.addEventListener('change', function () {
        state.settings.threshold = Number(inpThreshold.value) || 600;
        save(LS.SETTINGS, state.settings);
        refreshAll();
      });
    }
    if (inpYear) {
      inpYear.value = state.settings.year;
      inpYear.addEventListener('change', function () {
        state.settings.year = Number(inpYear.value) || new Date().getFullYear();
        save(LS.SETTINGS, state.settings);
      });
    }

    var billsIn = document.getElementById('billsFile');
    if (billsIn) {
      billsIn.addEventListener('change', function () {
        var f = billsIn.files && billsIn.files[0];
        if (f) handleBillsFile(f);
        billsIn.value = '';
      });
    }
    var taxIn = document.getElementById('taxXlsxFile');
    if (taxIn) {
      taxIn.addEventListener('change', function () {
        var f = taxIn.files && taxIn.files[0];
        if (f) handleTaxXlsx(f);
        taxIn.value = '';
      });
    }
    var ownIn = document.getElementById('ownersCsvFile');
    if (ownIn) {
      ownIn.addEventListener('change', function () {
        var f = ownIn.files && ownIn.files[0];
        if (f) handleOwnersCsv(f);
        ownIn.value = '';
      });
    }

    window.addEventListener('message', function (ev) {
      var d = ev.data;
      if (!d || d.source !== 'crm1099') return;
      if (d.type === 'setTab' && d.tab) switchTab(d.tab);
      if (d.type === 'print') window.print();
    });

    var btnPrint = document.getElementById('btnPrint1099');
    if (btnPrint) {
      btnPrint.addEventListener('click', function () {
        window.print();
      });
    }
  }

  function init() {
    if (window.self !== window.top) {
      document.body.classList.add('in-iframe');
    }
    loadAll();
    bindUi();
    window.switchTab = switchTab;
    switchTab(state.ui.lastTab || '1099');
    refreshAll();
    window.addEventListener('load', postHeight);
    window.addEventListener('resize', postHeight);
    setTimeout(postHeight, 400);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
