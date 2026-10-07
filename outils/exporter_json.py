#!/usr/bin/env python3
"""Exporte chaque bloc de données du dashboard en fichier JSON lisible (dossier donnees_json/).
Usage : python3 outils/exporter_json.py dashboard_parfums_emmanuelle_jane.html donnees_json
Lecture seule — ne modifie pas le dashboard."""
import json, sys, os, re
sys.path.insert(0, os.path.dirname(__file__))
from rebuild_dashboard import find_blob
html = open(sys.argv[1], encoding="utf-8").read(); out = sys.argv[2]; os.makedirs(out, exist_ok=True)
for name in ["ALL","CHARGES_DATA","REVENUE_DATA","SUPPLIER_INVOICES","PENDING_TRANSFERS","FIXED_CHARGES","INVENTAIRE_DATA",
             "CADEAUX_UNIT_COST","CADEAUX_UNIT_COST_NEW","CADEAUX_COST_DETAIL","CADEAUX_2ML_DETAIL","CARTON_INFO","PROD_COMPONENTS_PRICES"]:
    try:
        a, b = find_blob(html, name); txt = html[a:b]
        try: data = json.loads(txt)
        except json.JSONDecodeError:
            open(os.path.join(out, name + ".js.txt"), "w", encoding="utf-8").write(txt); print("  (JS brut)", name); continue
        json.dump(data, open(os.path.join(out, name + ".json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1); print("  ok", name)
    except Exception as e: print("  ignoré", name, e)
