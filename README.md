# Om-X - AI Browser with Minecraft Integration

![Version](https://img.shields.io/badge/version-2.0.5-blue.svg)
![License](https://img.shields.io/badge/license-Custom-green.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)
![Electron](https://img.shields.io/badge/Electron-33.0.0-0DFF00.svg)

A feature-rich desktop browser built on Electron with integrated AI capabilities, Minecraft bot management, games, and advanced security features.

## Om Chat

A real-time messaging platform built with Node.js, Express, Socket.io, and MongoDB. Features server-based chat rooms, channels, direct messages, real-time messaging with typing indicators, message reactions, and an integrated AI assistant.

### Key Features
- **Server & Channel System**: Create servers, organize channels, and manage permissions
- **Real-time Messaging**: Instant message delivery with Socket.io (websocket + polling fallback)
- **Direct Messages**: Private conversations between users
- **AI Assistant**: Built-in AI chatbot accessible via `@ai` mentions (powered by Groq API)
- **User Presence**: Online/offline/away status tracking with real-time updates
- **Message Features**: Reactions, pinning, editing, deleting with full audit trail
- **File Uploads**: Image uploads with a built-in GIF pack library
- **Secure Authentication**: JWT-based auth with refresh tokens, email verification (OTP), and device tracking
- **Rate Limiting**: Protects against spam and abuse
- **Security**: CORS protection, CSRF tokens, Helmet.js security headers

### Tech Stack
- **Backend**: Express.js, Socket.io, MongoDB (Mongoose)
- **Auth**: JWT, bcrypt, session cookies
- **Real-time**: Socket.io with typing indicators, presence tracking
- **Security**: Helmet, rate limiting, CORS, CSRF protection

### Om Chat Project Structure
```
Om-chat/
├── public/              # Frontend assets
│   ├── app.html        # Main chat application
│   ├── index.html      # Landing/auth page
│   ├── css/            # Stylesheets
│   └── js/             # Client-side JavaScript
├── server/             # Backend logic
│   ├── index.js        # Express + Socket.io server entry
│   ├── config.js       # Configuration with Zod validation
│   ├── db/             # MongoDB models & initialization
│   ├── middleware/     # Auth, session, rate limiting
│   ├── models/         # Mongoose schemas (User, Server, Channel, Message, etc.)
│   ├── routes/         # REST API endpoints
│   ├── services/       # Business logic services
│   ├── sockets/        # Socket.io event handlers
│   └── utils/          # Validation, serialization, crypto
├── gif-pack/           # Built-in GIF library
├── uploads/            # User-uploaded files storage
└── .env                # Environment variables
```

---

## YouTube Addon

A built-in enhancement addon for YouTube that provides content filtering, UI customization, and distraction-free viewing.

### Features
- **Hide Shorts**: Automatically filter out YouTube Shorts from search results and recommendations
- **Hide Home Suggestions**: Remove recommended videos, sidebar suggestions, and next-up videos
- **Blur Thumbnails**: Apply blur effect to video thumbnails for spoiler-free browsing
- **Hide Live Chat**: Remove live chat frames and comments from video pages
- **Hide Header Controls**: Clean up the video player header controls
- **Black & White Mode**: Render YouTube in grayscale for reduced eye strain
- **Clean UI Mode**: Remove end screens, suggested videos, and other distractions during playback

### Tech Implementation
- Injected via `tabs.js` `applyYouTubeAddon()` method
- Uses CSS attribute-based state management (`data-omx-*` attributes)
- MutationObserver for dynamic content filtering
- requestAnimationFrame for performance-optimized DOM updates

---

## Mouse & Keyboard Interactions

### Left Click Actions

| Element | Action |
|---------|--------|
| **Tab** | Switch to the clicked tab |
| **Tab Icon (+)** | Create new tab |
| **Tab Close (×)** | Close the tab (stops propagation) |
| **Back/Forward Buttons** | Navigate browser history |
| **Minimize/Maximize/Close** | Window controls |
| **Webview Links** | Navigate to link destination |
| **Context Menu Items** | Execute menu action |

### Right Click Actions (Context Menus)

#### Webview Context Menu
| Submenu | Actions |
|---------|---------|
| **System** | Minimize, Maximize/Restore, Close window |
| **Page** | Back, Reload |
| **Page (with link)** | Open Link in New Tab |
| **Page (with image)** | Download Image, Open Image in New Tab, Search with Google Lens |
| **AI** | Read Selection (TTS), Improve with Writer, Translate Selection, Google Translate, Search (default engine) |
| **Edit** | Copy (when text selected), Paste (when in input field) |
| **Developer** | Info (page diagnostics), Show/Hide Sidebar, Inspect Element |

#### Tab Context Menu
| Action | Description |
|--------|-------------|
| **Bookmark Tab** | Open bookmark editor for the tab |
| **Copy URL** | Copy tab URL to clipboard |
| **Enable/Disable Dark Mode** | Toggle per-tab dark mode |

#### Sidebar Context Menu (when visible)
| Action | Description |
|--------|-------------|
| **Expand/Collapse Sidebar** | Toggle sidebar collapse state |
| **Hide Sidebar** | Hide the sidebar panel |
| **Show Sidebar** | Reveal the hidden sidebar |
| **Restore Full View** | Reset sidebar to default state |

#### Hidden Sidebar Context Menu
| Action | Description |
|--------|-------------|
| **Show Sidebar** | Reveal the sidebar |
| **Back** | Go back in webview |
| **Forward** | Go forward in webview |
| **Reload** | Refresh current page |

### Middle Click Actions
| Element | Action |
|---------|--------|
| **Tab** | Close tab |
| **Tab Icon (+)** | Create new tab |

### Tab Bar Interactions
- **Left Click on Tab**: Activate tab
- **Left Click on Tab Icon (+)**: New tab
- **Left Click on Close Button (×)**: Close tab (stops event propagation)
- **Right Click on Tab**: Open tab context menu
- **Right Click on Tab Icon (when sidebar collapsed)**: Close tab directly
- **Hover on Submenu Items**: Auto-open nested submenus

### Webview Interactions
- **Left Click**: Navigate links / focus webview
- **Right Click**: Show custom context menu (overrides native menu)
- **Middle Click on Link**: Opens link in new tab
- **Focus/Mousedown on Webview**: Dismiss all open context menus

### Menu Behavior
- **Click outside menu**: Closes all menus
- **Right-click outside menu**: Closes menus first (allows native menu after)
- **Window blur**: Closes all menus
- **Submenu hover**: Auto-opens submenu after 300ms delay
- **Mousedown on menu item**: Prevents menu close
- **Contextmenu on menu**: Stops propagation

---

## Llama Server (Local AI)

A built-in local AI server that runs GGUF-format language models using llama.cpp, providing privacy-preserving, offline-capable AI inference.

### How It Works
- Runs **llama-server** executable from llama.cpp (downloaded separately)
- Loads GGUF model files (.gguf) from a user-specified folder
- Exposes an **OpenAI-compatible API** at `http://localhost:{port}/v1/chat/completions`
- Automatically detects GPU memory and suggests compatible models

### Setup & Configuration
| Setting | Description |
|---------|-------------|
| **llama-server.exe** | Path to llama.cpp server executable |
| **llama-cli.exe** | Optional CLI executable for model inspection |
| **Models Folder** | Folder containing .gguf model files |
| **Context Length** | Context window size (default: 4096) |
| **GPU Layers** | Layers offloaded to GPU (default: -1 = all) |
| **Threads** | CPU threads for inference (default: 4) |
| **Port** | Server port (default: 8080) |
| **Host** | Bind address (local/remote/LAN) |
| **System Prompt** | Optional default guardrails/persona passed to `llama-server` with `--system-prompt` |
| **Protection Manager** | RAM safety thresholds that warn early and eject the model before the system freezes |

### Features
- **Model Scanning**: Automatically detects .gguf files in models folder
- **Size Estimation**: Estimates model VRAM requirements from filename patterns
- **GPU Compatibility Check**: Validates if model fits available GPU memory
- **Uptime Counter**: Tracks server runtime duration
- **Real-time Logs**: Streams stdout/stderr to terminal console
- **Manual Command Generator**: Generates CLI commands for custom launches
- **System Prompt Injection**: Persists a default startup prompt for local llama-server sessions
- **RAM Protection Manager**: Monitors system memory pressure and automatically unloads the model when usage stays critical

### IPC API (preload bridge)
```javascript
window.browserAPI.llama.startServer(config)     // Start the server
window.browserAPI.llama.stopServer()           // Stop the server
window.browserAPI.llama.onOutput(callback)     // Stream output
window.browserAPI.llama.onExit(callback)       // Process exit
window.browserAPI.llama.checkModelSize()       // Get model file size
window.browserAPI.llama.getGPUInfo()            // Get GPU VRAM info
```

### Integration
- AI Chat button prioritizes local Llama server when running
- Falls back to Duck AI when Llama server is offline
- Can be used as OpenAI-compatible backend for any AI integration

---

## MCP Server (Model Context Protocol)

A unified MCP server that provides structured AI tools via the Model Context Protocol, enabling AI assistants to access external data sources.

### How It Works
- Built on **@modelcontextprotocol/sdk** with Express.js HTTP transport
- Exposes MCP tools via **POST /mcp** and **POST /sse** endpoints
- Exposes an **OpenAI-compatible API** via **GET /v1/models** and **POST /v1/chat/completions**
- Aggregates multiple search/data APIs under one MCP server
- Can run a tool-calling loop against an upstream OpenAI-compatible model so web/news/wiki tools can collect data before the final answer is returned
- Supports API key configuration for premium services

### Available Tools

| Tool | Description | API Required |
|------|-------------|--------------|
| **Wikipedia** | Search and fetch Wikipedia pages | None |
| **Web Search** | Google search via SerpAPI | SerpAPI key |
| **DuckDuckGo** | Web, image, and video search | None |
| **Tavily** | AI-optimized search with answers | Tavily API key |
| **News API** | Top headlines and source listing | NewsAPI key |
| **Device Time** | Get current device date/time | None |

### Tool Details

#### Wikipedia Tools
- `wiki_search(query, maxResults)`: Search Wikipedia articles
- `wiki_page(pageId)`: Fetch page content by Wikipedia page ID

#### Web Search (SerpAPI)
- `web_search(query, maxResults, includeImages)`: Google organic results with optional images

#### DuckDuckGo Tools
- `ddg_web_search(query, maxResults, safeSearch)`: Web search
- `ddg_image_search(query, maxResults, safeSearch)`: Image search
- `ddg_video_search(query, maxResults)`: Video search

#### Tavily Search
- `tavily_web_search(query, maxResults, searchDepth, includeAnswer)`: Advanced search with AI-generated answer

#### News Tools
- `news_top_headlines(sources, q, category, country)`: Get breaking news
- `news_sources(category, language, country)`: List available news sources

### Configuration
| Setting | Default | Description |
|---------|---------|-------------|
| Host | 127.0.0.1 | Bind address |
| Port | 3000 | Server port |
| SerpAPI Key | - | For Google web search |
| Tavily API Key | - | For Tavily search |
| NewsAPI Key | - | For news headlines |

### IPC API
```javascript
window.browserAPI.mcp.startServer(config)       // Start MCP server
window.browserAPI.mcp.stopServer()             // Stop MCP server
window.browserAPI.mcp.onOutput(callback)        // Stream output
window.browserAPI.mcp.onExit(callback)          // Process exit
```

### OpenAI-Compatible Notes
- `GET /v1/models`: Lists the configured upstream model plus the local `omx-mcp-tools` wrapper
- `POST /v1/chat/completions`: Accepts OpenAI-style chat requests and can execute local tools such as `web_search`, `ddg_web_search`, `tavily_web_search`, `wiki_search`, `news_top_headlines`, and `device_time`
- When an upstream OpenAI-compatible model is configured, the server resolves tool calls, collects the search data, then sends the tool results back to the model for the final response

---

## AI Chat Button

A quick-access button that opens an AI chat interface with intelligent routing.

### How It Works
1. Click the **AI Chat** button in the sidebar navigation
2. System checks if **Llama Server** is running locally
3. If running → Opens local Llama server endpoint
4. If offline → Opens **Duck AI** (https://duck.ai/chat)

### Smart Routing Logic
```
AI Chat Button Click:
  ↓
Is Llama Server Running?
  ├─ YES → Open http://localhost:{port} (local AI)
  └─ NO  → Open https://duck.ai/chat (Duck AI fallback)
```

### Duck AI Integration
- **URL**: https://duck.ai/chat
- **Sidebar Hiding**: Optional sidebar toggle for distraction-free chat
- **Quick Launch**: Available from features home popup and sidebar nav

### Quick Panel Features
| Feature | Description |
|---------|-------------|
| **AI Chat** | Opens AI chat with smart routing |
| **Duck AI** | Direct Duck AI access |
| **Llama Server** | Opens Llama Server management panel |
| **MCP Server** | Opens MCP Server management panel |

### File Locations
- **Renderer**: `java/renderer/renderer.js` (lines 1179-1183, 2002, 2034)
- **UI**: `html/windows/main.html` (line 547)
- **Preload Bridge**: `java/preload.js`, `preload.js`

---

## Additional Features

### Matrix Search (Omni Box)

A powerful quick-launch panel with customizable search engines and keyboard shortcuts.

**Features:**
- **Multiple Search Engines**: Google, DuckDuckGo, Wikipedia, YouTube, and custom engines
- **Hotkey Activation**: Quick-access keywords (e.g., `yt query` → YouTube search)
- **Engine Profiles**: Add, edit, delete custom search engines
- **Protected Cores**: Core engines (google, youtube, duckduckgo, wiki) cannot be deleted

**Hotkey System:**
| Keyword | Engine | Example |
|---------|--------|---------|
| `yt` | YouTube | `yt minecraft` |
| `ddg` | DuckDuckGo | `ddg query` |
| `wiki` | Wikipedia | `wiki topic` |
| `gh` | GitHub | `gh repository` |

### Security Features

#### Antivirus Engine
- **Pre-download Scanning**: Scans files before download completes using VirusTotal API
- **MIME Validation**: Detects extension spoofing (e.g., `.png` that is actually `.exe`)
- **Double Extension Detection**: Identifies disguised files (e.g., `photo.jpg.exe`)
- **Dangerous Extension Warning**: Warns for `.exe`, `.scr`, `.bat`, `.cmd`, `.vbs`, `.js`, `.msi`, etc.
- **Trusted Sources Bypass**: Allows executables from microsoft.com, google.com, github.com, etc.
- **File Hash Lookup**: SHA256 hash scanning against VirusTotal database

#### Cookie Shield
- **Third-Party Cookie Blocking**: Prevents cross-site tracking
- **Request Header Stripping**: Removes cookies from third-party requests
- **Response Header Filtering**: Blocks Set-Cookie from third-party domains

#### Popup Blocker
- Automatically blocks unwanted popups and new windows
- Configurable via settings
- Exception list for trusted sites

#### Custom Blocklist
- Add domains to block manually
- Real-time blocking of custom domains
- Remove blocked domains from the list
- Import/export blocklist

#### Adult Content Blocker
A multi-layered content filtering system that blocks adult/pornographic websites across search results, images, and direct browsing.

**How It Works:**
The blocker operates at two levels:

| Layer | File | Purpose |
|-------|------|---------|
| **Preload Script** | `webviewPreload.js` | Injected into every webview, blocks images and search result cards |
| **Tab UI Blocker** | `tabs.js` | Integrated into tab management, provides additional card-level blocking |

**Detection Methods:**

| Method | Description |
|--------|-------------|
| **Domain Matching** | Checks 80+ adult domains via raw substring matching (no `new URL()` parsing) |
| **URL Decoding** | Decodes Google redirect URLs (`%2F%2Fxhamster.com` → `xhamster.com`) |
| **Ancestor Traversal** | Walks up 12 parent levels collecting `data-lpage`, `data-ou`, `data-iurl`, `href` attributes |
| **Source Labels** | Checks text labels under thumbnails (e.g., "RusPorn", "The Art Porn") against keyword list |
| **Search Result Cards** | Hides entire Google search result cards containing adult URLs in hrefs/data attributes |

**What Gets Blocked:**

| Content Type | Action | Visual |
|--------------|--------|--------|
| **Image Thumbnails** | Blurred with CSS filter | `🚫` overlay on card |
| **Search Result Cards** | Hidden via `display: none` | Completely removed |
| **Video Elements** | Hidden | Removed from page |
| **Clickable Cards** | `pointer-events: none` | Cannot be clicked through |

**Keyword Detection:**
Short text labels (<200 chars) are checked against keywords:
- `porn`, `xxx`, `hentai`, `nsfw`, `onlyfans`, `xvideos`

**Protected Against:**
- CDN-proxied thumbnails (Google serves from `encrypted-tbn0.gstatic.com`)
- URL-encoded redirect links in `<a href>` attributes
- Lazy-loaded content via MutationObserver
- False positives (only URLs are checked for search results, not page text)

**Configuration:**
The blocker runs automatically on every webview. No configuration required. Domains are defined in:
- `webviewPreload.js` → `ADULT_DOMAINS` array (line 18-45)
- `tabs.js` → `ADULT_DOMAINS` array (line 3676-3710)

**Technical Details:**
- Debounced MutationObserver (150ms) to prevent performance issues
- `data-omxProcessed` / `data-omxFiltered` attributes prevent double-processing
- Periodic scan every 2 seconds for lazy-loaded content
- CSS classes: `omx-blur`, `omx-blur-wrap`, `omx-hide`, `omx-adult-blur`, `omx-adult-wrap`, `omx-adult-remove`

### VirusTotal Integration

Real-time security scanning powered by VirusTotal's database of 70+ antivirus engines.

**URL Scanning:**
- Scan any URL for malware/phishing detection before visiting
- View detailed security reports with risk scores
- Risk assessment with detection counts (malicious, suspicious, harmless, undetected)
- One-click URL scanner from context menu
- Automatic URL caching (30-minute TTL) for performance
- Real-time analysis polling for new URLs

**File Scanning:**
- Upload and scan files before download
- SHA256 hash lookup with automatic caching (2-hour TTL)
- Detection statistics from 70+ antivirus engines
- Block on suspicious executables option

**Risk Assessment:**
- **Clean**: Risk score < 5% with harmless/undetected votes
- **Danger**: 3+ malicious detections OR risk score >= 15%
- **Suspicious**: 1+ malicious OR suspicious detections
- **Unknown**: No votes or unable to determine

**API Configuration:**
- Configure VirusTotal API key via settings
- View quota usage (daily/monthly limits)
- Rate limiting awareness with automatic retry
- API key verification on save

**File Location:**
- Client: `java/main/security/virustotal/VirusTotalClient.js`
- Settings UI: `html/windows/system.html`
- Settings Logic: `java/renderer/systemRenderer.js`

### Text Tools

#### Omni Translator
- **Draggable Popup**: Position anywhere on screen
- **Auto-Detect Source**: Automatically detect source language
- **10+ Target Languages**: English, Hindi, Bengali, Telugu, Tamil, Arabic, Japanese, Chinese, Urdu, Spanish, French
- **One-Click Copy**: Copy translation to clipboard
- **Context Menu Integration**: Right-click any selected text to translate

#### Omni Writer
- **AI Text Rewriting**: Improve selected text with AI
- **Writing Modes**: Balanced, Professional, Creative
- **Implement Feature**: Apply rewritten text directly to page
- **Context Menu Integration**: Access via right-click menu

### Screenshot Tool

A powerful screenshot capture tool with region selection, window/display picker, and multiple export formats.

**Features:**
- **Full Screen Capture**: Capture entire webview with one click
- **Region Selection**: Draw to select specific area of the screen
- **Google Lens Integration**: Search selected area with Google Lens for reverse image search
- **Delay Timer**: Optional countdown (3-10 seconds) before capture for capturing menus/dropdowns
- **Window Picker**: Select specific application windows to capture with visual preview
- **Display Picker**: Multi-monitor support with visual display map
- **Multiple Formats**: Save as PNG, JPG, WEBP, or PDF
- **Clipboard Copy**: Copy screenshot directly to clipboard
- **High-DPI Support**: Automatic scaling for Retina/4K displays

**Keyboard Shortcut:** `Ctrl+Shift+S`

**File Locations:**
- UI Overlay: `java/renderer/ui/screenshotOverlay.js`
- IPC Handlers: `java/main/mainProcess.js`
- HTML Elements: `html/windows/main.html`

### Keyboard Shortcuts

**Customizable Shortcuts:**
| Action | Default | Description |
|--------|---------|-------------|
| New Tab | Ctrl+T | Open new tab |
| Close Tab | Ctrl+W | Close active tab |
| Sidebar Toggle | Ctrl+B | Collapse/expand sidebar |
| System Settings | Ctrl+, | Open settings |
| Quick Screenshot | Ctrl+Shift+S | Take screenshot |
| Inspect Tools | Ctrl+Shift+I | Developer tools |
| Fullscreen | F11 | Toggle fullscreen |
| Quit App | Ctrl+Q | Safe exit |

**Shortcut Recorder:**
- Click input field to record new shortcut
- Records Ctrl, Alt, Shift + key combinations
- Validates before saving

### Desktop Shortcuts (Windows)

Create desktop shortcuts to launch apps directly:
- **Quick Launch Apps**: Server Operator, Scraper, Games, etc.
- **System Integration**: Pins to Windows desktop
- **Custom Naming**: User-defined shortcut names

### Theme System

**Single Default Theme:**
| Theme | Style |
|-------|-------|
| Onyx (Noir) | Dark minimal with deep black gradients and subtle texture |

**Theme Features:**
- Deep black background with subtle gradient (#0c0c0f to #141418)
- Glass effect panels with blur (28px)
- Neutral gray accent colors (#6b6b75)
- Smooth shadow glows for depth

### Loading Animation

**Scanline Loading Animation:**
- Horizontal scanline effect that sweeps across the loading bar
- Uses accent color for the moving gradient
- Smooth ease-in-out timing for seamless motion
- Duration: 1.2s per cycle with infinite loop

```css
@keyframes scanline {
  0% { left: -100%; }
  100% { left: 100%; }
}
```

### Search Suggestions

- Real-time search suggestions as you type
- Quick navigation with keyboard (Up/Down arrows)
- Enter to select, Esc to dismiss
- Search engine refresh button

### Download Manager

- **Format Selection**: PNG, JPG, WEBP, PDF
- **Image Preview**: Preview before downloading
- **Download History**: Track all downloads
- **Format Conversion**: Convert images between formats

### Window/Display Management

- **Window Picker**: Select specific application windows for screenshots
- **Display Picker**: Choose which monitor to capture
- **Visual Mapping**: See display layouts visually

---

## 🚀 Features

### AI & Intelligence
- **Multiple AI Engines**: Integrated support for:
  - Google Generative AI
  - Groq API
  - LM Studio (local AI models)
  - Sarvamai AI

### Neural Scraper (Web Content Discovery)

A powerful multi-modal web scraping tool that discovers, downloads, and synthesizes content from across the internet.

**Scraping Modes:**

| Mode | Description |
|------|-------------|
| **Images** | Search and download high-quality images based on topic |
| **Videos** | Find and extract video content with thumbnails |
| **Data** | Scrape structured data, articles, and text content |
| **AI Data** | AI-powered research with synthesis reports |

**How It Works (Images Mode):**
1. Enter a search topic in the input field
2. Click **DISCOVER** to start scraping
3. View loading animation with workflow progress
4. Browse discovered images in grid layout
5. Hover over images to see download overlay
6. Click to preview full-size in viewer
7. Download individual or batch-save all to desktop

**How It Works (AI Data Mode):**
1. Enter a research topic
2. System generates optimized search queries using AI
3. Searches Wikipedia and DuckDuckGo for relevant sources
4. Ranks and filters sources by relevance
5. Extracts evidence using AI (Groq/LM Studio)
6. Synthesizes comprehensive research report
7. Displays overview, key points, focus areas, and risks

**AI Report Features:**
- **Executive Summary**: Quick overview of the topic
- **Key Points**: Bulleted important findings with source attribution
- **Focus Areas**: Related topics and subtopics discovered
- **Detailed Narrative**: In-depth analysis (2500-4000 characters)
- **Related Topics**: Wiki topics and subtopics for further research
- **Source Links**: Clickable reference links from search results

**Configuration Options:**
- **Context Length**: Adjustable (512-8192 tokens)
- **Temperature**: AI creativity/precision balance (0-1.5)
- **Search Provider**: DuckDuckGo (default), SerpAPI, Tavily
- **Groq Keys**: Multiple API keys for rate limit rotation
- **Image Count**: Number of images to fetch per search

**API Quota Tracking:**
Click **USAGE** button to view:
- Monthly limits for SerpAPI, Tavily, and NewsAPI
- Usage statistics (used/remaining)
- Plan type and rate limit status

**File Locations:**
- UI: `html/pages/scraper.html`
- Logic: `java/renderer/scraperRenderer.js`
- Styles: `css/pages/scraper.css`
- IPC Handlers: `java/main/mainProcess.js`

### Productivity & Tools
- **Web Browser**: Full-featured browsing with security enhancements
- **Neural Scraper**: Multi-modal web content discovery (images, videos, data, AI reports)
- **Todo Application**: Task management and tracking
- **History Management**: Browse and manage your activity history

### Gaming
- **Extensive Game Library**: 
  - Chessly
  - Go
  - Dark Sky
  - Maze game with 160+ levels
- **Electron Games**: Native desktop game experiences

### Security & Privacy
- **VirusTotal Integration**: Real-time URL and file scanning against 70+ AV engines
- **HTTPS Enforcement**: Secure connections by default
- **Third-Party Cookie Blocking**: Enhanced privacy protection
- **Security Defense Suite**: Dedicated security features with firewall
- **Antivirus Engine**: Pre-download scanning with MIME/double-extension detection
- **Cookie Shield**: Blocks third-party tracking cookies

## 🛠️ Installation

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Windows, macOS, or Linux operating system

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/Ramizsk586/Om-X.git
   cd Om-X
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run in development mode**
   ```bash
   npm run dev
   ```

4. **Build the application**
   ```bash
   npm run build
   ```

## 📦 Package Scripts

- `npm start` - Launch the application
- `npm run dev` - Run in development mode with debugging
- `npm run build` - Build the application for distribution
- `npm run rebuild` - Rebuild native modules

## 🔧 Configuration

### Application Config (`config/app.config.json`)
```json
{
  "appName": "Om-X",
  "version": "2.5.0",
  "build": "stable",
  "defaults": {
    "homeUrl": "https://www.google.com",
    "theme": "dark",
    "userAgent": "Mozilla/5.0..."
  }
}
```

### Security Config (`config/security.config.json`)
- Malware Protection: Enabled
- HTTPS Only: Enabled
- Third-Party Cookies: Blocked

## 📁 Project Structure

```
Om-X/
├── main.js                      # Electron entry point
├── preload.js                   # IPC bridge (renderer ↔ main)
├── package.json                 # Dependencies and scripts
├── .env / .env.example          # Environment variables
│
├── html/                        # UI markup
│   ├── pages/                   # Feature pages
│   │   ├── home.html            # Home page
│   │   ├── scraper.html         # Neural Scraper tool
│   │   ├── downloads.html       # Download manager
│   │   ├── history.html         # History manager
│   │   ├── games.html           # Games launcher
│   │   ├── todo.html            # Todo application
│   │   ├── server-operator.html # Minecraft server control
│   │   └── security-defense-blocked.html
│   └── windows/                 # Window layouts
│       ├── main.html            # Main browser window
│       ├── system.html          # Settings window
│       ├── translate.html       # Translator popup
│       ├── writer.html          # AI Writer popup
│       └── matrix-search.html   # Search panel
│
├── css/                         # Stylesheets
│   ├── base/                    # Reset, variables, base styles
│   ├── layout/                  # Layout (browser.css)
│   ├── pages/                   # Page-specific styles
│   ├── themes/                  # Theme definitions
│   └── windows/                 # Window-specific styles
│
├── java/                        # JavaScript (backend logic)
│   ├── main/                    # Main process
│   │   ├── mainProcess.js       # Electron main process (window, IPC)
│   │   ├── mcpBootstrap.cjs     # MCP server bootstrap
│   │   └── security/             # Security modules
│   │       ├── SecurityManager.js
│   │       ├── antivirus/        # Antivirus engine
│   │       ├── firewall/        # Web firewall
│   │       └── virustotal/      # VirusTotal client
│   │
│   ├── preload.js               # Preload script
│   │
│   ├── renderer/                # Renderer process
│   │   ├── renderer.js          # Main UI controller
│   │   ├── systemRenderer.js    # Settings logic
│   │   ├── scraperRenderer.js   # Neural Scraper logic
│   │   ├── historyRenderer.js
│   │   ├── downloadsRenderer.js
│   │   ├── gamesRenderer.js
│   │   ├── todoRenderer.js
│   │   ├── matrix-search.js
│   │   ├── server-renderer.js
│   │   ├── translate.js
│   │   ├── writer.js
│   │   ├── securityDefenseBlockedRenderer.js
│   │   ├── search.js
│   │   ├── grammarTranslate.js
│   │   ├── block.js
│   │   └── ui/                  # UI components
│   │       ├── screenshotOverlay.js
│   │       ├── sidePanel.js
│   │       ├── tabs.js
│   │       ├── toolbar.js
│   │       ├── translator.js
│   │       ├── writer.js
│   │       ├── downloadPanel.js
│   │       └── grammarTranslate.js
│   │
│   ├── extension/                # Browser extensions
│   │   └── shorts hide/          # YouTube shorts hider
│   │
│   ├── utils/                    # Utilities
│   │   └── ai/                   # AI provider integration
│   │
│   ├── data/                     # Data management
│   │
│   └── webviewPreload.js         # Webview preload script
│
├── game/                         # Games
│   ├── electron/                 # Standalone Electron games
│   │   ├── chessly electron/     # Chess with AI arena
│   │   ├── go electron/          # Go/Baduk board game
│   │   └── dark sky/            # Storm survival mini game
│   └── maze/                     # Maze puzzle game
│       ├── index.html            # Maze menu
│       ├── maze-core.js          # Core maze logic
│       ├── styles.css            # Maze styles
│       └── level*.html           # 200+ maze levels (1-220+)
│
├── tools/                        # External tool integrations
│   ├── wiki/                     # Wikipedia MCP tool
│   │   ├── src/
│   │   ├── mcp-wiki.mjs
│   │   └── package.json
│   └── ddg/                      # DuckDuckGo MCP tool
│       ├── src/
│       ├── mcp-ddg.mjs
│       └── package.json
│
├── mcp/                          # Model Context Protocol server
│   ├── server.mjs                # MCP server entry
│   └── package.json
│
├── Om-chat/                      # Real-time chat application
│   ├── server/                   # Backend
│   │   ├── index.js              # Express + Socket.io server
│   │   ├── config.js             # Configuration
│   │   ├── ai/                   # AI service
│   │   ├── db/                   # MongoDB initialization
│   │   ├── middleware/           # Auth, rate limiting, session
│   │   ├── models/               # Mongoose schemas
│   │   ├── routes/               # REST API endpoints
│   │   ├── services/             # Business logic
│   │   ├── sockets/              # Socket.io handlers
│   │   └── utils/                # Validation, crypto, email
│   ├── public/                   # Frontend
│   │   ├── index.html            # Landing/auth page
│   │   ├── app.html              # Chat application
│   │   ├── css/                  # Chat styles
│   │   ├── js/                   # Client-side JS
│   │   └── assets/               # Static assets
│   ├── gif-pack/                 # Built-in GIF library
│   ├── uploads/                  # User-uploaded files
│   └── scripts/                  # Helper scripts
│
├── bin/                          # Executable tools (ngrok, etc.)
├── assets/                       # Application assets
│   └── icons/                    # App icons
├── LICENSE
└── README.md
```

## 🎮 Neuro-Arcade (Game Hub)

A comprehensive gaming platform with 12 built-in games across multiple genres, plus 3 standalone Electron games.

### Game Categories

| Category | Games |
|----------|-------|
| **Action** | Neuro-Snake, Neural-Dragon, Neural Racer |
| **Puzzle** | Neuro-Memory, 2048 Merge, Maze (200 levels) |
| **Strategy** | Pac-Man Maze, Tetris Block, Brick Breaker |
| **Classic** | Tic-Tac-Toe, Minesweeper, Flappy Bird |
| **Electron** | Chessly, Go, Dark Sky |

---

### Action Games

#### Neuro-Snake
Classic snake game with neural-themed visuals. Navigate the snake to eat food, grow longer, and avoid hitting walls or yourself.
- **Controls**: Arrow keys
- **Objective**: Score points by eating, avoid collision
- **Scoring**: Latency-based score display

#### Neural-Dragon
Endless runner where you control a dragon leaping between data packets. Jump to avoid obstacles and survive as long as possible.
- **Controls**: Spacebar/Click to jump
- **Objective**: Survive endless obstacles, maximize throughput
- **Difficulty**: Speed increases over time

#### Neural Racer
High-speed highway survival racing game. Steer your car through traffic, avoid crashes, and survive as long as possible.
- **Controls**: Arrow keys or A/D to steer
- **Objective**: Survive traffic, maximize score
- **Features**: Speed display, crash counter, power-ups, time survived tracking

---

### Puzzle Games

#### Neuro-Memory
Card matching memory game. Flip cards to find matching pairs with stability percentage tracking.
- **Controls**: Click to flip cards
- **Objective**: Match all pairs with minimal flips
- **Scoring**: Stability percentage (starts at 100%, decreases with moves)

#### 2048 Merge
Classic 2048 tile-merging puzzle game. Slide tiles to combine matching numbers and reach 2048.
- **Controls**: Arrow keys to slide
- **Objective**: Create a 2048 tile
- **Features**: Animated tile merging, gradient color system for tiles

#### Maze Game
200-tiered maze puzzles organized into difficulty levels. Progress through increasingly challenging mazes.
- **Difficulty Tiers**: 50 Low, 50 Mid, 50 Upper, 50 Top
- **Objective**: Navigate from start to finish
- **Features**: No repeat mazes, progressive difficulty

---

### Strategy Games

#### Pac-Man Maze
Classic Pac-Man style maze game. Navigate the maze, eat pellets, and avoid ghosts.
- **Controls**: Arrow keys to move
- **Objective**: Eat all pellets, avoid ghosts
- **Scoring**: Pellet count display

#### Tetris Block
Block-stacking puzzle game. Rotate and drop falling blocks to create complete lines.
- **Controls**: Arrow keys to move, Up to rotate
- **Objective**: Complete lines to score, survive as long as possible
- **Scoring**: Block count display

#### Brick Breaker
Breakout-style brick-breaking game with 50 levels and multiple brick patterns.
- **Controls**: Mouse or arrow keys to move paddle
- **Objective**: Break all bricks
- **Features**: Multiple levels, brick patterns, lives system

---

### Classic Games

#### Tic-Tac-Toe
Unbeatable AI-powered Tic-Tac-Toe game. Play against an AI that never loses.
- **Controls**: Click to place X
- **Objective**: Get three in a row or force a draw
- **AI**: Minimax algorithm for perfect play

#### Minesweeper
Classic minesweeper grid game. Reveal safe cells, avoid mines.
- **Grid**: 10x10 with 10 mines
- **Controls**: Click to reveal, flag mines
- **Objective**: Reveal all safe cells

#### Flappy Bird
Flap-based flying game. Navigate through pipes without crashing.
- **Controls**: Click or Spacebar to flap
- **Objective**: Fly as far as possible without hitting pipes

---

### Electron Games (Standalone Windows)

#### Chessly
Next-generation chess GUI with AI Arena and deep analysis tools.
- **Features**: AI opponents, game analysis, move history
- **Technology**: Standalone Electron window
- **Location**: `game/electron/chessly electron/`

#### Go (Baduk)
Classic Go/Weiqi board game with AI engine support.
- **Features**: AI opponents, save/load games, multiple board sizes
- **Technology**: Standalone Electron window
- **Location**: `game/electron/go electron/`

#### Dark Sky
Storm-flight survival mini game.
- **Genre**: Survival/Adventure
- **Features**: Navigate through storms, survive obstacles
- **Technology**: Standalone Electron window
- **Location**: `game/electron/dark sky/`

---

### Game Hub Architecture

**File Locations:**
- Games UI: `html/pages/games.html`
- Game Logic: `java/renderer/gamesRenderer.js`
- Maze Game: `game/maze/` (200+ level HTML files)
- Electron Games: `game/electron/`
  - Chessly: `chessly electron/`
  - Go: `go electron/`
  - Dark Sky: `dark sky/`

**Technical Features:**
- Canvas-based rendering for smooth gameplay
- RequestAnimationFrame for optimized game loops
- Game state persistence (scores, progress)
- Keyboard event handling with smooth controls
- Responsive design for various screen sizes

## 🔐 Security Features

### Antivirus Protection
- **Pre-download Scanning**: VirusTotal API integration for file verification
- **MIME Type Validation**: Detects file extension spoofing
- **Double Extension Detection**: Identifies disguised executables
- **Dangerous Extension Warnings**: Alerts for .exe, .scr, .bat, .cmd, .vbs, .js, .msi
- **Trusted Source Bypass**: Auto-allows safe downloads from verified sources

### Privacy Controls
- **Third-Party Cookie Blocking**: Prevents cross-site tracking
- **HTTPS Enforcement**: Default to secure connections
- **Cookie Shield**: Strips cookies from third-party requests
- **Custom Blocklists**: Domain and keyword-based blocking

### VirusTotal Integration
- **URL Scanning**: Real-time security checks before visiting sites
- **File Scanning**: SHA256 hash lookup against 70+ AV engines
- **Risk Assessment**: Automatic danger/suspicious/clean classification
- **Quota Tracking**: Monitor API usage limits

## 🌐 AI Integrations

### Supported Providers
1. **Google GenAI** - Google's generative AI
2. **Groq** - Fast inference engine
3. **LM Studio** - Local model execution
4. **Sarvamai** - Indian AI provider

All AI features are configurable through the AI Settings page.

## 📊 Supported APIs

- Socket.io (real-time communication)
- Express.js (backend routing)
- JSPDF (document generation)
- Axios (HTTP client)


## 📝 Development

### Code Structure
- **Preload Scripts** - Security bridge between main and renderer
- **Main Process** - Handles application lifecycle and system integration
- **Renderer Process** - UI and user interaction
- **Java Folder** - Despite the name, contains JavaScript for backend logic

### Available Extensions
- Minecraft Server Integration
- Local AI Model Controller
- Security & Blocking System

## 🐛 Troubleshooting

### Application Won't Start
- Ensure Node.js is properly installed
- Run `npm install` again to verify dependencies
- Check for port conflicts (default port may be in use)

### AI Features Not Working
- Configure API keys in `.env`
- Verify internet connection
- Check supported AI provider is selected

## 📄 License

See [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Sk Abdul Ramiz**
- GitHub: [@Ramizsk586](https://github.com/Ramizsk586)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📧 Support & Feedback

For issues, feature requests, or feedback, please open an issue on [GitHub Issues](https://github.com/Ramizsk586/Om-X/issues).


**Built with ❤️ using Electron, Node.js, and modern web technologies**
