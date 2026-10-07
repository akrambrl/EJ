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

Chart.defaults.color = '#243049';
Chart.defaults.borderColor = 'rgba(31,42,68,.1)';
// Affichage des valeurs directement sur les graphiques
Chart.register(ChartDataLabels);
const dlMoney = v => !v ? '' : (Math.abs(v) >= 1000 ? Math.round(v/1000).toLocaleString('fr-FR') + ' k€' : Math.round(v) + ' €');
const dlNum = v => !v ? '' : Math.round(v).toLocaleString('fr-FR');
Chart.defaults.set('plugins.datalabels', {
  display: 'auto',
  color: '#ffffff',
  font: { weight: 'bold', size: 11 },
  textStrokeColor: 'rgba(31,42,68,.9)',
  textStrokeWidth: 3,
  formatter: dlMoney
});
const PALETTE = ['#b8860b','#8B5CF6','#3B82F6','#10B981','#F59E0B','#EF4444','#EC4899','#06B6D4','#84CC16','#F97316','#A855F7','#14B8A6','#FB7185','#F43F5E','#22D3EE'];
// Étiquettes verticales posées au-dessus des barres : lisibles sur mobile même avec beaucoup de barres
const barTopLabels = { anchor:'end', align:'start', rotation:-90, offset:6, clamp:true, display:'auto', color:'#ffffff', textStrokeColor:'rgba(31,42,68,.85)', textStrokeWidth:3, font:{weight:'bold', size:9} };

function renderKpis(){
  const d = getD();
  document.getElementById('kpi-ca').textContent = fmtMoneyShort(d.kpi_ca);
  document.getElementById('kpi-marge').textContent = fmtMoneyShort(d.kpi_marge);
  document.getElementById('kpi-marge-pct').textContent = fmtPct(d.kpi_marge_pct_known);
  const royalCAEl = document.getElementById('royalCA');
  if(royalCAEl) royalCAEl.textContent = fmtMoney(d.kpi_ca_unknown);
}

