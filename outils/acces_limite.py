"""Version « accès limité » du dashboard (ex. Natali) : mêmes pages de travail (devis et factures, stock, clients,
expéditions, salons…), mais SANS les chiffres financiers internes, retirés des données avant le chiffrement :
coûts de revient et marges, composants et leurs prix, charges, recettes bancaires, salaires et charges fixes,
factures fournisseurs, virements attendus, ventes internes BSD → NB, coût des cadeaux, analyses de marge.
Les montants des factures clients restent (nécessaires pour faire et consulter une facture).
Utilisé par construire_netlify.py (option --mot-de-passe-limite / variable EJ_MOT_DE_PASSE_LIMITE)."""
import json, re

# Données dont tous les nombres sont remis à 0 (les libellés restent, pour que les pages ne plantent pas).
TOUT_A_ZERO = ['data/charges.js', 'data/revenus.js', 'data/charges-fixes.js', 'data/factures-fournisseurs.js',
               'data/virements-en-attente.js', 'data/intragroupe.js', 'data/depenses-nb.js']
# Clés financières internes dans ALL (ventes)
CLES_COUT = {'cout', 'marge', 'kpi_cout', 'kpi_marge', 'kpi_marge_pct_known', 'cost_per_btl', 'benef_pot', 'ca_pot',
             'cout_achat', 'marge_pct', 'marge_nb', 'total_ca_pot', 'total_benef_pot'}
# Dans ALL.costs, seules ces valeurs restent (formats et prix de vente publics)
COSTS_GARDE = {'volume_ml', 'carton_size', 'standard_price_carton', 'standard_price_bottle', 'units_sold_per_carton', 'tester_ratio'}
# Blocs de prix internes dans js/app.js
BLOCS_APP = ['CADEAUX_UNIT_COST', 'CADEAUX_COST_DETAIL', 'CADEAUX_UNIT_COST_NEW', 'PROD_COMPONENTS_PRICES', 'CADEAUX_2ML_DETAIL',
             'CADEAUX_SAC_DETAIL', 'CADEAUX_MOUIL_DETAIL', 'CADEAUX_CATA_DETAIL']


def _zero(o, garde=frozenset(), vider_txt=False):
    if isinstance(o, dict):
        return {k: (v if k in garde else _zero(v, garde, vider_txt)) for k, v in o.items()}
    if isinstance(o, list):
        return [_zero(v, garde, vider_txt) for v in o]
    if isinstance(o, bool):
        return o
    if isinstance(o, (int, float)):
        return 0
    if isinstance(o, str) and vider_txt and re.search(r'\d', o):
        return ''
    return o


def _cles(o, cles):
    if isinstance(o, dict):
        return {k: (0 if k in cles and isinstance(v, (int, float)) and not isinstance(v, bool) else _cles(v, cles)) for k, v in o.items()}
    if isinstance(o, list):
        return [_cles(v, cles) for v in o]
    return o


def _blocs_const(txt, f):
    """Applique f à chaque « const NOM = <json>; » du fichier."""
    out, pos = [], 0
    for m in re.finditer(r'const\s+(\w+)\s*=\s*', txt):
        if m.start() < pos:
            continue
        debut = m.end()
        fin = _fin_json(txt, debut)
        if fin is None:
            continue
        try:
            obj = json.loads(txt[debut:fin])
        except Exception:
            continue
        out.append(txt[pos:debut]); out.append(json.dumps(f(m.group(1), obj), ensure_ascii=False)); pos = fin
    out.append(txt[pos:])
    return ''.join(out)


def _fin_json(txt, i):
    ouv = txt[i] if i < len(txt) else ''
    if ouv not in '{[':
        return None
    ferm, niv, dans, esc = {'{': '}', '[': ']'}[ouv], 0, False, False
    for j in range(i, len(txt)):
        c = txt[j]
        if dans:
            if esc: esc = False
            elif c == '\\': esc = True
            elif c == '"': dans = False
            continue
        if c == '"': dans = True
        elif c in '{[': niv += 1
        elif c in '}]':
            niv -= 1
            if niv == 0:
                return j + 1
    return None


def _ventes(nom, all_):
    if nom != 'ALL':
        return all_
    all_ = _cles(all_, CLES_COUT)
    if 'costs' in all_:
        all_['costs'] = {col: _zero(c, COSTS_GARDE, vider_txt=True) for col, c in all_['costs'].items()}
    for y, d in all_.items():
        if isinstance(d, dict) and 'insights' in d:
            d['insights'] = []            # analyses automatiques (citent des marges et des montants)
    return all_


def _zero_numeriques_bloc(txt, nom):
    m = re.search(r'const\s+' + nom + r'\s*=\s*', txt)
    if not m:
        return txt
    i = m.end()
    if txt[i] not in '{[':
        return txt
    # fin du bloc par équilibrage (le JS de ces blocs n'a pas de chaîne contenant d'accolade)
    niv, j = 0, i
    for j in range(i, len(txt)):
        if txt[j] in '{[': niv += 1
        elif txt[j] in '}]':
            niv -= 1
            if niv == 0:
                break
    bloc = re.sub(r'(?<![\w\'"])\d+(?:\.\d+)?(?![\w\'"])', '0', txt[i:j + 1])
    return txt[:i] + bloc + txt[j + 1:]


def nettoyer(rel, txt):
    """Contenu d'un fichier source → version sans chiffres financiers internes."""
    rel = rel.replace('\\', '/')
    if rel == 'data/cachets.js':   # pas de cachet ni de signature dans l'accès limité
        return 'const CACHETS = {};\n'
    if rel in TOUT_A_ZERO:
        return _blocs_const(txt, lambda n, o: _zero(o))
    if rel == 'data/ventes.js':
        return _blocs_const(txt, _ventes)
    if rel == 'js/app.js':
        for b in BLOCS_APP:
            txt = _zero_numeriques_bloc(txt, b)
        # commentaires qui citent des prix de revient (« … 0,67 € … »)
        txt = re.sub(r'^[ \t]*//[^\n]*(?:€|\$|prix|coût|cout)[^\n]*$', '', txt, flags=re.M | re.I)
        return txt
    return txt
