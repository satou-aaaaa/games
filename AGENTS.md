# AGENTS.md

satou-aaaaa の全ゲームをジャンル別に紹介する一覧ページ（https://satou-aaaaa.github.io/games/ 、GitHub Pages は main の /）。
Claude・Codex・Gemini・Copilot など、どの AI でも、人でも、ここから読み始める。

## しくみ

- ページを開くたびに satou-aaaaa/shared-workflows の `repos.txt`（種類 game）と `routines/project-practices.md` の「### ゲーム」の表を読む（`list.js`）。新作はそこに1行足されるだけで載る。ここは直さない。
- 読めないときは同梱の控え `games.json` を出す。控えは `node scripts/snapshot.mjs ../shared-workflows` で作り直す。
- ジャンルは `genres.json`。`map`（名前→ジャンル）が人の決めた分け方。`map` に無い新作は `rules`（分野の言葉）で決まり、どれにも合わなければ「その他」。ずれていたら `map` に1行足す。
- 外へ通信するのは raw.githubusercontent.com だけ（CSP の connect-src）。広げない。
- 「小江戸ゲーム部」の名前は出さない（2026-11-24 satou さん）。題は「学べる無料ゲーム一覧」。`qa/run.mjs` の BANNED がファイルと画面を見る。出さない言葉が増えたら BANNED に足す。

## push する前の確認

```bash
cd qa && npm ci && cd ..
node qa/run.mjs   # 部品・新作が載るか・控え・320px・44px・コントラスト。結果は qa-report/report.md
```

- 画面や部品を直したら `qa/run.mjs` に検査も足す。
- PR の作り方・マージは shared-workflows の `routines/pr.md`、全体のきまりは `routines/common.md`。
