
class GoBrain {
    constructor(size = 9) {
        this.size = size;
        this.reset();
    }

    reset(newSize = -1) {
        if (newSize > 0 && this.size !== newSize) {
            this.size = newSize;
        }
        this.board = Array(this.size).fill(0).map(() => Array(this.size).fill(0));
        this.turn = 'b'; // Black moves first
        this.captures = { b: 0, w: 0 };
        this.history = []; // For Ko rule
        this.moveHistory = []; // For game review
        this.lastMove = null;
        this.passed = false;
        this.gameOver = false;
        this.winner = null;
        this.scores = null;
    }

    placeStone(r, c) {
        if (this.gameOver || r < 0 || r >= this.size || c < 0 || c >= this.size) {
            return { success: false, error: "Invalid coordinates." };
        }

        if (this.board[r][c] !== 0) {
            return { success: false, error: "Intersection is already occupied." };
        }

        const player = this.turn === 'b' ? 1 : 2;
        const opponent = player === 1 ? 2 : 1;

        // Create a temporary board to test the move
        const tempBoard = this.board.map(row => row.slice());
        tempBoard[r][c] = player;

        // 1. Check for captures
        let capturedStones = 0;
        const neighbors = this.getNeighbors(r, c);
        for (const { nr, nc } of neighbors) {
            if (tempBoard[nr][nc] === opponent) {
                const group = this.getGroup(nr, nc, tempBoard);
                if (group.liberties === 0) {
                    capturedStones += group.stones.length;
                    for (const { sr, sc } of group.stones) {
                        tempBoard[sr][sc] = 0; // Remove captured stones
                    }
                }
            }
        }

        // 2. Check for suicide
        if (capturedStones === 0) {
            const ownGroup = this.getGroup(r, c, tempBoard);
            if (ownGroup.liberties === 0) {
                return { success: false, error: "Suicide move is not allowed." };
            }
        }
        
        // 3. Check for Ko
        const boardState = JSON.stringify(tempBoard);
        if (this.history.includes(boardState)) {
             return { success: false, error: "Ko rule prevents this move." };
        }

        // If all checks pass, apply the move to the real board
        const center = Math.floor(this.size / 2);
        const centerCoord = { x: c - center, y: center - r };

        this.moveHistory.push({ color: this.turn, r, c, center_coord: centerCoord });
        this.board = tempBoard;
        this.captures[this.turn] += capturedStones;
        this.lastMove = { r, c, center_coord: centerCoord };
        this.passed = false;

        this.history.push(boardState);
        if (this.history.length > 2) {
            this.history.shift(); // Keep history short for simple Ko
        }

        this.turn = this.turn === 'b' ? 'w' : 'b';
        return { success: true, captures: capturedStones };
    }

    passTurn() {
        if (this.gameOver) return;
        this.moveHistory.push({ color: this.turn, passed: true });
        if (this.passed) {
            this.endGame();
        } else {
            this.passed = true;
            this.lastMove = { passed: true };
            this.turn = this.turn === 'b' ? 'w' : 'b';
        }
    }
    
    endGame() {
        this.gameOver = true;
        const scores = this.calculateScore();
        this.scores = scores; // Store final scores
        if (scores.b > scores.w) this.winner = 'b';
        else if (scores.w > scores.b) this.winner = 'w';
        else this.winner = 'draw';
    }

    getGameRecord() {
        return {
            size: this.size,
            moveHistory: this.moveHistory,
            scores: this.scores || this.calculateScore(),
            winner: this.winner,
            captures: this.captures,
            players: { b: 'Black', w: 'White' } 
        };
    }

    getNeighbors(r, c) {
        const neighbors = [];
        if (r > 0) neighbors.push({ nr: r - 1, nc: c });
        if (r < this.size - 1) neighbors.push({ nr: r + 1, nc: c });
        if (c > 0) neighbors.push({ nr: r, nc: c - 1 });
        if (c < this.size - 1) neighbors.push({ nr: r, nc: c + 1 });
        return neighbors;
    }

    getGroup(r, c, board) {
        const player = board[r][c];
        if (player === 0) return { stones: [], liberties: 0 };

        const visited = new Set();
        const stoneStack = [{ r, c }];
        const groupStones = [];
        const libertySet = new Set();
        
        visited.add(`${r},${c}`);

        while (stoneStack.length > 0) {
            const { r: cr, c: cc } = stoneStack.pop();
            groupStones.push({ sr: cr, sc: cc });

            for (const { nr, nc } of this.getNeighbors(cr, cc)) {
                const neighborKey = `${nr},${nc}`;
                if (visited.has(neighborKey)) continue;
                visited.add(neighborKey);

                const neighborStone = board[nr][nc];
                if (neighborStone === 0) {
                    libertySet.add(neighborKey);
                } else if (neighborStone === player) {
                    stoneStack.push({ r: nr, c: nc });
                }
            }
        }
        return { stones: groupStones, liberties: libertySet.size };
    }
    
    calculateScore() {
        const territory = { b: 0, w: 0 };
        const visited = new Set();

        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                if (this.board[r][c] === 0 && !visited.has(`${r},${c}`)) {
                    const queue = [{r,c}];
                    visited.add(`${r},${c}`);
                    const region = [];
                    let touchesB = false;
                    let touchesW = false;

                    while(queue.length > 0) {
                        const {r: cr, c: cc} = queue.shift();
                        region.push({r: cr, c: cc});

                        for(const {nr, nc} of this.getNeighbors(cr, cc)) {
                            const neighborStone = this.board[nr][nc];
                            if (neighborStone === 1) touchesB = true;
                            else if (neighborStone === 2) touchesW = true;
                            else if (!visited.has(`${nr},${nc}`)) {
                                visited.add(`${nr},${nc}`);
                                queue.push({r: nr, c: nc});
                            }
                        }
                    }
                    
                    if (touchesB && !touchesW) territory.b += region.length;
                    else if (touchesW && !touchesB) territory.w += region.length;
                }
            }
        }

        // Komi (points for white for moving second)
        const komi = 6.5;

        return {
            b: territory.b + this.captures.b,
            w: territory.w + this.captures.w + komi
        };
    }

    toAsciiBoard() {
        const LETTERS = "ABCDEFGHJKLMNOPQRSTUVWXYZ".split('');
        const letters = LETTERS.slice(0, this.size);
        let output = "   " + letters.join(" ") + "\n";
        
        for (let r = 0; r < this.size; r++) {
            const rowNum = this.size - r;
            let rowStr = (rowNum < 10 ? " " : "") + rowNum + " ";
            for (let c = 0; c < this.size; c++) {
                const val = this.board[r][c];
                if (val === 0) rowStr += ". ";
                else if (val === 1) rowStr += "X "; // Black
                else rowStr += "O "; // White
            }
            rowStr += rowNum;
            output += rowStr + "\n";
        }
        output += "   " + letters.join(" ");
        return output;
    }
}
