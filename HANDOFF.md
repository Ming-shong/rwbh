# RWBH — Real World Bullet Hell
## 專案交接文件 / Handoff Document

> 最後更新：Phase 1 完成
> 啟動指令：`python main.py` → 開啟 http://localhost:5000

---

## 一、專案目標

打造一款**無長期伺服器依賴**的 Web 彈幕射擊遊戲 Demo，以現實世界地圖為遊戲場景。

核心遊戲循環：
```
現實地圖探索 → 點擊事件（小怪/Boss）→ 彈幕戰鬥（Canvas）→ 獲得資源 → 世界狀態改變 → 繼續探索
```

關鍵設計限制：
- ❌ 不依賴長期運行的後端伺服器（Flask 僅作本地開發用）
- ✔ 所有地理資料透過 Overpass API 即時查詢並快取到本地 JSON
- ✔ 前端純 HTML + JS，後端純 Python（Flask + requests）
- ✔ 可離線運行（快取命中後不需要網路）

---

## 二、技術架構

### 前後端溝通模式

```
瀏覽器 (ui/)
  └─ api.js → fetch → Flask (main.py)
                          ├─ /api/geocode  → nominatim.py → Nominatim API
                          ├─ /api/scan     → nominatim.py → Overpass API
                          └─ /api/world    → data/world.json
```

### 目錄結構（Phase 1 已建立）

```
rwbh/
├── main.py                   # Flask 入口，所有 API endpoint
├── requirements.txt          # flask, flask-cors, requests
│
├── map_system/
│   ├── __init__.py
│   └── nominatim.py          # Overpass POI 搜尋 + geocode + 快取
│
├── data/
│   ├── cache.json            # Overpass API 回應快取（TTL 3600s）
│   └── world.json            # 世界事件狀態（Phase 2 起寫入）
│
└── ui/
    ├── index.html            # 主頁面，HUD、掃描面板、按鈕邏輯
    ├── state.js              # 全域狀態 window.STATE，CustomEvent 通知
    ├── api.js                # fetch 封裝 window.API.scan() / geocode()
    └── map.js                # Leaflet 地圖、玩家標記、POI 標記、Popup
```

### Phase 2–6 預計新增的目錄

```
rwbh/
├── map_system/
│   ├── osrm.py               # OSRM 步行距離計算
│   ├── generator.py          # POI → 遊戲事件（Boss/小怪屬性生成）
│   └── folium_export.py      # Folium HTML 地圖輸出（可選）
│
├── battle/
│   ├── __init__.py
│   ├── player.py             # 玩家屬性、武器槽
│   ├── boss.py               # Boss 多階段攻擊定義
│   ├── bullets.py            # 彈幕樣式（旋轉、散射、螺旋）
│   ├── collision.py          # 圓形 Hitbox + Spatial Grid
│   ├── weapons.py            # 武器定義（傷害、射速、特效）
│   └── reward.py             # 掉落計算
│
├── data/
│   └── shop.json             # 商城武器清單
│
└── ui/
    ├── hud.js                # 血條、資源欄（已部分內嵌於 index.html）
    ├── event_card.js         # 事件卡片元件
    ├── battle_canvas.js      # Canvas 戰鬥場景主迴圈
    ├── player.js             # 玩家移動、射擊邏輯
    ├── bullets.js            # 子彈物件池、彈幕生成
    ├── enemy.js              # 小怪/Boss 渲染與行為
    ├── shop.js               # 商城 UI
    ├── inventory.js          # 背包 UI
    ├── weapons.js            # 武器特效渲染
    ├── sfx.js                # 音效（Web Audio API）
    ├── vfx.js                # 視覺特效（爆炸、閃光）
    └── transition.js         # 地圖 ↔ 戰鬥畫面切換動畫
```

---

## 三、架構決策與設計原理

### 3.1 前端狀態管理（state.js）

