#!/usr/bin/env python3
"""
Recalcule TOUS les agrégats du dashboard Emmanuelle Jane à partir de factures[].
Usage :
  python3 rebuild_dashboard.py dashboard.html                 -> vérifie seulement (aucune écriture)
  python3 rebuild_dashboard.py dashboard.html --write         -> recalcule + réécrit le fichier (backup .bak créé)
  options : --today JJ/MM/AAAA  (date de référence pour les prédictions, défaut = aujourd'hui)
Règle d'or : on ne modifie QUE ALL[annee].factures[] (ajout/correction de facture),
puis on lance ce script. Jamais de patch manuel des KPI / clients / pays / mois / refs...
"""
import json, sys, shutil, datetime
from collections import defaultdict, OrderedDict

MOIS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"]

def find_blob(html, name):
    i = html.index("const " + name); j = html.index("=", i) + 1
    while html[j] in " \n\t": j += 1
    op = html[j]; cl = {'{': '}', '[': ']'}[op]; d = 0; s = False; e = False
    for k in range(j, len(html)):
        c = html[k]
        if s:
            if e: e = False
            elif c == '\\': e = True
            elif c == '"': s = False
        else:
            if c == '"': s = True
            elif c == op: d += 1
            elif c == cl:
                d -= 1
                if d == 0: return j, k + 1
    raise ValueError("blob non trouvé: " + name)

def pdate(s): return datetime.datetime.strptime(s, "%d/%m/%Y").date()
def fdate(d): return d.strftime("%d/%m/%Y")
def eur(x): return f"{round(x):,}".replace(",", " ")

def aggregate(factures, with_pred, today):
    F = sorted(factures, key=lambda f: (pdate(f["date"]), f["facture"]), reverse=True)
    cl = OrderedDict(); pa = OrderedDict(); pc = OrderedDict(); rf = OrderedDict(); co = OrderedDict()
    mo = {m: dict(mois=m, factures=0, btl=0, ca=0.0, cout=0.0, marge=0.0) for m in MOIS}
    ctp = defaultdict(lambda: OrderedDict())
    for f in F:
        key = (f["client"], f["pays"])
        tst = sum(l.get("testers", 0) for l in f["lines"])
        fc = sum(l.get("cout", 0) or 0 for l in f["lines"]); fm = sum(l.get("marge", 0) or 0 for l in f["lines"])
        c = cl.setdefault(key, dict(client=f["client"], pays=f["pays"], factures=0, btl=0, testers=0, ca=0.0, cout=0.0, marge=0.0))
        p = pa.setdefault(f["pays"], dict(pays=f["pays"], _cl=set(), factures=0, btl=0, ca=0.0, cout=0.0, marge=0.0))
        q = pc.setdefault(key, dict(pays=f["pays"], client=f["client"], label=f'{f["pays"]} — {f["client"]}', factures=0, btl=0, ca=0.0, cout=0.0, marge=0.0))
        m = mo[MOIS[pdate(f["date"]).month - 1]]
        for o in (c, p, q, m):
            o["factures"] += 1; o["btl"] += f["btl"]; o["ca"] += f["ca"]; o["cout"] += fc; o["marge"] += fm
        c["testers"] += tst; p["_cl"].add(f["client"])
        for l in f["lines"]:
            r = rf.setdefault((l["collection"], l["reference"]), dict(collection=l["collection"], reference=l["reference"], cartons=0, btl=0, testers=0, ca=0.0, cout=0.0, marge=0.0, cost_known=True))
            for k in ("cartons", "btl", "testers", "ca", "cout", "marge"): r[k] += l.get(k, 0) or 0
            g = co.setdefault(l["collection"], dict(collection=l["collection"], _r=set(), btl=0, ca=0.0, cout=0.0, marge=0.0, cost_known=True))
            g["_r"].add(l["reference"])
            for k in ("btl", "ca", "cout", "marge"): g[k] += l.get(k, 0) or 0
            if l.get("mode") != "remise":
                t = ctp[f'{f["client"]}|{f["pays"]}'].setdefault((l["collection"], l["reference"]), dict(collection=l["collection"], reference=l["reference"], btl=0, ca=0.0))
                t["btl"] += l.get("btl", 0) or 0; t["ca"] += l.get("ca", 0) or 0
    for p in pa.values(): p["clients"] = len(p.pop("_cl"))
    for g in co.values(): g["refs"] = len(g.pop("_r"))
    pays = [dict(pays=p["pays"], clients=p["clients"], factures=p["factures"], btl=p["btl"], ca=p["ca"], cout=p["cout"], marge=p["marge"]) for p in pa.values()]
    colls = [dict(collection=g["collection"], refs=g["refs"], btl=g["btl"], ca=g["ca"], cout=g["cout"], marge=g["marge"], cost_known=True) for g in co.values()]
    byca = lambda L: sorted(L, key=lambda x: -x["ca"])
    clients = byca(list(cl.values()))
    ca = sum(f["ca"] for f in F); cout = sum(l.get("cout", 0) or 0 for f in F for l in f["lines"]); marge = sum(l.get("marge", 0) or 0 for f in F for l in f["lines"])
    out = OrderedDict(
        kpi_ca=ca, kpi_cout=cout, kpi_marge=marge, kpi_marge_pct_known=(marge / ca * 100 if ca else 0),
        kpi_ca_known=ca, kpi_ca_unknown=0, kpi_btl=sum(f["btl"] for f in F),
        kpi_testers=sum(l.get("testers", 0) for f in F for l in f["lines"]),
        kpi_factures=len(F), kpi_clients=len(clients), kpi_pays=len(pays), kpi_refs=len(rf),
        clients=clients, pays=byca(pays), pays_client=byca(list(pc.values())), mois=list(mo.values()),
        refs=byca(list(rf.values())), collections=byca(colls), factures=F,
        petits=[dict(client=c["client"], pays=c["pays"], ca=c["ca"], btl=c["btl"]) for c in sorted(clients, key=lambda x: x["ca"])[:3]],
        client_top_products={k: sorted(v.values(), key=lambda x: -x["btl"])[:3] for k, v in ctp.items()},
    )
    if with_pred:
        out["predictions"] = predictions(F, today)
        out["insights"] = insights(F, out)
    return out

