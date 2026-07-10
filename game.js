// ==================== GAME VARIABLES ====================
let allWords = [];
let currentWords = [];
let matchedWords = [];
let wrongWordsList = [];
let currentScore = 0;
let totalScore = 0;
let elapsedTime = 0;
let timerInterval = null;
let startTime = null;
let selectedLeft = null;
let selectedRight = null;
let isDrawing = false;
let highScore = parseInt(localStorage.getItem('highScore')) || 0;

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
  console.log('🎮 Initializing game...');
  
  // Load words
  loadWords();
  
  // Setup event listeners
  setupEventListeners();
  
  // Display high score
  document.getElementById('high-score').textContent = highScore;
});

// Load words from JSON
async function loadWords() {
  try {
    const response = await fetch('data/words.json', { cache: 'no-store' });
    const res = await fetch('data/words.json', { cache: 'no-store' });
    allWords = await response.json();
    console.log(`✅ โหลดคำศัพท์สำเร็จ: ${allWords.length} คำ`);
    console.log('✅ เกมพร้อมใช้งาน');
  } catch (error) {
    console.error('❌ โหลดคำศัพท์ไม่สำเร็จ:', error);
  }
}

// Setup event listeners
function setupEventListeners() {
  // Start button
  document.getElementById('btn-start').addEventListener('click', () => {
    showScreen('screen-learn');
    showLearnScreen();
  });

  // Go to game button
  document.getElementById('btn-go-game').addEventListener('click', () => {
    showScreen('screen-game');
    startGame();
  });

  // Restart button
  document.getElementById('btn-restart').addEventListener('click', () => {
    showScreen('screen-learn');
    showLearnScreen();
  });

  // Share button
  document.getElementById('btn-share').addEventListener('click', shareResult);

  // Home button
  document.getElementById('btn-home').addEventListener('click', () => {
    showScreen('screen-start');
  });
}

// ==================== LEARN SCREEN ====================
function showLearnScreen() {
  // Select random 10 words
  currentWords = getRandomWords(allWords, 10);
  
  const learnList = document.getElementById('learn-list');
  learnList.innerHTML = '';
  
  currentWords.forEach((word, index) => {
    const item = document.createElement('div');
    item.className = 'learn-item';
    item.innerHTML = `
      <div class="learn-word">
        <span class="word-en">${word.en}</span>
        <span class="word-th">${word.th}</span>
      </div>
      <button class="btn-sound" onclick="speakWord('${word.en}')">🔊</button>
    `;
    learnList.appendChild(item);
  });
}

// Speak word using TTS
function speakWord(text) {
  if ('speechSynthesis' in window) {
    // Cancel any ongoing speech
    speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.8;
    
    // Try to use local voice
    const voices = speechSynthesis.getVoices();
    const localVoice = voices.find(v => v.localService && v.lang.startsWith('en'));
    if (localVoice) {
      utterance.voice = localVoice;
    }
    
    speechSynthesis.speak(utterance);
  }
}

// ==================== GAME LOGIC ====================
function startGame() {
  // Reset game state
  matchedWords = [];
  wrongWordsList = [];
  currentScore = 0;
  elapsedTime = 0;
  startTime = Date.now();
  
  // Update UI
  document.getElementById('score').textContent = '0';
  document.getElementById('timer').textContent = '00:00';
  document.getElementById('progress').textContent = `0/${currentWords.length}`;
  
  // Start timer
  startTimer();
  
  // Render game
  renderGame();
}

