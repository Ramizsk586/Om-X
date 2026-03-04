# Om-X - AI Browser with Minecraft Integration

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
![License](https://img.shields.io/badge/license-Custom-green.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)
![Electron](https://img.shields.io/badge/Electron-33.0.0-0DFF00.svg)

A feature-rich desktop browser built on Electron with integrated AI capabilities, Minecraft bot management, games, and advanced security features.

## 🚀 Features

### AI & Intelligence
- **Multiple AI Engines**: Integrated support for:
  - Google Generative AI
  - Groq API
  - LM Studio (local AI models)
  - Sarvamai AI
- **Omni-Chat**: Advanced conversational AI interface
- **Omni-Canvas**: AI-powered canvas tool for creative tasks
- **AI Settings**: Customizable AI configurations and preferences

### Minecraft Integration
- **Mineflayer Bot Manager**: Create and manage Minecraft bots
- **Bot Automation**: Automated task execution in Minecraft servers
- **Server Connection**: Connect to and control multiple servers
- **Real-time Viewer**: Prismarine viewer for visual bot monitoring

### Productivity & Tools
- **Web Browser**: Full-featured browsing with security enhancements
- **Code Editor**: Built-in development environment
- **PDF Viewer**: Native PDF viewing capabilities
- **Todo Application**: Task management and tracking
- **History Management**: Browse and manage your activity history

### Gaming
- **Extensive Game Library**: 
  - Chess Master
  - Chessly
  - Go
  - Dark Sky
  - Maze game with 160+ levels
- **Electron Games**: Native desktop game experiences

### Content
- **YouTube Download**: Integrated yt-dlp for video downloads
- **YouTube Player**: Embedded YouTube integration

### Security & Privacy
- **Ad Blocker**: Ghostery-based ad blocking (adblocker-electron)
- **Malware Protection**: Advanced malware detection
- **HTTPS Enforcement**: Secure connections by default
- **Third-Party Cookie Blocking**: Enhanced privacy protection
- **Security Defense Suite**: Dedicated security features

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
  "version": "2.0.0",
  "build": "stable",
  "defaults": {
    "homeUrl": "https://www.google.com",
    "theme": "dark",
    "userAgent": "Mozilla/5.0..."
  }
}
```

### Security Config (`config/security.config.json`)
- Ad Blocker: Enabled
- Malware Protection: Enabled
- HTTPS Only: Enabled
- Third-Party Cookies: Blocked

## 📁 Project Structure

```
om-x/
├── main.js                 # Entry point
├── package.json            # Dependencies and scripts
├── config/                 # Application configuration
├── html/                   # UI pages
│   ├── pages/             # Feature pages
│   ├── dialogs/           # Dialog windows
│   └── windows/           # Window layouts
├── css/                    # Stylesheets
│   ├── base/              # Core styles
│   ├── layout/            # Layout styles
│   ├── pages/             # Page-specific styles
│   ├── themes/            # Theme definitions
│   └── windows/           # Window styles
├── java/                  # Main process logic
│   ├── main/              # Core application
│   ├── preload/           # Preload scripts
│   ├── renderer/          # Render process
│   ├── extensions-host/   # Extension system
│   ├── utils/             # Utility functions
│   └── data/              # Data management
├── game/                  # Game modules
│   ├── electron/          # Desktop games
│   └── maze/              # Maze game levels
├── tools/                 # External tools
│   ├── ddg/              # DuckDuckGo integration
│   ├── image-editor/     # Image editing
│   └── wiki/             # Wikipedia integration
└── assets/               # Application assets
    └── icons/            # App icons
```

## 🎮 Games Included

### Single Player Games
- **Chess Master** - Advanced chess gameplay
- **Chessly** - Chess learning and practice
- **Go** - Traditional Go board game
- **Dark Sky** - Adventure game
- **Maze Game** - 160+ progressively challenging levels

## 🤖 Minecraft Bot Capabilities

The integrated Minecraft bot manager provides:
- Autonomous bot automation
- Multi-server management
- Path finding and navigation
- Block collection and inventory management
- Real-time monitoring and control
- Server farming and task automation

## 🔐 Security Features

- **Ghostery Ad Blocker**: Blocks ads and trackers
- **Malware Detection**: Identifies and blocks malicious content
- **Privacy Protection**: 
  - Blocks third-party cookies
  - HTTPS-only enforcement
  - Custom blocklists for domains and keywords
- **Secure Defaults**: HTTPS protocol preference

## 🌐 AI Integrations

### Supported Providers
1. **Google GenAI** - Google's generative AI
2. **Groq** - Fast inference engine
3. **LM Studio** - Local model execution
4. **Sarvamai** - Indian AI provider

All AI features are configurable through the AI Settings page.

## 📊 Supported APIs

- YouTube Download (yt-dlp)
- Minecraft Browser & Data
- Socket.io (real-time communication)
- Express.js (backend routing)
- JSPDF (document generation)
- Axios (HTTP client)

## 🚀 Auto-Update

The application includes built-in auto-update functionality via electron-updater. Updates are published through GitHub releases.

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
- Ad Blocker Module
- Custom Updater

## 🐛 Troubleshooting

### Application Won't Start
- Ensure Node.js is properly installed
- Run `npm install` again to verify dependencies
- Check for port conflicts (default port may be in use)

### Minecraft Bot Issues
- Verify server connection details
- Check mineflayer dependencies with `npm run rebuild`
- Review bot logs for connection errors

### AI Features Not Working
- Configure API keys in AI Settings
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

## 🔄 Version History

### v2.0.0 (Current)
- Multiple AI engine integration
- Enhanced Minecraft bot management
- Expanded game library
- Improved security features
- Local AI model support

---

**Built with ❤️ using Electron, Node.js, and modern web technologies**
