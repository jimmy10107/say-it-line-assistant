# 影片學習與實作對照

來源：[PAPAYA 電腦教室影片](https://www.youtube.com/watch?v=0VdLfs1t7dk)，2026-09-27。本次取得並讀完 0:02–17:51 的完整逐字稿，另確認影片說明與章節；不是宣稱逐幀觀看所有畫面。

| 章節 | 此專案的落實方式 |
|---|---|
| 專案資料夾 | 獨立的 voice-line-assistant，不混入日南品牌素材 |
| App 圖示 | 可編輯 SVG 聲波對話圖示、PWA PNG 圖示 |
| 功能需求 | 單一管理者、手機／電腦、語音提醒與賀卡 |
| Git 版本管理 | 新 GitHub 專案、提交、後續分支與 revert |
| 雲端與金鑰 | Worker、D1、R2；金鑰存 Secrets |
| App 測試 | 安全與時間測試、本機 API、桌面與手機介面 |
| 修改與新功能 | AGENTS.md、測試、手動正式部署工作流程 |
| 賀卡擴充 | Gemini 圖片生成、預覽、確認後 LINE 排程 |

與影片的操作差異：真正排程前有明確的最終確認表單；語音準備草稿不等於送出。GitHub Pages 只提供示範，正式通知在 Worker 執行。模型與套件以官方現行資料核對，沒有直接使用逐字稿作為 API 規格。

## 已使用的 skill

- Codex Skill Installer：從 GitHub 安裝技能。
- [Google 官方 gemini-api-dev](https://github.com/google-gemini/gemini-skills/tree/main/skills/gemini-api-dev)：目前 SDK、圖片生成與服務端 API。
- [Google 官方 gemini-live-api-dev](https://github.com/google-gemini/gemini-skills/tree/main/skills/gemini-live-api-dev)：即時語音、PCM、工具呼叫與短效 token。

兩個 Gemini skill 已安装到使用者的 Codex skills 資料夾。本次讀取並使用；下個回合可自動發現。來源提交：`6fee1bec62d6a0ca92c1d0e34d62ff11f70c498a`。

## 官方教學與參考

- [Gemini Live 概覽](https://ai.google.dev/gemini-api/docs/live-api)：雙向音訊與實作方式。
- [Live WebSocket 教學](https://ai.google.dev/gemini-api/docs/live-api/get-started-websocket)：協定、PCM 與工具回應。
- [短效 token](https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens)：前端不持有長效 key。
- [Gemini 圖片生成](https://ai.google.dev/gemini-api/docs/image-generation)：Nano Banana 與回傳圖片。
- [Google coding agent skills](https://ai.google.dev/gemini-api/docs/coding-agents)：官方技能設定。
- [Cloudflare Cron](https://developers.cloudflare.com/workers/configuration/cron-triggers/)：雲端背景排程。
- [Cloudflare D1](https://developers.cloudflare.com/d1/get-started/)：資料庫設定。
- [LINE 發送訊息](https://developers.line.biz/en/docs/messaging-api/sending-messages/)：push 與收件人條件。
- [LINE Webhook 驗證](https://developers.line.biz/en/docs/messaging-api/verify-webhook-signature/)：簽章檢查。
- [LINE 重試 API](https://developers.line.biz/en/docs/messaging-api/retrying-api-request/)：重試鍵與重複請求。
- [GitHub Pages 發布來源](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)：示範頁發布。

影片轉錄稿與第三方完整文件未收錄在公開儲存庫。