function renderOverview(){
  const d = getD();
  destroyChart('chartCollections');
  charts.chartCollections = new Chart(document.getElementById('chartCollections'),{
    type:'doughnut',
    data:{labels:d.collections.map(c=>c.collection),datasets:[{data:d.collections.map(c=>c.ca),backgroundColor:PALETTE,borderWidth:2,borderColor:'#ffffff'}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{title:{display:true,text:'CA par Collection',font:{size:14},color:'#b8860b'},legend:{position:'right'}}}
  });
  destroyChart('chartPays');
  charts.chartPays = new Chart(document.getElementById('chartPays'),{
    type:'doughnut',
    data:{labels:d.pays.map(p=>p.pays),datasets:[{data:d.pays.map(p=>p.ca),backgroundColor:PALETTE,borderWidth:2,borderColor:'#ffffff'}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{title:{display:true,text:'CA par Pays',font:{size:14},color:'#b8860b'},legend:{position:'right'}}}
  });
  destroyChart('chartMois');
  charts.chartMois = new Chart(document.getElementById('chartMois'),{
    type:'bar',
    data:{labels:d.mois.map(m=>m.mois),datasets:[
      {label:'CA (€)',data:d.mois.map(m=>m.ca),backgroundColor:'#b8860b',borderRadius:6},
      {label:'Bénéfice (€)',data:d.mois.map(m=>m.marge),backgroundColor:'#10B981',borderRadius:6}
    ]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{title:{display:true,text:'CA & Bénéfice mensuel',font:{size:14},color:'#b8860b'},datalabels:{...barTopLabels,formatter:dlMoney}},scales:{y:{grace:'5%',ticks:{callback:v=>(v/1000).toFixed(0)+' k€'}}}}
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
      div.innerHTML = `<div class="podium-rank">${ranks[i]}</div><div class="podium-name">${top3[i].client}</div><div class="podium-amount">${fmtMoneyShort(top3[i].ca)}<br><small style="color:#10B981">+${fmtMoneyShort(top3[i].marge)} bénéfice</small></div>`;
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
    <div style="color:#b8860b;font-weight:bold;margin-bottom:6px;font-size:.9rem">⭐ Top 3 produits</div>
    ${top.map((p, i) => `
      <div style="margin-bottom:6px;padding:6px;background:rgba(31,42,68,.05);border-radius:5px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-weight:bold">#${i+1} ${p.reference}</span>
          <span class="${collClass(p.collection)}" style="font-size:.7rem">${p.collection}</span>
        </div>
        <div style="color:#5b6577;font-size:.75rem;margin-top:3px">${fmtNum(p.btl)} btl • ${fmtMoneyShort(p.ca)}</div>
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
    data:{labels:d.pays.map(p=>p.pays),datasets:[{data:d.pays.map(p=>p.ca),backgroundColor:PALETTE,borderWidth:2,borderColor:'#ffffff'}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{title:{display:true,text:'CA par pays (agrégé)',color:'#b8860b'},legend:{position:'bottom'}}}
  });
  destroyChart('chartPaysClientCA');
  charts.chartPaysClientCA = new Chart(document.getElementById('chartPaysClientCA'),{
    type:'pie',
    data:{labels:d.pays_client.map(p=>p.label),datasets:[{data:d.pays_client.map(p=>p.ca),backgroundColor:PALETTE,borderWidth:2,borderColor:'#ffffff'}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{title:{display:true,text:'CA par Pays × Client (2 irakiens séparés)',color:'#b8860b'},legend:{position:'bottom'}}}
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
      {label:'CA (€)',data:d.mois.map(m=>m.ca),borderColor:'#b8860b',backgroundColor:'rgba(184,134,11,.2)',fill:true,tension:.3,pointRadius:5,pointBackgroundColor:'#b8860b'},
      {label:'Bénéfice (€)',data:d.mois.map(m=>m.marge),borderColor:'#10B981',backgroundColor:'rgba(16,185,129,.15)',fill:true,tension:.3,pointRadius:5,pointBackgroundColor:'#10B981'}
    ]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{title:{display:true,text:'Évolution mensuelle (CA + Bénéfice)',color:'#b8860b'}},scales:{y:{ticks:{callback:v=>(v/1000).toFixed(0)+' k€'}}}}
  });
  destroyChart('chartMoisMarge');
  charts.chartMoisMarge = new Chart(document.getElementById('chartMoisMarge'),{
    type:'bar',
    data:{labels:d.mois.map(m=>m.mois),datasets:[{label:'Bouteilles',data:d.mois.map(m=>m.btl),backgroundColor:'#3B82F6',borderRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{title:{display:true,text:'Bouteilles vendues par mois',color:'#b8860b'},legend:{display:false},datalabels:{...barTopLabels,formatter:dlNum}},scales:{y:{grace:'5%'}}}
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
    data:{labels:top15.map(r=>r.reference),datasets:[{label:'Bouteilles vendues',data:top15.map(r=>r.btl),backgroundColor:'#b8860b',borderRadius:4}]},
    options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{title:{display:true,text:'Top 15 références (par bouteilles vendues)',font:{size:14},color:'#b8860b'},legend:{display:false},datalabels:{formatter:dlNum,anchor:'end',align:'left',color:'#ffffff'}}}
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
        tb.innerHTML += `<tr style="background:rgba(184,134,11,.10);font-weight:bold"><td colspan="3"><em>↳ Sous-total ${currentColl} (${collCount} réf.)</em></td><td></td><td class="text-right">${fmtNum(collTotalBtl)}</td><td class="text-right amount">${fmtMoneyShort(collTotalCA)}</td><td class="text-right amount-negative">${fmtMoneyShort(collTotalCout)}</td><td class="text-right amount-positive">${fmtMoneyShort(collTotalMarge)}</td></tr>`;
      }
      // En-tête de la nouvelle collection
      tb.innerHTML += `<tr style="background:#1f4e78"><td colspan="8" style="padding:10px 12px;color:#b8860b;font-weight:bold;font-size:.95rem;text-transform:uppercase;letter-spacing:.5px"><span class="${collClass(r.collection)}" style="margin-right:8px">${r.collection}</span></td></tr>`;
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
    tb.innerHTML += `<tr style="background:rgba(184,134,11,.10);font-weight:bold"><td colspan="3"><em>↳ Sous-total ${currentColl} (${collCount} réf.)</em></td><td></td><td class="text-right">${fmtNum(collTotalBtl)}</td><td class="text-right amount">${fmtMoneyShort(collTotalCA)}</td><td class="text-right amount-negative">${fmtMoneyShort(collTotalCout)}</td><td class="text-right amount-positive">${fmtMoneyShort(collTotalMarge)}</td></tr>`;
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
    <div class="modal-stat"><div class="modal-stat-label">Coût</div><div class="modal-stat-value" style="color:#ef4444">${fmtMoney(f.cout)}</div></div>
    <div class="modal-stat"><div class="modal-stat-label">Bénéfice</div><div class="modal-stat-value" style="color:#10b981">${fmtMoney(f.marge)}</div></div>
    <div class="modal-stat"><div class="modal-stat-label">Bouteilles</div><div class="modal-stat-value">${fmtNum(f.btl)}</div></div>
  `;
  const tb = document.getElementById('modalLines');
  tb.innerHTML = '';
  f.lines.forEach(l=>{
    tb.innerHTML += `<tr><td><span class="${collClass(l.collection)}">${l.collection}</span></td><td>${l.reference}</td><td>${l.mode}</td><td class="text-right">${fmtNum(l.cartons)}</td><td class="text-right">${fmtNum(l.btl)}</td><td class="text-right">${l.testers}</td><td class="text-right">${fmtMoney(l.prix)}</td><td class="text-right amount">${fmtMoneyShort(l.ca)}</td><td class="text-right amount-negative">${fmtMoneyShort(l.cout)}</td><td class="text-right amount-positive">${fmtMoneyShort(l.marge)}</td></tr>`;
  });
  document.getElementById('modalOverlay').classList.add('active');
}
function closeModal(){ document.getElementById('modalOverlay').classList.remove('active'); }
document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('modalOverlay').addEventListener('click', e => { if(e.target.id === 'modalOverlay') closeModal(); });

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
      {label:'2025',data:[d25.kpi_ca,d25.kpi_cout,d25.kpi_marge],backgroundColor:'#3B82F6',borderRadius:6},
      {label:'2026',data:[d26.kpi_ca,d26.kpi_cout,d26.kpi_marge],backgroundColor:'#b8860b',borderRadius:6}
    ]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{title:{display:true,text:'Comparaison 2025 vs 2026',color:'#b8860b'}},scales:{y:{ticks:{callback:v=>(v/1000).toFixed(0)+' k€'}}}}
  });
  destroyChart('chartCompareMarge');
  charts.chartCompareMarge = new Chart(document.getElementById('chartCompareMarge'),{
    type:'doughnut',
    data:{labels:['CA 2025','CA 2026'],datasets:[{data:[d25.kpi_ca,d26.kpi_ca],backgroundColor:['#3B82F6','#b8860b'],borderWidth:2,borderColor:'#ffffff'}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{title:{display:true,text:'Part de chaque année',color:'#b8860b'},legend:{position:'bottom'}}}
  });
  destroyChart('chartCompareMois');
  charts.chartCompareMois = new Chart(document.getElementById('chartCompareMois'),{
    type:'line',
    data:{labels:d25.mois.map(m=>m.mois),datasets:[
      {label:'CA 2025',data:d25.mois.map(m=>m.ca),borderColor:'#3B82F6',backgroundColor:'rgba(59,130,246,.2)',fill:false,tension:.3,pointRadius:5},
      {label:'CA 2026',data:d26.mois.map(m=>m.ca),borderColor:'#b8860b',backgroundColor:'rgba(184,134,11,.2)',fill:false,tension:.3,pointRadius:5}
    ]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{title:{display:true,text:'CA mensuel — 2025 vs 2026',color:'#b8860b'}},scales:{y:{ticks:{callback:v=>(v/1000).toFixed(0)+' k€'}}}}
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
    btn.style.cssText = `padding:10px 12px;margin-bottom:6px;background:${isSelected?'rgba(184,134,11,.25)':'rgba(31,42,68,.05)'};border-radius:6px;cursor:pointer;border-left:3px solid ${isSelected?'#b8860b':'transparent'};transition:all .15s`;
    btn.innerHTML = `<div style="font-weight:600;color:#b8860b;font-size:.92rem">${trendIcon} ${c.client}</div><div style="color:#5b6577;font-size:.78rem;margin-top:2px">${c.pays} • ${factures.length} fact. • ${fmtMoneyShort(c.ca)}</div>`;
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
    document.getElementById('evoSelectedHeader').innerHTML = '<div style="color:#5b6577;font-size:.9rem">Sélectionne un client à gauche pour voir son évolution</div>';
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
  let trendColor = '#5b6577';
  let trendIcon = '➡️';
  if(factures.length >= 2){
    const first = factures[0].ca;
    const last = factures[factures.length-1].ca;
    const evol = ((last - first) / first * 100);
    if(evol > 10){ trendText = `+${evol.toFixed(1)}% entre 1ère et dernière commande`; trendColor = '#10b981'; trendIcon = '📈'; }
    else if(evol < -10){ trendText = `${evol.toFixed(1)}% entre 1ère et dernière commande`; trendColor = '#ef4444'; trendIcon = '📉'; }
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
        <div style="color:#b8860b;font-size:1.2rem;font-weight:bold">${c.client}</div>
        <div style="color:#5b6577;font-size:.9rem">${c.pays} • ${factures.length} commande(s)</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:1.6rem">${trendIcon}</div>
        <div style="color:${trendColor};font-size:.9rem;font-weight:600">${trendText}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-top:12px">
      <div><div style="color:#5b6577;font-size:.75rem">CA Total</div><div style="color:#b8860b;font-weight:bold">${fmtMoneyShort(totalCA)}</div></div>
      <div><div style="color:#5b6577;font-size:.75rem">Bénéfice</div><div style="color:#10b981;font-weight:bold">${fmtMoneyShort(totalMarge)}</div></div>
      <div><div style="color:#5b6577;font-size:.75rem">CA moyen / commande</div><div style="color:#b8860b;font-weight:bold">${fmtMoneyShort(avgCA)}</div></div>
    </div>
  `;

  destroyChart('chartEvoClient');
  charts.chartEvoClient = new Chart(document.getElementById('chartEvoClient'),{
    type:'line',
    data:{
      labels:factures.map(f=>f.date),
      datasets:[
        {label:'CA par commande (€)',data:factures.map(f=>f.ca),borderColor:'#b8860b',backgroundColor:'rgba(184,134,11,.2)',fill:true,tension:.25,pointRadius:7,pointHoverRadius:10,pointBackgroundColor:'#b8860b'},
        {label:'Bénéfice net (€)',data:factures.map(f=>f.marge),borderColor:'#10B981',backgroundColor:'rgba(16,185,129,.15)',fill:false,tension:.25,pointRadius:5,pointBackgroundColor:'#10B981',borderDash:[5,5]}
      ]
    },
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{title:{display:true,text:`Évolution des commandes — ${c.client}`,color:'#b8860b',font:{size:14}},legend:{position:'top'}},
      scales:{y:{ticks:{callback:v=>(v/1000).toFixed(1)+' k€'}}}
    }
  });

  // Tableau
  const tb = document.querySelector('#tableEvoClient tbody');
  tb.innerHTML = '';
  factures.forEach((f, i) => {
    let variation = '—';
    let varColor = '#5b6577';
    if(i > 0){
      const prev = factures[i-1].ca;
      const ev = ((f.ca - prev) / prev * 100);
      if(ev > 0) { variation = `📈 +${ev.toFixed(1)}%`; varColor = '#10b981'; }
      else if(ev < 0) { variation = `📉 ${ev.toFixed(1)}%`; varColor = '#ef4444'; }
      else variation = '➡️ 0%';
    }
    tb.innerHTML += `<tr class="clickable" data-facture="${f.facture}"><td>${f.date}</td><td><strong>${f.facture}</strong></td><td class="text-right">${fmtNum(f.btl)}</td><td class="text-right amount">${fmtMoneyShort(f.ca)}</td><td class="text-right amount-positive">${fmtMoneyShort(f.marge)}</td><td class="text-right" style="color:${varColor};font-weight:600">${variation}</td></tr>`;
  });
}

// === PRIX DE REVIENT ===
function renderCosts(){
  const collName = document.getElementById('costCollSelect').value;
  const c = ALL.costs[collName];
  const out = document.getElementById('costDetails');
  if(c.not_yet){
    out.innerHTML = `
      <div class="warning-box">
        ⚠️ <strong>Prix de revient ${collName} pas encore renseignés.</strong><br>
        <span style="font-size:.88rem;color:#fca5a5">Les coûts de production pour cette collection seront ajoutés ultérieurement. Aucune marge n'est donc calculable pour le moment sur les ROYAL.</span>
      </div>
      <div class="info-box">
        Pour mémoire : un carton ROYAL standard contient ${c.carton_size} bouteilles (${c.tester_info}) et se vend ${fmtMoney(c.standard_price_carton)} (${fmtMoney(c.standard_price_bottle)}/bouteille).
      </div>
    `;
    return;
  }
  if(c.provisional){
    const margeCarton = c.standard_price_carton - (c.total_fixed * (c.carton_size + 1));
    const margePct = (margeCarton / c.standard_price_carton * 100).toFixed(1);
    out.innerHTML = `
      <div class="info-box" style="background:rgba(59,130,246,.12);border-left:4px solid #3b82f6">
        ℹ️ <strong>Prix de revient provisoire : ${c.total_fixed.toFixed(2)} €/bouteille</strong><br>
        <span style="font-size:.88rem;color:#5b6577">À affiner avec le détail réel des composants, concentrés et production. En attendant, les marges affichées sont basées sur ce coût forfaitaire.</span>
      </div>
      <div style="background:rgba(184,134,11,.08);border-left:4px solid #b8860b;padding:14px;border-radius:6px;margin:18px 0">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px">
          <div><div style="color:#5b6577;font-size:.75rem">Bouteilles / carton</div><div style="color:#b8860b;font-weight:bold">${c.carton_size}</div></div>
          <div><div style="color:#5b6577;font-size:.75rem">Système</div><div style="color:#b8860b;font-weight:bold">${c.tester_info}</div></div>
          <div><div style="color:#5b6577;font-size:.75rem">Prix vente carton</div><div style="color:#b8860b;font-weight:bold">${fmtMoney(c.standard_price_carton)}</div></div>
          <div><div style="color:#5b6577;font-size:.75rem">Prix vente bouteille</div><div style="color:#b8860b;font-weight:bold">${fmtMoney(c.standard_price_bottle)}</div></div>
        </div>
      </div>
      <div style="background:rgba(16,185,129,.12);border:1px solid #10b981;padding:18px;border-radius:8px;margin-bottom:18px;text-align:center">
        <div style="color:#a7f3d0;font-size:.95rem;text-transform:uppercase;letter-spacing:.8px;font-weight:600">💎 Marge par carton (estimée)</div>
        <div style="font-size:2.1rem;color:#10b981;font-weight:bold;margin-top:6px">${fmtMoney(margeCarton)} (${margePct}%)</div>
        <div style="color:#a7f3d0;font-size:.85rem;margin-top:6px">Vente ${fmtMoney(c.standard_price_carton)} − Coût ${fmtMoney(c.total_fixed * (c.carton_size + 1))} (${c.carton_size + 1} btl × ${c.total_fixed}€)</div>
      </div>
      <h3 style="color:#b8860b;margin-bottom:10px">📋 Références ${collName}</h3>
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
    <div style="background:rgba(184,134,11,.08);border-left:4px solid #b8860b;padding:14px;border-radius:6px;margin-bottom:18px">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px">
        <div><div style="color:#5b6577;font-size:.75rem">Volume bouteille</div><div style="color:#b8860b;font-weight:bold">${c.volume_ml} ml</div></div>
        <div><div style="color:#5b6577;font-size:.75rem">Bouteilles / carton</div><div style="color:#b8860b;font-weight:bold">${c.carton_size}</div></div>
        <div><div style="color:#5b6577;font-size:.75rem">Système</div><div style="color:#b8860b;font-weight:bold">${c.tester_info}</div></div>
        <div><div style="color:#5b6577;font-size:.75rem">Prix vente carton</div><div style="color:#b8860b;font-weight:bold">${fmtMoney(c.standard_price_carton)}</div></div>
        <div><div style="color:#5b6577;font-size:.75rem">Prix vente bouteille</div><div style="color:#b8860b;font-weight:bold">${fmtMoney(c.standard_price_bottle)}</div></div>
      </div>
    </div>
  `;

  // Composants physiques
  html += `
    <div class="grid-2" style="margin-bottom:18px">
      <div>
        <h3 style="color:#b8860b;margin-bottom:10px">🧱 Composants physiques</h3>
        <table>
          <thead><tr><th>Élément</th><th class="text-right">Prix d'origine</th><th class="text-right">En EUR</th></tr></thead>
          <tbody>
            ${c.components.map(comp => `<tr><td>${comp.name}</td><td class="text-right" style="color:#5b6577;font-size:.85rem">${comp.price_orig}</td><td class="text-right amount">${comp.price_eur.toFixed(4)} €</td></tr>`).join('')}
            <tr style="background:rgba(184,134,11,.12);font-weight:bold"><td colspan="2"><strong>TOTAL composants</strong></td><td class="text-right amount" style="font-size:1rem">${c.total_components.toFixed(4)} €</td></tr>
          </tbody>
        </table>
      </div>
      <div>
        <h3 style="color:#b8860b;margin-bottom:10px">⚙️ Main-d'œuvre / Production</h3>
        <table>
          <thead><tr><th>Étape</th><th class="text-right">Détail</th><th class="text-right">Coût €</th></tr></thead>
          <tbody>
            ${c.production.map(p => `<tr><td>${p.name}</td><td class="text-right" style="color:#5b6577;font-size:.85rem">${p.detail}</td><td class="text-right amount">${p.price_eur.toFixed(4)} €</td></tr>`).join('')}
            <tr style="background:rgba(184,134,11,.12);font-weight:bold"><td colspan="2"><strong>TOTAL production</strong></td><td class="text-right amount" style="font-size:1rem">${c.total_production.toFixed(4)} €</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Coût moyen complet (avec concentré)
  const avg_conc_cost = c.refs.reduce((s, r) => s + r.cost_conc, 0) / c.refs.length;
  const avg_total_cost = c.total_fixed + avg_conc_cost;
  const min_total = Math.min(...c.refs.map(r => c.total_fixed + r.cost_conc));
  const max_total = Math.max(...c.refs.map(r => c.total_fixed + r.cost_conc));
  html += `
    <div style="background:rgba(16,185,129,.12);border:1px solid #10b981;padding:18px;border-radius:8px;margin-bottom:18px;text-align:center">
      <div style="color:#a7f3d0;font-size:.95rem;text-transform:uppercase;letter-spacing:.8px;font-weight:600">💎 Coût par bouteille (concentré inclus)</div>
      <div style="font-size:2.1rem;color:#10b981;font-weight:bold;margin-top:6px">${avg_total_cost.toFixed(4)} €</div>
      <div style="color:#a7f3d0;font-size:.85rem;margin-top:6px">Coût moyen — varie de <strong>${min_total.toFixed(2)} €</strong> à <strong>${max_total.toFixed(2)} €</strong> selon la référence</div>
      <div style="color:#8a92a3;font-size:.75rem;margin-top:8px">Détail : ${c.total_fixed.toFixed(4)} € (composants+production fixe) + ${avg_conc_cost.toFixed(4)} € (concentré moyen)</div>
    </div>
  `;

  // Concentré + Coût total + Marge
  const refs_sorted = [...c.refs].sort((a,b) => a.cost_per_bottle - b.cost_per_bottle);
  html += `
    <h3 style="color:#b8860b;margin-bottom:10px">💎 Concentré + Coût total par référence</h3>
    <table>
      <thead>
        <tr>
          <th>#</th><th>Référence</th>
          <th class="text-right">Concentr.</th>
          <th class="text-right">kg/1000</th>
          <th class="text-right">Prix kg</th>
          <th class="text-right">Coût concentré /btl</th>
          <th class="text-right">Coût TOTAL /btl</th>
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
            <td class="text-right" style="color:${r.margin_pct >= 60 ? '#10b981' : r.margin_pct >= 50 ? '#b8860b' : '#ef4444'};font-weight:bold">${r.margin_pct} %</td>
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
      <div class="kpi"><div class="kpi-label">⭐ Moins cher</div><div class="kpi-value" style="font-size:1rem">${cheapest.name}<br><span style="font-size:.85rem;color:#10b981">${cheapest.cost_per_bottle.toFixed(2)} €</span></div></div>
      <div class="kpi"><div class="kpi-label">⭐ Plus cher</div><div class="kpi-value" style="font-size:1rem">${expensive.name}<br><span style="font-size:.85rem;color:#ef4444">${expensive.cost_per_bottle.toFixed(2)} €</span></div></div>
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
    epuise: {bg:'rgba(31,42,68,.12)', border:'#000', text:'⚫ Épuisé', color:'#8a92a3'},
    critical: {bg:'rgba(239,68,68,.15)', border:'#ef4444', text:'🔴 Critique', color:'#ef4444'},
    low: {bg:'rgba(245,158,11,.12)', border:'#f59e0b', text:'🟠 Faible', color:'#f59e0b'},
    medium: {bg:'rgba(184,134,11,.10)', border:'#b8860b', text:'🟡 Moyen', color:'#b8860b'},
    ok: {bg:'rgba(16,185,129,.10)', border:'#10b981', text:'🟢 OK', color:'#10b981'},
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
    <div style="color:#5b6577;font-size:.78rem;margin-bottom:14px">*Bénéfice calculé hors ROYAL (coût non renseigné). CA potentiel calculé au prix de vente unitaire standard (VIP 16€, VIP BLACK 18€, ROYAL 9€, 50ML 13€, BRUMES 4€).</div>
  `;

  let html = '';
  COLL_ORDER.forEach(coll => {
    if(!stock[coll]) return;
    const s = stock[coll];
    const benefDisplay = s.has_cost ? fmtMoneyShort(s.total_benef_pot) : '—';
    html += `
      <div style="background:rgba(31,42,68,.04);border-radius:8px;padding:18px;margin-bottom:18px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;margin-bottom:14px">
          <h3 style="color:#b8860b"><span class="${collClass(coll)}">${coll}</span></h3>
          <div style="color:#5b6577;font-size:.95rem">
            <strong style="color:#b8860b">${fmtNum(s.total_qty)}</strong> btl •
            CA : <strong style="color:#b8860b">${fmtMoneyShort(s.total_ca_pot)}</strong> •
            Bénéfice : <strong style="color:#10b981">${benefDisplay}</strong>
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
    html += `<div style="background:rgba(31,42,68,.04);border-radius:8px;padding:18px;margin-bottom:16px">
      <h3 style="color:#b8860b;margin-bottom:10px"><span class="${collClass(coll)}">${coll}</span> <span style="color:#5b6577;font-size:.85rem;font-weight:normal">(${c.volume_ml}ml • prix vente btl : ${c.standard_price_bottle}€)</span></h3>
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
        <td class="text-right"><input type="number" min="0" step="100" value="${qty}" data-prod-key="${key}" style="width:90px;padding:6px 10px;background:rgba(31,42,68,.08);border:1px solid rgba(31,42,68,.2);border-radius:6px;color:#1f2a44;text-align:right;font-size:.95rem"></td>
        <td class="text-right">${qty > 0 ? `<strong style="color:#b8860b">${concKg} kg</strong><br><span style="color:#5b6577;font-size:.78rem">${concEur} €</span>` : '—'}</td>
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
  let html = '<h2 style="color:#b8860b;margin-top:20px;margin-bottom:12px">📋 Ce que tu dois commander</h2>';

  Object.keys(byColl).forEach(coll => {
    const data = byColl[coll];
    const c = costs[coll];
    const N = data.total_btl;
    totalBtlAll += N;
    totalCostAll += data.total_cost;
    totalCaAll += data.total_ca;

    html += `<div style="background:rgba(31,42,68,.04);border-radius:8px;padding:18px;margin-bottom:16px">
      <h3 style="color:#b8860b;margin-bottom:12px"><span class="${collClass(coll)}">${coll}</span> — <strong>${fmtNum(N)}</strong> bouteilles à produire</h3>
      <div class="grid-2">
        <div>
          <h4 style="color:#b8860b;margin-bottom:8px;font-size:.95rem">🧱 Composants physiques</h4>
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
    html += `<tr style="background:rgba(184,134,11,.10);font-weight:bold"><td><strong>Sous-total composants</strong></td><td></td><td class="text-right amount-negative">${fmtMoneyShort(compTotal)}</td></tr>`;
    html += '</tbody></table></div>';

    // Concentré
    html += `<div>
      <h4 style="color:#b8860b;margin-bottom:8px;font-size:.95rem">💎 Concentré nécessaire</h4>
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
    html += `<tr style="background:rgba(184,134,11,.10);font-weight:bold"><td><strong>Sous-total concentré</strong></td><td></td><td class="text-right amount-negative">${fmtMoneyShort(concTotal)}</td></tr>`;
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
    html += `<div style="margin-top:14px;padding:12px;background:rgba(184,134,11,.08);border-radius:6px;display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px">
      <div><div style="color:#5b6577;font-size:.75rem">Main-d'œuvre</div><div style="color:#ef4444;font-weight:bold">${fmtMoneyShort(prodCost)}</div></div>
      <div><div style="color:#5b6577;font-size:.75rem">Coût TOTAL ${coll}</div><div style="color:#ef4444;font-weight:bold;font-size:1.1rem">${fmtMoneyShort(data.total_cost)}</div></div>
      <div><div style="color:#5b6577;font-size:.75rem">CA potentiel</div><div style="color:#b8860b;font-weight:bold;font-size:1.1rem">${fmtMoneyShort(data.total_ca)}</div></div>
      <div><div style="color:#5b6577;font-size:.75rem">Bénéfice</div><div style="color:#10b981;font-weight:bold;font-size:1.1rem">${fmtMoneyShort(benefice)}</div></div>
    </div></div>`;
  });

  document.getElementById('prodNeeds').innerHTML = html;

  // Sommaire global
  const totalBenef = totalCaAll - totalCostAll;
  document.getElementById('prodSummary').style.display = 'block';
  document.getElementById('prodSummary').innerHTML = `
    <h3 style="color:#b8860b;margin-bottom:10px">💼 Récap global de la production</h3>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px">
      <div><div style="color:#5b6577;font-size:.78rem">Total bouteilles</div><div style="font-size:1.5rem;color:#b8860b;font-weight:bold">${fmtNum(totalBtlAll)}</div></div>
      <div><div style="color:#5b6577;font-size:.78rem">Investissement total</div><div style="font-size:1.5rem;color:#ef4444;font-weight:bold">${fmtMoneyShort(totalCostAll)}</div></div>
      <div><div style="color:#5b6577;font-size:.78rem">CA potentiel</div><div style="font-size:1.5rem;color:#b8860b;font-weight:bold">${fmtMoneyShort(totalCaAll)}</div></div>
      <div><div style="color:#5b6577;font-size:.78rem">💚 Bénéfice attendu</div><div style="font-size:1.5rem;color:#10b981;font-weight:bold">${fmtMoneyShort(totalBenef)}</div></div>
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
    html += `<h3 style="color:#ef4444;margin-bottom:10px;margin-top:14px">🔔 Clients en retard sur leur commande habituelle (${overdue.length})</h3>`;
    html += renderPredCards(overdue, 'danger');
  }
  if(upcoming.length){
    html += `<h3 style="color:#b8860b;margin-bottom:10px;margin-top:18px">📅 Prochaines commandes prévues (${upcoming.length})</h3>`;
    html += renderPredCards(upcoming, 'info');
  }
  if(inactive.length){
    html += `<h3 style="color:#f59e0b;margin-bottom:10px;margin-top:18px">😴 Clients inactifs > 6 mois (${inactive.length})</h3>`;
    html += renderPredCards(inactive, 'warning');
  }
  if(noHistory.length){
    html += `<h3 style="color:#5b6577;margin-bottom:10px;margin-top:18px">🆕 Clients avec 1 seule commande (${noHistory.length})</h3>`;
    html += renderPredCards(noHistory, 'newbie');
  }
  out.innerHTML = html;
}

function renderPredCards(preds, level){
  const colorMap = {
    danger:{bg:'rgba(239,68,68,.10)',border:'#ef4444',accent:'#fca5a5'},
    info:{bg:'rgba(59,130,246,.10)',border:'#3b82f6',accent:'#93c5fd'},
    warning:{bg:'rgba(245,158,11,.10)',border:'#f59e0b',accent:'#fcd34d'},
    newbie:{bg:'rgba(31,42,68,.06)',border:'#8a92a3',accent:'#cbd5e1'}
  };
  const c = colorMap[level];
  return '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:12px">' +
    preds.map(p => `
      <div style="background:${c.bg};border-left:4px solid ${c.border};padding:14px;border-radius:8px">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
          <div>
            <div style="color:#b8860b;font-weight:bold;font-size:1rem">${p.client}</div>
            <div style="color:#5b6577;font-size:.8rem">${p.pays} • ${p.n_factures} commande(s)</div>
          </div>
          <div style="text-align:right">
            <div style="color:${c.accent};font-size:.75rem;text-transform:uppercase">Confiance</div>
            <div style="color:${c.accent};font-weight:bold;font-size:.85rem">${p.confidence}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;font-size:.85rem">
          <div><span style="color:#5b6577">Dernière :</span><br><strong>${p.last_order}</strong> (il y a ${p.days_since_last}j)</div>
          <div><span style="color:#5b6577">Prochaine prévue :</span><br><strong style="color:#b8860b">${p.predicted_date || '?'}</strong></div>
          <div><span style="color:#5b6577">Intervalle moyen :</span><br><strong>${p.avg_interval ? p.avg_interval+' j' : 'N/A'}</strong></div>
          <div><span style="color:#5b6577">CA attendu :</span><br><strong style="color:#10b981">${fmtMoneyShort(p.predicted_ca)}</strong></div>
        </div>
        ${p.top_refs.length ? `<div style="border-top:1px solid rgba(31,42,68,.1);padding-top:8px"><div style="color:#5b6577;font-size:.75rem;margin-bottom:4px">📦 À prévoir (top références) :</div>${p.top_refs.slice(0,3).map(r => `<div style="font-size:.8rem;display:flex;justify-content:space-between"><span><span class="${collClass(r.collection)}" style="font-size:.65rem">${r.collection}</span> ${r.reference}</span><span style="color:#b8860b">${r.cartons} cart.</span></div>`).join('')}</div>` : ''}
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
      <div style="background:rgba(31,42,68,.05);padding:16px;border-radius:8px;margin-bottom:16px">
        <h3 style="color:#b8860b;margin-bottom:10px">📅 Comparaison avec ${yearN1}</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px">
          <div><div style="color:#5b6577;font-size:.8rem">CA ${yearN1} (réf.)</div><div style="color:#b8860b;font-weight:bold;font-size:1.15rem">${fmtMoney(dN1.kpi_ca)}</div></div>
          <div><div style="color:#5b6577;font-size:.8rem">CA ${year} (actuel)</div><div style="color:#b8860b;font-weight:bold;font-size:1.15rem">${fmtMoney(d.kpi_ca)}</div></div>
          <div><div style="color:#5b6577;font-size:.8rem">Évolution actuelle</div><div style="color:${evolution>=0?'#10b981':'#ef4444'};font-weight:bold;font-size:1.15rem">${evolution>=0?'+':''}${evolution.toFixed(1)}%</div></div>
          <div><div style="color:#5b6577;font-size:.8rem">Évolution projetée</div><div style="color:${projectionVsN1>=0?'#10b981':'#ef4444'};font-weight:bold;font-size:1.15rem">${projectionVsN1>=0?'+':''}${projectionVsN1.toFixed(1)}%</div></div>
        </div>
      </div>
    `;
  }

  // Status
  let statusIcon = '🟢', statusColor = '#10b981', statusText = 'Sur la bonne voie';
  if(pctProjection < 80){ statusIcon = '🔴'; statusColor = '#ef4444'; statusText = 'En retard sur l\'objectif'; }
  else if(pctProjection < 100){ statusIcon = '🟡'; statusColor = '#f59e0b'; statusText = 'Légèrement en-dessous'; }
  else if(pctProjection > 120){ statusIcon = '🚀'; statusColor = '#10b981'; statusText = 'Au-dessus des prévisions !'; }

  let html = compHtml;

  // Bar de progression
  html += `
    <div style="background:rgba(31,42,68,.05);padding:18px;border-radius:8px;margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap">
        <h3 style="color:#b8860b">🎯 Objectif ${year} : ${fmtMoney(cible)}</h3>
        <div style="color:${statusColor};font-weight:bold;font-size:1.05rem">${statusIcon} ${statusText}</div>
      </div>
      <div style="background:rgba(31,42,68,.12);height:30px;border-radius:15px;overflow:hidden;position:relative;margin-bottom:10px">
        <div style="background:linear-gradient(90deg,#b8860b 0%,#10b981 100%);height:100%;width:${Math.min(pctObjectif,100)}%;border-radius:15px;transition:width .5s;display:flex;align-items:center;justify-content:center;color:#1a2747;font-weight:bold;font-size:.85rem">${pctObjectif.toFixed(1)}%</div>
        ${pctProjection > pctObjectif ? `<div style="position:absolute;top:0;height:100%;width:2px;background:#1f2a44;left:${Math.min(pctProjection,100)}%"><div style="position:absolute;top:-22px;left:-30px;color:#fff;font-size:.7rem">Projection ${pctProjection.toFixed(0)}%</div></div>`:''}
      </div>
      <div style="display:flex;justify-content:space-between;color:#5b6577;font-size:.85rem">
        <span>CA actuel : <strong style="color:#b8860b">${fmtMoney(d.kpi_ca)}</strong></span>
        <span>Reste à faire : <strong style="color:${cible-d.kpi_ca>0?'#ef4444':'#10b981'}">${fmtMoney(Math.max(cible-d.kpi_ca,0))}</strong></span>
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
    <h3 style="color:#b8860b;margin-bottom:10px">Détail mensuel et cumul</h3>
    <table>
      <thead><tr><th>Mois</th><th class="text-right">CA du mois</th><th class="text-right">Cumul</th><th class="text-right">% objectif atteint</th></tr></thead>
      <tbody>
  `;
  let cumul = 0;
  d.mois.forEach(m => {
    cumul += m.ca;
    const pct = cible > 0 ? (cumul/cible*100) : 0;
    html += `<tr style="${m.ca===0?'opacity:.4':''}"><td><strong>${m.mois}</strong></td><td class="text-right amount">${fmtMoneyShort(m.ca)}</td><td class="text-right">${fmtMoneyShort(cumul)}</td><td class="text-right" style="color:${pct>=100?'#10b981':'#b8860b'}">${pct.toFixed(1)}%</td></tr>`;
  });
  html += '</tbody></table>';

  out.innerHTML = html;
}
document.getElementById('objYear').addEventListener('change', renderObjectifs);
document.getElementById('objCible').addEventListener('input', renderObjectifs);

// === REMARQUES INTELLIGENTES ===
function renderInsights(){
  const d = getD();
  const out = document.getElementById('insightsContent');
  const relances = (typeof window.relanceInsights==='function') ? window.relanceInsights() : [];
  const items = relances.concat(d.insights || []);
  if(items.length === 0){
    out.innerHTML = '<div class="info-box">Aucune remarque générée pour cette période.</div>';
    return;
  }
  const colorMap = {
    success:{bg:'rgba(16,185,129,.12)',border:'#10b981'},
    warning:{bg:'rgba(245,158,11,.12)',border:'#f59e0b'},
    danger:{bg:'rgba(239,68,68,.12)',border:'#ef4444'},
    info:{bg:'rgba(59,130,246,.12)',border:'#3b82f6'}
  };
  const html = items.map(ins => {
    const c = colorMap[ins.level] || colorMap.info;
    return `
      <div style="background:${c.bg};border-left:4px solid ${c.border};padding:14px 18px;border-radius:8px;margin-bottom:10px;display:flex;gap:14px;align-items:start">
        <div style="font-size:1.8rem">${ins.icon}</div>
        <div style="flex:1">
          <div style="color:#b8860b;font-weight:bold;font-size:1rem;margin-bottom:4px">${ins.title}</div>
          <div style="color:#243049;font-size:.9rem">${ins.desc}</div>
        </div>
      </div>
    `;
  }).join('');
  out.innerHTML = html;
}

function renderAll(){
  renderKpis();
  renderOverview();
  renderClients();
  renderPays();
  renderMois();
  renderRefs();
  renderFactures();
  selectedEvoClient = null;
  renderEvolutionList();
  renderEvolutionChart();
  renderCosts();
  renderStock();
  loadProductionData();
  renderProduction();
  loadSimulationData();
  renderSimulation();
  renderAnticipation();
  renderObjectifs();
  renderInsights();
  renderCompare();
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
      const statusColor = qtyBtl === 0 ? '#64748b' : (feasible ? '#10b981' : '#ef4444');
      const statusIcon = qtyBtl === 0 ? '—' : (feasible ? '✅' : '❌');
      const afterColor = after < 0 ? '#ef4444' : (after < 50 ? '#f59e0b' : '#10b981');
      const stockColor = it.qty <= 0 ? '#ef4444' : (it.qty < 50 ? '#f59e0b' : '#243049');

      rows += `<tr>
        <td><strong>${it.reference}</strong></td>
        <td class="text-right" style="color:${stockColor};font-weight:600">${fmtNum(it.qty)}</td>
        <td class="text-right">
          <input type="number" min="0" step="${simCartonMode ? 1 : 1}" value="${displayQty}"
                 data-key="${key}" data-coll="${coll}" data-size="${info.size}"
                 class="sim-input"
                 style="width:100px;padding:6px 8px;border-radius:6px;border:1px solid rgba(31,42,68,.18);background:#ffffff;color:#1f2a44;text-align:right;font-weight:600">
        </td>
        <td class="text-right" style="color:#8a92a3;font-size:.85rem">${tester > 0 ? '+' + tester : '—'}</td>
        <td class="text-right" style="color:${afterColor};font-weight:600">${qtyBtl === 0 ? '—' : fmtNum(after)}</td>
        <td class="text-right amount">${qtyBtl === 0 ? '—' : fmtMoney(ca)}</td>
        <td class="text-center" style="font-size:1.1rem;color:${statusColor}">${statusIcon}</td>
      </tr>`;
    });

    const collStatus = collKO > 0 ? `<span style="color:#ef4444">⚠️ ${collKO} ref(s) en rupture</span>` : (collQty > 0 ? '<span style="color:#10b981">✅ Faisable</span>' : '<span style="color:#64748b">Aucune saisie</span>');
    html += `
      <div style="background:rgba(31,42,68,.04);border-radius:8px;padding:18px;margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:10px">
          <h3 style="color:#b8860b;margin:0">
            <span class="${collClass(coll)}">${coll}</span>
            <span style="color:#5b6577;font-size:.85rem;font-weight:normal">
              (${info.price_btl}€/btl • carton de ${info.size}+1 à ${info.price_carton}€)
            </span>
          </h3>
          <div style="font-size:.95rem">${collStatus} <span style="color:#5b6577;margin-left:14px">${fmtNum(collQty)} btl • ${fmtMoney(collCA)}</span></div>
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
  const summaryColor = refsKO > 0 ? '#ef4444' : (totalBtl > 0 ? '#10b981' : '#64748b');
  const summaryMsg = refsKO > 0
    ? `❌ ${refsKO} référence(s) en rupture — produire avant`
    : (totalBtl > 0 ? `✅ Commande entièrement faisable avec le stock actuel` : 'Aucune référence saisie');
  document.getElementById('simSummary').innerHTML = `
    <div style="background:linear-gradient(135deg,rgba(184,134,11,.08),rgba(184,134,11,.02));border:1px solid ${summaryColor};border-radius:10px;padding:18px;margin-bottom:16px;display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px">
      <div><div style="color:#5b6577;font-size:.78rem;text-transform:uppercase;letter-spacing:.6px">Statut</div><div style="font-size:1.05rem;color:${summaryColor};font-weight:bold;margin-top:4px">${summaryMsg}</div></div>
      <div><div style="color:#5b6577;font-size:.78rem;text-transform:uppercase;letter-spacing:.6px">Total bouteilles</div><div style="font-size:1.6rem;color:#b8860b;font-weight:bold">${fmtNum(totalBtl)}</div></div>
      <div><div style="color:#5b6577;font-size:.78rem;text-transform:uppercase;letter-spacing:.6px">CA estimé (prix standard)</div><div style="font-size:1.6rem;color:#10b981;font-weight:bold">${fmtMoney(totalCA)}</div></div>
      <div><div style="color:#5b6577;font-size:.78rem;text-transform:uppercase;letter-spacing:.6px">Réfs OK / KO</div><div style="font-size:1.6rem;font-weight:bold"><span style="color:#10b981">${refsOK}</span> <span style="color:#8a92a3">/</span> <span style="color:#ef4444">${refsKO}</span></div></div>
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

// Year switcher (discrete picker)
const yearLabels = {'2025':'📅 2025','2026':'📅 2026','total':'🌍 Total'};
const yearPicker = document.getElementById('yearPicker');
const yearTrigger = document.getElementById('yearTrigger');
document.querySelectorAll('.year-btn').forEach(b => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.year-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    currentYear = b.dataset.year;
    document.getElementById('yearTriggerLabel').textContent = yearLabels[currentYear] || currentYear;
    yearPicker.classList.remove('open');
    yearTrigger.setAttribute('aria-expanded','false');
    renderAll();
  });
});
yearTrigger.addEventListener('click', e => {
  e.stopPropagation();
  const open = yearPicker.classList.toggle('open');
  yearTrigger.setAttribute('aria-expanded', open ? 'true' : 'false');
});
document.addEventListener('click', e => {
  if(!yearPicker.contains(e.target)){
    yearPicker.classList.remove('open');
    yearTrigger.setAttribute('aria-expanded','false');
  }
});
document.addEventListener('keydown', e => {
  if(e.key === 'Escape') { yearPicker.classList.remove('open'); yearTrigger.setAttribute('aria-expanded','false'); }
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
document.getElementById('search-evo-client').addEventListener('input', e => renderEvolutionList(e.target.value));

// Delegated click for facture rows
document.addEventListener('click', e => {
  const tr = e.target.closest('tr.clickable[data-facture]');
  if(tr) openFactureModal(tr.dataset.facture);
});

// Initial render
renderAll();
