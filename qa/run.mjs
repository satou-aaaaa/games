// 一覧ページの検査（CI の QA と同じ。手元では node qa/run.mjs）。
// 1. 部品（list.js）：表の読み方・ジャンルの決め方・今日の1本・検索
// 2. ブラウザ：最新の一覧を読めたとき（新作が1本増えた形）と、読めなかったとき（控えを出す）
// 結果は qa-report/report.md。失敗があれば終了コード 1。
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseRepos, parseTable, shortField, genreOf, build, todayPick, search, dayKey, SRC } from "../list.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail: String(detail).slice(0, 400) });
const g = JSON.parse(readFileSync(path.join(root, "genres.json"), "utf8"));
const snap = JSON.parse(readFileSync(path.join(root, "games.json"), "utf8"));
const gids = new Set(g.genres.map((x) => x.id));

// ---- 0. 使わない言葉 ----
// 一覧に出さないと決めた言葉（2026-11-24 satou さん「ゲーム一覧で『小江戸ゲーム部』という言葉を使わない」「Xへのリンクも外して」）。
// ファイルと、ブラウザで出た画面の文字の両方を見る（表の元データから入っても気づけるように）。
const BANNED = ["小江戸ゲーム部", "coedogameclub"];
for (const f of ["index.html", "README.md", "AGENTS.md", "app.js", "list.js", "games.json", "genres.json", "style.css"]) {
  const hit = BANNED.filter((w) => readFileSync(path.join(root, f), "utf8").includes(w));
  check(`${f} に使わない言葉が無い`, hit.length === 0, hit.join(","));
}

// ---- 1. 部品 ----
check("repos.txt は種類 game だけ読む", JSON.stringify(parseRepos("# c\na-b game\nc app\nd game # x\n")) === '["a-b","d"]');
const md = "## x\n| a | b |\n### ゲーム\n\n| プロジェクト | 分野 |\n| --- | --- |\n| aa-bb（あいう（え）） | 学習ゲーム（くらし・税） | z |\n### 次\n| cc（ちがう） | x | y |\n";
const t = parseTable(md);
check("表は「### ゲーム」の中だけ読む", t["aa-bb"] && !t.cc, JSON.stringify(t));
check("分野のかっこの中を出す", shortField("学習ゲーム（くらし・民法の売買）") === "くらし・民法の売買" && shortField("パズルゲーム") === "パズルゲーム");
check("map に無い新作は分野の言葉でジャンルを決める", genreOf("zz-new", "学習ゲーム（くらし・所得税）", g) === "okane" && genreOf("zz", "学習ゲーム（防災・洪水）", g) === "bousai" && genreOf("zz", "なにか", g) === "sonota");
check("genres.json の map と rules はある ジャンルだけを指す", Object.values(g.map).every((x) => gids.has(x)) && g.rules.every(([x]) => gids.has(x)));
check("控え games.json の全部にジャンルがあり、その他が0本", snap.length > 100 && snap.every((x) => gids.has(x.genre) && x.genre !== "sonota" && x.title && x.title !== x.id), snap.filter((x) => x.genre === "sonota").map((x) => x.id).join(","));
check("控えの全部が map にある（ジャンルを人が決めた）", snap.every((x) => g.map[x.id]), snap.filter((x) => !g.map[x.id]).map((x) => x.id).join(","));
const agree = snap.filter((x) => genreOf("__", "（" + x.field + "）", g) === x.genre).length;
console.log(`言葉だけで決めたジャンルが人の分け方と同じ: ${agree}/${snap.length}`);
check("今日の1本は日付で決まり、同じ日は同じ", todayPick(snap, "2026-11-21").id === todayPick([...snap].reverse(), "2026-11-21").id && todayPick(snap, "2026-11-21").id !== todayPick(snap, "2026-11-22").id);
check("日付は日本の日付（UTC 15時は次の日）", dayKey(new Date("2026-11-21T15:00:00Z")) === "2026-11-22");
check("検索はひらがな・カタカナ・ジャンルで絞れる", search([{ id: "a", title: "ピクトグラム", field: "", genre: "x" }], "ぴくと", "all").length === 1 && search([{ id: "a", title: "ピクト", field: "", genre: "x" }], "", "y").length === 0);

