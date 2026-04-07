# 專案進度與預算總覽管控系統實作計畫

本計畫旨在打造一個具備高質感介面、視覺化圖表與嚴謹預算驗證邏輯的單頁式現代網頁應用程式 (SPA)。我們將使用 Vanilla HTML/CSS/JavaScript 開發前端，並將您的 Google Sheets 作為雲端資料儲存中心（後端）。

## 目標範圍與背景

整合 Google OAuth 登入功能，讓使用者能安全存取並讀取/寫入指定的 Google Sheet 試算表 `1VQESZGFUox6XtZEfRtTrlpNWfbca2hDZnEUvbkmKDoM`。系統具備三個主要層級：**計畫 (Plan)** > **任務 (Task)** > **工作 (Job)**，並嚴格遵循您訂定的各項預算上限規則與進度計算邏輯。

> [!IMPORTANT]
> **User Review Required (需要您的確認與回饋)**
> 1. **資料結構定義：** 請確認下方「Google Sheets 資料結構建議」是否符合您的預期，若同意，實作階段將程式自動化建置對應的欄位結構。
> 2. **總預算計算：** 目前規劃 `計畫總運算 = 初始預算 + 追加預算`。任務的上限(不超過40%)與整體任務預算上限(不超過150%)，都會以這個「計畫總運算」為基準計算，請確認此邏輯正確。
> 3. **開發環境測試：** 確保在 Google Cloud Console 中，`http://127.0.0.1:5500` 已經加入至 OAuth 2.0 用戶端 ID (`471276001563-bi6rfu2a518u11bjl78puv7ggrhi30vh...`) 的**已授權的 JavaScript 來源**中，否則登入時會遇到 origin mismatch 錯誤。

## Google Sheets 資料結構建議

為了確保各階層資料關聯性並兼顧關聯式查詢優化，建議將資料分成三個工作表 (Sheets)，系統運作時所有 AUDI 操作都將對應至這三張表：

### 1. 工作表：`Plans` (計畫)
- **ID**: `string` (UUID，唯一識別碼)
- **Name**: `string` (計畫名稱)
- **InitialBudget**: `number` (初始預算)
- **AdditionalBudget**: `number` (追加預算)
- **CreatedAt**: `string` (建立時間)

### 2. 工作表：`Tasks` (任務)
- **ID**: `string` (UUID)
- **PlanID**: `string` (關聯的計畫 ID)
- **Name**: `string` (任務名稱)
- **Budget**: `number` (任務預算，新增/修改時受該計畫總運算的 40% 檢查上限)
- **ActualCost**: `number` (實際花費金額)
- **CreatedAt**: `string` (建立時間)

### 3. 工作表：`Jobs` (工作)
- **ID**: `string` (UUID)
- **TaskID**: `string` (關聯的任務 ID)
- **Name**: `string` (工作名稱)
- **IsCompleted**: `boolean` (`TRUE` 或 `FALSE`，表示完成或未完成狀態)
- **CreatedAt**: `string` (建立時間)

## 提出的架構與改變 (Proposed Changes)

我們將採用純淨的現代化工具堆疊，不依賴龐大框架以確保載入速度。

---

### [前端結構基礎]

採用模組化 JavaScript 分離邏輯，並以 Vanilla CSS 確保精美的動態與深色模式支援設計。這包含設計系統 (Design System) 定義。

#### [NEW] `index.html`
- SPA 的主要進入點。包含 Google Identity Services script 的載入，登入介面，以及主要儀表板的切換容器 (`div#app`)。
- 引入 Chart.js 以繪製視覺化圖表。

#### [NEW] `css/style.css`
- 遵循美感與高質感設計，設定 CSS 變數（玻璃透視風格、柔和漸層、精緻陰影與平滑轉場動畫）。
- 建構 Grid / Flexbox 排版系統，確保在桌面與平板的良好響應式體驗。
- **針對特別條件的樣式**：定義 `.alert-over-budget` 亮色字體樣式（當任務預算加總 > 計畫總運算時套用）。