def predictions(F, today):
    by = OrderedDict()
    for f in sorted(F, key=lambda f: pdate(f["date"])): by.setdefault((f["client"], f["pays"]), []).append(f)
    res = []
    for (c, p), L in by.items():
        ds = [pdate(f["date"]) for f in L]
        gaps = [(ds[i] - ds[i - 1]).days for i in range(1, len(ds))]
        avg = round(sum(gaps) / len(gaps)) if gaps else None
        last = ds[-1]; since = (today - last).days
        tr = OrderedDict()
        for f in L:
            for l in f["lines"]:
                if l.get("mode") == "remise": continue
                t = tr.setdefault((l["collection"], l["reference"]), dict(collection=l["collection"], reference=l["reference"], btl=0, cartons=0))
                t["btl"] += l.get("btl", 0) or 0; t["cartons"] += l.get("cartons", 0) or 0
        n = len(L)
        res.append(dict(client=c, pays=p, n_factures=n, last_order=fdate(last), days_since_last=since, avg_interval=avg,
                        predicted_date=fdate(last + datetime.timedelta(days=avg)) if avg is not None else None,
                        predicted_ca=sum(f["ca"] for f in L) / n,
                        confidence="haute" if n >= 5 else ("moyenne" if n >= 2 else "basse"),
                        overdue=(avg is not None and since > avg),
                        top_refs=sorted(tr.values(), key=lambda x: -x["btl"])[:5]))
    return sorted(res, key=lambda r: (-r["n_factures"], -r["predicted_ca"]))

