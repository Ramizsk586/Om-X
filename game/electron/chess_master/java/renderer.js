
// ... State & Config ...
const brain = new ChessBrain(); // Assumes chess_logic.js is loaded
const boardEl = document.getElementById('board');
const overlaySvg = document.getElementById('overlay-svg');
const coachText = document.getElementById('coach-text');
const coachStatus = document.getElementById('coach-status');
const conceptCard = document.getElementById('concept-card');
const voiceBtn = document.getElementById('btn-voice');
const sparBtn = document.getElementById('btn-spar');
const coachImg = document.getElementById('coach-img');
const coachName = document.getElementById('coach-name');

let selectedSquare = null;
let currentValidMoves = [];
let currentApiKey = localStorage.getItem('cm_api_key') || "";
let currentProvider = localStorage.getItem('cm_ai_provider') || "gemini";
let currentModel = localStorage.getItem('cm_ai_model') || "";

// Settings
let panelCache = {};
let isVoiceEnabled = true; 
let showCoachArrows = false;
let arrowDuration = 5000;
let arrowTimer = null;
let typeInterval = null; 
let isSparring = false; // Spar mode active?

// Blunder Recovery State
let savedStateSnapshot = null;
let bestAlternativeMove = null;

// Game Tracking for Achievements & Story
let hasUsedUndo = false;
let hasUsedHint = false;
let lossStreak = parseInt(localStorage.getItem('cm_loss_streak') || "0");
let checksReceived = 0;
let kingMoveCount = 0;
let consecutiveCaptures = 0;

// Idle Timer for Jokes/Morals
let idleTimer = null;

// PERSONA MANAGEMENT
let currentPersonaId = 'dr_yun';
let currentPersonaConfig = null;
let winsAgainstYun = parseInt(localStorage.getItem('cm_wins_yun') || "0");

const FAMILY_IDS = ['dr_yun', 'yash', 'dr_san', 'isha'];
const PERSONA_DEFAULTS = {
    dr_yun: { name: "Dr. Yun", elo: 2500, depth: 15, style: "Socratic", role: "The Mentor", desc: "A wise grandmaster who focuses on principles." },
    yash: { name: "Yash", elo: 1200, depth: 5, style: "Aggressive", role: "The Rival", desc: "Your younger brother. Plays fast and loose." },
    dr_san: { name: "Dr. San", elo: 1800, depth: 10, style: "Defensive", role: "The Theorist", desc: "Obsessed with pawn structures and solidity." },
    isha: { name: "Isha", elo: 800, depth: 2, style: "Chaotic", role: "The Artist", desc: "Plays for beauty, not always for the win." }
};

// Achievements Data
const ACHIEVEMENTS = [
    // Fundamentals
    { id: "first_blood", title: "First Blood", category: "Fundamentals", desc: "Capture an enemy piece.", icon: "⚔️", tier: "bronze", guide: "Simply capture any of your opponent's pieces." },
    { id: "scholar", title: "Scholar", category: "Fundamentals", desc: "Connect the Neural Link.", icon: "📜", tier: "bronze", guide: "Go to AI Config panel and enter a valid API key." },
    { id: "student_driver", title: "Student Driver", category: "Fundamentals", desc: "Use Undo during a match.", icon: "🚗", tier: "bronze", guide: "Click the Undo button (↶) during a game." },
    { id: "march_forward", title: "March Forward", category: "Fundamentals", desc: "Move a pawn 2 squares.", icon: "⏩", tier: "bronze", guide: "On a pawn's first move, advance it two squares." },
    { id: "centralize", title: "Centralize", category: "Fundamentals", desc: "Control the center.", icon: "🎯", tier: "bronze", guide: "Place a pawn on d4 or e4 (or d5/e5 for Black)." },
    
    // The Hunt
    { id: "killer_pawn", title: "Killer Pawn", category: "The Hunt", desc: "Capture an enemy Pawn.", icon: "♟️", tier: "bronze", guide: "Use any piece to capture an opponent's pawn." },
    { id: "killer_knight", title: "Killer Knight", category: "The Hunt", desc: "Capture an enemy Knight.", icon: "🐴", tier: "bronze", guide: "Target the horses!" },
    { id: "killer_bishop", title: "Killer Bishop", category: "The Hunt", desc: "Capture an enemy Bishop.", icon: "♝", tier: "bronze", guide: "Capture the bishop." },
    { id: "killer_rook", title: "Killer Rook", category: "The Hunt", desc: "Capture an enemy Rook.", icon: "♜", tier: "silver", guide: "Rooks are usually in the corners." },
    { id: "queen_slayer", title: "Killer Queen", category: "The Hunt", desc: "Capture the enemy Queen.", icon: "♛", tier: "gold", guide: "The most powerful piece. Be careful not to lose yours in the process!" },
    { id: "killer_king", title: "Killer King", category: "The Hunt", desc: "Capture a piece with your King.", icon: "🤴", tier: "medium", guide: "Use your King to capture an enemy piece." },
    { id: "trade_off", title: "Trade Off", category: "The Hunt", desc: "Exchange Queens.", icon: "🤝", tier: "medium", guide: "Capture the enemy Queen with your own Queen." },
    { id: "serial_killer", title: "Serial Killer", category: "The Hunt", desc: "3 Captures in a row.", icon: "🔪", tier: "hard", guide: "Capture enemy pieces on 3 consecutive turns." },

    // Technique
    { id: "castle_kingside", title: "Kingside Castle", category: "Technique", desc: "Castle on the kingside (O-O).", icon: "🏰", tier: "bronze", guide: "Move your King two squares towards the Rook on the h-file. Ensure no pieces are between them and you haven't moved either piece yet." },
    { id: "castle_queenside", title: "Queenside Castle", category: "Technique", desc: "Castle on the queenside (O-O-O).", icon: "🏯", tier: "bronze", guide: "Move your King two squares towards the Rook on the a-file. Needs more space cleared than kingside." },
    { id: "en_passant", title: "En Passant", category: "Technique", desc: "Perform an En Passant capture.", icon: "👻", tier: "silver", guide: "When an enemy pawn moves two squares forward and lands beside your pawn, capture it as if it only moved one square." },
    { id: "pawn_promoted", title: "Pawn Promoted", category: "Technique", desc: "Promote a pawn to a Queen.", icon: "🚀", tier: "silver", guide: "Advance a pawn all the way to the other side of the board." },
    { id: "underpromotion", title: "Underpromotion", category: "Technique", desc: "Promote to N, B, or R.", icon: "👶", tier: "hard", guide: "Promote a pawn to a Knight, Bishop, or Rook instead of a Queen." },
    { id: "bongcloud", title: "Bongcloud Unleashed", category: "Technique", desc: "Play 1. e4 e5 2. Ke2 as White.", icon: "☁️", tier: "silver", guide: "A meme opening. Move King's pawn, then move King forward. Not recommended for serious play!" },
    { id: "sicilian_defense", title: "Sicilian Defense", category: "Technique", desc: "Play 1. e4 c5 as Black.", icon: "🌋", tier: "silver", guide: "As Black, if White plays e4, respond with c5 (moving the pawn in front of the bishop)." },
    { id: "queens_gambit", title: "Queen's Gambit", category: "Technique", desc: "Play 1. d4 d5 2. c4 as White.", icon: "👑", tier: "silver", guide: "As White, move Queen's pawn (d4), then after d5, move the c-pawn to c4." },
    { id: "fianchetto", title: "Fianchetto", category: "Technique", desc: "Develop Bishop to long diagonal.", icon: "📐", tier: "medium", guide: "Move pawn to g3/b3 and Bishop to g2/b2." },
    { id: "rook_lift", title: "Rook Lift", category: "Technique", desc: "Lift Rook to 3rd rank.", icon: "🏗️", tier: "medium", guide: "Move a Rook forward to the 3rd rank while pawns are still on the 2nd." },

    // Tactics
    { id: "early_bird", title: "Early Bird", category: "Tactics", desc: "Deliver a check before move 10.", icon: "🐦", tier: "bronze", guide: "Attack the enemy king early in the game." },
    { id: "pawn_snake", title: "Pawn Snake", category: "Tactics", desc: "Have 3 connected pawns on the same rank.", icon: "🐍", tier: "bronze", guide: "Align three pawns horizontally side-by-side." },
    { id: "pawn_chain", title: "Pawn Chain", category: "Tactics", desc: "Diagonal chain of 3 pawns.", icon: "🔗", tier: "medium", guide: "Connect 3 pawns diagonally protecting each other." },
    { id: "pacifist", title: "Pacifist", category: "Tactics", desc: "Reach move 20 with zero captures on the board.", icon: "🕊️", tier: "silver", guide: "Avoid capturing enemy pieces for the first 20 moves." },
    { id: "fork_master", title: "Fork Master", category: "Tactics", desc: "Attack two major pieces (Queen/Rook) with a Knight.", icon: "🍴", tier: "gold", guide: "Position your knight so it attacks two valuable pieces at once." },
    { id: "royal_family", title: "Royal Family", category: "Tactics", desc: "Fork King and Queen.", icon: "👑", tier: "hard", guide: "Attack the King and Queen simultaneously with a Knight." },
    { id: "early_queen", title: "Early Queen", category: "Tactics", desc: "Move Queen before move 5.", icon: "👸", tier: "medium", guide: "Bring out your Queen very early in the opening." },

    // Milestones
    { id: "checkmate", title: "Checkmate", category: "Milestones", desc: "Win a game by checkmate.", icon: "🏁", tier: "silver", guide: "Trap the enemy king so it cannot escape." },
    { id: "stalemate", title: "Stalemate", category: "Milestones", desc: "Draw by stalemate.", icon: "🤝", tier: "medium", guide: "Reach a position where the opponent has no legal moves but is not in check." },
    { id: "survivor", title: "Survivor", category: "Milestones", desc: "Reach move 30 in a game.", icon: "🛡️", tier: "bronze", guide: "Play a game that lasts at least 30 moves." },
    { id: "marathon", title: "Marathon", category: "Milestones", desc: "Reach move 80 in a game.", icon: "🏃", tier: "gold", guide: "Play a very long game (80 moves)." },
    { id: "blitz_krieg", title: "Blitzkrieg", category: "Milestones", desc: "Win in under 20 moves.", icon: "⚡", tier: "gold", guide: "Checkmate the opponent quickly." },
    { id: "scholars_mate", title: "Scholar's Mate", category: "Milestones", desc: "Win in 4 moves or less.", icon: "🎓", tier: "hard", guide: "Achieve checkmate in the first 4 moves." },
    { id: "the_long_game", title: "The Long Game", category: "Milestones", desc: "Win a game > 60 moves.", icon: "⏳", tier: "hard", guide: "Win a game that lasts longer than 60 moves." },

    // Campaign
    { id: "win_beginner", title: "Apprentice", category: "Campaign", desc: "Defeat Isha.", icon: "🎨", tier: "bronze", guide: "Beat Isha in a match." },
    { id: "win_intermediate", title: "Challenger", category: "Campaign", desc: "Defeat Yash.", icon: "🎮", tier: "silver", guide: "Beat Yash in a match." },
    { id: "win_advanced", title: "Strategist", category: "Campaign", desc: "Defeat Dr. San.", icon: "📚", tier: "gold", guide: "Beat Dr. San in a match." },
    { id: "win_expert", title: "Master", category: "Campaign", desc: "Defeat Dr. Yun.", icon: "🎓", tier: "gold", guide: "Beat Dr. Yun in a match." },
    { id: "family_reunion", title: "Family Reunion", category: "Campaign", desc: "Play against every family member.", icon: "👨‍👩‍👧‍👦", tier: "silver", guide: "Unlock and play a game against all 4 personas." },

    // Mastery
    { id: "underdog", title: "Underdog", category: "Mastery", desc: "Win against Dr. Yun (2500 ELO).", icon: "🔥", tier: "gold", guide: "Defeat the default Coach persona in a fair game." },
    { id: "queen_sacrifice", title: "The Immortal", category: "Mastery", desc: "Win a game after losing your Queen.", icon: "💎", tier: "gold", guide: "Allow your Queen to be captured, then go on to checkmate the opponent." },
    { id: "pawn_tsunami", title: "Pawn Tsunami", category: "Mastery", desc: "Win with 6 or more pawns remaining.", icon: "🌊", tier: "gold", guide: "Preserve your pawn structure and win the game." },
    { id: "the_wall", title: "The Wall", category: "Mastery", desc: "8 Pawns at Move 20.", icon: "🧱", tier: "medium", guide: "Don't lose a single pawn for the first 20 moves." },
    { id: "no_undo", title: "Iron Will", category: "Mastery", desc: "Win a game without using Undo.", icon: "🚫", tier: "silver", guide: "Play a full game and win without correcting your mistakes." },
    { id: "pure_skill", title: "Pure Skill", category: "Mastery", desc: "Win without Hints or Undos.", icon: "🧠", tier: "gold", guide: "Win unaided. No 'Show Me' and no 'Undo'." },
    { id: "clean_sheet", title: "Perfection", category: "Mastery", desc: "Win without losing a single pawn.", icon: "🛡️", tier: "gold", guide: "Protect your pawns! Don't let any be captured." },
    { id: "piece_hoarder", title: "Piece Hoarder", category: "Mastery", desc: "Win with all 8 officers alive.", icon: "🏰", tier: "hard", guide: "Win while keeping all Rooks, Knights, Bishops, and Queen." },
    { id: "bishop_pair", title: "Bishop Pair", category: "Mastery", desc: "Win with both Bishops alive.", icon: "♝", tier: "medium", guide: "Finish the game with both your bishops on the board." },
    { id: "minor_mate", title: "Minor Mate", category: "Mastery", desc: "Checkmate with Knight/Bishop.", icon: "🦄", tier: "medium", guide: "Deliver the final checkmate using a minor piece." },
    { id: "david_goliath", title: "David vs Goliath", category: "Mastery", desc: "Checkmate with a Pawn.", icon: "🦶", tier: "hard", guide: "Deliver checkmate with a pawn push." },
    { id: "king_march", title: "The King's Walk", category: "Mastery", desc: "Reach the enemy back rank with your King.", icon: "👑", tier: "gold", guide: "Walk your King all the way to the opponent's first rank." },
    { id: "eye_of_storm", title: "Eye of the Storm", category: "Mastery", desc: "Win with 5+ King moves.", icon: "🌀", tier: "hard", guide: "Move your King at least 5 times and still win." },
    { id: "immortal_king", title: "Immortal King", category: "Mastery", desc: "Win with King on Rank 5+.", icon: "🦁", tier: "hard", guide: "End the game with your King advanced past the middle of the board." },
    { id: "perfect_defense", title: "Perfect Defense", category: "Mastery", desc: "Win with 0 checks received.", icon: "🛡️", tier: "hard", guide: "Win a game without ever being put in check." },
    { id: "grandmaster", title: "Grandmaster", category: "Mastery", desc: "Defeat Dr. Yun at max difficulty (3200 ELO).", icon: "🏆", tier: "gold", guide: "Set Dr. Yun's ELO to 3200 in the AI Config and win." }
];

