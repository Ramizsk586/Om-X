# SessionGuard — Browser Extension

A Manifest V3 extension that protects session tokens and authentication cookies from cross-tab access, token theft, and unauthorized cookie reads.

## Features

- **Cookie & Session Isolation** — Blocks cross-tab cookie access on protected domains
- **Cross-Tab Access Prevention** — Tracks tab ownership for each session
- **Token Theft Prevention** — Intercepts fetch/XHR exfiltration attempts
- **Request Header Protection** — Strips Cookie/Referer headers from tracking requests
- **Anti-Hijacking** — Detects tab cloning and validates session fingerprints

## Installation (Chrome/Edge)

### Load as Unpacked Extension

1. **Open Extensions page:**
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`

2. **Enable Developer Mode** (toggle in top-right corner)

3. **Click "Load unpacked"**

4. **Select the `SessionGuard` folder**

5. **The extension is now active** — Shield icon appears in toolbar

### Create Placeholder Icons

If you see "Could not load icon" errors, add icon files:

**Windows PowerShell (run in SessionGuard directory):**
```powershell
# Create simple green square icons as placeholders
Add-Type -AssemblyName System.Drawing
@{shield16=16; shield48=48; shield128=128}.GetEnumerator() | ForEach-Object {
    $bmp = New-Object System.Drawing.Bitmap($_.Value, $_.Value)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::FromArgb(34, 197, 94))
    $bmp.Save("icons/$($_.Key).png", [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose()
    Write-Host "Created icons/$($_.Key).png"
}
```

**macOS/Linux (run in SessionGuard directory):**
```bash
# Requires ImageMagick
for size in 16 48 128; do
    convert -size ${size}x${size} xc:"#22c55e" icons/shield${size}.png
done
```

## Usage

1. **Click the shield icon** to open the popup dashboard
2. **Protected Domains** tab shows which sites are protected
3. **Sessions** tab shows active sessions and lets you lock/unlock them
4. **Audit Log** shows blocked access attempts
5. **Settings** lets you toggle protection on/off

## Default Protected Sites

- discord.com, youtube.com, instagram.com
- facebook.com, twitter.com, github.com
- google.com, netflix.com, amazon.com
- twitch.tv, spotify.com, microsoft.com
- (and 10+ more — all configurable)

## How It Works

### Cookie Proxy
Content scripts override `document.cookie` to intercept reads/writes before page scripts execute.

### Session Map
Background service worker maintains a `tabId → domain` ownership map in ephemeral storage.

### Fetch Interceptor
Blocks `fetch()` and `XMLHttpRequest` calls that try to send cookie credentials to tracking domains.

### Storage Monitor
Scans `localStorage`/`sessionStorage` for JWT patterns and token strings.

## Permissions

| Permission | Purpose |
|-----------|---------|
| `cookies` | Monitor cookie changes |
| `tabs` | Track tab-to-domain ownership |
| `storage` | Save settings and session maps |
| `declarativeNetRequest` | Strip headers from tracking requests |
| `webNavigation` | Detect navigation events |
| `scripting` | Inject content scripts |
| `notifications` | Alert on blocked attempts |

## Development

```
SessionGuard/
├── manifest.json
├── background/
│   ├── service_worker.js    # Core logic
│   ├── domain_manager.js    # Whitelist management
│   └── session_map.js       # Tab-to-session mapping
├── content_scripts/
│   ├── cookie_proxy.js      # document.cookie override
│   ├── fetch_interceptor.js # XHR/Fetch blocking
│   └── storage_monitor.js   # Storage token detection
├── popup/
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── rules/
│   └── net_rules.json       # Header stripping rules
├── utils/
│   └── token_detector.js    # Token pattern matching
└── icons/
    ├── shield16.png
    ├── shield48.png
    └── shield128.png
```
