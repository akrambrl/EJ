/* ===================== COMMANDES & FACTURES =====================
   Bons de commande + factures multi-lignes (avec référence libre).
   Seules les FACTURES alimentent le dashboard (recalcul additif, données
   d'origine préservées). Documents imprimables (PDF via le navigateur).
   Persistance localStorage + cloud (clé 'ventes', compatible). */
(function(){
  if(typeof ALL==='undefined') return;
  const MN=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const clone = o => JSON.parse(JSON.stringify(o));
  const esc = s => String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  // Factures d'origine figées (capturées une seule fois)
  const BASE_FACT = { '2025': clone(ALL['2025'].factures||[]), '2026': clone(ALL['2026'].factures||[]) };

  // Documents = commandes + factures (persistés sous 'ventes' pour compat)
  function loadDocs(){ let d=(typeof modLoad==='function')?modLoad('ventes',[]):[]; if(!Array.isArray(d)) d=[]; return d.map(x=>{ if(!x.type) x.type='facture'; if(!x.numero) x.numero=x.facture||''; return x; }); }
  let docs = loadDocs();
  const isFacture = d => d.type==='facture';

  // ---------- Multi-sociétés + devises ----------
  const SOC_DEF = (window.EJ_CONFIG && window.EJ_CONFIG.societes) || {};
  function loadSettings(){
    let s={}; try{ const r=localStorage.getItem('ej_mod_settings'); if(r) s=JSON.parse(r)||{}; }catch(e){}
    const soc={}; ['BSD','NB'].forEach(k=>{ soc[k]=Object.assign({}, SOC_DEF[k]||{}, (s.societes&&s.societes[k])||{}); });
    return { fx:(s.fx!=null?+s.fx:((window.EJ_CONFIG&&window.EJ_CONFIG.fxUSDtoEUR)||0.92)), societes:soc };
  }
  let SETT = loadSettings();
  const FX = () => SETT.fx || 0.92;
  let clientCompany = (typeof modLoad==='function') ? modLoad('clientco', {}) : {};
  let companyFilter = 'all';
  const NB_PAYS = ['Irak','Russie']; // pays rattachés par défaut à NB Evolution
  function defaultCompany(pays){ return NB_PAYS.indexOf(pays)>=0 ? 'NB' : 'BSD'; }
  function companyOf(f){ return f.societe || clientCompany[f.client] || defaultCompany(f.pays); }
  function inFilter(f){ return companyFilter==='all' || companyOf(f)===companyFilter; }
  function fxOf(f){ return f.devise==='USD' ? FX() : 1; }
  function saveSettings(){ try{ localStorage.setItem('ej_mod_settings', JSON.stringify(SETT)); }catch(e){} if(typeof cloudPush==='function') cloudPush('settings', SETT); }
  function saveClientCompany(){ try{ localStorage.setItem('ej_mod_clientco', JSON.stringify(clientCompany)); }catch(e){} if(typeof cloudPush==='function') cloudPush('clientco', clientCompany); }

  // ---------- Recalcul des agrégats (factures uniquement, converties en €) ----------
  function aggregate(F){
    let ca=0,cout=0,marge=0,btl=0,testers=0;
    const cl={},py={},rf={},co={},ctp={};
    const mo={}; MN.forEach((m,i)=>mo[i+1]={mois:m,factures:0,btl:0,ca:0,cout:0,marge:0});
    F.forEach(f=>{
      const fx=fxOf(f);
      const Fca=(f.ca||0)*fx, Fcout=(f.cout||0), Fmarge=(f.ca||0)*fx-(f.cout||0);
      ca+=Fca; cout+=Fcout; marge+=Fmarge; btl+=f.btl||0;
      const mm=+String(f.date||'').split('/')[1];
      if(mo[mm]){ mo[mm].factures++; mo[mm].btl+=f.btl||0; mo[mm].ca+=Fca; mo[mm].cout+=Fcout; mo[mm].marge+=Fmarge; }
      const ck=f.client+'|'+f.pays;
      const c=cl[ck]||(cl[ck]={client:f.client,pays:f.pays,factures:0,btl:0,testers:0,ca:0,cout:0,marge:0});
      c.factures++; c.btl+=f.btl||0; c.ca+=Fca; c.cout+=Fcout; c.marge+=Fmarge;
      const p=py[f.pays]||(py[f.pays]={pays:f.pays,clients:0,_s:{},factures:0,btl:0,ca:0,cout:0,marge:0});
      p._s[f.client]=1; p.factures++; p.btl+=f.btl||0; p.ca+=Fca; p.cout+=Fcout; p.marge+=Fmarge;
      (f.lines||[]).forEach(l=>{
        if(l.sample) return;
        testers+=l.testers||0; c.testers+=l.testers||0;
        if(l.collection==='REMISE') return;
        const Lca=(l.ca||0)*fx, Lcout=(l.cout||0), Lmarge=(l.ca||0)*fx-(l.cout||0);
        const rk=l.collection+'|'+l.reference;
        const r=rf[rk]||(rf[rk]={collection:l.collection,reference:l.reference,cartons:0,btl:0,testers:0,ca:0,cout:0,marge:0,cost_known:true});
        r.cartons+=l.cartons||0; r.btl+=l.btl||0; r.testers+=l.testers||0; r.ca+=Lca; r.cout+=Lcout; r.marge+=Lmarge;
        const c1=co[l.collection]||(co[l.collection]={collection:l.collection,_r:{},refs:0,btl:0,ca:0,cout:0,marge:0,cost_known:true});
        c1._r[l.reference]=1; c1.btl+=l.btl||0; c1.ca+=Lca; c1.cout+=Lcout; c1.marge+=Lmarge;
        const tp=ctp[ck]||(ctp[ck]={}); const e=tp[rk]||(tp[rk]={collection:l.collection,reference:l.reference,btl:0,ca:0});
        e.btl+=l.btl||0; e.ca+=Lca;
      });
    });
    const clients=Object.values(cl).sort((a,b)=>b.ca-a.ca);
    const pays=Object.values(py).map(p=>{p.clients=Object.keys(p._s).length;delete p._s;return p;}).sort((a,b)=>b.ca-a.ca);
    const refs=Object.values(rf).sort((a,b)=>b.ca-a.ca);
    const collections=Object.values(co).map(c=>{c.refs=Object.keys(c._r).length;delete c._r;return c;}).sort((a,b)=>b.ca-a.ca);
    const client_top_products={};
    Object.keys(ctp).forEach(k=>{ client_top_products[k]=Object.values(ctp[k]).sort((a,b)=>b.ca-a.ca).slice(0,3); });
    return {
      kpi_ca:ca,kpi_cout:cout,kpi_marge:marge,kpi_marge_pct_known:ca>0?(marge/ca*100):0,
      kpi_ca_known:ca,kpi_ca_unknown:0,kpi_btl:btl,kpi_testers:testers,
      kpi_factures:F.length,kpi_clients:clients.length,kpi_pays:pays.length,kpi_refs:refs.length,
      clients,pays,mois:MN.map((m,i)=>mo[i+1]),refs,collections,client_top_products,
      factures: F.map(f=>{ const fx=fxOf(f); if(fx===1) return f; return Object.assign({},f,{ ca:(f.ca||0)*fx, cout:(f.cout||0), marge:(f.ca||0)*fx-(f.cout||0), lines:(f.lines||[]).map(l=>Object.assign({},l,{ca:(l.ca||0)*fx, prix:(l.prix||0)*fx, cout:(l.cout||0), marge:(l.ca||0)*fx-(l.cout||0)})) }); })
    };
  }
  const fyear = f => String(f.date||'').split('/')[2];
  function rebuild(){
    const uf=docs.filter(isFacture);
    const y25=BASE_FACT['2025'].concat(uf.filter(f=>fyear(f)==='2025')).filter(inFilter);
    const y26=BASE_FACT['2026'].concat(uf.filter(f=>fyear(f)==='2026')).filter(inFilter);
    Object.assign(ALL['2025'], aggregate(y25));
    Object.assign(ALL['2026'], aggregate(y26));
    Object.assign(ALL['total'], aggregate(y25.concat(y26)));
  }
  function persist(){
    try{ localStorage.setItem('ej_mod_ventes', JSON.stringify(docs)); }catch(e){}
    if(typeof cloudPush==='function') cloudPush('ventes', docs);
  }
  window.__reloadVentes=function(){ docs=loadDocs(); SETT=loadSettings(); clientCompany=(typeof modLoad==='function')?modLoad('clientco',{}):{}; rebuild(); buildList(); if(typeof renderReglements==='function') renderReglements(); if(typeof buildSettingsUI==='function') buildSettingsUI(); if(typeof renderAll==='function') renderAll(); };

  // Décompte / réajout automatique des échantillons 2 ml dans le module de stock
  const norm = s => String(s||'').trim().toLowerCase();
  function adjustStock2ml(doc, sign){
    const m = (typeof MODULES!=='undefined') ? MODULES.stock2ml : null; if(!m) return;
    (doc.lines||[]).forEach(l=>{
      if(!l.sample) return; const q=+l.qty||0; if(!q) return;
      let row = m.rows.find(r=>norm(r.reference)===norm(l.reference) && (!l.gamme || norm(r.gamme)===norm(l.gamme)));
      if(!row) row = m.rows.find(r=>norm(r.reference)===norm(l.reference));
      if(row) row.qte = Math.max(0,(+row.qte||0) + sign*q);
      else if(sign<0) m.rows.push({gamme:l.gamme||'VIP',reference:l.reference,qte:0,seuil:300});
    });
    if(typeof modSave==='function') modSave(m);
    if(typeof renderModule==='function') renderModule('stock2ml');
  }
  function deductSamples(doc){ if(doc && !doc._stockDeducted){ adjustStock2ml(doc,-1); doc._stockDeducted=true; } }
  function restoreSamples(doc){ if(doc && doc._stockDeducted){ adjustStock2ml(doc,+1); doc._stockDeducted=false; } }

  // ---------- Modèle de coût d'une ligne (+ référence libre) ----------
  const costOf = c => ALL.costs ? ALL.costs[c] : null;
  const refList = c => { const C=costOf(c); return (C&&C.refs)?C.refs:[]; };
  function avgCpb(coll){ const rl=refList(coll); if(rl.length) return Math.round(rl.reduce((a,r)=>a+(r.cost_per_bottle||0),0)/rl.length*100)/100; const C=costOf(coll); return C?(C.total_fixed||0):0; }
  function defPrix(l){ const C=costOf(l.collection); if(!C) return 0; return l.mode==='unite' ? (C.standard_price_bottle||0) : (C.standard_price_carton||0); }
  function computeLine(l){
    if(l.sample){ l.collection='2 ML'; l.mode='offert'; l.cartons=0; l.btl=0; l.testers=0; l.qty=+l.qty||0; l.prix=0; l.ca=0; l.cout=0; l.marge=0; return l; }
    if(l.collection==='REMISE'){ l.mode='remise'; l.cartons=0; l.btl=0; l.testers=0; l.ca=-Math.abs(+l.prix||0); l.cout=0; l.marge=l.ca; return l; }
    const C=costOf(l.collection); const cs=C?(C.carton_size||10):10;
    let cpb,cpcs;
    if(l.custom){ cpb=+l.customCost||0; cpcs=cpb*(cs+1); }
    else { const ref=(C&&C.refs||[]).find(r=>r.name===l.reference); cpb=ref?ref.cost_per_bottle:(C?(C.total_fixed||0):0); cpcs=ref?ref.cost_per_carton_sold:(cpb*(cs+1)); }
    if(l.mode==='unite'){
      l.cartons=0; l.btl=+l.btl||0; l.testers=+l.testers||0;
      l.ca=l.btl*(+l.prix||0); l.cout=(l.btl+l.testers)*cpb; l.marge=l.ca-l.cout;
    } else {
      l.mode='carton'; l.cartons=+l.cartons||0; l.btl=l.cartons*cs; l.testers=l.cartons;
      l.ca=l.cartons*(+l.prix||0); l.cout=l.cartons*cpcs; l.marge=l.ca-l.cout;
    }
    return l;
  }

  // ---------- Dates / numéros ----------
  function todayISO(){ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
  function iso2fr(s){ if(!s) return ''; const p=s.split('-'); return p.length===3 ? p[2]+'/'+p[1]+'/'+p[0] : s; }
  function fr2iso(s){ if(!s) return ''; const p=String(s).split('/'); return p.length===3 ? p[2]+'-'+p[1].padStart(2,'0')+'-'+p[0].padStart(2,'0') : s; }
  function addDaysFr(frDate, days){ const iso=fr2iso(frDate); if(!iso) return ''; const d=new Date(iso+'T00:00:00'); if(isNaN(d)) return ''; d.setDate(d.getDate()+days); return iso2fr(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')); }
  // Statut de paiement effectif (calcule « En retard » si échéance dépassée et non payée)
  function payStatut(d){ if(d.statut==='Payée') return 'Payée'; const ech=fr2iso(d.echeance); if(ech && ech < todayISO()) return 'En retard'; return 'En attente'; }
  function daysLate(d){ const ech=fr2iso(d.echeance); if(!ech) return 0; const ms=new Date(todayISO()+'T00:00:00')-new Date(ech+'T00:00:00'); return Math.max(0, Math.round(ms/86400000)); }
  function prefOf(s,type){ return type==='facture'?(s.prefFac||'EJ'):type==='commande'?(s.prefCmd||'BC'):(s.prefDev||'DEV'); }
  function nextNum(type,year){
    const s = (SETT.societes && SETT.societes[draft.societe]) || {};
    const pre = prefOf(s,type);
    let mx=0; const re=new RegExp('^'+pre+year+'(\\d+)$');
    BASE_FACT['2025'].concat(BASE_FACT['2026'],docs).forEach(f=>{ const m=String(f.numero||f.facture||'').match(re); if(m) mx=Math.max(mx,+m[1]); });
    return pre+year+String(mx+1).padStart(3,'0');
  }

  // ---------- État du brouillon ----------
  const sec=document.getElementById('saisie'); if(!sec) return;
  const $=id=>document.getElementById(id);
  let docType='devis', lastAutoNum='';
  function newLine(){ const coll=Object.keys(ALL.costs||{})[0]||'VIP'; const rl=refList(coll); const l={collection:coll,reference:rl[0]?rl[0].name:'',mode:'carton',cartons:1,prix:0}; l.prix=defPrix(l); return computeLine(l); }
  let draft={ societe:'BSD', lines:[ newLine() ] };
  function clientPaysMap(){ const m={}; (ALL.total.clients||[]).forEach(c=>{ if(c.client && !m[c.client]) m[c.client]=c.pays; }); docs.forEach(d=>{ if(d.client && !m[d.client]) m[d.client]=d.pays||''; }); return m; }
  // Affichage dans la devise de la société du brouillon (coût toujours en €, converti pour l'affichage NB)
  const curSym = () => draft.societe==='NB' ? '$' : '€';
  const dm = n => Math.round(n||0).toLocaleString('fr-FR') + ' ' + curSym();
  const coutDisp = l => draft.societe==='NB' ? (l.cout/(FX()||1)) : l.cout;
  const margeDisp = l => (l.ca||0) - coutDisp(l);

  function collOptions(sel){ return Object.keys(ALL.costs||{}).map(k=>`<option value="${k}"${k===sel?' selected':''}>${k}</option>`).join(''); }
  function refOptions(coll,sel){ return refList(coll).map(r=>`<option value="${esc(r.name).replace(/"/g,'&quot;')}"${r.name===sel?' selected':''}>${esc(r.name)}</option>`).join('') + '<option value="__custom__">✏️ Autre référence…</option>'; }

  function newSample(){ return {sample:true,collection:'2 ML',gamme:'VIP',reference:'',qty:1,mode:'offert',cartons:0,btl:0,testers:0,prix:0,ca:0,cout:0,marge:0}; }
  function lineRow(l,i){
    if(l.sample){
      return `<tr data-i="${i}">
        <td><select class="mod-in sa-f" data-f="sgamme" style="min-width:80px"><option value="CP"${l.gamme==='CP'?' selected':''}>CP</option><option value="ROYAL"${l.gamme==='ROYAL'?' selected':''}>ROYAL</option><option value="VIP"${l.gamme==='VIP'?' selected':''}>VIP</option></select></td>
        <td><input class="mod-in sa-f" data-f="sref" list="sa-2ml-list" value="${esc(l.reference).replace(/"/g,'&quot;')}" placeholder="Référence 2 ml" style="width:100%"></td>
        <td style="text-align:center"><span class="badge-doc" style="background:#e0f2fe;color:#075985">2 ML OFFERT</span></td>
        <td><input class="mod-in sa-n" type="number" min="0" data-f="sqty" value="${l.qty||0}" style="text-align:right" title="Flacons 2 ml offerts"></td>
        <td class="text-right" style="color:#9aa1b0">—</td>
        <td class="text-right" style="color:#9aa1b0">—</td><td class="text-right" style="color:#9aa1b0">—</td>
        <td class="text-right" style="color:#0369a1;font-weight:700">offert</td>
        <td class="text-right" style="color:#9aa1b0">—</td>
        <td class="text-right" style="color:#9aa1b0">—</td>
        <td style="text-align:center"><span class="mod-del" data-i="${i}" style="cursor:pointer;color:#dc2626">🗑️</span></td>
      </tr>`;
    }
    if(l.collection==='REMISE'){
      return `<tr data-i="${i}">
        <td><span class="badge badge-remise">REMISE</span></td>
        <td><input class="mod-in sa-f" data-f="reference" value="${esc(l.reference).replace(/"/g,'&quot;')}" style="width:100%"></td>
        <td style="text-align:center;color:#9aa1b0">—</td>
        <td class="text-right" style="color:#9aa1b0">—</td>
        <td><input class="mod-in sa-n" type="number" step="0.01" data-f="remise" value="${Math.abs(l.prix||0)}" style="text-align:right" placeholder="montant"></td>
        <td class="text-right" style="color:#9aa1b0">—</td><td class="text-right" style="color:#9aa1b0">—</td>
        <td class="text-right amount" data-c="ca">${dm(l.ca)}</td>
        <td class="text-right" style="color:#9aa1b0">—</td>
        <td class="text-right amount-negative" data-c="marge">${dm(l.ca)}</td>
        <td style="text-align:center"><span class="mod-del" data-i="${i}" style="cursor:pointer;color:#dc2626">🗑️</span></td>
      </tr>`;
    }
    const refCell = l.custom
      ? `<input class="mod-in sa-f" data-f="customname" value="${esc(l.reference).replace(/"/g,'&quot;')}" placeholder="Nom de la référence" style="width:100%;margin-bottom:4px">
         <div style="display:flex;align-items:center;gap:4px"><input class="mod-in sa-n" type="number" step="0.01" min="0" data-f="customcost" value="${l.customCost||0}" title="Coût par bouteille (€)" style="width:74px;text-align:right"><span style="font-size:.7rem;color:#9aa1b0">€/btl</span><span class="sa-uncustom" data-i="${i}" title="Choisir dans la liste" style="cursor:pointer;color:#b8860b;font-weight:700">↩</span></div>`
      : `<select class="mod-in sa-f" data-f="reference">${refOptions(l.collection,l.reference)}</select>`;
    const qty = l.mode==='unite' ? l.btl : l.cartons;
    return `<tr data-i="${i}">
      <td><select class="mod-in sa-f" data-f="collection">${collOptions(l.collection)}</select></td>
      <td style="min-width:160px">${refCell}</td>
      <td><select class="mod-in sa-f" data-f="mode"><option value="carton"${l.mode!=='unite'?' selected':''}>Carton</option><option value="unite"${l.mode==='unite'?' selected':''}>Unité</option></select></td>
      <td><input class="mod-in sa-n" type="number" min="0" data-f="qty" value="${qty}" style="text-align:right"></td>
      <td><input class="mod-in sa-n" type="number" min="0" step="0.01" data-f="prix" value="${l.prix}" style="text-align:right"></td>
      <td class="text-right" data-c="btl">${fmtNum(l.btl)}</td>
      <td class="text-right" data-c="testers">${l.testers}</td>
      <td class="text-right amount" data-c="ca">${dm(l.ca)}</td>
      <td class="text-right amount-negative" data-c="cout">${dm(coutDisp(l))}</td>
      <td class="text-right amount-positive" data-c="marge">${dm(margeDisp(l))}</td>
      <td style="text-align:center"><span class="mod-del" data-i="${i}" style="cursor:pointer;color:#dc2626">🗑️</span></td>
    </tr>`;
  }
  function renderLines(){ $('sa-lines').innerHTML = draft.lines.map((l,i)=>lineRow(l,i)).join(''); }
  function updateRowCells(tr,l){
    const set=(c,v)=>{ const td=tr.querySelector('[data-c="'+c+'"]'); if(td) td.textContent=v; };
    if(l.collection==='REMISE'){ set('ca',dm(l.ca)); set('marge',dm(l.ca)); return; }
    set('btl',fmtNum(l.btl)); set('testers',l.testers); set('ca',dm(l.ca)); set('cout',dm(coutDisp(l))); set('marge',dm(margeDisp(l)));
  }
  function totals(){ return draft.lines.reduce((a,l)=>{a.ca+=l.ca||0;a.cout+=l.cout||0;a.marge+=l.marge||0;a.btl+=l.btl||0;return a;},{ca:0,cout:0,marge:0,btl:0}); }
  function renderTotals(){
    const t=totals();
    const coutT = draft.societe==='NB' ? (t.cout/(FX()||1)) : t.cout;
    const margeT = t.ca - coutT;
    const pct = t.ca>0 ? (margeT/t.ca*100) : 0;
    $('sa-totals').innerHTML=`
      <div class="st"><div class="st-label">Chiffre d'affaires</div><div class="st-val gold">${dm(t.ca)}</div></div>
      <div class="st"><div class="st-label">Coût</div><div class="st-val">${dm(coutT)}</div></div>
      <div class="st"><div class="st-label">Bénéfice</div><div class="st-val green">${dm(margeT)} <span style="font-size:.9rem;opacity:.8">(${pct.toFixed(1)}%)</span></div></div>
      <div class="st"><div class="st-label">Bouteilles</div><div class="st-val">${fmtNum(t.btl)}</div></div>`;
  }
  function buildList(){
    const w=$('sa-listwrap'); if(!w) return;
    if(!docs.length){ w.innerHTML=''; return; }
    const items=docs.map((d,i)=>({d,i})).sort((a,b)=>(b.d.createdAt||0)-(a.d.createdAt||0));
    const rows=items.map(({d,i})=>{
      const badge = d.type==='facture'?'<span class="badge-doc badge-fact">FACTURE</span>':d.type==='commande'?'<span class="badge-doc badge-cmd">COMMANDE</span>':'<span class="badge-doc badge-dev">DEVIS</span>';
      const co = companyOf(d)==='NB'?'🇦🇪 NB':'🇫🇷 BSD';
      const sym = (d.devise==='USD')?'$':'€';
      let conv='';
      if(d.type==='devis') conv=`<span class="sa-act conv" data-act="tocmd" data-i="${i}">➡️ Commande</span><span class="sa-act conv" data-act="tofac" data-i="${i}">🧾 Facturer</span>`;
      else if(d.type==='commande') conv=`<span class="sa-act conv" data-act="tofac" data-i="${i}">🧾 Facturer</span>`;
      const from = d.bcNumero?`<div style="font-size:.7rem;color:#9aa1b0">issu de ${esc(d.bcNumero)}</div>`:'';
      return `<tr><td><strong>${esc(d.numero||d.facture||'')}</strong>${from}</td><td>${badge}</td><td>${co}</td><td>${esc(d.date)}</td><td>${esc(d.client)}</td><td>${esc(d.pays)}</td><td class="text-right amount">${Math.round(d.ca).toLocaleString('fr-FR')} ${sym}</td><td style="text-align:right;white-space:nowrap"><span class="sa-act" data-act="print" data-i="${i}">🖨️ PDF</span>${conv}<span class="sa-act del" data-act="del" data-i="${i}">🗑️</span></td></tr>`;
    }).join('');
    w.innerHTML=`<h3>📋 Mes documents (${docs.length})</h3>
      <div class="info-box" style="background:#eef6ff;border-left-color:#3b82f6;color:#1e3a5f">Seules les <strong>factures</strong> entrent dans le CA. Un <strong>devis</strong> se transforme en commande ou directement en facture ; une <strong>commande</strong> se transforme en facture. <strong>« PDF »</strong> ouvre le document imprimable à envoyer au client.</div>
      <div class="table-wrap"><table><thead><tr><th>N°</th><th>Type</th><th>Société</th><th>Date</th><th>Client</th><th>Pays</th><th class="text-right">Montant</th><th class="text-right">Actions</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  // ===== Suivi des règlements (vraies factures) =====
  function reglMoney(d){ const sym=(d.devise==='USD')?'$':'€'; return Math.round(d.ca||0).toLocaleString('fr-FR')+' '+sym; }
  function renderReglements(){
    const sumEl=$('tresoFactSummary'), cont=$('tresoFactContent'); if(!cont) return;
    const facts=docs.map((d,i)=>({d,i})).filter(x=>x.d.type==='facture');
    if(!facts.length){ if(sumEl) sumEl.innerHTML=''; cont.innerHTML='<div class="info-box">Aucune facture créée pour le moment. Crée une facture dans « 🧾 Commandes & Factures » : elle apparaîtra ici pour le suivi du règlement.</div>'; return; }
    let encE=0,attE=0,retE=0,encU=0,attU=0,retU=0;
    facts.forEach(({d})=>{ const st=payStatut(d); const usd=d.devise==='USD'; const v=d.ca||0;
      if(st==='Payée'){ usd?encU+=v:encE+=v; } else if(st==='En retard'){ usd?retU+=v:retE+=v; } else { usd?attU+=v:attE+=v; } });
    const e=v=>Math.round(v).toLocaleString('fr-FR')+' €', u=v=>Math.round(v).toLocaleString('fr-FR')+' $';
    const dual=(ve,vu)=>e(ve)+(vu?' · '+u(vu):'');
    if(sumEl) sumEl.innerHTML=`<div class="kpis" style="margin-bottom:16px">
      <div class="kpi success"><div class="kpi-label">Encaissé</div><div class="kpi-value">${dual(encE,encU)}</div></div>
      <div class="kpi"><div class="kpi-label">En attente</div><div class="kpi-value">${dual(attE,attU)}</div></div>
      <div class="kpi danger"><div class="kpi-label">En retard</div><div class="kpi-value">${dual(retE,retU)}</div></div>
      <div class="kpi"><div class="kpi-label">Reste à encaisser</div><div class="kpi-value">${dual(attE+retE,attU+retU)}</div></div>
    </div>`;
    const order={'En retard':0,'En attente':1,'Payée':2};
    const sorted=facts.slice().sort((a,b)=>{ const sa=order[payStatut(a.d)], sb=order[payStatut(b.d)]; if(sa!==sb) return sa-sb; return (fr2iso(a.d.echeance)||'').localeCompare(fr2iso(b.d.echeance)||''); });
    const body=sorted.map(({d,i})=>{
      const st=payStatut(d); const co=companyOf(d)==='NB'?'🇦🇪 NB':'🇫🇷 BSD';
      const badge = st==='Payée'?'<span class="badge-doc" style="background:#10b981">Payée</span>': st==='En retard'?`<span class="badge-doc" style="background:#ef4444">En retard (${daysLate(d)} j)</span>`:'<span class="badge-doc" style="background:#f59e0b">En attente</span>';
      const opts=['En attente','Payée'].map(o=>`<option${(d.statut==='Payée')===(o==='Payée')?' selected':''}>${o}</option>`).join('');
      return `<tr>
        <td><strong>${esc(d.numero||d.facture||'')}</strong></td>
        <td>${co}</td>
        <td>${esc(d.client)}</td>
        <td>${esc(d.date)}</td>
        <td><input type="date" class="regl-ech" data-i="${i}" value="${fr2iso(d.echeance)}" style="padding:7px 9px;border:1px solid rgba(31,42,68,.14);border-radius:9px;font-weight:600"></td>
        <td class="text-right amount">${reglMoney(d)}</td>
        <td>${badge}</td>
        <td><select class="regl-st" data-i="${i}" style="padding:7px 9px;border:1px solid rgba(31,42,68,.14);border-radius:9px;font-weight:600">${opts}</select></td>
      </tr>`;
    }).join('');
    cont.innerHTML=`<div class="table-wrap"><table><thead><tr><th>N°</th><th>Société</th><th>Client</th><th>Date</th><th>Échéance</th><th class="text-right">Montant</th><th>Statut</th><th>Marquer</th></tr></thead><tbody>${body}</tbody></table></div>`;
  }
  window.renderReglements = renderReglements;

  // Relances impayés injectées dans « Remarques intelligentes »
  window.relanceInsights = function(){
    return docs.filter(d=>d.type==='facture' && payStatut(d)==='En retard')
      .sort((a,b)=>daysLate(b)-daysLate(a))
      .map(d=>({icon:'⏰',level:'danger',title:'Facture en retard — '+esc(d.client),
        desc:'Facture '+esc(d.numero||d.facture||'')+' de '+reglMoney(d)+' — échéance du '+esc(d.echeance||'?')+' dépassée de '+daysLate(d)+' jour(s). À relancer.'}));
  };

  // Export comptable CSV (toutes les factures : historique + créées)
  function csvCell(v){ v=String(v==null?'':v); return /[";\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v; }
  function exportComptable(){
    const out=[]; const header=['Société','Numéro','Date','Échéance','Devise','Client','Pays','CA','Coût','Bénéfice','Statut'];
    const push=(d,base)=>{ const co=companyOf(d); const dev=d.devise||'EUR';
      out.push([co,d.numero||d.facture||'',d.date||'',d.echeance||'',dev,d.client||'',d.pays||'',Math.round(d.ca||0),Math.round(d.cout||0),Math.round(d.marge||0),base?'Payée':payStatut(d)]); };
    BASE_FACT['2025'].concat(BASE_FACT['2026']).forEach(d=>push(d,true));
    docs.filter(d=>d.type==='facture').forEach(d=>push(d,false));
    const csv=[header].concat(out).map(r=>r.map(csvCell).join(';')).join('\r\n');
    const blob=new Blob([String.fromCharCode(0xFEFF)+csv],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob); const a=document.createElement('a');
    a.href=url; a.download='factures_EJ_'+todayISO()+'.csv'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function populateDatalists(){
    const m=(typeof MODULES!=='undefined')?MODULES.stock2ml:null; const dl=$('sa-2ml-list');
    if(m&&dl) dl.innerHTML=m.rows.map(r=>`<option value="${esc(r.reference).replace(/"/g,'&quot;')}">${esc(r.gamme)}`).join('');
  }
  // Liste déroulante custom (le <datalist> natif ne fonctionne pas sur iOS Safari)
  function attachAutocomplete(input, getItems, onPick){
    if(!input) return;
    const box=document.createElement('div'); box.className='ac-list'; box.style.display='none';
    input.parentNode.appendChild(box);
    let active=-1, current=[];
    function render(){
      const q=input.value.trim().toLowerCase();
      const items=getItems();
      current=(q?items.filter(it=>it.label.toLowerCase().includes(q)):items.slice()).slice(0,60);
      if(!items.length){ box.style.display='none'; return; }
      if(!current.length){ box.innerHTML='<div class="ac-empty">Aucun client correspondant</div>'; box.style.display='block'; return; }
      box.innerHTML=current.map((it,idx)=>`<div class="ac-item${idx===active?' active':''}" data-idx="${idx}"><span>${esc(it.label)}</span>${it.sub?`<span class="ac-sub">${esc(it.sub)}</span>`:''}</div>`).join('');
      box.style.display='block';
    }
    function hide(){ box.style.display='none'; active=-1; }
    function pick(idx){ const it=current[idx]; if(!it) return; input.value=it.label; hide(); if(onPick) onPick(it); input.dispatchEvent(new Event('change',{bubbles:true})); }
    input.addEventListener('input', ()=>{ active=-1; render(); });
    input.addEventListener('focus', render);
    input.addEventListener('keydown', e=>{
      if(box.style.display==='none') return;
      if(e.key==='ArrowDown'){ e.preventDefault(); active=Math.min(active+1,current.length-1); render(); }
      else if(e.key==='ArrowUp'){ e.preventDefault(); active=Math.max(active-1,0); render(); }
      else if(e.key==='Enter'){ if(active>=0){ e.preventDefault(); pick(active); } }
      else if(e.key==='Escape'){ hide(); }
    });
    box.addEventListener('mousedown', e=>{ const it=e.target.closest('.ac-item'); if(it){ e.preventDefault(); pick(+it.dataset.idx); } });
    document.addEventListener('click', e=>{ if(!input.parentNode.contains(e.target)) hide(); });
  }

  // ---------- Document imprimable (PDF) ----------
  function printDoc(d){
    const code = d.societe || companyOf(d) || 'BSD';
    const SOC = (SETT.societes && SETT.societes[code]) || (SETT.societes && SETT.societes.BSD) || {};
    const sym = (d.devise==='USD') ? '$' : '€';
    const money = n => (Math.round(n*100)/100).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' ' + sym;
    const isFac = isFacture(d);
    const title = d.type==='facture' ? 'FACTURE' : d.type==='commande' ? 'BON DE COMMANDE' : 'DEVIS';
    const num = d.numero||d.facture||'';
    const socLines=[
      SOC.nom?('<strong>'+esc(SOC.nom)+'</strong>'):'',
      SOC.adresse?esc(SOC.adresse):'',
      SOC.cp_ville?esc(SOC.cp_ville):'',
      SOC.pays?esc(SOC.pays):'',
      [SOC.ident?esc(SOC.ident):'', SOC.tva?('TVA '+esc(SOC.tva)):''].filter(Boolean).join(' · '),
      SOC.email?esc(SOC.email):'', SOC.tel?esc(SOC.tel):''
    ].filter(Boolean).join('<br>');
    const legal=[SOC.nom, SOC.forme, (SOC.adresse&&SOC.cp_ville)?(SOC.adresse+', '+SOC.cp_ville):(SOC.cp_ville||SOC.adresse), SOC.pays, SOC.ident, SOC.rcs, SOC.tva?('TVA '+SOC.tva):'', SOC.ape?('APE '+SOC.ape):''].filter(Boolean).map(esc).join(' — ');
    const linesHtml=(d.lines||[]).map(l=>{
      if(l.sample) return `<tr><td>Échantillon 2 ml</td><td>${esc(l.reference)}${l.gamme?(' ('+esc(l.gamme)+')'):''}</td><td class="r">${fmtNum(l.qty)} flacon(s)</td><td class="r">offert</td><td class="r">${money(0)}</td></tr>`;
      if(l.collection==='REMISE') return `<tr><td colspan="4">${esc(l.reference||'Remise')}</td><td class="r">${money(l.ca)}</td></tr>`;
      const qty = l.mode==='unite' ? (fmtNum(l.btl)+' btl') : (l.cartons+' cart. ('+fmtNum(l.btl)+' btl)');
      return `<tr><td>${esc(l.collection)}</td><td>${esc(l.reference)}</td><td class="r">${qty}</td><td class="r">${money(l.prix)}</td><td class="r">${money(l.ca)}</td></tr>`;
    }).join('');
    const regime = d.tvaRegime || 'export';
    const rate = regime==='fr20' ? 20 : 0;
    const tvaMention = regime==='export' ? 'Exonération de TVA — art. 262 I du CGI (exportation hors Union européenne).'
      : regime==='intracom' ? 'Exonération de TVA — art. 262 ter I du CGI (livraison intracommunautaire) — autoliquidation par le preneur.'
      : regime==='none' ? 'TVA non applicable.'
      : '';
    let totRows;
    if(rate>0){ const ht=d.ca, tva=ht*rate/100, ttc=ht+tva;
      totRows = `<tr><td>Total bouteilles</td><td class="r">${fmtNum(d.btl)}</td></tr>
        <tr><td>Total HT</td><td class="r">${money(ht)}</td></tr>
        <tr><td>TVA ${rate} %</td><td class="r">${money(tva)}</td></tr>
        <tr class="pd-grand"><td>Total TTC</td><td class="r">${money(ttc)}</td></tr>`;
    } else {
      totRows = `<tr><td>Total bouteilles</td><td class="r">${fmtNum(d.btl)}</td></tr>
        <tr class="pd-grand"><td>Total à payer</td><td class="r">${money(d.ca)}</td></tr>`;
    }
    const brandName = code==='NB' ? 'NB Evolution' : 'Emmanuelle Jane';
    const brandSub  = code==='NB' ? 'ÉMIRATS' : 'PARIS';
    const cur = d.devise==='USD' ? 'dollars (USD)' : 'euros (EUR)';
    const baseNote = isFac
      ? 'Montants exprimés en '+cur+'. Conditions de règlement : à réception, sauf accord particulier.'
      : d.type==='devis'
        ? 'Devis valable 30 jours à compter de la date ci-dessus. Pour confirmer votre commande, retournez ce devis daté et signé (bon pour accord). Montants en '+cur+'.'
        : 'Bon de commande valable 30 jours à compter de la date ci-dessus. Livraison et règlement selon conditions convenues. Montants en '+cur+'.';
    const noteText = (tvaMention ? '<strong>'+tvaMention+'</strong> ' : '') + baseNote;
    const note = isFac
      ? `<div class="pd-note">${noteText}</div>`
      : `<div class="pd-note">${noteText}</div>
         <div class="pd-sign"><div>Cachet &amp; signature du client<br><span style="color:#9aa1b0">(bon pour accord)</span></div><div>${esc(SOC.nom||brandName)}</div></div>`;
    const p=$('ej-print');
    p.innerHTML=`<style>
      #ej-print{font-family:Georgia,'Times New Roman',serif;color:#1f2a44;background:#fff;padding:46px 52px;font-size:13px;line-height:1.5}
      #ej-print .pd-top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1f2a44;padding-bottom:18px}
      #ej-print .pd-brand{font-family:'Parisienne',cursive;font-size:42px;line-height:1;color:#1f2a44}
      #ej-print .pd-sub{letter-spacing:.45em;font-size:11px;color:#b8860b;font-weight:bold;margin-top:2px}
      #ej-print .pd-soc{font-size:10.5px;color:#5b6577;margin-top:10px;line-height:1.6}
      #ej-print .pd-doc{text-align:right}
      #ej-print .pd-doc h1{font-size:24px;letter-spacing:.1em;margin:0 0 6px;color:#1f2a44}
      #ej-print .pd-num{font-size:15px;font-weight:bold;color:#b8860b}
      #ej-print .pd-doc .pd-d{font-size:12px;color:#5b6577;margin-top:2px}
      #ej-print .pd-client{margin:24px 0 6px;padding:14px 18px;background:#f7f3ec;border-radius:8px;display:inline-block;min-width:240px}
      #ej-print .pd-lab{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:#b8860b;font-weight:bold;margin-bottom:4px}
      #ej-print .pd-cli{font-size:16px;font-weight:bold}
      #ej-print table.pd-t{width:100%;border-collapse:collapse;margin:18px 0 6px}
      #ej-print table.pd-t th{background:#1f2a44;color:#fff;text-align:left;padding:9px 10px;font-size:11px;letter-spacing:.03em}
      #ej-print table.pd-t th.r,#ej-print table.pd-t td.r{text-align:right}
      #ej-print table.pd-t td{padding:8px 10px;border-bottom:1px solid #e7e1d4;font-size:12px}
      #ej-print .pd-tot{display:flex;justify-content:flex-end;margin-top:8px}
      #ej-print .pd-tot table{border-collapse:collapse;min-width:260px}
      #ej-print .pd-tot td{padding:6px 10px}
      #ej-print .pd-tot .pd-grand td{font-size:17px;font-weight:bold;border-top:2px solid #1f2a44}
      #ej-print .pd-note{margin-top:28px;font-size:11px;color:#5b6577}
      #ej-print .pd-sign{margin-top:40px;display:flex;justify-content:space-between}
      #ej-print .pd-sign div{width:44%;border-top:1px solid #9aa1b0;padding-top:6px;font-size:11px;color:#5b6577}
      #ej-print .pd-foot{margin-top:42px;border-top:1px solid #e7e1d4;padding-top:12px;text-align:center;font-size:10px;color:#9aa1b0}
    </style>
    <div class="pd-top">
      <div><div class="pd-brand">${esc(brandName)}</div><div class="pd-sub">${esc(brandSub)}</div>${socLines?`<div class="pd-soc">${socLines}</div>`:''}</div>
      <div class="pd-doc"><h1>${title}</h1><div class="pd-num">N° ${esc(num)}</div><div class="pd-d">Date : ${esc(d.date)}</div></div>
    </div>
    <div class="pd-client"><div class="pd-lab">${isFac?'Facturé à':'Client'}</div><div class="pd-cli">${esc(d.client)}</div><div>${esc(d.pays)}</div></div>
    <table class="pd-t"><thead><tr><th>Collection</th><th>Référence</th><th class="r">Quantité</th><th class="r">Prix unit.</th><th class="r">Montant</th></tr></thead><tbody>${linesHtml}</tbody></table>
    <div class="pd-tot"><table>${totRows}</table></div>
    ${note}
    <div class="pd-foot">${legal||'Emmanuelle Jane Paris'}<br><span style="opacity:.8">Document généré le ${iso2fr(todayISO())}</span></div>`;
    setTimeout(()=>window.print(), 60);
  }

  function convertDoc(i, target){
    const d=docs[i]; if(!d) return;
    const yr=String(d.date||'').split('/')[2]; const year=(yr==='2025'||yr==='2026')?yr:String(new Date().getFullYear());
    const co=companyOf(d); const s=(SETT.societes&&SETT.societes[co])||{}; const pre=prefOf(s,target);
    let mx=0; const re=new RegExp('^'+pre+year+'(\\d+)$');
    BASE_FACT['2025'].concat(BASE_FACT['2026'],docs).forEach(f=>{ const m=String(f.numero||f.facture||'').match(re); if(m) mx=Math.max(mx,+m[1]); });
    const old=d.numero;
    d.bcNumero=old;
    d.type=target;
    d.numero=pre+year+String(mx+1).padStart(3,'0');
    if(target==='facture'){ d.facture=d.numero; if(!d.statut) d.statut='En attente'; if(!d.echeance) d.echeance=addDaysFr(d.date,30); } else { delete d.facture; }
    d.createdAt=Date.now();
    if(target==='facture') deductSamples(d);
    persist(); if(target==='facture'){ rebuild(); if(typeof renderAll==='function') renderAll(); } buildList(); renderReglements();
    const lab = target==='facture'?'facture':target==='commande'?'bon de commande':'devis';
    showSectionMsg('✅ '+old+' transformé en '+lab+' '+d.numero+(target==='facture'?' — dashboard mis à jour.':'.'), true);
  }

  // ---------- Interactions ----------
  const linesEl=$('sa-lines');
  linesEl.addEventListener('input', e=>{
    const inp=e.target.closest('input.sa-n, input.sa-f'); if(!inp) return;
    const tr=e.target.closest('tr'); const l=draft.lines[+tr.dataset.i]; if(!l) return;
    const f=inp.dataset.f, v=inp.value;
    if(f==='qty'){ if(l.mode==='unite') l.btl=+v||0; else l.cartons=+v||0; }
    else if(f==='prix'){ l.prix=+v||0; }
    else if(f==='remise'){ l.prix=-Math.abs(+v||0); }
    else if(f==='reference'){ l.reference=v; }
    else if(f==='customname'){ l.reference=v; }
    else if(f==='customcost'){ l.customCost=+v||0; }
    else if(f==='sref'){ l.reference=v; }
    else if(f==='sqty'){ l.qty=+v||0; }
    computeLine(l); updateRowCells(tr,l); renderTotals();
  });
  linesEl.addEventListener('change', e=>{
    const sel=e.target.closest('select.sa-f'); if(!sel) return;
    const tr=e.target.closest('tr'); const l=draft.lines[+tr.dataset.i]; if(!l) return;
    const f=sel.dataset.f, v=sel.value;
    if(f==='collection'){ l.collection=v; l.custom=false; const rl=refList(v); l.reference=rl[0]?rl[0].name:''; l.prix=defPrix(l); }
    else if(f==='reference'){ if(v==='__custom__'){ l.custom=true; l.customCost=avgCpb(l.collection); l.reference=''; } else l.reference=v; }
    else if(f==='mode'){ l.mode=v; l.prix=defPrix(l); }
    else if(f==='sgamme'){ l.gamme=v; }
    computeLine(l); renderLines(); renderTotals();
  });
  linesEl.addEventListener('click', e=>{
    const un=e.target.closest('.sa-uncustom');
    if(un){ const l=draft.lines[+un.dataset.i]; if(l){ l.custom=false; const rl=refList(l.collection); l.reference=rl[0]?rl[0].name:''; computeLine(l); renderLines(); renderTotals(); } return; }
    const del=e.target.closest('.mod-del'); if(!del) return;
    draft.lines.splice(+del.dataset.i,1);
    if(!draft.lines.length) draft.lines.push(newLine());
    renderLines(); renderTotals();
  });
  $('sa-addline').addEventListener('click', ()=>{ draft.lines.push(newLine()); renderLines(); renderTotals(); });
  $('sa-addremise').addEventListener('click', ()=>{ draft.lines.push(computeLine({collection:'REMISE',reference:'Réduction exceptionnelle',mode:'remise',prix:0})); renderLines(); renderTotals(); });
  $('sa-addsample').addEventListener('click', ()=>{ draft.lines.push(computeLine(newSample())); renderLines(); renderTotals(); });

  const DOCLAB={devis:'devis',commande:'bon de commande',facture:'facture'};
  function applyDocType(){
    sec.querySelectorAll('#sa-doctype .doc-type-btn').forEach(x=>x.classList.toggle('active', x.dataset.type===docType));
    $('sa-numlabel').firstChild.textContent = 'N° '+DOCLAB[docType];
    $('sa-savelabel').textContent = docType==='facture' ? 'Enregistrer la facture' : 'Enregistrer le '+DOCLAB[docType];
    lastAutoNum=nextNum(docType, ($('sa-date').value||todayISO()).split('-')[0]);
    $('sa-fact').value=lastAutoNum;
  }
  $('sa-doctype').addEventListener('click', e=>{ const b=e.target.closest('.doc-type-btn'); if(!b) return; docType=b.dataset.type; applyDocType(); });

  function applyCompany(){
    sec.querySelectorAll('#sa-company .doc-type-btn').forEach(x=>x.classList.toggle('active', x.dataset.co===draft.societe));
    const tva=$('sa-tva');
    if(tva){ if(draft.societe==='NB'){ tva.value='none'; tva.disabled=true; } else { tva.disabled=false; if(tva.value==='none') tva.value=(SETT.societes.BSD&&SETT.societes.BSD.tvaDefault)||'export'; } }
    applyDocType();      // recalcule le numéro avec le préfixe de la société
    renderLines(); renderTotals();
  }
  $('sa-company').addEventListener('click', e=>{ const b=e.target.closest('.doc-type-btn'); if(!b) return; draft.societe=b.dataset.co; applyCompany(); });

  // Filtre société (topbar)
  const coSel=$('ejCoFilter');
  if(coSel) coSel.addEventListener('change', ()=>{ companyFilter=coSel.value; rebuild(); if(typeof renderAll==='function') renderAll(); });

  $('sa-date').addEventListener('change', ()=>{
    const y=($('sa-date').value||'').split('-')[0];
    if(y && (!$('sa-fact').value.trim() || $('sa-fact').value===lastAutoNum)){ lastAutoNum=nextNum(docType,y); $('sa-fact').value=lastAutoNum; }
  });
  $('sa-client').addEventListener('change', ()=>{
    const cmap=clientPaysMap(); const c=$('sa-client').value.trim();
    if(cmap[c] && !$('sa-pays').value.trim()) $('sa-pays').value=cmap[c];
  });

  function showSectionMsg(txt,ok){ const m=$('sa-msg'); m.textContent=txt; m.style.color=ok?'#0f9d6f':'#dc2626'; if(txt) setTimeout(()=>{ if(m.textContent===txt) m.textContent=''; }, 6000); }
  function resetDraft(){ const co=draft.societe||'BSD'; draft={societe:co,lines:[newLine()]}; $('sa-client').value=''; $('sa-pays').value=''; $('sa-date').value=todayISO(); applyCompany(); }

  $('sa-reset').addEventListener('click', ()=>{ resetDraft(); showSectionMsg('',true); });
  $('sa-save').addEventListener('click', ()=>{
    const numero=$('sa-fact').value.trim(), iso=$('sa-date').value, client=$('sa-client').value.trim(), pays=$('sa-pays').value.trim();
    if(!numero) return showSectionMsg('Indique un numéro de document.');
    if(!iso) return showSectionMsg('Choisis une date.');
    if(!client) return showSectionMsg('Indique le client.');
    if(!pays) return showSectionMsg('Indique le pays.');
    const lines=draft.lines.map(l=>computeLine(Object.assign({},l))).filter(l=>l.ca||l.cout||l.btl||(l.sample&&l.qty));
    if(!lines.length) return showSectionMsg('Ajoute au moins une ligne avec un montant.');
    const year=iso.split('-')[0];
    if(year!=='2025' && year!=='2026') return showSectionMsg('La date doit être en 2025 ou 2026.');
    if(BASE_FACT['2025'].concat(BASE_FACT['2026'],docs).some(f=>(f.numero||f.facture)===numero)) return showSectionMsg('Ce numéro existe déjà.');
    const t=lines.reduce((a,l)=>{a.btl+=l.btl||0;a.ca+=l.ca||0;a.cout+=l.cout||0;a.marge+=l.marge||0;return a;},{btl:0,ca:0,cout:0,marge:0});
    const doc={ type:docType, societe:draft.societe, devise:(draft.societe==='NB'?'USD':'EUR'), numero, date:iso2fr(iso), client, pays, tvaRegime:($('sa-tva')?$('sa-tva').value:'export'), btl:t.btl, ca:t.ca, cout:t.cout, marge:t.marge, lines, createdAt:Date.now(), _user:true };
    if(docType==='facture'){ doc.facture=numero; doc.statut='En attente'; doc.echeance=addDaysFr(doc.date,30); }
    docs.push(doc);
    if(docType==='facture'){ deductSamples(doc); }
    persist();
    if(docType==='facture'){ rebuild(); if(typeof renderAll==='function') renderAll(); }
    populateDatalists(); buildList(); renderReglements(); resetDraft();
    showSectionMsg(docType==='facture' ? '✅ Facture enregistrée — dashboard mis à jour.' : (docType==='devis'?'✅ Devis enregistré. Tu peux l\'imprimer (PDF) ou le transformer en commande/facture ci-dessous.':'✅ Bon de commande enregistré. Tu peux l\'imprimer ou le transformer en facture ci-dessous.'), true);
  });

  $('sa-listwrap').addEventListener('click', e=>{
    const a=e.target.closest('.sa-act'); if(!a) return;
    const i=+a.dataset.i, act=a.dataset.act, d=docs[i]; if(!d) return;
    if(act==='print') printDoc(d);
    else if(act==='tocmd'){ if(confirm(`Transformer le devis ${d.numero||''} en bon de commande ?`)) convertDoc(i,'commande'); }
    else if(act==='tofac'){ if(confirm(`Transformer ${d.numero||''} en facture ?\nElle comptera alors dans ton chiffre d'affaires.`)) convertDoc(i,'facture'); }
    else if(act==='del'){
      if(!confirm('Supprimer le document '+(d.numero||d.facture||'')+' ('+d.client+') ?')) return;
      const wasFac=isFacture(d); restoreSamples(d); docs.splice(i,1); persist();
      if(wasFac){ rebuild(); if(typeof renderAll==='function') renderAll(); }
      populateDatalists(); buildList(); renderReglements();
    }
  });

  // Suivi des règlements : édition du statut / de l'échéance + export
  const reglCont=$('tresoFactContent');
  if(reglCont) reglCont.addEventListener('change', e=>{
    const sel=e.target.closest('.regl-st'), ech=e.target.closest('.regl-ech');
    if(sel){ const d=docs[+sel.dataset.i]; if(d){ d.statut=sel.value; persist(); renderReglements(); } }
    else if(ech){ const d=docs[+ech.dataset.i]; if(d){ d.echeance=iso2fr(ech.value); persist(); renderReglements(); } }
  });
  const reglExpBtn=$('reglExport'); if(reglExpBtn) reglExpBtn.addEventListener('click', exportComptable);

  // ---------- Réglages : sociétés, devise, répartition clients ----------
  function allClients(){
    const set={};
    BASE_FACT['2025'].concat(BASE_FACT['2026']).forEach(f=>{ if(f.client) set[f.client]=f.pays; });
    docs.forEach(d=>{ if(d.client && !set[d.client]) set[d.client]=d.pays; });
    return Object.keys(set).sort((a,b)=>a.localeCompare(b,'fr')).map(c=>({client:c,pays:set[c]}));
  }
  function socField(code,k,label,ph){
    const v=esc((SETT.societes[code]&&SETT.societes[code][k])||'').replace(/"/g,'&quot;');
    return `<label style="display:flex;flex-direction:column;font-size:.68rem;text-transform:uppercase;letter-spacing:.04em;color:#9aa1b0;font-weight:700;gap:4px">${label}<input class="set-soc" data-soc="${code}" data-k="${k}" value="${v}" placeholder="${ph||''}" style="padding:9px 12px;border:1px solid rgba(31,42,68,.14);border-radius:10px;font-size:.9rem;color:#1f2a44;font-weight:600;text-transform:none;letter-spacing:0"></label>`;
  }
  function socCard(code){
    const s=SETT.societes[code]||{}; const flag=code==='NB'?'🇦🇪':'🇫🇷';
    return `<div style="background:#fff;border:1px solid rgba(31,42,68,.08);border-radius:16px;padding:18px 20px;box-shadow:0 6px 18px rgba(31,42,68,.05)">
      <h3 style="margin-bottom:2px">${flag} ${esc(s.label||code)}</h3>
      <div style="font-size:.8rem;color:#9aa1b0;margin-bottom:14px">Devise ${code==='NB'?'$ (USD) · sans TVA':'€ (EUR) · TVA française'}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        ${socField(code,'nom','Dénomination')}${socField(code,'forme','Forme / capital')}
        ${socField(code,'adresse','Adresse')}${socField(code,'cp_ville','Code postal & ville')}
        ${socField(code,'pays','Pays')}${socField(code,'ident',code==='NB'?'N° licence / registration':'SIRET')}
        ${socField(code,'tva',code==='NB'?'TRN / TVA (option.)':'N° TVA')}${socField(code,'rcs','RCS')}
        ${socField(code,'ape','APE / activité')}${socField(code,'email','Email')}
        ${socField(code,'tel','Téléphone')}
      </div></div>`;
  }
  function buildSettingsUI(){
    const el=$('set-content'); if(!el) return;
    const rows=allClients().map(({client:c,pays})=>{ const cur=clientCompany[c]||defaultCompany(pays);
      return `<tr><td>${esc(c)}</td><td style="color:#5b6577">${esc(pays||'')}</td><td style="text-align:right"><select class="set-cc" data-client="${esc(c).replace(/"/g,'&quot;')}"><option value="BSD"${cur==='BSD'?' selected':''}>🇫🇷 BSD</option><option value="NB"${cur==='NB'?' selected':''}>🇦🇪 NB Evolution</option></select></td></tr>`;
    }).join('');
    el.innerHTML=`
      <div style="background:#fff;border:1px solid rgba(31,42,68,.08);border-radius:16px;padding:16px 20px;margin-bottom:18px;box-shadow:0 6px 18px rgba(31,42,68,.05);display:flex;align-items:center;gap:14px;flex-wrap:wrap">
        <div><div style="font-weight:800;color:#1f2a44">💱 Taux de change</div><div style="font-size:.8rem;color:#9aa1b0">Conversion des ventes NB ($) vers € dans le tableau de bord</div></div>
        <div style="margin-left:auto;display:flex;align-items:center;gap:8px;font-weight:700;color:#1f2a44">1 $ = <input id="set-fx" type="number" step="0.001" min="0" value="${SETT.fx}" style="width:90px;padding:9px 12px;border:1px solid rgba(31,42,68,.14);border-radius:10px;text-align:right;font-weight:700"> €</div>
      </div>
      <div class="set-soc-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:22px">${socCard('BSD')}${socCard('NB')}</div>
      <h3 style="margin-bottom:8px">👥 Répartition des clients (${allClients().length})</h3>
      <div class="info-box" style="background:#eef6ff;border-left-color:#3b82f6;color:#1e3a5f">Par défaut, les clients en <strong>Irak</strong> et <strong>Russie</strong> sont rattachés à <strong>NB Evolution</strong>, les autres à <strong>BSD</strong>. Tu peux corriger n'importe quel client ici — le tableau de bord se met à jour aussitôt.</div>
      <div class="table-wrap"><table><thead><tr><th>Client</th><th>Pays</th><th style="text-align:right">Société</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  const setEl=$('set-content');
  if(setEl){
    setEl.addEventListener('input', e=>{
      const fx=e.target.closest('#set-fx');
      if(fx){ SETT.fx=+fx.value||0; saveSettings(); rebuild(); if(typeof renderAll==='function') renderAll(); return; }
      const sf=e.target.closest('.set-soc');
      if(sf){ (SETT.societes[sf.dataset.soc]=SETT.societes[sf.dataset.soc]||{})[sf.dataset.k]=sf.value; saveSettings(); }
    });
    setEl.addEventListener('change', e=>{
      const cc=e.target.closest('.set-cc');
      if(cc){ clientCompany[cc.dataset.client]=cc.value; saveClientCompany(); rebuild(); if(typeof renderAll==='function') renderAll(); }
    });
  }

  // ---------- Démarrage ----------
  $('sa-date').value=todayISO();
  applyCompany();
  populateDatalists(); buildList(); renderReglements(); buildSettingsUI();
  attachAutocomplete($('sa-client'),
    ()=>{ const m=clientPaysMap(); return Object.keys(m).sort((a,b)=>a.localeCompare(b,'fr')).map(name=>({label:name, sub:m[name]||''})); },
    null);
  attachAutocomplete($('sa-pays'),
    ()=>{ const set={}; (ALL.total.pays||[]).forEach(p=>{ if(p.pays) set[p.pays]=1; }); docs.forEach(d=>{ if(d.pays) set[d.pays]=1; }); return Object.keys(set).sort((a,b)=>a.localeCompare(b,'fr')).map(p=>({label:p})); },
    null);
  if(coSel) coSel.value=companyFilter;
  rebuild();
  if(docs.some(isFacture) && typeof renderAll==='function') renderAll();
})();
