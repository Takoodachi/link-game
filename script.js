import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-analytics.js";

import { getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    onAuthStateChanged, 
    signOut, 
    sendPasswordResetEmail,
    verifyBeforeUpdateEmail,
    sendEmailVerification
 } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyACoE3UwOfESN1o_GPPATdN_mmtjomMiL8",
    authDomain: "numberlink-73560.firebaseapp.com",
    projectId: "numberlink-73560",
    storageBucket: "numberlink-73560.firebasestorage.app",
    messagingSenderId: "689648695062",
    appId: "1:689648695062:web:cae517808fcc47eae5c237",
    measurementId: "G-NMVN4KL7KF"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

class Game {
    constructor() {
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        if (this.isMobile) {
            document.body.classList.add('mobile-layout');
        }

        this.splashStartTime = Date.now();
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.wrapper = document.getElementById('game-wrapper');
        this.confettiCanvas = document.getElementById('confetti-canvas');
        this.confettiCtx = this.confettiCanvas.getContext('2d');

        this.currentLevelIndex = 0;
        this.maxUnlockedIndex = 0; 
        this.maxNumber = 0;
        this.hints = 2;
        this.gridSize = 5;
        this.streak = 0;
        this.speedrunStartTime = 0;
        this.speedrunCurrentTime = 0;
        
        this.confettiParticles = [];
        this.allLevels = [];
        this.grid = []; 
        this.solutionPath = [];
        this.userLines = [];
        this.numberIndices = {};
        this.speedrunBestTimes = {};

        this.isCelebrating = false;
        this.isDrawing = false;
        this.isDarkMode = false;
        this.isWinning = false;
        this.hasPromptedLogin = false;
        this.isSpeedrunActive = false;
        this.isLoginMode = true;
        this.lastLoginDate = null;
        this.currentUser = null;
        this.searchTimeout = null;
        this.currentDragLine = null;
        this.lastHintDate = null;
        this.currentMode = 'classic';

        this.colors = [ '#6d28d9', '#ef4444', '#059669', '#2563eb', '#db2777', '#d97706', '#0891b2' ];
        
        document.getElementById('btn-undo').onclick = () => this.undo();
        document.getElementById('btn-hint').onclick = () => this.useHint();
        document.getElementById('btn-reset').onclick = () => this.resetLevel();
        document.getElementById('theme-toggle').onclick = () => this.toggleTheme();
        
        window.addEventListener('resize', () => {
            this.resizeCanvas();
            this.checkOrientation();
        });

        const authBtn = document.getElementById('auth-btn');
        const sidebar = document.getElementById('gamemode-sidebar');

        if (!localStorage.getItem('gamemodeSidebarVisited')) {
            sidebar.classList.add('open');
            localStorage.setItem('gamemodeSidebarVisited', 'true');
        }

        authBtn.onclick = (e) => {
            e.stopPropagation();
            sidebar.classList.toggle('open');
        };

        document.addEventListener('click', (e) => {
            if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && !authBtn.contains(e.target)) {
                sidebar.classList.remove('open');
            }
        });

        document.getElementById('sidebar-auth-trigger').onclick = () => {
            sidebar.classList.remove('open');
            this.toggleAuth();
        };

        document.getElementById('close-auth-btn').onclick = () => document.getElementById('auth-modal').classList.remove('open');
        document.getElementById('auth-submit-btn').onclick = () => this.handleAuthSubmit();
        document.getElementById('auth-toggle-text').onclick = () => this.toggleAuthMode();
        document.getElementById('auth-modal').addEventListener('click', (e) => {
            if (e.target.id === 'auth-modal') e.target.classList.remove('open');
        });

        document.getElementById('close-profile-btn').onclick = () => document.getElementById('profile-modal').classList.remove('open');
        document.getElementById('profile-modal').addEventListener('click', (e) => {
            if (e.target.id === 'profile-modal') e.target.classList.remove('open');
        });
        document.getElementById('profile-logout-btn').onclick = () => this.handleLogout();
        document.getElementById('profile-reset-pwd').onclick = () => this.handlePasswordReset();

        document.getElementById('profile-change-email').onclick = () => this.openChangeEmailModal();
        document.getElementById('close-change-email-btn').onclick = () => document.getElementById('change-email-modal').classList.remove('open');
        document.getElementById('submit-change-email-btn').onclick = () => this.submitEmailChange();
        document.getElementById('change-email-modal').addEventListener('click', (e) => {
            if (e.target.id === 'change-email-modal') e.target.classList.remove('open');
        });

