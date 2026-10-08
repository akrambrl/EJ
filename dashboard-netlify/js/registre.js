/* Registres : petits tableaux modifiables directement (comme un tableur) utilisés par les pages de gestion
   (trésorerie, créances, commandes fournisseurs, expéditions, conformité, prospects, agents…).
   Chaque registre est gardé dans le navigateur sous la clé 'ej_reg_<nom>' (synchronisée par js/cloud.js si branché).
   Utilisation : const R = REG.def('commandes', {cols:[…], defauts:[…]}); R.rows(); R.render(conteneur);
   Colonnes : {k, l (titre), t: 'text' | 'num' | 'money' | 'date' | 'select' | 'area' | 'check', o: [options], w: largeur min, ph: aide} */
(function(){
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const DEFS = {};
  const KEY = n => 'ej_reg_' + n;
  function load(n, def){ try { const v = JSON.parse(localStorage.getItem(KEY(n))); return v == null ? def : v; } catch(e) { return def; } }
  function store(n, v){ try { localStorage.setItem(KEY(n), JSON.stringify(v)); } catch(e) { alert("Enregistrement impossible dans ce navigateur."); } window.dispatchEvent(new CustomEvent('ej-reg', {detail:n})); }

  function def(nom, cfg){
    const D = DEFS[nom] = Object.assign({nom, cols:[], defauts:[], ajout:'+ Ajouter une ligne'}, cfg);
    // Lignes par défaut : enregistrées dès la première lecture pour garder des identifiants stables.
    D.rows = () => { let r = load(nom, null); if(r == null){ r = D.defauts.map(x => Object.assign({id:uid()}, x)); try { localStorage.setItem(KEY(nom), JSON.stringify(r)); } catch(e) {} } return r; };
    D.save = rows => store(nom, rows);
    D.add = obj => { const r = D.rows(); r.push(Object.assign({id:uid()}, obj)); D.save(r); };
    D.update = (id, k, v) => { const r = D.rows(), x = r.find(y => y.id === id); if(x){ x[k] = v; D.save(r); } };
    D.render = (box, opt) => render(D, box, opt || {});
    return D;
  }
  // Petites valeurs (réglages) : REG.val('taux', {usd:0.92})
  function val(nom, defaut){ const v = load(nom, null); return Object.assign({}, defaut, v || {}); }
  function setVal(nom, obj){ store(nom, obj); }

  function cell(c, x){
    const v = x[c.k] == null ? '' : x[c.k], a = `data-k="${c.k}"` + (c.w ? ` style="min-width:${c.w}px"` : '') + (c.ph ? ` placeholder="${esc(c.ph)}"` : '');
    if(c.t === 'select') return `<select ${a}>${(c.o || []).map(o => `<option${String(o) === String(v) ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    if(c.t === 'check') return `<input type="checkbox" ${a}${v ? ' checked' : ''}>`;
    if(c.t === 'area') return `<textarea rows="1" ${a}>${esc(v)}</textarea>`;
    if(c.t === 'date') return `<input type="date" ${a} value="${esc(v)}">`;
    if(c.t === 'num' || c.t === 'money') return `<input type="number" step="${c.t === 'money' ? '0.01' : 'any'}" class="reg-num" ${a} value="${esc(v)}">`;
    return `<input ${a} value="${esc(v)}">`;
  }
  function render(D, box, opt){
    if(!box) return;
    let rows = D.rows();
    if(opt.filtre) rows = rows.filter(opt.filtre);
    if(D.tri) rows = rows.slice().sort(D.tri);
    const cols = D.cols.filter(c => !c.cache);
    box.innerHTML = `<div class="reg-wrap"><table class="reg" data-reg="${D.nom}"><thead><tr>${cols.map(c => `<th${c.t === 'num' || c.t === 'money' ? ' class="text-right"' : ''}>${esc(c.l)}</th>`).join('')}${D.extra ? `<th>${esc(D.extra.l)}</th>` : ''}<th></th></tr></thead>
      <tbody>${rows.map(x => `<tr data-id="${x.id}"${D.classe ? ` class="${D.classe(x) || ''}"` : ''}>${cols.map(c => `<td>${cell(c, x)}</td>`).join('')}${D.extra ? `<td class="reg-extra">${D.extra.f(x)}</td>` : ''}<td><button type="button" class="reg-del" title="Supprimer la ligne">×</button></td></tr>`).join('')
        || `<tr><td colspan="${cols.length + 2}" class="reg-vide">${esc(D.vide || 'Aucune ligne pour l’instant.')}</td></tr>`}</tbody></table></div>
      <div class="reg-act"><button type="button" class="doc-btn reg-add">${esc(D.ajout)}</button><button type="button" class="j-mini reg-csv">Exporter (CSV)</button></div>`;
    box.dataset.reg = D.nom;
    box._opt = opt;
  }
  // Un seul jeu d'écouteurs pour tous les registres de la page
  function boxOf(el){ const b = el.closest('[data-reg]:not(table)'); return b ? [b, DEFS[b.dataset.reg]] : [null, null]; }
  document.addEventListener('change', e => {
    const el = e.target; if(!el.dataset || !el.dataset.k) return;
    const tr = el.closest('tr[data-id]'), [box, D] = boxOf(el); if(!tr || !D) return;
    const c = D.cols.find(x => x.k === el.dataset.k);
    const v = c.t === 'check' ? el.checked : (c.t === 'num' || c.t === 'money') ? (el.value === '' ? '' : +el.value) : el.value;
    D.update(tr.dataset.id, el.dataset.k, v);
    if(D.classe){ tr.className = D.classe(D.rows().find(x => x.id === tr.dataset.id)) || ''; }
    if(D.extra){ const x = D.rows().find(y => y.id === tr.dataset.id), td = tr.querySelector('.reg-extra'); if(td && x) td.innerHTML = D.extra.f(x); }
  });
  document.addEventListener('click', e => {
    const b = e.target.closest('.reg-add, .reg-del, .reg-csv'); if(!b) return;
    const [box, D] = boxOf(b); if(!D) return;
    if(b.classList.contains('reg-add')){ D.add(Object.assign({}, D.nouveau ? D.nouveau() : {}, box._opt && box._opt.nouveau ? box._opt.nouveau() : {})); render(D, box, box._opt); const f = box.querySelector('tbody tr:last-child input, tbody tr:last-child select'); if(f) f.focus(); }
    else if(b.classList.contains('reg-del')){ if(!confirm('Supprimer cette ligne ?')) return; D.save(D.rows().filter(x => x.id !== b.closest('tr').dataset.id)); render(D, box, box._opt); }
    else {
      const rows = D.rows(), cols = D.cols, q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
      const csv = '﻿' + [cols.map(c => q(c.l)).join(';')].concat(rows.map(x => cols.map(c => q(x[c.k])).join(';'))).join('\r\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'})); a.download = D.nom + '.csv';
      document.body.appendChild(a); a.click(); a.remove();
    }
  });
  window.REG = {def, val, setVal, DEFS, uid, esc};
})();