function startTimer() {
  if (timerInterval) clearInterval(timerInterval);
  
  timerInterval = setInterval(() => {
    elapsedTime = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(elapsedTime / 60);
    const seconds = elapsedTime % 60;
    document.getElementById('timer').textContent = 
      `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }, 1000);
}

function renderGame() {
  const leftList = document.getElementById('left-list');
  const rightList = document.getElementById('right-list');
  
  leftList.innerHTML = '';
  rightList.innerHTML = '';
  
  // Shuffle words for display
  const shuffledLeft = [...currentWords].sort(() => Math.random() - 0.5);
  const shuffledRight = [...currentWords].sort(() => Math.random() - 0.5);
  
  // Render left column (English)
  shuffledLeft.forEach(word => {
    const item = document.createElement('div');
    item.className = 'word-item left-item';
    item.dataset.word = word.en;
    item.textContent = word.en;
    item.addEventListener('click', () => selectLeft(item, word.en));
    leftList.appendChild(item);
  });
  
  // Render right column (Thai)
  shuffledRight.forEach(word => {
    const item = document.createElement('div');
    item.className = 'word-item right-item';
    item.dataset.word = word.th;
    item.textContent = word.th;
    item.addEventListener('click', () => selectRight(item, word.th));
    rightList.appendChild(item);
  });
}

function selectLeft(element, word) {
  if (element.classList.contains('matched')) return;
  
  // Remove previous selection
  document.querySelectorAll('.left-item').forEach(item => {
    item.classList.remove('selected');
  });
  
  element.classList.add('selected');
  selectedLeft = { element, word };
  
  checkMatch();
}

function selectRight(element, word) {
  if (element.classList.contains('matched')) return;
  
  // Remove previous selection
  document.querySelectorAll('.right-item').forEach(item => {
    item.classList.remove('selected');
  });
  
  element.classList.add('selected');
  selectedRight = { element, word };
  
  checkMatch();
}

function checkMatch() {
  if (!selectedLeft || !selectedRight) return;
  
  const leftWord = selectedLeft.word;
  const rightWord = selectedRight.word;
  
  // Find matching pair
  const match = currentWords.find(w => w.en === leftWord && w.th === rightWord);
  
  if (match) {
    // Correct match
    selectedLeft.element.classList.add('matched', 'correct');
    selectedRight.element.classList.add('matched', 'correct');
    
    matchedWords.push(match);
    currentScore += 10;
    
    // Update UI
    document.getElementById('score').textContent = currentScore;
    document.getElementById('progress').textContent = `${matchedWords.length}/${currentWords.length}`;
    
    // Draw line
    drawLine(selectedLeft.element, selectedRight.element, 'correct');
    
    // Check if game is complete
    if (matchedWords.length === currentWords.length) {
      setTimeout(endGame, 500);
    }
  } else {
    // Wrong match
    selectedLeft.element.classList.add('wrong');
    selectedRight.element.classList.add('wrong');
    
    wrongWordsList.push({ en: leftWord, th: rightWord });
    
    // Draw wrong line
    drawLine(selectedLeft.element, selectedRight.element, 'wrong');
    
    // Remove wrong animation after delay
    setTimeout(() => {
      selectedLeft.element.classList.remove('selected', 'wrong');
      selectedRight.element.classList.remove('selected', 'wrong');
      clearLines();
    }, 1000);
  }
  
  // Reset selection
  selectedLeft = null;
  selectedRight = null;
}

function drawLine(leftElement, rightElement, type) {
  const svg = document.getElementById('lines-svg');
  const leftRect = leftElement.getBoundingClientRect();
  const rightRect = rightElement.getBoundingClientRect();
  const gameArea = document.getElementById('game-area').getBoundingClientRect();
  
  const x1 = leftRect.right - gameArea.left;
  const y1 = leftRect.top + leftRect.height / 2 - gameArea.top;
  const x2 = rightRect.left - gameArea.left;
  const y2 = rightRect.top + rightRect.height / 2 - gameArea.top;
  
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', x1);
  line.setAttribute('y1', y1);
  line.setAttribute('x2', x2);
  line.setAttribute('y2', y2);
  line.setAttribute('stroke', type === 'correct' ? '#4CAF50' : '#f44336');
  line.setAttribute('stroke-width', '3');
  line.setAttribute('class', `line-${type}`);
  
  svg.appendChild(line);
}

function clearLines() {
  const svg = document.getElementById('lines-svg');
  svg.querySelectorAll('.line-wrong').forEach(line => line.remove());
}

// ==================== END GAME ====================
async function endGame() {
  console.log('🏁 endGame() called');
  
  // Stop timer
  if (timerInterval) clearInterval(timerInterval);
  
  // Calculate final score
  totalScore = currentWords.length * 10;
  const finalScore = currentScore;
  const correctCount = matchedWords.length;
  const wrongCount = wrongWordsList.length;
  
  console.log('📊 Game stats:', { finalScore, correctCount, wrongCount, elapsedTime });
  
  // Update high score
  if (finalScore > highScore) {
    highScore = finalScore;
    localStorage.setItem('highScore', highScore);
    document.getElementById('high-score').textContent = highScore;
  }
  
  // Display result
  document.getElementById('final-score').textContent = finalScore;
  document.getElementById('total-score').textContent = totalScore;
  document.getElementById('correct-count').textContent = correctCount;
  document.getElementById('wrong-count').textContent = wrongCount;
  
  const minutes = Math.floor(elapsedTime / 60);
  const seconds = elapsedTime % 60;
  document.getElementById('final-time').textContent = 
    `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  
  // Display datetime
  const now = new Date();
  document.getElementById('result-datetime-text').textContent = 
    now.toLocaleString('th-TH', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  
  // Display word review
  const reviewList = document.getElementById('word-review-list');
  reviewList.innerHTML = '';
  currentWords.forEach(word => {
    const item = document.createElement('div');
    item.className = 'review-item';
    const isCorrect = matchedWords.some(m => m.en === word.en);
    item.innerHTML = `
      <span class="review-en">${word.en}</span>
      <span class="review-th">${word.th}</span>
      <span class="review-status">${isCorrect ? '✅' : '❌'}</span>
    `;
    reviewList.appendChild(item);
  });
  
  // Show result screen
  showScreen('screen-result');
  
  // ==================== SAVE TO SUPABASE ====================
  console.log('🔍 Checking if Supabase functions are available...');
  console.log('typeof getCurrentUser:', typeof getCurrentUser);
  console.log('typeof saveGameStats:', typeof saveGameStats);
  console.log('typeof updateUserProgress:', typeof updateUserProgress);
  
  // Check if user is logged in
  const currentUser = getCurrentUser();
  console.log('👤 Current user:', currentUser);
  
  if (!currentUser) {
    console.warn('⚠️ No user logged in, skipping save');
    return;
  }
  
  if (typeof saveGameStats !== 'function') {
    console.error('❌ saveGameStats function not found');
    return;
  }
  
  try {
    console.log('📊 Saving game stats to Supabase...');
    
    // Save game stats
    const wrongWordsArray = wrongWordsList.map(w => w.en);
    console.log('📝 Data to save:', {
      userId: currentUser.id,
      score: finalScore,
      wordsMatched: correctCount,
      wrongWords: wrongWordsArray,
      timeSpent: elapsedTime
    });
    
    const result = await saveGameStats(finalScore, correctCount, wrongWordsArray, elapsedTime);
    console.log('✅ Save result:', result);
    
    if (!result.success) {
      console.error('❌ Save failed:', result.message);
      return;
    }
    
    // Update XP
    const newXP = currentUser.xp + finalScore;
    const newLevel = Math.floor(newXP / 1000) + 1;
    
    console.log('📈 Updating XP:', { 
      userId: currentUser.id,
      oldXP: currentUser.xp, 
      newXP, 
      newLevel 
    });
    
    const updateResult = await updateUserProgress(newLevel, newXP);
    console.log('✅ Update result:', updateResult);
    
    // Update user info bar
    if (typeof updateUserInfoBar === 'function') {
      updateUserInfoBar();
    }
    
    console.log('✅ Game stats saved successfully!');
  } catch (error) {
    console.error('💥 Error saving game stats:', error);
    console.error('Error stack:', error.stack);
  }
}

// ==================== SHARE ====================
function shareResult() {
  const text = `🎮 Word Match Puzzle\n` +
    `📊 คะแนน: ${currentScore}/${totalScore}\n` +
    `✅ ถูก: ${matchedWords.length} คำ\n` +
    `❌ ผิด: ${wrongWordsList.length} คำ\n` +
    `⏱️ เวลา: ${document.getElementById('final-time').textContent}\n` +
    `\nมาเล่นด้วยกัน!`;
  
  if (navigator.share) {
    navigator.share({
      title: 'Word Match Puzzle',
      text: text
    }).catch(err => console.log('Share cancelled'));
  } else {
    // Fallback: copy to clipboard
    navigator.clipboard.writeText(text).then(() => {
      alert('คัดลอกผลลัพธ์แล้ว!');
    });
  }
}

// ==================== UTILITIES ====================
function getRandomWords(words, count) {
  const shuffled = [...words].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
}
