/* Export « facturation électronique » des factures BSD (réforme française : émission obligatoire pour les PME
   au 1er septembre 2027, e-reporting des ventes à l'étranger).
   Le dashboard n'est pas une plateforme agréée : il prépare les fichiers à déposer sur la plateforme choisie par BSD.
   - Tableau e-reporting (CSV, Excel) : une ligne par facture / avoir de la période (HT, TVA, TTC, catégorie, pays…).
   - Une facture électronique par document au format CII (UN/CEFACT, profil EN 16931), un des 3 formats acceptés.
   - Le tout dans un .zip, avec un LISEZMOI.
   Sources : factures du registre (vue BSD, ventes internes BSD → NB comprises) enrichies par les documents créés
   dans le dashboard (adresse, n° TVA client, régime, échéance, testeurs et échantillons). */
(function(){
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const r2 = n => Math.round((+n || 0) * 100) / 100;
  const m2 = n => r2(n).toFixed(2);
  const eur = n => r2(n).toLocaleString('fr-FR', {minimumFractionDigits:2, maximumFractionDigits:2}) + ' €';
  const frIso = s => { const m = String(s || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? `${m[3]}-${m[2]}-${m[1]}` : String(s || ''); };
  const isoFr = s => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[3]}/${m[2]}/${m[1]}` : String(s || ''); };
  const d102 = iso => iso.replace(/-/g, '');
  const pad = n => String(n).padStart(2, '0');
  const isoDe = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const CAT = {
    export:{lib:'Export hors UE', code:'G', motif:'VATEX-EU-G', nature:'Livraison de biens à l’export (hors UE)'},
    intra:{lib:'Livraison intracommunautaire', code:'K', motif:'VATEX-EU-IC', nature:'Livraison intracommunautaire de biens'},
    fr:{lib:'France', code:'S', motif:'', nature:'Livraison de biens en France'}
  };

  /* ---------- Factures BSD d'une période ---------- */
  function factures(du, au){
    const D = window.EJ_DOCS, S = window.EJ_SOC && EJ_SOC.statsFor ? EJ_SOC.statsFor('BSD') : null; if(!D || !S) return [];
    const docs = D.list().filter(d => d.societe === 'BSD' && (d.type === 'facture' || d.type === 'avoir'));
    return (S.total.factures || []).filter(f => { const i = frIso(f.date); return i >= du && i <= au; })
      .map(f => fiche(f, docs.find(d => d.numero === f.facture)))
      .sort((a, b) => a.date.localeCompare(b.date) || a.numero.localeCompare(b.numero));
  }
  function fiche(f, doc){
    const D = EJ_DOCS, info = D.clientInfo(f.client, 'BSD') || {};
    const pays = (doc && doc.pays) || f.pays || info.pays || '';
    const regime = (doc && doc.regime) || D.regimeFor('BSD', pays), R = D.REGIMES.BSD[regime] || D.REGIMES.BSD.export;
    const x = {numero:f.facture, date:frIso(f.date), client:f.client, pays, code:codePays(pays), adresse:(doc && doc.adresse) || info.adresse || '',
      tvaClient:(doc && doc.tvaClient) || info.tvaClient || '', regime, taux:R.taux, mention:R.fr, doc:!!doc, alertes:[]};
    if(doc){
      const k = D.calc(doc); x.ht = k.ht; x.tva = k.tva; x.ttc = k.ttc; x.echeance = doc.echeance || '';
      x.lignes = k.rows.filter(r => r.ca).map(r => { const l = r.src, svc = D.isSvc(l), col = D.COLL[l.collection] || {};
        return {nom:svc ? (l.reference || col.fr || l.collection) : `${col.fr || l.collection} — ${l.reference || ''}`.trim(), ean:svc ? '' : (l.ean || D.eanOf(l.collection, l.reference, l.format) || ''),
          qte:+l.qty || 0, unite:svc ? 'C62' : (l.mode === 'carton' ? 'XBX' : 'H87'), prix:+l.prix || 0, total:r2(r.ca)}; });
      if(k.testersVal) x.lignes.push({nom:'Testeurs (valeur douane, offerts)', ean:'', qte:k.testers, unite:'H87', prix:k.pt, total:r2(k.testersVal)});
      if(k.echVal) x.lignes.push({nom:'Échantillons 2 ml (offerts)', ean:'', qte:k.nEch, unite:'H87', prix:k.pe, total:r2(k.echVal)});
    } else {
      x.ht = r2(f.ca); x.tva = r2(x.ht * x.taux / 100); x.ttc = r2(x.ht + x.tva); x.echeance = '';
      x.lignes = (f.lines || []).filter(l => l.ca > 0).map(l => { const carton = l.mode === 'carton' && l.cartons;
        return {nom:/^(SERVICE|TRANSPORT|CONCENTR|COFFRET)/.test(l.collection) ? (l.reference || l.collection) : `${l.collection} — ${l.reference || ''}`,
          ean:(D.eanOf && D.eanOf(l.collection, l.reference)) || '', qte:carton ? l.cartons : (l.btl || 1), unite:carton ? 'XBX' : 'H87',
          prix:carton ? (l.prix || r2(l.ca / l.cartons)) : r2(l.ca / (l.btl || 1)), total:r2(l.ca)}; });
      if(x.taux) x.alertes.push('TVA recalculée (facture du registre)');
    }
    // vente interne BSD → NB : l'acheteur est NB Evolution à Dubaï (le client final entre parenthèses n'est qu'une indication)
    if(/^nb evolution/i.test(f.client || '')){ x.clientFinal = f.client; x.client = 'NB EVOLUTION'; x.pays = 'Émirats Arabes Unis'; x.code = 'AE'; x.regime = 'export'; x.taux = 0; x.mention = D.REGIMES.BSD.export.fr; x.tva = 0; x.ttc = x.ht; x.alertes = x.alertes.filter(a => !/TVA/.test(a)); }
    // une facture électronique doit avoir au moins une ligne
    if(!x.lignes.length) x.lignes.push({nom:'Ventes de parfums (détail sur la facture d’origine)', ean:'', qte:1, unite:'C62', prix:Math.abs(x.ht), total:Math.abs(x.ht)});
    x.avoir = x.ht < 0 || /^AV/i.test(x.numero);
    if(!x.code) x.alertes.push('pays inconnu');
    if(regime === 'intra' && !x.tvaClient) x.alertes.push('n° TVA client manquant');
    if(!x.adresse) x.alertes.push('adresse manquante');
    return x;
  }

  /* ---------- Tableau e-reporting (CSV pour Excel : « ; » et virgule décimale) ---------- */
  function csv(L){
    const c = v => { const s = String(v == null ? '' : v); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const n = v => r2(v).toFixed(2).replace('.', ',');
    const tete = ['Type', 'Numéro', 'Date', 'Client', 'Pays', 'Code pays', 'N° TVA client', 'Catégorie', 'Nature de l’opération', 'Montant HT', 'Taux TVA', 'Montant TVA', 'Montant TTC', 'Devise', 'Motif d’exonération', 'Échéance', 'Source', 'À vérifier'];
    const lignes = L.map(x => [x.avoir ? 'Avoir' : 'Facture', x.numero, isoFr(x.date), x.client, x.pays, x.code, x.tvaClient, CAT[x.regime].lib, CAT[x.regime].nature,
      n(x.ht), n(x.taux), n(x.tva), n(x.ttc), 'EUR', x.mention, isoFr(x.echeance), x.doc ? 'Document du dashboard' : 'Registre des factures', x.alertes.join(' ; ')]);
    return '﻿' + [tete].concat(lignes).map(r => r.map(c).join(';')).join('\r\n') + '\r\n';
  }

  /* ---------- Facture électronique CII (EN 16931) ---------- */
  function cii(x){
    const S = EJ_DOCS.soc('BSD'), cat = CAT[x.regime], sg = x.avoir ? -1 : 1, taux = m2(x.taux);
    const siren = String(S.siret || '').replace(/\D/g, '').slice(0, 9);
    const cp = (String(S.cp_ville || '').match(/^\s*(\d{5})\s*(.*)$/) || []);
    const lignes = x.lignes.map(l => Object.assign({}, l, {total:r2(sg * l.total), prix:Math.abs(l.prix), qte:sg * l.qte}));
    const totLignes = r2(lignes.reduce((a, l) => a + l.total, 0)), ht = r2(sg * x.ht), remise = r2(totLignes - ht);
    const taxe = (montant) => `<ram:TypeCode>VAT</ram:TypeCode><ram:CategoryCode>${cat.code}</ram:CategoryCode><ram:RateApplicablePercent>${taux}</ram:RateApplicablePercent>`;
    const adr = (txt, code) => { const L = String(txt || '').split(/\n|,\s*/).map(s => s.trim()).filter(Boolean);
      return `<ram:PostalTradeAddress>${L[0] ? `<ram:LineOne>${esc(L[0])}</ram:LineOne>` : ''}${L[1] ? `<ram:LineTwo>${esc(L[1])}</ram:LineTwo>` : ''}${L.length > 2 ? `<ram:LineThree>${esc(L.slice(2).join(', '))}</ram:LineThree>` : ''}<ram:CountryID>${code || 'FR'}</ram:CountryID></ram:PostalTradeAddress>`; };
    const ac = (charge, montant, motif) => `<ram:SpecifiedTradeAllowanceCharge><ram:ChargeIndicator><udt:Indicator>${charge}</udt:Indicator></ram:ChargeIndicator><ram:ActualAmount>${m2(montant)}</ram:ActualAmount><ram:Reason>${esc(motif)}</ram:Reason><ram:CategoryTradeTax><ram:TypeCode>VAT</ram:TypeCode><ram:CategoryCode>${cat.code}</ram:CategoryCode><ram:RateApplicablePercent>${taux}</ram:RateApplicablePercent></ram:CategoryTradeTax></ram:SpecifiedTradeAllowanceCharge>`;
    const tva = r2(ht * x.taux / 100), ttc = r2(ht + tva);
    return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
<rsm:ExchangedDocumentContext><ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>urn:cen.eu:en16931:2017</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter></rsm:ExchangedDocumentContext>
<rsm:ExchangedDocument><ram:ID>${esc(x.numero)}</ram:ID><ram:TypeCode>${x.avoir ? 381 : 380}</ram:TypeCode><ram:IssueDateTime><udt:DateTimeString format="102">${d102(x.date)}</udt:DateTimeString></ram:IssueDateTime>${x.mention ? `<ram:IncludedNote><ram:Content>${esc(x.mention)}</ram:Content></ram:IncludedNote>` : ''}</rsm:ExchangedDocument>
<rsm:SupplyChainTradeTransaction>
${lignes.map((l, i) => `<ram:IncludedSupplyChainTradeLineItem><ram:AssociatedDocumentLineDocument><ram:LineID>${i + 1}</ram:LineID></ram:AssociatedDocumentLineDocument><ram:SpecifiedTradeProduct>${/^\d{13}$/.test(l.ean) ? `<ram:GlobalID schemeID="0160">${l.ean}</ram:GlobalID>` : ''}<ram:Name>${esc(l.nom)}</ram:Name></ram:SpecifiedTradeProduct><ram:SpecifiedLineTradeAgreement><ram:NetPriceProductTradePrice><ram:ChargeAmount>${(+l.prix || 0).toFixed(4)}</ram:ChargeAmount></ram:NetPriceProductTradePrice></ram:SpecifiedLineTradeAgreement><ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="${l.unite}">${(+l.qte || 0).toFixed(4)}</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery><ram:SpecifiedLineTradeSettlement><ram:ApplicableTradeTax>${taxe()}</ram:ApplicableTradeTax><ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>${m2(l.total)}</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation></ram:SpecifiedLineTradeSettlement></ram:IncludedSupplyChainTradeLineItem>`).join('\n')}
<ram:ApplicableHeaderTradeAgreement>
<ram:SellerTradeParty><ram:Name>${esc(S.nom)}</ram:Name>${siren ? `<ram:SpecifiedLegalOrganization><ram:ID schemeID="0002">${siren}</ram:ID></ram:SpecifiedLegalOrganization>` : ''}<ram:PostalTradeAddress>${cp[1] ? `<ram:PostcodeCode>${cp[1]}</ram:PostcodeCode>` : ''}<ram:LineOne>${esc(S.adresse)}</ram:LineOne><ram:CityName>${esc(cp[2] || S.cp_ville)}</ram:CityName><ram:CountryID>FR</ram:CountryID></ram:PostalTradeAddress>${S.tva ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${esc(String(S.tva).replace(/\s/g, ''))}</ram:ID></ram:SpecifiedTaxRegistration>` : ''}</ram:SellerTradeParty>
<ram:BuyerTradeParty><ram:Name>${esc(x.client)}</ram:Name>${adr(x.adresse, x.code)}${x.tvaClient ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${esc(String(x.tvaClient).replace(/\s/g, ''))}</ram:ID></ram:SpecifiedTaxRegistration>` : ''}</ram:BuyerTradeParty>
</ram:ApplicableHeaderTradeAgreement>
<ram:ApplicableHeaderTradeDelivery><ram:ActualDeliverySupplyChainEvent><ram:OccurrenceDateTime><udt:DateTimeString format="102">${d102(x.date)}</udt:DateTimeString></ram:OccurrenceDateTime></ram:ActualDeliverySupplyChainEvent></ram:ApplicableHeaderTradeDelivery>
<ram:ApplicableHeaderTradeSettlement>
<ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
${S.iban ? `<ram:SpecifiedTradeSettlementPaymentMeans><ram:TypeCode>58</ram:TypeCode><ram:PayeePartyCreditorFinancialAccount><ram:IBANID>${esc(String(S.iban).replace(/\s/g, ''))}</ram:IBANID></ram:PayeePartyCreditorFinancialAccount></ram:SpecifiedTradeSettlementPaymentMeans>` : ''}
<ram:ApplicableTradeTax><ram:CalculatedAmount>${m2(tva)}</ram:CalculatedAmount><ram:TypeCode>VAT</ram:TypeCode>${cat.motif ? `<ram:ExemptionReason>${esc(x.mention)}</ram:ExemptionReason>` : ''}<ram:BasisAmount>${m2(ht)}</ram:BasisAmount><ram:CategoryCode>${cat.code}</ram:CategoryCode>${cat.motif ? `<ram:ExemptionReasonCode>${cat.motif}</ram:ExemptionReasonCode>` : ''}<ram:RateApplicablePercent>${taux}</ram:RateApplicablePercent></ram:ApplicableTradeTax>
${remise > 0 ? ac(false, remise, 'Remise') : remise < 0 ? ac(true, -remise, 'Ajustement') : ''}
${x.echeance ? `<ram:SpecifiedTradePaymentTerms><ram:DueDateDateTime><udt:DateTimeString format="102">${d102(x.echeance)}</udt:DateTimeString></ram:DueDateDateTime></ram:SpecifiedTradePaymentTerms>` : ''}
<ram:SpecifiedTradeSettlementHeaderMonetarySummation><ram:LineTotalAmount>${m2(totLignes)}</ram:LineTotalAmount>${remise < 0 ? `<ram:ChargeTotalAmount>${m2(-remise)}</ram:ChargeTotalAmount>` : ''}${remise > 0 ? `<ram:AllowanceTotalAmount>${m2(remise)}</ram:AllowanceTotalAmount>` : ''}<ram:TaxBasisTotalAmount>${m2(ht)}</ram:TaxBasisTotalAmount><ram:TaxTotalAmount currencyID="EUR">${m2(tva)}</ram:TaxTotalAmount><ram:GrandTotalAmount>${m2(ttc)}</ram:GrandTotalAmount><ram:DuePayableAmount>${m2(ttc)}</ram:DuePayableAmount></ram:SpecifiedTradeSettlementHeaderMonetarySummation>
</ram:ApplicableHeaderTradeSettlement>
</rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>
`;
  }

  /* ---------- .zip sans compression (aucune bibliothèque nécessaire) ---------- */
  const CRC = (() => { const t = new Uint32Array(256); for(let n = 0; n < 256; n++){ let c = n; for(let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = b => { let c = 0xFFFFFFFF; for(let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function zip(fichiers){
    const enc = new TextEncoder(), parts = [], centre = []; let pos = 0;
    const now = new Date(), dt = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)), dd = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate());
    fichiers.forEach(([nom, txt]) => {
      const n = enc.encode(nom), d = enc.encode(txt), c = crc32(d);
      const h = new DataView(new ArrayBuffer(30)); [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, 0, 2], [10, dt, 2], [12, dd, 2], [14, c, 4], [18, d.length, 4], [22, d.length, 4], [26, n.length, 2], [28, 0, 2]].forEach(([o, v, s]) => s === 4 ? h.setUint32(o, v, true) : h.setUint16(o, v, true));
      const ch = new DataView(new ArrayBuffer(46)); [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, 0, 2], [12, dt, 2], [14, dd, 2], [16, c, 4], [20, d.length, 4], [24, d.length, 4], [28, n.length, 2], [30, 0, 2], [32, 0, 2], [34, 0, 2], [36, 0, 2], [38, 0, 4], [42, pos, 4]].forEach(([o, v, s]) => s === 4 ? ch.setUint32(o, v, true) : ch.setUint16(o, v, true));
      parts.push(h, n, d); centre.push(ch, n); pos += 30 + n.length + d.length;
    });
    const tailleC = centre.reduce((a, b) => a + b.byteLength, 0), fin = new DataView(new ArrayBuffer(22));
    [[0, 0x06054b50, 4], [8, fichiers.length, 2], [10, fichiers.length, 2], [12, tailleC, 4], [16, pos, 4]].forEach(([o, v, s]) => s === 4 ? fin.setUint32(o, v, true) : fin.setUint16(o, v, true));
    return new Blob(parts.concat(centre, [fin]), {type:'application/zip'});
  }
  function telecharger(nom, blob){ const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nom; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }

  /* ---------- Fenêtre ---------- */
  let du, au;
  function periode(k){
    const t = new Date(), y = t.getFullYear(), m = t.getMonth();
    if(k === 'mois') return [isoDe(new Date(y, m, 1)), isoDe(new Date(y, m + 1, 0))];
    if(k === 'moisPrec') return [isoDe(new Date(y, m - 1, 1)), isoDe(new Date(y, m, 0))];
    if(k === 'trimPrec'){ const q = Math.floor(m / 3) * 3; return [isoDe(new Date(y, q - 3, 1)), isoDe(new Date(y, q, 0))]; }
    if(k === 'annee') return [`${y}-01-01`, `${y}-12-31`];
    if(k === 'anneePrec') return [`${y - 1}-01-01`, `${y - 1}-12-31`];
  }
  function ouvrir(){
    let ov = $('fxModal');
    if(!ov){
      ov = document.createElement('div'); ov.className = 'modal-overlay'; ov.id = 'fxModal';
      ov.innerHTML = '<div class="modal fx-modal"><button class="modal-close" data-fx="fermer">×</button><h2>Facturation électronique — BSD</h2><div id="fxBody"></div></div>';
      document.body.appendChild(ov);
      ov.addEventListener('click', e => {
        if(e.target === ov || e.target.closest('[data-fx="fermer"]')) return ov.classList.remove('active');
        const p = e.target.closest('[data-fx-p]'); if(p){ [du, au] = periode(p.dataset.fxP); rendre(); return; }
        const a = e.target.closest('[data-fx]'); if(!a) return;
        const L = factures(du, au), nom = `BSD_${du}_${au}`;
        if(a.dataset.fx === 'csv') telecharger(`e-reporting_${nom}.csv`, new Blob([csv(L)], {type:'text/csv;charset=utf-8'}));
        if(a.dataset.fx === 'zip') telecharger(`facturation-electronique_${nom}.zip`, zip([[`e-reporting_${nom}.csv`, csv(L)], ['LISEZMOI.txt', lisezmoi(L)]].concat(L.map(x => [`factures-cii/${x.numero}.xml`, cii(x)]))));
      });
      ov.addEventListener('change', e => { if(e.target.id === 'fxDu') du = e.target.value; if(e.target.id === 'fxAu') au = e.target.value; rendre(); });
    }
    if(!du) [du, au] = periode('moisPrec');
    rendre(); ov.classList.add('active');
  }
  function lisezmoi(L){
    return `Export facturation électronique — BSD — du ${isoFr(du)} au ${isoFr(au)}\r\nGénéré par le dashboard le ${new Date().toLocaleString('fr-FR')}\r\n\r\n`
      + `- e-reporting_….csv : une ligne par facture ou avoir (HT, TVA, TTC, catégorie, pays). S'ouvre dans Excel.\r\n`
      + `  Sert au e-reporting des ventes à l'étranger (export hors UE et livraisons intracommunautaires).\r\n`
      + `- factures-cii/ : chaque facture au format CII (UN/CEFACT, norme EN 16931), un des formats acceptés par les plateformes agréées.\r\n\r\n`
      + `Ces fichiers sont à déposer ou importer sur la plateforme agréée de BSD. À faire valider par l'expert-comptable.\r\n`
      + `Les factures venant du registre (et non créées dans le dashboard) n'ont pas toujours l'adresse ou le n° TVA du client : voir la colonne « À vérifier ».\r\n\r\n`
      + `${L.length} document(s), total HT ${eur(L.reduce((a, x) => a + x.ht, 0))}.\r\n`;
  }
  function rendre(){
    const L = factures(du, au), parCat = {};
    L.forEach(x => { const c = parCat[x.regime] = parCat[x.regime] || {n:0, ht:0, tva:0}; c.n++; c.ht += x.ht; c.tva += x.tva; });
    const alertes = L.filter(x => x.alertes.length).length;
    $('fxBody').innerHTML = `
      <p class="fx-intro">Prépare les fichiers à déposer sur la <strong>plateforme agréée</strong> de BSD : le tableau du <strong>e-reporting</strong> (ventes à l'étranger) et chaque facture au <strong>format électronique</strong> (CII, norme EN 16931). Le dashboard ne transmet rien lui-même.</p>
      <div class="fx-per"><div class="vx-pills">${[['moisPrec', 'Mois dernier'], ['mois', 'Ce mois-ci'], ['trimPrec', 'Trimestre dernier'], ['annee', 'Cette année'], ['anneePrec', 'Année dernière']].map(([k, l]) => { const [a, b] = periode(k); return `<button type="button" data-fx-p="${k}" class="${a === du && b === au ? 'actif' : ''}">${l}</button>`; }).join('')}</div>
        <label>Du <input type="date" id="fxDu" value="${du}"></label><label>au <input type="date" id="fxAu" value="${au}"></label></div>
      <div class="vx-kpis">${Object.keys(CAT).filter(k => parCat[k]).map(k => `<div class="vx-kpi"><span>${CAT[k].lib}</span><strong>${eur(parCat[k].ht)}</strong><small>${parCat[k].n} document${parCat[k].n > 1 ? 's' : ''}${parCat[k].tva ? ' · TVA ' + eur(parCat[k].tva) : ' · exonéré'}</small></div>`).join('') || '<div class="vx-kpi"><span>Période</span><strong>0</strong><small>aucune facture BSD</small></div>'}</div>
      ${L.length ? `<div class="fx-liste"><table><thead><tr><th>Date</th><th>N°</th><th>Client</th><th>Catégorie</th><th class="r">HT</th><th class="r">TVA</th><th>À vérifier</th></tr></thead><tbody>
        ${L.map(x => `<tr><td>${isoFr(x.date)}</td><td>${esc(x.numero)}</td><td>${typeof drapeau === 'function' ? drapeau(x.pays) : ''}${esc(x.client)}</td><td>${CAT[x.regime].lib}</td><td class="r">${eur(x.ht)}</td><td class="r">${eur(x.tva)}</td><td class="fx-al">${x.alertes.map(esc).join('<br>')}</td></tr>`).join('')}</tbody></table></div>` : ''}
      ${alertes ? `<p class="fx-note">${alertes} document${alertes > 1 ? 's' : ''} à compléter : renseignez l'adresse et le n° TVA dans la fiche du client (« Coordonnées des sociétés » → clients) ou dans la facture.</p>` : ''}
      <div class="fx-act"><button type="button" class="doc-btn primary" data-fx="zip"${L.length ? '' : ' disabled'}>Télécharger tout (.zip)</button><button type="button" class="doc-btn" data-fx="csv"${L.length ? '' : ' disabled'}>Tableau e-reporting seul (Excel)</button></div>`;
  }

  // Bouton dans l'onglet « Factures & proformas »
  const tools = document.querySelector('#documents .doc-tools');
  if(tools){ const b = document.createElement('button'); b.className = 'doc-btn fx-btn'; b.type = 'button'; b.textContent = 'Facturation électronique (export BSD)'; b.addEventListener('click', ouvrir); tools.insertBefore(b, tools.firstChild); }
  window.EJ_EFACTURE = {factures, csv, cii, zip, ouvrir};
})();