採用**單一全域物件 + CustomEvent** 模式：

```js
// 所有模組讀寫 window.STATE
STATE.setPlayerPos(lat, lng)
// → 發出 CustomEvent("playerMoved")
// → map.js 監聽並移動標記
// → index.html 監聽並更新座標顯示
```

**為何不用 React/Vue？** 保持零建置工具依賴，任何瀏覽器直接開啟即可執行。

### 3.2 GPS / 點擊地圖 互斥邏輯

```
window.GPS_ACTIVE = false（預設）
  ↓
GPS 關閉 → map.on("click") 有效 → 玩家標記跟著滑鼠點擊移動
GPS 開啟 → map.on("click") 被 guard 擋住 → 位置由 watchPosition 更新
          → map.flyTo 只在 GPS_ACTIVE 時執行（避免點地圖時鏡頭跳動）
```

定位按鈕樣式：
- 預設灰色（`var(--muted)`，class `btn-locate`）
- GPS 開啟後加上 `.gps-active` → 藍色 + 發光

### 3.3 Overpass 快取策略

```python
cache_key = md5(f"poi:{lat:.3f}:{lng:.3f}:{radius}")
# 座標只取小數後 3 位（約 111m 精度）
# → 同一區域移動幾公尺不會產生不同 cache key
# → TTL = 3600s（1 小時後強制重新查詢）
```

快取儲存於 `data/cache.json`，格式：
```json
{
  "a1b2c3d4...": {
    "timestamp": 1700000000.0,
    "pois": [ ... ]
  }
}
```

### 3.4 POI 分類邏輯

| OSM tag | 遊戲類型 | 威脅等級 |
|---|---|---|
| amenity=convenience_store / cafe / restaurant / fast_food | mob | 1 |
| amenity=pharmacy / bank / police | mob | 2 |
| leisure=park / amenity=school / bus_station | boss | 3 |
| amenity=university / hospital / shop=mall | boss | 4 |
| railway=station | boss | 5 |

威脅等級（1–5）決定：標記大小、異變圈半徑、掉落結晶數量。

### 3.5 Flask 僅作本地工具

Flask 的角色是：
1. 提供 API endpoint（代理 Overpass 呼叫，處理快取）
2. 靜態服務 `ui/` 目錄
3. **不**持久運行，用完關閉即可

未來若要純前端化，可把 Overpass 呼叫移進 `api.js` 直接 fetch，Flask 完全移除。

---

## 四、已完成功能（Phase 1）

### 後端
- [x] `main.py`：Flask server，三個 endpoint（`/api/geocode`、`/api/scan`、`/api/world`）
- [x] `map_system/nominatim.py`：
  - `geocode(place)` — 地名轉座標（Nominatim API）
  - `search_pois(lat, lng, radius)` — Overpass API 批次查詢所有 POI 類型
  - `_deduplicate()` — 去除 25m 內重複 POI
  - `_cache_key()` + 讀寫 `cache.json` — TTL 3600s 快取

### 前端
- [x] `state.js`：全域狀態物件 + CustomEvent 通知機制
- [x] `api.js`：fetch 封裝，`window.API.scan()` / `window.API.geocode()`
- [x] `map.js`：
  - Leaflet 地圖初始化（OSM 圖層，暗色濾鏡）
  - 玩家標記（藍色圓點 + 脈衝圈）
  - 點擊地圖移動玩家（GPS 關閉時）
  - POI 標記：小怪（橘色圓點）、Boss（粉紅菱形 + 異變圈）
  - 事件卡片 Popup（名稱、距離、威脅等級、掉落預覽）
  - `playerMoved` 事件：GPS 模式才 flyTo，點擊模式不跳鏡頭
