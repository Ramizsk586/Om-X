

const fs = require('fs');
const readline = require('readline');

// Comprehensive but lightweight Opening Dictionary
const ECO_DB = {
    "e4": "King's Pawn Opening",
    "d4": "Queen's Pawn Opening",
    "c4": "English Opening",
    "Nf3": "Zukertort Opening",
    "e4 e5": "Open Game",
    "e4 c5": "Sicilian Defense",
    "e4 e6": "French Defense",
    "e4 c6": "Caro-Kann Defense",
    "e4 d6": "Pirc Defense",
    "d4 Nf6": "Indian Game",
    "d4 d5": "Closed Game",
    "e4 c5 Nf3 d6": "Sicilian Defense: Modern Variations",
    "e4 c5 Nf3 Nc6": "Sicilian Defense: Old Sicilian",
    "e4 c5 Nf3 e6": "Sicilian Defense: French Variation",
    "e4 e5 Nf3 Nc6 Bb5": "Ruy Lopez",
    "e4 e5 Nf3 Nc6 Bc4": "Italian Game",
    "e4 e5 Nf3 Nc6 d4": "Scotch Game",
    "e4 e5 f4": "King's Gambit",
    "d4 d5 c4": "Queen's Gambit",
    "d4 Nf6 c4 g6": "King's Indian / Grünfeld",
    "d4 Nf6 c4 e6": "Nimzo-Indian / Queen's Indian",
    "e4 e6 d4 d5": "French Defense: Main Line",
    "e4 c6 d4 d5": "Caro-Kann Defense: Main Line",
    "1. b3": "Nimzo-Larsen Attack",
    "1. f4": "Bird's Opening",
    "1. g3": "King's Fianchetto Opening"
};

class MoveNode {
    constructor() {
        this.children = {}; // map move string -> MoveNode
        this.w = 0; // White wins
        this.b = 0; // Black wins
        this.d = 0; // Draws
    }
    
    get total() {
        return this.w + this.b + this.d;
    }
}

class ChessDB {
    constructor() {
        this.root = new MoveNode();
        this.dbLoaded = false;
        this.totalGames = 0;
        this.memoryLimitReached = false;
    }

    cleanMove(san) {
        // Remove annotations, checks, mates (e.g. "Nf3+?!", "O-O#") -> "Nf3", "O-O"
        // Also clean common BOM or weird spaces
        return san.replace(/[+#?!]/g, '').replace(/\ufeff/g, '').trim();
    }

    loadDatabase(filePath) {
        this.root = new MoveNode();
        this.dbLoaded = false;
        this.totalGames = 0;
        this.memoryLimitReached = false;

        if (!filePath || !fs.existsSync(filePath)) {
            console.log("DB: No file found at", filePath);
            return;
        }

        console.log("DB: Streaming PGN...", filePath);

        try {
            const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
            const rl = readline.createInterface({
                input: stream,
                crlfDelay: Infinity
            });

            let currentResult = null;
            let currentMovesStr = "";
            
            // Simple State Machine for PGN parsing
            // Standard PGN: [Header "Value"] ... 1. e4 e5 ... 1-0
            
            rl.on('line', (line) => {
                if (this.memoryLimitReached) return;

                const l = line.trim();
                if (!l) return; // Skip empty lines

                // Header Line
                if (l.startsWith('[')) {
                    // If we were accumulating moves, process them now as a game ended or new one started
                    if (currentMovesStr) {
                        this.processGame(currentMovesStr, currentResult);
                        currentMovesStr = "";
                        currentResult = null;
                        
                        // Memory Check every 5000 games
                        if (this.totalGames % 5000 === 0) {
                            const used = process.memoryUsage().heapUsed / 1024 / 1024;
                            if (used > 1400) { 
                                console.warn(`DB: Memory Cap Triggered (${used.toFixed(0)}MB). Stopping load.`);
                                this.memoryLimitReached = true;
                                rl.close();
                                rl.removeAllListeners('line');
                                stream.destroy();
                                this.dbLoaded = true;
                            }
                        }
                    }

                    if (l.startsWith('[Result')) {
                        if (l.includes('1-0')) currentResult = 'w';
                        else if (l.includes('0-1')) currentResult = 'b';
                        else currentResult = 'd';
                    }
                } else {
                    // Move Line
                    currentMovesStr += " " + l;
                }
            });

            rl.on('close', () => {
                if (!this.memoryLimitReached && currentMovesStr) {
                    this.processGame(currentMovesStr, currentResult);
                }
                this.dbLoaded = true;
                console.log(`DB: Loaded ${this.totalGames} games.`);
            });

        } catch (e) {
            console.error("DB Load Init Error:", e);
        }
    }

    processGame(rawMoves, result) {
        if (!result) {
            // Try to find result at end of string if header missed it
            if (rawMoves.includes("1-0")) result = 'w';
            else if (rawMoves.includes("0-1")) result = 'b';
            else result = 'd';
        }

        // Robust regex to strip comments { } and variations ( ) and move numbers
        // Remove results from the string so they aren't parsed as moves
        let clean = rawMoves
            .replace(/\{[^}]*?\}/g, "") 
            .replace(/\([^)]*?\)/g, "")
            .replace(/\d+\.+/g, "")
            .replace(/1-0|0-1|1\/2-1\/2|\*/g, "")
            .replace(/\$ \d+/g, "")
            .replace(/\s+/g, " ")
            .trim();

        const moves = clean.split(" ").filter(m => m.length >= 2); // Filter out single chars or empty

        if (moves.length > 0) {
            this.addToTrie(moves, result || 'd');
            this.totalGames++;
        }
    }

