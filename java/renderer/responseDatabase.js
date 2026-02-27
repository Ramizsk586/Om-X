/**
 * Om-X Response Database
 * Hardcoded knowledge for "@..." queries inside Omni Chat.
 * Coverage: panels, buttons, navigation, feature workflows, and page modules.
 */

const PANEL_REFERENCE = {
  // System settings window panels
  'panel-system': 'General Configuration panel (history, loading animation, AI chat button visibility, devtools startup).',
  'panel-security': 'Security & Defense panel (firewall, antivirus, VirusTotal controls and scan toggles).',
  'panel-password-vault': 'Password Vault host panel that mounts the secure vault module (unlock, AI keys, passkey rotation).',
  'panel-appearance': 'Visual Aesthetic panel (theme gallery, accent color, save theme).',
  'panel-shortcuts': 'Keyboard shortcut recorder panel.',
  'panel-search-matrix': 'Search Matrix panel (engine cards, default engine, @keyword editing, profile modal).',
  'panel-adblocker': 'Ad Shield panel (ad/tracker/social/miner/cosmetic/youtube toggles, custom rules, safe sites popup).',
  'panel-block': 'Block List panel (manual domain add + auto-blocked domains list).',
  'panel-advanced': 'System Intelligence panel (update check and release lineage).',
  'panel-creator': 'Creator profile panel (GitHub sync, module tiles, social links).',
  'panel-about': 'About panel (version/runtime details + update trigger).',

  // Neural hub window panels
  'panel-hub-dashboard': 'Neural Hub telemetry dashboard (active engine, latency, uptime).',
  'panel-hub-translator': 'Translator configuration panel mount.',
  'panel-hub-writer': 'Writer configuration panel mount.',
  'panel-hub-llm-chat': 'LLM Chat Hub panel (ChatGPT web app cards + custom services).',
  'panel-hub-animations': 'Loading animation chooser panel.',
  'panel-hub-ai-themes': 'AI response theme chooser panel.',
  'panel-hub-panel-tools': 'Panel Tools launcher panel (external web tools like Photopea).',
  'panel-hub-music-player': 'Music player design and enable/disable panel.',

  // Minecraft manager page panels
  'panel-ai-player': 'Minecraft AI Player panel.',
  'panel-llama': 'Minecraft llama.cpp server panel.',
  'panel-server': 'Minecraft Bedrock server panel.',
  'panel-llama-cli': 'Minecraft llama.cpp CLI builder panel.',
  'panel-pocket-tts': 'Minecraft Pocket-TTS server panel.',
  'panel-java-server': 'Minecraft Java server panel.',
  'panel-view-panel': 'Minecraft live view iframe panel.',
  'panel-help-panel': 'Minecraft help and reference panel'
};

