/* Blocs repliables : un appui sur le titre d'un bloc le replie ou le déplie (état gardé dans le navigateur).
   Chaque page qui contient des blocs repliables a aussi « Tout replier / Tout déplier » à côté de son titre.
   Sur mobile, certains blocs longs sont repliés par défaut, les encadrés d'explication sont réduits à 2 lignes
   et la liste « À traiter » du journal n'affiche que les 4 premiers rappels.
   Les pages se redessinent souvent (changement d'année, de société…) : un MutationObserver réapplique les plis. */
(function(){
  const KEY = 'ej_plis_v1';
  const mobile = () => window.innerWidth < 600;
  let etat; try { etat = JSON.parse(localStorage.getItem(KEY)) || {}; } catch(e) { etat = {}; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(etat)); } catch(e) {} };

  // [sélecteur du bloc, sélecteur de son en-tête (enfant direct), replié par défaut sur mobile ?]
  const REGLES = [
    ['.j-card', ':scope > .j-h', b => /Routine|Journal$/.test(titre(b))],
    ['.eq-mission', ':scope > .eq-mh', b => b.previousElementSibling && b.previousElementSibling.classList.contains('eq-mission')],
    ['#stockContent > div', ':scope > div:first-child', () => true],
    ['.sl-mois', ':scope > .sl-mois-t', b => !b.querySelector('.sl-avenir, .sl-encours')]
  ];
  function titre(b){ const h = b.querySelector(':scope > .j-h, :scope > .eq-mh h3, :scope > div:first-child, :scope > .sl-mois-t'); return h ? (h.firstChild && h.firstChild.nodeType === 3 ? h.firstChild.textContent : h.textContent).trim().slice(0, 40) : ''; }
  const cle = b => { const s = b.closest('.section'); return (s ? s.id : '') + '|' + titre(b); };
  function estPlie(b){ const k = cle(b); return k in etat ? etat[k] : (mobile() && b._defaut); }
  function poser(b){ b.classList.toggle('plie', !!estPlie(b)); }

  function appliquer(){
    REGLES.forEach(([sel, hsel, def]) => document.querySelectorAll(sel).forEach(b => {
      if(b.dataset.pli) { poser(b); return; }
      const h = b.querySelector(hsel); if(!h) return;
      b.dataset.pli = '1'; b.classList.add('pli'); h.classList.add('pli-h');
      b._defaut = def(b);
      const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'pli-btn'; btn.setAttribute('aria-label', 'Replier ou déplier');
      h.appendChild(btn);
      poser(b);
    }));
    // « Tout replier / déplier » à côté du titre de chaque page qui contient des blocs repliables
    document.querySelectorAll('.section').forEach(s => {
      const h2 = s.querySelector(':scope > h2'); if(!h2) return;
      const has = s.querySelector('.pli');
      let t = h2.querySelector('.pli-tout');
      if(has && !t){ t = document.createElement('button'); t.type = 'button'; t.className = 'pli-tout'; h2.appendChild(t); }
      if(t){ if(t.hidden !== !has) t.hidden = !has; const tous = [...s.querySelectorAll('.pli')]; const txt = tous.length && tous.every(b => b.classList.contains('plie')) ? 'Tout déplier' : 'Tout replier'; if(t.textContent !== txt) t.textContent = txt; }
    });
    // Encadrés d'explication réduits sur mobile
    document.querySelectorAll('.info-box:not([data-court])').forEach(i => { i.dataset.court = '1'; });
    // Journal : 4 rappels visibles sur mobile, puis « Voir les autres »
    const auto = document.getElementById('jAuto');
    if(auto){
      const n = auto.querySelectorAll(':scope > li.j-item').length, plus = auto.parentNode.querySelector('.j-plus');
      if(n > 5 && !auto.classList.contains('tout-voir')){ auto.classList.add('court');
        const txt = `Voir les ${n - 4} autres rappels`;
        if(!plus){ const b = document.createElement('button'); b.type = 'button'; b.className = 'j-plus'; b.textContent = txt; auto.after(b); }
        else if(plus.textContent !== txt) plus.textContent = txt;
      } else if(plus && n <= 5) plus.remove();
    }
  }

  document.addEventListener('click', e => {
    const t = e.target.closest('.pli-tout');
    if(t){ const s = t.closest('.section'), tous = [...s.querySelectorAll('.pli')], plier = !tous.every(b => b.classList.contains('plie'));
      tous.forEach(b => { etat[cle(b)] = plier; poser(b); }); save(); appliquer(); return; }
    const h = e.target.closest('.pli-h');
    // Les liens, boutons et champs de l'en-tête gardent leur rôle ; seul un appui « à vide » ou sur la flèche replie.
    if(h && (!e.target.closest('a, button, input, select, textarea, label') || e.target.classList.contains('pli-btn'))){
      const b = h.parentNode; etat[cle(b)] = !b.classList.contains('plie'); save(); poser(b); appliquer(); return; }
    const i = e.target.closest('.info-box');
    if(i && mobile() && !e.target.closest('a')) i.classList.toggle('ouvert');
    const p = e.target.closest('.j-plus');
    if(p){ const a = document.getElementById('jAuto'); a.classList.remove('court'); a.classList.add('tout-voir'); p.remove(); }
    // Un lien du sommaire d'un espace équipe déplie la mission visée
    const g = e.target.closest('[data-goto]');
    if(g){ const m = document.getElementById(g.dataset.goto); if(m && m.classList.contains('plie')){ etat[cle(m)] = false; save(); poser(m); } }
  }, true);

  let tm = null;
  new MutationObserver(() => { clearTimeout(tm); tm = setTimeout(appliquer, 30); }).observe(document.querySelector('.main') || document.body, {childList:true, subtree:true});
  window.addEventListener('resize', () => { clearTimeout(tm); tm = setTimeout(appliquer, 100); });
  appliquer();
})();
