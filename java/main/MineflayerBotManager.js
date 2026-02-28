/**
 * MineflayerBotManager
 * Advanced Minecraft bot using Mineflayer with pathfinding, inventory, and AI
 * Note: Mineflayer only works with Minecraft Java Edition servers
 */

const { ipcMain } = require('electron');
const Vec3 = require('vec3');

// Try to load mineflayer modules, handle errors gracefully
let mineflayer, pathfinder, Movements, GoalNear, GoalBlock, GoalFollow, collectBlock, mcData;
let autoEat, armorManager, pvp;
let autoEatAvailable = false;
let armorManagerAvailable = false;
let pvpAvailable = false;
let viewer = null;
let mineflayerAvailable = false;

try {
  mineflayer = require('mineflayer');
  const pathfinderModule = require('mineflayer-pathfinder');
  pathfinder = pathfinderModule.pathfinder;
  Movements = pathfinderModule.Movements;
  GoalNear = pathfinderModule.goals.GoalNear;
  GoalBlock = pathfinderModule.goals.GoalBlock;
  GoalFollow = pathfinderModule.goals.GoalFollow;
  collectBlock = require('mineflayer-collectblock').plugin;
  mcData = require('minecraft-data');
  mineflayerAvailable = true;
  console.log('[MineflayerBot] All modules loaded successfully');
} catch (error) {
  console.error('[MineflayerBot] Failed to load mineflayer modules:', error.message);
  console.error('[MineflayerBot] Java Edition support will be unavailable');
}

// Optional plugins (do not fail if missing)
try {
  const autoEatModule = require('mineflayer-auto-eat');
  autoEat = autoEatModule.plugin || autoEatModule;
  autoEatAvailable = true;
  console.log('[MineflayerBot] mineflayer-auto-eat loaded');
} catch (e) {}

try {
  const armorModule = require('mineflayer-armor-manager');
  armorManager = armorModule.plugin || armorModule;
  armorManagerAvailable = true;
  console.log('[MineflayerBot] mineflayer-armor-manager loaded');
} catch (e) {}

try {
  const pvpModule = require('mineflayer-pvp');
  pvp = pvpModule.plugin || pvpModule;
  pvpAvailable = true;
  console.log('[MineflayerBot] mineflayer-pvp loaded');
} catch (e) {}

class MineflayerBotManager {
  constructor() {
    this.bots = new Map();
    this.mainWindow = null;
    this.isAvailable = mineflayerAvailable;
    this.viewerServers = new Map();
    this.toolLocks = new Set();
    this.botLocks = new Map(); // botId -> Set of lock keys
    this.defaultCapabilities = {
      crafting: true,
      eating: true,
      walking: true,
      combat: true,
      lighting: true,
      smelting: true,
      building: true,
      inventory: true
    };
    this.defaultAutonomy = {
      enabled: true,
      combat: true,
      eat: true,
      light: true,
      inventory: true,
      maintenance: true,
      wander: true
    };
    this.setupIPCHandlers();
  }

  setMainWindow(window) {
    this.mainWindow = window;
  }

  setupIPCHandlers() {
    // Connect bot
    ipcMain.handle('mineflayer-bot:connect', async (event, config) => {
      return await this.connectBot(config);
    });

    // Disconnect
    ipcMain.handle('mineflayer-bot:disconnect', async (event, botId) => {
      return await this.disconnectBot(botId);
    });

    // Send chat
    ipcMain.handle('mineflayer-bot:chat', async (event, { botId, message }) => {
      return await this.sendChat(botId, message);
    });

    // Execute AI command
    ipcMain.handle('mineflayer-bot:execute-ai-command', async (event, { botId, command, aiResponse }) => {
      return await this.executeAICommand(botId, command, aiResponse);
    });

    // Get bot status
    ipcMain.handle('mineflayer-bot:status', async (event, botId) => {
      return this.getBotStatus(botId);
    });

    // Pathfind to player
    ipcMain.handle('mineflayer-bot:pathfind-to-player', async (event, { botId, playerName, range = 2 }) => {
      return await this.pathfindToPlayer(botId, playerName, range);
    });

    // Collect block
    ipcMain.handle('mineflayer-bot:collect-block', async (event, { botId, blockType, maxDistance = 64 }) => {
      return await this.collectBlock(botId, blockType, maxDistance);
    });

    // Place block
    ipcMain.handle('mineflayer-bot:place-block', async (event, { botId, blockName, position }) => {
      return await this.placeBlock(botId, blockName, position);
    });

    // Check inventory
    ipcMain.handle('mineflayer-bot:inventory', async (event, botId) => {
      return this.getInventory(botId);
    });

    // Check player online
    ipcMain.handle('mineflayer-bot:check-player', async (event, { botId, playerName }) => {
      return await this.checkPlayerOnline(botId, playerName);
    });

    // Get nearby players
    ipcMain.handle('mineflayer-bot:nearby-players', async (event, botId) => {
      return await this.getNearbyPlayers(botId);
    });

    ipcMain.handle('mineflayer-bot:set-viewer', async (event, { botId, enabled }) => {
      return await this.toggleViewer(botId, enabled);
    });

    ipcMain.handle('mineflayer-bot:set-autonomy', async (event, { botId, autonomy }) => {
      const botData = this.bots.get(botId);
      if (!botData) return { success: false, error: 'Bot not found' };
      botData.autonomy = { ...this.defaultAutonomy, ...(autonomy || {}) };
      botData.autonomyEnabled = botData.autonomy.enabled !== false;
      return { success: true };
    });
  }