- [x] `index.html`：
  - 頂部 HUD（HP 條、異變進度條、變異結晶）
  - 掃描面板：唯讀座標顯示（跟隨玩家）、搜尋半徑輸入
  - 底部列（商城/背包 stub、事件計數、定位按鈕）
  - 定位按鈕：預設灰色，GPS 啟用後藍色，toggle 行為
  - 掃描按鈕：手動觸發，不自動掃描
  - 預設位置：`24.797590°N, 120.995540°E`
  - 載入畫面動畫

---

## 五、接下來的待辦事項

### Phase 2 — 地理事件系統

**目標**：加入 OSRM 步行距離計算，讓事件生成更有遊戲感。

- [ ] `map_system/osrm.py`
  - 呼叫 `http://router.project-osrm.org/route/v1/foot/{lng1},{lat1};{lng2},{lat2}`
  - 回傳步行距離（m）與時間（秒）
  - 同樣加快取（key = `osrm:{lat1:.4f}:{lng1:.4f}:{lat2:.4f}:{lng2:.4f}`）

- [ ] `map_system/generator.py`
  - 輸入：POI list + 玩家位置 + OSRM 距離
  - 過濾：步行 > 20 分鐘的 POI 不生成事件（或降為低威脅）
  - 輸出：帶有 `walk_minutes`、`boss_hp`、`mob_count` 的事件物件

- [ ] `data/world.json`：寫入當前世界事件狀態（供重新開啟時恢復）

- [ ] 前端：事件卡片顯示步行時間（來自後端 `walk_minutes`）

- [ ] 前端：`map.js` 在 Boss 卡片顯示 OSRM 路線 polyline

**OSRM API 格式**：
```
GET http://router.project-osrm.org/route/v1/foot/{lng},{lat};{lng},{lat}?overview=full&geometries=geojson
回傳：routes[0].distance（公尺）、routes[0].duration（秒）、routes[0].geometry（GeoJSON）
```

---

### Phase 3 — 地圖互動 UI

**目標**：讓地圖事件有更豐富的視覺回饋。

- [ ] `ui/hud.js`：抽出 HUD 邏輯（目前內嵌於 index.html）
- [ ] `ui/event_card.js`：事件卡片元件化
- [ ] `ui/styles.css`：抽出所有 CSS（目前內嵌於 index.html）
- [ ] Boss 區域動態污染圈效果（CSS animation）
- [ ] 異變進度條：根據玩家附近 Boss 數量自動增長
- [ ] 掃描面板：顯示掃描狀態（API 呼叫中 / 快取命中 / 完成）

---

### Phase 4 — 彈幕戰鬥核心

**目標**：按下事件卡片的「開始戰鬥」後，切換到 Canvas 彈幕場景。

- [ ] `battle/boss.py`：Boss 多階段攻擊定義
  ```python
  BOSS_PATTERNS = {
    "phase1": {"type": "radial", "count": 8,  "speed": 3},
    "phase2": {"type": "spiral", "count": 16, "speed": 5},
    "phase3": {"type": "aimed",  "count": 4,  "speed": 7},
  }
  ```
- [ ] `battle/bullets.py`：彈幕類型（放射狀、螺旋、追蹤、波浪）
- [ ] `battle/collision.py`：圓形 Hitbox，Spatial Grid 分區加速碰撞偵測

- [ ] `ui/battle_canvas.js`：Canvas 主迴圈（requestAnimationFrame）
  ```js
  // 主迴圈架構
  function gameLoop(timestamp) {
    update(dt)    // 更新所有物件位置
    checkCollisions()
    render()      // 清空 Canvas，重繪所有物件
    requestAnimationFrame(gameLoop)
  }
  ```
- [ ] `ui/player.js`：滑鼠控制移動方向，自動射擊，無敵幀
- [ ] `ui/bullets.js`：Object Pool（子彈重用，避免 GC）
- [ ] `ui/enemy.js`：Boss 渲染（多部位 Hitbox）+ 血條
- [ ] `ui/transition.js`：地圖 → 戰鬥畫面切換（fade out/in）