const PANEL_DEEP_DIVE = {
  'panel-system': {
    title: 'General Configuration',
    purpose: 'Controls core browser behavior and quick-access UI options.',
    features: [
      '`feat-history` toggles local browsing history storage.',
      '`feat-loading-anim` enables or disables search/loading animations.',
      '`feat-ai-chat-btn` shows or hides the AI Chat quick button.',
      '`devtools-toggle` controls opening inspector for new tabs.'
    ],
    howTo: [
      'Open System Settings and select the General panel.',
      'Toggle the options you want to change.',
      'Click `btn-save-settings` to apply and persist.'
    ]
  },
  'panel-security': {
    title: 'Security & Defense',
    purpose: 'Main threat-protection panel for firewall, antivirus, and VirusTotal integration.',
    features: [
      '`feat-firewall` for malicious domain and phishing protection.',
      '`feat-antivirus` for heuristic download scanning.',
      '`feat-virustotal` master toggle for cloud scan controls.',
      '`btn-open-virustotal-popup` opens API key, quota, and manual URL scan tools.',
      '`feat-virustotal-url-scan` and `feat-virustotal-file-scan` configure scan scope.'
    ],
    howTo: [
      'Turn on the protections you need in Security & Defense.',
      'Enable VirusTotal and open the popup with `btn-open-virustotal-popup`.',
      'Verify key using `btn-verify-virustotal`, then scan with `btn-scan-virustotal-url`.',
      'Save with `btn-save-settings`.'
    ]
  },
  'panel-password-vault': {
    title: 'Password Vault',
    purpose: 'Hosts the secure vault module for key and passkey operations.',
    features: [
      'Panel is dynamically mounted by `loadVaultPanel()`.',
      '`btn-vault-unlock` unlocks vault sessions.',
      '`btn-save-ai-key` stores AI provider keys in vault.',
      '`btn-update-passkey` rotates master passkey.',
      '`btn-lock-vault-global` locks all active vault sessions.'
    ],
    howTo: [
      'Open Password Vault panel in Settings.',
      'Unlock with `btn-vault-unlock`.',
      'Add or rotate credentials with vault action buttons.',
      'Lock sessions with `btn-lock-vault-global` when done.'
    ]
  },
  'panel-appearance': {
    title: 'Visual Aesthetic',
    purpose: 'Theme preview and appearance customization panel.',
    features: [
      'Large theme gallery with click-to-preview cards (`theme-preview-card`).',
      'Current selection state and active preview feedback.',
      '`btn-save-theme` shortcut delegates to save workflow.',
      'Final persistence happens through `btn-save-settings`.'
    ],
    howTo: [
      'Open Appearance and click a theme card to preview.',
      'Confirm selection with `btn-save-theme` or `btn-save-settings`.',
      'Wait for save status confirmation.'
    ]
  },
  'panel-shortcuts': {
    title: 'Keyboard Shortcuts',
    purpose: 'Records and edits global shortcut mappings.',
    features: [
      'Rows are rendered dynamically into `shortcuts-container`.',
      'Shortcut inputs capture key combinations through recorder mode.',
      'Mappings include tab, sidebar, screenshot, devtools, and exit actions.'
    ],
    howTo: [
      'Open Shortcuts panel.',
      'Click a shortcut input and press the new key combination.',
      'Repeat for any commands, then click `btn-save-settings`.'
    ]
  },
  'panel-search-matrix': {
    title: 'Search Matrix',
    purpose: 'Manages search-engine cards, defaults, and profile-level search behavior.',
    features: [
      'Dynamically mounted by `loadMatrixSearchPanel()`.',
      'Engine profile editor with `btn-save-profile` and `btn-delete-profile`.',
      'Supports default engine choice and per-engine keyword behavior.'
    ],
    howTo: [
      'Open Search Matrix panel.',
      'Select an engine card and edit its profile settings.',
      'Save changes with `btn-save-profile`.',
      'Persist global settings with `btn-save-settings` if needed.'
    ]
  },
  'panel-adblocker': {
    title: 'Ad Shield',
    purpose: 'Network/content filtering controls for ads, trackers, and YouTube behavior.',
    features: [
      '`toggle-adblock-master` global blocking control.',
      '`toggle-adblock-trackers`, `toggle-adblock-social`, `toggle-adblock-miners` granular filters.',
      '`toggle-adblock-cosmetic` removes leftover ad placeholders.',
      '`toggle-adblock-ytskip` and `toggle-adblock-youtube-addon` add YouTube-specific controls.',
      '`adblock-custom-rules` for manual domain rules.',
      '`btn-open-safe-sites` opens trusted safe-site list.'
    ],
    howTo: [
      'Enable master block first, then tune granular toggles.',
      'Add custom domains to `adblock-custom-rules` if needed.',
      'Review trusted domains in Safe Sites popup.',
      'Save with `btn-save-settings`.'
    ]
  },
  'panel-block': {
    title: 'Blocked Websites & Threats',
    purpose: 'Manual and automatic domain blocklist management.',
    features: [
      '`block-input-domain` for manual domain entry.',
      '`btn-add-block` appends domain to active blocklist.',
      '`block-list-container` shows blocked domains with remove actions.',
      'Auto-blocked domains from security layer also appear here.'
    ],
    howTo: [
      'Type domain in `block-input-domain`.',
      'Click `btn-add-block` (or press Enter).',
      'Review/remove entries in block list.',
      'Click `btn-save-settings` to persist.'
    ]
  },
  'panel-advanced': {
    title: 'System Intelligence',
    purpose: 'Update status, version lineage, and rollback-aware maintenance.',
    features: [
      'Update banner with runtime status indicators.',
      '`btn-check-updates` triggers update checks.',
      '`update-history-container` lists release lineage and rollback actions.',
      'Panel data loads through `loadUpdateHistory()` when opened.'
    ],
    howTo: [
      'Open System Intelligence panel.',
      'Run `btn-check-updates` for current update status.',
      'Review release history and available rollback/reinstall options.'
    ]
  },
  'panel-creator': {
    title: 'Architect Profile',
    purpose: 'Creator profile with live GitHub stats and module portfolio.',
    features: [
      'Loads profile stats and repositories via `syncCreatorGitHub()`.',
      'Displays social links and module cards.',
      'Hides global save footer because this is informational.'
    ],
    howTo: [
      'Open Architect Profile panel.',
      'Wait for GitHub data to sync and render.',
      'Open project/social links directly from card actions.'
    ]
  },
  'panel-about': {
    title: 'About Om-X',
    purpose: 'Build/runtime metadata and update entry points.',
    features: [
      'Shows app version, channel, Chromium, Electron, Node, and V8 info.',
      '`btn-about-check-updates` gives update shortcut.',
      'Version fields are populated by `loadAboutInfo()`.'
    ],
    howTo: [
      'Open About panel to inspect runtime details.',
      'Use `btn-about-check-updates` to trigger update workflow.'
    ]
  },

  'panel-hub-dashboard': {
    title: 'Neural Command Center',
    purpose: 'Live telemetry overview for active engine, latency, and uptime.',
    features: [
      '`val-active-engine`, `val-latency`, and `val-uptime` live fields.',
      'Provider/model telemetry sync from global settings bridge.',
      'Read-only orchestration information for cross-window sync.'
    ],
    howTo: [
      'Open Dashboard in Neural Hub.',
      'Use displayed engine/latency/uptime to confirm AI pipeline health.'
    ]
  },
  'panel-hub-translator': {
    title: 'Translator Hub Panel',
    purpose: 'Mounted translator module configuration workspace.',
    features: [
      'Translator UI is mounted into `translator-ui-container`.',
      'Uses hidden save trigger `btn-save-translator` behind global save button.',
      'Supports provider/model verification and translator behavior tuning.'
    ],
    howTo: [
      'Open Translator tab in Neural Hub.',
      'Configure provider/model and verify credentials.',
      'Click global `btn-save-all` to run translator save action.'
    ]
  },
  'panel-hub-writer': {
    title: 'Syntactic Writer Hub Panel',
    purpose: 'Mounted writer module configuration workspace.',
    features: [
      'Writer UI is mounted into `writer-ui-container`.',
      'Uses hidden save trigger `btn-save-writer` via `btn-save-all`.',
      'Controls rewrite model/provider behavior for writer workflows.'
    ],
    howTo: [
      'Open Writer tab in Neural Hub.',
      'Tune provider/model settings.',
      'Use `btn-save-all` to apply writer configuration.'
    ]
  },
  'panel-hub-llm-chat': {
    title: 'LLM Chat Hub',
    purpose: 'Launchpad for ChatGPT and custom web-based LLM services.',
    features: [
      'Default ChatGPT card with quick start/open action.',
      'Custom service support saved in `llm_custom_services` localStorage.',
      'Service cards show URL, type, and feature tags.'
    ],
    howTo: [
      'Open LLM Chat Hub panel.',
      'Click Start on a card to open service in a new tab.',
      'Optionally add custom services for recurring tools.'
    ]
  },
  'panel-hub-animations': {
    title: 'Loading Animations',
    purpose: 'Selects global loading animation style for search/UI transitions.',
    features: [
      'Animation cards: pulse, spinner, bouncing, wave, and morph.',
      'Current selection preview and active animation status labels.',
      '`btn-save-animation` applies selected preference to localStorage.'
    ],
    howTo: [
      'Open Loading Animations panel.',
      'Click an animation card to select it.',
      'Press `btn-save-animation` (Apply Changes).'
    ]
  },
  'panel-hub-ai-themes': {
    title: 'AI Response Themes',
    purpose: 'Controls visual style for AI response containers.',
    features: [
      'Theme cards include neon, minimal, cyberpunk, glass, and cinematic.',
      'Selection state is shown in current-theme info block.',
      '`btn-save-ai-theme` persists `ai_response_theme` in localStorage.'
    ],
    howTo: [
      'Open AI Themes panel.',
      'Select desired theme card.',
      'Click `btn-save-ai-theme` to apply.'
    ]
  },
  'panel-hub-panel-tools': {
    title: 'Panel Tools',
    purpose: 'Quick launcher for external web utilities.',
    features: [
      'Tool cards with tags and one-click start buttons.',
      'Current catalog includes Photopea launcher.',
      'Uses browser tab opener for external tool sites.'
    ],
    howTo: [
      'Open Panel Tools tab.',
      'Choose a tool card and click Start to open in browser tab.'
    ]
  },
  'panel-hub-music-player': {
    title: 'Music Player',
    purpose: 'Configures mini-player enable state and player design style.',
    features: [
      '`player-enabled-toggle` enables/disables player UI.',
      'Design cards (classic, modern, dark, neon).',
      'Persists `music_player_design` and `music_player_enabled` in localStorage.'
    ],
    howTo: [
      'Open Music Player panel.',
      'Toggle player enabled state.',
      'Pick a design card; selection saves to local storage.'
    ]
  },

  'panel-ai-player': {
    title: 'Minecraft AI Player',
    purpose: 'Controls AI bot connection, autonomy, commanding, and building workflows.',
    features: [
      '`btn-ai-connect` connects/disconnects bot from target server.',
      '`btn-check-server` checks reachable server target before connect.',
      '`btn-ai-settings` opens saved-AI-profile selector modal.',
      'Capability toggles (`cap-*`) and autonomy toggles (`auto-*`).',
      'Tabs for Config, Console, Build, and Player inventory.',
      '`btn-ai-send-command` and quick command chips for natural commands.',
      '`btn-build-start` triggers structure build flow (Creative mode only).'
    ],
    howTo: [
      'Configure server IP/port/player name and optionally game version.',
      'Use `btn-check-server`, then `btn-ai-connect`.',
      'Adjust capabilities/autonomy toggles based on allowed behavior.',
      'Send command text with `btn-ai-send-command` or quick-command chips.',
      'For structures: upload schematic, confirm Creative mode, then run `btn-build-start`.'
    ]
  },
  'panel-llama': {
    title: 'Minecraft llama.cpp Server',
    purpose: 'Runs and manages local llama-server runtime for model-backed AI tasks.',
    features: [
      'Console and Config tabs with live status and uptime.',
      '`btn-browse-llama` selects server executable.',
      '`btn-browse-models` + `btn-scan-models` discovers GGUF models.',
      'Model compatibility checks against GPU memory.',
      '`btn-start-llama` / `btn-stop-llama` manage process lifecycle.',
      'Manual command preview and `btn-copy-llama-command`.'
    ],
    howTo: [
      'Set executable path and models folder.',
      'Scan models and choose one.',
      'Tune context/gpu-layers/threads/host/port.',
      'Start with `btn-start-llama`, monitor console and uptime.'
    ]
  },
  'panel-server': {
    title: 'Minecraft Bedrock Server',
    purpose: 'Cloud provider launchpad plus local Bedrock server process control.',
    features: [
      'Cloud tab lists external hosting providers.',
      'Local tab supports executable path selection (`btn-browse-bedrock`).',
      '`btn-start-bedrock` / `btn-stop-bedrock` process controls.',
      'Live console, command input, status indicator, and uptime.',
      'Server info cards for players/path/port.'
    ],
    howTo: [
      'Use Cloud tab for hosted panels, or switch to Local tab.',
      'Set local executable path with `btn-browse-bedrock`.',
      'Start server with `btn-start-bedrock` and monitor logs.',
      'Send runtime commands in console input when online.'
    ]
  },
  'panel-llama-cli': {
    title: 'llama.cpp CLI Builder',
    purpose: 'Generates local PowerShell command lines for llama-cli runs.',
    features: [
      '`btn-browse-llama-cli` selects CLI executable.',
      '`btn-browse-llama-cli-model` selects GGUF model file.',
      'Parameter controls for context, GPU layers, threads, temperature.',
      'Generated command output with `btn-copy-cli-command`.'
    ],
    howTo: [
      'Choose executable and model file paths.',
      'Tune runtime parameters.',
      'Copy generated command and run in terminal.'
    ]
  },
  'panel-pocket-tts': {
    title: 'Pocket-TTS Server',
    purpose: 'Runs local Pocket-TTS process and tracks service state.',
    features: [
      '`btn-browse-pockettts` sets executable path.',
      '`btn-start-pockettts` / `btn-stop-pockettts` control process.',
      'Console output stream and command input.',
      'Status, uptime, and server info panel.'
    ],
    howTo: [
      'Select executable path for Pocket-TTS server.',
      'Start service using `btn-start-pockettts`.',
      'Watch logs/status and stop with `btn-stop-pockettts` when done.'
    ]
  },
  'panel-java-server': {
    title: 'Minecraft Java Server',
    purpose: 'Configures and runs local Java server with generated startup command.',
    features: [
      '`btn-browse-java-folder` selects server directory.',
      'RAM, port, and Java executable controls.',
      'Live startup command preview (`java-command-preview`).',
      '`btn-start-java-server` / `btn-stop-java-server` process controls.',
      'Dedicated Java console with clear action.'
    ],
    howTo: [
      'Choose server folder and tune RAM/port/java executable.',
      'Review generated startup command preview.',
      'Start server with `btn-start-java-server` and monitor console.',
      'Stop service using `btn-stop-java-server`.'
    ]
  },
  'panel-view-panel': {
    title: 'Live View',
    purpose: 'Displays bot-view stream iframe when view streaming is enabled.',
    features: [
      '`view-panel-frame` iframe for streamed visual feed.',
      'Creative-mode-only indicator and guidance text.',
      'Depends on Build tab stream toggle.'
    ],
    howTo: [
      'Enable stream from AI Player Build tab (`build-view-toggle`).',
      'Open View panel to watch live iframe feed.'
    ]
  },
  'panel-help-panel': {
    title: 'Help',
    purpose: 'Quick operational guidance for Minecraft manager panels.',
    features: [
      'Lists supported workflows for AI Player, Build, Player, and server modules.',
      'Highlights compatibility and mode requirements.'
    ],
    howTo: [
      'Open Help panel for module-specific instructions before setup.',
      'Follow listed prerequisites (Creative mode, version constraints, etc.).'
    ]
  }
};

