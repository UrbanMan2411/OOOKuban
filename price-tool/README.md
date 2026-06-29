# GREEN PANDA — генератор прайс-листа из Excel

Веб-сервис: загружаешь `.xlsx` в формате прайса **GREEN PANDA** (ТМ ООО «КубаньБытХим») → получаешь готовый брендированный **PDF**. Всё считается прямо в браузере — файл никуда не отправляется.

🟢 **Прод:** https://price-tool-delta.vercel.app/

Близнец сервиса Матрёшки ([matreshka-price-tool](https://github.com/UrbanMan2411/matreshka-price-tool)) — та же база, эко-зелёная палитра.

---

## Что умеет
- Парсит xlsx в браузере (SheetJS) — категории, товары, цены.
- **Достаёт фото товаров прямо из xlsx** (вшитые картинки: `xl/media/*` + якоря `xl/drawings/drawing1.xml` через JSZip).
- Генерит многостраничный PDF (pdf-lib) — A4 landscape, шапка с лого и реквизитами, заголовки категорий, фото-колонка, центрированные Объём/Артикул/Цена.
- Выбор фона-водяного знака: **Стандартный / Свой / Без фона** + ползунок прозрачности.
- Кириллица — вшитый Manrope (Regular/Bold).

## Стек
React 18 · Vite 5 · pdf-lib + @pdf-lib/fontkit · SheetJS (xlsx) · JSZip. Без бэкенда, деплой на Vercel.

## Запуск
```bash
npm install
npm run dev        # http://localhost:5173
npm run build
npm run preview
```

## Деплой
Подключён к Vercel (auto-deploy при `git push` в `main`). Ручной: `npx vercel --prod`.

## Структура
```
public/brand/   Manrope-*.ttf · logo.png (вордмарк Green Panda) · bg.jpg (фон)
src/
  App.jsx           UI: загрузка, выбор фона, генерация
  index.css         стили + палитра
  lib/parseXlsx.js  парсинг xlsx + вытаскивание фото
  lib/buildPdf.js   вёрстка PDF
```

## Формат xlsx
Парсер сам находит шапку по слову `наименование`. Колонки: 1 Фото · 2 наименование · 3 описание · 4 объём · 5 артикул · 6 штрих-код · 7 паллет · 8 в коробе · 9 цена. Категория — строка, где кол.1 заполнена, а кол.2 и 5 пусты.

## Где менять бренд
Цвета — CSS-переменные в `src/index.css`; палитра PDF — константы вверху `src/lib/buildPdf.js`; шапка/футер/заголовок цены — `drawHeader`/`drawTHead`/`drawFooter` в `buildPdf.js`.
