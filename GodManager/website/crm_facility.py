"""CSV e agregações dos módulos institucionais (PW, Pool, Land Scape, BBQ)."""
from __future__ import annotations

import csv
import io
from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple


def parse_facility_csv(text: str, module_key: str) -> Tuple[List[Dict[str, Any]], List[str], Dict[str, str]]:
    """
    Devolve (linhas para CrmServiceRecord, erros, mapa de colunas).
    Cabeçalhos flexíveis (date/data, property/casa, etc.).
    """
    errs: List[str] = []
    mapping: Dict[str, str] = {}
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        return [], ["CSV vazio ou sem cabeçalho."], mapping

    for h in reader.fieldnames:
        if h:
            mapping[h.strip()] = h.strip()

    def _get(row: Dict[str, str], *names: str) -> str:
        lower = {((k or "").strip().lower()): (v or "").strip() for k, v in row.items()}
        for n in names:
            if n.lower() in lower:
                return lower[n.lower()]
        return ""

    rows: List[Dict[str, Any]] = []
    for line in reader:
        if not any((v or "").strip() for v in line.values()):
            continue
        date_s = _get(line, "date", "data", "record_date", "dia")
        prop = _get(line, "property", "property_name", "casa", "address", "endereco", "imovel")
        cat = _get(line, "category", "categoria")
        owner = _get(line, "owner", "proprietario", "dono")
        status = _get(line, "status", "estado")
        svc = _get(line, "service_type", "type", "tipo", "servico")
        amt_s = _get(line, "amount", "valor", "total", "montante")

        rd = None
        if date_s:
            for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y"):
                try:
                    rd = datetime.strptime(date_s[:10], fmt).date()
                    break
                except ValueError:
                    continue
            if rd is None:
                errs.append(f"Data inválida: {date_s!r}")
                continue

        try:
            amount = float(amt_s.replace(",", ".")) if amt_s else 0.0
        except ValueError:
            amount = 0.0

        rows.append(
            {
                "module": module_key,
                "record_date": rd,
                "property_name": (prop or "")[:200],
                "category": (cat or "")[:120],
                "owner": (owner or "")[:200],
                "status": (status or "")[:80],
                "service_type": (svc or "")[:120],
                "amount": amount,
            }
        )

    return rows, errs, mapping


def aggregate_charts(records, module_key: Optional[str] = None) -> Dict[str, Any]:
    """Agregação para gráficos (template CRM)."""
    by_cat: Dict[str, float] = defaultdict(float)
    by_prop: Dict[str, float] = defaultdict(float)
    total = 0.0
    for r in records:
        a = float(r.amount or 0)
        total += a
        by_cat[(r.category or "").strip() or "—"] += a
        pn = ((r.property_name or "").strip() or "—")[:80]
        by_prop[pn] += a

    cat_items = sorted(by_cat.items(), key=lambda x: -x[1])[:16]
    prop_items = sorted(by_prop.items(), key=lambda x: -x[1])[:16]

    return {
        "donut_labels": [c[0] for c in cat_items],
        "donut_values": [c[1] for c in cat_items],
        "bar_labels": [p[0] for p in prop_items],
        "bar_values": [p[1] for p in prop_items],
        "total_amount": total,
        "count": len(records),
        "module_key": module_key or "",
    }
