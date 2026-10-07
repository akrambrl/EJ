/* ===================== MODULES DE GESTION =====================
   Catalogue & tarifs · Trésorerie · Matières & achats · Réseau B2B
   Tableaux éditables + sauvegarde locale (localStorage).
   Données d'EXEMPLE — à remplacer par les vraies données.        */
const MOD_PREFIX = 'ej_mod_';
const eMoney = n => (Math.round(+n||0)).toLocaleString('fr-FR') + ' €';
const eNum   = n => (+n||0).toLocaleString('fr-FR');
const eToday = () => { const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };
const eFr2iso = s => { if(!s) return ''; const p=String(s).split('/'); return p.length===3 ? p[2]+'-'+p[1].padStart(2,'0')+'-'+p[0].padStart(2,'0') : ''; };
const eIso2fr = s => { if(!s) return ''; const p=String(s).split('-'); return p.length===3 ? p[2]+'/'+p[1]+'/'+p[0] : ''; };
const eDaysUntil = fr => { const iso=eFr2iso(fr); if(!iso) return null; const ms=new Date(iso+'T00:00:00')-new Date(eToday()+'T00:00:00'); return Math.round(ms/86400000); };
const MODULES = {};

function modLoad(key, defaults){
  try{ const r = localStorage.getItem(MOD_PREFIX+key); if(r) return JSON.parse(r); }catch(e){}
  return JSON.parse(JSON.stringify(defaults));
}
function modSave(m){ try{ localStorage.setItem(MOD_PREFIX+m.key, JSON.stringify(m.rows)); }catch(e){} if(typeof cloudPush==='function') cloudPush(m.key, m.rows); }
function escAttr(v){ return String(v==null?'':v).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }

function defineModule(cfg){ cfg.name = cfg.base; cfg.rows = modLoad(cfg.key, cfg.defaults); MODULES[cfg.base] = cfg; }

function modCell(m, col, row, ri){
  if(col.compute){
    const v = col.compute(row);
    return `<td class="text-right" data-comp="${m.name}|${ri}|${col.id}">${col.fmt?col.fmt(v):v}</td>`;
  }
  if(col.type==='select'){
    const opts = col.options.map(o=>`<option${String(row[col.id])===String(o)?' selected':''}>${o}</option>`).join('');
    return `<td><select class="mod-in" data-m="${m.name}" data-ri="${ri}" data-c="${col.id}" style="min-width:${col.w||110}px">${opts}</select></td>`;
  }
  if(col.type==='date'){
    return `<td><input class="mod-in" type="date" value="${escAttr(eFr2iso(row[col.id]))}" data-m="${m.name}" data-ri="${ri}" data-c="${col.id}" style="width:${col.w||130}px"></td>`;
  }
  const inType = (col.type==='number'||col.type==='money') ? 'number' : 'text';
  const step = col.type==='money' ? ' step="0.01"' : (col.type==='number'?' step="1"':'');
  const al = col.align==='right' ? 'text-align:right;' : '';
  return `<td><input class="mod-in" type="${inType}"${step} value="${escAttr(row[col.id])}" data-m="${m.name}" data-ri="${ri}" data-c="${col.id}" style="width:${col.w||90}px;${al}"></td>`;
}

function renderModule(name){
  const m = MODULES[name];
  const cont = document.getElementById(m.base+'Content');
  if(!cont) return;
  const head = '<tr>' + m.cols.map(c=>`<th class="${c.align==='right'?'text-right':''}">${c.label}</th>`).join('') + '<th></th></tr>';
  const body = m.rows.map((row,ri)=>'<tr>' + m.cols.map(c=>modCell(m,c,row,ri)).join('') +
      `<td class="text-center"><button class="mod-del" data-m="${name}" data-ri="${ri}" title="Supprimer" style="background:none;border:none;color:#dc2626;cursor:pointer;font-size:1.05rem;font-weight:bold">✕</button></td></tr>`).join('');
  cont.innerHTML = `<table><thead>${head}</thead><tbody>${body||''}</tbody></table>`;
  updateModSummary(name);
}

function updateModComputed(name){
  const m = MODULES[name];
  document.querySelectorAll(`[data-comp^="${name}|"]`).forEach(td=>{
    const p = td.dataset.comp.split('|'); const col = m.cols.find(c=>c.id===p[2]); const row = m.rows[+p[1]];
    if(col && row){ const v = col.compute(row); td.innerHTML = col.fmt?col.fmt(v):v; }
  });
  updateModSummary(name);
}
function updateModSummary(name){
  const m = MODULES[name];
  const el = document.getElementById(m.base+'Summary');
  if(el && m.summary) el.innerHTML = m.summary(m.rows);
}
function kpiRow(items){
  return '<div class="kpis" style="margin-bottom:16px">' + items.map(it=>
    `<div class="kpi ${it.cls||''}"><div class="kpi-label">${it.label}</div><div class="kpi-value">${it.value}</div></div>`).join('') + '</div>';
}
const sum = (rows,f) => rows.reduce((a,r)=>a+(+f(r)||0),0);

