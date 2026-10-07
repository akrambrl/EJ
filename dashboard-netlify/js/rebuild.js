/* ===================== RECALCUL DES AGRÉGATS =====================
   Portage JavaScript fidèle de outils/rebuild_dashboard.py (aggregate, predictions, insights).
   Vérifié : résultat identique au script Python sur toutes les factures 2025-2026.
   À garder synchronisé si le script Python change. */
(function(){
  const pad = (n, w) => String(n).padStart(w || 2, '0');
  const MOIS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const pdate = s => { const [d, m, y] = String(s).split('/').map(Number); return Date.UTC(y, m - 1, d); };
  const fdate = t => { const d = new Date(t); return pad(d.getUTCDate()) + '/' + pad(d.getUTCMonth() + 1) + '/' + d.getUTCFullYear(); };
  const DAY = 86400000;
  const pyRound = x => (Math.abs(x % 1) === 0.5) ? 2 * Math.round(x / 2) : Math.round(x);   // round() de Python (arrondi bancaire)
  const eur = x => String(pyRound(x)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const sum = (arr, f) => arr.reduce((a, x) => a + f(x), 0);
  const setdefault = (map, k, mk) => { if(!map.has(k)) map.set(k, mk()); return map.get(k); };
  const byKey = key => (a, b) => { const ka = key(a), kb = key(b); for(let i = 0; i < ka.length; i++){ if(ka[i] < kb[i]) return -1; if(ka[i] > kb[i]) return 1; } return 0; };
  const tupleCmp = (a, b) => { for(let i = 0; i < a.length; i++){ if(a[i] < b[i]) return -1; if(a[i] > b[i]) return 1; } return 0; };
  const maxBy = (arr, cmp) => arr.reduce((m, x) => cmp(x, m) > 0 ? x : m);
  const minBy = (arr, cmp) => arr.reduce((m, x) => cmp(x, m) < 0 ? x : m);

  function aggregate(factures, withPred, today){
    const F = factures.slice().sort((a, b) => -byKey(f => [pdate(f.date), f.facture])(a, b));
    const cl = new Map(), pa = new Map(), pc = new Map(), rf = new Map(), co = new Map();
    const mo = new Map(MOIS.map(m => [m, {mois:m, factures:0, btl:0, ca:0, cout:0, marge:0}]));
    const ctp = new Map();
    for(const f of F){
      const key = f.client + '\u0000' + f.pays;
      const tst = sum(f.lines, l => l.testers || 0);
      const fc = sum(f.lines, l => l.cout || 0), fm = sum(f.lines, l => l.marge || 0);
      const c = setdefault(cl, key, () => ({client:f.client, pays:f.pays, factures:0, btl:0, testers:0, ca:0, cout:0, marge:0}));
      const p = setdefault(pa, f.pays, () => ({pays:f.pays, _cl:new Set(), factures:0, btl:0, ca:0, cout:0, marge:0}));
      const q = setdefault(pc, key, () => ({pays:f.pays, client:f.client, label:`${f.pays} — ${f.client}`, factures:0, btl:0, ca:0, cout:0, marge:0}));
      const m = mo.get(MOIS[new Date(pdate(f.date)).getUTCMonth()]);
      for(const o of [c, p, q, m]){ o.factures += 1; o.btl += f.btl; o.ca += f.ca; o.cout += fc; o.marge += fm; }
      c.testers += tst;
      p._cl.add(f.client);
      for(const l of f.lines){
        const r = setdefault(rf, l.collection + '\u0000' + l.reference, () => ({collection:l.collection, reference:l.reference, cartons:0, btl:0, testers:0, ca:0, cout:0, marge:0, cost_known:true}));
        for(const k of ['cartons','btl','testers','ca','cout','marge']) r[k] += l[k] || 0;
        const g = setdefault(co, l.collection, () => ({collection:l.collection, _r:new Set(), btl:0, ca:0, cout:0, marge:0, cost_known:true}));
        g._r.add(l.reference);
        for(const k of ['btl','ca','cout','marge']) g[k] += l[k] || 0;
        if(l.mode !== 'remise'){
          const t = setdefault(setdefault(ctp, `${f.client}|${f.pays}`, () => new Map()), l.collection + '\u0000' + l.reference,
            () => ({collection:l.collection, reference:l.reference, btl:0, ca:0}));
          t.btl += l.btl || 0; t.ca += l.ca || 0;
        }
      }
    }
    for(const p of pa.values()){ p.clients = p._cl.size; delete p._cl; }
    for(const g of co.values()){ g.refs = g._r.size; delete g._r; }
    const pays = [...pa.values()].map(p => ({pays:p.pays, clients:p.clients, factures:p.factures, btl:p.btl, ca:p.ca, cout:p.cout, marge:p.marge}));
    const colls = [...co.values()].map(g => ({collection:g.collection, refs:g.refs, btl:g.btl, ca:g.ca, cout:g.cout, marge:g.marge, cost_known:true}));
    const byca = L => L.slice().sort((a, b) => b.ca - a.ca);
    const clients = byca([...cl.values()]);
    const ca = sum(F, f => f.ca);
    const cout = sum(F, f => sum(f.lines, l => l.cout || 0)), marge = sum(F, f => sum(f.lines, l => l.marge || 0));
    const ctpObj = {};
    for(const [k, v] of ctp) ctpObj[k] = [...v.values()].sort((a, b) => b.btl - a.btl).slice(0, 3);
    const out = {
      kpi_ca:ca, kpi_cout:cout, kpi_marge:marge, kpi_marge_pct_known:(ca ? marge / ca * 100 : 0),
      kpi_ca_known:ca, kpi_ca_unknown:0,
      kpi_btl:sum(F, f => f.btl), kpi_testers:sum(F, f => sum(f.lines, l => l.testers || 0)),
      kpi_factures:F.length, kpi_clients:clients.length, kpi_pays:pays.length, kpi_refs:rf.size,
      clients, pays:byca(pays), pays_client:byca([...pc.values()]), mois:[...mo.values()],
      refs:byca([...rf.values()]), collections:byca(colls), factures:F,
      petits:clients.slice().sort((a, b) => a.ca - b.ca).slice(0, 3).map(c => ({client:c.client, pays:c.pays, ca:c.ca, btl:c.btl})),
      client_top_products:ctpObj
    };
    if(withPred){ out.predictions = predictions(F, today); out.insights = insights(F, out); }
    return out;
  }

  function groupByClient(F){
    const by = new Map();
    for(const f of F.slice().sort((a, b) => pdate(a.date) - pdate(b.date))) setdefault(by, f.client + '\u0000' + f.pays, () => []).push(f);
    return by;
  }

  function predictions(F, today){
    const res = [];
    for(const [k, L] of groupByClient(F)){
      const [c, p] = k.split('\u0000');
      const ds = L.map(f => pdate(f.date));
      const gaps = []; for(let i = 1; i < ds.length; i++) gaps.push(Math.round((ds[i] - ds[i - 1]) / DAY));
      const avg = gaps.length ? pyRound(sum(gaps, x => x) / gaps.length) : null;
      const last = ds[ds.length - 1], since = Math.round((today - last) / DAY);
      const tr = new Map();
      for(const f of L) for(const l of f.lines){
        if(l.mode === 'remise') continue;
        const t = setdefault(tr, l.collection + '\u0000' + l.reference, () => ({collection:l.collection, reference:l.reference, btl:0, cartons:0}));
        t.btl += l.btl || 0; t.cartons += l.cartons || 0;
      }
      const n = L.length;
      res.push({client:c, pays:p, n_factures:n, last_order:fdate(last), days_since_last:since, avg_interval:avg,
        predicted_date:avg !== null ? fdate(last + avg * DAY) : null, predicted_ca:sum(L, f => f.ca) / n,
        confidence:n >= 5 ? 'haute' : n >= 2 ? 'moyenne' : 'basse', overdue:avg !== null && since > avg,
        top_refs:[...tr.values()].sort((a, b) => b.btl - a.btl).slice(0, 5)});
    }
    return res.sort(byKey(r => [-r.n_factures, -r.predicted_ca]));
  }

  function insights(F, A){
    const gr = [];
    for(const [k, L] of groupByClient(F)){
      const [c, p] = k.split('\u0000');
      if(L.length >= 2 && L[0].ca) gr.push([(L[L.length - 1].ca - L[0].ca) / L[0].ca * 100, c, p, L[0].ca, L[L.length - 1].ca]);
    }
    const ins = [];
    if(gr.length){
      const g = maxBy(gr, tupleCmp);
      ins.push({icon:'🚀', level:'success', title:`${g[1]} (${g[2]}) en très forte croissance (+${pyRound(g[0])}%)`, desc:`Sa 1ère commande était de ${eur(g[3])} €  sa dernière de ${eur(g[4])} €.`});
      const d = minBy(gr, tupleCmp);
      if(d[0] < 0) ins.push({icon:'📉', level:'danger', title:`${d[1]} (${d[2]}) en baisse (${pyRound(d[0])}%)`, desc:`Sa 1ère commande était de ${eur(d[3])} €  sa dernière de ${eur(d[4])} €.`});
    }
    const bm = maxBy(A.mois, (a, b) => a.ca - b.ca);
    ins.push({icon:'🏆', level:'info', title:`Meilleur mois : ${bm.mois}`, desc:`${eur(bm.ca)} € de CA sur ce mois.`});
    const t = A.clients[0];
    ins.push({icon:'👑', level:'info', title:`${t.client} concentre ${pyRound(t.ca / A.kpi_ca * 100)}% du CA`, desc:`${eur(t.ca)} € sur ${eur(A.kpi_ca)} € au total.`});
    const real = A.collections.filter(c => c.ca > 0 && !['REMISE','CONCENTRÉ'].includes(c.collection)).map(c => [c.marge / c.ca * 100, c]);
    if(real.length){
      const [pct, c] = minBy(real, (a, b) => a[0] - b[0]);
      ins.push({icon:'💸', level:'warning', title:`${c.collection} : marge la plus faible (${pyRound(pct)}%)`, desc:`Marge de ${eur(c.marge)} € sur ${eur(c.ca)} € de CA.`});
    }
    return ins;
  }

  function rebuildAll(f2025, f2026, today){
    return {
      '2025': Object.assign(aggregate(f2025, false, today), {year:'2025'}),
      '2026': Object.assign(aggregate(f2026, true, today), {year:'2026'}),
      'total': Object.assign(aggregate(f2025.concat(f2026), true, today), {year:'total'})
    };
  }
  window.EJ_REBUILD = { aggregate, rebuildAll, pdate, fdate, MOIS };
})();
