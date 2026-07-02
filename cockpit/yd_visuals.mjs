// Зеркалит публичную папку Я.Диска «Визуалы» в STORAGE_DIR/catalogs/visuals
// и собирает visuals/index.html (галерея с поиском). Запуск на сервере.
import { writeFileSync, mkdirSync, existsSync, statSync, readdirSync } from "node:fs";
import path from "node:path";

const PUB = "https://disk.360.yandex.ru/d/8F-8W7pLZtLFxA";
const API = "https://cloud-api.yandex.net/v1/disk/public/resources";
const OUT = "/var/lib/greenpanda/cockpit/catalogs/visuals";
const FILES = path.join(OUT, "files");

async function list(p) {
  const items = [];
  for (let offset = 0; ; offset += 200) {
    const u = `${API}?public_key=${encodeURIComponent(PUB)}&path=${encodeURIComponent(p)}&limit=200&offset=${offset}`;
    const r = await fetch(u); if (!r.ok) throw new Error(`list ${p}: ${r.status}`);
    const j = await r.json(); const emb = j._embedded || {};
    items.push(...(emb.items || []));
    if (items.length >= (emb.total || 0)) break;
  }
  return items;
}
async function walk(p, acc) {
  for (const it of await list(p)) {
    const rel = (p === "/" ? "" : p) + "/" + it.name;
    if (it.type === "dir") await walk(rel, acc);
    else acc.push({ rel, url: it.file, size: it.size || 0 });
  }
  return acc;
}
async function dl(url, dest) {
  try {
    const r = await fetch(url); if (!r.ok) return false;
    mkdirSync(path.dirname(dest), { recursive: true });
    writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
    return true;
  } catch { return false; }
}

console.log("→ обхожу дерево Я.Диска…");
const files = await walk("/", []);
const total = files.reduce((s, f) => s + f.size, 0);
console.log(`файлов: ${files.length}, объём: ${(total / 1048576).toFixed(0)} МБ`);

let done = 0, skip = 0, fail = 0;
for (let i = 0; i < files.length; i += 8) {
  await Promise.all(files.slice(i, i + 8).map(async f => {
    const dest = path.join(FILES, f.rel);
    if (existsSync(dest) && statSync(dest).size === f.size) { skip++; return; }
    (await dl(f.url, dest)) ? done++ : (fail++, console.log("  FAIL:", f.rel));
  }));
  if ((i / 8) % 10 === 0) process.stdout.write(`  ${done + skip + fail}/${files.length}\r`);
}
console.log(`\nскачано: ${done}, уже было: ${skip}, ошибок: ${fail}`);

// ---------- сборка страницы из локального дерева ----------
const IMG = /\.(png|jpe?g|webp)$/i;
const groups = []; // {cat, name, files:[{rel,img}], key}
const extras = []; // не-картинки в корне (zip и пр.)
for (const cat of readdirSync(FILES, { withFileTypes: true })) {
  if (!cat.isDirectory()) {
    extras.push(cat.name);
    continue;
  }
  const catDir = path.join(FILES, cat.name);
  const map = new Map(); // groupName -> files[]
  const walkLocal = (dir, groupName) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        // на первом уровне подпапка = товар; глубже (архив/леруа) — вливаем в ту же группу с пометкой
        walkLocal(full, groupName || e.name);
      } else {
        const g = groupName || cat.name;
        if (!map.has(g)) map.set(g, []);
        map.get(g).push(path.relative(FILES, full));
      }
    }
  };
  walkLocal(catDir, "");
  for (const [g, fs] of map) {
    const imgs = fs.filter(f => IMG.test(f)).sort();
    const other = fs.filter(f => !IMG.test(f)).sort();
    if (imgs.length || other.length) groups.push({ cat: cat.name, name: g, imgs, other });
  }
}
groups.sort((a, b) => a.cat.localeCompare(b.cat, "ru") || a.name.localeCompare(b.name, "ru"));
const cats = [...new Set(groups.map(g => g.cat))];
console.log(`групп: ${groups.length}, категорий: ${cats.length}, прочие файлы: ${extras.join(", ") || "нет"}`);

