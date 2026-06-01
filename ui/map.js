/**
 * ui/map.js
 * Leaflet 地圖邏輯（Phase 2–6 + 即時距離/路線更新）。
 */

const THREAT_LABELS = ["", "低", "低", "中", "高", "極危"];
const THREAT_COLORS = ["", "#00ff88", "#00ff88", "#ffaa00", "#ff6b35", "#ff1a6e"];


const INIT_LAT = 24.797590;
const INIT_LNG = 120.995540;

// ── 地圖初始化 ──────────────────────────────────────────────────────────────
const map = L.map("map", {
  center: [INIT_LAT, INIT_LNG],
  zoom: 16,
  zoomControl: true,
  attributionControl: false,
});
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);

map.on("mousemove", e => {
  document.getElementById("coord-lat").textContent = "LAT " + e.latlng.lat.toFixed(5);
  document.getElementById("coord-lng").textContent = "LNG " + e.latlng.lng.toFixed(5);
});
map.on("click", e => {
  if (window.GPS_ACTIVE) return;
  STATE.setPlayerPos(e.latlng.lat, e.latlng.lng);
  // 玩家移動後清除所有路線
  _clearAllRoutes();
});

// ── 玩家標記 ────────────────────────────────────────────────────────────────
function makePlayerIcon() {
  return L.divIcon({
    className: "",
    html: `<div class="player-dot"><div class="player-core"></div></div>`,
    iconSize: [20, 20], iconAnchor: [10, 10],
  });
}
let playerMarker = L.marker([INIT_LAT, INIT_LNG], { icon: makePlayerIcon() }).addTo(map);
let playerPulse  = L.circle([INIT_LAT, INIT_LNG], {
  radius: 60, color: "rgba(0,240,255,.25)",
  fillColor: "rgba(0,240,255,.04)", weight: 1, fillOpacity: 1,
}).addTo(map);

function movePlayer(lat, lng) {
  playerMarker.setLatLng([lat, lng]);
  playerPulse.setLatLng([lat, lng]);
}

// ── 距離工具 ────────────────────────────────────────────────────────────────
function _haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── POI 資料 ────────────────────────────────────────────────────────────────
let poiMarkers     = [];
let anomalyCircles = [];
const routePolylineMap = {}; // poiId → Leaflet polyline
let scanRing       = null;

// poiId → 完整資料
const poiDataMap = {};

// ── 收藏地點標記 ─────────────────────────────────────────────────────────────
const favMarkers = {}; // favId → Leaflet marker

function makeFavoriteIcon(name) {
  return L.divIcon({
    className: "",
    html: `<div class="fav-marker" title="${name}">★</div>`,
    iconSize: [24, 24], iconAnchor: [12, 12],
  });
}

function addFavoriteMarker(fav) {
  if (favMarkers[fav.id]) map.removeLayer(favMarkers[fav.id]);
  const m = L.marker([fav.lat, fav.lng], { icon: makeFavoriteIcon(fav.name), zIndexOffset: 500 })
    .bindTooltip(fav.name, { permanent: false, direction: 'top', className: 'fav-tooltip' })
    .addTo(map);
  favMarkers[fav.id] = m;
}

function removeFavoriteMarker(favId) {
  if (favMarkers[favId]) {
    map.removeLayer(favMarkers[favId]);
    delete favMarkers[favId];
  }
}

function renderFavorites(favs) {
  // 清除舊標記
  Object.values(favMarkers).forEach(m => map.removeLayer(m));
  Object.keys(favMarkers).forEach(k => delete favMarkers[k]);
  // 繪製新標記
  favs.forEach(f => addFavoriteMarker(f));
}

// 雙擊地圖快速收藏
map.on('dblclick', e => {
  if (window.GPS_ACTIVE) return;
  e.originalEvent.preventDefault();
  const name = prompt('收藏名稱（如：家）：');
  if (!name?.trim()) return;
  API.favoriteAdd(name.trim(), e.latlng.lat, e.latlng.lng).then(result => {
    if (result.ok) {
      addFavoriteMarker(result.data.favorite);
      // 更新面板列表
      API.favoritesGet().then(r => {
        if (r.ok) {
          const { renderFavorites: rf } = window._favPanelFns || {};
          rf?.(r.data.favorites);
        }
      });
      window.HUD?.toast(`★ 已收藏「${name.trim()}」`, 2000);
    }
  });
});

