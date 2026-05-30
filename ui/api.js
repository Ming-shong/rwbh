/**
 * ui/api.js
 * ---------
 * 前端 API 客戶端：封裝對 Python Flask 後端的所有 fetch 呼叫。
 * 統一處理錯誤、回傳格式。
 */

const API_BASE = "";  // 同源，空字串即可

/**
 * 通用 fetch 封裝。
 * @returns {{ ok: boolean, data?: any, error?: string }}
 */
async function apiFetch(path) {
  try {
    const resp = await fetch(API_BASE + path);
    const json = await resp.json();
    if (!resp.ok || !json.ok) {
      return { ok: false, error: json.error || `HTTP ${resp.status}` };
    }
    return { ok: true, data: json };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * 地名 → 座標
 * @param {string} place
 * @returns {{ ok, data: { lat, lng, display_name } }}
 */
async function apiGeocode(place) {
  return apiFetch(`/api/geocode?place=${encodeURIComponent(place)}`);
}

/**
 * 搜尋附近 POI
 * @param {number} lat
 * @param {number} lng
 * @param {number} radius  (公尺)
 * @returns {{ ok, data: { pois, mob_count, boss_count, total } }}
 */
async function apiScan(lat, lng, radius = 800) {
  return apiFetch(`/api/scan?lat=${lat}&lng=${lng}&radius=${radius}`);
}

/**
 * 取得世界狀態
 */
async function apiWorld() {
  return apiFetch("/api/world");
}

/** 取得收藏列表 */
async function apiFavoritesGet() {
  return apiFetch("/api/favorites");
}

/** 新增收藏 */
async function apiFavoriteAdd(name, lat, lng) {
  try {
    const resp = await fetch("/api/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, lat, lng }),
    });
    const json = await resp.json();
    return { ok: json.ok, data: json };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/** 刪除收藏 */
async function apiFavoriteDelete(id) {
  try {
    const resp = await fetch(`/api/favorites/${id}`, { method: "DELETE" });
    const json = await resp.json();
    return { ok: json.ok };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// 掛到全域，供其他模組使用
window.API = {
  geocode:        apiGeocode,
  scan:           apiScan,
  world:          apiWorld,
  favoritesGet:   apiFavoritesGet,
  favoriteAdd:    apiFavoriteAdd,
  favoriteDelete: apiFavoriteDelete,
};