    addToTrie(moves, result) {
        let node = this.root;
        // 25 ply depth limit to save memory
        const limit = Math.min(moves.length, 25); 
        
        for (let i = 0; i < limit; i++) {
            const moveRaw = moves[i];
            const move = this.cleanMove(moveRaw);
            
            if (!move) continue; // Skip empty clean result

            if (!node.children[move]) {
                node.children[move] = new MoveNode();
            }
            node = node.children[move];
            
            if (result === 'w') node.w++;
            else if (result === 'b') node.b++;
            else node.d++;
        }
    }

    getOpeningName(movesSAN) {
        if (!movesSAN || movesSAN.length === 0) return "Starting Position";
        
        let bestMatch = "Unknown Opening";
        let currentSeq = "";
        let depth = 0;
        
        for (const m of movesSAN) {
            const clean = this.cleanMove(m);
            currentSeq += (currentSeq ? " " : "") + clean;
            
            // Direct match or prefix match if dictionary expands
            if (ECO_DB[currentSeq]) {
                bestMatch = ECO_DB[currentSeq];
            }
            depth++;
            if (depth > 12) break; 
        }
        
        return bestMatch;
    }

    getStats(movesSAN) {
        if (!this.dbLoaded && this.totalGames === 0) return { found: false, moves: [], total: 0, opening: "DB Loading..." };

        let node = this.root;
        
        // Navigate to current position
        for (const m of movesSAN) {
            const clean = this.cleanMove(m);
            if (node.children[clean]) {
                node = node.children[clean];
            } else {
                // Path not found in DB
                return { found: false, moves: [], total: 0, opening: this.getOpeningName(movesSAN) }; 
            }
        }
        
        // Collect candidates from current node children
        const candidates = Object.keys(node.children).map(move => {
            const child = node.children[move];
            const total = child.total;
            return {
                san: move,
                stats: {
                    w: child.w,
                    b: child.b,
                    d: child.d,
                    total: total,
                    whitePct: total > 0 ? (child.w / total) * 100 : 0,
                    drawPct: total > 0 ? (child.d / total) * 100 : 0,
                    blackPct: total > 0 ? (child.b / total) * 100 : 0
                }
            };
        });
        
        // Sort by popularity (Total games)
        candidates.sort((a,b) => b.stats.total - a.stats.total);
        
        return { 
            found: true, 
            moves: candidates, 
            total: node.total,
            opening: this.getOpeningName(movesSAN)
        };
    }
}

module.exports = new ChessDB();