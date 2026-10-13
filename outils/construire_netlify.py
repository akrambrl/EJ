#!/usr/bin/env python3
"""Fabrique un dashboard en UN SEUL fichier index.html, prêt à déposer sur Netlify (app.netlify.com/drop).
Styles, scripts, données, images et simulateur d'offres sont intégrés dans le fichier.
Usage : python3 outils/construire_netlify.py [dossier_sortie] [--mot-de-passe MOT]   (défaut : netlify-deploy/)
Avec un mot de passe (option ou variable d'environnement EJ_MOT_DE_PASSE), toute la page est chiffrée (AES-256-GCM,
clé dérivée du mot de passe par PBKDF2-SHA256) : sans le mot de passe, le fichier en ligne ne révèle aucune donnée.
Le navigateur déchiffre la page après saisie du mot de passe (option « se souvenir de cet appareil »).
⚠️ Sans mot de passe, le fichier contient toutes les données confidentielles en clair."""
import re, base64, os, sys, html
def datauri(path):
    ext = path.rsplit('.',1)[1].lower(); mime = {'png':'image/png','jpg':'image/jpeg','jpeg':'image/jpeg'}[ext]
    return f'data:{mime};base64,' + base64.b64encode(open(path,'rb').read()).decode()
def inline(base, h, transfo=None):
    lire = lambda rel: (transfo or (lambda r, t: t))(rel, open(os.path.join(base, rel), encoding='utf-8').read())
    h = re.sub(r'<link rel="stylesheet" href="([^"]+)">', lambda m: '<style>\n' + css(base, m.group(1)) + '\n</style>', h)
    h = re.sub(r'<script src="((?!https?:)[^"]+)"></script>', lambda m: '<script>\n' + lire(m.group(1)).replace('</script', '<\\/script') + '\n</script>', h)
    return h
def css(base, rel):
    p = os.path.join(base, rel); d = os.path.dirname(p)
    c = open(p, encoding='utf-8').read()
    return re.sub(r'url\(([^)]+\.(?:png|jpe?g))\)', lambda m: 'url(' + datauri(os.path.normpath(os.path.join(d, m.group(1)))) + ')', c)
HERE = os.path.dirname(os.path.abspath(__file__))
root = os.path.join(HERE, '..', 'dashboard-netlify')
args = sys.argv[1:]
mdp = os.environ.get('EJ_MOT_DE_PASSE', '')
if '--mot-de-passe' in args:
    i = args.index('--mot-de-passe'); mdp = args[i + 1]; del args[i:i + 2]
# Accès limité (sans chiffres financiers internes) : page séparée <sortie>/natali/, autre mot de passe
mdp_lim = os.environ.get('EJ_MOT_DE_PASSE_LIMITE', '')
if '--mot-de-passe-limite' in args:
    i = args.index('--mot-de-passe-limite'); mdp_lim = args[i + 1]; del args[i:i + 2]
out_dir = args[0] if args else os.path.join(HERE, '..', 'netlify-deploy')
os.makedirs(out_dir, exist_ok=True)
out = os.path.join(out_dir, 'index.html')
# simulateur autonome
sb = os.path.join(root, 'simulateur-offres')
sim = inline(sb, open(os.path.join(sb, 'index.html'), encoding='utf-8').read())
sim = re.sub(r'(?<=["(])img/([\w.-]+\.(?:png|jpe?g))', lambda m: datauri(os.path.join(sb, 'img', m.group(1))), sim)
def construire(role=None):
  from acces_limite import nettoyer
  h = inline(root, open(os.path.join(root, 'index.html'), encoding='utf-8').read(), nettoyer if role else None)
  if role:
    # Mentions de prix de revient écrites en dur dans la page (pied de page, notes de calcul)
    h = re.sub(r' — \*ROYAL : prix de revient provisoire[^<]*', '', h)
    h = re.sub(r'<p>Le prix de revient de la collection ROYAL[^<]*</p>', '', h)
    h = h.replace('<head>', '<head>\n<script>window.EJ_ROLE="' + role + '";document.documentElement.dataset.role="' + role + '";</script>', 1)
  # Logo : une seule copie (window.EJ_LOGO) reprise par les documents imprimables
  LOGO = datauri(os.path.join(root, 'img/logo.png'))
  h = h.replace('<img src="img/logo.png" alt="">`', '<img src="${window.EJ_LOGO}" alt="">`')
  h = re.sub(r'(<div class="pd-brand"><img src=")img/logo.png(")', r'\1${window.EJ_LOGO}\2', h)
  h = h.replace('"img/logo.png"', '"' + LOGO + '"')
  h = h.replace('<head>', '<head>\n<script>window.EJ_LOGO="' + LOGO + '";</script>', 1)
  h = h.replace('<iframe class="sim-frame" src="simulateur-offres/index.html"', '<iframe class="sim-frame" srcdoc="' + (html.escape(sim, quote=True) if not role else '') + '"')
  h = h.replace(' <a href="simulateur-offres/index.html" target="_blank" rel="noopener">Ouvrir dans un nouvel onglet</a>', '')
  h = h.replace('<link rel="icon" href="img/logo.png">', '<link rel="icon" href="' + datauri(os.path.join(root, 'img/logo.png')) + '">')
  return h