/* -------- Délégation d'événements (une seule fois) -------- */
document.addEventListener('input', e=>{
  const el = e.target.closest('input.mod-in'); if(!el) return;
  const m = MODULES[el.dataset.m]; if(!m) return;
  const col = m.cols.find(c=>c.id===el.dataset.c);
  let v = el.value;
  if(col && (col.type==='number'||col.type==='money')) v = el.value==='' ? '' : parseFloat(el.value);
  else if(col && col.type==='date') v = eIso2fr(el.value);
  m.rows[+el.dataset.ri][el.dataset.c] = v; modSave(m); updateModComputed(m.name);
});
document.addEventListener('change', e=>{
  const el = e.target.closest('select.mod-in, input.mod-in[type="date"]'); if(!el) return;
  const m = MODULES[el.dataset.m]; if(!m) return;
  const col = m.cols.find(c=>c.id===el.dataset.c);
  const v = (col && col.type==='date') ? eIso2fr(el.value) : el.value;
  m.rows[+el.dataset.ri][el.dataset.c] = v; modSave(m); updateModComputed(m.name);
});
document.addEventListener('click', e=>{
  const add = e.target.closest('.mod-add');
  if(add){ const m=MODULES[add.dataset.m]; if(!m) return; m.rows.push(JSON.parse(JSON.stringify(m.blank))); modSave(m); renderModule(m.name); return; }
  const reset = e.target.closest('.mod-reset');
  if(reset){ const m=MODULES[reset.dataset.m]; if(!m) return; if(confirm("Réinitialiser les données d'exemple de ce tableau ?")){ m.rows=JSON.parse(JSON.stringify(m.defaults)); modSave(m); renderModule(m.name);} return; }
  const del = e.target.closest('.mod-del');
  if(del){ const m=MODULES[del.dataset.m]; if(!m) return; m.rows.splice(+del.dataset.ri,1); modSave(m); renderModule(m.name); return; }
});

/* ===================== DÉFINITION DES MODULES ===================== */

// 1) CATALOGUE & TARIFS
defineModule({
  base:'catalogue', key:'catalogue',
  cols:[
    {id:'collection',label:'Collection',type:'select',options:['VIP Black','VIP','Black','Royal','Brumes'],w:110},
    {id:'reference',label:'Référence',type:'text',w:150},
    {id:'ml',label:'ml',type:'number',align:'right',w:55},
    {id:'notes',label:'Notes olfactives',type:'text',w:190},
    {id:'pr',label:'PR €',type:'money',align:'right',w:75},
    {id:'pgros',label:'Prix gros € (B2B)',type:'money',align:'right',w:90},
    {id:'pv',label:'PV public € (B2C)',type:'money',align:'right',w:90},
    {id:'mB2B',label:'Marge B2B',align:'right',compute:r=>(+r.pgros||0)-(+r.pr||0),fmt:eMoney},
    {id:'mB2C',label:'Marge B2C',align:'right',compute:r=>(+r.pv||0)-(+r.pr||0),fmt:eMoney},
    {id:'txB2C',label:'% marge B2C',align:'right',compute:r=>{const pv=+r.pv||0;return pv?Math.round((pv-(+r.pr||0))/pv*100)+' %':'—';}}
  ],
  blank:{collection:'VIP',reference:'',ml:50,notes:'',pr:0,pgros:0,pv:0},
  defaults:[
    {collection:'VIP Black',reference:'Miel Royal',ml:50,notes:'Oud, miel, vanille Bourbon',pr:9,pgros:70,pv:139.99},
    {collection:'VIP Black',reference:'Cuir Rouge',ml:50,notes:'Cuir, safran persan, rose',pr:9,pgros:70,pv:139.99},
    {collection:'VIP',reference:'VIP Oud Vanille',ml:50,notes:'Oud, vanille, ambre',pr:8,pgros:60,pv:119.99},
    {collection:'VIP',reference:'VIP Red',ml:50,notes:'Fruits rouges, musc blanc',pr:8,pgros:60,pv:119.99},
    {collection:'Black',reference:'Exotic Oud',ml:50,notes:'Oud rare, bois, épices',pr:6.5,pgros:45,pv:89},
    {collection:'Black',reference:'Santal Wood',ml:50,notes:'Santal, vétiver, musc',pr:6.5,pgros:45,pv:89},
    {collection:'Royal',reference:'Milano Men',ml:50,notes:'Aromatique boisé',pr:4.5,pgros:20,pv:39.90},
    {collection:'Brumes',reference:'Flower Bomb',ml:30,notes:'Floral fruité',pr:2,pgros:9,pv:19.99},
    {collection:'Brumes',reference:'Coco Shine',ml:30,notes:'Coco, fleur de tiaré',pr:2,pgros:9,pv:19.99}
  ],
  summary:rows=>{
    const n=rows.length;
    const avgB2C = n? Math.round(sum(rows,r=>{const pv=+r.pv||0;return pv?(pv-(+r.pr||0))/pv*100:0;})/n):0;
    const avgB2B = n? Math.round(sum(rows,r=>{const pg=+r.pgros||0;return pg?(pg-(+r.pr||0))/pg*100:0;})/n):0;
    const pvMoy = n? Math.round(sum(rows,r=>+r.pv||0)/n):0;
    return kpiRow([
      {label:'Références',value:eNum(n)},
      {label:'PV public moyen',value:eMoney(pvMoy)},
      {label:'Marge moy. B2C',value:avgB2C+' %',cls:'success'},
      {label:'Marge moy. B2B',value:avgB2B+' %',cls:'success'}
    ]);
  }
});

// 2) TRÉSORERIE — Factures & encours : rendu par le module de saisie (vraies factures), voir renderReglements()