// --- Achievement Manager ---
const AchievementManager = {
    unlock: (id) => {
        const unlocked = JSON.parse(localStorage.getItem('cm_achievements') || "[]");
        if (!unlocked.includes(id)) {
            unlocked.push(id);
            localStorage.setItem('cm_achievements', JSON.stringify(unlocked));
            AchievementManager.showToast(id);
        }
    },
    isUnlocked: (id) => {
        const unlocked = JSON.parse(localStorage.getItem('cm_achievements') || "[]");
        return unlocked.includes(id);
    },
    showToast: (id) => {
        const ach = ACHIEVEMENTS.find(a => a.id === id);
        if(!ach) return;
        
        const toast = document.getElementById('achievement-toast');
        toast.innerHTML = `
            <div class="toast-icon">${ach.icon}</div>
            <div class="toast-content">
                <h4>Achievement Unlocked!</h4>
                <p>${ach.title}</p>
            </div>
        `;
        toast.className = `achievement-toast visible ${ach.tier}`; 
        
        // Play sound if possible
        const audio = new Audio('../assets/sounds/notify.mp3'); 
        audio.volume = 0.5;
        audio.play().catch(e => {}); 

        setTimeout(() => toast.classList.remove('visible'), 4000);
    }
};

// --- Achievement Detail Modal Logic ---
window.openAchievementDetail = (id) => {
    const ach = ACHIEVEMENTS.find(a => a.id === id);
    if(!ach) return;

    const overlay = document.getElementById('ach-detail-overlay');
    const header = document.getElementById('ach-detail-header');
    const icon = document.getElementById('ach-detail-icon');
    const title = document.getElementById('ach-detail-title');
    const desc = document.getElementById('ach-detail-desc');
    const status = document.getElementById('ach-detail-status');
    const guide = document.getElementById('ach-detail-guide');

    const unlocked = AchievementManager.isUnlocked(id);

    // Set content
    icon.innerText = ach.icon;
    title.innerText = ach.title;
    desc.innerText = ach.desc;
    
    if (guide && ach.guide) {
        guide.innerText = "Tip: " + ach.guide;
        guide.style.display = "block";
    } else if (guide) {
        guide.style.display = "none";
    }
    
    // Styling based on unlocked status
    if (unlocked) {
        status.className = 'ach-status-badge unlocked';
        status.innerText = 'Unlocked';
        desc.style.opacity = '1';
    } else {
        status.className = 'ach-status-badge locked';
        status.innerText = 'Locked';
        // Keep description visible so they know what to do
        desc.style.opacity = '0.8';
    }

    // Set header color based on tier
    header.className = `ach-modal-header ${ach.tier}`;

    overlay.classList.add('visible');
};

window.closeAchievementDetail = (e) => {
    if (e.target.id === 'ach-detail-overlay' || e.target.classList.contains('ach-modal-close')) {
        document.getElementById('ach-detail-overlay').classList.remove('visible');
    }
};