LOGO = datauri(os.path.join(root, 'img/logo.png'))
h = construire()
left = [x for x in re.findall(r'(?:src|href)="((?!https?:|data:|#|\$\{)[^"]+)"', h) if not x.startswith("' +")]
print('références locales restantes :', left)

CLE_STOCKAGE = 'ej_cle_acces'
def chiffrer_donnees(page, mot):
    """Chiffre une page (AES-256-GCM, clé PBKDF2-SHA256 du mot de passe) → {s, i, n, c} en base64."""
    import base64, secrets
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
    from cryptography.hazmat.primitives import hashes
    ITER = 310000
    sel, iv = secrets.token_bytes(16), secrets.token_bytes(12)
    cle = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=sel, iterations=ITER).derive(mot.encode('utf-8'))
    # Bouton « Verrouiller cet appareil » ajouté au menu de la page déchiffrée
    verrou = ('<script>(function(){var s=document.querySelector(".sidebar");if(!s)return;var a=document.createElement("a");a.href="#";a.className="cloud-foot";'
              'a.style.cssText="display:block;margin:10px auto 6px;padding:9px 14px;border:1px solid var(--gold);border-radius:8px;text-align:center;text-decoration:none;color:var(--ink);font-size:.85rem;width:max-content";a.textContent="Se déconnecter";a.title="Fermer la session sur cet appareil (pour changer d\'accès, ex. Natali)";a.onclick=function(e){e.preventDefault();try{localStorage.removeItem("' + CLE_STOCKAGE + '")}catch(x){}location.reload()};s.appendChild(a)})();</script>')
    page = page.replace('</body>', verrou + '</body>', 1)
    ct = AESGCM(cle).encrypt(iv, page.encode('utf-8'), None)
    b = lambda x: base64.b64encode(x).decode()
    return {'s': b(sel), 'i': b(iv), 'n': ITER, 'c': b(ct)}

