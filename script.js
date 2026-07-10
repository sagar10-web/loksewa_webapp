/**
 * LOKSEWA MCQ APP - APPLICATION CONTROLLER
 * Architecture: Class-based modular design using Vanilla ES6
 * Author: Antigravity Code Assistant
 */

/* ==========================================================================
   1. SOUND MANAGER (WEB AUDIO API SYNTHESIS)
   ========================================================================== */
class SoundManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        console.warn("Web Audio API not supported in this browser.", e);
      }
    }
    // Resume context if suspended (browser security policy)
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTone(freq, duration, type = 'sine', volume = 0.05) {
    if (!this.enabled || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();
      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);
      
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gainNode.gain.setValueAtTime(volume, this.ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
      
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      console.warn("Error playing audio tone:", e);
    }
  }

  playClick() {
    this.init();
    this.playTone(600, 0.08, 'sine', 0.03);
  }

  playCorrect() {
    this.init();
    // Harmonious major third chime
    this.playTone(523.25, 0.15, 'sine', 0.05); // C5
    setTimeout(() => {
      this.playTone(659.25, 0.2, 'sine', 0.05); // E5
    }, 80);
  }

  playIncorrect() {
    this.init();
    // Low, buzzy, slightly dissonant tone
    if (!this.enabled || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();
      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, this.ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(80, this.ctx.currentTime + 0.25);
      
      gainNode.gain.setValueAtTime(0.04, this.ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 0.25);
      
      osc.start();
      osc.stop(this.ctx.currentTime + 0.25);
    } catch (e) {
      console.warn(e);
    }
  }

  playLevelUp() {
    this.init();
    // Ascending arpeggio
    const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, 0.25, 'sine', 0.06);
      }, idx * 100);
    });
  }
}

/* ==========================================================================
   2. STORAGE MANAGER (LOCALSTORAGE & DATA MANAGEMENT)
   ========================================================================== */
class StorageManager {
  constructor() {
    this.storageKey = 'loksewa_mcq_data';
    this.defaultState = {
      xp: 0,
      level: 1,
      streak: 0,
      lastLoginDate: null,
      completedQuestions: {}, // Map of qId: { correct: boolean, timestamp: number }
      bookmarks: [], // Array of question IDs
      wrongAnswers: [], // Array of question IDs (for revision review)
      highScores: {
        practice: 0,
        mock: 0
      },
      achievements: [], // Array of earned achievement IDs
      settings: {
        sound: true,
        highContrast: false,
        animations: true,
        fontSize: 'small'
      }
    };
    this.state = this.loadState();
  }

  loadState() {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        const parsed = JSON.parse(data);
        // Deep merge default state structures for backwards compatibility
        return {
          ...this.defaultState,
          ...parsed,
          settings: { ...this.defaultState.settings, ...parsed.settings },
          highScores: { ...this.defaultState.highScores, ...parsed.highScores }
        };
      }
    } catch (e) {
      console.error("Failed to parse LocalStorage data. Initializing defaults.", e);
    }
    return { ...this.defaultState };
  }

  saveState() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.state));
    } catch (e) {
      console.error("Failed to write to LocalStorage.", e);
    }
  }

  resetProgress() {
    this.state = {
      ...this.defaultState,
      settings: { ...this.state.settings } // Keep settings intact
    };
    this.saveState();
  }

  addXP(amount) {
    this.state.xp += amount;
    // Calculate Level Up: e.g., 500 XP per level
    const newLevel = Math.floor(this.state.xp / 500) + 1;
    let leveledUp = false;
    if (newLevel > this.state.level) {
      this.state.level = newLevel;
      leveledUp = true;
    }
    this.saveState();
    return { leveledUp, currentLevel: this.state.level };
  }

  recordAnswer(qId, correct) {
    const prevAnswer = this.state.completedQuestions[qId];
    this.state.completedQuestions[qId] = {
      correct,
      timestamp: Date.now()
    };

    // Keep track of wrong answers specifically for revision
    if (!correct) {
      if (!this.state.wrongAnswers.includes(qId)) {
        this.state.wrongAnswers.push(qId);
      }
    } else {
      // Remove from wrong answers list if answered correctly
      this.state.wrongAnswers = this.state.wrongAnswers.filter(id => id !== qId);
    }

    this.saveState();
    // Return if it was the first time answering this question
    return !prevAnswer;
  }

  toggleBookmark(qId) {
    const index = this.state.bookmarks.indexOf(qId);
    let added = false;
    if (index === -1) {
      this.state.bookmarks.push(qId);
      added = true;
    } else {
      this.state.bookmarks.splice(index, 1);
    }
    this.saveState();
    return added;
  }

  isBookmarked(qId) {
    return this.state.bookmarks.includes(qId);
  }

  checkStreak() {
    const today = new Date().toDateString();
    const lastLogin = this.state.lastLoginDate;

    if (lastLogin) {
      const lastDate = new Date(lastLogin);
      const todayDate = new Date(today);
      const diffTime = Math.abs(todayDate - lastDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        // Daily streak continues
        this.state.streak += 1;
      } else if (diffDays > 1) {
        // Streak broken
        this.state.streak = 1;
      }
    } else {
      // First login ever
      this.state.streak = 1;
    }
    this.state.lastLoginDate = today;
    this.saveState();
  }

  unlockAchievement(achId) {
    if (!this.state.achievements.includes(achId)) {
      this.state.achievements.push(achId);
      this.saveState();
      return true;
    }
    return false;
  }
}

/* ==========================================================================
   3. QUESTION ENGINE (LOADING, SEARCHING & FILTERING)
   ========================================================================== */
class QuestionEngine {
  constructor() {
    this.questions = [];
    this.categories = [];
    this.loadQuestions();
  }

  loadQuestions() {
    // Collect questions from variables defined in easy.js, medium.js, hard.js, expert.js
    const easy = typeof easyQuestions !== 'undefined' ? easyQuestions : [];
    const medium = typeof mediumQuestions !== 'undefined' ? mediumQuestions : [];
    const hard = typeof hardQuestions !== 'undefined' ? hardQuestions : [];
    const expert = typeof expertQuestions !== 'undefined' ? expertQuestions : [];
    
    this.questions = [...easy, ...medium, ...hard, ...expert];

    // Extract unique categories
    const catSet = new Set(this.questions.map(q => q.category));
    this.categories = Array.from(catSet).sort();
    
    console.log(`QuestionEngine initialized. Total questions loaded: ${this.questions.length}`);
  }

