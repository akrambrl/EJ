/* ===================== DEVIS, PROFORMAS & FACTURES (BSD et NB EVOLUTION) =====================
   Documents commerciaux des deux sociétés, imprimables en PDF (navigateur).
   - Devis et proformas : n'entrent pas dans le CA.
   - Factures : intégrées aux chiffres (vues Groupe / BSD / NB, cf. js/societes.js), tous les agrégats
     étant recalculés par js/rebuild.js (portage exact de outils/rebuild_dashboard.py).
   - Testeurs : valorisés (1 € par défaut) pour la douane puis déduits automatiquement par une ligne
     de remise du même montant — sans effet sur le CA.
   Enregistrement dans ce navigateur (localStorage) ; « Exporter les données » produit data/ventes.js et
   data/intragroupe.js à jour pour rendre les nouvelles factures permanentes. */
(function(){
  if(typeof ALL === 'undefined' || !window.EJ_SOC) return;
  const SOC = window.EJ_SOC;

  const DOC_KEY = 'ej_documents_v1', SET_KEY = 'ej_documents_settings_v2', SIM_KEY = 'ej-simulateur-v3';
  const clone = o => JSON.parse(JSON.stringify(o));
  const esc = s => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const r2 = x => Math.round((x + Number.EPSILON) * 100) / 100;
  const r4 = x => Math.round((x + Number.EPSILON) * 10000) / 10000;
  const num = v => { const n = parseFloat(String(v == null ? '' : v).replace(/\s/g,'').replace(',', '.')); return isNaN(n) ? 0 : n; };
  const money = n => (n || 0).toLocaleString('fr-FR', {minimumFractionDigits:2, maximumFractionDigits:2}) + ' €';
  const pad = (n, w) => String(n).padStart(w || 2, '0');
  const sum = (arr, f) => arr.reduce((a, x) => a + f(x), 0);
  const load = (k, d) => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : d; } catch(e) { return d; } };
  const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e) { alert("Enregistrement impossible dans ce navigateur (stockage plein ou désactivé)."); } };
  const DAY = 86400000;
  const fmtEan = e => /^\d{13}$/.test(e || '') ? e.replace(/^(\d)(\d{3})(\d{3})(\d{3})(\d{3})$/, '$1 $2 $3 $4 $5') : (e || '');
  const pdate = window.EJ_REBUILD.pdate;

  const BASE_FACT = SOC.BASE['2025'].factures.concat(SOC.BASE['2026'].factures);
  const BASE_NUMS = SOC.baseNumbers();
  // Numéros déjà utilisés sur papier mais absents des données (ex. proforma NB2026012 du 01/10/2026).
  const NUMEROS_PAPIER = ['NB2026010', 'NB2026011', 'NB2026012'];

  /* ---------- Catalogue, tarifs, coûts ---------- */
  const PARFUMS = ['VIP','VIP BLACK','50ML','BRUMES','ROYAL'];
  const COLLECTIONS = PARFUMS.concat(['TRANSPORT','SERVICE']);
  const COLL = {
    'VIP':{fr:'Collection VIP', en:'VIP COLLECTION', court:'VIP 90 ml', ml:'90 ml'},
    'VIP BLACK':{fr:'Collection VIP Black', en:'VIP BLACK COLLECTION', court:'VIP Black 90 ml', ml:'90 ml'},
    '50ML':{fr:'Collection VIP Black 50 ml', en:'BLACK COLLECTION 50 ML', court:'VIP Black 50 ml', ml:'50 ml'},
    'BRUMES':{fr:'Brumes', en:'BODY SPRAY', court:'Brumes 250 ml', ml:'250 ml'},
    'ROYAL':{fr:'Collection Royal', en:'ROYAL COLLECTION', court:'Royal 100 ml', ml:'100 ml'},
    'TRANSPORT':{fr:'Transport', en:'SHIPPING', court:'Transport', ml:''},
    'SERVICE':{fr:'Autres prestations', en:'OTHER SERVICES', court:'Service / autre', ml:''}
  };
  const REFS = {};
  PARFUMS.forEach(c => {
    const s = new Set();
    ((ALL.costs[c] || {}).refs || []).forEach(r => s.add(r.name));
    (((ALL.stock || {})[c] || {}).items || []).forEach(i => s.add(i.reference));
    REFS[c] = [...s].sort((a, b) => a.localeCompare(b, 'fr'));
  });
  const perCartonDefault = c => (ALL.costs[c] && ALL.costs[c].units_sold_per_carton) || (typeof CARTON_INFO !== 'undefined' && CARTON_INFO[c] ? CARTON_INFO[c].size : 1);
  const priceDefault = (c, mode) => { const ci = (typeof CARTON_INFO !== 'undefined' && CARTON_INFO[c]) || {}; return mode === 'unite' ? (ci.price_btl || 0) : (ci.price_carton || 0); };
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
  const CADEAUX_EN = {'Sacs noirs':'Black bags','Paquets de mouillettes':'Packs of blotters','Catalogues':'Catalogues','Échantillons 2ml':'2 ml samples'};
  const LAST_PAYS = {};
  BASE_FACT.slice().sort((a, b) => pdate(a.date) - pdate(b.date)).forEach(f => { LAST_PAYS[f.client] = f.pays; });

  /* ---------- Réglages (par société) ---------- */
  let SETT = load(SET_KEY, null);
  if(!SETT){ SETT = {societes:{}, clients:{}, ean:{}}; const old = load('ej_documents_settings_v1', null); if(old) SETT.clients = old.clients || {}; }
  SETT.societes = SETT.societes || {}; SETT.clients = SETT.clients || {}; SETT.ean = SETT.ean || {};
  const soc = code => Object.assign({}, SOC.SOCIETES[code], SETT.societes[code] || {});
  let docs = load(DOC_KEY, []);
  if(!Array.isArray(docs)) docs = [];
  docs.forEach(d => { if(!d.societe) d.societe = 'BSD'; if(!d.langue) d.langue = 'fr'; if(d.prixTesteur == null) d.prixTesteur = 0; });
  const saveDocs = () => store(DOC_KEY, docs);
  const saveSett = () => store(SET_KEY, SETT);
  const eanOf = (col, ref, fmt) => (col === 'BRUMES' && fmt === '265')
    ? (SETT.ean['BRUMES265|' + ref] || SOC.EAN_BRUMES_265[ref] || '')
    : (SETT.ean[col + '|' + ref] || ((SOC.EAN[col] || {})[ref]) || '');
  const mlOf = l => l.collection === 'BRUMES' ? (l.format === '265' ? '265 ml' : '250 ml') : COLL[l.collection].ml;

  const TYPES = {
    devis:{label:'Devis', fr:'DEVIS', en:'QUOTATION', statuts:['Brouillon','Envoyé','Accepté','Refusé','Converti']},
    proforma:{label:'Proforma', fr:'FACTURE PROFORMA', en:'PROFORMA', statuts:['Brouillon','Envoyée','Acompte reçu','Convertie']},
    facture:{label:'Facture', fr:'FACTURE', en:'INVOICE', statuts:['À encaisser','Payée']}
  };
  const UE = ['Allemagne','Autriche','Belgique','Bulgarie','Chypre','Croatie','Danemark','Espagne','Estonie','Finlande','Grèce','Hongrie','Irlande','Italie','Lettonie','Lituanie','Luxembourg','Malte','Pays-Bas','Pologne','Portugal','Roumanie','Slovaquie','Slovénie','Suède','Tchéquie','République tchèque'];
  const EAU = ['Émirats Arabes Unis','Emirats Arabes Unis','EAU','United Arab Emirates','UAE'];
  const REGIMES = {
    BSD:{
      export:{label:'Export hors UE — exonéré', taux:0, fr:'Exonération de TVA — exportation hors Union européenne (article 262 I du CGI).', en:'VAT exempt — export outside the European Union (article 262 I of the French Tax Code).'},
      intra:{label:'Livraison intracommunautaire — exonéré', taux:0, fr:'Exonération de TVA — livraison intracommunautaire (article 262 ter I du CGI). Autoliquidation par le preneur.', en:'VAT exempt — intra-Community supply (article 262 ter I of the French Tax Code). Reverse charge: VAT to be accounted for by the customer.'},
      fr:{label:'France — TVA 20 %', taux:20, fr:'', en:''}
    },
    NB:{
      export:{label:'Export hors EAU — TVA 0 %', taux:0, fr:'TVA 0 % — exportation de biens hors des Émirats arabes unis.', en:'VAT 0% — export of goods outside the United Arab Emirates.'},
      ae:{label:'Émirats — TVA 5 %', taux:5, fr:'', en:''}
    }
  };
  const regimeFor = (s, pays) => s === 'NB' ? (EAU.includes(pays) ? 'ae' : 'export') : (pays === 'France' ? 'fr' : UE.includes(pays) ? 'intra' : 'export');
  const regimeOf = d => REGIMES[d.societe][d.regime] || REGIMES[d.societe][Object.keys(REGIMES[d.societe])[0]];

  /* ---------- Dates ---------- */
  const todayIso = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  const isoToFr = s => { const [y, m, d] = String(s || '').split('-'); return d ? `${d}/${m}/${y}` : ''; };
  const addDaysIso = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d) + n * DAY); return t.getUTCFullYear() + '-' + pad(t.getUTCMonth() + 1) + '-' + pad(t.getUTCDate()); };

  /* ---------- Numérotation ---------- */
  // BSD : factures EJ2026xxx (suite des factures existantes), proformas PF2026-xxx, devis DV2026-xxx.
  // NB  : factures et proformas dans la même série NB2026xxx (comme la proforma NB2026012), devis NBDV2026-xxx.
  function nextNumero(s, type, iso){
    const year = (iso || todayIso()).slice(0, 4);
    const seq = (s === 'BSD' && type === 'facture') ? 'EJ' + year : (s === 'NB' && type !== 'devis') ? 'NB' + year : null;
    if(seq){
      const re = new RegExp('^' + seq + '(\\d{3})$');
      let max = 0;
      [...BASE_NUMS].concat(NUMEROS_PAPIER).concat(docs.map(d => d.numero)).forEach(n => { const m = re.exec(n || ''); if(m) max = Math.max(max, +m[1]); });
      return seq + pad(max + 1, 3);
    }
    const pre = (s === 'NB' ? 'NBDV' : type === 'devis' ? 'DV' : 'PF') + year + '-';
    let max = 0;
    docs.filter(d => String(d.numero).startsWith(pre)).forEach(d => { max = Math.max(max, parseInt(String(d.numero).slice(pre.length), 10) || 0); });
    return pre + pad(max + 1, 3);
  }

  /* ---------- Calculs ---------- */
  const isSvc = l => l.collection === 'TRANSPORT' || l.collection === 'SERVICE';
  function lineCalc(l){
    const qty = num(l.qty), prix = num(l.prix);
    if(isSvc(l)){ const ca = r2(qty * prix); return {btl:0, testers:0, cartons:0, ca, cout:0, marge:ca}; }
    const cartons = l.mode === 'carton' ? qty : 0;
    const btl = l.mode === 'carton' ? Math.round(qty * num(l.perCarton)) : Math.round(qty);
    const testers = Math.round(num(l.testers));
    const ca = r2(qty * prix);
    const cout = r4(unitCost(l.collection, l.reference) * (btl + testers));
    return {btl, testers, cartons, ca, cout, marge:r4(ca - cout)};
  }
  function docCalc(d){
    const rows = d.lines.map(l => Object.assign({src:l}, lineCalc(l)));
    const pt = num(d.prixTesteur);                       // valeur douane d'un testeur
    const testersByColl = {};
    rows.forEach(r => { if(!isSvc(r.src) && r.testers) testersByColl[r.src.collection] = (testersByColl[r.src.collection] || 0) + r.testers; });
    const produits = r2(sum(rows, r => r.ca));
    const testersVal = pt ? r2(sum(Object.values(testersByColl), n => n * pt)) : 0;
    const brut = r2(produits + testersVal);
    const remiseTesteurs = -testersVal;                  // déduction automatique : les testeurs restent gratuits
    const remiseCom = num(d.remiseMontant) > 0 ? -r2(num(d.remiseMontant)) : (num(d.remisePct) ? -r2(produits * num(d.remisePct) / 100) : 0);
    const remise = r2(remiseTesteurs + remiseCom);
    const ht = r2(brut + remise);
    const regime = regimeOf(d);
    const tva = r2(ht * regime.taux / 100);
    return {rows, testersByColl, pt, produits, testersVal, brut, remiseTesteurs, remiseCom, remise, ht, tva, ttc:r2(ht + tva), regime,
      btl:sum(rows, r => r.btl), testers:sum(rows, r => r.testers), cout:r4(sum(rows, r => r.cout))};
  }
  const remiseLabel = (d, lg) => num(d.remiseMontant) > 0 ? (lg === 'en' ? 'Discount' : 'Remise') : `${lg === 'en' ? 'Discount' : 'Remise'} ${String(d.remisePct).replace('.', ',')} %`;
  // Facture -> format ALL[année].factures (cf. CLAUDE.md), avec .societe (et .lien pour un achat NB).
  // La valeur douane des testeurs et sa déduction s'annulent : elles ne sont pas reportées dans les chiffres.
  function toInvoice(d){
    const k = docCalc(d);
    const lines = k.rows.filter(r => num(r.src.qty) > 0).map(r => {
      const l = r.src;
      return {collection:l.collection, reference:l.reference || COLL[l.collection].fr, mode:isSvc(l) ? (l.collection === 'TRANSPORT' ? 'transport' : 'service') : l.mode,
        cartons:r.cartons, btl:r.btl, testers:r.testers, prix:num(l.prix), ca:r.ca, cout:r.cout, marge:r.marge};
    });
    if(k.remiseCom) lines.push({collection:'REMISE', reference:remiseLabel(d, 'fr'), mode:'remise', cartons:0, btl:0, testers:0, prix:k.remiseCom, ca:k.remiseCom, cout:0, marge:k.remiseCom});
    const inv = {facture:d.numero, date:isoToFr(d.date), client:d.client.trim(), pays:d.pays.trim(),
      btl:sum(lines, l => l.btl), ca:r2(sum(lines, l => l.ca)), cout:r4(sum(lines, l => l.cout)), marge:0, lines};
    inv.marge = r4(inv.ca - inv.cout);
    const cad = CADEAUX.filter(a => num((d.cadeaux || {})[a]) > 0).map(a => ({article:a, quantite:Math.round(num(d.cadeaux[a]))}));
    if(cad.length) inv.cadeaux = cad;
    inv.societe = d.societe;
    if(d.societe === 'NB' && d.lien) inv.lien = d.lien;
    return inv;
  }

  /* ---------- Intégration aux chiffres ---------- */
  const localInvoices = () => docs.filter(d => d.type === 'facture' && !BASE_NUMS.has(d.numero) && d.client && d.date).map(toInvoice);
  function sync(){ SOC.setLocal(localInvoices()); SOC.apply(); }

  /* ---------- Liste ---------- */
  const $ = id => document.getElementById(id);
  let filterType = 'all', filterSoc = 'all', filterText = '';
  function statusClass(s){ return /pay|accept|acompte|conver/i.test(s || '') ? 'ok' : /refus/i.test(s || '') ? 'ko' : ''; }
  function renderList(){
    const q = filterText.toLowerCase();
    const list = docs.filter(d => (filterType === 'all' || d.type === filterType) && (filterSoc === 'all' || d.societe === filterSoc) && (!q || (d.numero + ' ' + d.client + ' ' + d.pays).toLowerCase().includes(q)))
      .sort((a, b) => (b.date || '').localeCompare(a.date || '') || String(b.numero).localeCompare(String(a.numero)));
    $('docList').innerHTML = list.map(d => {
      const k = docCalc(d), t = TYPES[d.type];
      const conv = d.type === 'devis' ? `<button class="doc-btn small" data-act="convert" data-to="proforma" data-id="${d.id}">→ Proforma</button><button class="doc-btn small" data-act="convert" data-to="facture" data-id="${d.id}">→ Facture</button>`
        : d.type === 'proforma' ? `<button class="doc-btn small" data-act="convert" data-to="facture" data-id="${d.id}">→ Facture</button>` : '';
      return `<tr>
        <td><span class="doc-soc doc-soc-${d.societe}">${d.societe === 'NB' ? 'NB' : 'BSD'}</span></td>
        <td><span class="doc-type doc-type-${d.type}">${t.label}</span></td>
        <td><strong>${esc(d.numero)}</strong>${d.source ? `<div class="doc-sub">depuis ${esc(d.source)}</div>` : ''}${d.lien ? `<div class="doc-sub">achat BSD ${esc(d.lien)}</div>` : ''}</td>
        <td>${esc(isoToFr(d.date))}</td>
        <td>${esc(d.client)}<div class="doc-sub">${esc(d.pays)}${d.societe === 'BSD' && SOC.isIntra(d) ? ' · vente interne au groupe' : ''}</div></td>
        <td class="text-right">${money(k.ht)}</td>
        <td><span class="doc-status ${statusClass(d.statut)}">${esc(d.statut || '')}</span></td>
        <td class="doc-actions"><button class="doc-btn small" data-act="view" data-id="${d.id}">Voir / PDF</button><button class="doc-btn small" data-act="edit" data-id="${d.id}">Modifier</button>${conv}<button class="doc-btn small" data-act="dup" data-id="${d.id}">Dupliquer</button><button class="doc-btn small danger" data-act="del" data-id="${d.id}">Supprimer</button></td>
      </tr>`;
    }).join('') || `<tr><td colspan="8" class="text-center" style="padding:28px;color:var(--muted)">Aucun document pour l'instant. Choisis la société puis « Nouveau devis », « Nouvelle proforma » ou « Nouvelle facture ».</td></tr>`;
    const loc = localInvoices();
    const by = s => loc.filter(f => f.societe === s).length;
    $('docStatus').innerHTML = `${docs.length} document${docs.length > 1 ? 's' : ''} enregistré${docs.length > 1 ? 's' : ''} dans ce navigateur · `
      + (loc.length ? `<strong>nouvelles factures dans les chiffres : BSD ${by('BSD')} · NB ${by('NB')}</strong> · pense à <strong>exporter les données</strong> pour les rendre permanentes` : 'aucune nouvelle facture dans les chiffres');
  }

  /* ---------- Éditeur ---------- */
  let cur = null;
  const newId = () => 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  function blankDoc(type, s){
    const S = soc(s), date = todayIso();
    return {id:newId(), societe:s, type, numero:nextNumero(s, type, date), date, langue:s === 'NB' ? 'en' : 'fr',
      validite:addDaysIso(date, +S.validite || 30), echeance:addDaysIso(date, +S.echeance || 30),
      client:'', pays:'', adresse:'', tvaClient:'', regime:Object.keys(REGIMES[s])[0], remisePct:0, remiseMontant:0, prixTesteur:num(S.prixTesteur),
      cadeaux:{}, notes:'', conditions:S.conditions, lien:'', statut:TYPES[type].statuts[0], lines:[newLine('VIP', '')]};
  }
  function newLine(col, pays){
    return {collection:col, reference:'', ean:'', mode:'carton', qty:1, perCarton:perCartonDefault(col), prix:priceDefault(col, 'carton'), testers:testerAuto(col, 'carton', 1, pays), autoT:true};
  }
  function testerAuto(col, mode, qty, pays){
    if(mode !== 'carton' || !PARFUMS.includes(col)) return 0;
    return Math.round(num(qty)) * (col === 'BRUMES' && pays === 'Russie' ? 2 : 1);
  }
  function openEditor(d){ cur = clone(d); renderEditor(); $('docEditor').classList.add('active'); }
  function closeEditor(){ $('docEditor').classList.remove('active'); cur = null; }

  function intraChoices(){
    const fromBase = SOC.INTRA.map(f => ({n:f.facture, l:`${f.facture} — ${f.client} — ${money(f.ca)}`}));
    const fromDocs = docs.filter(d => d.type === 'facture' && d.societe === 'BSD' && SOC.isIntra(d)).map(d => ({n:d.numero, l:`${d.numero} — ${d.client} — ${money(docCalc(d).ht)}`}));
    return fromDocs.reverse().concat(fromBase.reverse());
  }
  function renderEditor(){
    const d = cur, t = TYPES[d.type];
    $('docEdTitle').textContent = (docs.some(x => x.id === d.id) ? 'Modifier — ' : 'Nouveau — ') + t.label + ' ' + (d.societe === 'NB' ? 'NB Evolution' : 'BSD');
    const clients = [...new Set(BASE_FACT.map(f => f.client).concat(docs.map(x => x.client)).concat(Object.keys(SETT.clients)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
    const paysList = [...new Set(BASE_FACT.map(f => f.pays).concat(UE).concat(['France', 'Émirats Arabes Unis', 'Israël']))].sort((a, b) => a.localeCompare(b, 'fr'));
    const opt = (v, c, lbl) => `<option value="${esc(v)}"${String(v) === String(c) ? ' selected' : ''}>${esc(lbl || v)}</option>`;
    $('docEdBody').innerHTML = `
      <div class="doc-grid">
        <label>Société<select data-f="societe">${opt('BSD', d.societe, 'BSD · France')}${opt('NB', d.societe, 'NB Evolution · Dubaï')}</select></label>
        <label>Type<select data-f="type">${Object.keys(TYPES).map(k => opt(k, d.type, TYPES[k].label)).join('')}</select></label>
        <label>Numéro<input data-f="numero" value="${esc(d.numero)}"></label>
        <label>Date<input type="date" data-f="date" value="${esc(d.date)}"></label>
        ${d.type === 'facture' ? `<label>Échéance<input type="date" data-f="echeance" value="${esc(d.echeance)}"></label>` : `<label>Valable jusqu'au<input type="date" data-f="validite" value="${esc(d.validite)}"></label>`}
        <label>Statut<select data-f="statut">${t.statuts.map(s => opt(s, d.statut)).join('')}</select></label>
        <label>Langue du document<select data-f="langue">${opt('fr', d.langue, 'Français')}${opt('en', d.langue, 'English')}</select></label>
      </div>
      <h3 class="doc-h3">Client</h3>
      <div class="doc-grid">
        <label class="span2">Nom du client<input data-f="client" list="docClients" value="${esc(d.client)}" placeholder="${d.societe === 'BSD' ? 'Ex. Arzum Group MMC — ou NB Evolution (…) pour une vente au groupe' : 'Ex. Oud House Ltd'}"></label>
        <label>Pays<input data-f="pays" list="docPays" value="${esc(d.pays)}"></label>
        <label>${d.societe === 'NB' ? 'N° société / TVA du client' : 'N° TVA du client'}<input data-f="tvaClient" value="${esc(d.tvaClient)}" placeholder="${d.societe === 'BSD' ? 'Obligatoire en intra-UE' : ''}"></label>
        <label class="span2">Adresse<textarea data-f="adresse" rows="2">${esc(d.adresse)}</textarea></label>
        <label class="span2">TVA<select data-f="regime">${Object.keys(REGIMES[d.societe]).map(k => opt(k, d.regime, REGIMES[d.societe][k].label)).join('')}</select></label>
        ${d.societe === 'NB' && d.type === 'facture' ? `<label class="span2">Facture d'achat BSD correspondante (coût de NB)<select data-f="lien"><option value="">— aucune / coût de fabrication —</option>${intraChoices().map(o => opt(o.n, d.lien, o.l)).join('')}</select></label>` : ''}
      </div>
      ${d.societe === 'BSD' && SOC.isIntra(d) ? `<div class="info-box" style="margin-top:4px">Vente de BSD à NB Evolution : comptée dans la vue BSD, exclue de la vue Groupe (vente interne).</div>` : ''}
      <datalist id="docClients">${clients.map(c => `<option value="${esc(c)}">`).join('')}</datalist>
      <datalist id="docPays">${paysList.map(c => `<option value="${esc(c)}">`).join('')}</datalist>
      ${PARFUMS.map(c => `<datalist id="docRefs-${c.replace(/\s/g, '')}">${REFS[c].map(r => `<option value="${esc(r)}">`).join('')}</datalist>`).join('')}
      <h3 class="doc-h3">Lignes</h3>
      <div class="doc-table-wrap"><table class="doc-lines">
        <thead><tr><th>Collection</th><th>Référence</th><th>EAN</th><th>Vente</th><th class="text-right">Qté</th><th class="text-right">Fl./ctn</th><th class="text-right">Testeurs</th><th class="text-right">Prix HT</th><th class="text-right">Total HT</th><th></th></tr></thead>
        <tbody>${d.lines.map((l, i) => lineRow(l, i)).join('')}</tbody>
      </table></div>
      <div class="doc-row-actions"><button class="doc-btn" data-act="addline">+ Ajouter une ligne</button><button class="doc-btn" data-act="sim">Appliquer la grille du simulateur d'offres</button><span id="docSimMsg" class="doc-sub"></span></div>
      <div class="doc-grid doc-grid-bottom">
        <div>
          <h3 class="doc-h3">Testeurs, remise et cadeaux</h3>
          <div class="doc-grid">
            <label>Valeur douane d'un testeur (€)<input type="number" step="0.01" min="0" data-f="prixTesteur" value="${esc(d.prixTesteur)}"></label>
            <label>Remise commerciale (%)<input type="number" step="0.5" min="0" data-f="remisePct" value="${esc(d.remisePct)}"></label>
            <label>ou remise (montant €)<input type="number" step="0.01" min="0" data-f="remiseMontant" value="${esc(d.remiseMontant || '')}" placeholder="0"></label>
            ${CADEAUX.map(a => `<label>${esc(a)}<input type="number" min="0" step="1" data-cad="${esc(a)}" value="${esc((d.cadeaux || {})[a] || '')}" placeholder="0"></label>`).join('')}
          </div>
          <p class="doc-sub">Les testeurs apparaissent sur le document à leur valeur douane, puis sont déduits automatiquement dans la remise : ils restent gratuits et n'entrent pas dans le CA.</p>
          <label class="doc-full">Conditions / mentions<textarea data-f="conditions" rows="2">${esc(d.conditions)}</textarea></label>
          <label class="doc-full">Notes internes (non imprimées)<textarea data-f="notes" rows="2">${esc(d.notes)}</textarea></label>
        </div>
        <div class="doc-totals" id="docTotals"></div>
      </div>`;
    updateTotals();
  }
  function lineRow(l, i){
    const svc = isSvc(l), k = lineCalc(l);
    const eanBad = l.ean && !SOC.eanOk(l.ean);
    return `<tr data-i="${i}">
      <td><select data-l="collection">${COLLECTIONS.map(c => `<option value="${c}"${c === l.collection ? ' selected' : ''}>${esc(COLL[c].court)}</option>`).join('')}</select></td>
      <td><input data-l="reference" value="${esc(l.reference)}" ${svc ? 'placeholder="Désignation"' : `list="docRefs-${l.collection.replace(/\s/g, '')}" placeholder="Référence"`}></td>
      <td>${svc ? '' : `<input class="ean${eanBad ? ' bad' : ''}" data-l="ean" value="${esc(l.ean)}" placeholder="à saisir" title="${eanBad ? 'Code EAN-13 invalide (clé de contrôle)' : 'Code EAN-13'}">`}</td>
      <td>${svc ? '<span class="doc-sub">forfait</span>' : `<select data-l="mode"><option value="carton"${l.mode === 'carton' ? ' selected' : ''}>Carton</option><option value="unite"${l.mode === 'unite' ? ' selected' : ''}>À l'unité</option></select>`}${l.collection === 'BRUMES' ? `<select data-l="format" class="doc-format"><option value="250"${l.format !== '265' ? ' selected' : ''}>250 ml</option><option value="265"${l.format === '265' ? ' selected' : ''}>265 ml</option></select>` : ''}</td>
      <td><input class="num" type="number" min="0" step="1" data-l="qty" value="${esc(l.qty)}"></td>
      <td>${!svc && l.mode === 'carton' ? `<input class="num" type="number" min="1" step="1" data-l="perCarton" value="${esc(l.perCarton)}">` : ''}</td>
      <td>${svc ? '' : `<input class="num" type="number" min="0" step="1" data-l="testers" value="${esc(l.testers)}">`}</td>
      <td><input class="num" type="number" min="0" step="0.01" data-l="prix" value="${esc(l.prix)}"></td>
      <td class="text-right" data-total>${money(k.ca)}</td>
      <td><button class="doc-x" data-act="delline" title="Supprimer la ligne">×</button></td>
    </tr>`;
  }
  function purchaseCost(d){
    if(d.societe !== 'NB' || !d.lien) return null;
    const p = SOC.INTRA.find(f => f.facture === d.lien); if(p) return p.ca;
    const pd = docs.find(x => x.numero === d.lien && x.societe === 'BSD'); return pd ? docCalc(pd).ht : null;
  }
  function updateTotals(){
    const k = docCalc(cur);
    cur.lines.forEach((l, i) => { const td = document.querySelector(`#docEdBody tr[data-i="${i}"] [data-total]`); if(td) td.textContent = money(lineCalc(l).ca); });
    const pc = purchaseCost(cur), cout = pc != null ? pc : k.cout;
    const marge = k.ht - cout;
    $('docTotals').innerHTML = `
      <div class="kv"><span>Produits</span><span>${money(k.produits)}</span></div>
      ${k.testersVal ? `<div class="kv"><span>Testeurs (valeur douane : ${k.testers} × ${money(k.pt)})</span><span>${money(k.testersVal)}</span></div>` : ''}
      <div class="kv"><span>Total</span><span>${money(k.brut)}</span></div>
      ${k.testersVal ? `<div class="kv"><span>Remise testeurs (automatique)</span><span>${money(k.remiseTesteurs)}</span></div>` : ''}
      ${k.remiseCom ? `<div class="kv"><span>${esc(remiseLabel(cur, 'fr'))}</span><span>${money(k.remiseCom)}</span></div>` : ''}
      <div class="kv"><span>Total HT</span><span>${money(k.ht)}</span></div>
      <div class="kv"><span>${k.regime.taux ? `TVA ${k.regime.taux} %` : 'TVA (0 % / exonéré)'}</span><span>${money(k.tva)}</span></div>
      <div class="kv strong"><span>${cur.type === 'devis' ? 'Total TTC' : 'Net à payer'}</span><span>${money(k.ttc)}</span></div>
      <div class="doc-internal">
        <div class="kv"><span>Bouteilles payées / testeurs</span><span>${k.btl} / ${k.testers}</span></div>
        <div class="kv"><span>${pc != null ? "Coût d'achat (facture BSD)" : 'Coût de revient estimé'}</span><span>${money(cout)}</span></div>
        <div class="kv"><span>Marge estimée</span><span class="${marge < 0 ? 'amount-negative' : 'amount-positive'}">${money(marge)}${k.ht ? ` · ${(marge / k.ht * 100).toFixed(1).replace('.', ',')} %` : ''}</span></div>
        <div class="doc-sub">Interne : n'apparaît pas sur le document imprimé.</div>
      </div>`;
  }

  function setRef(l, ref){ l.reference = ref; if(!isSvc(l)) l.ean = eanOf(l.collection, ref, l.format); }
  function onEdInput(e){
    if(!cur) return;
    const el = e.target, f = el.dataset.f, lf = el.dataset.l, cad = el.dataset.cad;
    if(f){
      const v = el.value;
      if(f === 'societe' || f === 'type'){
        if(e.type !== 'change' || v === cur[f]) return;
        cur[f] = v;
        if(f === 'societe'){ const S = soc(v); cur.prixTesteur = num(S.prixTesteur); cur.conditions = S.conditions; cur.langue = v === 'NB' ? 'en' : (cur.pays && cur.pays !== 'France' ? 'en' : 'fr'); cur.regime = regimeFor(v, cur.pays); cur.lien = ''; }
        cur.numero = nextNumero(cur.societe, cur.type, cur.date); cur.statut = TYPES[cur.type].statuts[0];
        renderEditor(); return;
      }
      cur[f] = ['remisePct','remiseMontant','prixTesteur'].includes(f) ? num(v) : v;
      if(f === 'date' && e.type === 'change' && !docs.some(x => x.id === cur.id)){ cur.numero = nextNumero(cur.societe, cur.type, v); $('docEdBody').querySelector('[data-f="numero"]').value = cur.numero; }
      if(f === 'client' && e.type === 'change'){
        const c = SETT.clients[v] || {};
        if(!cur.pays && (c.pays || LAST_PAYS[v])) cur.pays = c.pays || LAST_PAYS[v];
        if(!cur.adresse && c.adresse) cur.adresse = c.adresse;
        if(!cur.tvaClient && c.tvaClient) cur.tvaClient = c.tvaClient;
        if(cur.pays){ cur.regime = regimeFor(cur.societe, cur.pays); if(cur.societe === 'BSD') cur.langue = cur.pays === 'France' ? 'fr' : 'en'; }
        retester(); renderEditor(); return;
      }
      if(f === 'pays' && e.type === 'change'){ cur.regime = regimeFor(cur.societe, v); if(cur.societe === 'BSD') cur.langue = v === 'France' ? 'fr' : 'en'; retester(); renderEditor(); return; }
      updateTotals(); return;
    }
    if(cad){ cur.cadeaux = cur.cadeaux || {}; cur.cadeaux[cad] = num(el.value); return; }
    if(lf){
      const i = +el.closest('tr').dataset.i, l = cur.lines[i];
      if(lf === 'collection'){
        if(e.type !== 'change') return;
        const nl = newLine(el.value, cur.pays); nl.qty = l.qty; nl.testers = testerAuto(nl.collection, nl.mode, nl.qty, cur.pays);
        if(isSvc(nl)){ nl.qty = 1; nl.prix = 0; nl.mode = 'service'; nl.reference = nl.collection === 'TRANSPORT' ? 'Frais de transport' : ''; }
        cur.lines[i] = nl; renderEditor(); return;
      }
      if(lf === 'mode'){
        if(e.type !== 'change') return;
        l.mode = el.value; l.prix = priceDefault(l.collection, l.mode); l.autoT = true; l.testers = testerAuto(l.collection, l.mode, l.qty, cur.pays); renderEditor(); return;
      }
      if(lf === 'format'){
        if(e.type !== 'change') return;
        l.format = el.value; l.ean = eanOf(l.collection, l.reference, l.format); renderEditor(); return;
      }
      if(lf === 'reference'){
        setRef(l, el.value);
        const ei = el.closest('tr').querySelector('[data-l="ean"]'); if(ei){ ei.value = l.ean; ei.classList.toggle('bad', !!l.ean && !SOC.eanOk(l.ean)); }
        return;
      }
      if(lf === 'ean'){
        l.ean = el.value.replace(/\s/g, '');
        el.classList.toggle('bad', !!l.ean && !SOC.eanOk(l.ean));
        if(e.type === 'change' && l.reference && SOC.eanOk(l.ean)){ SETT.ean[(l.collection === 'BRUMES' && l.format === '265' ? 'BRUMES265' : l.collection) + '|' + l.reference] = l.ean; saveSett(); }
        return;
      }
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
    cur.remisePct = T.remise; cur.remiseMontant = 0;
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
    if(docs.some(x => x.id !== d.id && x.numero === d.numero)) return `Le numéro ${d.numero} existe déjà.`;
    if(d.type === 'facture' && BASE_NUMS.has(d.numero) && !docs.some(x => x.id === d.id)) return `Le numéro ${d.numero} est déjà utilisé par une facture existante.`;
    const bad = d.lines.filter(l => PARFUMS.includes(l.collection) && l.reference && !REFS[l.collection].includes(l.reference));
    if(bad.length && !confirm(`Référence(s) hors catalogue : ${bad.map(l => l.reference).join(', ')}.\nLe dashboard les comptera comme de nouvelles références. Continuer ?`)) return 'cancel';
    const badEan = d.lines.filter(l => l.ean && !SOC.eanOk(l.ean));
    if(badEan.length && !confirm(`Code(s) EAN invalide(s) : ${badEan.map(l => l.reference + ' ' + l.ean).join(', ')}. Continuer ?`)) return 'cancel';
    if(d.societe === 'BSD' && d.regime === 'intra' && !d.tvaClient.trim() && !confirm("Livraison intracommunautaire sans numéro de TVA du client : l'exonération n'est pas valable sans ce numéro. Continuer ?")) return 'cancel';
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
    if(d.type === 'facture' || i >= 0) sync();
    renderList();
    return d;
  }
  function convert(id, to){
    const s = docs.find(x => x.id === id); if(!s) return;
    const d = clone(s), date = todayIso(), S = soc(s.societe);
    Object.assign(d, {id:newId(), type:to, numero:nextNumero(s.societe, to, date), date,
      validite:addDaysIso(date, +S.validite || 30), echeance:addDaysIso(date, +S.echeance || 30), statut:TYPES[to].statuts[0], source:s.numero});
    s.statut = s.type === 'devis' ? 'Converti' : 'Convertie'; saveDocs();
    openEditor(d);
  }

  /* ---------- Document imprimable (mise en page des factures BSD / NB) ---------- */
  const T = {
    fr:{date:'Date', due:'Échéance', valid:"Valable jusqu'au", from:'Réf.', bill:'Adresse de facturation', to:'Destinataire', ml:'Contenance', ean:'Code EAN', unit:'Prix unitaire', bpb:'Flacons / carton', tpb:'Testeur / carton', ppb:'Prix carton', qty:'Cartons', total:'Total', testers:'TESTEURS', sub:'Total', other:'Désignation', q:'Quantité', gross:'Total', disc:'Remise', discT:'Remise testeurs', ht:'Total HT', vat:'TVA', exo:'0 %', net:{devis:'Total devis', proforma:'Total proforma', facture:'Total facture'}, gifts:'Offert avec la commande', bank:'Coordonnées bancaires', sign:'Bon pour accord — date, signature et cachet', units:'fl.', vatno:'N° TVA', late:"En cas de retard de paiement : pénalités au taux de trois fois le taux d'intérêt légal et indemnité forfaitaire de 40 € pour frais de recouvrement (art. L441-10 du Code de commerce). Pas d'escompte pour paiement anticipé.", pro:'Facture proforma : document sans valeur comptable, ne constitue pas une facture.', tnote:'Testeurs offerts, valorisés pour la douane uniquement et déduits dans la remise.'},
    en:{date:'Date', due:'Due date', valid:'Valid until', from:'Ref.', bill:'Invoicing address', to:'Customer', ml:'Contents', ean:'EAN codes', unit:'Unit price', bpb:'Bottles per box', tpb:'Tester per box', ppb:'Price per box', qty:'Box ordered', total:'Total', testers:'TESTERS', sub:'Total', other:'Description', q:'Quantity', gross:'Total', disc:'Discount', discT:'Discount (testers)', ht:'Total excl. VAT', vat:'VAT', exo:'0%', net:{devis:'Total quotation', proforma:'Total proforma', facture:'Total invoice'}, gifts:'Offered with the order', bank:'Banking details', sign:'Approved — date, signature and company stamp', units:'btl', vatno:'VAT / company no.', late:'Late payment: penalties at three times the French legal interest rate and a fixed recovery fee of €40 (article L441-10 of the French Commercial Code).', pro:'Proforma invoice — not a tax invoice.', tnote:'Testers are free of charge, valued for customs purposes only and deducted in the discount.'}
  };
  function docHtml(d){
    const k = docCalc(d), S = soc(d.societe), lg = d.langue === 'en' ? 'en' : 'fr', L = T[lg];
    const groups = {}; const others = [];
    k.rows.filter(r => num(r.src.qty) > 0).forEach(r => { if(isSvc(r.src)) others.push(r); else (groups[r.src.collection] = groups[r.src.collection] || []).push(r); });
    const tables = PARFUMS.filter(c => groups[c]).map(c => {
      const rows = groups[c].map(r => {
        const l = r.src, carton = l.mode === 'carton';
        const unit = carton ? num(l.prix) / (num(l.perCarton) || 1) : num(l.prix);
        const tpc = carton && num(l.qty) ? Math.round(r.testers / num(l.qty) * 100) / 100 : (r.testers || '—');
        return `<tr><td>${esc(String(l.reference).toUpperCase())}</td><td class="c">${mlOf(l)}</td><td class="c">${esc(fmtEan(l.ean))}</td><td class="r">${money(unit)}</td>
          <td class="c">${carton ? esc(l.perCarton) : '—'}</td><td class="c">${tpc}</td>
          <td class="r">${carton ? money(num(l.prix)) : '—'}</td><td class="c">${carton ? esc(l.qty) : esc(l.qty) + ' ' + L.units}</td><td class="r">${money(r.ca)}</td></tr>`;
      }).join('');
      const nt = k.testersByColl[c] || 0, tval = k.pt ? r2(nt * k.pt) : 0;
      const trow = k.pt && nt ? `<tr class="pd-trow"><td>${L.testers}</td><td></td><td></td><td class="r">${money(k.pt)}</td><td></td><td></td><td></td><td class="c">${nt}</td><td class="r">${money(tval)}</td></tr>` : '';
      const subtotal = r2(sum(groups[c], r => r.ca) + tval);
      return `<table class="pd-table"><thead><tr><th>${COLL[c][lg]}</th><th class="c">${L.ml}</th><th class="c">${L.ean}</th><th class="r">${L.unit}</th><th class="c">${L.bpb}</th><th class="c">${L.tpb}</th><th class="r">${L.ppb}</th><th class="c">${L.qty}</th><th class="r">${L.total}</th></tr></thead>
        <tbody>${rows}${trow}</tbody><tfoot><tr><td colspan="8" class="r">${L.sub}</td><td class="r">${money(subtotal)}</td></tr></tfoot></table>`;
    }).join('');
    const otherTable = others.length ? `<table class="pd-table"><thead><tr><th>${L.other}</th><th class="c">${L.q}</th><th class="r">${L.unit}</th><th class="r">${L.total}</th></tr></thead><tbody>${others.map(r => `<tr><td>${esc(r.src.reference || COLL[r.src.collection][lg])}</td><td class="c">${esc(r.src.qty)}</td><td class="r">${money(num(r.src.prix))}</td><td class="r">${money(r.ca)}</td></tr>`).join('')}</tbody></table>` : '';
    const cad = CADEAUX.filter(a => num((d.cadeaux || {})[a]) > 0).map(a => `${lg === 'en' ? CADEAUX_EN[a] : a} : ${Math.round(num(d.cadeaux[a]))}`);
    const dates = d.type === 'facture'
      ? `<div><span>${L.date}</span>${esc(isoToFr(d.date))}</div><div><span>${L.due}</span>${esc(isoToFr(d.echeance))}</div>`
      : `<div><span>${L.date}</span>${esc(isoToFr(d.date))}</div><div><span>${L.valid}</span>${esc(isoToFr(d.validite))}</div>`;
    const emitter = d.societe === 'NB'
      ? [S.adresse, S.cp_ville, S.pays, S.email && 'Mail : ' + S.email, S.portable && 'Port : ' + S.portable, S.licence && 'License number : ' + S.licence, S.trn && 'TRN : ' + S.trn]
      : [S.adresse, S.cp_ville + ' — ' + S.pays, S.tel && (lg === 'en' ? 'Tel : ' : 'Tél : ') + S.tel, S.portable && 'Port : ' + S.portable, S.email];
    const mentions = [];
    if(k.testersVal) mentions.push(L.tnote);
    if(k.regime[lg]) mentions.push(esc(k.regime[lg]));
    if(d.conditions) mentions.push(esc(d.conditions));
    if(d.type === 'facture' && d.societe === 'BSD') mentions.push(L.late);
    if(d.type === 'proforma') mentions.push(L.pro);
    const bank = S.iban ? `<div class="pd-bank"><strong>${L.bank}</strong><br>${esc(S.banque)}<br>IBAN : ${esc(S.iban)}${S.bic ? '<br>BIC : ' + esc(S.bic) : ''}</div>` : '';
    const legal = d.societe === 'NB'
      ? [S.nom + (S.sousTitre ? ' – ' + S.sousTitre.toUpperCase() : ''), [S.adresse, S.cp_ville, S.pays].filter(Boolean).join(', '), S.email && 'Mail : ' + S.email, S.portable && 'Port : ' + S.portable, S.licence && 'License number : ' + S.licence]
      : [S.nom, S.forme, [S.adresse, S.cp_ville, S.pays].filter(Boolean).join(' '), S.siret && 'SIRET ' + S.siret, S.rcs, S.naf && 'NAF ' + S.naf, S.tva && (lg === 'en' ? 'VAT ' : 'TVA intracom. ') + S.tva];
    // Remises : testeurs seuls -> une ligne « Remise » comme sur les factures d'origine ; sinon détail.
    const discRows = !k.remise ? '' : (k.testersVal && k.remiseCom)
      ? `<div><span>${L.discT}</span><span>${money(-k.remiseTesteurs)}</span></div><div><span>${esc(remiseLabel(d, lg))}</span><span>${money(-k.remiseCom)}</span></div>`
      : `<div><span>${k.remiseCom ? esc(remiseLabel(d, lg)) : L.disc}</span><span>${money(-k.remise)}</span></div>`;
    return `<div class="pd pd-${d.societe}">
      <div class="pd-head">
        <div class="pd-brand"><img src="img/logo.png" alt=""><div class="pd-em"><div class="pd-co">${esc(S.nom)}</div>${S.sousTitre && d.societe === 'NB' ? `<div class="pd-co-sub">${esc(S.sousTitre)}</div>` : ''}${emitter.filter(Boolean).map(esc).join('<br>')}</div></div>
        <div class="pd-title"><h1>${TYPES[d.type][lg]}</h1><div class="pd-num">N° ${esc(d.numero)}</div><div class="pd-dates">${dates}</div>${d.source ? `<div class="pd-ref">${L.from} ${esc(d.source)}</div>` : ''}</div>
      </div>
      <div class="pd-client"><div class="pd-label">${d.type === 'devis' ? L.to : L.bill}</div><strong>${esc(d.client)}</strong><br>${esc(d.adresse).replace(/\n/g, '<br>')}${d.adresse ? '<br>' : ''}${esc(d.pays)}${d.tvaClient ? `<br>${L.vatno} : ${esc(d.tvaClient)}` : ''}</div>
      ${tables}${otherTable}
      <div class="pd-foot">
        <div class="pd-left">${cad.length ? `<div class="pd-gift"><strong>${L.gifts}</strong><br>${cad.map(esc).join(' · ')}</div>` : ''}${bank}</div>
        <div class="pd-tot">
          <div><span>${L.gross}</span><span>${money(k.brut)}</span></div>
          ${discRows}
          ${k.regime.taux ? `<div><span>${L.ht}</span><span>${money(k.ht)}</span></div><div><span>${L.vat} ${k.regime.taux} %</span><span>${money(k.tva)}</span></div>` : `<div><span>${L.vat}</span><span>${L.exo}</span></div>`}
          <div class="pd-net"><span>${L.net[d.type]}</span><span>${money(k.ttc)}</span></div>
        </div>
      </div>
      ${d.type === 'devis' ? `<div class="pd-sign"><div>${L.sign}</div></div>` : ''}
      <div class="pd-mentions">${mentions.map(m => `<p>${m}</p>`).join('')}</div>
      <div class="pd-legal">${legal.filter(Boolean).map(esc).join(' · ')}</div>
    </div>`;
  }
  function showDoc(id){
    const d = docs.find(x => x.id === id); if(!d) return;
    $('docViewTitle').textContent = TYPES[d.type].label + ' ' + d.numero + (d.societe === 'NB' ? ' · NB Evolution' : ' · BSD');
    $('docPaper').innerHTML = docHtml(d);
    $('docViewer').dataset.id = id;
    $('docViewer').classList.add('active');
  }
  function printDoc(id){
    const d = docs.find(x => x.id === id); if(!d) return;
    $('docPrint').innerHTML = docHtml(d);
    const old = document.title; document.title = `${d.numero} - ${d.client}`;
    document.body.classList.add('printing-doc');
    const done = () => { document.body.classList.remove('printing-doc'); document.title = old; window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    window.print();
    setTimeout(done, 1500);
  }

  /* ---------- Réglages, sauvegarde, export ---------- */
  const SET_FIELDS = [['nom','Raison sociale'],['sousTitre','Sous-titre'],['forme','Forme juridique'],['adresse','Adresse'],['cp_ville','Code postal et ville'],['pays','Pays'],['tel','Téléphone'],['portable','Portable'],['email','E-mail'],['siret','SIRET'],['rcs','RCS'],['naf','Code NAF'],['tva','N° TVA intracommunautaire'],['licence','N° de licence'],['trn','TRN (TVA EAU)'],['banque','Banque'],['iban','IBAN'],['bic','BIC'],['conditions','Conditions de paiement par défaut'],['prixTesteur',"Valeur douane d'un testeur (€)"],['validite','Validité des devis (jours)'],['echeance','Échéance des factures (jours)']];
  let setSoc = 'BSD';
  function openSettings(code){
    setSoc = code || setSoc;
    const S = soc(setSoc);
    $('docSetBody').innerHTML = `<div class="doc-row-actions">${['BSD','NB'].map(c => `<button class="doc-btn${c === setSoc ? ' primary' : ''}" data-act="sswitch" data-soc="${c}">${SOC.SOCIETES[c].label}</button>`).join('')}</div>
      <div class="doc-grid">${SET_FIELDS.map(([k, l]) => `<label${k === 'conditions' || k === 'nom' ? ' class="span2"' : ''}>${l}<input data-s="${k}" value="${esc(S[k])}"></label>`).join('')}</div>`;
    $('docSettings').classList.add('active');
  }
  function saveSettings(close){
    const o = {}; document.querySelectorAll('#docSetBody [data-s]').forEach(i => { o[i.dataset.s] = i.value.trim(); });
    SETT.societes[setSoc] = o; saveSett();
    if(close) $('docSettings').classList.remove('active');
  }
  function download(name, text, type){
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], {type:type || 'text/plain'}));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function exportData(){
    if(!localInvoices().length){ alert("Aucune nouvelle facture : les fichiers de données sont déjà à jour."); return; }
    const x = SOC.exportData();
    download('ventes.js', "// Données de ventes (vue Groupe : BSD + NB Evolution, sans les ventes internes). Régénéré par l'onglet Devis & Factures.\nconst ALL = " + JSON.stringify(x.all, null, 1) + ';\n', 'text/javascript');
    if(x.nIntra) setTimeout(() => download('intragroupe.js', "// Factures BSD -> NB Evolution (ventes internes au groupe). Régénéré par l'onglet Devis & Factures.\nconst INTRAGROUPE = " + JSON.stringify(x.intra, null, 1) + ';\n', 'text/javascript'), 400);
    alert(`Téléchargé : ventes.js${x.nIntra ? ' et intragroupe.js' : ''}.\nRemplace les fichiers du même nom dans dashboard-netlify/data/, puis vérifie avec :\npython3 outils/rebuild_dashboard.py dashboard-netlify/data/ventes.js\nAjoute aussi ces factures aux registres donnees_sources/FACTURES_20XX.md.`);
  }
  function backup(){ download('ej-documents-' + todayIso() + '.json', JSON.stringify({version:2, documents:docs, reglages:SETT}, null, 1), 'application/json'); }
  function restore(file){
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const o = JSON.parse(rd.result); const list = o.documents || [];
        let n = 0; list.forEach(d => { if(d && d.id && !docs.some(x => x.id === d.id)){ if(!d.societe) d.societe = 'BSD'; if(!d.langue) d.langue = 'fr'; docs.push(d); n++; } });
        if(o.reglages && o.reglages.societes && confirm('Restaurer aussi les coordonnées des sociétés ?')) SETT = Object.assign({societes:{}, clients:{}, ean:{}}, o.reglages);
        saveDocs(); saveSett(); sync(); renderList();
        alert(`${n} document(s) ajouté(s).`);
      } catch(e) { alert("Fichier de sauvegarde illisible."); }
    };
    rd.readAsText(file);
  }

  /* ---------- Événements ---------- */
  $('documents').addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if(!b) return;
    const id = b.dataset.id, act = b.dataset.act;
    if(act === 'new') openEditor(blankDoc(b.dataset.type, $('docNewSoc').value));
    else if(act === 'view') showDoc(id);
    else if(act === 'edit'){ const d = docs.find(x => x.id === id); if(d){ if(d.type === 'facture' && !confirm("Une facture émise ne devrait normalement plus être modifiée (préférer un avoir). Modifier quand même ?")) return; openEditor(d); } }
    else if(act === 'dup'){ const s = docs.find(x => x.id === id); if(s){ const d = clone(s); const date = todayIso(); Object.assign(d, {id:newId(), numero:nextNumero(d.societe, d.type, date), date, statut:TYPES[d.type].statuts[0], source:''}); openEditor(d); } }
    else if(act === 'convert') convert(id, b.dataset.to);
    else if(act === 'del'){
      const d = docs.find(x => x.id === id); if(!d) return;
      const msg = d.type === 'facture' ? `Supprimer la facture ${d.numero} ?\nLa numérotation des factures doit rester continue : en principe on établit un avoir plutôt que de supprimer.` : `Supprimer ${TYPES[d.type].label.toLowerCase()} ${d.numero} ?`;
      if(!confirm(msg)) return;
      docs = docs.filter(x => x.id !== id); saveDocs();
      if(d.type === 'facture') sync();
      renderList();
    }
    else if(act === 'settings') openSettings($('docNewSoc').value);
    else if(act === 'export') exportData();
    else if(act === 'backup') backup();
    else if(act === 'restore') $('docRestoreFile').click();
  });
  $('docRestoreFile').addEventListener('change', e => { if(e.target.files[0]) restore(e.target.files[0]); e.target.value = ''; });
  $('docFilter').addEventListener('change', e => { filterType = e.target.value; renderList(); });
  $('docFilterSoc').addEventListener('change', e => { filterSoc = e.target.value; renderList(); });
  $('docSearch').addEventListener('input', e => { filterText = e.target.value; renderList(); });

  const ed = $('docEditor');
  ed.addEventListener('input', onEdInput);
  ed.addEventListener('change', onEdInput);
  ed.addEventListener('click', e => {
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
    else if(b && b.dataset.act === 'ssave') saveSettings(true);
    else if(b && b.dataset.act === 'sswitch'){ saveSettings(false); openSettings(b.dataset.soc); }
  });

  // Démarrage : applique la vue société mémorisée et les factures créées dans ce navigateur.
  sync();
  renderList();
})();
