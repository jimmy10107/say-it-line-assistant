# 說一聲維護規則

- 本專案獨立於日南稻站品牌素材，勿修改或上傳父層資產。
- 先閱讀 README.md、docs/DEPLOYMENT.md 與 docs/VERIFICATION.md。
- `public/` 為介面來源；修改後執行 `node scripts/build-demo.mjs` 同步 GitHub Pages。
- 正式 Worker 必須在同一個 HTTPS 網址提供介面與 API；不要把長效 API key 放在前端。
- 語音只能準備草稿；使用者必須在表單確認收件人、時間與內容後才能建立排程。
- 不得把示範提醒寫成已發送 LINE，也不得在示範模式呼叫付費 API。
- 不記錄密碼、session token、Gemini token、LINE secret 或完整 API 回應。
- LINE Webhook 必須先驗證原始 request body 的 HMAC-SHA256 簽章。
- 台灣時間以 Asia/Taipei 或帶 +08:00 的 ISO 字串處理；後端儲存 UTC epoch。
- 排程變更必須保留 claim／lease／retry key，避免 cron 重疊導致重複發送。
- 修改 API 或排程後執行 npm run check、npm test 與相關本機流程測試。
- 新功能建立 codex/ 前綴分支；先驗證再部署。還原採 git revert 保留歷史，勿 force push 主線。
- Gemini API 變更先核對 Google 官方文件及 gemini-api-dev、gemini-live-api-dev skill，勿只依影片或模型記憶。