// --- Story Manager ---
const StoryManager = {
    check: () => {
        // Only trigger story beats when playing with Dr. Yun (the main mentor)
        if (currentPersonaId !== 'dr_yun') return;

        const unlocked = JSON.parse(localStorage.getItem('cm_unlocked_personas') || "['dr_yun']");
        
        // Scenario 1: Meet Isha (Creative) - Trigger after 1 Win against Yun OR played 2 games
        // Checking for 1 win or 3 total games
        const gamesPlayed = parseInt(localStorage.getItem('cm_games_played') || "0");
        
        if (!unlocked.includes('isha') && (winsAgainstYun >= 1 || gamesPlayed >= 3)) {
            setTimeout(() => {
                StoryManager.presentEvent({
                    id: 'meet_isha',
                    speaker: "Dr. Yun",
                    role: "The Mentor",
                    text: "I have been observing your play. You have a spark of creativity. I think it is time you met my niece, Isha. She sees the board... differently.",
                    acceptText: "Meet Isha",
                    declineText: "Not now",
                    onAccept: () => {
                        StoryManager.unlockPersona('isha');
                        loadPersona('isha');
                    }
                });
            }, 1500); // Slight delay after game over
            return;
        }

        // Scenario 2: Meet Yash (Aggressive) - Trigger after 2 consecutive losses
        if (!unlocked.includes('yash') && lossStreak >= 2) {
             setTimeout(() => {
                StoryManager.presentEvent({
                    id: 'meet_yash',
                    speaker: "Dr. Yun",
                    role: "The Mentor",
                    text: "You are struggling with the pressure. My nephew Yash specializes in aggressive tactics. Perhaps a duel with him will sharpen your defenses?",
                    acceptText: "Challenge Yash",
                    declineText: "I'll stick with you",
                    onAccept: () => {
                        StoryManager.unlockPersona('yash');
                        loadPersona('yash');
                    }
                });
             }, 1500);
            return;
        }
        
        // Scenario 3: Meet Dr. San (Defensive) - Trigger after 3 Wins or high ELO rating unlock
        if (!unlocked.includes('dr_san') && winsAgainstYun >= 3) {
             setTimeout(() => {
                StoryManager.presentEvent({
                    id: 'meet_san',
                    speaker: "Dr. Yun",
                    role: "The Mentor",
                    text: "Remarkable progress. You are ready for a different kind of test. Dr. San is a master of structure and defense. Can you break his fortress?",
                    acceptText: "Face Dr. San",
                    declineText: "Maybe later",
                    onAccept: () => {
                        StoryManager.unlockPersona('dr_san');
                        loadPersona('dr_san');
                    }
                });
             }, 1500);
            return;
        }
    },
    
    unlockPersona: (id) => {
        const unlocked = JSON.parse(localStorage.getItem('cm_unlocked_personas') || "['dr_yun']");
        if(!unlocked.includes(id)) {
            unlocked.push(id);
            localStorage.setItem('cm_unlocked_personas', JSON.stringify(unlocked));
        }
    },

    presentEvent: (evt) => {
        const overlay = document.getElementById('story-overlay');
        const title = document.getElementById('story-title');
        const subtitle = document.getElementById('story-subtitle');
        const msg = document.getElementById('story-message');
        const img = document.getElementById('story-speaker-img');
        const btnAccept = document.getElementById('story-btn-accept');
        const btnDecline = document.getElementById('story-btn-decline');

        title.innerText = evt.speaker;
        subtitle.innerText = evt.role;
        msg.innerText = evt.text;
        btnAccept.innerText = evt.acceptText;
        btnDecline.innerText = evt.declineText;
        
        // Ensure image
        img.src = "../assets/Dr.Yun.png"; // Default to Yun for now as he introduces them

        overlay.classList.add('visible');

        btnAccept.onclick = () => {
            overlay.classList.remove('visible');
            if(evt.onAccept) evt.onAccept();
        };

        btnDecline.onclick = () => {
            overlay.classList.remove('visible');
            typeText("As you wish. Let us continue our study.");
            speakText("As you wish.");
        };
    }
};

// --- Persona Logic ---
async function loadPersona(id) {
    currentPersonaId = id;
    
    // Load config from local storage or defaults
    const savedConfigs = JSON.parse(localStorage.getItem('cm_persona_settings') || "{}");
    const config = savedConfigs[id] || PERSONA_DEFAULTS[id];
    
    currentPersonaConfig = { ...PERSONA_DEFAULTS[id], ...config }; // Merge to ensure static props like desc exist
    
    // Get voice/dialogue data from main process
    const baseData = await window.api.coachGetPersona(id);
    if(baseData) {
        currentPersonaConfig.voiceSettings = baseData.voiceSettings;
        currentPersonaConfig.dialogues = baseData.dialogues; 
    }

    // Update UI
    coachName.innerText = currentPersonaConfig.name;
    let filename = "";
    if (id === 'dr_yun') filename = "Dr.Yun.png";
    else if (id === 'dr_san') filename = "Dr. San.png";
    else if (id === 'yash') filename = "Yash.png";
    else if (id === 'isha') filename = "Isha.png";
    
    coachImg.src = `../assets/${filename}`;
    coachImg.onerror = () => { coachImg.src = '../assets/pieces/wK.png'; };
    
    // Reset Tracking
    hasUsedUndo = false;
    hasUsedHint = false;
    checksReceived = 0;
    kingMoveCount = 0;
    consecutiveCaptures = 0;

    // Announce
    const greeting = id === 'dr_yun' ? "Welcome back." : `Hello! I am ${currentPersonaConfig.name}.`;
    typeText(greeting);
    speakText(greeting);
    
    // Track for achievement
    let metFamily = JSON.parse(localStorage.getItem('cm_met_family') || "[]");
    if(!metFamily.includes(id)) {
        metFamily.push(id);
        localStorage.setItem('cm_met_family', JSON.stringify(metFamily));
        if(metFamily.length >= 4) AchievementManager.unlock('family_reunion');
    }
}

// --- Navigation ---
window.switchPanel = async (panelId) => {
    // Update Sidebar UI
    document.querySelectorAll('.nav-icon').forEach(el => el.classList.remove('active'));
    const activeIcon = document.querySelector(`.nav-icon[onclick="switchPanel('${panelId}')"]`);
    if(activeIcon) activeIcon.classList.add('active');

    // Hide all panels
    document.querySelectorAll('.panel').forEach(el => el.classList.remove('active-panel'));
    
    // Show Target
    const target = document.getElementById(`panel-${panelId}`);
    if (target) {
        target.classList.add('active-panel');
        
        // Load Content if empty (for settings/ai/achievements)
        if (target.innerHTML.trim() === "") {
            let htmlName = '';
            if (panelId === 'settings') htmlName = 'settings';
            if (panelId === 'ai') htmlName = 'ai_config';
            if (panelId === 'achievements') htmlName = 'achievements';
            
            if (htmlName) {
                // Fetch from main process
                const html = await window.api.getPanelHtml(htmlName);
                target.innerHTML = html;
                
                // Init handlers for the new content
                if (panelId === 'ai') initAiPanel();
                if (panelId === 'settings') await initSettingsPanel();
                if (panelId === 'achievements') renderAchievements();
            }
        } else {
            // Refresh if reopening
            if (panelId === 'ai') initAiPanel();
            if (panelId === 'achievements') renderAchievements();
        }
    }
};

function renderAchievements() {
    const list = document.getElementById('achievement-list');
    if(!list) return;
    list.innerHTML = '';
    
    const unlocked = JSON.parse(localStorage.getItem('cm_achievements') || "[]");
    
    // Sorting order for tiers
    const tierOrder = { 'bronze': 1, 'silver': 2, 'medium': 3, 'gold': 4, 'hard': 5 };
    const sortByDifficulty = (a, b) => (tierOrder[a.tier] || 0) - (tierOrder[b.tier] || 0);

    // Group by category
    const categories = {};
    ACHIEVEMENTS.forEach(ach => {
        if (!categories[ach.category]) categories[ach.category] = [];
        categories[ach.category].push(ach);
    });

    // Define display order
    const catOrder = [
        "Fundamentals", 
        "The Hunt", 
        "Technique", 
        "Tactics", 
        "Campaign", 
        "Milestones", 
        "Mastery"
    ];

    catOrder.forEach(cat => {
        if (!categories[cat]) return;
        
        // Sort items within category
        const group = categories[cat].sort(sortByDifficulty);
        
        // Create Header
        const header = document.createElement('div');
        header.className = 'achievement-category-title';
        header.innerText = cat;
        list.appendChild(header);

        // Create Grid
        const grid = document.createElement('div');
        grid.className = 'achievement-grid';
        
        group.forEach(ach => {
            const isUnlocked = unlocked.includes(ach.id);
            const div = document.createElement('div');
            div.className = `achievement-card ${ach.tier} ${isUnlocked ? 'unlocked' : 'locked'}`;
            div.style.cursor = 'pointer';
            div.onclick = () => window.openAchievementDetail(ach.id);
            
            div.innerHTML = `
                <div class="achievement-icon">${ach.icon}</div>
                <div class="achievement-title">${ach.title}</div>
                <div class="achievement-desc" style="display:none;">${ach.desc}</div>
                <div class="achievement-date">${isUnlocked ? 'Unlocked' : 'Locked'}</div>
            `;
            grid.appendChild(div);
        });
        
        list.appendChild(grid);
    });
}

