/* Mode simple (par défaut) / mode complet.
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
    } else aller('journal');
    if(window.Chart) setTimeout(() => Object.values(Chart.instances || {}).forEach(c => c.resize()), 50);
  }
  if(btnMode) btnMode.addEventListener('click', () => passer(simple() ? 'complet' : 'simple'));
  majBouton();

  /* ---------- Page d'accueil ---------- */
  function rendre(){
    const box = document.getElementById('accueil-body'); if(!box) return;
    const S = (window.EJ_SOC && EJ_SOC.statsFor ? EJ_SOC.statsFor('groupe') : ALL)[YEAR] || {};
    let creances = 0; try { creances = EJ_GESTION.creances().reduce((a, c) => a + c.montant, 0); } catch(e) {}
    const it = []; Object.values(ALL.stock || {}).forEach(c => (c.items || []).forEach(i => it.push(i)));
    const rupture = it.filter(i => i.qty <= 0).length, bas = it.filter(i => i.qty > 0 && (i.status === 'critical' || i.status === 'low')).length;
    let rap = []; try { rap = (window.EJ_JOURNAL ? EJ_JOURNAL.rappels() : []).slice(0, 5); } catch(e) {}
    const sal = (typeof SALONS !== 'undefined' ? SALONS : []).filter(s => /^\d{4}-\d{2}-\d{2}$/.test(s.debut) && s.statut !== 'reporte' && days(s.fin || s.debut) >= 0).sort((a, b) => a.debut.localeCompare(b.debut))[0];
    const h = new Date().getHours();
    const tuile = (titre, valeur, detail, tab, cls) => `<button type="button" class="ac-tuile${cls ? ' ' + cls : ''}" data-go="${tab}"><span class="ac-t">${titre}</span><strong>${valeur}</strong><span class="ac-d">${detail}</span></button>`;
    box.innerHTML = `
      <p class="ac-bonjour">${h < 18 ? 'Bonjour' : 'Bonsoir'}. Nous sommes le ${today().toLocaleDateString('fr-FR', {weekday:'long', day:'numeric', month:'long', year:'numeric'})}.</p>
      <div class="ac-tuiles">
        ${tuile('Ventes ' + YEAR, money0(S.kpi_ca), (S.kpi_factures || 0) + ' factures · ' + (S.kpi_clients || 0) + ' clients', 'overview')}
        ${tuile('Bénéfice ' + YEAR, money0(S.kpi_marge), 'ventes moins le coût des parfums', 'overview', 'ok')}
        ${tuile('À encaisser', money0(creances), creances ? 'argent que les clients doivent encore' : 'aucune facture en attente de paiement', 'creances')}
        ${tuile('Stock', rupture + bas ? `${rupture} en rupture` : 'Tout va bien', rupture + bas ? `${bas} références presque épuisées` : 'aucune référence en rupture', 'stock', rupture ? 'ko' : '')}
      </div>
      <h3 class="ac-h">Que voulez-vous faire ?</h3>
      <div class="ac-actions">
        <button type="button" class="ac-act" data-new="facture">Faire une facture</button>
        <button type="button" class="ac-act" data-new="devis">Faire un devis</button>
        <button type="button" class="ac-act" data-go="stock">Voir le stock</button>
        <button type="button" class="ac-act" data-go="crm">Chercher un client</button>
        <button type="button" class="ac-act" data-ia-open="1">Poser une question</button>
      </div>
      <h3 class="ac-h">À faire en priorité</h3>
      <ul class="ac-todo">${rap.length ? rap.map(r => `<li><button type="button" data-go="${r.tab}"><span class="ac-pt ac-p${r.prio}"></span><span><strong>${esc(r.txt)}</strong>${r.sub ? `<small>${esc(r.sub)}</small>` : ''}</span><em>Ouvrir ›</em></button></li>`).join('') : '<li class="ac-vide">Rien d’urgent aujourd’hui.</li>'}</ul>
      <p class="ac-lien"><button type="button" data-go="journal">Voir toute la liste dans le journal de bord ›</button></p>
      ${sal ? `<h3 class="ac-h">Prochain salon</h3><button type="button" class="ac-salon" data-go="salons"><strong>${esc(sal.nom)}</strong> — ${esc(sal.ville)}, ${days(sal.debut) > 0 ? 'dans ' + days(sal.debut) + ' jours (' + fr(sal.debut) + ')' : 'en ce moment'}</button>` : ''}
      <p class="ac-mode">Besoin des autres pages (prix de revient, impôts, équipe…) ? <button type="button" data-mode-complet="1">Afficher toutes les pages</button></p>`;
  }

  document.addEventListener('click', e => {
    const g = e.target.closest('#accueil [data-go]'); if(g){ aller(g.dataset.go); window.scrollTo({top:0}); return; }
    const n = e.target.closest('#accueil [data-new]');
    if(n){ aller('documents'); setTimeout(() => { const b = document.querySelector(`[data-act="new"][data-type="${n.dataset.new}"]`); if(b) b.click(); }, 80); return; }
    const q = e.target.closest('[data-ia-open]');
    if(q){ const box = document.querySelector('.ia-box'), fab = document.querySelector('.ia-fab'); if(box && box.hidden && fab) fab.click();
      if(window.innerWidth < 900) document.body.classList.remove('menu-ouvert'); return; }
    if(e.target.closest('[data-mode-complet]')) passer('complet');
  });
  document.querySelectorAll('.sidebar .tab[data-tab="accueil"]').forEach(b => b.addEventListener('click', rendre));
  document.querySelectorAll('.year-btn').forEach(b => b.addEventListener('click', () => setTimeout(rendre, 50)));

  // Ouverture : en mode simple, on arrive sur l'accueil (vue groupe)
  rendre();
  if(simple()){
    const g = document.querySelector('.soc-btn[data-soc="groupe"]'); if(g && !g.classList.contains('active')) g.click();
    aller('accueil');
  }
})();
