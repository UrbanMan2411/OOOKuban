// Генерация HTML-каталогов Озон + WB в STORAGE_DIR/catalogs/{ozon,wb}.
// Запуск на сервере из /opt/greenpanda/cockpit (там node_modules/xlsx).
import * as XLSX from "xlsx";
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";

const env = Object.fromEntries(readFileSync("/opt/greenpanda/cockpit/.env", "utf8")
  .split("\n").filter(Boolean).map(l => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1)]; }));
const OUT = "/var/lib/greenpanda/cockpit/catalogs";

const translit = s => { const m = { а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"e",ж:"zh",з:"z",и:"i",й:"y",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"h",ц:"c",ч:"ch",ш:"sh",щ:"sch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya"," ":"_" }; return s.toLowerCase().split("").map(c => m[c] ?? (/[a-z0-9_]/.test(c) ? c : "")).join("").replace(/_+/g, "_").replace(/^_|_$/g, "") || "cat"; };
const volOf = (v, n) => { const src = String(v || "") + " " + String(n || ""); const m = src.match(/([0-9]+[.,]?[0-9]*)\s*(л|литр|мл|ml)\b/i); if (!m) return (v && /^\d/.test(String(v)) ? String(v) : ""); const x = parseFloat(m[1].replace(",", ".")); return /мл|ml/i.test(m[2]) ? x + " мл" : x + " л"; };
async function dl(url, path) { try { const r = await fetch(url); if (!r.ok) return false; writeFileSync(path, Buffer.from(await r.arrayBuffer())); return true; } catch { return false; } }