// ---- 2. ブラウザ ----
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
const server = createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(new URL(req.url, "http://x").pathname.replace(/^\/games\//, "/")).replace(/\/$/, "/index.html"));
  if (!p.startsWith(root)) { res.writeHead(403); return res.end(); }
  try { res.writeHead(200, { "content-type": types[path.extname(p)] || "text/plain" }); res.end(readFileSync(p)); } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}/games/`;

// 最新の一覧の形（控え＋新作1本。新作は map に無いので分野の言葉でお金・税金に入るはず）
const NEW = { id: "zz-shinsaku", title: "新作テスト", field: "学習ゲーム（くらし・住民税）" };
const repos = [...snap.map((x) => `${x.id} game`), `${NEW.id} game`, "tenbin app"].join("\n") + "\n";
const table = "# x\n### ゲーム\n\n| プロジェクト | 分野 |\n| --- | --- |\n" + [...snap.map((x) => `| ${x.id}（${x.title}） | 学習ゲーム（${x.field}） | a |`), `| ${NEW.id}（${NEW.title}） | ${NEW.field} | a |`].join("\n") + "\n### 次\n";

const { chromium } = await import("playwright");
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
async function open(live, width = 1024, hash = "") {
  const page = await browser.newPage({ viewport: { width, height: 800 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && !/raw\.githubusercontent|Failed to load resource/.test(m.text()) && errors.push(m.text()));
  await page.route("https://raw.githubusercontent.com/**", (r) => {
    if (!live) return r.abort();
    const u = r.request().url();
    return r.fulfill({ status: 200, contentType: "text/plain", body: u === SRC.repos ? repos : table });
  });
  await page.goto(base + hash);
  await page.waitForFunction(() => document.querySelectorAll(".cards a").length > 0);
  return { page, errors };
}

{
  const { page, errors } = await open(true);
  const n = await page.$$eval(".cards a", (a) => a.length);
  check("最新の一覧を読むと新作も載る（全部の本数）", n === snap.length + 1 && (await page.textContent("#count")) === String(snap.length + 1), `${n}`);
  const newHref = await page.$$eval(".cards a", (a) => a.map((x) => x.href));
  check("新作のリンクは Pages の URL", newHref.includes(`https://satou-aaaaa.github.io/${NEW.id}/`));
  check("新作は分野の言葉でお金・税金に入る", await page.$eval("#g-okane", (s, id) => !!s.querySelector(`a[href$="/${id}/"]`), NEW.id));
  check("ゲームのリンクは全部 https://satou-aaaaa.github.io/<名前>/", newHref.every((h) => /^https:\/\/satou-aaaaa\.github\.io\/[a-z0-9-]+\/$/.test(h)));
  check("今日の1本が出る", (await page.getAttribute("#pick", "href")).startsWith("https://satou-aaaaa.github.io/") && (await page.textContent("#pick-title")) !== "…");
  await page.click('button[data-g="rika"]');
  const rika = snap.filter((x) => x.genre === "rika").length;
  check("ジャンルのボタンで絞れる（理科）", (await page.$$eval(".cards a", (a) => a.length)) === rika && (await page.$$(".group")).length === 1 && page.url().endsWith("#g=rika"), `${rika}`);
  await page.click('button[data-g="all"]');
  await page.fill("#q", "税");
  const hits = await page.$$eval(".cards .t", (a) => a.map((x) => x.textContent));
  check("検索で絞れる（税）", hits.length > 3 && hits.length < 60 && (await page.textContent("#status")).includes("本"), hits.length);
  await page.fill("#q", "ぜったいにないことば");
  check("見つからないときは知らせる", (await page.$(".empty")) !== null);
  check("ブラウザのエラーが無い", errors.length === 0, errors.join(" / "));
  const shown = (await page.title()) + (await page.textContent("body"));
  check("画面に使わない言葉が出ない", BANNED.every((w) => !shown.includes(w)), BANNED.filter((w) => shown.includes(w)).join(","));
  await page.close();
}
{
  const { page, errors } = await open(false, 1024, "#g=bousai");
  check("最新を読めないときは控えを出し、そう知らせる", (await page.$$eval(".cards a", (a) => a.length)) === snap.filter((x) => x.genre === "bousai").length && (await page.textContent("#status")).includes("控え"));
  check("URL の #g= でジャンルを開ける", (await page.getAttribute('button[data-g="bousai"]', "aria-pressed")) === "true");
  check("ブラウザのエラーが無い（控え）", errors.length === 0, errors.join(" / "));
  await page.close();
}
{
  const { page } = await open(true, 320);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check("幅320px で横にはみ出さない", over <= 0, over);
  const small = await page.$$eval("button, .cards a, #pick, #q", (xs) => xs.filter((x) => Math.round(x.getBoundingClientRect().height) < 44).map((x) => x.textContent.trim().slice(0, 10)));
  check("押せる所は高さ44px以上", small.length === 0, small.join(","));
  check("lang=ja・拡大を禁じない", (await page.getAttribute("html", "lang")) === "ja" && !/user-scalable=no|maximum-scale=1(\D|$)/.test(await page.getAttribute('meta[name="viewport"]', "content")));
  const noName = await page.$$eval("button, a, input", (xs) => xs.filter((x) => !(x.textContent.trim() || x.getAttribute("aria-label") || (x.id && document.querySelector(`label[for="${x.id}"]`)))).length);
  check("名前の無いボタン・リンク・入力欄が無い", noName === 0, noName);
  await page.close();
}
for (const scheme of ["light", "dark"]) {
  const page = await browser.newPage({ colorScheme: scheme });
  await page.route("https://raw.githubusercontent.com/**", (r) => r.abort());
  await page.goto(base);
  await page.waitForSelector(".cards a");
  // 文字と背景のコントラスト（WCAG 1.4.3：4.5:1）。背景は親をたどって最初の不透明な色
  const bad = await page.evaluate(() => {
    const rgb = (s) => (s.match(/[\d.]+/g) || []).map(Number);
    const lum = ([r, g, b]) => [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
    const bg = (e) => { for (; e; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c.length === 3 || c[3] > 0.9) return c; } return [255, 255, 255]; };
    const out = [];
    for (const e of document.querySelectorAll("h1,h2,p,span,a,button,label")) {
      if (!e.textContent.trim() || !e.getClientRects().length) continue;
      const f = rgb(getComputedStyle(e).color), b = bg(e);
      const a = f[3] ?? 1; const mix = f.slice(0, 3).map((v, i) => v * a + b[i] * (1 - a));
      const [l1, l2] = [lum(mix), lum(b)].sort((x, y) => y - x);
      const r = (l1 + 0.05) / (l2 + 0.05);
      if (r < 4.5) out.push(`${e.tagName}.${e.className}:${r.toFixed(2)}`);
    }
    return [...new Set(out)].slice(0, 8);
  });
  check(`文字のコントラスト 4.5:1 以上（${scheme}）`, bad.length === 0, bad.join(" "));
  await page.close();
}
await browser.close();
server.close();

mkdirSync(path.join(root, "qa-report"), { recursive: true });
const lines = results.map((r) => `- ${r.ok ? "✅" : "❌"} ${r.name}${r.detail && !r.ok ? `（${r.detail}）` : ""}`);
writeFileSync(path.join(root, "qa-report", "report.md"), `# QA\n\n${lines.join("\n")}\n`);
console.log(lines.join("\n"));
const fail = results.filter((r) => !r.ok).length;
console.log(fail ? `\n❌ ${fail} 件` : `\n✅ 全部 ${results.length} 件`);
process.exit(fail ? 1 : 0);
