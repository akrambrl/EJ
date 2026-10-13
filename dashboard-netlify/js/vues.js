/* Présentations lisibles de « Mes ventes » (onglet overview) et « Stock » :
   grandes cartes de chiffres, classements en barres (au lieu des camemberts), clients en cartes,
   stock en cartes par parfum (photo, quantité, état) avec recherche et filtres.
   Les anciens graphiques et tableaux restent disponibles (tableau détaillé du stock replié, graphique mensuel conservé). */
(function(){
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const nb = n => Math.round(n || 0).toLocaleString('fr-FR');
  const eur = n => nb(n) + ' €';
  const fl = p => typeof drapeau === 'function' ? drapeau(p) : '';
  const fin = () => !window.EJ_ROLE;
  const AN = () => typeof currentYear !== 'undefined' ? currentYear : 'total';
  const periode = () => AN() === 'total' ? '2025 + 2026' : AN();
  const D = () => (typeof ALL !== 'undefined' && ALL[AN()]) || {};
  const NOMS = {'VIP':'VIP 90 ml', 'VIP BLACK':'VIP Black 90 ml', '50ML':'VIP Black 50 ml', 'ROYAL':'Royal 100 ml', 'BRUMES':'Brumes 250 ml'};
  const nomCol = c => NOMS[c] || (c.charAt(0) + c.slice(1).toLowerCase());
  const carte = (t, v, s, cls) => `<div class="vx-kpi${cls ? ' ' + cls : ''}"><span>${t}</span><strong>${v}</strong>${s ? `<small>${s}</small>` : ''}</div>`;
  const barres = (L, total, lib) => `<ul class="vx-bars">${L.map(x => { const pct = total ? x.v / total * 100 : 0;
    return `<li><div class="vx-bl"><span>${lib(x)}</span><b>${x.txt}</b></div><div class="vx-bar"><i style="width:${Math.max(1.5, pct).toFixed(1)}%"></i></div><small>${pct.toFixed(1).replace('.', ',')} %</small></li>`; }).join('')}</ul>`;

  /* ---------- Mes ventes ---------- */
  function ventes(){
    const sec = document.getElementById('overview'); if(!sec) return;
    let box = document.getElementById('ovVue');
    if(!box){ box = document.createElement('div'); box.id = 'ovVue'; const h2 = sec.querySelector(':scope > h2'); sec.insertBefore(box, h2 ? h2.nextSibling : sec.firstChild); sec.classList.add('vx-ventes'); }
    const d = D(), ca = d.kpi_ca || 0;
    const cols = (d.collections || []).filter(c => c.ca > 0).sort((a, b) => b.ca - a.ca);
    const pays = (d.pays || []).filter(p => p.ca > 0).sort((a, b) => b.ca - a.ca);
    const topP = pays.slice(0, 8), autres = pays.slice(8).reduce((a, p) => a + p.ca, 0);
    const cli = (d.clients || []).slice().sort((a, b) => fin() ? b.ca - a.ca : b.btl - a.btl).slice(0, 5);
    const maxCli = Math.max(1, ...cli.map(c => fin() ? c.ca : c.btl));
    box.innerHTML = `
      <div class="vx-2">
        <section class="vx-bloc"><div class="vx-bh"><h3>Ventes par collection</h3><span>${periode()}</span></div>
          ${barres(cols.map(c => ({v:c.ca, txt:fin() ? eur(c.ca) : nb(c.btl) + ' fl.', c})), cols.reduce((a, c) => a + c.ca, 0), x => esc(nomCol(x.c.collection)) + `<small>${nb(x.c.btl)} flacons</small>`)}</section>
        <section class="vx-bloc"><div class="vx-bh"><h3>Ventes par pays</h3><span>${pays.length} pays</span></div>
          ${barres(topP.map(p => ({v:p.ca, txt:fin() ? eur(p.ca) : nb(p.btl) + ' fl.', p})).concat(autres ? [{v:autres, txt:fin() ? eur(autres) : '', p:{pays:'Autres pays (' + (pays.length - 8) + ')', clients:0}}] : []), pays.reduce((a, p) => a + p.ca, 0),
            x => fl(x.p.pays) + esc(x.p.pays) + (x.p.clients ? `<small>${x.p.clients} client${x.p.clients > 1 ? 's' : ''}</small>` : ''))}</section>
      </div>
      <section class="vx-bloc"><div class="vx-bh"><h3>Meilleurs clients</h3><span>${periode()}</span></div>
        <ol class="vx-cli">${cli.map((c, i) => `<li><span class="vx-rg">${i + 1}</span><span class="vx-nm"><strong>${esc(c.client)}</strong><small>${fl(c.pays)}${esc(c.pays)} · ${c.factures} facture${c.factures > 1 ? 's' : ''} · ${nb(c.btl)} flacons</small>
          <span class="vx-bar"><i style="width:${((fin() ? c.ca : c.btl) / maxCli * 100).toFixed(1)}%"></i></span></span>${fin() ? `<b>${eur(c.ca)}</b>` : ''}</li>`).join('')}</ol></section>
      <h3 class="vx-h">Ventes mois par mois</h3>`;
  }

  /* ---------- Stock ---------- */
  let fCol = 'tous', fEtat = 'tous', fQ = '';
  const etat = i => i.qty <= 0 ? 'ko' : (i.status === 'critical' || i.status === 'low') ? 'bas' : i.status === 'medium' ? 'moyen' : 'ok';
  const ETAT = {ko:'En rupture', bas:'Bientôt épuisé', moyen:'Stock moyen', ok:'En stock'};
  function stock(){
    const sec = document.getElementById('stock'); if(!sec || typeof ALL === 'undefined' || !ALL.stock) return;
    let box = document.getElementById('stVue');
    if(!box){
      box = document.createElement('div'); box.id = 'stVue';
      const kp = document.getElementById('stockGlobalKpis'); sec.insertBefore(box, kp);
      // l'ancien tableau (prix, CA potentiel…) reste disponible, replié
      const det = document.createElement('details'); det.className = 'vx-detail'; det.innerHTML = '<summary>Voir le tableau détaillé</summary>';
      sec.appendChild(det); const ib = sec.querySelector(':scope > .info-box'); if(ib) det.appendChild(ib);
      ['stockGlobalKpis', 'stockContent'].forEach(id => { const e = document.getElementById(id); if(e) det.appendChild(e); });
      box.addEventListener('input', e => { if(e.target.id === 'stQ'){ fQ = e.target.value; grille(); } });
      box.addEventListener('click', e => { const b = e.target.closest('[data-stc],[data-ste]'); if(!b) return; if(b.dataset.stc) fCol = b.dataset.stc; if(b.dataset.ste) fEtat = b.dataset.ste; stock(); });
    }
    const it = []; Object.entries(ALL.stock).forEach(([c, s]) => (s.items || []).forEach(i => it.push(Object.assign({col:c}, i))));
    const n = k => it.filter(i => etat(i) === k).length, tot = it.reduce((a, i) => a + Math.max(0, i.qty), 0);
    const cols = Object.keys(ALL.stock);
    const q = document.getElementById('stQ'), pos = q && document.activeElement === q ? q.selectionStart : null;
    box.innerHTML = `
      <div class="vx-kpis">
        ${carte('Flacons en stock', nb(tot), it.length + ' parfums', 'vx-main')}
        ${carte('En rupture', n('ko'), 'à recommander', n('ko') ? 'vx-ko' : '')}
        ${carte('Bientôt épuisés', n('bas'), 'à surveiller', n('bas') ? 'vx-bas' : '')}
        ${carte('Bien en stock', n('ok') + n('moyen'), 'parfums', 'vx-ok')}
      </div>
      <div class="vx-filtres">
        <input class="vx-q" id="stQ" placeholder="Rechercher un parfum…" value="${esc(fQ)}" autocomplete="off">
        <div class="vx-pills">${['tous'].concat(cols).map(c => `<button type="button" data-stc="${c}" class="${fCol === c ? 'actif' : ''}">${c === 'tous' ? 'Toutes les collections' : esc(nomCol(c))}</button>`).join('')}</div>
        <div class="vx-pills">${[['tous', 'Tous'], ['ko', 'En rupture'], ['bas', 'Bientôt épuisés'], ['ok', 'En stock']].map(([k, l]) => `<button type="button" data-ste="${k}" class="${fEtat === k ? 'actif' : ''}">${l}</button>`).join('')}</div>
      </div>
      <div id="stGrille"></div>`;
    if(pos != null){ const q2 = document.getElementById('stQ'); q2.focus(); q2.setSelectionRange(pos, pos); }
    grille(it);
  }
  function grille(it){
    const g = document.getElementById('stGrille'); if(!g) return;
    if(!it){ it = []; Object.entries(ALL.stock).forEach(([c, s]) => (s.items || []).forEach(i => it.push(Object.assign({col:c}, i)))); }
    const qq = fQ.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(), ord = {ko:0, bas:1, moyen:2, ok:3};
    const L = it.filter(i => (fCol === 'tous' || i.col === fCol) && (fEtat === 'tous' || (fEtat === 'ok' ? ['ok', 'moyen'].includes(etat(i)) : etat(i) === fEtat))
      && (!qq || i.reference.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(qq)))
      .sort((a, b) => ord[etat(a)] - ord[etat(b)] || a.reference.localeCompare(b.reference, 'fr'));
    g.innerHTML = L.length ? `<div class="vx-st">${L.map(i => { const e = etat(i), ph = typeof PHOTOS !== 'undefined' && PHOTOS[i.col + '|' + i.reference], ref = Math.max(i.qty_comptage || i.initial || 0, i.qty, 1);
      return `<div class="vx-sc vx-${e}">${ph ? `<img src="${ph}" alt="" loading="lazy">` : '<div class="vx-noimg"></div>'}<div class="vx-sb"><strong>${esc(i.reference)}</strong><small>${esc(nomCol(i.col))}</small>
        <div class="vx-q2"><b>${nb(Math.max(0, i.qty))}</b><span>flacons</span></div><div class="vx-bar"><i style="width:${Math.max(0, Math.min(100, i.qty / ref * 100)).toFixed(0)}%"></i></div><em>${ETAT[e]}${i.qty < 0 ? ` (${nb(i.qty)})` : ''}</em></div></div>`; }).join('')}</div>`
      : '<p class="vx-vide">Aucun parfum ne correspond.</p>';
  }

  /* ---------- Branchements ---------- */
  ['renderOverview', 'renderStock'].forEach(f => { if(typeof window[f] === 'function'){ const o = window[f]; window[f] = function(){ const r = o.apply(this, arguments); try { f === 'renderOverview' ? ventes() : stock(); } catch(e) { console.error(e); } return r; }; } });
  document.querySelectorAll('.year-btn, .soc-btn').forEach(b => b.addEventListener('click', () => setTimeout(() => { try { ventes(); stock(); } catch(e) {} }, 60)));
  window.addEventListener('ej-reg', () => setTimeout(stock, 50));
  try { ventes(); stock(); } catch(e) { console.error(e); }
})();