def insights(F, A):
    by = OrderedDict()
    for f in sorted(F, key=lambda f: pdate(f["date"])): by.setdefault((f["client"], f["pays"]), []).append(f)
    gr = []
    for (c, p), L in by.items():
        if len(L) >= 2 and L[0]["ca"]:
            gr.append(((L[-1]["ca"] - L[0]["ca"]) / L[0]["ca"] * 100, c, p, L[0]["ca"], L[-1]["ca"]))
    ins = []
    if gr:
        g = max(gr)
        ins.append(dict(icon="🚀", level="success", title=f"{g[1]} ({g[2]}) en très forte croissance (+{round(g[0])}%)", desc=f"Sa 1ère commande était de {eur(g[3])} €  sa dernière de {eur(g[4])} €."))
        d = min(gr)
        if d[0] < 0:
            ins.append(dict(icon="📉", level="danger", title=f"{d[1]} ({d[2]}) en baisse ({round(d[0])}%)", desc=f"Sa 1ère commande était de {eur(d[3])} €  sa dernière de {eur(d[4])} €."))
    bm = max(A["mois"], key=lambda m: m["ca"])
    ins.append(dict(icon="🏆", level="info", title=f"Meilleur mois : {bm['mois']}", desc=f"{eur(bm['ca'])} € de CA sur ce mois."))
    t = A["clients"][0]
    ins.append(dict(icon="👑", level="info", title=f"{t['client']} concentre {round(t['ca'] / A['kpi_ca'] * 100)}% du CA", desc=f"{eur(t['ca'])} € sur {eur(A['kpi_ca'])} € au total."))
    real = [(c["marge"] / c["ca"] * 100, c) for c in A["collections"] if c["ca"] > 0 and c["collection"] not in ("REMISE", "CONCENTRÉ")]
    if real:
        pct, c = min(real, key=lambda x: x[0])
        ins.append(dict(icon="💸", level="warning", title=f"{c['collection']} : marge la plus faible ({round(pct)}%)", desc=f"Marge de {eur(c['marge'])} € sur {eur(c['ca'])} € de CA."))
    return ins

def check(A):
    ok = True
    for y in ("2025", "2026", "total"):
        d = A[y]
        for f in d["factures"]:
            s = sum(l["ca"] for l in f["lines"])
            if abs(s - f["ca"]) > 0.02: print(f"  ⚠ {y} {f['facture']}: somme lignes {s:.2f} ≠ ca {f['ca']:.2f}"); ok = False
        sums = {k: sum(x["ca"] for x in d[k]) for k in ("clients", "pays", "pays_client", "mois", "refs", "collections", "factures")}
        bad = {k: v for k, v in sums.items() if abs(v - d["kpi_ca"]) > 0.05}
        print(f"  {y}: CA {d['kpi_ca']:,.2f} € | {d['kpi_factures']} factures | {d['kpi_clients']} clients | {'OK' if not bad else 'ÉCART ' + str(bad)}")
        ok = ok and not bad
    return ok

def main():
    path = sys.argv[1]; write = "--write" in sys.argv
    today = datetime.date.today()
    if "--today" in sys.argv: today = pdate(sys.argv[sys.argv.index("--today") + 1])
    html = open(path, encoding="utf-8").read()
    a, b = find_blob(html, "ALL"); A = json.loads(html[a:b])
    new = dict(A)
    new["2025"] = dict(aggregate(A["2025"]["factures"], False, today), year="2025")
    new["2026"] = dict(aggregate(A["2026"]["factures"], True, today), year="2026")
    new["total"] = dict(aggregate(A["2025"]["factures"] + A["2026"]["factures"], True, today), year="total")
    print("Contrôles après recalcul :")
    ok = check(new)
    if not write:
        print("\n(mode vérification — rien n'a été écrit. Ajoute --write pour enregistrer.)"); return
    if not ok: print("❌ Incohérences — fichier NON modifié."); sys.exit(1)
    shutil.copy(path, path + ".bak")
    out = html[:a] + json.dumps(new, ensure_ascii=False, separators=(",", ":")) + html[b:]
    open(path, "w", encoding="utf-8").write(out)
    print(f"✅ Écrit : {path} (sauvegarde : {path}.bak)")

if __name__ == "__main__": main()
