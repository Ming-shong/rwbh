/**
 * dev_editor/dev_data.js
 * 預設範例 POI、攻擊 pattern、視覺設定、武器等資料。
 */

window.DEV_POIS = [
  { id:'dev-mob-1',   lat:24.7976, lng:120.9955, name:'污染工廠 Lv.1', type:'mob',  threat:1, mob_count:2 },
  { id:'dev-mob-2',   lat:24.7982, lng:120.9960, name:'感染街區 Lv.2', type:'mob',  threat:2, mob_count:4 },
  { id:'dev-mob-3',   lat:24.7970, lng:120.9948, name:'腐化市場 Lv.3', type:'mob',  threat:3, mob_count:3 },
  { id:'dev-boss-1',  lat:24.7990, lng:120.9940, name:'異變核心 Lv.1', type:'boss', threat:1 },
  { id:'dev-boss-2',  lat:24.7995, lng:120.9965, name:'污染體·巨型 Lv.2', type:'boss', threat:2 },
  { id:'dev-boss-3',  lat:24.8000, lng:120.9950, name:'腐敗領主 Lv.3', type:'boss', threat:3 },
  { id:'dev-boss-4',  lat:24.8005, lng:120.9935, name:'混沌守衛 Lv.4', type:'boss', threat:4 },
  { id:'dev-boss-5',  lat:24.8010, lng:120.9970, name:'終焉使者 Lv.5', type:'boss', threat:5 },
];

window.DEV_DEFAULT_PATTERNS = {
  threat_1: [{ phase:1, type:'radial',  count:6,  speed:2.5, hp_threshold:1.0, fire_interval:60, damage:10, r:6, color:'#ff1a6e', maxLife:260, trajectory:'straight' }],
  threat_2: [{ phase:1, type:'radial',  count:8,  speed:3.0, hp_threshold:1.0, fire_interval:55, damage:10, r:6, color:'#ff1a6e', maxLife:260, trajectory:'straight' },
             { phase:2, type:'aimed',   count:3,  speed:4.5, hp_threshold:0.5, fire_interval:40, damage:16, r:7, color:'#ffaa00', maxLife:320, trajectory:'straight' }],
  threat_3: [{ phase:1, type:'radial',  count:10, speed:3.0, hp_threshold:1.0, fire_interval:50, damage:10, r:6, color:'#ff1a6e', maxLife:260, trajectory:'straight' },
             { phase:2, type:'spiral',  count:3,  speed:4.0, hp_threshold:0.6, fire_interval:35, damage:8,  r:5, color:'#ff6600', maxLife:320, trajectory:'straight' },
             { phase:3, type:'aimed',   count:4,  speed:5.5, hp_threshold:0.3, fire_interval:30, damage:16, r:7, color:'#ffaa00', maxLife:320, trajectory:'straight' }],
  threat_4: [{ phase:1, type:'radial',  count:12, speed:3.5, hp_threshold:1.0, fire_interval:45, damage:10, r:6, color:'#ff1a6e', maxLife:260, trajectory:'straight' },
             { phase:2, type:'spiral',  count:4,  speed:5.0, hp_threshold:0.7, fire_interval:32, damage:8,  r:5, color:'#ff6600', maxLife:320, trajectory:'straight' },
             { phase:3, type:'aimed',   count:5,  speed:6.5, hp_threshold:0.4, fire_interval:28, damage:16, r:7, color:'#ffaa00', maxLife:320, trajectory:'straight' },
             { phase:4, type:'wave',    count:18, speed:4.0, hp_threshold:0.2, fire_interval:50, damage:13, r:6, color:'#aa00ff', maxLife:350, trajectory:'straight' }],
  threat_5: [{ phase:1, type:'radial',  count:14, speed:4.0, hp_threshold:1.0, fire_interval:40, damage:10, r:6, color:'#ff1a6e', maxLife:260, trajectory:'straight' },
             { phase:2, type:'spiral',  count:5,  speed:5.5, hp_threshold:0.75,fire_interval:28, damage:8,  r:5, color:'#ff6600', maxLife:320, trajectory:'straight' },
             { phase:3, type:'aimed',   count:6,  speed:7.0, hp_threshold:0.5, fire_interval:25, damage:16, r:7, color:'#ffaa00', maxLife:320, trajectory:'straight' },
             { phase:4, type:'wave',    count:22, speed:5.0, hp_threshold:0.3, fire_interval:45, damage:13, r:6, color:'#aa00ff', maxLife:350, trajectory:'straight' },
             { phase:5, type:'chaos',   count:16, speed:6.0, hp_threshold:0.15,fire_interval:22, damage:12, r:6, color:'#ff1a6e', maxLife:300, trajectory:'straight' }],
};