        document.getElementById('level-select-btn').onclick = () => this.openLevelModal();
        document.getElementById('level-search-btn').addEventListener('click', () => this.executeSearch());
        document.getElementById('level-search').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.executeSearch();
        });
        this.lastScrollTop = 0;
        const levelGrid = document.getElementById('level-grid');
        const searchContainer = document.querySelector('.search-container');
        levelGrid.addEventListener('scroll', () => {
            if (!searchContainer) return;
            
            const currentScrollTop = levelGrid.scrollTop;
            
            if (currentScrollTop > this.lastScrollTop && currentScrollTop > 10) {
                searchContainer.classList.add('hidden');
            }
            else if (currentScrollTop < this.lastScrollTop) {
                searchContainer.classList.remove('hidden');
            }
            
            this.lastScrollTop = currentScrollTop <= 0 ? 0 : currentScrollTop; 
        });
        document.getElementById('close-level-btn').onclick = () => this.closeLevelModal();
        document.getElementById('level-modal').addEventListener('click', (e) => {
            if (e.target.id === 'level-modal') this.closeLevelModal();
        });

        document.getElementById('close-promo-btn').onclick = () => document.getElementById('promo-modal').classList.remove('open');
        document.getElementById('btn-promo-guest').onclick = () => document.getElementById('promo-modal').classList.remove('open');
        document.getElementById('btn-promo-login').onclick = () => {
        document.getElementById('promo-modal').classList.remove('open');
            this.toggleAuth(); 
        };

        document.getElementById('promo-modal').addEventListener('click', (e) => {
            if (e.target.id === 'promo-modal') e.target.classList.remove('open');
        });

        this.devEmail = "admin@test.com";
        this.isDevMode = false;

        this.initLeaderboard();
        this.initRulesModal();
        this.bindInputs();
        this.initTheme(); 
        this.checkOrientation();
        this.fetchLevels();
        this.initAuth();
        this.initContact();
        this.initGameModes();
    }

    // Authentication and Cloud Methods
    initAuth() {
        const authBtn = document.getElementById('auth-btn');
        const sidebarAuthBtn = document.getElementById('sidebar-auth-trigger');
        
        authBtn.innerText = this.isMobile ? "☰" : "Menu";

        onAuthStateChanged(auth, async (user) => {
            if (user) {
                if (!user.emailVerified) {
                    await signOut(auth);
                    this.currentUser = null;
                    this.isDevMode = false;
                    if (sidebarAuthBtn) sidebarAuthBtn.innerText = "Login / Register";
                    await this.loadProgress();
                    return;
                }

                this.currentUser = user;
                this.isDevMode = (user.email === this.devEmail); 
                if (sidebarAuthBtn) sidebarAuthBtn.innerText = "Profile / Settings";
                await this.loadProgress();
            } else {
                this.currentUser = null;
                this.isDevMode = false; 
                if (sidebarAuthBtn) sidebarAuthBtn.innerText = "Login / Register";
                await this.loadProgress();
                
                const today = new Date();
                const isMonday = today.getDay() === 1; 
                const todayString = today.toDateString(); 
                const lastPromptedDate = localStorage.getItem('lastPromoMonday');
                const hasSeenInitialPromo = localStorage.getItem('hasSeenInitialPromo');

                let shouldShowPromo = false;

                if (!hasSeenInitialPromo && !this.hasPromptedLogin) {
                    shouldShowPromo = true;
                    localStorage.setItem('hasSeenInitialPromo', 'true');
                    localStorage.setItem('lastPromoMonday', todayString); 
                } 
                else if (isMonday && lastPromptedDate !== todayString && !this.hasPromptedLogin) {
                    shouldShowPromo = true;
                    localStorage.setItem('lastPromoMonday', todayString);
                }

                if (shouldShowPromo) {
                    this.hasPromptedLogin = true;
                    
                    setTimeout(() => {
                        const promoModal = document.getElementById('promo-modal');
                        if (promoModal) promoModal.classList.add('open');
                    }, 100); 
                }
            }
        });
    }

    toggleAuthMode() {
        this.isLoginMode = !this.isLoginMode;
        const title = document.getElementById('auth-title');
        const submitBtn = document.getElementById('auth-submit-btn');
        const toggleText = document.getElementById('auth-toggle-text');
        const errorText = document.getElementById('auth-error');

        errorText.innerText = "";

        if (this.isLoginMode) {
            title.innerText = "Login";
            submitBtn.innerText = "Login";
            toggleText.innerHTML = "Don't have an account? <span>Register</span>";
        } else {
            title.innerText = "Register";
            submitBtn.innerText = "Register";
            toggleText.innerHTML = "Already have an account? <span>Login</span>";
        }
    }

    toggleAuth() {
        if (this.currentUser) {
            document.getElementById('profile-email').innerText = this.currentUser.email;
            
            const lvlString = this.allLevels[this.currentLevelIndex] ? this.allLevels[this.currentLevelIndex].id : this.currentLevelIndex + 1;
            document.getElementById('profile-level').innerText = lvlString;
            
            document.getElementById('profile-modal').classList.add('open');
        } else {
            this.isLoginMode = true;
            document.getElementById('auth-title').innerText = "Login";
            document.getElementById('auth-submit-btn').innerText = "Login";
            document.getElementById('auth-toggle-text').innerHTML = "Don't have an account? <span>Register</span>";
            
            document.getElementById('auth-email').value = "";
            document.getElementById('auth-password').value = "";
            document.getElementById('auth-error').innerText = "";
            
            document.getElementById('auth-modal').classList.add('open');
        }
    }

    handleLogout() {
        signOut(auth);
        document.getElementById('profile-modal').classList.remove('open');
    }

    initGameModes() {
        const modeButtons = document.querySelectorAll('.gamemode-btn');
        const modes = ['classic', 'speedrun', 'blindfold', 'efficiency', 'words'];
        
        modeButtons.forEach((btn, index) => {
            btn.onclick = () => {
                modeButtons.forEach(b => {
                    b.classList.remove('btn-primary');
                    b.classList.add('btn-secondary');
                });
                btn.classList.remove('btn-secondary');
                btn.classList.add('btn-primary');
                
                this.setGameMode(modes[index]);
                
                if (this.isMobile) {
                    document.getElementById('gamemode-sidebar').classList.remove('open');
                }
            };
        });
    }

    setGameMode(mode) {
        if (this.currentMode === mode) return; 
        this.currentMode = mode;
        this.loadLevel(this.currentLevelIndex); 
        this.updateRulesUI();
        
        let displayMode = mode === 'classic' ? 'Number Link' : mode.charAt(0).toUpperCase() + mode.slice(1);
        this.showToast(`Switched to ${displayMode} Mode`, 2000);
    }

    startSpeedrun() {
        if (this.isSpeedrunActive) return;
        this.isSpeedrunActive = true;
        this.speedrunStartTime = Date.now() - this.speedrunCurrentTime;
        this.updateUI(); 
        
        const tick = () => {
            if (!this.isSpeedrunActive) return;
            this.speedrunCurrentTime = Date.now() - this.speedrunStartTime;
            document.getElementById('hints-display').innerText = this.formatTime(this.speedrunCurrentTime);
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }

    stopSpeedrun() {
        this.isSpeedrunActive = false;
        this.updateUI();
    }

    resetSpeedrun() {
        this.stopSpeedrun();
        this.speedrunCurrentTime = 0;
        if (this.currentMode === 'speedrun') {
            document.getElementById('hints-display').innerText = this.formatTime(0);
        }
    }

    formatTime(ms) {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const milliseconds = Math.floor((ms % 1000) / 10);
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
    }

    openChangeEmailModal() {
        if (!this.currentUser) return;
        
        document.getElementById('new-email-input').value = "";
        document.getElementById('confirm-email-checkbox').checked = false;
        
        const errorText = document.getElementById('change-email-error');
        errorText.innerText = "";
        errorText.style.color = "#ef4444";
        
        document.getElementById('profile-modal').classList.remove('open');
        document.getElementById('change-email-modal').classList.add('open');
    }

    async submitEmailChange() {
        if (!this.currentUser) return;

        const newEmail = document.getElementById('new-email-input').value.trim();
        const isConfirmed = document.getElementById('confirm-email-checkbox').checked;
        const errorText = document.getElementById('change-email-error');

        if (!newEmail) {
            errorText.innerText = "Please enter a new email address.";
            return;
        }
        if (!isConfirmed) {
            errorText.innerText = "Please check the box to confirm.";
            return;
        }
        if (newEmail === this.currentUser.email) {
            errorText.innerText = "This is already your current email.";
            return;
        }

        errorText.style.color = "";
        errorText.innerText = "Processing...";

        try {
            await verifyBeforeUpdateEmail(this.currentUser, newEmail);
            
            errorText.style.color = "#059669";
            errorText.innerText = `Success! A verification link has been sent to ${newEmail}.`;
            
            setTimeout(() => {
                document.getElementById('change-email-modal').classList.remove('open');
            }, 3000);

        } catch (error) {
            errorText.style.color = "#ef4444";
            if (error.code === 'auth/requires-recent-login') {
                errorText.innerText = "For security, please log out and log back in before changing your email.";
            } else if (error.code === 'auth/invalid-email') {
                errorText.innerText = "Please enter a valid email address.";
            } else if (error.code === 'auth/email-already-in-use') {
                errorText.innerText = "That email is already registered to another account.";
            } else {
                errorText.innerText = error.message;
            }
        }
    }

    async handlePasswordReset() {
        if (!this.currentUser) return;
        
        try {
            await sendPasswordResetEmail(auth, this.currentUser.email);
            alert(`A password reset link has been sent to ${this.currentUser.email}`);
        } catch (error) {
            alert("Error sending reset email: " + error.message);
        }
    }

    async handleAuthSubmit() {
        const email = document.getElementById('auth-email').value.trim();
        const password = document.getElementById('auth-password').value;
        const errorText = document.getElementById('auth-error');
        
        if (!email || !password) {
            errorText.innerText = "Please fill out all fields.";
            return;
        }

        errorText.innerText = "Processing...";
        errorText.style.color = "";
        
        try {
            if (this.isLoginMode) {
                const userCred = await signInWithEmailAndPassword(auth, email, password);
                
                if (!userCred.user.emailVerified) {
                    await signOut(auth);
                    errorText.style.color = "#ef4444";
                    errorText.innerText = "Please verify your email before logging in.";
                    return;
                }
                
                document.getElementById('auth-modal').classList.remove('open');
            } else {
                const userCred = await createUserWithEmailAndPassword(auth, email, password);
                
                await sendEmailVerification(userCred.user);
                await signOut(auth);
                
                this.isLoginMode = true;
                document.getElementById('auth-title').innerText = "Login";
                document.getElementById('auth-submit-btn').innerText = "Login";
                document.getElementById('auth-toggle-text').innerHTML = "Don't have an account? <span>Register</span>";
                
                errorText.style.color = "#059669";
                errorText.innerText = "Account created! Please check your email to verify.";
            }
        } catch (error) {
            errorText.style.color = "#ef4444";
            
            if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found') {
                errorText.innerText = "This account does not exist. Please register.";
            } else if (error.code === 'auth/wrong-password') {
                errorText.innerText = "Incorrect password.";
            } else if (error.code === 'auth/email-already-in-use') {
                errorText.innerText = "An account with this email already exists.";
            } else if (error.code === 'auth/weak-password') {
                errorText.innerText = "Password must be at least 6 characters.";
            } else if (error.code === 'auth/invalid-email') {
                errorText.innerText = "Please enter a valid email address.";
            } else {
                errorText.innerText = error.message;
            }
        }
    }

    async loadProgress() {
        const saved = localStorage.getItem('linkGameData');
        if (saved) {
            const data = JSON.parse(saved);
            this.currentLevelIndex = data.currentLevelIndex || 0;
            this.maxUnlockedIndex = data.maxUnlockedIndex || 0;
            this.hints = data.hints !== undefined ? data.hints : 2;
            this.lastHintDate = data.lastHintDate;
            this.streak = data.streak || 0;
            this.lastLoginDate = data.lastLoginDate || null;
            this.speedrunBestTimes = data.speedrunBestTimes || {};
        }

        if (this.currentUser) {
            try {
                const docRef = doc(db, "users", this.currentUser.uid);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const cloudData = docSnap.data();
                    
                    const localMax = this.maxUnlockedIndex || 0;
                    const cloudMax = cloudData.maxUnlockedIndex || 0;

                    if (localMax !== cloudMax) {
                        const choice = await this.askForConflictResolution(localMax, cloudMax);
                        if (choice === 'cloud') {
                            this.applyCloudData(cloudData);
                        } else {
                            this.saveProgress();
                        }
                    } else {
                        this.applyCloudData(cloudData);
                    }
                } else {
                    this.saveProgress();
                }
            } catch (e) {
                console.error("Error loading from cloud:", e);
            }
        }
        
        this.checkDailyHint();
        this.checkDailyStreak()
    }

    applyCloudData(cloudData) {
        this.currentLevelIndex = cloudData.currentLevelIndex;
        this.maxUnlockedIndex = cloudData.maxUnlockedIndex;
        this.hints = cloudData.hints;
        this.lastHintDate = cloudData.lastHintDate;
        this.streak = cloudData.streak || 0;
        this.lastLoginDate = cloudData.lastLoginDate || null;
        this.speedrunBestTimes = cloudData.speedrunBestTimes || {};
        
        localStorage.setItem('linkGameData', JSON.stringify(cloudData));
        this.updateUI();
        this.loadLevel(this.currentLevelIndex);
    }

    askForConflictResolution(localIndex, cloudIndex) {
        return new Promise((resolve) => {
            const modal = document.getElementById('conflict-modal');
            const localBtn = document.getElementById('btn-keep-local');
            const cloudBtn = document.getElementById('btn-keep-cloud');

            const localLvlString = this.allLevels[localIndex] ? `Level ${this.allLevels[localIndex].id}` : `Level ${localIndex + 1}`;
            const cloudLvlString = this.allLevels[cloudIndex] ? `Level ${this.allLevels[cloudIndex].id}` : `Level ${cloudIndex + 1}`;

            document.getElementById('conflict-local-text').innerText = localLvlString;
            document.getElementById('conflict-cloud-text').innerText = cloudLvlString;

            modal.classList.add('open');

            const handleLocal = () => { cleanup(); resolve('local'); };
            const handleCloud = () => { cleanup(); resolve('cloud'); };

            const cleanup = () => {
                modal.classList.remove('open');
                localBtn.removeEventListener('click', handleLocal);
                cloudBtn.removeEventListener('click', handleCloud);
            };

            localBtn.addEventListener('click', handleLocal);
            cloudBtn.addEventListener('click', handleCloud);
        });
    }

    async saveProgress() {
        const data = {
            currentLevelIndex: this.currentLevelIndex,
            maxUnlockedIndex: this.maxUnlockedIndex,
            hints: this.hints,
            lastHintDate: this.lastHintDate,
            streak: this.streak,
            lastLoginDate: this.lastLoginDate,
            speedrunBestTimes: this.speedrunBestTimes
        };
        
        localStorage.setItem('linkGameData', JSON.stringify(data));
        this.updateUI();

        if (this.currentUser) {
            try {
                await setDoc(doc(db, "users", this.currentUser.uid), data);
            } catch (e) {
                console.error("Error saving to cloud:", e);
            }
        }
    }

    // UI and Level Selection Methods
    executeSearch() {
        const searchInput = document.getElementById('level-search');
        if (!searchInput) return;

        const searchTerm = searchInput.value.trim();
        const grid = document.getElementById('level-grid');
        const buttons = grid.getElementsByClassName('lvl-btn');
        
        for (let btn of buttons) {
            if (searchTerm === "" || btn.innerText.includes(searchTerm)) {
                btn.style.display = ''; 
            } else {
                btn.style.display = 'none'; 
            }
        }
    }

    openLevelModal() {
        const modal = document.getElementById('level-modal');
        const grid = document.getElementById('level-grid');
        const searchInput = document.getElementById('level-search');
        const searchContainer = document.querySelector('.search-container');

        if (searchContainer) searchContainer.classList.remove('hidden');
        grid.scrollTop = 0;
        this.lastScrollTop = 0;

        grid.innerHTML = '';
        if (searchInput) searchInput.value = '';
        
        if (this.allLevels.length === 0) {
            grid.innerHTML = '<p style="color:var(--text-color); padding:20px;">Levels loading...</p>';
        } else {
            const limit = this.isDevMode ? this.allLevels.length : this.maxUnlockedIndex;
            
            for (let i = 0; i <= limit && i < this.allLevels.length; i++) {
                const lvl = this.allLevels[i];
                const btn = document.createElement('button');
                btn.innerText = lvl.id;
                btn.className = 'lvl-btn';
                
                if (i === this.currentLevelIndex) btn.classList.add('active');
                
                btn.onclick = () => this.loadLevel(i);
                grid.appendChild(btn);
            }
        }

        modal.classList.add('open');
    }

    async fetchLevels() {
        try {
            const response = await fetch('levels.enc');
            if (!response.ok) throw new Error("Could not load levels");
            
            const encodedText = await response.text();
            
            const decodedText = atob(encodedText);
            this.allLevels = JSON.parse(decodedText);
            
            if (this.currentLevelIndex >= this.allLevels.length) {
                this.currentLevelIndex = this.allLevels.length - 1;
            }
            
            this.loadLevel(this.currentLevelIndex);
            
            const elapsedTime = Date.now() - this.splashStartTime;
            const remainingTime = Math.max(0, 1500 - elapsedTime);
            
            setTimeout(() => {
                this.removeSplashScreen(); 
            }, remainingTime);
            
        } catch (error) {
            console.error(error);
            document.getElementById('message-area').innerText = "Loading...";
            setTimeout(() => {
                if(this.allLevels.length === 0) alert("Please verify levels.enc is uploaded to GitHub.");
            }, 2000);
        }
    }

    loadLevel(index) {
        if (!this.allLevels || !this.allLevels[index]) return;

        this.currentLevelIndex = index;
        this.resetSpeedrun();
        const levelData = this.allLevels[index];
        
        this.gridSize = levelData.size;
        this.isWinning = false;
        this.userLines = [];
        this.currentDragLine = null;
        this.numberIndices = {};
        this.setRandomColor();
        this.grid = Array(this.gridSize).fill().map(() => Array(this.gridSize).fill({ val: null, type: 'empty' }));
        this.resizeCanvas();
        this.solutionPath = levelData.solution;
        
        let maxVal = 0;
        levelData.clues.forEach(clue => {
            this.grid[clue.r][clue.c] = { val: clue.val, type: 'fixed' };
            if (clue.val > maxVal) maxVal = clue.val;
            
            const pathIdx = this.solutionPath.findIndex(p => p.r === clue.r && p.c === clue.c);
            if(pathIdx !== -1) this.numberIndices[clue.val] = pathIdx;
        });

        this.maxNumber = maxVal;
        this.updateUI();
        this.draw();
        this.closeLevelModal();
    }

    closeLevelModal() {
        document.getElementById('level-modal').classList.remove('open');
    }
    
    initLeaderboard() {
        const lbBtn = document.getElementById('leaderboard-toggle-btn');
        const panel = document.getElementById('leaderboard-panel');
        const tabStreak = document.getElementById('tab-streak');
        const tabTime = document.getElementById('tab-time');

        lbBtn.innerText = this.isMobile ? "🏆" : "Leaderboard";

        lbBtn.onclick = (e) => {
            e.stopPropagation();
            panel.classList.toggle('open');
            if (panel.classList.contains('open')) {
                const activeType = tabTime.classList.contains('active') ? 'time' : 'streak';
                this.renderLeaderboard(activeType);
            }
        };

        document.addEventListener('click', (e) => {
            if (panel.classList.contains('open') && !panel.contains(e.target) && !lbBtn.contains(e.target)) {
                panel.classList.remove('open');
            }
        });

        tabStreak.onclick = () => {
            tabStreak.classList.add('active');
            tabTime.classList.remove('active');
            this.renderLeaderboard('streak');
        };

        tabTime.onclick = () => {
            tabTime.classList.add('active');
            tabStreak.classList.remove('active');
            this.renderLeaderboard('time');
        };
    }

    renderLeaderboard(type) {
        const content = document.getElementById('leaderboard-content');
        content.innerHTML = '<div style="text-align: center; padding: 20px;">Loading...</div>';

        setTimeout(() => {
            content.innerHTML = '';
            if (type === 'streak') {
                const mockStreaks = [100, 97, 85, 60, 42, 30, 25, 12, 5, 2];
                mockStreaks.forEach((streak, idx) => {
                    content.innerHTML += `
                        <div class="leaderboard-item">
                            <span>#${idx + 1}</span> 
                            <span>${streak} 🔥</span>
                        </div>`;
                });
            } else {
                const mockTimes = [
                    { time: 4200, level: 10 },
                    { time: 5100, level: 1 },
                    { time: 6500, level: 5 },
                    { time: 7200, level: 12 },
                    { time: 8000, level: 2 }
                ];
                mockTimes.forEach((data, idx) => {
                    content.innerHTML += `
                        <div class="leaderboard-item">
                            <span>#${idx + 1}</span> 
                            <span>${this.formatTime(data.time)} - Level ${data.level}</span>
                        </div>`;
                });
            }
        }, 300); 
    }

    updateRulesUI() {
        const rulesContainer = document.getElementById('dynamic-rules-content');
        if (!rulesContainer) return;

        const controlsText = this.isMobile ? "Drag to link!" : "Drag or use arrow keys to link!";
        let rulesHTML = '';

        if (this.currentMode === 'blindfold') {
            rulesHTML += `<div class="rule-item"><div class="rule-icon">❓</div><div class="rule-text">Connect hidden numbers in order to reveal them!</div></div>`;
            rulesHTML += `<div class="rule-item"><div class="rule-icon">▧</div><div class="rule-text">Fill every cell</div></div>`;
            rulesHTML += `<div class="rule-item"><div class="rule-icon">≠</div><div class="rule-text">Lines cannot cross</div></div>`;
        } else {
            rulesHTML += `<div class="rule-item"><div class="rule-icon">1-2-3</div><div class="rule-text">Connect numbers in order</div></div>`;
            rulesHTML += `<div class="rule-item"><div class="rule-icon">▧</div><div class="rule-text">Fill every cell</div></div>`;
            rulesHTML += `<div class="rule-item"><div class="rule-icon">≠</div><div class="rule-text">Lines cannot cross</div></div>`;
        }

        rulesHTML += `
            <div class="rule-item">
                <div class="rule-icon">🎮</div>
                <div class="rule-text">${controlsText}</div>
            </div>
        `;

        rulesContainer.innerHTML = rulesHTML;
    }

    initRulesModal() {
        const rulesBtn = document.getElementById('rules-btn');
        const rulesModal = document.getElementById('rules-modal');
        const closeBtn = document.getElementById('close-rules-btn');

        this.updateRulesUI();

        rulesBtn.onclick = () => rulesModal.classList.add('open');
        closeBtn.onclick = () => rulesModal.classList.remove('open');
        
        rulesModal.addEventListener('click', (e) => {
            if (e.target.id === 'rules-modal') rulesModal.classList.remove('open');
        });

        if (!localStorage.getItem('linkGameHasVisited')) {
            rulesModal.classList.add('open');
            localStorage.setItem('linkGameHasVisited', 'true');
        }
    }

    checkOrientation() {
        if (!this.isMobile) return;

        const overlay = document.getElementById('orientation-lock');
        if (window.innerWidth > window.innerHeight) {
            overlay.style.display = 'flex';
        } else {
            overlay.style.display = 'none';
        }
    }

    initTheme() {
        const savedTheme = localStorage.getItem('theme');
        const systemMedia = window.matchMedia('(prefers-color-scheme: dark)');
        
        if (savedTheme) {
            this.isDarkMode = (savedTheme === 'dark');
        } else {
            this.isDarkMode = systemMedia.matches;
        }

        this.applyTheme();

        systemMedia.addEventListener('change', (e) => {
            if (!localStorage.getItem('theme')) {
                this.isDarkMode = e.matches;
                this.applyTheme();
                this.draw(); 
            }
        });
    }

    applyTheme() {
        document.body.classList.toggle('dark-mode', this.isDarkMode);
        
        document.getElementById('theme-toggle').innerText = this.isDarkMode ? "☀️" : "🌙";
        
        const favicon = document.getElementById('dynamic-favicon');
        if (favicon) {
            favicon.href = this.isDarkMode ? "favicon_dark.svg" : "favicon_light.svg";
        }
    }

    toggleTheme() {
        this.isDarkMode = !this.isDarkMode;
        
        localStorage.setItem('theme', this.isDarkMode ? 'dark' : 'light');
        
        this.applyTheme();
        this.draw(); 
    }

    setRandomColor() {
        const randomIndex = Math.floor(Math.random() * this.colors.length);
        const newColor = this.colors[randomIndex];
        document.documentElement.style.setProperty('--line-color', newColor);
    }

    resizeCanvas() {
        const maxWidth = Math.min(window.innerWidth * 0.92, 600);
        const maxHeight = window.innerHeight - 220;
        const wrapperSize = Math.floor(Math.min(maxWidth, maxHeight));
        
        this.wrapper.style.width = `${wrapperSize}px`;
        this.wrapper.style.height = `${wrapperSize}px`;

        const displaySize = wrapperSize - 5;
        const dpr = Math.max(1, window.devicePixelRatio || 1);

        this.canvas.width = displaySize * dpr;
        this.canvas.height = displaySize * dpr;
        this.canvas.style.width = `${displaySize}px`;
        this.canvas.style.height = `${displaySize}px`;

        if (this.ctx.setTransform) {
            this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        } else {
            try { this.ctx.resetTransform(); } catch (e) {}
            this.ctx.scale(dpr, dpr);
        }
        
        this.cellSize = displaySize / this.gridSize;
        this.draw();
    }

    // Game Interaction Methods
    bindInputs() {
        this.canvas.addEventListener('mousedown', (e) => this.handleStart(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMove(e));
        window.addEventListener('mouseup', () => this.handleEnd());
        this.canvas.addEventListener('touchstart', (e) => this.handleStart(e, true), {passive: false});
        this.canvas.addEventListener('touchmove', (e) => this.handleMove(e, true), {passive: false});
        window.addEventListener('touchend', () => this.handleEnd());
        document.getElementById('btn-show-answer').onclick = () => this.showAnswer();
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));
    }
    
    getPos(e, isTouch) {
        const rect = this.canvas.getBoundingClientRect();
        const clientX = isTouch ? e.touches[0].clientX : e.clientX;
        const clientY = isTouch ? e.touches[0].clientY : e.clientY;
        return {
            c: Math.floor((clientX - rect.left) / (rect.width / this.gridSize)),
            r: Math.floor((clientY - rect.top) / (rect.height / this.gridSize))
        };
    }

    getLineAt(r, c) { return this.userLines.find(line => line.points.some(p => p.r === r && p.c === c)); }
    
    handleStart(e, isTouch) {
        if (this.currentMode === 'speedrun' && !this.isSpeedrunActive) {
            this.startSpeedrun();
        }

        if (this.isWinning) return; 

        if(isTouch) e.preventDefault();

        const {r, c} = this.getPos(e, isTouch);
        if (!this.isValidCell(r, c)) return;
        const cell = this.grid[r][c];

        if (cell.val !== null) {
            const cutIndex = this.userLines.findIndex(l => l.startVal === cell.val);
            if (cutIndex !== -1) {
                this.userLines = this.userLines.slice(0, cutIndex);
                this.draw();
            }

            let isValidStart = false;
            
            if (cell.val === 1 && this.userLines.length === 0) {
                isValidStart = true;
            } else if (this.userLines.length > 0) {
                const lastLine = this.userLines[this.userLines.length - 1];
                const lastPt = lastLine.points[lastLine.points.length - 1];
                if (lastPt.r === r && lastPt.c === c) {
                    isValidStart = true;
                }
            }

            if (isValidStart) {
                this.isDrawing = true;
                this.currentDragLine = { startVal: cell.val, points: [{r, c}], widthScale: 0.45 };
                this.draw();
            }
        }
    }

    handleMove(e, isTouch) {
        if (!this.isDrawing || !this.currentDragLine || this.isWinning) return;
        if(isTouch) e.preventDefault();
        const {r, c} = this.getPos(e, isTouch);
        if (!this.isValidCell(r, c)) return;
        
        this.attemptMove(r, c);
    }

    attemptMove(r, c) {
        const pts = this.currentDragLine.points;
        const last = pts[pts.length - 1];
        
        if (r === last.r && c === last.c) return; 
        
        if (pts.length > 1) {
            const prev = pts[pts.length - 2];
            if (prev.r === r && prev.c === c) { pts.pop(); this.draw(); return; }
        }
        
        if (Math.abs(r - last.r) + Math.abs(c - last.c) !== 1) return;
        
        if (this.isCellOccupied(r, c)) {
            const target = this.grid[r][c];

            if (this.userLines.length > 0) {
                const lastLine = this.userLines[this.userLines.length - 1];
                if (lastLine.points.length > 1) {
                    const prevPt = lastLine.points[lastLine.points.length - 2];
                    if (prevPt.r === r && prevPt.c === c) {
                        this.userLines.pop();
                        this.currentDragLine = lastLine;
                        this.currentDragLine.widthScale = 0.45;
                        this.currentDragLine.points.pop(); 
                        this.draw();
                        return;
                    }
                }
            }

            if (target.type === 'fixed') {
                if (target.val === this.currentDragLine.startVal) {
                    this.currentDragLine.points = [{r, c}]; 
                    this.draw();
                    return;
                }

                const lastLine = this.userLines[this.userLines.length - 1];
                if (lastLine && target.val === lastLine.startVal) {
                    this.userLines.pop();
                    this.currentDragLine = { startVal: target.val, points: [{r, c}], widthScale: 0.45 };
                    this.draw();
                    return;
                }

                const isUsed = this.userLines.some(l => l.startVal === target.val) || (target.val === 1);

                if (!isUsed) {
                    pts.push({r, c});
                    this.userLines.push(this.currentDragLine);
                    
                    this.triggerTileAnimation(r, c); 

                    if (this.userLines.length < this.maxNumber - 1) {
                        this.currentDragLine = { startVal: target.val, points: [{r, c}], widthScale: 0.45 };
                    } else { 
                        this.isDrawing = false; 
                        this.currentDragLine = null; 
                    }
                    this.checkWin(); 
                    this.draw(); 
                    return;
                } 
                return;
            }

            const lineAtTarget = this.getLineAt(r, c);
            if (lineAtTarget) {
                return;
            }

            return; 
        }
        
        pts.push({r, c}); this.draw();
    }

    handleEnd() { this.isDrawing = false; this.currentDragLine = null; this.draw(); }

    handleKeyDown(e) {
        if (this.isWinning) return;

        let dr = 0, dc = 0;
        if (e.key === 'ArrowUp') dr = -1;
        else if (e.key === 'ArrowDown') dr = 1;
        else if (e.key === 'ArrowLeft') dc = -1;
        else if (e.key === 'ArrowRight') dc = 1;
        else return;

        e.preventDefault();

        if (this.currentMode === 'speedrun' && !this.isSpeedrunActive) {
            this.startSpeedrun();
        }

        if (!this.isDrawing || !this.currentDragLine) {
            let startNode = null;
            let startVal = null;

            if (this.userLines.length > 0) {
                const lastLine = this.userLines[this.userLines.length - 1];
                const lastPt = lastLine.points[lastLine.points.length - 1];
                const cell = this.grid[lastPt.r][lastPt.c];
                if (cell.val !== null) {
                    startNode = lastPt;
                    startVal = cell.val;
                }
            } else {
                for(let r=0; r<this.gridSize; r++) {
                    for(let c=0; c<this.gridSize; c++) {
                        if (this.grid[r][c].val === 1) {
                            startNode = {r, c};
                            startVal = 1;
                            break;
                        }
                    }
                    if (startNode) break;
                }
            }

            if (startNode) {
                this.isDrawing = true;
                this.currentDragLine = { 
                    startVal: startVal, 
                    points: [{r: startNode.r, c: startNode.c}], 
                    widthScale: 0.45 
                };
                this.draw();
            } else {
                return;
            }
        }

        const pts = this.currentDragLine.points;
        const head = pts[pts.length - 1];
        const r = head.r + dr;
        const c = head.c + dc;

        if (!this.isValidCell(r, c)) return;

        this.attemptMove(r, c);
    }

    isValidCell(r, c) { return r >= 0 && r < this.gridSize && c >= 0 && c < this.gridSize; }

    isCellOccupied(r, c) {
        if (this.grid[r][c].type === 'fixed') return true;

        for (let line of this.userLines) { for (let p of line.points) { if (p.r === r && p.c === c) return true; } }

        if (this.currentDragLine) { for (let i = 0; i < this.currentDragLine.points.length - 1; i++) { const p = this.currentDragLine.points[i]; 

        if (p.r === r && p.c === c) return true; } }
        
        return false;
    }
    
    undo() { if (this.userLines.length > 0 && !this.isWinning) { this.userLines.pop(); this.draw(); } }

    resetLevel() { 
        if (!this.isWinning) { 
            this.userLines = []; 
            if (this.currentMode === 'speedrun') {
                this.resetSpeedrun();
            }
            this.draw(); 
        } 
    }

    useHint() {
        if ((this.hints <= 0 && !this.isDevMode) || this.isWinning) { 
            if(!this.isWinning) alert("No hints remaining! Come back tomorrow."); 
            return; 
        }
        
        if (!this.isDevMode) {
            this.hints--; 
            this.saveProgress();
        }

        let currentMax = 1;
        while (currentMax < this.maxNumber) {
            const hasNext = this.userLines.find(l => l.startVal === currentMax);
            if (hasNext) { currentMax++; } else { break; }
        }

        const targetNumber = Math.min(currentMax + 4, this.maxNumber);
        const startIndex = this.numberIndices[currentMax];
        const endIndex = this.numberIndices[targetNumber];

        if (startIndex === undefined || endIndex === undefined) return;

        const hintPoints = this.solutionPath.slice(startIndex, endIndex + 1);
        const ctx = this.ctx;
        ctx.save();
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = this.isDarkMode ? "#FFFF00" : "#FFD700"; 
        ctx.lineWidth = this.cellSize * 0.4;
        ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.beginPath();
        const cx = c => c * this.cellSize + this.cellSize/2;
        const cy = r => r * this.cellSize + this.cellSize/2;
        ctx.moveTo(cx(hintPoints[0].c), cy(hintPoints[0].r));

        for(let i=1; i<hintPoints.length; i++) { ctx.lineTo(cx(hintPoints[i].c), cy(hintPoints[i].r)); }

        ctx.stroke(); ctx.restore();
        setTimeout(() => this.draw(), 2000);
    }

    checkDailyHint() {
        const today = new Date().toDateString();
        if (this.lastHintDate === null) {
            this.lastHintDate = today;
            this.saveProgress();
            return;
        }
        if (this.lastHintDate !== today) {
            this.hints = 2; 
            this.lastHintDate = today;
            this.showToast("New Day! Hints reset to 2. 💡");
            this.saveProgress();
        }
    }

    checkDailyStreak() {
        if (!this.currentUser) return;

        const today = new Date();
        const todayString = today.toDateString();
        
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        const yesterdayString = yesterday.toDateString();

        if (!this.lastLoginDate) {
            this.streak = 1;
            this.lastLoginDate = todayString;
            this.saveProgress();
        } else if (this.lastLoginDate !== todayString) {
            if (this.lastLoginDate === yesterdayString) {
                this.streak++;
                setTimeout(() => {
                    this.showToast(`🔥 Streak increased! ${this.streak} Days! 🔥`, 4000);
                    this.startCelebration();
                    
                    setTimeout(() => this.stopCelebration(), 3000);
                }, 1000);
            } else {
                this.streak = 1;
            }
            this.lastLoginDate = todayString;
            this.saveProgress();
        }
    }

    // Check Win and Animation Methods
    checkWin() {
        const set = new Set();
        this.grid.forEach((row, r) => row.forEach((cell, c) => { if(cell.type === 'fixed') set.add(`${r},${c}`); }));
        this.userLines.forEach(line => { line.points.forEach(p => set.add(`${p.r},${p.c}`)); });
        
        const isGridFull = (set.size === this.gridSize * this.gridSize);
        if (!isGridFull) return;

        for (let i = 1; i < this.maxNumber; i++) {
            const line = this.userLines.find(l => l.startVal === i);
            
            if (!line) return;

            const lastPt = line.points[line.points.length - 1];
            const endCell = this.grid[lastPt.r][lastPt.c];

            if (endCell.val !== i + 1) return;
        }

        this.triggerWinSequence();
    }

    triggerWinSequence() {
        this.isWinning = true;
        if (this.currentMode === 'speedrun') this.stopSpeedrun();
        const pathLines = this.userLines;
        
        this.winAnimationPoints = [];
        pathLines.forEach(line => { this.winAnimationPoints.push(...line.points); });
        this.winFrame = 0; this.totalWinFrames = 120; 
        requestAnimationFrame(() => this.animateWinLoop());
    }

    animateWinLoop() {
        if (!this.isWinning) return;
        this.winFrame++;
        const progress = this.winFrame / this.totalWinFrames;
        this.draw(true, progress); 
        if (this.winFrame < this.totalWinFrames) { requestAnimationFrame(() => this.animateWinLoop()); } 
        else { setTimeout(() => this.handleLevelComplete(), 500); }
    }

    handleLevelComplete() {
        const msg = document.getElementById('message-area');
        msg.innerText = "Level Complete!";
        msg.classList.add('visible'); 
        this.startCelebration();
        if (typeof gtag === 'function') {
            gtag('event', 'level_complete', {
                'level_index': this.currentLevelIndex,
                'level_id': this.allLevels[this.currentLevelIndex].id
            });
        }
        if (this.currentLevelIndex === this.maxUnlockedIndex) {
            this.maxUnlockedIndex++;
        }
        setTimeout(() => {
            this.stopCelebration();
            msg.classList.remove('visible');
            msg.innerText = "";
            
            if (this.currentMode === 'speedrun') {
                const bestTime = this.speedrunBestTimes[this.currentLevelIndex] || Infinity;
                if (this.speedrunCurrentTime < bestTime) {
                    this.speedrunBestTimes[this.currentLevelIndex] = this.speedrunCurrentTime;
                    this.showToast(`New Best Time: ${this.formatTime(this.speedrunCurrentTime)}! 🏆`, 4000);
                    this.saveProgress();
                } else {
                    this.showToast(`Time: ${this.formatTime(this.speedrunCurrentTime)}. Best: ${this.formatTime(bestTime)}`, 4000);
                }
            }
            
            if (this.currentLevelIndex + 1 < this.allLevels.length) {
                this.currentLevelIndex++;
                this.saveProgress();
                this.loadLevel(this.currentLevelIndex);
            } else {
                alert("You have beaten all levels!");
            }
        }, 2000);
    }

    updateUI() {
        if(this.allLevels && this.allLevels[this.currentLevelIndex]) {
            document.getElementById('level-select-btn').innerText = `Level ${this.allLevels[this.currentLevelIndex].id} ▾`;
        }
        
        const streakDisplay = document.getElementById('streak-display');
        if (streakDisplay) {
            if (this.currentUser) {
                streakDisplay.style.display = 'inline';
                streakDisplay.innerText = `🔥 ${this.streak}`;
            } else {
                streakDisplay.style.display = 'none';
            }
        }
        
        const answerBtn = document.getElementById('btn-show-answer');
        const hintBtn = document.getElementById('btn-hint');
        const hintsDisplay = document.getElementById('hints-display');
        const bestTimeDisplay = document.getElementById('best-time-display');

        if (this.currentMode === 'speedrun') {
            hintsDisplay.innerText = this.formatTime(this.speedrunCurrentTime || 0);
            hintBtn.innerText = "Start";
            hintBtn.onclick = () => this.startSpeedrun();
            answerBtn.style.display = 'none';
            
            if (bestTimeDisplay) {
                bestTimeDisplay.style.display = 'inline';
                const bestTime = this.speedrunBestTimes[this.currentLevelIndex];
                if (bestTime !== undefined && bestTime !== Infinity) {
                    bestTimeDisplay.innerText = `Best: ${this.formatTime(bestTime)}`;
                } else {
                    bestTimeDisplay.innerText = `Best: 00:00.00`;
                }
            }
            
            if (this.isSpeedrunActive) {
                hintBtn.disabled = true;
                hintBtn.style.opacity = '0.5';
            } else {
                hintBtn.disabled = false;
                hintBtn.style.opacity = '1';
            }
        } else {
            hintsDisplay.innerText = this.isDevMode ? `Hints: ∞ (Dev)` : `Hints: ${this.hints}`;
            hintBtn.innerText = "Hint";
            hintBtn.onclick = () => this.useHint();
            hintBtn.disabled = false;
            hintBtn.style.opacity = '1';
            
            if (bestTimeDisplay) {
                bestTimeDisplay.style.display = 'none';
            }
            
            if (this.currentLevelIndex < this.maxUnlockedIndex || this.isDevMode) {
                answerBtn.style.display = 'inline-block';
            } else {
                answerBtn.style.display = 'none';
            }
        }
    }

    draw(isAnimating = false, animationProgress = 1) {
        if (!this.grid || !this.grid[0]) return;
        const cs = this.cellSize;
        const ctx = this.ctx;
        const style = getComputedStyle(document.body);
        const bgColor = style.getPropertyValue('--grid-bg').trim();
        const lineColor = style.getPropertyValue('--line-color').trim();
        const nodeColor = style.getPropertyValue('--node-color').trim();
        const nodeTextColor = this.isDarkMode ? "#000" : "#fff";

        let keepAnimating = false;
        if (!isAnimating) {
            this.userLines.forEach(l => {
                if (l.widthScale === undefined) l.widthScale = 0.5;
                
                if (l.widthScale < 0.5) {
                    l.widthScale += 0.05;
                    if (l.widthScale > 0.5) l.widthScale = 0.5;
                    keepAnimating = true;
                }
            });
        }

        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, this.gridSize * cs, this.gridSize * cs);

        const cx = c => c * cs + cs/2;
        const cy = r => r * cs + cs/2;

        if (!isAnimating) {
            ctx.fillStyle = lineColor;
            ctx.globalAlpha = 0.15;

            const fillCell = (r, c) => {
                ctx.fillRect(c * cs + 1, r * cs + 1, cs - 2, cs - 2);
            };

            this.userLines.forEach(line => {
                line.points.forEach(p => fillCell(p.r, p.c));
            });

            if (this.currentDragLine) {
                this.currentDragLine.points.forEach(p => fillCell(p.r, p.c));
            }

            ctx.globalAlpha = 1.0;
        }

        if (!isAnimating) {
            ctx.strokeStyle = this.isDarkMode ? "#374151" : "#f3f4f6";
            ctx.lineWidth = 2;
            ctx.beginPath();
            for(let i=0; i<=this.gridSize; i++) {
                ctx.moveTo(i*cs, 0); ctx.lineTo(i*cs, this.gridSize * cs);
                ctx.moveTo(0, i*cs); ctx.lineTo(this.gridSize * cs, i*cs);
            }
            ctx.stroke();
        }

        const drawPoly = (points, wScale = 0.5) => {
            if(points.length < 2) return;
            ctx.beginPath(); ctx.lineCap = "round"; ctx.lineJoin = "round";
            
            ctx.lineWidth = cs * wScale; 
            ctx.strokeStyle = lineColor;
            ctx.moveTo(cx(points[0].c), cy(points[0].r));
            for(let i=1; i<points.length; i++) ctx.lineTo(cx(points[i].c), cy(points[i].r));
            ctx.stroke();
            
            ctx.beginPath(); 
            ctx.lineWidth = cs * (wScale * 0.3);
            ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
            ctx.moveTo(cx(points[0].c), cy(points[0].r));
            for(let i=1; i<points.length; i++) ctx.lineTo(cx(points[i].c), cy(points[i].r));
            ctx.stroke();
        };

        if (isAnimating) {
            const maxIdx = Math.floor(this.winAnimationPoints.length * animationProgress);
            if (maxIdx > 1) {
                ctx.save(); ctx.shadowBlur = 15; ctx.shadowColor = lineColor;
                drawPoly(this.winAnimationPoints.slice(0, maxIdx)); ctx.restore();
            }
        } else {
            this.userLines.forEach(l => drawPoly(l.points, l.widthScale));
            
            if(this.currentDragLine) {
                const prevLine = this.userLines.find(l => l.startVal === this.currentDragLine.startVal - 1);
                const dragWidth = this.currentDragLine.widthScale || 0.45;

                if (!prevLine) {
                    drawPoly(this.currentDragLine.points, dragWidth);
                } else {
                    const excludeSet = new Set(prevLine.points.map(p => `${p.r},${p.c}`));
                    const pts = this.currentDragLine.points;
                    
                    if (pts.length > 1) {
                        ctx.lineCap = "round"; ctx.lineJoin = "round";
                        
                        ctx.lineWidth = cs * dragWidth; 
                        ctx.strokeStyle = lineColor;
                        ctx.beginPath();
                        for(let i=0; i<pts.length-1; i++) {
                            const p1 = pts[i]; const p2 = pts[i+1];
                            if(excludeSet.has(`${p1.r},${p1.c}`) && excludeSet.has(`${p2.r},${p2.c}`)) continue;
                            ctx.moveTo(cx(p1.c), cy(p1.r));
                            ctx.lineTo(cx(p2.c), cy(p2.r));
                        }
                        ctx.stroke();

                        ctx.lineWidth = cs * (dragWidth * 0.3); 
                        ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
                        ctx.beginPath();
                        for(let i=0; i<pts.length-1; i++) {
                            const p1 = pts[i]; const p2 = pts[i+1];
                            if(excludeSet.has(`${p1.r},${p1.c}`) && excludeSet.has(`${p2.r},${p2.c}`)) continue;
                            ctx.moveTo(cx(p1.c), cy(p1.r));
                            ctx.lineTo(cx(p2.c), cy(p2.r));
                        }
                        ctx.stroke();
                    }
                }
            }
        }

        ctx.font = `bold ${cs * 0.4}px sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        for(let r=0; r<this.gridSize; r++) {
            for(let c=0; c<this.gridSize; c++) {
                const cell = this.grid[r][c];
                if(cell.type === 'fixed') {
                    ctx.save();
                    if (cell.val === 1 || cell.val === this.maxNumber) {
                        ctx.shadowColor = this.isDarkMode ? "rgba(255,255,255,0.85)" : lineColor;
                        ctx.shadowBlur = cs * 0.2;
                        ctx.shadowOffsetY = 0;
                    } else {
                        ctx.shadowColor = "rgba(0,0,0,0.3)"; ctx.shadowBlur = 1; ctx.shadowOffsetY = 1;
                    }
                    ctx.fillStyle = nodeColor; ctx.beginPath();
                    const scale = cell.animScale || 1.0; 
                    ctx.arc(cx(c), cy(r), cs * 0.35 * scale, 0, Math.PI*2); 
                    ctx.fill();
                    ctx.restore();
                    
                    let showText = true;
                    if (this.currentMode === 'blindfold') {
                        if (cell.val !== 1 && cell.val !== this.maxNumber) {
                            showText = false;
                            
                            const prevLine = this.userLines.find(l => l.startVal === cell.val - 1);
                            if (prevLine) {
                                const lastPt = prevLine.points[prevLine.points.length - 1];
                                if (lastPt.r === r && lastPt.c === c) {
                                    showText = true;
                                }
                            }
                        }
                    }

                    if (showText) {
                        ctx.fillStyle = nodeTextColor; 
                        ctx.fillText(cell.val, cx(c), cy(r));
                    }
                }
            }
        }
        
        if (keepAnimating) {
            requestAnimationFrame(() => this.draw());
        }
    }

    triggerTileAnimation(r, c) {
        const cell = this.grid[r][c];
        let frame = 0;
        const maxFrames = 15;
        const amplitude = 0.35;

        const animate = () => {
            frame++;
            const progress = frame / maxFrames;
            
            if (progress >= 1) {
                cell.animScale = 1.0;
                this.draw();
                return;
            }

            cell.animScale = 1.0 + Math.sin(progress * Math.PI) * amplitude;
            
            this.draw();
            requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
    }

    startCelebration() {
        this.isCelebrating = true;
        this.confettiCanvas.classList.add('active');
        this.confettiCanvas.width = window.innerWidth;
        this.confettiCanvas.height = window.innerHeight;

        this.confettiParticles = [];
        for(let i=0; i<150; i++) {
            this.confettiParticles.push(this.createParticle());
        }
        this.animateConfetti();
    }

    stopCelebration() {
        this.isCelebrating = false;
        this.confettiCanvas.classList.remove('active');
        this.confettiCtx.clearRect(0, 0, this.confettiCanvas.width, this.confettiCanvas.height);
    }

    createParticle() {
        const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffffff'];
        return {
            x: Math.random() * this.confettiCanvas.width,
            y: Math.random() * this.confettiCanvas.height - this.confettiCanvas.height,
            color: colors[Math.floor(Math.random() * colors.length)],
            size: Math.random() * 10 + 5,
            vx: Math.random() * 4 - 2,
            vy: Math.random() * 4 + 4,
            rotation: Math.random() * 360,
            rotationSpeed: Math.random() * 10 - 5
        };
    }

    animateConfetti() {
        if (!this.isCelebrating) return;
        
        const ctx = this.confettiCtx;
        const width = this.confettiCanvas.width;
        const height = this.confettiCanvas.height;

        ctx.clearRect(0, 0, width, height);

        this.confettiParticles.forEach(p => {
            p.y += p.vy;
            p.x += p.vx;
            p.rotation += p.rotationSpeed;
            
            if (p.y > height) {
                p.y = -20;
                p.x = Math.random() * width;
            }

            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation * Math.PI / 180);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
            ctx.restore();
        });

        requestAnimationFrame(() => this.animateConfetti());
    }

    showToast(message, duration = 3000) {
        let container = document.getElementById('toast-container');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerText = message;
        
        container.appendChild(toast);
        
        void toast.offsetWidth;
        
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
            
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 400); 
            
        }, duration);
    }

    showAnswer() {
        if (this.currentLevelIndex >= this.maxUnlockedIndex && !this.isDevMode) return;

        this.userLines = [];
        this.currentDragLine = null;
        this.isDrawing = false;
        this.isWinning = false;

        for (let val = 1; val < this.maxNumber; val++) {
            const startIdx = this.numberIndices[val];
            const endIdx = this.numberIndices[val + 1];

            if (startIdx !== undefined && endIdx !== undefined) {
                const points = this.solutionPath.slice(startIdx, endIdx + 1);
                
                this.userLines.push({
                    startVal: val,
                    points: points,
                    widthScale: 0.5
                });
            }
        }

        this.draw();
    }

    // Misc Methods
    initContact() {
        const contactDiv = document.getElementById('contact-corner');
        const email = "luongdtran06@gmail.com";

        if (this.isMobile) {
            contactDiv.innerHTML = "✉️";
            contactDiv.onclick = async () => {
                try {
                    await navigator.clipboard.writeText(email);
                    alert("Email copied to clipboard: " + email);
                } catch (err) {
                    alert("Contact me at: " + email);
                }
            };
        } else {
            contactDiv.innerHTML = `<a href="mailto:${email}">Contact: ${email}</a>`;
        }
    }

    removeSplashScreen() {
        const webSplash = document.getElementById('web-splash');
        if (webSplash) {
            webSplash.classList.add('hidden');
            setTimeout(() => webSplash.remove(), 500); 
        }
    }
}

window.onload = () => { new Game(); };