// --- Idle Timer Logic ---
function startIdleTimer() {
    clearIdleTimer();
    // 12 seconds
    idleTimer = setTimeout(async () => {
        // Only trigger if it is the player's turn (White) and not currently analyzing
        if (brain.turn === 'w' && !document.querySelector('.status-dot.thinking')) {
            const chatter = await window.api.coachIdleChatter(currentPersonaId);
            if (chatter) {
                typeText(chatter);
                speakText(chatter);
            }
        }
    }, 12000);
}

function clearIdleTimer() {
    if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
    }
}

// --- Game Loop Integration ---
function renderBoard() {
    boardEl.innerHTML = '';
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const sq = document.createElement('div');
            sq.className = `sq ${(r + c) % 2 === 0 ? 'light' : 'dark'}`;
            sq.onclick = () => handleClick(r, c);
            sq.dataset.row = r;
            sq.dataset.col = c;
            
            const p = brain.getPiece(r, c);
            if (p) {
                const piece = document.createElement('div');
                piece.className = 'piece';
                const filename = p.color + p.type.toUpperCase(); 
                piece.style.backgroundImage = `url('../assets/pieces/${filename}.png')`;
                sq.appendChild(piece);
            }
            
            // Legal Move Hints
            const moveHint = currentValidMoves.find(m => m.r === r && m.c === c);
            if (moveHint) {
                const hint = document.createElement('div');
                if (moveHint.isCapture) {
                    hint.className = 'legal-hint capture';
                } else {
                    hint.className = 'legal-hint dot';
                }
                sq.appendChild(hint);
            }

            if (selectedSquare && selectedSquare.r === r && selectedSquare.c === c) {
                sq.classList.add('highlight-move');
            }
            boardEl.appendChild(sq);
        }
    }
}

// Helper to check dynamic achievements after a move
function checkDynamicAchievements(move, prevFen, currentFen) {
    const history = brain.history;
    
    // 1. OPENINGS
    if (history.length >= 2) {
        const m1 = history[0]; // White 1
        const m2 = history[1]; // Black 1
        
        // Sicilian: 1. e4 c5
        // e4 is from (6,4) to (4,4). c5 is from (1,2) to (3,2).
        if (m1.from.r === 6 && m1.from.c === 4 && m1.to.r === 4 && m1.to.c === 4 &&
            m2.from.r === 1 && m2.from.c === 2 && m2.to.r === 3 && m2.to.c === 2) {
            AchievementManager.unlock('sicilian_defense');
        }
    }
    if (history.length >= 3) {
        // Queen's Gambit: 1. d4 d5 2. c4
        const m1 = history[0];
        const m2 = history[1];
        const m3 = history[2];
        if (m1.from.r === 6 && m1.from.c === 3 && m1.to.r === 4 && m1.to.c === 3 && // d4
            m2.from.r === 1 && m2.from.c === 3 && m2.to.r === 3 && m2.to.c === 3 && // d5
            m3.from.r === 6 && m3.from.c === 2 && m3.to.r === 4 && m3.to.c === 2) { // c4
            AchievementManager.unlock('queens_gambit');
        }
    }

    // 2. Early Bird (Check before move 10)
    // We check if opponent is in check now
    if (brain.isKingInCheck(brain.turn) && history.length < 20) { // 10 full moves = 20 half moves
        AchievementManager.unlock('early_bird');
    }

    // 3. Pawn Snake (3 connected pawns on rank)
    // Scan board for player (White)
    for (let r = 0; r < 8; r++) {
        let chain = 0;
        for (let c = 0; c < 8; c++) {
            const p = brain.getPiece(r, c);
            if (p && p.color === 'w' && p.type === 'p') {
                chain++;
                if (chain >= 3) {
                    AchievementManager.unlock('pawn_snake');
                    break;
                }
            } else {
                chain = 0;
            }
        }
    }
    
    // 3b. Pawn Chain (Diagonal)
    for (let r = 6; r >= 2; r--) {
        for (let c = 0; c < 8; c++) {
            const p = brain.getPiece(r, c);
            if (p && p.color === 'w' && p.type === 'p') {
                // Check up-left or up-right
                const checkDiagonal = (dr, dc) => {
                    let count = 1;
                    for (let i = 1; i < 3; i++) {
                        const nextP = brain.getPiece(r + (dr * i), c + (dc * i));
                        if (nextP && nextP.color === 'w' && nextP.type === 'p') count++;
                        else break;
                    }
                    return count >= 3;
                };
                if (checkDiagonal(-1, -1) || checkDiagonal(-1, 1)) {
                    AchievementManager.unlock('pawn_chain');
                }
            }
        }
    }

    // 4. Pacifist (Move 20 with no captures)
    if (history.length >= 40) { // 20 moves
        let pieces = 0;
        for(let r=0; r<8; r++) {
            for(let c=0; c<8; c++) {
                if (brain.getPiece(r, c)) pieces++;
            }
        }
        if (pieces === 32) AchievementManager.unlock('pacifist');
    }
    
    // 5. The Wall (8 Pawns at move 20)
    if (history.length === 40) {
        let whitePawns = 0;
        for(let r=0; r<8; r++) {
            for(let c=0; c<8; c++) {
                const p = brain.getPiece(r, c);
                if (p && p.color === 'w' && p.type === 'p') whitePawns++;
            }
        }
        if (whitePawns === 8) AchievementManager.unlock('the_wall');
    }
    
    // 6. Fianchetto Check
    const wb = brain.getPiece(7, 5); // f1 bishop (moved?)
    const bb = brain.getPiece(7, 2); // c1 bishop
    // Simple check: Bishop on g2 or b2
    const bg2 = brain.getPiece(6, 6);
    const bb2 = brain.getPiece(6, 1);
    if ((bg2 && bg2.type === 'b' && bg2.color === 'w') || (bb2 && bb2.type === 'b' && bb2.color === 'w')) {
        AchievementManager.unlock('fianchetto');
    }
    
    // 7. Rook Lift Check
    // Rook on rank 3 (index 5) with pawns on rank 2 (index 6) in front?
    // Simplified: Just any White Rook on Rank 3.
    for (let c = 0; c < 8; c++) {
        const p = brain.getPiece(5, c);
        if (p && p.type === 'r' && p.color === 'w') {
            // Check if there are own pawns behind it on rank 2
            const pawnBehind = brain.getPiece(6, c);
            if (pawnBehind && pawnBehind.type === 'p' && pawnBehind.color === 'w') {
                AchievementManager.unlock('rook_lift');
            }
        }
    }
}

