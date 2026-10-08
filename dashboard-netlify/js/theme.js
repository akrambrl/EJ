/* Mode clair (beige) / mode sombre : bouton soleil-lune dans l'en-tête, choix gardé sur l'appareil ('ej_theme').
   Le thème est appliqué dès le <head> (petit script en ligne) pour éviter un flash ; ici on gère le bouton et le rafraîchissement. */
(function(){
  const KEY = 'ej_theme', root = document.documentElement;
  const SOLEIL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></svg>';
  const LUNE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/></svg>';
  const sombre = () => root.dataset.theme === 'dark';
  const top = document.querySelector('.topbar');
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'theme-btn';
  const maj = () => { btn.innerHTML = sombre() ? SOLEIL : LUNE; btn.title = sombre() ? 'Passer en mode clair' : 'Passer en mode sombre'; btn.setAttribute('aria-label', btn.title); };
  if(top){ top.appendChild(btn); maj(); }
  function simulateur(){ // le simulateur d'offres (iframe) suit le thème
    document.querySelectorAll('iframe.sim-frame').forEach(f => { try { f.contentDocument.documentElement.dataset.theme = sombre() ? 'dark' : 'light'; } catch(e) {} });
  }
  btn.addEventListener('click', () => {
    if(sombre()) root.dataset.theme = 'light'; else root.dataset.theme = 'dark';
    try { localStorage.setItem(KEY, root.dataset.theme); } catch(e) {}
    maj(); simulateur();
    if(typeof applyChartTheme === 'function') applyChartTheme();
    if(typeof renderAll === 'function') renderAll();
    window.dispatchEvent(new CustomEvent('ej-theme'));
  });
  document.querySelectorAll('iframe.sim-frame').forEach(f => f.addEventListener('load', simulateur));
  simulateur();
})();
