# 正式版本設定教學

GitHub Pages 網址是操作示範。真正的語音、圖片與 LINE 排程在 Cloudflare Worker 網址執行。GitHub 只備份程式，不會替你管理服務金鑰。

## 1. Cloudflare 登入與資源

在專案資料夾開啟終端機：

```sh
npm ci
npx wrangler login
npx wrangler d1 create voice-line-assistant
npx wrangler r2 bucket create voice-line-cards
```

登入授權由帳號擁有者完成。將建立 D1 後顯示的 `database_id` 填進 `wrangler.jsonc`。R2 若需要開通服務或付款資料，請自行確認費用與條款。

```sh
npx wrangler d1 execute voice-line-assistant --remote --file=schema.sql
```

## 2. 設定私人登入密碼

```sh
node scripts/password.mjs
```

密碼輸入不顯示在終端機。輸出的是 salt 與 PBKDF2 hash，原始密碼不保存。

逐一執行，將對應值貼進終端機提示，不要貼到聊天：

```sh
npx wrangler secret put PASSWORD_SALT
npx wrangler secret put PASSWORD_HASH
```

## 3. Gemini API

到 [Google AI Studio](https://aistudio.google.com/api-keys) 建立 API key，確認你的專案支援 Live 與圖片模型。

```sh
npx wrangler secret put GEMINI_API_KEY
```

預設使用 `gemini-3.8-live` 與 `gemini-3.1-flash-image`。如果帳號不支援模型，請依 [官方模型資料](https://ai.google.dev/gemini-api/docs/models) 選擇可用模型，再修改 `wrangler.jsonc`。不要把整把金鑰放進前端；瀏覽器只取得單次、短效 Live token。

圖片生成可能需要付費方案。此專案不會替你設定帳單或儲值。先在官方介面確認你的用量與費用。

## 4. LINE 官方帳號

依 [LINE 官方教學](https://developers.line.biz/en/docs/messaging-api/getting-started/) 建立官方帳號並啟用 Messaging API，取得 Channel Secret 與 Channel Access Token。

```sh
npx wrangler secret put LINE_CHANNEL_SECRET
npx wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
```

## 5. 部署並設定正式網址

```sh
npm run check
npm test
npm run deploy
```

取得 `https://say-it-line-assistant.<你的子網域>.workers.dev` 後，在 Cloudflare Worker 的 Settings → Variables and Secrets 新增一般變數 `PUBLIC_ORIGIN`，值為該 HTTPS 網址，末尾不要加 `/`。或在 `wrangler.jsonc` 的 vars 加入此值後重新部署。

這個值供背景排程建立 LINE 可讀取的賀卡網址。未設定時，App 不允許建立提醒。

在 LINE Developers 設定 Webhook URL：

```text
https://你的正式Worker網址/api/line/webhook
```

按 Verify，確認成功後啟用 Use webhook。若不希望 LINE 自己回覆罐頭訊息，可在官方帳號管理介面關閉自動回覆。好友加入後傳送一句訊息，即可同步聯絡人。

## 6. 實際驗收

1. 在正式 Worker 網址登入，確認「連接設定」的四項都已設定。
2. 用自己的 LINE 加入官方帳號並傳送訊息，確認聯絡人出現；把自己暱稱設成「我自己」。
3. 建立 2 分鐘後的提醒，確認表單的收件人與台灣時間。
4. 關閉 App，確認 LINE 仍收到通知；提醒清單應顯示 LINE 已接受。
5. 建立提醒後取消，确认排程不會送出。
6. 點麥克風測試雙向語音；允許瀏覽器的麥克風權限。使用耳機減少回音。
7. 生成一張賀卡，確認畫面和文字，再排定給自己的 LINE。

未完成以上項目前，不應稱為正式可用或已驗證 LINE 發送。

## 7. 後續 GitHub 部署

GitHub Pages 發布 `main` 分支的 `/docs`。修改介面後：

```sh
node scripts/build-demo.mjs
git add public docs
git commit -m "Update assistant interface"
git push
```

Cloudflare 正式部署可在 GitHub Actions 手動執行「Deploy Cloudflare」，需先設定 repository secrets `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`、`CLOUDFLARE_DATABASE_ID`。API token 僅給此部署需要的 Workers、D1 與 R2 權限。App 金鑰與登入密碼仍保存在 Cloudflare Secrets。

## 8. 本機測試

本機使用 `.dev.vars`，此檔已排除版本管理：

```text
PASSWORD_SALT=你產生的salt
PASSWORD_HASH=你產生的hash
GEMINI_API_KEY=你的金鑰
LINE_CHANNEL_SECRET=你的LINE秘密
LINE_CHANNEL_ACCESS_TOKEN=你的LINE token
PUBLIC_ORIGIN=https://你的正式Worker網址
```

```sh
npm run db:local
npm run dev
```

本機沒有公開 HTTPS Webhook，也不會自動收到 LINE 事件。請用正式 Worker 測試完整流程。

## 問題排查

| 情況 | 檢查 |
|---|---|
| 語音無法啟動 | HTTPS、瀏覽器麥克風權限、API key、模型名稱、額度 |
| 聯絡人沒有出現 | Webhook 驗證、Use webhook、Channel Secret、是否有加入並傳訊息 |
| 時間到了沒通知 | PUBLIC_ORIGIN、Cron trigger、LINE token、官方帳號額度、收件人是否封鎖 |
| 賀卡沒有產生 | Gemini 圖片模型、付款／額度設定、R2 binding |
| 發送失敗 | 提醒清單錯誤狀態與 LINE 的 HTTP 狀態；修正後重新建立提醒 |
| 登入失败 | PASSWORD_HASH 與 PASSWORD_SALT 是否成對、15 分鐘登入嘗試限制 |

提醒遇到暫時性錯誤最多嘗試 5 次。LINE API 的成功只代表接受發送，不保證收件人已讀。
