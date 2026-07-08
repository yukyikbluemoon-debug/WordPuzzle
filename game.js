/* =========================================================
   Word Match Puzzle - Game Logic (Fixed Version)
   ========================================================= */

(() => {
  'use strict';

  // ---------- ค่าคงที่ ----------
  const WORDS_PER_GAME = 20;
  const POINTS_PER_CORRECT = 10;
  const STORAGE_KEY = 'wordPuzzleHighScore';

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

  // ---------- Text To Speech ----------
  function speak(text) {
    if (!('speechSynthesis' in window)) {
      alert('❌ เบราว์เซอร์นี้ไม่รองรับ Text To Speech');
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'en-US';
    utter.rate = 0.9;
    utter.pitch = 1.1;
    window.speechSynthesis.speak(utter);
  }

  // ---------- Learn Screen ----------
  function renderLearnScreen() {
    dom.learnList.innerHTML = '';
    state.currentWords.forEach(w => {
      const item = document.createElement('div');
      item.className = 'learn-item';
      item.innerHTML = `<button class="speak-btn" aria-label="ฟังเสียง">🔊</button><div class="word-text"><div class="en">${w.word}</div><div class="th">${w.thai}</div></div>`;
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
    row.innerHTML = `<button class="speak-btn" aria-label="ฟังเสียง">🔊</button><div class="word-text">${word.word}</div>`;
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
    row.innerHTML = `<div class="word-text">${word.thai}</div>`;
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
    return { x: e.clientX, y: e.clientY };
  }

  function onPointerDown(e) {
    let target = e.target;
    if (target.tagName === 'TEXT') target = target.parentElement;
    
    const btn = target.closest('.speak-btn');
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

    const coords = getClientCoords(e);
    state.startX = coords.x;
    state.startY = coords.y;

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
      drawPermanentLine(leftRow, rightRow);
      updateScoreUI();

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
    const p2 = getElementCenter(rightRow);
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
    const p2 = getElementCenter(rightRow);
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

    dom.finalScore.textContent = state.score;
    dom.totalScore.textContent = total;
    dom.correctCount.textContent = correct;
    dom.wrongCount.textContent = wrong;
    dom.finalTime.textContent = formatTime(elapsed);

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

  // ---------- Event Listeners ----------
  function bindEvents() {
    dom.btnStart.addEventListener('click', () => {
      console.log('🔵 ปุ่มเริ่มเกมถูกกด');
      console.log('📚 จำนวนคำศัพท์:', state.allWords.length);
      
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