// 目前開啟的 popup 所對應的 marker（供即時更新）
let _openPopupMarker = null;
let _openPopupPoi    = null;

function clearPOIMarkers() {
  poiMarkers.forEach(m => map.removeLayer(m));
  anomalyCircles.forEach(c => map.removeLayer(c));
  Object.values(routePolylineMap).forEach(p => map.removeLayer(p));
  if (scanRing) { map.removeLayer(scanRing); scanRing = null; }
  poiMarkers = []; anomalyCircles = [];
  Object.keys(routePolylineMap).forEach(k => delete routePolylineMap[k]);
}

// ── Icon 工廠 ───────────────────────────────────────────────────────────────
function makeMobIcon(threat, defeated) {
  const s = 10 + threat * 2;
  const color  = defeated ? '#4a6080' : 'rgba(255,107,53,.25)';
  const border = defeated ? '#4a6080' : 'var(--mob)';
  const glow   = defeated ? 'none' : `0 0 ${s}px rgba(255,107,53,.7)`;
  return L.divIcon({
    className: "",
    html: `<div class="mob-marker" style="width:${s}px;height:${s}px;background:${color};border-color:${border};box-shadow:${glow};opacity:${defeated ? 0.45 : 1}"></div>`,
    iconSize: [s, s], iconAnchor: [s / 2, s / 2],
  });
}
function makeBossIcon(threat, defeated) {
  const s = 18 + threat * 4;
  const color  = defeated ? 'rgba(74,96,128,.2)' : 'rgba(255,26,110,.2)';
  const border = defeated ? '#4a6080' : 'var(--boss)';
  const glow   = defeated ? 'none' : `0 0 ${s * 1.2}px rgba(255,26,110,.8)`;
  return L.divIcon({
    className: "",
    html: `<div class="boss-marker" style="width:${s}px;height:${s}px;background:${color};border-color:${border};box-shadow:${glow};opacity:${defeated ? 0.4 : 1}"></div>`,
    iconSize: [s, s], iconAnchor: [s / 2, s / 2],
  });
}

// ── Popup HTML（使用當前玩家位置計算即時距離）──────────────────────────────
function buildPopupHTML(poi) {
  const isBoss     = poi.type === "boss";
  const threat     = poi.effective_threat || poi.threat;
  const color      = THREAT_COLORS[threat] || "#888";
  const displayName = isBoss ? (poi.boss_name || poi.name) : (poi.mob_name || poi.name);
  const defeated   = poi.defeated;

  // 從玩家當前 state 即時計算距離
  const liveDist = (STATE.player.lat && STATE.player.lng)
    ? Math.round(_haversine(STATE.player.lat, STATE.player.lng, poi.lat, poi.lng))
    : (poi.distance_m ?? null);

  // 步行時間估算（依即時距離）
  const walkMin = liveDist != null
    ? `${(liveDist / 80).toFixed(1)} 分鐘`
    : "—";

  const battleRange = 50 + threat * 25;
  const tooFar = isBoss && !defeated && liveDist != null && liveDist > battleRange;

  const battleBtn = defeated
    ? `<div class="card-btn ${isBoss ? 'boss-btn' : 'mob-btn'}" style="opacity:.4;cursor:default;pointer-events:none">✓ 已擊敗</div>`
    : isBoss
      ? `<button class="card-btn boss-btn" ${tooFar ? 'style="opacity:.5"' : ''} onclick="window.MAP.onBattle('${poi.id}')">
           ${tooFar ? `📍 需接近 ${battleRange}m 內（距 ${liveDist}m）` : '⚔ 挑戰 Boss'}
         </button>`
      : `<button class="card-btn mob-btn" onclick="window.MAP.onBattle('${poi.id}')">▶ 開始戰鬥</button>`;

  return `
<div class="event-card">
  <div class="card-badge ${poi.type}">${defeated ? "✓ 已擊敗" : (isBoss ? "BOSS EVENT" : "MOB EVENT")}</div>
  <div class="card-name" style="color:${color}">${displayName}</div>

  <!-- 地點資訊區（藍色風格） -->
  <div style="background:rgba(30,144,255,.08);border:1px solid rgba(30,144,255,.35);border-radius:4px;padding:7px 10px;margin-bottom:8px;color:#7ec8ff">
    <div style="font-size:8px;color:rgba(30,144,255,.7);letter-spacing:1px;margin-bottom:5px">📍 地點資訊</div>
    <div class="card-row"><span class="ck" style="color:rgba(30,144,255,.6)">地標</span><span class="cv" style="color:#7ec8ff;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${poi.name}">${poi.name}</span></div>
    <div class="card-row"><span class="ck" style="color:rgba(30,144,255,.6)">類型</span><span class="cv" style="color:#7ec8ff">${poi.category}</span></div>
    <div class="card-row"><span class="ck" style="color:rgba(30,144,255,.6)">距離</span><span class="cv" style="color:#7ec8ff">${liveDist ?? "—"} m</span></div>
    <div class="card-row"><span class="ck" style="color:rgba(30,144,255,.6)">步行</span><span class="cv" style="color:#7ec8ff">🚶 ${walkMin}</span></div>
  </div>

  <!-- 戰鬥資訊區 -->
  <div class="card-stats">
    <div style="font-size:8px;color:var(--muted);letter-spacing:1px;margin-bottom:5px">⚔ 戰鬥資訊</div>
    <div class="card-row"><span class="ck">危險</span><span class="cv" style="color:${color}">■ ${THREAT_LABELS[threat] ?? "?"} (Lv.${threat})</span></div>
    ${isBoss
      ? `<div class="card-row"><span class="ck">Boss HP</span><span class="cv">${poi.boss_hp ?? "—"}</span></div>`
      : `<div class="card-row"><span class="ck">小怪數量</span><span class="cv">${poi.mob_count ?? "—"} 隻</span></div>`}
    <div class="card-row"><span class="ck">掉落</span><span class="cv">◈ ×${poi.crystal_drop ?? (threat * 5)}</span></div>
  </div>
  ${battleBtn}
</div>`;
}

