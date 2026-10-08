/* Menu latéral : rubriques (Ventes, Produits, Finances, Commercial), choix de la société et de l'année.
   Les onglets gardent leur fonctionnement d'origine (js/app.js). Le menu se masque avec le bouton de l'en-tête
   (état mémorisé) ; sur mobile, il s'ouvre par-dessus la page et se referme après un choix. */
(function(){
  const KEY = 'ej_menu_masque';
  const body = document.body, toggle = document.getElementById('sbToggle'), overlay = document.getElementById('sbOverlay');
  const mobile = () => window.innerWidth < 900;
  let hidden = false;
  try { hidden = localStorage.getItem(KEY) === '1'; } catch(e) {}
  if(hidden) body.classList.add('menu-masque');

  function setOpen(open){
    if(mobile()) body.classList.toggle('menu-ouvert', open);
    else { body.classList.toggle('menu-masque', !open); try { localStorage.setItem(KEY, open ? '0' : '1'); } catch(e) {} }
    toggle.setAttribute('aria-expanded', String(open));
  }
  const isOpen = () => mobile() ? body.classList.contains('menu-ouvert') : !body.classList.contains('menu-masque');
  toggle.addEventListener('click', () => setOpen(!isOpen()));
  overlay.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', e => { if(e.key === 'Escape' && mobile() && isOpen()) setOpen(false); });
  toggle.setAttribute('aria-expanded', String(isOpen()));

  // Titre de la page et rappel des filtres dans l'en-tête
  const title = document.getElementById('pageTitle'), ctx = document.getElementById('ctxLine');
  const SOC = {groupe:'Groupe', BSD:'BSD · France', NB:'NB Evolution · Dubaï'}, AN = {'2025':'2025', '2026':'2026', total:'2025 + 2026'};
  function refreshHeader(){
    const t = document.querySelector('.sidebar .tab.active'); if(t && title) title.textContent = t.textContent;
    const s = document.querySelector('.soc-btn.active'), y = document.querySelector('.year-btn.active');
    if(ctx) ctx.textContent = (s ? SOC[s.dataset.soc] : '') + ' · ' + (y ? AN[y.dataset.year] : '');
  }
  document.querySelectorAll('.sidebar .tab').forEach(t => t.addEventListener('click', () => {
    refreshHeader();
    window.scrollTo({top:0});
    if(mobile()) setOpen(false);
  }));
  document.querySelectorAll('.soc-btn, .year-btn').forEach(b => b.addEventListener('click', () => setTimeout(refreshHeader, 0)));

  // Redessine les graphiques une fois les polices chargées, et après l'ouverture / fermeture du menu.
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if(typeof renderAll === 'function') renderAll(); });
  document.querySelector('.main').addEventListener('transitionend', e => { if(e.propertyName === 'margin-left' && window.Chart) Object.values(Chart.instances || {}).forEach(c => c.resize()); });
  refreshHeader();
})();
