/* Factures fournisseurs déposées (page « Factures fournisseurs »).
   - On dépose un PDF ou une photo de facture : les informations sont lues automatiquement
     (avec la clé Claude de l'assistant si elle est enregistrée : lecture complète, y compris des photos ;
      sinon lecture du texte du PDF avec pdf.js, chargé à la demande depuis vendor/pdfjs/),
     puis vérifiées dans un formulaire avant l'enregistrement.
   - Chaque facture a un statut (à payer / payée en partie / payée), une échéance, la date et le mode de paiement.
   - Registre 'ej_reg_factures_fournisseurs' (partagé en ligne si le partage est branché).
     Le fichier lui-même reste dans ce navigateur (IndexedDB), il n'est pas partagé.
   - Les factures non payées s'ajoutent aux « fournisseurs à payer » (trésorerie, rappels, assistant) via EJ_FOURN.dus(). */
(function(){
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num = v => { const n = parseFloat(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.')); return isNaN(n) ? 0 : n; };
  const pad = n => String(n).padStart(2, '0');
  const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const T0 = () => iso(new Date());
  const fr = s => s ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : '';
  const jours = s => Math.round((new Date(s + 'T00:00:00') - new Date(T0() + 'T00:00:00')) / 864e5);
  const money = (n, dev) => (n || 0).toLocaleString('fr-FR', {minimumFractionDigits:2, maximumFractionDigits:2}) + ' ' + (dev && dev !== 'EUR' ? dev : '€');
  const TAUX = {EUR:1, USD:0.92, AED:0.25, GBP:1.17};
  const enEur = (n, dev) => num(n) * (TAUX[dev] || 1);
  const STATUTS = ['À payer', 'Payée en partie', 'Payée'];
  const MODES = ['Virement', 'Prélèvement', 'Carte bancaire', 'Chèque', 'Espèces', 'Autre'];
  const CATS = ['Matières premières / jus', 'Flacons & emballages', 'Production', 'Transport & logistique', 'Salons & marketing', 'Services & honoraires', 'Loyer & charges', 'Autre'];

  if(!window.REG) return;
  const R = REG.def('factures_fournisseurs', {cols:[]});
  const rows = () => R.rows();
  const reste = x => Math.max(0, num(x.ttc) - (x.statut === 'Payée' ? num(x.ttc) : num(x.paye)));
  const etat = x => x.statut === 'Payée' ? 'payee' : (x.echeance && jours(x.echeance) < 0) ? 'retard' : (x.echeance && jours(x.echeance) <= 7) ? 'bientot' : 'apayer';

  /* ---------- Fichiers (IndexedDB, local à ce navigateur) ---------- */
  const DB = () => new Promise((ok, ko) => { const r = indexedDB.open('ej_fichiers', 1); r.onupgradeneeded = () => r.result.createObjectStore('f'); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); });
  async function fPut(id, blob){ try { const db = await DB(); await new Promise((ok, ko) => { const t = db.transaction('f', 'readwrite'); t.objectStore('f').put(blob, id); t.oncomplete = ok; t.onerror = () => ko(t.error); }); return true; } catch(e) { return false; } }
  async function fGet(id){ try { const db = await DB(); return await new Promise((ok, ko) => { const q = db.transaction('f').objectStore('f').get(id); q.onsuccess = () => ok(q.result || null); q.onerror = () => ko(q.error); }); } catch(e) { return null; } }
  async function fDel(id){ try { const db = await DB(); db.transaction('f', 'readwrite').objectStore('f').delete(id); } catch(e) {} }

  /* ---------- Lecture automatique ---------- */
  const b64 = blob => new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = ko; r.readAsDataURL(blob); });
  function chargerPdfJs(){
    if(window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    return new Promise((ok, ko) => { const s = document.createElement('script'); s.src = 'vendor/pdfjs/pdf.min.js';
      s.onload = () => { try { pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdfjs/pdf.worker.min.js'; } catch(e) {} ok(window.pdfjsLib); }; s.onerror = () => ko(new Error('pdf.js indisponible')); document.head.appendChild(s); });
  }
  async function textePdf(file){
    const lib = await chargerPdfJs(), doc = await lib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise; let t = '';
    for(let i = 1; i <= Math.min(doc.numPages, 5); i++){
      const c = await (await doc.getPage(i)).getTextContent(); let y = null;
      c.items.forEach(it => { const yy = Math.round(it.transform[5]); t += (y !== null && Math.abs(yy - y) > 3 ? '\n' : ' ') + it.str; y = yy; }); t += '\n';
    }
    return t.replace(/[ \t]+/g, ' ');
  }
  const MOIS = {janvier:1, fevrier:2, mars:3, avril:4, mai:5, juin:6, juillet:7, aout:8, septembre:9, octobre:10, novembre:11, decembre:12, january:1, february:2, march:3, april:4, may:5, june:6, july:7, august:8, september:9, october:10, november:11, december:12};
  const sansAcc = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  function dates(t){
    const out = [], re = /(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})|(\d{4})-(\d{2})-(\d{2})|(\d{1,2})\s+([A-Za-zéûôà]+)\s+(\d{4})/g; let m;
    while((m = re.exec(t))){
      let y, mo, d;
      if(m[1]){ d = +m[1]; mo = +m[2]; y = +m[3]; if(y < 100) y += 2000; }
      else if(m[4]){ y = +m[4]; mo = +m[5]; d = +m[6]; }
      else { d = +m[7]; mo = MOIS[sansAcc(m[8])]; y = +m[9]; }
      if(mo >= 1 && mo <= 12 && d >= 1 && d <= 31 && y >= 2015 && y <= 2040) out.push({iso:y + '-' + pad(mo) + '-' + pad(d), i:m.index});
    }
    return out;
  }
  const montant = s => { s = s.replace(/[^\d,.\s]/g, '').trim().replace(/\s(?=\d{3}\b)/g, ''); if(/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); else s = s.replace(/,/g, ''); return parseFloat(s) || 0; };
  // Montant d'une ligne « mot-clé … montant » : on prend le DERNIER nombre de la ligne (« TVA 20 % : 2 480,00 € » → 2 480,00).
  function chercheMontant(t, motifs){
    const lignes = t.split('\n'), NB = /\d{1,3}(?:[ .  ]\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?/g;
    for(const mo of motifs){
      const re = new RegExp(mo, 'i'); let last = 0;
      lignes.forEach(l => { const m = sansAcc(l).match(re); if(!m) return; const apres = l.slice(m.index + m[0].length), ns = apres.match(NB); if(ns){ const v = montant(ns[ns.length - 1]); if(v) last = v; } });
      if(last) return last;
    }
    return 0;
  }
  function fournisseursConnus(){
    const s = new Set();
    try { (SUPPLIER_INVOICES.months || []).forEach(m => (m.lines || []).forEach(l => s.add(String(l.label).replace(/\s*\(.*$/, '').trim()))); } catch(e) {}
    rows().forEach(x => x.fournisseur && s.add(x.fournisseur));
    ['Firmenich', 'Goldrock', 'Givaudan', 'IFS', 'CPL', 'Verescence', 'Sylvie de France', 'Web Print Service', 'DHL', 'FedEx', 'UPS', 'Chronopost'].forEach(x => s.add(x));
    return [...s].filter(x => x && x.length > 2);
  }
  function lireTexte(t){
    const o = {}, low = sansAcc(t);
    const n = t.match(/(?:facture|invoice|rechnung|fattura)\s*(?:n[°ºo]\.?|no\.?|num(?:[ée]ro)?|#|number)?\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-\/_.]{2,})/i); if(n) o.numero = n[1].replace(/[.:]$/, '');
    const D = dates(t);
    const ech = D.find(d => /(echeance|due|payable|a payer avant|date limite|reglement)/.test(sansAcc(t.slice(Math.max(0, d.i - 60), d.i))));
    const fact = D.find(d => /(date|facture|invoice|emis)/.test(sansAcc(t.slice(Math.max(0, d.i - 40), d.i))) && d !== ech) || D.find(d => d !== ech);
    if(fact) o.date = fact.iso; if(ech) o.echeance = ech.iso;
    o.ttc = chercheMontant(t, ['net\\s*a\\s*payer', 'total\\s*ttc', 'montant\\s*ttc', 'total\\s*due', 'amount\\s*due', 'total\\s*a\\s*payer', 'grand\\s*total', 'total\\s*amount', 'total']);
    o.ht = chercheMontant(t, ['total\\s*h\\.?t\\.?', 'montant\\s*h\\.?t\\.?', 'sous[-\\s]?total', 'subtotal', 'total\\s*hors\\s*taxe']);
    o.tva = chercheMontant(t, ['total\\s*tva', 'montant\\s*tva', 'tva', 'vat']);
    if(o.ht && o.tva && !o.ttc) o.ttc = Math.round((o.ht + o.tva) * 100) / 100;
    if(o.tva && o.ttc && o.tva >= o.ttc) o.tva = 0;
    o.devise = /\bUSD\b|\$/.test(t) ? 'USD' : /\bAED\b|dirham/i.test(t) ? 'AED' : /\bGBP\b|£/.test(t) ? 'GBP' : 'EUR';
    const iban = t.replace(/\s/g, '').match(/[A-Z]{2}\d{2}[A-Z0-9]{11,30}/); if(iban && /iban/i.test(t)) o.iban = iban[0];
    const f = fournisseursConnus().find(x => low.includes(sansAcc(x))); o.fournisseur = f || (t.split('\n').map(x => x.trim()).find(x => x.length > 2 && !/facture|invoice|date|page/i.test(x)) || '').slice(0, 60);
    return o;
  }
  async function lireClaude(file, cle){
    const data = await b64(file), estPdf = file.type === 'application/pdf';
    const bloc = estPdf ? {type:'document', source:{type:'base64', media_type:'application/pdf', data}} : {type:'image', source:{type:'base64', media_type:file.type || 'image/jpeg', data}};
    const consigne = `Tu lis une facture FOURNISSEUR reçue par la société BSD (France) ou NB Evolution (Dubaï), marque Emmanuelle Jane Paris (parfums).
Réponds UNIQUEMENT avec un objet JSON, sans texte autour, avec ces clés (chaîne vide ou 0 si absent) :
{"fournisseur": nom de l'entreprise qui facture, "numero": numéro de facture, "date": "AAAA-MM-JJ", "echeance": "AAAA-MM-JJ" (date limite de paiement ; si seulement un délai comme « 30 jours », calcule-la),
"ht": nombre, "tva": nombre, "ttc": nombre (montant total à payer), "devise": "EUR" | "USD" | "AED" | "GBP", "deja_paye": nombre (acompte ou montant déjà réglé indiqué sur la facture),
"conditions": conditions de paiement en clair (ex. « 30 % à la commande, solde à 30 jours »), "iban": IBAN du fournisseur, "objet": ce qui est facturé en quelques mots,
"categorie": une de ${JSON.stringify(CATS)}, "societe_cliente": "BSD" ou "NB" selon le destinataire de la facture}`;
    const r = await fetch('https://api.anthropic.com/v1/messages', {method:'POST',
      headers:{'content-type':'application/json', 'x-api-key':cle, 'anthropic-version':'2023-06-01', 'anthropic-dangerous-direct-browser-access':'true'},
      body:JSON.stringify({model:'claude-opus-5-5', max_tokens:2000, messages:[{role:'user', content:[bloc, {type:'text', text:consigne}]}]})});
    if(!r.ok){ const e = new Error(r.status === 401 ? 'clé Claude refusée' : 'erreur ' + r.status); throw e; }
    const j = await r.json(), txt = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    const m = txt.match(/\{[\s\S]*\}/); if(!m) throw new Error('réponse illisible');
    const o = JSON.parse(m[0]);
    return {fournisseur:o.fournisseur, numero:o.numero, date:o.date, echeance:o.echeance, ht:num(o.ht), tva:num(o.tva), ttc:num(o.ttc), devise:o.devise || 'EUR', paye:num(o.deja_paye),
      conditions:o.conditions, iban:o.iban, objet:o.objet, categorie:CATS.includes(o.categorie) ? o.categorie : '', soc:o.societe_cliente === 'NB' ? 'NB' : 'BSD'};
  }
  async function lire(file){
    let cle = ''; try { cle = localStorage.getItem('ej_ia_cle') || ''; } catch(e) {}
    if(cle && (file.type === 'application/pdf' || /^image\//.test(file.type))){
      try { return {o:await lireClaude(file, cle), via:'Claude'}; } catch(e) { if(file.type !== 'application/pdf') return {o:{}, via:'', err:'Lecture par Claude impossible (' + e.message + '). Complétez à la main.'}; }
    }
    if(file.type === 'application/pdf'){
      try { const t = await textePdf(file); if(t.replace(/\s/g, '').length < 30) return {o:{}, via:'', err:'Ce PDF est une image scannée : il n’y a pas de texte à lire. Complétez à la main, ou ajoutez une clé Claude dans les réglages de l’assistant (⚙) pour lire les scans et les photos.'};
        return {o:lireTexte(t), via:'texte du PDF'}; }
      catch(e) { return {o:{}, via:'', err:'Lecture du PDF impossible ici (' + e.message + '). Complétez à la main.'}; }
    }
    return {o:{}, via:'', err:'Photo enregistrée. Pour lire automatiquement les photos, ajoutez une clé Claude dans les réglages de l’assistant (⚙). Complétez à la main.'};
  }

  /* ---------- Interface ---------- */
  const sec = document.getElementById('fournisseurs'); if(!sec) return;
  const box = document.createElement('div'); box.className = 'ff'; box.id = 'ffBox';
  const h2 = sec.querySelector(':scope > h2'); sec.insertBefore(box, h2 ? h2.nextSibling : sec.firstChild);
  const modal = document.createElement('div'); modal.className = 'ff-ov'; modal.hidden = true; document.body.appendChild(modal);
  let filtre = 'apayer', cur = null, fichier = null, urlApercu = null;

  function render(){
    const L = rows(), apayer = L.filter(x => x.statut !== 'Payée'), retard = apayer.filter(x => etat(x) === 'retard'), mk = T0().slice(0, 7);
    const payeMois = L.filter(x => x.statut === 'Payée' && (x.paye_le || '').slice(0, 7) === mk);
    const tot = a => a.reduce((s, x) => s + enEur(reste(x), x.devise), 0);
    const vis = L.filter(x => filtre === 'toutes' || (filtre === 'payees' ? x.statut === 'Payée' : filtre === 'retard' ? etat(x) === 'retard' : x.statut !== 'Payée'))
      .sort((a, b) => (filtre === 'payees' ? String(b.paye_le || b.date).localeCompare(String(a.paye_le || a.date)) : String(a.echeance || '9999').localeCompare(String(b.echeance || '9999'))));
    const badge = x => { const e = etat(x); return `<span class="ff-b ff-${e}">${e === 'payee' ? 'Payée' + (x.paye_le ? ' le ' + fr(x.paye_le) : '') : e === 'retard' ? 'En retard' : x.statut === 'Payée en partie' ? 'Payée en partie' : 'À payer'}</span>`; };
    box.innerHTML = `<div class="ff-top"><div><h3>Factures fournisseurs déposées</h3><p class="ff-sub">Déposez la facture : les informations sont remplies automatiquement, vous vérifiez, puis vous suivez le paiement.</p></div></div>
      <label class="ff-drop" id="ffDrop"><input type="file" id="ffFile" accept="application/pdf,image/*" hidden>
        <strong>Déposer une facture</strong><span>Glissez un PDF ou une photo ici, ou cliquez pour choisir le fichier</span></label>
      <div class="ff-kpis"><div><span>À payer</span><strong>${money(tot(apayer))}</strong><small>${apayer.length} facture${apayer.length > 1 ? 's' : ''}</small></div>
        <div class="${retard.length ? 'ko' : ''}"><span>En retard</span><strong>${money(tot(retard))}</strong><small>${retard.length} facture${retard.length > 1 ? 's' : ''}</small></div>
        <div><span>Payé ce mois-ci</span><strong>${money(payeMois.reduce((s, x) => s + enEur(x.ttc, x.devise), 0))}</strong><small>${payeMois.length} facture${payeMois.length > 1 ? 's' : ''}</small></div></div>
      <div class="ff-filtres">${[['apayer', 'À payer'], ['retard', 'En retard'], ['payees', 'Payées'], ['toutes', 'Toutes']].map(([k, l]) => `<button type="button" data-ff-f="${k}" class="${filtre === k ? 'actif' : ''}">${l}</button>`).join('')}</div>
      ${vis.length ? `<div class="ff-tw"><table class="ff-t"><thead><tr><th>Fournisseur</th><th>N° facture</th><th>Date</th><th>Échéance</th><th class="r">Montant TTC</th><th class="r">Reste à payer</th><th>Statut</th><th></th></tr></thead><tbody>
        ${vis.map(x => `<tr data-ff="${x.id}" class="ff-${etat(x)}"><td><strong>${esc(x.fournisseur || '—')}</strong><small>${esc([x.soc, x.categorie, x.objet].filter(Boolean).join(' · '))}</small></td><td>${esc(x.numero || '—')}</td><td>${fr(x.date)}</td>
          <td>${x.echeance ? fr(x.echeance) + (x.statut !== 'Payée' ? `<small>${jours(x.echeance) < 0 ? 'il y a ' + -jours(x.echeance) + ' j' : jours(x.echeance) === 0 ? "aujourd'hui" : 'dans ' + jours(x.echeance) + ' j'}</small>` : '') : '—'}</td>
          <td class="r">${money(num(x.ttc), x.devise)}</td><td class="r">${x.statut === 'Payée' ? '—' : money(reste(x), x.devise)}</td><td>${badge(x)}</td>
          <td class="ff-act">${x.statut !== 'Payée' ? `<button type="button" class="doc-btn small primary" data-ff-a="payer">Marquer payée</button>` : ''}<button type="button" class="doc-btn small" data-ff-a="modif">Modifier</button>${x.fichier ? `<button type="button" class="doc-btn small" data-ff-a="voir">Voir la facture</button>` : ''}</td></tr>`).join('')}
        </tbody></table></div>` : `<p class="ff-vide">${filtre === 'payees' ? 'Aucune facture payée enregistrée.' : filtre === 'retard' ? 'Aucune facture en retard.' : L.length ? 'Tout est payé.' : 'Aucune facture déposée pour l’instant.'}</p>`}`;
  }

  function form(x, info){
    const v = k => esc(x[k] == null ? '' : x[k]), opt = (L, val) => L.map(o => `<option${o === val ? ' selected' : ''}>${esc(o)}</option>`).join('');
    const dl = `<datalist id="ffFourn">${fournisseursConnus().map(f => `<option value="${esc(f)}">`).join('')}</datalist>`;
    modal.innerHTML = `<div class="ff-m" role="dialog" aria-modal="true"><div class="ff-mh"><h3>${rows().some(y => y.id === x.id) ? 'Modifier la facture' : 'Nouvelle facture fournisseur'}</h3><button type="button" class="ff-x" data-ff-m="fermer" aria-label="Fermer">×</button></div>
      ${info ? `<p class="ff-info ${info.err ? 'ko' : ''}">${esc(info.err || 'Informations lues automatiquement (' + info.via + ') : vérifiez-les avant d’enregistrer.')}</p>` : ''}
      <div class="ff-mb"><div class="ff-apercu" id="ffApercu">${urlApercu ? (fichier && fichier.type === 'application/pdf' ? `<iframe src="${urlApercu}" title="Facture"></iframe>` : `<img src="${urlApercu}" alt="Facture">`) : '<p class="ff-vide">Pas de fichier joint.</p>'}</div>
      <form class="ff-f" id="ffForm">${dl}
        <fieldset><legend>Facture</legend>
        <label class="l2">Fournisseur<input name="fournisseur" list="ffFourn" value="${v('fournisseur')}" required></label>
        <label>N° de facture<input name="numero" value="${v('numero')}"></label>
        <label>Société qui paie<select name="soc">${opt(['BSD', 'NB'], x.soc || 'BSD')}</select></label>
        <label>Date de la facture<input type="date" name="date" value="${v('date')}"></label>
        <label>Échéance (à payer avant le)<input type="date" name="echeance" value="${v('echeance')}"></label>
        <label>Catégorie<select name="categorie"><option></option>${opt(CATS, x.categorie)}</select></label>
        <label class="l2">Objet<input name="objet" value="${v('objet')}" placeholder="Ex. concentré VIP, flacons 90 ml…"></label></fieldset>
        <fieldset><legend>Montants</legend>
        <label>Montant HT<input type="number" step="0.01" name="ht" value="${v('ht')}"></label>
        <label>TVA<input type="number" step="0.01" name="tva" value="${v('tva')}"></label>
        <label>Total TTC à payer<input type="number" step="0.01" name="ttc" value="${v('ttc')}" required></label>
        <label>Devise<select name="devise">${opt(['EUR', 'USD', 'AED', 'GBP'], x.devise || 'EUR')}</select></label>
        <label class="l2">Conditions de paiement<input name="conditions" value="${v('conditions')}" placeholder="Ex. 30 % à la commande, solde à 30 jours"></label>
        <label class="l2">IBAN du fournisseur<input name="iban" value="${v('iban')}"></label></fieldset>
        <fieldset><legend>Paiement</legend>
        <label>Statut<select name="statut">${opt(STATUTS, x.statut || 'À payer')}</select></label>
        <label>Déjà payé<input type="number" step="0.01" name="paye" value="${v('paye')}" placeholder="0"></label>
        <label>Payée le<input type="date" name="paye_le" value="${v('paye_le')}"></label>
        <label>Mode de paiement<select name="mode"><option></option>${opt(MODES, x.mode)}</select></label>
        <label class="l2">Note<input name="note" value="${v('note')}"></label></fieldset>
      </form></div>
      <div class="ff-mf">${rows().some(y => y.id === x.id) ? '<button type="button" class="doc-btn danger" data-ff-m="suppr">Supprimer</button>' : ''}<span></span><button type="button" class="doc-btn" data-ff-m="fermer">Annuler</button><button type="button" class="doc-btn primary" data-ff-m="ok">Enregistrer</button></div></div>`;
    modal.hidden = false; document.body.classList.add('wz-on');
    const f = modal.querySelector('#ffForm');
    f.statut.addEventListener('change', () => { if(f.statut.value === 'Payée'){ if(!f.paye_le.value) f.paye_le.value = T0(); f.paye.value = f.ttc.value; } });
  }
  function fermer(){ modal.hidden = true; document.body.classList.remove('wz-on'); if(urlApercu){ URL.revokeObjectURL(urlApercu); urlApercu = null; } cur = null; fichier = null; }
  async function enregistrer(){
    const f = modal.querySelector('#ffForm'); if(!f.fournisseur.value.trim()){ f.fournisseur.focus(); return; } if(!num(f.ttc.value)){ f.ttc.focus(); return; }
    const o = {}; [...f.elements].forEach(el => { if(el.name) o[el.name] = ['ht', 'tva', 'ttc', 'paye'].includes(el.name) ? (el.value === '' ? '' : num(el.value)) : el.value.trim(); });
    if(o.statut === 'Payée'){ o.paye = o.ttc; if(!o.paye_le) o.paye_le = T0(); }
    else if(num(o.paye) >= num(o.ttc) && num(o.ttc) > 0){ o.statut = 'Payée'; if(!o.paye_le) o.paye_le = T0(); }
    else if(num(o.paye) > 0) o.statut = 'Payée en partie';
    const L = rows(), i = L.findIndex(y => y.id === cur.id);
    if(fichier && !cur.fichier){ const fid = 'ff_' + cur.id; if(await fPut(fid, fichier)){ o.fichier = fid; o.nomFichier = fichier.name; } }
    if(i >= 0) Object.assign(L[i], o); else L.push(Object.assign({id:cur.id, ajoute:T0()}, cur.fichier ? {fichier:cur.fichier, nomFichier:cur.nomFichier} : {}, o));
    R.save(L); fermer(); render();
  }
  async function deposer(file){
    if(!file) return;
    if(file.size > 15e6){ alert('Fichier trop lourd (15 Mo maximum).'); return; }
    fichier = file; urlApercu = URL.createObjectURL(file);
    cur = {id:Date.now().toString(36) + Math.random().toString(36).slice(2, 6), statut:'À payer', soc:'BSD', date:T0()};
    modal.innerHTML = `<div class="ff-m ff-lecture"><div class="ff-spin"></div><p>Lecture de la facture…</p></div>`; modal.hidden = false; document.body.classList.add('wz-on');
    const r = await lire(file);
    Object.keys(r.o || {}).forEach(k => { if(r.o[k] !== '' && r.o[k] != null && r.o[k] !== 0) cur[k] = r.o[k]; });
    if(cur.paye && cur.ttc && num(cur.paye) >= num(cur.ttc)){ cur.statut = 'Payée'; } else if(num(cur.paye) > 0) cur.statut = 'Payée en partie';
    if(!cur.echeance && cur.date){ const d = new Date(cur.date + 'T00:00:00'); d.setDate(d.getDate() + 30); cur.echeance = iso(d); r.ech30 = true; }
    if(r.ech30 && !r.err) r.via += ' ; échéance non trouvée, mise à 30 jours par défaut';
    form(cur, r);
  }

  box.addEventListener('change', e => { if(e.target.id === 'ffFile'){ deposer(e.target.files[0]); e.target.value = ''; } });
  box.addEventListener('dragover', e => { const d = e.target.closest('.ff-drop'); if(d){ e.preventDefault(); d.classList.add('survol'); } });
  box.addEventListener('dragleave', e => { const d = e.target.closest('.ff-drop'); if(d) d.classList.remove('survol'); });
  box.addEventListener('drop', e => { const d = e.target.closest('.ff-drop'); if(!d) return; e.preventDefault(); d.classList.remove('survol'); deposer(e.dataTransfer.files[0]); });
  box.addEventListener('click', async e => {
    const f = e.target.closest('[data-ff-f]'); if(f){ filtre = f.dataset.ffF; render(); return; }
    const a = e.target.closest('[data-ff-a]'); if(!a) return;
    const id = a.closest('tr').dataset.ff, L = rows(), x = L.find(y => y.id === id); if(!x) return;
    if(a.dataset.ffA === 'payer'){ x.statut = 'Payée'; x.paye = num(x.ttc); x.paye_le = T0(); if(!x.mode) x.mode = 'Virement'; R.save(L); render(); }
    else if(a.dataset.ffA === 'modif'){ cur = Object.assign({}, x); fichier = null; urlApercu = null;
      if(x.fichier){ const b = await fGet(x.fichier); if(b){ fichier = b; urlApercu = URL.createObjectURL(b); } } form(cur, null); }
    else if(a.dataset.ffA === 'voir'){ const b = await fGet(x.fichier); if(!b){ alert('Le fichier n’est pas sur cet appareil (il reste dans le navigateur où la facture a été déposée).'); return; } const u = URL.createObjectURL(b); window.open(u, '_blank'); setTimeout(() => URL.revokeObjectURL(u), 60000); }
  });
  modal.addEventListener('click', e => {
    if(e.target === modal) return fermer();
    const b = e.target.closest('[data-ff-m]'); if(!b) return;
    if(b.dataset.ffM === 'fermer') fermer();
    else if(b.dataset.ffM === 'ok') enregistrer();
    else if(b.dataset.ffM === 'suppr' && confirm('Supprimer cette facture fournisseur ?')){ const L = rows().filter(y => y.id !== cur.id); if(cur.fichier) fDel(cur.fichier); R.save(L); fermer(); render(); }
  });
  document.addEventListener('keydown', e => { if(!modal.hidden && e.key === 'Escape') fermer(); });
  window.addEventListener('ej-reg', e => { if(e.detail === 'factures_fournisseurs' && modal.hidden) render(); });
  document.querySelectorAll('.sidebar .tab[data-tab="fournisseurs"]').forEach(t => t.addEventListener('click', render));
  render();

  /* ---------- Pour la trésorerie, les rappels et l'assistant ---------- */
  function dus(){ return rows().filter(x => x.statut !== 'Payée' && reste(x) > 0).map(x => ({soc:x.soc || 'BSD', date:x.echeance || x.date || T0(), lib:`${x.fournisseur}${x.numero ? ' — facture ' + x.numero : ''}`, montant:enEur(reste(x), x.devise), retard:!!x.echeance && jours(x.echeance) < 0, id:x.id})); }
  window.EJ_FOURN = {dus, rows, lireTexte, ouvrir:() => { const b = document.querySelector('.sidebar .tab[data-tab="fournisseurs"]'); if(b) b.click(); }};
})();