// ── 渲染 POI ────────────────────────────────────────────────────────────────
function renderPOIs(pois, centerLat, centerLng, radius) {
  clearPOIMarkers();

  scanRing = L.circle([centerLat, centerLng], {
    radius, color: "rgba(0,240,255,.15)",
    fillColor: "transparent", weight: 1, dashArray: "5,5",
  }).addTo(map);

  pois.forEach(poi => {
    poiDataMap[poi.id] = poi;

    const defeated = !!poi.defeated;
    const threat   = poi.effective_threat || poi.threat;
    const icon = poi.type === "boss"
      ? makeBossIcon(threat, defeated)
      : makeMobIcon(threat, defeated);

    const marker = L.marker([poi.lat, poi.lng], { icon }).addTo(map);
    marker.bindPopup(buildPopupHTML(poi), { maxWidth: 290, minWidth: 250 });
    // 儲存 poiId 在 marker 上，方便反查
    marker._poiId = poi.id;
    poiMarkers.push(marker);

    if (poi.type === "boss" && !defeated) {
      const ac = L.circle([poi.lat, poi.lng], {
        radius: 50 + threat * 25,
        color: "rgba(255,26,110,.4)", fillColor: "rgba(255,26,110,.04)",
        weight: 1, fillOpacity: 1, dashArray: "4,4",
        className: "boss-anomaly-circle",
      }).addTo(map);
      anomalyCircles.push(ac);
    }
  });
}

// ── 路線 polyline 管理 ───────────────────────────────────────────────────────
function _setRoutePolyline(poiId, geometry) {
  if (routePolylineMap[poiId]) map.removeLayer(routePolylineMap[poiId]);
  if (!geometry) { delete routePolylineMap[poiId]; return; }
  const coords = geometry.coordinates.map(([lng, lat]) => [lat, lng]);
  routePolylineMap[poiId] = L.polyline(coords, {
    color: "rgba(30,144,255,.75)", weight: 3, dashArray: "6,4",
  }).addTo(map);
}

// ── 即時路線更新（debounce，玩家移動後自動重新抓 Boss 路線）───────────────
let _routeUpdateTimer = null;
let _lastRoutePos     = null;

