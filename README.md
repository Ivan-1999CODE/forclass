# 課堂即時問答

本專案是本機可測試的 Kahoot-like 課堂即時問答系統。老師在電腦啟動服務後，學生手機連同一個 Wi-Fi，就能用區網網址加入同場測驗。

## 啟動

```powershell
npm install
npm run dev
```

啟動後終端機會顯示：

- 老師頁面：`http://localhost:3000/host-teacher-panel`
- 學生本機測試：`http://localhost:3000/join`
- 手機測試網址：`http://你的區網IP:3000/join`

如果 Windows 防火牆詢問，請允許 Node.js 在私人網路通訊。

## 題目格式

題目 JSON 放在 `quizzes/`。範例：

```json
{
  "id": "2026-05-25-present-simple",
  "title": "現在簡單式",
  "date": "2026-05-25",
  "defaultTimeLimitSec": 20,
  "questions": [
    {
      "prompt": "She ____ to school every day.",
      "options": ["go", "goes", "going", "went"],
      "answerIndex": 1,
      "explanation": "主詞 She 是第三人稱單數，現在簡單式動詞要加 -s。"
    }
  ]
}
```

`answerIndex` 從 0 開始：第一個選項是 0，第二個選項是 1。

## 測試流程

1. 老師開啟 `http://localhost:3000/host-teacher-panel`。
2. 選擇測驗並建立場次。
3. 用無痕視窗開學生連結，或開 `/join` 後輸入加入碼，模擬 2-3 位學生加入。
4. 手機連同一個 Wi-Fi，開終端機顯示的手機測試網址。
5. 老師按開始遊戲，學生答題。
6. 題目會自動倒數，時間到自動公布答案；老師查看統計後按下一題。
7. 結束後下載 `summary.csv` 和 `responses.csv`。

## 新增題目

把新的 `.json` 題目檔放進 `quizzes/` 資料夾，例如：

```text
quizzes/2026-05-26-present-simple-review.json
```

儲存後重新整理老師頁，新的測驗就會出現在下拉選單。檔案名稱可以自訂，但 JSON 裡的 `id` 不要和其他測驗重複。

## Supabase 歷史場次保存

如果要讓完成的場次在 Render 睡著、重啟或重新部署後仍然保留：

1. 到 Supabase 專案的 SQL Editor。
2. 貼上並執行 `supabase/schema.sql`。
3. 到 Supabase `Project Settings` -> `API` 複製：
   - Project URL
   - service_role key
4. 到 Render 服務的 `Environment` 新增：
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `TEACHER_PASSWORD`
5. 在 Render 按 `Manual Deploy` -> `Deploy latest commit`。

`service_role key` 只能放在 Render 後端環境變數，不要放到前端或公開貼給學生。

`TEACHER_PASSWORD` 是老師控制頁密碼。設定後，進入 `/host-teacher-panel` 需要先輸入這組密碼。
