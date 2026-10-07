/* ===================== DEVIS, PROFORMAS & FACTURES =====================
   Création de documents commerciaux imprimables (PDF via le navigateur).
   - Devis et proformas : n'entrent pas dans le CA.
   - Factures : ajoutées à ALL[année].factures, puis TOUS les agrégats sont recalculés
     (portage fidèle de outils/rebuild_dashboard.py — règle d'or n° 1 de CLAUDE.md).
   Les documents sont enregistrés dans ce navigateur (localStorage). Le bouton
   « Exporter data/ventes.js » produit le fichier de données à jour pour les rendre permanents. */
(function(){
  if(typeof ALL === 'undefined') return;

  const DOC_KEY = 'ej_documents_v1', SET_KEY = 'ej_documents_settings_v1', SIM_KEY = 'ej-simulateur-v3';
  const clone = o => JSON.parse(JSON.stringify(o));
  const esc = s => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const r2 = x => Math.round((x + Number.EPSILON) * 100) / 100;
  const r4 = x => Math.round((x + Number.EPSILON) * 10000) / 10000;
  const num = v => { const n = parseFloat(String(v == null ? '' : v).replace(/\s/g,'').replace(',', '.')); return isNaN(n) ? 0 : n; };
  const money = n => (n || 0).toLocaleString('fr-FR', {minimumFractionDigits:2, maximumFractionDigits:2}) + ' €';
  const pad = (n, w) => String(n).padStart(w || 2, '0');
  const load = (k, d) => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : d; } catch(e) { return d; } };
  const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e) { alert("Enregistrement impossible dans ce navigateur (stockage plein ou désactivé)."); } };

  // Données d'origine figées : le recalcul repart toujours d'elles.
  const BASE = { '2025': clone(ALL['2025']), '2026': clone(ALL['2026']), 'total': clone(ALL['total']) };
  const BASE_FACT = BASE['2025'].factures.concat(BASE['2026'].factures);
  const BASE_NUMS = new Set(BASE_FACT.map(f => f.facture));
  const YEARS = ['2025', '2026'];
  // Numéros EJ déjà attribués dans les registres (donnees_sources/FACTURES_*.md) mais présents dans le
  // dashboard sous leur numéro Dubaï (NB…) : à ne jamais réattribuer.
  const NUMEROS_REGISTRE = ['EJ2025006','EJ2025013','EJ2025015','EJ2025017','EJ2025027','EJ2025033','EJ2025034','EJ2025036','EJ2025037','EJ2025050',
    'EJ2026003','EJ2026009','EJ2026010','EJ2026021','EJ2026025','EJ2026026','EJ2026027','EJ2026031'];

  /* ---------- Recalcul des agrégats : portage de outils/rebuild_dashboard.py ---------- */
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
  window.EJ_REBUILD = { aggregate, rebuildAll, pdate };   // exposé pour les tests

  /* ---------- Catalogue, tarifs et coûts ---------- */
  const PARFUMS = ['VIP','VIP BLACK','50ML','BRUMES','ROYAL'];
  const COLL_LABEL = {'VIP':'VIP 90 ml','VIP BLACK':'VIP Black 90 ml','50ML':'VIP Black 50 ml','BRUMES':'Brumes 250 ml','ROYAL':'Royal 100 ml','TRANSPORT':'Transport','SERVICE':'Service / autre'};
  const COLLECTIONS = PARFUMS.concat(['TRANSPORT','SERVICE']);
  const REFS = {};
  PARFUMS.forEach(c => {
    const s = new Set();
    ((ALL.costs[c] || {}).refs || []).forEach(r => s.add(r.name));
    (((ALL.stock || {})[c] || {}).items || []).forEach(i => s.add(i.reference));
    REFS[c] = [...s].sort((a, b) => a.localeCompare(b, 'fr'));
  });
  const perCartonDefault = c => (ALL.costs[c] && ALL.costs[c].units_sold_per_carton) || (typeof CARTON_INFO !== 'undefined' && CARTON_INFO[c] ? CARTON_INFO[c].size : 1);
  const priceDefault = (c, mode) => { const ci = (typeof CARTON_INFO !== 'undefined' && CARTON_INFO[c]) || {}; return mode === 'unite' ? (ci.price_btl || 0) : (ci.price_carton || 0); };
  // Coût par bouteille physique : ratio de la dernière facture contenant la référence, sinon fabrication + transport.
  const LAST_COST = {};
  BASE_FACT.slice().sort((a, b) => pdate(a.date) - pdate(b.date)).forEach(f => f.lines.forEach(l => {
    const u = (l.btl || 0) + (l.testers || 0);
    if(u > 0 && l.cout > 0) LAST_COST[l.collection + '|' + l.reference] = l.cout / u;
  }));
  function unitCost(col, ref){
    const k = col + '|' + ref;
    if(LAST_COST[k] != null) return LAST_COST[k];
    const c = ALL.costs[col]; if(!c) return 0;
    const r = (c.refs || []).find(x => x.name === ref);
    const fab = r ? r.cost_per_bottle_fabrication : (c.refs && c.refs.length ? sum(c.refs, x => x.cost_per_bottle_fabrication) / c.refs.length : 0);
    return (fab || 0) + (c.transport_eur || 0);
  }
  const CADEAUX = ['Sacs noirs','Paquets de mouillettes','Catalogues','Échantillons 2ml'];
  const LAST_PAYS = {};
  BASE_FACT.slice().sort((a, b) => pdate(a.date) - pdate(b.date)).forEach(f => { LAST_PAYS[f.client] = f.pays; });

  /* ---------- Réglages : coordonnées de l'émetteur ---------- */
  const DEFAULT_SETTINGS = {
    nom:'PARFUMS EMMANUELLE JANE', forme:'SARL au capital de 100 000 €', adresse:'3 rue Robespierre', cp_ville:'94500 Champigny-sur-Marne', pays:'France',
    siret:'532 707 684 00025', rcs:'RCS Créteil 532 707 684', tva:'FR49532707684', ape:'46.49Z', email:'', tel:'',
    banque:'', iban:'', bic:'', conditions:'Paiement à réception de facture, par virement bancaire.', validite:30, echeance:30, clients:{}
  };
  let SETT = Object.assign({}, DEFAULT_SETTINGS, load(SET_KEY, {}));
  SETT.clients = SETT.clients || {};
  let docs = load(DOC_KEY, []);
  if(!Array.isArray(docs)) docs = [];
  const saveDocs = () => store(DOC_KEY, docs);
  const saveSett = () => store(SET_KEY, SETT);

  const TYPES = {
    devis:{label:'Devis', titre:'DEVIS', prefix:'DV', statuts:['Brouillon','Envoyé','Accepté','Refusé','Converti']},
    proforma:{label:'Proforma', titre:'FACTURE PROFORMA', prefix:'PF', statuts:['Brouillon','Envoyée','Acompte reçu','Convertie']},
    facture:{label:'Facture', titre:'FACTURE', prefix:'EJ', statuts:['À encaisser','Payée']}
  };
  const UE = ['Allemagne','Autriche','Belgique','Bulgarie','Chypre','Croatie','Danemark','Espagne','Estonie','Finlande','Grèce','Hongrie','Irlande','Italie','Lettonie','Lituanie','Luxembourg','Malte','Pays-Bas','Pologne','Portugal','Roumanie','Slovaquie','Slovénie','Suède','Tchéquie','République tchèque'];
  const REGIMES = {
    export:{label:'Export hors UE — exonéré', taux:0, mention:'Exonération de TVA — exportation hors Union européenne (article 262 I du CGI).'},
    intra:{label:'Livraison intracommunautaire — exonéré', taux:0, mention:'Exonération de TVA — livraison intracommunautaire (article 262 ter I du CGI). Autoliquidation par le preneur.'},
    fr:{label:'France — TVA 20 %', taux:20, mention:''}
  };
  const regimeFor = pays => pays === 'France' ? 'fr' : UE.includes(pays) ? 'intra' : 'export';

  /* ---------- Dates ---------- */
  const todayIso = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  const isoToFr = s => { const [y, m, d] = String(s || '').split('-'); return d ? `${d}/${m}/${y}` : ''; };
  const addDaysIso = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d) + n * DAY); return t.getUTCFullYear() + '-' + pad(t.getUTCMonth() + 1) + '-' + pad(t.getUTCDate()); };
  const todayUTC = () => { const d = new Date(); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); };

  /* ---------- Numérotation ---------- */
  function nextNumero(type, iso){
    const year = (iso || todayIso()).slice(0, 4);
    if(type === 'facture'){
      const re = new RegExp('^EJ' + year + '(\\d{3})$');
      let max = 0;
      BASE_FACT.map(f => f.facture).concat(NUMEROS_REGISTRE).concat(docs.filter(d => d.type === 'facture').map(d => d.numero))
        .forEach(n => { const m = re.exec(n || ''); if(m) max = Math.max(max, +m[1]); });
      return 'EJ' + year + pad(max + 1, 3);
    }
    const pre = TYPES[type].prefix + year + '-';
    let max = 0;
    docs.filter(d => d.type === type && String(d.numero).startsWith(pre)).forEach(d => { max = Math.max(max, parseInt(String(d.numero).slice(pre.length), 10) || 0); });
    return pre + pad(max + 1, 3);
  }

  /* ---------- Calcul d'un document ---------- */
  function lineCalc(l){
    const qty = num(l.qty), prix = num(l.prix);
    if(l.collection === 'TRANSPORT' || l.collection === 'SERVICE'){
      const ca = r2(qty * prix);
      return {btl:0, testers:0, cartons:0, ca, cout:0, marge:ca};
    }
    const cartons = l.mode === 'carton' ? qty : 0;
    const btl = l.mode === 'carton' ? Math.round(qty * num(l.perCarton)) : Math.round(qty);
    const testers = Math.round(num(l.testers));
    const ca = r2(qty * prix);
    const cout = r4(unitCost(l.collection, l.reference) * (btl + testers));
    return {btl, testers, cartons, ca, cout, marge:r4(ca - cout)};
  }
  function docCalc(d){
    const rows = d.lines.map(l => Object.assign({src:l}, lineCalc(l)));
    const brut = r2(sum(rows, r => r.ca));
    const remise = d.remisePct ? -r2(brut * num(d.remisePct) / 100) : 0;
    const ht = r2(brut + remise);
    const regime = REGIMES[d.regime] || REGIMES.export;
    const tva = r2(ht * regime.taux / 100);
    return {rows, brut, remise, ht, tva, ttc:r2(ht + tva), regime,
      btl:sum(rows, r => r.btl), testers:sum(rows, r => r.testers), cartons:sum(rows, r => r.cartons), cout:r4(sum(rows, r => r.cout))};
  }
  // Convertit une facture du module au format de ALL[année].factures (cf. CLAUDE.md)
  function toInvoice(d){
    const k = docCalc(d);
    const lines = k.rows.filter(r => r.src.reference || r.ca).map(r => {
      const l = r.src, svc = l.collection === 'TRANSPORT' || l.collection === 'SERVICE';
      return {collection:l.collection, reference:l.reference || COLL_LABEL[l.collection], mode:svc ? (l.collection === 'TRANSPORT' ? 'transport' : 'service') : l.mode,
        cartons:r.cartons, btl:r.btl, testers:r.testers, prix:num(l.prix), ca:r.ca, cout:r.cout, marge:r.marge};
    });
    if(k.remise) lines.push({collection:'REMISE', reference:`Remise ${String(d.remisePct).replace('.', ',')} %`, mode:'remise', cartons:0, btl:0, testers:0, prix:k.remise, ca:k.remise, cout:0, marge:k.remise});
    const inv = {facture:d.numero, date:isoToFr(d.date), client:d.client.trim(), pays:d.pays.trim(),
      btl:sum(lines, l => l.btl), ca:r2(sum(lines, l => l.ca)), cout:r4(sum(lines, l => l.cout)), marge:0, lines};
    inv.marge = r4(inv.ca - inv.cout);
    const cad = CADEAUX.filter(a => num((d.cadeaux || {})[a]) > 0).map(a => ({article:a, quantite:Math.round(num(d.cadeaux[a]))}));
    if(cad.length) inv.cadeaux = cad;
    return inv;
  }

  /* ---------- Intégration des factures au dashboard ---------- */
  let integrated = 0, outOfRange = [];
  function applyToDashboard(){
    const local = docs.filter(d => d.type === 'facture' && !BASE_NUMS.has(d.numero) && d.client && d.date).map(toInvoice);
    outOfRange = local.filter(f => !YEARS.includes(f.date.slice(6)));
    const add = y => local.filter(f => f.date.slice(6) === y);
    integrated = local.length - outOfRange.length;
    if(integrated){
      const R = rebuildAll(BASE['2025'].factures.concat(add('2025')), BASE['2026'].factures.concat(add('2026')), todayUTC());
      YEARS.concat(['total']).forEach(y => { ALL[y] = R[y]; });
    } else {
      YEARS.concat(['total']).forEach(y => { ALL[y] = clone(BASE[y]); });
    }
    if(typeof renderAll === 'function') renderAll();
  }

  /* ---------- Liste ---------- */
  const $ = id => document.getElementById(id);
  let filterType = 'all', filterText = '';
  function statusClass(s){ return /pay|accept|encaiss|acompte|conver/i.test(s) && !/à encaisser/i.test(s) ? 'ok' : /refus/i.test(s) ? 'ko' : ''; }
  function renderList(){
    const q = filterText.toLowerCase();
    const list = docs.filter(d => (filterType === 'all' || d.type === filterType) && (!q || (d.numero + ' ' + d.client + ' ' + d.pays).toLowerCase().includes(q)))
      .sort((a, b) => (b.date || '').localeCompare(a.date || '') || String(b.numero).localeCompare(String(a.numero)));
    const rows = list.map(d => {
      const k = docCalc(d), t = TYPES[d.type];
      const inBase = d.type === 'facture' && BASE_NUMS.has(d.numero);
      const conv = d.type === 'devis' ? `<button class="doc-btn small" data-act="convert" data-to="proforma" data-id="${d.id}">→ Proforma</button><button class="doc-btn small" data-act="convert" data-to="facture" data-id="${d.id}">→ Facture</button>`
        : d.type === 'proforma' ? `<button class="doc-btn small" data-act="convert" data-to="facture" data-id="${d.id}">→ Facture</button>` : '';
      return `<tr>
        <td><span class="doc-type doc-type-${d.type}">${t.label}</span></td>
        <td><strong>${esc(d.numero)}</strong>${d.source ? `<div class="doc-sub">depuis ${esc(d.source)}</div>` : ''}</td>
        <td>${esc(isoToFr(d.date))}</td>
        <td>${esc(d.client)}<div class="doc-sub">${esc(d.pays)}</div></td>
        <td class="text-right">${money(k.ht)}</td>
        <td><span class="doc-status ${statusClass(d.statut)}">${esc(d.statut || '')}</span>${inBase ? '<div class="doc-sub">déjà dans le fichier de données</div>' : ''}</td>
        <td class="doc-actions"><button class="doc-btn small" data-act="view" data-id="${d.id}">Voir / PDF</button><button class="doc-btn small" data-act="edit" data-id="${d.id}">Modifier</button>${conv}<button class="doc-btn small" data-act="dup" data-id="${d.id}">Dupliquer</button><button class="doc-btn small danger" data-act="del" data-id="${d.id}">Supprimer</button></td>
      </tr>`;
    }).join('');
    $('docList').innerHTML = rows || `<tr><td colspan="7" class="text-center" style="padding:28px;color:var(--muted)">Aucun document pour l'instant. Commence par « Nouveau devis », « Nouvelle proforma » ou « Nouvelle facture ».</td></tr>`;
    const nf = docs.filter(d => d.type === 'facture' && !BASE_NUMS.has(d.numero)).length;
    $('docStatus').innerHTML = `${docs.length} document${docs.length > 1 ? 's' : ''} enregistré${docs.length > 1 ? 's' : ''} dans ce navigateur · `
      + (integrated ? `<strong>${integrated} facture${integrated > 1 ? 's' : ''} ajoutée${integrated > 1 ? 's' : ''} aux chiffres du dashboard</strong>` : 'aucune nouvelle facture dans les chiffres')
      + (outOfRange.length ? ` · ⚠️ ${outOfRange.length} facture(s) hors 2025-2026 non comptée(s)` : '')
      + (nf ? ` · pense à <strong>exporter data/ventes.js</strong> pour les rendre permanentes` : '');
  }

  /* ---------- Éditeur ---------- */
  let cur = null;   // document en cours d'édition (copie)
  function blankDoc(type){
    const date = todayIso();
    return {id:'d' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), type, numero:nextNumero(type, date), date,
      validite:addDaysIso(date, +SETT.validite || 30), echeance:addDaysIso(date, +SETT.echeance || 30),
      client:'', pays:'', adresse:'', tvaClient:'', regime:'export', remisePct:0, cadeaux:{}, notes:'', conditions:SETT.conditions,
      statut:TYPES[type].statuts[0], lines:[newLine('VIP', '')]};
  }
  function newLine(col, pays){
    const mode = 'carton';
    return {collection:col, reference:'', mode, qty:1, perCarton:perCartonDefault(col), prix:priceDefault(col, mode), testers:testerAuto(col, mode, 1, pays), autoT:true};
  }
  function testerAuto(col, mode, qty, pays){
    if(mode !== 'carton' || !PARFUMS.includes(col)) return 0;
    return Math.round(num(qty)) * (col === 'BRUMES' && pays === 'Russie' ? 2 : 1);
  }
  function openEditor(d){
    cur = clone(d);
    $('docEdTitle').textContent = (docs.some(x => x.id === d.id) ? 'Modifier — ' : 'Nouveau — ') + TYPES[d.type].label;
    renderEditor();
    $('docEditor').classList.add('active');
  }
  function closeEditor(){ $('docEditor').classList.remove('active'); cur = null; }

  function renderEditor(){
    const d = cur, t = TYPES[d.type];
    const clients = [...new Set(BASE_FACT.map(f => f.client).concat(docs.map(x => x.client)).concat(Object.keys(SETT.clients)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
    const paysList = [...new Set(BASE_FACT.map(f => f.pays).concat(UE).concat(['France']))].sort((a, b) => a.localeCompare(b, 'fr'));
    const opt = (v, cur, lbl) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(lbl || v)}</option>`;
    $('docEdBody').innerHTML = `
      <div class="doc-grid">
        <label>Type<select data-f="type">${Object.keys(TYPES).map(k => opt(k, d.type, TYPES[k].label)).join('')}</select></label>
        <label>Numéro<input data-f="numero" value="${esc(d.numero)}"></label>
        <label>Date<input type="date" data-f="date" value="${esc(d.date)}"></label>
        ${d.type === 'facture' ? `<label>Échéance<input type="date" data-f="echeance" value="${esc(d.echeance)}"></label>` : `<label>Valable jusqu'au<input type="date" data-f="validite" value="${esc(d.validite)}"></label>`}
        <label>Statut<select data-f="statut">${t.statuts.map(s => opt(s, d.statut)).join('')}</select></label>
      </div>
      <h3 class="doc-h3">Client</h3>
      <div class="doc-grid">
        <label class="span2">Nom du client<input data-f="client" list="docClients" value="${esc(d.client)}" placeholder="Ex. MB Tressoria"></label>
        <label>Pays<input data-f="pays" list="docPays" value="${esc(d.pays)}"></label>
        <label>N° TVA du client<input data-f="tvaClient" value="${esc(d.tvaClient)}" placeholder="Obligatoire en intra-UE"></label>
        <label class="span2">Adresse<textarea data-f="adresse" rows="2">${esc(d.adresse)}</textarea></label>
        <label class="span2">TVA<select data-f="regime">${Object.keys(REGIMES).map(k => opt(k, d.regime, REGIMES[k].label)).join('')}</select></label>
      </div>
      <datalist id="docClients">${clients.map(c => `<option value="${esc(c)}">`).join('')}</datalist>
      <datalist id="docPays">${paysList.map(c => `<option value="${esc(c)}">`).join('')}</datalist>
      ${PARFUMS.map(c => `<datalist id="docRefs-${c.replace(/\s/g, '')}">${REFS[c].map(r => `<option value="${esc(r)}">`).join('')}</datalist>`).join('')}
      <h3 class="doc-h3">Lignes</h3>
      <div class="doc-table-wrap"><table class="doc-lines">
        <thead><tr><th>Collection</th><th>Référence</th><th>Vente</th><th class="text-right">Qté</th><th class="text-right">Fl./ctn</th><th class="text-right">Testeurs</th><th class="text-right">Prix HT</th><th class="text-right">Total HT</th><th></th></tr></thead>
        <tbody>${d.lines.map((l, i) => lineRow(l, i)).join('')}</tbody>
      </table></div>
      <div class="doc-row-actions"><button class="doc-btn" data-act="addline">+ Ajouter une ligne</button><button class="doc-btn" data-act="sim">Appliquer la grille du simulateur d'offres</button><span id="docSimMsg" class="doc-sub"></span></div>
      <div class="doc-grid doc-grid-bottom">
        <div>
          <h3 class="doc-h3">Remise et cadeaux offerts</h3>
          <div class="doc-grid">
            <label>Remise sur la commande (%)<input type="number" step="0.5" min="0" data-f="remisePct" value="${esc(d.remisePct)}"></label>
            ${CADEAUX.map(a => `<label>${esc(a)}<input type="number" min="0" step="1" data-cad="${esc(a)}" value="${esc((d.cadeaux || {})[a] || '')}" placeholder="0"></label>`).join('')}
          </div>
          <label class="doc-full">Conditions / mentions<textarea data-f="conditions" rows="2">${esc(d.conditions)}</textarea></label>
          <label class="doc-full">Notes internes (non imprimées)<textarea data-f="notes" rows="2">${esc(d.notes)}</textarea></label>
        </div>
        <div class="doc-totals" id="docTotals"></div>
      </div>`;
    updateTotals();
  }
  function lineRow(l, i){
    const svc = l.collection === 'TRANSPORT' || l.collection === 'SERVICE';
    const k = lineCalc(l);
    return `<tr data-i="${i}">
      <td><select data-l="collection">${COLLECTIONS.map(c => `<option value="${c}"${c === l.collection ? ' selected' : ''}>${esc(COLL_LABEL[c])}</option>`).join('')}</select></td>
      <td><input data-l="reference" value="${esc(l.reference)}" ${svc ? 'placeholder="Désignation"' : `list="docRefs-${l.collection.replace(/\s/g, '')}" placeholder="Référence"`}></td>
      <td>${svc ? '<span class="doc-sub">forfait</span>' : `<select data-l="mode"><option value="carton"${l.mode === 'carton' ? ' selected' : ''}>Carton</option><option value="unite"${l.mode === 'unite' ? ' selected' : ''}>À l'unité</option></select>`}</td>
      <td><input class="num" type="number" min="0" step="1" data-l="qty" value="${esc(l.qty)}"></td>
      <td>${!svc && l.mode === 'carton' ? `<input class="num" type="number" min="1" step="1" data-l="perCarton" value="${esc(l.perCarton)}">` : ''}</td>
      <td>${svc ? '' : `<input class="num" type="number" min="0" step="1" data-l="testers" value="${esc(l.testers)}">`}</td>
      <td><input class="num" type="number" min="0" step="0.01" data-l="prix" value="${esc(l.prix)}"></td>
      <td class="text-right" data-total>${money(k.ca)}</td>
      <td><button class="doc-x" data-act="delline" title="Supprimer la ligne">×</button></td>
    </tr>`;
  }
  function updateTotals(){
    const k = docCalc(cur);
    cur.lines.forEach((l, i) => { const td = document.querySelector(`#docEdBody tr[data-i="${i}"] [data-total]`); if(td) td.textContent = money(lineCalc(l).ca); });
    const marge = k.ht - k.cout;
    $('docTotals').innerHTML = `
      <div class="kv"><span>Total brut HT</span><span>${money(k.brut)}</span></div>
      ${k.remise ? `<div class="kv"><span>Remise ${esc(cur.remisePct)} %</span><span>${money(k.remise)}</span></div>` : ''}
      <div class="kv"><span>Total HT</span><span>${money(k.ht)}</span></div>
      <div class="kv"><span>${k.regime.taux ? `TVA ${k.regime.taux} %` : 'TVA (exonéré)'}</span><span>${money(k.tva)}</span></div>
      <div class="kv strong"><span>${cur.type === 'devis' ? 'Total TTC' : 'Net à payer'}</span><span>${money(k.ttc)}</span></div>
      <div class="doc-internal">
        <div class="kv"><span>Bouteilles payées / testeurs</span><span>${k.btl} / ${k.testers}</span></div>
        <div class="kv"><span>Coût de revient estimé</span><span>${money(k.cout)}</span></div>
        <div class="kv"><span>Marge estimée</span><span class="${marge < 0 ? 'amount-negative' : 'amount-positive'}">${money(marge)}${k.ht ? ` · ${(marge / k.ht * 100).toFixed(1).replace('.', ',')} %` : ''}</span></div>
        <div class="doc-sub">Interne : n'apparaît pas sur le document imprimé.</div>
      </div>`;
  }

  function onEdInput(e){
    if(!cur) return;
    const el = e.target, f = el.dataset.f, lf = el.dataset.l, cad = el.dataset.cad;
    if(f){
      const v = el.value;
      if(f === 'type'){
        if(v !== cur.type){ cur.type = v; cur.numero = nextNumero(v, cur.date); cur.statut = TYPES[v].statuts[0]; renderEditor(); }
        return;
      }
      cur[f] = f === 'remisePct' ? num(v) : v;
      if(f === 'date' && e.type === 'change' && !docs.some(x => x.id === cur.id)){ cur.numero = nextNumero(cur.type, v); $('docEdBody').querySelector('[data-f="numero"]').value = cur.numero; }
      if(f === 'client' && e.type === 'change'){
        const c = SETT.clients[v] || {};
        if(!cur.pays && (c.pays || LAST_PAYS[v])){ cur.pays = c.pays || LAST_PAYS[v]; }
        if(!cur.adresse && c.adresse) cur.adresse = c.adresse;
        if(!cur.tvaClient && c.tvaClient) cur.tvaClient = c.tvaClient;
        if(cur.pays) cur.regime = regimeFor(cur.pays);
        retester(); renderEditor(); return;
      }
      if(f === 'pays' && e.type === 'change'){ cur.regime = regimeFor(v); retester(); renderEditor(); return; }
      updateTotals(); return;
    }
    if(cad){ cur.cadeaux = cur.cadeaux || {}; cur.cadeaux[cad] = num(el.value); return; }
    if(lf){
      const i = +el.closest('tr').dataset.i, l = cur.lines[i];
      if(lf === 'collection'){
        if(e.type !== 'change') return;
        const nl = newLine(el.value, cur.pays); nl.qty = l.qty; nl.testers = testerAuto(nl.collection, nl.mode, nl.qty, cur.pays);
        if(nl.collection === 'TRANSPORT' || nl.collection === 'SERVICE'){ nl.qty = 1; nl.prix = 0; nl.mode = 'service'; nl.reference = nl.collection === 'TRANSPORT' ? 'Frais de transport' : ''; }
        cur.lines[i] = nl; renderEditor(); return;
      }
      if(lf === 'mode'){
        if(e.type !== 'change') return;
        l.mode = el.value; l.prix = priceDefault(l.collection, l.mode); l.autoT = true; l.testers = testerAuto(l.collection, l.mode, l.qty, cur.pays); renderEditor(); return;
      }
      if(lf === 'reference'){ l.reference = el.value; return; }
      l[lf] = num(el.value);
      if(lf === 'testers') l.autoT = false;
      if(lf === 'qty' && l.autoT){ l.testers = testerAuto(l.collection, l.mode, l.qty, cur.pays); const ti = el.closest('tr').querySelector('[data-l="testers"]'); if(ti) ti.value = l.testers; }
      updateTotals();
    }
  }
  function retester(){ cur.lines.forEach(l => { if(l.autoT) l.testers = testerAuto(l.collection, l.mode, l.qty, cur.pays); }); }

  function applySimulator(){
    let S = null; try { S = JSON.parse(localStorage.getItem(SIM_KEY)); } catch(e) {}
    const tiers = (S && S.tiers) || [{min:1,remise:0,testeur:1,sac:2,ech:5,cata:1,mouil:0},{min:5,remise:3,testeur:1,sac:3,ech:10,cata:2,mouil:1},{min:10,remise:5,testeur:1,sac:4,ech:15,cata:3,mouil:1},{min:20,remise:8,testeur:1,sac:5,ech:20,cata:5,mouil:2}];
    const cartons = sum(cur.lines.filter(l => l.mode === 'carton' && PARFUMS.includes(l.collection)), l => Math.round(num(l.qty)));
    let T = null; tiers.slice().sort((a, b) => a.min - b.min).forEach(t => { if(cartons >= t.min) T = t; });
    if(!T){ $('docSimMsg').textContent = cartons ? `Aucun palier atteint avec ${cartons} carton(s).` : 'Ajoute des lignes en cartons pour appliquer la grille.'; return; }
    cur.remisePct = T.remise;
    cur.lines.forEach(l => { if(l.mode === 'carton' && PARFUMS.includes(l.collection)){ l.autoT = false; l.testers = Math.round(num(l.qty)) * Math.max(T.testeur, l.collection === 'BRUMES' && cur.pays === 'Russie' ? 2 : 0); } });
    cur.cadeaux = {'Sacs noirs':cartons * T.sac, 'Échantillons 2ml':cartons * T.ech, 'Catalogues':T.cata, 'Paquets de mouillettes':T.mouil};
    renderEditor();
    $('docSimMsg').textContent = `Palier « dès ${T.min} cartons » appliqué (${cartons} cartons) : remise ${T.remise} %, testeurs et cadeaux mis à jour.`;
  }

  function validate(d){
    const err = [];
    if(!d.numero.trim()) err.push('le numéro');
    if(!d.date) err.push('la date');
    if(!d.client.trim()) err.push('le client');
    if(!d.pays.trim()) err.push('le pays');
    if(!d.lines.some(l => num(l.qty) > 0)) err.push('au moins une ligne avec une quantité');
    if(err.length) return 'Il manque ' + err.join(', ') + '.';
    if(docs.some(x => x.id !== d.id && x.type === d.type && x.numero === d.numero)) return `Le numéro ${d.numero} existe déjà.`;
    if(d.type === 'facture' && (BASE_NUMS.has(d.numero) || NUMEROS_REGISTRE.includes(d.numero)) && !docs.some(x => x.id === d.id)) return `Le numéro ${d.numero} est déjà utilisé par une facture existante.`;
    const bad = d.lines.filter(l => PARFUMS.includes(l.collection) && l.reference && !REFS[l.collection].includes(l.reference));
    if(bad.length && !confirm(`Référence(s) hors catalogue : ${bad.map(l => l.reference).join(', ')}.\nLe dashboard les comptera comme de nouvelles références. Continuer ?`)) return 'cancel';
    if(d.regime === 'intra' && !d.tvaClient.trim() && !confirm("Livraison intracommunautaire sans numéro de TVA du client : l'exonération n'est pas valable sans ce numéro. Continuer ?")) return 'cancel';
    return '';
  }
  function saveCurrent(){
    const d = cur;
    d.client = d.client.trim(); d.pays = d.pays.trim(); d.numero = d.numero.trim();
    d.lines = d.lines.filter(l => num(l.qty) > 0 || l.reference);
    const err = validate(d);
    if(err === 'cancel') return false;
    if(err){ alert(err); return false; }
    SETT.clients[d.client] = {pays:d.pays, adresse:d.adresse, tvaClient:d.tvaClient}; saveSett();
    const i = docs.findIndex(x => x.id === d.id);
    if(i >= 0) docs[i] = d; else docs.push(d);
    saveDocs(); closeEditor();
    if(d.type === 'facture') applyToDashboard();
    renderList();
    return d;
  }

  function convert(id, to){
    const s = docs.find(x => x.id === id); if(!s) return;
    const d = clone(s), date = todayIso();
    Object.assign(d, {id:'d' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), type:to, numero:nextNumero(to, date), date,
      validite:addDaysIso(date, +SETT.validite || 30), echeance:addDaysIso(date, +SETT.echeance || 30), statut:TYPES[to].statuts[0], source:s.numero});
    s.statut = s.type === 'devis' ? 'Converti' : 'Convertie'; saveDocs();
    openEditor(d);
  }

  /* ---------- Document imprimable ---------- */
  function docHtml(d){
    const k = docCalc(d), t = TYPES[d.type], S = SETT;
    const lines = k.rows.filter(r => num(r.src.qty) > 0).map(r => {
      const l = r.src, svc = l.collection === 'TRANSPORT' || l.collection === 'SERVICE';
      const design = svc ? esc(l.reference || COLL_LABEL[l.collection]) : `<strong>${esc(l.reference)}</strong><div class="pd-sub">${esc(COLL_LABEL[l.collection])}</div>`;
      const qte = svc ? esc(String(l.qty)) : l.mode === 'carton' ? `${esc(l.qty)} carton${num(l.qty) > 1 ? 's' : ''}<div class="pd-sub">${r.btl} flacons (${esc(l.perCarton)}/carton)</div>` : `${r.btl} flacon${r.btl > 1 ? 's' : ''}`;
      const pu = svc ? money(num(l.prix)) : money(num(l.prix)) + `<div class="pd-sub">${l.mode === 'carton' ? 'le carton' : 'le flacon'}</div>`;
      return `<tr><td>${design}</td><td class="r">${qte}</td><td class="r">${r.testers ? r.testers + ' offert' + (r.testers > 1 ? 's' : '') : '—'}</td><td class="r">${pu}</td><td class="r">${money(r.ca)}</td></tr>`;
    }).join('');
    const cad = CADEAUX.filter(a => num((d.cadeaux || {})[a]) > 0).map(a => `${a} : ${Math.round(num(d.cadeaux[a]))}`);
    const emetteur = [S.forme, S.adresse, S.cp_ville, S.pays].filter(Boolean).map(esc).join('<br>');
    const ids = [S.siret && 'SIRET ' + S.siret, S.tva && 'TVA ' + S.tva, S.tel, S.email].filter(Boolean).map(esc).join('<br>');
    const dates = d.type === 'facture'
      ? `<div><span>Date</span>${esc(isoToFr(d.date))}</div><div><span>Échéance</span>${esc(isoToFr(d.echeance))}</div>`
      : `<div><span>Date</span>${esc(isoToFr(d.date))}</div><div><span>Valable jusqu'au</span>${esc(isoToFr(d.validite))}</div>`;
    const mentions = [];
    if(k.regime.mention) mentions.push(k.regime.mention);
    if(d.conditions) mentions.push(esc(d.conditions));
    if(d.type === 'facture') mentions.push("En cas de retard de paiement : pénalités au taux de trois fois le taux d'intérêt légal et indemnité forfaitaire de 40 € pour frais de recouvrement (art. L441-10 du Code de commerce). Pas d'escompte pour paiement anticipé.");
    if(d.type === 'proforma') mentions.push('Facture proforma : document sans valeur comptable, ne constitue pas une facture.');
    const bank = S.iban ? `<div class="pd-bank"><strong>Coordonnées bancaires</strong><br>${esc(S.banque)}${S.banque ? '<br>' : ''}IBAN ${esc(S.iban)}${S.bic ? ' · BIC ' + esc(S.bic) : ''}</div>` : '';
    return `<div class="pd">
      <div class="pd-head">
        <div class="pd-brand"><img src="img/logo.png" alt=""><div class="pd-em"><strong>${esc(S.nom)}</strong><br>${emetteur}<div class="pd-ids">${ids}</div></div></div>
        <div class="pd-title"><h1>${t.titre}</h1><div class="pd-num">N° ${esc(d.numero)}</div><div class="pd-dates">${dates}</div>${d.source ? `<div class="pd-ref">Réf. ${esc(d.source)}</div>` : ''}</div>
      </div>
      <div class="pd-client"><div class="pd-label">${d.type === 'devis' ? 'Destinataire' : 'Facturé à'}</div><strong>${esc(d.client)}</strong><br>${esc(d.adresse).replace(/\n/g, '<br>')}${d.adresse ? '<br>' : ''}${esc(d.pays)}${d.tvaClient ? `<br>N° TVA : ${esc(d.tvaClient)}` : ''}</div>
      <table class="pd-table"><thead><tr><th>Désignation</th><th class="r">Quantité</th><th class="r">Testeurs</th><th class="r">Prix unitaire HT</th><th class="r">Montant HT</th></tr></thead><tbody>${lines}</tbody></table>
      <div class="pd-foot">
        <div class="pd-left">${cad.length ? `<div class="pd-gift"><strong>Offert avec la commande</strong><br>${cad.map(esc).join(' · ')}</div>` : ''}${bank}</div>
        <div class="pd-tot">
          <div><span>Total brut HT</span><span>${money(k.brut)}</span></div>
          ${k.remise ? `<div><span>Remise ${esc(String(d.remisePct).replace('.', ','))} %</span><span>${money(k.remise)}</span></div>` : ''}
          <div><span>Total HT</span><span>${money(k.ht)}</span></div>
          <div><span>${k.regime.taux ? 'TVA ' + k.regime.taux + ' %' : 'TVA'}</span><span>${k.regime.taux ? money(k.tva) : 'Exonérée'}</span></div>
          <div class="pd-net"><span>${d.type === 'devis' ? 'Total TTC' : 'Net à payer'}</span><span>${money(k.ttc)}</span></div>
        </div>
      </div>
      ${d.type === 'devis' ? '<div class="pd-sign"><div>Bon pour accord — date, signature et cachet du client</div></div>' : ''}
      <div class="pd-mentions">${mentions.map(m => `<p>${m}</p>`).join('')}</div>
      <div class="pd-legal">${[S.nom, S.forme, S.siret && 'SIRET ' + S.siret, S.rcs, S.ape && 'APE ' + S.ape, S.tva && 'TVA intracommunautaire ' + S.tva].filter(Boolean).map(esc).join(' · ')}</div>
    </div>`;
  }
  function showDoc(id){
    const d = docs.find(x => x.id === id); if(!d) return;
    $('docViewTitle').textContent = TYPES[d.type].label + ' ' + d.numero;
    $('docPaper').innerHTML = docHtml(d);
    $('docViewer').dataset.id = id;
    $('docViewer').classList.add('active');
  }
  function printDoc(id){
    const d = docs.find(x => x.id === id); if(!d) return;
    $('docPrint').innerHTML = docHtml(d);
    const old = document.title; document.title = `${TYPES[d.type].label} ${d.numero} - ${d.client}`;
    document.body.classList.add('printing-doc');
    const done = () => { document.body.classList.remove('printing-doc'); document.title = old; window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    window.print();
    setTimeout(done, 1500);
  }

  /* ---------- Réglages, sauvegarde, export ---------- */
  const SET_FIELDS = [['nom','Raison sociale'],['forme','Forme juridique'],['adresse','Adresse'],['cp_ville','Code postal et ville'],['pays','Pays'],['siret','SIRET'],['rcs','RCS'],['tva','N° TVA intracommunautaire'],['ape','Code APE'],['tel','Téléphone'],['email','E-mail'],['banque','Banque'],['iban','IBAN'],['bic','BIC'],['conditions','Conditions de paiement par défaut'],['validite','Validité des devis (jours)'],['echeance','Échéance des factures (jours)']];
  function openSettings(){
    $('docSetBody').innerHTML = `<div class="doc-grid">${SET_FIELDS.map(([k, l]) => `<label${k === 'conditions' ? ' class="span2"' : ''}>${l}<input data-s="${k}" value="${esc(SETT[k])}"></label>`).join('')}</div>`;
    $('docSettings').classList.add('active');
  }
  function saveSettings(){
    document.querySelectorAll('#docSetBody [data-s]').forEach(i => { SETT[i.dataset.s] = i.value.trim(); });
    saveSett(); $('docSettings').classList.remove('active');
  }
  function download(name, text, type){
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], {type:type || 'text/plain'}));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function exportVentes(){
    if(!integrated){ alert("Aucune nouvelle facture à intégrer : data/ventes.js est déjà à jour."); return; }
    const data = {}; Object.keys(ALL).forEach(k => { data[k] = ALL[k]; });
    download('ventes.js', '// Données de ventes (CA, clients, factures…) par année. Régénéré par le module Devis & Factures.\nconst ALL = ' + JSON.stringify(data, null, 1) + ';\n', 'text/javascript');
    alert(`Fichier ventes.js téléchargé (${integrated} nouvelle(s) facture(s)).\nRemplace dashboard-netlify/data/ventes.js par ce fichier, puis vérifie avec :\npython3 outils/rebuild_dashboard.py dashboard-netlify/data/ventes.js\nAjoute aussi ces factures au registre donnees_sources/FACTURES_20XX.md.`);
  }
  function backup(){ download('ej-documents-' + todayIso() + '.json', JSON.stringify({version:1, documents:docs, reglages:SETT}, null, 1), 'application/json'); }
  function restore(file){
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const o = JSON.parse(rd.result); const list = o.documents || [];
        let n = 0; list.forEach(d => { if(d && d.id && !docs.some(x => x.id === d.id)){ docs.push(d); n++; } });
        if(o.reglages && confirm('Restaurer aussi les coordonnées de la société ?')) SETT = Object.assign({}, DEFAULT_SETTINGS, o.reglages);
        saveDocs(); saveSett(); applyToDashboard(); renderList();
        alert(`${n} document(s) ajouté(s).`);
      } catch(e) { alert("Fichier de sauvegarde illisible."); }
    };
    rd.readAsText(file);
  }

  /* ---------- Événements ---------- */
  $('documents').addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if(!b) return;
    const id = b.dataset.id, act = b.dataset.act;
    if(act === 'new') openEditor(blankDoc(b.dataset.type));
    else if(act === 'view') showDoc(id);
    else if(act === 'edit'){ const d = docs.find(x => x.id === id); if(d){ if(d.type === 'facture' && !confirm("Une facture émise ne devrait normalement plus être modifiée (préférer un avoir). Modifier quand même ?")) return; openEditor(d); } }
    else if(act === 'dup'){ const s = docs.find(x => x.id === id); if(s){ const d = clone(s); const date = todayIso(); Object.assign(d, {id:'d' + Date.now().toString(36), numero:nextNumero(d.type, date), date, statut:TYPES[d.type].statuts[0], source:''}); openEditor(d); } }
    else if(act === 'convert') convert(id, b.dataset.to);
    else if(act === 'del'){
      const d = docs.find(x => x.id === id); if(!d) return;
      const msg = d.type === 'facture' ? `Supprimer la facture ${d.numero} ?\nLa numérotation des factures doit rester continue : en principe on établit un avoir plutôt que de supprimer.` : `Supprimer ${TYPES[d.type].label.toLowerCase()} ${d.numero} ?`;
      if(!confirm(msg)) return;
      docs = docs.filter(x => x.id !== id); saveDocs();
      if(d.type === 'facture') applyToDashboard();
      renderList();
    }
    else if(act === 'settings') openSettings();
    else if(act === 'export') exportVentes();
    else if(act === 'backup') backup();
    else if(act === 'restore') $('docRestoreFile').click();
  });
  $('docRestoreFile').addEventListener('change', e => { if(e.target.files[0]) restore(e.target.files[0]); e.target.value = ''; });
  $('docFilter').addEventListener('change', e => { filterType = e.target.value; renderList(); });
  $('docSearch').addEventListener('input', e => { filterText = e.target.value; renderList(); });

  const ed = $('docEditor');
  ed.addEventListener('input', onEdInput);
  ed.addEventListener('change', onEdInput);
  ed.addEventListener('click', e => {
    if(e.target === ed) return;
    const b = e.target.closest('[data-act]'); if(!b || !cur) return;
    const act = b.dataset.act;
    if(act === 'addline'){ const last = cur.lines[cur.lines.length - 1]; cur.lines.push(newLine(last && PARFUMS.includes(last.collection) ? last.collection : 'VIP', cur.pays)); renderEditor(); }
    else if(act === 'delline'){ cur.lines.splice(+b.closest('tr').dataset.i, 1); if(!cur.lines.length) cur.lines.push(newLine('VIP', cur.pays)); renderEditor(); }
    else if(act === 'sim') applySimulator();
    else if(act === 'save') saveCurrent();
    else if(act === 'saveview'){ const d = saveCurrent(); if(d) showDoc(d.id); }
    else if(act === 'close'){ if(confirm('Fermer sans enregistrer ?')) closeEditor(); }
  });
  $('docViewer').addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if(e.target.id === 'docViewer' || (b && b.dataset.act === 'vclose')) $('docViewer').classList.remove('active');
    else if(b && b.dataset.act === 'print') printDoc($('docViewer').dataset.id);
  });
  $('docSettings').addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if(e.target.id === 'docSettings' || (b && b.dataset.act === 'sclose')) $('docSettings').classList.remove('active');
    else if(b && b.dataset.act === 'ssave') saveSettings();
  });

  // Démarrage : intègre les factures déjà créées dans ce navigateur, puis affiche la liste.
  if(docs.some(d => d.type === 'facture' && !BASE_NUMS.has(d.numero))) applyToDashboard();
  renderList();
})();
