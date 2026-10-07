let currentYear = 'total';
let charts = {};


const fmtMoney = n => n.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' €';
const fmtMoneyShort = n => Math.round(n).toLocaleString('fr-FR') + ' €';
const fmtNum = n => n.toLocaleString('fr-FR');
const fmtPct = n => n.toFixed(1) + ' %';
const collClass = c => {
  const map = {'VIP':'badge-vip','VIP BLACK':'badge-vipblack','ROYAL':'badge-royal','BRUMES':'badge-brumes','50ML':'badge-50ml','REMISE':'badge-remise'};
  return 'badge ' + (map[c] || 'badge-vip');
};

function getD(){ return ALL[currentYear]; }

function destroyChart(id){ if(charts[id]){ charts[id].destroy(); delete charts[id]; } }

Chart.defaults.color = '#1C1814';
Chart.defaults.borderColor = 'rgba(28,24,20,.1)';
Chart.defaults.font.family = "Montserrat, 'Helvetica Neue', Arial, sans-serif";
const PALETTE = ['#A87B12','#2F6FA8','#C0612A','#2E8B57','#9A4C8C','#00929F','#B8433F','#D2B266','#86A9C9','#DCA07A','#8CBF9F','#C79BBF','#7FC4CB','#D99490']; // charte catalogue : 7 teintes validées + 7 teintes claires

function renderKpis(){
  const d = getD();
  document.getElementById('kpi-ca').textContent = fmtMoney(d.kpi_ca);
  document.getElementById('kpi-btl').textContent = fmtNum(d.kpi_btl);
  document.getElementById('kpi-testers').textContent = fmtNum(d.kpi_testers);
  document.getElementById('kpi-factures').textContent = d.kpi_factures;
  document.getElementById('kpi-clients').textContent = d.kpi_clients;
  const royalCAEl = document.getElementById('royalCA');
  if(royalCAEl) royalCAEl.textContent = fmtMoney(d.kpi_ca_unknown);

  const beneficeProduitEl = document.getElementById('kpi-benefice-produit');
  if(beneficeProduitEl){
    let cadeauxItemsCost = 0;
    (d.factures||[]).forEach(f => {
      const bd = factureCadeauxBreakdown(f);
      bd.items.forEach(it => { if(it.cost !== null) cadeauxItemsCost += it.cost; });
    });
    const beneficeProduit = d.kpi_marge - cadeauxItemsCost;
    beneficeProduitEl.textContent = fmtMoneyShort(beneficeProduit);
    beneficeProduitEl.parentElement.classList.toggle('danger', beneficeProduit < 0);
    beneficeProduitEl.parentElement.classList.toggle('success', beneficeProduit >= 0);
  }

  const chargesFixesEl = document.getElementById('kpi-charges-fixes-mensuelles');
  if(chargesFixesEl){
    const fc = FIXED_CHARGES;
    const totalCharges = fc.charges.reduce((s,c) => s + c.amount, 0);
    const totalSalaires = fc.salaires.reduce((s,c) => s + c.amount, 0);
    chargesFixesEl.textContent = fmtMoneyShort(totalCharges + totalSalaires);
  }
}

