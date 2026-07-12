/* =========================================================
   Word Match Puzzle - Game Logic
   ระบบ: จับคู่คำศัพท์ + Login (ชื่อ+PIN ผ่าน Supabase) + XP/Level + Rank
   ========================================================= */

(() => {
  'use strict';

  // ---------- Supabase config ----------
  // หมายเหตุ: อ้างอิงจากค่าที่ให้มา "pwrhnmvhwhellfbznczb" เป็นรูปแบบ Project ID
  // มาตรฐานของ Supabase (ใช้ประกอบ URL ได้ตรง) จึงใช้ค่านี้สร้าง Project URL
  // ถ้าไม่ตรงกับของจริงในหน้า Settings > API ของโปรเจกต์ ให้แก้ 2 ค่านี้ได้เลย
  const SUPABASE_URL = 'https://pwrhnmvhwhellfbznczb.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_zmIZ9aucZsRMJrySDe0uIQ_W4OgndeO';

  const WORDS_PER_GAME = 10;
  const POINTS_PER_CORRECT = 10;
  const DRAG_THRESHOLD_PX = 12;
  const SESSION_KEY = 'wp_session';
  const GUEST_KEY = 'wp_guest_progress';

  // ---------- ระบบหมวดคำศัพท์: ธรรมดา / พิเศษ (TOEFL,IELTS) / บอส (TOEIC) ----------
  const BOSS_MULTIPLIERS = [1.5, 2, 2.5, 3]; // คอมโบตอบถูกคำบอสติดกันครั้งที่ 1,2,3,4+
  const MISSED_KEY_PREFIX = 'wp_missed_';
  const GUEST_STATS_KEY = 'wp_guest_stats';

  // ---------- ระบบ Achievement (เหรียญตรา) ----------
  const ACHIEVEMENTS = [
    { id: 'first_game',   icon: '🎮', title: 'ก้าวแรก',           desc: 'เล่นเกมจบครั้งแรก',                          check: (s) => s.games_played >= 1 },
    { id: 'perfect_1',    icon: '🌟', title: 'สมบูรณ์แบบ',        desc: 'ได้ Perfect Score (ไม่พลาดเลย) 1 ครั้ง',       check: (s) => s.perfect_games >= 1 },
    { id: 'perfect_5',    icon: '💎', title: 'มือโปร',            desc: 'ได้ Perfect Score สะสม 5 ครั้ง',              check: (s) => s.perfect_games >= 5 },
    { id: 'games_10',     icon: '🏃', title: 'ขยันเล่น',          desc: 'เล่นครบ 10 เกม',                              check: (s) => s.games_played >= 10 },
    { id: 'games_50',     icon: '🏆', title: 'นักฝึกฝนตัวยง',      desc: 'เล่นครบ 50 เกม',                              check: (s) => s.games_played >= 50 },
    { id: 'boss_slayer',  icon: '👑', title: 'ผู้พิชิตบอส',        desc: 'ตอบคำบอส (TOEIC) ถูกสะสม 20 คำ',              check: (s) => s.boss_correct >= 20 },
    { id: 'boss_master',  icon: '🔥', title: 'เจ้าบอส TOEIC',      desc: 'ตอบคำบอส (TOEIC) ถูกสะสม 100 คำ',             check: (s) => s.boss_correct >= 100 },
    { id: 'combo_king',   icon: '⚡', title: 'สายคอมโบ',          desc: 'ทำคอมโบคูณคะแนนสูงสุด x3 ได้ในเกมเดียว',      check: (s) => s.best_combo >= 3 },
    { id: 'scholar',      icon: '📚', title: 'นักวิชาการ',         desc: 'ตอบคำพิเศษ (TOEFL/IELTS) ถูกสะสม 50 คำ',      check: (s) => s.special_correct >= 50 },
    { id: 'speed_runner', icon: '⏱️', title: 'สายฟ้าแลบ',         desc: 'จบเกมภายใน 30 วินาที',                        check: (s) => s.fastest_time != null && s.fastest_time <= 30 },
    { id: 'sunday_warrior', icon: '🎪', title: 'นักล่าบอสวันอาทิตย์', desc: 'เล่นในวัน Sunday Boss Rush อย่างน้อย 1 ครั้ง', check: (s) => s.sunday_games >= 1 },
    { id: 'level_5',      icon: '🥉', title: 'เลเวล 5',           desc: 'ไต่ระดับถึงเลเวล 5',                          check: (s, level) => level >= 5 },
    { id: 'level_10',     icon: '🥈', title: 'เลเวล 10',          desc: 'ไต่ระดับถึงเลเวล 10',                         check: (s, level) => level >= 10 },
    { id: 'level_20',     icon: '🥇', title: 'เลเวล 20',          desc: 'ไต่ระดับถึงเลเวล 20',                         check: (s, level) => level >= 20 }
  ];

  const SPEAKER_SVG = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`;

  // ---------- Supabase client ----------
  let sb = null;
  function initSupabaseClient() {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      try {
        sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      } catch (e) {
        console.warn('⚠️ สร้าง Supabase client ไม่สำเร็จ:', e);
        sb = null;
      }
    } else {
      console.warn('⚠️ โหลด Supabase client ไม่สำเร็จ (อาจเป็นเพราะเน็ตหลุด) - จะเล่นได้เฉพาะโหมด Guest');
    }
  }

  // ---------- State ----------
  const state = {
    allWords: [],
    currentWords: [],
    rightOrder: [],
    matched: new Map(),
    wrongCount: 0,
    wrongWordsList: [],
    score: 0,
    bossStreak: 0,
    bossCorrectCount: 0,
    specialCorrectCount: 0,
    bestBossMultiplierThisGame: 0,
    isSundayBoss: false,
    startTime: 0,
    timerInterval: null,
    gameDateTime: null,
    gameResults: [],

    currentUser: null, // {id, name, pin, level, xp}
    isGuest: false,

    // pointer/drag tracking
    pointerId: null,
    isPointerDown: false,
    isDragging: false,
    dragStartId: null,
    dragStartEl: null,
    drawingLine: null,
    startX: 0,
    startY: 0
  };

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const screens = {
    auth:   $('screen-auth'),
    start:  $('screen-start'),
    learn:  $('screen-learn'),
    game:   $('screen-game'),
    result: $('screen-result'),
    achievements: $('screen-achievements'),
    profile: $('screen-profile')
  };
  const dom = {
    // auth
    authName:        $('auth-name'),
    authPin:         $('auth-pin'),
    authError:       $('auth-error'),
    btnAuthSubmit:   $('btn-auth-submit'),
    btnAuthGuest:    $('btn-auth-guest'),

    // start / topbar
    startUserName:   $('start-user-name'),
    startLevelBadge: $('start-level-badge'),
    startXpFill:     $('start-xp-fill'),
    startXpCaption:  $('start-xp-caption'),
    btnLogout:       $('btn-logout'),
    btnStart:        $('btn-start'),
    startAchvCount:  $('start-achv-count'),
    leaderboardStartList: $('leaderboard-start-list'),
    bossBannerStart: $('boss-banner-start'),

    // achievements
    achievementsGrid: $('achievements-grid'),
    btnAchievementsBack: $('btn-achievements-back'),

    // profile
    userChip:          $('user-chip'),
    profileAvatar:     $('profile-avatar'),
    profileName:       $('profile-name'),
    profileLevelBadge: $('profile-level-badge'),
    profileXpFill:     $('profile-xp-fill'),
    profileXpCaption:  $('profile-xp-caption'),
    profileStatsGrid:  $('profile-stats-grid'),
    profileHistoryList: $('profile-history-list'),
    btnProfileBack:    $('btn-profile-back'),

    // learn
    btnGoGame:       $('btn-go-game'),
    learnList:       $('learn-list'),

    // game
    timer:           $('timer'),
    score:           $('score'),
    progress:        $('progress'),
    comboChip:       $('combo-chip'),
    leftList:        $('left-list'),
    rightList:       $('right-list'),
    linesSvg:        $('lines-svg'),
    gameArea:        $('game-area'),

    // result
    resultTitle:     $('result-title'),
    resultDateTime:  $('result-datetime-text'),
    levelUpBanner:   $('level-up-banner'),
    levelUpValue:    $('level-up-value'),
    xpGainBanner:    $('xp-gain-banner'),
    xpGainValue:     $('xp-gain-value'),
    finalScore:      $('final-score'),
    totalScore:      $('total-score'),
    correctCount:    $('correct-count'),
    wrongCount:      $('wrong-count'),
    finalTime:       $('final-time'),
    myRankLine:      $('my-rank-line'),
    achvUnlockBanner: $('achv-unlock-banner'),
    resultAchvCount: $('result-achv-count'),
    leaderboardResultList: $('leaderboard-result-list'),
    wordReviewList:  $('word-review-list'),
    btnRestart:      $('btn-restart'),
    btnHome:         $('btn-home'),
    btnShare:        $('btn-share')
  };

  // ---------- Utility ----------
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function formatTime(seconds) {
    const m = String(Math.floor(seconds / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  function formatDateTime(date) {
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };
    return date.toLocaleDateString('th-TH', options);
  }

  function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str ?? '');
    return div.innerHTML;
  }

  // =========================================================
  // ---------- XP / Level system ----------
  // เลเวล N ต้องใช้ XP สะสม 100*N คะแนนถึงจะขึ้นเลเวลถัดไป (ยิ่งเลเวลสูงยิ่งใช้ XP เยอะขึ้น)
  // =========================================================
  function xpNeededForLevel(level) {
    return 100 * level;
  }

  function totalXpAtLevelStart(level) {
    let sum = 0;
    for (let i = 1; i < level; i++) sum += xpNeededForLevel(i);
    return sum;
  }

  function levelFromXp(xp) {
    let level = 1;
    while (xp >= totalXpAtLevelStart(level + 1)) level++;
    return level;
  }

  function xpProgress(xp) {
    const level = levelFromXp(xp);
    const start = totalXpAtLevelStart(level);
    const next = totalXpAtLevelStart(level + 1);
    const current = xp - start;
    const needed = next - start;
    return { level, current, needed, percent: needed > 0 ? Math.min(100, Math.round((current / needed) * 100)) : 100 };
  }

  function calcXpEarned(score, wrongCount, elapsedSeconds) {
    let xp = score;
    if (wrongCount === 0) xp += 30; // โบนัสไม่ตอบผิดเลย
    if (elapsedSeconds <= 45) xp += 20; // โบนัสเร็ว
    return xp;
  }

  // ---------- Load Words ----------
  async function loadWords() {
    try {
      const res = await fetch('data/words.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('โหลดคำศัพท์ไม่สำเร็จ');
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) throw new Error('รูปแบบข้อมูลคำศัพท์ไม่ถูกต้อง');
      state.allWords = data;
      console.log(`✅ โหลดคำศัพท์สำเร็จ: ${data.length} คำ`);
    } catch (err) {
      console.error('❌ Error loading words:', err);
      alert('❌ ไม่สามารถโหลดข้อมูลคำศัพท์ได้\nกรุณาตรวจสอบไฟล์ data/words.json');
    }
  }

  // =========================================================
  // ---------- Auth (Supabase: users table, name+pin) ----------
  // =========================================================
  function saveSession(user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ id: user.id, name: user.name }));
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  async function restoreSession() {
    if (!sb) return null;
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      const { id } = JSON.parse(raw);
      const { data, error } = await sb.from('users').select('*').eq('id', id).maybeSingle();
      if (error || !data) { clearSession(); return null; }
      return data;
    } catch (e) {
      return null;
    }
  }

  async function loginOrRegister(name, pin) {
    if (!sb) return { error: 'offline' };
    try {
      const { data: existing, error } = await sb.from('users').select('*').eq('name', name).maybeSingle();
      if (error) return { error: 'network' };

      if (existing) {
        if (existing.pin !== pin) return { error: 'wrong_pin' };
        return { user: existing };
      }

      const { data: created, error: insErr } = await sb.from('users').insert({ name, pin }).select().single();
      if (insErr) return { error: 'network' };
      return { user: created, isNew: true };
    } catch (e) {
      return { error: 'network' };
    }
  }

  function loadGuestProgress() {
    try {
      const parsed = JSON.parse(localStorage.getItem(GUEST_KEY));
      return parsed && typeof parsed.xp === 'number' ? parsed : { xp: 0 };
    } catch (e) {
      return { xp: 0 };
    }
  }

  function saveGuestProgress(xp) {
    localStorage.setItem(GUEST_KEY, JSON.stringify({ xp }));
  }

  // ---------- Leaderboard ----------
  async function fetchLeaderboard(limit = 10) {
    if (!sb) return [];
    const { data, error } = await sb.from('users').select('id,name,level,xp,stats').order('xp', { ascending: false }).limit(limit);
    if (error) { console.warn('⚠️ โหลด leaderboard ไม่สำเร็จ:', error); return []; }
    return data || [];
  }

  async function fetchMyRank(xp) {
    if (!sb) return null;
    const higher = await sb.from('users').select('*', { count: 'exact', head: true }).gt('xp', xp);
    const total = await sb.from('users').select('*', { count: 'exact', head: true });
    if (higher.error || total.error) return null;
    return { rank: (higher.count || 0) + 1, total: total.count || 0 };
  }

  function renderLeaderboardList(container, list, highlightId) {
    if (!list || list.length === 0) {
      container.innerHTML = '<div class="leaderboard-empty">ยังไม่มีใครเล่นเลย เป็นคนแรกสิ! 🚀</div>';
      container.onclick = null;
      return;
    }
    container.innerHTML = list.map((u, i) => {
      const rankIcon = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : String(i + 1);
      const isMe = highlightId && u.id === highlightId;
      return `<div class="leaderboard-row clickable ${isMe ? 'me' : ''}" data-user-id="${u.id}">
        <div class="leaderboard-rank">${rankIcon}</div>
        <div class="leaderboard-name">${escapeHtml(u.name)}</div>
        <div class="leaderboard-xp">Lv.${u.level} · ${u.xp} XP</div>
      </div>`;
    }).join('');

    // ใช้ onclick (แทน addEventListener) เพื่อไม่ให้ listener ซ้อนกันทุกครั้งที่ re-render
    container.onclick = (e) => {
      const row = e.target.closest('.leaderboard-row');
      if (!row) return;
      const user = list.find(u => String(u.id) === String(row.dataset.userId));
      if (user) openProfileFromScreen(user);
    };
  }

  async function refreshLeaderboardWidget(container, highlightId) {
    const list = await fetchLeaderboard(10);
    renderLeaderboardList(container, list, highlightId);
  }

  function getCurrentScreenName() {
    return Object.keys(screens).find(key => screens[key].classList.contains('active')) || 'start';
  }

  function openProfileFromScreen(user) {
    state.profileReturnScreenName = getCurrentScreenName();
    renderProfileScreen(user);
  }

  // =========================================================
  // ---------- โปรไฟล์ผู้เล่น ----------
  // =========================================================
  const AVATAR_GRADIENTS = [
    ['#ff6b4a', '#ffc857'],
    ['#8c7bff', '#35d6a6'],
    ['#35d6a6', '#ffc857'],
    ['#ff5c7a', '#8c7bff'],
    ['#ffc857', '#ff6b4a']
  ];

  function avatarInitial(name) {
    const trimmed = (name || '?').trim();
    return trimmed ? trimmed[0].toUpperCase() : '?';
  }

  function avatarGradient(name) {
    let hash = 0;
    const str = name || 'guest';
    for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
    const [c1, c2] = AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
    return `linear-gradient(135deg, ${c1}, ${c2})`;
  }

  async function fetchGameHistory(userId, limit = 10) {
    if (!sb || !userId) return [];
    const { data, error } = await sb
      .from('game_stats')
      .select('score, words_matched, time_spent, played_at')
      .eq('user_id', userId)
      .order('played_at', { ascending: false })
      .limit(limit);
    if (error) { console.warn('⚠️ โหลดประวัติการเล่นไม่สำเร็จ:', error); return []; }
    return data || [];
  }

  function renderProfileStatsGrid(stats) {
    const unlockedCount = (stats.unlocked || []).length;
    const cells = [
      { icon: '🎮', label: 'เกมที่เล่น', value: stats.games_played || 0 },
      { icon: '🌟', label: 'Perfect Score', value: stats.perfect_games || 0 },
      { icon: '👑', label: 'คำบอสตอบถูก', value: stats.boss_correct || 0 },
      { icon: '📚', label: 'คำพิเศษตอบถูก', value: stats.special_correct || 0 },
      { icon: '⚡', label: 'คอมโบสูงสุด', value: stats.best_combo ? `x${stats.best_combo}` : '-' },
      { icon: '⏱️', label: 'เร็วที่สุด', value: stats.fastest_time != null ? formatTime(stats.fastest_time) : '-' },
      { icon: '🎪', label: 'เกมวันอาทิตย์', value: stats.sunday_games || 0 },
      { icon: '🏅', label: 'เหรียญตรา', value: `${unlockedCount}/${ACHIEVEMENTS.length}` }
    ];
    dom.profileStatsGrid.innerHTML = cells.map(c => `
      <div class="profile-stat-cell">
        <div class="profile-stat-icon">${c.icon}</div>
        <div class="profile-stat-value">${c.value}</div>
        <div class="profile-stat-label">${c.label}</div>
      </div>
    `).join('');
  }

  function renderProfileHistory(rows, isSelf) {
    if (!rows || rows.length === 0) {
      dom.profileHistoryList.innerHTML = (isSelf && state.isGuest)
        ? '<div class="leaderboard-empty">เล่นแบบ Guest ไม่มีการบันทึกประวัติ — เข้าสู่ระบบเพื่อบันทึกทุกเกมที่เล่น</div>'
        : '<div class="leaderboard-empty">ยังไม่มีประวัติการเล่น</div>';
      return;
    }
    dom.profileHistoryList.innerHTML = rows.map(r => {
      const d = new Date(r.played_at);
      const dateLabel = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      return `
        <div class="profile-history-row">
          <div class="profile-history-date">${dateLabel}</div>
          <div class="profile-history-mid">✅ ${r.words_matched}/${WORDS_PER_GAME}</div>
          <div class="profile-history-score">⭐ ${r.score}</div>
        </div>
      `;
    }).join('');
  }

  // viewUser: ไม่ใส่ = ดูโปรไฟล์ตัวเอง, ใส่ {id,name,level,xp,stats} = ดูโปรไฟล์คนอื่นจาก leaderboard
  async function renderProfileScreen(viewUser) {
    const isSelf = !viewUser;
    let name, xp, statsSource, historyUserId;

    if (isSelf) {
      name = state.isGuest ? 'Guest' : (state.currentUser ? state.currentUser.name : '-');
      xp = currentXp();
      statsSource = loadStats();
      historyUserId = (!state.isGuest && state.currentUser) ? state.currentUser.id : null;
      state.profileReturnScreenName = state.profileReturnScreenName || 'start';
    } else {
      name = viewUser.name;
      xp = viewUser.xp || 0;
      statsSource = (viewUser.stats && typeof viewUser.stats === 'object') ? { ...defaultStats(), ...viewUser.stats } : defaultStats();
      historyUserId = viewUser.id;
    }

    const { level, current, needed, percent } = xpProgress(xp);

    dom.profileAvatar.textContent = avatarInitial(name);
    dom.profileAvatar.style.background = avatarGradient(name);
    dom.profileName.textContent = name;
    dom.profileLevelBadge.textContent = level;
    dom.profileXpFill.style.width = `${percent}%`;
    dom.profileXpCaption.textContent = `${current} / ${needed} XP`;

    renderProfileStatsGrid(statsSource);

    if (dom.btnProfileBack) {
      dom.btnProfileBack.textContent = isSelf ? '🏠 กลับหน้าหลัก' : '‹ กลับไปหน้าเดิม';
    }

    dom.profileHistoryList.innerHTML = '<div class="leaderboard-empty">กำลังโหลด...</div>';
    showScreen('profile');

    if (historyUserId) {
      const history = await fetchGameHistory(historyUserId, 10);
      renderProfileHistory(history, isSelf);
    } else {
      renderProfileHistory([], isSelf);
    }
  }

  // ---------- User chip / topbar UI ----------
  function currentXp() {
    if (state.isGuest) return loadGuestProgress().xp;
    if (state.currentUser) return state.currentUser.xp;
    return 0;
  }

  function updateUserChipUI() {
    const xp = currentXp();
    const { level, current, needed, percent } = xpProgress(xp);
    dom.startUserName.textContent = state.isGuest ? 'Guest' : (state.currentUser ? state.currentUser.name : '-');
    dom.startLevelBadge.textContent = level;
    dom.startXpFill.style.width = `${percent}%`;
    dom.startXpCaption.textContent = `${current} / ${needed} XP`;

    if (dom.startAchvCount) {
      const unlockedCount = (loadStats().unlocked || []).length;
      dom.startAchvCount.textContent = `🏅 ${unlockedCount}/${ACHIEVEMENTS.length}`;
    }
  }

  // ---------- Auth screen logic ----------
  function setAuthError(msg) {
    dom.authError.textContent = msg || '';
  }

  async function handleAuthSubmit() {
    const name = dom.authName.value.trim();
    const pin = dom.authPin.value.trim();

    if (!name) { setAuthError('กรุณาใส่ชื่อผู้เล่น'); return; }
    if (!/^\d{4,6}$/.test(pin)) { setAuthError('PIN ต้องเป็นตัวเลข 4-6 หลัก'); return; }

    setAuthError('');
    dom.btnAuthSubmit.disabled = true;
    dom.btnAuthSubmit.textContent = 'กำลังตรวจสอบ...';

    const result = await loginOrRegister(name, pin);

    dom.btnAuthSubmit.disabled = false;
    dom.btnAuthSubmit.textContent = 'เข้าสู่ระบบ / สร้างบัญชีใหม่';

    if (result.error === 'wrong_pin') {
      setAuthError('❌ PIN ไม่ถูกต้อง ลองใหม่อีกครั้ง');
      return;
    }
    if (result.error === 'offline' || result.error === 'network') {
      setAuthError('❌ เชื่อมต่อระบบสมาชิกไม่ได้ตอนนี้ ลองใหม่ หรือกด "เล่นแบบไม่ล็อกอิน" แทนได้');
      return;
    }

    state.currentUser = result.user;
    state.isGuest = false;
    saveSession(result.user);
    await enterStartScreen();
  }

  function handleAuthGuest() {
    state.currentUser = null;
    state.isGuest = true;
    enterStartScreen();
  }

  async function enterStartScreen() {
    updateUserChipUI();
    showScreen('start');
    const highlightId = state.currentUser ? state.currentUser.id : null;
    refreshLeaderboardWidget(dom.leaderboardStartList, highlightId);
  }

  function logout() {
    clearSession();
    state.currentUser = null;
    state.isGuest = false;
    dom.authName.value = '';
    dom.authPin.value = '';
    setAuthError('');
    showScreen('auth');
  }

  // ---------- Learn Screen ----------
  function renderLearnScreen() {
    dom.learnList.innerHTML = '';
    state.currentWords.forEach(w => {
      const item = document.createElement('div');
      item.className = 'learn-item';
      item.innerHTML = `
        <button type="button" class="speak-btn" aria-label="ฟังเสียง">${SPEAKER_SVG}</button>
        <div class="word-text">
          <div class="en">${escapeHtml(w.word)}</div>
          <div class="th">${escapeHtml(w.thai)}</div>
        </div>
      `;
      const btn = item.querySelector('.speak-btn');
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        TTS.speak(w.word, btn);
      });
      dom.learnList.appendChild(item);
    });
  }

  // =========================================================
  // ---------- ระบบเลือกคำศัพท์ตามหมวด + วันอาทิตย์ Boss Rush ----------
  // ธรรมดา: เจอได้ทุกวัน
  // พิเศษ (TOEFL/IELTS): เจอบ่อยขึ้นตามเลเวลผู้เล่น
  // บอส (TOEIC): เจอเฉพาะวันอาทิตย์ ยิ่งเลเวลสูงยิ่งเจอเยอะ ตอบถูกได้คะแนนคูณ
  // =========================================================
  function isBossDay() {
    return new Date().getDay() === 0; // อาทิตย์
  }

  function currentPlayerLevel() {
    return xpProgress(currentXp()).level;
  }

  function missedWordsKey() {
    const who = state.isGuest ? 'guest' : (state.currentUser ? state.currentUser.id : 'guest');
    return MISSED_KEY_PREFIX + who;
  }

  function loadMissedWords() {
    try {
      return JSON.parse(localStorage.getItem(missedWordsKey())) || {};
    } catch (e) {
      return {};
    }
  }

  function saveMissedWords(map) {
    localStorage.setItem(missedWordsKey(), JSON.stringify(map));
  }

  function recordMissedWord(wordId) {
    const map = loadMissedWords();
    map[wordId] = (map[wordId] || 0) + 1;
    saveMissedWords(map);
  }

  function recordCorrectWord(wordId) {
    // ตอบถูกแล้ว ลดระดับ "คำที่เคยพลาด" ลงเล็กน้อย เหมือนเริ่มจดจำได้แล้ว
    const map = loadMissedWords();
    if (map[wordId]) {
      map[wordId] = Math.max(0, map[wordId] - 1);
      saveMissedWords(map);
    }
  }

  // =========================================================
  // ---------- สถิติสะสม + ปลดล็อก Achievement ----------
  // =========================================================
  function defaultStats() {
    return {
      games_played: 0,
      perfect_games: 0,
      boss_correct: 0,
      special_correct: 0,
      best_combo: 0,
      fastest_time: null,
      sunday_games: 0,
      unlocked: []
    };
  }

  function loadStats() {
    if (state.isGuest) {
      try {
        return { ...defaultStats(), ...(JSON.parse(localStorage.getItem(GUEST_STATS_KEY)) || {}) };
      } catch (e) {
        return defaultStats();
      }
    }
    if (state.currentUser && state.currentUser.stats && typeof state.currentUser.stats === 'object') {
      return { ...defaultStats(), ...state.currentUser.stats };
    }
    return defaultStats();
  }

  function saveGuestStats(stats) {
    localStorage.setItem(GUEST_STATS_KEY, JSON.stringify(stats));
  }

  // อัปเดตสถิติหลังจบเกม แล้วเช็คว่ามี achievement ใหม่ที่เพิ่งปลดล็อกไหม
  function computeUpdatedStats(prevStats, summary, level) {
    const stats = { ...prevStats };
    stats.games_played = (stats.games_played || 0) + 1;
    if (summary.isPerfect) stats.perfect_games = (stats.perfect_games || 0) + 1;
    stats.boss_correct = (stats.boss_correct || 0) + summary.bossCorrect;
    stats.special_correct = (stats.special_correct || 0) + summary.specialCorrect;
    stats.best_combo = Math.max(stats.best_combo || 0, summary.bestCombo || 0);
    stats.fastest_time = stats.fastest_time == null ? summary.elapsed : Math.min(stats.fastest_time, summary.elapsed);
    if (summary.isSunday) stats.sunday_games = (stats.sunday_games || 0) + 1;

    const prevUnlocked = new Set(stats.unlocked || []);
    const nowUnlocked = ACHIEVEMENTS.filter(a => a.check(stats, level)).map(a => a.id);
    const newlyUnlocked = nowUnlocked.filter(id => !prevUnlocked.has(id));
    stats.unlocked = Array.from(new Set([...(stats.unlocked || []), ...nowUnlocked]));

    return { stats, newlyUnlocked };
  }

  function renderAchievementUnlockBanner(newlyUnlocked) {
    if (!dom.achvUnlockBanner) return;
    if (!newlyUnlocked || newlyUnlocked.length === 0) {
      dom.achvUnlockBanner.style.display = 'none';
      dom.achvUnlockBanner.innerHTML = '';
      return;
    }
    const items = newlyUnlocked
      .map(id => ACHIEVEMENTS.find(a => a.id === id))
      .filter(Boolean);

    dom.achvUnlockBanner.innerHTML = `
      <div class="achv-unlock-title">🏅 ปลดล็อก Achievement ใหม่!</div>
      <div class="achv-unlock-list">
        ${items.map(a => `
          <div class="achv-unlock-item">
            <span class="achv-unlock-icon">${a.icon}</span>
            <span class="achv-unlock-name">${escapeHtml(a.title)}</span>
          </div>
        `).join('')}
      </div>
    `;
    dom.achvUnlockBanner.style.display = 'block';
  }

  function renderAchievementsGrid(container, stats) {
    if (!container) return;
    const unlocked = new Set(stats.unlocked || []);
    container.innerHTML = ACHIEVEMENTS.map(a => {
      const isUnlocked = unlocked.has(a.id);
      return `
        <div class="achv-badge ${isUnlocked ? 'unlocked' : 'locked'}">
          <div class="achv-icon">${isUnlocked ? a.icon : '🔒'}</div>
          <div class="achv-title">${escapeHtml(a.title)}</div>
          <div class="achv-desc">${escapeHtml(a.desc)}</div>
        </div>
      `;
    }).join('');
  }

  function computeSlotCounts(playerLevel, sundayBoss) {
    let specialSlots = Math.min(Math.floor(playerLevel / 2), 4);
    let bossSlots = sundayBoss ? Math.min(2 + Math.floor(playerLevel / 3), 6) : 0;

    // กันไม่ให้คำพิเศษ+บอสเบียดคำธรรมดาจนเหลือน้อยเกินไป (เก็บคำธรรมดาไว้อย่างน้อย 2 คำ)
    while (specialSlots + bossSlots > WORDS_PER_GAME - 2) {
      if (bossSlots >= specialSlots && bossSlots > 0) bossSlots--;
      else if (specialSlots > 0) specialSlots--;
      else break;
    }

    const normalSlots = WORDS_PER_GAME - specialSlots - bossSlots;
    return { normalSlots, specialSlots, bossSlots };
  }

  // เลือกคำบอสแบบถ่วงน้ำหนัก: คำที่เคยตอบผิดบ่อยมีโอกาสเจอสูงกว่า (ไม่ใช่สุ่มล้วน)
  function pickWeightedWords(pool, n, missedMap) {
    const available = pool.map(w => ({ w, weight: (missedMap[w.id] || 0) * 3 + 1 }));
    const picked = [];
    for (let i = 0; i < n && available.length > 0; i++) {
      const totalWeight = available.reduce((s, x) => s + x.weight, 0);
      let r = Math.random() * totalWeight;
      let idx = 0;
      for (; idx < available.length; idx++) {
        r -= available[idx].weight;
        if (r <= 0) break;
      }
      idx = Math.min(idx, available.length - 1);
      picked.push(available[idx].w);
      available.splice(idx, 1);
    }
    return picked;
  }

  function pickRandomWords(pool, n) {
    return shuffle(pool).slice(0, n);
  }

  function selectGameWords() {
    const playerLevel = currentPlayerLevel();
    const sundayBoss = state.isSundayBoss;
    const { normalSlots, specialSlots, bossSlots } = computeSlotCounts(playerLevel, sundayBoss);

    const normalPool = state.allWords.filter(w => w.tier === 'normal' || !w.tier);
    const specialPool = state.allWords.filter(w => w.tier === 'special');
    const bossPool = state.allWords.filter(w => w.tier === 'boss');
    const missedMap = loadMissedWords();

    let picked = [
      ...pickRandomWords(normalPool, normalSlots),
      ...pickRandomWords(specialPool, specialSlots),
      ...pickWeightedWords(bossPool, bossSlots, missedMap)
    ];

    // เผื่อบางหมวดมีคำไม่พอ ให้เติมจากคำธรรมดาจนครบจำนวนที่ต้องใช้ต่อเกม
    if (picked.length < WORDS_PER_GAME) {
      const usedIds = new Set(picked.map(w => w.id));
      const filler = normalPool.filter(w => !usedIds.has(w.id));
      picked = picked.concat(pickRandomWords(filler, WORDS_PER_GAME - picked.length));
    }

    return shuffle(picked).slice(0, WORDS_PER_GAME);
  }

  function tierBadge(word) {
    if (word.tier === 'boss') return '👑 ';
    if (word.tier === 'special') return '⭐ ';
    return '';
  }

  function calcMaxPossibleScore(words) {
    const bossCount = words.filter(w => w.tier === 'boss').length;
    const nonBossCount = words.length - bossCount;
    let max = nonBossCount * POINTS_PER_CORRECT;
    for (let i = 0; i < bossCount; i++) {
      const multiplier = BOSS_MULTIPLIERS[Math.min(i, BOSS_MULTIPLIERS.length - 1)];
      max += Math.round(POINTS_PER_CORRECT * multiplier);
    }
    return max;
  }

  // ---------- Game Setup ----------
  function startNewGame() {
    if (state.allWords.length < WORDS_PER_GAME) {
      alert(`❌ คำศัพท์ไม่พอ (ต้องมีอย่างน้อย ${WORDS_PER_GAME} คำ)\nมีอยู่: ${state.allWords.length} คำ`);
      return;
    }

    state.isSundayBoss = isBossDay();
    state.currentWords = selectGameWords();
    state.rightOrder = shuffle(state.currentWords);
    state.matched = new Map();
    state.wrongCount = 0;
    state.wrongWordsList = [];
    state.score = 0;
    state.bossStreak = 0;
    state.bossCorrectCount = 0;
    state.specialCorrectCount = 0;
    state.bestBossMultiplierThisGame = 0;
    state.gameResults = [];

    renderGameBoard();
    resetTimer();
    startTimer();
    updateScoreUI();
    updateComboUI();
    showScreen('game');

    dom.linesSvg.innerHTML = '';
  }

  function renderGameBoard() {
    dom.leftList.innerHTML = '';
    dom.rightList.innerHTML = '';
    dom.linesSvg.innerHTML = '';

    state.currentWords.forEach(w => dom.leftList.appendChild(createLeftRow(w)));
    state.rightOrder.forEach(w => dom.rightList.appendChild(createRightRow(w)));
  }

  function createLeftRow(word) {
    const row = document.createElement('div');
    row.className = 'word-row';
    row.dataset.id = word.id;
    row.dataset.side = 'left';
    row.dataset.word = word.word;
    row.dataset.tier = word.tier || 'normal';
    row.innerHTML = `
      <div class="word-text">${tierBadge(word)}${escapeHtml(word.word)}</div>
      <button type="button" class="speak-btn" aria-label="ฟังเสียง / ลากไปจับคู่">${SPEAKER_SVG}</button>
    `;
    // ปุ่มนี้ทำ 2 หน้าที่ - "แตะ" = ฟังเสียง, "ลาก" = จับคู่คำ (ดู onPointerUp)
    return row;
  }

  function createRightRow(word) {
    const row = document.createElement('div');
    row.className = 'word-row';
    row.dataset.id = word.id;
    row.dataset.side = 'right';
    row.dataset.tier = word.tier || 'normal';
    row.innerHTML = `
      <div class="drop-target" data-id="${word.id}"></div>
      <div class="word-text">${tierBadge(word)}${escapeHtml(word.thai)}</div>
    `;
    return row;
  }

  // ---------- Timer ----------
  function startTimer() {
    state.startTime = Date.now();
    state.timerInterval = setInterval(() => {
      const sec = Math.floor((Date.now() - state.startTime) / 1000);
      dom.timer.textContent = formatTime(sec);
    }, 500);
  }

  function resetTimer() {
    if (state.timerInterval) clearInterval(state.timerInterval);
    dom.timer.textContent = '00:00';
  }

  function getElapsedSeconds() {
    return Math.floor((Date.now() - state.startTime) / 1000);
  }

  // ---------- Score UI ----------
  function updateScoreUI() {
    dom.score.textContent = state.score;
    dom.progress.textContent = `${state.matched.size}/${WORDS_PER_GAME}`;
  }

  function currentBossMultiplier() {
    return BOSS_MULTIPLIERS[Math.min(state.bossStreak, BOSS_MULTIPLIERS.length - 1)];
  }

  function updateComboUI() {
    if (!dom.comboChip) return;
    if (state.isSundayBoss && state.bossStreak > 0) {
      dom.comboChip.style.display = 'flex';
      dom.comboChip.querySelector('b').textContent = `x${currentBossMultiplier()}`;
    } else {
      dom.comboChip.style.display = 'none';
    }
  }

  // =========================================================
  // ---------- Pointer handling: แตะ = ฟังเสียง, ลาก = จับคู่ ----------
  // =========================================================
  function setupDragListeners() {
    const area = dom.gameArea;
    area.addEventListener('pointerdown', onPointerDown);
    area.addEventListener('pointermove', onPointerMove);
    area.addEventListener('pointerup', onPointerUp);
    area.addEventListener('pointercancel', onPointerCancel);
  }

  function onPointerDown(e) {
    const btn = e.target.closest('.speak-btn');
    if (!btn) return;

    const row = btn.closest('.word-row');
    if (!row || row.dataset.side !== 'left') return;
    if (row.classList.contains('matched')) return;

    state.pointerId = e.pointerId;
    state.isPointerDown = true;
    state.isDragging = false;
    state.dragStartId = row.dataset.id;
    state.dragStartEl = btn;
    state.startX = e.clientX;
    state.startY = e.clientY;

    try { btn.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  }

  function onPointerMove(e) {
    if (!state.isPointerDown || e.pointerId !== state.pointerId) return;

    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;
    const dist = Math.hypot(dx, dy);

    if (!state.isDragging && dist > DRAG_THRESHOLD_PX) {
      state.isDragging = true;
      state.dragStartEl.classList.add('dragging');
      startDrawingLine(state.dragStartEl);
    }

    if (!state.isDragging) return;

    e.preventDefault();
    const areaRect = dom.gameArea.getBoundingClientRect();
    const x2 = e.clientX - areaRect.left;
    const y2 = e.clientY - areaRect.top;

    if (state.drawingLine) {
      state.drawingLine.setAttribute('x2', x2);
      state.drawingLine.setAttribute('y2', y2);
    }

    highlightNearestDropTarget(e.clientX, e.clientY);
  }

  function onPointerUp(e) {
    if (!state.isPointerDown || e.pointerId !== state.pointerId) return;

    const wasDragging = state.isDragging;
    const btn = state.dragStartEl;
    const leftId = state.dragStartId;

    cleanupPointerState();

    if (!wasDragging) {
      const word = state.currentWords.find(w => String(w.id) === String(leftId));
      if (word && btn) TTS.speak(word.word, btn);
      return;
    }

    document.querySelectorAll('.drop-target.highlight').forEach(el => el.classList.remove('highlight'));

    dom.linesSvg.style.display = 'none';
    const target = document.elementFromPoint(e.clientX, e.clientY);
    dom.linesSvg.style.display = 'block';

    const rightRow = target?.closest?.('.word-row[data-side="right"]');
    if (rightRow) handleMatch(leftId, rightRow.dataset.id, rightRow);
  }

  function onPointerCancel() {
    cleanupPointerState();
  }

  function cleanupPointerState() {
    if (state.dragStartEl) state.dragStartEl.classList.remove('dragging');
    if (state.drawingLine) { state.drawingLine.remove(); state.drawingLine = null; }
    document.querySelectorAll('.drop-target.highlight').forEach(el => el.classList.remove('highlight'));

    state.pointerId = null;
    state.isPointerDown = false;
    state.isDragging = false;
    state.dragStartId = null;
    state.dragStartEl = null;
  }

  function startDrawingLine(btn) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('class', 'line-drawing');
    dom.linesSvg.appendChild(line);
    state.drawingLine = line;

    const startPt = getElementCenter(btn);
    line.setAttribute('x1', startPt.x);
    line.setAttribute('y1', startPt.y);
    line.setAttribute('x2', startPt.x);
    line.setAttribute('y2', startPt.y);
  }

  function highlightNearestDropTarget(clientX, clientY) {
    document.querySelectorAll('.drop-target.highlight').forEach(el => el.classList.remove('highlight'));

    dom.linesSvg.style.display = 'none';
    const target = document.elementFromPoint(clientX, clientY);
    dom.linesSvg.style.display = 'block';

    const dropTarget = target?.closest?.('.drop-target');
    if (dropTarget && !dropTarget.classList.contains('matched-dot')) dropTarget.classList.add('highlight');
  }

  function getElementCenter(el) {
    const areaRect = dom.gameArea.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    return {
      x: elRect.left + elRect.width / 2 - areaRect.left,
      y: elRect.top + elRect.height / 2 - areaRect.top
    };
  }

  function handleMatch(leftId, rightId, rightRow) {
    if (state.matched.has(leftId)) return;
    for (const [, rid] of state.matched.entries()) {
      if (rid === rightId) return;
    }

    const leftRow = dom.leftList.querySelector(`.word-row[data-id="${leftId}"]`);
    if (!leftRow) return;

    if (leftId === rightId) {
      state.matched.set(leftId, rightId);

      const word = state.currentWords.find(w => String(w.id) === String(leftId));
      let pointsAwarded = POINTS_PER_CORRECT;

      if (word && word.tier === 'boss') {
        const multiplier = currentBossMultiplier();
        pointsAwarded = Math.round(POINTS_PER_CORRECT * multiplier);
        state.bossStreak++;
        state.bossCorrectCount++;
        state.bestBossMultiplierThisGame = Math.max(state.bestBossMultiplierThisGame, multiplier);
        leftRow.classList.add('boss-hit');
        setTimeout(() => leftRow.classList.remove('boss-hit'), 500);
      } else if (word && word.tier === 'special') {
        state.specialCorrectCount++;
      }

      state.score += pointsAwarded;
      if (word) recordCorrectWord(word.id);

      leftRow.classList.add('matched');
      rightRow.classList.add('matched');

      const dropTarget = rightRow.querySelector('.drop-target');
      if (dropTarget) dropTarget.classList.add('matched-dot');

      drawPermanentLine(leftRow, rightRow);
      updateScoreUI();
      updateComboUI();

      if (word) state.gameResults.push({ word: word.word, thai: word.thai, correct: true });

      if (state.matched.size === WORDS_PER_GAME) setTimeout(endGame, 500);
    } else {
      const word = state.currentWords.find(w => String(w.id) === String(leftId));
      if (word && word.tier === 'boss') {
        state.bossStreak = 0; // พลาดคำบอส คอมโบขาด
        updateComboUI();
      }
      if (word) recordMissedWord(word.id);

      state.wrongCount++;
      state.wrongWordsList.push(leftRow.dataset.word);
      drawWrongLine(leftRow, rightRow);
      leftRow.classList.add('wrong-flash');
      rightRow.classList.add('wrong-flash');
      setTimeout(() => {
        leftRow.classList.remove('wrong-flash');
        rightRow.classList.remove('wrong-flash');
      }, 500);
    }
  }

  function drawPermanentLine(leftRow, rightRow) {
    const p1 = getElementCenter(leftRow.querySelector('.speak-btn'));
    const p2 = getElementCenter(rightRow.querySelector('.drop-target'));
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('class', 'line-correct');
    line.setAttribute('x1', p1.x); line.setAttribute('y1', p1.y);
    line.setAttribute('x2', p2.x); line.setAttribute('y2', p2.y);
    dom.linesSvg.appendChild(line);
  }

  function drawWrongLine(leftRow, rightRow) {
    const p1 = getElementCenter(leftRow.querySelector('.speak-btn'));
    const p2 = getElementCenter(rightRow.querySelector('.drop-target'));
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('class', 'line-wrong');
    line.setAttribute('x1', p1.x); line.setAttribute('y1', p1.y);
    line.setAttribute('x2', p2.x); line.setAttribute('y2', p2.y);
    dom.linesSvg.appendChild(line);
    setTimeout(() => line.remove(), 800);
  }

  // ---------- Save score / XP after a game ----------
  async function applyXpAndSave(xpEarned, summary) {
    if (state.isGuest) {
      const progress = loadGuestProgress();
      const oldXp = progress.xp;
      const newXp = oldXp + xpEarned;
      saveGuestProgress(newXp);

      const prevStats = loadStats();
      const { stats, newlyUnlocked } = computeUpdatedStats(prevStats, summary, levelFromXp(newXp));
      saveGuestStats(stats);

      return { oldLevel: levelFromXp(oldXp), newLevel: levelFromXp(newXp), newXp, myId: null, stats, newlyUnlocked };
    }

    const user = state.currentUser;
    if (!user) return { oldLevel: 1, newLevel: 1, newXp: 0, myId: null, stats: defaultStats(), newlyUnlocked: [] };

    const oldXp = user.xp;
    const newXp = oldXp + xpEarned;
    const oldLevel = levelFromXp(oldXp);
    const newLevel = levelFromXp(newXp);

    const prevStats = loadStats();
    const { stats, newlyUnlocked } = computeUpdatedStats(prevStats, summary, newLevel);

    if (sb) {
      try {
        await sb.from('users').update({ xp: newXp, level: newLevel, stats }).eq('id', user.id);
        await sb.from('game_stats').insert({
          user_id: user.id,
          score: state.score,
          words_matched: state.matched.size,
          wrong_words: state.wrongWordsList,
          time_spent: getElapsedSeconds()
        });
      } catch (e) {
        console.warn('⚠️ บันทึกคะแนนไป Supabase ไม่สำเร็จ (อาจเน็ตหลุด):', e);
      }
    }

    user.xp = newXp;
    user.level = newLevel;
    user.stats = stats;
    return { oldLevel, newLevel, newXp, myId: user.id, stats, newlyUnlocked };
  }

  // ---------- End Game ----------
  async function endGame() {
    clearInterval(state.timerInterval);
    const elapsed = getElapsedSeconds();
    const correct = state.matched.size;
    const wrong = state.wrongCount;
    const total = calcMaxPossibleScore(state.currentWords);

    state.gameDateTime = new Date();

    dom.finalScore.textContent = state.score;
    dom.totalScore.textContent = total;
    dom.correctCount.textContent = correct;
    dom.wrongCount.textContent = wrong;
    dom.finalTime.textContent = formatTime(elapsed);
    dom.resultDateTime.textContent = formatDateTime(state.gameDateTime);

    renderWordReview();

    const percent = (correct / WORDS_PER_GAME) * 100;
    if (percent === 100) dom.resultTitle.textContent = '🏆 ยอดเยี่ยม! Perfect Score!';
    else if (percent >= 80) dom.resultTitle.textContent = '🎉 เก่งมาก!';
    else if (percent >= 60) dom.resultTitle.textContent = '👍 ดีมาก!';
    else dom.resultTitle.textContent = '💪 ลองใหม่อีกครั้งนะ!';

    showScreen('result');

    // XP / level / rank (แสดงผลแบบ progressive - ไม่บล็อกหน้าจอสรุปผล)
    const xpEarned = calcXpEarned(state.score, wrong, elapsed);
    dom.xpGainValue.textContent = xpEarned;
    dom.levelUpBanner.style.display = 'none';

    const summary = {
      isPerfect: wrong === 0,
      bossCorrect: state.bossCorrectCount,
      specialCorrect: state.specialCorrectCount,
      bestCombo: state.bestBossMultiplierThisGame,
      elapsed,
      isSunday: state.isSundayBoss
    };

    const { oldLevel, newLevel, newXp, myId, stats, newlyUnlocked } = await applyXpAndSave(xpEarned, summary);
    updateUserChipUI();

    if (dom.resultAchvCount) {
      const unlockedCount = (stats.unlocked || []).length;
      dom.resultAchvCount.textContent = `🏅 ${unlockedCount}/${ACHIEVEMENTS.length}`;
    }

    if (newLevel > oldLevel) {
      dom.levelUpValue.textContent = newLevel;
      dom.levelUpBanner.style.display = 'block';
    }

    renderAchievementUnlockBanner(newlyUnlocked);

    if (state.isGuest) {
      dom.myRankLine.textContent = 'เล่นแบบ Guest — เข้าสู่ระบบเพื่อบันทึกคะแนนและขึ้นอันดับ';
    } else if (sb && myId) {
      const rankInfo = await fetchMyRank(newXp);
      dom.myRankLine.textContent = rankInfo
        ? `อันดับของคุณ: อันดับที่ ${rankInfo.rank} จาก ${rankInfo.total} คน`
        : '';
    } else {
      dom.myRankLine.textContent = '';
    }

    refreshLeaderboardWidget(dom.leaderboardResultList, state.isGuest ? null : (state.currentUser ? state.currentUser.id : null));
  }

  // ---------- Render Word Review ----------
  function renderWordReview() {
    dom.wordReviewList.innerHTML = '';

    const sortedResults = [
      ...state.gameResults.filter(r => r.correct),
      ...state.currentWords
        .filter(w => !state.gameResults.find(r => r.word === w.word))
        .map(w => ({ word: w.word, thai: w.thai, correct: false }))
    ];

    sortedResults.forEach((item, index) => {
      const div = document.createElement('div');
      div.className = `word-review-item ${item.correct ? 'correct' : 'wrong'}`;
      div.innerHTML = `
        <span class="word-review-status">${item.correct ? '✅' : '❌'}</span>
        <span class="word-review-en">${index + 1}. ${escapeHtml(item.word)}</span>
        <span class="word-review-arrow">=</span>
        <span class="word-review-th">${escapeHtml(item.thai)}</span>
      `;
      dom.wordReviewList.appendChild(div);
    });
  }

  // =========================================================
  // ---------- Text To Speech ----------
  // "แตะ" กับ "ลาก" แยกกันด้วย Pointer Events (ดูฟังก์ชัน onPointerUp)
  // ไม่พึ่ง click event บนปุ่มลำโพงฝั่งซ้ายอีกต่อไป เพราะบนมือถือ
  // touchstart ที่เรียก preventDefault จะบล็อก click ที่ตามมา
  // =========================================================
  const TTS = (() => {
    let voices = [];
    let isSpeaking = false;
    let unlocked = false;
    let hasWarnedUnsupported = false;

    function refreshVoices() {
      if ('speechSynthesis' in window) voices = window.speechSynthesis.getVoices();
    }

    function pickVoice() {
      if (voices.length === 0) return null;
      // เสียง local (ในเครื่อง) เสถียรกว่าเสียง remote (ผ่านเน็ต) มาก
      const localEnUS = voices.filter(v => v.lang === 'en-US' && v.localService);
      const localEn = voices.filter(v => v.lang && v.lang.startsWith('en') && v.localService);
      const anyEnUS = voices.filter(v => v.lang === 'en-US');
      const anyEn = voices.filter(v => v.lang && v.lang.startsWith('en'));
      return localEnUS[0] || localEn[0] || anyEnUS[0] || anyEn[0] || voices.find(v => v.default) || voices[0];
    }

    function init() {
      if (!('speechSynthesis' in window)) return;
      try { window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }

      refreshVoices();
      window.speechSynthesis.onvoiceschanged = refreshVoices;

      const unlock = () => {
        if (unlocked) return;
        unlocked = true;
        try {
          const u = new SpeechSynthesisUtterance('');
          u.volume = 0;
          window.speechSynthesis.speak(u);
        } catch (e) { /* ignore */ }
      };
      document.addEventListener('pointerdown', unlock, { once: true, capture: true });

      setInterval(() => {
        if (window.speechSynthesis.paused) window.speechSynthesis.resume();
      }, 4000);
    }

    function setButtonState(btnEl, speaking) {
      if (btnEl) btnEl.classList.toggle('speaking', speaking);
    }

    function speak(text, btnEl) {
      if (!('speechSynthesis' in window)) {
        if (!hasWarnedUnsupported) {
          hasWarnedUnsupported = true;
          alert('❌ เบราว์เซอร์นี้ไม่รองรับการอ่านออกเสียง (Text To Speech)');
        }
        return;
      }

      if (isSpeaking) window.speechSynthesis.cancel();
      isSpeaking = true;
      setButtonState(btnEl, true);

      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'en-US';
      utter.rate = 0.9;
      utter.pitch = 1.1;
      utter.volume = 1.0;

      const voice = pickVoice();
      if (voice) utter.voice = voice;

      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        isSpeaking = false;
        setButtonState(btnEl, false);
      };

      utter.onend = finish;
      utter.onerror = (e) => {
        console.warn('⚠️ TTS ถูกขัดจังหวะ หรือเกิดข้อผิดพลาด:', e && e.error);
        finish();
      };

      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);

      setTimeout(() => { if (window.speechSynthesis.paused) window.speechSynthesis.resume(); }, 150);
      setTimeout(finish, 4000);
    }

    return { init, speak };
  })();

  // ---------- Share Result (Social/Mobile) ----------
  function buildShareText() {
    const correct = state.matched.size;
    const wrong = state.wrongCount;
    const total = calcMaxPossibleScore(state.currentWords);
    return [
      '🎯 Word Match Puzzle',
      `⭐ คะแนน: ${state.score}/${total}`,
      `✅ ถูก ${correct}  ❌ ผิด ${wrong}`,
      `⏱️ เวลา: ${dom.finalTime.textContent}`,
      '',
      'มาฝึกคำศัพท์ด้วยกันนะ! 👉'
    ].join('\n');
  }

  function fallbackCopyText(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try { document.execCommand('copy'); } catch (err) { console.error('❌ Fallback copy failed:', err); }
    document.body.removeChild(textarea);
  }

  function copyShareText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => fallbackCopyText(text));
    } else {
      fallbackCopyText(text);
    }
  }

  async function shareResult() {
    const shareText = buildShareText();
    const shareUrl = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Word Match Puzzle', text: shareText, url: shareUrl });
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return;
        console.error('❌ Share error:', err);
      }
    }

    copyShareText(`${shareText}\n${shareUrl}`);
    alert('📋 คัดลอกผลลัพธ์แล้ว! นำไปวางแชร์ในแอปที่ต้องการได้เลย');
  }

  // ---------- Event Listeners ----------
  function bindEvents() {
    dom.btnAuthSubmit.addEventListener('click', handleAuthSubmit);
    dom.authPin.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleAuthSubmit(); });
    dom.btnAuthGuest.addEventListener('click', handleAuthGuest);
    dom.btnLogout.addEventListener('click', logout);

    dom.btnStart.addEventListener('click', () => {
      if (state.allWords.length < WORDS_PER_GAME) {
        alert('❌ คำศัพท์ไม่พอ (ต้องมีอย่างน้อย ' + WORDS_PER_GAME + ' คำ)');
        return;
      }
      renderLearnScreen();
      showScreen('learn');
    });

    dom.btnGoGame.addEventListener('click', startNewGame);
    dom.btnRestart.addEventListener('click', startNewGame);

    dom.btnHome.addEventListener('click', () => {
      enterStartScreen();
    });

    if (dom.btnShare) dom.btnShare.addEventListener('click', shareResult);

    const openAchievements = () => {
      renderAchievementsGrid(dom.achievementsGrid, loadStats());
      showScreen('achievements');
    };
    if (dom.startAchvCount) dom.startAchvCount.addEventListener('click', openAchievements);
    if (dom.resultAchvCount) dom.resultAchvCount.addEventListener('click', openAchievements);

    if (dom.btnAchievementsBack) {
      dom.btnAchievementsBack.addEventListener('click', () => {
        enterStartScreen();
      });
    }

    if (dom.userChip) {
      const openOwnProfile = () => {
        state.profileReturnScreenName = 'start';
        renderProfileScreen();
      };
      dom.userChip.addEventListener('click', openOwnProfile);
      dom.userChip.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openOwnProfile();
        }
      });
    }
    if (dom.btnProfileBack) {
      dom.btnProfileBack.addEventListener('click', () => {
        const target = state.profileReturnScreenName || 'start';
        if (target === 'start') enterStartScreen();
        else showScreen(target);
      });
    }
  }

  // ---------- Init ----------
  async function init() {
    initSupabaseClient();
    TTS.init();

    state.isSundayBoss = isBossDay();
    document.body.classList.toggle('boss-day', state.isSundayBoss);
    if (dom.bossBannerStart) dom.bossBannerStart.style.display = state.isSundayBoss ? 'flex' : 'none';

    await loadWords();
    setupDragListeners();
    bindEvents();

    const restored = await restoreSession();
    if (restored) {
      state.currentUser = restored;
      state.isGuest = false;
      await enterStartScreen();
    }
    // ถ้ายังไม่มี session ให้ค้างอยู่หน้า auth (active อยู่แล้วโดย default)

    console.log('✅ เกมพร้อมใช้งาน');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
