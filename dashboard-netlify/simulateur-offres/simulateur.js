const IMG={vip:"img/produit-vip.jpg",black:"img/produit-black.jpg","50ml":"img/produit-50ml.jpg",brume:"img/produit-brume.jpg",royal:"img/produit-royal.jpg"};
const DEFAULTS={
  products:[
    {id:'vip',name:'VIP',sub:'Collection VIP',unit:4.36,per:10,tester:4.36,qty:0,price:16},
    {id:'black',name:'VIP Black',sub:'90 ml',unit:4.51,per:10,tester:4.51,qty:0,price:18},
    {id:'50ml',name:'VIP Black',sub:'50 ml',unit:4.06,per:12,tester:4.06,qty:0,price:13},
    {id:'brume',name:'Brumes',sub:'Collection Brumes',unit:1.60,per:24,tester:1.60,qty:0,price:4},
    {id:'royal',name:'Royal',sub:'Collection Royal',unit:4.95,per:14,tester:4.95,qty:0,price:9}
  ],
  goodies:{sac:29.50/50,ech:26.33/70,cata:36/20,mouil:22},
  tiers:[
    {min:1,remise:0,testeur:1,sac:2,ech:5,cata:1,mouil:0},
    {min:5,remise:3,testeur:1,sac:3,ech:10,cata:2,mouil:1},
    {min:10,remise:5,testeur:1,sac:4,ech:15,cata:3,mouil:1},
    {min:20,remise:8,testeur:1,sac:5,ech:20,cata:5,mouil:2}
  ]
};
const KEY='ej-simulateur-v3';
let S=null; try{S=JSON.parse(localStorage.getItem(KEY));}catch(e){}
if(!S||!S.products||S.products.length!==5) S=JSON.parse(JSON.stringify(DEFAULTS));
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){}};
const eur=n=>n.toLocaleString('fr-FR',{style:'currency',currency:'EUR'});
const num=v=>{const n=parseFloat(String(v).replace(',','.'));return isNaN(n)||n<0?0:n;};
const r3=v=>Math.round(v*1000)/1000;
const inp=(path,val,step)=>`<input type="number" min="0" step="${step||'0.01'}" data-path="${path}" value="${r3(val)}">`;

