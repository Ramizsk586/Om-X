/**
 * MinecraftBotManager
 * DEPRECATED - Java Edition AI Player now uses MineflayerBotManager instead
 * This file is kept for reference only - bedrock-protocol has been removed
 */

const { ipcMain } = require('electron');

class MinecraftBotManager {
  constructor() {
    this.bots = new Map();
    this.mainWindow = null;
    this.isAvailable = false;
    console.log('[MinecraftBot] Bedrock Edition support has been removed. Use MineflayerBotManager for Java Edition.');
    this.setupIPCHandlers();
  }

  setMainWindow(window) {
    this.mainWindow = window;
  }

  setupIPCHandlers() {
    ipcMain.handle('minecraft-bot:connect', async (event, config) => {
      return {
        success: false,
        error: 'Bedrock Edition support has been removed. Please use Java Edition with MineflayerBotManager.'
      };
    });

    ipcMain.handle('minecraft-bot:disconnect', async (event, botId) => {
      return { success: false, error: 'Bedrock Edition support has been removed.' };
    });

    ipcMain.handle('minecraft-bot:chat', async (event, { botId, message }) => {
      return { success: false, error: 'Bedrock Edition support has been removed.' };
    });

    ipcMain.handle('minecraft-bot:command', async (event, { botId, command }) => {
      return { success: false, error: 'Bedrock Edition support has been removed.' };
    });

    ipcMain.handle('minecraft-bot:status', async (event, botId) => {
      return { connected: false, error: 'Bedrock Edition support has been removed.' };
    });

    ipcMain.handle('minecraft-bot:check-player', async (event, { botId, playerName }) => {
      return { online: false, error: 'Bedrock Edition support has been removed.' };
    });
  }

  async connectBot(config) {
    return {
      success: false,
      error: 'Bedrock Edition support has been removed. Please use Java Edition with MineflayerBotManager.'
    };
  }

  async disconnectBot(botId) {
    return { success: false, error: 'Bedrock Edition support has been removed.' };
  }

  async sendChat(botId, message) {
    return { success: false, error: 'Bedrock Edition support has been removed.' };
  }

  async executeCommand(botId, command) {
    return { success: false, error: 'Bedrock Edition support has been removed.' };
  }

  getBotStatus(botId) {
    return { connected: false, error: 'Bedrock Edition support has been removed.' };
  }

  async checkPlayerOnline(botId, playerName) {
    return { online: false, error: 'Bedrock Edition support has been removed.' };
  }

  notifyRenderer(eventName, data) {}

  disconnectAll() {}
}

module.exports = MinecraftBotManager;