// ---------- Ozon ----------
async function pullOzon() {
  const H = { "Client-Id": env.OZON_CLIENT_ID, "Api-Key": env.OZON_API_KEY, "Content-Type": "application/json" };
  let r = await fetch("https://api-seller.ozon.ru/v3/product/list", { method: "POST", headers: H, body: JSON.stringify({ filter: { visibility: "ALL" }, last_id: "", limit: 1000 }) });
  const ids = ((await r.json()).result?.items || []).map(x => String(x.product_id));
  const out = [];
  for (let i = 0; i < ids.length; i += 100) {
    r = await fetch("https://api-seller.ozon.ru/v4/product/info/attributes", { method: "POST", headers: H, body: JSON.stringify({ filter: { product_id: ids.slice(i, i + 100), visibility: "ALL" }, limit: 100, last_id: "", sort_dir: "ASC" }) });
    for (const p of ((await r.json()).result || [])) out.push({ pid: String(p.id || p.product_id), art: String(p.offer_id || ""), name: p.name || "", barcode: String(p.barcode || ""), images: (p.images || []).map(im => typeof im === "string" ? im : (im.file_name || im.default || "")).filter(Boolean) });
  }
  for (const p of out) {
    try { const rr = await fetch("https://api-seller.ozon.ru/v1/product/info/description", { method: "POST", headers: H, body: JSON.stringify({ product_id: Number(p.pid) }) }); const d = (await rr.json()).result || {}; p.desc = (d.description || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(); } catch { p.desc = ""; }
  }
  return out;
}
const OZ_CATS = { gel: "Гель для стирки", cond: "Кондиционер для белья", dish: "Средство для мытья посуды", kitchen: "Чистящее для кухни", soap: "Жидкое мыло", bath: "Ванна / сантехника", floor: "Полы / уборка", sets: "Наборы", other: "Прочее" };
function ozCat(n) { const x = (n || "").toLowerCase();
  if (/набор/.test(x)) return "sets";
  if (/кондиционер|ополаскиватель/.test(x)) return "cond";
  if (/гель для стирки|для стирки/.test(x) && !/кондиционер/.test(x)) return "gel";
  if (/посуд/.test(x)) return "dish";
  if (/ванна|душ|сантехник|антинал[её]т|акрил/.test(x)) return "bath";
  if (/(крем.?мыло|мыло|пенка).*(рук|тел)|жидкое крем мыло|пенка для рук/.test(x) && !/стирки|хозяйствен|посуд/.test(x)) return "soap";
  if ((/средство для мытья пол|для мытья пол|мытья пола/.test(x) || /уборка\s*-?\s*эко|универсальное средство для уборки/.test(x)) && !/стирки|хозяйствен|посуд/.test(x)) return "floor";
  if (/антижир|жироудал|кухн|духов|плит|свч/.test(x)) return "kitchen";
  return "other"; }

// ---------- WB ----------
async function pullWB() {
  const H = { Authorization: env.WB_TOKEN, "Content-Type": "application/json" };
  let cursor = { limit: 100 }; const all = [];
  for (let p = 0; p < 50; p++) {
    const r = await fetch("https://content-api.wildberries.ru/content/v2/get/cards/list", { method: "POST", headers: H, body: JSON.stringify({ settings: { cursor, filter: { withPhoto: -1 } } }) });
    const j = await r.json(); const cards = j.cards || [];
    for (const c of cards) {
      const ch = {}; (c.characteristics || []).forEach(x => { ch[x.name] = Array.isArray(x.value) ? x.value.join(", ") : x.value; });
      all.push({ nmID: c.nmID, art: String(c.vendorCode || ""), name: c.title || "", cat: c.subjectName || "Прочее",
        barcode: String(((c.sizes || []).map(s => s.skus || []).flat()[0]) || ""),
        photos: (c.photos || []).map(ph => ph.big || ph.c516x688 || ph["c246x328"] || "").filter(Boolean),
        desc: (c.description || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
        vol: ch["Объем продукта"] || ch["Объем"] || "" });
    }
    if (cards.length < 100) break;
    cursor = { limit: 100, updatedAt: j.cursor.updatedAt, nmID: j.cursor.nmID };
  }
  return all;
}

// ---------- HTML ----------
function buildHTML({ title, emoji, color, items, catNames, order }) {
  const data = JSON.stringify(items);
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
*{box-sizing:border-box}body{margin:0;font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f4f1ea;color:#23201c}
header{position:sticky;top:0;background:${color};color:#fff;padding:14px 18px;z-index:10;box-shadow:0 2px 8px rgba(0,0,0,.15)}
header h1{margin:0 0 8px;font-size:18px}
.bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
#q{flex:1;min-width:200px;padding:9px 12px;border:0;border-radius:8px;font-size:15px}
.chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.chip{background:rgba(255,255,255,.18);color:#fff;border:0;padding:6px 12px;border-radius:16px;font-size:13px;cursor:pointer}
.chip.on{background:#fff;color:${color};font-weight:600}
.count{font-size:13px;opacity:.9}
main{padding:16px;max-width:1300px;margin:0 auto}
.cat-title{font-size:16px;font-weight:700;margin:22px 4px 10px;color:${color}}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px}
.card{background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);display:flex;flex-direction:column}
.ph{aspect-ratio:1;background:#f0ede6;display:flex;align-items:center;justify-content:center;cursor:pointer}
.ph img{width:100%;height:100%;object-fit:contain}
.noimg{color:#aaa;font-size:13px}
.cb{padding:10px 12px;display:flex;flex-direction:column;gap:5px}
.nm{font-size:13px;line-height:1.35;font-weight:600}
.meta{font-size:11px;color:#888;display:flex;gap:8px;flex-wrap:wrap}
.meta b{color:#555;font-weight:600}
.desc{font-size:12px;color:#555;line-height:1.45;max-height:54px;overflow:hidden}
.desc.open{max-height:none}
.more{font-size:11px;color:${color};cursor:pointer;align-self:flex-start}
.thumbs{display:flex;gap:4px;flex-wrap:wrap;margin-top:2px}
.thumbs img{width:34px;height:34px;object-fit:cover;border-radius:5px;cursor:pointer;border:1px solid #eee}
#lb{position:fixed;inset:0;background:rgba(0,0,0,.85);display:none;align-items:center;justify-content:center;z-index:50;cursor:zoom-out}
#lb img{max-width:92vw;max-height:92vh;object-fit:contain}
.empty{text-align:center;color:#999;padding:40px}
.dl{color:#fff;font-size:13px;text-decoration:underline}
</style></head><body>
<header><h1>${emoji} ${title} <span class="count" id="cnt"></span></h1>
<div class="bar"><input id="q" placeholder="Поиск: название, артикул, штрихкод, аромат…"><a class="dl" href="opisaniya.xlsx">Excel ⭳</a></div>
<div class="chips" id="chips"></div></header>
<main id="main"></main>
<div id="lb"><img id="lbimg"></div>
<script>
const DATA=${data};
const CATN=${JSON.stringify(catNames)};
const order=${JSON.stringify(order)};
let active="all", term="";
const main=document.getElementById("main"), chips=document.getElementById("chips");
function esc(s){return (s||"").replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]))}
function chip(id,label,n){const b=document.createElement("button");b.className="chip"+(id===active?" on":"");b.textContent=label+" ("+n+")";b.onclick=()=>{active=id;render()};return b}
function buildChips(){chips.innerHTML="";chips.appendChild(chip("all","Все",DATA.length));order.forEach(k=>chips.appendChild(chip(k,CATN[k],DATA.filter(d=>d.cat===k).length)))}
function card(it){const d=document.createElement("div");d.className="card";const m0=it.imgs[0]||"";
  d.innerHTML=\`<div class="ph">\${m0?\`<img loading="lazy" src="\${m0}" onclick="zoom('\${m0}')">\`:'<span class="noimg">нет фото</span>'}</div>
  <div class="cb"><div class="nm">\${esc(it.name)}</div>
  <div class="meta"><span><b>Арт:</b> \${esc(it.art)}</span>\${it.vol?\`<span><b>Объём:</b> \${esc(it.vol)}</span>\`:''}\${it.barcode?\`<span><b>ШК:</b> \${esc(it.barcode)}</span>\`:''}</div>
  \${it.desc?\`<div class="desc">\${esc(it.desc)}</div><span class="more">показать полностью ▾</span>\`:''}
  \${it.imgs.length>1?\`<div class="thumbs">\${it.imgs.map(u=>\`<img loading="lazy" src="\${u}" onclick="zoom('\${u}')">\`).join("")}</div>\`:''}
  </div>\`;
  const more=d.querySelector(".more");if(more)more.onclick=()=>{const ds=d.querySelector(".desc");ds.classList.toggle("open");more.textContent=ds.classList.contains("open")?"свернуть ▴":"показать полностью ▾"};
  return d}
function render(){buildChips();main.innerHTML="";const t=term.toLowerCase();
  let list=DATA.filter(d=>(active==="all"||d.cat===active)&&(!t||(d.name+" "+d.art+" "+d.barcode+" "+d.desc).toLowerCase().includes(t)));
  document.getElementById("cnt").textContent="— "+list.length+" шт";
  if(!list.length){main.innerHTML='<div class="empty">Ничего не найдено</div>';return}
  const gr={};list.forEach(it=>{(gr[it.cat]=gr[it.cat]||[]).push(it)});
  order.filter(k=>gr[k]).forEach(k=>{const h=document.createElement("div");h.className="cat-title";h.textContent=CATN[k]+" — "+gr[k].length;main.appendChild(h);const g=document.createElement("div");g.className="grid";gr[k].forEach(it=>g.appendChild(card(it)));main.appendChild(g)})}
window.zoom=u=>{document.getElementById("lbimg").src=u;document.getElementById("lb").style.display="flex"};
document.getElementById("lb").onclick=()=>document.getElementById("lb").style.display="none";
document.getElementById("q").oninput=e=>{term=e.target.value;render()};
render();
</script></body></html>`;
}
function buildXlsx(rows, sheet, path) {
  const wb = XLSX.utils.book_new(); const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = rows[0].map((h, i) => ({ wch: [16, 10, 55, 10, 15, 8, 90, 12][i] || 14 }));
  ws["!autofilter"] = { ref: `A1:${XLSX.utils.encode_col(rows[0].length - 1)}${rows.length}` };
  XLSX.utils.book_append_sheet(wb, ws, sheet);
  writeFileSync(path, XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

// ---------- Ozon build ----------
console.log("→ Ozon: тяну карточки…");
const oz = await pullOzon();
rmSync(`${OUT}/ozon`, { recursive: true, force: true });
Object.keys(OZ_CATS).forEach(k => mkdirSync(`${OUT}/ozon/photos/${k}`, { recursive: true }));
let items = [], queue = [];
for (const p of oz) { const cat = ozCat(p.name); const imgs = [];
  p.images.forEach((u, i) => { const fn = `${p.art}_${i + 1}.jpg`; imgs.push(`photos/${cat}/${fn}`); queue.push([u, `${OUT}/ozon/photos/${cat}/${fn}`]); });
  items.push({ art: p.art, name: p.name, barcode: p.barcode, cat, vol: volOf("", p.name), desc: p.desc || "", imgs }); }
let ok = 0;
for (let i = 0; i < queue.length; i += 12) { const res = await Promise.all(queue.slice(i, i + 12).map(([u, pp]) => dl(u, pp))); ok += res.filter(Boolean).length; }
console.log(`Ozon: ${items.length} тов., фото ${ok}/${queue.length}`);
const ozOrder = Object.keys(OZ_CATS).filter(k => items.some(i => i.cat === k));
writeFileSync(`${OUT}/ozon/index.html`, buildHTML({ title: "Каталог Matrёshka — Ozon", emoji: "🟦", color: "#2f8079", items, catNames: OZ_CATS, order: ozOrder }));
buildXlsx([["Категория","Артикул","Название","Объём","Штрихкод","Фото, шт","Описание"],
  ...items.slice().sort((a,b)=>a.cat.localeCompare(b.cat)).map(p=>[OZ_CATS[p.cat],p.art,p.name,p.vol,p.barcode,p.imgs.length,p.desc])],
  "Каталог Ozon", `${OUT}/ozon/opisaniya.xlsx`);

// ---------- WB build ----------
console.log("→ WB: тяну карточки…");
const wbCards = await pullWB();
rmSync(`${OUT}/wb`, { recursive: true, force: true });
const wbKeys = {}; wbCards.forEach(p => { if (!wbKeys[p.cat]) wbKeys[p.cat] = translit(p.cat); });
Object.values(wbKeys).forEach(k => mkdirSync(`${OUT}/wb/photos/${k}`, { recursive: true }));
items = []; queue = [];
for (const p of wbCards) { const k = wbKeys[p.cat]; const imgs = [];
  p.photos.forEach((u, i) => { const fn = `${p.art}_${i + 1}.webp`; imgs.push(`photos/${k}/${fn}`); queue.push([u, `${OUT}/wb/photos/${k}/${fn}`]); });
  items.push({ art: p.art, nmID: p.nmID, name: p.name, barcode: p.barcode, cat: k, catName: p.cat, vol: volOf(p.vol, p.name), desc: p.desc || "", imgs }); }
ok = 0;
for (let i = 0; i < queue.length; i += 12) { const res = await Promise.all(queue.slice(i, i + 12).map(([u, pp]) => dl(u, pp))); ok += res.filter(Boolean).length; }
console.log(`WB: ${items.length} тов., фото ${ok}/${queue.length}`);
const wbNames = {}; items.forEach(it => wbNames[it.cat] = it.catName);
const wbOrder = [...new Set(items.map(i => i.cat))];
writeFileSync(`${OUT}/wb/index.html`, buildHTML({ title: "Каталог Matrёshka — Wildberries", emoji: "🟪", color: "#8b2fa0", items, catNames: wbNames, order: wbOrder }));
buildXlsx([["Категория","Артикул","nmID","Название","Объём","Штрихкод","Фото, шт","Описание"],
  ...items.slice().sort((a,b)=>a.catName.localeCompare(b.catName)).map(p=>[p.catName,p.art,p.nmID,p.name,p.vol,p.barcode,p.imgs.length,p.desc])],
  "Каталог WB", `${OUT}/wb/opisaniya.xlsx`);

// ---------- hub ----------
writeFileSync(`${OUT}/index.html`, `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Каталоги Matrёshka</title>
<style>body{margin:0;font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f4f1ea;display:flex;min-height:100vh;align-items:center;justify-content:center}
.wrap{display:flex;gap:20px;flex-wrap:wrap;justify-content:center;padding:20px}
a.card{display:block;width:260px;padding:28px 24px;background:#fff;border-radius:16px;box-shadow:0 2px 10px rgba(0,0,0,.08);text-decoration:none;color:#23201c;text-align:center;transition:transform .15s}
a.card:hover{transform:translateY(-3px)}
.ic{font-size:42px}.t{font-size:18px;font-weight:700;margin:10px 0 4px}.s{font-size:13px;color:#888}</style></head><body>
<div class="wrap">
<a class="card" href="ozon/"><div class="ic">🟦</div><div class="t">Каталог Ozon</div><div class="s">карточки, фото, описания</div></a>
<a class="card" href="wb/"><div class="ic">🟪</div><div class="t">Каталог Wildberries</div><div class="s">карточки, фото, описания</div></a>
<a class="card" href="visuals/"><div class="ic">🎨</div><div class="t">Визуалы</div><div class="s">наклейки и рендеры (обновить: node yd_visuals.mjs)</div></a>
</div></body></html>`);
console.log("✓ готово:", OUT);