// 2b) TRÉSORERIE — Flux
defineModule({
  base:'tresoFlux', key:'treso_flux',
  cols:[
    {id:'date',label:'Date',type:'text',w:95},
    {id:'libelle',label:'Libellé',type:'text',w:180},
    {id:'type',label:'Type',type:'select',options:['Entrée','Sortie'],w:80},
    {id:'categorie',label:'Catégorie',type:'select',options:['Vente','Fournisseur','Production','Expédition','Marketing','Salaire','Charges','Autre'],w:115},
    {id:'montant',label:'Montant €',type:'money',align:'right',w:95}
  ],
  blank:{date:'',libelle:'',type:'Sortie',categorie:'Autre',montant:0},
  defaults:[
    {date:'05/01/2026',libelle:'Règlement Parfumerie Al Noor',type:'Entrée',categorie:'Vente',montant:18400},
    {date:'10/01/2026',libelle:'Achat concentrés (Grasse)',type:'Sortie',categorie:'Fournisseur',montant:7200},
    {date:'15/01/2026',libelle:'Flaconnage + pompes',type:'Sortie',categorie:'Production',montant:3100},
    {date:'20/02/2026',libelle:'Campagne réseaux sociaux',type:'Sortie',categorie:'Marketing',montant:1500},
    {date:'28/02/2026',libelle:'Ventes web février',type:'Entrée',categorie:'Vente',montant:8600},
    {date:'01/03/2026',libelle:'Transport export Moyen-Orient',type:'Sortie',categorie:'Expédition',montant:2400}
  ],
  summary:rows=>{
    const ent = sum(rows.filter(r=>r.type==='Entrée'),r=>r.montant);
    const sor = sum(rows.filter(r=>r.type==='Sortie'),r=>r.montant);
    return kpiRow([
      {label:'Total entrées',value:eMoney(ent),cls:'success'},
      {label:'Total sorties',value:eMoney(sor),cls:'danger'},
      {label:'Solde',value:eMoney(ent-sor),cls:(ent-sor)>=0?'success':'danger'}
    ]);
  }
});

// 3) MATIÈRES PREMIÈRES
defineModule({
  base:'matieres', key:'matieres_stock',
  cols:[
    {id:'matiere',label:'Matière / composant',type:'text',w:170},
    {id:'categorie',label:'Catégorie',type:'select',options:['Concentré','Alcool','Flacon','Pompe','Capot','Étui','Coffret','Étiquette','Autre'],w:110},
    {id:'unite',label:'Unité',type:'text',w:65},
    {id:'stock',label:'Stock',type:'number',align:'right',w:75},
    {id:'seuil',label:'Seuil',type:'number',align:'right',w:70},
    {id:'cout',label:'Coût/u €',type:'money',align:'right',w:80},
    {id:'fournisseur',label:'Fournisseur',type:'text',w:140},
    {id:'valeur',label:'Valeur stock',align:'right',compute:r=>(+r.stock||0)*(+r.cout||0),fmt:eMoney},
    {id:'etat',label:'État',compute:r=>(+r.stock||0)<=(+r.seuil||0)?'⚠️ À commander':'✓ OK',fmt:v=>v.indexOf('⚠')>=0?`<span class="stat-alert">${v}</span>`:`<span class="stat-ok">${v}</span>`}
  ],
  blank:{matiere:'',categorie:'Concentré',unite:'g',stock:0,seuil:0,cout:0,fournisseur:''},
  defaults:[
    {matiere:'Concentré Oud rare',categorie:'Concentré',unite:'g',stock:1200,seuil:500,cout:0.45,fournisseur:'Grasse Aromatics'},
    {matiere:'Concentré Vanille Bourbon',categorie:'Concentré',unite:'g',stock:300,seuil:400,cout:0.30,fournisseur:'Grasse Aromatics'},
    {matiere:'Alcool parfumeur 96°',categorie:'Alcool',unite:'L',stock:80,seuil:50,cout:6,fournisseur:'Distillerie Sud'},
    {matiere:'Flacon 50ml VIP',categorie:'Flacon',unite:'u',stock:2500,seuil:1000,cout:1.8,fournisseur:'Verrerie Lux'},
    {matiere:'Pompe spray dorée',categorie:'Pompe',unite:'u',stock:900,seuil:1000,cout:0.6,fournisseur:'Verrerie Lux'},
    {matiere:'Étui VIP Black',categorie:'Étui',unite:'u',stock:1800,seuil:800,cout:0.9,fournisseur:'Cartonnage Paris'},
    {matiere:'Flacon 30ml Brumes',categorie:'Flacon',unite:'u',stock:400,seuil:600,cout:0.7,fournisseur:'Verrerie Lux'}
  ],
  summary:rows=>{
    const val = sum(rows,r=>(+r.stock||0)*(+r.cout||0));
    const alert = rows.filter(r=>(+r.stock||0)<=(+r.seuil||0)).length;
    return kpiRow([
      {label:'Valeur du stock',value:eMoney(val)},
      {label:'Réf. matières',value:eNum(rows.length)},
      {label:'À commander',value:eNum(alert),cls:alert>0?'danger':'success'}
    ]);
  }
});

