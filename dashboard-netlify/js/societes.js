/* ===================== SOCIÉTÉS : BSD (France) et NB EVOLUTION (Dubaï) =====================
   Le dashboard couvre deux sociétés :
   - BSD — Parfums Emmanuelle Jane (France) : fabrique et vend, notamment à NB Evolution.
   - NB Evolution (Dubaï) : revend à ses clients (factures NB…).
   Trois vues :
   - Groupe : chiffres consolidés, sans les ventes internes BSD -> NB (c'est la vue d'origine du dashboard).
   - BSD : ses ventes, y compris à NB Evolution (data/intragroupe.js).
   - NB Evolution : ses ventes ; son coût d'achat = ce que BSD lui a facturé.
   Les dépenses (charges fixes, fournisseurs, virements attendus) sont propres à chaque société. */
(function(){
  if(typeof ALL === 'undefined' || !window.EJ_REBUILD) return;
  const clone = o => JSON.parse(JSON.stringify(o));
  const R = window.EJ_REBUILD;

  /* ---------- Coordonnées des sociétés (valeurs par défaut, modifiables dans l'onglet Devis & Factures) ---------- */
  const SOCIETES = {
    BSD: {
      code:'BSD', label:'BSD · France', court:'BSD', nom:'B.S.D – PARFUMS EMMANUELLE JANE', sousTitre:'Parfums Emmanuelle Jane',
      forme:'SARL au capital de 100 000 €', adresse:'3, rue Robespierre', cp_ville:'94500 Champigny-sur-Marne', pays:'France',
      tel:'+33 (0)1 48 81 62 60', portable:'+33 (0)6 78 82 01 29', email:'said@emmanuellejane.com',
      siret:'532 707 684 00025', rcs:'RCS Créteil 532 707 684', naf:'4649Z', tva:'FR49532707684', licence:'', trn:'',
      banque:'BRED Joinville Polangis', iban:'FR76 1010 7002 1600 0250 3701 354', bic:'BREDFRPPXXX',
      conditions:'Paiement à réception de facture, par virement bancaire.', validite:30, echeance:30, prixTesteur:1
    },
    NB: {
      code:'NB', label:'NB Evolution · Dubaï', court:'NB Evolution', nom:'NB EVOLUTION', sousTitre:'Parfums Emmanuelle Jane',
      forme:'', adresse:'Dubai Silicon Oasis, DDP, Building A1', cp_ville:'Dubai', pays:'United Arab Emirates',
      tel:'', portable:'+33 7 85 04 22 07', email:'nassim@emmanuellejane.com',
      siret:'', rcs:'', naf:'', tva:'', licence:'30537', trn:'',
      banque:'WIO Bank', iban:'AE33 0860 0000 0939 7980 276', bic:'WIOBAEADXXX',
      conditions:'Payment by bank transfer before shipment.', validite:30, echeance:30, prixTesteur:1
    }
  };

  /* ---------- Codes EAN (relevés sur les factures BSD EJ2026029 et NB proforma NB2026012) ---------- */
  const EAN = {
    'VIP':{'Moon':'3760120371455','Dream Catcher':'3760120371462','Caftan':'3760120371820','Grey':'3760120370786','Red':'3760120370236','Oud Vanille':'3760120370519','Silver':'3760120370182','Regatus':'3760120371448','Elixir':'3760120371431','Piège':'3760120371516','Pure':'3760120370915','Rivière Noire':'3760120372131','Oud Berry':'3760120372124','Éclat de Vanille':'3760120372780'},
    'VIP BLACK':{'Éclat Vert':'3760120373084','Cœur de Sable':'3760120373107','Sublime':'3760120373121','Ciel Blanc':'3760120373152','Jardin Royal':'3760120373169','Harmonie':'3760120373091','Velours Rose':'3760120373183','Cuir Rouge':'3760120373114','Jour Doré':'3760120373138','Terre Noble':'3760120373145','Miel Royal':'3760120373176'},
    '50ML':{'Blais':'3760120372940','Vétiver':'3760120372964','Wild Cherry':'3760120372957',"L'Éloge d'Orient":'3760120372667','Bora Bora':'3760120372643','Golden Caramel':'3760120372650','Exotic Oud':'3760120372674','Santal Wood':'3760120372636'},
    'BRUMES':{'Butterfly Bloom':'3760120372858','Coco Shine':'3760120372803',"Comme l'Air":'3760120372889','Dolce Vita':'3760120372797','Fleur Sauvage':'3760120372872','Flower Bomb':'3760120372827','Gold Crush':'3760120372896','Last Night':'3760120372865','Love Moment':'3760120372810','Lovely Body':'3760120372841','Night Kiss':'3760120372834',"Fruit d'Amour":'3760120372933','Vanilla Desire':'3760120372919','Rose Pétale':'3760120372902'},
    'ROYAL':{'Milano Men':'3760120370274','Milano Women':'3760120370281','Uomo':'3760120370045','Milano Ultra':'3760120371721','Milano Renaissance':'3760120371714','Uomo Alternance':'3760120371707'}
    // Caramelia : le code imprimé sur la proforma NB2026012 (3760120372826) n'est pas un EAN-13 valide → à vérifier.
  };
  // Brumes à l'ancien format 265 ml (proforma EJ2025026 du 10/07/2025) : codes EAN différents du format 250 ml.
  // Vanilla Desire, Caramelia, Fruit d'Amour et Rose Pétale n'y figurent pas.
  const EAN_BRUMES_265 = {'Butterfly Bloom':'3760120371240','Coco Shine':'3760120371653',"Comme l'Air":'3760120371943','Dolce Vita':'3760120371578','Fleur Sauvage':'3760120371936',
    'Flower Bomb':'3760120370700','Gold Crush':'3760120371905','Last Night':'3760120371929','Love Moment':'3760120370830','Lovely Body':'3760120371912','Night Kiss':'3760120371233'};
  // Sources : factures EJ2026029 et NB2026012, proforma EJ2025026, planches d'étiquettes VIP Black 90 ml et 50 ml (20/05/2026).
  const eanOk = e => /^\d{13}$/.test(e) && (10 - [...e.slice(0, 12)].reduce((s, x, i) => s + (+x) * (i % 2 ? 3 : 1), 0) % 10) % 10 === +e[12];

  /* ---------- Données de base ---------- */
  const YEARS = ['2025', '2026'];
  const BASE = { '2025': clone(ALL['2025']), '2026': clone(ALL['2026']), 'total': clone(ALL['total']) };
  const INTRA = (typeof INTRAGROUPE !== 'undefined') ? INTRAGROUPE : [];
  const isNBNum = n => /^NB\d/.test(n || '');
  const isIntra = f => /^nb evolution/i.test(f.client || '');
  const clean = f => { const g = clone(f); delete g.annee; delete g.societe; return g; };
  const DEP = {
    BSD: {fixed:clone(FIXED_CHARGES), supplier:clone(SUPPLIER_INVOICES), pending:clone(PENDING_TRANSFERS)},
    NB: {fixed:clone(typeof FIXED_CHARGES_NB !== 'undefined' ? FIXED_CHARGES_NB : {updated:'', charges:[], salaires:[]}),
         supplier:clone(typeof SUPPLIER_INVOICES_NB !== 'undefined' ? SUPPLIER_INVOICES_NB : {updated:'', soldes:[], total_eur:0, total_goldrock_usd:0, total_goldrock_eur:0, months:[], goldrock:{status:'', lines:[]}}),
         pending:clone(typeof PENDING_TRANSFERS_NB !== 'undefined' ? PENDING_TRANSFERS_NB : {updated:'', total:0, items:[]})}
  };

  // Coût d'achat de NB = montant facturé par BSD, ventilé sur les lignes par référence (sinon au prorata du CA).
  function withPurchase(f, purchase){
    const g = clone(f);
    if(!purchase) return g;
    const P = purchase.lines.reduce((s, l) => s + (l.ca || 0), 0);
    const pk = new Map(); purchase.lines.forEach(l => { const k = l.collection + '|' + l.reference; pk.set(k, (pk.get(k) || 0) + (l.ca || 0)); });
    const lines = g.lines.filter(l => l.mode !== 'remise');
    const sk = new Map(); lines.forEach(l => { const k = l.collection + '|' + l.reference; sk.set(k, (sk.get(k) || 0) + (l.ca || 0)); });
    const matched = [...pk.keys()].filter(k => sk.has(k)).reduce((s, k) => s + pk.get(k), 0);
    const byKey = Math.abs(matched - P) < 0.05;
    const caTot = lines.reduce((s, l) => s + (l.ca || 0), 0) || 1;
    g.lines.forEach(l => {
      if(l.mode === 'remise'){ l.cout = 0; }
      else if(byKey){ const k = l.collection + '|' + l.reference; l.cout = Math.round(pk.get(k) * ((l.ca || 0) / (sk.get(k) || 1)) * 10000) / 10000; }
      else { l.cout = Math.round(P * (l.ca || 0) / caTot * 10000) / 10000; }
      l.marge = Math.round(((l.ca || 0) - l.cout) * 10000) / 10000;
    });
    g.cout = Math.round(g.lines.reduce((s, l) => s + l.cout, 0) * 10000) / 10000;
    g.marge = Math.round((g.ca - g.cout) * 10000) / 10000;
    g.achat = purchase.facture;
    return g;
  }

  /* ---------- Vue courante ---------- */
  const VIEW_KEY = 'ej_vue_societe';
  let view = 'groupe';
  try { view = localStorage.getItem(VIEW_KEY) || 'groupe'; } catch(e) {}
  if(!['groupe', 'BSD', 'NB'].includes(view)) view = 'groupe';
  let local = [];   // factures créées dans l'onglet Devis & Factures (format ALL, avec .societe)

  const yearOf = f => f.annee || String(f.date || '').slice(6);
  function setsFor(v){
    const out = {};
    const intraLocal = local.filter(f => f.societe === 'BSD' && isIntra(f));
    const purchaseOf = num => INTRA.find(x => x.facture === num) || intraLocal.find(x => x.facture === num);
    const intraByLien = new Map(INTRA.map(x => [x.lien, x]));
    YEARS.forEach(y => {
      const base = BASE[y].factures, L = local.filter(f => yearOf(f) === y);
      if(v === 'groupe') out[y] = base.concat(L.filter(f => f.societe === 'NB' || !isIntra(f)).map(clean));
      else if(v === 'BSD') out[y] = base.filter(f => !isNBNum(f.facture)).concat(INTRA.filter(f => yearOf(f) === y).map(clean)).concat(L.filter(f => f.societe === 'BSD').map(clean));
      else out[y] = base.filter(f => isNBNum(f.facture)).map(f => withPurchase(f, intraByLien.get(f.facture) || (f.lien ? purchaseOf(f.lien) : null)))
        .concat(L.filter(f => f.societe === 'NB').map(f => clean(withPurchase(f, f.lien ? purchaseOf(f.lien) : null))));
    });
    return out;
  }
  function todayUTC(){ const d = new Date(); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); }

  function mutate(target, src){ Object.keys(target).forEach(k => delete target[k]); Object.assign(target, clone(src)); }
  const tag = (list, who) => list.map(x => Object.assign({}, x, {label:who + ' — ' + x.label}));
  function depensesFor(v){
    if(v !== 'groupe') return DEP[v];
    const B = DEP.BSD, N = DEP.NB;
    const nbHas = N.fixed.charges.length + N.fixed.salaires.length + N.supplier.months.length + N.supplier.goldrock.lines.length + N.pending.items.length > 0;
    if(!nbHas) return B;
    return {
      fixed:{updated:B.fixed.updated, charges:tag(B.fixed.charges, 'BSD').concat(tag(N.fixed.charges, 'NB')), salaires:tag(B.fixed.salaires, 'BSD').concat(tag(N.fixed.salaires, 'NB'))},
      supplier:Object.assign({}, B.supplier, {total_eur:B.supplier.total_eur + N.supplier.total_eur, total_goldrock_usd:B.supplier.total_goldrock_usd + N.supplier.total_goldrock_usd,
        total_goldrock_eur:B.supplier.total_goldrock_eur + N.supplier.total_goldrock_eur,
        months:B.supplier.months.map(m => Object.assign({}, m, {name:'BSD — ' + m.name})).concat(N.supplier.months.map(m => Object.assign({}, m, {name:'NB — ' + m.name}))),
        goldrock:{status:B.supplier.goldrock.status, lines:B.supplier.goldrock.lines.concat(N.supplier.goldrock.lines)}}),
      pending:{updated:B.pending.updated, total:B.pending.total + N.pending.total, items:tag(B.pending.items, 'BSD').concat(tag(N.pending.items, 'NB'))}
    };
  }

  const NOTES = {
    groupe:"Vue consolidée BSD + NB Evolution : ventes aux clients finaux, sans les ventes internes BSD → NB (pas de double comptage). Dépenses : BSD + NB.",
    BSD:"BSD seule : toutes ses factures, y compris ses ventes à NB Evolution (prix négociés). Dépenses : compte BRED de BSD.",
    NB:"NB Evolution seule : ses ventes aux clients ; le coût de revient affiché est son prix d'achat facturé par BSD. Dépenses NB : à renseigner dans data/depenses-nb.js."
  };

  function apply(v){
    if(v) { view = v; try { localStorage.setItem(VIEW_KEY, view); } catch(e) {} }
    const inRange = local.filter(f => YEARS.includes(yearOf(f)));
    if(view === 'groupe' && !inRange.some(f => f.societe === 'NB' || !isIntra(f))){
      YEARS.concat(['total']).forEach(y => { ALL[y] = clone(BASE[y]); });
    } else {
      const s = setsFor(view);
      const Rb = R.rebuildAll(s['2025'], s['2026'], todayUTC());
      YEARS.concat(['total']).forEach(y => { ALL[y] = Rb[y]; });
    }
    const D = depensesFor(view);
    mutate(FIXED_CHARGES, D.fixed); mutate(SUPPLIER_INVOICES, D.supplier); mutate(PENDING_TRANSFERS, D.pending);
    document.querySelectorAll('.soc-btn').forEach(b => b.classList.toggle('active', b.dataset.soc === view));
    const note = document.getElementById('socNote'); if(note) note.textContent = NOTES[view];
    document.body.dataset.societe = view;
    if(typeof renderAll === 'function') renderAll();
  }

  // Données « groupe » à jour pour l'export (data/ventes.js et data/intragroupe.js)
  function exportData(){
    const s = setsFor('groupe');
    const Rb = R.rebuildAll(s['2025'], s['2026'], todayUTC());
    const all = {}; Object.keys(ALL).forEach(k => { all[k] = YEARS.concat(['total']).includes(k) ? Rb[k] : ALL[k]; });
    const newIntra = local.filter(f => f.societe === 'BSD' && isIntra(f) && !INTRA.some(x => x.facture === f.facture))
      .map(f => { const g = clean(f); g.annee = yearOf(f); return g; });
    return {all, intra:INTRA.concat(newIntra), nIntra:newIntra.length};
  }

  document.querySelectorAll('.soc-btn').forEach(b => b.addEventListener('click', () => apply(b.dataset.soc)));

  window.EJ_SOC = {
    SOCIETES, EAN, EAN_BRUMES_265, eanOk, isIntra, isNBNum, INTRA, BASE,
    get view(){ return view; },
    setLocal(list){ local = list || []; },
    apply, exportData,
    baseNumbers:() => new Set(BASE['2025'].factures.concat(BASE['2026'].factures).map(f => f.facture).concat(INTRA.map(f => f.facture)))
  };
})();
