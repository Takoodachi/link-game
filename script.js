class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.wrapper = document.getElementById('game-wrapper');
        
        // Game Configuration
        this.gridSize = 5; 
        this.level = 1;
        this.hints = 3;
        this.lastHintDate = null;
        
        // State
        this.grid = []; 
        this.solutionPath = []; 
        this.userLines = []; // Array of {startVal: number, points: []}
        this.currentDragLine = null;
        this.isDrawing = false;
        
        // Bind UI
        document.getElementById('btn-undo').onclick = () => this.undo();
        document.getElementById('btn-hint').onclick = () => this.useHint();
        document.getElementById('btn-reset').onclick = () => this.resetLevel();
        
        // Bind Inputs
        this.canvas.addEventListener('mousedown', (e) => this.handleStart(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMove(e));
        window.addEventListener('mouseup', () => this.handleEnd());
        
        this.canvas.addEventListener('touchstart', (e) => this.handleStart(e, true), {passive: false});
        this.canvas.addEventListener('touchmove', (e) => this.handleMove(e, true), {passive: false});
        window.addEventListener('touchend', () => this.handleEnd());

        // Handle Resize
        window.addEventListener('resize', () => this.resizeCanvas());

        this.loadProgress();
        this.checkDailyHint();
        this.initLevel();
    }

    /* --- SETUP & RESIZING --- */

    resizeCanvas() {
        // Get CSS display size
        const rect = this.wrapper.getBoundingClientRect();
        const size = Math.floor(Math.min(rect.width, rect.height) - 20); // padding adjustment
        
        // Set internal resolution to match display size (for crispness)
        this.canvas.width = size;
        this.canvas.height = size;
        
        this.cellSize = size / this.gridSize;
        this.draw();
    }

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
        this.saveProgress(); // Save the new date immediately
    }

    /* --- LEVEL GENERATION --- */

    initLevel() {
        this.resizeCanvas(); // Ensure size is correct before drawing
        this.solutionPath = this.generateHamiltonianPath();
        
        // Initialize Grid
        this.grid = Array(this.gridSize).fill().map(() => Array(this.gridSize).fill({ val: null, type: 'empty' }));

        // Place Sequential Anchors (1, 2, 3...)
        // We split the path into segments of random lengths (min 2, max 5 approx)
        let pathIdx = 0;
        let numCounter = 1;
        
        while(pathIdx < this.solutionPath.length) {
            // Place number at current index
            const pos = this.solutionPath[pathIdx];
            this.grid[pos.r][pos.c] = { val: numCounter, type: 'fixed' };
            
            // If this is the very last cell, stop
            if(pathIdx === this.solutionPath.length - 1) break;

            // Determine gap to next number
            // We want gaps to be decent size so the user has to draw lines
            let gap = Math.floor(Math.random() * 3) + 2; // Gap of 2 to 4 steps
            
            // Ensure we don't overshoot the end
            if (pathIdx + gap >= this.solutionPath.length) {
                gap = this.solutionPath.length - 1 - pathIdx;
            }
            
            // If gap is 0 (end reached), we just loop once more to place the final number
            if(gap === 0) gap = 1;

            pathIdx += gap;
            numCounter++;
        }

        // If the last placed number wasn't at the very end of the path, place one more
        const lastPos = this.solutionPath[this.solutionPath.length - 1];
        if (this.grid[lastPos.r][lastPos.c].val === null) {
            this.grid[lastPos.r][lastPos.c] = { val: numCounter, type: 'fixed' };
        }

        this.userLines = [];
        this.currentDragLine = null;
        this.updateUI();
        this.draw();
    }

    generateHamiltonianPath() {
        // Recursive Backtracking to find a path that fills the grid
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

        // Retry loop to prevent sticking
        let attempts = 0;
        while(attempts < 100) {
            path.length = 0;
            visited.clear();
            const startR = Math.floor(Math.random() * N);
            const startC = Math.floor(Math.random() * N);
            if (solve(startR, startC)) return path;
            attempts++;
        }
        return path; // Should ideally not fail often on small grids
    }

    /* --- INPUT HANDLING --- */

    getPos(e, isTouch) {
        const rect = this.canvas.getBoundingClientRect();
        const clientX = isTouch ? e.touches[0].clientX : e.clientX;
        const clientY = isTouch ? e.touches[0].clientY : e.clientY;
        
        // Scale appropriately
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        return {
            c: Math.floor((clientX - rect.left) * scaleX / this.cellSize),
            r: Math.floor((clientY - rect.top) * scaleY / this.cellSize)
        };
    }

    handleStart(e, isTouch) {
        if(isTouch) e.preventDefault();
        const {r, c} = this.getPos(e, isTouch);
        
        // Must start on a Fixed Number OR the end of an existing line?
        // For strict "Link" style: You drag from Number X to Number X+1
        const cell = this.grid[r][c];
        
        if (cell.val !== null) {
            // Started on a number
            this.isDrawing = true;
            this.currentDragLine = {
                startVal: cell.val,
                points: [{r, c}]
            };
            
            // If there was already a line starting from here, delete it to re-draw
            this.userLines = this.userLines.filter(l => l.startVal !== cell.val);
            this.draw();
        }
    }

    handleMove(e, isTouch) {
        if (!this.isDrawing || !this.currentDragLine) return;
        if(isTouch) e.preventDefault();
        
        const {r, c} = this.getPos(e, isTouch);
        const pts = this.currentDragLine.points;
        const last = pts[pts.length - 1];

        if (r === last.r && c === last.c) return; // Same cell
        if (Math.abs(r - last.r) + Math.abs(c - last.c) !== 1) return; // Not neighbor

        // Collision Check
        if (this.isCellOccupied(r, c)) {
            // Is it the target number? (startVal + 1)
            const target = this.grid[r][c];
            if (target.type === 'fixed') {
                if (target.val === this.currentDragLine.startVal + 1) {
                    // Success connection!
                    pts.push({r, c});
                    this.userLines.push(this.currentDragLine);
                    this.isDrawing = false;
                    this.currentDragLine = null;
                    this.checkWin();
                    this.draw();
                }
                // If we hit any other number, we stop/block
            } else {
                // If we hit our own current line (backtracking), remove last point
                if (pts.length > 1) {
                    const prev = pts[pts.length - 2];
                    if (prev.r === r && prev.c === c) {
                        pts.pop();
                        this.draw();
                    }
                }
            }
            return; 
        }

        // Valid move into empty space
        pts.push({r, c});
        this.draw();
    }

    handleEnd() {
        this.isDrawing = false;
        this.currentDragLine = null; // Discard dangling lines
        this.draw();
    }

    isCellOccupied(r, c) {
        // Check Fixed
        if (this.grid[r][c].type === 'fixed') return true;
        
        // Check Existing Lines
        for (let line of this.userLines) {
            for (let p of line.points) {
                if (p.r === r && p.c === c) return true;
            }
        }
        
        // Check Current Drag Line (self-collision)
        if (this.currentDragLine) {
            // Don't check the very last point (where we came from)
            for (let i = 0; i < this.currentDragLine.points.length - 1; i++) {
                const p = this.currentDragLine.points[i];
                if (p.r === r && p.c === c) return true;
            }
        }
        return false;
    }

    /* --- GAME LOGIC --- */

    undo() {
        if (this.userLines.length > 0) {
            this.userLines.pop(); // Remove most recently added line
            this.draw();
        }
    }

    resetLevel() {
        this.userLines = [];
        this.draw();
    }

    useHint() {
        if (this.hints <= 0) {
            alert("No hints remaining!");
            return;
        }
        
        this.hints--;
        this.saveProgress();

        // Show the whole solution path briefly
        const ctx = this.ctx;
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = "yellow";
        ctx.lineWidth = this.cellSize * 0.5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        ctx.beginPath();
        const center = (x) => x * this.cellSize + this.cellSize/2;
        
        // Draw the full continuous solution path
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

        setTimeout(() => this.draw(), 2000);
    }

    checkWin() {
        // We win if every sequential pair is connected?
        // Actually, in this logic, we win if the grid is Full.
        // But since we enforced "Connect N to N+1", checking grid fullness is sufficient.
        
        let filledCount = 0;
        const set = new Set();
        
        // Count Fixed
        this.grid.forEach((row, r) => row.forEach((cell, c) => {
            if(cell.type === 'fixed') {
                set.add(`${r},${c}`);
            }
        }));

        // Count Lines
        this.userLines.forEach(line => {
            line.points.forEach(p => set.add(`${p.r},${p.c}`));
        });

        if (set.size === this.gridSize * this.gridSize) {
            document.getElementById('message-area').innerText = "Level Complete!";
            setTimeout(() => {
                this.level++;
                this.gridSize = Math.min(8, 5 + Math.floor((this.level - 1) / 5));
                this.saveProgress();
                this.initLevel();
                document.getElementById('message-area').innerText = "";
            }, 1000);
        }
    }

    /* --- DRAWING --- */

    draw() {
        const cs = this.cellSize;
        const ctx = this.ctx;
        const W = this.canvas.width;
        const H = this.canvas.height;

        // Bg
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, W, H);

        // Helper
        const cx = c => c * cs + cs/2;
        const cy = r => r * cs + cs/2;

        // 1. Grid Lines
        ctx.strokeStyle = "#f3f4f6";
        ctx.lineWidth = 2;
        ctx.beginPath();
        for(let i=0; i<=this.gridSize; i++) {
            ctx.moveTo(i*cs, 0); ctx.lineTo(i*cs, H);
            ctx.moveTo(0, i*cs); ctx.lineTo(W, i*cs);
        }
        ctx.stroke();

        // 2. Draw Lines (Completed & Dragging)
        const drawPoly = (points) => {
            if(points.length < 2) return;
            ctx.beginPath();
            ctx.moveTo(cx(points[0].c), cy(points[0].r));
            for(let i=1; i<points.length; i++) ctx.lineTo(cx(points[i].c), cy(points[i].r));
            ctx.stroke();
        };

        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineWidth = cs * 0.5;
        ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--line-color');

        this.userLines.forEach(l => drawPoly(l.points));
        if(this.currentDragLine) drawPoly(this.currentDragLine.points);

        // 3. Draw Numbers
        ctx.font = `bold ${cs * 0.4}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        for(let r=0; r<this.gridSize; r++) {
            for(let c=0; c<this.gridSize; c++) {
                const cell = this.grid[r][c];
                if(cell.type === 'fixed') {
                    // Circle bg
                    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--node-color');
                    ctx.beginPath();
                    ctx.arc(cx(c), cy(r), cs * 0.4, 0, Math.PI*2);
                    ctx.fill();

                    // Text
                    ctx.fillStyle = "#fff";
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

// Start
window.onload = () => {
    new Game();
};