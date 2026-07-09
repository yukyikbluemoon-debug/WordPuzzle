/* =========================================================
   Word Match Puzzle - Game Logic (Final Version with Review)
   ========================================================= */

(() => {
  'use strict';

  // ---------- ค่าคงที่ ----------
  const WORDS_PER_GAME = 10;
  const POINTS_PER_CORRECT = 10;
  const STORAGE_KEY = 'wordPuzzleHighScore';

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
    isDrawing: false,
    drawingLine: null,
    dragStartId: null,
    dragStartEl: null,
    gameDateTime: null,
    gameResults: [] // เก็บผลลัพธ์แต่ละคำ
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
    highScore:     $('high-score'),
    btnStart:      $('btn-start'),
    btnGoGame:     $('btn-go-game'),
    learnList:     $('learn-list'),
    timer:         $('timer'),
    score:         $('score'),
    progress:      $('progress'),
    leftList:      $('left-list'),
    rightList:     $('right-list'),
    linesSvg:      $('lines-svg'),
    gameArea:      $('game-area'),
    finalScore:    $('final-score'),
    totalScore:    $('total-score'),
    correctCount:  $('correct-count'),
    wrongCount:    $('wrong-count'),
    finalTime:     $('final-time'),
    resultTitle:   $('result-title'),
    resultDateTime: $('result-datetime-text'),
    wordReviewList: $('word-review-list'),
    btnRestart:    $('btn-restart'),
    btnHome:       $('btn-home')
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
      const res = await fetch('data/words.json');
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

// ---------- Text To Speech (FIXED for Mobile) ----------
let voicesLoaded = false;
let availableVoices = [];

// โหลด voices ล่วงหน้า
function loadVoices() {
  availableVoices = window.speechSynthesis.getVoices();
  if (availableVoices.length > 0) {
    voicesLoaded = true;
    console.log(`✅ โหลดเสียงสำเร็จ: ${availableVoices.length} voices`);
  }
}

// เรียกทันทีถ้าพร้อม
if ('speechSynthesis' in window) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

function speak(text) {
  if (!('speechSynthesis' in window)) {
    alert('❌ เบราว์เซอร์นี้ไม่รองรับ Text To Speech');
    return;
  }

  // หยุดการพูดก่อนหน้า
  window.speechSynthesis.cancel();
  
  // สร้าง utterance
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'en-US';
  utter.rate = 0.9;
  utter.pitch = 1.1;
  utter.volume = 1.0;

  // เลือก voice en-US ที่ดีที่สุด
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    // ลำดับความสำคัญ: en-US → en-GB → en → ภาษาอื่น
    const voice = voices.find(v => v.lang === 'en-US' && v.localService) ||
                  voices.find(v => v.lang === 'en-US') ||
                  voices.find(v => v.lang.startsWith('en-US')) ||
                  voices.find(v => v.lang.startsWith('en')) ||
                  voices.find(v => v.default);
    if (voice) {
      utter.voice = voice;
      console.log(`🔊 ใช้เสียง: ${voice.name} (${voice.lang})`);
    }
  }

  // Error handling
  utter.onerror = (e) => {
    console.error('❌ TTS Error:', e.error, e);
  };
  
  utter.onend = () => {
    console.log('✅ พูดจบแล้ว');
  };

  // พูด
  window.speechSynthesis.speak(utter);
  console.log(`🔊 กำลังพูด: "${text}"`);

  // Chrome bug fix: resume ถ้าหยุดกลางคัน
  setTimeout(() => {
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.resume();
    }
  }, 100);
}
  // ---------- Learn Screen ----------
  function renderLearnScreen() {
    dom.learnList.innerHTML = '';
    state.currentWords.forEach(w => {
      const item = document.createElement('div');
      item.className = 'learn-item';
      item.innerHTML = `
        <button class="speak-btn" aria-label="ฟังเสียง">${SPEAKER_SVG}</button>
        <div class="word-text">
          <div class="en">${w.word}</div>
          <div class="th">${w.thai}</div>
        </div>
      `;
      item.querySelector('.speak-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        speak(w.word);
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
    state.gameResults = []; // รีเซ็ตผลลัพธ์

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
    row.innerHTML = `
      <div class="word-text">${word.word}</div>
      <button class="speak-btn" aria-label="ฟังเสียง">${SPEAKER_SVG}</button>
    `;
    const btn = row.querySelector('.speak-btn');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      speak(word.word);
    });
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

  // ---------- Drag & Drop Matching ----------
  function setupDragListeners() {
    const area = dom.gameArea;

    area.addEventListener('mousedown', onPointerDown);
    area.addEventListener('touchstart', onPointerDown, { passive: false });

    area.addEventListener('mousemove', onPointerMove);
    area.addEventListener('touchmove', onPointerMove, { passive: false });

    area.addEventListener('mouseup', onPointerUp);
    area.addEventListener('touchend', onPointerUp);
    area.addEventListener('touchcancel', onPointerUp);
  }

  function getClientCoords(e) {
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    if (e.changedTouches && e.changedTouches.length > 0) {
      return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  }

  function onPointerDown(e) {
    const btn = e.target.closest('.speak-btn');
    if (!btn) return;

    const row = btn.closest('.word-row');
    if (!row || row.dataset.side !== 'left') return;
    if (row.classList.contains('matched')) return;

    e.preventDefault();
    e.stopPropagation();

    state.isDrawing = true;
    state.dragStartId = row.dataset.id;
    state.dragStartEl = btn;
    btn.classList.add('dragging');

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

  function onPointerMove(e) {
    if (!state.isDrawing || !state.drawingLine) return;
    e.preventDefault();

    const coords = getClientCoords(e);
    const areaRect = dom.gameArea.getBoundingClientRect();

    const x2 = coords.x - areaRect.left;
    const y2 = coords.y - areaRect.top;

    state.drawingLine.setAttribute('x2', x2);
    state.drawingLine.setAttribute('y2', y2);

    highlightNearestDropTarget(coords.x, coords.y);
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

  function onPointerUp(e) {
    if (!state.isDrawing) return;
    state.isDrawing = false;

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

    const coords = getClientCoords(e);

    dom.linesSvg.style.display = 'none';
    const target = document.elementFromPoint(coords.x, coords.y);
    dom.linesSvg.style.display = 'block';

    const rightRow = target?.closest?.('.word-row[data-side="right"]');

    if (rightRow) {
      const leftId = state.dragStartId;
      const rightId = rightRow.dataset.id;
      handleMatch(leftId, rightId, rightRow);
    }

    state.dragStartId = null;
    state.dragStartEl = null;
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

    for (const [lid, rid] of state.matched.entries()) {
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

      // บันทึกผล: ถูก
      const word = state.currentWords.find(w => w.id === leftId);
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

    // บันทึกวันที่เวลา
    state.gameDateTime = new Date();

    dom.finalScore.textContent = state.score;
    dom.totalScore.textContent = total;
    dom.correctCount.textContent = correct;
    dom.wrongCount.textContent = wrong;
    dom.finalTime.textContent = formatTime(elapsed);

    // แสดงวันที่เวลา
    dom.resultDateTime.textContent = formatDateTime(state.gameDateTime);

    // แสดงรายการคำศัพท์
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

    // เรียงตามลำดับที่เล่น (ถูกก่อน แล้วค่อยผิด)
    const sortedResults = [
      ...state.gameResults.filter(r => r.correct),
      ...state.currentWords.filter(w => !state.gameResults.find(r => r.word === w.word)).map(w => ({ word: w.word, thai: w.thai, correct: false }))
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

  // ---------- Event Listeners ----------
  function bindEvents() {
    dom.btnStart.addEventListener('click', () => {
      console.log('🔵 ปุ่มเริ่มเกมถูกกด');
      console.log(' จำนวนคำศัพท์:', state.allWords.length);

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
  }

  // ---------- Init ----------
  async function init() {
    renderHighScore();
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
