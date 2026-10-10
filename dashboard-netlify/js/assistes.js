/* Parcours guidés des actions rapides de l'accueil : une question par écran, de grands boutons, « Retour » à chaque étape.
   - Faire une facture / un devis : société → client → parfums et cartons → paiement → récapitulatif,
     puis l'éditeur habituel s'ouvre déjà rempli (EJ_DOCS.preparer) pour vérifier et enregistrer.
   - Voir le stock : collection → références avec quantités (ou recherche d'un parfum).
   - Chercher un client : recherche → fiche (dernière commande, total, à encaisser) → facture, devis ou fiche complète.
   - Poser une question : thème → question (avec choix du parfum ou du client si besoin) → réponse (moteur de l'assistant). */
(function(){
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const money0 = n => Math.round(n || 0).toLocaleString('fr-FR') + ' €';
  const nb = n => Math.round(n || 0).toLocaleString('fr-FR');
  const pdate = s => { const m = String(s || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? new Date(+m[3], +m[2] - 1, +m[1]).getTime() : 0; };
  const aller = tab => { const b = [...document.querySelectorAll(`.sidebar .tab[data-tab="${tab}"]`)].find(x => x.offsetParent) || document.querySelector(`.sidebar .tab[data-tab="${tab}"]`); if(b) b.click(); };
  const D = () => window.EJ_DOCS;

  /* ---------- Données ---------- */
  function factures(){ const S = window.EJ_SOC && EJ_SOC.statsFor ? EJ_SOC.statsFor('groupe') : ALL; return ((S.total || ALL.total || {}).factures || []); }
  function clients(){
    const m = {};
    factures().forEach(f => { if(!f.client) return; const c = m[f.client] || (m[f.client] = {nom:f.client, pays:f.pays, n:0, ca:0, der:null, nb:false});
      c.n++; c.ca += f.ca || 0; if(!c.der || pdate(f.date) >= pdate(c.der.date)){ c.der = f; c.pays = f.pays || c.pays; } if(/^NB/.test(f.facture)) c.nb = true; });
    if(typeof CLIENTS !== 'undefined') Object.entries(CLIENTS).forEach(([k, v]) => { if(!m[k]) m[k] = {nom:k, pays:v.pays, n:0, ca:0, der:null}; });
    return Object.values(m).sort((a, b) => (b.der ? pdate(b.der.date) : 0) - (a.der ? pdate(a.der.date) : 0) || a.nom.localeCompare(b.nom, 'fr'));
  }
  function stockItems(col){ return ((((ALL.stock || {})[col]) || {}).items || []).slice().sort((a, b) => a.reference.localeCompare(b.reference, 'fr')); }
  const etat = i => i.qty <= 0 ? ['ko', 'En rupture'] : (i.status === 'critical' || i.status === 'low') ? ['bas', 'Bientôt épuisé'] : ['ok', 'En stock'];
  function aEncaisser(nom){ try { return EJ_GESTION.creances().filter(c => norm(c.client) === norm(nom)).reduce((a, c) => a + (c.montant || 0), 0); } catch(e) { return 0; } }
  const COLS = () => (D() && D().PARFUMS) || ['VIP', 'VIP BLACK', '50ML', 'BRUMES', 'ROYAL'];
  const nomCol = c => (D() && D().COLL && D().COLL[c] ? D().COLL[c].court : c);

  /* ---------- Fenêtre ---------- */
  const ov = document.createElement('div'); ov.className = 'wz-ov'; ov.hidden = true;
  ov.innerHTML = `<div class="wz" role="dialog" aria-modal="true" aria-labelledby="wzT"><div class="wz-h"><div><div class="wz-k" id="wzK"></div><div class="wz-t" id="wzT"></div></div><button type="button" class="wz-x" data-wz-act="fermer" aria-label="Fermer">×</button></div>
    <div class="wz-pas" id="wzPas"></div><div class="wz-b" id="wzB"></div><div class="wz-f" id="wzF"></div></div>`;
  document.body.appendChild(ov);
  const $ = id => document.getElementById(id);
  let P = null;          // parcours en cours : {nom, etapes, i, data}
  const pile = [];       // historique pour « Retour »

  function ouvrir(nom, data){ P = {nom, data:data || {}}; pile.length = 0; ov.hidden = false; document.body.classList.add('wz-on'); aller_(PARCOURS[nom].debut); }
  function fermer(){ ov.hidden = true; document.body.classList.remove('wz-on'); P = null; }
  function aller_(etape, sansHisto){ if(P.etape && !sansHisto) pile.push(P.etape); P.etape = etape; rendre(); }
  function retour(){ if(pile.length){ P.etape = pile.pop(); rendre(); } else fermer(); }
  function rendre(){
    const def = PARCOURS[P.nom], e = def.etapes[P.etape], n = def.ordre.indexOf(P.etape);
    $('wzK').textContent = def.titre; $('wzT').textContent = typeof e.q === 'function' ? e.q() : e.q;
    $('wzPas').innerHTML = def.ordre.map((k, i) => `<span class="${i < n ? 'fait' : i === n ? 'ici' : ''}"></span>`).join('') + (n >= 0 ? `<em>Étape ${n + 1} sur ${def.ordre.length}</em>` : '');
    $('wzB').innerHTML = e.h(); $('wzB').scrollTop = 0;
    const suite = e.suite ? e.suite() : null;
    $('wzF').innerHTML = `<button type="button" class="wz-ret" data-wz-act="retour">‹ ${pile.length ? 'Retour' : 'Annuler'}</button>${suite ? `<button type="button" class="wz-ok" data-wz-act="suite"${suite.off ? ' disabled' : ''}>${suite.l}</button>` : ''}`;
    if(e.apres) e.apres();
    const f = $('wzB').querySelector('[data-wz-focus]'); if(f && window.innerWidth > 700) setTimeout(() => f.focus(), 30);
  }
  const maj = () => rendre();

  /* ---------- Briques ---------- */
  const gros = (act, val, titre, sous, cls) => `<button type="button" class="wz-choix${cls ? ' ' + cls : ''}" data-wz="${act}" data-v="${esc(val)}"><strong>${titre}</strong>${sous ? `<small>${sous}</small>` : ''}</button>`;
  function listeClients(filtre, act){
    const q = norm(filtre), L = clients().filter(c => !q || norm(c.nom).includes(q) || norm(c.pays).includes(q)).slice(0, q ? 30 : 12);
    return L.length ? L.map(c => gros(act, c.nom, esc(c.nom), esc([c.pays, c.der ? 'dernière commande le ' + c.der.date : 'pas encore de commande'].filter(Boolean).join(' · ')))).join('')
      : '<p class="wz-vide">Aucun client trouvé avec ce nom.</p>';
  }
  const champRecherche = (ph, val) => `<input class="wz-in" id="wzRech" data-wz-focus placeholder="${ph}" value="${esc(val || '')}" autocomplete="off">`;
  function brancherRecherche(cible, f){ const i = $('wzRech'); if(!i) return; i.addEventListener('input', () => { $(cible).innerHTML = f(i.value); }); }

  /* ---------- Parcours : facture / devis ---------- */
  const PAIEMENTS = [['100c', 'Tout à la commande', '100 % avant de préparer la commande'], ['50e', 'Moitié-moitié', '50 % à la commande, 50 % avant expédition'], ['30e', 'Acompte de 30 %', '30 % à la commande, 70 % avant expédition'],
    ['50j60', 'Moitié maintenant, moitié à 60 jours', '50 % à la commande, 50 % 60 jours après la date de la facture'], ['50l', 'Moitié à la livraison', '50 % à la commande, 50 % à la livraison'], ['30j', 'À 30 jours', 'le client paie tout 30 jours après la facture'], ['60j', 'À 60 jours', 'le client paie tout 60 jours après la facture'], ['', 'Je verrai plus tard', 'conditions habituelles de la société']];
  function totalLignes(d){ return (d.lignes || []).reduce((a, l) => a + l.qty * (D() ? D().prixCarton(d.client, l.collection) : 0), 0); }
  function lignesHtml(d){
    if(!d.lignes.length) return '<p class="wz-vide">Aucun parfum pour l’instant : choisissez une collection puis touchez un parfum.</p>';
    return `<ul class="wz-lignes">${d.lignes.map((l, i) => `<li><span><strong>${esc(l.reference)}</strong><small>${esc(nomCol(l.collection))} · ${D() ? D().perCarton(l.collection) : ''} flacons par carton</small></span>
      <span class="wz-qte"><button type="button" data-wz="moins" data-v="${i}" aria-label="Un carton de moins">−</button><b>${l.qty}</b><button type="button" data-wz="plus" data-v="${i}" aria-label="Un carton de plus">+</button></span><em>carton${l.qty > 1 ? 's' : ''}</em>
      <button type="button" class="wz-suppr" data-wz="suppr" data-v="${i}" aria-label="Retirer">×</button></li>`).join('')}</ul>
      <p class="wz-total">Environ <strong>${money0(totalLignes(d))}</strong> HT <small>(prix habituels ; modifiables à la fin)</small></p>`;
  }
  const facture = type => ({
    titre: type === 'devis' ? 'Faire un devis' : 'Faire une facture',
    debut: 'soc', ordre: ['soc', 'client', 'parfums', 'paiement', 'recap'],
    etapes: {
      soc: {q:'Pour quelle société ?', h:() => `<div class="wz-grille2">${gros('soc', 'BSD', 'BSD', 'France · factures EJ…')}${gros('soc', 'NB', 'NB Evolution', 'Dubaï · factures NB…')}</div>`},
      client: {q:'Pour quel client ?', h:() => `${champRecherche('Tapez le nom du client ou le pays…', P.data.rech)}<div id="wzListe" class="wz-liste">${listeClients(P.data.rech, 'client')}</div>
        <button type="button" class="wz-lien" data-wz="nouveau">+ C’est un nouveau client</button>`, apres:() => brancherRecherche('wzListe', v => { P.data.rech = v; return listeClients(v, 'client'); })},
      nouveau: {q:'Nouveau client', h:() => `<label class="wz-lab">Nom de la société cliente<input class="wz-in" id="wzNom" data-wz-focus value="${esc(P.data.client || '')}"></label>
        <label class="wz-lab">Pays<input class="wz-in" id="wzPays" value="${esc(P.data.pays || '')}" placeholder="Ex. Arabie saoudite"></label>
        <label class="wz-lab">Adresse (facultatif)<textarea class="wz-in" id="wzAdr" rows="3">${esc(P.data.adresse || '')}</textarea></label>`,
        suite:() => ({l:'Continuer ›'}), valider:() => { const n = $('wzNom').value.trim(); if(!n){ $('wzNom').focus(); return false; } Object.assign(P.data, {client:n, pays:$('wzPays').value.trim(), adresse:$('wzAdr').value.trim()}); aller_('parfums'); }},
      parfums: {q:() => 'Quels parfums pour ' + P.data.client + ' ?', h:() => {
        const d = P.data; d.col = d.col || COLS()[0];
        const refs = (D() && D().REFS[d.col]) || stockItems(d.col).map(i => i.reference);
        const st = {}; stockItems(d.col).forEach(i => { st[i.reference] = i; });
        return `<div class="wz-onglets">${COLS().map(c => `<button type="button" class="${c === d.col ? 'actif' : ''}" data-wz="col" data-v="${esc(c)}">${esc(nomCol(c))}</button>`).join('')}</div>
          <p class="wz-aide">Touchez un parfum pour l’ajouter (1 carton). Touchez-le encore pour ajouter un carton.</p>
          <div class="wz-refs">${refs.map(r => { const i = st[r], e = i ? etat(i) : null, n = (d.lignes.find(l => l.collection === d.col && l.reference === r) || {}).qty;
            return `<button type="button" class="wz-ref${n ? ' pris' : ''}" data-wz="ref" data-v="${esc(r)}"><strong>${esc(r)}</strong><small class="${e ? e[0] : ''}">${i ? nb(i.qty) + ' en stock' : ''}</small>${n ? `<b>${n}</b>` : ''}</button>`; }).join('')}</div>
          <h4 class="wz-h4">Votre commande</h4><div id="wzLignes">${lignesHtml(d)}</div>`; },
        suite:() => { const n = P.data.lignes.reduce((x, l) => x + l.qty, 0); return {l:n ? `Continuer (${n} carton${n > 1 ? 's' : ''}) ›` : 'Continuer ›', off:!n}; }, valider:() => aller_('paiement')},
      paiement: {q:'Comment le client va-t-il payer ?', h:() => `<div class="wz-liste">${PAIEMENTS.map(([k, t, s]) => gros('pay', k, t, s, P.data.preset === k ? 'actif' : '')).join('')}</div>`},
      recap: {q:'On vérifie ensemble', h:() => { const d = P.data, pay = PAIEMENTS.find(p => p[0] === d.preset);
        return `<dl class="wz-recap"><dt>Document</dt><dd>${type === 'devis' ? 'Devis' : 'Facture'} ${d.soc === 'NB' ? 'NB Evolution (Dubaï)' : 'BSD (France)'}</dd>
          <dt>Client</dt><dd>${esc(d.client)}${d.pays ? ' · ' + esc(d.pays) : ''}</dd>
          <dt>Parfums</dt><dd>${d.lignes.map(l => `${l.qty} carton${l.qty > 1 ? 's' : ''} de <strong>${esc(l.reference)}</strong> <small>(${esc(nomCol(l.collection))})</small>`).join('<br>')}</dd>
          <dt>Total estimé</dt><dd><strong>${money0(totalLignes(d))}</strong> HT</dd><dt>Paiement</dt><dd>${pay ? pay[1] + (pay[0] ? ' — ' + pay[2] : '') : '—'}</dd></dl>
          <p class="wz-aide">En cliquant ci-dessous, ${type === 'devis' ? 'le devis s’ouvre déjà rempli' : 'la facture s’ouvre déjà remplie'}. Vous pourrez encore changer un prix ou ajouter un cadeau, puis cliquer sur <strong>Enregistrer</strong>.</p>`; },
        suite:() => ({l:type === 'devis' ? 'Préparer le devis ›' : 'Préparer la facture ›'}),
        valider:() => { const d = P.data; fermer(); aller('documents');
          setTimeout(() => D().preparer({type, societe:d.soc, client:d.client, pays:d.pays, adresse:d.adresse, lignes:d.lignes, preset:d.preset}), 60); }}
    },
    clic: {
      soc: v => { P.data.soc = v; P.data.lignes = P.data.lignes || []; aller_(P.data.client ? 'parfums' : 'client'); },
      client: v => { const c = clients().find(x => x.nom === v) || {}; Object.assign(P.data, {client:v, pays:c.pays || '', adresse:''}); aller_('parfums'); },
      nouveau: () => { P.data.client = ''; aller_('nouveau'); },
      col: v => { P.data.col = v; maj(); },
      ref: v => { const d = P.data, l = d.lignes.find(x => x.collection === d.col && x.reference === v); if(l) l.qty++; else d.lignes.push({collection:d.col, reference:v, qty:1}); maj(); },
      plus: i => { P.data.lignes[+i].qty++; maj(); },
      moins: i => { const l = P.data.lignes[+i]; if(l.qty > 1) l.qty--; else P.data.lignes.splice(+i, 1); maj(); },
      suppr: i => { P.data.lignes.splice(+i, 1); maj(); },
      pay: v => { P.data.preset = v; aller_('recap'); }
    }
  });

  /* ---------- Parcours : stock ---------- */
  function refsTrouvees(q){
    q = norm(q); if(!q) return '';
    const L = []; COLS().forEach(c => stockItems(c).forEach(i => { if(norm(i.reference).includes(q)) L.push([c, i]); }));
    return L.length ? `<div class="wz-stock">${L.slice(0, 20).map(([c, i]) => ligneStock(i, c)).join('')}</div>` : '<p class="wz-vide">Aucun parfum de ce nom.</p>';
  }
  function ligneStock(i, col){ const e = etat(i); return `<div class="wz-st ${e[0]}"><span><strong>${esc(i.reference)}</strong>${col ? `<small>${esc(nomCol(col))}</small>` : ''}</span><b>${nb(i.qty)}<small> flacons</small></b><em>${e[1]}</em></div>`; }
  const stock = {
    titre:'Voir le stock', debut:'col', ordre:['col', 'liste'],
    etapes: {
      col: {q:'Quelle collection voulez-vous voir ?', h:() => `${champRecherche('Ou tapez le nom d’un parfum (ex. Moon)…')}<div id="wzTrouve"></div>
        <div class="wz-grille2">${COLS().map(c => { const it = stockItems(c), r = it.filter(i => i.qty <= 0).length, b = it.filter(i => i.qty > 0 && etat(i)[0] === 'bas').length;
          return gros('col', c, esc(nomCol(c)), `${nb(it.reduce((a, i) => a + Math.max(0, i.qty), 0))} flacons · ${it.length} parfums${r ? ` · <span class="ko">${r} en rupture</span>` : ''}${b ? ` · <span class="bas">${b} bientôt épuisé${b > 1 ? 's' : ''}</span>` : ''}`); }).join('')}</div>`,
        apres:() => brancherRecherche('wzTrouve', refsTrouvees)},
      liste: {q:() => 'Stock — ' + nomCol(P.data.col), h:() => { const it = stockItems(P.data.col), ord = {ko:0, bas:1, ok:2};
        it.sort((a, b) => ord[etat(a)[0]] - ord[etat(b)[0]] || a.reference.localeCompare(b.reference, 'fr'));
        return `<p class="wz-aide">Les parfums en rupture ou bientôt épuisés sont en haut. ${ALL.stock_ref_date ? 'Comptage du ' + esc(ALL.stock_ref_date) + ', mis à jour avec les factures suivantes.' : ''}</p>
          <div class="wz-stock">${it.map(i => ligneStock(i)).join('')}</div><button type="button" class="wz-lien" data-wz="page">Ouvrir la page Stock complète ›</button>`; }}
    },
    clic: { col: v => { P.data.col = v; aller_('liste'); }, page: () => { fermer(); aller('stock'); } }
  };

  /* ---------- Parcours : client ---------- */
  const client = {
    titre:'Chercher un client', debut:'rech', ordre:['rech', 'fiche'],
    etapes: {
      rech: {q:'Quel client cherchez-vous ?', h:() => `${champRecherche('Tapez le nom du client ou le pays…', P.data.rech)}<div id="wzListe" class="wz-liste">${listeClients(P.data.rech, 'voir')}</div>`,
        apres:() => brancherRecherche('wzListe', v => { P.data.rech = v; return listeClients(v, 'voir'); })},
      fiche: {q:() => P.data.client, h:() => {
        const c = clients().find(x => x.nom === P.data.client) || {nom:P.data.client}, info = D() ? D().clientInfo(c.nom) : {}, du = aEncaisser(c.nom);
        const top = {}; factures().filter(f => f.client === c.nom).forEach(f => (f.lines || []).forEach(l => { if(l.btl > 0 && l.reference) top[l.reference] = (top[l.reference] || 0) + l.btl; }));
        const tops = Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 3);
        return `<div class="wz-fiche"><div><span>Pays</span><strong>${esc(c.pays || info.pays || '—')}</strong></div><div><span>Commandes</span><strong>${c.n || 0}</strong></div>
          <div><span>Total acheté</span><strong>${money0(c.ca)}</strong></div><div><span>Doit encore</span><strong class="${du ? 'ko' : ''}">${du ? money0(du) : 'rien'}</strong></div></div>
          ${c.der ? `<p class="wz-der">Dernière commande : <strong>${esc(c.der.date)}</strong> — facture ${esc(c.der.facture)} — ${money0(c.der.ca)}</p>` : '<p class="wz-der">Pas encore de commande enregistrée.</p>'}
          ${tops.length ? `<p class="wz-aide">Parfums qu’il achète le plus : ${tops.map(([r, n]) => `<strong>${esc(r)}</strong> (${nb(n)} fl.)`).join(', ')}</p>` : ''}
          ${info.adresse ? `<p class="wz-aide">Adresse : ${esc(info.adresse).replace(/\n/g, ', ')}</p>` : ''}
          <h4 class="wz-h4">Que voulez-vous faire ?</h4><div class="wz-grille2">${gros('fact', 'facture', 'Lui faire une facture', '')}${gros('fact', 'devis', 'Lui faire un devis', '')}
          ${c.der ? gros('derf', c.der.facture, 'Voir sa dernière facture', esc(c.der.facture)) : ''}${gros('crm', c.nom, 'Voir sa fiche complète', 'historique, notes, contacts')}</div>`; }}
    },
    clic: {
      voir: v => { P.data.client = v; aller_('fiche'); },
      fact: t => { const c = clients().find(x => x.nom === P.data.client) || {}; const data = {client:P.data.client, pays:c.pays || '', lignes:[]};
        P = {nom:t, data}; pile.length = 0; P.etape = null; aller_('soc'); },
      derf: v => { fermer(); const y = document.querySelector('.year-btn[data-year="total"]'); if(y && !y.classList.contains('active')) y.click(); setTimeout(() => { if(typeof openFactureModal === 'function') openFactureModal(v); }, 100); },
      crm: v => { fermer(); aller('crm'); setTimeout(() => { const li = document.querySelector(`.crm-list li[data-crm="${CSS.escape(v)}"]`); if(li) li.click(); }, 150); }
    }
  };

  /* ---------- Parcours : question ---------- */
  const THEMES = {
    stock:{t:'Le stock', s:'quantités, ruptures', q:[['Stock d’un parfum', 'ref', r => 'Stock de ' + r], ['Quels parfums sont en rupture ?', '', 'Références en rupture']]},
    clients:{t:'Les clients', s:'factures, commandes', q:[['Dernière facture d’un client', 'client', c => 'Dernière facture de ' + c], ['Meilleurs clients de l’année', '', () => 'Meilleurs clients ' + new Date().getFullYear()], ['Clients qui n’ont pas commandé depuis longtemps', '', 'Clients inactifs']]},
    ventes:{t:'Les ventes', s:'chiffre d’affaires, bénéfice', q:[['Chiffre d’affaires de l’année', '', () => 'CA ' + new Date().getFullYear()], ['Bénéfice de l’année', '', () => 'Bénéfice ' + new Date().getFullYear()], ['Parfums les plus vendus', '', () => 'Meilleures références ' + new Date().getFullYear()]]},
    argent:{t:'L’argent', s:'paiements, impôts', q:[['Qui me doit de l’argent ?', '', 'Qui me doit de l’argent ?'], ['Quels fournisseurs dois-je payer ?', '', 'Fournisseurs à payer'], ['Combien d’impôts cette année ?', '', 'Combien d’impôts cette année ?'], ['Prochaines échéances fiscales', '', 'Prochaines échéances fiscales']]},
    salons:{t:'Les salons', s:'dates, villes', q:[['Quel est le prochain salon ?', '', 'Quel est le prochain salon ?']]},
    jour:{t:'Ma journée', s:'choses à faire', q:[['Qu’est-ce que je dois faire aujourd’hui ?', '', 'Qu’est-ce que je dois faire aujourd’hui ?']]}
  };
  const txt = (f, v) => typeof f === 'function' ? f(v) : f;
  function toutesRefs(q){ q = norm(q); const L = []; COLS().forEach(c => stockItems(c).forEach(i => { if(!q || norm(i.reference).includes(q)) L.push([c, i.reference]); })); return L; }
  const question = {
    titre:'Poser une question', debut:'theme', ordre:['theme', 'question', 'reponse'],
    etapes: {
      theme: {q:'Sur quel sujet ?', h:() => `<div class="wz-grille2">${Object.entries(THEMES).map(([k, t]) => gros('theme', k, t.t, t.s)).join('')}</div>
        <div class="wz-grille2 wz-autres">${window.EJ_ASSISTANT && EJ_ASSISTANT.vocal ? gros('libre', 'voix', '🎤 Je pose ma question à voix haute', '') : ''}${gros('libre', 'ecrit', '✎ J’écris ma question', '')}</div>`},
      question: {q:() => THEMES[P.data.theme].t + ' : que voulez-vous savoir ?', h:() => `<div class="wz-liste">${THEMES[P.data.theme].q.map((x, i) => gros('q', i, x[0], '')).join('')}</div>`},
      ref: {q:'Quel parfum ?', h:() => `${champRecherche('Tapez le nom du parfum…')}<div id="wzListe" class="wz-refs">${refsBtn('')}</div>`, apres:() => brancherRecherche('wzListe', refsBtn)},
      cli: {q:'Quel client ?', h:() => `${champRecherche('Tapez le nom du client…')}<div id="wzListe" class="wz-liste">${listeClients('', 'cli')}</div>`, apres:() => brancherRecherche('wzListe', v => listeClients(v, 'cli'))},
      reponse: {q:() => P.data.texte, h:() => { let r = null; try { r = window.EJ_ASSISTANT ? EJ_ASSISTANT.repondreLocal(P.data.texte) : null; } catch(e) {}
        return `<div class="wz-rep ia-m ia-bot">${r || 'Je n’ai pas de réponse directe. Posez-la à l’assistant, qui peut chercher plus loin.'}</div>
          <div class="wz-grille2">${gros('encore', '', 'Poser une autre question', '')}${gros('assist', '', 'Continuer avec l’assistant', 'pour une question plus précise')}</div>`; },
        apres:() => { $('wzB').querySelectorAll('.ia-go').forEach(g => g.addEventListener('click', () => { fermer();
          if(g.dataset.facture){ const y = document.querySelector('.year-btn[data-year="total"]'); if(y && !y.classList.contains('active')) y.click(); setTimeout(() => { if(typeof openFactureModal === 'function') openFactureModal(g.dataset.facture); }, 100); }
          else if(g.dataset.tab){ aller(g.dataset.tab); if(g.dataset.client) setTimeout(() => { const li = document.querySelector(`.crm-list li[data-crm="${CSS.escape(g.dataset.client)}"]`); if(li) li.click(); }, 150); } })); }}
    },
    clic: {
      theme: v => { P.data.theme = v; aller_('question'); },
      q: i => { const x = THEMES[P.data.theme].q[+i]; P.data.modele = x[2]; if(x[1] === 'ref') aller_('ref'); else if(x[1] === 'client') aller_('cli'); else { P.data.texte = txt(x[2]); aller_('reponse'); } },
      choixref: v => { P.data.texte = txt(P.data.modele, v); aller_('reponse'); },
      cli: v => { P.data.texte = txt(P.data.modele, v); aller_('reponse'); },
      encore: () => { pile.length = 0; P.etape = null; aller_('theme'); },
      assist: () => { const t = P.data.texte; fermer(); ouvrirAssistant(); if(t && window.EJ_ASSISTANT) setTimeout(() => { const q = document.getElementById('iaQ'); if(q){ q.value = t; q.focus(); } }, 80); },
      libre: v => { fermer(); ouvrirAssistant(); if(v === 'voix' && window.EJ_ASSISTANT) setTimeout(EJ_ASSISTANT.ecouter, 120); }
    }
  };
  function refsBtn(q){ const L = toutesRefs(q).slice(0, 40); return L.length ? L.map(([c, r]) => `<button type="button" class="wz-ref" data-wz="choixref" data-v="${esc(r)}"><strong>${esc(r)}</strong><small>${esc(nomCol(c))}</small></button>`).join('') : '<p class="wz-vide">Aucun parfum de ce nom.</p>'; }
  function ouvrirAssistant(){ const box = document.querySelector('.ia-box'), fab = document.querySelector('.ia-fab'); if(box && box.hidden && fab) fab.click(); }

  const PARCOURS = {facture:facture('facture'), devis:facture('devis'), stock, client, question};

  /* ---------- Événements ---------- */
  ov.addEventListener('click', e => {
    if(e.target === ov) return fermer();
    const a = e.target.closest('[data-wz-act]');
    if(a){ const k = a.dataset.wzAct; if(k === 'fermer') fermer(); else if(k === 'retour') retour(); else if(k === 'suite'){ const et = PARCOURS[P.nom].etapes[P.etape]; if(et.valider) et.valider(); } return; }
    const b = e.target.closest('[data-wz]'); if(!b || !P) return;
    const f = PARCOURS[P.nom].clic[b.dataset.wz]; if(f) f(b.dataset.v);
  });
  document.addEventListener('keydown', e => { if(!ov.hidden && e.key === 'Escape') fermer(); });
  // Les boutons « data-wz-open » (accueil) lancent un parcours.
  document.addEventListener('click', e => { const b = e.target.closest('[data-wz-open]'); if(b){ e.preventDefault(); e.stopPropagation(); ouvrir(b.dataset.wzOpen); } }, true);

  window.EJ_ASSISTES = {ouvrir, fermer};
})();