async function handleClick(r, c) {
    try {
        clearIdleTimer();

        // Lock board if AI is thinking or Game Over
        if ((isSparring && brain.turn === 'b') || brain.getGameState() === 'checkmate') return;

        conceptCard.classList.remove('visible');
        const p = brain.getPiece(r, c);
        
        if (selectedSquare) {
            if (selectedSquare.r === r && selectedSquare.c === c) {
                selectedSquare = null;
                currentValidMoves = [];
                renderBoard();
                if (brain.turn === 'w') startIdleTimer();
                return;
            }
            
            const move = currentValidMoves.find(m => m.r === r && m.c === c);
            const isValid = !!move;

            if (isValid) {
                // --- Achievement Checks: Captures ---
                if (move.isCapture) {
                    consecutiveCaptures++;
                    AchievementManager.unlock('first_blood');
                    const targetPiece = brain.getPiece(r, c);
                    const movingPiece = brain.getPiece(selectedSquare.r, selectedSquare.c);
                    
                    if (targetPiece) {
                        if (targetPiece.type === 'p') AchievementManager.unlock('killer_pawn');
                        if (targetPiece.type === 'n') AchievementManager.unlock('killer_knight');
                        if (targetPiece.type === 'b') AchievementManager.unlock('killer_bishop');
                        if (targetPiece.type === 'r') AchievementManager.unlock('killer_rook');
                        if (targetPiece.type === 'q') {
                            AchievementManager.unlock('queen_slayer');
                            if (movingPiece.type === 'q') AchievementManager.unlock('trade_off');
                        }
                    }
                    
                    if (movingPiece.type === 'k') AchievementManager.unlock('killer_king');
                    
                    if (consecutiveCaptures >= 3) AchievementManager.unlock('serial_killer');
                } else {
                    consecutiveCaptures = 0; // Reset
                }

                // Snapshot before moving
                const preMoveFen = brain.getFen();
                savedStateSnapshot = brain.getSnapshot(); 
                
                const movingPiece = brain.getPiece(selectedSquare.r, selectedSquare.c);
                let promo = "";
                
                // --- Achievement Checks: Promotion & Special Moves ---
                if (movingPiece.type === 'p' && (r === 0 || r === 7)) {
                    // We need a way to detect underpromotion.
                    // For now, default is Queen, but let's assume if it happened, it's checked here.
                    // Since the current UI doesn't support promo selection popup, it defaults to Q.
                    // If we add promo selection, we'd check the choice here.
                    // Assuming default Q for now:
                    promo = "q";
                    AchievementManager.unlock('pawn_promoted');
                }
                
                if (movingPiece.type === 'k') {
                    kingMoveCount++;
                    if (Math.abs(c - selectedSquare.c) === 2) {
                        if (c > selectedSquare.c) AchievementManager.unlock('castle_kingside');
                        else AchievementManager.unlock('castle_queenside');
                    }
                }
                
                // En Passant check (if pawn moves diagonally to empty square)
                if (movingPiece.type === 'p' && !move.isCapture && c !== selectedSquare.c) {
                     // Logic in brain handles EP detection, but visually it's diagonal to empty
                     const targetSqContent = brain.getPiece(r, c);
                     if (!targetSqContent) AchievementManager.unlock('en_passant');
                }
                
                // King March check
                if (movingPiece.type === 'k' && (r === 0)) { // Reached rank 8 (row 0)
                    AchievementManager.unlock('king_march');
                }
                
                // Pawn Advances
                if (movingPiece.type === 'p') {
                    if (Math.abs(r - selectedSquare.r) === 2) AchievementManager.unlock('march_forward');
                    // Center Control
                    if ((r === 4 && c === 3) || (r === 4 && c === 4)) { // d4, e4 (indices 3,4)
                        AchievementManager.unlock('centralize');
                    }
                }
                
                // Early Queen
                if (movingPiece.type === 'q' && brain.history.length < 10) { // < 5 moves
                    AchievementManager.unlock('early_queen');
                }
                
                // Royal Family Fork Check
                if (movingPiece.type === 'n') {
                    // Perform move temporarily to check attacks? 
                    // Or check attacks from destination r,c
                    // We need to see if this knight attacks K and Q simultaneously.
                    // Opponent color:
                    const oppColor = 'b';
                    // Find Opponent K and Q
                    let kPos = null, qPos = null;
                    for(let i=0; i<8; i++) {
                        for(let j=0; j<8; j++) {
                            const p = brain.getPiece(i, j);
                            if (p && p.color === oppColor) {
                                if (p.type === 'k') kPos = {r:i, c:j};
                                if (p.type === 'q') qPos = {r:i, c:j};
                            }
                        }
                    }
                    if (kPos && qPos) {
                        // Check if Knight at r,c attacks both
                        const attacks = (tr, tc) => {
                            const dr = Math.abs(tr - r);
                            const dc = Math.abs(tc - c);
                            return (dr === 2 && dc === 1) || (dr === 1 && dc === 2);
                        };
                        if (attacks(kPos.r, kPos.c) && attacks(qPos.r, qPos.c)) {
                            AchievementManager.unlock('royal_family');
                        }
                    }
                }

                brain.movePiece(selectedSquare.r, selectedSquare.c, r, c);
                
                // Bongcloud check: 1. e4 e5 2. Ke2
                if (brain.history.length === 3) {
                    const m1 = brain.history[0];
                    const m3 = brain.history[2];
                    if (m1.from.r === 6 && m1.from.c === 4 && m1.to.r === 4 && m1.to.c === 4 &&
                        m3.from.r === 7 && m3.from.c === 4 && m3.to.r === 6 && m3.to.c === 4) {
                        AchievementManager.unlock('bongcloud');
                    }
                }

                const moveStr = `${files[selectedSquare.c]}${8-selectedSquare.r}${files[c]}${8-r}${promo}`;
                const postMoveFen = brain.getFen();
                
                checkDynamicAchievements(move, preMoveFen, postMoveFen);

                selectedSquare = null;
                currentValidMoves = [];
                renderBoard();
                
                // Check Game End for Player Move
                const state = brain.getGameState();
                const moveCount = brain.history.length;

                if (state === 'checkmate') {
                    AchievementManager.unlock('checkmate');
                    if (moveCount < 40) AchievementManager.unlock('blitz_krieg'); // < 20 full moves
                    if (moveCount <= 8) AchievementManager.unlock('scholars_mate'); // <= 4 moves
                    if (currentPersonaId === 'dr_yun' && currentPersonaConfig.elo >= 3200) {
                        AchievementManager.unlock('grandmaster');
                    }
                    if (currentPersonaId === 'dr_yun') AchievementManager.unlock('underdog');
                    
                    // Minor Mate / Pawn Mate checks
                    if (movingPiece.type === 'n' || movingPiece.type === 'b') AchievementManager.unlock('minor_mate');
                    if (movingPiece.type === 'p') AchievementManager.unlock('david_goliath');
                    
                    handleGameOver('win');
                    return;
                } else if (state === 'stalemate') {
                    AchievementManager.unlock('stalemate');
                    handleGameOver('draw');
                    return;
                }

                // Check Move Count
                if (moveCount >= 60) AchievementManager.unlock('survivor');
                if (moveCount >= 160) AchievementManager.unlock('marathon');
                if (moveCount > 120) AchievementManager.unlock('the_long_game');

                // 3. Decide Flow
                if (isSparring) {
                    clearArrows();
                    await triggerAiResponse();
                } else {
                    coachStatus.className = 'status-dot thinking';
                    coachText.textContent = "Analyzing...";
                    
                    try {
                        const blunderTimeout = new Promise((_, reject) => setTimeout(() => reject("timeout"), 2000));
                        const check = await Promise.race([
                            window.api.coachCheckBlunder({ prevFen: preMoveFen, currFen: postMoveFen }),
                            blunderTimeout
                        ]);
                        
                        if (check.isBlunder) {
                            handleBlunderDetected(check, moveStr);
                        } else {
                            updateVisualAids(); 
                            await triggerCoachAnalysis(moveStr);
                        }
                    } catch (e) {
                        // Fallback if blunder check times out or fails
                        updateVisualAids(); 
                        await triggerCoachAnalysis(moveStr);
                    }
                }
            } else {
                if (p && p.color === brain.turn) {
                    selectedSquare = { r, c };
                    currentValidMoves = brain.getValidMoves(r, c);
                    renderBoard();
                } else {
                    selectedSquare = null;
                    currentValidMoves = [];
                    renderBoard();
                    if (brain.turn === 'w') startIdleTimer();
                }
            }
        } else {
            if (p && p.color === brain.turn) {
                selectedSquare = { r, c };
                currentValidMoves = brain.getValidMoves(r, c);
                renderBoard();
            } else {
                if (brain.turn === 'w') startIdleTimer();
            }
        }
    } catch (e) {
        console.error("Board Interaction Error", e);
        // Ensure visual state recovers
        renderBoard();
    }
}

function handleGameOver(result) {
    coachStatus.className = 'status-dot ready';
    let msg = "";
    
    // Update Stats
    let gamesPlayed = parseInt(localStorage.getItem('cm_games_played') || "0");
    gamesPlayed++;
    localStorage.setItem('cm_games_played', gamesPlayed);

    if (result === 'win') {
        msg = "Checkmate! Well played. You have defeated me.";
        winsAgainstYun++; 
        localStorage.setItem('cm_wins_yun', winsAgainstYun);
        lossStreak = 0; // Reset loss streak
        localStorage.setItem('cm_loss_streak', 0);
        
        // Persona Wins
        if (currentPersonaId === 'isha') AchievementManager.unlock('win_beginner');
        if (currentPersonaId === 'yash') AchievementManager.unlock('win_intermediate');
        if (currentPersonaId === 'dr_san') AchievementManager.unlock('win_advanced');
        if (currentPersonaId === 'dr_yun') AchievementManager.unlock('win_expert');
        
        // Purity Wins
        if (!hasUsedUndo) AchievementManager.unlock('no_undo');
        if (!hasUsedUndo && !hasUsedHint) AchievementManager.unlock('pure_skill');
        
        // Stats Checks
        if (checksReceived === 0) AchievementManager.unlock('perfect_defense');
        if (kingMoveCount >= 5) AchievementManager.unlock('eye_of_storm');
        
        // Piece Counting
        let playerPawns = 0;
        let whiteQueens = 0;
        let whitePawns = 0;
        let whiteBishops = 0;
        let whiteKnights = 0;
        let whiteRooks = 0;
        let whiteKingRank = 7; 
        
        for(let r=0; r<8; r++) {
            for(let c=0; c<8; c++) {
                const p = brain.getPiece(r, c);
                if (p && p.color === 'w') {
                    if (p.type === 'p') whitePawns++;
                    if (p.type === 'q') whiteQueens++;
                    if (p.type === 'b') whiteBishops++;
                    if (p.type === 'n') whiteKnights++;
                    if (p.type === 'r') whiteRooks++;
                    if (p.type === 'k') whiteKingRank = r;
                }
            }
        }
        
        if (whitePawns === 8) AchievementManager.unlock('clean_sheet');
        if (whiteQueens === 0) AchievementManager.unlock('queen_sacrifice'); // Won with no queen
        if (whitePawns >= 6) AchievementManager.unlock('pawn_tsunami');
        
        if (whiteBishops === 2) AchievementManager.unlock('bishop_pair');
        if (whiteQueens === 1 && whiteRooks === 2 && whiteBishops === 2 && whiteKnights === 2) {
            AchievementManager.unlock('piece_hoarder');
        }
        
        if (whiteKingRank <= 3) AchievementManager.unlock('immortal_king'); // Rank 5+ (index 3 or less)

    } else if (result === 'lose') {
        msg = "Checkmate. Do not be discouraged. Reset and try again.";
        lossStreak++;
        localStorage.setItem('cm_loss_streak', lossStreak);
    } else {
        msg = "Stalemate. A draw is a respectable result.";
        // Streak stays same on draw
    }
    typeText(msg);
    speakText(msg);

    // --- STORYLINE CHECK ---
    StoryManager.check();
}