const PANEL_ALIAS_TO_ID = {
  'general panel': 'panel-system',
  'system panel': 'panel-system',
  'security panel': 'panel-security',
  'password panel': 'panel-password-vault',
  'vault panel': 'panel-password-vault',
  'appearance panel': 'panel-appearance',
  'theme panel': 'panel-appearance',
  'shortcuts panel': 'panel-shortcuts',
  'search matrix panel': 'panel-search-matrix',
  'ad shield panel': 'panel-adblocker',
  'adblock panel': 'panel-adblocker',
  'block panel': 'panel-block',
  'blocklist panel': 'panel-block',
  'advanced panel': 'panel-advanced',
  'creator panel': 'panel-creator',
  'about panel': 'panel-about',

  'hub dashboard': 'panel-hub-dashboard',
  'translator panel': 'panel-hub-translator',
  'writer panel': 'panel-hub-writer',
  'llm panel': 'panel-hub-llm-chat',
  'chat hub panel': 'panel-hub-llm-chat',
  'animations panel': 'panel-hub-animations',
  'ai themes panel': 'panel-hub-ai-themes',
  'panel tools': 'panel-hub-panel-tools',
  'music panel': 'panel-hub-music-player',
  'music player panel': 'panel-hub-music-player',

  'ai player panel': 'panel-ai-player',
  'minecraft ai panel': 'panel-ai-player',
  'llama server panel': 'panel-llama',
  'bedrock panel': 'panel-server',
  'server panel': 'panel-server',
  'llama cli panel': 'panel-llama-cli',
  'pocket tts panel': 'panel-pocket-tts',
  'java panel': 'panel-java-server',
  'java server panel': 'panel-java-server',
  'view panel': 'panel-view-panel',
  'help panel': 'panel-help-panel'
};

const TILE_REFERENCE = {
  'tile-ai-chat': 'Home tile that opens Omni Chat.',
  'tile-todo-station': 'Home tile that opens the To-Do page.',
  'tile-games': 'Home tile that opens Neuro-Arcade.',
  'tile-neural-hub': 'Home tile that opens Neural Hub.',
  'tile-history': 'Home tile that opens History.',
  'tile-minecraft': 'Home tile that opens Minecraft Server Manager.'
};

