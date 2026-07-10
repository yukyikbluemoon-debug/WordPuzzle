/* =========================================================
   Word Match Puzzle - Game Logic (Rewrite)
   โครงสร้างใหม่: ใช้ Pointer Events แบบรวมศูนย์ (mouse+touch เดียวกัน)
   แยก "แตะเพื่อฟังเสียง" ออกจาก "ลากเพื่อจับคู่" อย่างชัดเจน
   เพื่อแก้บั๊กเดิมที่ปุ่มลำโพงไม่ยอมมีเสียงบนมือถือ
   ========================================================= */

(() => {
  'use strict';

  // ---------- ค่าคงที่ ----------
  const WORDS_PER_GAME = 10;
  const POINTS_PER_CORRECT = 10;
  const STORAGE_KEY = 'wordPuzzleHighScore';
  const DRAG_THRESHOLD_PX = 12; // ขยับเกินนี้ถือว่ากำลัง "ลาก" ไม่ใช่ "แตะ"

  // SVG ไอคอนลำโพง
  const SPEAKER_SVG = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`;

  // ---------- State ----------
  const state = {
    allWords: [],
    currentWords: [],
    rightOrder: [],
    matched: new Map(),
    wrongCount: 0,
    score: 0,
    startTime: 0,
    timerInterval: null,
    gameDateTime: null,
    gameResults: [],

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
    start:  $('screen-start'),
    learn:  $('screen-learn'),
    game:   $('screen-game'),
    result: $('screen-result')
  };
  const dom = {
    highScore:      $('high-score'),
    btnStart:       $('btn-start'),
    btnGoGame:      $('btn-go-game'),
    learnList:      $('learn-list'),
    timer:          $('timer'),
    score:          $('score'),
    progress:       $('progress'),
    leftList:       $('left-list'),
    rightList:      $('right-list'),
    linesSvg:       $('lines-svg'),
    gameArea:       $('game-area'),
    finalScore:     $('final-score'),
    totalScore:     $('total-score'),
    correctCount:   $('correct-count'),
    wrongCount:     $('wrong-count'),
    finalTime:      $('final-time'),
    resultTitle:    $('result-title'),
    resultDateTime: $('result-datetime-text'),
    wordReviewList: $('word-review-list'),
    btnRestart:     $('btn-restart'),
    btnHome:        $('btn-home'),
    btnShare:       $('btn-share')
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
    const options = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    };
    return date.toLocaleDateString('th-TH', options);
  }

  function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
  }

  // ---------- Load Words ----------
  async function loadWords() {
    try {
      const res = await fetch('data/words.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('โหลดคำศัพท์ไม่สำเร็จ');
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('รูปแบบข้อมูลคำศัพท์ไม่ถูกต้อง');
      }
      state.allWords = data;
      console.log(`✅ โหลดคำศัพท์สำเร็จ: ${data.length} คำ`);
    } catch (err) {
      console.error('❌ Error loading words:', err);
      alert('❌ ไม่สามารถโหลดข้อมูลคำศัพท์ได้\nกรุณาตรวจสอบไฟล์ data/words.json');
    }
  }

  // ---------- High Score ----------
  function getHighScore() {
    return parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
  }

  function saveHighScore(score) {
    if (score > getHighScore()) {
      localStorage.setItem(STORAGE_KEY, String(score));
    }
  }

  function renderHighScore() {
    dom.highScore.textContent = getHighScore();
  }

  // =========================================================
  // ---------- Text To Speech ----------
  // แก้ไขปัญหาหลัก: ก่อนหน้านี้ speak() ถูกเรียกจาก listener 'click'
  // บนปุ่มเดียวกับที่ใช้เริ่มลาก (mousedown/touchstart + preventDefault)
  // บนมือถือ การ preventDefault ใน touchstart จะ "บล็อก" ไม่ให้ event
  // click สังเคราะห์เกิดขึ้นตามมาเลย -> พูดไม่ออกเสียง/ไม่เสถียร
  // ตอนนี้ speak() ถูกเรียกตรงจาก pointerup โดยตรง (แยกกรณี "แตะ" กับ
  // "ลาก" ด้วยระยะทางที่ขยับ) ไม่พึ่ง click event อีกต่อไป
  // =========================================================
  const TTS = (() => {
    let voices = [];
    let isSpeaking = false;
    let unlocked = false;
    let hasWarnedUnsupported = false;

    function refreshVoices() {
      if ('speechSynthesis' in window) {
        voices = window.speechSynthesis.getVoices();
      }
    }

    function pickVoice() {
      if (voices.length === 0) return null;
      // เสียงแบบ "local" (ทำงานในเครื่อง ไม่พึ่งอินเทอร์เน็ต) เสถียรกว่าเสียง
      // แบบ "remote" (เช่น Google เสียงเครือข่าย) มาก - เสียง remote เป็นสาเหตุที่พบบ่อย
      // ที่ทำให้พูดได้รอบแรกแต่รอบถัดไปเงียบ/ค้าง จึงบังคับเลือก local ก่อนเสมอถ้ามี
      const localEnUS = voices.filter(v => v.lang === 'en-US' && v.localService);
      const localEn = voices.filter(v => v.lang && v.lang.startsWith('en') && v.localService);
      const anyEnUS = voices.filter(v => v.lang === 'en-US');
      const anyEn = voices.filter(v => v.lang && v.lang.startsWith('en'));

      return (
        localEnUS[0] ||
        localEn[0] ||
        anyEnUS[0] ||
        anyEn[0] ||
        voices.find(v => v.default) ||
        voices[0]
      );
    }

    function init() {
      if (!('speechSynthesis' in window)) return;

      // เคลียร์คิวเสียงที่อาจค้างจากรอบก่อนหน้า (เช่น รีเฟรชระหว่างกำลังพูด)
      try { window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }

      refreshVoices();
      window.speechSynthesis.onvoiceschanged = refreshVoices;

      // มือถือหลายรุ่นต้องมี user gesture ครั้งแรกก่อน engine เสียงถึงจะพร้อม
      // ปลดล็อกด้วยการพูดข้อความว่างเงียบๆ ทันทีที่ผู้ใช้แตะ/คลิกครั้งแรกที่ไหนก็ได้
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

      // เคยเจอบั๊กของ Chrome ที่ speechSynthesis จะ "ค้าง" (paused) เองถ้าไม่ได้
      // ใช้งานสักพัก - คอย resume เบาๆ เป็นระยะเพื่อกันไม่ให้ engine หลับ
      setInterval(() => {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      }, 4000);
    }

    function setButtonState(btnEl, speaking) {
      if (!btnEl) return;
      btnEl.classList.toggle('speaking', speaking);
    }

    function speak(text, btnEl) {
      if (!('speechSynthesis' in window)) {
        if (!hasWarnedUnsupported) {
          hasWarnedUnsupported = true;
          alert('❌ เบราว์เซอร์นี้ไม่รองรับการอ่านออกเสียง (Text To Speech)');
        }
        return;
      }

      // กันผู้ใช้แตะรัวๆ ให้คำพูดต่อคิวจนฟังดู "ช้า"
      if (isSpeaking) {
        window.speechSynthesis.cancel();
      }

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
        // Chrome/แท็บที่ไม่ได้โฟกัส บางครั้งยิง error ที่ไม่มีรายละเอียด (interrupted)
        // ซึ่งไม่ใช่ปัญหาจริงจากผู้ใช้ จึงแค่ log ไว้เฉยๆ ไม่รบกวนผู้เล่นด้วย alert
        console.warn('⚠️ TTS ถูกขัดจังหวะ หรือเกิดข้อผิดพลาด:', e && e.error);
        finish();
      };

      // เรียก speak() ทันทีแบบ synchronous ภายใน user gesture (ไม่ผ่าน setTimeout)
      // เพราะบางเบราว์เซอร์จะปฏิเสธเสียง (not-allowed) ถ้า speak ไม่ได้เริ่มจาก
      // การกระทำของผู้ใช้โดยตรง
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);

      // กันปุ่มค้างถ้า onend/onerror ไม่ยิงเลยในบาง webview
      setTimeout(finish, 4000);
    }

    return { init, speak };
  })();

  // ---------- Learn Screen ----------
  function renderLearnScreen() {
    dom.learnList.innerHTML = '';
    state.currentWords.forEach(w => {
      const item = document.createElement('div');
      item.className = 'learn-item';
      item.innerHTML = `
        <button type="button" class="speak-btn" aria-label="ฟังเสียง">${SPEAKER_SVG}</button>
        <div class="word-text">
          <div class="en">${w.word}</div>
          <div class="th">${w.thai}</div>
        </div>
      `;
      const btn = item.querySelector('.speak-btn');
      // หน้าเรียนรู้คำศัพท์ไม่มีการลาก จึงใช้ click ปกติได้อย่างปลอดภัย
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

    state.currentWords.forEach(w => {
      dom.leftList.appendChild(createLeftRow(w));
    });

    state.rightOrder.forEach(w => {
      dom.rightList.appendChild(createRightRow(w));
    });
  }

  function createLeftRow(word) {
    const row = document.createElement('div');
    row.className = 'word-row';
    row.dataset.id = word.id;
    row.dataset.side = 'left';
    row.dataset.word = word.word;
    row.innerHTML = `
      <div class="word-text">${word.word}</div>
      <button type="button" class="speak-btn" aria-label="ฟังเสียง / ลากไปจับคู่">${SPEAKER_SVG}</button>
    `;
    // หมายเหตุ: ปุ่มนี้ทำ 2 หน้าที่ - "แตะ" = ฟังเสียง, "ลาก" = จับคู่คำ
    // การจัดการทั้งสองอย่างทำผ่าน Pointer Events ชุดเดียวใน setupDragListeners()
    // (ดู onPointerUp สำหรับตรรกะแยกแตะ/ลาก) ไม่มี click listener แยกอีกต่อไป
    return row;
  }

  function createRightRow(word) {
    const row = document.createElement('div');
    row.className = 'word-row';
    row.dataset.id = word.id;
    row.dataset.side = 'right';
    row.innerHTML = `
      <div class="drop-target" data-id="${word.id}"></div>
      <div class="word-text">${word.thai}</div>
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
  // ใช้ Pointer Events (รองรับทั้งเมาส์/นิ้ว/ปากกาในโค้ดชุดเดียว)
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

    // เพิ่งขยับเกิน threshold ครั้งแรก -> เริ่มถือว่าเป็นการ "ลาก" และวาดเส้น
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
      // แตะเฉยๆ ไม่ได้ลาก -> เล่นเสียงคำศัพท์
      const word = state.currentWords.find(w => String(w.id) === String(leftId));
      if (word && btn) TTS.speak(word.word, btn);
      return;
    }

    // ลากจริง -> ตรวจว่าปล่อยตรงคำแปลฝั่งขวาหรือไม่
    document.querySelectorAll('.drop-target.highlight').forEach(el => {
      el.classList.remove('highlight');
    });

    dom.linesSvg.style.display = 'none';
    const target = document.elementFromPoint(e.clientX, e.clientY);
    dom.linesSvg.style.display = 'block';

    const rightRow = target?.closest?.('.word-row[data-side="right"]');
    if (rightRow) {
      handleMatch(leftId, rightRow.dataset.id, rightRow);
    }
  }

  function onPointerCancel() {
    cleanupPointerState();
  }

  function cleanupPointerState() {
    if (state.dragStartEl) {
      state.dragStartEl.classList.remove('dragging');
    }
    if (state.drawingLine) {
      state.drawingLine.remove();
      state.drawingLine = null;
    }
    document.querySelectorAll('.drop-target.highlight').forEach(el => {
      el.classList.remove('highlight');
    });

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
    document.querySelectorAll('.drop-target.highlight').forEach(el => {
      el.classList.remove('highlight');
    });

    dom.linesSvg.style.display = 'none';
    const target = document.elementFromPoint(clientX, clientY);
    dom.linesSvg.style.display = 'block';

    const dropTarget = target?.closest?.('.drop-target');
    if (dropTarget && !dropTarget.classList.contains('matched-dot')) {
      dropTarget.classList.add('highlight');
    }
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
      if (word) {
        state.gameResults.push({ word: word.word, thai: word.thai, correct: true });
      }

      if (state.matched.size === WORDS_PER_GAME) {
        setTimeout(endGame, 500);
      }
    } else {
      state.wrongCount++;
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
    line.setAttribute('x1', p1.x);
    line.setAttribute('y1', p1.y);
    line.setAttribute('x2', p2.x);
    line.setAttribute('y2', p2.y);
    dom.linesSvg.appendChild(line);
  }

  function drawWrongLine(leftRow, rightRow) {
    const p1 = getElementCenter(leftRow.querySelector('.speak-btn'));
    const p2 = getElementCenter(rightRow.querySelector('.drop-target'));
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('class', 'line-wrong');
    line.setAttribute('x1', p1.x);
    line.setAttribute('y1', p1.y);
    line.setAttribute('x2', p2.x);
    line.setAttribute('y2', p2.y);
    dom.linesSvg.appendChild(line);
    setTimeout(() => line.remove(), 800);
  }

  // ---------- End Game ----------
  function endGame() {
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
    if (percent === 100) {
      dom.resultTitle.textContent = '🏆 ยอดเยี่ยม! Perfect Score!';
    } else if (percent >= 80) {
      dom.resultTitle.textContent = '🎉 เก่งมาก!';
    } else if (percent >= 60) {
      dom.resultTitle.textContent = '👍 ดีมาก!';
    } else {
      dom.resultTitle.textContent = '💪 ลองใหม่อีกครั้งนะ!';
    }

    saveHighScore(state.score);
    showScreen('result');
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
        <span class="word-review-en">${index + 1}. ${item.word}</span>
        <span class="word-review-arrow">=</span>
        <span class="word-review-th">${item.thai}</span>
      `;
      dom.wordReviewList.appendChild(div);
    });
  }

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
    try {
      document.execCommand('copy');
    } catch (err) {
      console.error('❌ Fallback copy failed:', err);
    }
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
    dom.btnStart.addEventListener('click', () => {
      if (state.allWords.length < WORDS_PER_GAME) {
        alert('❌ คำศัพท์ไม่พอ (ต้องมีอย่างน้อย ' + WORDS_PER_GAME + ' คำ)');
        return;
      }
      renderLearnScreen();
      showScreen('learn');
    });

    dom.btnGoGame.addEventListener('click', () => {
      startNewGame();
    });

    dom.btnRestart.addEventListener('click', () => {
      startNewGame();
    });

    dom.btnHome.addEventListener('click', () => {
      renderHighScore();
      showScreen('start');
    });

    if (dom.btnShare) {
      dom.btnShare.addEventListener('click', shareResult);
    }
  }

  // ---------- Init ----------
  async function init() {
    renderHighScore();
    TTS.init();
    await loadWords();
    setupDragListeners();
    bindEvents();
    console.log('✅ เกมพร้อมใช้งาน');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
