/* Calendrier des salons de la parfumerie (onglet « Calendrier des salons »).
   Données : data/salons.js (SALONS). Les salons ajoutés à la main sont gardés dans le navigateur (localStorage 'ej_salons_perso').
   Ne dépend pas du choix de société ni de l'année du menu : l'onglet a son propre sélecteur d'année. */
(function(){
  const root = document.getElementById('salons');
  if(!root || typeof SALONS === 'undefined') return;
  const KEY = 'ej_salons_perso';
  const MOIS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const MOIS_C = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
  const CAT = {beaute:'Beauté & cosmétique', niche:'Parfumerie de niche', packaging:'Packaging', ingredients:'Matières premières', congres:'Congrès', autre:'Autre'};
  const STATUT = {confirme:'', a_confirmer:'À confirmer', reporte:'Reporté'};
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function perso(){ try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch(e) { return []; } }
  function savePerso(l){ try { localStorage.setItem(KEY, JSON.stringify(l)); } catch(e) {} }
  function all(){
    return SALONS.map((s, i) => Object.assign({id:'s' + i}, s))
      .concat(perso().map((s, i) => Object.assign({id:'p' + i, perso:true}, s)));
  }
  const parse = d => { const p = d.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2] || 1); };
  const exact = s => /^\d{4}-\d{2}-\d{2}$/.test(s.debut);
  const year = s => +s.debut.slice(0, 4), month = s => +s.debut.slice(5, 7) - 1;
  const endDate = s => exact(s) ? parse(s.fin || s.debut) : new Date(year(s), month(s) + 1, 0);
  const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  function etat(s){
    const t = today(), a = exact(s) ? parse(s.debut) : null, b = endDate(s);
    if(b < t) return 'passe';
    if(a && a <= t) return 'encours';
    return 'avenir';
  }
  function dates(s){
    if(!exact(s)) return MOIS[month(s)] + ' ' + year(s);
    const a = parse(s.debut), b = parse(s.fin || s.debut);
    if(+a === +b) return a.getDate() + ' ' + MOIS_C[a.getMonth()];
    if(a.getMonth() === b.getMonth()) return a.getDate() + '–' + b.getDate() + ' ' + MOIS_C[a.getMonth()];
    return a.getDate() + ' ' + MOIS_C[a.getMonth()] + ' – ' + b.getDate() + ' ' + MOIS_C[b.getMonth()];
  }
  function dans(s){
    const e = etat(s);
    if(s.statut === 'reporte') return 'Reporté';
    if(e === 'encours') return 'En cours';
    if(e === 'passe') return 'Terminé';
    const n = Math.round((parse(exact(s) ? s.debut : s.debut + '-01') - today()) / 864e5);
    if(!exact(s)) return n > 0 ? 'dans ~' + Math.max(1, Math.round(n / 30)) + ' mois' : 'ce mois-ci';
    return n === 1 ? 'demain' : n < 60 ? 'dans ' + n + ' jours' : 'dans ' + Math.round(n / 30) + ' mois';
  }

  let annee = String(Math.max(today().getFullYear(), Math.min.apply(null, SALONS.map(year)))), filtre = 'tous';

  function badges(s){
    let h = '';
    if(s.prio) h += '<span class="sl-badge sl-prio" title="Marché prioritaire">★ Prioritaire</span>';
    if(STATUT[s.statut]) h += '<span class="sl-badge sl-' + s.statut + '">' + STATUT[s.statut] + '</span>';
    if(s.perso) h += '<span class="sl-badge">Ajouté</span>';
    return h;
  }
  function item(s){
    const e = etat(s);
    return '<div class="sl-item sl-' + e + (s.prio ? ' is-prio' : '') + '" data-id="' + s.id + '">' +
      '<div class="sl-date">' + esc(dates(s)) + '</div>' +
      '<div class="sl-nom">' + (s.site ? '<a href="' + esc(s.site) + '" target="_blank" rel="noopener">' + esc(s.nom) + '</a>' : esc(s.nom)) + '</div>' +
      '<div class="sl-lieu">' + esc(s.ville) + (s.pays ? ' · ' + esc(s.pays) : '') + '</div>' +
      '<div class="sl-meta"><span class="sl-cat sl-cat-' + esc(s.cat) + '">' + esc(CAT[s.cat] || s.cat) + '</span>' + badges(s) + '</div>' +
      (s.note ? '<div class="sl-note">' + esc(s.note) + '</div>' : '') +
      '<div class="sl-actions"><span class="sl-dans">' + dans(s) + '</span>' +
        (exact(s) && e !== 'passe' && s.statut !== 'reporte' ? '<button type="button" class="sl-ics" data-id="' + s.id + '">Ajouter à l’agenda</button>' : '') +
        (s.perso ? '<button type="button" class="sl-del" data-id="' + s.id + '">Supprimer</button>' : '') + '</div>' +
      '</div>';
  }

  function render(){
    const liste = all();
    const annees = [...new Set(liste.map(year))].sort();
    if(!annees.includes(+annee)) annee = String(annees[annees.length - 1]);
    root.querySelector('#slYears').innerHTML = annees.map(a => '<button type="button" data-y="' + a + '"' + (String(a) === annee ? ' class="active"' : '') + '>' + a + '</button>').join('');
    root.querySelectorAll('#slFiltres button').forEach(b => b.classList.toggle('active', b.dataset.f === filtre));

    // Prochain salon, toutes années confondues (dates exactes en priorité)
    const futurs = liste.filter(s => etat(s) !== 'passe' && s.statut !== 'reporte').sort((a, b) => (exact(a) ? parse(a.debut) : endDate(a)) - (exact(b) ? parse(b.debut) : endDate(b)));
    const prochain = futurs[0], prio = futurs.find(s => s.prio && s !== prochain);
    root.querySelector('#slNext').innerHTML = [prochain && ['Prochain salon', prochain], prio && ['Prochain salon prioritaire', prio]].filter(Boolean).map(([t, s]) =>
      '<div class="sl-next"><div class="sl-next-t">' + t + '</div><div class="sl-next-n">' + esc(s.nom) + '</div>' +
      '<div class="sl-next-d">' + esc(dates(s)) + (exact(s) ? ' ' + year(s) : '') + ' · ' + esc(s.ville) + '</div><div class="sl-next-c">' + dans(s) + '</div></div>').join('');

    const vis = liste.filter(s => String(year(s)) === annee && (filtre === 'tous' || (filtre === 'prio' ? s.prio : s.cat === filtre)))
      .sort((a, b) => a.debut.localeCompare(b.debut));
    const t = today(), curM = String(t.getFullYear()) === annee ? t.getMonth() : -1;
    let h = '';
    for(let m = 0; m < 12; m++){
      const ev = vis.filter(s => month(s) === m);
      h += '<div class="sl-mois' + (m === curM ? ' sl-courant' : '') + (ev.length ? '' : ' sl-vide') + '"><div class="sl-mois-t">' + MOIS[m] +
        (ev.length ? '<span>' + ev.length + '</span>' : '') + '</div>' + (ev.length ? ev.map(item).join('') : '<div class="sl-rien">—</div>') + '</div>';
    }
    root.querySelector('#slGrid').innerHTML = h;
    const nPrio = vis.filter(s => s.prio).length, nConf = vis.filter(s => s.statut === 'a_confirmer').length;
    root.querySelector('#slResume').textContent = vis.length + ' salon' + (vis.length > 1 ? 's' : '') + ' en ' + annee +
      ' · ' + nPrio + ' prioritaire' + (nPrio > 1 ? 's' : '') + (nConf ? ' · ' + nConf + ' date' + (nConf > 1 ? 's' : '') + ' à confirmer' : '');
  }

  function ics(s){
    const f = d => d.replace(/-/g, '');
    const fin = parse(s.fin || s.debut); fin.setDate(fin.getDate() + 1);
    const fe = fin.getFullYear() + String(fin.getMonth() + 1).padStart(2, '0') + String(fin.getDate()).padStart(2, '0');
    const txt = v => String(v || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
    const body = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Emmanuelle Jane Paris//Salons//FR','BEGIN:VEVENT',
      'UID:' + f(s.debut) + '-' + s.nom.replace(/\W+/g, '') + '@emmanuellejane','DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z',
      'DTSTART;VALUE=DATE:' + f(s.debut),'DTEND;VALUE=DATE:' + fe,'SUMMARY:' + txt(s.nom),'LOCATION:' + txt(s.ville + ', ' + s.pays),
      'DESCRIPTION:' + txt((s.note || '') + (s.site ? '\n' + s.site : '')),'END:VEVENT','END:VCALENDAR'].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([body], {type:'text/calendar'}));
    a.download = s.nom.replace(/[^\w]+/g, '_') + '_' + year(s) + '.ics';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  root.addEventListener('click', e => {
    const y = e.target.closest('#slYears button'); if(y){ annee = y.dataset.y; render(); return; }
    const f = e.target.closest('#slFiltres button'); if(f){ filtre = f.dataset.f; render(); return; }
    const i = e.target.closest('.sl-ics'); if(i){ const s = all().find(x => x.id === i.dataset.id); if(s) ics(s); return; }
    const d = e.target.closest('.sl-del');
    if(d && confirm('Supprimer ce salon ?')){ const l = perso(); l.splice(+d.dataset.id.slice(1), 1); savePerso(l); render(); }
  });
  root.querySelector('#slForm').addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.target), s = {};
    ['nom','ville','pays','debut','fin','cat','site','note'].forEach(k => s[k] = String(fd.get(k) || '').trim());
    if(!s.nom || !s.debut) return;
    if(s.fin && s.fin < s.debut) s.fin = s.debut;
    s.statut = 'confirme'; s.prio = fd.get('prio') === 'on';
    const l = perso(); l.push(s); savePerso(l);
    annee = s.debut.slice(0, 4); e.target.reset(); e.target.closest('details').open = false; render();
  });
  render();
})();
