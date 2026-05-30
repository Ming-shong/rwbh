# RWBH 專案指令

## 每次對話開始時

**必須先讀取** `C:\Users\PKS\.claude\projects\C--Users-PKS-Desktop-final-project-rwbh\memory\project_file_map.md`

這份檔案記錄所有主要檔案的關鍵函式行號，修改前先查此表再用 `offset/limit` 精確 Read，避免重複讀取整個大檔案。

## 每次修改程式後

若新增、刪除、移動了函式，**必須同步更新** `project_file_map.md` 中對應的行號。
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