window.DEV_DEFAULT_VISUALS = {
  boss: {
    1:{ shape:'diamond', primary_color:'#ff1a6e', spoke_count:6, spoke_color:'#ff1a6e', glow_intensity:50, size_multiplier:1.0, rotation_speed:0.5, core_color_mode:'hp_shift' },
    2:{ shape:'diamond', primary_color:'#ff1a6e', spoke_count:6, spoke_color:'#ff1a6e', glow_intensity:50, size_multiplier:1.0, rotation_speed:0.5, core_color_mode:'hp_shift' },
    3:{ shape:'diamond', primary_color:'#ff1a6e', spoke_count:6, spoke_color:'#ff1a6e', glow_intensity:50, size_multiplier:1.0, rotation_speed:0.5, core_color_mode:'hp_shift' },
    4:{ shape:'diamond', primary_color:'#ff1a6e', spoke_count:8, spoke_color:'#ff1a6e', glow_intensity:60, size_multiplier:1.1, rotation_speed:0.6, core_color_mode:'hp_shift' },
    5:{ shape:'diamond', primary_color:'#ff1a6e', spoke_count:8, spoke_color:'#ff1a6e', glow_intensity:70, size_multiplier:1.2, rotation_speed:0.7, core_color_mode:'hp_shift' },
  },
  mob: {
    1:{ shape:'hexagon', primary_color:'#ff6b35', glow_intensity:24, size_multiplier:1.0, show_hp_bar:true },
    2:{ shape:'hexagon', primary_color:'#ff6b35', glow_intensity:24, size_multiplier:1.0, show_hp_bar:true },
    3:{ shape:'hexagon', primary_color:'#ff6b35', glow_intensity:28, size_multiplier:1.0, show_hp_bar:true },
    4:{ shape:'hexagon', primary_color:'#ff6b35', glow_intensity:32, size_multiplier:1.1, show_hp_bar:true },
    5:{ shape:'hexagon', primary_color:'#ff6b35', glow_intensity:36, size_multiplier:1.2, show_hp_bar:true },
  },
  player:{
    hull_color_mode:'weapon_color', hull_fixed_color:'#00f0ff',
    glow_color:'#00f0ff', cockpit_color:'rgba(0,20,40,0.6)', core_color:'#ffffff',
    thruster_hot_color:'#00f0ff', thruster_cold_color:'#ff6b00',
    shape_preset:'default', glow_intensity:24,
  },
};

window.DEV_DEFAULT_WEAPONS = {
  // ── 主武器 ──
  pulse_gun:    { name:'脈衝槍',   description:'標準單發，射速穩定。入門武器。',      damage:12, fire_rate:7,  pattern:'single',   color:'#00f0ff', price:0,   icon:'▷', bullet_r:3,   bullet_trail_mult:1.0, type:'main' },
  twin:         { name:'雙管炮',   description:'左右雙管同步射擊，覆蓋面積增倍。',    damage:11, fire_rate:9,  pattern:'twin',     color:'#00d4ff', price:80,  icon:'◈', bullet_r:3,   bullet_trail_mult:1.0, type:'main' },
  scatter:      { name:'散彈槍',   description:'五發散射，短程命中率極高。',          damage:7,  fire_rate:14, pattern:'spread_5', color:'#ffaa00', price:120, icon:'⋯', bullet_r:2.5, bullet_trail_mult:0.8, type:'main' },
  rapid:        { name:'速射機槍', description:'射速超高，個別傷害低但累積驚人。',    damage:5,  fire_rate:3,  pattern:'rapid',    color:'#00ff88', price:150, icon:'≡', bullet_r:2,   bullet_trail_mult:0.6, type:'main' },
  laser:        { name:'雷射砲',   description:'貫穿性高能光束，威力強但需蓄力。',    damage:45, fire_rate:30, pattern:'laser',    color:'#ff00ff', price:200, icon:'━', bullet_r:5,   bullet_trail_mult:1.5, type:'main' },
  seeker:       { name:'追蹤導彈', description:'自動追蹤目標，幾乎不會脫靶。',        damage:18, fire_rate:22, pattern:'seek',     color:'#ff6b35', price:300, icon:'◎', bullet_r:4,   bullet_trail_mult:2.0, type:'main' },
  // ── 副武器 ──
  side_cannons: { name:'側翼砲台', description:'裝備在左右兩側，自動向前方補充火力。', damage:8,  fire_rate:12, pattern:'single',   color:'#88ddff', price:100, icon:'⊲', bullet_r:3,   bullet_trail_mult:1.0, type:'sub', sub_position:{type:'both_sides', dist:28} },
  rear_turret:  { name:'後方砲台', description:'裝備在後方，自動向後方掃射覆蓋盲區。', damage:10, fire_rate:18, pattern:'spread_5', color:'#ff8855', price:180, icon:'▽', bullet_r:2.5, bullet_trail_mult:0.8, type:'sub', sub_position:{type:'angle', angle:180, dist:20} },
};