#### [NEW] `js/main.js`
- 進入點腳本。初始化 Google Auth、事件監聽器，以及處理 UI 頁面的切換與主要邏輯整合。

---

### [資料庫存取層 (Google Sheets API)]

處理與 Google Sheets 溝通的核心服務邏輯。

#### [NEW] `js/auth.js`
- 載入並初始化 `google.accounts.oauth2.initTokenClient`，處理 OAuth Token 授權與更新，使用 Client ID `471276...` 請求 `https://www.googleapis.com/auth/spreadsheets` 存取權。

#### [NEW] `js/api.js`
- 封裝 Google Sheets 的 REST API 呼叫 (Fetch)。
- 實作擷取全部計畫、任務、工作的 `read` 方法。
- 實作寫入行 (Add)、更新特殊行 (Update)、清空特殊行 (Delete) 等基礎 AUDI 方法，對應 `1VQESZGFUox6XtZEfRtTrlpNWfbca2hDZnEUvbkmKDoM` sheetID。

---

### [業務邏輯與介面組件層]

處理複雜的約束邊界條件、動態畫面渲染與進度計算。

#### [NEW] `js/business.js`
- `calculateProgress(planOrTaskID, type)`: 根據條件遞迴或計算底下相應 `Jobs` 的完成數與總數，並回傳百分比。
- `validateTaskBudget(taskBudget, planTotalBudget)`: 檢查新增預算是否大於總計畫之 40%。
- `validateTotalPlanBudgetLimit(currentTotalTaskBudget, newTaskBudget, planTotalBudget)`: 檢查加總後是否會超過計畫總預算的 150%。若超過會拋出錯誤阻止新增機制。
- `checkPlanAlertStatus(planID)`: 回傳是否達到警示亮色標準（任務總預算 > 計畫總預算）。

#### [NEW] `js/ui.js`
- 綁定對應的 AUDI Modal 對話方塊 (新增/編輯表單)，與點擊觸發事件 (Job Checkbox)。
- 使用 `Chart.js` 繪製 `renderTaskCharts()` 與 `renderPlanCharts()`：
  - 各任務實際花費 vs 任務預算（長條圖）
  - 面板呈現進度完成圓餅圖（Progress Doughnut Chart）

## 驗證計畫 (Verification Plan)

### 1. 手動整合與安全驗證
- **連線與安全性**：透過 Live Server (`http://127.0.0.1:5500/`) 發行後，檢查登入階段是否有被 Google 成功授權。檢視 Browser Console 確認沒有 CORS 或 Origin 無效化問題。
- **預先載入測試**：確保即使 Google 試算表目前為空，應用也能先透過 API 自動初始化出對應標題的「三個工作表」。

### 2. 業務規則與 AUDI 測試
1. **[計畫管控]**：建立新計畫，驗證「初始預算」與「追加預算」能否存入與計算。
2. **[任務預算上限]**：在某個總預算 $10,000 的計畫下，嘗試新增 $4,001 的任務，確認表單跳出錯誤警告並**禁止輸入/儲存**。
3. **[任務總預算警報]**：讓三個任務累積預算達 $10,001，觀察專案列表上的名稱是否變更為**顯眼亮色字體**。
4. **[任務總裁切上限]**：讓所有任務預算加總逼近 $15,000，嘗試再加入一筆讓總預算超過 $15,000 的任務或修改預算，確認被系統阻擋（150% 鎖定限制）。
5. **[狀態關聯查詢]**：加入多個工作 (Jobs)，切換 "已完成"，驗證任務 (Task) 執行進度與對應計畫 (Plan) 進度的百分比是否正確連動重算更新。

請閱讀並確認以上的實作計畫，一旦您給予同意，我們就會立刻開始幫您刻劃與實作網站！
