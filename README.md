# 說一聲 · LINE 語音提醒助手

把提醒與心意，準時送達。手機、電腦共用的繁體中文 PWA。

**[打開 GitHub Pages 示範版](https://jimmy10107.github.io/say-it-line-assistant/)**

示範版僅使用本機瀏覽器資料，不開啟麥克風、不呼叫 Gemini、不傳送 LINE。正式功能的程式已包含在本專案，需設定 Cloudflare、Gemini 與 LINE 後啟用；未以真實帳號完成端到端驗證。

## 功能

- Gemini Live 即時語音對話：問候、理解收件人與時間、口頭確認、提醒草稿。
- 最後確認表單：檢查提醒內容、聯絡人、台灣時間，確認後才建立排程。
- 手動建立提醒與基本相對時間文字輸入。
- LINE Webhook 自動同步好友名稱、設定暱稱、處理封鎖事件。
- 雲端排程：每分鐘檢查提醒，頁面關閉仍運作；LINE push 使用重試鍵防止重複通知。
- Nano Banana 2 賀卡：描述、生成、預覽，再選擇收件人與排程時間。
- PBKDF2 密碼登入、12 小時登入有效期、登入頻率限制、短效 Gemini token。
- 可加入手機主畫面的 PWA。離線僅保留介面，不會在離線時建立正式排程。

## 快速開始

```sh
npm ci
npm run check
npm test
npm run db:local
npm run dev
```

正式部署請讀 [設定教學](docs/DEPLOYMENT.md)。本機登入需依教學設定 `.dev.vars`，沒有密碼時頁面會顯示連接設定。

## 專案與學習記錄

| 檔案 | 用途 |
|---|---|
| `public/` | 手機與桌面介面、語音串流、PWA |
| `src/worker.ts` | 登入、LINE Webhook、提醒 API、Gemini 與背景排程 |
| `schema.sql` | D1 資料表 |
| `docs/` | GitHub Pages 示範頁與部署教學 |
| `tests/` | 時間、安全驗證及排程可靠性測試 |
| `AGENTS.md` | 後續開發與還原規則 |
| `docs/LEARNING.md` | 影片內容對照、官方資料與 skill |

更新示範頁：`node scripts/build-demo.mjs`。`public/` 是介面原始檔，請勿只修改 `docs/` 的複製檔。

## 實際限制

- Cron 每分鐘檢查一次，網路與供應商可能增加延遲；不是秒級保證。
- LINE API 成功表示平台接受請求，不表示收件人已收到或讀取；收件人必須符合 LINE 的發送条件。
- Gemini API、圖片生成、Cloudflare 與 LINE 的額度／費用由各帳號決定。程式不會自動註冊帳號、開通付款或產生金鑰。
- 個人使用的單一管理者密碼系統；不適用多租戶或公開提供他人註冊。
- 賀卡在確認前不會發送，但生成本身可能產生費用。圖片以隨機不可推測網址供 LINE 讀取；持有該網址的人可查看圖片。
- 語音 session 最長約 9 分鐘，結束後需重新按麥克風。未實作無縫重連或自動續接。

## 驗證

測試與未驗證的功能請見 [交付與驗證紀錄](docs/VERIFICATION.md)。