// 3b) BONS DE COMMANDE
defineModule({
  base:'commandes', key:'achats_commandes',
  cols:[
    {id:'fournisseur',label:'Fournisseur',type:'text',w:140},
    {id:'matiere',label:'Matière',type:'text',w:160},
    {id:'quantite',label:'Qté',type:'number',align:'right',w:70},
    {id:'cout',label:'Coût total €',type:'money',align:'right',w:95},
    {id:'delai',label:'Délai',type:'text',w:90},
    {id:'statut',label:'Statut',type:'select',options:['Brouillon','Envoyée','Reçue'],w:105}
  ],
  blank:{fournisseur:'',matiere:'',quantite:0,cout:0,delai:'',statut:'Brouillon'},
  defaults:[
    {fournisseur:'Grasse Aromatics',matiere:'Concentré Vanille Bourbon',quantite:2000,cout:600,delai:'3 semaines',statut:'Envoyée'},
    {fournisseur:'Verrerie Lux',matiere:'Pompe spray dorée',quantite:3000,cout:1800,delai:'2 semaines',statut:'Envoyée'},
    {fournisseur:'Verrerie Lux',matiere:'Flacon 30ml Brumes',quantite:2000,cout:1400,delai:'2 semaines',statut:'Brouillon'},
    {fournisseur:'Cartonnage Paris',matiere:'Étui VIP Black',quantite:2000,cout:1800,delai:'10 jours',statut:'Reçue'}
  ],
  summary:rows=>{
    const enCours = rows.filter(r=>r.statut==='Envoyée').length;
    const engage = sum(rows.filter(r=>r.statut!=='Reçue'),r=>r.cout);
    return kpiRow([
      {label:'Commandes en cours',value:eNum(enCours)},
      {label:'Montant engagé',value:eMoney(engage)},
      {label:'Total bons',value:eNum(rows.length)}
    ]);
  }
});

// 3c) ARRIVAGES — Suivi des dates d'arrivage des matières premières
defineModule({
  base:'arrivages', key:'achats_arrivages',
  cols:[
    {id:'matiere',label:'Matière / composant',type:'text',w:170},
    {id:'fournisseur',label:'Fournisseur',type:'text',w:140},
    {id:'quantite',label:'Qté',type:'number',align:'right',w:75},
    {id:'transport',label:'Transport',type:'select',options:['Maritime','Aérien','Routier','Express','Autre'],w:95},
    {id:'commande',label:'Date commande',type:'date',w:140},
    {id:'prevue',label:'Arrivage prévu',type:'date',w:140},
    {id:'reelle',label:'Arrivage réel',type:'date',w:140},
    {id:'statut',label:'Statut',type:'select',options:['En préparation','Expédié','En transit','Arrivé','Retardé'],w:120},
    {id:'suivi',label:'Suivi',compute:r=>{
        if(r.statut==='Arrivé') return r.reelle ? '✓ Arrivé le '+r.reelle : '✓ Arrivé';
        const d=eDaysUntil(r.prevue);
        if(d===null) return '—';
        if(d<0) return '⚠️ En retard ('+(-d)+' j)';
        if(d===0) return '🔔 Aujourd’hui';
        if(d<=7) return '🔜 Dans '+d+' j';
        return 'Dans '+d+' j';
      }, fmt:v=> v.indexOf('⚠')>=0?`<span class="stat-alert">${v}</span>` : v.indexOf('✓')>=0?`<span class="stat-ok">${v}</span>` : v}
  ],
  blank:{matiere:'',fournisseur:'',quantite:0,transport:'Routier',commande:'',prevue:'',reelle:'',statut:'En préparation'},
  defaults:[
    {matiere:'Concentré Oud rare',fournisseur:'Grasse Aromatics',quantite:3000,transport:'Routier',commande:'10/05/2026',prevue:'12/06/2026',reelle:'',statut:'En transit'},
    {matiere:'Flacon 50ml VIP',fournisseur:'Verrerie Lux',quantite:5000,transport:'Maritime',commande:'01/04/2026',prevue:'20/05/2026',reelle:'18/05/2026',statut:'Arrivé'},
    {matiere:'Pompe spray dorée',fournisseur:'Verrerie Lux',quantite:4000,transport:'Routier',commande:'02/05/2026',prevue:'28/05/2026',reelle:'',statut:'Expédié'},
    {matiere:'Étui VIP Black',fournisseur:'Cartonnage Paris',quantite:3000,transport:'Express',commande:'20/05/2026',prevue:'15/06/2026',reelle:'',statut:'En préparation'}
  ],
  summary:rows=>{
    const enRoute = rows.filter(r=>r.statut==='Expédié'||r.statut==='En transit').length;
    const bientot = rows.filter(r=>{ if(r.statut==='Arrivé') return false; const d=eDaysUntil(r.prevue); return d!==null && d>=0 && d<=7; }).length;
    const retard = rows.filter(r=>{ if(r.statut==='Arrivé') return false; const d=eDaysUntil(r.prevue); return d!==null && d<0; }).length;
    return kpiRow([
      {label:'En route',value:eNum(enRoute)},
      {label:'Arrivée sous 7 j',value:eNum(bientot)},
      {label:'En retard',value:eNum(retard),cls:retard>0?'danger':'success'},
      {label:'Total arrivages',value:eNum(rows.length)}
    ]);
  }
});

