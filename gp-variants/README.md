# GREEN PANDA — лендинг (варианты дизайна)

Статический сайт-лендинг бренда **GREEN PANDA** (эко-бытовая химия, ТМ ООО «КубаньБытХим»). Репозиторий содержит **6 вариантов** дизайна одной посадочной + индекс со ссылками на все.

🟢 **Прод (GitHub Pages):** https://urbanman2411.github.io/gp-variants/
Боевой / основной вариант — **fullbleed**: https://urbanman2411.github.io/gp-variants/fullbleed/

## Что внутри
```
index.html              витрина: карточки-ссылки на 6 вариантов
strict/      eco/      premium/      consumer/      hybrid/      fullbleed/
  └─ index.html         каждый вариант — самостоятельная статическая страница
assets/
  products/*.png        фото этикеток 6 SKU (для каталога)
  docs/                 sgr-…pdf (СГР), kubanbithim-card.doc (карточка предприятия)
  green_panda_logo.png, footer-slogan.png, logo-eac/eco/kbh.png,
  biz-bg.png, form-bg.png, hero-video.mp4, soon-marketplaces.png …
```

**Основной рабочий файл — `fullbleed/index.html`** (его дорабатывали). Это одностраничник: hero с видео-фоном, sticky-хедер, секции (преимущества, каталог с попапами товаров, процесс, аудитория, форма заявки), подвал с реквизитами, политика ПДн/конфиденциальности (модал), cookie-баннер, бамбук/сакура-декор.

Технологий-сборки нет — чистый HTML/CSS/JS в одном файле на вариант. Картинки и пути — относительные (`../assets/...`).

## Локальный просмотр
```bash
# любой статик-сервер из корня репо, напр.:
python3 -m http.server 4173
# затем открой http://localhost:4173/fullbleed/
```

## Деплой
GitHub Pages из ветки `main` (корень). После `git push` страница пересобирается за ~30 сек.
URL варианта = `…github.io/gp-variants/<вариант>/`.

## Частые правки в fullbleed
- **Контакты / реквизиты** — в подвале (`<footer class="site">`) и в модале политики.
- **Каталог товаров** — массив `PRODUCTS` в `<script>` внизу `fullbleed/index.html` (название, объём, артикул, фото, описание для попапа).
- **Этикетки** — `assets/products/{soap,dishes,laundry,glass,floors,plasticizer}.png` (кэш-бастер `?v=N` в ссылках).
- **Домен** — почты/политика используют `greenpanda-eco.ru`.

## Заметка про хостинг reg.ru
Есть отдельная задача — выложить `fullbleed` на боевой хостинг reg.ru (домен `greenpanda-eco.ru`). Готовый бандл собирался в `~/Downloads/greenpanda-fullbleed-site.zip` (index.html + assets в корне архива, пути уже `assets/...`). FTP/SSH с зарубежных IP reg.ru режет — грузить через ISPmanager File Manager.
