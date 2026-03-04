




const { spawn } = require('child_process');

class MatchReviewer {
    constructor(enginePath) {
        this.enginePath = enginePath;
    }

    async analyzeMatch(gameData, playerColor, opponentElo) {
        // Simplified backend feedback for Game Over screen
        // Detailed analysis happens in the Review Window
        
        // We return neutral stats so the UI doesn't flash "0% Accuracy" incorrectly
        // The frontend 'review.html' is responsible for deep analysis.
        const analysis = {
            accuracy: "---", 
            blunders: "---",
            mistakes: "---",
            excellent: "---"
        };
        
        const eloChange = this.calculateEloChange(gameData, playerColor, opponentElo);

        return {
            ...analysis,
            eloChange
        };
    }

    calculateEloChange(gameData, color, opponentElo) {
        // Basic Elo Calc (K=20)
        let score = 0;
        const result = gameData.result;
        
        if (result === 'Checkmate') score = (gameData.winner === (color === 'w' ? 'White' : 'Black')) ? 1 : 0;
        else if (result === 'Stalemate' || result === 'Draw') score = 0.5;
        
        const currentElo = 1200; 
        const ea = 1 / (1 + Math.pow(10, (opponentElo - currentElo) / 400));
        
        let kFactor = 20;
        let delta = Math.round(kFactor * (score - ea));
        
        if (delta > 50) delta = 50;
        if (delta < -50) delta = -50;
        
        return delta;
    }
}

module.exports = MatchReviewer;
