
// Knowledge base for offline chess coaching

const OPENINGS = {
    "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR": "The King's Pawn. Classic.",
    "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR": "The Queen's Pawn. Solid.",
    "rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR": "Scandinavian Defense. Bold.",
    "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR": "Open Game. Tactical.",
    "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR": "Sicilian Defense. Complex.",
    "rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR": "French Defense. Solid structure.",
    "rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR": "Indian Defense. Flexible.",
    "rnbqkbnr/pp1ppppp/8/2p5/3P4/8/PPP1PPPP/RNBQKBNR": "Smith-Morra Gambit. Aggressive.",
    "rnbqkbnr/pppp1ppp/8/4p3/2P5/8/PP1PPPPP/RNBQKBNR": "English Opening. Positional.",
    "rnbqkb1r/pppppppp/5n2/8/2P5/8/PP1PPPPP/RNBQKBNR": "English Opening. Flexible response.",
    "rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKBNR": "Réti Opening. Hypermodern.",
    "rnbqkb1r/pppp1ppp/4pn2/8/3P4/8/PPP1PPPP/RNBQKBNR": "Nimzo-Indian Defense style setup.",
    "rnbqkb1r/pp1ppppp/2p2n2/8/3P4/8/PPP1PPPP/RNBQKBNR": "Slav Defense setup.",
    "rnbqkbnr/ppp2ppp/4p3/3p4/3P4/8/PPP1PPPP/RNBQKBNR": "Queen's Gambit Declined structure.",
    "rnbqkbnr/pp2pppp/2p5/3p4/3P4/8/PPP1PPPP/RNBQKBNR": "Slav Defense. Very solid.",
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR": "The starting position. A world of possibilities."
};

function getMaterialCount(fen) {
    const piecePart = fen.split(' ')[0];
    let count = 0;
    for (const char of piecePart) {
        if ("nrbqNRBQ".includes(char)) { 
             count++;
        }
    }
    return count;
}

function getOpeningInfo(fen) {
    const placement = fen.split(' ')[0];
    // Exact match
    for (const [key, comment] of Object.entries(OPENINGS)) {
        if (fen.includes(key.split(' ')[0])) return comment;
    }
    return null;
}

function isEndgame(fen) {
    const count = getMaterialCount(fen);
    return count <= 6; 
}

function getRandom(arr) {
    if (!arr || arr.length === 0) return "I am observing.";
    return arr[Math.floor(Math.random() * arr.length)];
}

// Simple heuristic scan to generate comments without engine eval
function scanBoardProperties(fen) {
    const parts = fen.split(' ');
    const board = parts[0];
    const turn = parts[1];
    const castling = parts[2];
    
    // Check castling rights
    const whiteCastled = !castling.includes('K') && !castling.includes('Q');
    const blackCastled = !castling.includes('k') && !castling.includes('q');
    
    // Simple commentary based on state
    if (turn === 'w' && castling.includes('K') && castling.includes('Q')) {
        return "Your King is still in the center. Consider castling soon.";
    }
    if (turn === 'b' && castling.includes('k') && castling.includes('q')) {
        return "Their King is uncastled. Look for attacks.";
    }
    
    // Check for Queen trade
    if (!board.includes('Q') && !board.includes('q')) {
        return "Queens are off. The endgame approaches.";
    }
    
    return null;
}

/**
 * Returns a random string from jokes, morals, or trivia
 */
function getIdleChatter(dialogues) {
    const categories = ['jokes', 'morals', 'trivia'];
    const randomCategory = categories[Math.floor(Math.random() * categories.length)];
    
    if (dialogues[randomCategory] && dialogues[randomCategory].length > 0) {
        return getRandom(dialogues[randomCategory]);
    }
    return "Take your time. Deep thought breeds success.";
}

/**
 * Returns { text: string, type: string }
 */
function getReaction(fen, evalScore, dialogues, lastMoveDiff = 0, isCheck = false, isCapture = false) {
    // 1. Check for specific Opening patterns
    const parts = fen.split(' ');
    const fullMove = parseInt(parts[5]) || 1;
    
    if (fullMove <= 4) {
        const openingComment = getOpeningInfo(fen);
        if (openingComment) return { text: openingComment, type: 'opening' };
        // If no specific opening, generic opening line
        if (Math.random() > 0.5) return { text: getRandom(dialogues.opening), type: 'opening' };
    }

    // 2. Check for Blunders/Great Moves based on Eval Diff
    // lastMoveDiff is (Score BEFORE move) - (Score AFTER move). 
    // If positive and large, user lost value (blunder).
    // If negative and large, user gained value (opponent blunder, or great find).
    
    // Note: evalScore passed here is User's perspective.
    
    if (lastMoveDiff > 2.0) return { text: getRandom(dialogues.blunder), type: 'blunder' };
    if (lastMoveDiff > 0.8) return { text: getRandom(dialogues.mistake), type: 'mistake' };
    if (lastMoveDiff < -1.5) return { text: getRandom(dialogues.great_move), type: 'great_move' };

    // 3. Contextual Events
    if (isCheck) return { text: getRandom(dialogues.check), type: 'check' };
    
    // 4. Endgame Context
    if (isEndgame(fen)) {
        if (Math.abs(evalScore) < 2.5) return { text: getRandom(dialogues.endgame), type: 'endgame' };
    }

    // 5. Fallback to heuristic scan if no engine eval is extreme
    // This allows the coach to say things without needing an engine opinion
    if (Math.abs(evalScore) < 0.5 && Math.random() < 0.3) {
        const staticComment = scanBoardProperties(fen);
        if (staticComment) return { text: staticComment, type: 'equal' };
    }

    // 6. Standard Evaluation Logic
    let category = "equal";
    
    if (evalScore > 4.0) category = "winning";
    else if (evalScore < -4.0) category = "losing";
    else if (evalScore > 1.0) category = "advantage";
    else if (evalScore < -1.0) category = "disadvantage";
    else category = "equal";
    
    // Mix in captures if equal/advantage to vary text
    if (isCapture && Math.random() > 0.6) {
        return { text: getRandom(dialogues.capture), type: 'capture' };
    }

    return { text: getRandom(dialogues[category]), type: category };
}

module.exports = { getReaction, getIdleChatter };
