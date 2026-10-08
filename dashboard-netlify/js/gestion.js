/* Pages de gestion : trésorerie prévisionnelle, créances clients, échéances fiscales, résultat & impôts,
   objectifs & budget, fiches clients, prospects, approvisionnement, expéditions, conformité produits.
   Saisies : registres (js/registre.js). Chiffres : données du dashboard (factures, documents, stock, charges).
   window.EJ_GESTION.rappels() alimente « À traiter » du journal de bord. */
(function(){
  if(typeof REG === 'undefined') return;
  const esc = REG.esc, $ = id => document.getElementById(id);
  const money = (n, d) => (n || 0).toLocaleString('fr-FR', {minimumFractionDigits:d ? 2 : 0, maximumFractionDigits:d ? 2 : 0}) + ' €';
  const pad = n => String(n).padStart(2, '0');
  const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const fr = s => s ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : '';
  const frToIso = s => { const m = String(s || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? m[3] + '-' + m[2] + '-' + m[1] : ''; };
  const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const T0 = () => iso(today());
  const days = s => Math.round((new Date(s + 'T00:00:00') - today()) / 864e5);
  const addDays = (s, n) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return iso(d); };
  const MOIS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  const moisNom = k => MOIS[+k.slice(5, 7) - 1] + ' ' + k.slice(0, 4);
  const YEAR = String(today().getFullYear());
  const num = v => +v || 0;
  const DOCS = () => (window.EJ_DOCS ? window.EJ_DOCS.list() : []);
  const DEP = v => (window.EJ_SOC && EJ_SOC.depenses ? EJ_SOC.depenses(v) : null);
  let statsCache = {};
  const stats = v => statsCache[v] || (statsCache[v] = window.EJ_SOC && EJ_SOC.statsFor ? EJ_SOC.statsFor(v) : ALL);
  window.addEventListener('ej-reg', () => {});
  // Part de l'année écoulée (pour les moyennes et projections)
  const moisEcoules = () => { const t = today(); return t.getMonth() + t.getDate() / new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate(); };

  /* ================= Taux de change ================= */
  const taux = () => REG.val('taux', {EUR:1, USD:0.92, AED:0.25});
  const enEur = (m, dev) => num(m) * (taux()[dev || 'EUR'] || 1);
  const DEVISES = ['EUR', 'USD', 'AED'];

  /* ================= Registres ================= */
  const R = {
    comptes:REG.def('comptes', {ajout:'+ Ajouter un compte', cols:[
      {k:'compte', l:'Compte', w:150}, {k:'soc', l:'Société', t:'select', o:['BSD', 'NB']}, {k:'devise', l:'Devise', t:'select', o:DEVISES},
      {k:'solde', l:'Solde', t:'money', w:110}, {k:'date', l:'Au', t:'date'}],
      defauts:[{compte:'BRED — BSD', soc:'BSD', devise:'EUR', solde:'', date:''}, {compte:'WIO Bank — NB Evolution', soc:'NB', devise:'AED', solde:'', date:''}]}),
    treso:REG.def('tresorerie', {ajout:'+ Ajouter un mouvement prévu', vide:'Aucun mouvement ajouté à la main.', tri:(a, b) => String(a.date).localeCompare(String(b.date)), cols:[
      {k:'date', l:'Date', t:'date'}, {k:'soc', l:'Société', t:'select', o:['BSD', 'NB']}, {k:'lib', l:'Libellé', w:200, ph:'Ex. Acompte client Gazzaz, achat flacons…'},
      {k:'sens', l:'Sens', t:'select', o:['Sortie', 'Entrée']}, {k:'montant', l:'Montant', t:'money'}, {k:'devise', l:'Devise', t:'select', o:DEVISES},
      {k:'fait', l:'Réalisé', t:'check'}], nouveau:() => ({date:T0(), soc:'BSD', sens:'Sortie', devise:'EUR'})}),
    creances:REG.def('creances', {ajout:'+ Ajouter une créance', vide:'Aucune créance saisie à la main (les factures créées dans « Devis & factures » sont reprises automatiquement).', tri:(a, b) => String(a.echeance).localeCompare(String(b.echeance)), cols:[
      {k:'client', l:'Client', w:150}, {k:'facture', l:'Facture', w:100}, {k:'soc', l:'Société', t:'select', o:['BSD', 'NB']}, {k:'montant', l:'Montant dû', t:'money'},
      {k:'devise', l:'Devise', t:'select', o:DEVISES}, {k:'date', l:'Date facture', t:'date'}, {k:'echeance', l:'Échéance', t:'date'}, {k:'paye', l:'Payé', t:'check'}, {k:'note', l:'Note', t:'area', w:160}],
      classe:x => x.paye ? 'reg-ok' : (x.echeance && days(x.echeance) < 0 ? 'reg-late' : ''), nouveau:() => ({soc:'BSD', devise:'EUR', date:T0()})}),
    echeances:REG.def('echeances', {ajout:'+ Ajouter une échéance', vide:'Aucune échéance ajoutée à la main.', tri:(a, b) => String(a.date).localeCompare(String(b.date)), cols:[
      {k:'date', l:'Date', t:'date'}, {k:'soc', l:'Société', t:'select', o:['BSD', 'NB']}, {k:'lib', l:'Échéance', w:220}, {k:'montant', l:'Montant €', t:'money'}, {k:'fait', l:'Fait', t:'check'}],
      classe:x => x.fait ? 'reg-ok' : (x.date && days(x.date) < 0 ? 'reg-late' : ''), nouveau:() => ({soc:'BSD'})}),
    objectifs:REG.def('objectifs', {ajout:'+ Ajouter un objectif', cols:[
      {k:'type', l:'Type', t:'select', o:['Pays', 'Client']}, {k:'nom', l:'Pays ou client (nom exact)', w:180}, {k:'objectif', l:'Objectif CA ' + YEAR, t:'money'}],
      extra:{l:'Réalisé · avancement · projection', f:x => objLigne(x)}, nouveau:() => ({type:'Pays'})}),
    budget:REG.def('budget', {ajout:'+ Ajouter une catégorie', cols:[{k:'cat', l:'Catégorie de charges', w:240}, {k:'budget', l:'Budget ' + YEAR, t:'money'}],
      extra:{l:'Réel (relevés) · consommé', f:x => budLigne(x)}}),
    agents:REG.def('agents', {ajout:'+ Ajouter un agent', vide:'Aucun agent ou vendeur commissionné.', cols:[
      {k:'agent', l:'Agent / vendeur', w:140}, {k:'clients', l:'Clients concernés (séparés par des virgules)', w:240}, {k:'taux', l:'Taux %', t:'num'},
      {k:'base', l:'Base', t:'select', o:['CA', 'Marge']}, {k:'paye', l:'Déjà versé ' + YEAR, t:'money'}], extra:{l:'Commission ' + YEAR, f:x => comLigne(x)}, nouveau:() => ({base:'CA'})}),
    prospects:REG.def('prospects', {ajout:'+ Ajouter un prospect', vide:'Aucun prospect.', cols:[
      {k:'nom', l:'Société', w:150}, {k:'pays', l:'Pays', w:100}, {k:'source', l:'Source', w:120, ph:'Salon, recommandation…'}, {k:'contact', l:'Contact', w:130}, {k:'email', l:'E-mail / tél.', w:150},
      {k:'etape', l:'Étape', t:'select', o:['Nouveau contact', 'Rendez-vous', 'Échantillons envoyés', 'Offre envoyée', 'Gagné', 'Perdu']},
      {k:'valeur', l:'1re commande estimée', t:'money'}, {k:'action', l:'Prochaine action', w:170}, {k:'date', l:'Pour le', t:'date'}],
      classe:x => x.etape === 'Gagné' ? 'reg-ok' : x.etape === 'Perdu' ? 'reg-off' : (x.date && days(x.date) < 0 ? 'reg-late' : ''),
      extra:{l:'', f:x => x.etape === 'Gagné' ? `<button type="button" class="j-mini" data-fiche="${esc(x.nom)}">Fiche client</button>` : ''}, nouveau:() => ({etape:'Nouveau contact'})}),
    commandes:REG.def('commandes', {ajout:'+ Ajouter une commande fournisseur', vide:'Aucune commande fournisseur en cours.', tri:(a, b) => String(a.eta).localeCompare(String(b.eta)), cols:[
      {k:'num', l:'N°', w:80}, {k:'fournisseur', l:'Fournisseur', w:130}, {k:'objet', l:'Objet', w:180, ph:'Concentré VIP, flacons 90 ml…'}, {k:'soc', l:'Société', t:'select', o:['BSD', 'NB']},
      {k:'montant', l:'Montant', t:'money'}, {k:'devise', l:'Devise', t:'select', o:DEVISES}, {k:'date', l:'Commandée le', t:'date'}, {k:'eta', l:'Arrivée prévue', t:'date'},
      {k:'paiement', l:'Paiement prévu', t:'date'}, {k:'paye', l:'Payée', t:'check'}, {k:'statut', l:'Statut', t:'select', o:['Commandée', 'En production', 'Expédiée', 'Reçue']}],
      classe:x => x.statut === 'Reçue' ? 'reg-ok' : (x.eta && days(x.eta) < 0 ? 'reg-late' : ''), nouveau:() => ({soc:'BSD', devise:'EUR', date:T0(), statut:'Commandée'})}),
    expeditions:REG.def('expeditions', {ajout:'+ Ajouter une expédition', vide:'Aucune expédition suivie.', tri:(a, b) => String(b.date).localeCompare(String(a.date)), cols:[
      {k:'date', l:'Date', t:'date'}, {k:'client', l:'Client', w:130}, {k:'facture', l:'Facture', w:90}, {k:'transporteur', l:'Transporteur', w:110}, {k:'suivi', l:'N° de suivi', w:130},
      {k:'incoterm', l:'Incoterm', t:'select', o:['EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP', 'FOB', 'CFR', 'CIF']}, {k:'colis', l:'Colis', t:'num'}, {k:'poids', l:'Poids kg', t:'num'},
      {k:'statut', l:'Statut', t:'select', o:['En préparation', 'Expédiée', 'En transit', 'En douane', 'Livrée', 'Problème']},
      {k:'pl', l:'Packing list', t:'check'}, {k:'co', l:'Certif. origine', t:'check'}, {k:'dgd', l:'Doc. marchandise dangereuse', t:'check'}, {k:'export', l:'Preuve d’export', t:'check'}],
      classe:x => x.statut === 'Problème' ? 'reg-late' : x.statut === 'Livrée' ? (x.export ? 'reg-ok' : 'reg-warn') : (x.date && days(x.date) < -30 ? 'reg-late' : ''),
      extra:{l:'Suivi', f:x => x.suivi ? `<a href="https://t.17track.net/fr#nums=${encodeURIComponent(x.suivi)}" target="_blank" rel="noopener">Suivre</a>` : ''}, nouveau:() => ({date:T0(), statut:'En préparation', incoterm:'EXW'})}),
    enreg:REG.def('enregistrements', {ajout:'+ Ajouter un enregistrement', tri:(a, b) => String(a.expiration || '9').localeCompare(String(b.expiration || '9')), cols:[
      {k:'pays', l:'Pays', w:110}, {k:'organisme', l:'Organisme / document', w:170}, {k:'produits', l:'Produits couverts', w:160}, {k:'numero', l:'N°', w:110},
      {k:'obtenu', l:'Obtenu le', t:'date'}, {k:'expiration', l:'Expire le', t:'date'}, {k:'statut', l:'Statut', t:'select', o:['À faire', 'En cours', 'Obtenu', 'Expiré']}, {k:'note', l:'Note', t:'area', w:140}],
      classe:x => x.expiration && days(x.expiration) < 0 ? 'reg-late' : x.expiration && days(x.expiration) < 60 ? 'reg-warn' : x.statut === 'Obtenu' ? 'reg-ok' : '',
      defauts:[
        {pays:'Union européenne', organisme:'Notification CPNP + personne responsable', produits:'Toutes les références', statut:'En cours'},
        {pays:'Arabie saoudite', organisme:'SFDA — enregistrement cosmétiques', produits:'', statut:'À faire'},
        {pays:'Émirats arabes unis', organisme:'Dubai Municipality (Montaha) / ECAS', produits:'', statut:'À faire'},
        {pays:'Russie (UEEA)', organisme:'Déclaration / certificat EAC', produits:'', statut:'À faire'},
        {pays:'Irak', organisme:'Certificat de conformité (COC) avant expédition', produits:'Par envoi', statut:'À faire'},
        {pays:'Qatar', organisme:'Enregistrement ministère de la Santé', produits:'', statut:'À faire'}]}),
    lots:REG.def('lots', {ajout:'+ Ajouter un lot', vide:'Aucun lot enregistré.', tri:(a, b) => String(b.date).localeCompare(String(a.date)), cols:[
      {k:'lot', l:'N° de lot', w:100}, {k:'collection', l:'Collection', t:'select', o:['VIP', 'VIP BLACK', '50ML', 'BRUMES', 'ROYAL', 'Autre']}, {k:'reference', l:'Référence', w:130},
      {k:'date', l:'Fabriqué le', t:'date'}, {k:'quantite', l:'Quantité', t:'num'}, {k:'fabricant', l:'Fabricant / usine', w:130}, {k:'clients', l:'Factures / clients livrés', t:'area', w:180}],
      nouveau:() => ({collection:'VIP', date:T0()})})
  };

  /* ================= Sources automatiques ================= */
  // Encaissements attendus des factures créées dans le dashboard (échéancier ou facture entière)
  function attendusDocs(){
    const out = [];
    DOCS().forEach(d => {
      if(d.type !== 'facture' || d.statut === 'Payée' || !d.client) return;
      const ps = EJ_DOCS.payState(d);
      if(ps) ps.e.forEach((r, i) => { if(!r.recu) out.push({src:'doc', id:d.id, i, soc:d.societe, client:d.client, facture:d.numero, montant:r.montant, echeance:r.due || '', quand:r.pct + ' % ' + (r.quand === 'commande' ? 'à la commande' : r.quand === 'expedition' ? 'avant expédition' : r.quand === 'livraison' ? 'à la livraison' : 'à échéance')}); });
      else out.push({src:'doc', id:d.id, i:-1, soc:d.societe, client:d.client, facture:d.numero, montant:EJ_DOCS.calc(d).ttc, echeance:d.echeance || '', quand:'facture entière'});
    });
    return out;
  }
  function creancesToutes(){
    const out = attendusDocs();
    R.creances.rows().filter(x => !x.paye && num(x.montant)).forEach(x => out.push({src:'reg', id:x.id, soc:x.soc, client:x.client, facture:x.facture, montant:enEur(x.montant, x.devise), echeance:x.echeance || '', quand:x.note || ''}));
    [['BSD', DEP('BSD')], ['NB', DEP('NB')]].forEach(([s, D]) => ((D && D.pending.items) || []).forEach(it => out.push({src:'vir', soc:s, client:it.client || it.label || '', facture:it.facture || '', montant:num(it.amount || it.montant), echeance:'', quand:'virement attendu'})));
    return out;
  }
  const MOISF = {janvier:0,'février':1,mars:2,avril:3,mai:4,juin:5,juillet:6,'août':7,septembre:8,octobre:9,novembre:10,'décembre':11};
  function fournisseursDus(){
    const out = [], mk = T0().slice(0, 7);
    [['BSD', DEP('BSD')], ['NB', DEP('NB')]].forEach(([s, D]) => {
      if(!D) return;
      (D.supplier.months || []).forEach(m => {
        const p = String(m.name).toLowerCase().split(/\s+/), mi = MOISF[p[0]], y = +p[1]; if(mi === undefined || !y) return;
        const k = y + '-' + pad(mi + 1);
        (m.lines || []).filter(l => !l.paid).forEach(l => out.push({soc:s, date:k < mk ? T0() : k + '-15', lib:`${l.label} (${m.name})`, montant:num(l.amount), retard:k < mk}));
      });
      if(D.supplier.goldrock && /payer/i.test(D.supplier.goldrock.status || '')) (D.supplier.goldrock.lines || []).forEach(l => out.push({soc:s, date:T0(), lib:'Goldrock — ' + l.label, montant:l.eur || enEur(l.usd, 'USD'), retard:true}));
    });
    return out;
  }

  /* ================= Échéances fiscales et administratives ================= */
  const fiscReg = () => REG.val('fiscal', {tvaJour:19, deb:true, dsnJour:15, nbLicence:'', nbTva:false, isAcompte:''});
  function echeancesAuto(debut, fin){
    const P = fiscReg(), L = [], add = (date, soc, code, lib, montant) => { if(date >= debut && date <= fin) L.push({key:soc + '|' + code + '|' + date, date, soc, lib, montant}); };
    const y0 = +debut.slice(0, 4), y1 = +fin.slice(0, 4);
    for(let y = y0; y <= y1; y++){
      for(let m = 1; m <= 12; m++){
        const prev = MOIS[(m + 10) % 12] + (m === 1 ? ' ' + (y - 1) : '');
        add(`${y}-${pad(m)}-${pad(P.tvaJour)}`, 'BSD', 'tva', `TVA : déclaration et paiement (CA3) de ${prev}`);
        add(`${y}-${pad(m)}-${pad(P.dsnJour)}`, 'BSD', 'dsn', `DSN et cotisations sociales de ${prev}`);
        if(P.deb) add(`${y}-${pad(m)}-10`, 'BSD', 'deb', `Ventes dans l'UE de ${prev} : déclaration européenne de services / état récapitulatif TVA`);
      }
      ['03', '06', '09', '12'].forEach(m => add(`${y}-${m}-15`, 'BSD', 'is', "Acompte d'impôt sur les sociétés", num(P.isAcompte) || ''));
      add(`${y}-05-15`, 'BSD', 'liasse', `Liasse fiscale et solde de l'impôt sur les sociétés (exercice ${y - 1})`);
      add(`${y}-06-30`, 'BSD', 'ag', `Approbation des comptes ${y - 1} (assemblée des associés)`);
      add(`${y}-07-31`, 'BSD', 'greffe', `Dépôt des comptes ${y - 1} au greffe`);
      add(`${y}-12-15`, 'BSD', 'cfe', 'CFE (cotisation foncière des entreprises)');
      add(`${y}-09-30`, 'NB', 'ct', `Émirats : déclaration et paiement de l'impôt sur les sociétés (exercice ${y - 1})`);
      if(P.nbTva) ['01', '04', '07', '10'].forEach(m => add(`${y}-${m}-28`, 'NB', 'vat', 'Émirats : déclaration de TVA du trimestre'));
    }
    if(P.nbLicence){ add(P.nbLicence, 'NB', 'licence', 'Renouvellement de la licence commerciale de NB Evolution (DSO)'); add(addDays(P.nbLicence, -30), 'NB', 'licence-prep', 'Préparer le renouvellement de la licence NB (dans 30 jours)'); }
    return L;
  }
  const fiscFait = () => REG.val('fiscal_fait', {}), fiscMontant = () => REG.val('fiscal_montant', {});
  function echeancesToutes(debut, fin){
    const F = fiscFait(), M = fiscMontant();
    return echeancesAuto(debut, fin).map(e => Object.assign(e, {fait:!!F[e.key], montant:M[e.key] !== undefined ? M[e.key] : e.montant, auto:true}))
      .concat(R.echeances.rows().filter(x => x.date && x.date >= debut && x.date <= fin).map(x => ({key:'reg|' + x.id, id:x.id, date:x.date, soc:x.soc, lib:x.lib, montant:x.montant, fait:!!x.fait})))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /* ================= Pages ================= */
  const PAGES = {};
  const head = (txt) => `<div class="info-box">${txt}</div>`;
  const kpis = list => `<div class="gx-kpis">${list.map(([l, v, c]) => `<div class="gx-kpi${c ? ' ' + c : ''}"><span>${l}</span><strong>${v}</strong></div>`).join('')}</div>`;
  const socSel = (id, v) => `<div class="seg gx-seg" id="${id}">${['groupe', 'BSD', 'NB'].map(s => `<button type="button" data-s="${s}"${s === v ? ' class="active"' : ''}>${s === 'groupe' ? 'Groupe' : s}</button>`).join('')}</div>`;

  // ---------- Trésorerie ----------
  let tresoSoc = 'groupe';
  function previsions(soc){
    const ok = s => soc === 'groupe' || s === soc, items = [], t0 = T0(), mk = t0.slice(0, 7);
    creancesToutes().filter(c => ok(c.soc)).forEach(c => items.push({date:c.echeance && c.echeance > t0 ? c.echeance : t0, lib:`${c.client} — ${c.facture || ''} ${c.quand}`.trim(), montant:c.montant, src:'Client'}));
    R.treso.rows().filter(x => !x.fait && x.date && ok(x.soc)).forEach(x => items.push({date:x.date < t0 ? t0 : x.date, lib:x.lib, montant:(x.sens === 'Entrée' ? 1 : -1) * enEur(x.montant, x.devise), src:'Saisie'}));
    fournisseursDus().filter(f => ok(f.soc)).forEach(f => items.push({date:f.date, lib:f.lib, montant:-f.montant, src:'Fournisseur'}));
    R.commandes.rows().filter(x => !x.paye && num(x.montant) && ok(x.soc)).forEach(x => { const d = x.paiement || x.eta || t0; items.push({date:d < t0 ? t0 : d, lib:`Commande ${x.fournisseur || ''} ${x.objet || ''}`.trim(), montant:-enEur(x.montant, x.devise), src:'Commande'}); });
    const fin = addDays(t0, 200);
    echeancesToutes(t0.slice(0, 7) + '-01', fin).filter(e => !e.fait && num(e.montant) && ok(e.soc)).forEach(e => items.push({date:e.date < t0 ? t0 : e.date, lib:e.lib, montant:-num(e.montant), src:'Fiscal'}));
    // Charges fixes et salaires : chaque mois à venir (le mois en cours compte s'il reste plus de 10 jours)
    ['BSD', 'NB'].filter(ok).forEach(s => { const D = DEP(s); if(!D) return;
      const mens = D.fixed.charges.concat(D.fixed.salaires).reduce((a, x) => a + num(x.amount), 0); if(!mens) return;
      for(let i = today().getDate() > 20 ? 1 : 0; i < 6; i++){ const d = new Date(today().getFullYear(), today().getMonth() + i, 28); items.push({date:iso(d), lib:`Charges fixes et salaires ${s}`, montant:-mens, src:'Charges fixes'}); } });
    const months = []; for(let i = 0; i < 6; i++){ const d = new Date(today().getFullYear(), today().getMonth() + i, 1); months.push(iso(d).slice(0, 7)); }
    const solde = R.comptes.rows().filter(x => ok(x.soc)).reduce((a, x) => a + enEur(x.solde, x.devise), 0);
    let s = solde; const rows = months.map(m => { const it = items.filter(x => x.date.slice(0, 7) === m);
      const inn = it.filter(x => x.montant > 0).reduce((a, x) => a + x.montant, 0), out = it.filter(x => x.montant < 0).reduce((a, x) => a + x.montant, 0);
      const debut = s; s += inn + out; return {m, debut, inn, out, fin:s, it}; });
    return {solde, rows, items};
  }
  PAGES.tresorerie = box => {
    const P = previsions(tresoSoc), T = taux(), min = Math.min(...P.rows.map(r => r.fin)), comptesVides = !R.comptes.rows().some(x => x.solde !== '' && x.solde != null);
    const maxAbs = Math.max(1, ...P.rows.map(r => Math.max(r.inn, -r.out)));
    box.innerHTML = head("Solde des comptes + argent attendu des clients − ce qu'il faut payer (fournisseurs, commandes, charges fixes et salaires, impôts saisis dans « Échéances fiscales »). Montants convertis en euros.") +
      socSel('tresoSoc', tresoSoc) +
      (comptesVides ? `<div class="warning-box gx-warn">Saisis le solde actuel des comptes ci-dessous pour une prévision juste.</div>` : '') +
      kpis([['Trésorerie actuelle', money(P.solde)], ['Entrées prévues (6 mois)', money(P.rows.reduce((a, r) => a + r.inn, 0)), 'ok'], ['Sorties prévues (6 mois)', money(-P.rows.reduce((a, r) => a + r.out, 0)), 'ko'], ['Point le plus bas', money(min), min < 0 ? 'ko' : ''], ['Solde dans 6 mois', money(P.rows[5].fin), P.rows[5].fin < 0 ? 'ko' : '']]) +
      `<div class="gx-table-wrap"><table class="gx-table"><thead><tr><th>Mois</th><th class="text-right">Début</th><th class="text-right">Entrées</th><th class="text-right">Sorties</th><th class="text-right">Fin de mois</th><th></th></tr></thead><tbody>
      ${P.rows.map((r, i) => `<tr class="gx-mois${r.fin < 0 ? ' gx-neg' : ''}" data-i="${i}"><td>${moisNom(r.m)}${i === 0 ? ' <small>(+ retards)</small>' : ''}</td><td class="text-right">${money(r.debut)}</td><td class="text-right amount-positive">${money(r.inn)}</td><td class="text-right amount-negative">${money(-r.out)}</td><td class="text-right"><strong>${money(r.fin)}</strong></td>
        <td class="gx-bars"><i class="in" style="width:${Math.round(r.inn / maxAbs * 100)}%"></i><i class="out" style="width:${Math.round(-r.out / maxAbs * 100)}%"></i></td></tr>
        <tr class="gx-det" hidden><td colspan="6"><ul>${r.it.sort((a, b) => a.date.localeCompare(b.date)).map(x => `<li><span>${fr(x.date)} · <em>${x.src}</em> · ${esc(x.lib)}</span><span class="${x.montant < 0 ? 'amount-negative' : 'amount-positive'}">${money(x.montant)}</span></li>`).join('') || '<li>Aucun mouvement</li>'}</ul></td></tr>`).join('')}
      </tbody></table></div><p class="j-sub">Cliquer sur un mois pour voir le détail.</p>
      <h3 class="gx-h3">Comptes bancaires</h3><div id="gxComptes"></div>
      <div class="gx-taux">Taux de conversion : 1 USD = <input type="number" step="0.0001" data-taux="USD" value="${T.USD}"> € · 1 AED = <input type="number" step="0.0001" data-taux="AED" value="${T.AED}"> €</div>
      <h3 class="gx-h3">Mouvements prévus ajoutés à la main</h3><div id="gxTreso"></div>
      <h3 class="gx-h3">Relevés bancaires importés</h3>
      <div class="gx-import"><label class="doc-btn">Importer un relevé (CSV)<input type="file" accept=".csv,text/csv,text/plain" id="gxReleve" hidden></label>
        <select id="gxReleveCompte">${R.comptes.rows().map(c => `<option value="${c.id}">${esc(c.compte)}</option>`).join('')}</select>
        <span class="j-sub">Export CSV de la banque (BRED, WIO…). Les opérations sont classées par catégorie d'après les fournisseurs connus.</span></div>
      <div id="gxReleveRes">${releveHtml()}</div>`;
    R.comptes.render($('gxComptes')); R.treso.render($('gxTreso'));
  };

  // ---------- Import de relevés bancaires ----------
  // Lit un CSV (séparateur ; , ou tabulation), repère les colonnes date / libellé / montant (ou débit + crédit) / solde,
  // classe chaque opération avec les fournisseurs connus des relevés précédents (CHARGES_DATA / REVENUE_DATA).
  function categoriser(lib, montant){
    const L = String(lib).toUpperCase(), src = montant < 0 ? (typeof CHARGES_DATA !== 'undefined' ? CHARGES_DATA : null) : (typeof REVENUE_DATA !== 'undefined' ? REVENUE_DATA : null);
    if(src) for(const y of Object.keys(src)){ const cats = (src[y] || {}).categories || {};
      for(const c of Object.keys(cats)) for(const v of (cats[c].vendors || [])){ const n = String(v.vendor || '').toUpperCase(); if(n.length > 3 && L.includes(n)) return c; } }
    return montant < 0 ? 'À classer (dépense)' : 'À classer (recette)';
  }
  const nombre = s => { s = String(s || '').replace(/\s|€|EUR|AED|USD/g, ''); if(/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); else s = s.replace(/,/g, ''); return parseFloat(s); };
  const dateIso = s => { s = String(s || '').trim(); let m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/); if(m) return (m[3].length === 2 ? '20' + m[3] : m[3]) + '-' + pad(m[2]) + '-' + pad(m[1]); m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[0] : ''; };
  function lireCsv(txt){
    const lignes = txt.replace(/^\ufeff/, '').split(/\r?\n/).filter(l => l.trim());
    const sep = [';', '\t', ','].sort((a, b) => lignes.slice(0, 5).join('').split(b).length - lignes.slice(0, 5).join('').split(a).length)[0];
    const split = l => { const out = []; let cur = '', q = false; for(const ch of l){ if(ch === '"'){ q = !q; continue; } if(ch === sep && !q){ out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map(x => x.trim()); };
    let hi = lignes.findIndex(l => /date/i.test(l) && /(montant|amount|d[ée]bit|cr[ée]dit|libell|description)/i.test(l)); if(hi < 0) hi = 0;
    const H = split(lignes[hi]).map(x => x.toLowerCase()), col = re => H.findIndex(x => re.test(x));
    const cD = col(/date/), cL = col(/libell|description|d[ée]tail|op[ée]ration|narrat|payee/), cM = col(/^montant|amount/), cDe = col(/d[ée]bit/), cCr = col(/cr[ée]dit/), cS = col(/solde|balance/);
    const ops = [];
    lignes.slice(hi + 1).forEach(l => { const c = split(l), d = dateIso(c[cD]); if(!d) return;
      let m = cM >= 0 ? nombre(c[cM]) : (nombre(c[cCr]) || 0) - Math.abs(nombre(c[cDe]) || 0); if(isNaN(m)) return;
      ops.push({date:d, lib:c[cL >= 0 ? cL : 1] || '', montant:m, solde:cS >= 0 ? nombre(c[cS]) : NaN}); });
    return ops;
  }
  function releveHtml(){
    const ops = REG.val('releve', {ops:[]}).ops || []; if(!ops.length) return '';
    const parCat = {}; ops.forEach(o => { parCat[o.cat] = (parCat[o.cat] || 0) + o.montant; });
    const d0 = ops.map(o => o.date).sort()[0], d1 = ops.map(o => o.date).sort().pop();
    return `<p class="j-sub">${ops.length} opérations du ${fr(d0)} au ${fr(d1)} · entrées ${money(ops.filter(o => o.montant > 0).reduce((a, o) => a + o.montant, 0))} · sorties ${money(-ops.filter(o => o.montant < 0).reduce((a, o) => a + o.montant, 0))}</p>
      <div class="gx-table-wrap"><table class="gx-table"><thead><tr><th>Catégorie</th><th class="text-right">Total</th></tr></thead><tbody>${Object.entries(parCat).sort((a, b) => a[1] - b[1]).map(([c, v]) => `<tr><td>${esc(c)}</td><td class="text-right ${v < 0 ? 'amount-negative' : 'amount-positive'}">${money(v)}</td></tr>`).join('')}</tbody></table></div>
      <details class="gx-reglages"><summary>Opérations (${ops.length})</summary><ul class="gx-det-list">${ops.slice().reverse().slice(0, 300).map(o => `<li><span>${fr(o.date)} · ${esc(o.lib)} <em>${esc(o.cat)}</em></span><span class="${o.montant < 0 ? 'amount-negative' : 'amount-positive'}">${money(o.montant, 1)}</span></li>`).join('')}</ul></details>`;
  }
  document.addEventListener('change', e => {
    if(e.target.id !== 'gxReleve' || !e.target.files[0]) return;
    const f = e.target.files[0], compteId = $('gxReleveCompte') && $('gxReleveCompte').value;
    f.text().then(txt => {
      const ops = lireCsv(txt); if(!ops.length){ alert("Aucune opération reconnue dans ce fichier (colonnes date et montant attendues)."); return; }
      ops.forEach(o => { o.cat = categoriser(o.lib, o.montant); });
      const prev = REG.val('releve', {ops:[]}).ops || [], cle = o => o.date + '|' + o.lib + '|' + o.montant;
      const vus = new Set(prev.map(cle)), nouv = ops.filter(o => !vus.has(cle(o)));
      REG.setVal('releve', {ops:prev.concat(nouv).sort((a, b) => a.date.localeCompare(b.date))});
      // Solde du compte : dernière ligne du relevé si la colonne existe
      const avecSolde = ops.filter(o => !isNaN(o.solde)).sort((a, b) => a.date.localeCompare(b.date)).pop();
      if(avecSolde && compteId){ R.comptes.update(compteId, 'solde', avecSolde.solde); R.comptes.update(compteId, 'date', avecSolde.date); }
      alert(`${nouv.length} opérations importées (${ops.length - nouv.length} déjà présentes).${avecSolde ? ' Solde du compte mis à jour au ' + fr(avecSolde.date) + '.' : ''}`);
      show('tresorerie');
    });
  });

  // ---------- Créances clients ----------
  const TRANCHES = [['Non échu', d => d === null || d >= 0], ['1–30 j', d => d < 0 && d >= -30], ['31–60 j', d => d < -30 && d >= -60], ['61–90 j', d => d < -60 && d >= -90], ['+ 90 j', d => d < -90]];
  function mailRelance(c){
    const crm = REG.val('crm', {})[c.client] || {}, mail = ((crm.contacts || []).find(x => x.email) || {}).email || '';
    const en = !/France/i.test(c.pays || '');
    const sujet = en ? `Payment reminder — invoice ${c.facture}` : `Relance — facture ${c.facture}`;
    const corps = en ? `Dear partner,\n\nUnless already done, we kindly remind you that invoice ${c.facture}${c.echeance ? ' due on ' + fr(c.echeance) : ''} for ${money(c.montant, 1)} is still outstanding.\nCould you please let us know when the payment will be made?\n\nBest regards,\nEmmanuelle Jane Paris`
      : `Bonjour,\n\nSauf erreur de notre part, la facture ${c.facture}${c.echeance ? ' échue le ' + fr(c.echeance) : ''} d'un montant de ${money(c.montant, 1)} reste à régler.\nPourriez-vous nous indiquer la date de paiement prévue ?\n\nBien cordialement,\nEmmanuelle Jane Paris`;
    return `mailto:${encodeURIComponent(mail)}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(corps)}`;
  }
  PAGES.creances = box => {
    const L = creancesToutes().map(c => Object.assign(c, {d:c.echeance ? days(c.echeance) : null})), tot = L.reduce((a, c) => a + c.montant, 0);
    const parClient = {}; L.forEach(c => { const p = parClient[c.client] = parClient[c.client] || {client:c.client, t:TRANCHES.map(() => 0), tot:0}; const i = TRANCHES.findIndex(([, f]) => f(c.d)); p.t[i] += c.montant; p.tot += c.montant; });
    const echu = L.filter(c => c.d !== null && c.d < 0).reduce((a, c) => a + c.montant, 0);
    box.innerHTML = head("Ce que les clients doivent encore. Reprend automatiquement les factures et échéanciers créés dans « Devis & factures », les virements attendus et les créances saisies plus bas (factures plus anciennes).") +
      kpis([['Total à encaisser', money(tot)], ['Dont échu', money(echu), echu ? 'ko' : 'ok'], ['Créances', L.length], ['Clients concernés', Object.keys(parClient).length]]) +
      `<h3 class="gx-h3">Balance âgée</h3><div class="gx-table-wrap"><table class="gx-table"><thead><tr><th>Client</th>${TRANCHES.map(([l]) => `<th class="text-right">${l}</th>`).join('')}<th class="text-right">Total</th></tr></thead><tbody>
      ${Object.values(parClient).sort((a, b) => b.tot - a.tot).map(p => `<tr><td>${esc(p.client)}</td>${p.t.map((v, i) => `<td class="text-right${v && i > 0 ? ' amount-negative' : ''}">${v ? money(v) : '—'}</td>`).join('')}<td class="text-right"><strong>${money(p.tot)}</strong></td></tr>`).join('') || `<tr><td colspan="${TRANCHES.length + 2}" class="reg-vide">Aucune créance en cours.</td></tr>`}
      </tbody></table></div>
      <h3 class="gx-h3">Détail et relances</h3><ul class="gx-list">${L.sort((a, b) => (a.d === null ? 1e9 : a.d) - (b.d === null ? 1e9 : b.d)).map(c => `<li class="${c.d !== null && c.d < 0 ? 'gx-late' : ''}">
        <div><strong>${esc(c.client)}</strong> · ${esc(c.facture || '')} <small>${esc(c.soc)}</small><div class="j-sub">${esc(c.quand)} · ${c.echeance ? (c.d < 0 ? `en retard de ${-c.d} j (${fr(c.echeance)})` : 'échéance ' + fr(c.echeance)) : 'date non fixée'}</div></div>
        <span class="gx-amt">${money(c.montant, 1)}</span>
        <span class="gx-btns"><a class="j-mini" href="${mailRelance(c)}">Relancer</a>${c.src !== 'vir' ? `<button type="button" class="j-mini" data-paye="${c.src}|${c.id}|${c.i}">Payé</button>` : ''}</span></li>`).join('') || '<li class="j-empty">Rien à encaisser.</li>'}</ul>
      <h3 class="gx-h3">Créances saisies à la main</h3><div id="gxCreances"></div>`;
    R.creances.render($('gxCreances'));
  };

  // ---------- Échéances fiscales ----------
  PAGES.fiscal = box => {
    const P = fiscReg(), t0 = T0(), debut = t0.slice(0, 7) + '-01', fin = addDays(t0, 365);
    const L = echeancesToutes(debut, fin).filter(e => !(e.fait && e.date < t0));
    const parMois = {}; L.forEach(e => (parMois[e.date.slice(0, 7)] = parMois[e.date.slice(0, 7)] || []).push(e));
    const retard = L.filter(e => !e.fait && e.date < t0).length, bientot = L.filter(e => !e.fait && e.date >= t0 && days(e.date) <= 15).length;
    box.innerHTML = head("Calendrier généré pour BSD (TVA mensuelle, DSN, ventes UE, acomptes et solde de l'IS, CFE, comptes annuels) et NB Evolution (impôt sur les sociétés aux Émirats, licence). Dates usuelles pour un exercice clos au 31 décembre : à ajuster avec l'expert-comptable. Saisir un montant le fait apparaître dans la trésorerie.") +
      kpis([['En retard', retard, retard ? 'ko' : 'ok'], ['Dans les 15 jours', bientot, bientot ? 'warn' : ''], ['Échéances sur 12 mois', L.length]]) +
      `<details class="gx-reglages"><summary>Réglages</summary><div class="gx-form">
        <label>Jour de la TVA (CA3)<input type="number" min="1" max="28" data-fisc="tvaJour" value="${P.tvaJour}"></label>
        <label>Jour de la DSN<input type="number" min="1" max="28" data-fisc="dsnJour" value="${P.dsnJour}"></label>
        <label>Ventes dans l'UE (déclaration mensuelle)<select data-fisc="deb"><option value="1"${P.deb ? ' selected' : ''}>Oui</option><option value="0"${P.deb ? '' : ' selected'}>Non</option></select></label>
        <label>Acompte d'IS habituel (€)<input type="number" data-fisc="isAcompte" value="${esc(P.isAcompte)}"></label>
        <label>Licence NB : date de renouvellement<input type="date" data-fisc="nbLicence" value="${esc(P.nbLicence)}"></label>
        <label>NB inscrite à la TVA aux Émirats<select data-fisc="nbTva"><option value="0"${P.nbTva ? '' : ' selected'}>Non</option><option value="1"${P.nbTva ? ' selected' : ''}>Oui</option></select></label></div></details>
      ${Object.keys(parMois).map(m => `<div class="gx-month"><div class="gx-mh">${moisNom(m)}</div><ul class="gx-fisc">${parMois[m].map(e => `<li class="${e.fait ? 'gx-fait' : e.date < t0 ? 'gx-late' : days(e.date) <= 15 ? 'gx-soon' : ''}">
        <input type="checkbox" data-ffait="${esc(e.key)}"${e.fait ? ' checked' : ''}><span class="gx-d">${e.date.slice(8, 10)}</span><span class="gx-soc">${e.soc}</span><span class="gx-lib">${esc(e.lib)}</span>
        ${e.auto ? `<input type="number" class="gx-mt" placeholder="Montant €" data-fmont="${esc(e.key)}" value="${e.montant === '' || e.montant == null ? '' : esc(e.montant)}">` : `<span class="gx-mt">${e.montant ? money(e.montant) : ''}</span>`}</li>`).join('')}</ul></div>`).join('')}
      <h3 class="gx-h3">Autres échéances (ajoutées à la main)</h3><div id="gxEcheances"></div>`;
    R.echeances.render($('gxEcheances'));
  };

  // ---------- Résultat & impôts ----------
  const impReg = () => REG.val('impots', {remGerant:0, autres:0, isReduit:15, isSeuil:42500, isTaux:25, ctSeuil:375000, ctTaux:9, zoneFranche:false});
  function resultat(v){
    const S = stats(v)[YEAR] || {}, P = impReg(), me = moisEcoules(), D = DEP(v);
    const mens = D ? D.fixed.charges.concat(D.fixed.salaires).reduce((a, x) => a + num(x.amount), 0) : 0;
    const calc = (marge, mois) => {
      const charges = mens * mois, extra = (v === 'BSD' ? num(P.remGerant) + num(P.autres) : 0) * mois / 12, res = marge - charges - extra;
      let impot = 0;
      if(v === 'BSD') impot = res <= 0 ? 0 : Math.min(res, num(P.isSeuil)) * num(P.isReduit) / 100 + Math.max(0, res - num(P.isSeuil)) * num(P.isTaux) / 100;
      else { const seuil = num(P.ctSeuil) * taux().AED; impot = P.zoneFranche ? 0 : Math.max(0, res - seuil) * num(P.ctTaux) / 100; }
      return {marge, charges:charges + extra, res, impot};
    };
    return {ca:S.kpi_ca || 0, mens, adate:calc(S.kpi_marge || 0, me), fin:calc((S.kpi_marge || 0) * 12 / me, 12), caFin:(S.kpi_ca || 0) * 12 / me};
  }
  PAGES.resultat = box => {
    const P = impReg(), B = resultat('BSD'), N = resultat('NB');
    const col = (t, X, note) => `<div class="gx-card"><div class="gx-ct">${t}</div><table class="gx-table gx-res"><thead><tr><th></th><th class="text-right">À ce jour</th><th class="text-right">Fin ${YEAR} (projection)</th></tr></thead><tbody>
      <tr><td>Chiffre d'affaires</td><td class="text-right">${money(X.ca)}</td><td class="text-right">${money(X.caFin)}</td></tr>
      <tr><td>Bénéfice produit (CA − prix de revient)</td><td class="text-right">${money(X.adate.marge)}</td><td class="text-right">${money(X.fin.marge)}</td></tr>
      <tr><td>Charges fixes, salaires et autres</td><td class="text-right amount-negative">${money(-X.adate.charges)}</td><td class="text-right amount-negative">${money(-X.fin.charges)}</td></tr>
      <tr class="gx-strong"><td>Résultat estimé</td><td class="text-right">${money(X.adate.res)}</td><td class="text-right">${money(X.fin.res)}</td></tr>
      <tr class="gx-strong gx-imp"><td>Impôt estimé</td><td class="text-right">${money(X.adate.impot)}</td><td class="text-right">${money(X.fin.impot)}</td></tr></tbody></table><p class="j-sub">${note}</p></div>`;
    box.innerHTML = head("Estimation à partir des factures (bénéfice produit) et des charges fixes mensuelles. Ce n'est pas un bilan : stocks, amortissements et charges exceptionnelles sont à valider avec l'expert-comptable.") +
      kpis([['Impôts estimés ' + YEAR + ' (projection)', money(B.fin.impot + N.fin.impot)], ['BSD — France', money(B.fin.impot)], ['NB Evolution — Émirats', money(N.fin.impot)]]) +
      `<div class="gx-grid2">${col('BSD — impôt sur les sociétés (France)', B, `Barème : ${P.isReduit} % jusqu'à ${money(P.isSeuil)} de bénéfice, ${P.isTaux} % au-delà. Charges fixes : ${money(B.mens)} par mois.`)}
        ${col('NB Evolution — Corporate Tax (Émirats)', N, P.zoneFranche ? 'Régime de zone franche appliqué (0 %) : à confirmer par l’expert-comptable.' : `${P.ctTaux} % au-delà de ${P.ctSeuil.toLocaleString('fr-FR')} AED (≈ ${money(P.ctSeuil * taux().AED)}). Charges NB : ${N.mens ? money(N.mens) + ' par mois' : 'non renseignées (data/depenses-nb.js)'}.`)}</div>
      <details class="gx-reglages" open><summary>Hypothèses</summary><div class="gx-form">
        <label>Rémunération annuelle du gérant (BSD, €)<input type="number" data-imp="remGerant" value="${esc(P.remGerant)}"></label>
        <label>Autres charges annuelles non comptées (BSD, €)<input type="number" data-imp="autres" value="${esc(P.autres)}"></label>
        <label>IS taux réduit %<input type="number" data-imp="isReduit" value="${P.isReduit}"></label><label>Seuil du taux réduit €<input type="number" data-imp="isSeuil" value="${P.isSeuil}"></label><label>IS taux normal %<input type="number" data-imp="isTaux" value="${P.isTaux}"></label>
        <label>Émirats : seuil exonéré (AED)<input type="number" data-imp="ctSeuil" value="${P.ctSeuil}"></label><label>Émirats : taux %<input type="number" data-imp="ctTaux" value="${P.ctTaux}"></label>
        <label>NB en zone franche qualifiée (0 %)<select data-imp="zoneFranche"><option value="0"${P.zoneFranche ? '' : ' selected'}>Non</option><option value="1"${P.zoneFranche ? ' selected' : ''}>Oui</option></select></label></div></details>`;
  };

  // ---------- Objectifs & budget ----------
  function objLigne(x){
    const S = stats('groupe')[YEAR] || {}, n = String(x.nom || '').trim().toLowerCase(); if(!n) return '';
    const list = x.type === 'Client' ? (S.clients || []) : (S.pays || []), key = x.type === 'Client' ? 'client' : 'pays';
    const r = list.filter(y => String(y[key]).toLowerCase() === n).reduce((a, y) => a + (y.ca || 0), 0), o = num(x.objectif), proj = r * 12 / moisEcoules();
    return `${money(r)} · <strong class="${o && proj >= o ? 'amount-positive' : 'amount-negative'}">${o ? Math.round(r / o * 100) + ' %' : '—'}</strong> · projection ${money(proj)}`;
  }
  function chargesReelles(cat){
    const C = (typeof CHARGES_DATA !== 'undefined' && CHARGES_DATA[YEAR]) || null; if(!C) return null;
    const c = C.categories[cat]; return c ? -c.total : 0;
  }
  function budLigne(x){
    const r = chargesReelles(x.cat), b = num(x.budget); if(r === null) return 'relevés non disponibles';
    const C = CHARGES_DATA[YEAR], fin = frToIso(String(C.period || '').split(' - ')[1] || ''), part = fin ? ((+fin.slice(5, 7) - 1) + (+fin.slice(8, 10)) / 30) / 12 : moisEcoules() / 12;
    return `${money(r)} · <strong class="${b && r > b * part ? 'amount-negative' : 'amount-positive'}">${b ? Math.round(r / b * 100) + ' % du budget' : '—'}</strong>${b ? ` <small>(${Math.round(part * 100)} % de l'année écoulée au ${fr(fin)})</small>` : ''}`;
  }
  function comLigne(x){
    const S = stats('groupe')[YEAR] || {}, noms = String(x.clients || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    const cl = (S.clients || []).filter(c => noms.some(n => String(c.client).toLowerCase().includes(n)));
    const base = cl.reduce((a, c) => a + (x.base === 'Marge' ? (c.marge || 0) : (c.ca || 0)), 0), due = base * num(x.taux) / 100;
    return `${money(due)} <small>sur ${money(base)} de ${x.base === 'Marge' ? 'marge' : 'CA'}${num(x.paye) ? ` · reste ${money(due - num(x.paye))}` : ''}</small>`;
  }
  PAGES.objectifs = box => {
    const O = REG.val('objectif_global', {}), obj = num(O[YEAR]), S = stats('groupe')[YEAR] || {}, ca = S.kpi_ca || 0, proj = ca * 12 / moisEcoules();
    const mois = S.mois || [], mObj = obj / 12, mx = Math.max(1, mObj, ...mois.map(m => m.ca || 0));
    if(!R.budget.rows().length && typeof CHARGES_DATA !== 'undefined' && CHARGES_DATA[YEAR]) R.budget.save(CHARGES_DATA[YEAR].order.map(c => ({id:REG.uid(), cat:c, budget:''})));
    box.innerHTML = head("Objectifs de chiffre d'affaires (groupe, clients finaux) comparés au réalisé, budget des charges comparé aux relevés bancaires, et commissions des agents.") +
      `<div class="gx-form gx-obj"><label>Objectif de CA ${YEAR} (€)<input type="number" data-objg="${YEAR}" value="${esc(O[YEAR] || '')}"></label></div>` +
      kpis([['CA réalisé ' + YEAR, money(ca)], ['Objectif', obj ? money(obj) : '—'], ['Avancement', obj ? Math.round(ca / obj * 100) + ' %' : '—', obj ? (proj >= obj ? 'ok' : 'ko') : ''], ['Projection fin d’année', money(proj), obj ? (proj >= obj ? 'ok' : 'ko') : '']]) +
      `<h3 class="gx-h3">Mois par mois</h3><div class="gx-bars-m">${mois.map(m => `<div class="gx-bm"><span>${String(m.mois).slice(0, 3)}</span><div class="gx-bt"><i style="height:${Math.round((m.ca || 0) / mx * 100)}%"></i>${obj ? `<b style="bottom:${Math.round(mObj / mx * 100)}%"></b>` : ''}</div><em>${m.ca ? Math.round(m.ca / 1000) + ' k' : ''}</em></div>`).join('')}</div>
      ${obj ? `<p class="j-sub">Trait doré : objectif mensuel moyen (${money(mObj)}).</p>` : ''}
      <h3 class="gx-h3">Objectifs par pays et par client</h3><div id="gxObjectifs"></div>
      <h3 class="gx-h3">Budget des charges ${YEAR}</h3><div id="gxBudget"></div>
      <h3 class="gx-h3">Commissions des agents et vendeurs</h3><div id="gxAgents"></div>`;
    R.objectifs.render($('gxObjectifs')); R.budget.render($('gxBudget')); R.agents.render($('gxAgents'));
  };

  // ---------- Fiches clients ----------
  let crmSel = null, crmQ = '';
  const crm = () => REG.val('crm', {});
  function clientsTous(){
    const S = stats('groupe').total || {}, m = {};
    (S.clients || []).forEach(c => { m[c.client] = {client:c.client, pays:c.pays, ca:c.ca, n:c.factures || c.nb || 0}; });
    Object.keys(typeof CLIENTS !== 'undefined' ? CLIENTS : {}).concat(Object.keys(crm())).forEach(k => { if(!m[k]) m[k] = {client:k, pays:(CLIENTS[k] || {}).pays || '', ca:0, n:0}; });
    return Object.values(m).sort((a, b) => b.ca - a.ca);
  }
  PAGES.crm = box => {
    const all = clientsTous(), q = crmQ.toLowerCase(), list = all.filter(c => !q || (c.client + ' ' + c.pays).toLowerCase().includes(q));
    if(!crmSel || !all.some(c => c.client === crmSel)) crmSel = (list[0] || {}).client || null;
    const C = crm()[crmSel] || {}, base = all.find(c => c.client === crmSel) || {}, adr = (typeof CLIENTS !== 'undefined' && CLIENTS[crmSel]) || {};
    const S = stats('groupe').total || {}, fact = (S.factures || []).filter(f => f.client === crmSel);
    const last = fact.map(f => frToIso(f.date)).sort().pop() || '';
    const top = ((S.client_top_products || {})[crmSel + '|' + base.pays] || []).slice(0, 5);
    box.innerHTML = head("Une fiche par client : contacts, conditions négociées, comptes rendus de rendez-vous et échantillons envoyés. Les chiffres viennent des factures.") +
      `<div class="crm"><div class="crm-list"><input class="search-box" id="crmQ" placeholder="Rechercher un client…" value="${esc(crmQ)}"><ul>${list.map(c => `<li class="${c.client === crmSel ? 'active' : ''}" data-crm="${esc(c.client)}"><span>${esc(c.client)}<small>${esc(c.pays || '')}</small></span><em>${c.ca ? money(c.ca) : ''}</em></li>`).join('')}</ul>
        <form class="eq-form" id="crmNew"><input name="nom" placeholder="Nouveau client" required><button class="doc-btn">Créer</button></form></div>
      ${crmSel ? `<div class="crm-fiche"><div class="crm-h"><div><div class="eq-nom">${esc(crmSel)}</div><div class="eq-role">${esc(base.pays || adr.pays || '')}</div></div></div>
        ${kpis([['CA total', money(base.ca)], ['Factures', fact.length], ['Dernière commande', last ? fr(last) : '—', last && days(last) < -120 ? 'ko' : '']])}
        ${adr.adresse ? `<p class="j-sub">${esc(adr.adresse).replace(/\n/g, ' · ')}${adr.tvaClient ? ' · ' + esc(adr.tvaClient) : ''}</p>` : ''}
        ${top.length ? `<p class="j-sub">Produits phares : ${top.map(t => esc(t.reference || t.ref || t[0] || '')).join(' · ')}</p>` : ''}
        <h3 class="gx-h3">Contacts</h3><ul class="crm-items">${(C.contacts || []).map((x, i) => `<li><span><strong>${esc(x.nom)}</strong> ${esc(x.role || '')}<small>${[x.email && `<a href="mailto:${esc(x.email)}">${esc(x.email)}</a>`, x.tel && `<a href="https://wa.me/${esc(String(x.tel).replace(/\D/g, ''))}" target="_blank" rel="noopener">${esc(x.tel)}</a>`].filter(Boolean).join(' · ')}</small></span><button data-crmdel="contacts|${i}">×</button></li>`).join('') || '<li class="j-empty">Aucun contact.</li>'}</ul>
        <form class="eq-form" data-crmadd="contacts"><input name="nom" placeholder="Nom" required><input name="role" placeholder="Fonction"><input name="email" placeholder="E-mail"><input name="tel" placeholder="Téléphone / WhatsApp"><button class="doc-btn">Ajouter</button></form>
        <h3 class="gx-h3">Conditions négociées</h3><div class="gx-form">${[['remise', 'Remise accordée'], ['prix', 'Prix spécifiques'], ['paiement', 'Conditions de paiement'], ['incoterm', 'Livraison / incoterm'], ['exclusivite', 'Exclusivité / territoire']].map(([k, l]) => `<label>${l}<input data-crmf="${k}" value="${esc(C[k] || '')}"></label>`).join('')}</div>
        <h3 class="gx-h3">Rendez-vous et échanges</h3>
        <form class="eq-form" data-crmadd="notes"><input name="date" type="date" value="${T0()}"><input name="txt" placeholder="Compte rendu, demande du client, suite à donner…" required><button class="doc-btn">Noter</button></form>
        <ul class="crm-items">${(C.notes || []).map((x, i) => [x, i]).reverse().map(([x, i]) => `<li><span><small>${fr(x.date)}</small>${esc(x.txt)}</span><button data-crmdel="notes|${i}">×</button></li>`).join('') || '<li class="j-empty">Aucune note.</li>'}</ul>
        <h3 class="gx-h3">Échantillons envoyés</h3>
        <form class="eq-form" data-crmadd="echantillons"><input name="date" type="date" value="${T0()}"><input name="txt" placeholder="Références envoyées" required><input name="suivi" placeholder="Retour du client"><button class="doc-btn">Ajouter</button></form>
        <ul class="crm-items">${(C.echantillons || []).map((x, i) => [x, i]).reverse().map(([x, i]) => `<li><span><small>${fr(x.date)}</small>${esc(x.txt)}${x.suivi ? ` — <em>${esc(x.suivi)}</em>` : ''}</span><button data-crmdel="echantillons|${i}">×</button></li>`).join('') || '<li class="j-empty">Aucun échantillon noté.</li>'}</ul>
      </div>` : ''}</div>`;
  };

  // ---------- Prospects ----------
  PAGES.prospects = box => {
    const L = R.prospects.rows(), et = R.prospects.cols.find(c => c.k === 'etape').o;
    const actifs = L.filter(x => !['Gagné', 'Perdu'].includes(x.etape)), gagnes = L.filter(x => x.etape === 'Gagné').length, fermes = L.filter(x => ['Gagné', 'Perdu'].includes(x.etape)).length;
    box.innerHTML = head("Les contacts pris (salons, recommandations, réseaux) jusqu'à la première commande. Changer l'étape au fil des échanges ; un prospect gagné peut ouvrir sa fiche client.") +
      kpis([['Prospects en cours', actifs.length], ['Valeur estimée en cours', money(actifs.reduce((a, x) => a + num(x.valeur), 0))], ['Taux de transformation', fermes ? Math.round(gagnes / fermes * 100) + ' %' : '—'], ['Actions en retard', actifs.filter(x => x.date && days(x.date) < 0).length, actifs.some(x => x.date && days(x.date) < 0) ? 'ko' : '']]) +
      `<div class="gx-funnel">${et.map(e => { const n = L.filter(x => x.etape === e); return `<div><span>${e}</span><strong>${n.length}</strong><em>${n.length ? money(n.reduce((a, x) => a + num(x.valeur), 0)) : ''}</em></div>`; }).join('')}</div><div id="gxProspects"></div>`;
    R.prospects.render($('gxProspects'));
  };

  // ---------- Approvisionnement ----------
  function couverture(){
    const S = stats('groupe')[YEAR] || {}, me = moisEcoules(), seuil = num(REG.val('appro', {seuil:3}).seuil) || 3, out = [];
    const vendu = {}; (S.refs || []).forEach(r => { vendu[r.collection + '|' + r.reference] = (r.btl || 0) + (r.testers || 0); });
    if(typeof ALL !== 'undefined' && ALL.stock) Object.values(ALL.stock).forEach(c => (c.items || []).forEach(i => {
      const v = vendu[c.collection + '|' + i.reference] || 0, parMois = v / me, cov = parMois ? i.qty / parMois : null;
      if(!v && !i.qty) return;
      out.push({col:c.collection, ref:i.reference, qty:i.qty, parMois, cov, etat:!parMois ? (i.qty ? 'dormant' : '') : cov < 1 ? 'urgent' : cov < seuil ? 'bientot' : 'ok'});
    }));
    return {seuil, list:out.sort((a, b) => (a.cov === null ? 1e9 : a.cov) - (b.cov === null ? 1e9 : b.cov))};
  }
  PAGES.appro = box => {
    const C = couverture(), urg = C.list.filter(x => x.etat === 'urgent'), bt = C.list.filter(x => x.etat === 'bientot');
    const enCours = R.commandes.rows().filter(x => x.statut !== 'Reçue');
    box.innerHTML = head(`Mois de stock restants pour chaque référence au rythme des ventes ${YEAR} (stock compté le ${fr(ALL.stock_ref_date || '')}, testeurs compris), et commandes fournisseurs en cours.`) +
      kpis([['À réapprovisionner d’urgence (< 1 mois)', urg.length, urg.length ? 'ko' : 'ok'], [`Sous le seuil (< ${C.seuil} mois)`, bt.length, bt.length ? 'warn' : ''], ['Commandes en cours', enCours.length], ['Arrivées en retard', enCours.filter(x => x.eta && days(x.eta) < 0).length, enCours.some(x => x.eta && days(x.eta) < 0) ? 'ko' : '']]) +
      `<div class="gx-form gx-obj"><label>Seuil d'alerte (mois de stock)<input type="number" min="1" step="0.5" data-appro="seuil" value="${C.seuil}"></label></div>
      <h3 class="gx-h3">Couverture du stock</h3><div class="gx-table-wrap"><table class="gx-table"><thead><tr><th>Collection</th><th>Référence</th><th class="text-right">Stock</th><th class="text-right">Ventes / mois</th><th class="text-right">Mois de stock</th><th></th></tr></thead><tbody>
      ${C.list.map(x => `<tr class="gx-${x.etat}"><td>${esc(x.col)}</td><td>${esc(x.ref)}</td><td class="text-right">${x.qty}</td><td class="text-right">${x.parMois ? Math.round(x.parMois) : '—'}</td><td class="text-right"><strong>${x.cov === null ? '—' : x.cov.toFixed(1).replace('.', ',')}</strong></td><td>${{urgent:'Réapprovisionner', bientot:'Prévoir', dormant:'Pas de vente', ok:'', '':''}[x.etat]}</td></tr>`).join('')}</tbody></table></div>
      <h3 class="gx-h3">Commandes fournisseurs</h3><div id="gxCommandes"></div>`;
    R.commandes.render($('gxCommandes'));
  };

  // ---------- Expéditions ----------
  PAGES.expeditions = box => {
    const L = R.expeditions.rows(), enCours = L.filter(x => !['Livrée'].includes(x.statut));
    box.innerHTML = head("Chaque envoi : transporteur, numéro de suivi, incoterm et documents export. Le parfum voyage comme marchandise dangereuse (UN 1266) : document spécifique obligatoire. La preuve d'export justifie la facture sans TVA.") +
      kpis([['Envois en cours', enCours.length], ['Problèmes', L.filter(x => x.statut === 'Problème').length, L.some(x => x.statut === 'Problème') ? 'ko' : ''], ['Livrés sans preuve d’export', L.filter(x => x.statut === 'Livrée' && !x.export).length, L.some(x => x.statut === 'Livrée' && !x.export) ? 'warn' : 'ok']]) +
      `<div id="gxExpeditions"></div>`;
    R.expeditions.render($('gxExpeditions'));
  };

  // ---------- Conformité ----------
  const confRefs = () => REG.val('conf_refs', {});
  PAGES.conformite = box => {
    const M = confRefs(), refs = [];
    if(typeof ALL !== 'undefined' && ALL.stock) Object.values(ALL.stock).forEach(c => (c.items || []).forEach(i => refs.push({col:c.collection, ref:i.reference, k:c.collection + '|' + i.reference})));
    const ok = r => { const x = M[r.k] || {}; return x.cpnp && x.dip && x.ifra && x.fds; };
    const E = R.enreg.rows(), exp = E.filter(x => x.expiration && days(x.expiration) < 60);
    box.innerHTML = head("Pour chaque référence : notification CPNP (Europe), dossier produit (DIP), certificat IFRA et fiche de données de sécurité. Puis les enregistrements par pays et les numéros de lot.") +
      kpis([['Références complètes', `${refs.filter(ok).length} / ${refs.length}`, refs.every(ok) ? 'ok' : 'warn'], ['Enregistrements pays obtenus', `${E.filter(x => x.statut === 'Obtenu').length} / ${E.length}`], ['Expirent dans 60 jours', exp.length, exp.length ? 'ko' : 'ok'], ['Lots enregistrés', R.lots.rows().length]]) +
      `<h3 class="gx-h3">Dossier réglementaire par référence</h3><div class="gx-table-wrap"><table class="gx-table gx-conf"><thead><tr><th>Collection</th><th>Référence</th><th>N° CPNP</th><th>DIP</th><th>IFRA (date)</th><th>FDS (date)</th><th>Note</th></tr></thead><tbody>
      ${refs.map(r => { const x = M[r.k] || {}; return `<tr class="${ok(r) ? 'reg-ok' : ''}" data-cr="${esc(r.k)}"><td>${esc(r.col)}</td><td>${esc(r.ref)}</td><td><input data-c="cpnp" value="${esc(x.cpnp || '')}"></td><td><input type="checkbox" data-c="dip"${x.dip ? ' checked' : ''}></td><td><input type="date" data-c="ifra" value="${esc(x.ifra || '')}"></td><td><input type="date" data-c="fds" value="${esc(x.fds || '')}"></td><td><input data-c="note" value="${esc(x.note || '')}"></td></tr>`; }).join('')}</tbody></table></div>
      <h3 class="gx-h3">Enregistrements par pays</h3><div id="gxEnreg"></div>
      <h3 class="gx-h3">Lots et traçabilité</h3><div id="gxLots"></div>`;
    R.enreg.render($('gxEnreg')); R.lots.render($('gxLots'));
  };

  /* ================= Affichage et événements ================= */
  function show(id){ const box = $(id + '-body'); if(box && PAGES[id]){ statsCache = {}; try { PAGES[id](box); } catch(e) { box.innerHTML = '<div class="warning-box">Erreur d’affichage : ' + esc(e.message) + '</div>'; console.error(e); } } }
  const actif = () => { const s = document.querySelector('.section.active'); return s && PAGES[s.id] ? s.id : null; };
  document.querySelectorAll('.sidebar .tab').forEach(t => t.addEventListener('click', () => { if(PAGES[t.dataset.tab]) show(t.dataset.tab); }));
  document.querySelectorAll('.soc-btn, .year-btn').forEach(b => b.addEventListener('click', () => setTimeout(() => { const a = actif(); if(a) show(a); }, 50)));

  document.addEventListener('click', e => {
    const b = e.target;
    const s = b.closest('#tresoSoc button'); if(s){ tresoSoc = s.dataset.s; show('tresorerie'); return; }
    const m = b.closest('tr.gx-mois'); if(m){ const d = m.nextElementSibling; if(d) d.hidden = !d.hidden; return; }
    if(b.dataset.paye){ const [src, id, i] = b.dataset.paye.split('|'); if(src === 'doc') EJ_DOCS.setRecu(id, +i, true); else R.creances.update(id, 'paye', true); show('creances'); return; }
    const c = b.closest('[data-crm]'); if(c){ crmSel = c.dataset.crm; show('crm'); return; }
    if(b.dataset.crmdel){ const [k, i] = b.dataset.crmdel.split('|'), all = crm(), C = all[crmSel]; if(C && C[k] && confirm('Supprimer ?')){ C[k].splice(+i, 1); REG.setVal('crm', all); show('crm'); } return; }
    if(b.dataset.fiche){ const all = crm(); all[b.dataset.fiche] = all[b.dataset.fiche] || {}; REG.setVal('crm', all); crmSel = b.dataset.fiche; const t = document.querySelector('.sidebar .tab[data-tab="crm"]'); if(t) t.click(); return; }
  });
  document.addEventListener('change', e => {
    const el = e.target;
    if(el.dataset.taux){ const T = taux(); T[el.dataset.taux] = +el.value || T[el.dataset.taux]; REG.setVal('taux', T); show('tresorerie'); }
    else if(el.dataset.fisc){ const P = fiscReg(); P[el.dataset.fisc] = el.tagName === 'SELECT' ? el.value === '1' : (el.type === 'number' ? (+el.value || '') : el.value); REG.setVal('fiscal', P); show('fiscal'); }
    else if(el.dataset.ffait){ const F = fiscFait(); if(el.dataset.ffait.startsWith('reg|')) R.echeances.update(el.dataset.ffait.slice(4), 'fait', el.checked); else { F[el.dataset.ffait] = el.checked; REG.setVal('fiscal_fait', F); } show('fiscal'); }
    else if(el.dataset.fmont){ const M = fiscMontant(); M[el.dataset.fmont] = el.value === '' ? '' : +el.value; REG.setVal('fiscal_montant', M); }
    else if(el.dataset.imp){ const P = impReg(); P[el.dataset.imp] = el.tagName === 'SELECT' ? el.value === '1' : +el.value; REG.setVal('impots', P); show('resultat'); }
    else if(el.dataset.objg){ const O = REG.val('objectif_global', {}); O[el.dataset.objg] = +el.value || ''; REG.setVal('objectif_global', O); show('objectifs'); }
    else if(el.dataset.appro){ REG.setVal('appro', {seuil:+el.value || 3}); show('appro'); }
    else if(el.dataset.crmf){ const all = crm(); (all[crmSel] = all[crmSel] || {})[el.dataset.crmf] = el.value.trim(); REG.setVal('crm', all); }
    else if(el.dataset.c && el.closest('tr[data-cr]')){ const M = confRefs(), k = el.closest('tr').dataset.cr; (M[k] = M[k] || {})[el.dataset.c] = el.type === 'checkbox' ? el.checked : el.value; REG.setVal('conf_refs', M); }
  });
  document.addEventListener('input', e => { if(e.target.id === 'crmQ'){ crmQ = e.target.value; const pos = e.target.selectionStart; show('crm'); const q = $('crmQ'); if(q){ q.focus(); q.setSelectionRange(pos, pos); } } });
  document.addEventListener('submit', e => {
    const f = e.target;
    if(f.id === 'crmNew'){ e.preventDefault(); const n = f.nom.value.trim(); if(!n) return; const all = crm(); all[n] = all[n] || {}; REG.setVal('crm', all); crmSel = n; crmQ = ''; show('crm'); }
    else if(f.dataset.crmadd){ e.preventDefault(); const all = crm(), C = all[crmSel] = all[crmSel] || {}, o = {}; [...f.elements].forEach(i => { if(i.name) o[i.name] = i.value.trim(); }); (C[f.dataset.crmadd] = C[f.dataset.crmadd] || []).push(o); REG.setVal('crm', all); show('crm'); }
  });
  // Les registres modifiés mettent à jour les chiffres de la page (sans redessiner le tableau en cours d'édition)
  let tm = null;
  window.addEventListener('ej-reg', ev => {
    const a = actif(); if(!a || ['crm'].includes(a)) return;
    if(['taux', 'fiscal', 'fiscal_fait', 'impots', 'objectif_global', 'appro', 'conf_refs', 'fiscal_montant', 'releve', 'crm'].includes(ev.detail)) return;
    clearTimeout(tm); tm = setTimeout(() => { const f = document.activeElement, inReg = f && f.closest && f.closest('.reg'); if(!inReg) show(a); }, 400);
  });

  /* ================= Rappels pour le journal de bord ================= */
  function rappels(){
    const out = [], t0 = T0();
    echeancesToutes(t0.slice(0, 7) + '-01', addDays(t0, 10)).filter(e => !e.fait).forEach(e => out.push({key:'fisc:' + e.key, cat:'admin', prio:e.date < t0 ? 3 : 2, tab:'fiscal', txt:`${e.soc} — ${e.lib}`, sub:e.date < t0 ? `en retard (${fr(e.date)})` : `le ${fr(e.date)}`}));
    R.enreg.rows().filter(x => x.expiration && days(x.expiration) < 60).forEach(x => out.push({key:'enreg:' + x.id + ':' + x.expiration, cat:'conformite', prio:days(x.expiration) < 0 ? 3 : 2, tab:'conformite', txt:`${x.pays} : ${x.organisme} ${days(x.expiration) < 0 ? 'expiré' : 'expire bientôt'}`, sub:'le ' + fr(x.expiration)}));
    R.commandes.rows().filter(x => x.statut !== 'Reçue' && x.eta && days(x.eta) < 0).forEach(x => out.push({key:'cmd:' + x.id + ':' + x.eta, cat:'fournisseur', prio:2, tab:'appro', txt:`Commande ${x.fournisseur || ''} ${x.objet || ''} en retard`, sub:'arrivée prévue le ' + fr(x.eta)}));
    R.expeditions.rows().filter(x => x.statut === 'Problème' || (x.statut === 'Livrée' && !x.export)).forEach(x => out.push({key:'exp:' + x.id + ':' + x.statut, cat:'logistique', prio:x.statut === 'Problème' ? 3 : 1, tab:'expeditions', txt:x.statut === 'Problème' ? `Problème d'expédition : ${x.client}` : `Récupérer la preuve d'export : ${x.client} ${x.facture || ''}`, sub:fr(x.date)}));
    R.prospects.rows().filter(x => !['Gagné', 'Perdu'].includes(x.etape) && x.date && days(x.date) <= 0).forEach(x => out.push({key:'pro:' + x.id + ':' + x.date, cat:'client', prio:2, tab:'prospects', txt:`Prospect ${x.nom} : ${x.action || 'relancer'}`, sub:'prévu le ' + fr(x.date)}));
    R.creances.rows().filter(x => !x.paye && x.echeance && days(x.echeance) < 0).forEach(x => out.push({key:'cre:' + x.id, cat:'paiement', prio:3, tab:'creances', txt:`Relancer ${x.client} : ${x.facture || 'créance'} (${money(enEur(x.montant, x.devise))})`, sub:`en retard de ${-days(x.echeance)} j`}));
    const C = couverture().list.filter(x => x.etat === 'urgent');
    if(C.length) out.push({key:'couv:' + t0.slice(0, 7) + ':' + C.length, cat:'stock', prio:2, tab:'appro', txt:`${C.length} références avec moins d'un mois de stock`, sub:C.slice(0, 6).map(x => x.ref).join(' · ')});
    try { const P = previsions('groupe'), neg = P.rows.find(r => r.fin < 0); if(neg && R.comptes.rows().some(x => x.solde !== '' && x.solde != null)) out.push({key:'treso:' + neg.m, cat:'paiement', prio:3, tab:'tresorerie', txt:`Trésorerie négative prévue en ${moisNom(neg.m)}`, sub:money(neg.fin)}); } catch(e) {}
    return out;
  }
  window.EJ_GESTION = {rappels, show, creances:creancesToutes, previsions, resultat, echeances:echeancesToutes, couverture, fournisseursDus, registres:R};
})();
