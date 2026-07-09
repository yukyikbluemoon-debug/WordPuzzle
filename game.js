// ============================================================
// game.js - Word Puzzle Game (แก้ไข Speech Synthesis)
// ============================================================

// ---------- ตัวแปรสถานะเกม ----------
let words = [];
let currentWordIndex = 0;
let score = 0;
let totalWords = 0;
let isGameStarted = false;
let isSpeaking = false;
let selectedVoice = null;
let voicesLoaded = false;

// DOM Elements
const wordDisplay = document.getElementById('wordDisplay');
const scrambledDisplay = document.getElementById('scrambledDisplay');
const inputField = document.getElementById('inputField');
const submitBtn = document.getElementById('submitBtn');
const nextBtn = document.getElementById('nextBtn');
const scoreDisplay = document.getElementById('scoreDisplay');
const totalDisplay = document.getElementById('totalDisplay');
const messageDiv = document.getElementById('message');
const startBtn = document.getElementById('startBtn');
const speakerBtn = document.getElementById('speakerBtn');
const progressBar = document.getElementById('progressBar');

// ---------- การโหลดเสียง (Speech Synthesis) ----------
function loadVoices() {
    return new Promise((resolve) => {
        // ถ้ามีเสียงอยู่แล้ว
        if (window.speechSynthesis && speechSynthesis.getVoices().length > 0) {
            selectVoice();
            voicesLoaded = true;
            resolve();
            return;
        }

        // ฟัง event เมื่อ voices โหลดเสร็จ
        if (window.speechSynthesis) {
            speechSynthesis.onvoiceschanged = () => {
                selectVoice();
                voicesLoaded = true;
                resolve();
            };
            // fallback: ถ้า event ไม่ทำงานภายใน 3 วินาที
            setTimeout(() => {
                if (!voicesLoaded) {
                    selectVoice();
                    voicesLoaded = true;
                    resolve();
                }
            }, 3000);
        } else {
            // เบราว์เซอร์ไม่รองรับ
            console.warn('❌ เบราว์เซอร์ไม่รองรับ Speech Synthesis');
            voicesLoaded = true;
            resolve();
        }
    });
}

function selectVoice() {
    const voices = speechSynthesis.getVoices();
    // เลือกเสียงภาษาอังกฤษที่ชัดเจน (优先 US, UK)
    selectedVoice = voices.find(v => v.lang.startsWith('en-US')) ||
                    voices.find(v => v.lang.startsWith('en-GB')) ||
                    voices.find(v => v.lang.startsWith('en')) ||
                    voices[0] || null;
    if (selectedVoice) {
        console.log('✅ ใช้เสียง:', selectedVoice.name, selectedVoice.lang);
    } else {
        console.warn('⚠️ ไม่พบเสียงที่เหมาะสม ใช้ค่าเริ่มต้น');
    }
}

// ---------- ฟังก์ชันพูด (เรียกโดยตรงเมื่อผู้ใช้คลิก) ----------
function speak(text, callback) {
    if (!window.speechSynthesis) {
        console.warn('❌ เบราว์เซอร์ไม่รองรับ Speech Synthesis');
        if (callback) callback();
        return;
    }

    // ยกเลิกการพูดค้าง
    speechSynthesis.cancel();

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'en-US';
    utter.rate = 0.9;
    utter.pitch = 1;

    if (selectedVoice) {
        utter.voice = selectedVoice;
    }

    utter.onend = () => {
        console.log('✅ พูดจบ:', text);
        isSpeaking = false;
        if (callback) callback();
    };

    utter.onerror = (e) => {
        console.error('❌ Speech error:', e.error || e);
        isSpeaking = false;
        // ถ้า error อาจเป็นเพราะ voices ยังไม่พร้อม หรือเบราว์เซอร์บล็อก
        // ลองเล่นซ้ำอีกครั้งโดยไม่ต้องเปลี่ยนเสียง
        if (e.error === 'synthesis-failed' || e.error === 'not-allowed') {
            console.warn('🔄 ลองพูดซ้ำอีกครั้งใน 500ms...');
            setTimeout(() => {
                if (!isSpeaking) {
                    speechSynthesis.speak(utter);
                }
            }, 500);
        } else {
            if (callback) callback();
        }
    };

    // เริ่มพูดทันที (ต้องอยู่ในการกระทำของผู้ใช้)
    isSpeaking = true;
    speechSynthesis.speak(utter);
}

// ---------- ฟังก์ชันเกม ----------
function shuffleWord(word) {
    const arr = word.split('');
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.join('');
}

function loadWord(index) {
    if (index >= words.length) {
        // จบเกม
        messageDiv.textContent = '🎉 คุณทำสำเร็จ!';
        nextBtn.disabled = true;
        submitBtn.disabled = true;
        inputField.disabled = true;
        return;
    }
    const wordObj = words[index];
    wordDisplay.textContent = wordObj.word;
    scrambledDisplay.textContent = shuffleWord(wordObj.word);
    inputField.value = '';
    inputField.focus();
    messageDiv.textContent = '';
    submitBtn.disabled = false;
    nextBtn.disabled = true;
    updateProgress();
}