const TOGGLE_REFERENCE = {
  'feat-history': 'Toggle for local browsing history storage.',
  'feat-loading-anim': 'Toggle for showing search/loading animations.',
  'feat-ai-chat-btn': 'Toggle for showing AI Chat nav button.',
  'feat-firewall': 'Toggle for web firewall checks.',
  'feat-antivirus': 'Toggle for antivirus scanning.',
  'feat-virustotal': 'Master toggle for VirusTotal integration.',
  'feat-virustotal-url-scan': 'Toggle for scanning URL apps/links with VirusTotal.',
  'feat-virustotal-file-scan': 'Toggle for scanning EXE/APK downloads with VirusTotal.',
  'toggle-adblock-master': 'Master Ad Shield toggle.',
  'toggle-adblock-trackers': 'Toggle to block trackers/analytics scripts.',
  'toggle-adblock-social': 'Toggle to block social widgets.',
  'toggle-adblock-miners': 'Toggle to block cryptominers.',
  'toggle-adblock-cosmetic': 'Toggle cosmetic filtering for ad leftovers.',
  'toggle-adblock-ytskip': 'Toggle auto-click for YouTube skippable ads.',
  'toggle-adblock-youtube-addon': 'Toggle floating YouTube addon panel.',
  'player-enabled-toggle': 'Neural Hub music-player on/off switch.',
  'youtube-addon-toggle-shorts': 'YouTube addon option: hide Shorts.',
  'youtube-addon-toggle-home': 'YouTube addon option: hide home suggestions.',
  'youtube-addon-toggle-blur': 'YouTube addon option: blur thumbnails.',
  'youtube-addon-toggle-chat': 'YouTube addon option: hide chat.',
  'youtube-addon-toggle-subscribe': 'YouTube addon option: hide subscribe UI.',
  'youtube-addon-toggle-bw': 'YouTube addon option: black-and-white mode.'
};

const BUTTON_REFERENCE = {
  // Main shell / navigation
  'btn-min': 'Minimizes the browser window.',
  'btn-max': 'Toggles maximize/restore.',
  'btn-close': 'Closes the browser window.',
  'btn-nav-home': 'If current tab is Home, toggles Omni Hub popup; otherwise navigates active tab to Home.',
  'btn-nav-ai-chat': 'Opens Omni Chat page tab.',
  'btn-nav-history': 'Opens History page tab.',
  'btn-nav-settings': 'Opens System Settings window tab.',
  'btn-nav-downloads': 'Opens Downloads panel overlay.',
  'btn-new-tab': 'Opens a new-tab search flow via search overlay.',
  'btn-sidebar-toggle': 'Collapses/expands sidebar.',
  'floating-sidebar-toggle': 'Draggable floating button that restores a fully hidden sidebar.',
  'youtube-addon-trigger': 'Opens the floating YouTube addon popup.',

  // Mini player controls
  'player-btn-prev': 'Previous media item in mini player.',
  'player-btn-toggle': 'Play/Pause toggle in mini player.',
  'player-btn-next': 'Next media item in mini player.',

  // Translator / writer popup controls
  'btn-close-translator': 'Closes translator popup.',
  'btn-copy-translation': 'Copies translated output.',
  'btn-perform-translation': 'Translates selected text through UnifiedTranslator.',
  'btn-translate-full-page': 'Injects dynamic viewport translation into the active webview.',
  'btn-close-writer': 'Closes writer popup.',
  'btn-perform-write': 'Runs AI rewrite on selected text.',
  'btn-implement-write': 'Writes rewritten text back into active editable element.',

  // Screenshot / scan overlays
  'btn-ss-full': 'Captures full screenshot region from current source.',
  'btn-ss-lens': 'Runs Google Lens search for current/selected screenshot.',
  'btn-ss-delay-cancel': 'Cancels delayed screenshot countdown.',
  'btn-close-window-picker': 'Closes window picker overlay.',
  'btn-close-display-picker': 'Closes display picker overlay.',
  'btn-vt-close-top': 'Closes VirusTotal scan modal (top action).',
  'btn-vt-close': 'Closes VirusTotal scan modal (done action).',
  'btn-vt-open-link': 'Opens scanned link in a tab after review.',

  // Panels and popups
  'btn-close-bm': 'Closes bookmark panel.',
  'btn-close-downloads': 'Closes downloads panel.',
  'btn-clear-downloads': 'Clears download history list.',
  'btn-close-electron-apps': 'Closes Electron apps panel.',
  'btn-close-picker': 'Closes icon picker popup.',
  'btn-image-dl-cancel': 'Cancels image format download modal.',
  'btn-shortcut-cancel': 'Closes shortcut-creation modal.',
  'btn-shortcut-save': 'Saves current tab as a Search Matrix shortcut.',

  // System panel controls
  'btn-save-settings': 'Persists system settings (features, security, ad shield, shortcuts, theme, blocklist).',
  'btn-save-theme': 'Shortcut trigger that delegates to save settings.',
  'btn-add-block': 'Adds a domain to block list.',
  'btn-check-updates': 'Triggers updater check.',
  'btn-about-check-updates': 'About-panel shortcut for update check.',
  'btn-open-safe-sites': 'Opens trusted safe-sites popup.',
  'btn-close-safe-sites': 'Closes safe-sites popup.',
  'btn-open-virustotal-popup': 'Opens VirusTotal controls popup.',
  'btn-close-virustotal-popup': 'Closes VirusTotal controls popup.',
  'btn-verify-virustotal': 'Verifies VirusTotal API key and fetches quota stats.',
  'btn-scan-virustotal-url': 'Runs manual URL scan via VirusTotal API.',

  // Search Matrix / Vault controls
  'btn-close-profile': 'Closes Search Matrix engine profile modal.',
  'btn-save-profile': 'Saves edits for selected engine profile.',
  'btn-delete-profile': 'Deletes non-protected engine profile.',
  'btn-vault-unlock': 'Unlocks vault using master key.',
  'btn-lock-vault-global': 'Locks all vault sessions.',
  'btn-save-ai-key': 'Registers an AI key entry in vault.',
  'btn-update-passkey': 'Rotates vault master passkey.',

  // Neural hub controls
  'btn-save-all': 'Global apply in Neural Hub; delegates to translator/writer hidden save buttons by active tab.',
  'btn-save-animation': 'Saves selected loading animation.',
  'btn-save-ai-theme': 'Saves selected AI response theme to localStorage.',
  'btn-save-translator': 'Hidden translator config save trigger.',
  'btn-save-writer': 'Hidden writer config save trigger.',
  'btn-verify-trans': 'Verifies translator provider credentials/model.',
  'btn-verify-writer': 'Verifies writer provider credentials/model.'
};

const PANEL_CATALOG = {
  'html/windows/system.html': [
    'panel-system',
    'panel-security',
    'panel-password-vault',
    'panel-appearance',
    'panel-shortcuts',
    'panel-search-matrix',
    'panel-adblocker',
    'panel-block',
    'panel-advanced',
    'panel-creator',
    'panel-about'
  ],
  'html/windows/neural-hub.html': [
    'panel-hub-dashboard',
    'panel-hub-translator',
    'panel-hub-writer',
    'panel-hub-llm-chat',
    'panel-hub-animations',
    'panel-hub-ai-themes',
    'panel-hub-panel-tools',
    'panel-hub-music-player'
  ],
  'html/pages/minecraft.html': [
    'panel-ai-player',
    'panel-llama',
    'panel-server',
    'panel-llama-cli',
    'panel-pocket-tts',
    'panel-java-server',
    'panel-view-panel',
    'panel-help-panel'
  ]
};

