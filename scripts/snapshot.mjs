// 同梱の控え games.json を作り直す（ページが shared-workflows を読めないときに出す一覧）。
// 使い方: node scripts/snapshot.mjs ../shared-workflows
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { build } from "../list.js";
const sw = process.argv[2] || "../shared-workflows";
const g = JSON.parse(readFileSync(new URL("../genres.json", import.meta.url), "utf8"));
const games = build(readFileSync(path.join(sw, "repos.txt"), "utf8"), readFileSync(path.join(sw, "routines/project-practices.md"), "utf8"), g);
writeFileSync(new URL("../games.json", import.meta.url), JSON.stringify(games, null, 0).replace(/\},\{/g, "},\n{") + "\n");
console.log(`games.json: ${games.length} 本`);