// 4) RÉSEAU B2B
defineModule({
  base:'b2b', key:'b2b_points',
  cols:[
    {id:'nom',label:'Point de vente',type:'text',w:160},
    {id:'ville',label:'Ville',type:'text',w:100},
    {id:'pays',label:'Pays',type:'text',w:90},
    {id:'type',label:'Type',type:'select',options:['Parfumerie','Concept store','Grand magasin','Pharmacie','Spa/Hôtel','Autre'],w:120},
    {id:'ca',label:'CA cumulé €',type:'money',align:'right',w:100},
    {id:'dernier',label:'Dernier réassort',type:'text',w:110},
    {id:'statut',label:'Statut',type:'select',options:['Actif','À relancer','Inactif'],w:100},
    {id:'contact',label:'Contact',type:'text',w:150}
  ],
  blank:{nom:'',ville:'',pays:'',type:'Parfumerie',ca:0,dernier:'',statut:'Actif',contact:''},
  defaults:[
    {nom:'Parfumerie Al Noor',ville:'Bagdad',pays:'Irak',type:'Parfumerie',ca:84500,dernier:'05/01/2026',statut:'Actif',contact:'+964 ...'},
    {nom:'Galeries du Levant',ville:'Beyrouth',pays:'Liban',type:'Grand magasin',ca:41200,dernier:'12/02/2026',statut:'Actif',contact:'contact@levant.lb'},
    {nom:'Maison Dubai Mall',ville:'Dubaï',pays:'EAU',type:'Concept store',ca:67800,dernier:'20/11/2025',statut:'À relancer',contact:'sales@dubaimall.ae'},
    {nom:'Concept Store Casablanca',ville:'Casablanca',pays:'Maroc',type:'Concept store',ca:23400,dernier:'02/03/2026',statut:'Actif',contact:'+212 ...'},
    {nom:'Spa Royal Doha',ville:'Doha',pays:'Qatar',type:'Spa/Hôtel',ca:12900,dernier:'15/09/2025',statut:'Inactif',contact:'spa@royaldoha.qa'}
  ],
  summary:rows=>{
    const actifs = rows.filter(r=>r.statut==='Actif').length;
    const relancer = rows.filter(r=>r.statut==='À relancer').length;
    const ca = sum(rows,r=>r.ca);
    return kpiRow([
      {label:'Points actifs',value:eNum(actifs),cls:'success'},
      {label:'CA réseau cumulé',value:eMoney(ca)},
      {label:'À relancer',value:eNum(relancer),cls:relancer>0?'danger':'success'},
      {label:'Total points',value:eNum(rows.length)}
    ]);
  }
});

// 7) STOCK ÉCHANTILLONS 2 ml (flacons)
defineModule({
  base:'stock2ml', key:'stock_2ml',
  cols:[
    {id:'gamme',label:'Gamme',type:'select',options:['CP','ROYAL','VIP'],w:90},
    {id:'reference',label:'Référence',type:'text',w:200},
    {id:'qte',label:'Stock (flacons 2 ml)',type:'number',align:'right',w:120},
    {id:'seuil',label:"Seuil d'alerte",type:'number',align:'right',w:100},
    {id:'etat',label:'État',align:'right',compute:r=>{const q=+r.qte||0,s=+r.seuil||0;return q<=0?'rupture':(s>0&&q<=s?'bas':'ok');},fmt:v=>v==='rupture'?'<span class="stat-alert">⛔ Rupture</span>':v==='bas'?'<span class="stat-warn">⚠️ Bas</span>':'<span class="stat-ok">✓ OK</span>'}
  ],
  blank:{gamme:'VIP',reference:'',qte:0,seuil:300},
  defaults:[
    {gamme:'CP',reference:'Bora Bora',qte:1256,seuil:300},
    {gamme:'CP',reference:"Éloge d'Orient",qte:1957,seuil:300},
    {gamme:'CP',reference:'Exotic Oud',qte:1958,seuil:300},
    {gamme:'CP',reference:'Golden Caramel',qte:1261,seuil:300},
    {gamme:'CP',reference:'Santal Wood',qte:1259,seuil:300},
    {gamme:'CP',reference:'Cherry 2ml',qte:2000,seuil:300},
    {gamme:'CP',reference:'Vetyver 2ml',qte:1084,seuil:300},
    {gamme:'ROYAL',reference:'Milano M',qte:1054,seuil:300},
    {gamme:'ROYAL',reference:'Milano Renaissance',qte:993,seuil:300},
    {gamme:'ROYAL',reference:'Milano Ultra',qte:2026,seuil:300},
    {gamme:'ROYAL',reference:'Milano W',qte:2143,seuil:300},
    {gamme:'ROYAL',reference:'Uomo',qte:942,seuil:300},
    {gamme:'ROYAL',reference:'Uomo Alternance',qte:944,seuil:300},
    {gamme:'VIP',reference:'Caftan',qte:1917,seuil:300},
    {gamme:'VIP',reference:'Dream Catcher',qte:761,seuil:300},
    {gamme:'VIP',reference:'Éclat de Vanille',qte:1435,seuil:300},
    {gamme:'VIP',reference:'Elixir',qte:1908,seuil:300},
    {gamme:'VIP',reference:'Grey',qte:809,seuil:300},
    {gamme:'VIP',reference:'Moon',qte:1925,seuil:300},
    {gamme:'VIP',reference:'Oud Berry',qte:1919,seuil:300},
    {gamme:'VIP',reference:'Oud Vanille',qte:799,seuil:300},
    {gamme:'VIP',reference:'Piège',qte:785,seuil:300},
    {gamme:'VIP',reference:'Pure',qte:0,seuil:300},
    {gamme:'VIP',reference:'Red',qte:787,seuil:300},
    {gamme:'VIP',reference:'Regatus',qte:1917,seuil:300},
    {gamme:'VIP',reference:'Rivière Noire',qte:0,seuil:300},
    {gamme:'VIP',reference:'Silver',qte:738,seuil:300}
  ],
  summary:rows=>{
    const byG=g=>sum(rows.filter(r=>r.gamme===g),r=>r.qte);
    const rupture=rows.filter(r=>(+r.qte||0)<=0).length;
    const bas=rows.filter(r=>{const q=+r.qte||0,s=+r.seuil||0;return q>0&&s>0&&q<=s;}).length;
    const alertes=rupture+bas;
    return kpiRow([
      {label:'Total flacons 2 ml',value:eNum(sum(rows,r=>r.qte))},
      {label:'CP',value:eNum(byG('CP'))},
      {label:'ROYAL',value:eNum(byG('ROYAL'))},
      {label:'VIP',value:eNum(byG('VIP'))},
      {label:'Alertes (bas + rupture)',value:eNum(alertes),cls:alertes>0?'danger':'success'}
    ]);
  }
});

