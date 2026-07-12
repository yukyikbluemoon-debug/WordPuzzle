# 🎯 Word Match Puzzle

เกมฝึกคำศัพท์ภาษาอังกฤษ-ไทยแบบ Interactive สำหรับเด็กและผู้ที่สนใจสอบ TOEFL / IELTS / TOEIC — ลากจับคู่คำศัพท์, สะสม XP ไต่เลเวล, แข่งอันดับกับเพื่อน และมีโหมดพิเศษ **Sunday Boss Rush** ทุกวันอาทิตย์

![PWA](https://img.shields.io/badge/PWA-Enabled-brightgreen)
![Backend](https://img.shields.io/badge/Backend-Supabase-3ecf8e)
![License](https://img.shields.io/badge/License-MIT-blue)

## 🌟 ฟีเจอร์

### 🎮 การเล่นเกม
- **ลากจับคู่คำศัพท์** — ลากเส้นจากคำอังกฤษฝั่งซ้ายไปจับคู่กับคำแปลไทยฝั่งขวา ใช้ Pointer Events รองรับทั้งเมาส์และนิ้วในโค้ดชุดเดียว
- **ฟังเสียงคำศัพท์** — แตะไอคอนลำโพงเพื่อฟังเสียงอ่าน (Web Speech API) แยกการ "แตะฟังเสียง" กับ "ลากจับคู่" ออกจากกันชัดเจน ไม่ชนกันบนมือถือ
- **ระบบคะแนน** — ตอบถูกได้ 10 คะแนนต่อคำ (คำบอสได้คะแนนคูณเพิ่ม ดูหัวข้อ Boss Rush)
- **จับเวลา** และสรุปผลแบบทวนคำที่ตอบถูก/ผิดหลังเล่นจบทุกครั้ง
- **แชร์ผลลัพธ์** ผ่าน Web Share API (เปิด share sheet ของมือถือได้ทันที) พร้อม fallback คัดลอกข้อความบนเดสก์ท็อป

### 📚 ระบบหมวดคำศัพท์ (679 คำ)
คำศัพท์แบ่งเป็น 3 ระดับ อ่านจาก `data/words.json`:

| หมวด | จำนวน | อธิบาย |
|---|---|---|
| 🟢 ธรรมดา | 289 คำ | เจอได้ทุกวัน คำศัพท์พื้นฐานในชีวิตประจำวัน |
| ⭐ พิเศษ (TOEFL/IELTS) | 250 คำ | คำวิชาการ โผล่บ่อยขึ้นตามเลเวลผู้เล่น |
| 👑 บอส (TOEIC) | 140 คำ | คำธุรกิจ **เจอเฉพาะวันอาทิตย์เท่านั้น** |

### 🔥 Sunday Boss Rush
ทุกวันอาทิตย์ ทั้งเว็บเปลี่ยนธีมเป็นขอบทอง/แดงเรืองแสง คำบอส (TOEIC) จะปรากฏบนกระดาน — ตอบถูกติดกันจะได้ **คอมโบคูณคะแนน 1.5x → 2x → 2.5x → 3x** พลาดคำบอสคอมโบรีเซ็ต และระบบจะเลือกคำบอสแบบถ่วงน้ำหนัก โดยให้น้ำหนักคำที่ผู้เล่นเคยตอบผิดบ่อยมีโอกาสเจอสูงกว่า (ไม่ใช่สุ่มล้วน)

### 👤 บัญชีผู้เล่น
- ล็อกอินง่ายๆ ด้วย **ชื่อ + PIN** ผ่าน Supabase (ไม่มีชื่อนี้มาก่อน = สมัครอัตโนมัติ)
- หรือเล่นแบบ **Guest** ได้โดยไม่ต้องสมัคร (บันทึกความคืบหน้าไว้ใน localStorage ของเครื่องนั้น)
- จำ session ไว้อัตโนมัติ ไม่ต้องล็อกอินใหม่ทุกครั้งที่เปิดเว็บ

### ⭐ XP / Level
เล่นจบเกมได้ XP = คะแนนที่ทำได้ + โบนัส (ไม่ตอบผิดเลย +30, จบภายใน 45 วิ +20) ยิ่งเลเวลสูงยิ่งต้องใช้ XP มากขึ้นในการอัปเลเวลถัดไป

### 🏆 อันดับ (Leaderboard) + โปรไฟล์สาธารณะ
- หน้าแรกและหน้าสรุปผลโชว์ Top 10 ผู้เล่น พร้อมบอกอันดับของตัวเอง
- **กดที่ชื่อใครในลีดเดอร์บอร์ดก็ได้** เพื่อดูโปรไฟล์ของคนนั้น (เลเวล, XP, สถิติสะสม, ประวัติการเล่นล่าสุด 10 เกม) เหมือนดูโปรไฟล์ตัวเอง

### 🏅 Achievement (เหรียญตรา)
13 เหรียญให้สะสม เช่น Perfect Score, ผู้พิชิตบอส, สายคอมโบ, นักวิชาการ, สายฟ้าแลบ (จบเกมไว), ไต่เลเวล 5/10/20 ฯลฯ — ปลดล็อกแล้วจะมีแบนเนอร์แจ้งเตือนที่หน้าสรุปผล ดูเหรียญทั้งหมดได้จากป้าย 🏅 คู่กับหัวข้อ Rank ทั้งหน้าแรกและหน้าสรุปผล

### 📱 PWA
ติดตั้งเป็นแอปบนมือถือได้ (manifest.json + ไอคอน) ธีม "Neon Arcade" ฟอนต์ Chakra Petch (หัวข้อ/ตัวเลข) + Sarabun (เนื้อหาไทย)

## 🗂️ โครงสร้างไฟล์

```
WordPuzzle/
├── index.html          # โครงหน้าเว็บทั้งหมด (auth/start/learn/game/result/achievements/profile)
├── game.js              # โค้ดเกมทั้งหมด: auth, xp/level, matching, TTS, leaderboard, achievements
├── style.css            # ธีม Neon Arcade ทั้งหมด
├── manifest.json         # PWA manifest
├── data/
│   └── words.json        # คลังคำศัพท์ 679 คำ (มี field tier/exam/level)
└── images/icon/          # ไอคอนแอป
```

## 🧱 Data schema (`data/words.json`)

```json
{
  "id": 1008,
  "word": "define",
  "thai": "นิยาม",
  "category": "วิชาการ",
  "tier": "special",
  "exam": "TOEFL",
  "level": 2
}
```
- `tier`: `"normal"` | `"special"` | `"boss"` — กำหนดว่าเจอบ่อยแค่ไหน/วันไหน
- `exam`: `null` | `"TOEFL"` | `"IELTS"` | `"TOEIC"` — ใช้แสดงผลเฉยๆ ไม่กระทบ logic
- `level`: ตัวเลข 1-5 ใช้ประกอบการคำนวณความยาก (ปัจจุบัน logic หลักอิงจากเลเวลผู้เล่น ไม่ใช่ level ของคำ)

## 🚀 ติดตั้งใช้งาน

### 1. Clone โปรเจกต์
```bash
git clone https://github.com/yukyikbluemoon-debug/WordPuzzle.git
cd WordPuzzle
```

### 2. ตั้งค่า Supabase
สร้างโปรเจกต์ที่ [supabase.com](https://supabase.com) แล้วรัน SQL นี้ใน SQL Editor:

```sql
-- ตาราง users (เก็บชื่อ + PIN + xp/level + สถิติสะสม)
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  pin TEXT NOT NULL,
  level INTEGER DEFAULT 1,
  xp INTEGER DEFAULT 0,
  stats JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ตาราง game_stats (ประวัติการเล่นแต่ละเกม)
CREATE TABLE game_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  words_matched INTEGER NOT NULL,
  wrong_words TEXT[],
  time_spent INTEGER NOT NULL,
  played_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on users"
  ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on game_stats"
  ON game_stats FOR ALL USING (true) WITH CHECK (true);
```

จากนั้นเปิด `game.js` แก้ 2 บรรทัดบนสุดให้ตรงกับโปรเจกต์ของตัวเอง (หน้า Project Settings → API):
```js
const SUPABASE_URL = 'https://xxxxxxxxxxxx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_xxxxxxxxxxxxxxxxxxxx';
```

### 3. รันในเครื่อง
เปิด `index.html` ตรงๆ ได้เลย หรือรันเซิร์ฟเวอร์เล็กๆ เช่น:
```bash
npx serve .
```

### 4. Deploy
รองรับ static hosting ทั่วไป (GitHub Pages, Netlify, Vercel) ไฟล์ทุกไฟล์เป็น static ล้วน ไม่มี build step

## ⚠️ ข้อควรรู้ (โปรเจกต์เล็กๆ เล่นกันเอง)
Policy ของ Supabase ที่ตั้งไว้เปิดให้ **ทุกคนที่มี anon key อ่าน/แก้ข้อมูลในตาราง `users` ได้ทั้งหมด** รวมถึง PIN ที่เก็บเป็น plain text — เหมาะกับการเล่นกันเองในกลุ่มเพื่อน/ครอบครัว ถ้าจะใช้งานสาธารณะวงกว้างขึ้น ควรปรับ RLS policy และเข้ารหัส PIN ก่อน

## 🛠️ เทคโนโลยีที่ใช้
- Vanilla JavaScript (ไม่มี framework/build step)
- [Supabase](https://supabase.com) — Auth (ชื่อ+PIN แบบกำหนดเอง), Database, Leaderboard
- Web Speech API — Text-to-Speech
- Pointer Events API — ลาก/แตะแบบรองรับทั้งเมาส์และมือถือในโค้ดเดียว
- Google Fonts: Chakra Petch, Sarabun

## 📄 License
MIT
