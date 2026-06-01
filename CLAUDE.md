# RWBH 專案指令

## 每次動作之前（最高優先）

**在執行任何動作（修改程式、查找變數、回答問題）之前，必須先查 memory：**

1. 先讀 `MEMORY.md` 索引，確認有哪些記憶可用
2. 找到相關記憶檔案後讀取，再根據內容行動
3. 不得直接 Grep / Read 程式碼，除非確認 memory 中找不到答案

## 每次對話開始時

依序讀取以下四個 map，全部讀完再動作：

1. **`project_file_map.md`** — 主專案各檔案的關鍵函式行號速查
2. **`variables.md`** — 所有全域與區域變數位置
3. **`project_map.md`** — 主專案完整 variable map + function map（含行號、輸入輸出、呼叫關係）
4. **`dev_editor_map.md`** — dev_editor 完整 variable map + function map

路徑前綴：`C:\Users\PKS\.claude\projects\C--Users-PKS-Desktop-final-project-rwbh\memory\`

> 讀完這四個 map 後才能動手修改或 Grep，避免重複讀取大檔案。

## 查找變數 / 函式前

先從上面四個 map 查找，確認找不到再用 Grep 定位。

## dev_editor ↔ 伺服器雙向同步原則

**每次修改 dev_editor 的邏輯，必須同步更新伺服器版本；反之亦然。**

| 修改位置 | 必須同步的對應位置 |
|---------|-----------------|
| `dev_editor/index.html` PREVIEW 渲染邏輯 | `ui/enemy.js` 對應渲染函式 |
| `dev_editor/index.html` PREVIEW 射擊/攻擊邏輯 | `ui/enemy.js` `_updateBoss` / `_updateMobs` |
| `dev_editor/index.html` 形狀繪製（`_drawSSShape`）| `ui/enemy.js` `_drawShape` |
| `ui/enemy.js` 任何敵人行為/渲染 | `dev_editor/index.html` PREVIEW 對應區段 |
| 任一端新增欄位或變數 | 另一端必須同樣讀取並套用 |

> 同步後，兩端的視覺與行為應保持一致。同步完畢後必須同步更新 memory。

## 每次修改程式後

**必須同步更新所有受影響的記憶：**

| 改動類型 | 必須更新的記憶檔 |
|---------|---------------|
| 新增/刪除/移動函式 | `project_file_map.md`、`project_map.md`（或 `dev_editor_map.md`）|
| 新增/修改/刪除變數 | `variables.md`、`project_map.md`（或 `dev_editor_map.md`）|
| 資料流改變 | `data_pipeline.md` |
| 新發現 bug 或修復 bug | `bug_list.md` |
| 系統行為改變（商城/戰鬥/復活等）| `game_systems.md` |
| dev_editor 規格改變 | `dev_editor_spec.md` |
| end-to-end 路線改變 | `e2e_audit.md` |

只需更新有變動的那幾行，不必重新讀整個檔案。

## Token 節省原則

- 修改檔案前：先 Grep 定位行號 → 再 `Read(file, offset=N, limit=40)` 精確讀取
- 不重複讀取已知內容，信任 Edit 成功不事後驗證
- 所有 git / ls / tree / read 大檔案指令加 `rtk` 前綴
- Grep 加 `head_limit: 20`，避免回傳過多無用結果
- 回應中不重複貼完整程式碼，說明「第 X 行改成 Y」即可
- 同一檔案多處修改，合併成同一輪的多個 Edit，不分多輪
- 錯誤訊息只貼最後 10 行，不貼完整 stack trace（用 `rtk err <cmd>`）
- 回應開頭不重述摘要，直接執行
- 定期用 consolidate-memory 整理 MEMORY.md，避免記憶檔膨脹