**效能注意事項**：
- 子彈用 Object Pool，不要每幀 `new Bullet()`
- Spatial Grid：把畫面分成 N×N 格，只檢查相鄰格的碰撞
- 彈幕運算考慮用 TypedArray（Float32Array）儲存座標

---

### Phase 5 — 遊戲系統整合

- [ ] `battle/player.py`：玩家屬性（HP、攻擊力、武器槽 ×3）
- [ ] `battle/weapons.py`：武器定義
  ```python
  WEAPONS = {
    "pulse_gun":  {"damage": 10, "fire_rate": 0.5, "pattern": "single"},
    "scatter":    {"damage": 6,  "fire_rate": 0.3, "pattern": "spread_5"},
    "laser":      {"damage": 40, "fire_rate": 2.0, "pattern": "beam"},
  }
  ```
- [ ] `battle/reward.py`：掉落計算（結晶數 = 威脅等級 × 基礎值 + 隨機浮動）
- [ ] `data/shop.json`：商城武器清單（price, name, stats）
- [ ] `ui/shop.js`：商城 UI（顯示武器、扣除結晶、通知背包）
- [ ] `ui/inventory.js`：背包 UI（3 個武器槽，拖曳裝備）
- [ ] 戰鬥結束後：寫入 `data/world.json`，地圖更新 Boss 狀態

---

### Phase 6 — 完整循環潤色

- [ ] `map_system/world_state.py`：管理 `world.json` 的讀寫與事件生命週期
- [ ] `ui/sfx.js`：音效（Web Audio API，不依賴外部音檔）
- [ ] `ui/vfx.js`：視覺特效（Canvas 爆炸粒子、子彈拖尾）
- [ ] 完整遊戲循環測試：地圖 → 戰鬥 → 結算 → 地圖（世界已改變）
- [ ] 效能壓測：同時 200 顆子彈在畫面上的 FPS

---

## 六、快速啟動

```bash
# 安裝
pip install -r requirements.txt

# 啟動
python main.py
# → http://localhost:5000

# 使用流程
# 1. 開啟瀏覽器，預設位置 24.797590°N, 120.995540°E
# 2. 點擊地圖任意位置移動玩家
# 3. 點擊「▶ 開始掃描」載入附近事件
# 4. 點擊地圖上的標記，查看事件卡片
```

---

## 七、已知問題與注意事項

| 問題 | 說明 | 解決方向 |
|---|---|---|
| Overpass 速率限制 | 短時間大量查詢會被 429 | cache.json 已緩解；考慮加 retry + backoff |
| `geocode()` 目前未使用 | Phase 1 移除了地名輸入欄 | Phase 2 可重新在進階設定中開放 |
| Boss 名稱隨機 | 每次開 Popup 重新隨機，重開會不同 | Phase 2 在 generator.py 生成時固定，存入 world.json |
| 掉落結晶純前端計算 | 重新整理頁面後結晶歸零 | Phase 5 存入 localStorage 或 world.json |
| 戰鬥入口是 stub | 點「開始戰鬥」只顯示 toast | Phase 4 實作 Canvas 切換 |

---

## 八、對話參考記錄（決策脈絡）

1. **初始規格**：無伺服器 Web 彈幕遊戲，Nominatim + OSRM + Folium 三層地理整合
2. **架構決定**：Flask 作本地工具，前端分離為 state.js / api.js / map.js
3. **Phase 1 檔案確認**：nominatim.py + main.py + ui/ 四個檔案
4. **UI 修正（本次）**：
   - 預設座標固定為 `24.797590, 120.995540`
   - 定位按鈕預設灰色，按後藍色（toggle GPS watchPosition）
   - GPS 關閉時點地圖任意位置移動玩家，GPS 開啟時鎖定
   - 掃描面板移除地名輸入，座標改為唯讀跟隨玩家
   - 掃描只在按下按鈕時執行，不自動掃描
