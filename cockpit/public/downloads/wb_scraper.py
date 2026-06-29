#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
WB market scraper — тянет цены/рейтинги/отзывы с Wildberries через открытый JSON-API.

ЗАПУСКАТЬ СО СВОЕГО (домашнего/офисного) IP, не с сервера — иначе WB отдаёт 429.
Установка:   ничего ставить не нужно (только стандартная библиотека Python)
Запуск:      python3 wb_scraper.py
Результат:   wb_prices.csv  — вставляется на лист «Цены конкурентов» дашборда.
             wb_scents.csv  — сводка по запахам (для листа «Запахи (отзывы)»).

Почему так: у WB нет официального B2B-API для аналитики чужих товаров, но фронт
магазина ходит в search.wb.ru (выдача) и feedbacks*.wb.ru (отзывы) — их и читаем.
Для Ozon/Я.Маркета аналогичного открытого API нет (жёсткий антибот) — там кабинет
селлера или платный сервис (MPSTATS, Moneyplace, MarketGuru).

Зависимостей нет — используется только стандартная библиотека Python (urllib).
Поэтому 'pip install' НЕ нужен: просто 'python3 wb_scraper.py'.
"""
import csv, re, time, sys, json, ssl
import urllib.request, urllib.parse, urllib.error
from collections import Counter

# TLS-контекст. На свежем macOS Python (python.org) системные сертификаты часто
# не настроены → CERTIFICATE_VERIFY_FAILED. Тогда скрипт сам переключится на
# контекст без проверки. Это допустимо ТОЛЬКО здесь: запросы идут к публичному
# API WB и НЕ содержат ни логинов, ни токенов. Для скриптов с API-ключами так
# делать нельзя — там проверка сертификата обязательна (см. README ниже).
SSL_CTX = ssl.create_default_context()

# --- что собираем: запрос -> категория для дашборда ---
QUERIES = {
    "гель для стирки": "Стирка",
    "капсулы для стирки": "Стирка",
    "кондиционер для белья": "Стирка",
    "средство для мытья посуды": "Посуда",
    "таблетки для посудомоечной машины": "Посуда",
    "чистящее средство для ванной": "Чистящие",
    "средство для мытья полов": "Чистящие",
    "освежитель воздуха": "Освежители",
}
PAGES_PER_QUERY = 2          # ~100 товаров на страницу
SLEEP = 1.2                  # пауза между запросами, чтобы не ловить 429
DEST = -1257786              # регион (Москва); поменяйте при желании

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Origin": "https://www.wildberries.ru",
    "Referer": "https://www.wildberries.ru/",
}

# --- эвристики разбора названия ---
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
FORMAT = {"капсулы": ["капсул", "podс", "pods"], "порошок": ["порошок"], "таблетки": ["таблет"],
          "гель": ["гель", "жидк"], "спрей": ["спрей", "аэрозол"]}
ECO_HINTS = ["эко", "eco", "био", "bio", "натурал", "гипоаллерген", "без фосфат", "0+"]

def parse_name(name):
    low = name.lower()
    vol = ""
    m = VOL_RE.search(low)
    if m:
        val = float(m.group(1).replace(",", "."))
        if m.group(2).lower() in ("мл", "ml"): val /= 1000.0
        vol = round(val, 3)
    washes = ""
    mw = WASH_RE.search(low)
    if mw: washes = int(mw.group(1))
    scent = next((s for s, kws in SCENTS.items() if any(k in low for k in kws)), "")
    fmt = next((f for f, kws in FORMAT.items() if any(k in low for k in kws)), "")
    eco = "да" if any(h in low for h in ECO_HINTS) else "нет"
    return vol, washes, scent, fmt, eco

def fetch_query(query, category, page):
    base = "https://search.wb.ru/exactmatch/ru/common/v5/search"
    params = {"ab_testing": "false", "appType": 1, "curr": "rub", "dest": DEST,
              "query": query, "page": page, "resultset": "catalog",
              "sort": "popular", "spp": 30, "suppressSpellcheck": "false"}
    global SSL_CTX
    url = base + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=30, context=SSL_CTX) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        if e.code == 429:
            print("  429 — подождите и/или смените сеть/VPN"); return []
        raise
    except urllib.error.URLError as e:
        if "CERTIFICATE_VERIFY_FAILED" in str(getattr(e, "reason", e)) and SSL_CTX.check_hostname:
            print("  (сертификаты macOS не настроены — переключаюсь в режим без проверки TLS; для публичных данных WB это безопасно)")
            SSL_CTX = ssl._create_unverified_context()
            return fetch_query(query, category, page)  # повтор один раз
        print("  сетевая ошибка:", getattr(e, "reason", e)); return []
    prods = (data.get("data") or {}).get("products") or []
    out = []
    for p in prods:
        price = (p.get("salePriceU") or p.get("priceU") or 0) / 100.0
        vol, washes, scent, fmt, eco = parse_name(p.get("name", ""))
        out.append({
            "Площадка": "WB", "Категория": category, "Бренд": p.get("brand", ""),
            "Наименование (SKU)": p.get("name", ""), "Объём, л": vol,
            "Кол-во стирок/порций": washes, "Цена, ₽": round(price, 2),
            "Рейтинг": p.get("reviewRating") or p.get("rating") or "",
            "Отзывов": p.get("feedbacks") or 0, "Запах/аромат": scent,
            "Формат": fmt, "Эко (да/нет)": eco,
            "Ссылка": f"https://www.wildberries.ru/catalog/{p.get('id')}/detail.aspx",
            "id": p.get("id"),
        })
    return out

def main():
    rows = []
    for q, cat in QUERIES.items():
        print(f"[{cat}] '{q}' …")
        for page in range(1, PAGES_PER_QUERY + 1):
            try:
                rows += fetch_query(q, cat, page)
            except Exception as e:
                print("  ошибка:", e)
            time.sleep(SLEEP)
    if not rows:
        print("Ничего не собрано (вероятно 429). Запустите со своего IP / включите VPN.")
        sys.exit(1)

    cols = ["Площадка","Категория","Бренд","Наименование (SKU)","Объём, л",
            "Кол-во стирок/порций","Цена, ₽","Рейтинг","Отзывов","Запах/аромат",
            "Формат","Эко (да/нет)","Ссылка"]
    with open("wb_prices.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader(); w.writerows(rows)
    print(f"\n✓ wb_prices.csv — {len(rows)} позиций")

    # сводка по запахам из названий (быстрый срез без чтения отзывов)
    cnt = Counter(r["Запах/аромат"] for r in rows if r["Запах/аромат"])
    with open("wb_scents.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f); w.writerow(["Аромат", "Кол-во SKU"])
        for s, n in cnt.most_common(): w.writerow([s, n])
    print(f"✓ wb_scents.csv — {len(cnt)} ароматов")
    print("\nДальше: открой wb_prices.csv и вставь строки на лист «Цены конкурентов».")
    print("Хочешь тональность по запахам — нужно читать отзывы (feedbacks*.wb.ru) по id; могу дописать.")

if __name__ == "__main__":
    main()