const WINDOW_BUTTON_IDS = [
  'btn-about-check-updates',
  'btn-add-block',
  'btn-check-updates',
  'btn-clear-downloads',
  'btn-close',
  'btn-close-bm',
  'btn-close-display-picker',
  'btn-close-downloads',
  'btn-close-electron-apps',
  'btn-close-picker',
  'btn-close-profile',
  'btn-close-safe-sites',
  'btn-close-translator',
  'btn-close-virustotal-popup',
  'btn-close-window-picker',
  'btn-close-writer',
  'btn-copy-translation',
  'btn-delete-profile',
  'btn-image-dl-cancel',
  'btn-implement-write',
  'btn-lock-vault-global',
  'btn-max',
  'btn-min',
  'btn-nav-ai-chat',
  'btn-nav-downloads',
  'btn-nav-history',
  'btn-nav-home',
  'btn-nav-settings',
  'btn-new-tab',
  'btn-open-safe-sites',
  'btn-open-virustotal-popup',
  'btn-perform-translation',
  'btn-perform-write',
  'btn-refresh-search',
  'btn-save-ai-key',
  'btn-save-ai-theme',
  'btn-save-all',
  'btn-save-animation',
  'btn-save-profile',
  'btn-save-settings',
  'btn-save-theme',
  'btn-save-translator',
  'btn-save-writer',
  'btn-scan-virustotal-url',
  'btn-shortcut-cancel',
  'btn-shortcut-save',
  'btn-sidebar-toggle',
  'btn-ss-delay-cancel',
  'btn-ss-full',
  'btn-ss-lens',
  'btn-translate-full-page',
  'btn-update-passkey',
  'btn-vault-unlock',
  'btn-verify-trans',
  'btn-verify-virustotal',
  'btn-verify-writer',
  'btn-vt-close',
  'btn-vt-close-top',
  'btn-vt-open-link',
  'floating-sidebar-toggle',
  'player-btn-next',
  'player-btn-prev',
  'player-btn-toggle',
  'youtube-addon-trigger'
];

const PAGE_BUTTON_CATALOG = {
  'html/pages/ai-settings.html': [
    'btn-close-scraper',
    'btn-close-viewer',
    'btn-launch-pdf-station',
    'btn-open-scraper',
    'btn-save',
    'btn-save-all-desktop',
    'btn-scan-llamacpp',
    'btn-scan-lm',
    'btn-scan-local',
    'btn-start-scrape',
    'btn-test-pocket-tts',
    'btn-verify-ai',
    'btn-verify-pse',
    'btn-verify-serp',
    'btn-viewer-dl',
    'btn-view-saved-gallery'
  ],
  'html/pages/games.html': [
    'btn-2048-retry',
    'btn-back-to-menu',
    'btn-breakout-retry',
    'btn-dragon-retry',
    'btn-flappy-retry',
    'btn-mem-retry',
    'btn-ms-retry',
    'btn-pacman-retry',
    'btn-racer-retry',
    'btn-racer-start',
    'btn-snake-retry',
    'btn-tetris-retry',
    'btn-ttt-retry'
  ],
  'html/pages/history.html': [
    'btn-clear-history'
  ],
  'html/pages/local-ai-manager.html': [
    'btn-global-unload',
    'btn-install-engine'
  ],
  'html/pages/minecraft.html': [
    'btn-ai-connect',
    'btn-ai-send-command',
    'btn-ai-settings',
    'btn-ai-settings-cancel',
    'btn-ai-settings-close',
    'btn-ai-settings-save',
    'btn-browse-bedrock',
    'btn-browse-java-folder',
    'btn-browse-llama',
    'btn-browse-llama-cli',
    'btn-browse-llama-cli-model',
    'btn-browse-models',
    'btn-browse-pockettts',
    'btn-build-clear',
    'btn-build-start',
    'btn-check-server',
    'btn-clear-ai-log',
    'btn-clear-bedrock',
    'btn-clear-java-console',
    'btn-clear-llama',
    'btn-clear-pockettts',
    'btn-copy-cli-command',
    'btn-copy-llama-command',
    'btn-open-ai-window-bottom',
    'btn-scan-models',
    'btn-start-bedrock',
    'btn-start-java-server',
    'btn-start-llama',
    'btn-start-pockettts',
    'btn-stop-bedrock',
    'btn-stop-java-server',
    'btn-stop-llama',
    'btn-stop-pockettts'
  ],
  'html/pages/music.html': [
    'btn-next',
    'btn-next-card',
    'btn-next-compact',
    'btn-next-retro',
    'btn-play-card',
    'btn-play-compact',
    'btn-play-minimal',
    'btn-play-retro',
    'btn-power',
    'btn-prev',
    'btn-prev-card',
    'btn-prev-compact',
    'btn-prev-retro',
    'btn-shuffle'
  ],
  'html/pages/omni-canvas.html': [
    'btn-apply-model',
    'btn-clear-chat',
    'btn-close',
    'btn-maximize',
    'btn-minimize',
    'btn-new',
    'btn-redo',
    'btn-refresh-models',
    'btn-send',
    'btn-undo',
    'btn-view-toggle'
  ],
  'html/pages/omni-chat.html': [
    'btn-abilities-toggle',
    'btn-ability-nothing',
    'btn-attach-popup',
    'btn-chat-settings',
    'btn-enhance-popup',
    'btn-new-chat',
    'btn-open-llama-web',
    'btn-send',
    'btn-stop',
    'btn-toggle-quick-search',
    'btn-toggle-search',
    'btn-toggle-video',
    'btn-toggle-wiki'
  ],
  'html/pages/pdf-viewer.html': [
    'btn-ai-send',
    'btn-clear-chat',
    'btn-close-ai',
    'btn-close-config',
    'btn-next',
    'btn-open-config',
    'btn-prev',
    'btn-read',
    'btn-save-config',
    'btn-select-area',
    'btn-summarize',
    'btn-thumbnails',
    'btn-toggle-ai',
    'btn-zoom-in',
    'btn-zoom-out'
  ],
  'html/pages/security-defense.html': [
    'btn-back',
    'btn-details'
  ],
  'html/pages/todo.html': [
    'btn-add',
    'btn-ai-organize',
    'btn-clear-completed'
  ]
};

const MAIN_NAVIGATION = [
  '`btn-nav-home` -> Home/Omni Hub popup',
  '`btn-nav-ai-chat` -> Omni Chat page',
  '`btn-nav-history` -> History page',
  '`btn-nav-settings` -> System Settings window',
  '`btn-nav-downloads` -> Downloads panel',
  '`btn-sidebar-toggle` -> Collapse/expand sidebar',
  '`floating-sidebar-toggle` -> Restore hidden sidebar'
];

const SYSTEM_NAVIGATION = [
  '`panel-system` (General)',
  '`panel-security` (Security)',
  '`panel-password-vault` (Passwords)',
  '`panel-appearance` (Appearance)',
  '`panel-shortcuts` (Shortcuts)',
  '`panel-search-matrix` (Search Matrix)',
  '`panel-adblocker` (Ad Shield)',
  '`panel-block` (Block List)',
  '`panel-advanced` (Advanced)',
  '`panel-creator` (Creator)',
  '`panel-about` (About)'
];

