/* Assistant : questions en langage courant sur les données du dashboard.
   1) Réponses immédiates calculées ici, sans connexion ni coût (stock d'une référence, dernière facture d'un client,
      prochain salon, créances, chiffre d'affaires, meilleurs clients, échéances, trésorerie, impôts…).
   2) Mode « IA Claude » facultatif : avec une clé API Anthropic saisie dans l'assistant (gardée dans ce navigateur
      seulement, jamais dans le fichier ni dans le partage), les questions libres sont envoyées à Claude, qui consulte
      les données du dashboard via un outil. SDK officiel @anthropic-ai/sdk chargé depuis jsDelivr. */
(function(){
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = n => (n || 0).toLocaleString('fr-FR', {minimumFractionDigits:2, maximumFractionDigits:2}) + ' €';
  const money0 = n => Math.round(n || 0).toLocaleString('fr-FR') + ' €';
  const nombre = n => Math.round(n || 0).toLocaleString('fr-FR');
  const pad = n => String(n).padStart(2, '0');
  const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const fr = s => s ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : '';
  const frToIso = s => { const m = String(s || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? m[3] + '-' + m[2] + '-' + m[1] : ''; };
  const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const days = s => Math.round((new Date(s + 'T00:00:00') - today()) / 864e5);
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const YEAR = String(today().getFullYear());
  const KEY_CLE = 'ej_ia_cle', KEY_MODE = 'ej_ia_mode';
  const MOIS = ['janvier','fevrier','mars','avril','mai','juin','juillet','aout','septembre','octobre','novembre','decembre'];

  /* ================= Données ================= */
  let cacheStats = null, cacheT = 0;
  function stats(){ if(!cacheStats || Date.now() - cacheT > 30000){ cacheStats = window.EJ_SOC && EJ_SOC.statsFor ? EJ_SOC.statsFor('groupe') : ALL; cacheT = Date.now(); } return cacheStats; }
  const factures = () => (stats().total.factures || []).slice().sort((a, b) => frToIso(b.date).localeCompare(frToIso(a.date)) || String(b.facture).localeCompare(String(a.facture)));
  function stockItems(){ const out = []; if(typeof ALL !== 'undefined' && ALL.stock) Object.values(ALL.stock).forEach(c => (c.items || []).forEach(i => out.push(Object.assign({collection:c.collection}, i)))); return out; }
  function clientsNoms(){
    const s = new Set((stats().total.clients || []).map(c => c.client));
    if(typeof CLIENTS !== 'undefined') Object.keys(CLIENTS).forEach(k => s.add(k));
    try { Object.keys(REG.val('crm', {})).forEach(k => s.add(k)); } catch(e) {}
    return [...s];
  }
  const refsNoms = () => [...new Set(stockItems().map(i => i.reference).concat((stats().total.refs || []).map(r => r.reference)))];
  const paysNoms = () => [...new Set((stats().total.pays || []).map(p => p.pays))];

  // Trouve dans la question le nom (client, référence, pays) le plus long qui y figure ; tolère une petite faute de frappe.
  function lev(a, b){ const m = a.length, n = b.length; if(Math.abs(m - n) > 2) return 9; const d = Array.from({length:m + 1}, (_, i) => [i]); for(let j = 1; j <= n; j++) d[0][j] = j;
    for(let i = 1; i <= m; i++) for(let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[m][n]; }
  // Mots courants à ne jamais prendre pour un nom de client (« est » dans « Gare de l'Est », « gare »…)
  const VIDES = new Set(['est','gare','styles','pour','par','sur','mes','ses','aux','qui','que','quoi','son','pas','plus','moi','nous','vous','avec','dans','quel','quelle','quand','comme','tout','mon','ont','fait','prochain','prochaine','dernier','derniere','cette','annee','mois','client','clients','salon','salons','stock','prix','combien','une','vente','ventes','commande','commandes','facture','factures','prevu','prevue','il','elle','on','en','au','a','y',
  'nb','evolution','the','de','du','la','le','les','des','et','paris','group','company','trading','limited','ltd','llc','mmc','srls','aps','distribution','distributors','partners','parfum','parfums','perfumeria','cosmetics','global','brands','vip','black','royal','milano','uomo']);
  function trouver(q, noms){
    const Q = ' ' + norm(q) + ' ', mots = norm(q).split(' ');
    let best = null, score = 0;
    noms.forEach(n => {
      const N = norm(n); if(!N) return;
      if(Q.includes(' ' + N + ' ')){ if(N.length + 100 > score){ best = n; score = N.length + 100; } return; }
      // mots distinctifs du nom (« Gazzaz », « Arzum », « Jamal », « Luxe »…)
      N.replace(/[()]/g, ' ').split(' ').filter(w => w.length >= 3 && !VIDES.has(w)).forEach(w => {
        if(mots.includes(w)){ if(w.length + 50 > score){ best = n; score = w.length + 50; } }
        else if(w.length >= 6 && mots.some(m => m.length >= 5 && lev(m, w) <= 1)){ if(w.length + 10 > score){ best = n; score = w.length + 10; } }
      });
    });
    return best;
  }
  function annee(q){ const m = norm(q).match(/\b(2025|2026|2027)\b/); return m ? m[1] : (/(cette annee|annee en cours)/.test(norm(q)) ? YEAR : (/annee derniere/.test(norm(q)) ? String(+YEAR - 1) : null)); }
  function moisDe(q){ const Q = norm(q); const i = MOIS.findIndex(m => Q.includes(m)); return i >= 0 ? i : null; }

  /* ================= Réponses locales ================= */
  const btn = (txt, tab, extra) => `<button type="button" class="ia-go" data-tab="${tab}"${extra || ''}>${esc(txt)}</button>`;
  const R = [];
  const regle = (test, f) => R.push({test, f});

  // Facture par numéro
  regle(q => /\b(ej|nb|av)\s?\d{6,8}\b/i.test(q), q => {
    const num = q.match(/\b(ej|nb|av)\s?(\d{6,8})\b/i); const n = (num[1] + num[2]).toUpperCase();
    const f = factures().find(x => x.facture === n); if(!f) return `Je ne trouve pas la facture <strong>${esc(n)}</strong> dans les données.`;
    return factureHtml(f);
  });
  function factureHtml(f){
    const lignes = (f.lines || []).filter(l => l.mode !== 'remise').slice(0, 8).map(l => `${esc(l.reference)} (${esc(l.collection)}) : ${l.cartons ? l.cartons + ' ctn · ' : ''}${nombre(l.btl)} fl. · ${money0(l.ca)}`).join('<br>');
    return `<strong>Facture ${esc(f.facture)}</strong> du ${esc(f.date)} — ${esc(f.client)} (${esc(f.pays)})<br>Montant : <strong>${money(f.ca)}</strong> · ${nombre(f.btl)} flacons${f.marge != null ? ` · bénéfice ${money0(f.marge)}` : ''}<div class="ia-sub">${lignes}${(f.lines || []).length > 8 ? '<br>…' : ''}</div>${btn('Ouvrir la facture', 'factures', ` data-facture="${esc(f.facture)}"`)}`;
  }
  // Dernière(s) facture(s) / commande d'un client
  // Salons
  regle(q => /(salon|foire|expo|cosmoprof|beautyworld|esxence|intercharm|pitti)/.test(norm(q)), q => {
    if(typeof SALONS === 'undefined') return 'Calendrier des salons indisponible.';
    const Q = norm(q), futurs = SALONS.filter(s => /^\d{4}-\d{2}-\d{2}$/.test(s.debut) ? days(s.fin || s.debut) >= 0 : s.debut >= iso(today()).slice(0, 7)).filter(s => s.statut !== 'reporte').sort((a, b) => a.debut.localeCompare(b.debut));
    const cible = SALONS.filter(s => norm(s.nom).split(' ').some(w => w.length > 4 && Q.includes(w)) || Q.includes(norm(s.ville)));
    const fmt = s => `<li><strong>${esc(s.nom)}</strong> — ${esc(s.ville)} · ${/^\d{4}-\d{2}-\d{2}$/.test(s.debut) ? fr(s.debut) + (s.fin && s.fin !== s.debut ? ' au ' + fr(s.fin) : '') + (days(s.debut) > 0 ? ` (dans ${days(s.debut)} j)` : days(s.fin || s.debut) >= 0 ? ' (en cours)' : ' (terminé)') : 'date à confirmer (' + s.debut + ')'}${s.prio ? ' ★' : ''}</li>`;
    if(cible.length) return `<ul>${cible.sort((a, b) => a.debut.localeCompare(b.debut)).map(fmt).join('')}</ul>${btn('Calendrier des salons', 'salons')}`;
    const prio = /prioritaire|important/.test(Q) ? futurs.filter(s => s.prio) : futurs;
    return `Prochains salons :<ul>${prio.slice(0, 5).map(fmt).join('')}</ul>${btn('Calendrier des salons', 'salons')}`;
  });
  // Clients sans commande récente
  regle(q => /(inactif|n ont pas commande|pas commande depuis|plus commande|sans commande|a relancer)/.test(norm(q)), () => {
    const der = {}; factures().forEach(f => { const d = frToIso(f.date); if(!der[f.client] || d > der[f.client].d) der[f.client] = {d, pays:f.pays, ca:0}; });
    const L = Object.entries(der).filter(([, x]) => days(x.d) < -120).sort((a, b) => a[1].d.localeCompare(b[1].d));
    return `${L.length} clients sans commande depuis plus de 4 mois :<ul>${L.map(([c, x]) => `<li>${esc(c)} (${esc(x.pays)}) — dernière le ${fr(x.d)}</li>`).join('')}</ul>${btn('Espace Nassim', 'equipe-nassim')}`;
  });
  // Commandes d'un pays (dernière, liste, nombre)
  const PAYS_ALIAS = {emirats:'Émirats Arabes Unis', eau:'Émirats Arabes Unis', dubai:'Émirats Arabes Unis', uae:'Émirats Arabes Unis', arabie:'Arabie Saoudite', saoudite:'Arabie Saoudite', ksa:'Arabie Saoudite', angleterre:'Angleterre', 'royaume uni':'Angleterre', uk:'Angleterre', usa:'USA', 'etats unis':'USA', amerique:'USA', azerbaidjan:'Azerbaïdjan', nigeria:'Nigéria'};
  const ART = {'Sénégal':'du ', 'Qatar':'du ', 'Nigéria':'du ', 'Danemark':'du ', 'Vietnam':'du ', 'Maroc':'du ', 'Liban':'du ', 'Koweït':'du ', 'Pays-Bas':'des ', 'USA':'des ', 'Émirats Arabes Unis':'des ', 'Russie':'de la ', 'France':'de la '};
  const dePays = p => ART[p] || (/^[aeiouéèiyÉ]/i.test(p) ? "d'" : 'de ');
  function paysDe(q){ const p = trouver(q, paysNoms()); if(p) return p; const Q = ' ' + norm(q) + ' '; const k = Object.keys(PAYS_ALIAS).find(a => Q.includes(' ' + a + ' ')); return k && paysNoms().includes(PAYS_ALIAS[k]) ? PAYS_ALIAS[k] : null; }
  regle(q => /(facture|commande|achat|client|quand)/.test(norm(q)) && !trouver(q, clientsNoms()) && !!paysDe(q), q => {
    const p = paysDe(q), y = annee(q), L = factures().filter(f => f.pays === p && (!y || frToIso(f.date).startsWith(y))), Q = norm(q);
    if(!L.length) return `Aucune commande trouvée pour <strong>${esc(p)}</strong>${y ? ' en ' + y : ''}.`;
    const clients = [...new Set(L.map(f => f.client))];
    if(/(client)/.test(Q) && !/(derniere|dernier|quand)/.test(Q)) return `Clients en <strong>${esc(p)}</strong> : ${clients.map(esc).join(', ')}.<div class="ia-sub">${L.length} commande(s), ${money0(L.reduce((a, f) => a + f.ca, 0))} au total.</div>${btn('Pays', 'pays')}`;
    if(/(toutes|liste|historique|combien)/.test(Q)) return `<strong>${esc(p)}</strong>${y ? ' en ' + y : ''} : ${L.length} commande${L.length > 1 ? 's' : ''}, ${money0(L.reduce((a, f) => a + f.ca, 0))} (${clients.map(esc).join(', ')}).<ul>${L.slice(0, 12).map(f => `<li>${esc(f.date)} · ${esc(f.client)} · ${esc(f.facture)} · ${money0(f.ca)}</li>`).join('')}</ul>${btn('Pays', 'pays')}`;
    const d = frToIso(L[0].date), n = -days(d);
    return `La dernière commande ${dePays(p)}<strong>${esc(p)}</strong> remonte au <strong>${esc(L[0].date)}</strong> (il y a ${n > 60 ? Math.round(n / 30) + ' mois' : n + ' jours'}).<br>` + factureHtml(L[0]);
  });
  regle(q => /(facture|commande|achat|quand)/.test(norm(q)) && trouver(q, clientsNoms()), q => {
    const c = trouver(q, clientsNoms()), L = factures().filter(f => f.client === c);
    if(!L.length) return `Aucune facture trouvée pour <strong>${esc(c)}</strong>.`;
    if(/(toutes|liste|historique|combien de)/.test(norm(q))) return `<strong>${esc(c)}</strong> : ${L.length} facture${L.length > 1 ? 's' : ''}, ${money0(L.reduce((a, f) => a + f.ca, 0))} au total.<ul>${L.slice(0, 12).map(f => `<li>${esc(f.date)} · ${esc(f.facture)} · ${money0(f.ca)}</li>`).join('')}</ul>${btn('Voir ses factures', 'factures')}`;
    const n = -days(frToIso(L[0].date));
    return `Dernière commande de <strong>${esc(c)}</strong> : le ${esc(L[0].date)} (il y a ${n > 60 ? Math.round(n / 30) + ' mois' : n + ' jours'}).<br>` + factureHtml(L[0]);
  });
  // Stock d'une référence / ruptures
  regle(q => /(rupture|epuise|manque|reappro|stock bas|plus de stock)/.test(norm(q)), () => {
    const it = stockItems(), ep = it.filter(i => i.status === 'epuise'), bas = it.filter(i => i.status === 'critical' || i.status === 'low');
    return `<strong>${ep.length} références épuisées</strong> : ${ep.map(i => esc(i.reference)).join(', ') || 'aucune'}.<br><strong>${bas.length} en stock bas</strong> : ${bas.sort((a, b) => a.qty - b.qty).slice(0, 12).map(i => `${esc(i.reference)} (${i.qty})`).join(', ')}.<div class="ia-sub">Stock compté le ${fr(ALL.stock_ref_date)}.</div>${btn('Approvisionnement', 'appro')}`;
  });
  regle(q => /(stock|reste|dispo|combien de (flacons|bouteilles))/.test(norm(q)), q => {
    const r = trouver(q, refsNoms()), it = stockItems();
    if(!r){ const tot = it.reduce((a, i) => a + (i.qty || 0), 0); const parCol = {}; it.forEach(i => { parCol[i.collection] = (parCol[i.collection] || 0) + i.qty; });
      return `Stock total : <strong>${nombre(tot)} flacons</strong> (compté le ${fr(ALL.stock_ref_date)}).<div class="ia-sub">${Object.entries(parCol).map(([c, n]) => `${esc(c)} : ${nombre(n)}`).join(' · ')}</div>Précise une référence, par exemple « stock de Moon ».${btn('Page Stock', 'stock')}`; }
    const L = it.filter(i => i.reference === r);
    const cov = window.EJ_GESTION ? EJ_GESTION.couverture().list.filter(x => x.ref === r) : [];
    if(!L.length) return `<strong>${esc(r)}</strong> n'apparaît pas dans le stock compté.`;
    return L.map(i => { const c = cov.find(x => x.col === i.collection); return `<strong>${esc(r)}</strong> (${esc(i.collection)}) : <strong>${nombre(i.qty)} flacons</strong> en stock${c && c.cov != null ? ` · environ ${c.cov.toFixed(1).replace('.', ',')} mois de ventes` : ''}${i.status === 'epuise' ? ' · <span class="ia-ko">épuisé</span>' : i.status === 'critical' || i.status === 'low' ? ' · <span class="ia-ko">stock bas</span>' : ''}`; }).join('<br>') + `<div class="ia-sub">Stock compté le ${fr(ALL.stock_ref_date)}, mis à jour avec les factures suivantes.</div>${btn('Page Stock', 'stock')}`;
  });
  // Créances
  regle(q => /(doit|doivent|dette|impaye|creance|a encaisser|pas paye|retard de paiement|argent)/.test(norm(q)), () => {
    if(!window.EJ_GESTION) return 'Page Créances indisponible.';
    const L = EJ_GESTION.creances(), tot = L.reduce((a, c) => a + c.montant, 0);
    if(!L.length) return `Aucune créance enregistrée.<div class="ia-sub">Les factures créées dans « Devis & factures » et les créances saisies dans la page Créances clients sont prises en compte ; les factures plus anciennes du registre n'ont pas de suivi de paiement.</div>${btn('Créances clients', 'creances')}`;
    const parClient = {}; L.forEach(c => { parClient[c.client] = (parClient[c.client] || 0) + c.montant; });
    const echu = L.filter(c => c.echeance && days(c.echeance) < 0);
    return `<strong>${money0(tot)}</strong> à encaisser${echu.length ? `, dont <span class="ia-ko">${money0(echu.reduce((a, c) => a + c.montant, 0))} en retard</span>` : ''} :<ul>${Object.entries(parClient).sort((a, b) => b[1] - a[1]).map(([c, m]) => `<li>${esc(c)} : ${money0(m)}</li>`).join('')}</ul>${btn('Créances clients', 'creances')}`;
  });
  // Impôts / résultat
  regle(q => /(impot|taxe|corporate tax)/.test(norm(q)) && !/(echeance|date|quand|declaration)/.test(norm(q)), () => {
    if(!window.EJ_GESTION) return '';
    const B = EJ_GESTION.resultat('BSD'), N = EJ_GESTION.resultat('NB');
    return `Impôts estimés ${YEAR} (projection fin d'année) : <strong>${money0(B.fin.impot + N.fin.impot)}</strong><ul><li>BSD (France) : ${money0(B.fin.impot)} — résultat estimé ${money0(B.fin.res)}</li><li>NB Evolution (Émirats) : ${money0(N.fin.impot)} — résultat estimé ${money0(N.fin.res)}</li></ul><div class="ia-sub">À ce jour : BSD ${money0(B.adate.impot)}, NB ${money0(N.adate.impot)}. Estimation à valider avec l'expert-comptable.</div>${btn('Résultat & impôts', 'resultat')}`;
  });
  // Échéances
  regle(q => /(echeance|declaration|tva|urssaf|dsn|cfe|acompte|a declarer|deadline)/.test(norm(q)), () => {
    if(!window.EJ_GESTION) return '';
    const t = iso(today()), L = EJ_GESTION.echeances(t.slice(0, 7) + '-01', iso(new Date(Date.now() + 60 * 864e5))).filter(e => !e.fait);
    return `Prochaines échéances :<ul>${L.slice(0, 8).map(e => `<li>${fr(e.date)} · ${esc(e.soc)} · ${esc(e.lib)}${e.date < t ? ' <span class="ia-ko">(en retard)</span>' : ''}</li>`).join('')}</ul>${btn('Échéances fiscales', 'fiscal')}`;
  });
  // Trésorerie
  regle(q => /(treso|banque|solde|compte bancaire|cash)/.test(norm(q)), () => {
    if(!window.EJ_GESTION) return '';
    const P = EJ_GESTION.previsions('groupe'), min = P.rows.reduce((a, r) => r.fin < a.fin ? r : a, P.rows[0]);
    return `Trésorerie actuelle (comptes saisis) : <strong>${money0(P.solde)}</strong>.<br>Point le plus bas sur 6 mois : ${money0(min.fin)} (${esc(min.m)}) · solde prévu dans 6 mois : ${money0(P.rows[5].fin)}.${P.solde ? '' : '<div class="ia-sub">Saisis le solde des comptes dans la page Trésorerie pour une prévision juste.</div>'}${btn('Trésorerie', 'tresorerie')}`;
  });
  // Fournisseurs à payer
  regle(q => /(fournisseur|payer|goldrock|firmenich)/.test(norm(q)), () => {
    if(!window.EJ_GESTION) return '';
    const L = EJ_GESTION.fournisseursDus(); const tot = L.reduce((a, f) => a + f.montant, 0);
    return `<strong>${money0(tot)}</strong> de factures fournisseurs non marquées payées :<ul>${L.sort((a, b) => b.montant - a.montant).slice(0, 8).map(f => `<li>${esc(f.lib)} : ${money0(f.montant)}${f.retard ? ' <span class="ia-ko">(mois passé)</span>' : ''}</li>`).join('')}</ul>${btn('Factures fournisseurs', 'fournisseurs')}`;
  });
  // Meilleurs clients / références
  regle(q => /(meilleur|top|plus gros|principaux)/.test(norm(q)) && /(client)/.test(norm(q)), q => {
    const y = annee(q) || 'total', L = (stats()[y].clients || []).slice().sort((a, b) => b.ca - a.ca).slice(0, 5);
    return `Meilleurs clients ${y === 'total' ? '(2025 + 2026)' : y} :<ol>${L.map(c => `<li>${esc(c.client)} (${esc(c.pays)}) : ${money0(c.ca)}</li>`).join('')}</ol>${btn('Clients', 'clients')}`;
  });
  regle(q => /(meilleur|top|plus vendu|best)/.test(norm(q)) && /(ref|parfum|produit|vente|vendu)/.test(norm(q)), q => {
    const y = annee(q) || 'total', L = (stats()[y].refs || []).filter(r => r.btl).slice().sort((a, b) => b.btl - a.btl).slice(0, 8);
    return `Références les plus vendues ${y === 'total' ? '(2025 + 2026)' : y} :<ol>${L.map(r => `<li>${esc(r.reference)} (${esc(r.collection)}) : ${nombre(r.btl)} fl. · ${money0(r.ca)}</li>`).join('')}</ol>${btn('Références', 'refs')}`;
  });
  // Bénéfice / marge
  regle(q => /(benefice|marge|rentab|resultat)/.test(norm(q)), q => {
    const y = annee(q) || YEAR, S = stats()[y] || {};
    return `Bénéfice produit ${y} (CA − prix de revient) : <strong>${money0(S.kpi_marge)}</strong> sur ${money0(S.kpi_ca)} de chiffre d'affaires (${S.kpi_ca ? Math.round(S.kpi_marge / S.kpi_ca * 100) : 0} %).<div class="ia-sub">Avant charges fixes et impôts : voir Résultat & impôts.</div>${btn('Résultat & impôts', 'resultat')}`;
  });
  // Chiffre d'affaires (client, pays, mois, année)
  regle(q => /(chiffre|ca |vendu|ventes|combien.*(fait|vend)|rapporte)/.test(norm(q) + ' '), q => {
    const y = annee(q), c = trouver(q, clientsNoms()), p = paysDe(q), m = moisDe(q), S = stats()[y || 'total'];
    if(!c && !p && trouver(q, refsNoms())) return null;   // ventes d'une référence : règle suivante
    if(c){ const L = factures().filter(f => f.client === c && (!y || frToIso(f.date).startsWith(y))); return `<strong>${esc(c)}</strong>${y ? ' en ' + y : ''} : <strong>${money0(L.reduce((a, f) => a + f.ca, 0))}</strong> sur ${L.length} facture${L.length > 1 ? 's' : ''}${L[0] ? ` (dernière le ${esc(L[0].date)})` : ''}.${btn('Fiche client', 'crm', ` data-client="${esc(c)}"`)}`; }
    if(p){ const x = (S.pays || []).find(z => z.pays === p) || {}; return `<strong>${esc(p)}</strong>${y ? ' en ' + y : ' (2025 + 2026)'} : <strong>${money0(x.ca)}</strong> · ${x.clients || 0} client(s) · ${x.factures || 0} facture(s).${btn('Pays', 'pays')}`; }
    if(m !== null){ const Y = y || YEAR, mm = (stats()[Y].mois || [])[m] || {}; return `${MOIS[m][0].toUpperCase() + MOIS[m].slice(1)} ${Y} : <strong>${money0(mm.ca)}</strong> · ${mm.factures || 0} facture(s) · ${nombre(mm.btl)} flacons.${btn('Mois', 'mois')}`; }
    const Y = y || YEAR, T = stats()[Y] || {};
    return `Chiffre d'affaires ${Y} : <strong>${money0(T.kpi_ca)}</strong> · ${T.kpi_factures} factures · ${T.kpi_clients} clients · ${nombre(T.kpi_btl)} flacons.${Y === YEAR ? `<div class="ia-sub">Projection fin d'année au rythme actuel : ${money0(T.kpi_ca * 12 / (today().getMonth() + today().getDate() / 30))}.</div>` : ''}${btn("Vue d'ensemble", 'overview')}`;
  });
  // Ventes d'une référence (« combien de Moon vendu », « ventes de Dolce Vita en 2026 »)
  regle(q => /(vendu|vente|combien|ca |chiffre)/.test(norm(q) + ' ') && !!trouver(q, refsNoms()) && !trouver(q, clientsNoms()), q => {
    const r = trouver(q, refsNoms()), y = annee(q), L = (stats()[y || 'total'].refs || []).filter(x => x.reference === r);
    if(!L.length) return `Aucune vente de <strong>${esc(r)}</strong>${y ? ' en ' + y : ''}.`;
    const clients = {}; factures().filter(f => !y || frToIso(f.date).startsWith(y)).forEach(f => (f.lines || []).forEach(l => { if(l.reference === r) clients[f.client] = (clients[f.client] || 0) + (l.btl || 0); }));
    return L.map(x => `<strong>${esc(r)}</strong> (${esc(x.collection)})${y ? ' en ' + y : ' (2025 + 2026)'} : <strong>${nombre(x.btl)} flacons</strong> vendus · ${money0(x.ca)} · bénéfice ${money0(x.marge)}`).join('<br>') +
      `<div class="ia-sub">Principaux clients : ${Object.entries(clients).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([c, n]) => `${esc(c)} (${nombre(n)})`).join(', ')}</div>${btn('Références', 'refs')}`;
  });
  // Informations sur un client
  regle(q => !!trouver(q, clientsNoms()), q => {
    const c = trouver(q, clientsNoms()), L = factures().filter(f => f.client === c), crm = (() => { try { return REG.val('crm', {})[c] || {}; } catch(e) { return {}; } })();
    const adr = (typeof CLIENTS !== 'undefined' && CLIENTS[c]) || {}, contact = (crm.contacts || [])[0];
    return `<strong>${esc(c)}</strong>${L[0] ? ' (' + esc(L[0].pays) + ')' : ''} : ${L.length} facture(s), ${money0(L.reduce((a, f) => a + f.ca, 0))} au total${L[0] ? `, dernière le ${esc(L[0].date)} (${esc(L[0].facture)}, ${money0(L[0].ca)})` : ''}.${adr.adresse ? `<div class="ia-sub">${esc(adr.adresse).replace(/\n/g, ', ')}</div>` : ''}${contact ? `<div class="ia-sub">Contact : ${esc(contact.nom)} ${esc(contact.email || '')} ${esc(contact.tel || '')}</div>` : ''}${btn('Fiche client', 'crm', ` data-client="${esc(c)}"`)}`;
  });
  // Prospects, commandes, expéditions
  regle(q => /prospect/.test(norm(q)), () => { const L = EJ_GESTION.registres.prospects.rows().filter(x => !['Gagné', 'Perdu'].includes(x.etape)); return `${L.length} prospect(s) en cours :<ul>${L.slice(0, 8).map(x => `<li>${esc(x.nom)} (${esc(x.pays || '')}) — ${esc(x.etape)}${x.action ? ' · ' + esc(x.action) : ''}</li>`).join('')}</ul>${btn('Prospects', 'prospects')}`; });
  regle(q => /(commande fournisseur|livraison fournisseur|arrivage|en production)/.test(norm(q)), () => { const L = EJ_GESTION.registres.commandes.rows().filter(x => x.statut !== 'Reçue'); return `${L.length} commande(s) fournisseur en cours :<ul>${L.map(x => `<li>${esc(x.fournisseur)} — ${esc(x.objet || '')} · ${esc(x.statut)}${x.eta ? ' · arrivée ' + fr(x.eta) : ''}</li>`).join('')}</ul>${btn('Approvisionnement', 'appro')}`; });
  regle(q => /(expedition|colis|envoi|tracking|suivi)/.test(norm(q)), () => { const L = EJ_GESTION.registres.expeditions.rows().filter(x => x.statut !== 'Livrée'); return `${L.length} envoi(s) en cours :<ul>${L.map(x => `<li>${esc(x.client)} — ${esc(x.transporteur || '')} ${esc(x.suivi || '')} · ${esc(x.statut)}</li>`).join('')}</ul>${btn('Expéditions', 'expeditions')}`; });
  // Que faire aujourd'hui
  regle(q => /(faire aujourd|a faire|taches|rappel|priorite)/.test(norm(q)), () => { const L = window.EJ_GESTION ? EJ_GESTION.rappels().sort((a, b) => b.prio - a.prio) : []; return `À traiter en priorité :<ul>${L.slice(0, 6).map(r => `<li>${esc(r.txt)}${r.sub ? ' <span class="ia-sub-i">— ' + esc(r.sub) + '</span>' : ''}</li>`).join('')}</ul>${btn('Journal de bord', 'journal')}`; });
  // Prix d'une référence
  regle(q => /(prix|cout|revient|tarif)/.test(norm(q)) && trouver(q, refsNoms()), q => {
    const r = trouver(q, refsNoms()), L = [];
    Object.entries(ALL.costs || {}).forEach(([col, c]) => (c.refs || []).forEach(x => { if((x.name || x.reference) === r) L.push(`${esc(col)} : prix de revient ${money(x.cost_per_bottle)} par flacon vendu (fabrication ${money(x.cost_per_bottle_fabrication)}, concentré ${esc(x.conc || '')}) · marge ${esc(x.margin_pct)} % au prix standard`); }));
    const st = stockItems().filter(i => i.reference === r).map(i => `${esc(i.collection)} : prix de vente standard ${money(i.prix_btl)}`);
    return `<strong>${esc(r)}</strong><br>${st.concat(L).join('<br>') || 'Pas de prix enregistré.'}${btn('Prix de revient', 'costs')}`;
  });

  regle(q => !!paysDe(q), q => {
    const p = paysDe(q), L = factures().filter(f => f.pays === p), x = (stats().total.pays || []).find(z => z.pays === p) || {};
    return `<strong>${esc(p)}</strong> : ${money0(x.ca)} de chiffre d'affaires (2025 + 2026), ${L.length} commande(s), clients : ${[...new Set(L.map(f => f.client))].map(esc).join(', ')}.${L[0] ? `<br>Dernière commande le ${esc(L[0].date)} (${esc(L[0].client)}, ${money0(L[0].ca)}).` : ''}${btn('Pays', 'pays')}`;
  });
  regle(q => !!trouver(q, refsNoms()), q => {
    const r = trouver(q, refsNoms()), st = stockItems().filter(i => i.reference === r), v = (stats().total.refs || []).filter(x => x.reference === r);
    return `<strong>${esc(r)}</strong> : ${st.map(i => `${esc(i.collection)} — ${nombre(i.qty)} flacons en stock`).join(' · ') || 'pas de stock compté'}${v.length ? `<br>Ventes 2025 + 2026 : ${v.map(x => `${nombre(x.btl)} flacons (${money0(x.ca)})`).join(' · ')}` : ''}${btn('Page Stock', 'stock')}`;
  });

  function repondreLocal(q){
    for(const r of R){ try { if(r.test(q)){ const h = r.f(q); if(h) return h; } } catch(e) { console.warn(e); } }
    return null;
  }
  const AIDE = `Je peux répondre sur : le <strong>stock</strong> d'une référence, la <strong>dernière facture</strong> d'un client, le <strong>chiffre d'affaires</strong> (client, pays, mois, année), les <strong>meilleurs clients</strong> et <strong>références</strong>, les <strong>salons</strong>, les <strong>créances</strong>, les <strong>échéances fiscales</strong>, la <strong>trésorerie</strong>, les <strong>impôts</strong>, les <strong>fournisseurs à payer</strong>, les <strong>prospects</strong>, les <strong>expéditions</strong>.`;

  /* ================= Mode IA (Claude) ================= */
  // Un seul outil : Claude choisit le sujet et un filtre ; on lui renvoie les données en JSON (listes limitées).
  const SUJETS = ['factures','clients','pays','stock','references','ventes_mensuelles','salons','creances','echeances','tresorerie','resultat_impots','fournisseurs_a_payer','prospects','commandes_fournisseurs','expeditions','documents_crees','charges_fixes','fiches_clients'];
  function donnees(sujet, filtre, annee_){
    const f = norm(filtre || ''), y = annee_ && stats()[annee_] ? annee_ : null, S = stats()[y || 'total'], match = o => !f || norm(JSON.stringify(o)).includes(f);
    const lim = (a, n) => a.filter(match).slice(0, n || 40);
    switch(sujet){
      case 'factures': return lim(factures().filter(x => !y || frToIso(x.date).startsWith(y)).map(x => ({facture:x.facture, date:x.date, client:x.client, pays:x.pays, ca:x.ca, benefice:Math.round(x.marge), flacons:x.btl, lignes:(x.lines || []).map(l => `${l.collection} ${l.reference} ${l.btl}fl ${Math.round(l.ca)}€`).join('; ')})), 30);
      case 'clients': return lim((S.clients || []).map(c => ({client:c.client, pays:c.pays, factures:c.factures, ca:Math.round(c.ca), benefice:Math.round(c.marge), flacons:c.btl})), 60);
      case 'pays': return lim((S.pays || []).map(p => ({pays:p.pays, clients:p.clients, factures:p.factures, ca:Math.round(p.ca), benefice:Math.round(p.marge)})), 60);
      case 'stock': return {compte_le:ALL.stock_ref_date, references:lim(stockItems().map(i => ({collection:i.collection, reference:i.reference, stock:i.qty, statut:i.status, prix_vente:i.prix_btl})), 80)};
      case 'references': return lim((S.refs || []).map(r => ({collection:r.collection, reference:r.reference, flacons:r.btl, ca:Math.round(r.ca), benefice:Math.round(r.marge)})), 60);
      case 'ventes_mensuelles': return (stats()[y || YEAR].mois || []).map(m => ({mois:m.mois, factures:m.factures, flacons:m.btl, ca:Math.round(m.ca), benefice:Math.round(m.marge)}));
      case 'salons': return lim((typeof SALONS !== 'undefined' ? SALONS : []).map(s => ({nom:s.nom, ville:s.ville, pays:s.pays, debut:s.debut, fin:s.fin, statut:s.statut, prioritaire:!!s.prio, note:s.note})), 50);
      case 'creances': return window.EJ_GESTION ? lim(EJ_GESTION.creances().map(c => ({client:c.client, facture:c.facture, societe:c.soc, montant:Math.round(c.montant), echeance:c.echeance, detail:c.quand}))) : [];
      case 'echeances': return window.EJ_GESTION ? lim(EJ_GESTION.echeances(iso(today()).slice(0, 7) + '-01', iso(new Date(Date.now() + 120 * 864e5))).map(e => ({date:e.date, societe:e.soc, echeance:e.lib, fait:e.fait, montant:e.montant}))) : [];
      case 'tresorerie': if(!window.EJ_GESTION) return {}; { const P = EJ_GESTION.previsions('groupe'); return {solde_actuel:Math.round(P.solde), mois:P.rows.map(r => ({mois:r.m, debut:Math.round(r.debut), entrees:Math.round(r.inn), sorties:Math.round(-r.out), fin:Math.round(r.fin)}))}; }
      case 'resultat_impots': if(!window.EJ_GESTION) return {}; return ['BSD', 'NB'].reduce((o, s) => { const X = EJ_GESTION.resultat(s); o[s] = {ca:Math.round(X.ca), a_ce_jour:{benefice_produit:Math.round(X.adate.marge), charges:Math.round(X.adate.charges), resultat:Math.round(X.adate.res), impot:Math.round(X.adate.impot)}, fin_annee:{resultat:Math.round(X.fin.res), impot:Math.round(X.fin.impot)}}; return o; }, {});
      case 'fournisseurs_a_payer': return window.EJ_GESTION ? lim(EJ_GESTION.fournisseursDus().map(x => ({societe:x.soc, libelle:x.lib, montant:Math.round(x.montant), date:x.date, mois_passe:x.retard}))) : [];
      case 'prospects': return window.EJ_GESTION ? lim(EJ_GESTION.registres.prospects.rows()) : [];
      case 'commandes_fournisseurs': return window.EJ_GESTION ? lim(EJ_GESTION.registres.commandes.rows()) : [];
      case 'expeditions': return window.EJ_GESTION ? lim(EJ_GESTION.registres.expeditions.rows()) : [];
      case 'documents_crees': return window.EJ_DOCS ? lim(EJ_DOCS.list().map(d => ({type:d.type, numero:d.numero, date:d.date, client:d.client, pays:d.pays, statut:d.statut, total:Math.round(EJ_DOCS.calc(d).ttc)}))) : [];
      case 'charges_fixes': return typeof FIXED_CHARGES !== 'undefined' ? {charges:FIXED_CHARGES.charges, salaires:FIXED_CHARGES.salaires} : {};
      case 'fiches_clients': try { const C = REG.val('crm', {}); return Object.keys(C).filter(k => !f || norm(k).includes(f)).slice(0, 20).map(k => Object.assign({client:k}, C[k], typeof CLIENTS !== 'undefined' && CLIENTS[k] ? {adresse:CLIENTS[k].adresse} : {})); } catch(e) { return []; }
    }
    return {erreur:'sujet inconnu'};
  }
  const OUTIL = {
    name:'consulter_donnees',
    description:"Lit les données du tableau de bord d'Emmanuelle Jane Paris (sociétés BSD en France et NB Evolution à Dubaï). Choisir le sujet ; filtre = texte à rechercher (nom de client, référence, pays, numéro…) ; annee = 2025 ou 2026 pour les sujets factures, clients, pays, references, ventes_mensuelles. Montants en euros. Appeler plusieurs fois si besoin.",
    input_schema:{type:'object', additionalProperties:false, required:['sujet'], properties:{
      sujet:{type:'string', enum:SUJETS}, filtre:{type:'string', description:'Texte à rechercher, facultatif'}, annee:{type:'string', enum:['2025','2026'], description:'Année, facultatif'}}}
  };
  let SDK = null, client = null, histo = [];
  async function claude(question){
    const cle = (() => { try { return localStorage.getItem(KEY_CLE) || ''; } catch(e) { return ''; } })();
    if(!cle) throw new Error('Aucune clé API');
    if(!SDK) SDK = (await import('https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.128.0/+esm')).default;
    if(!client || client.apiKey !== cle) client = new SDK({apiKey:cle, dangerouslyAllowBrowser:true});
    const system = `Tu es l'assistant du tableau de bord d'Emmanuelle Jane Paris, maison de parfums (collections VIP, VIP BLACK, 50ML, BRUMES, ROYAL). Deux sociétés : BSD (France, factures EJ…) et NB Evolution (Dubaï, factures NB…). Nous sommes le ${today().toLocaleDateString('fr-FR')}. Réponds en français, de façon courte et précise, avec les chiffres exacts tirés de l'outil consulter_donnees (ne jamais inventer de chiffre). Si une donnée manque, dis-le. Utilise des listes courtes quand il y a plusieurs éléments.`;
    histo.push({role:'user', content:question});
    for(let tour = 0; tour < 8; tour++){
      const rep = await client.beta.messages.create({
        model:'claude-opus-5-5', max_tokens:16000, system, tools:[OUTIL], messages:histo,
        output_config:{effort:'medium'},
        // Repli automatique sur un autre modèle si une demande est refusée par les filtres de sécurité
        betas:['server-side-fallback-2026-07-01'], fallbacks:'default'
      });
      histo.push({role:'assistant', content:rep.content});
      if(rep.stop_reason === 'refusal') return 'La demande n’a pas pu être traitée.';
      if(rep.stop_reason === 'pause_turn') continue;
      const appels = rep.content.filter(b => b.type === 'tool_use');
      if(rep.stop_reason !== 'tool_use' || !appels.length) return rep.content.filter(b => b.type === 'text').map(b => b.text).join('\n') || '(pas de réponse)';
      histo.push({role:'user', content:appels.map(b => { let r; try { const i = b.input || {}; r = SUJETS.includes(i.sujet) ? donnees(i.sujet, i.filtre, i.annee) : {erreur:'sujet inconnu'}; } catch(e) { r = {erreur:e.message}; }
        return {type:'tool_result', tool_use_id:b.id, content:JSON.stringify(r).slice(0, 60000)}; })});
    }
    return 'Réponse interrompue (trop d’étapes).';
  }
  // Mise en forme simple du texte de Claude (gras, listes, retours à la ligne)
  function md(t){
    return esc(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').split('\n').reduce((a, l) => {
      const li = l.match(/^\s*(?:[-•*]|\d+[.)])\s+(.*)/);
      if(li){ if(!a.inList){ a.out.push('<ul>'); a.inList = true; } a.out.push('<li>' + li[1] + '</li>'); }
      else { if(a.inList){ a.out.push('</ul>'); a.inList = false; } if(l.trim()) a.out.push(l.replace(/^#+\s*/, '') + '<br>'); }
      return a;
    }, {out:[], inList:false}).out.join('') + '';
  }

  /* ================= Interface ================= */
  const SUGG = ['Stock de Moon', 'Dernière facture de Gazzaz', 'Quel est le prochain salon ?', 'Qui me doit de l’argent ?', 'CA 2026', 'Meilleurs clients 2026', 'Références en rupture', 'Prochaines échéances fiscales', 'Combien d’impôts cette année ?', 'Qu’est-ce que je dois faire aujourd’hui ?'];
  const fab = document.createElement('button'); fab.type = 'button'; fab.className = 'ia-fab'; fab.title = 'Assistant'; fab.setAttribute('aria-label', 'Ouvrir l’assistant');
  fab.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>';
  const box = document.createElement('div'); box.className = 'ia-box'; box.hidden = true;
  box.innerHTML = `<div class="ia-h"><div><div class="ia-t">Assistant</div><div class="ia-mode" id="iaMode"></div></div><button type="button" class="ia-x" data-ia="reglages" title="Réglages">⚙</button><button type="button" class="ia-x" data-ia="fermer" title="Fermer">×</button></div>
    <div class="ia-reg" id="iaReg" hidden><p>Réponses directes : sans connexion, gratuites, sur les données du dashboard. Pour les questions libres, ajoute une clé API Anthropic (console.anthropic.com) : elle reste dans ce navigateur uniquement, n'est ni dans le fichier ni partagée. Chaque question envoyée à Claude est facturée sur ce compte.</p>
      <input type="password" id="iaCle" placeholder="Clé API Anthropic (sk-ant-…)" autocomplete="off"><label><input type="checkbox" id="iaClaude"> Envoyer à Claude les questions sans réponse directe</label>
      <div class="ia-reg-act"><button type="button" class="j-mini" data-ia="effacer">Effacer la clé</button><button type="button" class="doc-btn primary" data-ia="sauver">Enregistrer</button></div></div>
    <div class="ia-msgs" id="iaMsgs"><div class="ia-m ia-bot">Bonjour. Pose une question sur les ventes, le stock, les clients, les salons, les paiements… <div class="ia-sugg">${SUGG.map(s => `<button type="button" data-q="${esc(s)}">${esc(s)}</button>`).join('')}</div></div></div>
    <form class="ia-f" id="iaForm"><input id="iaQ" placeholder="Ta question…" autocomplete="off"><button class="doc-btn primary" aria-label="Envoyer">➤</button></form>`;
  document.body.appendChild(fab); document.body.appendChild(box);
  const $ = id => document.getElementById(id), msgs = $('iaMsgs');
  const cle = () => { try { return localStorage.getItem(KEY_CLE) || ''; } catch(e) { return ''; } };
  const modeClaude = () => { try { return !!cle() && localStorage.getItem(KEY_MODE) !== '0'; } catch(e) { return false; } };
  const majMode = () => { $('iaMode').textContent = modeClaude() ? 'Réponses directes + IA Claude' : 'Réponses directes sur tes données'; };
  majMode();
  function ajoute(html, qui){ const d = document.createElement('div'); d.className = 'ia-m ia-' + qui; d.innerHTML = html; msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight; return d; }
  async function poser(q){
    q = q.trim(); if(!q) return;
    ajoute(esc(q), 'moi');
    // Avec l'IA activée, les questions longues ou d'analyse vont directement à Claude ; les questions simples restent instantanées.
    const complexe = modeClaude() && (norm(q).split(' ').length > 9 || /(compar|pourquoi|analys|conseil|explique|strateg|recommand|resume|synthese|tendance|prevoir|devrais)/.test(norm(q)));
    const loc = complexe ? null : repondreLocal(q);
    if(loc){ ajoute(loc, 'bot'); return; }
    if(!modeClaude()){ ajoute('Je n’ai pas trouvé de réponse directe à cette question. ' + AIDE + '<div class="ia-sub">Pour les questions libres, ajoute une clé API Anthropic dans les réglages (⚙).</div>', 'bot'); return; }
    const att = ajoute('<span class="ia-wait">Claude réfléchit…</span>', 'bot');
    try { att.innerHTML = md(await claude(q)); }
    catch(e) { att.innerHTML = 'Erreur : ' + esc(e.status === 401 ? 'clé API refusée' : e.message || e) + '. ' + (e.status === 401 ? 'Vérifie la clé dans les réglages (⚙).' : ''); histo = []; }
    msgs.scrollTop = msgs.scrollHeight;
  }
  fab.addEventListener('click', () => { box.hidden = !box.hidden; fab.classList.toggle('ouvert', !box.hidden); if(!box.hidden) setTimeout(() => $('iaQ').focus(), 50); });
  $('iaForm').addEventListener('submit', e => { e.preventDefault(); const q = $('iaQ').value; $('iaQ').value = ''; poser(q); });
  box.addEventListener('click', e => {
    const s = e.target.closest('[data-q]'); if(s){ poser(s.dataset.q); return; }
    const g = e.target.closest('.ia-go');
    if(g){
      const t = document.querySelector(`.sidebar .tab[data-tab="${g.dataset.tab}"]`);
      if(g.dataset.facture){ const y = document.querySelector('.year-btn[data-year="total"]'); if(y && !y.classList.contains('active')) y.click(); setTimeout(() => { if(typeof openFactureModal === 'function') openFactureModal(g.dataset.facture); }, 100); }
      else if(t){ t.click(); if(g.dataset.client && window.EJ_GESTION) setTimeout(() => { const li = document.querySelector(`.crm-list li[data-crm="${CSS.escape(g.dataset.client)}"]`); if(li) li.click(); }, 150); }
      if(window.innerWidth < 600){ box.hidden = true; fab.classList.remove('ouvert'); }
      return;
    }
    const a = e.target.closest('[data-ia]'); if(!a) return;
    if(a.dataset.ia === 'fermer'){ box.hidden = true; fab.classList.remove('ouvert'); }
    else if(a.dataset.ia === 'reglages'){ const r = $('iaReg'); r.hidden = !r.hidden; $('iaCle').value = cle() ? '••••••••' + cle().slice(-4) : ''; $('iaClaude').checked = modeClaude() || !cle(); }
    else if(a.dataset.ia === 'sauver'){ const v = $('iaCle').value.trim(); try { if(v && !v.startsWith('••')) localStorage.setItem(KEY_CLE, v); localStorage.setItem(KEY_MODE, $('iaClaude').checked ? '1' : '0'); } catch(x) {} $('iaReg').hidden = true; client = null; majMode(); }
    else if(a.dataset.ia === 'effacer'){ try { localStorage.removeItem(KEY_CLE); } catch(x) {} $('iaCle').value = ''; client = null; histo = []; majMode(); }
  });
  window.EJ_ASSISTANT = {repondreLocal, donnees, poser};
})();
