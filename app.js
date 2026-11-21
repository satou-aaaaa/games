// 画面：ジャンルのボタン・検索・今日の1本・一覧。データは list.js の load()（最新を読み、だめなら控え）。
import { load, search, todayPick, dayKey, playUrl } from "./list.js";

const $ = (s) => document.querySelector(s);
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  for (const k of kids) e.append(k);
  return e;
};

async function main() {
  const [g, snapshot] = await Promise.all(["genres.json", "games.json"].map((u) => fetch(u).then((r) => r.json())));
  const { games, live } = await load(window.fetch.bind(window), g, snapshot);
  const names = Object.fromEntries(g.genres.map((x) => [x.id, x]));
  const used = g.genres.filter((x) => games.some((y) => y.genre === x.id));
  const state = { genre: "all", q: "" };
  const h = new URLSearchParams(location.hash.slice(1));
  if (names[h.get("g")]) state.genre = h.get("g");
  if (h.get("q")) state.q = h.get("q");
  $("#q").value = state.q;

  $("#count").textContent = games.length;
  const p = todayPick(games, dayKey());
  if (p) {
    $("#pick").href = playUrl(p.id);
    $("#pick-title").textContent = p.title;
    $("#pick-field").textContent = `${names[p.genre]?.name || ""}｜${p.field}`;
  }

  const bar = $("#genres");
  const btn = (id, label, n) => {
    const b = el("button", { type: "button", "data-g": id, "aria-pressed": String(state.genre === id) }, label, el("span", { class: "n" }, `${n}`));
    b.addEventListener("click", () => { state.genre = id; render(); });
    return b;
  };
  bar.append(btn("all", "すべて", games.length));
  for (const x of used) bar.append(btn(x.id, x.short || x.name, games.filter((y) => y.genre === x.id).length));

  const card = (x) => el("li", {}, el("a", { href: playUrl(x.id) }, el("span", { class: "t" }, x.title), el("span", { class: "f" }, x.field)));

  function render() {
    for (const b of bar.querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.dataset.g === state.genre));
    const hits = search(games, state.q, state.genre);
    const list = $("#list");
    list.replaceChildren();
    const groups = state.genre === "all" ? used : [names[state.genre]];
    for (const gr of groups) {
      const xs = hits.filter((x) => x.genre === gr.id);
      if (!xs.length) continue;
      list.append(el("section", { class: "group", id: `g-${gr.id}` },
        el("h2", {}, gr.name, el("span", { class: "n" }, `${xs.length}本`)),
        el("p", { class: "desc" }, gr.desc),
        el("ul", { class: "cards" }, ...xs.map(card))));
    }
    if (!hits.length) list.append(el("p", { class: "empty" }, "見つかりませんでした。ほかのことばで探すか、ジャンルを「すべて」にしてください。"));
    const where = state.genre === "all" ? "" : `${names[state.genre].name}で `;
    $("#status").textContent = (state.q || state.genre !== "all" ? `${where}${hits.length}本` : "") + (live ? "" : "（最新の一覧を読めなかったので、控えの一覧を出しています）");
    const nh = new URLSearchParams();
    if (state.genre !== "all") nh.set("g", state.genre);
    if (state.q) nh.set("q", state.q);
    history.replaceState(null, "", nh.toString() ? `#${nh}` : location.pathname);
  }
  $("#q").addEventListener("input", (e) => { state.q = e.target.value; render(); });
  render();
}
main().catch(() => { document.querySelector("#status").textContent = "一覧を読めませんでした。ページを読み込み直してください。"; });
