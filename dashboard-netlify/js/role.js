/* Accès limité (page construite avec un rôle, ex. https://…/natali/) : seules les pages de travail sont visibles
   (devis et factures, stock, clients, expéditions, salons…). Les chiffres financiers internes ont déjà été retirés des
   données à la construction (outils/acces_limite.py) ; ici on masque les pages et blocs qui n'ont plus de sens. */
(function(){
  if(!window.EJ_ROLE) return;
  // Toujours le mode simple (grandes entrées, accueil clair) : pas de bascule vers « toutes les pages »
  document.documentElement.dataset.mode = 'simple'; try { localStorage.setItem('ej_mode', 'simple'); } catch(e) {}
  const PERMIS = ['accueil', 'journal', 'equipe-natali', 'stock', 'inventaire', 'appro', 'expeditions', 'conformite', 'documents', 'crm', 'prospects', 'salons'];
  const ok = t => PERMIS.includes(t);
  // Menu : on retire les entrées interdites et les titres de groupe devenus vides
  document.querySelectorAll('.sidebar .tab[data-tab]').forEach(b => { if(!ok(b.dataset.tab)) b.remove(); });
  document.querySelectorAll('.sidebar .sb-group').forEach(g => { let n = g.nextElementSibling, vide = true; while(n && !n.classList.contains('sb-group')){ if(n.classList.contains('tab')) vide = false; n = n.nextElementSibling; } if(vide) g.remove(); });
  document.querySelectorAll('.section').forEach(s => { if(!ok(s.id)) s.classList.add('role-cache'); });
  // Société : vue groupe uniquement
  const g = document.querySelector('.soc-btn[data-soc="groupe"]'); if(g && !g.classList.contains('active')) g.click();
  // Toute demande d'ouverture d'une page interdite (lien d'un rappel, de l'assistant…) ramène à l'accueil
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-tab], [data-go]'); if(!b) return;
    const t = b.dataset.tab || b.dataset.go; if(t && !ok(t)){ e.preventDefault(); e.stopImmediatePropagation(); const a = document.querySelector('.sidebar .tab[data-tab="accueil"]'); if(a) a.click(); }
  }, true);
  const nom = document.createElement('div'); nom.className = 'role-badge'; nom.textContent = 'Accès Natali';
  const brand = document.querySelector('.sidebar'); if(brand) brand.insertBefore(nom, brand.children[1] || null);
  const a = document.querySelector('.sidebar .tab[data-tab="accueil"]'); if(a) a.click();
})();