function updateProgress() {
    const progress = totalWords > 0 ? (currentWordIndex / totalWords) * 100 : 0;
    progressBar.style.width = progress + '%';
    progressBar.textContent = Math.round(progress) + '%';
    scoreDisplay.textContent = score;
    totalDisplay.textContent = totalWords;
}

function checkAnswer() {
    const userAnswer = inputField.value.trim().toLowerCase();
    const correct = words[currentWordIndex].word.toLowerCase();
    if (userAnswer === correct) {
        score++;
        messageDiv.textContent = '✅ ถูกต้อง!';
        messageDiv.style.color = 'green';
        submitBtn.disabled = true;
        nextBtn.disabled = false;
        // เล่นเสียงคำที่ถูกต้อง (เฉพาะเมื่อผู้ใช้กด submit ซึ่งเป็นการโต้ตอบ)
        // แต่เพื่อไม่ให้รบกวน太多, เราให้ speak ถูกเรียกตอนกดปุ่ม speaker แทน
        // หรือจะเล่นเสียงอัตโนมัติ? ตามที่แจ้งไว้ ควรให้ผู้ใช้กด speaker
    } else {
        messageDiv.textContent = '❌ ลองใหม่!';
        messageDiv.style.color = 'red';
        inputField.value = '';
        inputField.focus();
    }
    updateProgress();
}

function nextWord() {
    currentWordIndex++;
    if (currentWordIndex < words.length) {
        loadWord(currentWordIndex);
    } else {
        loadWord(currentWordIndex); // แสดงจบเกม
    }
}

// ---------- เริ่มเกม ----------
async function startGame() {
    console.log('🔵 ปุ่มเริ่มเกมถูกกด');
    if (isGameStarted) return;

    // โหลดเสียงก่อน (ถ้ายังไม่โหลด)
    if (!voicesLoaded) {
        await loadVoices();
    }

    // สุ่มคำศัพท์
    const shuffled = [...words];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    words = shuffled;
    totalWords = words.length;
    currentWordIndex = 0;
    score = 0;
    isGameStarted = true;

    startBtn.disabled = true;
    startBtn.textContent = 'กำลังเล่น...';
    inputField.disabled = false;
    submitBtn.disabled = false;

    loadWord(currentWordIndex);
    updateProgress();
    console.log(`✅ เริ่มเกมด้วย ${totalWords} คำ`);
}

// ---------- Event Listeners ----------
document.addEventListener('DOMContentLoaded', async () => {
    // โหลดคำศัพท์
    try {
        const response = await fetch('data/words.json');
        const data = await response.json();
        words = data.words || [];
        console.log(`✅ โหลดคำศัพท์สำเร็จ: ${words.length} คำ`);
    } catch (error) {
        console.error('❌ โหลดคำศัพท์ล้มเหลว:', error);
        messageDiv.textContent = 'เกิดข้อผิดพลาดในการโหลดคำศัพท์';
        return;
    }

    // โหลดเสียงเตรียมไว้ (ไม่ต้องรอ)
    loadVoices();

    // UI เตรียมพร้อม
    totalDisplay.textContent = words.length;
    scoreDisplay.textContent = 0;
    startBtn.disabled = false;
    inputField.disabled = true;
    submitBtn.disabled = true;
    nextBtn.disabled = true;

    console.log('✅ เกมพร้อมใช้งาน');
});

// ปุ่มเริ่มเกม
startBtn.addEventListener('click', startGame);

// ปุ่มส่งคำตอบ
submitBtn.addEventListener('click', checkAnswer);

// กด Enter ในช่อง input
inputField.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        if (!submitBtn.disabled) {
            checkAnswer();
        }
    }
});

// ปุ่มถัดไป
nextBtn.addEventListener('click', nextWord);

// ปุ่มลำโพง - พูดคำปัจจุบัน (เรียกตรงๆ ไม่มี delay)
speakerBtn.addEventListener('click', () => {
    if (!isGameStarted || currentWordIndex >= words.length) {
        messageDiv.textContent = '⚠️ ยังไม่มีคำให้พูด';
        return;
    }
    const word = words[currentWordIndex].word;
    // เรียก speak ทันที (เป็นการโต้ตอบโดยตรง)
    speak(word, () => {
        // callback เมื่อพูดจบ (ไม่ต้องทำอะไร)
    });
});

// ---------- เพิ่มเติม: จัดการกรณีเบราว์เซอร์ปิดเสียง ----------
// ถ้าไม่มีการโต้ตอบ, เบราว์เซอร์อาจ pause speech synthesis
// เราสามารถ resume ได้เมื่อคลิกที่ใดก็ได้ในหน้า
document.addEventListener('click', () => {
    if (window.speechSynthesis && speechSynthesis.paused) {
        speechSynthesis.resume();
        console.log('▶️ Resume speech synthesis');
    }
});

// ถ้าเบราว์เซอร์เปลี่ยนหน้า, หยุดพูด
window.addEventListener('beforeunload', () => {
    if (window.speechSynthesis) {
        speechSynthesis.cancel();
    }
});

console.log('✅ game.js โหลดเสร็จ (เวอร์ชันแก้ไขเสียง)');