window.DEV_DEFAULT_BALANCE = {
  difficulty:{ preset:'normal', enemy_speed_mult:1.0, enemy_hp_mult:1.0, enemy_damage_mult:1.0 },
  crystals:  { base:{1:8,2:18,3:35,4:70,5:140}, variance:0.4, speed_bonus_mult:2.0, no_damage_mult:1.5 },
  anomaly_per_boss:{1:4,2:8,3:12,4:16,5:20},
  triple_shot_threshold:30,
};

window.DEV_DEFAULT_LORE = {
  boss_names:['異變核心','污染體·巨型','腐敗領主','混沌守衛','終焉使者'],
  mob_prefixes:['污染體','異變體','腐化生物','感染者','潛伏者'],
  phase_lines:{ '2':['目標已識別，切換攻擊模式。','有趣的抵抗。'], '3':['無謂的掙扎。','你已無路可退。'] },
  victory_lines:['異變源已清除。','地區污染等級下降。'],
  defeat_lines: ['玩家已被同化。','下次帶更好的武器來。'],
  game_title:'R·W·B·H',
};

window.DEV_DEFAULT_MECHANICS = {
  player:{ max_hp:100, inv_frames:90, player_radius:8, move_smoothing:0.14, base_atk:12, fire_rate:7, bullet_speed_mult:1.0, damage_reduction:0, start_crystals:0 },
  skills:{ dash:{enabled:false,distance:120,inv_frames:20,cooldown_s:1.5}, shield:{enabled:false,radius:40,max_frames:60,cost_crystals:5,deflect:true}, bomb:{enabled:false,cooldown_s:8,cost_crystals:20} },
  aim_assist_deg:0, combo:{enabled:false,threshold:10,multiplier:1.5},
};

window.DEV_DEFAULT_WORLD = {
  poi_categories:[
    {tag:'amenity=convenience_store',label:'便利商店',type:'mob', threat:1},
    {tag:'amenity=fast_food',        label:'速食店',  type:'mob', threat:1},
    {tag:'amenity=restaurant',       label:'餐廳',    type:'mob', threat:1},
    {tag:'amenity=cafe',             label:'咖啡廳',  type:'mob', threat:1},
    {tag:'amenity=pharmacy',         label:'藥局',    type:'mob', threat:2},
    {tag:'amenity=bank',             label:'銀行',    type:'mob', threat:2},
    {tag:'amenity=police',           label:'警察局',  type:'mob', threat:2},
    {tag:'leisure=park',             label:'公園',    type:'boss',threat:3},
    {tag:'amenity=school',           label:'學校',    type:'boss',threat:3},
    {tag:'amenity=university',       label:'大學',    type:'boss',threat:4},
    {tag:'amenity=hospital',         label:'醫院',    type:'boss',threat:4},
    {tag:'railway=station',          label:'車站',    type:'boss',threat:5},
    {tag:'shop=mall',                label:'商場',    type:'boss',threat:4},
    {tag:'amenity=bus_station',      label:'公車站',  type:'boss',threat:3},
  ],
  battle_range:{base:50,per_threat:25},
  scan_radius_default:800, dedup_distance_m:25, cache_ttl_s:3600, max_walk_minutes:20,
};