const HUB_NAVIGATION = [
  '`panel-hub-dashboard`',
  '`panel-hub-translator`',
  '`panel-hub-writer`',
  '`panel-hub-llm-chat`',
  '`panel-hub-animations`',
  '`panel-hub-music-player`',
  '`panel-hub-ai-themes`',
  '`panel-hub-panel-tools`'
];

const HOME_TILES = [
  '`tile-ai-chat`',
  '`tile-todo-station`',
  '`tile-games`',
  '`tile-neural-hub`',
  '`tile-history`',
  '`tile-minecraft`'
];

const PAGE_MODULES = [
  '`html/pages/omni-chat.html`: core chat session UI, ability modes, attachments, stop/send pipeline',
  '`html/pages/ai-settings.html`: provider config, model scanning, scraper sandbox, TTS config, PDF launch',
  '`html/pages/local-ai-manager.html`: local engine provisioning, GPU telemetry, model mount/unload',
  '`html/pages/minecraft.html`: AI player + Bedrock/Java/llama.cpp/Pocket-TTS orchestration panels',
  '`html/pages/pdf-viewer.html`: PDF navigation + AI side assistant + config',
  '`html/pages/games.html`: arcade launcher and retry flows',
  '`html/pages/todo.html`: task board, clear completed, AI organize',
  '`html/pages/history.html`: searchable history + clear history',
  '`html/pages/security-defense.html`: blocked-site interstitial actions',
  '`html/pages/omni-canvas.html`: canvas + model + chat controls',
  '`html/pages/music.html`: music player UI variants and transport controls'
];

function numberedList(values) {
  return values.map((value, index) => `${index + 1}. ${value}`).join('\n');
}

function bulletedList(values) {
  return values.map((value) => `- ${value}`).join('\n');
}

function formatPanelDeepDiveResponse(id, panelData, locations = []) {
  if (!panelData) return null;

  const where = locations.length
    ? `\n\nFound in: ${locations.map((loc) => `\`${loc}\``).join(', ')}`
    : '';

  const features = Array.isArray(panelData.features) && panelData.features.length > 0
    ? `\n\n**Features**\n${bulletedList(panelData.features)}`
    : '';

  const howTo = Array.isArray(panelData.howTo) && panelData.howTo.length > 0
    ? `\n\n**How to Use**\n${numberedList(panelData.howTo)}`
    : '';

  return `**${id} - ${panelData.title || 'Panel'}**\n${panelData.purpose || PANEL_REFERENCE[id] || 'Panel detail.'}${where}${features}${howTo}`;
}

function resolvePanelAlias(normalizedQuery) {
  for (const [alias, panelId] of Object.entries(PANEL_ALIAS_TO_ID)) {
    if (normalizedQuery.includes(alias)) {
      return panelId;
    }
  }
  return null;
}

function buildIndex(catalog) {
  const index = {};
  for (const [location, ids] of Object.entries(catalog)) {
    for (const id of ids) {
      if (!index[id]) index[id] = [];
      if (!index[id].includes(location)) index[id].push(location);
    }
  }
  return index;
}

const PANEL_FILE_INDEX = buildIndex(PANEL_CATALOG);
const BUTTON_FILE_INDEX = buildIndex({
  'html/windows/*': WINDOW_BUTTON_IDS,
  ...PAGE_BUTTON_CATALOG
});

function formatIdentifierResponse(id, description, locations = []) {
  const where = locations.length
    ? `\n\nFound in: ${locations.map((loc) => `\`${loc}\``).join(', ')}`
    : '';
  return `**${id}**\n${description}${where}`;
}

function lookupIdentifierResponse(normalizedQuery) {
  const aliasPanelId = resolvePanelAlias(normalizedQuery);
  if (aliasPanelId && PANEL_DEEP_DIVE[aliasPanelId]) {
    return formatPanelDeepDiveResponse(aliasPanelId, PANEL_DEEP_DIVE[aliasPanelId], PANEL_FILE_INDEX[aliasPanelId] || []);
  }

  const tokens = new Set([normalizedQuery]);
  const tokenMatches = normalizedQuery.match(/[a-z0-9][a-z0-9-]+/g) || [];
  tokenMatches.forEach((token) => tokens.add(token));

  for (const token of tokens) {
    if (PANEL_DEEP_DIVE[token]) {
      return formatPanelDeepDiveResponse(token, PANEL_DEEP_DIVE[token], PANEL_FILE_INDEX[token] || []);
    }
    if (PANEL_REFERENCE[token]) {
      return formatIdentifierResponse(token, PANEL_REFERENCE[token], PANEL_FILE_INDEX[token] || []);
    }
    if (BUTTON_REFERENCE[token]) {
      return formatIdentifierResponse(token, BUTTON_REFERENCE[token], BUTTON_FILE_INDEX[token] || []);
    }
    if (TILE_REFERENCE[token]) {
      return formatIdentifierResponse(token, TILE_REFERENCE[token], ['html/windows/main.html']);
    }
    if (TOGGLE_REFERENCE[token]) {
      return formatIdentifierResponse(token, TOGGLE_REFERENCE[token], ['html/windows/system.html', 'html/windows/main.html']);
    }
    if (PANEL_FILE_INDEX[token]) {
      return formatIdentifierResponse(token, 'Known panel id in Om-X.', PANEL_FILE_INDEX[token]);
    }
    if (BUTTON_FILE_INDEX[token]) {
      return formatIdentifierResponse(token, 'Known button/control id in Om-X.', BUTTON_FILE_INDEX[token]);
    }
  }

  return null;
}

const PANELS_RESPONSE = `**Panel Inventory (hardcoded from project files)**

**System window panels ('html/windows/system.html'):**
${numberedList(SYSTEM_NAVIGATION)}

**Neural Hub panels ('html/windows/neural-hub.html'):**
${numberedList(HUB_NAVIGATION)}

**Minecraft manager panels ('html/pages/minecraft.html'):**
${numberedList(PANEL_CATALOG['html/pages/minecraft.html'].map((id) => `\`${id}\``))}

Use "@id lookup" and include a panel id like "@panel-security" for direct detail.`;

const PANEL_WORKING_RESPONSE = `**Panel Working Guide (what each panel does + features + usage path)**

**System Panels**
${numberedList(PANEL_CATALOG['html/windows/system.html'].map((id) => `\`${id}\` -> ${PANEL_DEEP_DIVE[id]?.purpose || PANEL_REFERENCE[id]}`))}

**Neural Hub Panels**
${numberedList(PANEL_CATALOG['html/windows/neural-hub.html'].map((id) => `\`${id}\` -> ${PANEL_DEEP_DIVE[id]?.purpose || PANEL_REFERENCE[id]}`))}

**Minecraft Panels**
${numberedList(PANEL_CATALOG['html/pages/minecraft.html'].map((id) => `\`${id}\` -> ${PANEL_DEEP_DIVE[id]?.purpose || PANEL_REFERENCE[id]}`))}

Ask a specific panel id to get full details, for example:
- \`@panel-security\`
- \`@panel-hub-animations\`
- \`@panel-ai-player\``;

const BUTTONS_RESPONSE = `**Button Catalog**

**Window-level controls ('html/windows/*'):**
Total: ${WINDOW_BUTTON_IDS.length}
${WINDOW_BUTTON_IDS.map((id) => `- \`${id}\``).join('\n')}

