class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.wrapper = document.getElementById('game-wrapper');
        
        this.allLevels = [];
        this.currentLevelIndex = 0;
        this.maxUnlockedIndex = 0; 
        
        this.hints = 2;
        this.lastHintDate = null;
        
        this.gridSize = 5; 
        this.maxNumber = 0;
        this.grid = []; 
        this.solutionPath = []; 
        this.numberIndices = {}; 
        this.userLines = []; 
        this.currentDragLine = null;
        
        this.isDrawing = false;
        this.isDarkMode = false;
        this.isWinning = false;
        
        this.colors = [ '#6d28d9', '#ef4444', '#059669', '#2563eb', '#db2777', '#d97706', '#0891b2' ];
        
        document.getElementById('btn-undo').onclick = () => this.undo();
        document.getElementById('btn-hint').onclick = () => this.useHint();
        document.getElementById('btn-reset').onclick = () => this.resetLevel();
        document.getElementById('theme-toggle').onclick = () => this.toggleTheme();
        document.getElementById('level-select-btn').onclick = () => this.openLevelModal();
        document.getElementById('close-level-btn').onclick = () => this.closeLevelModal();
        document.getElementById('level-modal').addEventListener('click', (e) => {
            if (e.target.id === 'level-modal') {
                this.closeLevelModal();
            }
        });

        this.initSidePanel();
        this.bindInputs();

        window.addEventListener('resize', () => this.resizeCanvas());

        this.initTheme(); 
        this.loadProgress();
        this.checkDailyHint();
        this.fetchLevels();
    }

    async fetchLevels() {
        try {
            const response = await fetch('levels.json');
            if (!response.ok) throw new Error("Could not load levels");
            this.allLevels = await response.json();
            
            if (this.currentLevelIndex >= this.allLevels.length) {
                this.currentLevelIndex = this.allLevels.length - 1;
            }
            
            this.loadLevel(this.currentLevelIndex);
        } catch (error) {
            console.error(error);
            document.getElementById('message-area').innerText = "Loading...";
            setTimeout(() => {
                if(this.allLevels.length === 0) alert("Please verify levels.json is uploaded to GitHub.");
            }, 2000);
        }
    }

    loadLevel(index) {
        if (!this.allLevels || !this.allLevels[index]) return;

        this.currentLevelIndex = index;
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

    openLevelModal() {
        const modal = document.getElementById('level-modal');
        const grid = document.getElementById('level-grid');
        grid.innerHTML = '';
        
        if (this.allLevels.length === 0) {
            grid.innerHTML = '<p style="color:var(--text-color); padding:20px;">Levels loading...</p>';
        } else {
            for (let i = 0; i <= this.maxUnlockedIndex && i < this.allLevels.length; i++) {
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

    closeLevelModal() {
        document.getElementById('level-modal').classList.remove('open');
    }

    loadProgress() {
        const saved = localStorage.getItem('linkGameData');
        if (saved) {
            const data = JSON.parse(saved);
            this.currentLevelIndex = data.currentLevelIndex || 0;
            this.maxUnlockedIndex = data.maxUnlockedIndex || 0;
            this.hints = data.hints !== undefined ? data.hints : 2;
            this.lastHintDate = data.lastHintDate;
        }
    }

    saveProgress() {
        const data = {
            currentLevelIndex: this.currentLevelIndex,
            maxUnlockedIndex: this.maxUnlockedIndex,
            hints: this.hints,
            lastHintDate: this.lastHintDate
        };
        localStorage.setItem('linkGameData', JSON.stringify(data));
        this.updateUI();
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
            alert("New Day! Hints reset to 2.");
            this.saveProgress();
        }
    }
    
    initSidePanel() {
        const rulesContainer = document.getElementById('rules-container');
        const rulesBtn = document.getElementById('rules-toggle-btn');
        const panel = document.getElementById('rules-panel');

        const hasVisited = localStorage.getItem('linkGameHasVisited');
        if (!hasVisited) {
            rulesContainer.classList.add('open');
            localStorage.setItem('linkGameHasVisited', 'true');
        }

        rulesBtn.onclick = (e) => {
            e.stopPropagation(); 
            rulesContainer.classList.toggle('open');
        };

        document.addEventListener('click', (e) => {
            if (rulesContainer.classList.contains('open')) {
                if (!panel.contains(e.target) && !rulesBtn.contains(e.target)) {
                    rulesContainer.classList.remove('open');
                }
            }
        });
    }

    bindInputs() {
        this.canvas.addEventListener('mousedown', (e) => this.handleStart(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMove(e));
        window.addEventListener('mouseup', () => this.handleEnd());
        this.canvas.addEventListener('touchstart', (e) => this.handleStart(e, true), {passive: false});
        this.canvas.addEventListener('touchmove', (e) => this.handleMove(e, true), {passive: false});
        window.addEventListener('touchend', () => this.handleEnd());
    }

    initTheme() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            this.isDarkMode = true;
            document.body.classList.add('dark-mode');
            document.getElementById('theme-toggle').innerText = "☀️";
        } else {
            document.getElementById('theme-toggle').innerText = "🌙";
        }
    }

    toggleTheme() {
        this.isDarkMode = !this.isDarkMode;
        document.body.classList.toggle('dark-mode', this.isDarkMode);
        const btn = document.getElementById('theme-toggle');
        btn.innerText = this.isDarkMode ? "☀️" : "🌙";
        localStorage.setItem('theme', this.isDarkMode ? 'dark' : 'light');
        this.draw(); 
    }

    setRandomColor() {
        const randomIndex = Math.floor(Math.random() * this.colors.length);
        const newColor = this.colors[randomIndex];
        document.documentElement.style.setProperty('--line-color', newColor);
    }

    resizeCanvas() {
        const rect = this.wrapper.getBoundingClientRect();
        const displaySize = Math.floor(Math.min(rect.width, rect.height) - 20);
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
        if (this.isWinning) return; 
        if(isTouch) e.preventDefault();
        const {r, c} = this.getPos(e, isTouch);
        if (!this.isValidCell(r, c)) return;
        const cell = this.grid[r][c];
        if (cell.val !== null) {
            this.isDrawing = true;
            this.currentDragLine = { startVal: cell.val, points: [{r, c}] };
            this.userLines = this.userLines.filter(l => l.startVal < cell.val);
            this.draw();
        }
    }

    handleMove(e, isTouch) {
        if (!this.isDrawing || !this.currentDragLine || this.isWinning) return;
        if(isTouch) e.preventDefault();
        const {r, c} = this.getPos(e, isTouch);
        if (!this.isValidCell(r, c)) return;
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

            if (target.type === 'fixed') {
                if (target.val === this.currentDragLine.startVal) {
                    this.currentDragLine.points = [{r, c}]; 
                    this.draw();
                    return;
                }

                if (target.val === this.currentDragLine.startVal + 1) {
                    pts.push({r, c});
                    this.userLines.push(this.currentDragLine);
                    if (target.val < this.maxNumber) {
                        this.currentDragLine = { startVal: target.val, points: [{r, c}] };
                        this.userLines = this.userLines.filter(l => l.startVal !== target.val);
                    } else { 
                        this.isDrawing = false; 
                        this.currentDragLine = null; 
                    }
                    this.checkWin(); 
                    this.draw(); 
                    return;
                } 
                
                if (target.val === this.currentDragLine.startVal - 1) {
                     this.userLines = this.userLines.filter(l => l.startVal < target.val);
                     this.currentDragLine = { startVal: target.val, points: [{r, c}] };
                     this.draw(); 
                     return;
                }

                return;
            }

            const lineAtTarget = this.getLineAt(r, c);
            
            if (lineAtTarget && lineAtTarget.startVal === this.currentDragLine.startVal - 1) {
                this.draw();
                return;
            } else {
                return;
            }
        }
        
        pts.push({r, c}); this.draw();
    }

    handleEnd() { this.isDrawing = false; this.currentDragLine = null; this.draw(); }
    isValidCell(r, c) { return r >= 0 && r < this.gridSize && c >= 0 && c < this.gridSize; }
    isCellOccupied(r, c) {
        if (this.grid[r][c].type === 'fixed') return true;
        for (let line of this.userLines) { for (let p of line.points) { if (p.r === r && p.c === c) return true; } }
        if (this.currentDragLine) { for (let i = 0; i < this.currentDragLine.points.length - 1; i++) { const p = this.currentDragLine.points[i]; if (p.r === r && p.c === c) return true; } }
        return false;
    }
    
    undo() { if (this.userLines.length > 0 && !this.isWinning) { this.userLines.pop(); this.draw(); } }
    resetLevel() { if (!this.isWinning) { this.userLines = []; this.draw(); } }

    useHint() {
        if (this.hints <= 0 || this.isWinning) { if(!this.isWinning) alert("No hints remaining! Come back tomorrow."); return; }
        this.hints--; this.saveProgress();
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

    checkWin() {
        const set = new Set();
        this.grid.forEach((row, r) => row.forEach((cell, c) => { if(cell.type === 'fixed') set.add(`${r},${c}`); }));
        this.userLines.forEach(line => { line.points.forEach(p => set.add(`${p.r},${p.c}`)); });
        const isGridFull = (set.size === this.gridSize * this.gridSize);
        const requiredLines = this.maxNumber - 1;
        const currentLines = this.userLines.length;
        if (isGridFull && currentLines === requiredLines) { this.triggerWinSequence(); }
    }
    triggerWinSequence() {
        this.isWinning = true;
        const sortedLines = [...this.userLines].sort((a, b) => a.startVal - b.startVal);
        this.winAnimationPoints = [];
        sortedLines.forEach(line => { this.winAnimationPoints.push(...line.points); });
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
        if (this.currentLevelIndex === this.maxUnlockedIndex) {
            this.maxUnlockedIndex++;
        }
        setTimeout(() => {
            if (this.currentLevelIndex + 1 < this.allLevels.length) {
                this.currentLevelIndex++;
                this.saveProgress();
                this.loadLevel(this.currentLevelIndex);
            } else {
                alert("You have beaten all levels!");
            }
            msg.classList.remove('visible');
            msg.innerText = "";
        }, 1000);
    }
    updateUI() {
        if(this.allLevels && this.allLevels[this.currentLevelIndex]) {
            document.getElementById('level-select-btn').innerText = `Level ${this.allLevels[this.currentLevelIndex].id} ▾`;
        }
        document.getElementById('hints-display').innerText = `Hints: ${this.hints}`;
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

        const drawPoly = (points) => {
            if(points.length < 2) return;
            ctx.beginPath(); ctx.lineCap = "round"; ctx.lineJoin = "round";
            ctx.lineWidth = cs * 0.5; ctx.strokeStyle = lineColor;
            ctx.moveTo(cx(points[0].c), cy(points[0].r));
            for(let i=1; i<points.length; i++) ctx.lineTo(cx(points[i].c), cy(points[i].r));
            ctx.stroke();
            ctx.beginPath(); ctx.lineWidth = cs * 0.15; ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
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
            this.userLines.forEach(l => drawPoly(l.points));
            
            if(this.currentDragLine) {
                const prevLine = this.userLines.find(l => l.startVal === this.currentDragLine.startVal - 1);
                
                if (!prevLine) {
                    drawPoly(this.currentDragLine.points);
                } else {
                    const excludeSet = new Set(prevLine.points.map(p => `${p.r},${p.c}`));
                    const pts = this.currentDragLine.points;
                    
                    if (pts.length > 1) {
                        ctx.lineCap = "round"; ctx.lineJoin = "round";
                        ctx.lineWidth = cs * 0.5; ctx.strokeStyle = lineColor;
                        ctx.beginPath();
                        for(let i=0; i<pts.length-1; i++) {
                            const p1 = pts[i]; const p2 = pts[i+1];
                            if(excludeSet.has(`${p1.r},${p1.c}`) && excludeSet.has(`${p2.r},${p2.c}`)) continue;
                            ctx.moveTo(cx(p1.c), cy(p1.r));
                            ctx.lineTo(cx(p2.c), cy(p2.r));
                        }
                        ctx.stroke();

                        ctx.lineWidth = cs * 0.15; ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
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
                    ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.3)"; ctx.shadowBlur = 5; ctx.shadowOffsetY = 3;
                    ctx.fillStyle = nodeColor; ctx.beginPath();
                    ctx.arc(cx(c), cy(r), cs * 0.35, 0, Math.PI*2); ctx.fill(); ctx.restore();
                    ctx.fillStyle = nodeTextColor; ctx.fillText(cell.val, cx(c), cy(r));
                }
            }
        }
    }
}
window.onload = () => { new Game(); };