function renderProducts(){
  document.getElementById('products').innerHTML=S.products.map((p,i)=>`
  <article class="card" data-i="${i}">
    <div class="ph"><img src="${IMG[p.id]}" alt="${p.name} ${p.sub}" loading="lazy"></div>
    <div class="body">
      <p class="name">${p.name}</p><p class="meta">${p.sub} · ${p.per} par carton</p>
      <div class="stepper"><button type="button" data-step="-1" data-i="${i}" aria-label="Retirer un carton">−</button>
        <input type="number" min="0" step="1" inputmode="numeric" data-path="products.${i}.qty" value="${p.qty}" aria-label="Cartons ${p.name} ${p.sub}">
        <button type="button" data-step="1" data-i="${i}" aria-label="Ajouter un carton">+</button></div>
      <label class="field">Prix de vente HT / pièce <input type="number" min="0" step="0.01" data-path="products.${i}.price" value="${r3(p.price)}"></label>
      <div class="cost" id="cost${i}"></div>
    </div>
  </article>`).join('');
}
function updateCards(){
  S.products.forEach((p,i)=>{
    document.querySelector(`.card[data-i="${i}"]`).classList.toggle('on',p.qty>0);
    document.getElementById('cost'+i).innerHTML=`Coût carton + testeur : <strong>${eur(p.unit*p.per+p.tester)}</strong>`;
  });
}
function renderTiers(){
  let h='<tr><th>Dès (cartons)</th><th>Remise %</th><th>Testeurs / carton</th><th>Sacs / carton</th><th>Échantillons / carton</th><th>Catalogues / cde</th><th>Mouillettes / cde</th></tr>';
  S.tiers.forEach((t,i)=>{h+=`<tr data-t="${i}"><td>${inp(`tiers.${i}.min`,t.min,'1')}</td><td>${inp(`tiers.${i}.remise`,t.remise,'0.5')}</td><td>${inp(`tiers.${i}.testeur`,t.testeur,'1')}</td><td>${inp(`tiers.${i}.sac`,t.sac,'1')}</td><td>${inp(`tiers.${i}.ech`,t.ech,'1')}</td><td>${inp(`tiers.${i}.cata`,t.cata,'1')}</td><td>${inp(`tiers.${i}.mouil`,t.mouil,'1')}</td></tr>`;});
  document.getElementById('tiers').innerHTML=h;
}
function renderCosts(){
  let h='<tr><th>Collection</th><th>Coût unitaire HT</th><th>Unités / carton</th><th>Coût testeur HT</th></tr>';
  S.products.forEach((p,i)=>{h+=`<tr><td>${p.name} ${p.sub}</td><td>${inp(`products.${i}.unit`,p.unit)}</td><td>${inp(`products.${i}.per`,p.per,'1')}</td><td>${inp(`products.${i}.tester`,p.tester)}</td></tr>`;});
  document.getElementById('costs').innerHTML=h;
  const g=S.goodies;
  document.getElementById('goodies').innerHTML=`<tr><th>Cadeau</th><th>Coût unitaire HT</th><th>Base d'achat</th></tr>
  <tr><td>Sac noir</td><td>${inp('goodies.sac',g.sac,'0.001')}</td><td>29,50 € les 50</td></tr>
  <tr><td>Échantillon 2 ml</td><td>${inp('goodies.ech',g.ech,'0.001')}</td><td>26,33 € les 70</td></tr>
  <tr><td>Catalogue</td><td>${inp('goodies.cata',g.cata)}</td><td>36,00 € les 20</td></tr>
  <tr><td>Paquet de mouillettes</td><td>${inp('goodies.mouil',g.mouil)}</td><td>22,00 € le paquet</td></tr>`;
}
function compute(){
  const cartons=S.products.reduce((a,p)=>a+p.qty,0);
  let T=null; S.tiers.map((t,i)=>({...t,i})).sort((a,b)=>a.min-b.min).forEach(t=>{if(cartons>=t.min)T=t;});
  const t=T||{remise:0,testeur:0,sac:0,ech:0,cata:0,mouil:0,i:-1,min:0};
  const caBrut=S.products.reduce((a,p)=>a+p.qty*p.per*p.price,0), remise=caBrut*t.remise/100, caNet=caBrut-remise;
  const march=S.products.reduce((a,p)=>a+p.qty*p.per*p.unit,0);
  const nTest=cartons*t.testeur, cTest=S.products.reduce((a,p)=>a+p.qty*t.testeur*p.tester,0);
  const g=S.goodies, nSac=cartons*t.sac, nEch=cartons*t.ech, nCata=cartons?t.cata:0, nMouil=cartons?t.mouil:0;
  const cGood=nSac*g.sac+nEch*g.ech+nCata*g.cata+nMouil*g.mouil, total=march+cTest+cGood;
  return {cartons,T,t,caBrut,remise,caNet,march,nTest,cTest,nSac,nEch,nCata,nMouil,cGood,total,marge:caNet-total};
}
function update(){
  updateCards();
  const r=compute();
  document.querySelectorAll('#tiers tr[data-t]').forEach(tr=>tr.classList.toggle('active',+tr.dataset.t===r.t.i));
  document.getElementById('tierNote').textContent = !r.cartons ? "Ajoutez des cartons à la commande : la ligne du palier atteint sera surlignée, et c'est elle qui s'applique au résultat."
    : r.T ? `Avec ${r.cartons} carton${r.cartons>1?'s':''}, c'est la ligne « dès ${r.t.min} » qui s'applique. Les autres lignes ne changent le résultat que si la commande atteint leur palier.`
    : `Avec ${r.cartons} carton${r.cartons>1?'s':''}, aucun palier n'est atteint.`;
  const minT=Math.min(...S.tiers.map(t=>t.min));
  document.getElementById('tierSub').textContent = r.cartons ? `${r.cartons} carton${r.cartons>1?'s':''} commandé${r.cartons>1?'s':''}` : 'Ajoutez des cartons pour lancer la simulation';
  document.getElementById('tierBadge').innerHTML = r.T ? `<span class="tier">Palier dès ${r.t.min} carton${r.t.min>1?'s':''}</span>` : (r.cartons?`<span class="tier">Aucun palier, le premier commence à ${minT}</span>`:'');
  const offerCost=r.remise+r.cTest+r.cGood, hasP=r.caBrut>0, pct=hasP&&r.caNet>0?r.marge/r.caNet*100:null;
  let h = hasP
    ? `<div class="big ${r.marge<0?'neg':''}">${eur(r.marge)}</div><p class="biglbl">Marge nette${pct!==null?' · '+pct.toFixed(1).replace('.',',')+' % du CA net':''}</p>`
    : `<div class="big">${eur(r.total)}</div><p class="biglbl">Coût total de la commande. Ajoutez vos prix de vente pour voir la marge.</p>`;
  const miss=S.products.filter(p=>p.qty&&!p.price).map(p=>p.name+' '+p.sub);
  if(hasP&&miss.length) h+=`<p class="biglbl" style="color:var(--bad);margin-top:-10px">Prix de vente manquant : ${miss.join(', ')}</p>`;
  h+=`<div class="kv"><span>CA brut HT</span><span>${eur(r.caBrut)}</span></div>
  <div class="kv"><span>Remise ${r.t.remise} %</span><span>− ${eur(r.remise)}</span></div>
  <div class="kv"><span>CA net HT</span><span>${eur(r.caNet)}</span></div>
  <div class="kv"><span>Coût marchandise</span><span>${eur(r.march)}</span></div>
  <div class="kv"><span>Testeurs offerts (${r.nTest})</span><span>${eur(r.cTest)}</span></div>
  <div class="kv"><span>Cadeaux offerts</span><span>${eur(r.cGood)}</span></div>
  <div class="kv"><span>Coût total</span><span>${eur(r.total)}</span></div>
  <div class="kv strong"><span>Coût de l'offre</span><span>${eur(offerCost)}</span></div>`;
  if(r.cartons) h+=`<div class="kv"><span>Coût de l'offre par carton</span><span>${eur(offerCost/r.cartons)}</span></div>`;
  document.getElementById('out').innerHTML=h;
  const bv=document.getElementById('barV'),bl=document.getElementById('barL');
  bv.textContent=hasP?eur(r.marge):eur(r.total); bv.classList.toggle('neg',hasP&&r.marge<0);
  bl.textContent=!r.cartons?'Ajoutez des cartons':(hasP?'Marge nette':'Coût total')+' · '+r.cartons+' carton'+(r.cartons>1?'s':'')+(r.T?' · palier '+r.t.min+'+':'');
  const items=[];
  if(r.t.remise) items.push(`${String(r.t.remise).replace('.',',')} % de remise sur la commande`);
  if(r.nTest) items.push(`${r.nTest} testeur${r.nTest>1?'s':''} offert${r.nTest>1?'s':''}`);
  if(r.nSac) items.push(`${r.nSac} sacs noirs`);
  if(r.nEch) items.push(`${r.nEch} échantillons 2 ml`);
  if(r.nCata) items.push(`${r.nCata} catalogue${r.nCata>1?'s':''}`);
  if(r.nMouil) items.push(`${r.nMouil} paquet${r.nMouil>1?'s':''} de mouillettes`);
  document.getElementById('offer').innerHTML=`<h3>Ce que le client reçoit</h3>`+(items.length?`<ul>${items.map(i=>`<li>${i}</li>`).join('')}</ul>`:`<p style="margin:0;color:var(--on-night-muted);font-size:.86rem">Rien pour l'instant.</p>`);
  const lines=S.products.filter(p=>p.qty).map(p=>`- ${p.qty} carton${p.qty>1?'s':''} ${p.name} ${p.sub} (${p.qty*p.per} unités)`);
  window._txt=`Emmanuelle Jane Paris\n\nVotre commande :\n${lines.join('\n')}\n\nOffert avec votre commande :\n${items.map(i=>'- '+i).join('\n')}`;
}
function renderAll(){renderProducts();renderTiers();renderCosts();update();}

