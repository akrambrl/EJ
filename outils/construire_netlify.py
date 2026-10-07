#!/usr/bin/env python3
"""Fabrique un dashboard en UN SEUL fichier index.html, prêt à déposer sur Netlify (app.netlify.com/drop).
Styles, scripts, données, images et simulateur d'offres sont intégrés dans le fichier.
Usage : python3 outils/construire_netlify.py [dossier_sortie]   (défaut : netlify-deploy/)
⚠️ Le fichier contient toutes les données confidentielles : protéger le site par mot de passe."""
import re, base64, os, sys, html
def datauri(path):
    ext = path.rsplit('.',1)[1].lower(); mime = {'png':'image/png','jpg':'image/jpeg','jpeg':'image/jpeg'}[ext]
    return f'data:{mime};base64,' + base64.b64encode(open(path,'rb').read()).decode()
def inline(base, h):
    h = re.sub(r'<link rel="stylesheet" href="([^"]+)">', lambda m: '<style>\n' + css(base, m.group(1)) + '\n</style>', h)
    h = re.sub(r'<script src="((?!https?:)[^"]+)"></script>', lambda m: '<script>\n' + open(os.path.join(base, m.group(1)), encoding='utf-8').read().replace('</script', '<\\/script') + '\n</script>', h)
    return h
def css(base, rel):
    p = os.path.join(base, rel); d = os.path.dirname(p)
    c = open(p, encoding='utf-8').read()
    return re.sub(r'url\(([^)]+\.(?:png|jpe?g))\)', lambda m: 'url(' + datauri(os.path.normpath(os.path.join(d, m.group(1)))) + ')', c)
HERE = os.path.dirname(os.path.abspath(__file__))
root = os.path.join(HERE, '..', 'dashboard-netlify')
out_dir = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', 'netlify-deploy')
os.makedirs(out_dir, exist_ok=True)
out = os.path.join(out_dir, 'index.html')
# simulateur autonome
sb = os.path.join(root, 'simulateur-offres')
sim = inline(sb, open(os.path.join(sb, 'index.html'), encoding='utf-8').read())
sim = re.sub(r'(?<=["(])img/([\w.-]+\.(?:png|jpe?g))', lambda m: datauri(os.path.join(sb, 'img', m.group(1))), sim)
# page principale
h = inline(root, open(os.path.join(root, 'index.html'), encoding='utf-8').read())
h = h.replace('"img/logo.png"', '"' + datauri(os.path.join(root, 'img/logo.png')) + '"')
h = h.replace("src=\"img/logo.png\" alt=\"\"", "src=\"" + datauri(os.path.join(root, 'img/logo.png')) + "\" alt=\"\"")
h = h.replace('<iframe class="sim-frame" src="simulateur-offres/index.html"', '<iframe class="sim-frame" srcdoc="' + html.escape(sim, quote=True) + '"')
h = h.replace(' <a href="simulateur-offres/index.html" target="_blank" rel="noopener">Ouvrir dans un nouvel onglet</a>', '')
h = h.replace('<link rel="icon" href="img/logo.png">', '<link rel="icon" href="' + datauri(os.path.join(root, 'img/logo.png')) + '">')
left = re.findall(r'(?:src|href)="((?!https?:|data:|#)[^"]+)"', h)
print('références locales restantes :', left)
open(out, 'w', encoding='utf-8').write(h)
print('taille :', round(os.path.getsize(out)/1e6, 2), 'Mo')