**Page-level controls ('html/pages/*'):**
${Object.entries(PAGE_BUTTON_CATALOG)
  .map(([file, ids]) => `- \`${file}\` (${ids.length}): ${ids.map((id) => `\`${id}\``).join(', ')}`)
  .join('\n')}

For behavior detail of a specific id, ask with the id directly, for example:
- "@btn-save-settings"
- "@btn-open-virustotal-popup"
- "@btn-start-scrape"`;

const NAVIGATION_RESPONSE = `**Navigation Map**

**Primary sidebar navigation ('main.html'):**
${numberedList(MAIN_NAVIGATION)}

**Home popup tiles ('features-home-popup'):**
${numberedList(HOME_TILES.map((tile) => `${tile} -> feature entry point`))}

**System window nav targets:**
${numberedList(SYSTEM_NAVIGATION)}

**Neural Hub nav targets:**
${numberedList(HUB_NAVIGATION)}

**Useful keyboard navigation shortcuts:**
- Ctrl+T: New tab/search overlay
- Ctrl+W: Close active tab
- Ctrl+B: DevTools
- Ctrl+[: Sidebar collapse
- Ctrl+Shift+[: Sidebar hide/show
- Ctrl+Shift+S: Screenshot
- Alt+I: Lens search capture
- F11: Fullscreen
- Ctrl+Shift+Q: Quit app`;

const WORKFLOW_RESPONSE = `**Feature Workflows**

1. VirusTotal setup + scan:
   Open Settings -> Security ('panel-security') -> enable 'feat-virustotal' -> open 'btn-open-virustotal-popup' -> verify key with 'btn-verify-virustotal' -> scan URL with 'btn-scan-virustotal-url'.
2. Ad Shield + safe sites:
   Open Settings -> Ad Shield ('panel-adblocker') -> set toggles ('toggle-adblock-*') -> optional custom rules ('adblock-custom-rules') -> review trusted sites via 'btn-open-safe-sites'.
3. Translator popup:
   Select page text -> open translator popup -> set source/target -> run 'btn-perform-translation' or 'btn-translate-full-page' -> copy with 'btn-copy-translation'.
4. Writer popup:
   Select page text -> open writer popup -> choose mode -> run 'btn-perform-write' -> apply back to page with 'btn-implement-write'.
5. Search Matrix engine edit:
   Open 'panel-search-matrix' -> click engine card -> edit in profile modal -> save via 'btn-save-profile' or remove via 'btn-delete-profile'.
6. Vault:
   Open 'panel-password-vault' -> unlock using 'btn-vault-unlock' -> manage AI keys with 'btn-save-ai-key' -> rotate master key with 'btn-update-passkey' -> relock using 'btn-lock-vault-global'.
7. Screenshot and Lens:
   Trigger screenshot shortcut -> use selection/full ('btn-ss-full') -> send selection to Google Lens via 'btn-ss-lens' -> use window/display pickers when needed.
8. Neural Hub sync:
   Open 'panel-hub-translator' or 'panel-hub-writer' -> configure provider/model -> apply using 'btn-save-all' (delegates to hidden module save buttons).
9. Local AI manager:
   Open 'local-ai-manager.html' -> provision runtime ('btn-install-engine') -> mount preset -> unload via 'btn-global-unload'.
10. AI settings scraper:
    Open 'ai-settings.html' -> launch scraper with 'btn-open-scraper' -> run discovery ('btn-start-scrape') -> export/download assets ('btn-save-all-desktop', 'btn-viewer-dl').`;

const PAGE_MODULES_RESPONSE = `**Page Module Map**
${numberedList(PAGE_MODULES)}

Use this with "@buttons" or an id query to drill into exact controls.`;

const FEATURES_RESPONSE = `**Current Om-X Feature Surface (from scanned files)**

- Sidebar browser shell with Home popup tiles, tab stack, downloads panel, bookmarks panel, Electron apps panel, mini player, and floating sidebar restore.
- System settings suite with 11 panels (security, ad shield, block list, search matrix, vault mount, themes, updates, creator/about).
- Neural Hub with 8 panels (dashboard, translator, writer, LLM chat hub, loading animations, AI themes, panel tools, music player).
- Omni Chat abilities: Core Engine, Quick Retrieval, Deep Intelligence, Video Discover, Wiki Brain, Prompt Enhance, file attach.
- Translator and writer popups for selected text + full-page translation and in-place rewrite implementation.
- VirusTotal integration for API verify, quota display, manual URL scan, and link scan overlays.
- Ad Shield controls including tracker/social/miner/cosmetic filters and YouTube addon options.
- Screenshot stack with selection/full capture, delay cancel, window picker, display picker, clipboard and Lens flow.
- Page modules: AI settings, local AI manager, Minecraft manager, PDF station, games, history, todo, security defense.
- Theme system from 'systemRenderer.js' currently defines 50 themes; Neural Hub includes 5 AI response themes and 4 music player designs.`;

const ID_LOOKUP_RESPONSE = `**ID Lookup**

Ask with any known id and I will return the control behavior and file location.

Examples:
- @panel-security
- @panel-hub-animations
- @btn-save-settings
- @btn-open-virustotal-popup
- @tile-neural-hub
- @toggle-adblock-master`;

