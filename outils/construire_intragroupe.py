#!/usr/bin/env python3
"""Reconstitue les factures BSD -> NB Evolution (ventes internes au groupe).

Le dashboard contient, pour chaque commande NB Evolution, la version Dubaï de la facture (n° NB…,
prix plein revendu au client final). Les registres donnees_sources/FACTURES_20XX.md contiennent la
version BSD (n° EJ…, prix négocié facturé par BSD à NB Evolution). La correspondance NB -> EJ est
dans donnees_sources/FACTURES_DUBAI.md.

Pour chaque paire, ce script reprend les lignes de la facture NB du dashboard (collection, référence,
quantités, testeurs, coût de fabrication) et y met le CA de la version EJ lu dans le registre.
Résultat : dashboard-netlify/data/intragroupe.js (const INTRAGROUPE = [...]).

Usage : python3 outils/construire_intragroupe.py            -> vérifie et écrit le fichier
"""
import json, os, re, sys, unicodedata
sys.path.insert(0, os.path.dirname(__file__))
from rebuild_dashboard import find_blob

ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC = os.path.join(ROOT, 'donnees_sources')
OUT = os.path.join(ROOT, 'dashboard-netlify', 'data', 'intragroupe.js')
COLLS = ['VIP BLACK', 'VIP', '50ML', 'BRUMES', 'ROYAL', 'TRANSPORT', 'COFFRET', 'SERVICE', 'CONCENTRÉ']

def norm(s):
    s = unicodedata.normalize('NFD', s.replace('’', "'").replace('œ', 'oe').replace('Œ', 'OE'))
    return re.sub(r'[̀-ͯ]', '', s).upper().strip()

def money(s):
    return float(re.sub(r'[^\d,.\-]', '', s.replace(' ', '').replace('\xa0', '')).replace(',', '.'))

def blocks(path):
    md = open(path, encoding='utf-8').read()
    for b in re.split(r'^### Facture N° ', md, flags=re.M)[1:]:
        yield b.split()[0], b

def parse_ej(block):
    """Lignes (collection, référence) -> CA, et CA total, d'une facture du registre."""
    lines, coll = {}, None
    for raw in block.splitlines():
        if raw.startswith('#### '):
            head = norm(raw[5:])
            coll = next((c for c in COLLS if head.startswith(norm(c))), None)
            continue
        if coll and raw.startswith('|') and not raw.startswith('|---'):
            cells = [c.strip() for c in raw.strip('|').split('|')]
            ref = cells[0].strip('* ')
            if not ref or norm(ref).startswith(('REFERENCE', 'SOUS-TOTAL', 'TOTAL', 'ARTICLE')) or '€' not in cells[-1]:
                continue
            key = (coll, norm(ref))
            lines[key] = lines.get(key, 0) + money(cells[-1])
    tot = re.findall(r'CA TOTAL[^:]*:\s*\**\s*([\d\s \xa0.,]+)\s*€', block)
    return lines, (money(tot[-1]) if tot else None)

def main():
    html = open(os.path.join(ROOT, 'dashboard-netlify', 'data', 'ventes.js'), encoding='utf-8').read()
    a, b = find_blob(html, 'ALL'); A = json.loads(html[a:b])
    nb_fact = {f['facture']: f for y in ('2025', '2026') for f in A[y]['factures']}
    mapping = {}
    for num, blk in blocks(os.path.join(SRC, 'FACTURES_DUBAI.md')):
        m = re.search(r'Correspond à[^:]*:\**\s*(EJ\d+)', blk)
        if m: mapping[num] = m.group(1)
    ej_blocks = {}
    for y in ('2025', '2026'):
        for num, blk in blocks(os.path.join(SRC, f'FACTURES_{y}.md')): ej_blocks[num] = blk

    out, problems = [], []
    for nb_num, ej_num in sorted(mapping.items()):
        nb = nb_fact.get(nb_num)
        if not nb or ej_num not in ej_blocks:
            problems.append(f'{nb_num}/{ej_num} introuvable'); continue
        ej_lines, ej_total = parse_ej(ej_blocks[ej_num])
        lines, unmatched = [], []
        for l in nb['lines']:
            key = (l['collection'], norm(l['reference']))
            if key in ej_lines:
                ca = round(ej_lines.pop(key), 2)
            elif l['collection'] == 'REMISE':
                ca = None
            else:
                ca = None; unmatched.append(l['reference'])
            lines.append((l, ca))
        known = sum(ca for _, ca in lines if ca is not None)
        missing = [l for l, ca in lines if ca is None and l['collection'] != 'REMISE']
        if (unmatched or ej_lines) and ej_total is not None:
            # lignes non retrouvées : CA réparti au prorata du prix plein
            rest = ej_total - known
            base = sum(l['ca'] for l in missing) or 1
            lines = [(l, round(l['ca'] * rest / base, 2) if (ca is None and l['collection'] != 'REMISE') else ca) for l, ca in lines]
            problems.append(f'{ej_num}: {len(unmatched)} ligne(s) réparties au prorata ({", ".join(unmatched[:4])})')
        new_lines = []
        for l, ca in lines:
            if l['collection'] == 'REMISE':
                continue   # les remises Dubaï ne s'appliquent pas à la facture BSD
            nl = dict(l); nl['ca'] = ca; nl['prix'] = round(ca / l['cartons'], 2) if l.get('mode') == 'carton' and l.get('cartons') else (round(ca / l['btl'], 4) if l.get('btl') else ca)
            nl['marge'] = round(ca - (l.get('cout') or 0), 4)
            new_lines.append(nl)
        f = {'facture': ej_num, 'date': nb['date'], 'client': nb['client'], 'pays': nb['pays'], 'btl': nb['btl'],
             'ca': round(sum(l['ca'] for l in new_lines), 2), 'cout': round(sum(l.get('cout') or 0 for l in new_lines), 4)}
        f['marge'] = round(f['ca'] - f['cout'], 4)
        f['lines'] = new_lines
        if nb.get('cadeaux'): f['cadeaux'] = nb['cadeaux']
        f['lien'] = nb_num
        f['annee'] = '2025' if nb in A['2025']['factures'] else '2026'
        if ej_total is not None and abs(f['ca'] - ej_total) > 0.05:
            problems.append(f'{ej_num}: CA reconstitué {f["ca"]:.2f} ≠ registre {ej_total:.2f}')
        out.append(f)

    print(f'{len(out)} factures BSD -> NB Evolution reconstituées, CA total {sum(f["ca"] for f in out):,.2f} €')
    for p in problems: print('  ⚠', p)
    open(OUT, 'w', encoding='utf-8').write(
        '// Factures BSD -> NB Evolution (ventes internes au groupe), reconstituées par outils/construire_intragroupe.py.\n'
        '// Utilisées pour la vue « BSD » (CA de BSD) et comme coût d\'achat dans la vue « NB Evolution ».\n'
        'const INTRAGROUPE = ' + json.dumps(out, ensure_ascii=False, indent=1) + ';\n')
    print('Écrit :', os.path.relpath(OUT, ROOT))

if __name__ == '__main__':
    main()