async function _updateBossRoutes(lat, lng) {
  const bossIds = Object.keys(poiDataMap).filter(id => {
    const p = poiDataMap[id];
    return p.type === 'boss' && !p.defeated;
  });

  for (const id of bossIds) {
    const poi = poiDataMap[id];
    try {
      const resp = await fetch(
        `/api/route?lat1=${lat}&lng1=${lng}&lat2=${poi.lat}&lng2=${poi.lng}`
      );
      const data = await resp.json();
      if (data.ok && data.geometry) {
        poi.route_geometry = data.geometry;
        _setRoutePolyline(id, data.geometry);
      }
    } catch (_) { /* 靜默失敗 */ }
  }
}

// ── 即時 Popup 更新（玩家移動時重新渲染已開啟的 popup）─────────────────────
map.on('popupopen', async e => {
  const marker = e.popup._source;
  if (!marker?._poiId) return;
  const poi = poiDataMap[marker._poiId];
  if (!poi) return;
  _openPopupMarker = marker;
  _openPopupPoi    = poi;
  // 用當前玩家位置刷新 popup 內容
  marker.setPopupContent(buildPopupHTML(poi));

  // 將 popup 推到路線的對面，避免遮住路線（同時隱藏錯位的 tip）
  if (STATE.player.lng != null) {
    const offsetX = STATE.player.lng < poi.lng ? 155 : -155;
    e.popup.options.offset = L.point(offsetX, -10);
    e.popup.update();
    // 直接隱藏 DOM 中的 tip（等 DOM 更新後再操作）
    requestAnimationFrame(() => {
      const tipEl = e.popup.getElement()?.querySelector('.leaflet-popup-tip-container');
      if (tipEl) tipEl.style.display = 'none';
    });
  }

  // 抓取並繪製路線（Boss 和小怪都畫，已擊敗的跳過）
  if (!poi.defeated && STATE.player.lat && STATE.player.lng) {
    try {
      const resp = await fetch(
        `/api/route?lat1=${STATE.player.lat}&lng1=${STATE.player.lng}&lat2=${poi.lat}&lng2=${poi.lng}`
      );
      const data = await resp.json();
      if (data.ok && data.geometry) {
        poi.route_geometry = data.geometry;
        _setRoutePolyline(poi.id, data.geometry);
      }
    } catch (_) { /* 靜默失敗 */ }
  }
});

map.on('popupclose', e => {
  // 移除目前顯示的路線
  if (_openPopupPoi && routePolylineMap[_openPopupPoi.id]) {
    map.removeLayer(routePolylineMap[_openPopupPoi.id]);
    delete routePolylineMap[_openPopupPoi.id];
  }
  // 重置 tip 與 offset，下次開啟重新計算
  if (e.popup) {
    e.popup.options.offset = L.point(0, -10);
    const tipEl = e.popup.getElement()?.querySelector('.leaflet-popup-tip-container');
    if (tipEl) tipEl.style.display = '';
  }
  _openPopupMarker = null;
  _openPopupPoi    = null;
});

// ── 戰鬥觸發 ────────────────────────────────────────────────────────────────
function onBattle(poiId) {
  const poi = poiDataMap[poiId];
  if (!poi) { window.HUD?.toast("找不到事件資料"); return; }
  if (poi.defeated) { window.HUD?.toast("此事件已擊敗"); return; }
  if (STATE.player.hp <= 0) {
    window.HUD?.toast('HP 為零，無法出戰！', 2000);
    window.showRevivalModal?.();
    return;
  }

  const dist = _haversine(STATE.player.lat, STATE.player.lng, poi.lat, poi.lng);

  if (poi.type === 'boss') {
    const threat      = poi.effective_threat || poi.threat;
    const battleRange = 50 + threat * 25;
    if (dist > battleRange) {
      window.HUD?.toast(
        `距離太遠！需進入紅色圓圈（${battleRange}m），目前 ${Math.round(dist)}m`,
        3200
      );
      return;
    }
  } else if (window.GPS_ACTIVE) {
    const PULSE_R = 60; // 藍圈半徑（與 playerPulse radius 一致）
    if (dist > PULSE_R) {
      window.HUD?.toast(`需在藍色範圍內（${PULSE_R}m），目前 ${Math.round(dist)}m`, 2800);
      return;
    }
  }

  map.closePopup();
  TRANSITION.toBattle(poi);
}