def chiffrer(page, mot, fichier_limite=''):
    """Page de connexion + page chiffrée. Le déchiffrement se fait dans le navigateur (WebCrypto).
    Avec fichier_limite : si le mot de passe n'ouvre pas la page principale, la page de connexion essaie l'accès limité
    (fichier chiffré à part, téléchargé seulement dans ce cas) — même adresse, autre mot de passe."""
    import json
    D = chiffrer_donnees(page, mot)
    return f"""<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,minimum-scale=1,shrink-to-fit=no,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow"><title>Emmanuelle Jane Paris</title><link rel="icon" href="{LOGO}">
<style>html,body{{margin:0;height:100%;background:#070605;color:#F2E8D8;font-family:Georgia,serif}}
.b{{min-height:100%;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;background:radial-gradient(circle at 50% 30%,#1d1712,#070605 70%)}}
form{{width:100%;max-width:340px;text-align:center;border:1px solid rgba(201,164,86,.3);padding:30px 24px;background:rgba(21,18,15,.9)}}
img{{width:84px}}h1{{font-weight:400;font-size:1.6rem;margin:12px 0 2px}}p{{font:11px/1.6 sans-serif;letter-spacing:.25em;text-transform:uppercase;color:#C9A456;margin:0 0 18px}}
input[type=password]{{width:100%;box-sizing:border-box;padding:12px;background:#0B0A09;border:1px solid #332C25;color:#F2E8D8;font-size:15px}}
label{{display:block;font:12px sans-serif;color:#A3968A;margin:12px 0}}button{{width:100%;padding:12px;border:0;background:linear-gradient(135deg,#F6E3A8,#D9B866 38%,#B8913F 62%,#E9CF85);color:#14110D;font:600 12px sans-serif;letter-spacing:.2em;text-transform:uppercase;cursor:pointer}}
#e{{color:#E8847A;font:13px sans-serif;min-height:18px;margin:10px 0 0}}</style></head>
<body><div class="b"><form id="f"><img src="{LOGO}" alt=""><h1>Emmanuelle Jane</h1><p>Tableau de bord</p>
<input type="password" id="m" placeholder="Mot de passe" autocomplete="current-password" autofocus required>
<label><input type="checkbox" id="r" checked> Se souvenir de cet appareil</label><button>Ouvrir</button><div id="e"></div></form></div>
<script>
var __EJD={json.dumps(D)},__EJL="{fichier_limite}",__EJS="{CLE_STOCKAGE}";
function __ejU(s){{var b=atob(s),a=new Uint8Array(b.length);for(var i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a}}
function __ejK(a){{var s="";a=new Uint8Array(a);for(var i=0;i<a.length;i++)s+=String.fromCharCode(a[i]);return btoa(s)}}
async function __ejD(raw,d){{var k=await crypto.subtle.importKey("raw",raw,"AES-GCM",false,["decrypt"]);return new TextDecoder().decode(await crypto.subtle.decrypt({{name:"AES-GCM",iv:__ejU(d.i)}},k,__ejU(d.c)))}}
async function __ejW(h){{if(document.readyState==="loading")await new Promise(function(r){{document.addEventListener("DOMContentLoaded",r)}});document.open();document.write(h);document.close()}}
async function __ejR(m,d){{var b=await crypto.subtle.importKey("raw",new TextEncoder().encode(m),"PBKDF2",false,["deriveBits"]);
 return crypto.subtle.deriveBits({{name:"PBKDF2",salt:__ejU(d.s),iterations:d.n,hash:"SHA-256"}},b,256)}}
async function __ejL(){{var r=await fetch(__EJL,{{cache:"no-store"}});if(!r.ok)throw new Error("accès limité indisponible");return r.json()}}
(async function(){{try{{var c=localStorage.getItem(__EJS);if(!c)return;
 if(c.slice(0,2)==="L:"){{await __ejW(await __ejD(__ejU(c.slice(2)),await __ejL()))}}else{{await __ejW(await __ejD(__ejU(c),__EJD))}}}}
 catch(x){{try{{localStorage.removeItem(__EJS)}}catch(y){{}}}}}})();
document.getElementById("f").onsubmit=async function(ev){{ev.preventDefault();var e=document.getElementById("e");e.textContent="Ouverture…";
 var garder=document.getElementById("r").checked,m=document.getElementById("m").value,h,cle;
 try{{var raw=await __ejR(m,__EJD);h=await __ejD(raw,__EJD);cle=__ejK(raw)}}catch(x){{}}
 if(!h&&__EJL)try{{var d=await __ejL(),raw2=await __ejR(m,d);h=await __ejD(raw2,d);cle="L:"+__ejK(raw2)}}catch(x){{}}
 if(!h){{e.textContent="Mot de passe incorrect.";return}}
 if(garder)try{{localStorage.setItem(__EJS,cle)}}catch(x){{}}
 __ejW(h)}};
</script></body></html>"""

FICHIER_LIMITE = 'acces-limite.json'
if mdp_lim and not mdp:
    sys.exit('Le mot de passe principal est requis pour construire aussi l\'accès limité.')
if mdp:
    h = chiffrer(h, mdp, FICHIER_LIMITE if mdp_lim else '')
    print('page chiffrée (mot de passe requis)')
else:
    print('⚠️  page NON chiffrée : ajouter --mot-de-passe pour protéger les données')
open(out, 'w', encoding='utf-8').write(h)
if mdp_lim:
    # Accès limité : même adresse, autre mot de passe ; page sans chiffres financiers internes, chiffrée à part
    import json
    json.dump(chiffrer_donnees(construire('limite'), mdp_lim), open(os.path.join(out_dir, FICHIER_LIMITE), 'w'))
    print('accès limité :', FICHIER_LIMITE, '(chiffré, sans chiffres financiers internes)')
# Bibliothèques chargées à la demande (lecture des PDF de factures fournisseurs) : fichiers publics, sans donnée.
import shutil
src_pdf = os.path.join(root, 'vendor', 'pdfjs')
if os.path.isdir(src_pdf):
    shutil.copytree(src_pdf, os.path.join(out_dir, 'vendor', 'pdfjs'), dirs_exist_ok=True)
print('taille :', round(os.path.getsize(out)/1e6, 2), 'Mo')
