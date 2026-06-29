#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Конвертер выгрузки MPSTATS (или похожего сервиса) → формат листа «Цены конкурентов».

Зачем: MPSTATS даёт экспорт в Excel/CSV со своими названиями колонок. Скрипт сам
находит нужные столбцы по ключевым словам, достаёт из названия объём/запах/формат/эко
и пишет готовый CSV в порядке колонок дашборда — остаётся вставить на лист.

Зависимостей нет для CSV; для .xlsx нужен openpyxl (обычно уже стоит).

Запуск:
    python3 mpstats_to_dashboard.py ВЫГРУЗКА.xlsx --platform WB
    python3 mpstats_to_dashboard.py export.csv --platform Ozon
Результат: competitors_ready.csv  → вставить на лист «Цены конкурентов».

Если колонки не распознались — скрипт напечатает заголовки файла; пришлите их мне,
и я точно настрою соответствие.
"""
import csv, re, sys, json, argparse

# --- те же эвристики разбора названия, что в wb_scraper.py ---
VOL_RE = re.compile(r"(\d+[.,]?\d*)\s*(л|l|литр|мл|ml)", re.I)
WASH_RE = re.compile(r"(\d+)\s*(стир|порц|шт|таб|капс)", re.I)
SCENTS = {
    "лаванда": ["лаванд"], "цитрус/лимон": ["лимон", "цитрус", "лайм"],
    "эвкалипт": ["эвкалипт"], "морская свежесть": ["морск", "океан", "свеж"],
    "без запаха": ["без запах", "без отдушк", "нейтрал"], "хвоя": ["хвоя", "пихт", "сосн"],
    "ваниль/гурманский": ["ванил", "карамель", "печень"], "цветочный": ["цвето", "флёр", "флер", "роза", "жасмин"],
    "алоэ": ["алоэ"], "мускус/парфюм": ["мускус", "парфюм", "perfum"], "хлопок": ["хлопок", "cotton"],
    "мята": ["мята", "ментол"],
}
FMT = {"капсулы": ["капсул", "pods"], "порошок": ["порошок"], "таблетки": ["таблет"],
       "гель": ["гель", "жидк"], "спрей": ["спрей", "аэрозол"]}
ECO_HINTS = ["эко", "eco", "био", "bio", "натурал", "гипоаллерген", "без фосфат", "0+"]

def parse_name(name):
    low = (name or "").lower()
    vol = ""
    m = VOL_RE.search(low)
    if m:
        v = float(m.group(1).replace(",", "."))
        if m.group(2).lower() in ("мл", "ml"): v /= 1000.0
        vol = round(v, 3)
    washes = ""
    mw = WASH_RE.search(low)
    if mw: washes = int(mw.group(1))
    scent = next((s for s, kws in SCENTS.items() if any(k in low for k in kws)), "")
    fmt = next((f for f, kws in FMT.items() if any(k in low for k in kws)), "")
    eco = "да" if any(h in low for h in ECO_HINTS) else "нет"
    return vol, washes, scent, fmt, eco

# --- поиск колонок по ключевым словам (регистронезависимо) ---
COLMAP = {
    "name":     ["наименование", "название", "товар", "name", "title"],
    "brand":    ["бренд", "brand", "марка"],
    "category": ["категория", "предмет", "category", "subject"],
    "price":    ["цена", "price", "финальная цена", "цена со скидкой"],
    "rating":   ["рейтинг", "rating", "оценка"],
    "feedbacks":["отзыв", "feedback", "комментар", "reviews"],
    "url":      ["ссылка", "url", "link", "артикул сайта"],
    "sku":      ["артикул", "sku", "id", "nmid", "ozon id"],
}

def find_cols(headers):
    res = {}
    low = [(h or "").strip().lower() for h in headers]
    for key, kws in COLMAP.items():
        for i, h in enumerate(low):
            if any(kw in h for kw in kws):
                res[key] = i; break
    return res

def read_table(path):
    if path.lower().endswith((".xlsx", ".xlsm")):
        import openpyxl
        wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
        ws = wb.active
        rows = [[c for c in r] for r in ws.iter_rows(values_only=True)]
        return rows
    # csv / tsv
    with open(path, encoding="utf-8-sig", newline="") as f:
        sample = f.read(4096); f.seek(0)
        delim = "\t" if sample.count("\t") > sample.count(",") else ","
        return [row for row in csv.reader(f, delimiter=delim)]

def num(x):
    if x is None: return ""
    s = str(x).replace("\xa0", "").replace(" ", "").replace(",", ".")
    s = re.sub(r"[^\d.]", "", s)
    try: return round(float(s), 2)
    except: return ""

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("file", help="выгрузка MPSTATS (.xlsx или .csv)")
    ap.add_argument("--platform", default="WB", help="WB / Ozon / Я.Маркет")
    ap.add_argument("--category", default="", help="перебить категорию вручную (если в файле её нет)")
    args = ap.parse_args()

    rows = read_table(args.file)
    if not rows:
        print("Файл пустой."); sys.exit(1)
    # ищем строку заголовков (первая, где находим хотя бы 'цена' и 'название/бренд')
    hdr_idx, cols = 0, {}
    for i, r in enumerate(rows[:10]):
        c = find_cols(r)
        if "price" in c and ("name" in c or "brand" in c):
            hdr_idx, cols = i, c; break
    else:
        print("Не нашёл колонки автоматически. Заголовки файла:")
        print(json.dumps(rows[0], ensure_ascii=False))
        print("\n→ Пришлите эту строку — настрою соответствие точно.")
        sys.exit(2)

    print("Распознаны колонки:", {k: rows[hdr_idx][v] for k, v in cols.items()})
    out = []
    for r in rows[hdr_idx+1:]:
        if not any(r): continue
        def get(key):
            i = cols.get(key)
            return r[i] if i is not None and i < len(r) else ""
        name = get("name")
        if not str(name).strip(): continue
        vol, washes, scent, fmt, eco = parse_name(str(name))
        out.append({
            "Площадка": args.platform,
            "Категория": args.category or get("category"),
            "Бренд": get("brand"),
            "Наименование (SKU)": name,
            "Объём, л": vol, "Кол-во стирок/порций": washes,
            "Цена, ₽": num(get("price")),
            "Рейтинг": get("rating") or "", "Отзывов": num(get("feedbacks")) or get("feedbacks") or "",
            "Запах/аромат": scent, "Формат": fmt, "Эко (да/нет)": eco,
            "Ссылка": get("url"),
        })

    cols_order = ["Площадка","Категория","Бренд","Наименование (SKU)","Объём, л",
                  "Кол-во стирок/порций","Цена, ₽","Рейтинг","Отзывов",
                  "Запах/аромат","Формат","Эко (да/нет)","Ссылка"]
    with open("competitors_ready.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=cols_order, extrasaction="ignore")
        w.writeheader(); w.writerows(out)
    print(f"\n✓ competitors_ready.csv — {len(out)} позиций")
    print("Откройте файл, скопируйте строки (без шапки) на лист «Цены конкурентов».")

if __name__ == "__main__":
    main()