// ── 對外 API ────────────────────────────────────────────────────────────────
window.MAP = {
  map, movePlayer, renderPOIs, clearPOIMarkers, onBattle,
  addFavoriteMarker, removeFavoriteMarker, renderFavorites,
};

// ── STATE 事件監聽 ───────────────────────────────────────────────────────────

document.addEventListener("playerMoved", e => {
  const { lat, lng } = e.detail;
  movePlayer(lat, lng);
  if (window.GPS_ACTIVE) map.flyTo([lat, lng], 16, { duration: 1.0 });

  // 即時更新已開啟 popup 的距離/按鈕狀態
  if (_openPopupMarker && _openPopupPoi) {
    _openPopupMarker.setPopupContent(buildPopupHTML(_openPopupPoi));
  }

  // 路線更新：只在 Popup 開啟時才更新，移動 > 80m 才重新查詢（debounce 1.5s）
  if (!_openPopupPoi) return;
  if (_lastRoutePos) {
    const moved = _haversine(lat, lng, _lastRoutePos.lat, _lastRoutePos.lng);
    if (moved < 80) return;
  }
  clearTimeout(_routeUpdateTimer);
  _routeUpdateTimer = setTimeout(async () => {
    _lastRoutePos = { lat, lng };
    if (!_openPopupPoi || _openPopupPoi.defeated) return;
    try {
      const resp = await fetch(
        `/api/route?lat1=${lat}&lng1=${lng}&lat2=${_openPopupPoi.lat}&lng2=${_openPopupPoi.lng}`
      );
      const data = await resp.json();
      if (data.ok && data.geometry) {
        _openPopupPoi.route_geometry = data.geometry;
        _setRoutePolyline(_openPopupPoi.id, data.geometry);
        _openPopupMarker?.setPopupContent(buildPopupHTML(_openPopupPoi));
      }
    } catch (_) { /* 靜默失敗 */ }
  }, 1500);
});

document.addEventListener("poisUpdated", e => {
  const { lat, lng } = STATE.player;
  const radius = parseInt(document.getElementById("input-radius")?.value) || 800;
  renderPOIs(e.detail.pois, lat, lng, radius);
});

document.addEventListener("poiDefeated", e => {
  const poi = poiDataMap[e.detail.poiId];
  if (!poi) return;
  // 移除路線
  if (routePolylineMap[poi.id]) {
    map.removeLayer(routePolylineMap[poi.id]);
    delete routePolylineMap[poi.id];
  }
  // 更新標記
  poiMarkers.forEach(m => {
    if (m._poiId !== poi.id) return;
    const defeated = true;
    m.setIcon(poi.type === "boss"
      ? makeBossIcon(poi.effective_threat || poi.threat, defeated)
      : makeMobIcon(poi.effective_threat  || poi.threat, defeated));
    m.setPopupContent(buildPopupHTML(poi));
  });
});

// ── 清除所有路線（供外部呼叫）────────────────────────────────────────────────
async function _refreshOpenPopupRoute() {
  if (!_openPopupPoi || !STATE.player.lat) return;
  const poi = _openPopupPoi;
  _openPopupMarker?.setPopupContent(buildPopupHTML(poi));
  try {
    const r = await fetch(`/api/route?lat1=${STATE.player.lat}&lng1=${STATE.player.lng}&lat2=${poi.lat}&lng2=${poi.lng}`);
    const d = await r.json();
    if (d.ok && d.geometry) _setRoutePolyline(poi.id, d.geometry);
  } catch(_) {}
}
window.MAP.refreshOpenPopupRoute = _refreshOpenPopupRoute;

function _clearAllRoutes() {
  // 清除 POI 路線
  Object.values(routePolylineMap).forEach(p => map.removeLayer(p));
  Object.keys(routePolylineMap).forEach(k => delete routePolylineMap[k]);
  _openPopupMarker = null;
  _openPopupPoi    = null;
  // 清除飛往目的地路線（由 index.html 管理）
  if (window._destRoutePolyline) {
    map.removeLayer(window._destRoutePolyline);
    window._destRoutePolyline = null;
  }
}
window.MAP.clearAllRoutes = _clearAllRoutes;
