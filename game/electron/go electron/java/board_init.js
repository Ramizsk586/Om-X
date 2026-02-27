// board_init.js - Renders a non-interactive Go board.

function initBoardFrame() {
    const topCoords = document.querySelector('.coords-top');
    const leftCoords = document.querySelector('.coords-left');
    if (!topCoords || !leftCoords) return;

    topCoords.innerHTML = '';
    leftCoords.innerHTML = '';

    const letters = 'ABCDEFGHJ'.split(''); // No 'I' in Go coordinates
    for (let i = 0; i < 9; i++) {
        const xLabel = document.createElement('div');
        xLabel.textContent = letters[i];
        topCoords.appendChild(xLabel);

        const yLabel = document.createElement('div');
        yLabel.textContent = 9 - i;
        leftCoords.appendChild(yLabel);
    }
}

function initBoard() {
    const boardContainer = document.getElementById('board-container');
    if (!boardContainer) return;
    
    const goboard = document.createElement('div');
    goboard.className = 'goboard';
    
    // Create intersections container first
    const intersections = document.createElement('div');
    intersections.className = 'intersection';
    goboard.appendChild(intersections);
    
    // Star Points (Hoshi) for 9x9 board
    const starPoints = [[2,2], [2,6], [4,4], [6,2], [6,6]];
    const posPercentage = 100 / (9 - 1);
    starPoints.forEach(([r, c]) => {
        const star = document.createElement('div');
        star.className = 'star-point';
        star.style.top = `${r * posPercentage}%`;
        star.style.left = `${c * posPercentage}%`;
        // Append to intersections to align with grid
        intersections.appendChild(star);
    });
    
    boardContainer.innerHTML = '';
    boardContainer.appendChild(goboard);
}

document.addEventListener('DOMContentLoaded', () => {
    initBoardFrame();
    initBoard();

    // Apply coordinate visibility settings on load
    (async function() {
        try {
            if (window.electronAPI) {
                const prefs = await window.electronAPI.getPreferences();
                document.body.classList.toggle('show-coords', prefs.goShowCoordinates !== false);
            }
        } catch(e) {
            console.error("Failed to load coordinate settings.", e);
            document.body.classList.add('show-coords');
        }
    })();
});