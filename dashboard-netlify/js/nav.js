/* Navigation par rubriques : Ventes, Produits, Finances, Commercial.
   Les onglets gardent leur fonctionnement d'origine (js/app.js) ; ce script n'affiche que ceux de la rubrique active. */
(function(){
  const groups = document.querySelectorAll('.nav-group'), tabs = document.querySelectorAll('.tab[data-group]');
  function show(g){
    groups.forEach(b => b.classList.toggle('active', b.dataset.group === g));
    tabs.forEach(t => t.hidden = t.dataset.group !== g);
  }
  groups.forEach(b => b.addEventListener('click', () => {
    show(b.dataset.group);
    const first = [...tabs].find(t => t.dataset.group === b.dataset.group);
    if(first) first.click();
  }));
  tabs.forEach(t => t.addEventListener('click', () => {
    show(t.dataset.group);
    t.scrollIntoView({block:'nearest', inline:'center'});
    const nav = document.querySelector('.nav');
    if(nav && (window.innerWidth < 700 || nav.getBoundingClientRect().top < 0)) window.scrollTo({top:nav.offsetTop - 4});
  }));
  const active = document.querySelector('.tab.active[data-group]');
  show(active ? active.dataset.group : 'ventes');
})();
