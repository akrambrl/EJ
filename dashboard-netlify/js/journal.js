/* Journal de bord (page d'accueil) : ce qu'il faut faire aujourd'hui.
   - « À traiter » : rappels calculés à partir des données (paiements clients, devis à relancer, fournisseurs,
     stock, inventaire du mois, salons proches). Cocher « Fait » masque le rappel (mémorisé dans le navigateur).
   - Routine quotidienne / hebdomadaire / mensuelle : cases remises à zéro à chaque période.
   - Mes tâches et notes du journal : saisies libres.
   - Actualités : flux Google News (parfumerie, marché, Moyen-Orient, international, la marque) via rss2json, en cache 3 h.
   Tout est gardé dans le localStorage du navigateur (clé 'ej_journal_v1'). */
(function(){
  const root = document.getElementById('journal');
  if(!root) return;
  const KEY = 'ej_journal_v1', NEWS_KEY = 'ej_actus_cache_v1';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = n => (n || 0).toLocaleString('fr-FR', {minimumFractionDigits:2, maximumFractionDigits:2}) + ' €';
  const pad = n => String(n).padStart(2, '0');
  const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const fr = s => s ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : '';
  const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const days = s => Math.round((new Date(s + 'T00:00:00') - today()) / 864e5);
  const MOIS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  const MOISF = {janvier:0,'février':1,mars:2,avril:3,mai:4,juin:5,juillet:6,'août':7,septembre:8,octobre:9,novembre:10,'décembre':11};

  const ROUTINE_DEFAUT = [
    {id:'r1', freq:'jour', txt:'Lire les mails et les nouvelles commandes clients'},
    {id:'r2', freq:'jour', txt:'Contrôler les virements reçus (BRED / WIO Bank)'},
    {id:'r3', freq:'jour', txt:'Suivre les expéditions en cours'},
    {id:'r4', freq:'semaine', txt:'Relancer les devis et proformas sans réponse'},
    {id:'r5', freq:'semaine', txt:'Relancer les paiements clients en retard'},
    {id:'r6', freq:'semaine', txt:'Point fournisseurs : commandes, délais, factures reçues'},
    {id:'r7', freq:'semaine', txt:'Saisir les nouvelles factures dans le dashboard'},
    {id:'r8', freq:'mois', txt:'Inventaire des stocks : produits finis et composants'},
    {id:'r9', freq:'mois', txt:'Rapprochement bancaire et relevé des charges'},
    {id:'r10', freq:'mois', txt:'Payer fournisseurs, salaires et charges du mois'},
    {id:'r11', freq:'mois', txt:'Envoyer les pièces au comptable'}
  ];
  const FREQ = {jour:'Chaque jour', semaine:'Chaque semaine', mois:'Chaque mois'};
  const CATS = {client:'Client', paiement:'Paiement', fournisseur:'Fournisseur', stock:'Stock', admin:'Admin', salon:'Salon', autre:'Autre'};

  function load(){ try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch(e) { return {}; } }
  let J = load();
  J.todos = J.todos || []; J.notes = J.notes || []; J.done = J.done || {}; J.routine = J.routine || ROUTINE_DEFAUT.slice(); J.rdone = J.rdone || {};
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(J)); } catch(e) {} };
  const period = f => { const t = today(); if(f === 'jour') return iso(t); if(f === 'mois') return iso(t).slice(0, 7);
    const m = new Date(t); m.setDate(t.getDate() - ((t.getDay() + 6) % 7)); return 'S' + iso(m); };
  const go = tab => { const b = document.querySelector(`.sidebar .tab[data-tab="${tab}"]`); if(b) b.click(); };

  /* ---------- Rappels automatiques ---------- */
  function rappels(){
    const R = [], t = iso(today()), mk = iso(today()).slice(0, 7);
    const add = o => { if(!J.done[o.key]) R.push(o); };
    // 1. Paiements clients (documents créés dans le dashboard)
    const D = window.EJ_DOCS;
    if(D){
      D.list().forEach(d => {
        if(d.type === 'facture' && d.statut !== 'Payée'){
          const s = D.payState(d);
          if(s){ s.e.forEach((r, i) => { if(r.recu) return; const n = r.due ? days(r.due) : null;
            if(n !== null && n <= 7) add({key:`pay:${d.id}:${i}`, cat:'paiement', prio:n < 0 ? 3 : 2, tab:'documents',
              txt:`Relancer ${d.client} : ${r.pct} % de la facture ${d.numero} (${money(r.montant)})`, sub:n < 0 ? `en retard de ${-n} j (échéance ${fr(r.due)})` : n === 0 ? "échéance aujourd'hui" : `échéance le ${fr(r.due)}`}); }); }
          else if(d.echeance && days(d.echeance) <= 7){ const n = days(d.echeance);
            add({key:`fac:${d.id}`, cat:'paiement', prio:n < 0 ? 3 : 2, tab:'documents', txt:`Encaisser la facture ${d.numero} — ${d.client} (${money(D.calc(d).ttc)})`, sub:n < 0 ? `en retard de ${-n} j` : `échéance le ${fr(d.echeance)}`}); }
        }
        if((d.type === 'devis' || d.type === 'proforma') && /^Envoy/.test(d.statut || '')){
          const n = d.validite ? days(d.validite) : 99;
          add({key:`rel:${d.id}:${period('semaine')}`, cat:'client', prio:n < 3 ? 2 : 1, tab:'documents', txt:`Relancer ${d.client} : ${D.TYPES[d.type].label.toLowerCase()} ${d.numero} sans réponse`, sub:n < 0 ? 'offre expirée' : `valable jusqu'au ${fr(d.validite)}`});
        }
      });
    }
    // Virements clients attendus (liste manuelle)
    [['', typeof PENDING_TRANSFERS !== 'undefined' ? PENDING_TRANSFERS : null], [' (NB)', typeof PENDING_TRANSFERS_NB !== 'undefined' ? PENDING_TRANSFERS_NB : null]].forEach(([sfx, P]) => {
      ((P && P.items) || []).forEach((it, i) => add({key:`vir${sfx}:${i}:${it.client || it.label}:${it.amount || it.montant}`, cat:'paiement', prio:2, tab:'virements',
        txt:`Relancer le virement de ${it.client || it.label || 'client'}${sfx}`, sub:money(it.amount || it.montant || 0)}));
    });
    // 2. Fournisseurs : lignes non payées du mois en cours et des mois passés
    [['', typeof SUPPLIER_INVOICES !== 'undefined' ? SUPPLIER_INVOICES : null], [' (NB)', typeof SUPPLIER_INVOICES_NB !== 'undefined' ? SUPPLIER_INVOICES_NB : null]].forEach(([sfx, S]) => {
      ((S && S.months) || []).forEach(m => {
        const p = String(m.name || '').toLowerCase().split(/\s+/), mi = MOISF[p[0]], y = +p[1];
        if(mi === undefined || !y) return;
        const mm = y + '-' + pad(mi + 1); if(mm > mk) return;
        const lines = (m.lines || []).filter(l => !l.paid);
        if(!lines.length) return;
        add({key:`four${sfx}:${m.name}`, cat:'fournisseur', prio:mm < mk ? 3 : 2, tab:'fournisseurs',
          txt:`Payer les fournisseurs de ${m.name}${sfx} : ${money(lines.reduce((a, l) => a + (l.amount || 0), 0))}`,
          sub:lines.map(l => `${l.label} ${money(l.amount)}`).join(' · ') + (mm < mk ? ' — mois passé : vérifier si réglé et mettre à jour' : '')});
      });
      if(S && S.goldrock && /payer/i.test(S.goldrock.status || '') && (S.goldrock.lines || []).length)
        add({key:`goldrock${sfx}:${S.updated}`, cat:'fournisseur', prio:2, tab:'fournisseurs', txt:`Goldrock${sfx} : ${S.total_goldrock_usd ? S.total_goldrock_usd.toLocaleString('fr-FR') + ' $' : ''} à payer`, sub:S.goldrock.lines.map(l => l.label).join(' · ')});
    });
    // 3. Stock
    if(typeof ALL !== 'undefined' && ALL.stock){
      const it = []; Object.values(ALL.stock).forEach(c => (c.items || []).forEach(i => it.push(Object.assign({col:c.collection}, i))));
      const crit = it.filter(i => i.status === 'critical' || i.status === 'low'), ep = it.filter(i => i.status === 'epuise');
      if(crit.length) add({key:`stock:${ALL.stock_ref_date}:${crit.length}`, cat:'stock', prio:2, tab:'stock', txt:`Stock bas : ${crit.length} références à réapprovisionner`,
        sub:crit.sort((a, b) => a.qty - b.qty).slice(0, 8).map(i => `${i.reference} (${i.col}) ${i.qty}`).join(' · ') + (crit.length > 8 ? ' …' : '')});
      if(ep.length) add({key:`epuise:${ALL.stock_ref_date}:${ep.length}`, cat:'stock', prio:1, tab:'stock', txt:`${ep.length} références épuisées : relancer la production ou les retirer de l'offre`,
        sub:ep.map(i => i.reference).join(' · ')});
      if(ALL.stock_ref_date && days(ALL.stock_ref_date) < -35) add({key:`stockdate:${mk}`, cat:'stock', prio:2, tab:'stock', txt:'Mettre à jour le stock du dashboard', sub:`dernier comptage le ${fr(ALL.stock_ref_date)}`});
    }
    // 4. Inventaire mensuel
    add({key:`inventaire:${mk}`, cat:'stock', prio:today().getDate() >= 25 ? 3 : 1, tab:'inventaire', txt:`Inventaire des stocks de ${MOIS[today().getMonth()]}`, sub:'produits finis, flacons, capots, étuis, cartons, cadeaux'});
    // 5. Salons dans les 45 jours
    if(typeof SALONS !== 'undefined') SALONS.forEach(s => {
      if(!/^\d{4}-\d{2}-\d{2}$/.test(s.debut) || s.statut === 'reporte') return;
      const n = days(s.debut), fin = days(s.fin || s.debut);
      if(fin >= 0 && n <= 45) add({key:`salon:${s.nom}:${s.debut}`, cat:'salon', prio:s.prio ? 2 : 1, tab:'salons', txt:`${n <= 0 ? 'En cours' : 'Salon dans ' + n + ' j'} : ${s.nom} (${s.ville})`, sub:s.prio ? 'marché prioritaire — préparer rendez-vous et échantillons' : (s.note || '')});
    });
    return R.sort((a, b) => b.prio - a.prio);
  }

  /* ---------- Rendu ---------- */
  function render(){
    const R = rappels(), t = today();
    const todos = J.todos.slice().sort((a, b) => (a.done - b.done) || String(a.due || '9').localeCompare(String(b.due || '9')));
    const late = J.todos.filter(x => !x.done && x.due && days(x.due) < 0).length;
    root.querySelector('#jDate').textContent = t.toLocaleDateString('fr-FR', {weekday:'long', day:'numeric', month:'long', year:'numeric'});
    root.querySelector('#jResume').textContent = `${R.length} rappel${R.length > 1 ? 's' : ''} · ${J.todos.filter(x => !x.done).length} tâche${J.todos.filter(x => !x.done).length > 1 ? 's' : ''} en cours${late ? ` dont ${late} en retard` : ''}`;
    root.querySelector('#jAuto').innerHTML = R.length ? R.map(r => `<li class="j-item j-p${r.prio}">
        <span class="j-cat j-cat-${r.cat}">${CATS[r.cat]}</span>
        <div class="j-txt"><button type="button" class="j-link" data-go="${r.tab}">${esc(r.txt)}</button>${r.sub ? `<div class="j-sub">${esc(r.sub)}</div>` : ''}</div>
        <button type="button" class="j-done" data-key="${esc(r.key)}" title="Marquer comme fait">Fait</button></li>`).join('')
      : '<li class="j-empty">Rien d\'urgent. Tout est à jour.</li>';
    root.querySelector('#jTodos').innerHTML = todos.length ? todos.map(x => { const n = x.due ? days(x.due) : null; return `<li class="j-item${x.done ? ' j-fait' : ''}${!x.done && n !== null && n < 0 ? ' j-p3' : ''}">
        <input type="checkbox" data-todo="${x.id}"${x.done ? ' checked' : ''}>
        <span class="j-cat j-cat-${x.cat}">${CATS[x.cat] || 'Autre'}</span>
        <div class="j-txt">${esc(x.txt)}${x.due ? `<div class="j-sub">${n < 0 && !x.done ? `en retard — ${fr(x.due)}` : n === 0 ? "aujourd'hui" : 'pour le ' + fr(x.due)}</div>` : ''}</div>
        <button type="button" class="j-del" data-deltodo="${x.id}" title="Supprimer">×</button></li>`; }).join('') : '<li class="j-empty">Aucune tâche. Ajoute la première ci-dessus.</li>';
    root.querySelector('#jRoutine').innerHTML = Object.keys(FREQ).map(f => {
      const items = J.routine.filter(r => r.freq === f), p = period(f), nb = items.filter(r => J.rdone[r.id] === p).length;
      return `<div class="j-rgroup"><div class="j-rhead">${FREQ[f]}<span>${nb} / ${items.length}</span></div><ul>${items.map(r => `<li class="j-ritem${J.rdone[r.id] === p ? ' j-fait' : ''}">
        <label><input type="checkbox" data-rid="${r.id}"${J.rdone[r.id] === p ? ' checked' : ''}> ${esc(r.txt)}</label><button type="button" class="j-del" data-delr="${r.id}" title="Retirer">×</button></li>`).join('')}</ul></div>`;
    }).join('');
    root.querySelector('#jNotes').innerHTML = J.notes.length ? J.notes.slice().reverse().slice(0, 30).map(n => `<li><div class="j-ndate">${esc(new Date(n.t).toLocaleString('fr-FR', {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'}))}<button type="button" class="j-del" data-delnote="${n.t}" title="Supprimer">×</button></div><div class="j-ntxt">${esc(n.txt).replace(/\n/g, '<br>')}</div></li>`).join('') : '<li class="j-empty">Note ici ce qui s\'est passé dans la journée : appels, rendez-vous, décisions…</li>';
  }

  root.addEventListener('click', e => {
    const g = e.target.closest('[data-go]'); if(g){ go(g.dataset.go); return; }
    const d = e.target.closest('[data-key]'); if(d){ J.done[d.dataset.key] = iso(today()); save(); render(); return; }
    const dt = e.target.closest('[data-deltodo]'); if(dt){ J.todos = J.todos.filter(x => x.id !== dt.dataset.deltodo); save(); render(); return; }
    const dr = e.target.closest('[data-delr]'); if(dr && confirm('Retirer cette tâche de la routine ?')){ J.routine = J.routine.filter(x => x.id !== dr.dataset.delr); save(); render(); return; }
    const dn = e.target.closest('[data-delnote]'); if(dn && confirm('Supprimer cette note ?')){ J.notes = J.notes.filter(x => String(x.t) !== dn.dataset.delnote); save(); render(); return; }
    if(e.target.id === 'jReset' && confirm('Réafficher tous les rappels marqués comme faits ?')){ J.done = {}; save(); render(); }
  });
  root.addEventListener('change', e => {
    const el = e.target;
    if(el.dataset.todo){ const x = J.todos.find(y => y.id === el.dataset.todo); if(x){ x.done = el.checked; save(); render(); } }
    if(el.dataset.rid){ if(el.checked) J.rdone[el.dataset.rid] = period(J.routine.find(r => r.id === el.dataset.rid).freq); else delete J.rdone[el.dataset.rid]; save(); render(); }
  });
  root.querySelector('#jTodoForm').addEventListener('submit', e => {
    e.preventDefault(); const f = e.target, txt = f.txt.value.trim(); if(!txt) return;
    J.todos.push({id:'t' + Date.now().toString(36), txt, cat:f.cat.value, due:f.due.value, done:false}); save(); f.txt.value = ''; f.due.value = ''; render();
  });
  root.querySelector('#jRoutineForm').addEventListener('submit', e => {
    e.preventDefault(); const f = e.target, txt = f.txt.value.trim(); if(!txt) return;
    J.routine.push({id:'r' + Date.now().toString(36), freq:f.freq.value, txt}); save(); f.txt.value = ''; render();
  });
  root.querySelector('#jNoteForm').addEventListener('submit', e => {
    e.preventDefault(); const f = e.target, txt = f.txt.value.trim(); if(!txt) return;
    J.notes.push({t:Date.now(), txt}); save(); f.txt.value = ''; render();
  });

  /* ---------- Actualités ---------- */
  const FEEDS = {
    parfumerie:{l:'Parfumerie', q:'parfumerie OR "parfum de niche" OR "nouveau parfum"', lg:'fr'},
    marche:{l:'Marché & industrie', q:'"industrie du parfum" OR "marché du parfum" OR Firmenich OR Givaudan OR IFF OR Symrise', lg:'fr'},
    orient:{l:'Moyen-Orient', q:'(perfume OR fragrance OR oud) (Dubai OR "Saudi Arabia" OR GCC OR "Middle East")', lg:'en'},
    monde:{l:'International', q:'"fragrance industry" OR "niche fragrance" OR "perfume brand"', lg:'en'},
    marque:{l:'Emmanuelle Jane', q:'"Emmanuelle Jane"', lg:'fr'}
  };
  const SITES = [['Premium Beauty News','https://www.premiumbeautynews.com/fr/'],['Nez, la revue','https://mag.bynez.com/'],['CosmeticOfficine','https://www.cosmeticofficine.com/'],['FashionNetwork Beauté','https://fr.fashionnetwork.com/news/Beaute/'],['Cosmetics Business','https://cosmeticsbusiness.com/'],['BeautyMatter','https://beautymatter.com/'],['Fragrantica News','https://www.fragrantica.com/news/']];
  let feed = 'parfumerie';
  function gnews(f){
    const F = FEEDS[f], loc = F.lg === 'en' ? 'hl=en-US&gl=US&ceid=US:en' : 'hl=fr&gl=FR&ceid=FR:fr';
    return 'https://news.google.com/rss/search?q=' + encodeURIComponent(F.q + ' when:30d') + '&' + loc;
  }
  function cache(){ try { return JSON.parse(localStorage.getItem(NEWS_KEY)) || {}; } catch(e) { return {}; } }
  function showNews(items){
    const box = root.querySelector('#jNews');
    if(!items || !items.length){ box.innerHTML = `<li class="j-empty">${feed === 'marque' ? 'Aucun article récent ne cite la marque.' : 'Aucun article trouvé.'}</li>`; return; }
    box.innerHTML = items.slice(0, 8).map(i => {
      const m = String(i.title).match(/^(.*) - ([^-]+)$/), titre = m ? m[1] : i.title, src = m ? m[2] : (i.author || '');
      const d = i.pubDate ? new Date(i.pubDate.replace(' ', 'T') + 'Z') : null;
      return `<li><a href="${esc(i.link)}" target="_blank" rel="noopener">${esc(titre)}</a><div class="j-sub">${esc(src)}${d && !isNaN(d) ? ' · ' + d.toLocaleDateString('fr-FR', {day:'numeric', month:'short'}) : ''}</div></li>`;
    }).join('');
  }
  function loadNews(force){
    root.querySelectorAll('#jFeeds button').forEach(b => b.classList.toggle('active', b.dataset.feed === feed));
    const C = cache(), c = C[feed];
    if(c && !force && Date.now() - c.t < 3 * 3600e3){ showNews(c.items); return; }
    const box = root.querySelector('#jNews'); box.innerHTML = '<li class="j-empty">Chargement des actualités…</li>';
    const f = feed;
    fetch('https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(gnews(f)))
      .then(r => r.json()).then(d => {
        if(d.status !== 'ok') throw new Error(d.message || 'flux indisponible');
        const items = (d.items || []).sort((a, b) => String(b.pubDate).localeCompare(String(a.pubDate)));
        const C2 = cache(); C2[f] = {t:Date.now(), items:items.slice(0, 10)}; try { localStorage.setItem(NEWS_KEY, JSON.stringify(C2)); } catch(e) {}
        if(f === feed) showNews(items);
      }).catch(() => {
        if(f !== feed) return;
        if(c) showNews(c.items);
        else box.innerHTML = `<li class="j-empty">Actualités indisponibles pour le moment (connexion ou limite du service). <a href="${esc(gnews(f).replace('/rss/search', '/search'))}" target="_blank" rel="noopener">Ouvrir dans Google Actualités</a></li>`;
      });
  }
  root.querySelector('#jFeeds').innerHTML = Object.keys(FEEDS).map(k => `<button type="button" data-feed="${k}">${FEEDS[k].l}</button>`).join('');
  root.querySelector('#jFeeds').addEventListener('click', e => { const b = e.target.closest('button'); if(b){ feed = b.dataset.feed; loadNews(); } });
  root.querySelector('#jNewsRefresh').addEventListener('click', () => loadNews(true));
  root.querySelector('#jSites').innerHTML = SITES.map(([n, u]) => `<a href="${u}" target="_blank" rel="noopener">${n}</a>`).join('');

  render();
  loadNews();
  // Les documents peuvent changer dans l'onglet Devis & Factures : on recalcule en revenant sur le journal.
  document.querySelectorAll('.sidebar .tab[data-tab="journal"]').forEach(b => b.addEventListener('click', render));
})();
