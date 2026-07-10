// ==================== AUTHENTICATION SYSTEM ====================

// Login or Register
async function loginOrRegister(playerName, pin) {
  // Validate input
  if (!playerName || playerName.trim().length === 0) {
    return { success: false, message: 'กรุณาใส่ชื่อผู้เล่น' };
  }
  
  if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
    return { success: false, message: 'PIN ต้องเป็นตัวเลข 4 หลัก' };
  }
  
  playerName = playerName.trim();
  
  // Check if user exists with this name + pin
  const { data: existingUser, error: queryError } = await supabase
    .from('users')
    .select('*')
    .eq('name', playerName)
    .eq('pin', pin)
    .single();
  
  if (existingUser) {
    // Login success
    setCurrentUser(existingUser);
    return { success: true, user: existingUser, message: 'เข้าสู่ระบบสำเร็จ' };
  }
  
  // Check if name exists but pin is wrong
  const { data: userWithSameName, error: nameCheckError } = await supabase
    .from('users')
    .select('*')
    .eq('name', playerName)
    .single();
  
  if (userWithSameName) {
    return { success: false, message: 'ชื่อนี้มีอยู่แล้ว แต่ PIN ผิด!' };
  }
  
  // Create new user
  const { data: newUser, error: createError } = await supabase
    .from('users')
    .insert({
      name: playerName,
      pin: pin
    })
    .select()
    .single();
  
  if (createError) {
    console.error('Create user error:', createError);
    return { success: false, message: 'สร้างผู้ใช้ไม่สำเร็จ: ' + createError.message };
  }
  
  setCurrentUser(newUser);
  return { success: true, user: newUser, message: 'สร้างผู้ใช้ใหม่สำเร็จ' };
}

// Set current user in localStorage
function setCurrentUser(user) {
  localStorage.setItem('currentUserId', user.id);
  localStorage.setItem('currentUserName', user.name);
  localStorage.setItem('currentUserLevel', user.level || 1);
  localStorage.setItem('currentUserXP', user.xp || 0);
}

// Get current user
function getCurrentUser() {
  const userId = localStorage.getItem('currentUserId');
  if (!userId) return null;
  
  return {
    id: userId,
    name: localStorage.getItem('currentUserName'),
    level: parseInt(localStorage.getItem('currentUserLevel')) || 1,
    xp: parseInt(localStorage.getItem('currentUserXP')) || 0
  };
}

// Logout
function logout() {
  localStorage.removeItem('currentUserId');
  localStorage.removeItem('currentUserName');
  localStorage.removeItem('currentUserLevel');
  localStorage.removeItem('currentUserXP');
}

// Check if user is logged in
function isLoggedIn() {
  return !!localStorage.getItem('currentUserId');
}

// ==================== GAME STATS ====================

// Save game stats after game ends
async function saveGameStats(score, wordsMatched, wrongWords, timeSpent) {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    console.error('Not logged in');
    return { success: false, message: 'ยังไม่ได้เข้าสู่ระบบ' };
  }
  
  const { error } = await supabase
    .from('game_stats')
    .insert({
      user_id: currentUser.id,
      score: score,
      words_matched: wordsMatched,
      wrong_words: wrongWords || [],
      time_spent: timeSpent
    });
  
  if (error) {
    console.error('Save stats error:', error);
    return { success: false, message: error.message };
  }
  
  return { success: true, message: 'บันทึกสถิติสำเร็จ' };
}

// Get all stats for current user
async function getUserStats() {
  const currentUser = getCurrentUser();
  if (!currentUser) return [];
  
  const { data, error } = await supabase
    .from('game_stats')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('played_at', { ascending: false });
  
  if (error) {
    console.error('Get stats error:', error);
    return [];
  }
  
  return data || [];
}

// Update user level and XP
async function updateUserProgress(newLevel, newXP) {
  const currentUser = getCurrentUser();
  if (!currentUser) return { success: false };
  
  const { error } = await supabase
    .from('users')
    .update({
      level: newLevel,
      xp: newXP
    })
    .eq('id', currentUser.id);
  
  if (!error) {
    localStorage.setItem('currentUserLevel', newLevel);
    localStorage.setItem('currentUserXP', newXP);
    return { success: true };
  }
  
  return { success: false };
}

// ==================== LEADERBOARD ====================

// Get top 10 players by XP
async function getLeaderboard() {
  const { data, error } = await supabase
    .from('users')
    .select('name, level, xp')
    .order('xp', { ascending: false })
    .limit(10);
  
  if (error) {
    console.error('Get leaderboard error:', error);
    return [];
  }
  
  return data || [];
}

// ==================== STATISTICS ====================

// Get detailed statistics for current user
async function getDetailedStats() {
  const stats = await getUserStats();
  
  if (stats.length === 0) {
    return {
      totalGames: 0,
      totalWordsMatched: 0,
      avgScore: 0,
      avgTime: 0,
      bestScore: 0,
      wrongWordsFrequency: {}
    };
  }
  
  const totalGames = stats.length;
  const totalWordsMatched = stats.reduce((sum, s) => sum + s.words_matched, 0);
  const avgScore = Math.round(stats.reduce((sum, s) => sum + s.score, 0) / totalGames);
  const avgTime = Math.round(stats.reduce((sum, s) => sum + s.time_spent, 0) / totalGames);
  const bestScore = Math.max(...stats.map(s => s.score));
  
  // Count wrong words frequency
  const wrongWordsFrequency = {};
  stats.forEach(s => {
    if (s.wrong_words) {
      s.wrong_words.forEach(word => {
        wrongWordsFrequency[word] = (wrongWordsFrequency[word] || 0) + 1;
      });
    }
  });
  
  return {
    totalGames,
    totalWordsMatched,
    avgScore,
    avgTime,
    bestScore,
    wrongWordsFrequency
  };
}
