/* Espaces personnels (rubrique « Équipe ») : un tableau de bord par salarié pour suivre ses missions.
   Fiches et missions : data/equipe.js. Saisies (actions, projets, décisions, notes par pays…) gardées dans le
   navigateur (localStorage 'ej_equipe_v1'), avec export / import d'un fichier pour les partager.
   Les chiffres (clients, relances, commandes à valider, stock, salons) sont calculés à partir des données du dashboard. */
(function(){
  if(typeof EQUIPE === 'undefined') return;
  const KEY = 'ej_equipe_v1';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = n => Math.round(n || 0).toLocaleString('fr-FR') + ' €';
  const pad = n => String(n).padStart(2, '0');
  const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const fr = s => s ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : '';
  const frToIso = s => { const m = String(s || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? m[3] + '-' + m[2] + '-' + m[1] : ''; };
  const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const days = s => Math.round((new Date(s + 'T00:00:00') - today()) / 864e5);
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const STATUTS = ['À faire', 'En cours', 'Fait'];

  let S; try { S = JSON.parse(localStorage.getItem(KEY)) || {}; } catch(e) { S = {}; }
  S.p = S.p || {};
  const P = id => (S.p[id] = S.p[id] || {actions:{}, pipes:{}, pays:{}, salons:{}, decisions:[]});
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch(e) { alert("Enregistrement impossible dans ce navigateur."); } };
  const missionsOf = pers => P(pers.id).missions || pers.missions;

  /* ---------- Données calculées ---------- */
  function clientsStats(){
    if(typeof ALL === 'undefined') return [];
    const m = {};
    (ALL.total.factures || []).forEach(f => {
      const d = frToIso(f.date); if(!d) return;
      const k = f.client, c = m[k] = m[k] || {client:k, pays:f.pays, ca:0, n:0, first:d, last:d};
      c.ca += f.ca || 0; c.n++; if(d < c.first) c.first = d; if(d > c.last){ c.last = d; c.pays = f.pays; }
    });
    return Object.values(m);
  }
  function paysStats(){
    const m = {};
    clientsStats().forEach(c => { const p = m[c.pays] = m[c.pays] || {pays:c.pays, ca:0, clients:0, last:''}; p.ca += c.ca; p.clients++; if(c.last > p.last) p.last = c.last; });
    return Object.values(m).sort((a, b) => b.ca - a.ca);
  }
  const docs = () => (window.EJ_DOCS ? window.EJ_DOCS.list() : []);
  function stockAlerts(){
    if(typeof ALL === 'undefined' || !ALL.stock) return [];
    const it = []; Object.values(ALL.stock).forEach(c => (c.items || []).forEach(i => { if(['critical','low','epuise'].includes(i.status)) it.push(Object.assign({col:c.collection}, i)); }));
    return it.sort((a, b) => a.qty - b.qty);
  }

  /* ---------- Outils ---------- */
  const T = {};
  T.commercial = (pers) => {
    const cs = clientsStats(), an = String(today().getFullYear());
    const relance = cs.filter(c => days(c.last) < -120).sort((a, b) => b.ca - a.ca).slice(0, 8);
    const nouveaux = cs.filter(c => c.first.startsWith(an)).sort((a, b) => b.ca - a.ca);
    const enCours = docs().filter(d => (d.type === 'devis' || d.type === 'proforma') && !/Convert|Refus/.test(d.statut || ''));
    const li = (a, b) => `<li><span>${a}</span><span>${b}</span></li>`;
    return `<div class="eq-tool-grid">
      <div><div class="eq-th">Clients à relancer <em>sans commande depuis 4 mois</em></div><ul class="eq-kv">${relance.map(c => li(esc(c.client) + `<small>${esc(c.pays)}</small>`, 'dernière : ' + fr(c.last))).join('') || '<li class="eq-empty">Aucun</li>'}</ul></div>
      <div><div class="eq-th">Nouveaux clients ${an}</div><ul class="eq-kv">${nouveaux.map(c => li(esc(c.client) + `<small>${esc(c.pays)}</small>`, money(c.ca))).join('') || '<li class="eq-empty">Aucun pour l\'instant</li>'}</ul></div>
      <div><div class="eq-th">Devis & proformas en cours</div><ul class="eq-kv">${enCours.map(d => li(esc(d.numero) + `<small>${esc(d.client)}</small>`, esc(d.statut))).join('') || '<li class="eq-empty">Aucun — onglet Devis & factures</li>'}</ul></div>
    </div>`;
  };
  T.pipeline = (pers, mis) => {
    const list = P(pers.id).pipes[mis.id] = P(pers.id).pipes[mis.id] || [];
    const et = mis.etapes || ['Idée', 'En cours', 'Validé'];
    return `<div class="eq-pipe">${et.map((e, k) => `<div class="eq-col"><div class="eq-th">${esc(e)}<em>${list.filter(x => x.etape === k).length}</em></div>
        ${list.filter(x => x.etape === k).map(x => `<div class="eq-card-p"><div>${esc(x.nom)}</div>${x.note ? `<small>${esc(x.note)}</small>` : ''}
          <div class="eq-mv">${k > 0 ? `<button data-pmove="-1" data-m="${mis.id}" data-id="${x.id}" title="Étape précédente">←</button>` : '<span></span>'}<button data-pdel data-m="${mis.id}" data-id="${x.id}" title="Supprimer">×</button>${k < et.length - 1 ? `<button data-pmove="1" data-m="${mis.id}" data-id="${x.id}" title="Étape suivante">→</button>` : '<span></span>'}</div></div>`).join('')}
      </div>`).join('')}</div>
      <form class="eq-form" data-padd="${mis.id}"><input name="nom" placeholder="Nouveau projet (ex. VIP Black — nouvelle référence ambrée)" required><input name="note" placeholder="Note (fournisseur, matière, échéance…)"><button class="doc-btn">Ajouter</button></form>`;
  };
  T.pays = (pers) => {
    const notes = P(pers.id).pays, ps = paysStats();
    Object.keys(notes).forEach(k => { if(!ps.some(p => p.pays === k)) ps.push({pays:k, ca:0, clients:0, last:'', nouveau:true}); });
    return `<div class="eq-table-wrap"><table class="eq-table"><thead><tr><th>Marché</th><th class="text-right">CA total</th><th>Clients</th><th>Dernière commande</th><th>Stratégie, positionnement, actions</th></tr></thead><tbody>
      ${ps.map(p => `<tr><td>${esc(p.pays)}${p.nouveau ? ' <small class="eq-new">à développer</small>' : ''}</td><td class="text-right">${money(p.ca)}</td><td>${p.clients}</td><td>${fr(p.last) || '—'}</td>
        <td><textarea data-pays="${esc(p.pays)}" rows="1" placeholder="Positionnement, prix, canal, campagne…">${esc(notes[p.pays] || '')}</textarea></td></tr>`).join('')}
      </tbody></table></div>
      <form class="eq-form" data-paysadd><input name="pays" placeholder="Nouveau marché à développer (ex. Japon)" required><button class="doc-btn">Ajouter</button></form>`;
  };
  T.salons = (pers) => {
    if(typeof SALONS === 'undefined') return '';
    const notes = P(pers.id).salons;
    const up = SALONS.filter(s => /^\d{4}-\d{2}-\d{2}$/.test(s.debut) && s.statut !== 'reporte' && days(s.fin || s.debut) >= 0).sort((a, b) => a.debut.localeCompare(b.debut)).filter(s => s.prio).slice(0, 6);
    return `<div class="eq-th">Salons prioritaires à venir</div><ul class="eq-salons">${up.map(s => { const k = s.nom + '|' + s.debut; return `<li><div><strong>${esc(s.nom)}</strong><small>${fr(s.debut)} · ${esc(s.ville)} · ${days(s.debut) <= 0 ? 'en cours' : 'dans ' + days(s.debut) + ' j'}</small></div>
      <input data-salon="${esc(k)}" value="${esc(notes[k] || '')}" placeholder="Action prévue : stand, visite, rendez-vous, lancement…"></li>`; }).join('')}</ul>`;
  };
  T.validations = () => {
    const big = docs().filter(d => !/Pay|Convert|Refus/.test(d.statut || '')).map(d => ({d, ttc:window.EJ_DOCS.calc(d).ttc})).filter(x => x.ttc >= 20000).sort((a, b) => b.ttc - a.ttc);
    const st = stockAlerts();
    return `<div class="eq-tool-grid">
      <div><div class="eq-th">Commandes importantes à valider <em>≥ 20 000 €</em></div><ul class="eq-kv">${big.map(x => `<li><span>${esc(x.d.numero)}<small>${esc(x.d.client)} · ${esc(x.d.statut)}</small></span><span>${money(x.ttc)}</span></li>`).join('') || '<li class="eq-empty">Aucune en attente</li>'}</ul></div>
      <div><div class="eq-th">Stock à répartir entre clients <em>bas ou épuisé</em></div><ul class="eq-kv">${st.slice(0, 10).map(i => `<li><span>${esc(i.reference)}<small>${esc(i.col)}</small></span><span class="${i.qty ? '' : 'eq-bad'}">${i.qty ? i.qty + ' fl.' : 'épuisé'}</span></li>`).join('') || '<li class="eq-empty">Stock correct</li>'}</ul>${st.length > 10 ? `<small class="eq-more">+ ${st.length - 10} autres — page Stock</small>` : ''}</div>
    </div>`;
  };
  T.decisions = (pers) => {
    const L = P(pers.id).decisions;
    return `<div class="eq-th">Journal des décisions</div>
      <form class="eq-form" data-decadd><select name="dom"><option>Stratégie</option><option>Commercial</option><option>Créatif</option><option>Produit</option><option>Équipe</option><option>Marché</option></select><input name="txt" placeholder="Décision prise (ex. priorité Arabie saoudite au T4, prix distributeur −10 %)" required><button class="doc-btn">Noter</button></form>
      <ul class="eq-dec">${L.slice().reverse().slice(0, 12).map(d => `<li><span class="eq-tag">${esc(d.dom)}</span><div>${esc(d.txt)}<small>${fr(d.date)}</small></div><button data-decdel="${d.id}" title="Supprimer">×</button></li>`).join('') || '<li class="eq-empty">Aucune décision notée.</li>'}</ul>`;
  };
  function actionsHtml(pers, mis){
    const L = P(pers.id).actions[mis.id] = P(pers.id).actions[mis.id] || [];
    const sorted = L.slice().sort((a, b) => (a.statut === 'Fait') - (b.statut === 'Fait') || String(a.due || '9').localeCompare(String(b.due || '9')));
    return `<div class="eq-th">Actions</div>
      <ul class="eq-actions">${sorted.map(a => { const late = a.statut !== 'Fait' && a.due && days(a.due) < 0; return `<li class="${a.statut === 'Fait' ? 'eq-fait' : ''}${late ? ' eq-late' : ''}">
        <select data-astat="${a.id}" data-m="${mis.id}">${STATUTS.map(s => `<option${s === a.statut ? ' selected' : ''}>${s}</option>`).join('')}</select>
        <div>${esc(a.txt)}${a.due ? `<small>${late ? 'en retard — ' : 'pour le '}${fr(a.due)}</small>` : ''}</div><button data-adel="${a.id}" data-m="${mis.id}" title="Supprimer">×</button></li>`; }).join('') || '<li class="eq-empty">Aucune action pour cette mission.</li>'}</ul>
      <form class="eq-form" data-aadd="${mis.id}"><input name="txt" placeholder="Nouvelle action" required><input name="due" type="date" title="Échéance"><button class="doc-btn">Ajouter</button></form>`;
  }

  /* ---------- Rendu d'un espace ---------- */
  function render(pers){
    const root = document.getElementById('equipe-' + pers.id); if(!root) return;
    const st = P(pers.id), mis = missionsOf(pers);
    const all = mis.flatMap(m => (st.actions[m.id] || []));
    const late = all.filter(a => a.statut !== 'Fait' && a.due && days(a.due) < 0).length;
    const mois = iso(today()).slice(0, 7);
    const kpi = [['Actions en cours', all.filter(a => a.statut !== 'Fait').length], ['En retard', late], ['Faites ce mois', all.filter(a => a.statut === 'Fait' && (a.doneAt || '').startsWith(mois)).length]];
    if(mis.some(m => (m.outils || []).includes('commercial'))){
      const cs = clientsStats(), an = String(today().getFullYear());
      const caAn = (typeof ALL !== 'undefined' && ALL[an]) ? ALL[an].kpi_ca : 0;
      kpi.unshift(['CA ' + an, money(caAn)], ['Nouveaux clients ' + an, cs.filter(c => c.first.startsWith(an)).length], ['Clients à relancer', cs.filter(c => days(c.last) < -120).length]);
    }
    if(mis.some(m => (m.outils || []).includes('pipeline'))) kpi.push(['Projets créatifs', mis.reduce((n, m) => n + (st.pipes[m.id] || []).filter(x => x.etape < ((m.etapes || []).length - 1)).length, 0)]);
    root.innerHTML = `<h2>Espace ${esc(pers.nom)}</h2>
      <div class="eq-head" style="--eq:${pers.couleur}"><div><div class="eq-nom">${esc(pers.nom)}</div><div class="eq-role">${esc(pers.role)}</div></div>
        <div class="eq-head-act"><button class="j-mini" data-edit="${pers.id}">Modifier les missions</button><button class="j-mini" data-export>Exporter</button><button class="j-mini" data-import>Importer</button></div></div>
      <div class="eq-kpis">${kpi.map(([l, v]) => `<div class="eq-kpi"><span>${l}</span><strong class="${l === 'En retard' && v ? 'eq-bad' : ''}">${v}</strong></div>`).join('')}</div>
      <div class="eq-edit" hidden><p class="j-sub">Une mission par bloc : le titre précédé de « ## », puis une responsabilité par ligne précédée de « - ».</p>
        <textarea rows="14">${esc(mis.map(m => '## ' + m.titre + '\n' + m.points.map(p => '- ' + p).join('\n')).join('\n\n'))}</textarea>
        <div class="eq-edit-act"><button class="j-mini" data-mreset>Revenir aux missions d'origine</button><button class="doc-btn primary" data-msave>Enregistrer les missions</button></div></div>
      <nav class="eq-nav">${mis.map((m, i) => `<a href="#" data-goto="eqm-${pers.id}-${m.id}">${i + 1}. ${esc(m.titre)}</a>`).join('')}</nav>
      ${mis.map((m, i) => {
        const L = st.actions[m.id] || [], done = L.filter(a => a.statut === 'Fait').length;
        return `<section class="eq-mission" id="eqm-${pers.id}-${m.id}">
          <div class="eq-mh"><span class="eq-num">${i + 1}</span><h3>${esc(m.titre)}</h3>${L.length ? `<span class="eq-prog"><i style="width:${Math.round(done / L.length * 100)}%"></i></span><em>${done}/${L.length}</em>` : ''}</div>
          <details class="eq-points"><summary>Responsabilités (${m.points.length})</summary><ul>${m.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul></details>
          ${(m.outils || []).filter(o => o !== 'actions' && T[o]).map(o => `<div class="eq-tool">${T[o](pers, m)}</div>`).join('')}
          <div class="eq-tool">${actionsHtml(pers, m)}</div>
        </section>`;
      }).join('')}`;
  }
  const renderAllEq = () => EQUIPE.forEach(render);

  function parseMissions(txt, old){
    const out = []; let cur = null;
    txt.split('\n').forEach(l => {
      const t = l.trim(); if(!t) return;
      if(t.startsWith('##')){ const titre = t.replace(/^#+\s*/, ''); const o = old.find(m => m.titre === titre); cur = {id:o ? o.id : 'm' + uid(), titre, points:[], outils:o ? o.outils : ['actions'], etapes:o && o.etapes}; out.push(cur); }
      else { if(!cur){ cur = {id:'m' + uid(), titre:'Missions', points:[], outils:['actions']}; out.push(cur); } cur.points.push(t.replace(/^[-•*]\s*/, '')); }
    });
    return out;
  }

  /* ---------- Événements ---------- */
  document.addEventListener('click', e => {
    const sec = e.target.closest('.eq-space'); if(!sec) return;
    const pers = EQUIPE.find(p => 'equipe-' + p.id === sec.id), st = P(pers.id), b = e.target;
    const g = b.closest('[data-goto]'); if(g){ e.preventDefault(); const t = document.getElementById(g.dataset.goto); if(t) t.scrollIntoView({behavior:'smooth', block:'start'}); return; }
    if(b.dataset.edit){ sec.querySelector('.eq-edit').hidden = !sec.querySelector('.eq-edit').hidden; return; }
    if(b.hasAttribute('data-msave')){ const m = parseMissions(sec.querySelector('.eq-edit textarea').value, missionsOf(pers)); if(m.length){ st.missions = m; if(pers.role === 'Missions à renseigner') pers.role = 'Missions personnalisées'; save(); render(pers); } return; }
    if(b.hasAttribute('data-mreset')){ if(confirm("Revenir aux missions d'origine ? Les actions déjà saisies sont gardées.")){ delete st.missions; save(); render(pers); } return; }
    if(b.dataset.pmove){ const x = st.pipes[b.dataset.m].find(y => y.id === b.dataset.id); x.etape += +b.dataset.pmove; save(); render(pers); return; }
    if(b.hasAttribute('data-pdel')){ if(confirm('Supprimer ce projet ?')){ st.pipes[b.dataset.m] = st.pipes[b.dataset.m].filter(y => y.id !== b.dataset.id); save(); render(pers); } return; }
    if(b.dataset.adel){ st.actions[b.dataset.m] = st.actions[b.dataset.m].filter(y => y.id !== b.dataset.adel); save(); render(pers); return; }
    if(b.dataset.decdel){ st.decisions = st.decisions.filter(y => y.id !== b.dataset.decdel); save(); render(pers); return; }
    if(b.hasAttribute('data-export')){
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 1)], {type:'application/json'}));
      a.download = 'ej-equipe-' + iso(today()) + '.json'; document.body.appendChild(a); a.click(); a.remove(); return;
    }
    if(b.hasAttribute('data-import')){
      const i = document.createElement('input'); i.type = 'file'; i.accept = '.json,application/json';
      i.onchange = () => { const f = i.files[0]; if(!f) return; const r = new FileReader(); r.onload = () => {
        try { const o = JSON.parse(r.result); if(!o.p) throw 0; if(confirm("Remplacer le suivi de l'équipe de ce navigateur par celui du fichier ?")){ S = o; save(); renderAllEq(); } } catch(err) { alert('Fichier illisible.'); } }; r.readAsText(f); };
      i.click();
    }
  });
  document.addEventListener('submit', e => {
    const sec = e.target.closest('.eq-space'); if(!sec) return;
    e.preventDefault();
    const pers = EQUIPE.find(p => 'equipe-' + p.id === sec.id), st = P(pers.id), f = e.target, v = n => (f[n] ? f[n].value.trim() : '');
    if(f.dataset.aadd){ (st.actions[f.dataset.aadd] = st.actions[f.dataset.aadd] || []).push({id:uid(), txt:v('txt'), due:v('due'), statut:'À faire'}); }
    else if(f.dataset.padd){ (st.pipes[f.dataset.padd] = st.pipes[f.dataset.padd] || []).push({id:uid(), nom:v('nom'), note:v('note'), etape:0, date:iso(today())}); }
    else if(f.hasAttribute('data-decadd')){ st.decisions.push({id:uid(), date:iso(today()), dom:v('dom'), txt:v('txt')}); }
    else if(f.hasAttribute('data-paysadd')){ if(!(v('pays') in st.pays)) st.pays[v('pays')] = ''; }
    save(); render(pers);
    const first = document.querySelector(`#${sec.id} form[data-aadd="${f.dataset.aadd}"] input, #${sec.id} form[data-padd="${f.dataset.padd}"] input`); if(first && (f.dataset.aadd || f.dataset.padd)) first.focus();
  });
  document.addEventListener('change', e => {
    const sec = e.target.closest('.eq-space'); if(!sec) return;
    const pers = EQUIPE.find(p => 'equipe-' + p.id === sec.id), st = P(pers.id), el = e.target;
    if(el.dataset.astat){ const a = st.actions[el.dataset.m].find(y => y.id === el.dataset.astat); a.statut = el.value; a.doneAt = el.value === 'Fait' ? iso(today()) : ''; save(); render(pers); }
    else if(el.dataset.pays !== undefined){ st.pays[el.dataset.pays] = el.value.trim(); save(); }
    else if(el.dataset.salon !== undefined){ st.salons[el.dataset.salon] = el.value.trim(); save(); }
  });
  // Rôle : celui de la fiche, sauf « Missions à renseigner » une fois les missions saisies.
  EQUIPE.forEach(p => { if(P(p.id).missions && p.role === 'Missions à renseigner') p.role = 'Missions personnalisées'; });
  renderAllEq();
  // Les chiffres (documents, stock) peuvent changer : on recalcule en ouvrant un espace.
  document.querySelectorAll('.sidebar .tab[data-group="equipe"]').forEach(t => t.addEventListener('click', renderAllEq));
})();