  getQuestions(filters = {}) {
    let filtered = [...this.questions];

    if (filters.difficulty && filters.difficulty !== 'All') {
      filtered = filtered.filter(q => q.difficulty.toLowerCase() === filters.difficulty.toLowerCase());
    }

    if (filters.category && filters.category !== 'All') {
      filtered = filtered.filter(q => q.category === filters.category);
    }

    if (filters.search) {
      const qLower = filters.search.toLowerCase();
      filtered = filtered.filter(q => q.question.toLowerCase().includes(qLower));
    }

    if (filters.bookmarkedIds) {
      filtered = filtered.filter(q => filters.bookmarkedIds.includes(q.id));
    }

    if (filters.wrongAnswerIds) {
      filtered = filtered.filter(q => filters.wrongAnswerIds.includes(q.id));
    }

    if (filters.random) {
      this.shuffle(filtered);
    }

    if (filters.limit) {
      filtered = filtered.slice(0, filters.limit);
    }

    return filtered;
  }

  getDailyChallenge(count = 10) {
    // Generate a pseudo-random seed using today's date string
    const todayStr = new Date().toDateString();
    let seed = 0;
    for (let i = 0; i < todayStr.length; i++) {
      seed += todayStr.charCodeAt(i);
    }

    // Custom seeded random number generator
    const randomSeeded = () => {
      const x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
    };

    // Shallow copy and shuffle with seeded random
    const pool = [...this.questions];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(randomSeeded() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    return pool.slice(0, count);
  }

  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  getQuestionById(id) {
    return this.questions.find(q => q.id === id);
  }
}

/* ==========================================================================
   4. CONFETTI ANIMATION ENGINE
   ========================================================================== */
class ConfettiEngine {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.colors = ['#6366f1', '#a855f7', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];
    this.particles = [];
    this.active = false;
    
    window.addEventListener('resize', () => {
      if (this.canvas) {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
      }
    });
  }

  start(durationMs = 2500) {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.active = true;
    this.particles = [];
    
    // Spawn initial particle burst
    for (let i = 0; i < 150; i++) {
      this.particles.push(this.createParticle());
    }

    const draw = () => {
      if (!this.active) return;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      
      this.particles.forEach((p, idx) => {
        p.y += p.vy;
        p.x += p.vx;
        p.vy += 0.1; // gravity
        p.rotation += p.rotationSpeed;
        
        this.ctx.save();
        this.ctx.translate(p.x, p.y);
        this.ctx.rotate(p.rotation);
        this.ctx.fillStyle = p.color;
        this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        this.ctx.restore();
        
        // Remove offscreen particles
        if (p.y > this.canvas.height) {
          this.particles[idx] = this.createParticle(true); // respawn at top
        }
      });
      
      requestAnimationFrame(draw);
    };
    
    draw();
    
    setTimeout(() => {
      this.active = false;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }, durationMs);
  }

  createParticle(fromTop = false) {
    return {
      x: Math.random() * this.canvas.width,
      y: fromTop ? -20 : Math.random() * this.canvas.height * 0.4,
      size: Math.random() * 8 + 6,
      color: this.colors[Math.floor(Math.random() * this.colors.length)],
      vx: Math.random() * 4 - 2,
      vy: Math.random() * 5 + 2,
      rotation: Math.random() * Math.PI,
      rotationSpeed: Math.random() * 0.1 - 0.05
    };
  }
}

/* ==========================================================================
   5. MAIN APPLICATION CONTROLLER
   ========================================================================== */
class LoksewaApp {
  constructor() {
    this.sound = new SoundManager();
    this.storage = new StorageManager();
    this.engine = new QuestionEngine();
    this.confetti = new ConfettiEngine('confetti-canvas');

    // Quiz Session Variables
    this.activeQuestions = [];
    this.currentQuestionIdx = 0;
    this.answersState = {}; // { qIdx: selectedOptionIdx }
    this.isExamMode = false;
    this.timeSpent = 0;
    this.timerInterval = null;
    this.timerLimit = 60; // 60 seconds per question in timed exam mode
    this.timeLeft = 0;
    
    // Config filters selected state
    this.selectedPracticeCategory = 'All';
    this.selectedPracticeDifficulty = 'All';

    this.init();
  }

  init() {
    // 1. Sync Settings on Load
    this.applySettings();
    
    // 2. Check Daily Streak
    this.storage.checkStreak();
    
    // 3. Register Event Listeners
    this.registerEvents();
    
    // 4. Populate Static View Components
    this.updateDashboardStats();
    this.renderCategoryChips();
    this.renderCategoryDropdowns();
    this.renderLeaderboard();
    
    // 5. Setup Keyboard Navigation Shortcut Listener
    this.setupKeyboardShortcuts();
    
    // Display Welcome Toast
    this.showToast(`🔥 Welcome back! Day ${this.storage.state.streak} streak active.`, 'info');
  }

  applySettings() {
    const s = this.storage.state.settings;
    this.sound.enabled = s.sound;
    
    // High contrast mode
    document.body.classList.toggle('high-contrast-mode', s.highContrast);
    
    // Theme setup on start (system sync)
    if (localStorage.getItem('theme') === 'light') {
      document.body.classList.remove('dark-theme');
      document.body.classList.add('light-theme');
      document.getElementById('theme-toggle').innerHTML = '<span class="icon">☀️</span>';
    } else {
      document.body.classList.add('dark-theme');
      document.body.classList.remove('light-theme');
      document.getElementById('theme-toggle').innerHTML = '<span class="icon">🌙</span>';
    }

    // Font Scaling classes
    document.body.classList.remove('font-medium', 'font-large');
    if (s.fontSize === 'medium') {
      document.body.classList.add('font-medium');
    } else if (s.fontSize === 'large') {
      document.body.classList.add('font-large');
    }
    
    // Sync Settings checkboxes in UI modal
    document.getElementById('settings-sound-toggle').checked = s.sound;
    document.getElementById('settings-contrast-toggle').checked = s.highContrast;
    document.getElementById('settings-animation-toggle').checked = s.animations;
    
    // Font Group UI buttons
    document.querySelectorAll('.font-selector button').forEach(b => {
      b.classList.toggle('active', b.dataset.font === s.fontSize);
    });
  }