// Rendu initial de tous les modules
Object.keys(MODULES).forEach(renderModule);

/* ===================== NAVIGATION À DEUX NIVEAUX ===================== */
const NAV_GROUPS = [
  {id:'g_pilotage', label:'📊 Pilotage', tabs:[['overview',"Vue d'ensemble"],['objectifs','Objectifs & Projection'],['insights','Remarques intelligentes'],['compare','Comparatif 2025/2026']]},
  {id:'g_ventes', label:'💶 Ventes', tabs:[['saisie','🧾 Commandes & Factures'],['clients','Clients & Pays'],['mois','Mois'],['refs','Références']]},
  {id:'g_finance', label:'🏷️ Catalogue & Finance', tabs:[['catalogue','Catalogue & Tarifs'],['costs','Prix de revient'],['treso','Trésorerie']]},
  {id:'g_ops', label:'📦 Opérations', tabs:[['stock','Stock produits finis'],['stock2ml','Stock 2 ml (échantillons)'],['achats','Matières & Achats'],['arrivages','Arrivages matières'],['production','Production'],['simulation','Simulation commande'],['anticipation','Anticipation']]},
  {id:'g_reseau', label:'🏬 Réseau B2B', tabs:[['b2b','Points de vente']]},
  {id:'g_reglages', label:'⚙️ Réglages', tabs:[['societes','Sociétés & devises']]}
];

const sidebar = document.getElementById('sidebar');
const backdrop = document.getElementById('sidebarBackdrop');
function closeSidebar(){ sidebar.classList.remove('open'); backdrop.classList.remove('open'); }
function showSection(id, label){
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  const sec = document.getElementById(id);
  if(sec){ sec.classList.add('active'); window.dispatchEvent(new Event('resize')); }
  const kpiHero = document.getElementById('kpiHero');
  if(kpiHero) kpiHero.style.display = (id==='overview') ? '' : 'none';
  if(label){ const tt=document.getElementById('topbarTitle'); if(tt) tt.textContent = label; }
  if(id==='pays' && typeof renderWorldMap==='function') setTimeout(renderWorldMap,60);
  if(id==='treso' && typeof window.renderReglements==='function') window.renderReglements();
}
// Sous-onglets (pages fusionnées : Clients/Pays/Évolution et Commandes&Factures/Factures)
document.addEventListener('click', e=>{
  const st = e.target.closest('.subtab'); if(!st || !st.dataset.sub) return;
  showSection(st.dataset.sub, st.textContent.trim());
});
function buildNav(){
  const nav = document.getElementById('sideNav');
  nav.innerHTML = NAV_GROUPS.map(grp =>
    `<div class="nav-cat">${grp.label}</div>` +
    grp.tabs.map(t=>`<button class="nav-item" data-tab="${t[0]}">${t[1]}</button>`).join('')
  ).join('');
  nav.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>{
    nav.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    showSection(b.dataset.tab, b.textContent);
    closeSidebar();
  }));
  const first = nav.querySelector('.nav-item');
  if(first){ first.classList.add('active'); showSection(first.dataset.tab, first.textContent); }
}
// Toggle mobile
document.getElementById('menuToggle').addEventListener('click', ()=>{ sidebar.classList.toggle('open'); backdrop.classList.toggle('open'); });
backdrop.addEventListener('click', closeSidebar);
buildNav();

/* ===================== SAUVEGARDE EN LIGNE + CONNEXION (optionnel) =====================
   Mode LOCAL par défaut (données dans le navigateur). Si window.EJ_CONFIG contient
   l'URL + la clé Supabase, on active : connexion sécurisée + sauvegarde cloud synchronisée. */
const EJ_CONFIG = window.EJ_CONFIG || { SUPABASE_URL:'', SUPABASE_ANON_KEY:'' };
const EJ_CLOUD = !!(EJ_CONFIG.SUPABASE_URL && EJ_CONFIG.SUPABASE_ANON_KEY);
const EJ_REQUIRE_AUTH = EJ_CONFIG.requireAuth !== false; // true par défaut, sauf si explicitement false
let _supa=null, _ejUser=null; const _pushTimers={};