function renderOverview(){
  const d = getD();
  destroyChart('chartCollections');
  charts.chartCollections = new Chart(document.getElementById('chartCollections'),{
    type:'doughnut',
    data:{labels:d.collections.map(c=>c.collection),datasets:[{data:d.collections.map(c=>c.ca),backgroundColor:PALETTE,borderWidth:2,borderColor:'#FCF6EE'}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{title:{display:true,text:'CA par Collection',font:{size:14},color:'#81620F'},legend:{position:'right'}}}
  });
  destroyChart('chartPays');
  charts.chartPays = new Chart(document.getElementById('chartPays'),{
    type:'doughnut',
    data:{labels:d.pays.map(p=>p.pays),datasets:[{data:d.pays.map(p=>p.ca),backgroundColor:PALETTE,borderWidth:2,borderColor:'#FCF6EE'}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{title:{display:true,text:'CA par Pays',font:{size:14},color:'#81620F'},legend:{position:'right'}}}
  });
  destroyChart('chartMois');
  charts.chartMois = new Chart(document.getElementById('chartMois'),{
    type:'bar',
    data:{labels:d.mois.map(m=>m.mois),datasets:[
      {label:'CA (€)',data:d.mois.map(m=>m.ca),backgroundColor:'#81620F',borderRadius:6},
      {label:'Bénéfice (€)',data:d.mois.map(m=>m.marge),backgroundColor:'#2E7D4F',borderRadius:6}
    ]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{title:{display:true,text:'CA & Bénéfice mensuel',font:{size:14},color:'#81620F'}},scales:{y:{ticks:{callback:v=>(v/1000).toFixed(0)+' k€'}}}}
  });
  // Podium
  const podium = document.getElementById('podium');
  podium.innerHTML = '';
  const top3 = d.clients.slice(0,3);
  const ranks = ['🥇','🥈','🥉'];
  const order = [1,0,2];
  const cls = ['silver','gold','bronze'];
  order.forEach((i,j)=>{
    if(top3[i]){
      const div = document.createElement('div');
      div.className = 'podium-step ' + cls[j];
      div.innerHTML = `<div class="podium-rank">${ranks[i]}</div><div class="podium-name">${top3[i].client}</div><div class="podium-amount">${fmtMoneyShort(top3[i].ca)}<br><small style="color:#2E7D4F">+${fmtMoneyShort(top3[i].marge)} bénéfice</small></div>`;
      podium.appendChild(div);
    }
  });
}

function renderClients(filter=''){
  const d = getD();
  const tb = document.querySelector('#table-clients tbody');
  tb.innerHTML = '';
  let filtered = d.clients;
  if(filter) filtered = filtered.filter(c => (c.client+' '+c.pays).toLowerCase().includes(filter.toLowerCase()));
  filtered.forEach((c,i)=>{
    const margePct = c.cout > 0 ? (c.marge/c.ca*100).toFixed(1) : 'N/A';
    const key = `${c.client}|${c.pays}`;
    tb.innerHTML += `<tr class="client-row" data-key="${key}"><td>${i+1}</td><td><strong>${c.client}</strong></td><td>${c.pays}</td><td class="text-right">${c.factures}</td><td class="text-right">${fmtNum(c.btl)}</td><td class="text-right amount">${fmtMoneyShort(c.ca)}</td><td class="text-right amount-negative">${fmtMoneyShort(c.cout)}</td><td class="text-right amount-positive">${fmtMoneyShort(c.marge)}</td><td class="text-right">${margePct}${typeof margePct==='string'&&margePct!=='N/A'?'%':margePct==='N/A'?'':'%'}</td></tr>`;
  });
  // Attach hover events
  document.querySelectorAll('#table-clients .client-row').forEach(tr => {
    tr.style.cursor = 'help';
    tr.addEventListener('mouseenter', e => showClientTooltip(tr.dataset.key, e));
    tr.addEventListener('mousemove', e => moveTooltip(e));
    tr.addEventListener('mouseleave', () => hideTooltip());
  });
}

// === TOOLTIP TOP 3 PRODUITS ===
function showClientTooltip(key, e){
  const d = getD();
  const top = d.client_top_products[key] || [];
  if(top.length === 0) return;
  const tt = document.getElementById('floatingTooltip');
  tt.innerHTML = `
    <div style="color:#81620F;font-weight:bold;margin-bottom:6px;font-size:.9rem">⭐ Top 3 produits</div>
    ${top.map((p, i) => `
      <div style="margin-bottom:6px;padding:6px;background:rgba(28,24,20,.05);border-radius:5px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-weight:bold">#${i+1} ${p.reference}</span>
          <span class="${collClass(p.collection)}" style="font-size:.7rem">${p.collection}</span>
        </div>
        <div style="color:#76695C;font-size:.75rem;margin-top:3px">${fmtNum(p.btl)} btl • ${fmtMoneyShort(p.ca)}</div>
      </div>
    `).join('')}
  `;
  tt.style.display = 'block';
  moveTooltip(e);
}
function moveTooltip(e){
  const tt = document.getElementById('floatingTooltip');
  let x = e.clientX + 15;
  let y = e.clientY + 15;
  if(x + 310 > window.innerWidth) x = e.clientX - 320;
  if(y + 300 > window.innerHeight) y = e.clientY - 300;
  tt.style.left = x + 'px';
  tt.style.top = y + 'px';
}
function hideTooltip(){
  document.getElementById('floatingTooltip').style.display = 'none';
}

function renderPays(){
  const d = getD();
  destroyChart('chartPaysCA');
  charts.chartPaysCA = new Chart(document.getElementById('chartPaysCA'),{
    type:'pie',
    data:{labels:d.pays.map(p=>p.pays),datasets:[{data:d.pays.map(p=>p.ca),backgroundColor:PALETTE,borderWidth:2,borderColor:'#FCF6EE'}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{title:{display:true,text:'CA par pays (agrégé)',color:'#81620F'},legend:{position:'bottom'}}}
  });
  destroyChart('chartPaysClientCA');
  charts.chartPaysClientCA = new Chart(document.getElementById('chartPaysClientCA'),{
    type:'pie',
    data:{labels:d.pays_client.map(p=>p.label),datasets:[{data:d.pays_client.map(p=>p.ca),backgroundColor:PALETTE,borderWidth:2,borderColor:'#FCF6EE'}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{title:{display:true,text:'CA par Pays × Client (2 irakiens séparés)',color:'#81620F'},legend:{position:'bottom'}}}
  });
  const tb = document.getElementById('tbody-pays-client');
  tb.innerHTML = '';
  d.pays_client.forEach((p,i)=>{
    tb.innerHTML += `<tr><td>${i+1}</td><td><strong>${p.pays}</strong></td><td>${p.client}</td><td class="text-right">${p.factures}</td><td class="text-right">${fmtNum(p.btl)}</td><td class="text-right amount">${fmtMoneyShort(p.ca)}</td><td class="text-right amount-negative">${fmtMoneyShort(p.cout)}</td><td class="text-right amount-positive">${fmtMoneyShort(p.marge)}</td></tr>`;
  });
}

function renderMois(){
  const d = getD();
  destroyChart('chartMoisCA');
  charts.chartMoisCA = new Chart(document.getElementById('chartMoisCA'),{
    type:'line',
    data:{labels:d.mois.map(m=>m.mois),datasets:[
      {label:'CA (€)',data:d.mois.map(m=>m.ca),borderColor:'#81620F',backgroundColor:'rgba(129,98,15,.2)',fill:true,tension:.3,pointRadius:5,pointBackgroundColor:'#81620F'},
      {label:'Bénéfice (€)',data:d.mois.map(m=>m.marge),borderColor:'#2E7D4F',backgroundColor:'rgba(46,125,79,.15)',fill:true,tension:.3,pointRadius:5,pointBackgroundColor:'#2E7D4F'}
    ]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{title:{display:true,text:'Évolution mensuelle (CA + Bénéfice)',color:'#81620F'}},scales:{y:{ticks:{callback:v=>(v/1000).toFixed(0)+' k€'}}}}
  });
  destroyChart('chartMoisMarge');
  charts.chartMoisMarge = new Chart(document.getElementById('chartMoisMarge'),{
    type:'bar',
    data:{labels:d.mois.map(m=>m.mois),datasets:[{label:'Bouteilles',data:d.mois.map(m=>m.btl),backgroundColor:'#2F6FA8',borderRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{title:{display:true,text:'Bouteilles vendues par mois',color:'#81620F'},legend:{display:false}}}
  });
  const tb = document.getElementById('tbody-mois');
  tb.innerHTML = '';
  d.mois.forEach(m=>{
    const isZero = m.ca===0;
    tb.innerHTML += `<tr style="${isZero?'opacity:.45':''}"><td><strong>${m.mois}</strong></td><td class="text-right">${m.factures}</td><td class="text-right">${fmtNum(m.btl)}</td><td class="text-right amount">${fmtMoneyShort(m.ca)}</td><td class="text-right amount-negative">${fmtMoneyShort(m.cout)}</td><td class="text-right amount-positive">${fmtMoneyShort(m.marge)}</td></tr>`;
  });
}

function renderRefs(){
  const d = getD();
  const top15 = d.refs.slice(0,15);
  destroyChart('chartTopRefs');
  charts.chartTopRefs = new Chart(document.getElementById('chartTopRefs'),{
    type:'bar',
    data:{labels:top15.map(r=>r.reference),datasets:[{label:'Bouteilles vendues',data:top15.map(r=>r.btl),backgroundColor:'#81620F',borderRadius:4}]},
    options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{title:{display:true,text:'Top 15 références (par bouteilles vendues)',font:{size:14},color:'#81620F'},legend:{display:false}}}
  });
  filterRefs();
}

function filterRefs(){
  const d = getD();
  const filterText = document.getElementById('search-ref').value.toLowerCase();
  const filterColl = document.getElementById('filter-collection').value;
  const tb = document.querySelector('#table-refs tbody');
  tb.innerHTML = '';
  let filtered = d.refs;
  if(filterText) filtered = filtered.filter(r => r.reference.toLowerCase().includes(filterText));
  if(filterColl) filtered = filtered.filter(r => r.collection===filterColl);
  // Trier par collection puis par bouteilles vendues
  const COLL_ORDER = ['VIP', 'VIP BLACK', 'ROYAL', 'BRUMES', '50ML'];
  filtered.sort((a, b) => {
    const ca = COLL_ORDER.indexOf(a.collection);
    const cb = COLL_ORDER.indexOf(b.collection);
    if(ca !== cb) return ca - cb;
    return b.btl - a.btl;
  });
  // Grouper par collection
  let currentColl = null;
  let collTotalCA = 0, collTotalBtl = 0, collTotalCout = 0, collTotalMarge = 0, collCount = 0;
  filtered.forEach((r, i) => {
    if(currentColl !== r.collection){
      // Insérer le total de la collection précédente si applicable
      if(currentColl !== null){
        tb.innerHTML += `<tr style="background:rgba(129,98,15,.10);font-weight:bold"><td colspan="3"><em>↳ Sous-total ${currentColl} (${collCount} réf.)</em></td><td></td><td class="text-right">${fmtNum(collTotalBtl)}</td><td class="text-right amount">${fmtMoneyShort(collTotalCA)}</td><td class="text-right amount-negative">${fmtMoneyShort(collTotalCout)}</td><td class="text-right amount-positive">${fmtMoneyShort(collTotalMarge)}</td></tr>`;
      }
      // En-tête de la nouvelle collection
      tb.innerHTML += `<tr style="background:#1C1814"><td colspan="8" style="padding:10px 12px;color:#81620F;font-weight:bold;font-size:.95rem;text-transform:uppercase;letter-spacing:.5px"><span class="${collClass(r.collection)}" style="margin-right:8px">${r.collection}</span></td></tr>`;
      currentColl = r.collection;
      collTotalCA = 0; collTotalBtl = 0; collTotalCout = 0; collTotalMarge = 0; collCount = 0;
    }
    const beneficeDisplay = r.cost_known ? fmtMoneyShort(r.marge) : '—';
    const coutDisplay = r.cost_known ? fmtMoneyShort(r.cout) : '—';
    tb.innerHTML += `<tr><td>${i+1}</td><td><span class="${collClass(r.collection)}">${r.collection}</span></td><td><strong>${r.reference}</strong></td><td class="text-right">${fmtNum(r.cartons)}</td><td class="text-right">${fmtNum(r.btl)}</td><td class="text-right amount">${fmtMoneyShort(r.ca)}</td><td class="text-right amount-negative">${coutDisplay}</td><td class="text-right amount-positive">${beneficeDisplay}</td></tr>`;
    collTotalCA += r.ca;
    collTotalBtl += r.btl;
    collTotalCout += r.cost_known ? r.cout : 0;
    collTotalMarge += r.cost_known ? r.marge : 0;
    collCount += 1;
  });
  // Total de la dernière collection
  if(currentColl !== null){
    tb.innerHTML += `<tr style="background:rgba(129,98,15,.10);font-weight:bold"><td colspan="3"><em>↳ Sous-total ${currentColl} (${collCount} réf.)</em></td><td></td><td class="text-right">${fmtNum(collTotalBtl)}</td><td class="text-right amount">${fmtMoneyShort(collTotalCA)}</td><td class="text-right amount-negative">${fmtMoneyShort(collTotalCout)}</td><td class="text-right amount-positive">${fmtMoneyShort(collTotalMarge)}</td></tr>`;
  }
}

function renderFactures(filter=''){
  const d = getD();
  const tb = document.querySelector('#table-fact tbody');
  tb.innerHTML = '';
  let filtered = d.factures;
  if(filter) filtered = filtered.filter(f => (f.facture+' '+f.client+' '+f.pays).toLowerCase().includes(filter.toLowerCase()));
  filtered.forEach(f=>{
    tb.innerHTML += `<tr class="clickable" data-facture="${f.facture}"><td><strong>${f.facture}</strong></td><td>${f.date}</td><td>${f.client}</td><td>${f.pays}</td><td class="text-right">${fmtNum(f.btl)}</td><td class="text-right amount">${fmtMoneyShort(f.ca)}</td><td class="text-right amount-negative">${fmtMoneyShort(f.cout)}</td><td class="text-right amount-positive">${fmtMoneyShort(f.marge)}</td></tr>`;
  });
}

// Modal pour facture
function openFactureModal(factureId){
  const d = getD();
  const f = d.factures.find(x => x.facture === factureId);
  if(!f) return;
  document.getElementById('modalTitle').textContent = `Facture ${f.facture}`;
  document.getElementById('modalMeta').innerHTML = `<strong>${f.client}</strong> — ${f.pays}<br>Date : ${f.date}`;
  document.getElementById('modalSummary').innerHTML = `
    <div class="modal-stat"><div class="modal-stat-label">CA</div><div class="modal-stat-value">${fmtMoney(f.ca)}</div></div>
    <div class="modal-stat"><div class="modal-stat-label">Coût</div><div class="modal-stat-value" style="color:#B8433F">${fmtMoney(f.cout)}</div></div>
    <div class="modal-stat"><div class="modal-stat-label">Bénéfice</div><div class="modal-stat-value" style="color:#2E7D4F">${fmtMoney(f.marge)}</div></div>
    <div class="modal-stat"><div class="modal-stat-label">Bouteilles</div><div class="modal-stat-value">${fmtNum(f.btl)}</div></div>
  `;
  const tb = document.getElementById('modalLines');
  tb.innerHTML = '';
  f.lines.forEach(l=>{
    tb.innerHTML += `<tr><td><span class="${collClass(l.collection)}">${l.collection}</span></td><td>${l.reference}</td><td>${l.mode}</td><td class="text-right">${fmtNum(l.cartons)}</td><td class="text-right">${fmtNum(l.btl)}</td><td class="text-right">${l.testers}</td><td class="text-right">${fmtMoney(l.prix)}</td><td class="text-right amount">${fmtMoneyShort(l.ca)}</td><td class="text-right amount-negative">${fmtMoneyShort(l.cout)}</td><td class="text-right amount-positive">${fmtMoneyShort(l.marge)}</td></tr>`;
  });
  const cadeauxWrap = document.getElementById('modalCadeauxWrap');
  const cadeauxTb = document.getElementById('modalCadeaux');
  const bd = factureCadeauxBreakdown(f);
  let cadeauxRows = '';
  bd.items.forEach(it => {
    const costCell = it.cost !== null ? `<span style="color:#B8433F;font-weight:600">${fmtMoney(it.cost)}</span>` : '<span style="color:#76695C">—</span>';
    cadeauxRows += `<tr><td>${it.article}</td><td class="text-right">${fmtNum(it.quantite)}</td><td class="text-right">${costCell}</td></tr>`;
  });
  bd.testers.forEach(t => {
    const costCell = t.allKnown ? `<span style="color:#B8433F;font-weight:600">${fmtMoney(t.cost)}</span>` : `<span style="color:#B8433F;font-weight:600">≥ ${fmtMoney(t.cost)}</span>`;
    cadeauxRows += `<tr><td>🧪 Testeurs ${t.collection}</td><td class="text-right">${fmtNum(t.qty)}</td><td class="text-right">${costCell}</td></tr>`;
  });
  if(cadeauxRows){
    const totalLabel = bd.totalKnown ? fmtMoney(bd.totalCost) : `≥ ${fmtMoney(bd.totalCost)}`;
    cadeauxRows += `<tr style="font-weight:bold;border-top:2px solid #81620F"><td colspan="2">TOTAL — ce que ça t'a coûté</td><td class="text-right" style="color:#B8433F">${totalLabel}</td></tr>`;
    cadeauxTb.innerHTML = cadeauxRows;
    cadeauxWrap.style.display = '';
  } else {
    cadeauxTb.innerHTML = '';
    cadeauxWrap.style.display = 'none';
  }
  document.getElementById('modalOverlay').classList.add('active');
}
function closeModal(){ document.getElementById('modalOverlay').classList.remove('active'); }
document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('modalOverlay').addEventListener('click', e => { if(e.target.id === 'modalOverlay') closeModal(); });

// ========= CADEAUX OFFERTS =========
// Prix de revient unitaire par type de cadeau (2026-07-20, Mounir)
// - Sacs noirs : 0,38€ fabrication + 0,21€ transport (transport exceptionnel, à revérifier)
// - Paquets de mouillettes : 22€/paquet
// - Catalogues : 1,8€ (provisoire, susceptible de changer)
// - Échantillons 2ml : 0,3761€ (calcul jus Velours Rose VIP BLACK appliqué à toutes les réf., écart jugé négligeable par Mounir)
const CADEAUX_UNIT_COST = {
  'Sacs noirs': 0.59,
  'Paquets de mouillettes': 22,
  'Catalogues': 1.8,
  'Échantillons 2ml': 0.3761
};
function cadeauxLineCost(c){
  const rate = CADEAUX_UNIT_COST[c.article];
  return rate !== undefined ? rate * c.quantite : null;
}
// Cadeaux (sacs/mouillettes/catalogues/2ml) + testeurs offerts d'une facture, avec coûts.
// Fonction partagée : utilisée par la modale facture ET par l'onglet Cadeaux offerts (2026-07-22).
function factureCadeauxBreakdown(f){
  const items = (f.cadeaux||[]).map(c => ({article: c.article, quantite: c.quantite, cost: cadeauxLineCost(c)}));
  const testersByColl = {};
  (f.lines||[]).forEach(l => {
    if(!l.testers) return;
    if(!testersByColl[l.collection]) testersByColl[l.collection] = {collection: l.collection, qty:0, cost:0, allKnown:true};
    testersByColl[l.collection].qty += l.testers;
    const cRefs = ALL.costs[l.collection] && ALL.costs[l.collection].refs;
    const ref = cRefs && cRefs.find(r => r.name === l.reference);
    if(ref && ref.cost_per_bottle_fabrication !== undefined){
      testersByColl[l.collection].cost += ref.cost_per_bottle_fabrication * l.testers;
    } else {
      testersByColl[l.collection].allKnown = false;
    }
  });
  const testers = Object.values(testersByColl);
  let totalCost = 0, totalKnown = true;
  items.forEach(it => { if(it.cost !== null) totalCost += it.cost; else totalKnown = false; });
  testers.forEach(t => { totalCost += t.cost; if(!t.allKnown) totalKnown = false; });
  return {items, testers, totalCost, totalKnown};
}

const CADEAUX_ORDER = ['Sacs noirs','Paquets de mouillettes','Catalogues','Échantillons 2ml'];
const CADEAUX_ICONS = {'Sacs noirs':'👜','Paquets de mouillettes':'🧴','Catalogues':'📖','Échantillons 2ml':'💧'};

function renderCadeaux(filter=''){
  const d = getD();
  const withGifts = d.factures.map(f => ({f, bd: factureCadeauxBreakdown(f)})).filter(x => x.bd.items.length || x.bd.testers.length);

  const totals = {};
  withGifts.forEach(({bd}) => bd.items.forEach(it => { totals[it.article] = (totals[it.article]||0) + it.quantite; }));
  const testerTotals = {};
  withGifts.forEach(({bd}) => bd.testers.forEach(t => {
    if(!testerTotals[t.collection]) testerTotals[t.collection] = {qty:0, cost:0};
    testerTotals[t.collection].qty += t.qty;
    testerTotals[t.collection].cost += t.cost;
  }));
  const totalCost = withGifts.reduce((s,{bd}) => s + bd.totalCost, 0);
  const totalTesters = Object.values(testerTotals).reduce((s,t) => s+t.qty, 0);
  const totalTestersCost = Object.values(testerTotals).reduce((s,t) => s+t.cost, 0);

  let kpiHtml = `<div class="kpi danger"><div class="kpi-label">💰 Coût total cadeaux (≈)</div><div class="kpi-value big">${fmtMoney(totalCost)}</div></div>`;
  CADEAUX_ORDER.forEach(article => {
    if(totals[article] === undefined) return;
    const rate = CADEAUX_UNIT_COST[article];
    const sub = rate !== undefined ? `<br><span style="font-size:.78rem;color:#76695C">≈ ${fmtMoney(totals[article]*rate)}</span>` : '';
    kpiHtml += `<div class="kpi"><div class="kpi-label">${CADEAUX_ICONS[article]||'🎁'} ${article}</div><div class="kpi-value big">${fmtNum(totals[article])}${sub}</div></div>`;
  });
  if(totalTesters > 0){
    kpiHtml += `<div class="kpi"><div class="kpi-label">🧪 Testeurs offerts</div><div class="kpi-value big">${fmtNum(totalTesters)}<br><span style="font-size:.78rem;color:#76695C">≈ ${fmtMoney(totalTestersCost)}</span></div></div>`;
  }
  kpiHtml += `<div class="kpi"><div class="kpi-label">📄 Factures avec cadeaux</div><div class="kpi-value">${withGifts.length}</div></div>`;
  document.getElementById('cadeauxKpis').innerHTML = kpiHtml;

  let filtered = withGifts;
  if(filter) filtered = filtered.filter(({f}) => (f.facture+' '+f.client+' '+f.pays).toLowerCase().includes(filter.toLowerCase()));
  const tb = document.querySelector('#table-cadeaux tbody');
  tb.innerHTML = '';
  filtered.forEach(({f,bd}) => {
    const parts = bd.items.map(it => `${fmtNum(it.quantite)} ${it.article}`);
    bd.testers.forEach(t => parts.push(`${fmtNum(t.qty)} testeurs ${t.collection}`));
    tb.innerHTML += `<tr class="clickable" data-facture="${f.facture}"><td><strong>${f.facture}</strong></td><td>${f.date}</td><td>${f.client}</td><td>${f.pays}</td><td>${parts.join(', ')}</td><td class="text-right amount-negative">${fmtMoney(bd.totalCost)}</td></tr>`;
  });
  if(filtered.length===0){
    tb.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#76695C">Aucun cadeau trouvé.</td></tr>';
  } else {
    const filteredCost = filtered.reduce((s,{bd}) => s + bd.totalCost, 0);
    tb.innerHTML += `<tr style="font-weight:bold;border-top:2px solid #81620F"><td colspan="5">TOTAL${filter?' (filtré)':''}</td><td class="text-right amount-negative">${fmtMoney(filteredCost)}</td></tr>`;
  }
  tb.querySelectorAll('tr[data-facture]').forEach(tr => tr.addEventListener('click', () => openFactureModal(tr.dataset.facture)));

  const clientFilterEl = document.getElementById('search-cadeaux-client');
  renderCadeauxClientList(clientFilterEl ? clientFilterEl.value : '');
  renderCadeauxClientsChart();
}

// ===== Cadeaux cumulés par client =====
function computeCadeauxByClient(d){
  const map = {};
  d.factures.forEach(f => {
    const key = f.client+'|'+f.pays;
    if(!map[key]) map[key] = {client:f.client, pays:f.pays, btl:0, ca:0, factures:0, items:{}, testers:{}, totalCost:0};
    const m = map[key];
    m.btl += f.btl;
    m.ca += f.ca;
    m.factures += 1;
    const bd = factureCadeauxBreakdown(f);
    bd.items.forEach(it => {
      if(!m.items[it.article]) m.items[it.article] = {quantite:0, cost:0};
      m.items[it.article].quantite += it.quantite;
      if(it.cost !== null) m.items[it.article].cost += it.cost;
    });
    bd.testers.forEach(t => {
      if(!m.testers[t.collection]) m.testers[t.collection] = {qty:0, cost:0};
      m.testers[t.collection].qty += t.qty;
      m.testers[t.collection].cost += t.cost;
    });
    m.totalCost += bd.totalCost;
  });
  return Object.values(map);
}

let selectedCadeauxClient = null;
function renderCadeauxClientList(filter=''){
  const d = getD();
  const data = computeCadeauxByClient(d).filter(c => c.totalCost > 0).sort((a,b) => b.totalCost - a.totalCost);
  if(selectedCadeauxClient){
    selectedCadeauxClient = data.find(c => c.client===selectedCadeauxClient.client && c.pays===selectedCadeauxClient.pays) || null;
  }
  const list = document.getElementById('cadeauxClientList');
  if(!list) return;
  list.innerHTML = '';
  let filtered = data;
  if(filter) filtered = filtered.filter(c => (c.client+' '+c.pays).toLowerCase().includes(filter.toLowerCase()));
  filtered.forEach(c => {
    const isSelected = selectedCadeauxClient && selectedCadeauxClient.client === c.client && selectedCadeauxClient.pays === c.pays;
    const btn = document.createElement('div');
    btn.style.cssText = `padding:10px 12px;margin-bottom:6px;background:${isSelected?'rgba(129,98,15,.25)':'rgba(28,24,20,.05)'};border-radius:6px;cursor:pointer;border-left:3px solid ${isSelected?'#81620F':'transparent'};transition:all .15s`;
    btn.innerHTML = `<div style="font-weight:600;color:#81620F;font-size:.92rem">${c.client}</div><div style="color:#76695C;font-size:.78rem;margin-top:2px">${c.pays} • ${c.factures} fact. • <span style="color:#B8433F">${fmtMoney(c.totalCost)}</span> de cadeaux</div>`;
    btn.addEventListener('click', () => {
      selectedCadeauxClient = c;
      renderCadeauxClientList(document.getElementById('search-cadeaux-client').value);
      renderCadeauxClientDetail();
    });
    list.appendChild(btn);
  });
  renderCadeauxClientDetail();
}

function renderCadeauxClientDetail(){
  const header = document.getElementById('cadeauxClientHeader');
  const tbody = document.querySelector('#tableCadeauxClient tbody');
  if(!header || !tbody) return;
  if(!selectedCadeauxClient){
    header.innerHTML = '<div style="color:#76695C;font-size:.9rem">Sélectionne un client à gauche pour voir le détail de ses cadeaux</div>';
    tbody.innerHTML = '';
    return;
  }
  const c = selectedCadeauxClient;
  header.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:10px">
      <div>
        <div style="color:#81620F;font-size:1.2rem;font-weight:bold">${c.client}</div>
        <div style="color:#76695C;font-size:.9rem">${c.pays} • ${c.factures} commande(s) • ${fmtMoney(c.ca)} de CA</div>
      </div>
      <div style="text-align:right">
        <div style="color:#76695C;font-size:.78rem">Coût total cadeaux offerts</div>
        <div style="color:#B8433F;font-size:1.4rem;font-weight:bold">${fmtMoney(c.totalCost)}</div>
      </div>
    </div>
  `;
  let rows = '';
  CADEAUX_ORDER.forEach(article => {
    const it = c.items[article];
    if(!it) return;
    rows += `<tr><td>${CADEAUX_ICONS[article]||'🎁'} ${article}</td><td class="text-right">${fmtNum(it.quantite)}</td><td class="text-right" style="color:#B8433F;font-weight:600">${fmtMoney(it.cost)}</td></tr>`;
  });
  Object.keys(c.testers).forEach(coll => {
    const t = c.testers[coll];
    rows += `<tr><td>🧪 Testeurs ${coll}</td><td class="text-right">${fmtNum(t.qty)}</td><td class="text-right" style="color:#B8433F;font-weight:600">${fmtMoney(t.cost)}</td></tr>`;
  });
  rows += `<tr style="font-weight:bold;border-top:2px solid #81620F"><td colspan="2">TOTAL</td><td class="text-right" style="color:#B8433F">${fmtMoney(c.totalCost)}</td></tr>`;
  tbody.innerHTML = rows;
}

// ===== Graphique : bouteilles commandées vs valeur des cadeaux offerts, par client =====
function renderCadeauxClientsChart(){
  const d = getD();
  const data = computeCadeauxByClient(d).filter(c => c.totalCost > 0).sort((a,b) => b.totalCost - a.totalCost);
  const top = data.slice(0, 15);
  destroyChart('chartCadeauxClients');
  const canvas = document.getElementById('chartCadeauxClients');
  if(!canvas) return;
  charts.chartCadeauxClients = new Chart(canvas, {
    data: {
      labels: top.map(c => c.client),
      datasets: [
        {type:'bar', label:'Chiffre d\'affaires (€)', data: top.map(c=>c.ca), backgroundColor:'#9A4C8C', borderRadius:5, yAxisID:'y'},
        {type:'line', label:'Cadeaux offerts (€)', data: top.map(c=>c.totalCost), borderColor:'#B8433F', backgroundColor:'#B8433F', yAxisID:'y1', tension:.3, pointRadius:4, pointBackgroundColor:'#B8433F'}
      ]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ labels:{ color:'#1C1814' } } },
      scales:{
        x:{ ticks:{ color:'#76695C', font:{size:10} }, grid:{ display:false } },
        y:{ position:'left', ticks:{ color:'#76695C' }, grid:{ color:'rgba(28,24,20,.08)' }, title:{display:true,text:'Chiffre d\'affaires (€)',color:'#76695C'} },
        y1:{ position:'right', ticks:{ color:'#B8433F' }, grid:{ display:false }, title:{display:true,text:'Cadeaux offerts (€)',color:'#B8433F'} }
      }
    }
  });
}

// Compare
function renderCompare(){
  const d25 = ALL['2025'];
  const d26 = ALL['2026'];
  const compareKpis = document.getElementById('compareKpis');
  compareKpis.innerHTML = `
    <div class="kpi"><div class="kpi-label">CA 2025</div><div class="kpi-value">${fmtMoneyShort(d25.kpi_ca)}</div></div>
    <div class="kpi"><div class="kpi-label">CA 2026</div><div class="kpi-value">${fmtMoneyShort(d26.kpi_ca)}</div></div>
    <div class="kpi success"><div class="kpi-label">Bénéfice 2025</div><div class="kpi-value">${fmtMoneyShort(d25.kpi_marge)}</div></div>
    <div class="kpi success"><div class="kpi-label">Bénéfice 2026</div><div class="kpi-value">${fmtMoneyShort(d26.kpi_marge)}</div></div>
  `;
  destroyChart('chartCompareCA');
  charts.chartCompareCA = new Chart(document.getElementById('chartCompareCA'),{
    type:'bar',
    data:{labels:['CA','Coût','Bénéfice'],datasets:[
      {label:'2025',data:[d25.kpi_ca,d25.kpi_cout,d25.kpi_marge],backgroundColor:'#2F6FA8',borderRadius:6},
      {label:'2026',data:[d26.kpi_ca,d26.kpi_cout,d26.kpi_marge],backgroundColor:'#81620F',borderRadius:6}
    ]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{title:{display:true,text:'Comparaison 2025 vs 2026',color:'#81620F'}},scales:{y:{ticks:{callback:v=>(v/1000).toFixed(0)+' k€'}}}}
  });
  destroyChart('chartCompareMarge');
  charts.chartCompareMarge = new Chart(document.getElementById('chartCompareMarge'),{
    type:'doughnut',
    data:{labels:['CA 2025','CA 2026'],datasets:[{data:[d25.kpi_ca,d26.kpi_ca],backgroundColor:['#2F6FA8','#81620F'],borderWidth:2,borderColor:'#FCF6EE'}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{title:{display:true,text:'Part de chaque année',color:'#81620F'},legend:{position:'bottom'}}}
  });
  destroyChart('chartCompareMois');
  charts.chartCompareMois = new Chart(document.getElementById('chartCompareMois'),{
    type:'line',
    data:{labels:d25.mois.map(m=>m.mois),datasets:[
      {label:'CA 2025',data:d25.mois.map(m=>m.ca),borderColor:'#2F6FA8',backgroundColor:'rgba(47,111,168,.2)',fill:false,tension:.3,pointRadius:5},
      {label:'CA 2026',data:d26.mois.map(m=>m.ca),borderColor:'#81620F',backgroundColor:'rgba(129,98,15,.2)',fill:false,tension:.3,pointRadius:5}
    ]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{title:{display:true,text:'CA mensuel — 2025 vs 2026',color:'#81620F'}},scales:{y:{ticks:{callback:v=>(v/1000).toFixed(0)+' k€'}}}}
  });
  // Tableau comparatif
  const evol = (a,b) => {
    if(a === 0) return b > 0 ? '🆕' : '—';
    return `${b>a?'📈 +':'📉 '}${((b-a)/a*100).toFixed(1)}%`;
  };
  const rows = [
    ['Chiffre d\'affaires', d25.kpi_ca, d26.kpi_ca],
    ['Coût production', d25.kpi_cout, d26.kpi_cout],
    ['Bénéfice net', d25.kpi_marge, d26.kpi_marge],
    ['Bouteilles vendues', d25.kpi_btl, d26.kpi_btl],
    ['Testers offerts', d25.kpi_testers, d26.kpi_testers],
    ['Factures', d25.kpi_factures, d26.kpi_factures],
    ['Clients', d25.kpi_clients, d26.kpi_clients],
    ['Pays', d25.kpi_pays, d26.kpi_pays],
  ];
  const tb = document.getElementById('tbody-compare');
  tb.innerHTML = '';
  rows.forEach(r => {
    const isMoney = ['Chiffre d\'affaires','Coût production','Bénéfice net'].includes(r[0]);
    const v25 = isMoney ? fmtMoneyShort(r[1]) : fmtNum(r[1]);
    const v26 = isMoney ? fmtMoneyShort(r[2]) : fmtNum(r[2]);
    tb.innerHTML += `<tr><td><strong>${r[0]}</strong></td><td class="text-right">${v25}</td><td class="text-right">${v26}</td><td class="text-right">${evol(r[1],r[2])}</td></tr>`;
  });
}

// === ÉVOLUTION CLIENTS ===
let selectedEvoClient = null;

function renderEvolutionList(filter=''){
  const d = getD();
  const list = document.getElementById('evoClientList');
  list.innerHTML = '';
  let clients = [...d.clients].sort((a,b) => b.ca - a.ca);
  if(filter) clients = clients.filter(c => (c.client+' '+c.pays).toLowerCase().includes(filter.toLowerCase()));
  clients.forEach(c => {
    // Compute trend for this client
    const factures = d.factures.filter(f => f.client === c.client && f.pays === c.pays)
                                .sort((a,b)=>{
                                  const pa = a.date.split('/').reverse().join('-');
                                  const pb = b.date.split('/').reverse().join('-');
                                  return pa.localeCompare(pb);
                                });
    let trendIcon = '—';
    if(factures.length >= 2){
      const first = factures[0].ca;
      const last = factures[factures.length-1].ca;
      if(last > first * 1.1) trendIcon = '📈';
      else if(last < first * 0.9) trendIcon = '📉';
      else trendIcon = '➡️';
    } else if(factures.length === 1){
      trendIcon = '🆕';
    }
    const isSelected = selectedEvoClient && selectedEvoClient.client === c.client && selectedEvoClient.pays === c.pays;
    const btn = document.createElement('div');
    btn.style.cssText = `padding:10px 12px;margin-bottom:6px;background:${isSelected?'rgba(129,98,15,.25)':'rgba(28,24,20,.05)'};border-radius:6px;cursor:pointer;border-left:3px solid ${isSelected?'#81620F':'transparent'};transition:all .15s`;
    btn.innerHTML = `<div style="font-weight:600;color:#81620F;font-size:.92rem">${trendIcon} ${c.client}</div><div style="color:#76695C;font-size:.78rem;margin-top:2px">${c.pays} • ${factures.length} fact. • ${fmtMoneyShort(c.ca)}</div>`;
    btn.addEventListener('click', () => {
      selectedEvoClient = c;
      renderEvolutionList(document.getElementById('search-evo-client').value);
      renderEvolutionChart();
    });
    list.appendChild(btn);
  });
}

function renderEvolutionChart(){
  if(!selectedEvoClient){
    document.getElementById('evoSelectedHeader').innerHTML = '<div style="color:#76695C;font-size:.9rem">Sélectionne un client à gauche pour voir son évolution</div>';
    destroyChart('chartEvoClient');
    document.querySelector('#tableEvoClient tbody').innerHTML = '';
    return;
  }
  const d = getD();
  const c = selectedEvoClient;
  const factures = d.factures.filter(f => f.client === c.client && f.pays === c.pays)
                              .sort((a,b)=>{
                                const pa = a.date.split('/').reverse().join('-');
                                const pb = b.date.split('/').reverse().join('-');
                                return pa.localeCompare(pb);
                              });

  // Tendance globale
  let trendText = 'pas assez de données';
  let trendColor = '#76695C';
  let trendIcon = '➡️';
  if(factures.length >= 2){
    const first = factures[0].ca;
    const last = factures[factures.length-1].ca;
    const evol = ((last - first) / first * 100);
    if(evol > 10){ trendText = `+${evol.toFixed(1)}% entre 1ère et dernière commande`; trendColor = '#2E7D4F'; trendIcon = '📈'; }
    else if(evol < -10){ trendText = `${evol.toFixed(1)}% entre 1ère et dernière commande`; trendColor = '#B8433F'; trendIcon = '📉'; }
    else { trendText = `${evol>=0?'+':''}${evol.toFixed(1)}% (stable)`; trendIcon = '➡️'; }
  } else if(factures.length === 1){
    trendText = 'Première commande — pas d\'historique';
    trendIcon = '🆕';
  }

  // CA moyen, total
  const totalCA = factures.reduce((s,f) => s+f.ca, 0);
  const totalMarge = factures.reduce((s,f) => s+f.marge, 0);
  const avgCA = totalCA / factures.length;

  document.getElementById('evoSelectedHeader').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:10px">
      <div>
        <div style="color:#81620F;font-size:1.2rem;font-weight:bold">${c.client}</div>
        <div style="color:#76695C;font-size:.9rem">${c.pays} • ${factures.length} commande(s)</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:1.6rem">${trendIcon}</div>
        <div style="color:${trendColor};font-size:.9rem;font-weight:600">${trendText}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-top:12px">
      <div><div style="color:#76695C;font-size:.75rem">CA Total</div><div style="color:#81620F;font-weight:bold">${fmtMoneyShort(totalCA)}</div></div>
      <div><div style="color:#76695C;font-size:.75rem">Bénéfice</div><div style="color:#2E7D4F;font-weight:bold">${fmtMoneyShort(totalMarge)}</div></div>
      <div><div style="color:#76695C;font-size:.75rem">CA moyen / commande</div><div style="color:#81620F;font-weight:bold">${fmtMoneyShort(avgCA)}</div></div>
    </div>
  `;

  destroyChart('chartEvoClient');
  charts.chartEvoClient = new Chart(document.getElementById('chartEvoClient'),{
    type:'line',
    data:{
      labels:factures.map(f=>f.date),
      datasets:[
        {label:'CA par commande (€)',data:factures.map(f=>f.ca),borderColor:'#81620F',backgroundColor:'rgba(129,98,15,.2)',fill:true,tension:.25,pointRadius:7,pointHoverRadius:10,pointBackgroundColor:'#81620F'},
        {label:'Bénéfice net (€)',data:factures.map(f=>f.marge),borderColor:'#2E7D4F',backgroundColor:'rgba(46,125,79,.15)',fill:false,tension:.25,pointRadius:5,pointBackgroundColor:'#2E7D4F',borderDash:[5,5]}
      ]
    },
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{title:{display:true,text:`Évolution des commandes — ${c.client}`,color:'#81620F',font:{size:14}},legend:{position:'top'}},
      scales:{y:{ticks:{callback:v=>(v/1000).toFixed(1)+' k€'}}}
    }
  });

  // Tableau
  const tb = document.querySelector('#tableEvoClient tbody');
  tb.innerHTML = '';
  factures.forEach((f, i) => {
    let variation = '—';
    let varColor = '#76695C';
    if(i > 0){
      const prev = factures[i-1].ca;
      const ev = ((f.ca - prev) / prev * 100);
      if(ev > 0) { variation = `📈 +${ev.toFixed(1)}%`; varColor = '#2E7D4F'; }
      else if(ev < 0) { variation = `📉 ${ev.toFixed(1)}%`; varColor = '#B8433F'; }
      else variation = '➡️ 0%';
    }
    tb.innerHTML += `<tr class="clickable" data-facture="${f.facture}"><td>${f.date}</td><td><strong>${f.facture}</strong></td><td class="text-right">${fmtNum(f.btl)}</td><td class="text-right amount">${fmtMoneyShort(f.ca)}</td><td class="text-right amount-positive">${fmtMoneyShort(f.marge)}</td><td class="text-right" style="color:${varColor};font-weight:600">${variation}</td></tr>`;
  });
}

// === PRIX DE REVIENT — CADEAUX OFFERTS (2026-10-03) ===
// ANCIEN prix de revient = celui utilisé partout dans le dashboard (CADEAUX_UNIT_COST, factures, bénéfice).
// NOUVEAU prix de revient = affiché uniquement ici, pour comparaison (demande Mounir 2026-10-03) :
//   sacs fabrication 0,67 (transport 0,21 inchangé), sérigraphie 2ml transparent 0,19 / black 0,25,
//   box 2ml 0,98 (cadeau séparé), reste du 2ml inchangé. Pour les factures : moyenne transparent/black.
const CADEAUX_COST_DETAIL = {
  'Sacs noirs': [['Fabrication', 0.38, 0.67], ['Transport (inchangé)', 0.21, 0.21]],
  'Paquets de mouillettes': [['Prix du paquet (nouveau : 250 mouillettes × 0,149 €)', 22, 37.25]],
  'Catalogues': [['Prix unitaire', 1.8, 2.75]],
  'Box 2ml': [['Prix de la box', null, 0.98]]
};
// 2ml : [élément, ancien, nouveau transparent, nouveau black]
const CADEAUX_2ML_DETAIL = [
  ['Jus (25 % × 2 ml × 133 €/kg — base Velours Rose)', 0.0665, 0.0665, 0.0665],
  ['Remplissage / conditionnement', 0.126, 0.126, 0.126],
  ['Flacon + sérigraphie', 0.06, 0.19, 0.25],
  ['Capot + pompe', 0.08, 0.08, 0.08],
  ['Transport', 0.027, 0.027, 0.027],
  ['Livraison usine / douane', 0.0166, 0.0166, 0.0166]
];
const sumCol = (rows, i) => rows.reduce((s,r) => s + (r[i]||0), 0);
const CADEAUX_2ML_NEW_TRANSP = sumCol(CADEAUX_2ML_DETAIL, 2);
const CADEAUX_2ML_NEW_BLACK  = sumCol(CADEAUX_2ML_DETAIL, 3);
const CADEAUX_UNIT_COST_NEW = {
  'Sacs noirs': sumCol(CADEAUX_COST_DETAIL['Sacs noirs'], 2),
  'Paquets de mouillettes': 37.25,
  'Catalogues': 2.75,
  'Échantillons 2ml': (CADEAUX_2ML_NEW_TRANSP + CADEAUX_2ML_NEW_BLACK) / 2,
  'Box 2ml': 0.98
};
function renderCostsCadeaux(out){
  const d = getD();
  const yr = currentYear === 'total' ? '2025 + 2026' : currentYear;
  const e4 = v => (v === null || v === undefined) ? '—' : v.toFixed(4) + ' €';
  const NEWC = '#2F6FA8';
  const qty = {}; const testers = {};
  d.factures.forEach(f => {
    const bd = factureCadeauxBreakdown(f);
    bd.items.forEach(it => { qty[it.article] = (qty[it.article]||0) + it.quantite; });
    bd.testers.forEach(t => {
      if(!testers[t.collection]) testers[t.collection] = {qty:0, cost:0};
      testers[t.collection].qty += t.qty; testers[t.collection].cost += t.cost;
    });
  });
  let html = `
    <div class="info-box">🎁 Prix de revient des cadeaux offerts aux clients. <strong>Ancien</strong> = prix utilisés actuellement dans les factures et le bénéfice. <strong style="color:${NEWC}">Nouveau</strong> = nouveaux prix, affichés ici pour comparaison seulement. Période : <strong>${yr}</strong>.</div>
    <h3 style="color:#81620F;margin-bottom:10px">🧾 Prix de revient unitaire par cadeau</h3>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:14px;margin-bottom:14px">`;
  ['Sacs noirs','Paquets de mouillettes','Catalogues','Box 2ml'].forEach(art => {
    const det = CADEAUX_COST_DETAIL[art];
    const oldU = CADEAUX_UNIT_COST[art];
    const newU = CADEAUX_UNIT_COST_NEW[art];
    const icon = art === 'Box 2ml' ? '📦' : (CADEAUX_ICONS[art]||'');
    html += `<div><table>
      <thead><tr><th>${icon} ${art}</th><th class="text-right">Ancien</th><th class="text-right">Nouveau</th></tr></thead>
      <tbody>
        ${det.map(([n,o,nv]) => `<tr><td>${n}</td><td class="text-right amount" style="white-space:nowrap">${e4(o)}</td><td class="text-right" style="white-space:nowrap;color:${NEWC};font-weight:600">${e4(nv)}</td></tr>`).join('')}
        <tr style="background:rgba(129,98,15,.12);font-weight:bold"><td><strong>Prix de revient / unité</strong></td><td class="text-right amount" style="white-space:nowrap">${e4(oldU)}</td><td class="text-right" style="white-space:nowrap;color:${NEWC}">${e4(newU)}</td></tr>
      </tbody></table></div>`;
  });
  html += `</div>`;
  // Détail 2ml : ancien / nouveau transparent / nouveau black
  html += `<table style="margin-bottom:22px">
      <thead><tr><th>💧 Échantillons 2ml</th><th class="text-right">Ancien</th><th class="text-right">Nouveau — transparent</th><th class="text-right">Nouveau — black</th></tr></thead>
      <tbody>
        ${CADEAUX_2ML_DETAIL.map(([n,o,t,b]) => `<tr><td>${n}</td><td class="text-right amount" style="white-space:nowrap">${e4(o)}</td><td class="text-right" style="white-space:nowrap;color:${NEWC};font-weight:600">${e4(t)}</td><td class="text-right" style="white-space:nowrap;color:${NEWC};font-weight:600">${e4(b)}</td></tr>`).join('')}
        <tr style="background:rgba(129,98,15,.12);font-weight:bold"><td><strong>Prix de revient / unité</strong></td><td class="text-right amount">${e4(CADEAUX_UNIT_COST['Échantillons 2ml'])}</td><td class="text-right" style="color:${NEWC}">${e4(CADEAUX_2ML_NEW_TRANSP)}</td><td class="text-right" style="color:${NEWC}">${e4(CADEAUX_2ML_NEW_BLACK)}</td></tr>
        <tr><td colspan="2" style="color:#76695C;font-size:.85rem">Moyenne nouveau (transparent + black) — utilisée pour le calcul des factures ci-dessous</td><td colspan="2" class="text-right" style="color:${NEWC};font-weight:bold">${e4(CADEAUX_UNIT_COST_NEW['Échantillons 2ml'])}</td></tr>
      </tbody></table>`;
  // Quantités offertes + coût ancien vs nouveau
  let totOld = 0, totNew = 0, rows = '';
  [...CADEAUX_ORDER, 'Box 2ml'].forEach(art => {
    const q = qty[art] || 0;
    if(art === 'Box 2ml' && !q) return;
    const uo = CADEAUX_UNIT_COST[art], un = CADEAUX_UNIT_COST_NEW[art];
    const co = uo !== undefined ? q*uo : 0, cn = q*un;
    totOld += co; totNew += cn;
    const icon = art === 'Box 2ml' ? '📦' : (CADEAUX_ICONS[art]||'');
    rows += `<tr><td>${icon} <strong>${art}</strong></td><td class="text-right">${fmtNum(q)}</td><td class="text-right" style="white-space:nowrap">${e4(uo)}</td><td class="text-right amount-negative" style="font-weight:bold">${fmtMoney(co)}</td><td class="text-right" style="white-space:nowrap;color:${NEWC}">${e4(un)}</td><td class="text-right" style="font-weight:bold;color:${NEWC}">${fmtMoney(cn)}</td></tr>`;
  });
  const giftsOld = totOld, giftsNew = totNew;
  Object.keys(testers).sort().forEach(coll => {
    const t = testers[coll]; totOld += t.cost; totNew += t.cost;
    const avg = t.qty ? (t.cost/t.qty).toFixed(4)+' € (moy.)' : '—';
    rows += `<tr><td>🧪 <strong>Testeurs ${coll}</strong></td><td class="text-right">${fmtNum(t.qty)}</td><td class="text-right" style="color:#76695C;font-size:.85rem">${avg}</td><td class="text-right amount-negative" style="font-weight:bold">${fmtMoney(t.cost)}</td><td class="text-right" style="color:#76695C;font-size:.85rem">inchangé</td><td class="text-right" style="font-weight:bold;color:${NEWC}">${fmtMoney(t.cost)}</td></tr>`;
  });
  const diff = totNew - totOld;
  html += `
    <h3 style="color:#81620F;margin-bottom:10px">📦 Cadeaux offerts sur la période (${yr}) — ancien vs nouveau</h3>
    <table>
      <thead><tr><th>Cadeau</th><th class="text-right">Quantité</th><th class="text-right">PR ancien</th><th class="text-right">Coût ancien</th><th class="text-right">PR nouveau</th><th class="text-right">Coût nouveau</th></tr></thead>
      <tbody>${rows}
        <tr style="background:rgba(129,98,15,.12);font-weight:bold"><td colspan="3"><strong>TOTAL — ce que les cadeaux t'ont coûté</strong></td><td class="text-right amount-negative" style="font-size:1.05rem">${fmtMoney(totOld)}</td><td></td><td class="text-right" style="font-size:1.05rem;color:${NEWC}">${fmtMoney(totNew)}</td></tr>
      </tbody>
    </table>
    ${qty['Box 2ml'] ? '' : `<div style="color:#76695C;font-size:.82rem;margin-top:6px">📦 Box 2ml (0,98 €) : aucune box enregistrée dans les factures pour l'instant — elle sera comptée dès qu'une facture en contiendra (article « Box 2ml »).</div>`}
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-top:18px">
      <div class="kpi danger"><div class="kpi-label">Cadeaux (hors testeurs) — ancien</div><div class="kpi-value">${fmtMoney(giftsOld)}</div></div>
      <div class="kpi"><div class="kpi-label">Cadeaux (hors testeurs) — nouveau</div><div class="kpi-value" style="color:${NEWC}">${fmtMoney(giftsNew)}</div></div>
      <div class="kpi danger"><div class="kpi-label">Total avec testeurs — ancien</div><div class="kpi-value">${fmtMoney(totOld)}</div></div>
      <div class="kpi"><div class="kpi-label">Total avec testeurs — nouveau</div><div class="kpi-value" style="color:${NEWC}">${fmtMoney(totNew)}</div></div>
      <div class="kpi ${diff>0?'danger':'success'}"><div class="kpi-label">Écart nouveau − ancien</div><div class="kpi-value">${diff>0?'+':''}${fmtMoney(diff)}</div></div>
    </div>`;
  out.innerHTML = html;
}
// === PRIX DE REVIENT ===
function renderCosts(){
  const collName = document.getElementById('costCollSelect').value;
  const c = ALL.costs[collName];
  const out = document.getElementById('costDetails');
  if(collName === 'CADEAUX'){ renderCostsCadeaux(out); return; }
  if(c.not_yet){
    out.innerHTML = `
      <div class="warning-box">
        ⚠️ <strong>Prix de revient ${collName} pas encore renseignés.</strong><br>
        <span style="font-size:.88rem;color:#A33A35">Les coûts de production pour cette collection seront ajoutés ultérieurement. Aucune marge n'est donc calculable pour le moment sur les ROYAL.</span>
      </div>
      <div class="info-box">
        Pour mémoire : un carton ROYAL standard contient ${c.carton_size} bouteilles (${c.tester_info}) et se vend ${fmtMoney(c.standard_price_carton)} (${fmtMoney(c.standard_price_bottle)}/bouteille).
      </div>
    `;
    return;
  }
  if(c.provisional){
    const margeCarton = c.standard_price_carton - (c.total_fixed * c.units_total_per_carton);
    const margePct = (margeCarton / c.standard_price_carton * 100).toFixed(1);
    out.innerHTML = `
      <div class="info-box" style="background:rgba(47,111,168,.12);border-left:4px solid #2F6FA8">
        ℹ️ <strong>Prix de revient provisoire : ${c.total_fixed.toFixed(2)} €/bouteille</strong><br>
        <span style="font-size:.88rem;color:#76695C">À affiner avec le détail réel des composants, concentrés et production. En attendant, les marges affichées sont basées sur ce coût forfaitaire.</span>
      </div>
      <div style="background:rgba(129,98,15,.08);border-left:4px solid #81620F;padding:14px;border-radius:6px;margin:18px 0">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px">
          <div><div style="color:#76695C;font-size:.75rem">Bouteilles / carton</div><div style="color:#81620F;font-weight:bold">${c.carton_size}</div></div>
          <div><div style="color:#76695C;font-size:.75rem">Système</div><div style="color:#81620F;font-weight:bold">${c.tester_info}</div></div>
          <div><div style="color:#76695C;font-size:.75rem">Prix vente carton</div><div style="color:#81620F;font-weight:bold">${fmtMoney(c.standard_price_carton)}</div></div>
          <div><div style="color:#76695C;font-size:.75rem">Prix vente bouteille</div><div style="color:#81620F;font-weight:bold">${fmtMoney(c.standard_price_bottle)}</div></div>
        </div>
      </div>
      <div style="background:rgba(46,125,79,.12);border:1px solid #2E7D4F;padding:18px;border-radius:8px;margin-bottom:18px;text-align:center">
        <div style="color:#2E7D4F;font-size:.95rem;text-transform:uppercase;letter-spacing:.8px;font-weight:600">💎 Marge par carton (estimée)</div>
        <div style="font-size:2.1rem;color:#2E7D4F;font-weight:bold;margin-top:6px">${fmtMoney(margeCarton)} (${margePct}%)</div>
        <div style="color:#2E7D4F;font-size:.85rem;margin-top:6px">Vente ${fmtMoney(c.standard_price_carton)} − Coût ${fmtMoney(c.total_fixed * c.units_total_per_carton)} (${c.units_total_per_carton} btl × ${c.total_fixed}€, testeur inclus)</div>
      </div>
      <h3 style="color:#81620F;margin-bottom:10px">📋 Références ${collName}</h3>
      <table>
        <thead><tr><th>Référence</th><th class="text-right">Coût/btl</th><th class="text-right">Coût/carton (+ tester)</th><th class="text-right">Marge/carton</th></tr></thead>
        <tbody>
          ${c.refs.map(r => `<tr><td><strong>${r.name}</strong></td><td class="text-right amount">${r.cost_per_bottle.toFixed(2)} €</td><td class="text-right amount">${r.cost_per_carton_sold.toFixed(2)} €</td><td class="text-right amount-positive">${r.margin_per_carton.toFixed(2)} € (${r.margin_pct}%)</td></tr>`).join('')}
        </tbody>
      </table>
    `;
    return;
  }
  let html = '';
  // En-tête
  html += `
    <div style="background:rgba(129,98,15,.08);border-left:4px solid #81620F;padding:14px;border-radius:6px;margin-bottom:18px">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px">
        <div><div style="color:#76695C;font-size:.75rem">Volume bouteille</div><div style="color:#81620F;font-weight:bold">${c.volume_ml} ml</div></div>
        <div><div style="color:#76695C;font-size:.75rem">Bouteilles / carton</div><div style="color:#81620F;font-weight:bold">${c.carton_size}</div></div>
        <div><div style="color:#76695C;font-size:.75rem">Système</div><div style="color:#81620F;font-weight:bold">${c.tester_info}</div></div>
        <div><div style="color:#76695C;font-size:.75rem">Prix vente carton</div><div style="color:#81620F;font-weight:bold">${fmtMoney(c.standard_price_carton)}</div></div>
        <div><div style="color:#76695C;font-size:.75rem">Prix vente bouteille</div><div style="color:#81620F;font-weight:bold">${fmtMoney(c.standard_price_bottle)}</div></div>
      </div>
    </div>
  `;

  // Composants physiques
  html += `
    <div class="grid-2" style="margin-bottom:18px">
      <div>
        <h3 style="color:#81620F;margin-bottom:10px">🧱 Composants physiques</h3>
        <table>
          <thead><tr><th>Élément</th><th class="text-right">Prix d'origine</th><th class="text-right">En EUR</th></tr></thead>
          <tbody>
            ${c.components.map(comp => `<tr><td>${comp.name}</td><td class="text-right" style="color:#76695C;font-size:.85rem">${comp.price_orig}</td><td class="text-right amount">${comp.price_eur.toFixed(4)} €</td></tr>`).join('')}
            <tr style="background:rgba(129,98,15,.12);font-weight:bold"><td colspan="2"><strong>TOTAL composants</strong></td><td class="text-right amount" style="font-size:1rem">${c.total_components.toFixed(4)} €</td></tr>
          </tbody>
        </table>
      </div>
      <div>
        <h3 style="color:#81620F;margin-bottom:10px">⚙️ Main-d'œuvre / Production</h3>
        <table>
          <thead><tr><th>Étape</th><th class="text-right">Détail</th><th class="text-right">Coût €</th></tr></thead>
          <tbody>
            ${c.production.map(p => `<tr><td>${p.name}</td><td class="text-right" style="color:#76695C;font-size:.85rem">${p.detail}</td><td class="text-right amount">${p.price_eur.toFixed(4)} €</td></tr>`).join('')}
            <tr style="background:rgba(129,98,15,.12);font-weight:bold"><td colspan="2"><strong>TOTAL production</strong></td><td class="text-right amount" style="font-size:1rem">${c.total_production.toFixed(4)} €</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Coût moyen complet (avec concentré)
  const avg_conc_cost = c.refs.reduce((s, r) => s + r.cost_conc, 0) / c.refs.length;
  const avg_fab_cost = c.total_fixed + avg_conc_cost;
  const avg_total_cost = c.refs.reduce((s, r) => s + r.cost_per_bottle, 0) / c.refs.length;
  const min_total = Math.min(...c.refs.map(r => r.cost_per_bottle));
  const max_total = Math.max(...c.refs.map(r => r.cost_per_bottle));
  html += `
    <div style="background:rgba(46,125,79,.12);border:1px solid #2E7D4F;padding:18px;border-radius:8px;margin-bottom:18px;text-align:center">
      <div style="color:#2E7D4F;font-size:.95rem;text-transform:uppercase;letter-spacing:.8px;font-weight:600">💎 Prix de revient par bouteille vendue (testeur${c.transport_eur ? ' + transport' : ''} inclus)</div>
      <div style="font-size:2.1rem;color:#2E7D4F;font-weight:bold;margin-top:6px">${avg_total_cost.toFixed(4)} €</div>
      <div style="color:#2E7D4F;font-size:.85rem;margin-top:6px">Coût moyen — varie de <strong>${min_total.toFixed(2)} €</strong> à <strong>${max_total.toFixed(2)} €</strong> selon la référence</div>
      <div style="color:#76695C;font-size:.75rem;margin-top:8px">Fabrication : ${avg_fab_cost.toFixed(4)} € (composants+production+concentré) × ${c.tester_ratio.toFixed(3)} (testeur offert amorti sur les btl vendues)${c.transport_eur ? ` + ${c.transport_eur.toFixed(2)} € transport/btl` : ''}</div>
    </div>
  `;

  // Concentré + Coût total + Marge
  const refs_sorted = [...c.refs].sort((a,b) => a.cost_per_bottle - b.cost_per_bottle);
  html += `
    <h3 style="color:#81620F;margin-bottom:10px">💎 Concentré + Coût total par référence</h3>
    <table>
      <thead>
        <tr>
          <th>#</th><th>Référence</th>
          <th class="text-right">Concentr.</th>
          <th class="text-right">kg/1000</th>
          <th class="text-right">Prix kg</th>
          <th class="text-right">Coût concentré /btl</th>
          <th class="text-right">Prix revient /btl vendue</th>
          <th class="text-right">Coût d'1 carton vendu</th>
          <th class="text-right">Marge brute /carton</th>
          <th class="text-right">% Marge</th>
        </tr>
      </thead>
      <tbody>
        ${refs_sorted.map((r, i) => `
          <tr>
            <td>${i+1}</td>
            <td><strong>${r.name}</strong></td>
            <td class="text-right">${r.conc}</td>
            <td class="text-right">${r.kg} kg</td>
            <td class="text-right">${r.price_kg.toFixed(2)} €</td>
            <td class="text-right amount">${r.cost_conc.toFixed(4)} €</td>
            <td class="text-right amount-negative" style="font-weight:bold">${r.cost_per_bottle.toFixed(4)} €</td>
            <td class="text-right amount-negative" style="font-weight:bold">${r.cost_per_carton_sold.toFixed(2)} €</td>
            <td class="text-right amount-positive" style="font-weight:bold">${r.margin_per_carton.toFixed(2)} €</td>
            <td class="text-right" style="color:${r.margin_pct >= 60 ? '#2E7D4F' : r.margin_pct >= 50 ? '#81620F' : '#B8433F'};font-weight:bold">${r.margin_pct} %</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  // Synthèse
  const avg_cost = c.refs.reduce((s, r) => s + r.cost_per_bottle, 0) / c.refs.length;
  const avg_margin_pct = c.refs.reduce((s, r) => s + r.margin_pct, 0) / c.refs.length;
  const cheapest = refs_sorted[0];
  const expensive = refs_sorted[refs_sorted.length - 1];
  html += `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-top:18px">
      <div class="kpi"><div class="kpi-label">Coût moyen / bouteille</div><div class="kpi-value">${avg_cost.toFixed(2)} €</div></div>
      <div class="kpi success"><div class="kpi-label">Marge moyenne</div><div class="kpi-value">${avg_margin_pct.toFixed(1)} %</div></div>
      <div class="kpi"><div class="kpi-label">⭐ Moins cher</div><div class="kpi-value" style="font-size:1rem">${cheapest.name}<br><span style="font-size:.85rem;color:#2E7D4F">${cheapest.cost_per_bottle.toFixed(2)} €</span></div></div>
      <div class="kpi"><div class="kpi-label">⭐ Plus cher</div><div class="kpi-value" style="font-size:1rem">${expensive.name}<br><span style="font-size:.85rem;color:#B8433F">${expensive.cost_per_bottle.toFixed(2)} €</span></div></div>
    </div>
  `;

  out.innerHTML = html;
}

document.getElementById('costCollSelect').addEventListener('change', renderCosts);

// === STOCK ===
function renderStock(){
  const stock = ALL.stock;
  const refDate = ALL.stock_ref_date;
  document.getElementById('stockRefDateInfo').textContent = refDate;

  const COLL_ORDER = ['VIP', 'VIP BLACK', 'ROYAL', '50ML', 'BRUMES'];
  const statusColors = {
    epuise: {bg:'rgba(28,24,20,.08)', border:'#000', text:'⚫ Épuisé', color:'#76695C'},
    critical: {bg:'rgba(184,67,63,.15)', border:'#B8433F', text:'🔴 Critique', color:'#B8433F'},
    low: {bg:'rgba(183,121,31,.12)', border:'#B7791F', text:'🟠 Faible', color:'#B7791F'},
    medium: {bg:'rgba(129,98,15,.10)', border:'#81620F', text:'🟡 Moyen', color:'#81620F'},
    ok: {bg:'rgba(46,125,79,.10)', border:'#2E7D4F', text:'🟢 OK', color:'#2E7D4F'},
  };

  // KPI globaux
  let totalQty = 0, totalCAPot = 0, totalBenefPot = 0, totalCritique = 0, totalEpuise = 0;
  COLL_ORDER.forEach(coll => {
    if(!stock[coll]) return;
    totalQty += stock[coll].total_qty;
    totalCAPot += stock[coll].total_ca_pot;
    totalBenefPot += stock[coll].total_benef_pot;
    stock[coll].items.forEach(it => {
      if(it.status === 'critical') totalCritique++;
      if(it.status === 'epuise') totalEpuise++;
    });
  });

  document.getElementById('stockGlobalKpis').innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:18px">
      <div class="kpi"><div class="kpi-label">Total bouteilles en stock</div><div class="kpi-value big">${fmtNum(totalQty)}</div></div>
      <div class="kpi"><div class="kpi-label">💰 CA potentiel (si tout vendu)</div><div class="kpi-value">${fmtMoneyShort(totalCAPot)}</div></div>
      <div class="kpi success"><div class="kpi-label">📈 Bénéfice potentiel*</div><div class="kpi-value">${fmtMoneyShort(totalBenefPot)}</div></div>
      <div class="kpi danger"><div class="kpi-label">Réf. critiques</div><div class="kpi-value">${totalCritique}</div></div>
      <div class="kpi danger"><div class="kpi-label">Réf. épuisées</div><div class="kpi-value">${totalEpuise}</div></div>
    </div>
    <div style="color:#76695C;font-size:.78rem;margin-bottom:14px">*Bénéfice calculé hors ROYAL (coût non renseigné). CA potentiel calculé au prix de vente unitaire standard (VIP 16€, VIP BLACK 18€, ROYAL 9€, 50ML 13€, BRUMES 4€).</div>
  `;

  let html = '';
  COLL_ORDER.forEach(coll => {
    if(!stock[coll]) return;
    const s = stock[coll];
    const benefDisplay = s.has_cost ? fmtMoneyShort(s.total_benef_pot) : '—';
    html += `
      <div style="background:rgba(28,24,20,.04);border-radius:8px;padding:18px;margin-bottom:18px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;margin-bottom:14px">
          <h3 style="color:#81620F"><span class="${collClass(coll)}">${coll}</span></h3>
          <div style="color:#76695C;font-size:.95rem">
            <strong style="color:#81620F">${fmtNum(s.total_qty)}</strong> btl •
            CA : <strong style="color:#81620F">${fmtMoneyShort(s.total_ca_pot)}</strong> •
            Bénéfice : <strong style="color:#2E7D4F">${benefDisplay}</strong>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th><th>Référence</th>
              <th class="text-right">Stock (btl)</th>
              <th class="text-right">Prix vente/btl</th>
              <th class="text-right">CA potentiel</th>
              <th class="text-right">Bénéfice potentiel</th>
              <th class="text-center">Statut</th>
            </tr>
          </thead>
          <tbody>
            ${s.items.map((it, i) => {
              const sc = statusColors[it.status];
              const benefDisp = s.has_cost ? fmtMoney(it.benef_pot) : '—';
              return `
                <tr style="background:${sc.bg}">
                  <td>${i+1}</td>
                  <td><strong>${it.reference}</strong></td>
                  <td class="text-right" style="font-weight:bold;color:${sc.color};font-size:1.05rem">${fmtNum(it.qty)}</td>
                  <td class="text-right">${fmtMoney(it.prix_btl)}</td>
                  <td class="text-right amount">${fmtMoney(it.ca_pot)}</td>
                  <td class="text-right amount-positive">${benefDisp}</td>
                  <td class="text-center" style="color:${sc.color};font-weight:600">${sc.text}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  });
  document.getElementById('stockContent').innerHTML = html;
}

// === PLANIFICATION DE PRODUCTION ===
const PROD_COMPONENTS_PRICES = {
  // VIP
  'VIP_pompe_argent': 0.26,
  'VIP_etiquette_flacon': 0.09 * 0.92,   // $ → €
  'VIP_etiquette_etui': 0.09 * 0.92,
  'VIP_etiquette_fond': 0.08 * 0.92,
  'VIP_sleeve': 0.0595,
  'VIP_carton_size': 10,
  'VIP_carton_unit': 0.69,
  'VIP_flacon': 1.05 * 0.92,
  'VIP_capot_frette': 0.75 * 0.92,
  'VIP_etui': 1.05 * 0.92,
  'VIP_maceration_per_l': 2.72,
  'VIP_conditionnement': 0.439,
  'VIP_coupe_pompe': 0.045,
  'VIP_deballage': 0.024,
  'VIP_volume_ml': 90,
  // VIP BLACK
  'VIPBLACK_pompe_noir': 0.27,
  'VIPBLACK_etiquette_flacon': 0.09 * 0.92,
  'VIPBLACK_etiquette_etui': 0.09 * 0.92,
  'VIPBLACK_etiquette_fond': 0.036 * 0.92,
  'VIPBLACK_sleeve': 0.045,
  'VIPBLACK_carton_size': 10,
  'VIPBLACK_carton_unit': 0.69,
  'VIPBLACK_flacon': 0.41 * 0.92,
  'VIPBLACK_capot_frette': 0.75 * 0.92,
  'VIPBLACK_etui': 1.68 * 0.92,
  'VIPBLACK_maceration_per_l': 2.42,
  'VIPBLACK_conditionnement': 0.68,
  'VIPBLACK_coupe_pompe': 0.045,
  'VIPBLACK_deballage': 0.024,
  'VIPBLACK_volume_ml': 90,
  // 50ML
  '50ML_pompe_noir': 0.27,
  '50ML_etiquette_flacon': 0.09 * 0.92,
  '50ML_etiquette_etui': 0.10 * 0.92,
  '50ML_etiquette_fond': 0.036 * 0.92,
  '50ML_sleeve': 0.042,
  '50ML_carton_size': 12,
  '50ML_carton_unit': 0.71,
  '50ML_flacon': 0.34 * 0.92,
  '50ML_capot_frette': 0.75 * 0.92,
  '50ML_etui': 1.40 * 0.92,
  '50ML_maceration_per_l': 2.42,
  '50ML_conditionnement': 0.68,
  '50ML_coupe_pompe': 0.045,
  '50ML_deballage': 0.024,
  '50ML_volume_ml': 50,
  // BRUMES
  'BRUMES_flacon': 0.34 * 0.92,
  'BRUMES_pompe': 0.07 * 0.92,
  'BRUMES_capot': 0.16 * 0.92,
  'BRUMES_frette': 0.05 * 0.92,
  'BRUMES_carton_size': 24,
  'BRUMES_carton_unit': 0.86,
  'BRUMES_croisillons_unit': 0.85,
  'BRUMES_maceration_per_l': 1.72,
  'BRUMES_conditionnement': 0.36,
  'BRUMES_deballage': 0.024,
  'BRUMES_volume_ml': 250,
};

let productionData = {}; // { 'VIP|Pure': 1000, ... }
const PROD_STORAGE_KEY = 'productionData_v1';

function loadProductionData(){
  try {
    const saved = localStorage.getItem(PROD_STORAGE_KEY);
    if(saved) productionData = JSON.parse(saved);
  } catch(e){}
}

function saveProductionData(){
  try {
    localStorage.setItem(PROD_STORAGE_KEY, JSON.stringify(productionData));
    alert('✅ Tes quantités de production ont été sauvegardées dans ce navigateur.');
  } catch(e){
    alert('Impossible de sauvegarder.');
  }
}

function renderProduction(){
  const costs = ALL.costs;
  const COLL_ORDER = ['VIP', 'VIP BLACK', '50ML', 'BRUMES'];
  const stock = ALL.stock;

  let html = '';
  COLL_ORDER.forEach(coll => {
    const c = costs[coll];
    if(!c || c.not_yet) return;
    html += `<div style="background:rgba(28,24,20,.04);border-radius:8px;padding:18px;margin-bottom:16px">
      <h3 style="color:#81620F;margin-bottom:10px"><span class="${collClass(coll)}">${coll}</span> <span style="color:#76695C;font-size:.85rem;font-weight:normal">(${c.volume_ml}ml • prix vente btl : ${c.standard_price_bottle}€)</span></h3>
      <table>
        <thead><tr><th>Référence</th><th class="text-right">Stock actuel</th><th class="text-right">Quantité à produire</th><th class="text-right">Concentré nécessaire</th><th class="text-right">Coût estimé</th><th class="text-right">CA si vendu</th></tr></thead>
        <tbody>`;
    c.refs.forEach(r => {
      const key = `${coll}|${r.name}`;
      const qty = productionData[key] || 0;
      const stockItem = (stock[coll]?.items || []).find(x => x.reference === r.name);
      const stockQty = stockItem ? stockItem.qty : 0;
      const concKg = (qty * c.volume_ml * parseFloat(r.conc.replace('%','').replace(',','.')) / 100 / 1000).toFixed(2);
      const concEur = (concKg * r.price_kg).toFixed(2);
      const totalCost = (qty * r.cost_per_bottle).toFixed(2);
      const caPot = (qty * c.standard_price_bottle).toFixed(2);
      html += `<tr>
        <td><strong>${r.name}</strong></td>
        <td class="text-right">${fmtNum(stockQty)}</td>
        <td class="text-right"><input type="number" min="0" step="100" value="${qty}" data-prod-key="${key}" style="width:90px;padding:6px 10px;background:rgba(28,24,20,.08);border:1px solid rgba(28,24,20,.2);border-radius:6px;color:#1C1814;text-align:right;font-size:.95rem"></td>
        <td class="text-right">${qty > 0 ? `<strong style="color:#81620F">${concKg} kg</strong><br><span style="color:#76695C;font-size:.78rem">${concEur} €</span>` : '—'}</td>
        <td class="text-right amount-negative">${qty > 0 ? fmtMoneyShort(totalCost) : '—'}</td>
        <td class="text-right amount">${qty > 0 ? fmtMoneyShort(caPot) : '—'}</td>
      </tr>`;
    });
    html += '</tbody></table></div>';
  });
  document.getElementById('prodInputs').innerHTML = html;

  // Attach input handlers
  document.querySelectorAll('input[data-prod-key]').forEach(input => {
    input.addEventListener('input', e => {
      const k = e.target.dataset.prodKey;
      const v = parseInt(e.target.value) || 0;
      if(v > 0) productionData[k] = v;
      else delete productionData[k];
      updateProductionNeeds();
    });
  });
  updateProductionNeeds();
}

function updateProductionNeeds(){
  const costs = ALL.costs;
  const P = PROD_COMPONENTS_PRICES;
  // Agrégat par collection
  const byColl = {};
  Object.keys(productionData).forEach(key => {
    const [coll, ref] = key.split('|');
    const qty = productionData[key];
    if(!byColl[coll]) byColl[coll] = {total_btl:0, refs:{}, total_cost:0, total_ca:0, total_conc_kg:{}};
    byColl[coll].total_btl += qty;
    byColl[coll].refs[ref] = qty;
    // Coût et CA
    const c = costs[coll];
    const refInfo = c.refs.find(r => r.name === ref);
    if(refInfo){
      byColl[coll].total_cost += qty * refInfo.cost_per_bottle;
      byColl[coll].total_ca += qty * c.standard_price_bottle;
      // Concentré nécessaire (par référence)
      const kg = qty * c.volume_ml * parseFloat(refInfo.conc.replace('%','').replace(',','.')) / 100 / 1000;
      byColl[coll].total_conc_kg[ref] = {kg, price_kg: refInfo.price_kg};
    }
  });

  if(Object.keys(byColl).length === 0){
    document.getElementById('prodNeeds').innerHTML = '<div class="info-box">Entre des quantités ci-dessus pour voir ce que tu dois commander.</div>';
    document.getElementById('prodSummary').style.display = 'none';
    return;
  }

  let totalBtlAll = 0, totalCostAll = 0, totalCaAll = 0;
  let html = '<h2 style="color:#81620F;margin-top:20px;margin-bottom:12px">📋 Ce que tu dois commander</h2>';

  Object.keys(byColl).forEach(coll => {
    const data = byColl[coll];
    const c = costs[coll];
    const N = data.total_btl;
    totalBtlAll += N;
    totalCostAll += data.total_cost;
    totalCaAll += data.total_ca;

    html += `<div style="background:rgba(28,24,20,.04);border-radius:8px;padding:18px;margin-bottom:16px">
      <h3 style="color:#81620F;margin-bottom:12px"><span class="${collClass(coll)}">${coll}</span> — <strong>${fmtNum(N)}</strong> bouteilles à produire</h3>
      <div class="grid-2">
        <div>
          <h4 style="color:#81620F;margin-bottom:8px;font-size:.95rem">🧱 Composants physiques</h4>
          <table>
            <thead><tr><th>Élément</th><th class="text-right">Quantité</th><th class="text-right">Coût</th></tr></thead>
            <tbody>`;

    const components = [];
    if(coll === 'VIP'){
      components.push(['Pompe argent', N, P.VIP_pompe_argent]);
      components.push(['Étiquette flacon', N, P.VIP_etiquette_flacon]);
      components.push(['Étiquette étui', N, P.VIP_etiquette_etui]);
      components.push(['Étiquette fond d\'étui', N, P.VIP_etiquette_fond]);
      components.push(['Sleeve', N, P.VIP_sleeve]);
      components.push(['Flacon VIP', N, P.VIP_flacon]);
      components.push(['Capot + frette', N, P.VIP_capot_frette]);
      components.push(['Étui VIP', N, P.VIP_etui]);
      components.push([`Carton (10 btl)`, Math.ceil(N/10), P.VIP_carton_unit]);
    } else if(coll === 'VIP BLACK'){
      components.push(['Pompe noire', N, P.VIPBLACK_pompe_noir]);
      components.push(['Étiquette flacon', N, P.VIPBLACK_etiquette_flacon]);
      components.push(['Étiquette étui', N, P.VIPBLACK_etiquette_etui]);
      components.push(['Étiquette fond d\'étui', N, P.VIPBLACK_etiquette_fond]);
      components.push(['Sleeve', N, P.VIPBLACK_sleeve]);
      components.push(['Flacon VIP BLACK', N, P.VIPBLACK_flacon]);
      components.push(['Capot + frette', N, P.VIPBLACK_capot_frette]);
      components.push(['Étui VIP BLACK', N, P.VIPBLACK_etui]);
      components.push([`Carton (10 btl)`, Math.ceil(N/10), P.VIPBLACK_carton_unit]);
    } else if(coll === '50ML'){
      components.push(['Pompe noire', N, P['50ML_pompe_noir']]);
      components.push(['Étiquette flacon', N, P['50ML_etiquette_flacon']]);
      components.push(['Étiquette étui', N, P['50ML_etiquette_etui']]);
      components.push(['Étiquette fond d\'étui', N, P['50ML_etiquette_fond']]);
      components.push(['Sleeve', N, P['50ML_sleeve']]);
      components.push(['Flacon 50ML', N, P['50ML_flacon']]);
      components.push(['Capot + frette', N, P['50ML_capot_frette']]);
      components.push(['Étui 50ML', N, P['50ML_etui']]);
      components.push([`Carton (12 btl)`, Math.ceil(N/12), P['50ML_carton_unit']]);
    } else if(coll === 'BRUMES'){
      components.push(['Flacon Brume', N, P.BRUMES_flacon]);
      components.push(['Pompe', N, P.BRUMES_pompe]);
      components.push(['Capot', N, P.BRUMES_capot]);
      components.push(['Frette', N, P.BRUMES_frette]);
      components.push([`Carton (24 btl)`, Math.ceil(N/24), P.BRUMES_carton_unit]);
      components.push([`Croisillons (1/carton)`, Math.ceil(N/24), P.BRUMES_croisillons_unit]);
    }
    let compTotal = 0;
    components.forEach(([name, qty, unit]) => {
      const total = qty * unit;
      compTotal += total;
      html += `<tr><td>${name}</td><td class="text-right">${fmtNum(qty)}</td><td class="text-right amount-negative">${fmtMoney(total)}</td></tr>`;
    });
    html += `<tr style="background:rgba(129,98,15,.10);font-weight:bold"><td><strong>Sous-total composants</strong></td><td></td><td class="text-right amount-negative">${fmtMoneyShort(compTotal)}</td></tr>`;
    html += '</tbody></table></div>';

    // Concentré
    html += `<div>
      <h4 style="color:#81620F;margin-bottom:8px;font-size:.95rem">💎 Concentré nécessaire</h4>
      <table>
        <thead><tr><th>Référence</th><th class="text-right">Quantité (kg)</th><th class="text-right">Coût</th></tr></thead>
        <tbody>`;
    let concTotal = 0;
    Object.keys(data.total_conc_kg).forEach(refName => {
      const info = data.total_conc_kg[refName];
      const cost = info.kg * info.price_kg;
      concTotal += cost;
      html += `<tr><td><strong>${refName}</strong></td><td class="text-right">${info.kg.toFixed(2)} kg</td><td class="text-right amount-negative">${fmtMoney(cost)}</td></tr>`;
    });
    html += `<tr style="background:rgba(129,98,15,.10);font-weight:bold"><td><strong>Sous-total concentré</strong></td><td></td><td class="text-right amount-negative">${fmtMoneyShort(concTotal)}</td></tr>`;
    html += '</tbody></table></div></div>';

    // Production / main d'œuvre
    let prodCost = 0;
    if(coll === 'VIP'){
      prodCost = N * (P.VIP_volume_ml/1000 * P.VIP_maceration_per_l + P.VIP_conditionnement + P.VIP_coupe_pompe + P.VIP_deballage);
    } else if(coll === 'VIP BLACK'){
      prodCost = N * (P.VIPBLACK_volume_ml/1000 * P.VIPBLACK_maceration_per_l + P.VIPBLACK_conditionnement + P.VIPBLACK_coupe_pompe + P.VIPBLACK_deballage);
    } else if(coll === '50ML'){
      prodCost = N * (P['50ML_volume_ml']/1000 * P['50ML_maceration_per_l'] + P['50ML_conditionnement'] + P['50ML_coupe_pompe'] + P['50ML_deballage']);
    } else if(coll === 'BRUMES'){
      prodCost = N * (P.BRUMES_volume_ml/1000 * P.BRUMES_maceration_per_l + P.BRUMES_conditionnement + P.BRUMES_deballage);
    }

    // Recap collection
    const benefice = data.total_ca - data.total_cost;
    html += `<div style="margin-top:14px;padding:12px;background:rgba(129,98,15,.08);border-radius:6px;display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px">
      <div><div style="color:#76695C;font-size:.75rem">Main-d'œuvre</div><div style="color:#B8433F;font-weight:bold">${fmtMoneyShort(prodCost)}</div></div>
      <div><div style="color:#76695C;font-size:.75rem">Coût TOTAL ${coll}</div><div style="color:#B8433F;font-weight:bold;font-size:1.1rem">${fmtMoneyShort(data.total_cost)}</div></div>
      <div><div style="color:#76695C;font-size:.75rem">CA potentiel</div><div style="color:#81620F;font-weight:bold;font-size:1.1rem">${fmtMoneyShort(data.total_ca)}</div></div>
      <div><div style="color:#76695C;font-size:.75rem">Bénéfice</div><div style="color:#2E7D4F;font-weight:bold;font-size:1.1rem">${fmtMoneyShort(benefice)}</div></div>
    </div></div>`;
  });

  document.getElementById('prodNeeds').innerHTML = html;

  // Sommaire global
  const totalBenef = totalCaAll - totalCostAll;
  document.getElementById('prodSummary').style.display = 'block';
  document.getElementById('prodSummary').innerHTML = `
    <h3 style="color:#81620F;margin-bottom:10px">💼 Récap global de la production</h3>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px">
      <div><div style="color:#76695C;font-size:.78rem">Total bouteilles</div><div style="font-size:1.5rem;color:#81620F;font-weight:bold">${fmtNum(totalBtlAll)}</div></div>
      <div><div style="color:#76695C;font-size:.78rem">Investissement total</div><div style="font-size:1.5rem;color:#B8433F;font-weight:bold">${fmtMoneyShort(totalCostAll)}</div></div>
      <div><div style="color:#76695C;font-size:.78rem">CA potentiel</div><div style="font-size:1.5rem;color:#81620F;font-weight:bold">${fmtMoneyShort(totalCaAll)}</div></div>
      <div><div style="color:#76695C;font-size:.78rem">💚 Bénéfice attendu</div><div style="font-size:1.5rem;color:#2E7D4F;font-weight:bold">${fmtMoneyShort(totalBenef)}</div></div>
    </div>
  `;
}

document.getElementById('prodClear').addEventListener('click', () => {
  if(confirm('Effacer toutes les quantités ?')){
    productionData = {};
    renderProduction();
  }
});
document.getElementById('prodSave').addEventListener('click', saveProductionData);
document.getElementById('prodFillStock').addEventListener('click', () => {
  const stock = ALL.stock;
  Object.keys(stock).forEach(coll => {
    if(coll === 'ROYAL') return;
    stock[coll].items.forEach(it => {
      const needed = Math.max(1000 - it.qty, 0);
      if(needed > 0) productionData[`${coll}|${it.reference}`] = needed;
    });
  });
  renderProduction();
});

// === ANTICIPATION DES COMMANDES ===
function renderAnticipation(){
  const d = getD();
  const out = document.getElementById('anticipationGrid');
  if(!d.predictions || d.predictions.length === 0){
    out.innerHTML = '<div class="info-box">Aucune donnée d\'anticipation pour cette période.</div>';
    return;
  }
  // Classer en 3 catégories
  const overdue = d.predictions.filter(p => p.overdue && p.days_since_last <= 365);
  const upcoming = d.predictions.filter(p => !p.overdue && p.predicted_date);
  const inactive = d.predictions.filter(p => p.days_since_last > 180 && !p.overdue);
  const noHistory = d.predictions.filter(p => !p.predicted_date);

  let html = '';
  if(overdue.length){
    html += `<h3 style="color:#B8433F;margin-bottom:10px;margin-top:14px">🔔 Clients en retard sur leur commande habituelle (${overdue.length})</h3>`;
    html += renderPredCards(overdue, 'danger');
  }
  if(upcoming.length){
    html += `<h3 style="color:#81620F;margin-bottom:10px;margin-top:18px">📅 Prochaines commandes prévues (${upcoming.length})</h3>`;
    html += renderPredCards(upcoming, 'info');
  }
  if(inactive.length){
    html += `<h3 style="color:#B7791F;margin-bottom:10px;margin-top:18px">😴 Clients inactifs > 6 mois (${inactive.length})</h3>`;
    html += renderPredCards(inactive, 'warning');
  }
  if(noHistory.length){
    html += `<h3 style="color:#76695C;margin-bottom:10px;margin-top:18px">🆕 Clients avec 1 seule commande (${noHistory.length})</h3>`;
    html += renderPredCards(noHistory, 'newbie');
  }
  out.innerHTML = html;
}

function renderPredCards(preds, level){
  const colorMap = {
    danger:{bg:'rgba(184,67,63,.10)',border:'#B8433F',accent:'#A33A35'},
    info:{bg:'rgba(47,111,168,.10)',border:'#2F6FA8',accent:'#2F6FA8'},
    warning:{bg:'rgba(183,121,31,.10)',border:'#B7791F',accent:'#fcd34d'},
    newbie:{bg:'rgba(28,24,20,.06)',border:'#76695C',accent:'#9C8F80'}
  };
  const c = colorMap[level];
  return '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:12px">' +
    preds.map(p => `
      <div style="background:${c.bg};border-left:4px solid ${c.border};padding:14px;border-radius:8px">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
          <div>
            <div style="color:#81620F;font-weight:bold;font-size:1rem">${p.client}</div>
            <div style="color:#76695C;font-size:.8rem">${p.pays} • ${p.n_factures} commande(s)</div>
          </div>
          <div style="text-align:right">
            <div style="color:${c.accent};font-size:.75rem;text-transform:uppercase">Confiance</div>
            <div style="color:${c.accent};font-weight:bold;font-size:.85rem">${p.confidence}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;font-size:.85rem">
          <div><span style="color:#76695C">Dernière :</span><br><strong>${p.last_order}</strong> (il y a ${p.days_since_last}j)</div>
          <div><span style="color:#76695C">Prochaine prévue :</span><br><strong style="color:#81620F">${p.predicted_date || '?'}</strong></div>
          <div><span style="color:#76695C">Intervalle moyen :</span><br><strong>${p.avg_interval ? p.avg_interval+' j' : 'N/A'}</strong></div>
          <div><span style="color:#76695C">CA attendu :</span><br><strong style="color:#2E7D4F">${fmtMoneyShort(p.predicted_ca)}</strong></div>
        </div>
        ${p.top_refs.length ? `<div style="border-top:1px solid rgba(28,24,20,.1);padding-top:8px"><div style="color:#76695C;font-size:.75rem;margin-bottom:4px">📦 À prévoir (top références) :</div>${p.top_refs.slice(0,3).map(r => `<div style="font-size:.8rem;display:flex;justify-content:space-between"><span><span class="${collClass(r.collection)}" style="font-size:.65rem">${r.collection}</span> ${r.reference}</span><span style="color:#81620F">${r.cartons} cart.</span></div>`).join('')}</div>` : ''}
      </div>
    `).join('') + '</div>';
}

// === OBJECTIFS ET PROJECTION ===
function renderObjectifs(){
  const year = document.getElementById('objYear').value;
  const cible = parseFloat(document.getElementById('objCible').value) || 0;
  const d = ALL[year];
  const out = document.getElementById('objContent');

  const moisRempli = d.mois.filter(m => m.ca > 0);
  const lastMois = moisRempli.length > 0 ? moisRempli[moisRempli.length-1].mois : '—';
  const nbMois = moisRempli.length;
  const moyenneMensuelle = nbMois > 0 ? d.kpi_ca / nbMois : 0;
  const projectionAnnee = moyenneMensuelle * 12;
  const pctObjectif = cible > 0 ? (d.kpi_ca / cible * 100) : 0;
  const pctProjection = cible > 0 ? (projectionAnnee / cible * 100) : 0;
  const ecartProjection = projectionAnnee - cible;

  // Comparaison année précédente
  const yearN1 = year === '2026' ? '2025' : null;
  let compHtml = '';
  if(yearN1){
    const dN1 = ALL[yearN1];
    const evolution = dN1.kpi_ca > 0 ? ((d.kpi_ca - dN1.kpi_ca) / dN1.kpi_ca * 100) : 0;
    const projectionVsN1 = dN1.kpi_ca > 0 ? ((projectionAnnee - dN1.kpi_ca) / dN1.kpi_ca * 100) : 0;
    compHtml = `
      <div style="background:rgba(28,24,20,.05);padding:16px;border-radius:8px;margin-bottom:16px">
        <h3 style="color:#81620F;margin-bottom:10px">📅 Comparaison avec ${yearN1}</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px">
          <div><div style="color:#76695C;font-size:.8rem">CA ${yearN1} (réf.)</div><div style="color:#81620F;font-weight:bold;font-size:1.15rem">${fmtMoney(dN1.kpi_ca)}</div></div>
          <div><div style="color:#76695C;font-size:.8rem">CA ${year} (actuel)</div><div style="color:#81620F;font-weight:bold;font-size:1.15rem">${fmtMoney(d.kpi_ca)}</div></div>
          <div><div style="color:#76695C;font-size:.8rem">Évolution actuelle</div><div style="color:${evolution>=0?'#2E7D4F':'#B8433F'};font-weight:bold;font-size:1.15rem">${evolution>=0?'+':''}${evolution.toFixed(1)}%</div></div>
          <div><div style="color:#76695C;font-size:.8rem">Évolution projetée</div><div style="color:${projectionVsN1>=0?'#2E7D4F':'#B8433F'};font-weight:bold;font-size:1.15rem">${projectionVsN1>=0?'+':''}${projectionVsN1.toFixed(1)}%</div></div>
        </div>
      </div>
    `;
  }

  // Status
  let statusIcon = '🟢', statusColor = '#2E7D4F', statusText = 'Sur la bonne voie';
  if(pctProjection < 80){ statusIcon = '🔴'; statusColor = '#B8433F'; statusText = 'En retard sur l\'objectif'; }
  else if(pctProjection < 100){ statusIcon = '🟡'; statusColor = '#B7791F'; statusText = 'Légèrement en-dessous'; }
  else if(pctProjection > 120){ statusIcon = '🚀'; statusColor = '#2E7D4F'; statusText = 'Au-dessus des prévisions !'; }

  let html = compHtml;

  // Bar de progression
  html += `
    <div style="background:rgba(28,24,20,.05);padding:18px;border-radius:8px;margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap">
        <h3 style="color:#81620F">🎯 Objectif ${year} : ${fmtMoney(cible)}</h3>
        <div style="color:${statusColor};font-weight:bold;font-size:1.05rem">${statusIcon} ${statusText}</div>
      </div>
      <div style="background:rgba(28,24,20,.08);height:30px;border-radius:15px;overflow:hidden;position:relative;margin-bottom:10px">
        <div style="background:linear-gradient(90deg,#81620F 0%,#2E7D4F 100%);height:100%;width:${Math.min(pctObjectif,100)}%;border-radius:15px;transition:width .5s;display:flex;align-items:center;justify-content:center;color:#FCF6EE;font-weight:bold;font-size:.85rem">${pctObjectif.toFixed(1)}%</div>
        ${pctProjection > pctObjectif ? `<div style="position:absolute;top:0;height:100%;width:2px;background:#1C1814;left:${Math.min(pctProjection,100)}%"><div style="position:absolute;top:-22px;left:-30px;color:#fff;font-size:.7rem">Projection ${pctProjection.toFixed(0)}%</div></div>`:''}
      </div>
      <div style="display:flex;justify-content:space-between;color:#76695C;font-size:.85rem">
        <span>CA actuel : <strong style="color:#81620F">${fmtMoney(d.kpi_ca)}</strong></span>
        <span>Reste à faire : <strong style="color:${cible-d.kpi_ca>0?'#B8433F':'#2E7D4F'}">${fmtMoney(Math.max(cible-d.kpi_ca,0))}</strong></span>
      </div>
    </div>
  `;

  // KPIs
  html += `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:16px">
      <div class="kpi"><div class="kpi-label">Mois rempli</div><div class="kpi-value">${nbMois}/12</div></div>
      <div class="kpi"><div class="kpi-label">Dernier mois</div><div class="kpi-value" style="font-size:1rem">${lastMois}</div></div>
      <div class="kpi"><div class="kpi-label">CA moyen / mois</div><div class="kpi-value">${fmtMoneyShort(moyenneMensuelle)}</div></div>
      <div class="kpi success"><div class="kpi-label">📊 Projection fin d'année</div><div class="kpi-value">${fmtMoneyShort(projectionAnnee)}</div></div>
      <div class="kpi ${ecartProjection>=0?'success':'danger'}"><div class="kpi-label">Écart vs objectif</div><div class="kpi-value">${ecartProjection>=0?'+':''}${fmtMoneyShort(ecartProjection)}</div></div>
    </div>
  `;

  // Tableau mensuel
  html += `
    <h3 style="color:#81620F;margin-bottom:10px">Détail mensuel et cumul</h3>
    <table>
      <thead><tr><th>Mois</th><th class="text-right">CA du mois</th><th class="text-right">Cumul</th><th class="text-right">% objectif atteint</th></tr></thead>
      <tbody>
  `;
  let cumul = 0;
  d.mois.forEach(m => {
    cumul += m.ca;
    const pct = cible > 0 ? (cumul/cible*100) : 0;
    html += `<tr style="${m.ca===0?'opacity:.4':''}"><td><strong>${m.mois}</strong></td><td class="text-right amount">${fmtMoneyShort(m.ca)}</td><td class="text-right">${fmtMoneyShort(cumul)}</td><td class="text-right" style="color:${pct>=100?'#2E7D4F':'#81620F'}">${pct.toFixed(1)}%</td></tr>`;
  });
  html += '</tbody></table>';

  out.innerHTML = html;
}

// === REMARQUES INTELLIGENTES ===
function renderInsights(){
  const d = getD();
  const out = document.getElementById('insightsContent');
  if(!d.insights || d.insights.length === 0){
    out.innerHTML = '<div class="info-box">Aucune remarque générée pour cette période.</div>';
    return;
  }
  const colorMap = {
    success:{bg:'rgba(46,125,79,.12)',border:'#2E7D4F'},
    warning:{bg:'rgba(183,121,31,.12)',border:'#B7791F'},
    danger:{bg:'rgba(184,67,63,.12)',border:'#B8433F'},
    info:{bg:'rgba(47,111,168,.12)',border:'#2F6FA8'}
  };
  const html = d.insights.map(ins => {
    const c = colorMap[ins.level] || colorMap.info;
    return `
      <div style="background:${c.bg};border-left:4px solid ${c.border};padding:14px 18px;border-radius:8px;margin-bottom:10px;display:flex;gap:14px;align-items:start">
        <div style="font-size:1.8rem">${ins.icon}</div>
        <div style="flex:1">
          <div style="color:#81620F;font-weight:bold;font-size:1rem;margin-bottom:4px">${ins.title}</div>
          <div style="color:#1C1814;font-size:.9rem">${ins.desc}</div>
        </div>
      </div>
    `;
  }).join('');
  out.innerHTML = html;
}

// ========= CHARGES — COMPTE BRED 2026 =========
function renderCharges(filter=''){
  const data = CHARGES_DATA[currentYear];
  if(!data){ document.getElementById('chargesKpis').innerHTML = '<div class="kpi"><div class="kpi-label">Charges</div><div class="kpi-value" style="font-size:1rem">Pas de données pour cette période</div></div>'; document.getElementById('tbody-charges').innerHTML=''; if(charts.charges){ charts.charges.destroy(); charts.charges=null; } return; }
  const totalAbs = Math.abs(data.total_amt);
  document.getElementById('chargesPeriodSpan').textContent = data.period;
  document.getElementById('chargesKpis').innerHTML = `
    <div class="kpi danger"><div class="kpi-label">Total charges</div><div class="kpi-value big">${fmtMoney(totalAbs)}</div></div>
    <div class="kpi"><div class="kpi-label">Nb opérations</div><div class="kpi-value">${fmtNum(data.total_ops)}</div></div>
    <div class="kpi"><div class="kpi-label">Catégories</div><div class="kpi-value">${data.order.length}</div></div>
    <div class="kpi"><div class="kpi-label">1ère catégorie</div><div class="kpi-value" style="font-size:.95rem">${data.order[0]}</div></div>
  `;

  const visibleCats = filter ? data.order.filter(cat => cat.toLowerCase().includes(filter.toLowerCase())) : data.order;
  let rows = '';
  visibleCats.forEach(cat => {
    const c = data.categories[cat];
    const pct = Math.abs(c.total) / totalAbs * 100;
    rows += `<tr class="clickable" data-charge-cat="${cat.replace(/"/g,'&quot;')}">
      <td>${cat}</td>
      <td class="text-right">${fmtNum(c.count)}</td>
      <td class="text-right amount-negative">${fmtMoney(c.total)}</td>
      <td class="text-right">${fmtPct(pct)}</td>
    </tr>`;
  });
  if(!filter){
    rows += `<tr style="font-weight:bold;border-top:2px solid #81620F">
      <td>TOTAL</td>
      <td class="text-right">${fmtNum(data.total_ops)}</td>
      <td class="text-right amount-negative">${fmtMoney(data.total_amt)}</td>
      <td class="text-right">100,0 %</td>
    </tr>`;
  }
  if(visibleCats.length===0){ rows = '<tr><td colspan="4" style="text-align:center;color:#76695C">Aucune catégorie ne correspond à la recherche.</td></tr>'; }
  document.getElementById('tbody-charges').innerHTML = rows;

  const labels = data.order;
  const values = data.order.map(cat => Math.abs(data.categories[cat].total));
  if(charts.charges) charts.charges.destroy();
  charts.charges = new Chart(document.getElementById('chartCharges'), {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Montant (€)', data: values, backgroundColor: '#81620F' }] },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#76695C' }, grid: { color: 'rgba(28,24,20,.08)' } },
        y: { ticks: { color: '#1C1814', font: { size: 10 } }, grid: { display: false } }
      }
    }
  });
}

const MOIS_NOMS_CHARGES = {'01':'Janvier','02':'Février','03':'Mars','04':'Avril','05':'Mai','06':'Juin','07':'Juillet','08':'Août','09':'Septembre','10':'Octobre','11':'Novembre','12':'Décembre'};

let chargesModalCurrentCat = null;
function openChargesModal(cat){
  const data = CHARGES_DATA[currentYear];
  if(!data) return;
  const c = data.categories[cat];
  if(!c) return;
  chargesModalCurrentCat = cat;
  const totalAbs = Math.abs(data.total_amt);
  const pct = Math.abs(c.total) / totalAbs * 100;
  document.getElementById('chargesModalTitle').textContent = cat;
  document.getElementById('chargesModalMeta').innerHTML = `Compte BRED ${currentYear === 'total' ? '2025 + 2026' : currentYear} — ${data.period}`;
  document.getElementById('chargesModalSummary').innerHTML = `
    <div class="modal-stat"><div class="modal-stat-label">Nb opérations</div><div class="modal-stat-value">${fmtNum(c.count)}</div></div>
    <div class="modal-stat"><div class="modal-stat-label">Montant total</div><div class="modal-stat-value" style="color:#B8433F">${fmtMoney(c.total)}</div></div>
    <div class="modal-stat"><div class="modal-stat-label">% du total charges</div><div class="modal-stat-value">${fmtPct(pct)}</div></div>
  `;
  const tb = document.getElementById('chargesModalVendors');
  tb.innerHTML = '';
  c.vendors.forEach(v => {
    const vpct = Math.abs(v.total) / Math.abs(c.total) * 100;
    tb.innerHTML += `<tr class="clickable" data-charge-vendor="${v.vendor.replace(/"/g,'&quot;')}"><td>${v.vendor}</td><td class="text-right">${fmtNum(v.count)}</td><td class="text-right amount-negative">${fmtMoney(v.total)}</td><td class="text-right">${fmtPct(vpct)}</td></tr>`;
  });
  showChargesMonths(cat, null);
  }
function showChargesMonths(cat, vendorName){
  const data = CHARGES_DATA[currentYear];
  if(!data) return;
  const c = data.categories[cat];
  if(!c) return;
  const titleEl = document.getElementById('chargesModalMonthsTitle');
  const mb = document.getElementById('chargesModalMonths');
  mb.innerHTML = '';
  let months = c.months;
  if(vendorName){
    const v = c.vendors.find(v => v.vendor === vendorName);
    months = (v && v.months) ? v.months : [];
    titleEl.innerHTML = `Répartition mensuelle — <span style="color:#81620F">${vendorName}</span> <a href="#" id="chargesMonthsBack" style="color:#76695C;font-size:.8rem;margin-left:8px">🔙 Toute la catégorie</a>`;
    document.getElementById('chargesMonthsBack').addEventListener('click', e => { e.preventDefault(); showChargesMonths(cat, null); });
  } else {
    titleEl.textContent = 'Répartition mensuelle';
  }
  if(months.length===0){ mb.innerHTML = '<tr><td colspan="2" style="text-align:center;color:#76695C">Pas de détail mensuel disponible.</td></tr>'; return; }
  months.forEach(m => {
    const mm = m.mois.split('-')[1];
    const yy = m.mois.split('-')[0];
    const label = (MOIS_NOMS_CHARGES[mm] || m.mois) + (currentYear==='total' ? ` ${yy}` : '');
    mb.innerHTML += `<tr><td>${label}</td><td class="text-right amount-negative">${fmtMoney(m.total)}</td></tr>`;
  });
}
function closeChargesModal(){ document.getElementById('chargesModalOverlay').classList.remove('active'); }

// ========= REVENUS — COMPTE BRED =========
function renderRevenus(filter=''){
  const data = REVENUE_DATA[currentYear];
  if(!data){ document.getElementById('revenusKpis').innerHTML = '<div class="kpi"><div class="kpi-label">Revenus</div><div class="kpi-value" style="font-size:1rem">Pas de données pour cette période</div></div>'; document.getElementById('tbody-revenus').innerHTML=''; if(charts.revenus){ charts.revenus.destroy(); charts.revenus=null; } return; }
  document.getElementById('revenusKpis').innerHTML = `
    <div class="kpi success"><div class="kpi-label">Total encaissements</div><div class="kpi-value big">${fmtMoney(data.total_amt)}</div></div>
    <div class="kpi"><div class="kpi-label">Nb opérations</div><div class="kpi-value">${fmtNum(data.total_ops)}</div></div>
    <div class="kpi"><div class="kpi-label">Sources</div><div class="kpi-value">${data.order.length}</div></div>
    <div class="kpi"><div class="kpi-label">1ère source</div><div class="kpi-value" style="font-size:.95rem">${data.order[0]}</div></div>
  `;

  const visibleCats = filter ? data.order.filter(cat => cat.toLowerCase().includes(filter.toLowerCase())) : data.order;
  let rows = '';
  visibleCats.forEach(cat => {
    const c = data.categories[cat];
    const pct = c.total / data.total_amt * 100;
    rows += `<tr class="clickable" data-revenu-cat="${cat.replace(/"/g,'&quot;')}">
      <td>${cat}</td>
      <td class="text-right">${fmtNum(c.count)}</td>
      <td class="text-right amount-positive">${fmtMoney(c.total)}</td>
      <td class="text-right">${fmtPct(pct)}</td>
    </tr>`;
  });
  if(!filter){
    rows += `<tr style="font-weight:bold;border-top:2px solid #81620F">
      <td>TOTAL</td>
      <td class="text-right">${fmtNum(data.total_ops)}</td>
      <td class="text-right amount-positive">${fmtMoney(data.total_amt)}</td>
      <td class="text-right">100,0 %</td>
    </tr>`;
  }
  if(visibleCats.length===0){ rows = '<tr><td colspan="4" style="text-align:center;color:#76695C">Aucune source ne correspond à la recherche.</td></tr>'; }
  document.getElementById('tbody-revenus').innerHTML = rows;

  const labels = data.order;
  const values = data.order.map(cat => data.categories[cat].total);
  if(charts.revenus) charts.revenus.destroy();
  charts.revenus = new Chart(document.getElementById('chartRevenus'), {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Montant (€)', data: values, backgroundColor: '#2E7D4F' }] },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#76695C' }, grid: { color: 'rgba(28,24,20,.08)' } },
        y: { ticks: { color: '#1C1814', font: { size: 10 } }, grid: { display: false } }
      }
    }
  });
}

let revenusModalCurrentCat = null;
function openRevenusModal(cat){
  const data = REVENUE_DATA[currentYear];
  const c = data.categories[cat];
  if(!c) return;
  revenusModalCurrentCat = cat;
  const pct = c.total / data.total_amt * 100;
  document.getElementById('revenusModalTitle').textContent = cat;
  document.getElementById('revenusModalMeta').innerHTML = `Compte BRED ${currentYear === 'total' ? '2025 + 2026' : currentYear} — ${data.period}`;
  document.getElementById('revenusModalSummary').innerHTML = `
    <div class="modal-stat"><div class="modal-stat-label">Nb opérations</div><div class="modal-stat-value">${fmtNum(c.count)}</div></div>
    <div class="modal-stat"><div class="modal-stat-label">Montant total</div><div class="modal-stat-value" style="color:#2E7D4F">${fmtMoney(c.total)}</div></div>
    <div class="modal-stat"><div class="modal-stat-label">% du total revenus</div><div class="modal-stat-value">${fmtPct(pct)}</div></div>
  `;
  const tb = document.getElementById('revenusModalVendors');
  tb.innerHTML = '';
  c.vendors.forEach(v => {
    const vpct = v.total / c.total * 100;
    tb.innerHTML += `<tr class="clickable" data-revenu-vendor="${v.vendor.replace(/"/g,'&quot;')}"><td>${v.vendor}</td><td class="text-right">${fmtNum(v.count)}</td><td class="text-right amount-positive">${fmtMoney(v.total)}</td><td class="text-right">${fmtPct(vpct)}</td></tr>`;
  });
  showRevenusMonths(cat, null);
  }
function showRevenusMonths(cat, vendorName){
  const data = REVENUE_DATA[currentYear];
  if(!data) return;
  const c = data.categories[cat];
  if(!c) return;
  const titleEl = document.getElementById('revenusModalMonthsTitle');
  const mb = document.getElementById('revenusModalMonths');
  mb.innerHTML = '';
  let months = c.months;
  if(vendorName){
    const v = c.vendors.find(v => v.vendor === vendorName);
    months = (v && v.months) ? v.months : [];
    titleEl.innerHTML = `Répartition mensuelle — <span style="color:#81620F">${vendorName}</span> <a href="#" id="revenusMonthsBack" style="color:#76695C;font-size:.8rem;margin-left:8px">🔙 Toute la source</a>`;
    document.getElementById('revenusMonthsBack').addEventListener('click', e => { e.preventDefault(); showRevenusMonths(cat, null); });
  } else {
    titleEl.textContent = 'Répartition mensuelle';
  }
  if(months.length===0){ mb.innerHTML = '<tr><td colspan="2" style="text-align:center;color:#76695C">Pas de détail mensuel disponible.</td></tr>'; return; }
  months.forEach(m => {
    const mm = m.mois.split('-')[1];
    const yy = m.mois.split('-')[0];
    const label = (MOIS_NOMS_CHARGES[mm] || m.mois) + (currentYear==='total' ? ` ${yy}` : '');
    mb.innerHTML += `<tr><td>${label}</td><td class="text-right amount-positive">${fmtMoney(m.total)}</td></tr>`;
  });
}
function closeRevenusModal(){ document.getElementById('revenusModalOverlay').classList.remove('active'); }

// ========= FACTURES FOURNISSEURS (suivi manuel) =========
function renderFournisseurs(){
  const d = SUPPLIER_INVOICES;
  document.getElementById('fournisseursUpdated').textContent = d.updated;
  document.getElementById('fournisseursSoldes').textContent = d.soldes.join(', ');
  const totalGeneral = d.total_eur + d.total_goldrock_eur;
  document.getElementById('fournisseursKpis').innerHTML = `
    <div class="kpi danger"><div class="kpi-label">Total France (€)</div><div class="kpi-value big">${fmtMoney(d.total_eur)}</div></div>
    <div class="kpi danger"><div class="kpi-label">Total Goldrock ($)</div><div class="kpi-value big">${d.total_goldrock_usd.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})} $</div></div>
    <div class="kpi danger"><div class="kpi-label">Total Goldrock (≈€)</div><div class="kpi-value">${fmtMoney(d.total_goldrock_eur)}</div></div>
    <div class="kpi danger"><div class="kpi-label">Total général (≈€)</div><div class="kpi-value big">${fmtMoney(totalGeneral)}</div></div>
  `;

  let rows = '';
  d.months.forEach(m => {
    m.lines.forEach((l,i) => {
      const paidTag = l.paid ? ' <span style="color:#2E7D4F;font-weight:700">✅ Payé</span>' : '';
      rows += `<tr${l.paid ? ' style="background:rgba(46,125,79,.08)"' : ''}><td>${i===0?m.name:''}</td><td>${i===0?m.status:''}</td><td>${l.label}${paidTag}</td><td class="text-right ${l.paid ? '' : 'amount-negative'}" style="${l.paid ? 'color:#2E7D4F' : ''}">${fmtMoney(l.amount)}</td></tr>`;
    });
    rows += `<tr style="font-weight:bold;border-top:1px solid rgba(129,98,15,.4)"><td colspan="3">TOTAL ${m.name}</td><td class="text-right amount-negative">${fmtMoney(m.total)}</td></tr>`;
  });
  document.getElementById('tbody-fournisseurs-france').innerHTML = rows;

  let grows = '';
  d.goldrock.lines.forEach(l => {
    grows += `<tr><td>${l.label}</td><td>${d.goldrock.status}</td><td class="text-right">${l.usd.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})} $</td><td class="text-right amount-negative">${fmtMoney(l.eur)}</td></tr>`;
  });
  grows += `<tr style="font-weight:bold;border-top:2px solid #81620F"><td colspan="2">TOTAL GOLDROCK</td><td class="text-right">${d.total_goldrock_usd.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})} $</td><td class="text-right amount-negative">${fmtMoney(d.total_goldrock_eur)}</td></tr>`;
  document.getElementById('tbody-fournisseurs-goldrock').innerHTML = grows;
}

// ========= CHARGES FIXES MENSUELLES (suivi manuel) =========
function renderChargesFixes(){
  const d = FIXED_CHARGES;
  document.getElementById('chargesfixesUpdated').textContent = d.updated;
  const totalCharges = d.charges.reduce((s,c) => s + c.amount, 0);
  const totalSalaires = d.salaires.reduce((s,c) => s + c.amount, 0);
  const totalGeneral = totalCharges + totalSalaires;
  document.getElementById('chargesfixesKpis').innerHTML = `
    <div class="kpi danger"><div class="kpi-label">Total charges fixes/mois</div><div class="kpi-value">${fmtMoney(totalCharges)}</div></div>
    <div class="kpi danger"><div class="kpi-label">Total salaires/mois</div><div class="kpi-value">${fmtMoney(totalSalaires)}</div></div>
    <div class="kpi danger"><div class="kpi-label">Total général/mois (≈)</div><div class="kpi-value big">${fmtMoney(totalGeneral)}</div></div>
  `;

  let rows = '';
  d.charges.forEach(c => {
    rows += `<tr><td>${c.label}</td><td class="text-right amount-negative">${fmtMoney(c.amount)}</td><td style="color:#76695C;font-size:.85rem">${c.note}</td></tr>`;
  });
  rows += `<tr style="font-weight:bold;border-top:2px solid #81620F"><td>TOTAL</td><td class="text-right amount-negative">${fmtMoney(totalCharges)}</td><td></td></tr>`;
  document.getElementById('tbody-chargesfixes').innerHTML = rows;

  let srows = '';
  d.salaires.forEach(s => {
    srows += `<tr><td>${s.label}</td><td class="text-right amount-negative">${fmtMoney(s.amount)}</td><td style="color:#76695C;font-size:.85rem">${s.note}</td></tr>`;
  });
  srows += `<tr style="font-weight:bold;border-top:2px solid #81620F"><td>TOTAL</td><td class="text-right amount-negative">${fmtMoney(totalSalaires)}</td><td></td></tr>`;
  document.getElementById('tbody-chargesfixes-salaires').innerHTML = srows;
}

// ========= VIREMENTS EN ATTENTE (suivi manuel) =========
function renderVirements(){
  const d = PENDING_TRANSFERS;
  document.getElementById('virementsUpdated').textContent = d.updated;
  document.getElementById('virementsKpis').innerHTML = `
    <div class="kpi success"><div class="kpi-label">Total à encaisser</div><div class="kpi-value big">${fmtMoney(d.total)}</div></div>
    <div class="kpi"><div class="kpi-label">Nb virements en attente</div><div class="kpi-value">${d.items.length}</div></div>
  `;
  const sorted = [...d.items].sort((a,b) => b.amount - a.amount);
  let rows = '';
  sorted.forEach(it => {
    const pct = it.amount / d.total * 100;
    rows += `<tr><td>${it.label}</td><td class="text-right amount-positive">${fmtMoney(it.amount)}</td><td class="text-right">${fmtPct(pct)}</td></tr>`;
  });
  rows += `<tr style="font-weight:bold;border-top:2px solid #81620F"><td>TOTAL</td><td class="text-right amount-positive">${fmtMoney(d.total)}</td><td class="text-right">100,0 %</td></tr>`;
  document.getElementById('tbody-virements').innerHTML = rows;
}

// ========= INVENTAIRE COMPOSANTS (suivi manuel) =========
function renderInventaire(filter=''){
  const d = INVENTAIRE_DATA;
  document.getElementById('inventaireUpdated').textContent = d.updated;
  document.getElementById('inventaireKpis').innerHTML = `
    <div class="kpi"><div class="kpi-label">Références suivies</div><div class="kpi-value big">${fmtNum(d.total_items)}</div></div>
    <div class="kpi success"><div class="kpi-label">Stock conforme (unités)</div><div class="kpi-value big">${fmtNum(d.total_conforme)}</div></div>
    <div class="kpi danger"><div class="kpi-label">Stock non conforme (unités)</div><div class="kpi-value">${fmtNum(d.total_non_conforme)}</div></div>
    <div class="kpi"><div class="kpi-label">Catégories</div><div class="kpi-value">${d.category_order.length}</div></div>
  `;

  const f = filter.trim().toLowerCase();
  let html = '';
  d.category_order.forEach(cat => {
    const c = d.categories[cat];
    const items = f ? c.items.filter(it => it.label.toLowerCase().includes(f) || it.code.toLowerCase().includes(f)) : c.items;
    if(f && items.length === 0) return;
    html += `
      <div style="background:rgba(28,24,20,.04);border-radius:8px;padding:18px;margin-bottom:18px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;margin-bottom:14px">
          <h3 style="color:#81620F">${cat}</h3>
          <div style="color:#76695C;font-size:.95rem">
            <strong style="color:#81620F">${fmtNum(c.total_conforme)}</strong> unités conformes
            ${c.total_non_conforme > 0 ? ` • <span style="color:#B8433F"><strong>${fmtNum(c.total_non_conforme)}</strong> non conformes</span>` : ''}
            • ${c.count} référence${c.count>1?'s':''}
          </div>
        </div>
        <table>
          <thead>
            <tr><th>#</th><th>Article</th><th style="color:#76695C;font-size:.8rem">Code</th><th class="text-right">Stock conforme</th><th class="text-right">Non conforme</th></tr>
          </thead>
          <tbody>
            ${items.map((it,i) => `
              <tr>
                <td>${i+1}</td>
                <td>${it.label}</td>
                <td style="color:#76695C;font-size:.8rem">${it.code}</td>
                <td class="text-right" style="${it.conforme===0?'color:#76695C':''}">${fmtNum(it.conforme)}</td>
                <td class="text-right" style="${it.non_conforme>0?'color:#B8433F;font-weight:600':'color:#76695C'}">${it.non_conforme>0?fmtNum(it.non_conforme):'—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  });
  if(f && html === '') html = '<div class="info-box">Aucun composant ne correspond à cette recherche.</div>';
  document.getElementById('inventaireContent').innerHTML = html;
}

function renderAll(){
  renderKpis();
  renderOverview();
  renderClients();
  renderPays();
  renderMois();
  renderRefs();
  renderFactures();
  selectedCadeauxClient = null;
  renderCadeaux();
  selectedEvoClient = null;
  renderEvolutionList();
  renderEvolutionChart();
  renderCosts();
  renderStock();
  renderInventaire();
  renderChargesFixes();
  loadProductionData();
  renderProduction();
  loadSimulationData();
  renderSimulation();
  renderCompare();
  renderFournisseurs();
  renderVirements();
}

// ========= SIMULATION DE COMMANDE =========
const SIM_STORAGE_KEY = 'ej_simulation_data';
let simData = {};       // { 'Collection|Ref': qty_btl }
let simCartonMode = false;
let simIncludeTester = true;

const CARTON_INFO = {
  'VIP': { size: 10, price_carton: 160, price_btl: 16 },
  'VIP BLACK': { size: 10, price_carton: 180, price_btl: 18 },
  'ROYAL': { size: 13, price_carton: 117, price_btl: 9 },
  '50ML': { size: 11, price_carton: 143, price_btl: 13 },
  'BRUMES': { size: 23, price_carton: 92, price_btl: 4 },
};

function loadSimulationData(){
  try {
    const raw = localStorage.getItem(SIM_STORAGE_KEY);
    if(raw) simData = JSON.parse(raw);
  } catch(e){ simData = {}; }
}
function saveSimulationData(){
  try { localStorage.setItem(SIM_STORAGE_KEY, JSON.stringify(simData)); } catch(e){}
}

function renderSimulation(){
  const stock = ALL.stock;
  const COLL_ORDER = ['VIP', 'VIP BLACK', 'ROYAL', '50ML', 'BRUMES'];
  let html = '';
  let totalBtl = 0, totalCA = 0, refsKO = 0, refsOK = 0;

  COLL_ORDER.forEach(coll => {
    const stk = stock[coll];
    if(!stk) return;
    const info = CARTON_INFO[coll];
    let collQty = 0, collCA = 0, collKO = 0;

    let rows = '';
    stk.items.forEach(it => {
      const key = `${coll}|${it.reference}`;
      const qtyBtl = simData[key] || 0;
      const tester = simIncludeTester ? Math.ceil(qtyBtl / info.size) : 0;
      const consumed = qtyBtl + tester;
      const after = it.qty - consumed;
      const feasible = after >= 0;
      const ca = qtyBtl * info.price_btl;

      if(qtyBtl > 0){
        collQty += qtyBtl;
        collCA += ca;
        if(feasible) refsOK++; else { refsKO++; collKO++; }
      }
      totalBtl += qtyBtl;
      totalCA += ca;

      const displayQty = simCartonMode ? (qtyBtl / info.size).toFixed(qtyBtl % info.size === 0 ? 0 : 1) : qtyBtl;
      const statusColor = qtyBtl === 0 ? '#76695C' : (feasible ? '#2E7D4F' : '#B8433F');
      const statusIcon = qtyBtl === 0 ? '—' : (feasible ? '✅' : '❌');
      const afterColor = after < 0 ? '#B8433F' : (after < 50 ? '#B7791F' : '#2E7D4F');
      const stockColor = it.qty <= 0 ? '#B8433F' : (it.qty < 50 ? '#B7791F' : '#1C1814');

      rows += `<tr>
        <td><strong>${it.reference}</strong></td>
        <td class="text-right" style="color:${stockColor};font-weight:600">${fmtNum(it.qty)}</td>
        <td class="text-right">
          <input type="number" min="0" step="${simCartonMode ? 1 : 1}" value="${displayQty}"
                 data-key="${key}" data-coll="${coll}" data-size="${info.size}"
                 class="sim-input"
                 style="width:100px;padding:6px 8px;border-radius:6px;border:1px solid #9C8F80;background:#FFFFFF;color:#1C1814;text-align:right;font-weight:600">
        </td>
        <td class="text-right" style="color:#76695C;font-size:.85rem">${tester > 0 ? '+' + tester : '—'}</td>
        <td class="text-right" style="color:${afterColor};font-weight:600">${qtyBtl === 0 ? '—' : fmtNum(after)}</td>
        <td class="text-right amount">${qtyBtl === 0 ? '—' : fmtMoney(ca)}</td>
        <td class="text-center" style="font-size:1.1rem;color:${statusColor}">${statusIcon}</td>
      </tr>`;
    });

    const collStatus = collKO > 0 ? `<span style="color:#B8433F">⚠️ ${collKO} ref(s) en rupture</span>` : (collQty > 0 ? '<span style="color:#2E7D4F">✅ Faisable</span>' : '<span style="color:#76695C">Aucune saisie</span>');
    html += `
      <div style="background:rgba(28,24,20,.04);border-radius:8px;padding:18px;margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:10px">
          <h3 style="color:#81620F;margin:0">
            <span class="${collClass(coll)}">${coll}</span>
            <span style="color:#76695C;font-size:.85rem;font-weight:normal">
              (${info.price_btl}€/btl • carton de ${info.size}+1 à ${info.price_carton}€)
            </span>
          </h3>
          <div style="font-size:.95rem">${collStatus} <span style="color:#76695C;margin-left:14px">${fmtNum(collQty)} btl • ${fmtMoney(collCA)}</span></div>
        </div>
        <table>
          <thead><tr>
            <th>Référence</th>
            <th class="text-right">Stock</th>
            <th class="text-right">Qté ${simCartonMode ? '(cartons)' : '(btl)'}</th>
            <th class="text-right">+ Tester</th>
            <th class="text-right">Après commande</th>
            <th class="text-right">CA estimé</th>
            <th class="text-center">Statut</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  });

  // Sommaire global en haut
  const summaryColor = refsKO > 0 ? '#B8433F' : (totalBtl > 0 ? '#2E7D4F' : '#76695C');
  const summaryMsg = refsKO > 0
    ? `❌ ${refsKO} référence(s) en rupture — produire avant`
    : (totalBtl > 0 ? `✅ Commande entièrement faisable avec le stock actuel` : 'Aucune référence saisie');
  document.getElementById('simSummary').innerHTML = `
    <div style="background:linear-gradient(135deg,rgba(129,98,15,.08),rgba(129,98,15,.02));border:1px solid ${summaryColor};border-radius:10px;padding:18px;margin-bottom:16px;display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px">
      <div><div style="color:#76695C;font-size:.78rem;text-transform:uppercase;letter-spacing:.6px">Statut</div><div style="font-size:1.05rem;color:${summaryColor};font-weight:bold;margin-top:4px">${summaryMsg}</div></div>
      <div><div style="color:#76695C;font-size:.78rem;text-transform:uppercase;letter-spacing:.6px">Total bouteilles</div><div style="font-size:1.6rem;color:#81620F;font-weight:bold">${fmtNum(totalBtl)}</div></div>
      <div><div style="color:#76695C;font-size:.78rem;text-transform:uppercase;letter-spacing:.6px">CA estimé (prix standard)</div><div style="font-size:1.6rem;color:#2E7D4F;font-weight:bold">${fmtMoney(totalCA)}</div></div>
      <div><div style="color:#76695C;font-size:.78rem;text-transform:uppercase;letter-spacing:.6px">Réfs OK / KO</div><div style="font-size:1.6rem;font-weight:bold"><span style="color:#2E7D4F">${refsOK}</span> <span style="color:#76695C">/</span> <span style="color:#B8433F">${refsKO}</span></div></div>
    </div>
  `;
  document.getElementById('simContent').innerHTML = html;

  // Wire inputs
  document.querySelectorAll('.sim-input').forEach(inp => {
    inp.addEventListener('input', (e) => {
      const key = e.target.dataset.key;
      const size = parseInt(e.target.dataset.size);
      const v = parseFloat(e.target.value) || 0;
      simData[key] = simCartonMode ? Math.round(v * size) : Math.round(v);
      if(simData[key] <= 0) delete simData[key];
      saveSimulationData();
      renderSimulation();
    });
  });
}

document.getElementById('simReset').addEventListener('click', () => {
  if(confirm('Effacer toutes les quantités de la simulation ?')){
    simData = {};
    saveSimulationData();
    renderSimulation();
  }
});
document.getElementById('simCartonMode').addEventListener('change', (e) => {
  simCartonMode = e.target.checked;
  renderSimulation();
});
document.getElementById('simIncludeTester').addEventListener('change', (e) => {
  simIncludeTester = e.target.checked;
  renderSimulation();
});

// Year switcher
document.querySelectorAll('.year-btn').forEach(b => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.year-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    currentYear = b.dataset.year;
    renderAll();
  });
});

// Tab switcher
document.querySelectorAll('.tab').forEach(t => {
  t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.section').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    document.getElementById(t.dataset.tab).classList.add('active');
  });
});

document.getElementById('search-client').addEventListener('input', e => renderClients(e.target.value));
document.getElementById('search-ref').addEventListener('input', filterRefs);
document.getElementById('filter-collection').addEventListener('change', filterRefs);
document.getElementById('search-fact').addEventListener('input', e => renderFactures(e.target.value));
document.getElementById('search-cadeaux').addEventListener('input', e => renderCadeaux(e.target.value));
document.getElementById('search-cadeaux-client').addEventListener('input', e => renderCadeauxClientList(e.target.value));
document.getElementById('search-evo-client').addEventListener('input', e => renderEvolutionList(e.target.value));
document.getElementById('search-inventaire').addEventListener('input', e => renderInventaire(e.target.value));

// Delegated click for facture rows
document.addEventListener('click', e => {
  const tr = e.target.closest('tr.clickable[data-facture]');
  if(tr) openFactureModal(tr.dataset.facture);
  const ctr = e.target.closest('tr.clickable[data-charge-cat]');
  if(ctr) openChargesModal(ctr.dataset.chargeCat);
  const rtr = e.target.closest('tr.clickable[data-revenu-cat]');
  if(rtr) openRevenusModal(rtr.dataset.revenuCat);
  const cvtr = e.target.closest('tr.clickable[data-charge-vendor]');
  if(cvtr && chargesModalCurrentCat) showChargesMonths(chargesModalCurrentCat, cvtr.dataset.chargeVendor);
  const rvtr = e.target.closest('tr.clickable[data-revenu-vendor]');
  if(rvtr && revenusModalCurrentCat) showRevenusMonths(revenusModalCurrentCat, rvtr.dataset.revenuVendor);
});

// Initial render
renderAll();
