// ゲームの一覧を作る部品（ページと qa/run.mjs の両方が使う。外へ通信するのは load() だけ）。
// 一覧の正は satou-aaaaa/shared-workflows の repos.txt（種類 game）と routines/project-practices.md の「### ゲーム」の表。
// 新作はそこに1行足されるだけで、ここは何も直さずに載る。ジャンルは genres.json の map、無ければ rules（分野の言葉）で決める。

export const SRC = {
  repos: "https://raw.githubusercontent.com/satou-aaaaa/shared-workflows/main/repos.txt",
  table: "https://raw.githubusercontent.com/satou-aaaaa/shared-workflows/main/routines/project-practices.md",
};
export const OWNER = "satou-aaaaa";
export const playUrl = (id) => `https://${OWNER}.github.io/${id}/`;

// repos.txt：1行「名前 種類」。# から後ろはコメント
export function parseRepos(text) {
  const out = [];
  for (const raw of text.split("\n")) {
    const line = raw.replace(/#.*/, "").trim();
    const m = line.match(/^([a-z0-9][a-z0-9-]*)\s+game$/);
    if (m) out.push(m[1]);
  }
  return out;
}

// project-practices.md の「### ゲーム」の表：| name（日本語の名前） | 分野 | …
export function parseTable(md) {
  const out = {};
  const start = md.indexOf("\n### ゲーム");
  if (start < 0) return out;
  const rest = md.slice(start + 1);
  const next = rest.indexOf("\n### ", 1);
  const body = next < 0 ? rest : rest.slice(0, next);
  for (const line of body.split("\n")) {
    const m = line.match(/^\| ([a-z0-9][a-z0-9-]*)（(.+?)） \| (.+?) \|/);
    if (m) out[m[1]] = { title: m[2], field: m[3] };
  }
  return out;
}

// 「学習ゲーム（くらし・民法の売買）」→「くらし・民法の売買」。かっこが無ければそのまま
export function shortField(field) {
  const m = (field || "").match(/^[^（]*（(.+)）$/);
  return m ? m[1] : field || "";
}

export function genreOf(id, field, g) {
  if (g.map[id]) return g.map[id];
  for (const [gid, re] of g.rules) if (new RegExp(re).test(field || "")) return gid;
  return "sonota";
}

export function build(reposText, tableMd, g) {
  const table = parseTable(tableMd);
  return parseRepos(reposText).map((id) => {
    const t = table[id] || { title: id, field: "" };
    return { id, title: t.title, field: shortField(t.field), genre: genreOf(id, t.field, g) };
  });
}

// 今日の1本：日本の日付で決める（だれでも同じ）
export function dayKey(d = new Date()) {
  return new Date(d.getTime() + 9 * 3600e3).toISOString().slice(0, 10);
}
export function todayPick(games, key) {
  if (!games.length) return null;
  const sorted = [...games].sort((a, b) => (a.id < b.id ? -1 : 1));
  let h = 2166136261;
  for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return sorted[h % sorted.length];
}

// かな・カナを同じに、大文字小文字も同じにして探す
export function norm(s) {
  return (s || "").normalize("NFKC").toLowerCase().replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}
export function search(games, q, genre) {
  const words = norm(q).split(/\s+/).filter(Boolean);
  return games.filter((x) => (!genre || genre === "all" || x.genre === genre) && words.every((w) => norm(`${x.title} ${x.field} ${x.id}`).includes(w)));
}

// 最新の一覧を読む。読めない・少なすぎるときは同梱の控え（games.json）を使う
export async function load(fetchFn, g, snapshot) {
  try {
    const [r, t] = await Promise.all([SRC.repos, SRC.table].map((u) => fetchFn(u, { cache: "no-cache" }).then((res) => { if (!res.ok) throw new Error(res.status); return res.text(); })));
    const games = build(r, t, g);
    if (games.length >= snapshot.length * 0.8) return { games, live: true };
  } catch (e) { /* 控えへ */ }
  return { games: snapshot, live: false };
}
