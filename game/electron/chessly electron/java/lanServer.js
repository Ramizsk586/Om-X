
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const ip = require('ip');
const path = require('path');

class LanServer {
    constructor(mainWindow) {
        this.mainWindow = mainWindow;
        this.app = express();
        this.server = http.createServer(this.app);
        
        this.io = new Server(this.server, {
            cors: { origin: "*", methods: ["GET", "POST"], credentials: true },
            transports: ['websocket', 'polling']
        });
        
        this.port = 3000;
        this.isRunning = false;
        this.hostWindow = null;
        this.connectedPlayers = []; 
        this.blockedIDs = new Set();
        this.maxPlayers = 4;

        this.gameState = {
            fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            history: []
        };

        this.setupRoutes();
        this.setupSocket();
    }

    setupRoutes() {
        this.app.use('/assets', express.static(path.join(__dirname, '../assets')));
        this.app.use('/mobile', express.static(path.join(__dirname, '../mobile')));
        this.app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../html/lan-client.html')));
        this.app.get('/style.css', (req, res) => res.sendFile(path.join(__dirname, '../html/css/lan-style.css')));
        this.app.get('/client.js', (req, res) => res.sendFile(path.join(__dirname, '../java/client.js')));
    }

    setupSocket() {
        this.io.on('connection', (socket) => {
            if(this.connectedPlayers.length >= this.maxPlayers) {
                socket.disconnect();
                return;
            }
            
            socket.emit('game-state', this.gameState);

            socket.on('client-join', (data) => {
                if(this.blockedIDs.has(socket.id)) {
                    socket.disconnect();
                    return;
                }
                
                const player = {
                    name: data.name,
                    id: socket.id,
                    avatar: data.avatar
                };
                this.connectedPlayers.push(player);
                
                this.notifyHost('lan-player-joined', player);
            });

            socket.on('client-move', (moveData) => {
                this.notifyHost('lan-move-received', moveData);
            });

            socket.on('disconnect', () => {
                this.connectedPlayers = this.connectedPlayers.filter(p => p.id !== socket.id);
                this.notifyHost('lan-player-disconnected', socket.id);
            });
        });
    }
    
    notifyHost(channel, data) {
        if (this.hostWindow) {
            this.hostWindow.webContents.send(channel, data);
        }
    }

    start() {
        if (this.isRunning) return this.getServerInfo();
        return new Promise((resolve, reject) => {
            this.server.listen(this.port, '0.0.0.0', () => {
                this.isRunning = true;
                resolve(this.getServerInfo());
            });
            this.server.on('error', (e) => reject(e));
        });
    }

    stop() {
        if (!this.isRunning) return;
        this.server.close();
        this.isRunning = false;
        this.connectedPlayers = [];
    }

    getServerInfo() {
        return {
            ip: ip.address(),
            port: this.port,
            url: `http://${ip.address()}:${this.port}/mobile`
        };
    }
    
    getStatus() {
        return {
            isRunning: this.isRunning,
            players: this.connectedPlayers,
            maxPlayers: this.maxPlayers
        };
    }

    setHostWindow(win) {
        this.hostWindow = win;
    }
    
    blockPlayer(id) {
        this.blockedIDs.add(id);
        const socket = this.io.sockets.sockets.get(id);
        if(socket) socket.disconnect();
    }
    
    setConfig(cfg) {
        if(cfg.maxPlayers) this.maxPlayers = cfg.maxPlayers;
    }

    broadcastMove(moveData, fen) {
        this.gameState.fen = fen;
        this.gameState.history.push(moveData);
        this.io.emit('server-move', { move: moveData, fen: fen });
    }
    
    broadcastGameReset(fen) {
        this.gameState.fen = fen;
        this.gameState.history = [];
        this.io.emit('game-reset', { fen });
    }

    broadcastGameOver(result, winner) {
        this.io.emit('game-over', { result, winner });
    }

    broadcastHostInfo(info) {
        this.io.emit('host-info', info);
    }
}

module.exports = LanServer;