  registerEvents() {
    // -- Navigation Button Listeners --
    const showScreen = (screenId) => {
      this.sound.playClick();
      document.querySelectorAll('.view-screen').forEach(s => s.classList.remove('active'));
      document.getElementById(screenId).classList.add('active');
      window.scrollTo(0, 0);
    };

    // Brand Logo -> Home
    document.getElementById('brand-logo').addEventListener('click', () => {
      this.stopExamTimer();
      showScreen('home-screen');
    });

    // Home Action Cards
    document.getElementById('card-practice').addEventListener('click', () => {
      this.selectedPracticeCategory = 'All';
      this.selectedPracticeDifficulty = 'All';
      this.updateSelectionScreenChips();
      showScreen('selection-screen');
    });

    document.getElementById('card-category').addEventListener('click', () => {
      this.selectedPracticeCategory = 'All';
      this.selectedPracticeDifficulty = 'All';
      this.updateSelectionScreenChips();
      showScreen('selection-screen');
    });

    document.getElementById('card-mock').addEventListener('click', () => {
      showScreen('mock-setup-screen');
    });

    // Daily Challenge
    document.getElementById('card-daily').addEventListener('click', () => {
      this.startDailyChallengeSession();
    });

    // Back to Home actions
    document.getElementById('back-to-home-selection').addEventListener('click', () => showScreen('home-screen'));
    document.getElementById('back-to-home-mock').addEventListener('click', () => showScreen('home-screen'));

    // Details stats navigation
    document.getElementById('view-all-stats-btn').addEventListener('click', () => {
      // Direct notification helper for advanced statistics review
      const completed = Object.keys(this.storage.state.completedQuestions).length;
      this.showToast(`📊 Completed: ${completed} questions. Keep practicing to unlock badges!`, 'info');
    });

    // Settings Modal controls
    document.getElementById('settings-btn').addEventListener('click', () => {
      this.sound.playClick();
      document.getElementById('settings-modal').classList.add('active');
    });

    document.getElementById('close-settings-modal').addEventListener('click', () => {
      this.sound.playClick();
      document.getElementById('settings-modal').classList.remove('active');
    });

    document.getElementById('settings-modal').addEventListener('click', (e) => {
      if (e.target === document.getElementById('settings-modal')) {
        document.getElementById('settings-modal').classList.remove('active');
      }
    });

    // -- Settings Toggles Sync --
    document.getElementById('settings-sound-toggle').addEventListener('change', (e) => {
      this.storage.state.settings.sound = e.target.checked;
      this.storage.saveState();
      this.applySettings();
      this.sound.playClick();
    });

    document.getElementById('settings-contrast-toggle').addEventListener('change', (e) => {
      this.storage.state.settings.highContrast = e.target.checked;
      this.storage.saveState();
      this.applySettings();
      this.sound.playClick();
    });

    document.getElementById('settings-animation-toggle').addEventListener('change', (e) => {
      this.storage.state.settings.animations = e.target.checked;
      this.storage.saveState();
      this.applySettings();
      this.sound.playClick();
    });

    // Font selection buttons
    document.querySelectorAll('.font-selector button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.storage.state.settings.fontSize = e.target.dataset.font;
        this.storage.saveState();
        this.applySettings();
        this.sound.playClick();
      });
    });

    // Theme toggle
    document.getElementById('theme-toggle').addEventListener('click', () => {
      const body = document.body;
      this.sound.playClick();
      if (body.classList.contains('dark-theme')) {
        body.classList.remove('dark-theme');
        body.classList.add('light-theme');
        localStorage.setItem('theme', 'light');
        document.getElementById('theme-toggle').innerHTML = '<span class="icon">☀️</span>';
      } else {
        body.classList.remove('light-theme');
        body.classList.add('dark-theme');
        localStorage.setItem('theme', 'dark');
        document.getElementById('theme-toggle').innerHTML = '<span class="icon">🌙</span>';
      }
    });

    // -- Data Backup Options --
    document.getElementById('export-progress-btn').addEventListener('click', () => {
      this.sound.playClick();
      const backup = JSON.stringify(this.storage.state, null, 2);
      const blob = new Blob([backup], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `loksewa_mcq_progress_backup_${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      this.showToast('📤 Progress backup downloaded successfully.', 'success');
    });

    document.getElementById('import-progress-btn').addEventListener('click', () => {
      this.sound.playClick();
      document.getElementById('import-file-input').click();
    });

    document.getElementById('import-file-input').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          if (parsed && typeof parsed.xp === 'number') {
            this.storage.state = parsed;
            this.storage.saveState();
            this.applySettings();
            this.updateDashboardStats();
            this.renderLeaderboard();
            this.showToast('📥 Backup imported and restored successfully!', 'success');
            document.getElementById('settings-modal').classList.remove('active');
          } else {
            this.showToast('⚠️ Invalid backup file format.', 'warning');
          }
        } catch (err) {
          this.showToast('❌ Failed to parse backup file.', 'warning');
        }
      };
      reader.readAsText(file);
    });

    document.getElementById('reset-progress-action').addEventListener('click', () => {
      if (confirm("⚠️ Are you absolutely sure you want to reset all your study stats, XP, level achievements, and bookmarks? This cannot be undone.")) {
        this.storage.resetProgress();
        this.applySettings();
        this.updateDashboardStats();
        this.renderLeaderboard();
        this.showToast('🔥 Application reset to factory defaults.', 'info');
        document.getElementById('settings-modal').classList.remove('active');
      }
    });

    document.getElementById('reset-leaderboard-btn').addEventListener('click', () => {
      this.sound.playClick();
      this.storage.state.xp = 0;
      this.storage.state.level = 1;
      this.storage.saveState();
      this.updateDashboardStats();
      this.renderLeaderboard();
      this.showToast('🏆 Leaderboard reset complete.', 'info');
    });

    // -- Practice Mode Setup Controls --
    // Difficulty choice buttons
    document.querySelectorAll('.difficulty-options .diff-option-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.sound.playClick();
        document.querySelectorAll('.difficulty-options .diff-option-btn').forEach(b => b.classList.remove('active'));
        const target = e.currentTarget;
        target.add = target.classList.add('active');
        this.selectedPracticeDifficulty = target.dataset.difficulty;
      });
    });

    document.getElementById('start-practice-action').addEventListener('click', () => {
      this.launchPracticeSession();
    });

    // -- Mock Test Setup controls --
    document.getElementById('launch-mock-exam').addEventListener('click', () => {
      this.launchMockSession();
    });

    // -- Quiz Screen Workflows --
    document.getElementById('quit-quiz-btn').addEventListener('click', () => {
      if (confirm("🚪 Exit the current session? Unsaved progress will be lost.")) {
        this.stopExamTimer();
        showScreen('home-screen');
      }
    });

    document.getElementById('tool-prev').addEventListener('click', () => {
      if (this.currentQuestionIdx > 0) {
        this.sound.playClick();
        this.navigateToQuestion(this.currentQuestionIdx - 1);
      }
    });

    document.getElementById('tool-next').addEventListener('click', () => {
      if (this.currentQuestionIdx < this.activeQuestions.length - 1) {
        this.sound.playClick();
        this.navigateToQuestion(this.currentQuestionIdx + 1);
      }
    });

    document.getElementById('tool-skip').addEventListener('click', () => {
      this.sound.playClick();
      // Record skip in answer states as undefined
      if (this.answersState[this.currentQuestionIdx] === undefined) {
        this.answersState[this.currentQuestionIdx] = null;
      }
      this.updatePaletteButton(this.currentQuestionIdx);
      
      // Auto advance
      if (this.currentQuestionIdx < this.activeQuestions.length - 1) {
        this.navigateToQuestion(this.currentQuestionIdx + 1);
      } else {
        this.showToast("📍 You've reached the last question. Submit the quiz when finished.", 'info');
      }
    });

    document.getElementById('tool-bookmark').addEventListener('click', () => {
      const q = this.activeQuestions[this.currentQuestionIdx];
      const added = this.storage.toggleBookmark(q.id);
      this.sound.playClick();
      this.updateBookmarkButtonState(q.id);
      this.updatePaletteButton(this.currentQuestionIdx);
      this.showToast(added ? "🔖 Question added to Bookmarks." : "🔖 Question removed from Bookmarks.", 'success');
    });

    document.getElementById('tool-hint').addEventListener('click', () => {
      this.sound.playClick();
      const q = this.activeQuestions[this.currentQuestionIdx];
      this.showToast(`💡 Hint: The correct answer is related to ${q.explanation.slice(0, 30)}...`, 'info');
    });

    // Submit Answer (In Practice Mode, or Submit Exam in Exam mode)
    document.getElementById('tool-submit').addEventListener('click', () => {
      if (!this.isExamMode) {
        this.evaluatePracticeAnswer();
      }
    });

    document.getElementById('palette-submit-exam-btn').addEventListener('click', () => {
      this.confirmAndSubmitExam();
    });

    // -- Results Page Actions --
    document.getElementById('btn-result-home').addEventListener('click', () => {
      showScreen('home-screen');
    });

    document.getElementById('btn-result-retry').addEventListener('click', () => {
      if (this.isExamMode) {
        this.launchMockSession(true); // Restart same params
      } else {
        this.launchPracticeSession();
      }
    });

    document.getElementById('btn-result-review-wrong').addEventListener('click', () => {
      // Launch custom review session using recorded wrong answers
      this.launchReviewSession();
    });
  }

  /* ==========================================================================
     6. UI RENDERERS (CHIPS, WIDGETS & STATS)
     ========================================================================== */
  renderCategoryChips() {
    const container = document.getElementById('category-chips-container');
    if (!container) return;
    container.innerHTML = '';
    
    // Add "All Categories" chip
    const allChip = document.createElement('div');
    allChip.className = 'category-chip active';
    allChip.dataset.category = 'All';
    allChip.textContent = 'All Categories';
    allChip.addEventListener('click', (e) => this.handleCategoryChipClick(e));
    container.appendChild(allChip);

    this.engine.categories.forEach(cat => {
      const chip = document.createElement('div');
      chip.className = 'category-chip';
      chip.dataset.category = cat;
      chip.textContent = cat;
      chip.addEventListener('click', (e) => this.handleCategoryChipClick(e));
      container.appendChild(chip);
    });
  }

  handleCategoryChipClick(e) {
    this.sound.playClick();
    document.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active'));
    e.target.classList.add('active');
    this.selectedPracticeCategory = e.target.dataset.category;
  }

  updateSelectionScreenChips() {
    document.querySelectorAll('.category-chip').forEach(c => {
      c.classList.toggle('active', c.dataset.category === this.selectedPracticeCategory);
    });
    document.querySelectorAll('.diff-option-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.difficulty === this.selectedPracticeDifficulty);
    });
  }

  renderCategoryDropdowns() {
    const select = document.getElementById('mock-category');
    if (!select) return;
    
    // Clear dynamic options while preserving "All Categories"
    select.innerHTML = '<option value="All">All Categories (Mixed)</option>';
    
    this.engine.categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      select.appendChild(opt);
    });
  }

  updateDashboardStats() {
    const s = this.storage.state;
    
    // Calculate stats
    const completedList = Object.keys(s.completedQuestions);
    const totalCompleted = completedList.length;
    let correctCount = 0;
    
    completedList.forEach(qId => {
      if (s.completedQuestions[qId].correct) correctCount++;
    });
    
    const wrongCount = totalCompleted - correctCount;
    const accuracy = totalCompleted > 0 ? Math.round((correctCount / totalCompleted) * 100) : 0;

    // Set text elements
    document.getElementById('streak-count').textContent = s.streak;
    document.getElementById('xp-count').textContent = `${s.xp} XP`;
    
    document.getElementById('hero-accuracy').textContent = `${accuracy}%`;
    document.getElementById('hero-level').textContent = `Level ${s.level}`;
    
    // Rank title logic
    let rankName = 'Aspirant';
    if (s.level >= 2 && s.level < 5) rankName = 'Section Officer';
    else if (s.level >= 5 && s.level < 10) rankName = 'Under Secretary';
    else if (s.level >= 10) rankName = 'Joint Secretary';
    document.getElementById('hero-rank-name').textContent = rankName;

    // Progress Level Bar
    // Formula: level-up threshold is level * 500 XP
    const prevLevelXP = (s.level - 1) * 500;
    const nextLevelXP = s.level * 500;
    const currentLevelXPProgress = s.xp - prevLevelXP;
    const xpNeededForLevel = nextLevelXP - prevLevelXP;
    
    const percent = Math.min(100, Math.max(0, Math.round((currentLevelXPProgress / xpNeededForLevel) * 100)));
    
    document.getElementById('progress-percent').textContent = `${percent}%`;
    document.getElementById('level-xp-progress').textContent = `${currentLevelXPProgress} / ${xpNeededForLevel} XP`;
    document.getElementById('dashboard-progress-fill').style.width = `${percent}%`;

    // Lower stats widget
    document.getElementById('stats-completed').textContent = totalCompleted;
    document.getElementById('stats-correct').textContent = correctCount;
    document.getElementById('stats-wrong').textContent = wrongCount;
    document.getElementById('stats-xp').textContent = `${s.xp} XP`;
  }

  renderLeaderboard() {
    const list = document.getElementById('leaderboard-list-container');
    if (!list) return;
    
    // Mock local competitors with different levels relative to player's progress
    const playerXP = this.storage.state.xp;
    const playerLevel = this.storage.state.level;
    
    let rankName = 'Aspirant';
    if (playerLevel >= 2 && playerLevel < 5) rankName = 'Officer';
    else if (playerLevel >= 5 && playerLevel < 10) rankName = 'Secretary';
    else if (playerLevel >= 10) rankName = 'Joint Sec';

    const localCompetitors = [
      { name: "Pradeep Gyawali (AI Bot)", xp: Math.max(3000, playerXP + 400), label: "Joint Sec" },
      { name: "Sushila Karki (AI Bot)", xp: Math.max(1800, playerXP - 200), label: "Under Sec" },
      { name: "Ram Shrestha (AI Bot)", xp: Math.max(600, playerXP - 800), label: "Officer" },
    ];

    // Add current user
    localCompetitors.push({ name: `You (${rankName})`, xp: playerXP, isSelf: true });
    
    // Sort descending
    localCompetitors.sort((a, b) => b.xp - a.xp);

    list.innerHTML = '';
    localCompetitors.forEach((c, idx) => {
      const div = document.createElement('div');
      div.className = `leaderboard-item ${c.isSelf ? 'current-user' : ''}`;
      
      div.innerHTML = `
        <span class="rank">#${idx + 1}</span>
        <span class="username">${c.name}</span>
        <span class="score">${c.xp} XP</span>
      `;
      list.appendChild(div);
    });
  }

  /* ==========================================================================
     7. QUIZ LAUNCH & SETUP CONTROLLERS
     ========================================================================== */
  launchPracticeSession() {
    const filters = {
      category: this.selectedPracticeCategory,
      difficulty: this.selectedPracticeDifficulty,
      random: true
    };
    
    const qs = this.engine.getQuestions(filters);
    if (qs.length === 0) {
      this.showToast("⚠️ No questions found matching those filters.", "warning");
      return;
    }

    this.activeQuestions = qs.slice(0, 20); // 20 questions default practice
    this.isExamMode = false;
    this.currentQuestionIdx = 0;
    this.answersState = {};
    this.timeSpent = 0;
    
    // Hide exam submittals and timer elements
    document.getElementById('palette-submit-exam-btn').classList.add('hidden');
    document.getElementById('score-correct-badge').classList.remove('hidden');
    document.getElementById('quiz-timer-container').classList.add('hidden');
    
    this.startQuiz();
  }

  launchMockSession(retrySame = false) {
    let count, category, difficulty, useTimer;
    
    if (retrySame && this.lastMockConfig) {
      count = this.lastMockConfig.count;
      category = this.lastMockConfig.category;
      difficulty = this.lastMockConfig.difficulty;
      useTimer = this.lastMockConfig.useTimer;
    } else {
      count = parseInt(document.getElementById('mock-question-count').value, 10);
      category = document.getElementById('mock-category').value;
      difficulty = document.getElementById('mock-difficulty').value;
      useTimer = document.getElementById('mock-timer-toggle').checked;
      
      // Save config for retry button
      this.lastMockConfig = { count, category, difficulty, useTimer };
    }

    const filters = {
      category,
      difficulty,
      random: true
    };

    const qs = this.engine.getQuestions(filters);
    if (qs.length === 0) {
      this.showToast("⚠️ No questions found matching those filters.", "warning");
      return;
    }

    this.activeQuestions = qs.slice(0, count);
    this.isExamMode = true;
    this.currentQuestionIdx = 0;
    this.answersState = {};
    this.timeSpent = 0;
    
    // Show palette exam submit
    document.getElementById('palette-submit-exam-btn').classList.remove('hidden');
    document.getElementById('score-correct-badge').classList.add('hidden');
    
    if (useTimer) {
      document.getElementById('quiz-timer-container').classList.remove('hidden');
      this.timeLeft = this.activeQuestions.length * 60; // 60s per question overall pool
      this.startExamTimer();
    } else {
      document.getElementById('quiz-timer-container').classList.add('hidden');
    }

    this.startQuiz();
  }

  launchReviewSession() {
    const wrongIds = this.storage.state.wrongAnswers;
    if (wrongIds.length === 0) {
      this.showToast("⭐ Excellent! You have no incorrect answers to review.", "success");
      return;
    }

    const qs = this.engine.getQuestions({ wrongAnswerIds: wrongIds, random: true });
    this.activeQuestions = qs.slice(0, 20); // Cap revision at 20 Qs per run
    this.isExamMode = false;
    this.currentQuestionIdx = 0;
    this.answersState = {};
    this.timeSpent = 0;
    
    document.getElementById('palette-submit-exam-btn').classList.add('hidden');
    document.getElementById('score-correct-badge').classList.remove('hidden');
    document.getElementById('quiz-timer-container').classList.add('hidden');
    
    this.startQuiz();
    this.showToast(`📚 Revision Mode: Evaluating ${this.activeQuestions.length} incorrect answers.`, 'info');
  }

  startDailyChallengeSession() {
    const qs = this.engine.getDailyChallenge();
    this.activeQuestions = qs;
    this.isExamMode = false;
    this.currentQuestionIdx = 0;
    this.answersState = {};
    this.timeSpent = 0;
    
    document.getElementById('palette-submit-exam-btn').classList.add('hidden');
    document.getElementById('score-correct-badge').classList.remove('hidden');
    document.getElementById('quiz-timer-container').classList.add('hidden');
    
    this.startQuiz();
    this.showToast(`🔥 Starting Daily Challenge! Double XP for correct answers.`, 'info');
  }

  startQuiz() {
    this.sound.playClick();
    
    // Hide screens, show quiz
    document.querySelectorAll('.view-screen').forEach(s => s.classList.remove('active'));
    document.getElementById('quiz-screen').classList.add('active');
    
    this.renderQuestionPalette();
    this.navigateToQuestion(0);
  }

  /* ==========================================================================
     8. QUIZ EXECUTION WORKSPACE
     ========================================================================== */
  navigateToQuestion(idx) {
    this.currentQuestionIdx = idx;
    const q = this.activeQuestions[idx];
    
    // Update labels and badges
    document.getElementById('current-question-num').textContent = idx + 1;
    document.getElementById('total-questions-num').textContent = this.activeQuestions.length;
    document.getElementById('quiz-category-badge').textContent = q.category;
    document.getElementById('quiz-difficulty-badge').textContent = q.difficulty;
    
    // Apply theme badges to difficulty
    const diffBadge = document.getElementById('quiz-difficulty-badge');
    diffBadge.className = 'badge';
    if (q.difficulty === 'Easy') diffBadge.classList.add('text-success');
    else if (q.difficulty === 'Medium') diffBadge.classList.add('text-info');
    else if (q.difficulty === 'Hard') diffBadge.classList.add('text-warning');
    else if (q.difficulty === 'Expert') diffBadge.classList.add('text-error');

    // Quiz workspace progress
    const pct = Math.round(((idx + 1) / this.activeQuestions.length) * 100);
    document.getElementById('quiz-progress-fill').style.width = `${pct}%`;

    // Render Question text
    document.getElementById('question-text-content').textContent = q.question;

    // Render option cards
    const grid = document.getElementById('options-grid');
    grid.innerHTML = '';
    
    const prefixes = ['A', 'B', 'C', 'D'];
    q.options.forEach((opt, oIdx) => {
      const card = document.createElement('div');
      card.className = 'option-card';
      card.dataset.index = oIdx;
      
      card.innerHTML = `
        <div class="option-prefix">${prefixes[oIdx]}</div>
        <div class="option-text">${opt}</div>
        <div class="option-shortcut">[${prefixes[oIdx]}]</div>
      `;

      // Options action click
      card.addEventListener('click', () => this.handleOptionClick(oIdx));
      grid.appendChild(card);
    });

    // Sync state for bookmark icon
    this.updateBookmarkButtonState(q.id);

    // Disable/Enable Nav buttons
    document.getElementById('tool-prev').disabled = (idx === 0);
    document.getElementById('tool-next').disabled = (idx === this.activeQuestions.length - 1);

    // Reset Explanation container view
    document.getElementById('explanation-container').classList.add('hidden');

    // Restore previously saved answer state if exists
    const savedAns = this.answersState[idx];
    
    if (this.isExamMode) {
      document.getElementById('tool-submit').style.display = 'none';
      if (savedAns !== undefined && savedAns !== null) {
        const activeCard = grid.querySelector(`.option-card[data-index="${savedAns}"]`);
        if (activeCard) activeCard.classList.add('selected');
      }
    } else {
      // Practice evaluation state restorals
      if (savedAns !== undefined && savedAns !== null) {
        // Show correct/incorrect directly
        this.evaluateOptionCards(savedAns, q.answer);
        this.showExplanation(q.explanation);
        document.getElementById('tool-submit').style.display = 'none';
      } else {
        document.getElementById('tool-submit').style.display = 'block';
        document.getElementById('tool-submit').disabled = true; // Disabled until selection
      }
    }

    // Active palette button marker sync
    document.querySelectorAll('.palette-btn').forEach(btn => btn.classList.remove('current'));
    const currentPaletteBtn = document.querySelector(`.palette-btn[data-idx="${idx}"]`);
    if (currentPaletteBtn) currentPaletteBtn.classList.add('current');
    
    // Update correct answer badge (Practice Mode only)
    if (!this.isExamMode) {
      const answeredCount = Object.keys(this.answersState).length;
      let correct = 0;
      Object.keys(this.answersState).forEach(k => {
        const qItem = this.activeQuestions[k];
        if (this.answersState[k] === qItem.answer) correct++;
      });
      const scoreBadge = document.getElementById('score-correct-badge');
      scoreBadge.textContent = `Correct: ${correct} / ${answeredCount}`;
    }
  }

  handleOptionClick(oIdx) {
    // If already evaluated in Practice Mode, ignore subsequent clicks
    if (!this.isExamMode && this.answersState[this.currentQuestionIdx] !== undefined) {
      return;
    }

    this.sound.playClick();
    
    const grid = document.getElementById('options-grid');
    grid.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
    
    const clickedCard = grid.querySelector(`.option-card[data-index="${oIdx}"]`);
    if (clickedCard) {
      clickedCard.classList.add('selected');
    }

    if (this.isExamMode) {
      // Save immediate state
      this.answersState[this.currentQuestionIdx] = oIdx;
      this.updatePaletteButton(this.currentQuestionIdx);
    } else {
      // Highlight submit button
      const submitBtn = document.getElementById('tool-submit');
      submitBtn.disabled = false;
      this.tempSelectedOption = oIdx;
    }
  }

  evaluatePracticeAnswer() {
    const idx = this.currentQuestionIdx;
    const q = this.activeQuestions[idx];
    const selected = this.tempSelectedOption;
    
    if (selected === undefined) return;
    
    // Save state
    this.answersState[idx] = selected;
    
    // Audio feedbacks & storage accumulation
    const isCorrect = (selected === q.answer);
    if (isCorrect) {
      this.sound.playCorrect();
      // Practice double XP check for daily challenge
      const xpMultiplier = this.activeQuestions.length === 10 ? 20 : 10;
      const { leveledUp, currentLevel } = this.storage.addXP(xpMultiplier);
      if (leveledUp) {
        this.sound.playLevelUp();
        this.confetti.start(3000);
        this.showToast(`🏆 LEVEL UP! You reached Level ${currentLevel}!`, 'success');
      }
      this.showToast(`✔️ Correct! +${xpMultiplier} XP`, 'success');
    } else {
      this.sound.playIncorrect();
      this.showToast(`❌ Incorrect. Review explanation.`, 'warning');
    }

    // Save evaluation to local database
    this.storage.recordAnswer(q.id, isCorrect);
    this.updateDashboardStats();

    // Redraw Option cards styles
    this.evaluateOptionCards(selected, q.answer);
    
    // Reveal Explanation
    this.showExplanation(q.explanation);
    
    // Sync sidebar state
    this.updatePaletteButton(idx);
    
    document.getElementById('tool-submit').style.display = 'none';
  }

  evaluateOptionCards(selected, correctIdx) {
    const grid = document.getElementById('options-grid');
    grid.querySelectorAll('.option-card').forEach(c => {
      c.classList.add('disabled');
      const cardIdx = parseInt(c.dataset.index, 10);
      if (cardIdx === correctIdx) {
        c.classList.add('correct');
      } else if (cardIdx === selected) {
        c.classList.add('incorrect');
      }
    });
  }

  showExplanation(text) {
    const container = document.getElementById('explanation-container');
    const textContent = document.getElementById('explanation-text-content');
    
    textContent.textContent = text;
    container.classList.remove('hidden');
  }

  updateBookmarkButtonState(qId) {
    const isB = this.storage.isBookmarked(qId);
    document.getElementById('bookmark-icon').textContent = isB ? '⭐' : '🔖';
  }

  /* ==========================================================================
     9. TIMER & MAP PALETTE HANDLERS
     ========================================================================== */
  startExamTimer() {
    this.stopExamTimer();
    this.timerInterval = setInterval(() => {
      this.timeLeft--;
      this.timeSpent++;
      
      const mins = Math.floor(this.timeLeft / 60);
      const secs = this.timeLeft % 60;
      
      const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      const element = document.getElementById('quiz-timer-text');
      if (element) {
        element.textContent = timeStr;
        // Turn text red if time is low
        element.classList.toggle('text-error', this.timeLeft < 30);
      }

      if (this.timeLeft <= 0) {
        this.stopExamTimer();
        this.showToast("⏳ Time is up! Submitting exam automatically.", "warning");
        this.submitExamResults();
      }
    }, 1000);
  }

  stopExamTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  renderQuestionPalette() {
    const container = document.getElementById('palette-grid-container');
    if (!container) return;
    container.innerHTML = '';

    this.activeQuestions.forEach((q, idx) => {
      const btn = document.createElement('button');
      btn.className = 'palette-btn';
      btn.dataset.idx = idx;
      btn.textContent = idx + 1;
      
      // Sync color states
      this.applyPaletteBtnColor(btn, idx);

      btn.addEventListener('click', () => {
        this.sound.playClick();
        this.navigateToQuestion(idx);
      });
      container.appendChild(btn);
    });
  }

  updatePaletteButton(idx) {
    const btn = document.querySelector(`.palette-btn[data-idx="${idx}"]`);
    if (btn) {
      this.applyPaletteBtnColor(btn, idx);
    }
  }

  applyPaletteBtnColor(btn, idx) {
    const ans = this.answersState[idx];
    const q = this.activeQuestions[idx];
    const isBookmarked = this.storage.isBookmarked(q.id);

    btn.className = 'palette-btn';
    
    if (idx === this.currentQuestionIdx) {
      btn.classList.add('current');
    }

    if (ans !== undefined && ans !== null) {
      btn.classList.add('answered');
    } else if (isBookmarked) {
      btn.classList.add('flagged');
    }
  }

  confirmAndSubmitExam() {
    const totalQ = this.activeQuestions.length;
    const answeredCount = Object.keys(this.answersState).filter(k => this.answersState[k] !== null).length;
    
    if (confirm(`📝 Submit Exam?\n\nYou have answered ${answeredCount} out of ${totalQ} questions.`)) {
      this.submitExamResults();
    }
  }

  submitExamResults() {
    this.stopExamTimer();
    
    // Math logic calculation
    let correctCount = 0;
    let wrongCount = 0;
    let skippedCount = 0;
    
    // Category tracking for stats charts
    const categoryStats = {};
    
    this.activeQuestions.forEach((q, idx) => {
      const selected = this.answersState[idx];
      
      // Initialize category tracker
      if (!categoryStats[q.category]) {
        categoryStats[q.category] = { total: 0, correct: 0 };
      }
      categoryStats[q.category].total++;

      if (selected === undefined || selected === null) {
        skippedCount++;
      } else if (selected === q.answer) {
        correctCount++;
        categoryStats[q.category].correct++;
        this.storage.recordAnswer(q.id, true);
      } else {
        wrongCount++;
        this.storage.recordAnswer(q.id, false);
      }
    });

    const percent = this.activeQuestions.length > 0 
      ? Math.round((correctCount / this.activeQuestions.length) * 100) 
      : 0;

    // XP calculation: 15 XP for correct answer, 2 XP for completion in exam mode
    const earnedXP = (correctCount * 15) + (skippedCount * 1) + 20;
    const { leveledUp, currentLevel } = this.storage.addXP(earnedXP);

    // Save mock high score if applicable
    if (percent > this.storage.state.highScores.mock) {
      this.storage.state.highScores.mock = percent;
      this.storage.saveState();
    }
    
    this.updateDashboardStats();
    
    // Play confetti and chimes on good results
    if (percent >= 80) {
      this.sound.playCorrect();
      setTimeout(() => this.sound.playLevelUp(), 400);
      this.confetti.start(4000);
      this.showToast(`🎉 Outstanding score! You got ${percent}% correct!`, 'success');
    } else if (percent >= 40) {
      this.sound.playCorrect();
      this.showToast(`👍 Exam Completed! Score: ${percent}%`, 'success');
    } else {
      this.sound.playIncorrect();
      this.showToast(`📝 Exam Completed. Review your weak areas below.`, 'warning');
    }

    if (leveledUp) {
      this.sound.playLevelUp();
      this.confetti.start(3000);
      this.showToast(`🏆 LEVEL UP! You reached Level ${currentLevel}!`, 'success');
    }

    // Populate and switch to results screen
    this.renderResultsPage(correctCount, wrongCount, skippedCount, percent, earnedXP, categoryStats);
  }

  /* ==========================================================================
     10. RESULTS COMPILATION & VISUAL SVGs
     ========================================================================== */
  renderResultsPage(correct, wrong, skipped, percent, xpEarned, categoryStats) {
    // Switch Screen
    document.querySelectorAll('.view-screen').forEach(s => s.classList.remove('active'));
    document.getElementById('results-screen').classList.add('active');

    // Title / Verdict Text
    let greeting = "Keep Practicing!";
    let verdict = "A little more focus and you will clear the Loksewa exams.";
    if (percent >= 85) {
      greeting = "Excellent Work!";
      verdict = "You are fully prepared to rank top in the Loksewa examinations!";
    } else if (percent >= 60) {
      greeting = "Good Effort!";
      verdict = "Great progress. Review weak topics to boost your scores further.";
    }
    
    document.getElementById('result-greeting').textContent = greeting;
    document.getElementById('result-verdict').textContent = verdict;

    // Circular progress stroke calculation
    // r = 40 => circumference = 2 * PI * r = 251.2
    const fillOffset = 251.2 - (251.2 * percent) / 100;
    const fillCircle = document.getElementById('result-circle-fill');
    fillCircle.style.strokeDashoffset = fillOffset;
    
    // Color circle dynamic styling
    if (percent >= 80) fillCircle.style.stroke = 'var(--success-color)';
    else if (percent >= 50) fillCircle.style.stroke = 'var(--secondary-color)';
    else fillCircle.style.stroke = 'var(--danger-color)';

    document.getElementById('result-score-percent').textContent = `${percent}%`;
    document.getElementById('result-score-fraction').textContent = `${correct} / ${this.activeQuestions.length}`;

    // Stars rating stars-rating-container
    const starsContainer = document.getElementById('stars-rating-container');
    starsContainer.innerHTML = '';
    
    let starsEarned = 1;
    if (percent >= 80) starsEarned = 3;
    else if (percent >= 50) starsEarned = 2;

    for (let i = 1; i <= 3; i++) {
      const star = document.createElement('span');
      if (i <= starsEarned) {
        star.className = 'star gold';
        star.textContent = '★';
        star.style.animationDelay = `${i * 150}ms`;
      } else {
        star.className = 'star grey';
        star.textContent = '★';
      }
      starsContainer.appendChild(star);
    }

    // Grid stat nodes
    document.getElementById('res-stat-correct').textContent = correct;
    document.getElementById('res-stat-wrong').textContent = wrong;
    
    // Formatting time taken
    const minTime = Math.floor(this.timeSpent / 60);
    const secTime = this.timeSpent % 60;
    document.getElementById('res-stat-time').textContent = `${minTime}:${secTime.toString().padStart(2, '0')}`;
    document.getElementById('res-stat-xp').textContent = `+${xpEarned} XP`;

    // Render Custom Category Horizontal Bar Charts (Vanilla SVGs)
    this.renderCategoryAnalysisCharts(categoryStats);
  }

  renderCategoryAnalysisCharts(categoryStats) {
    const chartContainer = document.getElementById('category-bar-chart');
    if (!chartContainer) return;
    
    chartContainer.innerHTML = '';

    const strongAreas = [];
    const weakAreas = [];

    const keys = Object.keys(categoryStats);
    
    if (keys.length === 0) {
      chartContainer.innerHTML = '<p class="text-muted">No category data compiled for this session.</p>';
      document.getElementById('strong-areas-list').innerHTML = '<li>Complete a test to calculate strengths.</li>';
      document.getElementById('weak-areas-list').innerHTML = '<li>Complete a test to identify areas to study.</li>';
      return;
    }

    keys.forEach(cat => {
      const stats = categoryStats[cat];
      const acc = Math.round((stats.correct / stats.total) * 100);

      // Build Horizontal Bar SVG Row
      const row = document.createElement('div');
      row.className = 'chart-bar-row';
      
      let barColor = 'var(--success-color)';
      if (acc < 45) {
        barColor = 'var(--danger-color)';
        weakAreas.push(cat);
      } else if (acc < 80) {
        barColor = 'var(--secondary-color)';
      } else {
        strongAreas.push(cat);
      }

      row.innerHTML = `
        <div class="chart-bar-info">
          <span>${cat}</span>
          <span>${acc}% (${stats.correct}/${stats.total})</span>
        </div>
        <div class="chart-bar-outer">
          <div class="chart-bar-inner" style="width: 0%; background: ${barColor};"></div>
        </div>
      `;

      chartContainer.appendChild(row);
      
      // Delay filling width slightly for sliding animation effect
      setTimeout(() => {
        const inner = row.querySelector('.chart-bar-inner');
        if (inner) inner.style.width = `${acc}%`;
      }, 100);
    });

    // Populate Weak/Strong lists
    const strongList = document.getElementById('strong-areas-list');
    strongList.innerHTML = '';
    if (strongAreas.length > 0) {
      strongAreas.forEach(a => {
        const li = document.createElement('li');
        li.textContent = `${a} (Outstanding proficiency)`;
        strongList.appendChild(li);
      });
    } else {
      strongList.innerHTML = '<li>Keep striving! Score over 80% to identify strengths.</li>';
    }

    const weakList = document.getElementById('weak-areas-list');
    weakList.innerHTML = '';
    if (weakAreas.length > 0) {
      weakAreas.forEach(a => {
        const li = document.createElement('li');
        li.textContent = `${a} (Needs revision, under 45% accuracy)`;
        weakList.appendChild(li);
      });
    } else {
      weakList.innerHTML = '<li>None! Keep up the balanced performance.</li>';
    }
  }

  /* ==========================================================================
     11. TOAST NOTIFICATIONS & KEYBOARD SHORTCUTS
     ========================================================================== */
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✔️';
    else if (type === 'warning') icon = '⚠️';
    
    toast.innerHTML = `<span class="toast-icon">${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    // Fade out after delay
    setTimeout(() => {
      toast.classList.add('fade-out');
      toast.addEventListener('animationend', () => {
        toast.remove();
      });
    }, 3200);
  }

  setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Check if we are currently viewing the quiz screen
      const quizActive = document.getElementById('quiz-screen').classList.contains('active');
      if (!quizActive) return;

      // Ignore if user is writing in settings or inputs
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT') {
        return;
      }

      const key = e.key.toLowerCase();
      
      // Options hotkeys A, B, C, D (or 1, 2, 3, 4)
      if (key === 'a' || key === '1') {
        e.preventDefault();
        this.handleOptionClick(0);
      } else if (key === 'b' || key === '2') {
        e.preventDefault();
        this.handleOptionClick(1);
      } else if (key === 'c' || key === '3') {
        e.preventDefault();
        this.handleOptionClick(2);
      } else if (key === 'd' || key === '4') {
        e.preventDefault();
        this.handleOptionClick(3);
      }

      // Action navigation shortcuts
      if (key === 'arrowleft' || key === 'p') {
        // Prev question
        if (this.currentQuestionIdx > 0) {
          this.navigateToQuestion(this.currentQuestionIdx - 1);
        }
      } else if (key === 'arrowright' || key === 'n') {
        // Next question
        if (this.currentQuestionIdx < this.activeQuestions.length - 1) {
          this.navigateToQuestion(this.currentQuestionIdx + 1);
        }
      } else if (key === 's') {
        // Skip
        e.preventDefault();
        document.getElementById('tool-skip').click();
      } else if (key === 'enter') {
        // Submit button triggers on enter
        e.preventDefault();
        const submitBtn = document.getElementById('tool-submit');
        if (submitBtn.style.display !== 'none' && !submitBtn.disabled) {
          submitBtn.click();
        } else {
          // Trigger next if quiz is evaluated and not last question
          if (this.currentQuestionIdx < this.activeQuestions.length - 1) {
            this.navigateToQuestion(this.currentQuestionIdx + 1);
          }
        }
      } else if (key === 'f') {
        // Flag / Bookmark question shortcut
        e.preventDefault();
        document.getElementById('tool-bookmark').click();
      }
    });
  }
}

// Instantiate the App on window load
window.addEventListener('DOMContentLoaded', () => {
  window.appInstance = new LoksewaApp();
});