// --- Blunder Interaction ---
function handleBlunderDetected(data, playedMoveStr) {
    coachStatus.className = 'status-dot ready';
    const msg = "I have identified a potential error. Continue or explore alternatives?";
    typeText(msg);
    speakText("I detected a slip. Do you wish to reconsider?");
    
    clearArrows();
    const from = { c: files.indexOf(playedMoveStr[0]), r: 8 - parseInt(playedMoveStr[1]) };
    const to = { c: files.indexOf(playedMoveStr[2]), r: 8 - parseInt(playedMoveStr[3]) };
    drawArrow(from, to, 'bad');
    
    bestAlternativeMove = data.bestMove;
    
    const btnArea = document.querySelector('.response-area');
    btnArea.innerHTML = `
        <button class="response-btn" onclick="continueGame('${playedMoveStr}')">Continue</button>
        <button class="response-btn" onclick="showAlternatives()">Show Alternative</button>
    `;
}

window.continueGame = (moveStr) => {
    resetCoachButtons();
    clearArrows();
    updateVisualAids();
    triggerCoachAnalysis(moveStr); 
};

window.showAlternatives = () => {
    hasUsedHint = true; // Mark hint used
    
    if (savedStateSnapshot) {
        brain.restoreSnapshot(savedStateSnapshot);
        renderBoard();
    }
    
    clearArrows();
    
    if (bestAlternativeMove) {
        const from = { c: files.indexOf(bestAlternativeMove[0]), r: 8 - parseInt(bestAlternativeMove[1]) };
        const to = { c: files.indexOf(bestAlternativeMove[2]), r: 8 - parseInt(bestAlternativeMove[3]) };
        drawArrow(from, to, 'good');
    }
    
    typeText("Here is a stronger continuation. Try this line.");
    speakText("Consider this line instead.");
    resetCoachButtons();
};

function resetCoachButtons() {
    const btnArea = document.querySelector('.response-area');
    btnArea.innerHTML = `
        <button class="response-btn" onclick="coachAck()">Ok, got it.</button>
        <button class="response-btn" id="btn-show-me">Show me.</button>
    `;
    
    // Wire up "Show me" as a hint use
    document.getElementById('btn-show-me').onclick = () => {
        hasUsedHint = true;
        // Logic to show suggestion (re-trigger analysis or visual aid)
        updateVisualAids();
        typeText("Observe the suggested plan.");
    };
}

function updateResponseButtons(category) {
    const btnArea = document.querySelector('.response-area');
    let html = '';
    switch (category) {
        case 'blunder':
        case 'mistake':
            html = `<button class="response-btn" onclick="coachAck()">I see.</button>
                    <button class="response-btn" id="btn-show-me">Show refutation.</button>`;
            break;
        case 'great_move':
        case 'winning':
            html = `<button class="response-btn" onclick="coachAck()">Thanks!</button>
                    <button class="response-btn" id="btn-show-me">Next step?</button>`;
            break;
        case 'opening':
            html = `<button class="response-btn" onclick="coachAck()">Understood.</button>
                    <button class="response-btn" id="btn-show-me">Common lines?</button>`;
            break;
        case 'check':
            html = `<button class="response-btn" onclick="coachAck()">Defending.</button>`;
            break;
        case 'advantage':
            html = `<button class="response-btn" onclick="coachAck()">Pressing on.</button>
                    <button class="response-btn" id="btn-show-me">How to convert?</button>`;
            break;
        default:
            html = `<button class="response-btn" onclick="coachAck()">Ok, got it.</button>
                    <button class="response-btn" id="btn-show-me">Show me.</button>`;
    }
    btnArea.innerHTML = html;
    
    const btnShow = document.getElementById('btn-show-me');
    if(btnShow) {
        btnShow.onclick = () => {
            hasUsedHint = true;
            updateVisualAids();
        }
    }
}

// --- Sparring Mode Logic ---
window.toggleSpar = () => {
    isSparring = !isSparring;
    sparBtn.style.color = isSparring ? 'var(--wood-dark)' : '#666';
    sparBtn.style.backgroundColor = isSparring ? 'var(--wood-light)' : 'transparent';
    sparBtn.style.borderColor = isSparring ? 'var(--wood-dark)' : '#aaa';
    
    if (isSparring) {
        const msg = "Spar mode engaged. I will play Black.";
        typeText(msg);
        speakText(msg);
        clearArrows();
        if (brain.turn === 'b') triggerAiResponse();
    } else {
        const msg = "Spar mode off. Back to analysis.";
        typeText(msg);
        speakText(msg);
        if (brain.turn === 'w') startIdleTimer();
    }
};

async function animatePiece(from, to) {
    const fromIndex = from.r * 8 + from.c;
    const toIndex = to.r * 8 + to.c;
    const squares = document.querySelectorAll('.sq');
    const sourceSq = squares[fromIndex];
    const targetSq = squares[toIndex];
    const piece = sourceSq.querySelector('.piece');

    if (!piece || !targetSq) return;

    const sourceRect = sourceSq.getBoundingClientRect();
    const targetRect = targetSq.getBoundingClientRect();
    const dx = targetRect.left - sourceRect.left;
    const dy = targetRect.top - sourceRect.top;

    piece.style.zIndex = 100;
    piece.style.transition = 'transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)'; 
    piece.style.transform = `translate(${dx}px, ${dy}px)`;

    return new Promise(resolve => {
        piece.addEventListener('transitionend', resolve, { once: true });
        setTimeout(resolve, 550);
    });
}

async function triggerAiResponse() {
    coachStatus.className = 'status-dot thinking';
    coachText.textContent = "Thinking...";
    
    const fen = brain.getFen();
    
    // Get parameters from current Persona
    const elo = currentPersonaConfig.elo;
    const depth = currentPersonaConfig.depth;

    // --- TIMEOUT IMPLEMENTATION (5s limit) ---
    const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(null), 5000));
    const enginePromise = window.api.coachMove({ fen, elo, depth });

    const bestMoveStr = await Promise.race([enginePromise, timeoutPromise]);
    
    if (bestMoveStr) {
        const fc = files.indexOf(bestMoveStr[0]);
        const fr = 8 - parseInt(bestMoveStr[1]);
        const tc = files.indexOf(bestMoveStr[2]);
        const tr = 8 - parseInt(bestMoveStr[3]);
        
        await animatePiece({r: fr, c: fc}, {r: tr, c: tc});
        
        brain.movePiece(fr, fc, tr, tc);
        
        const p = brain.getPiece(tr, tc);
        if (p.type === 'p' && (tr === 0 || tr === 7)) p.type = 'q';

        renderBoard();
        coachStatus.className = 'status-dot ready';
        
        // Check Game End after AI Move
        const state = brain.getGameState();
        if (state === 'checkmate') {
            handleGameOver('lose');
            return;
        } else if (state === 'stalemate') {
            handleGameOver('draw');
            return;
        }

        const newFen = brain.getFen();
        const internalEval = brain.evaluate();
        let gameStateDesc = "Playing";
        
        if (brain.isKingInCheck(brain.turn)) {
            gameStateDesc = "Check";
            checksReceived++; // Track check count against player
        }
        
        // Race AI commentary too to prevent hang
        const commentTimeout = new Promise(resolve => setTimeout(() => resolve({ text: "Your move.", type: "equal" }), 3000));
        const commentPromise = window.api.coachAsk({
            fen: newFen,
            move: bestMoveStr,
            eval: -(internalEval / 100), 
            bestMove: null,
            apiKey: currentApiKey,
            provider: currentProvider,
            model: currentModel,
            gameState: gameStateDesc,
            personaId: currentPersonaId
        });

        const response = await Promise.race([commentPromise, commentTimeout]);

        const msg = response.text || "Your move.";
        typeText(msg);
        speakText(msg);
        
        updateResponseButtons(response.type);
        startIdleTimer();

    } else {
        // Fallback to internal engine if timeout or error
        const result = brain.findBestMove(3);
        if (result.move) {
            // Animate internal move
            await animatePiece(result.move.from, result.move.to);
            
            brain.movePiece(result.move.from.r, result.move.from.c, result.move.to.r, result.move.to.c);
            renderBoard();
            coachStatus.className = 'status-dot ready';
            typeText("Your move (Internal Engine fallback).");
            startIdleTimer();
        } else {
            typeText("Game Over or Engine Error.");
            coachStatus.className = 'status-dot ready';
        }
    }
}

// --- Visual Aids (Arrows) ---

