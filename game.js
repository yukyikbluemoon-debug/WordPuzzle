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
    result: $('screen-result')
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
    leaderboardStartList: $('leaderboard-start-list'),

    // learn
    btnGoGame:       $('btn-go-game'),
    learnList:       $('learn-list'),

    // game
    timer:           $('timer'),
    score:           $('score'),
    progress:        $('progress'),
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
    const { data, error } = await sb.from('users').select('id,name,level,xp').order('xp', { ascending: false }).limit(limit);
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
      return;
    }
    container.innerHTML = list.map((u, i) => {
      const rankIcon = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : String(i + 1);
      const isMe = highlightId && u.id === highlightId;
      return `<div class="leaderboard-row ${isMe ? 'me' : ''}">
        <div class="leaderboard-rank">${rankIcon}</div>
        <div class="leaderboard-name">${escapeHtml(u.name)}</div>
        <div class="leaderboard-xp">Lv.${u.level} · ${u.xp} XP</div>
      </div>`;
    }).join('');
  }

  async function refreshLeaderboardWidget(container, highlightId) {
    const list = await fetchLeaderboard(10);
    renderLeaderboardList(container, list, highlightId);
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

  // ---------- Game Setup ----------
  function startNewGame() {
    if (state.allWords.length < WORDS_PER_GAME) {
      alert(`❌ คำศัพท์ไม่พอ (ต้องมีอย่างน้อย ${WORDS_PER_GAME} คำ)\nมีอยู่: ${state.allWords.length} คำ`);
      return;
    }

    state.currentWords = shuffle(state.allWords).slice(0, WORDS_PER_GAME);
    state.rightOrder = shuffle(state.currentWords);
    state.matched = new Map();
    state.wrongCount = 0;
    state.wrongWordsList = [];
    state.score = 0;
    state.gameResults = [];

    renderGameBoard();
    resetTimer();
    startTimer();
    updateScoreUI();
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
    row.innerHTML = `
      <div class="word-text">${escapeHtml(word.word)}</div>
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
    row.innerHTML = `
      <div class="drop-target" data-id="${word.id}"></div>
      <div class="word-text">${escapeHtml(word.thai)}</div>
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
      state.score += POINTS_PER_CORRECT;
      leftRow.classList.add('matched');
      rightRow.classList.add('matched');

      const dropTarget = rightRow.querySelector('.drop-target');
      if (dropTarget) dropTarget.classList.add('matched-dot');

      drawPermanentLine(leftRow, rightRow);
      updateScoreUI();

      const word = state.currentWords.find(w => String(w.id) === String(leftId));
      if (word) state.gameResults.push({ word: word.word, thai: word.thai, correct: true });

      if (state.matched.size === WORDS_PER_GAME) setTimeout(endGame, 500);
    } else {
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
  async function applyXpAndSave(xpEarned) {
    if (state.isGuest) {
      const progress = loadGuestProgress();
      const oldXp = progress.xp;
      const newXp = oldXp + xpEarned;
      saveGuestProgress(newXp);
      return { oldLevel: levelFromXp(oldXp), newLevel: levelFromXp(newXp), newXp, myId: null };
    }

    const user = state.currentUser;
    if (!user) return { oldLevel: 1, newLevel: 1, newXp: 0, myId: null };

    const oldXp = user.xp;
    const newXp = oldXp + xpEarned;
    const oldLevel = levelFromXp(oldXp);
    const newLevel = levelFromXp(newXp);

    if (sb) {
      try {
        await sb.from('users').update({ xp: newXp, level: newLevel }).eq('id', user.id);
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
    return { oldLevel, newLevel, newXp, myId: user.id };
  }

  // ---------- End Game ----------
  async function endGame() {
    clearInterval(state.timerInterval);
    const elapsed = getElapsedSeconds();
    const correct = state.matched.size;
    const wrong = state.wrongCount;
    const total = WORDS_PER_GAME * POINTS_PER_CORRECT;

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

    const { oldLevel, newLevel, newXp, myId } = await applyXpAndSave(xpEarned);
    updateUserChipUI();

    if (newLevel > oldLevel) {
      dom.levelUpValue.textContent = newLevel;
      dom.levelUpBanner.style.display = 'block';
    }

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
    const total = WORDS_PER_GAME * POINTS_PER_CORRECT;
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
  }

  // ---------- Init ----------
  async function init() {
    initSupabaseClient();
    TTS.init();

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
