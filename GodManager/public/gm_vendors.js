/* GodManager Premium — Vendors registry UI (API: /api/appfolio/vendors/*) */
(function () {
  'use strict';

  var GM_VEN_STATES = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA',
    'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK',
    'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
  ];
  var GM_VEN_GL = [
    ['6073 - General Maintenance', '6073 - General Maintenance'],
    ['6074 - Landscaping', '6074 - Landscaping'],
    ['6075 - HOA', '6075 - HOA'],
    ['6076 - Cleaning', '6076 - Cleaning'],
    ['6112 - Tenant Placement', '6112 - Tenant Placement'],
    ['6141 - Painting', '6141 - Painting'],
    ['6142 - Plumbing', '6142 - Plumbing'],
    ['6144 - HVAC', '6144 - HVAC'],
    ['7010 - Appliances', '7010 - Appliances'],
    ['6103 - Other', '6103 - Other'],
  ];
  var GM_VEN_PAY = ['Check', 'eCheck', 'ACH', 'Wire Transfer', 'Zelle', 'Venmo'];

  window._gmVenPage = 1;
  window._gmVenTotalPages = 1;
  window._gmVenTrades = [];
  window._gmVenDocs = [];
  window._gmVenSearchT = null;

  function gmVenApi() {
    return (String(typeof GM_BACKEND_RAILWAY_APP !== 'undefined' ? GM_BACKEND_RAILWAY_APP : '').replace(/\/$/, '') + '/api/appfolio/vendors');
  }
  function gmVenT(k) {
    return typeof window.t === 'function' ? window.t(k) : k;
  }
  function gmVenEsc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  function gmVenFillStates() {
    var sel = document.getElementById('gm-ven-state');
    if (!sel || sel.options.length > 2) return;
    GM_VEN_STATES.forEach(function (st) {
      var o = document.createElement('option');
      o.value = st;
      o.textContent = st;
      sel.appendChild(o);
    });
  }

  function gmVenFillStaticSelects() {
    var gl = document.getElementById('gm-ven-gl');
    if (gl && !gl._gmDone) {
      GM_VEN_GL.forEach(function (x) {
        var o = document.createElement('option');
        o.value = x[0];
        o.textContent = x[1];
        gl.appendChild(o);
      });
      gl._gmDone = 1;
    }
    var pay = document.getElementById('gm-ven-pay');
    if (pay && !pay._gmDone) {
      GM_VEN_PAY.forEach(function (p) {
        var o = document.createElement('option');
        o.value = p;
        o.textContent = p;
        pay.appendChild(o);
      });
      pay._gmDone = 1;
    }
    gmVenFillStates();
  }

  window.gmVenSetPage = function (p) {
    window._gmVenPage = parseInt(p, 10) || 1;
    gmVenLoadPage();
  };

  window.gmVenSearchDebounced = function () {
    clearTimeout(window._gmVenSearchT);
    window._gmVenSearchT = setTimeout(function () {
      window.gmVenSetPage(1);
    }, 320);
  };

  function gmVenFetchTrades(cb) {
    fetch(gmVenApi() + '/trades', { method: 'GET', mode: 'cors', credentials: 'omit' })
      .then(function (r) {
        return r.json();
      })
      .then(function (d) {
        window._gmVenTrades = d.trades || [];
        var ft = document.getElementById('gm-ven-f-trade');
        if (ft) {
          var fv = ft.value;
          ft.innerHTML = '<option value="">' + gmVenEsc(gmVenT('vendors_status_all')) + '</option>';
          window._gmVenTrades.forEach(function (x) {
            var o = document.createElement('option');
            o.value = x;
            o.textContent = x;
            ft.appendChild(o);
          });
          if (fv) {
            try {
              ft.value = fv;
            } catch (e) {}
          }
        }
        gmVenFillTradeDropdowns();
        if (typeof cb === 'function') cb();
      })
      .catch(function () {
        window._gmVenTrades = [];
        if (typeof cb === 'function') cb();
      });
  }

  function gmVenFillTradeDropdowns() {
    ['gm-ven-trade', 'gm-ven-trade2'].forEach(function (id) {
      var sel = document.getElementById(id);
      if (!sel) return;
      var cur = sel.value;
      sel.innerHTML = '';
      window._gmVenTrades.forEach(function (x) {
        var o = document.createElement('option');
        o.value = x;
        o.textContent = x;
        sel.appendChild(o);
      });
      if (id === 'gm-ven-trade') {
        var o2 = document.createElement('option');
        o2.value = '__new__';
        o2.textContent = gmVenT('add_new_trade');
        sel.appendChild(o2);
      }
      if (cur && cur !== '__new__') {
        try {
          sel.value = cur;
        } catch (e2) {}
      }
    });
  }

  window.gmVenLoadPage = function () {
    gmVenFetchTrades(function () {
      var qs = new URLSearchParams();
      qs.set('page', String(window._gmVenPage || 1));
      qs.set('limit', '20');
      var tr = document.getElementById('gm-ven-f-trade');
      if (tr && tr.value) qs.set('trade', tr.value);
      var st = document.getElementById('gm-ven-f-status');
      if (st && st.value) qs.set('status', st.value);
      var sq = document.getElementById('gm-ven-search');
      if (sq && sq.value.trim()) qs.set('search', sq.value.trim());
      fetch(gmVenApi() + '/list?' + qs.toString(), { method: 'GET', mode: 'cors', credentials: 'omit' })
        .then(function (r) {
          return r.json();
        })
        .then(function (d) {
          var sm = d.summary || {};
          var tEl = document.getElementById('gm-ven-kpi-total');
          var aEl = document.getElementById('gm-ven-kpi-active');
          var pEl = document.getElementById('gm-ven-kpi-pending');
          var eEl = document.getElementById('gm-ven-kpi-expiring');
          if (tEl) tEl.textContent = String(sm.total != null ? sm.total : 0);
          if (aEl) aEl.textContent = String(sm.active != null ? sm.active : 0);
          if (pEl) pEl.textContent = String(sm.pending_review != null ? sm.pending_review : 0);
          if (eEl) eEl.textContent = String(sm.expiring_soon != null ? sm.expiring_soon : 0);
          window._gmVenTotalPages = Math.max(1, parseInt(d.total_pages, 10) || 1);
          var tb = document.getElementById('gm-ven-tbody');
          var em = document.getElementById('gm-ven-empty');
          if (!tb) return;
          tb.innerHTML = '';
          var rows = d.vendors || [];
          if (!rows.length) {
            if (em) em.style.display = 'block';
            return;
          }
          if (em) em.style.display = 'none';
          rows.forEach(function (v) {
            var tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--border)';
            var ct = ((v.contact_first_name || '') + ' ' + (v.contact_last_name || '')).trim() || '—';
            var done = parseInt(v.checklist_done, 10) || 0;
            var tot = parseInt(v.checklist_total, 10) || 11;
            var pct = tot ? Math.round((100 * done) / tot) : 0;
            var barColor = pct >= 100 ? 'var(--green)' : pct >= 50 ? 'var(--amber)' : 'var(--red)';
            var stat = String(v.status || '');
            var sb = stat === 'active' ? 'pg' : stat === 'pending_review' ? 'pa' : 'pb';
            var stl =
              stat === 'active'
                ? gmVenT('vendors_status_active')
                : stat === 'pending_review'
                  ? gmVenT('vendors_status_pending')
                  : gmVenT('vendors_status_inactive');
            tr.innerHTML =
              '<td style="padding:9px 12px;font-weight:600;color:var(--ink)">' +
              gmVenEsc(v.company_name || '') +
              '</td>' +
              '<td style="padding:9px 12px;font-size:11px">' +
              gmVenEsc(ct) +
              '</td>' +
              '<td style="padding:9px 12px;font-size:11px;color:var(--ink2)">' +
              gmVenEsc(v.trade || '') +
              '</td>' +
              '<td style="padding:9px 12px;font-size:11px;font-family:JetBrains Mono,monospace">' +
              gmVenEsc(v.phone || '') +
              '</td>' +
              '<td style="padding:9px 12px;font-size:11px">' +
              gmVenEsc(v.email || '') +
              '</td>' +
              '<td style="padding:9px 12px;text-align:center;font-size:11px">' +
              (v.send_1099 ? 'Y' : '—') +
              '</td>' +
              '<td style="padding:9px 12px"><div style="height:6px;background:var(--cream);border-radius:4px;overflow:hidden;border:1px solid var(--border)"><div style="height:100%;width:' +
              pct +
              '%;background:' +
              barColor +
              ';transition:width .3s"></div></div><div style="font-size:9px;color:var(--ink3);margin-top:2px;text-align:center">' +
              done +
              '/' +
              tot +
              '</div></td>' +
              '<td style="padding:9px 12px;text-align:center"><span class="' +
              sb +
              '" style="font-size:10px;padding:2px 8px;border-radius:12px">' +
              gmVenEsc(stl) +
              '</span></td>' +
              '<td style="padding:9px 12px;text-align:center;white-space:nowrap">' +
              '<button type="button" onclick="gmVenView(' +
              v.id +
              ')" style="padding:4px 8px;margin:0 2px;border:1px solid var(--border2);border-radius:6px;background:transparent;font-size:10px;cursor:pointer">' +
              gmVenEsc(gmVenT('vendors_action_view')) +
              '</button><button type="button" onclick="gmVenOpenModal(' +
              v.id +
              ')" style="padding:4px 8px;margin:0 2px;border:1px solid var(--border2);border-radius:6px;background:transparent;font-size:10px;cursor:pointer">' +
              gmVenEsc(gmVenT('vendors_action_edit')) +
              '</button><button type="button" onclick="gmVenDelete(' +
              v.id +
              ')" style="padding:4px 8px;margin:0 2px;border:1px solid var(--red-bd);border-radius:6px;background:var(--red-bg);color:var(--red);font-size:10px;cursor:pointer">' +
              gmVenEsc(gmVenT('vendors_action_delete')) +
              '</button></td>';
            tb.appendChild(tr);
          });
          var pr = document.getElementById('gm-ven-pager');
          if (pr)
            pr.innerHTML =
              '<span style="font-size:11px;color:var(--ink3)">' +
              window._gmVenPage +
              ' / ' +
              window._gmVenTotalPages +
              '</span><button type="button" onclick="gmVenSetPage(' +
              (window._gmVenPage - 1) +
              ')" style="padding:6px 12px;border:1px solid var(--border2);border-radius:6px;background:transparent;font-size:11px;cursor:pointer"' +
              (window._gmVenPage <= 1 ? ' disabled' : '') +
              '>' +
              gmVenEsc(gmVenT('tenants_prev')) +
              '</button><button type="button" onclick="gmVenSetPage(' +
              (window._gmVenPage + 1) +
              ')" style="padding:6px 12px;border:1px solid var(--border2);border-radius:6px;background:transparent;font-size:11px;cursor:pointer"' +
              (window._gmVenPage >= window._gmVenTotalPages ? ' disabled' : '') +
              '>' +
              gmVenEsc(gmVenT('tenants_next')) +
              '</button>';
        })
        .catch(function () {});
    });
  };

  window.gmVenOnTradeChange = function () {
    var sel = document.getElementById('gm-ven-trade');
    var w = document.getElementById('gm-ven-trade-new-wrap');
    if (sel && sel.value === '__new__' && w) w.style.display = 'block';
    else if (w) w.style.display = 'none';
  };

  window.gmVenAddTrade = function () {
    var inp = document.getElementById('gm-ven-trade-new');
    var name = inp ? inp.value.trim() : '';
    if (!name) return;
    fetch(gmVenApi() + '/trades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      mode: 'cors',
      credentials: 'omit',
      body: JSON.stringify({ name: name }),
    })
      .then(function (r) {
        return r.json();
      })
      .then(function () {
        gmVenFetchTrades(function () {
          var s = document.getElementById('gm-ven-trade');
          if (s) s.value = name;
          gmVenOnTradeChange();
          if (inp) inp.value = '';
          var w = document.getElementById('gm-ven-trade-new-wrap');
          if (w) w.style.display = 'none';
        });
      });
  };

  window.gmVenOpenModal = function (id) {
    gmVenFillStaticSelects();
    gmVenFetchTrades(function () {
      gmVenFinishOpenModal(id);
    });
  };

  function gmVenFinishOpenModal(id) {
    var bg = document.getElementById('gm-ven-modal-bg');
    if (!bg) return;
    document.getElementById('gm-ven-id').value = id ? String(id) : '';
    window._gmVenDocs = [];
    if (id) {
      document.getElementById('gm-ven-modal-title').textContent = gmVenT('vendors_action_edit');
      fetch(gmVenApi() + '/' + id, { method: 'GET', mode: 'cors', credentials: 'omit' })
        .then(function (r) {
          return r.json();
        })
        .then(function (v) {
          gmVenApplyVendorToForm(v);
          window._gmVenDocs = v.documents || [];
          gmVenRenderChecklist();
          bg.style.display = 'flex';
          bg.style.flexDirection = 'column';
          document.body.style.overflow = 'hidden';
          if (typeof applyTranslations === 'function') applyTranslations();
        });
    } else {
      document.getElementById('gm-ven-modal-title').textContent = gmVenT('vendors_new');
      gmVenClearForm();
      gmVenRenderChecklist();
      bg.style.display = 'flex';
      bg.style.flexDirection = 'column';
      document.body.style.overflow = 'hidden';
      if (typeof applyTranslations === 'function') applyTranslations();
    }
  }

  function gmVenClearForm() {
    [
      'gm-ven-company',
      'gm-ven-fn',
      'gm-ven-ln',
      'gm-ven-email',
      'gm-ven-phone',
      'gm-ven-phone2',
      'gm-ven-street',
      'gm-ven-city',
      'gm-ven-zip',
      'gm-ven-web',
      'gm-ven-ein',
      'gm-ven-bank',
      'gm-ven-rt',
      'gm-ven-ac',
      'gm-ven-wcp',
      'gm-ven-wce',
      'gm-ven-lip',
      'gm-ven-lie',
      'gm-ven-lia',
      'gm-ven-aue',
      'gm-ven-epa',
      'gm-ven-sln',
      'gm-ven-sle',
      'gm-ven-ce',
      'gm-ven-notes',
    ].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = '';
    });
    document.getElementById('gm-ven-1099').checked = false;
    document.getElementById('gm-ven-portal').checked = false;
    document.getElementById('gm-ven-na-auto').checked = false;
    document.getElementById('gm-ven-na-sl').checked = false;
    document.getElementById('gm-ven-state').value = '';
    var tr = document.getElementById('gm-ven-trade');
    if (tr) tr.selectedIndex = 0;
    var t2 = document.getElementById('gm-ven-trade2');
    if (t2) t2.selectedIndex = 0;
    document.getElementById('gm-ven-status').value = 'pending_review';
    document.getElementById('gm-ven-rating').value = '3';
    gmVenStarPaint(3);
    var gl = document.getElementById('gm-ven-gl');
    if (gl && GM_VEN_GL[0]) gl.value = GM_VEN_GL[0][0];
    var pay = document.getElementById('gm-ven-pay');
    if (pay) pay.value = GM_VEN_PAY[0];
    document.getElementById('gm-ven-at').value = 'Checking';
    window._gmVenDocs = [];
    gmVenOnTradeChange();
  }

  function gmVenApplyVendorToForm(v) {
    gmVenClearForm();
    function set(id, val) {
      var e = document.getElementById(id);
      if (e) e.value = val != null ? String(val) : '';
    }
    set('gm-ven-company', v.company_name);
    set('gm-ven-fn', v.contact_first_name);
    set('gm-ven-ln', v.contact_last_name);
    set('gm-ven-email', v.email);
    set('gm-ven-phone', v.phone);
    set('gm-ven-phone2', v.phone_secondary);
    set('gm-ven-street', v.address_street);
    set('gm-ven-city', v.address_city);
    set('gm-ven-state', v.address_state);
    set('gm-ven-zip', v.address_zip);
    set('gm-ven-web', v.website);
    set('gm-ven-ein', v.ein_tax_id);
    set('gm-ven-bank', v.bank_name);
    set('gm-ven-rt', v.routing_number);
    set('gm-ven-ac', v.account_number);
    set('gm-ven-wcp', v.workers_comp_policy);
    set('gm-ven-wce', v.workers_comp_expiration);
    set('gm-ven-lip', v.liability_insurance_policy);
    set('gm-ven-lie', v.liability_insurance_expiration);
    set('gm-ven-lia', v.liability_insurance_amount);
    set('gm-ven-aue', v.auto_insurance_expiration);
    set('gm-ven-epa', v.epa_certification_expiration);
    set('gm-ven-sln', v.state_license_number);
    set('gm-ven-sle', v.state_license_expiration);
    set('gm-ven-ce', v.contract_expiration);
    set('gm-ven-notes', v.notes);
    document.getElementById('gm-ven-1099').checked = !!v.send_1099;
    document.getElementById('gm-ven-portal').checked = !!v.vendor_portal_activated;
    document.getElementById('gm-ven-na-auto').checked = !!v.auto_insurance_na;
    document.getElementById('gm-ven-na-sl').checked = !!v.state_license_na;
    if (v.trade) {
      var t = document.getElementById('gm-ven-trade');
      if (t) t.value = v.trade;
    }
    if (v.trade_secondary) {
      var t2 = document.getElementById('gm-ven-trade2');
      if (t2) t2.value = v.trade_secondary;
    }
    if (v.default_gl_account) {
      var g = document.getElementById('gm-ven-gl');
      if (g) g.value = v.default_gl_account;
    }
    if (v.payment_type) {
      var p = document.getElementById('gm-ven-pay');
      if (p) p.value = v.payment_type;
    }
    if (v.account_type) {
      var a = document.getElementById('gm-ven-at');
      if (a) a.value = v.account_type;
    }
    if (v.status) {
      var s = document.getElementById('gm-ven-status');
      if (s) s.value = v.status;
    }
    var r = v.rating || 3;
    document.getElementById('gm-ven-rating').value = String(r);
    gmVenStarPaint(r);
    ['gm-ven-wce', 'gm-ven-lie', 'gm-ven-aue', 'gm-ven-epa', 'gm-ven-sle', 'gm-ven-ce'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) gmVenDateCls(el);
    });
    gmVenOnTradeChange();
  }

  function gmVenStarPaint(n) {
    var host = document.getElementById('gm-ven-stars');
    if (!host) return;
    host.innerHTML = '';
    for (var i = 1; i <= 5; i++) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('data-s', String(i));
      b.style.cssText =
        'border:none;background:transparent;cursor:pointer;font-size:18px;line-height:1;padding:0 3px;color:' +
        (i <= n ? 'var(--amber)' : 'var(--border2)');
      b.textContent = '\u2605';
      host.appendChild(b);
    }
  }

  window.gmVenStarClick = function (ev) {
    var t = ev.target;
    if (!t || t.getAttribute('data-s') == null) return;
    var n = parseInt(t.getAttribute('data-s'), 10) || 1;
    document.getElementById('gm-ven-rating').value = String(n);
    gmVenStarPaint(n);
  };

  window.gmVenDateCls = function (el) {
    if (!el || !el.value) {
      el.style.borderColor = 'var(--border2)';
      el.style.boxShadow = 'none';
      return;
    }
    var d = new Date(el.value + 'T12:00:00');
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var diff = Math.floor((d - today) / 86400000);
    if (diff < 0) {
      el.style.borderColor = 'var(--red)';
      el.style.boxShadow = '0 0 0 2px rgba(184,48,48,.15)';
    } else if (diff <= 60) {
      el.style.borderColor = 'var(--amber)';
      el.style.boxShadow = '0 0 0 2px rgba(201,169,110,.12)';
    } else {
      el.style.borderColor = 'var(--green)';
      el.style.boxShadow = '0 0 0 2px rgba(45,114,82,.12)';
    }
  };

  function gmVenCollectPayload() {
    var tradeSel = document.getElementById('gm-ven-trade');
    var tradeVal = tradeSel && tradeSel.value === '__new__' ? document.getElementById('gm-ven-trade-new').value.trim() : tradeSel ? tradeSel.value.trim() : '';
    return {
      company_name: document.getElementById('gm-ven-company').value.trim(),
      contact_first_name: document.getElementById('gm-ven-fn').value.trim(),
      contact_last_name: document.getElementById('gm-ven-ln').value.trim(),
      email: document.getElementById('gm-ven-email').value.trim(),
      phone: document.getElementById('gm-ven-phone').value.trim(),
      phone_secondary: document.getElementById('gm-ven-phone2').value.trim(),
      address_street: document.getElementById('gm-ven-street').value.trim(),
      address_city: document.getElementById('gm-ven-city').value.trim(),
      address_state: document.getElementById('gm-ven-state').value.trim(),
      address_zip: document.getElementById('gm-ven-zip').value.trim(),
      website: document.getElementById('gm-ven-web').value.trim(),
      notes: document.getElementById('gm-ven-notes').value.trim(),
      trade: tradeVal,
      trade_secondary: document.getElementById('gm-ven-trade2').value.trim(),
      ein_tax_id: document.getElementById('gm-ven-ein').value.trim(),
      payment_type: document.getElementById('gm-ven-pay').value,
      bank_name: document.getElementById('gm-ven-bank').value.trim(),
      routing_number: document.getElementById('gm-ven-rt').value.trim(),
      account_number: document.getElementById('gm-ven-ac').value.trim(),
      account_type: document.getElementById('gm-ven-at').value,
      send_1099: document.getElementById('gm-ven-1099').checked,
      default_gl_account: document.getElementById('gm-ven-gl').value,
      workers_comp_expiration: document.getElementById('gm-ven-wce').value,
      workers_comp_policy: document.getElementById('gm-ven-wcp').value.trim(),
      liability_insurance_expiration: document.getElementById('gm-ven-lie').value,
      liability_insurance_policy: document.getElementById('gm-ven-lip').value.trim(),
      liability_insurance_amount: parseFloat(document.getElementById('gm-ven-lia').value) || 0,
      auto_insurance_expiration: document.getElementById('gm-ven-aue').value,
      epa_certification_expiration: document.getElementById('gm-ven-epa').value,
      state_license_number: document.getElementById('gm-ven-sln').value.trim(),
      state_license_expiration: document.getElementById('gm-ven-sle').value,
      contract_expiration: document.getElementById('gm-ven-ce').value,
      status: document.getElementById('gm-ven-status').value,
      vendor_portal_activated: document.getElementById('gm-ven-portal').checked,
      rating: parseInt(document.getElementById('gm-ven-rating').value, 10) || 3,
      auto_insurance_na: document.getElementById('gm-ven-na-auto').checked,
      state_license_na: document.getElementById('gm-ven-na-sl').checked,
    };
  }

  function gmVenHasDocType(types, t) {
    return types.indexOf(t) >= 0;
  }

  window.gmVenRenderChecklist = function () {
    var comp = (document.getElementById('gm-ven-company').value || '').trim();
    var head = document.getElementById('gm-ven-checklist-head');
    if (head) head.textContent = gmVenT('payment_checklist') + ' — ' + comp;
    var types = [];
    (window._gmVenDocs || []).forEach(function (d) {
      if (d && d.type) types.push(String(d.type).toLowerCase());
    });
    var naAuto = document.getElementById('gm-ven-na-auto') && document.getElementById('gm-ven-na-auto').checked;
    var naSl = document.getElementById('gm-ven-na-sl') && document.getElementById('gm-ven-na-sl').checked;
    var checks = [
      { auto: true, ok: !!comp, title: 'vendors_ck_name_title', sub: 'vendors_ck_name_sub' },
      {
        auto: true,
        ok: !!(
          document.getElementById('gm-ven-street').value.trim() &&
          document.getElementById('gm-ven-city').value.trim() &&
          document.getElementById('gm-ven-state').value.trim() &&
          document.getElementById('gm-ven-zip').value.trim()
        ),
        title: 'vendors_ck_addr_title',
        sub: 'vendors_ck_addr_sub',
      },
      { auto: true, ok: !!document.getElementById('gm-ven-email').value.trim(), title: 'vendors_ck_email_title', sub: 'vendors_ck_email_sub' },
      { auto: true, ok: !!document.getElementById('gm-ven-phone').value.trim(), title: 'vendors_ck_phone_title', sub: 'vendors_ck_phone_sub' },
      { doc: 'w9', title: 'w9_form', sub: 'vendors_ck_w9_sub' },
      { doc: 'bank_info', title: 'bank_info', sub: 'vendors_ck_bank_sub' },
      { doc: 'workers_comp', title: 'workers_comp', sub: 'vendors_ck_wc_sub' },
      { doc: 'liability_insurance', title: 'liability_insurance', sub: 'vendors_ck_li_sub' },
      { doc: 'auto_insurance', title: 'auto_insurance', sub: 'vendors_ck_ai_sub', na: naAuto },
      { doc: 'state_license', title: 'state_license', sub: 'vendors_ck_sl_sub', na: naSl },
      { doc: 'contract', title: 'contract_signed', sub: 'vendors_ck_contract_sub' },
    ];
    var done = 0;
    var grid = document.getElementById('gm-ven-checklist-grid');
    if (!grid) return;
    grid.innerHTML = '';
    var vid = document.getElementById('gm-ven-id').value;
    checks.forEach(function (c) {
      var ok = false;
      if (c.auto) ok = c.ok;
      else if (c.na) ok = true;
      else ok = gmVenHasDocType(types, c.doc);
      if (ok) done++;
      var card = document.createElement('div');
      card.style.cssText =
        'background:var(--paper);border:1px solid var(--border);border-radius:10px;padding:12px 12px 12px 14px;border-left:3px solid ' +
        (ok ? '#2d7252' : '#b83030') +
        ';transition:box-shadow .25s ease';
      var svgX =
        '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="#b83030" stroke-width="1.5"/><path d="M8 8l8 8M16 8l-8 8" stroke="#b83030" stroke-width="1.8" stroke-linecap="round"/></svg>';
      var svgOK =
        '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="#2d7252" stroke-width="1.5"/><path d="M7 12l4 4 6-7" stroke="#2d7252" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      var docMeta = null;
      if (!c.auto && !c.na) {
        (window._gmVenDocs || []).forEach(function (d) {
          if (String(d.type).toLowerCase() === c.doc) docMeta = d;
        });
      }
      var upHtml = '';
      if (!c.auto && !c.na) {
        if (!ok) {
          if (!vid) upHtml = '<div style="font-size:10px;color:var(--ink3);margin-top:6px">' + gmVenEsc(gmVenT('vendors_save_first_docs')) + '</div>';
          else
            upHtml =
              '<input type="file" style="font-size:10px;margin-top:6px;max-width:100%" onchange="gmVenDocUpload(\'' +
              c.doc +
              "',this.files[0]);this.value=''\">";
        } else if (docMeta && vid) {
          upHtml =
            '<div style="font-size:10px;color:var(--ink2);margin-top:4px;word-break:break-all">' +
            gmVenEsc(docMeta.filename || '') +
            '</div><div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap"><button type="button" onclick="window.open(\'' +
            gmVenApi() +
            '/' +
            vid +
            '/documents/' +
            docMeta.id +
            '/file\')" style="padding:3px 8px;font-size:10px;border:1px solid var(--border2);border-radius:4px;background:transparent;cursor:pointer">' +
            gmVenT('view') +
            '</button><button type="button" onclick="gmVenDocRemove(' +
            docMeta.id +
            ')" style="padding:3px 8px;font-size:10px;border:1px solid var(--red-bd);border-radius:4px;background:var(--red-bg);color:var(--red);cursor:pointer">' +
            gmVenT('remove') +
            '</button></div>';
        }
      }
      var naHtml = c.na ? '<div style="font-size:10px;color:var(--ink3);margin-top:4px">' + gmVenEsc(gmVenT('not_applicable')) + '</div>' : '';
      var autoHint = c.auto && !ok ? '<div style="font-size:10px;color:var(--ink3);margin-top:6px">' + gmVenEsc(gmVenT('missing')) + '</div>' : '';
      card.innerHTML =
        '<div style="display:flex;gap:8px;align-items:flex-start"><div style="flex-shrink:0">' +
        (ok ? svgOK : svgX) +
        '</div><div style="min-width:0;flex:1"><div style="font-weight:700;font-size:12px;color:var(--ink)">' +
        gmVenEsc(gmVenT(c.title)) +
        '</div><div style="font-size:10px;color:var(--ink3);margin-top:2px;line-height:1.4">' +
        gmVenEsc(gmVenT(c.sub)) +
        '</div>' +
        naHtml +
        upHtml +
        autoHint +
        '</div></div><div style="font-size:9px;font-weight:700;margin-top:8px;color:' +
        (ok ? '#2d7252' : '#b83030') +
        '">' +
        (ok ? gmVenT('vendors_complete_label') : gmVenT('missing')) +
        '</div>';
      grid.appendChild(card);
    });
    var bar = document.getElementById('gm-ven-ck-bar');
    var lbl = document.getElementById('gm-ven-ck-lbl');
    var pct = Math.round((100 * done) / 11);
    if (bar) {
      bar.style.width = pct + '%';
      bar.style.background = pct >= 100 ? 'var(--green)' : pct >= 50 ? 'var(--amber)' : 'var(--red)';
    }
    if (lbl) lbl.textContent = String(done) + ' / 11 — ' + gmVenT('items_complete');
  };

  window.gmVenDocUpload = function (t, f) {
    var id = document.getElementById('gm-ven-id').value;
    if (!id || !f) return;
    var fd = new FormData();
    fd.append('file', f);
    fd.append('type', t);
    fetch(gmVenApi() + '/' + id + '/documents', { method: 'POST', mode: 'cors', credentials: 'omit', body: fd })
      .then(function (r) {
        return r.json();
      })
      .then(function (o) {
        if (o.document) {
          window._gmVenDocs = (window._gmVenDocs || []).filter(function (d) {
            return String(d.type).toLowerCase() !== t;
          });
          window._gmVenDocs.push(o.document);
          gmVenRenderChecklist();
        }
      });
  };

  window.gmVenDocRemove = function (docId) {
    var id = document.getElementById('gm-ven-id').value;
    if (!id) return;
    fetch(gmVenApi() + '/' + id + '/documents/' + docId, { method: 'DELETE', mode: 'cors', credentials: 'omit' })
      .then(function (r) {
        if (!r.ok) throw 0;
        return r.json();
      })
      .then(function () {
        window._gmVenDocs = (window._gmVenDocs || []).filter(function (d) {
          return Number(d.id) !== Number(docId);
        });
        gmVenRenderChecklist();
      })
      .catch(function () {});
  };

  window.gmVenSave = function () {
    var pl = gmVenCollectPayload();
    var id = document.getElementById('gm-ven-id').value;
    var url,
      method = id ? 'PUT' : 'POST';
    url = id ? gmVenApi() + '/' + id : gmVenApi() + '/register';
    fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      mode: 'cors',
      credentials: 'omit',
      body: JSON.stringify(pl),
    })
      .then(function (r) {
        return r.json().then(function (j) {
          return { ok: r.ok, j: j };
        });
      })
      .then(function (o) {
        if (!o.ok) {
          if (typeof showToast === 'function') showToast(gmVenT('error'), 'error');
          return;
        }
        var v = o.j.vendor || o.j;
        if (!id && v && v.id) {
          document.getElementById('gm-ven-id').value = String(v.id);
          window._gmVenDocs = v.documents || [];
          document.getElementById('gm-ven-modal-title').textContent = gmVenT('vendors_action_edit');
        } else if (o.j.vendor) {
          window._gmVenDocs = o.j.vendor.documents || [];
        }
        gmVenRenderChecklist();
        if (typeof showToast === 'function') showToast('OK', 'success');
        gmVenLoadPage();
      })
      .catch(function () {
        if (typeof showToast === 'function') showToast(gmVenT('error'), 'error');
      });
  };

  window.gmVenDelete = function (id) {
    if (!confirm(gmVenT('vendors_delete_confirm'))) return;
    fetch(gmVenApi() + '/' + id, { method: 'DELETE', mode: 'cors', credentials: 'omit' })
      .then(function (r) {
        if (!r.ok) throw 0;
        return r.json();
      })
      .then(function () {
        gmVenLoadPage();
        if (typeof showToast === 'function') showToast('OK', 'success');
      })
      .catch(function () {
        if (typeof showToast === 'function') showToast(gmVenT('error'), 'error');
      });
  };

  function gmVenExpiryLabel(iso) {
    if (!iso) return '<span style="color:var(--ink3)">—</span>';
    var d = new Date(iso + 'T12:00:00');
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var diff = Math.floor((d - today) / 86400000);
    if (diff < 0) return '<span style="color:var(--red);font-weight:600">' + gmVenEsc(gmVenT('expired')) + '</span>';
    if (diff <= 60) return '<span style="color:var(--amber);font-weight:600">' + gmVenEsc(gmVenT('expiring_soon')) + '</span>';
    return '<span style="color:var(--green);font-weight:600">' + gmVenEsc(gmVenT('valid')) + '</span>';
  }

  window.gmVenView = function (id) {
    fetch(gmVenApi() + '/' + id, { method: 'GET', mode: 'cors', credentials: 'omit' })
      .then(function (r) {
        return r.json();
      })
      .then(function (v) {
        var body = document.getElementById('gm-ven-view-body');
        var title = document.getElementById('gm-ven-view-title');
        if (title) title.textContent = v.company_name || 'Vendor';
        var cl = v.checklist || {};
        var ckDone = v.checklist_done != null ? v.checklist_done : 0;
        var ckTot = v.checklist_total != null ? v.checklist_total : 11;
        var docs = v.documents || [];
        var docList = docs
          .map(function (d) {
            return (
              '<li style="margin:4px 0"><a href="' +
              gmVenApi() +
              '/' +
              id +
              '/documents/' +
              d.id +
              '/file" target="_blank" rel="noopener" style="color:var(--blue)">' +
              gmVenEsc(d.filename) +
              '</a> <span style="color:var(--ink3);font-size:10px">(' +
              gmVenEsc(d.type) +
              ')</span></li>'
            );
          })
          .join('');
        if (!body) return;
        body.innerHTML =
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">' +
          '<div style="background:var(--cream);border-radius:8px;padding:12px;border:1px solid var(--border)"><div style="font-size:9px;font-weight:700;color:var(--ink3);text-transform:uppercase">' +
          gmVenEsc(gmVenT('vendors_basic_info')) +
          '</div><div style="margin-top:8px;font-size:12px;color:var(--ink)"><strong>' +
          gmVenEsc(v.company_name) +
          '</strong><br>' +
          gmVenEsc(v.contact_first_name + ' ' + v.contact_last_name) +
          '<br>' +
          gmVenEsc(v.email) +
          '<br>' +
          gmVenEsc(v.phone) +
          '</div></div>' +
          '<div style="background:var(--cream);border-radius:8px;padding:12px;border:1px solid var(--border)"><div style="font-size:9px;font-weight:700;color:var(--ink3);text-transform:uppercase">' +
          gmVenEsc(gmVenT('trade')) +
          '</div><div style="margin-top:8px;font-size:12px">' +
          gmVenEsc(v.trade) +
          (v.trade_secondary ? '<br>' + gmVenEsc(v.trade_secondary) : '') +
          '</div></div></div>' +
          '<div style="background:var(--cream);border-radius:8px;padding:12px;margin-bottom:12px;border:1px solid var(--border)"><div style="font-size:9px;font-weight:700;color:var(--ink3)">' +
          gmVenEsc(gmVenT('vendors_alerts')) +
          '</div><div style="margin-top:8px;font-size:11px;line-height:1.6">WC: ' +
          gmVenExpiryLabel(v.workers_comp_expiration) +
          ' · Liab: ' +
          gmVenExpiryLabel(v.liability_insurance_expiration) +
          ' · Auto: ' +
          gmVenExpiryLabel(v.auto_insurance_expiration) +
          ' · License: ' +
          gmVenExpiryLabel(v.state_license_expiration) +
          ' · Contract: ' +
          gmVenExpiryLabel(v.contract_expiration) +
          '</div></div>' +
          '<div style="margin-bottom:10px;font-weight:700;font-size:12px">' +
          gmVenEsc(gmVenT('payment_checklist')) +
          ' (' +
          ckDone +
          '/' +
          ckTot +
          ')</div>' +
          '<ul style="margin:0 0 14px 18px;font-size:11px">' +
          (function () {
            var ckLbl = {
              name_registered: 'vendors_ck_name_title',
              address_complete: 'vendors_ck_addr_title',
              email_verified: 'vendors_ck_email_title',
              phone_verified: 'vendors_ck_phone_title',
              w9_uploaded: 'w9_form',
              bank_info_uploaded: 'bank_info',
              workers_comp_uploaded: 'workers_comp',
              liability_insurance_uploaded: 'liability_insurance',
              auto_insurance_uploaded: 'auto_insurance',
              state_license_uploaded: 'state_license',
              contract_signed: 'contract_signed',
            };
            return [
              'name_registered',
              'address_complete',
              'email_verified',
              'phone_verified',
              'w9_uploaded',
              'bank_info_uploaded',
              'workers_comp_uploaded',
              'liability_insurance_uploaded',
              'auto_insurance_uploaded',
              'state_license_uploaded',
              'contract_signed',
            ]
              .map(function (k) {
                var lbl = gmVenT(ckLbl[k] || k);
                var ok = cl[k];
                return (
                  '<li><span style="color:var(--ink)">' +
                  gmVenEsc(lbl) +
                  '</span>: <span style="font-weight:700;color:' +
                  (ok ? 'var(--green)' : 'var(--red)') +
                  '">' +
                  gmVenEsc(ok ? gmVenT('complete') : gmVenT('missing')) +
                  '</span></li>'
                );
              })
              .join('');
          })() +
          '</ul>' +
          '<div style="font-weight:700;font-size:12px;margin-bottom:6px">' +
          gmVenEsc(gmVenT('documents_section')) +
          '</div><ul style="margin:0 0 14px 18px;font-size:11px">' +
          (docList || '<li>—</li>') +
          '</ul>' +
          '<div style="font-weight:700;font-size:12px;margin-bottom:6px">' +
          gmVenEsc(gmVenT('vendors_payment_history')) +
          '</div><div style="font-size:11px;color:var(--ink3);padding:12px;background:var(--sand);border-radius:8px;border:1px dashed var(--border2)">' +
          gmVenEsc(gmVenT('vendors_payment_history_ph')) +
          '</div>';
        var bg = document.getElementById('gm-ven-view-bg');
        if (bg) {
          bg.style.display = 'flex';
          bg.style.flexDirection = 'column';
          document.body.style.overflow = 'hidden';
        }
        if (typeof applyTranslations === 'function') applyTranslations();
      });
  };

  window.gmVenCloseModal = function () {
    var bg = document.getElementById('gm-ven-modal-bg');
    if (bg) bg.style.display = 'none';
    document.body.style.overflow = '';
  };

  window.gmVenCloseView = function () {
    var bg = document.getElementById('gm-ven-view-bg');
    if (bg) bg.style.display = 'none';
    document.body.style.overflow = '';
  };

  window.gmVenExportCsv = function () {
    fetch(gmVenApi() + '/list?page=1&limit=500', { method: 'GET', mode: 'cors', credentials: 'omit' })
      .then(function (r) {
        return r.json();
      })
      .then(function (d) {
        var rows = d.vendors || [];
        var headers = ['id', 'company_name', 'trade', 'email', 'phone', 'status', 'checklist_done', 'send_1099'];
        var lines = [headers.join(',')];
        rows.forEach(function (v) {
          lines.push(
            [
              v.id,
              '"' + String(v.company_name || '').replace(/"/g, '""') + '"',
              '"' + String(v.trade || '').replace(/"/g, '""') + '"',
              '"' + String(v.email || '').replace(/"/g, '""') + '"',
              '"' + String(v.phone || '').replace(/"/g, '""') + '"',
              v.status,
              v.checklist_done,
              v.send_1099 ? 'yes' : 'no',
            ].join(',')
          );
        });
        var a = document.createElement('a');
        a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent('\uFEFF' + lines.join('\n'));
        a.download = 'vendors_export.csv';
        a.click();
      });
  };
})();