function updateVisualAids() {
    if (!showCoachArrows) {
        overlaySvg.innerHTML = '';
        return;
    }

    clearArrows();
    if (arrowTimer) clearTimeout(arrowTimer);

    setTimeout(async () => {
        const fen = brain.getFen();
        
        // Timeout for visual aid calculation (2s max)
        let analysis = { bestMove: null };
        try {
            const timeout = new Promise((_, reject) => setTimeout(() => reject(), 2000));
            analysis = await Promise.race([window.api.coachAnalyze(fen), timeout]);
        } catch(e) { /* ignore */ }
        
        if (analysis.bestMove) {
            const m = analysis.bestMove;
            const from = { c: files.indexOf(m[0]), r: 8 - parseInt(m[1]) };
            const to = { c: files.indexOf(m[2]), r: 8 - parseInt(m[3]) };
            drawArrow(from, to, 'good');
        } else {
            const result = brain.findBestMove(3);
            if(result.move) drawArrow(result.move.from, result.move.to, 'good');
        }
        
        arrowTimer = setTimeout(clearArrows, arrowDuration);
    }, 100); 
}

function drawArrow(from, to, type) {
    const x1 = from.c * 12.5 + 6.25;
    const y1 = from.r * 12.5 + 6.25;
    const x2 = to.c * 12.5 + 6.25;
    const y2 = to.r * 12.5 + 6.25;

    const dx = Math.abs(from.c - to.c);
    const dy = Math.abs(from.r - to.r);
    const isKnight = (dx === 1 && dy === 2) || (dx === 2 && dy === 1);

    const color = type === 'good' ? 'var(--arrow-green)' : '#e74c3c';
    
    let defs = overlaySvg.querySelector('defs');
    if (!defs) {
        defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
        overlaySvg.appendChild(defs);
    }
    
    const id = `arrowhead-${type}`;
    if (!document.getElementById(id)) {
        const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
        marker.setAttribute("id", id);
        marker.setAttribute("markerWidth", "6");
        marker.setAttribute("markerHeight", "6");
        marker.setAttribute("refX", "5");
        marker.setAttribute("refY", "3");
        marker.setAttribute("orient", "auto");
        
        const poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        poly.setAttribute("points", "0 0, 6 3, 0 6");
        poly.setAttribute("fill", color);
        marker.appendChild(poly);
        defs.appendChild(marker);
    }

    if (isKnight) {
        let ex, ey;
        if (Math.abs(from.c - to.c) === 2) {
             ex = x2; ey = y1;
        } else {
             ex = x1; ey = y2;
        }
        
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", `M ${x1} ${y1} L ${ex} ${ey} L ${x2} ${y2}`);
        path.setAttribute("stroke", color);
        path.setAttribute("stroke-width", "1.5");
        path.setAttribute("fill", "none");
        path.setAttribute("opacity", "0.8");
        path.setAttribute("marker-end", `url(#${id})`);
        path.classList.add("arrow-anim");
        overlaySvg.appendChild(path);
    } else {
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", x1);
        line.setAttribute("y1", y1);
        line.setAttribute("x2", x2);
        line.setAttribute("y2", y2);
        line.setAttribute("stroke", color);
        line.setAttribute("stroke-width", "1.5"); 
        line.setAttribute("marker-end", `url(#${id})`);
        line.setAttribute("opacity", "0.8");
        line.classList.add("arrow-anim"); 
        overlaySvg.appendChild(line);
    }
}

function clearArrows() {
    const elements = overlaySvg.querySelectorAll('line, path');
    elements.forEach(el => el.remove());
}

const files = ['a','b','c','d','e','f','g','h'];

// --- Text To Speech & Animation ---

window.toggleVoice = () => {
    isVoiceEnabled = !isVoiceEnabled;
    voiceBtn.innerHTML = isVoiceEnabled ? '🔊' : '🔇';
    voiceBtn.style.opacity = isVoiceEnabled ? '1' : '0.5';
    if (!isVoiceEnabled) {
        window.speechSynthesis.cancel();
    }
};