const data = JSON.stringify(groups.map(g => ({ c: g.cat, n: g.name, i: g.imgs, o: g.other })));
const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Визуалы Matrёshka — наклейки и рендеры</title>
<style>
*{box-sizing:border-box}body{margin:0;font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f4f1ea;color:#23201c}
header{position:sticky;top:0;background:#b3541e;color:#fff;padding:14px 18px;z-index:10;box-shadow:0 2px 8px rgba(0,0,0,.15)}
header h1{margin:0 0 8px;font-size:18px}
.bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
#q{flex:1;min-width:200px;padding:9px 12px;border:0;border-radius:8px;font-size:15px}
.chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.chip{background:rgba(255,255,255,.18);color:#fff;border:0;padding:6px 12px;border-radius:16px;font-size:13px;cursor:pointer}
.chip.on{background:#fff;color:#b3541e;font-weight:600}
.count{font-size:13px;opacity:.9}
main{padding:16px;max-width:1300px;margin:0 auto}
.cat-title{font-size:16px;font-weight:700;margin:22px 4px 10px;color:#b3541e}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px}
.card{background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);display:flex;flex-direction:column}
.ph{aspect-ratio:1;background:#f0ede6;display:flex;align-items:center;justify-content:center;cursor:pointer}
.ph img{width:100%;height:100%;object-fit:contain}
.cb{padding:10px 12px;display:flex;flex-direction:column;gap:6px}
.nm{font-size:13px;line-height:1.35;font-weight:600}
.meta{font-size:11px;color:#888}
.thumbs{display:flex;gap:4px;flex-wrap:wrap}
.thumbs img{width:34px;height:34px;object-fit:cover;border-radius:5px;cursor:pointer;border:1px solid #eee}
.links{display:flex;flex-direction:column;gap:2px}
.links a{font-size:11px;color:#b3541e;text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.links a:hover{text-decoration:underline}
#lb{position:fixed;inset:0;background:rgba(0,0,0,.85);display:none;flex-direction:column;align-items:center;justify-content:center;z-index:50;cursor:zoom-out;gap:10px}
#lb img{max-width:92vw;max-height:84vh;object-fit:contain}
#lbdl{color:#fff;font-size:14px}
.empty{text-align:center;color:#999;padding:40px}
.extras{font-size:12px;margin-top:6px}.extras a{color:#fff}
</style></head><body>
<header><h1>🎨 Визуалы Matrёshka — наклейки и рендеры <span class="count" id="cnt"></span></h1>
<div class="bar"><input id="q" placeholder="Поиск: категория, товар, аромат, файл…"></div>
${extras.length ? `<div class="extras">Доп. файлы: ${extras.map(e => `<a href="files/${encodeURIComponent(e)}" download>${e}</a>`).join(" · ")}</div>` : ""}
<div class="chips" id="chips"></div></header>
<main id="main"></main>
<div id="lb"><img id="lbimg"><a id="lbdl" href="#" download>⭳ скачать файл</a></div>
<script>
const DATA=${data};
const cats=[...new Set(DATA.map(d=>d.c))];
let active="all", term="";
const main=document.getElementById("main"), chips=document.getElementById("chips");
const enc=p=>p.split("/").map(encodeURIComponent).join("/");
function esc(s){return (s||"").replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]))}
function base(p){return p.split("/").pop()}
function chip(id,label,n){const b=document.createElement("button");b.className="chip"+(id===active?" on":"");b.textContent=label+" ("+n+")";b.onclick=()=>{active=id;render()};return b}
function buildChips(){chips.innerHTML="";chips.appendChild(chip("all","Все",DATA.length));cats.forEach(k=>chips.appendChild(chip(k,k,DATA.filter(d=>d.c===k).length)))}
function card(g){const d=document.createElement("div");d.className="card";const m0=g.i[0]?"files/"+enc(g.i[0]):"";
  d.innerHTML=\`<div class="ph">\${m0?\`<img loading="lazy" src="\${m0}" data-p="\${enc(g.i[0])}">\`:'<span class="meta">нет превью</span>'}</div>
  <div class="cb"><div class="nm">\${esc(g.n)}</div>
  <div class="meta">\${esc(g.c)} · файлов: \${g.i.length+g.o.length}</div>
  \${g.i.length>1?\`<div class="thumbs">\${g.i.slice(1).map(p=>\`<img loading="lazy" src="files/\${enc(p)}" data-p="\${enc(p)}" title="\${esc(base(p))}">\`).join("")}</div>\`:''}
  \${g.o.length?\`<div class="links">\${g.o.map(p=>\`<a href="files/\${enc(p)}" download>⭳ \${esc(base(p))}</a>\`).join("")}</div>\`:''}
  </div>\`;
  d.querySelectorAll("img[data-p]").forEach(im=>im.onclick=()=>zoom(im.dataset.p));
  return d}
function render(){buildChips();main.innerHTML="";const t=term.toLowerCase();
  let list=DATA.filter(g=>(active==="all"||g.c===active)&&(!t||(g.c+" "+g.n+" "+g.i.join(" ")+" "+g.o.join(" ")).toLowerCase().includes(t)));
  document.getElementById("cnt").textContent="— "+list.length+" наборов";
  if(!list.length){main.innerHTML='<div class="empty">Ничего не найдено</div>';return}
  const gr={};list.forEach(g=>{(gr[g.c]=gr[g.c]||[]).push(g)});
  cats.filter(k=>gr[k]).forEach(k=>{const h=document.createElement("div");h.className="cat-title";h.textContent=k+" — "+gr[k].length;main.appendChild(h);const g=document.createElement("div");g.className="grid";gr[k].forEach(x=>g.appendChild(card(x)));main.appendChild(g)})}
function zoom(p){const lb=document.getElementById("lb");document.getElementById("lbimg").src="files/"+p;const a=document.getElementById("lbdl");a.href="files/"+p;lb.style.display="flex"}
document.getElementById("lb").onclick=e=>{if(e.target.id!=="lbdl")document.getElementById("lb").style.display="none"};
document.getElementById("q").oninput=e=>{term=e.target.value;render()};
render();
</script></body></html>`;
writeFileSync(path.join(OUT, "index.html"), html);
console.log("✓ страница:", path.join(OUT, "index.html"));