const onEdit=e=>{
  const p=e.target.dataset.path; if(!p) return;
  const k=p.split('.'); let o=S; for(let i=0;i<k.length-1;i++) o=o[k[i]];
  o[k[k.length-1]]=k[k.length-1]==='qty'?Math.round(num(e.target.value)):num(e.target.value);
  save(); update();
};
document.addEventListener('input',onEdit);
document.addEventListener('change',onEdit);
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-step]'); if(!b) return;
  const i=+b.dataset.i, p=S.products[i]; p.qty=Math.max(0,p.qty+ +b.dataset.step);
  document.querySelector(`input[data-path="products.${i}.qty"]`).value=p.qty; save(); update();
});
document.getElementById('addTier').onclick=()=>{const l=S.tiers[S.tiers.length-1];S.tiers.push({...l,min:l.min+10,remise:l.remise+2});save();renderTiers();update();};
document.getElementById('removeTier').onclick=()=>{if(S.tiers.length>1){S.tiers.pop();save();renderTiers();update();}};
document.getElementById('reset').onclick=()=>{S=JSON.parse(JSON.stringify(DEFAULTS));save();renderAll();};
document.getElementById('copy').onclick=async e=>{const b=e.currentTarget;try{await navigator.clipboard.writeText(window._txt||'');b.textContent='Offre copiée';}catch(err){b.textContent='Copie impossible ici';}setTimeout(()=>b.textContent="Copier l'offre client",1800);};
document.getElementById('barBtn').onclick=()=>document.getElementById('result').scrollIntoView({behavior:'smooth'});
renderAll();