function speakText(text) {
    if (!isVoiceEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    
    let preferred = null;
    const settings = currentPersonaConfig?.voiceSettings;

    if (settings) {
        preferred = voices.find(v => v.lang.includes(settings.lang) && v.name.toLowerCase().includes(settings.gender));
        if (preferred) {
            utterance.voice = preferred;
            utterance.pitch = settings.pitch || 1.0;
            utterance.rate = settings.rate || 1.0;
        } else {
            const fallbackName = settings.gender === 'female' ? 'Google US English' : 'Google UK English Male';
            preferred = voices.find(v => v.name.includes(fallbackName));
            if (preferred) utterance.voice = preferred;
        }
    } else {
        preferred = voices.find(v => v.name.includes("Google US English"));
        if (preferred) utterance.voice = preferred;
    }

    window.speechSynthesis.speak(utterance);
}

function typeText(text) {
    if (typeInterval) clearInterval(typeInterval);
    coachText.innerHTML = ''; 
    coachText.classList.add('typing');
    
    let i = 0;
    typeInterval = setInterval(() => {
        coachText.textContent += text.charAt(i);
        i++;
        if (i >= text.length) {
            clearInterval(typeInterval);
            coachText.classList.remove('typing');
        }
    }, 35); 
}

async function triggerCoachAnalysis(lastMove) {
    window.speechSynthesis.cancel();
    if (typeInterval) clearInterval(typeInterval);

    coachStatus.className = 'status-dot thinking';
    coachText.textContent = "Analyzing..."; 
    
    const fen = brain.getFen();
    const internalEval = brain.evaluate(); 
    
    let externalAnalysis = { bestMove: null, evaluation: internalEval / 100 };
    // Timeout for analysis (2s)
    try {
        const analysisTimeout = new Promise((_, reject) => setTimeout(() => reject("timeout"), 2000));
        externalAnalysis = await Promise.race([window.api.coachAnalyze(fen), analysisTimeout]);
    } catch(e) { console.log("External engine unavailable, using internal brain."); }
    
    let state = "Playing";
    const status = brain.getGameState();
    if (status === 'check') state = "Check";
    else if (status === 'checkmate') state = "Checkmate";
    else if (status === 'stalemate') state = "Stalemate";

    // --- TIMEOUT FIX FOR COACH COMMENTARY (5s) ---
    // If the API call hangs, we use a default response to unblock the UI.
    const responseTimeout = new Promise(resolve => setTimeout(() => resolve({
        text: "Analyzing position...",
        type: "equal"
    }), 5000));

    const askPromise = window.api.coachAsk({
        fen,
        move: lastMove,
        eval: externalAnalysis.evaluation || (internalEval / 100),
        bestMove: externalAnalysis.bestMove,
        apiKey: currentApiKey,
        provider: currentProvider,
        model: currentModel,
        gameState: state,
        personaId: currentPersonaId
    });

    const response = await Promise.race([askPromise, responseTimeout]);
    
    typeText(response.text);
    speakText(response.text);
    updateResponseButtons(response.type);
    
    coachStatus.className = 'status-dot ready';
    startIdleTimer();
}

function undoMove() {
    if (brain.history.length === 0) return;

    AchievementManager.unlock('student_driver');
    hasUsedUndo = true;

    // Get current history minus the last move
    let historyToReplay = brain.history.slice(0, -1);

    // If sparring (vs AI) and it is the player's turn, it means AI just moved.
    // We probably want to undo the AI move AND the player's move to get back to the player's turn.
    if (isSparring && brain.turn === 'w') { 
        // Undo AI move as well
        if (historyToReplay.length > 0) {
            historyToReplay.pop();
        }
    }

    // Use the replay function to reconstruct state without hard resetting pieces
    brain.replay(historyToReplay);
    
    renderBoard();
    clearArrows();
    startIdleTimer();
    typeText("Move undone.");
}

// Full restart: reset engine state, UI highlights, and timers
window.restartGame = () => {
    clearIdleTimer();
    if (arrowTimer) { clearTimeout(arrowTimer); arrowTimer = null; }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    
    brain.reset();
    selectedSquare = null;
    currentValidMoves = [];
    savedStateSnapshot = null;
    bestAlternativeMove = null;
    hasUsedUndo = false;
    hasUsedHint = false;
    checksReceived = 0;
    kingMoveCount = 0;
    consecutiveCaptures = 0;
    clearArrows();
    coachStatus.className = 'status-dot ready';
    
    renderBoard();
    typeText("New game started. Your move.");
    speakText("New game started. Your move.");
    startIdleTimer();
};

window.coachAck = function() {
    window.speechSynthesis.cancel();
    if (typeInterval) clearInterval(typeInterval);
    const txt = "Your turn.";
    typeText(txt);
    speakText(txt);
    startIdleTimer();
}

let selectedEditPersona = 'dr_yun';

function initAiPanel() {
    const keyInput = document.getElementById('api-key-input');
    const provSelect = document.getElementById('ai-provider');
    const modelSelect = document.getElementById('ai-model');
    const statusEl = document.getElementById('verify-status');
    
    const listEl = document.getElementById('persona-list');
    const detailEl = document.getElementById('config-detail');
    const emptyEl = document.getElementById('config-empty');
    
    const heroImg = document.getElementById('hero-img');
    const heroName = document.getElementById('hero-name');
    const heroRole = document.getElementById('hero-role');
    const heroDesc = document.getElementById('hero-desc');
    const badgeElo = document.getElementById('hero-badge-elo');
    const badgeStyle = document.getElementById('hero-badge-style');
    
    const eloSlider = document.getElementById('elo-slider');
    const eloDisplay = document.getElementById('elo-display');
    const depthSlider = document.getElementById('depth-slider');
    const depthDisplay = document.getElementById('depth-display');
    const styleSelect = document.getElementById('style-select');

    if(keyInput) keyInput.value = currentApiKey;
    if(provSelect) provSelect.value = currentProvider;
    if (currentModel) {
        const opt = document.createElement('option');
        opt.value = currentModel;
        opt.innerText = currentModel;
        opt.selected = true;
        modelSelect.appendChild(opt);
    }

    let savedConfigs = {};
    try {
        savedConfigs = JSON.parse(localStorage.getItem('cm_persona_settings') || "{}");
    } catch (e) {
        console.error("Error parsing saved persona settings:", e);
        savedConfigs = {};
    }

    let unlocked = ['dr_yun'];
    try {
        const stored = localStorage.getItem('cm_unlocked_personas');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) unlocked = parsed;
        }
    } catch (e) {
        console.error("Error parsing unlocked personas:", e);
    }

    function selectPersonaForEdit(id) {
        selectedEditPersona = id;
        if(listEl) {
            const items = listEl.querySelectorAll('.persona-item');
            items.forEach(el => el.classList.remove('active'));
            const idx = FAMILY_IDS.indexOf(id);
            if(idx !== -1 && items[idx]) items[idx].classList.add('active');
        }

        if(emptyEl) emptyEl.style.display = 'none';
        if(detailEl) detailEl.style.display = 'block';

        const config = { ...PERSONA_DEFAULTS[id], ...(savedConfigs[id] || {}) };
        
        if(heroName) heroName.innerText = config.name;
        if(heroRole) heroRole.innerText = config.role;
        if(heroDesc) heroDesc.innerText = config.desc;
        if(badgeElo) badgeElo.innerText = `ELO: ${config.elo}`;
        if(badgeStyle) badgeStyle.innerText = `Style: ${config.style}`;
        
        let imgName = id === 'dr_yun' ? "Dr.Yun.png" : 
                      id === 'dr_san' ? "Dr. San.png" : 
                      id === 'yash' ? "Yash.png" : "Isha.png";
        if(heroImg) {
            heroImg.src = `../assets/${imgName}`;
            heroImg.onerror = () => { heroImg.src = '../assets/pieces/wK.png'; };
        }

        if(eloSlider) eloSlider.value = config.elo;
        if(eloDisplay) eloDisplay.innerText = config.elo;
        if(depthSlider) depthSlider.value = config.depth;
        if(depthDisplay) depthDisplay.innerText = config.depth;
        if(styleSelect) styleSelect.value = config.style;
    }

    if (listEl) {
        listEl.innerHTML = '';
        FAMILY_IDS.forEach(id => {
            const defaults = PERSONA_DEFAULTS[id];
            const div = document.createElement('div');
            
            const isLocked = !unlocked.includes(id);
            div.className = `persona-item ${id === selectedEditPersona ? 'active' : ''} ${isLocked ? 'locked' : ''}`;
            
            if(!isLocked) div.onclick = () => selectPersonaForEdit(id);
            
            let imgName = id === 'dr_yun' ? "Dr.Yun.png" : 
                          id === 'dr_san' ? "Dr. San.png" : 
                          id === 'yash' ? "Yash.png" : "Isha.png";
            
            div.innerHTML = `
                <img src="../assets/${imgName}" onerror="this.src='../assets/pieces/wK.png'" class="p-avatar-sm">
                <div style="font-weight:600; color:#4a3b2a;">${defaults.name}</div>
            `;
            listEl.appendChild(div);
        });
        
        selectPersonaForEdit(selectedEditPersona);
    }

    if(eloSlider) {
        eloSlider.oninput = function() { 
            eloDisplay.innerText = this.value; 
            if(badgeElo) badgeElo.innerText = `ELO: ${this.value}`;
        };
    }
    if(depthSlider) {
        depthSlider.oninput = function() { depthDisplay.innerText = this.value; };
    }
    if(styleSelect) {
        styleSelect.onchange = function() {
            if(badgeStyle) badgeStyle.innerText = `Style: ${this.value}`;
        }
    }

    window.saveCurrentPersonaSettings = () => {
        const newConfig = {
            name: PERSONA_DEFAULTS[selectedEditPersona].name,
            role: PERSONA_DEFAULTS[selectedEditPersona].role,
            desc: PERSONA_DEFAULTS[selectedEditPersona].desc,
            elo: parseInt(eloSlider.value),
            depth: parseInt(depthSlider.value),
            style: styleSelect.value
        };
        
        savedConfigs[selectedEditPersona] = newConfig;
        localStorage.setItem('cm_persona_settings', JSON.stringify(savedConfigs));
        
        if (selectedEditPersona === currentPersonaId) {
            currentPersonaConfig.elo = newConfig.elo;
            currentPersonaConfig.depth = newConfig.depth;
            currentPersonaConfig.style = newConfig.style;
            typeText(`Adjustments made. Elo: ${newConfig.elo}, Depth: ${newConfig.depth}.`);
        } else {
            loadPersona(selectedEditPersona);
        }
        
        alert("Settings Saved & Persona Activated!");
    };
    
    window.verifyKey = async () => {
        const key = keyInput.value;
        const prov = provSelect.value;
        statusEl.innerText = "Verifying...";
        try {
            const res = await window.api.coachVerifyKey({ provider: prov, apiKey: key });
            if (res.success) {
                statusEl.innerText = "Verified!";
                statusEl.style.color = "green";
                modelSelect.innerHTML = "";
                res.models.forEach(m => {
                    const opt = document.createElement('option');
                    opt.value = m;
                    opt.innerText = m;
                    modelSelect.appendChild(opt);
                });
                AchievementManager.unlock('scholar');
            } else {
                statusEl.innerText = "Error: " + (res.error || "Failed");
                statusEl.style.color = "red";
            }
        } catch(e) {
            statusEl.innerText = "Connection error";
            statusEl.style.color = "red";
        }
    };
    
    window.saveAiConfig = () => {
        const key = document.getElementById('api-key-input').value;
        const prov = document.getElementById('ai-provider').value;
        const mod = document.getElementById('ai-model').value;

        if(key) {
            currentApiKey = key;
            currentProvider = prov;
            currentModel = mod;
            localStorage.setItem('cm_api_key', key);
            localStorage.setItem('cm_ai_provider', prov);
            localStorage.setItem('cm_ai_model', mod);
            alert("Neural Link Established.");
        } else {
            currentApiKey = "";
            localStorage.removeItem('cm_api_key');
            alert("Neural Link Severed.");
        }
    };
}

async function initSettingsPanel() {
    const arrowToggle = document.getElementById('coach-arrows-toggle');
    const timeSelect = document.getElementById('arrow-time-select');
    
    if(arrowToggle) {
        arrowToggle.checked = showCoachArrows;
        arrowToggle.onchange = (e) => {
            showCoachArrows = e.target.checked;
            if(showCoachArrows) updateVisualAids();
            else clearArrows();
        };
    }
    
    if(timeSelect) {
        timeSelect.value = arrowDuration;
        timeSelect.onchange = (e) => arrowDuration = parseInt(e.target.value);
    }

    window.setBoardTheme = (theme) => {
        document.querySelectorAll('.segment-btn').forEach(b => b.classList.remove('active'));
        if(event && event.target) event.target.classList.add('active');
        const root = document.documentElement;
        
        root.removeAttribute('data-board-theme');

        if(theme === 'wood') {
            root.style.setProperty('--wood-light', '#f0d9b5');
            root.style.setProperty('--wood-dark', '#b58863');
            root.style.setProperty('--bg-paper', '#fcf5e5');
        } else if (theme === 'marble') {
            root.style.setProperty('--wood-light', '#e0e0e0');
            root.style.setProperty('--wood-dark', '#757575');
            root.style.setProperty('--bg-paper', '#f5f5f5');
        } else if (theme === 'paper') {
            root.style.setProperty('--wood-light', '#fffdf5');
            root.style.setProperty('--wood-dark', '#8b7355');
            root.style.setProperty('--bg-paper', '#fffdf5');
        } else if (theme === 'ancient') {
            root.setAttribute('data-board-theme', 'ancient');
            root.style.setProperty('--wood-light', '#e8dcb5');
            root.style.setProperty('--wood-dark', '#a48666');
            root.style.setProperty('--bg-paper', '#e6dac3');
        }
    };
    
    window.toggleCoords = (checked) => {
        document.querySelectorAll('.coords').forEach(el => el.style.display = checked ? 'flex' : 'none');
    };

    const engineInput = document.getElementById('engine-path');
    if (engineInput) {
        const currentPath = await window.api.getEnginePath();
        engineInput.value = currentPath || "";
    }

    window.browseEngine = async () => {
        const path = await window.api.browseEngine();
        if (path) {
            document.getElementById('engine-path').value = path;
            await window.api.setEnginePath(path);
            alert("Engine path updated.");
        }
    };
}

window.onload = async () => {
    brain.reset();
    renderBoard();
    
    await loadPersona('dr_yun');
    
    showCoachArrows = true; 
    updateVisualAids();
    
    startIdleTimer();
};
