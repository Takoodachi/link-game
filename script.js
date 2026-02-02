class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.wrapper = document.getElementById('game-wrapper');
        
        this.gridSize = 5; 
        this.level = 1;
        this.hints = 3;
        this.lastHintDate = null;
        this.maxNumber = 0;
        
        this.colors = [
            '#6d28d9', '#ef4444', '#059669', '#2563eb', 
            '#db2777', '#d97706', '#0891b2'
        ];
        
        this.grid = []; 
        this.solutionPath = []; 
        this.userLines = []; 
        this.currentDragLine = null;
        this.isDrawing = false;
        this.isDarkMode = false;
        this.isWinning = false;
        
        document.getElementById('btn-undo').onclick = () => this.undo();
        document.getElementById('btn-hint').onclick = () => this.useHint();
        document.getElementById('btn-reset').onclick = () => this.resetLevel();
        document.getElementById('theme-toggle').onclick = () => this.toggleTheme();
        
        this.initSidePanel();

        this.canvas.addEventListener('mousedown', (e) => this.handleStart(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMove(e));
        window.addEventListener('mouseup', () => this.handleEnd());
        
        this.canvas.addEventListener('touchstart', (e) => this.handleStart(e, true), {passive: false});
        this.canvas.addEventListener('touchmove', (e) => this.handleMove(e, true), {passive: false});
        window.addEventListener('touchend', () => this.handleEnd());

        window.addEventListener('resize', () => this.resizeCanvas());

        this.loadProgress();
        this.initTheme(); 
        this.checkDailyHint();
        this.initLevel();
    }

    initSidePanel() {
        const rulesContainer = document.getElementById('rules-container');
        const rulesBtn = document.getElementById('rules-toggle-btn');
        const panel = document.getElementById('rules-panel');

        rulesBtn.onclick = (e) => {
            e.stopPropagation(); 
            rulesContainer.classList.toggle('open');
            // Toggle icon X / i
            rulesBtn.innerText = rulesContainer.classList.contains('open') ? '✖' : 'i';
        };

        document.addEventListener('click', (e) => {
            if (rulesContainer.classList.contains('open')) {
                // If clicking outside panel AND not clicking the button
                if (!panel.contains(e.target) && !rulesBtn.contains(e.target)) {
                    rulesContainer.classList.remove('open');
                    rulesBtn.innerText = 'i';
                }
            }
        });
    }

    /* --- THEME & COLOR --- */
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

    /* --- SETUP & RESIZING --- */
    resizeCanvas() {
        const rect = this.wrapper.getBoundingClientRect();
        const displaySize = Math.floor(Math.min(rect.width, rect.height) - 20);
        const dpr = window.devicePixelRatio || 1;
        
        this.canvas.width = displaySize * dpr;
        this.canvas.height = displaySize * dpr;
        this.canvas.style.width = `${displaySize}px`;
        this.canvas.style.height = `${displaySize}px`;
        this.ctx.scale(dpr, dpr);

        this.cellSize = displaySize / this.gridSize;
        this.draw();
    }

    /* --- LEVEL GEN & STORAGE --- */
    loadProgress() {
        const saved = localStorage.getItem('linkGameData');
        if (saved) {
            const data = JSON.parse(saved);
            this.level = data.level || 1;
            this.hints = data.hints !== undefined ? data.hints : 3;
            this.lastHintDate = data.lastHintDate;
            this.gridSize = Math.min(8, 5 + Math.floor((this.level - 1) / 5));
        }
    }

    saveProgress() {
        const data = {
            level: this.level,
            hints: this.hints,
            lastHintDate: this.lastHintDate
        };
        localStorage.setItem('linkGameData', JSON.stringify(data));
        this.updateUI();
    }

    checkDailyHint() {
        const today = new Date().toDateString();
        if (this.lastHintDate && this.lastHintDate !== today) {
            this.hints++;
            alert("Daily Bonus: +1 Hint!");
        }
        this.lastHintDate = today;
        this.saveProgress();
    }

    initLevel() {
        this.isWinning = false;
        this.setRandomColor();
        this.userLines = [];
        this.currentDragLine = null;
        this.grid = Array(this.gridSize).fill().map(() => Array(this.gridSize).fill({ val: null, type: 'empty' }));
        this.resizeCanvas();
        this.solutionPath = this.generateHamiltonianPath();
        
        let pathIdx = 0;
        let numCounter = 1;
        
        while(pathIdx < this.solutionPath.length) {
            const pos = this.solutionPath[pathIdx];
            this.grid[pos.r][pos.c] = { val: numCounter, type: 'fixed' };
            if(pathIdx === this.solutionPath.length - 1) break;
            let gap = Math.floor(Math.random() * 3) + 2; 
            if (pathIdx + gap >= this.solutionPath.length) gap = this.solutionPath.length - 1 - pathIdx;
            if(gap === 0) gap = 1;
            pathIdx += gap;
            numCounter++;
        }

        const lastPos = this.solutionPath[this.solutionPath.length - 1];
        if (this.grid[lastPos.r][lastPos.c].val === null) {
            this.grid[lastPos.r][lastPos.c] = { val: numCounter, type: 'fixed' };
        } else {
            numCounter = this.grid[lastPos.r][lastPos.c].val;
        }

        this.maxNumber = numCounter;
        this.updateUI();
        this.draw();
    }

    generateHamiltonianPath() {
        const path = [];
        const visited = new Set();
        const N = this.gridSize;
        const solve = (r, c) => {
            path.push({r, c});
            visited.add(`${r},${c}`);
            if (path.length === N * N) return true;
            const dirs = [[0,1], [1,0], [0,-1], [-1,0]].sort(() => Math.random() - 0.5);
            for (let [dr, dc] of dirs) {
                const nr = r + dr, nc = c + dc;
                if (nr >= 0 && nr < N && nc >= 0 && nc < N && !visited.has(`${nr},${nc}`)) {
                    if (solve(nr, nc)) return true;
                }
            }
            visited.delete(`${r},${c}`);
            path.pop();
            return false;
        };
        let attempts = 0;
        while(attempts < 100) {
            path.length = 0;
            visited.clear();
            const startR = Math.floor(Math.random() * N);
            const startC = Math.floor(Math.random() * N);
            if (solve(startR, startC)) return path;
            attempts++;
        }
        return path; 
    }

    /* --- INPUT HANDLING --- */
    getPos(e, isTouch) {
        const rect = this.canvas.getBoundingClientRect();
        const clientX = isTouch ? e.touches[0].clientX : e.clientX;
        const clientY = isTouch ? e.touches[0].clientY : e.clientY;
        return {
            c: Math.floor((clientX - rect.left) / (rect.width / this.gridSize)),
            r: Math.floor((clientY - rect.top) / (rect.height / this.gridSize))
        };
    }

    getLineAt(r, c) {
        return this.userLines.find(line => 
            line.points.some(p => p.r === r && p.c === c)
        );
    }

    handleStart(e, isTouch) {
        if (this.isWinning) return; 
        if(isTouch) e.preventDefault();
        const {r, c} = this.getPos(e, isTouch);
        if (!this.isValidCell(r, c)) return;

        const cell = this.grid[r][c];
        if (cell.val !== null) {
            this.isDrawing = true;
            this.currentDragLine = {
                startVal: cell.val,
                points: [{r, c}]
            };
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
            if (prev.r === r && prev.c === c) {
                pts.pop();
                this.draw();
                return;
            }
        }

        if (Math.abs(r - last.r) + Math.abs(c - last.c) !== 1) return;

        if (this.isCellOccupied(r, c)) {
            const target = this.grid[r][c];
            const lineAtTarget = this.getLineAt(r, c);

            if (target.type === 'fixed' && target.val === this.currentDragLine.startVal + 1) {
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
            
            if (target.type === 'fixed' && target.val < this.currentDragLine.startVal) {
                 this.userLines = this.userLines.filter(l => l.startVal < target.val);
                 this.currentDragLine = {
                     startVal: target.val,
                     points: [{r, c}]
                 };
                 this.draw();
                 return;
            }

            if (lineAtTarget && lineAtTarget.startVal < this.currentDragLine.startVal) {
                const cutIdx = lineAtTarget.points.findIndex(p => p.r === r && p.c === c);
                const newPoints = lineAtTarget.points.slice(0, cutIdx + 1);
                this.currentDragLine = {
                    startVal: lineAtTarget.startVal,
                    points: newPoints
                };
                this.userLines = this.userLines.filter(l => l.startVal < lineAtTarget.startVal);
                this.draw();
                return;
            }
            return; 
        }

        pts.push({r, c});
        this.draw();
    }

    handleEnd() {
        this.isDrawing = false;
        this.currentDragLine = null;
        this.draw();
    }

    isValidCell(r, c) {
        return r >= 0 && r < this.gridSize && c >= 0 && c < this.gridSize;
    }

    isCellOccupied(r, c) {
        if (this.grid[r][c].type === 'fixed') return true;
        for (let line of this.userLines) {
            for (let p of line.points) {
                if (p.r === r && p.c === c) return true;
            }
        }
        if (this.currentDragLine) {
            for (let i = 0; i < this.currentDragLine.points.length - 1; i++) {
                const p = this.currentDragLine.points[i];
                if (p.r === r && p.c === c) return true;
            }
        }
        return false;
    }

    undo() {
        if (this.userLines.length > 0 && !this.isWinning) {
            this.userLines.pop();
            this.draw();
        }
    }

    resetLevel() {
        if (!this.isWinning) {
            this.userLines = [];
            this.draw();
        }
    }

    useHint() {
        if (this.hints <= 0 || this.isWinning) {
            if(!this.isWinning) alert("No hints remaining!");
            return;
        }
        this.hints--;
        this.saveProgress();
        const ctx = this.ctx;
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = this.isDarkMode ? "#FFFF00" : "#FFD700"; 
        ctx.lineWidth = this.cellSize * 0.4;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        const center = (x) => x * this.cellSize + this.cellSize/2;
        if(this.solutionPath.length > 0) {
            const start = this.solutionPath[0];
            ctx.moveTo(center(start.c), center(start.r));
            for(let i=1; i<this.solutionPath.length; i++) {
                const p = this.solutionPath[i];
                ctx.lineTo(center(p.c), center(p.r));
            }
        }
        ctx.stroke();
        ctx.restore();
        setTimeout(() => this.draw(), 1500);
    }

    checkWin() {
        const set = new Set();
        this.grid.forEach((row, r) => row.forEach((cell, c) => {
            if(cell.type === 'fixed') set.add(`${r},${c}`);
        }));
        this.userLines.forEach(line => {
            line.points.forEach(p => set.add(`${p.r},${p.c}`));
        });
        const isGridFull = (set.size === this.gridSize * this.gridSize);
        const requiredLines = this.maxNumber - 1;
        const currentLines = this.userLines.length;
        if (isGridFull && currentLines === requiredLines) {
            this.triggerWinSequence();
        }
    }

    triggerWinSequence() {
        this.isWinning = true;
        const sortedLines = [...this.userLines].sort((a, b) => a.startVal - b.startVal);
        this.winAnimationPoints = [];
        sortedLines.forEach(line => {
            this.winAnimationPoints.push(...line.points);
        });
        this.winFrame = 0;
        this.totalWinFrames = 120; 
        requestAnimationFrame(() => this.animateWinLoop());
    }

    animateWinLoop() {
        if (!this.isWinning) return;
        this.winFrame++;
        const progress = this.winFrame / this.totalWinFrames;
        this.draw(true, progress); 
        if (this.winFrame < this.totalWinFrames) {
            requestAnimationFrame(() => this.animateWinLoop());
        } else {
            setTimeout(() => this.handleLevelComplete(), 500);
        }
    }

    handleLevelComplete() {
        const msg = document.getElementById('message-area');
        msg.innerText = "Level Complete!";
        msg.classList.add('visible'); 
        
        if (this.level % 5 === 0) {
            this.hints++;
            alert(`Level ${this.level} Complete!\n\n🎉 You earned a free hint!`);
        }
        setTimeout(() => {
            this.level++;
            this.gridSize = Math.min(8, 5 + Math.floor((this.level - 1) / 5));
            this.saveProgress();
            msg.classList.remove('visible');
            msg.innerText = "";
            this.initLevel();
        }, 1000);
    }

    draw(isAnimating = false, animationProgress = 1) {
        if (!this.grid || !this.grid[0]) return;

        const cs = this.cellSize;
        const ctx = this.ctx;
        const W = this.canvas.width / (window.devicePixelRatio || 1);
        const H = this.canvas.height / (window.devicePixelRatio || 1);
        
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
            ctx.beginPath();
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.lineWidth = cs * 0.5;
            ctx.strokeStyle = lineColor;
            ctx.moveTo(cx(points[0].c), cy(points[0].r));
            for(let i=1; i<points.length; i++) ctx.lineTo(cx(points[i].c), cy(points[i].r));
            ctx.stroke();

            ctx.beginPath();
            ctx.lineWidth = cs * 0.15; 
            ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
            ctx.moveTo(cx(points[0].c), cy(points[0].r));
            for(let i=1; i<points.length; i++) ctx.lineTo(cx(points[i].c), cy(points[i].r));
            ctx.stroke();
        };

        if (isAnimating) {
            const maxIdx = Math.floor(this.winAnimationPoints.length * animationProgress);
            if (maxIdx > 1) {
                ctx.save();
                ctx.shadowBlur = 15;
                ctx.shadowColor = lineColor;
                drawPoly(this.winAnimationPoints.slice(0, maxIdx));
                ctx.restore();
            }
        } else {
            this.userLines.forEach(l => drawPoly(l.points));
            if(this.currentDragLine) drawPoly(this.currentDragLine.points);
        }

        ctx.font = `bold ${cs * 0.4}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        for(let r=0; r<this.gridSize; r++) {
            for(let c=0; c<this.gridSize; c++) {
                const cell = this.grid[r][c];
                if(cell.type === 'fixed') {
                    ctx.save();
                    ctx.shadowColor = "rgba(0,0,0,0.3)";
                    ctx.shadowBlur = 5;
                    ctx.shadowOffsetY = 3;
                    ctx.fillStyle = nodeColor;
                    ctx.beginPath();
                    ctx.arc(cx(c), cy(r), cs * 0.35, 0, Math.PI*2); 
                    ctx.fill();
                    ctx.restore();
                    ctx.fillStyle = nodeTextColor;
                    ctx.fillText(cell.val, cx(c), cy(r));
                }
            }
        }
    }
    
    updateUI() {
        document.getElementById('level-display').innerText = `Level: ${this.level}`;
        document.getElementById('hints-display').innerText = `Hints: ${this.hints}`;
    }
}

window.onload = () => {
    new Game();
};