/* Partage des données entre les membres de l'équipe (Supabase).
   Sans configuration (data/config-cloud.js vide), tout reste dans le navigateur (« mode local »).
   Avec configuration : connexion par e-mail et mot de passe, puis les saisies (documents, journal, équipe, registres
   de gestion, fiches clients…) sont envoyées dans la table « ej_partage » et récupérées sur les autres appareils.
   Mise en place : voir PARTAGE-SUPABASE.md. API REST et Auth de Supabase appelées directement (pas de bibliothèque). */
(function(){
  const C = window.EJ_CLOUD_CONFIG || {};
  const ON = !!(C.url && C.anonKey);
  const TABLE = C.table || 'ej_partage';
  const SESSION = 'ej_cloud_session', META = 'ej_cloud_meta';
  // Clés partagées (le reste — caches, préférences d'affichage — reste propre à chaque appareil)
  const PARTAGEES = ['ej_documents_v1', 'ej_documents_settings_v2', 'ej_journal_v1', 'ej_equipe_v1', 'ej_salons_perso', 'productionData_v1', 'ej-simulateur-v3'];
  const partagee = k => PARTAGEES.includes(k) || /^ej_reg_/.test(k);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ls = {get:k => { try { return localStorage.getItem(k); } catch(e) { return null; } }, set:null};
  const rawSet = Storage.prototype.setItem;
  ls.set = (k, v) => { try { rawSet.call(localStorage, k, v); } catch(e) {} };
  const jget = (k, d) => { try { return JSON.parse(ls.get(k)) || d; } catch(e) { return d; } };

  let sess = jget(SESSION, null), meta = jget(META, {}), file = {}, timer = null, dernier = meta._pull || '';
  const foot = () => document.getElementById('cloudFoot');
  function etat(txt, cls){ const f = foot(); if(f){ f.innerHTML = txt; f.className = 'cloud-foot ' + (cls || ''); } }

  /* ---------- Appels Supabase ---------- */
  const H = extra => Object.assign({apikey:C.anonKey, 'Content-Type':'application/json'}, sess ? {Authorization:'Bearer ' + sess.access_token} : {}, extra || {});
  async function auth(body, grant){
    const r = await fetch(`${C.url}/auth/v1/token?grant_type=${grant}`, {method:'POST', headers:{apikey:C.anonKey, 'Content-Type':'application/json'}, body:JSON.stringify(body)});
    const d = await r.json().catch(() => ({}));
    if(!r.ok) throw new Error(d.error_description || d.msg || d.message || 'Connexion refusée');
    sess = {access_token:d.access_token, refresh_token:d.refresh_token, exp:Date.now() + (d.expires_in || 3600) * 1000, email:(d.user || {}).email || (sess || {}).email};
    ls.set(SESSION, JSON.stringify(sess));
  }
  async function jeton(){ if(sess && Date.now() > sess.exp - 120e3) await auth({refresh_token:sess.refresh_token}, 'refresh_token'); }
  async function rest(path, opt){
    await jeton();
    const r = await fetch(`${C.url}/rest/v1/${path}`, Object.assign({}, opt, {headers:H(opt && opt.headers)}));
    if(r.status === 401){ deconnecter(true); throw new Error('Session expirée'); }
    if(!r.ok){ const t = await r.text(); throw new Error(r.status === 404 ? `Table « ${TABLE} » introuvable : voir PARTAGE-SUPABASE.md` : t.slice(0, 200)); }
    const t = await r.text();   // « return=minimal » : réponse vide
    return t ? JSON.parse(t) : null;
  }

  /* ---------- Synchronisation ---------- */
  // Récupère ce qui a changé ailleurs ; retourne le nombre de clés mises à jour dans ce navigateur.
  async function tirer(){
    const rows = await rest(`${TABLE}?select=key,value,updated_at,updated_by${dernier ? '&updated_at=gt.' + encodeURIComponent(dernier) : ''}`, {method:'GET'});
    let n = 0, par = new Set();
    (rows || []).forEach(r => {
      if(r.updated_at > dernier) dernier = r.updated_at;
      if(file[r.key] !== undefined) return;                       // modification locale en attente : elle gagne
      if(meta[r.key] && meta[r.key] >= r.updated_at) return;
      const v = JSON.stringify(r.value);
      if(ls.get(r.key) !== v){ ls.set(r.key, v); n++; if(r.updated_by && r.updated_by !== (sess || {}).email) par.add(r.updated_by); }
      meta[r.key] = r.updated_at;
    });
    meta._pull = dernier; ls.set(META, JSON.stringify(meta));
    return {n, par:[...par]};
  }
  async function pousser(){
    const keys = Object.keys(file); if(!keys.length || !sess) return;
    // updated_at est fixé par le serveur (déclencheur SQL) : on relit la date renvoyée pour ne pas dépendre des horloges des appareils.
    const now = new Date().toISOString(), body = keys.map(k => { let v = null; try { v = JSON.parse(file[k]); } catch(e) { v = file[k]; } return {key:k, value:v, updated_at:now, updated_by:sess.email}; });
    file = {};
    try {
      const res = await rest(`${TABLE}?on_conflict=key&select=key,updated_at`, {method:'POST', headers:{Prefer:'resolution=merge-duplicates,return=representation'}, body:JSON.stringify(body)});
      keys.forEach(k => { const r = (res || []).find(x => x.key === k); meta[k] = r ? r.updated_at : now; }); ls.set(META, JSON.stringify(meta));
      etat(`☁ Synchronisé · ${esc(sess.email)} · <a href="#" data-cloud="out">Se déconnecter</a>`, 'ok');
    } catch(e) { body.forEach(b => { if(file[b.key] === undefined) file[b.key] = JSON.stringify(b.value); }); etat('☁ Envoi impossible, nouvel essai… <small>' + esc(e.message) + '</small>', 'ko'); planifier(15000); }
  }
  function planifier(ms){ clearTimeout(timer); timer = setTimeout(pousser, ms || 1200); }
  // Toute écriture d'une clé partagée part vers Supabase (regroupée toutes les 1,2 s)
  Storage.prototype.setItem = function(k, v){
    rawSet.call(this, k, v);
    if(ON && sess && this === localStorage && partagee(k)){ file[k] = v; planifier(); }
  };

  async function demarrer(premiere){
    etat('☁ Synchronisation…');
    const r = await tirer();
    // Première connexion de cet appareil : ce qui n'est pas encore en ligne y est envoyé.
    if(premiere){ for(let i = 0; i < localStorage.length; i++){ const k = localStorage.key(i); if(partagee(k) && !meta[k]) file[k] = ls.get(k); } if(Object.keys(file).length) await pousser(); }
    etat(`☁ Synchronisé · ${esc(sess.email)} · <a href="#" data-cloud="out">Se déconnecter</a>`, 'ok');
    if(r.n && !sessionStorage.getItem('ej_cloud_reload')){ sessionStorage.setItem('ej_cloud_reload', '1'); location.reload(); return; }
    sessionStorage.removeItem('ej_cloud_reload');
    setInterval(verifier, 60e3);
    window.addEventListener('focus', verifier);
  }
  async function verifier(){
    if(!sess || document.hidden) return;
    try { const r = await tirer(); if(r.n) bandeau(r.par); } catch(e) { etat('☁ Hors ligne · <small>' + esc(e.message) + '</small>', 'ko'); }
  }
  function bandeau(par){
    if(document.getElementById('cloudBand')) return;
    const b = document.createElement('div'); b.id = 'cloudBand'; b.className = 'cloud-band';
    b.innerHTML = `Données mises à jour${par.length ? ' par ' + esc(par.join(', ')) : ''}. <button type="button">Actualiser</button>`;
    b.querySelector('button').onclick = () => location.reload();
    document.body.appendChild(b);
  }
  function deconnecter(expire){
    sess = null; try { localStorage.removeItem(SESSION); } catch(e) {}
    if(expire) ecranConnexion('Session expirée : reconnecte-toi.'); else location.reload();
  }

  /* ---------- Écran de connexion ---------- */
  function ecranConnexion(msg){
    if(document.getElementById('cloudAuth')) return;
    const o = document.createElement('div'); o.id = 'cloudAuth'; o.className = 'cloud-auth';
    o.innerHTML = `<form class="cloud-box"><div class="cloud-t">Emmanuelle Jane</div><div class="cloud-s">Espace de l'équipe</div>
      <input name="email" type="email" placeholder="E-mail" autocomplete="username" required><input name="pwd" type="password" placeholder="Mot de passe" autocomplete="current-password" required>
      <div class="cloud-err">${esc(msg || '')}</div><button class="doc-btn primary">Se connecter</button>
      ${C.obligatoire ? '' : '<a href="#" data-cloud="local">Continuer sans connexion (données sur cet appareil)</a>'}</form>`;
    document.body.appendChild(o);
    o.querySelector('form').addEventListener('submit', async e => {
      e.preventDefault(); const f = e.target, err = o.querySelector('.cloud-err'); err.textContent = '';
      try { await auth({email:f.email.value.trim(), password:f.pwd.value}, 'password'); o.remove(); await demarrer(true); }
      catch(x) { err.textContent = /invalid/i.test(x.message) ? 'E-mail ou mot de passe incorrect.' : x.message; }
    });
  }
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-cloud]'); if(!a) return; e.preventDefault();
    if(a.dataset.cloud === 'out'){ if(confirm('Se déconnecter ? Les données restent dans ce navigateur.')) deconnecter(); }
    else if(a.dataset.cloud === 'in') ecranConnexion();
    else if(a.dataset.cloud === 'local'){ const o = document.getElementById('cloudAuth'); if(o) o.remove(); }
  });

  // Indicateur en bas du menu
  const sb = document.querySelector('.sidebar');
  if(sb){ const d = document.createElement('div'); d.id = 'cloudFoot'; d.className = 'cloud-foot'; sb.appendChild(d); }
  if(!ON) etat('Données enregistrées sur cet appareil <small>(partage en ligne non branché)</small>');
  else if(sess) demarrer(false).catch(e => etat('☁ Hors ligne · <small>' + esc(e.message) + '</small>', 'ko'));
  else { etat('Mode local · <a href="#" data-cloud="in">Se connecter pour partager</a>'); if(C.obligatoire) ecranConnexion(); }
  window.EJ_CLOUD = {actif:() => ON && !!sess, pousser};
})();