function cloudPush(key, rows){
  if(!EJ_CLOUD || !_supa || !_ejUser) return;
  clearTimeout(_pushTimers[key]);
  _pushTimers[key]=setTimeout(async()=>{
    try{ await _supa.from('ej_data').upsert({user_id:_ejUser.id,key,value:rows},{onConflict:'user_id,key'}); }
    catch(e){ console.warn('Supabase push',e); }
  },600);
}
async function cloudPullAll(){
  if(!EJ_CLOUD || !_supa || !_ejUser) return;
  try{
    const {data}=await _supa.from('ej_data').select('key,value').eq('user_id',_ejUser.id);
    (data||[]).forEach(r=>{ try{ localStorage.setItem(MOD_PREFIX+r.key, JSON.stringify(r.value)); }catch(e){} });
    Object.keys(MODULES).forEach(name=>{ const m=MODULES[name]; m.rows=modLoad(m.key,m.defaults); renderModule(name); });
    if(typeof window.__reloadVentes==='function') window.__reloadVentes();
    if(typeof renderWorldMap==='function') renderWorldMap();
  }catch(e){ console.warn('Supabase pull',e); }
}
function ejFoot(txt){ const f=document.querySelector('.sidebar-foot'); if(f) f.innerHTML=txt; }
function ejSignOutBtn(){
  ejFoot(`<div style="margin-bottom:6px">🔒 ${_ejUser?_ejUser.email:''}</div><button id="ejSignOut" style="padding:6px 14px;border:1px solid rgba(31,42,68,.2);background:#fff;border-radius:999px;color:#5b6577;font-weight:700;cursor:pointer;font-size:.72rem">Se déconnecter</button>`);
  const b=document.getElementById('ejSignOut'); if(b) b.addEventListener('click',async()=>{ await _supa.auth.signOut(); location.reload(); });
}
function ejDevFoot(){
  ejFoot("🛠️ Mode dév · accès libre<br><a id='ejConnect' style='color:#b8860b;font-weight:700;cursor:pointer;font-size:.72rem'>Se connecter (sauvegarde cloud)</a>");
  const a=document.getElementById('ejConnect'); if(a) a.addEventListener('click',()=>ejShowAuth(true));
}
function ejShowAuth(closable){
  if(document.getElementById('ejAuth')) return;
  const o=document.createElement('div'); o.id='ejAuth';
  o.style.cssText='position:fixed;inset:0;z-index:5000;background:linear-gradient(160deg,#f7f3ec,#e9e1d2);display:flex;align-items:center;justify-content:center;padding:20px';
  o.innerHTML=`<div style="background:#fff;border-radius:26px;box-shadow:0 30px 70px rgba(31,42,68,.25);padding:34px 30px;max-width:380px;width:100%;text-align:center">
    <div style="font-family:'Parisienne',cursive;font-size:2.2rem;color:#1f2a44;margin-bottom:2px">Emmanuelle Jane</div>
    <div style="letter-spacing:.4em;font-size:.7rem;color:#b8860b;margin-bottom:22px;font-weight:700">PARIS · OUTIL DE GESTION</div>
    <input id="ejEmail" type="email" placeholder="Email" style="width:100%;padding:12px 16px;border:1px solid rgba(31,42,68,.18);border-radius:12px;margin-bottom:10px;font-size:.95rem">
    <input id="ejPwd" type="password" placeholder="Mot de passe" style="width:100%;padding:12px 16px;border:1px solid rgba(31,42,68,.18);border-radius:12px;margin-bottom:6px;font-size:.95rem">
    <div id="ejErr" style="color:#dc2626;font-size:.82rem;min-height:18px;margin-bottom:8px"></div>
    <button id="ejLogin" style="width:100%;padding:13px;background:#1f2a44;color:#e6c200;border:none;border-radius:999px;font-weight:800;font-size:.95rem;cursor:pointer;margin-bottom:10px">Se connecter</button>
    <button id="ejSignup" style="width:100%;padding:11px;background:#fff;color:#5b6577;border:1px solid rgba(31,42,68,.18);border-radius:999px;font-weight:700;font-size:.9rem;cursor:pointer">Créer un compte</button>
  </div>`;
  document.body.appendChild(o);
  if(closable){
    const c=document.createElement('div');
    c.innerHTML="<a style='display:inline-block;margin-top:14px;color:#8a93a3;font-size:.82rem;cursor:pointer'>← Continuer sans compte</a>";
    c.querySelector('a').addEventListener('click',()=>{ o.remove(); ejDevFoot(); });
    o.querySelector('div').appendChild(c);
  }
  const err=m=>{document.getElementById('ejErr').textContent=m;};
  const creds=()=>[document.getElementById('ejEmail').value.trim(), document.getElementById('ejPwd').value];
  document.getElementById('ejLogin').addEventListener('click',async()=>{
    const [email,password]=creds(); err('');
    const {data,error}=await _supa.auth.signInWithPassword({email,password});
    if(error) return err(error.message);
    _ejUser=data.user; o.remove(); await cloudPullAll(); ejSignOutBtn();
  });
  document.getElementById('ejSignup').addEventListener('click',async()=>{
    const [email,password]=creds(); err('');
    const {data,error}=await _supa.auth.signUp({email,password});
    if(error) return err(error.message);
    if(data.session){ _ejUser=data.user; o.remove(); await cloudPullAll(); ejSignOutBtn(); }
    else err('Compte créé. Vérifie tes emails pour confirmer, puis connecte-toi.');
  });
}
function ejInitCloud(){
  const s=document.createElement('script'); s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
  s.onload=async()=>{
    _supa=supabase.createClient(EJ_CONFIG.SUPABASE_URL, EJ_CONFIG.SUPABASE_ANON_KEY);
    const {data:{session}}=await _supa.auth.getSession();
    if(session){ _ejUser=session.user; await cloudPullAll(); ejSignOutBtn(); }
    else if(EJ_REQUIRE_AUTH) ejShowAuth(false);
    else ejDevFoot();
  };
  s.onerror=()=>ejFoot('⚠️ Cloud indisponible · mode local');
  document.head.appendChild(s);
}
if(EJ_CLOUD) ejInitCloud();
else ejFoot("📍 Mode local · données sur cet appareil<br><span style='font-size:.66rem;color:#b8a86a'>Branchez Supabase pour la sauvegarde en ligne</span>");