  async connectBot(config) {
    let bot = null;
    let botData = null;
    try {
      // Check if mineflayer is available
      if (!this.isAvailable || !mineflayer) {
        console.error('[MineflayerBot] Mineflayer not available');
        return {
          success: false,
          error: 'Java Edition support is not available. The mineflayer module failed to load.'
        };
      }
      
      const {
        serverHost = 'localhost',
        serverPort = 25565,
        username = 'AI_Player',
        version = '1.20.4',
        auth = 'offline'
      } = config;

      const normalizeVersion = (ver) => (typeof ver === 'string' ? ver.trim() : '');
      const getProtocol = (ver) => {
        if (!ver) return null;
        const entry = mcData?.versionsByMinecraftVersion?.pc?.[ver];
        return entry ? entry.version : null;
      };

      const requestedVersion = normalizeVersion(version);
      const latestSupported = normalizeVersion(mineflayer.latestSupportedVersion);
      const requestedProtocol = getProtocol(requestedVersion);
      const latestProtocol = getProtocol(latestSupported);

      if (requestedVersion && latestSupported && requestedProtocol && latestProtocol && requestedProtocol > latestProtocol) {
        return {
          success: false,
          error: `Server version ${requestedVersion} is newer than the supported Mineflayer version (${latestSupported}). Downgrade the server or update Mineflayer to connect.`
        };
      }

      console.log(`[MineflayerBot] Creating bot "${username}" for Java server ${serverHost}:${serverPort}`);

      bot = mineflayer.createBot({
        host: serverHost,
        port: parseInt(serverPort),
        username: username,
        version: requestedVersion || version,
        auth: auth, // 'offline' for cracked servers, 'microsoft' for premium
        checkTimeoutInterval: 60000,
        viewDistance: 1
      });

      if (pvpAvailable && pvp) bot.loadPlugin(pvp);
      if (autoEatAvailable && autoEat) bot.loadPlugin(autoEat);
      if (armorManagerAvailable && armorManager) bot.loadPlugin(armorManager);

      const botId = `mf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Store bot data
      const autonomyConfig = { ...this.defaultAutonomy, ...(config?.autonomy || {}) };
      botData = {
        bot,
        id: botId,
        username,
        serverHost,
        serverPort,
        connected: false,
        spawned: false,
        connectWaiter: null,
        currentTask: null,
        lastActivity: Date.now(),
        autonomyEnabled: autonomyConfig.enabled !== false,
        autonomy: autonomyConfig,
        autonomyInterval: null,
        memoryGuardInterval: null,
        autonomyBusy: false,
        autonomyState: null,
        lastManualCommandAt: 0,
        autonomyNextActionAt: 0,
        lastActionAt: 0,
        lastSmeltAt: 0,
        lastCraftAt: 0,
        capabilities: { ...this.defaultCapabilities, ...(config?.capabilities || {}) }
      };

      this.bots.set(botId, botData);

      // Setup event handlers
      this.setupBotEventHandlers(bot, botId, botData);

      // Wait for successful connection without missing fast spawn events
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          if (botData.connectWaiter) {
            botData.connectWaiter = null;
          }
          if (botData.connected || botData.spawned || bot.entity || bot._client?.state === 'PLAY') {
            resolve();
            return;
          }
          reject(new Error('Connection timeout after 30 seconds'));
        }, 30000);

        botData.connectWaiter = {
          resolve: () => {
            clearTimeout(timeout);
            botData.connectWaiter = null;
            resolve();
          },
          reject: (err) => {
            clearTimeout(timeout);
            botData.connectWaiter = null;
            reject(err);
          }
        };

        if (botData.spawned) {
          botData.connectWaiter.resolve();
          return;
        }

        // Resolve on spawn/login events directly to avoid missed signals
        bot.once('login', () => {
          botData.connected = true;
          if (botData.connectWaiter) botData.connectWaiter.resolve();
        });
        bot.once('spawn', () => {
          botData.connected = true;
          botData.spawned = true;
          if (botData.connectWaiter) botData.connectWaiter.resolve();
        });

        bot.once('error', (err) => {
          if (botData.connectWaiter) botData.connectWaiter.reject(err);
        });

        bot.once('kicked', (reason) => {
          if (botData.connectWaiter) botData.connectWaiter.reject(new Error(`Kicked from server: ${reason}`));
        });
      });

      // Load plugins after spawn
      bot.loadPlugin(pathfinder);
      bot.loadPlugin(collectBlock);

      // Configure default movements
      const defaultMove = new Movements(bot, mcData(bot.version));
      defaultMove.canDig = true;
      defaultMove.allow1by1towers = true;
      defaultMove.allowFreeMotion = true;
      defaultMove.scafoldingBlocks = [];
      bot.pathfinder.setMovements(defaultMove);

      console.log(`[MineflayerBot] Bot "${username}" spawned and ready!`);
      this.notifyRenderer('bot-spawned', { botId, username });

      return {
        success: true,
        botId,
        message: `Bot "${username}" connected to ${serverHost}:${serverPort}`,
        version: bot.version
      };

    } catch (error) {
      console.error('[MineflayerBot] Connection error:', error);
      if (error && String(error.message || error).includes('Connection timeout')) {
        if (bot && (bot.entity || bot._client?.state === 'PLAY')) {
          if (botData) {
            botData.connected = true;
            botData.spawned = botData.spawned || !!bot.entity;
          }
          return {
            success: true,
            botId: botData?.id,
            message: `Bot "${botData?.username || 'AI_Player'}" connected to ${botData?.serverHost || 'server'}`,
            version: bot?.version
          };
        }
      }
      // Ensure any partially created bot is cleaned up to avoid leaks
      try {
        for (const [id, data] of this.bots.entries()) {
          if (data.connected || data.spawned || data.bot?.entity) continue;
          if (data.bot && typeof data.bot.end === 'function') {
            data.bot.end();
          }
          if (data.bot && typeof data.bot.removeAllListeners === 'function') {
            data.bot.removeAllListeners();
          }
          this.bots.delete(id);
        }
      } catch (e) {}
      let errorMessage = error && error.message ? error.message : String(error);
      if (error && error.code === 'ECONNRESET') {
        errorMessage = `${errorMessage}. Connection was reset by the server. Check: correct LAN port, Java Edition server, matching game version, and online-mode auth.`;
      }
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  setupBotEventHandlers(bot, botId, botData) {
    bot.once('login', () => {
      botData.connected = true;
      if (botData.connectWaiter) {
        botData.connectWaiter.resolve();
      }
    });

    // Spawn event
    bot.once('spawn', () => {
      console.log(`[MineflayerBot] Bot spawned in world`);
      botData.spawned = true;
      botData.connected = true;
      if (botData.connectWaiter) {
        botData.connectWaiter.resolve();
      }
        this.notifyRenderer('bot-spawned', { 
          botId, 
          username: botData.username,
          position: bot.entity.position 
        });

        // Memory guard to avoid Electron OOM
        if (!botData.memoryGuardInterval) {
          botData.memoryGuardInterval = setInterval(() => {
            try {
              const heapUsed = process.memoryUsage().heapUsed;
              if (heapUsed > 1200 * 1024 * 1024) {
                console.error('[MineflayerBot] High memory usage detected, disconnecting bot to prevent crash');
                this.disconnectBot(botId);
              }
            } catch (e) {}
          }, 10000);
        }

        if (bot.autoEat) {
          bot.autoEat.options = {
            priority: 'foodPoints',
            startAt: 14,
          bannedFood: ['rotten_flesh', 'spider_eye', 'poisonous_potato', 'pufferfish', 'chicken']
        };
        if (typeof bot.autoEat.enable === 'function') {
          bot.autoEat.enable();
        }
      }

      if (bot.armorManager && typeof bot.armorManager.equipAll === 'function') {
        bot.armorManager.equipAll();
      }

      this.startAutonomyLoop(botId);
    });

    // Chat event
    bot.on('chat', (username, message) => {
      if (username === bot.username) return;
      
      console.log(`[MineflayerBot] Chat: ${username}: ${message}`);
      this.notifyRenderer('bot-chat-received', { 
        botId, 
        username, 
        message,
        timestamp: Date.now()
      });

      // Check for AI commands
      if (message.includes(bot.username) || message.includes('@AI')) {
        this.handleAICommand(botId, username, message);
      }
    });

    // Message event (for system messages)
    bot.on('message', (jsonMsg) => {
      const message = jsonMsg.toString();
      console.log(`[MineflayerBot] Message: ${message}`);
    });

    // Error handling
    bot.on('error', (err) => {
      console.error(`[MineflayerBot] Bot error:`, err);
      this.notifyRenderer('bot-error', { botId, error: err.message });
    });

    // Kicked event
    bot.on('kicked', (reason, loggedIn) => {
      console.log(`[MineflayerBot] Bot kicked:`, reason);
      botData.connected = false;
      this.notifyRenderer('bot-kicked', { botId, reason, loggedIn });
    });

    // Death event
    bot.on('death', () => {
      console.log(`[MineflayerBot] Bot died`);
      this.notifyRenderer('bot-death', { botId });
      bot.chat('I died! Respawning...');
    });

    // Health change
    bot.on('health', () => {
      if (bot.health < 10) {
        bot.chat(`Warning: My health is low (${bot.health}/20)`);
      }
    });

    // Entity spawn (for tracking players)
    bot.on('entitySpawn', (entity) => {
      if (entity.type === 'player' && entity.username !== bot.username) {
        console.log(`[MineflayerBot] Player spawned: ${entity.username}`);
        this.notifyRenderer('player-joined', { botId, username: entity.username });
      }
    });

    // Disconnected
    bot.on('end', () => {
      console.log(`[MineflayerBot] Bot disconnected`);
      botData.connected = false;
      if (botData.connectWaiter) {
        botData.connectWaiter.reject(new Error('Bot disconnected'));
        botData.connectWaiter = null;
      }
      this.stopAutonomyLoop(botId);
      if (botData.memoryGuardInterval) {
        clearInterval(botData.memoryGuardInterval);
        botData.memoryGuardInterval = null;
      }
      this.notifyRenderer('bot-disconnected', { botId });
      this.bots.delete(botId);
      this.botLocks.delete(botId);
    });
  }

  async handleAICommand(botId, username, message) {
    const botData = this.bots.get(botId);
    if (!botData) return;

    const bot = botData.bot;
    const cleanMessage = message.replace(bot.username, '').replace('@AI', '').trim().toLowerCase();

    console.log(`[MineflayerBot] AI command from ${username}: "${cleanMessage}"`);

    // Send to renderer for AI processing
    this.notifyRenderer('ai-command-request', {
      botId,
      fromPlayer: username,
      command: cleanMessage,
      fullMessage: message
    });
  }

  async executeAICommand(botId, command, aiResponse) {
    const botData = this.bots.get(botId);
    if (!botData || !botData.connected) {
      return { success: false, error: 'Bot not connected' };
    }

    const bot = botData.bot;
    const cmd = command.toLowerCase();
    botData.lastManualCommandAt = Date.now();
    const manualTaskName = `manual:${cmd || 'command'}`;
    this.stopCurrentTask(botId, 'manual_command');
    this.setCurrentTask(botId, manualTaskName, 'manual', 300000);

    try {
      bot.chat(`Executing: ${command}`);

      // Pathfinding commands
      if (cmd.includes('come') || cmd.includes('here')) {
        return await this.pathfindToNearestPlayer(botId);
      }

      if (cmd.includes('follow')) {
        const playerName = cmd.replace('follow', '').trim() || null;
        return await this.startFollowing(botId, playerName);
      }

      if (cmd.includes('stop') || cmd.includes('stay')) {
        bot.pathfinder.setGoal(null);
        this.stopCurrentTask(botId, 'manual_stop');
        bot.chat('I\'ll wait here.');
        return { success: true, action: 'stopped' };
      }

      // Resource gathering
      if (cmd.includes('wood') || cmd.includes('log') || cmd.includes('tree')) {
        return await this.collectBlock(botId, 'oak_log', 32);
      }

      if (cmd.includes('stone') || cmd.includes('mine')) {
        return await this.collectBlock(botId, 'stone', 32);
      }

      if (cmd.includes('coal')) {
        return await this.collectBlock(botId, 'coal_ore', 16);
      }

      // Building
      if (cmd.includes('build') || cmd.includes('place')) {
        // Simple block placement example
        return { success: true, action: 'building_requested', message: 'Building requires specific coordinates' };
      }

      // Information
      if (cmd.includes('position') || cmd.includes('where')) {
        const pos = bot.entity.position;
        bot.chat(`I'm at X:${Math.floor(pos.x)} Y:${Math.floor(pos.y)} Z:${Math.floor(pos.z)}`);
        return { success: true, action: 'position_reported', position: pos };
      }

      if (cmd.includes('inventory') || cmd.includes('items')) {
        if (!this.can(botId, 'inventory')) {
          bot.chat('Inventory system is disabled in the AI config.');
          return { success: false, error: 'inventory disabled' };
        }
        return await this.showInventory(botId);
      }

      if (cmd.includes('health') || cmd.includes('hp')) {
        bot.chat(`Health: ${bot.health}/20, Food: ${bot.food}/20`);
        return { success: true, action: 'health_reported', health: bot.health, food: bot.food };
      }

      if (cmd.includes('craft') || cmd.includes('tools') || cmd.includes('gear')) {
        if (!this.can(botId, 'crafting')) {
          bot.chat('Crafting is disabled in the AI config.');
          return { success: false, error: 'crafting disabled' };
        }
        await this.ensureAdvancedLoadout(botId);
        bot.chat('Crafting and gear check complete.');
        return { success: true, action: 'crafted_loadout' };
      }

      if (cmd.includes('armor')) {
        if (!this.can(botId, 'crafting')) {
          bot.chat('Armor crafting is disabled in the AI config.');
          return { success: false, error: 'armor crafting disabled' };
        }
        await this.ensureArmor(botId);
        bot.chat('Armor check complete.');
        return { success: true, action: 'armor_check' };
      }

      if (cmd.includes('shield')) {
        if (!this.can(botId, 'crafting')) {
          bot.chat('Shield crafting is disabled in the AI config.');
          return { success: false, error: 'shield crafting disabled' };
        }
        await this.ensureShield(bot);
        bot.chat('Shield ready.');
        return { success: true, action: 'shield_ready' };
      }

      if (cmd.includes('smelt')) {
        if (!this.can(botId, 'smelting')) {
          bot.chat('Smelting is disabled in the AI config.');
          return { success: false, error: 'smelting disabled' };
        }
        const smelted = await this.trySmeltIron(bot);
        bot.chat(smelted ? 'Smelting complete.' : 'Could not smelt right now.');
        return { success: true, action: 'smelt' };
      }

      if (cmd.includes('chest') || cmd.includes('store')) {
        await this.ensureChestAndStash(bot);
        bot.chat('Stored items in a chest.');
        return { success: true, action: 'stash' };
      }

      if (cmd.includes('shelter') || cmd.includes('base')) {
        if (!this.can(botId, 'building')) {
          bot.chat('Building is disabled in the AI config.');
          return { success: false, error: 'building disabled' };
        }
        const built = await this.buildQuickShelter(bot);
        bot.chat(built ? 'Shelter ready.' : 'Could not build shelter.');
        return { success: true, action: 'shelter' };
      }

      if (cmd.includes('trade') || cmd.includes('villager')) {
        const traded = await this.basicVillagerTrade(bot);
        bot.chat(traded ? 'Trade done.' : 'Could not trade now.');
        return { success: true, action: 'trade' };
      }

      if (cmd.includes('sleep') || cmd.includes('bed')) {
        const slept = await this.sleepIfNight(bot);
        bot.chat(slept ? 'Sleeping now.' : 'No bed available or it is not night.');
        return { success: true, action: 'sleep' };
      }

      if (cmd.includes('torch') || cmd.includes('light')) {
        if (!this.can(botId, 'lighting')) {
          bot.chat('Lighting is disabled in the AI config.');
          return { success: false, error: 'lighting disabled' };
        }
        const lit = await this.tryAutoLight(bot);
        bot.chat(lit ? 'Placed a torch.' : 'No torch available.');
        return { success: true, action: 'light' };
      }

      if (cmd.includes('eat') || cmd.includes('food')) {
        if (!this.can(botId, 'eating')) {
          bot.chat('Eating is disabled in the AI config.');
          return { success: false, error: 'eating disabled' };
        }
        const ate = await this.tryEat(bot);
        if (!ate) await this.huntForFood(bot);
        bot.chat('Getting food.');
        return { success: true, action: 'eat' };
      }

      if (cmd.includes('autonomy on') || cmd.includes('free will on')) {
        if (!botData.autonomy) botData.autonomy = { ...this.defaultAutonomy };
        botData.autonomy.enabled = true;
        botData.autonomyEnabled = true;
        bot.chat('Autonomy enabled.');
        return { success: true, action: 'autonomy_on' };
      }
      if (cmd.includes('autonomy off') || cmd.includes('free will off')) {
        if (!botData.autonomy) botData.autonomy = { ...this.defaultAutonomy };
        botData.autonomy.enabled = false;
        botData.autonomyEnabled = false;
        bot.chat('Autonomy disabled.');
        return { success: true, action: 'autonomy_off' };
      }

      // Default response
      bot.chat(aiResponse || 'I received your command!');
      return { success: true, action: 'chat_response' };

    } catch (error) {
      console.error('[MineflayerBot] Command execution error:', error);
      bot.chat('Sorry, I had trouble with that command.');
      return { success: false, error: error.message };
    } finally {
      // Keep the manual task active for a bit to avoid autonomy interference
      if (botData.currentTask && botData.currentTask.name === manualTaskName) {
        botData.currentTask.expiresAt = Date.now() + 300000;
      }
    }
  }

  async pathfindToPlayer(botId, playerName, range = 2) {
    const botData = this.bots.get(botId);
    if (!botData || !botData.connected) {
      return { success: false, error: 'Bot not connected' };
    }

    const bot = botData.bot;
    const player = bot.players[playerName];

    if (!player || !player.entity) {
      bot.chat(`I can't see ${playerName}!`);
      return { success: false, error: 'Player not visible' };
    }

    const target = player.entity.position;
    bot.chat(`Coming to you, ${playerName}!`);

    try {
      await bot.pathfinder.goto(new GoalNear(target.x, target.y, target.z, range));
      bot.chat('I\'m here!');
      return { success: true, action: 'pathfind_complete' };
    } catch (error) {
      bot.chat('I couldn\'t reach you!');
      return { success: false, error: error.message };
    }
  }

  async pathfindToNearestPlayer(botId) {
    const botData = this.bots.get(botId);
    if (!botData || !botData.connected) {
      return { success: false, error: 'Bot not connected' };
    }

    const bot = botData.bot;
    let nearest = null;
    let minDistance = Infinity;

    for (const playerName in bot.players) {
      if (playerName === bot.username) continue;
      const player = bot.players[playerName];
      if (player.entity) {
        const dist = bot.entity.position.distanceTo(player.entity.position);
        if (dist < minDistance) {
          minDistance = dist;
          nearest = playerName;
        }
      }
    }

    if (nearest) {
      return await this.pathfindToPlayer(botId, nearest, 2);
    } else {
      bot.chat('I don\'t see anyone nearby!');
      return { success: false, error: 'No players nearby' };
    }
  }

  async startFollowing(botId, playerName = null) {
    const botData = this.bots.get(botId);
    if (!botData || !botData.connected) {
      return { success: false, error: 'Bot not connected' };
    }

    const bot = botData.bot;
    const target = playerName || Object.keys(bot.players).find(p => p !== bot.username);

    if (!target || !bot.players[target] || !bot.players[target].entity) {
      bot.chat('No one to follow!');
      return { success: false, error: 'No target to follow' };
    }

    bot.chat(`Following ${target}!`);
    
    const playerEntity = bot.players[target].entity;
    bot.pathfinder.setGoal(new GoalFollow(playerEntity, 2), true);

    return { success: true, action: 'following', target };
  }

  async collectBlock(botId, blockType, maxDistance = 64) {
    const botData = this.bots.get(botId);
    if (!botData || !botData.connected) {
      return { success: false, error: 'Bot not connected' };
    }

    const bot = botData.bot;
    const blockId = mcData(bot.version).blocksByName[blockType]?.id;

    if (!blockId) {
      bot.chat(`I don't know what ${blockType} is!`);
      return { success: false, error: 'Unknown block type' };
    }

    bot.chat(`Looking for ${blockType}...`);

    try {
      const block = bot.findBlock({
        matching: blockId,
        maxDistance: maxDistance
      });

      if (!block) {
        bot.chat(`I can't find any ${blockType} nearby!`);
        return { success: false, error: 'Block not found' };
      }

      await bot.collectBlock.collect(block);
      bot.chat(`Collected ${blockType}!`);
      
      return { 
        success: true, 
        action: 'collected', 
        blockType,
        position: block.position 
      };

    } catch (error) {
      bot.chat(`Couldn't collect ${blockType}: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async placeBlock(botId, blockName, position) {
    const botData = this.bots.get(botId);
    if (!botData || !botData.connected) {
      return { success: false, error: 'Bot not connected' };
    }

    const bot = botData.bot;
    
    try {
      // Find block in inventory
      const items = bot.inventory.items();
      const blockItem = items.find(item => item.name.includes(blockName));

      if (!blockItem) {
        bot.chat(`I don't have ${blockName} in my inventory!`);
        return { success: false, error: 'Block not in inventory' };
      }

      // Equip the block
      await bot.equip(blockItem, 'hand');
      
      // Place at position (simplified - assumes position is valid)
      const referenceBlock = bot.blockAt(position.offset(0, -1, 0));
      if (!referenceBlock) {
        return { success: false, error: 'Invalid placement position' };
      }

      await bot.placeBlock(referenceBlock, position);
      bot.chat(`Placed ${blockName}!`);
      
      return { success: true, action: 'placed', blockName, position };

    } catch (error) {
      bot.chat(`Couldn't place ${blockName}: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async showInventory(botId) {
    const botData = this.bots.get(botId);
    if (!botData || !botData.connected) {
      return { success: false, error: 'Bot not connected' };
    }

    const bot = botData.bot;
    const items = bot.inventory.items();
    
    if (items.length === 0) {
      bot.chat('My inventory is empty!');
      return { success: true, empty: true };
    }

    const itemList = items.slice(0, 5).map(item => `${item.count}x ${item.name}`).join(', ');
    bot.chat(`I have: ${itemList}${items.length > 5 ? ' and more...' : ''}`);

    return { 
      success: true, 
      items: items.map(item => ({ name: item.name, count: item.count }))
    };
  }

  getInventory(botId) {
    const botData = this.bots.get(botId);
    if (!botData || !botData.connected) {
      return { success: false, error: 'Bot not connected' };
    }
    if (!this.can(botId, 'inventory')) {
      return { success: false, error: 'Inventory disabled' };
    }

    const items = botData.bot.inventory.items();
    return {
      success: true,
      items: items.map(item => ({
        name: item.name,
        count: item.count,
        slot: item.slot
      }))
    };
  }

  async sendChat(botId, message) {
    const botData = this.bots.get(botId);
    if (!botData || !botData.connected) {
      return { success: false, error: 'Bot not connected' };
    }

    try {
      botData.bot.chat(message);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  startAutonomyLoop(botId) {
    const botData = this.bots.get(botId);
    if (!botData || botData.autonomyInterval) return;

    botData.autonomyInterval = setInterval(() => {
      this.runAutonomyTick(botId);
    }, 1500);
  }

  stopAutonomyLoop(botId) {
    const botData = this.bots.get(botId);
    if (botData && botData.autonomyInterval) {
      clearInterval(botData.autonomyInterval);
      botData.autonomyInterval = null;
    }
  }

  // =========================
  // Step-by-step Autonomy Engine
  // =========================

  initAutonomyState(botData) {
    if (!botData.autonomyState) {
      botData.autonomyState = {
        stepIndex: 0,
        cooldowns: {},
        maintenanceQueue: [],
        lastMaintenanceAt: 0
      };
    }
    return botData.autonomyState;
  }

  async runAutonomyTick(botId) {
    const botData = this.bots.get(botId);
    if (!botData || !botData.connected || !this.isAuto(botId, 'enabled') || !botData.bot?.entity) return;
    if (botData.autonomyBusy) return;

    // Don't fight the user for control for a short window after manual commands
    if (Date.now() - botData.lastManualCommandAt < 15000) return;

    const now = Date.now();
    if (botData.currentTask && botData.currentTask.source === 'manual') {
      if (botData.currentTask.expiresAt && now < botData.currentTask.expiresAt) return;
      this.clearCurrentTask(botId);
    }
    if (now - botData.lastActionAt < 3000) return; // enforce 3s gap between tasks

    botData.autonomyBusy = true;
    try {
      const bot = botData.bot;
      const state = this.initAutonomyState(botData);

      // Immediate threat check
      const hostile = this.findNearestHostile(bot, 12);
      if (hostile && hostile.position && this.can(botId, 'combat') && this.isAuto(botId, 'combat')) {
        this.setCurrentTask(botId, 'combat', 'autonomy', 15000);
        await this.handleHostile(botId, bot, hostile);
        this.clearCurrentTask(botId, 'combat');
        botData.lastActionAt = Date.now();
        return;
      }

      // Step-by-step maintenance queue
      if (state.maintenanceQueue.length > 0) {
        const step = state.maintenanceQueue.shift();
        this.setCurrentTask(botId, `maintenance:${step}`, 'autonomy', 15000);
        await this.runMaintenanceStep(botId, bot, step);
        this.clearCurrentTask(botId, `maintenance:${step}`);
        botData.lastActionAt = Date.now();
        return;
      }

      const steps = this.getAutonomySteps(botId, bot, state);
      if (!steps.length) return;

      for (let i = 0; i < steps.length; i++) {
        const idx = (state.stepIndex + i) % steps.length;
        const step = steps[idx];
        const nextAt = state.cooldowns[step.key] || 0;
        if (now < nextAt) continue;
        this.setCurrentTask(botId, `step:${step.key}`, 'autonomy', 15000);
        const acted = await step.run();
        this.clearCurrentTask(botId, `step:${step.key}`);
        state.stepIndex = (idx + 1) % steps.length;
        if (acted) {
          state.cooldowns[step.key] = now + (step.cooldownMs || 6000);
          botData.lastActionAt = Date.now();
        }
        break;
      }
    } catch (e) {
    } finally {
      botData.autonomyBusy = false;
    }
  }

  getAutonomySteps(botId, bot, state) {
    const steps = [];
    const now = Date.now();

    steps.push({
      key: 'eat',
      cooldownMs: 8000,
      run: async () => {
        if (!this.can(botId, 'eating') || !this.isAuto(botId, 'eat')) return false;
        if (bot.food === undefined || bot.food >= 16) return false;
        return await this.tryEat(bot);
      }
    });

    steps.push({
      key: 'light',
      cooldownMs: 30000,
      run: async () => {
        if (!this.can(botId, 'lighting') || !this.isAuto(botId, 'light')) return false;
        return await this.tryAutoLight(bot);
      }
    });

    steps.push({
      key: 'inventory',
      cooldownMs: 20000,
      run: async () => {
        if (!this.can(botId, 'inventory') || !this.isAuto(botId, 'inventory')) return false;
        const emptySlots = bot.inventory.slots.filter(slot => slot == null).length;
        if (emptySlots > 2) return false;
        await this.ensureInventorySpace(bot);
        return true;
      }
    });

    steps.push({
      key: 'maintenance',
      cooldownMs: 180000,
      run: async () => {
        if (!this.isAuto(botId, 'maintenance')) return false;
        if (now - state.lastMaintenanceAt < 180000) return false;
        state.lastMaintenanceAt = now;
        state.maintenanceQueue = [
          'equip_armor',
          'equip_shield',
          'torches',
          'smelt'
        ];
        return true;
      }
    });

    steps.push({
      key: 'wander',
      cooldownMs: 10000,
      run: async () => {
        if (!this.can(botId, 'walking') || !this.isAuto(botId, 'wander')) return false;
        await this.performIdleAutonomy(botId, bot);
        return true;
      }
    });

    return steps;
  }

  async runMaintenanceStep(botId, bot, step) {
    switch (step) {
      case 'equip_armor':
        if (this.can(botId, 'inventory')) await this.equipArmorIfAvailable(bot);
        break;
      case 'equip_shield':
        if (this.can(botId, 'inventory')) await this.equipShieldIfAvailable(bot);
        break;
      case 'torches':
        if (this.can(botId, 'crafting')) await this.ensureTorchesPassive(bot);
        break;
      case 'smelt':
        if (this.can(botId, 'smelting')) await this.trySmeltIronPassive(bot);
        break;
      default:
        break;
    }
  }

  async equipArmorIfAvailable(bot) {
    try {
      await this.tryEquipArmor(bot, 'diamond_helmet', 'head');
      await this.tryEquipArmor(bot, 'diamond_chestplate', 'torso');
      await this.tryEquipArmor(bot, 'diamond_leggings', 'legs');
      await this.tryEquipArmor(bot, 'diamond_boots', 'feet');
      await this.tryEquipArmor(bot, 'iron_helmet', 'head');
      await this.tryEquipArmor(bot, 'iron_chestplate', 'torso');
      await this.tryEquipArmor(bot, 'iron_leggings', 'legs');
      await this.tryEquipArmor(bot, 'iron_boots', 'feet');
    } catch (e) {}
  }

  async equipShieldIfAvailable(bot) {
    try {
      const shield = bot.inventory.items().find(i => i.name === 'shield');
      if (shield) {
        await bot.equip(shield, 'off-hand');
      }
    } catch (e) {}
  }

  async ensureTorchesPassive(bot) {
    try {
      const torchCount = this.countItem(bot, 'torch');
      if (torchCount >= 8) return false;
      const fuel = bot.inventory.items().find(i => i.name === 'coal' || i.name === 'charcoal');
      if (!fuel) return false;
      if (this.countItem(bot, 'stick') < 2) {
        const woodType = this.findWoodType(bot);
        if (!woodType) return false;
        const planksName = `${woodType}_planks`;
        if (this.countItem(bot, planksName) < 2) return false;
        await this.craftItem(bot, 'stick', 4);
      }
      if (this.countItem(bot, 'stick') < 2) return false;
      return await this.craftItem(bot, 'torch', 16);
    } catch (e) {
      return false;
    }
  }

  async trySmeltIronPassive(bot) {
    try {
      const data = this.getMcDataForBot(bot);
      if (!data) return false;
      const rawIron = this.countItem(bot, 'raw_iron') + this.countItem(bot, 'iron_ore');
      if (rawIron <= 0) return false;
      const fuelItem = this.findSmeltingFuel(bot);
      if (!fuelItem) return false;

      let furnaceBlock = bot.findBlock({ matching: data.blocksByName.furnace?.id, maxDistance: 4 });
      if (!furnaceBlock) {
        if (!this.hasItem(bot, 'furnace', 1)) return false;
        await this.placeBlockNearby(bot, 'furnace');
        furnaceBlock = bot.findBlock({ matching: data.blocksByName.furnace?.id, maxDistance: 4 });
      }
      if (!furnaceBlock) return false;

      const furnace = await bot.openFurnace(furnaceBlock);
      const inputItem = bot.inventory.items().find(i => i.name === 'raw_iron' || i.name === 'iron_ore');
      if (!inputItem) {
        furnace.close();
        return false;
      }
      await furnace.putInput(inputItem.type, Math.min(inputItem.count, 8));
      await furnace.putFuel(fuelItem.type, Math.min(fuelItem.count, 8));
      await new Promise(resolve => setTimeout(resolve, 3000));
      try { await furnace.takeOutput(); } catch (e) {}
      furnace.close();
      return true;
    } catch (e) {
      return false;
    }
  }

  // =========================
  // Advanced Autonomy Helpers
  // =========================

  getPassiveMobNames() {
    return new Set([
      'cow', 'pig', 'chicken', 'sheep', 'rabbit', 'mooshroom',
      'horse', 'donkey', 'mule', 'llama', 'goat'
    ]);
  }

  getJunkItemNames() {
    return new Set([
      'rotten_flesh', 'spider_eye', 'poisonous_potato', 'pufferfish',
      'feather', 'string', 'seeds', 'wheat_seeds', 'beetroot_seeds'
    ]);
  }

  getHostileMobNames() {
    return new Set([
      'zombie', 'skeleton', 'creeper', 'spider', 'cave_spider', 'enderman',
      'witch', 'drowned', 'husk', 'stray', 'phantom', 'pillager', 'vindicator',
      'evoker', 'ravager', 'blaze', 'ghast', 'piglin_brute', 'hoglin',
      'wither_skeleton', 'magma_cube', 'slime'
    ]);
  }

  can(botId, capability) {
    const botData = this.bots.get(botId);
    const caps = botData?.capabilities || this.defaultCapabilities;
    return caps[capability] !== false;
  }

  isAuto(botId, key) {
    const botData = this.bots.get(botId);
    const auto = botData?.autonomy || this.defaultAutonomy;
    if (key === 'enabled') return auto.enabled !== false;
    return auto[key] !== false;
  }

  setCurrentTask(botId, name, source = 'autonomy', ttlMs = 60000) {
    const botData = this.bots.get(botId);
    if (!botData) return;
    if (botData.currentTask && botData.currentTask.name === name && botData.currentTask.source === source) {
      return;
    }
    this.stopCurrentTask(botId, 'switch_task');
    botData.currentTask = {
      name,
      source,
      startedAt: Date.now(),
      expiresAt: Date.now() + ttlMs
    };
  }

  clearCurrentTask(botId, name = null) {
    const botData = this.bots.get(botId);
    if (!botData || !botData.currentTask) return;
    if (!name || botData.currentTask.name === name) {
      botData.currentTask = null;
    }
  }

  stopCurrentTask(botId, reason = 'interrupt') {
    const botData = this.bots.get(botId);
    if (!botData || !botData.bot) return;
    const bot = botData.bot;
    try {
      if (bot.pathfinder && typeof bot.pathfinder.setGoal === 'function') {
        bot.pathfinder.setGoal(null);
      }
      if (bot.pathfinder && typeof bot.pathfinder.stop === 'function') {
        bot.pathfinder.stop();
      }
    } catch (e) {}
    try {
      if (bot.pvp && typeof bot.pvp.stop === 'function') bot.pvp.stop();
    } catch (e) {}
    try {
      if (bot.collectBlock && typeof bot.collectBlock.cancelTask === 'function') {
        bot.collectBlock.cancelTask();
      }
    } catch (e) {}
    try {
      if (typeof bot.clearControlStates === 'function') bot.clearControlStates();
    } catch (e) {}
    botData.currentTask = null;
  }

  findBotIdByInstance(botInstance) {
    for (const [id, data] of this.bots.entries()) {
      if (data.bot === botInstance) return id;
    }
    return null;
  }

  // Simple per-bot lock utility to prevent re-entrancy loops
  getLockSet(botId) {
    if (!this.botLocks.has(botId)) {
      this.botLocks.set(botId, new Set());
    }
    return this.botLocks.get(botId);
  }

  async withLock(botId, key, fn) {
    const locks = this.getLockSet(botId);
    if (locks.has(key)) return null;
    locks.add(key);
    try {
      return await fn();
    } finally {
      locks.delete(key);
    }
  }

  getWoodTypes() {
    return [
      'oak','spruce','birch','jungle','acacia','dark_oak',
      'mangrove','cherry','crimson','warped'
    ];
  }

  findWoodType(bot) {
    const plank = bot.inventory.items().find(i => i.name.endsWith('_planks'));
    if (plank) return plank.name.replace('_planks', '');
    const log = bot.inventory.items().find(i => i.name.endsWith('_log') || i.name.endsWith('_stem'));
    if (log) return log.name.replace(/_(log|stem)$/, '');
    return null;
  }

  isHostileEntity(entity) {
    if (!entity || !entity.name) return false;
    if (entity.type !== 'mob' && entity.type !== 'hostile') return false;
    return this.getHostileMobNames().has(entity.name);
  }

  isHuntableEntity(entity) {
    if (!entity || !entity.name) return false;
    if (entity.type !== 'mob') return false;
    if (!this.getPassiveMobNames().has(entity.name)) return false;
    // metadata[16] is baby flag in many mobs
    if (Array.isArray(entity.metadata) && entity.metadata[16] === true) return false;
    return true;
  }

  findNearestHostile(bot, maxDistance = 16) {
    return bot.nearestEntity(e => {
      if (!this.isHostileEntity(e)) return false;
      if (!bot.entity || !e.position) return false;
      return bot.entity.position.distanceTo(e.position) <= maxDistance;
    });
  }

  isNight(bot) {
    const time = bot.time?.timeOfDay;
    if (time == null) return false;
    return time >= 13000 && time <= 23000;
  }

  hasOtherPlayers(bot) {
    const players = bot?.players || {};
    return Object.values(players).some(p => p && p.entity && p.username && p.username !== bot.username);
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async performIdleAutonomy(botId, bot) {
    if (!this.can(botId, 'walking')) return;
    await this.withLock(botId, 'idle_wander', async () => {
      try {
        bot.setControlState('forward', true);
        if (Math.random() < 0.3) bot.setControlState('jump', true);
        await this.delay(1200 + Math.random() * 800);
      } catch (e) {
      } finally {
        try {
          bot.clearControlStates();
        } catch (e) {}
      }
    });
  }

  getMcDataForBot(bot) {
    try {
      return mcData(bot.version);
    } catch (e) {
      return null;
    }
  }

  countItem(bot, name) {
    return bot.inventory.items().reduce((sum, item) => sum + (item.name === name ? item.count : 0), 0);
  }

  hasItem(bot, name, count = 1) {
    return this.countItem(bot, name) >= count;
  }

  async equipBestWeapon(bot) {
    try {
      let weapons = bot.inventory.items().filter(item =>
        item.name.includes('sword') || (item.name.includes('axe') && !item.name.includes('pickaxe'))
      );
      if (weapons.length === 0) {
        weapons = bot.inventory.items().filter(item =>
          item.name.includes('pickaxe') || item.name.includes('shovel')
        );
      }
      if (weapons.length === 0) return;
      weapons.sort((a, b) => (b.attackDamage || 0) - (a.attackDamage || 0));
      await bot.equip(weapons[0], 'hand');
    } catch (e) {}
  }

  async handleHostile(botId, bot, hostile) {
    try {
      const botPos = bot.entity.position;
      const distance = botPos.distanceTo(hostile.position);
      const isCreeper = hostile.name === 'creeper';
      const lowHealth = bot.health !== undefined && bot.health <= 8;

      if (!this.can(botId, 'combat')) {
        if (this.can(botId, 'walking')) {
          const away = botPos.minus(hostile.position).normalize().scaled(10);
          const target = botPos.plus(away);
          try { bot.pathfinder.setGoal(new GoalNear(target.x, target.y, target.z, 1)); } catch (e) {}
        }
        return;
      }

      if (lowHealth || (isCreeper && distance < 6)) {
        const away = botPos.minus(hostile.position).normalize().scaled(10);
        const target = botPos.plus(away);
        try {
          bot.pathfinder.setGoal(new GoalNear(target.x, target.y, target.z, 1));
        } catch (e) {}
        return;
      }

      await this.equipBestWeapon(bot);
      try {
        bot.pathfinder.setGoal(new GoalNear(hostile.position.x, hostile.position.y, hostile.position.z, 2));
        if (distance <= 3) {
          if (bot.pvp && typeof bot.pvp.attack === 'function') {
            bot.pvp.attack(hostile);
          } else {
            bot.attack(hostile);
          }
        }
      } catch (e) {}
    } catch (e) {}
  }

  async tryAutoLight(bot) {
    try {
      const botId = this.findBotIdByInstance(bot);
      if (!this.can(botId, 'lighting')) return false;
      if (!this.isNight(bot)) return false;
      if (!this.hasItem(bot, 'torch', 1)) return false;
      const placed = await this.placeBlockNearby(bot, 'torch');
      return !!placed;
    } catch (e) {
      return false;
    }
  }

  async sleepIfNight(bot) {
    try {
      if (!this.isNight(bot)) return false;

      let bed = bot.findBlock({
        matching: block => block && block.name && block.name.includes('bed'),
        maxDistance: 16
      });

      if (!bed) {
        const bedItem = await this.ensureBedInInventory(bot);
        if (bedItem) {
          await this.placeBlockNearby(bot, bedItem.name);
          bed = bot.findBlock({
            matching: block => block && block.name && block.name.includes('bed'),
            maxDistance: 8
          });
        }
      }

      if (bed) {
        await bot.sleep(bed);
        return true;
      }
    } catch (e) {}
    return false;
  }

  async ensureBedInInventory(bot) {
    const existing = bot.inventory.items().find(i => i.name.endsWith('_bed'));
    if (existing) return existing;

    const woolColor = this.findBedWoolColor(bot);
    if (!woolColor) return null;
    await this.ensurePlanksAndSticks(bot);
    await this.craftItem(bot, `${woolColor}_bed`, 1);

    return bot.inventory.items().find(i => i.name.endsWith('_bed')) || null;
  }

  findBedWoolColor(bot) {
    const colors = [
      'white','orange','magenta','light_blue','yellow','lime','pink','gray',
      'light_gray','cyan','purple','blue','brown','green','red','black'
    ];
    for (const color of colors) {
      const count = this.countItem(bot, `${color}_wool`);
      if (count >= 3) return color;
    }
    return null;
  }

  async ensureSurvivalBasics(botId) {
    const botData = this.bots.get(botId);
    if (!botData || !botData.connected) return;
    const bot = botData.bot;

    return this.withLock(botId, 'survival_basics', async () => {
      await this.ensureInventorySpace(bot);

      // Night routine: try sleep; if not possible, place light
      const slept = await this.sleepIfNight(bot);
      if (!slept) {
        await this.tryAutoLight(bot);
      }

      // Eat if hungry and has food
      if (this.can(botId, 'eating') && bot.food !== undefined && bot.food < 16) {
        const ate = await this.tryEat(bot);
        if (!ate) {
          await this.huntForFood(bot);
        }
      }

      // Ensure tools and torches
      if (this.can(botId, 'crafting')) {
        await this.ensureAdvancedLoadout(botId);
      }

      // Ensure armor when possible
      if (this.can(botId, 'crafting')) {
        await this.ensureArmor(botId);
      }

      // Ensure shield if possible
      if (this.can(botId, 'crafting')) {
        await this.ensureShield(bot);
      }

      // Gather core resources if low
      await this.gatherCoreResources(bot);

      // Stash overflow if near full
      if (this.can(botId, 'crafting')) {
        await this.ensureChestAndStash(bot);
      }

      // Try smelting iron if possible (throttled)
      if (this.can(botId, 'smelting')) {
        const now = Date.now();
        if (now - botData.lastSmeltAt > 60000) {
          const smelted = await this.trySmeltIron(bot);
          if (smelted) botData.lastSmeltAt = now;
        }
      }
    });
  }

  async ensureAdvancedLoadout(botId) {
    const botData = this.bots.get(botId);
    if (!botData || !botData.connected) return;
    const bot = botData.bot;
    const data = this.getMcDataForBot(bot);
    if (!data) return;

    // Ensure crafting table
    await this.ensureCraftingTable(bot);

    // Ensure sticks/planks
    await this.ensurePlanksAndSticks(bot);

    // Ensure basic tools
    await this.ensureTool(bot, 'pickaxe');
    await this.ensureTool(bot, 'axe');
    await this.ensureTool(bot, 'sword');
    await this.ensureTool(bot, 'shovel');

    // Ensure torches if possible
    await this.ensureTorches(bot);
  }

  async tryEat(bot) {
    const botId = this.findBotIdByInstance(bot);
    if (!this.can(botId, 'eating')) return false;
    return this.withLock(botId, 'eat', async () => {
      try {
        const food = bot.inventory.items().find(i => i.food);
        if (!food) return false;
        await bot.equip(food, 'hand');
        await bot.consume();
        return true;
      } catch (e) {
        return false;
      }
    });
  }

  async ensureCraftingTable(bot) {
    const botId = this.findBotIdByInstance(bot);
    if (!this.can(botId, 'crafting')) return;
    return this.withLock(botId, 'crafting_table', async () => {
      if (this.hasItem(bot, 'crafting_table', 1)) return;
      await this.ensurePlanksAndSticks(bot);
      await this.craftItem(bot, 'crafting_table', 1);
    });
  }

  async ensurePlanksAndSticks(bot) {
    const botId = this.findBotIdByInstance(bot);
    if (!this.can(botId, 'crafting')) return;
    return this.withLock(botId, 'planks_sticks', async () => {
      const woodType = this.findWoodType(bot) || 'oak';
      const planksName = `${woodType}_planks`;
      const logName = woodType === 'crimson' || woodType === 'warped'
        ? `${woodType}_stem`
        : `${woodType}_log`;

      if (this.countItem(bot, planksName) < 8) {
        if (!this.hasItem(bot, logName, 1)) {
          // Avoid recursive crafting loop: gather initial logs without trying to craft tools
          await this.collectBlockByName(bot, logName, 16, { allowToolCraft: false });
        }
        await this.craftItem(bot, planksName, 8);
      }
      if (this.countItem(bot, 'stick') < 8) {
        await this.craftItem(bot, 'stick', 8);
      }
    });
  }

  async ensureTool(bot, toolType) {
    const botId = this.findBotIdByInstance(bot);
    if (!this.can(botId, 'crafting')) return;
    return this.withLock(botId, `tool_${toolType}`, async () => {
      if (this.hasItem(bot, `iron_${toolType}`, 1)) {
        await this.tryEquip(bot, `iron_${toolType}`);
        return;
      }

      const ironCost = toolType === 'sword' ? 2 : 3;
      if (this.countItem(bot, 'iron_ingot') >= ironCost) {
        await this.craftItem(bot, `iron_${toolType}`, 1);
        await this.tryEquip(bot, `iron_${toolType}`);
        return;
      }

      if (this.hasItem(bot, `stone_${toolType}`, 1)) {
        await this.tryEquip(bot, `stone_${toolType}`);
        return;
      }

      if (this.hasItem(bot, `wooden_${toolType}`, 1)) {
        await this.tryEquip(bot, `wooden_${toolType}`);
        return;
      }

      // Craft wooden tool first
      await this.ensurePlanksAndSticks(bot);
      await this.craftItem(bot, `wooden_${toolType}`, 1);
      await this.tryEquip(bot, `wooden_${toolType}`);

      // Then upgrade to stone if possible
      if (!this.hasItem(bot, 'cobblestone', 3)) {
        await this.collectBlockByName(bot, 'stone', 16, { allowToolCraft: false });
      }
      if (this.hasItem(bot, 'cobblestone', 3)) {
        await this.craftItem(bot, `stone_${toolType}`, 1);
        await this.tryEquip(bot, `stone_${toolType}`);
      }
    });
  }

  async tryEquip(bot, itemName) {
    try {
      const item = bot.inventory.items().find(i => i.name === itemName);
      if (item) {
        await bot.equip(item, 'hand');
      }
    } catch (e) {}
  }

  async ensureTorches(bot) {
    const botId = this.findBotIdByInstance(bot);
    if (!this.can(botId, 'crafting')) return;
    return this.withLock(botId, 'torches', async () => {
      const torchCount = this.countItem(bot, 'torch');
      if (torchCount >= 16) return;
      if (!this.hasItem(bot, 'coal', 1)) {
        await this.collectBlockByName(bot, 'coal_ore', 16, { allowToolCraft: false });
      }
      if (!this.hasItem(bot, 'stick', 1)) {
        await this.ensurePlanksAndSticks(bot);
      }
      await this.craftItem(bot, 'torch', 16);
    });
  }

  async ensureShield(bot) {
    const botId = this.findBotIdByInstance(bot);
    if (!this.can(botId, 'crafting')) return;
    return this.withLock(botId, 'shield', async () => {
      try {
        const existing = bot.inventory.items().find(i => i.name === 'shield');
        if (existing) {
          await bot.equip(existing, 'off-hand');
          return;
        }
        if (this.countItem(bot, 'iron_ingot') < 1) return;
        const planks = bot.inventory.items().filter(i => i.name.endsWith('_planks'))
          .reduce((sum, i) => sum + i.count, 0);
        if (planks < 6) {
          await this.ensurePlanksAndSticks(bot);
        }
        await this.craftItem(bot, 'shield', 1);
        const shield = bot.inventory.items().find(i => i.name === 'shield');
        if (shield) {
          await bot.equip(shield, 'off-hand');
        }
      } catch (e) {}
    });
  }

  async gatherCoreResources(bot) {
    const botId = this.findBotIdByInstance(bot);
    if (!this.can(botId, 'walking')) return;
    try {
      if (this.countItem(bot, 'oak_log') < 4) {
        await this.collectBlockByName(bot, 'oak_log', 24);
      }
      if (this.countItem(bot, 'cobblestone') < 16) {
        await this.collectBlockByName(bot, 'stone', 24);
      }
      if (this.countItem(bot, 'coal') < 4) {
        await this.collectBlockByName(bot, 'coal_ore', 24);
      }
      const ironTotal = this.countItem(bot, 'iron_ingot') +
        this.countItem(bot, 'raw_iron') +
        this.countItem(bot, 'iron_ore');
      if (ironTotal < 6) {
        await this.collectBlockByName(bot, 'iron_ore', 24);
      }
    } catch (e) {}
  }

  async basicVillagerTrade(bot) {
    const botId = this.findBotIdByInstance(bot);
    if (!this.can(botId, 'walking')) return false;
    try {
      const villager = bot.nearestEntity(e => e && e.name === 'villager' && e.type === 'mob');
      if (!villager || !villager.position) return false;

      await bot.pathfinder.goto(new GoalNear(villager.position.x, villager.position.y, villager.position.z, 2));

      const villagerWindow = await bot.openVillager(villager);
      const breadTrade = villagerWindow.trades.find(t => t.outputItem && t.outputItem.name === 'bread');
      const pickTrade = villagerWindow.trades.find(t => t.outputItem && t.outputItem.name === 'iron_pickaxe');
      const axeTrade = villagerWindow.trades.find(t => t.outputItem && t.outputItem.name === 'iron_axe');
      const trade = breadTrade || pickTrade || axeTrade || villagerWindow.trades[0];
      if (!trade) { villagerWindow.close(); return false; }

      await villagerWindow.trade(trade);
      villagerWindow.close();
      return true;
    } catch (e) {
      return false;
    }
  }

  async buildQuickShelter(bot) {
    const botId = this.findBotIdByInstance(bot);
    if (!this.can(botId, 'building')) return false;
    try {
      const material = this.hasItem(bot, 'dirt', 20) ? 'dirt' : 'oak_planks';
      if (!this.hasItem(bot, material, 20)) {
        if (material === 'oak_planks') {
          await this.ensurePlanksAndSticks(bot);
        } else {
          await this.collectBlockByName(bot, 'dirt', 24);
        }
      }
      if (!this.hasItem(bot, 'torch', 1)) {
        await this.ensureTorches(bot);
      }
      if (!this.hasItem(bot, 'door', 1) && this.countItem(bot, 'oak_planks') >= 6) {
        await this.craftItem(bot, 'oak_door', 1);
      }

      const base = bot.entity.position.floored();
      const blocks = [];
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          blocks.push({ pos: base.offset(dx, -1, dz), name: material });
          blocks.push({ pos: base.offset(dx, 2, dz), name: material });
        }
      }
      const wallCoords = [
        [-1,0],[0,-1],[1,0],[0,1],[-1,1],[1,1],[-1,-1],[1,-1]
      ];
      for (const [dx,dz] of wallCoords) {
        blocks.push({ pos: base.offset(dx,0,dz), name: material });
        blocks.push({ pos: base.offset(dx,1,dz), name: material });
      }

      for (const b of blocks) {
        await this.placeSpecificBlock(bot, b.name, b.pos);
      }

      const doorItem = bot.inventory.items().find(i => i.name.endsWith('_door'));
      if (doorItem) {
        await this.placeSpecificBlock(bot, doorItem.name, base.offset(0,0,-1));
      }

      await this.placeSpecificBlock(bot, 'torch', base.offset(0,0,0));
      return true;
    } catch (e) {
      return false;
    }
  }

  async placeSpecificBlock(bot, itemName, targetPos) {
    const botId = this.findBotIdByInstance(bot);
    if (!this.can(botId, 'building')) return false;
    try {
      const item = bot.inventory.items().find(i => i.name === itemName);
      if (!item) return false;
      const below = bot.blockAt(targetPos.offset(0, -1, 0));
      if (!below || below.boundingBox !== 'block') return false;
      const targetBlock = bot.blockAt(targetPos);
      if (targetBlock && targetBlock.name !== 'air') return true;
      await bot.equip(item, 'hand');
      await bot.placeBlock(below, targetPos.minus(below.position));
      return true;
    } catch (e) {
      return false;
    }
  }

  async ensureChestAndStash(bot) {
    const botId = this.findBotIdByInstance(bot);
    if (!this.can(botId, 'crafting')) return;
    try {
      const emptySlots = bot.inventory.slots.filter(slot => slot == null).length;
      if (emptySlots > 3) return;

      // Ensure chest item
      if (!this.hasItem(bot, 'chest', 1)) {
        const plankTotal = bot.inventory.items().filter(i => i.name.endsWith('_planks')).reduce((s, i) => s + i.count, 0);
        if (plankTotal < 8) {
          await this.ensurePlanksAndSticks(bot);
        }
        await this.craftItem(bot, 'chest', 1);
      }

      // Place chest nearby
      const placed = await this.placeBlockNearby(bot, 'chest');
      if (!placed) return;

      const chestBlock = bot.findBlock({ matching: blk => blk && blk.name === 'chest', maxDistance: 5 });
      if (!chestBlock) return;

      const chest = await bot.openChest(chestBlock);
      const stashList = bot.inventory.items().filter(i => this.isStashCandidate(i.name));
      for (const item of stashList) {
        try { await chest.deposit(item.type, null, item.count); } catch (e) {}
      }
      chest.close();
    } catch (e) {}
  }

  isStashCandidate(name) {
    const keep = ['pickaxe','axe','sword','shovel','shield','helmet','chestplate','leggings','boots','food','torch','coal','charcoal','iron','raw_iron','furnace','crafting_table','bed','bow','arrow'];
    if (keep.some(k => name.includes(k))) return false;
    return true;
  }

  async equipToolForBlock(bot, blockName, allowToolCraft = true) {
    try {
      if (!blockName) return;
      if (blockName.includes('log') || blockName.includes('wood')) {
        if (!allowToolCraft) {
          const existing = bot.inventory.items().find(i => i.name.endsWith('_axe'));
          if (existing) { await bot.equip(existing, 'hand'); }
          return;
        }
        await this.ensureTool(bot, 'axe');
        return;
      }
      if (blockName.includes('stone') || blockName.includes('ore')) {
        if (!allowToolCraft) {
          const existing = bot.inventory.items().find(i => i.name.endsWith('_pickaxe'));
          if (existing) { await bot.equip(existing, 'hand'); }
          return;
        }
        await this.ensureTool(bot, 'pickaxe');
        return;
      }
      if (blockName.includes('dirt') || blockName.includes('sand') || blockName.includes('gravel')) {
        if (!allowToolCraft) {
          const existing = bot.inventory.items().find(i => i.name.endsWith('_shovel'));
          if (existing) { await bot.equip(existing, 'hand'); }
          return;
        }
        await this.ensureTool(bot, 'shovel');
        return;
      }
    } catch (e) {}
  }

  async collectBlockByName(bot, blockName, maxDistance = 32, opts = {}) {
    const { allowToolCraft = true } = opts;
    const botId = this.findBotIdByInstance(bot);
    if (!this.can(botId, 'walking')) return;
    return this.withLock(botId, `collect_${blockName}`, async () => {
      try {
        if (!bot.collectBlock || !bot.collectBlock.collect) return;
        await this.equipToolForBlock(bot, blockName, allowToolCraft);
        const data = this.getMcDataForBot(bot);
        if (!data) return;
        const blockId = data.blocksByName[blockName]?.id;
        if (!blockId) return;
        const block = bot.findBlock({ matching: blockId, maxDistance });
        if (!block) return;
        await bot.collectBlock.collect(block);
      } catch (e) {}
    });
  }

  findSmeltingFuel(bot) {
    const preferred = ['coal', 'charcoal', 'coal_block', 'blaze_rod', 'lava_bucket'];
    for (const name of preferred) {
      const item = bot.inventory.items().find(i => i.name === name);
      if (item) return item;
    }
    const fallback = bot.inventory.items().find(i => i.name.includes('log') || i.name.includes('planks'));
    return fallback || null;
  }

  async craftItem(bot, itemName, count = 1) {
    const botId = this.findBotIdByInstance(bot);
    if (!this.can(botId, 'crafting')) return false;
    try {
      const data = this.getMcDataForBot(bot);
      if (!data) return;
      const itemId = data.itemsByName[itemName]?.id;
      if (!itemId) return;
      let table = null;
      let recipes = bot.recipesFor(itemId, null, 1, null);
      if (!recipes || recipes.length === 0) {
        table = await this.ensurePlacedCraftingTable(bot);
        if (!table) return false;
        recipes = bot.recipesFor(itemId, null, 1, table);
      }
      if (!recipes || recipes.length === 0) return false;
      const recipe = recipes[0];
      await bot.craft(recipe, count, table);

      if (bot.armorManager && typeof bot.armorManager.equipAll === 'function') {
        bot.armorManager.equipAll();
      }
      return true;
    } catch (e) {}
  }

  async ensurePlacedCraftingTable(bot) {
    const data = this.getMcDataForBot(bot);
    if (!data) return null;

    const existing = bot.findBlock({
      matching: data.blocksByName.crafting_table?.id,
      maxDistance: 4
    });
    if (existing) return existing;

    if (!this.hasItem(bot, 'crafting_table', 1)) {
      await this.ensureCraftingTable(bot);
    }
    const placed = await this.placeBlockNearby(bot, 'crafting_table');
    if (!placed) return null;

    return bot.findBlock({
      matching: data.blocksByName.crafting_table?.id,
      maxDistance: 4
    });
  }

  async placeBlockNearby(bot, itemName) {
    const botId = this.findBotIdByInstance(bot);
    if (!this.can(botId, 'building')) return false;
    try {
      const item = bot.inventory.items().find(i => i.name === itemName);
      if (!item) return false;

      const basePos = bot.entity.position.floored();
      const offsets = [
        [1, 0], [-1, 0], [0, 1], [0, -1],
        [1, 1], [1, -1], [-1, 1], [-1, -1]
      ];

      let reference = null;
      for (const [dx, dz] of offsets) {
        const target = basePos.offset(dx, 0, dz);
        const below = bot.blockAt(target.offset(0, -1, 0));
        const targetBlock = bot.blockAt(target);
        if (!below || !targetBlock) continue;
        if (below.boundingBox !== 'block') continue;
        if (targetBlock.boundingBox !== 'empty') continue;
        reference = below;
        break;
      }

      if (!reference) return false;
      await bot.equip(item, 'hand');
      await bot.placeBlock(reference, new Vec3(0, 1, 0));
      return true;
    } catch (e) {
      return false;
    }
  }

  async ensureInventorySpace(bot) {
    const botId = this.findBotIdByInstance(bot);
    if (!this.can(botId, 'inventory')) return;
    try {
      const emptySlots = bot.inventory.slots.filter(slot => slot == null).length;
      if (emptySlots > 2) return;
      const junk = this.getJunkItemNames();
      for (const item of bot.inventory.items()) {
        if (junk.has(item.name)) {
          await bot.tossStack(item);
        }
      }
    } catch (e) {}
  }

  async huntForFood(bot) {
    try {
      const target = bot.nearestEntity(e => this.isHuntableEntity(e));
      if (!target || !target.position) return false;
      await this.equipBestWeapon(bot);
      await bot.pathfinder.goto(new GoalNear(target.position.x, target.position.y, target.position.z, 1));
      if (bot.pvp && typeof bot.pvp.attack === 'function') {
        bot.pvp.attack(target);
      } else {
        bot.attack(target);
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  async ensureArmor(botId) {
    const botData = this.bots.get(botId);
    if (!botData || !botData.connected) return;
    const bot = botData.bot;
    return this.withLock(botId, 'armor', async () => {
      const pieces = [
        { name: 'iron_helmet', slot: 'head', cost: 5 },
        { name: 'iron_chestplate', slot: 'torso', cost: 8 },
        { name: 'iron_leggings', slot: 'legs', cost: 7 },
        { name: 'iron_boots', slot: 'feet', cost: 4 }
      ];

      let ingots = this.countItem(bot, 'iron_ingot');
      for (const piece of pieces) {
        if (!this.hasItem(bot, piece.name, 1) && ingots >= piece.cost) {
          await this.craftItem(bot, piece.name, 1);
          ingots = this.countItem(bot, 'iron_ingot');
        }
        await this.tryEquipArmor(bot, piece.name, piece.slot);
      }

      if (bot.armorManager && typeof bot.armorManager.equipAll === 'function') {
        bot.armorManager.equipAll();
      }
    });
  }

  async tryEquipArmor(bot, itemName, destination) {
    try {
      const item = bot.inventory.items().find(i => i.name === itemName);
      if (item) {
        await bot.equip(item, destination);
      }
    } catch (e) {}
  }

  async trySmeltIron(bot) {
    const botId = this.findBotIdByInstance(bot);
    if (!this.can(botId, 'smelting')) return false;
    try {
      const data = this.getMcDataForBot(bot);
      if (!data) return false;
      const rawIron = this.countItem(bot, 'raw_iron') + this.countItem(bot, 'iron_ore');
      if (rawIron <= 0) return false;

      const fuelItem = this.findSmeltingFuel(bot);
      if (!fuelItem) return false;

      // Ensure furnace
      let furnaceBlock = bot.findBlock({ matching: data.blocksByName.furnace?.id, maxDistance: 4 });
      if (!furnaceBlock) {
        if (!this.hasItem(bot, 'furnace', 1)) {
          if (!this.hasItem(bot, 'cobblestone', 8)) {
            await this.collectBlockByName(bot, 'stone', 16);
          }
          await this.craftItem(bot, 'furnace', 1);
        }
        await this.placeBlockNearby(bot, 'furnace');
        furnaceBlock = bot.findBlock({ matching: data.blocksByName.furnace?.id, maxDistance: 4 });
      }
      if (!furnaceBlock) return false;

      const furnace = await bot.openFurnace(furnaceBlock);
      const inputItem = bot.inventory.items().find(i => i.name === 'raw_iron' || i.name === 'iron_ore');
      if (!inputItem) {
        furnace.close();
        return false;
      }
      await furnace.putInput(inputItem.type, Math.min(inputItem.count, 16));
      await furnace.putFuel(fuelItem.type, Math.min(fuelItem.count, 16));
      // Wait a bit for smelting
      await new Promise(resolve => setTimeout(resolve, 6000));
      try { await furnace.takeOutput(); } catch (e) {}
      furnace.close();
      return true;
    } catch (e) {
      return false;
    }
  }

  async disconnectBot(botId) {
    const botData = this.bots.get(botId);
    if (!botData) {
      return { success: false, error: 'Bot not found' };
    }

    try {
      botData.bot.chat('Goodbye!');
      botData.bot.end();
      this.stopViewer(botId);
      this.bots.delete(botId);
      return { success: true, message: 'Bot disconnected' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  getBotStatus(botId) {
    const botData = this.bots.get(botId);
    if (!botData) {
      return { connected: false, error: 'Bot not found' };
    }

    const bot = botData.bot;
    return {
      connected: botData.connected,
      spawned: botData.spawned,
      username: botData.username,
      server: `${botData.serverHost}:${botData.serverPort}`,
      position: bot.entity ? bot.entity.position : null,
      health: bot.health,
      food: bot.food,
      currentTask: botData.currentTask
    };
  }

  async checkPlayerOnline(botId, playerName) {
    const botData = this.bots.get(botId);
    if (!botData || !botData.connected) {
      return { online: false, error: 'Bot not connected' };
    }

    const bot = botData.bot;
    const player = bot.players[playerName];
    
    return {
      online: !!(player && player.entity),
      playerName,
      distance: player && player.entity && bot.entity 
        ? bot.entity.position.distanceTo(player.entity.position) 
        : null
    };
  }

  async getNearbyPlayers(botId) {
    const botData = this.bots.get(botId);
    if (!botData || !botData.connected) {
      return { success: false, error: 'Bot not connected' };
    }

    const bot = botData.bot;
    const players = Object.values(bot.players)
      .filter(p => p.username !== bot.username && p.entity)
      .map(p => ({
        username: p.username,
        distance: bot.entity.position.distanceTo(p.entity.position),
        position: p.entity.position
      }));

    return { success: true, players };
  }

  notifyRenderer(eventName, data) {
    try {
      if (!this.mainWindow || this.mainWindow.isDestroyed()) return;
      const wc = this.mainWindow.webContents;
      if (!wc || wc.isDestroyed()) return;
      wc.send('mineflayer-bot-event', {
        event: eventName,
        data
      });
    } catch (e) {
      // Avoid crashing if window was closed/destroyed mid-send
      console.error('[MineflayerBot] notifyRenderer failed:', e.message);
    }
  }

  async toggleViewer(botId, enabled) {
    try {
      const botData = this.bots.get(botId);
      if (!botData || !botData.connected) return { success: false, error: 'Bot not connected' };

      if (!viewer) {
        try {
          viewer = require('prismarine-viewer').mineflayer;
        } catch (e) {
          return { success: false, error: 'prismarine-viewer not installed' };
        }
      }

      if (!enabled) {
        this.stopViewer(botId);
        return { success: true, enabled: false };
      }

      const port = 3007;
      this.stopViewer(botId);
      const server = viewer(botData.bot, { port, firstPerson: true, viewDistance: 6 });
      this.viewerServers.set(botId, server);
      return { success: true, enabled: true, port };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  stopViewer(botId) {
    const server = this.viewerServers.get(botId);
    if (server && server.close) {
      try { server.close(); } catch (e) {}
    }
    this.viewerServers.delete(botId);
  }

  disconnectAll() {
    console.log('[MineflayerBot] Disconnecting all bots...');
    for (const [botId, botData] of this.bots) {
      try {
        botData.bot.end();
      } catch (e) {
        console.error(`[MineflayerBot] Error disconnecting bot ${botId}:`, e);
      }
    }
    this.bots.clear();
  }
}

module.exports = MineflayerBotManager;
