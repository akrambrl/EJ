/* Mode simple (par défaut) / mode complet. En mode complet, l'accueil ne garde que les actions rapides (.ac-extra masqués).
   Mode simple : 7 entrées de menu avec icônes, texte plus grand, page d'accueil claire (chiffres clés, actions en un clic,
   choses à faire), sans les indicateurs répétés en haut de chaque page ni le choix de société.
   Mode complet : toutes les pages. Le choix est gardé sur l'appareil ('ej_mode') ; appliqué dès le <head>. */
(function(){
  const root = document.documentElement, KEY = 'ej_mode';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money0 = n => Math.round(n || 0).toLocaleString('fr-FR') + ' €';
  const pad = n => String(n).padStart(2, '0');
  const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const days = s => Math.round((new Date(s + 'T00:00:00') - today()) / 864e5);
  const fr = s => s ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : '';
  const YEAR = String(today().getFullYear());
  const simple = () => root.dataset.mode !== 'complet';
  const aller = tab => { const b = document.querySelector(`.sidebar .tab[data-tab="${tab}"]`); if(b) b.click(); };

  /* ---------- Bascule ---------- */
  const btnMode = document.getElementById('sbMode');
  function majBouton(){ if(btnMode) btnMode.textContent = simple() ? 'Afficher toutes les pages' : 'Revenir au mode simple'; }
  function passer(mode){
    root.dataset.mode = mode; try { localStorage.setItem(KEY, mode); } catch(e) {}
    majBouton();
    if(mode === 'simple'){
      const g = document.querySelector('.soc-btn[data-soc="groupe"]'); if(g && !g.classList.contains('active')) g.click();
      aller('accueil');
    } else aller('accueil');
    if(window.Chart) setTimeout(() => Object.values(Chart.instances || {}).forEach(c => c.resize()), 50);
  }
  if(btnMode) btnMode.addEventListener('click', () => passer(simple() ? 'complet' : 'simple'));
  majBouton();

  /* ---------- Page d'accueil ---------- */
  function rendre(){
    const box = document.getElementById('accueil-body'); if(!box) return;
    const S = (window.EJ_SOC && EJ_SOC.statsFor ? EJ_SOC.statsFor('groupe') : ALL)[YEAR] || {};
    const AN = typeof currentYear !== 'undefined' ? currentYear : 'total', periode = AN === 'total' ? '2025 + 2026' : AN;
    const ST = (window.EJ_SOC && EJ_SOC.statsFor ? EJ_SOC.statsFor('groupe') : ALL), P = ST[AN] || {}, T = ST.total || ALL.total || {};
    const fin = !window.EJ_ROLE;   // accès limité : pas de montants dans les classements
    const nb = n => Math.round(n || 0).toLocaleString('fr-FR');
    const pdate = s => { const m = String(s || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? m[3] + m[2] + m[1] : ''; };
    const cartons = f => (f.lines || []).reduce((a, l) => a + (l.cartons || 0), 0);
    const refsDe = f => { const m = {}; (f.lines || []).forEach(l => { if(l.reference && (l.btl || 0) > 0 && !/REMISE|TRANSPORT|SERVICE|AVOIR/.test(l.collection)) m[l.reference] = (m[l.reference] || 0) + (l.cartons || 0 || Math.round(l.btl / 10)); });
      return Object.entries(m).sort((a, b) => b[1] - a[1]); };
    // 1. Meilleurs clients
    const clients = (P.clients || []).slice().sort((a, b) => fin ? b.ca - a.ca : b.btl - a.btl).slice(0, 3);
    // 2. Meilleures ventes (factures les plus importantes)
    const ventes = (P.factures || []).filter(f => f.ca > 0).slice().sort((a, b) => b.ca - a.ca).slice(0, 5);
    // 3. Stock actuel par collection
    const COLS = ['VIP', 'VIP BLACK', '50ML', 'ROYAL', 'BRUMES'], NOMS = {'VIP':'VIP 90 ml', 'VIP BLACK':'VIP Black 90 ml', '50ML':'VIP Black 50 ml', 'ROYAL':'Royal 100 ml', 'BRUMES':'Brumes 250 ml'};
    const stock = COLS.filter(c => ALL.stock && ALL.stock[c]).map(c => { const it = ALL.stock[c].items || [];
      return {c, total:it.reduce((a, i) => a + Math.max(0, i.qty), 0), refs:it.length, rupture:it.filter(i => i.qty <= 0).length, bas:it.filter(i => i.qty > 0 && (i.status === 'critical' || i.status === 'low')).length,
        top:it.filter(i => i.qty > 0).sort((a, b) => b.qty - a.qty).slice(0, 3)}; });
    const totalStock = stock.reduce((a, s) => a + s.total, 0);
    // 4. Dernières factures éditées (les plus récentes d'abord)
    const recentes = (T.factures || []).slice().sort((a, b) => pdate(b.date).localeCompare(pdate(a.date)) || String(b.facture).localeCompare(String(a.facture))).slice(0, 8);
    const medaille = i => ['🥇', '🥈', '🥉'][i] || '';
    // Accès limité (Natali) : ce qui sert au quotidien (stock à surveiller, stock, dernières factures), sans classement des ventes
    const surveiller = []; COLS.forEach(c => ((ALL.stock && ALL.stock[c] && ALL.stock[c].items) || []).forEach(i => { if(i.qty <= 0 || i.status === 'critical' || i.status === 'low') surveiller.push(Object.assign({col:c}, i)); }));
    surveiller.sort((a, b) => a.qty - b.qty);
    const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
    const listeFactures = recentes.length ? `<ul class="ac-fl">${recentes.map(f => { const m = String(f.date || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      return `<li><button type="button" data-facture="${esc(f.facture)}"><span class="ac-cal">${m ? `<b>${+m[1]}</b><small>${MOIS[+m[2] - 1]} ${m[3].slice(2)}</small>` : '<b>—</b>'}</span>
        <span class="ac-nm"><strong>${esc(f.client)}</strong><small>${drapeau(f.pays)}${esc(f.pays || '')} · ${esc(f.facture)} · ${nb(f.btl)} flacons</small></span><b>${money0(f.ca)}</b></button></li>`; }).join('')}</ul>`
      : '<p class="ac-vide">Aucune facture.</p>';
    const maxSt = Math.max(1, ...stock.map(s => s.total));
    const listeStock = `<ul class="ac-st ac-stb">${stock.map(s => `<li><button type="button" data-go="stock"><span class="ac-nm"><strong>${NOMS[s.c] || s.c}</strong>
        <span class="vx-bar"><i style="width:${Math.max(1.5, s.total / maxSt * 100).toFixed(1)}%"></i></span><small>${s.top.map(i => esc(i.reference) + ' ' + nb(i.qty)).join(' · ') || '—'}</small></span>
      <span class="ac-sq"><b>${nb(s.total)}</b><small>${s.rupture ? `<em class="ko">${s.rupture} en rupture</em>` : ''}${s.rupture && s.bas ? ' · ' : ''}${s.bas ? `<em class="bas">${s.bas} bas</em>` : ''}${!s.rupture && !s.bas ? '<em class="ok">tout va bien</em>' : ''}</small></span></button></li>`).join('')}</ul>`;
    const kpi = (t, v, sub, cls) => `<div class="vx-kpi${cls ? ' ' + cls : ''}"><span>${t}</span><strong>${v}</strong>${sub ? `<small>${sub}</small>` : ''}</div>`;
    const kpis = fin
      ? `<div class="vx-kpis ac-kpis">${kpi('Chiffre d’affaires', money0(P.kpi_ca), periode, 'vx-main')}${kpi('Factures', nb(P.kpi_factures), nb(P.kpi_clients) + ' clients')}${kpi('Flacons vendus', nb(P.kpi_btl), periode)}${kpi('Stock', nb(totalStock), 'flacons', surveiller.length ? 'vx-bas' : 'vx-ok')}</div>`
      : `<div class="vx-kpis ac-kpis">${kpi('Stock', nb(totalStock), 'flacons', 'vx-main')}${kpi('À surveiller', nb(surveiller.length), 'parfums', surveiller.length ? 'vx-bas' : 'vx-ok')}${kpi('Dernière facture', recentes[0] ? esc(recentes[0].date) : '—', recentes[0] ? esc(recentes[0].client) : '')}</div>`;
    const vueComplete = `
      <div class="ac-vue">
        <section class="ac-bloc"><div class="ac-bh"><h3>Meilleurs clients</h3><span>${esc(periode)}</span></div>
          ${clients.length ? `<ol class="ac-cl">${clients.map((c, i) => `<li><button type="button" data-client="${esc(c.client)}"><span class="ac-med">${medaille(i)}</span><span class="ac-nm"><strong>${esc(c.client)}</strong><small>${drapeau(c.pays)}${esc(c.pays || '')} · ${c.factures} facture${c.factures > 1 ? 's' : ''} · ${nb(c.btl)} flacons</small></span>${fin ? `<b>${money0(c.ca)}</b>` : ''}</button></li>`).join('')}</ol>` : '<p class="ac-vide">Aucune vente sur cette période.</p>'}</section>
        <section class="ac-bloc"><div class="ac-bh"><h3>Stock actuel</h3><span>${nb(totalStock)} flacons</span></div>
          ${listeStock}
          <p class="ac-plus"><button type="button" data-go="stock">Voir le stock détaillé ›</button></p></section>
        <section class="ac-bloc ac-large"><div class="ac-bh"><h3>Meilleures ventes</h3><span>${esc(periode)} · les 5 plus grosses factures</span></div>
          ${ventes.length ? `<ol class="ac-vt">${ventes.map((f, i) => { const r = refsDe(f), ct = cartons(f);
            return `<li><button type="button" data-facture="${esc(f.facture)}"><span class="ac-rg">${i + 1}</span><span class="ac-nm"><strong>${esc(f.client)}</strong>
              <small>${esc(f.facture)} · ${esc(f.date)} · ${drapeau(f.pays)}${esc(f.pays || '')} · ${ct ? nb(ct) + ' cartons · ' : ''}${nb(f.btl)} flacons</small>
              <small class="ac-refs">${r.slice(0, 4).map(([n, q]) => `${esc(n)}${q ? ' <i>' + nb(q) + '</i>' : ''}`).join(' · ')}${r.length > 4 ? ` · +${r.length - 4} autres` : ''}</small></span><b>${money0(f.ca)}</b></button></li>`; }).join('')}</ol>` : '<p class="ac-vide">Aucune vente sur cette période.</p>'}</section>
        <section class="ac-bloc ac-large"><div class="ac-bh"><h3>Dernières factures éditées</h3><span>les plus récentes d'abord</span></div>
          ${listeFactures}
          <p class="ac-plus"><button type="button" data-go="documents">Voir toutes les factures et proformas ›</button></p></section>
      </div>`;
    const vueNatali = window.EJ_ROLE ? `
      <div class="ac-vue">
        <section class="ac-bloc"><div class="ac-bh"><h3>Stock à surveiller</h3><span>${surveiller.length ? surveiller.length + ' parfums' : 'tout va bien'}</span></div>
          ${surveiller.length ? `<ul class="ac-st ac-surv">${surveiller.slice(0, 6).map(i => `<li><button type="button" data-go="stock">${typeof PHOTOS !== 'undefined' && PHOTOS[i.col + '|' + i.reference] ? `<img class="wz-ph-l" src="${PHOTOS[i.col + '|' + i.reference]}" alt="">` : ''}<span class="ac-nm"><strong>${esc(i.reference)}</strong><small>${NOMS[i.col] || i.col}</small></span>
            <span class="ac-sq"><b>${nb(Math.max(0, i.qty))}</b><small><em class="${i.qty <= 0 ? 'ko' : 'bas'}">${i.qty <= 0 ? 'en rupture' : 'bientôt épuisé'}</em></small></span></button></li>`).join('')}</ul>${surveiller.length > 6 ? `<p class="ac-plus"><button type="button" data-go="stock">Voir les ${surveiller.length - 6} autres ›</button></p>` : ''}` : '<p class="ac-vide">Aucun parfum en rupture ni presque épuisé.</p>'}</section>
        <section class="ac-bloc"><div class="ac-bh"><h3>Stock actuel</h3><span>${nb(totalStock)} flacons</span></div>
          ${listeStock}
          <p class="ac-plus"><button type="button" data-go="stock">Voir le stock détaillé ›</button></p></section>
        <section class="ac-bloc ac-large"><div class="ac-bh"><h3>Dernières factures éditées</h3><span>les plus récentes d'abord</span></div>
          ${listeFactures}
          <p class="ac-plus"><button type="button" data-go="documents">Voir toutes les factures et proformas ›</button></p></section>
      </div>` : '';
    const h = new Date().getHours();
    box.innerHTML = `
      <p class="ac-bonjour ac-extra">${h < 18 ? 'Bonjour' : 'Bonsoir'}${window.EJ_ROLE ? ' Natali' : ''}. Nous sommes le ${today().toLocaleDateString('fr-FR', {weekday:'long', day:'numeric', month:'long', year:'numeric'})}.</p>
      <h3 class="ac-h">Que voulez-vous faire ?</h3>
      <div class="ac-actions">
        <button type="button" class="ac-act" data-wz-open="facture">Faire une facture</button>
        <button type="button" class="ac-act" data-wz-open="proforma">Faire un bon de commande</button>
        <button type="button" class="ac-act" data-wz-open="stock">Voir le stock</button>
        <button type="button" class="ac-act" data-wz-open="client">Chercher un client</button>
        <button type="button" class="ac-act" data-wz-open="question">Poser une question</button>
        <button type="button" class="ac-act" data-go="fournisseurs">Déposer une facture fournisseur</button>
        ${window.EJ_ASSISTANT && EJ_ASSISTANT.vocal ? '<button type="button" class="ac-act ac-voix" data-ia-open="1" data-ia-voix="1">🎤 Demander à voix haute</button>' : ''}
      </div>
      ${kpis}
      ${window.EJ_ROLE ? vueNatali : vueComplete}
      ${simple() ? '' : '<p class="ac-mode">Vous êtes en mode complet (toutes les pages). <button type="button" data-mode-simple="1">Revenir au mode simple</button></p>'}
      <p class="ac-mode ac-mode-s">Besoin des autres pages (prix de revient, impôts, équipe…) ? <button type="button" data-mode-complet="1">Afficher toutes les pages</button></p>`;
  }

  document.addEventListener('click', e => {
    const fa = e.target.closest('#accueil [data-facture]');
    if(fa){ const y = document.querySelector('.year-btn[data-year="total"]'); if(y && !y.classList.contains('active')) y.click(); setTimeout(() => { if(typeof openFactureModal === 'function') openFactureModal(fa.dataset.facture); }, 80); return; }
    const cl = e.target.closest('#accueil [data-client]');
    if(cl){ if(window.EJ_ASSISTES){ EJ_ASSISTES.ouvrir('client'); setTimeout(() => { const b = document.querySelector(`.wz [data-wz="voir"][data-v="${CSS.escape(cl.dataset.client)}"]`); if(b) b.click(); else { const r = document.getElementById('wzRech'); if(r){ r.value = cl.dataset.client; r.dispatchEvent(new Event('input')); } } }, 50); } return; }
    const g = e.target.closest('#accueil [data-go]'); if(g){ aller(g.dataset.go); window.scrollTo({top:0}); return; }
    const n = e.target.closest('#accueil [data-new]');
    if(n){ aller('documents'); setTimeout(() => { const b = document.querySelector(`[data-act="new"][data-type="${n.dataset.new}"]`); if(b) b.click(); }, 80); return; }
    const q = e.target.closest('[data-ia-open]');
    if(q){ const box = document.querySelector('.ia-box'), fab = document.querySelector('.ia-fab'); if(box && box.hidden && fab) fab.click();
      if(q.dataset.iaVoix && window.EJ_ASSISTANT && EJ_ASSISTANT.ecouter) setTimeout(EJ_ASSISTANT.ecouter, 120);
      if(window.innerWidth < 900) document.body.classList.remove('menu-ouvert'); return; }
    if(e.target.closest('[data-mode-complet]')) passer('complet');
    if(e.target.closest('[data-mode-simple]')) passer('simple');
  });
  document.querySelectorAll('.sidebar .tab[data-tab="accueil"]').forEach(b => b.addEventListener('click', () => { try { rendre(); } catch(e) { console.error(e); } }));
  document.querySelectorAll('.year-btn').forEach(b => b.addEventListener('click', () => setTimeout(rendre, 50)));

  // Ouverture : on arrive toujours sur l'accueil (actions rapides) ; en mode simple, vue groupe
  try { rendre(); } catch(e) { console.error(e); }
  if(simple()){ const g = document.querySelector('.soc-btn[data-soc="groupe"]'); if(g && !g.classList.contains('active')) g.click(); }
  aller('accueil');
})();