/* ===================== CARTE DU MONDE DES CLIENTS ===================== */
const COORD={
 'France':[2.2,46.2],'Angleterre':[-1.5,52.5],'Royaume-Uni':[-1.5,52.5],'Espagne':[-3.7,40.4],'Italie':[12.5,42.8],
 'Pays-Bas':[5.3,52.1],'Chypre':[33.4,35.1],'Malte':[14.4,35.9],'Lituanie':[23.9,55.2],
 'Russie':[37.6,55.7],'Azerbaïdjan':[47.6,40.4],'Irak':[43.7,33.2],'Arabie Saoudite':[45,23.9],
 'Qatar':[51.2,25.3],'Nigéria':[8.1,9.1],'Sénégal':[-14.5,14.5],'USA':[-98.5,39.8],
 'Émirats Arabes Unis':[54,24],'EAU':[54,24],'Liban':[35.8,33.9],'Maroc':[-6.8,31.8],'Koweït':[47.9,29.3],
 'Turquie':[35,39],'Allemagne':[10.4,51.1],'Belgique':[4.5,50.6],'Suisse':[8.2,46.8],'Canada':[-106,56]};
let _worldAtlas=null, _worldChart=null, mapMode='ca';
// Compte les points de vente B2B par pays (depuis le module Réseau B2B)
function b2bByCountry(){
  const m = MODULES['b2b']; const idx={};
  (m?m.rows:[]).forEach(r=>{ const c=(r.pays||'').trim(); if(!c) return;
    if(!idx[c]) idx[c]={count:0,ca:0,names:[]};
    idx[c].count++; idx[c].ca+=(+r.ca||0); if(r.nom) idx[c].names.push(r.nom); });
  return idx;
}
async function renderWorldMap(){
  const cv=document.getElementById('chartWorldMap');
  if(!cv || typeof ChartGeo==='undefined' || typeof getD!=='function') return;
  if(!_worldAtlas){
    try{ const t=await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json').then(r=>r.json());
      _worldAtlas=ChartGeo.topojson.feature(t,t.objects.countries).features; }
    catch(e){ cv.parentElement.innerHTML='<div style="text-align:center;color:#9aa1b0;padding-top:140px">Carte indisponible (hors-ligne)</div>'; return; }
  }
  const d=getD(); const b2b=b2bByCountry();
  const caByPays={}; (d.pays||[]).forEach(p=>caByPays[p.pays]=p);
  let pts, fill, stroke;
  if(mapMode==='pdv'){
    fill='rgba(31,42,68,.55)'; stroke='#1f2a44';
    pts=Object.keys(b2b).filter(c=>COORD[c]).map(c=>({x:COORD[c][0],y:COORD[c][1],value:b2b[c].count,
      name:c,pdv:b2b[c].count,names:b2b[c].names,ca:(caByPays[c]?caByPays[c].ca:0)}));
  } else {
    fill='rgba(184,134,11,.55)'; stroke='#b8860b';
    pts=(d.pays||[]).filter(p=>COORD[p.pays]).map(p=>({x:COORD[p.pays][0],y:COORD[p.pays][1],value:p.ca,
      name:p.pays,clients:p.clients,ca:p.ca,pdv:(b2b[p.pays]?b2b[p.pays].count:0)}));
  }
  if(_worldChart) _worldChart.destroy();
  _worldChart=new Chart(cv,{
    type:'bubbleMap',
    data:{labels:pts.map(p=>p.name),datasets:[{outline:_worldAtlas,showOutline:true,
      outlineBackgroundColor:'#ece5d6',outlineBorderColor:'#d8cfbd',outlineBorderWidth:.5,
      backgroundColor:fill,borderColor:stroke,borderWidth:1,data:pts}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},datalabels:{display:false},
        tooltip:{callbacks:{title:()=>'',label:c=>{const p=c.raw;
          return mapMode==='pdv'
            ? ` ${p.name} — ${p.pdv} point(s) de vente${p.ca?' · CA '+eMoney(p.ca):''}`
            : ` ${p.name} — ${eMoney(p.ca)} · ${p.clients} client(s) · ${p.pdv} pt(s) de vente`;}}}},
      scales:{projection:{axis:'x',projection:'equalEarth'},size:{axis:'x',size:[6,30],legend:{display:false}}}}
  });
}
renderWorldMap();
// Bascule CA / points de vente
document.querySelectorAll('.map-mode').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('.map-mode').forEach(x=>x.classList.remove('active'));
  b.classList.add('active'); mapMode=b.dataset.mode; renderWorldMap();
}));
// Rafraîchit la carte au changement d'année
document.querySelectorAll('.year-btn').forEach(b=>b.addEventListener('click',()=>setTimeout(renderWorldMap,60)));

// Rend les tableaux scrollables horizontalement sur petit écran (sans casser la page)
document.querySelectorAll('main table').forEach(t=>{
  const p = t.parentElement;
  if(p.classList.contains('table-wrap')) return;
  // les tableaux des modules sont déjà dans un conteneur scrollable
  if(p.style && p.style.overflowX === 'auto') return;
  const w = document.createElement('div');
  w.className = 'table-wrap';
  p.insertBefore(w, t);
  w.appendChild(t);
});