export const responseDatabase = {
  'how to use': '**Using Om-X quickly:**\n1. Use sidebar nav (`btn-nav-*`) for Home/AI/History/Settings.\n2. Use Home popup tiles (`tile-*`) to jump to modules.\n3. Open Settings and Neural Hub for configuration panels.\n4. Prefix with `@` in Omni Chat to query this hardcoded knowledge base.',

  'keyboard shortcuts': NAVIGATION_RESPONSE,
  'shortcuts': NAVIGATION_RESPONSE,
  'navigation': NAVIGATION_RESPONSE,
  'sidebar': NAVIGATION_RESPONSE,
  'sidebar navigation': NAVIGATION_RESPONSE,
  'home tiles': `**Home Tiles**\n${numberedList(HOME_TILES.map((tile) => `${tile} -> ${TILE_REFERENCE[tile] || 'feature entry point'}`))}`,

  'panels': PANELS_RESPONSE,
  'all panels': PANELS_RESPONSE,
  'panel list': PANELS_RESPONSE,
  'panel details': PANEL_WORKING_RESPONSE,
  'panel working': PANEL_WORKING_RESPONSE,
  'panel features': PANEL_WORKING_RESPONSE,
  'panel usage': PANEL_WORKING_RESPONSE,
  'what panels do': PANEL_WORKING_RESPONSE,
  'how to use panels': PANEL_WORKING_RESPONSE,
  'system panels': `**System Panels**\n${numberedList(PANEL_CATALOG['html/windows/system.html'].map((id) => `\`${id}\``))}`,
  'neural hub panels': `**Neural Hub Panels**\n${numberedList(PANEL_CATALOG['html/windows/neural-hub.html'].map((id) => `\`${id}\``))}`,
  'minecraft panels': `**Minecraft Panels**\n${numberedList(PANEL_CATALOG['html/pages/minecraft.html'].map((id) => `\`${id}\``))}`,

  'buttons': BUTTONS_RESPONSE,
  'all buttons': BUTTONS_RESPONSE,
  'button catalog': BUTTONS_RESPONSE,

  'features': FEATURES_RESPONSE,
  'feature workflows': WORKFLOW_RESPONSE,
  'workflows': WORKFLOW_RESPONSE,
  'settings': FEATURES_RESPONSE,
  'neural hub': `**Neural Hub Summary**\n- Dashboard telemetry\n- Translator panel\n- Writer panel\n- LLM chat hub (ChatGPT + custom links)\n- Loading animations panel\n- AI themes panel\n- Panel tools launcher\n- Music player panel\n\nUse "@neural hub panels" for exact ids.`,
  'ai chat': 'Omni Chat includes ability modes (`btn-ability-nothing`, `btn-toggle-quick-search`, `btn-toggle-search`, `btn-toggle-video`, `btn-toggle-wiki`, `btn-enhance-popup`, `btn-attach-popup`) and session controls (`btn-new-chat`, `btn-send`, `btn-stop`, `btn-chat-settings`).',
  'ai modes': 'Modes in `omni-chat.html`: Core Engine, Quick Retrieval, Deep Intelligence, Video Discover, Wiki Brain, Prompt Enhance, Attach File.',
  'translator': 'Translator has two surfaces: (1) popup translation in `main.html` with `btn-perform-translation` and `btn-translate-full-page`; (2) Neural Hub translator config (`panel-hub-translator`) with provider/model verify (`btn-verify-trans`) and save (`btn-save-translator`).',
  'writer': 'Writer has two surfaces: (1) popup rewrite in `main.html` with `btn-perform-write` and `btn-implement-write`; (2) Neural Hub writer config (`panel-hub-writer`) with verify (`btn-verify-writer`) and save (`btn-save-writer`).',
  'search matrix': 'Search Matrix (`panel-search-matrix`) manages engine cards, default engine selection, per-engine @keyword editing, and profile modal actions (`btn-save-profile`, `btn-delete-profile`).',
  'vault': 'Vault (`panel-password-vault`) mounts `vault.html`: unlock (`btn-vault-unlock`), lock all (`btn-lock-vault-global`), AI key registry (`btn-save-ai-key`), and passkey rotation (`btn-update-passkey`).',
  'virustotal': 'Security panel supports VirusTotal: open popup (`btn-open-virustotal-popup`), verify API (`btn-verify-virustotal`), manual URL scan (`btn-scan-virustotal-url`), URL/file scan toggles (`feat-virustotal-url-scan`, `feat-virustotal-file-scan`).',
  'ad shield': 'Ad Shield panel (`panel-adblocker`) controls ad/tracker/social/miner/cosmetic filters, YouTube addon toggles, custom rules, and trusted safe-sites popup (`btn-open-safe-sites`).',
  'screenshot': 'Screenshot overlay supports region/full capture, delay cancel (`btn-ss-delay-cancel`), Lens search (`btn-ss-lens`), window picker, and display picker.',
  'downloads': 'Downloads panel uses `btn-nav-downloads` to open, `btn-clear-downloads` to clear history, and per-item actions (open file, show folder, pause/resume/cancel).',

  'page modules': PAGE_MODULES_RESPONSE,
  'module map': PAGE_MODULES_RESPONSE,
  'ai settings page': 'AI settings page (`html/pages/ai-settings.html`) covers provider setup, model scanning (`btn-scan-local`, `btn-scan-lm`, `btn-scan-llamacpp`), web search key verify (`btn-verify-serp`, `btn-verify-pse`), scraper sandbox (`btn-open-scraper`, `btn-start-scrape`), TTS test (`btn-test-pocket-tts`), and PDF launch (`btn-launch-pdf-station`).',
  'local ai manager': 'Local AI manager (`html/pages/local-ai-manager.html`) handles local engine provisioning (`btn-install-engine`), preset mount, live GPU telemetry, and emergency unload (`btn-global-unload`).',
  'minecraft manager': 'Minecraft manager (`html/pages/minecraft.html`) contains 8 panels for AI player, Bedrock/Java server controls, llama.cpp server/CLI, Pocket-TTS, live view, and help.',
  'pdf station': 'PDF viewer (`html/pages/pdf-viewer.html`) supports page nav (`btn-prev`, `btn-next`), zoom, thumbnails, AI sidebar (`btn-toggle-ai`), summarize (`btn-summarize`), read mode (`btn-read`), and AI config save (`btn-save-config`).',
  'games': 'Games module includes retry controls for Snake, 2048, Tetris, Memory, Minesweeper, Pacman, Dragon, Breakout, Flappy, Racer, and Tic-Tac-Toe.',
  'todo': 'To-Do page has add (`btn-add`), clear completed (`btn-clear-completed`), and AI organize (`btn-ai-organize`).',
  'history': 'History page has search and clear action (`btn-clear-history`).',

  'id lookup': ID_LOOKUP_RESPONSE,
  'help': `Ask about:
- panels
- buttons
- navigation
- feature workflows
- page modules
- any specific id (panel/button/tile/toggle)`
};

/**
 * Find a response in the database based on user query
 * @param {string} query - User's question (without the @ prefix)
 * @returns {string|null} - Matching response or null
 */
export function findResponse(query) {
  if (!query) return null;

  const normalizedQuery = query.toLowerCase().trim();

  // Identifier-first lookup (panel/button/tile/toggle ids)
  const identifierResponse = lookupIdentifierResponse(normalizedQuery);
  if (identifierResponse) {
    return identifierResponse;
  }

  // Direct match
  if (responseDatabase[normalizedQuery]) {
    return responseDatabase[normalizedQuery];
  }

  // Partial match - check if query contains any key
  for (const [key, response] of Object.entries(responseDatabase)) {
    if (normalizedQuery.includes(key) || key.includes(normalizedQuery)) {
      return response;
    }
  }

  // Word-by-word scoring
  const queryWords = normalizedQuery.split(/\s+/);
  let bestMatch = null;
  let bestMatchScore = 0;

  for (const [key, response] of Object.entries(responseDatabase)) {
    const keyWords = key.split(/\s+/);
    let matchScore = 0;

    for (const queryWord of queryWords) {
      if (queryWord.length > 2) {
        for (const keyWord of keyWords) {
          if (keyWord.includes(queryWord) || queryWord.includes(keyWord)) {
            matchScore++;
          }
        }
      }
    }

    if (matchScore > bestMatchScore) {
      bestMatchScore = matchScore;
      bestMatch = response;
    }
  }

  return bestMatch;
}

/**
 * Get all available response topics
 * @returns {string[]}
 */
export function getAvailableTopics() {
  const topics = new Set(Object.keys(responseDatabase));
  Object.keys(PANEL_DEEP_DIVE).forEach((id) => topics.add(id));
  Object.keys(PANEL_ALIAS_TO_ID).forEach((alias) => topics.add(alias));
  return Array.from(topics);
}

/**
 * Check if input should route to this DB
 * @param {string} text
 * @returns {boolean}
 */
export function shouldUseDatabase(text) {
  return text && text.trim().startsWith('@');
}

/**
 * Strip @ prefix before lookup
 * @param {string} text
 * @returns {string}
 */
export function processDatabaseQuery(text) {
  return text.trim().replace(/^@\s*/, '');
}

export default responseDatabase;
