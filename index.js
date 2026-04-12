const express = require("express");
const { Telegraf } = require("telegraf");
const mineflayer = require("mineflayer");

// ===================== CONFIG =====================
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = "8322294514"; 
const PORT = process.env.PORT || 3000;
const HOST = process.env.MC_HOST || "production.agerapvp.club";
const MC_PORT = process.env.MC_PORT || 25565;
const PUBLIC_URL = process.env.PUBLIC_URL;

if (!BOT_TOKEN) {
  console.log("[FATAL] BOT_TOKEN not set");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const app = express();
app.use(express.json());

// ===================== STATE =====================
let mcBot = null;
let reconnectAttempts = 0;
let cooldown = false;
let isConnecting = false; // Защита от дабл-коннекта

function log(msg) {
  const message = `[LOG ${new Date().toISOString()}] ${msg}`;
  console.log(message);
  if (msg.includes("✅") || msg.includes("❌")) {
    bot.telegram.sendMessage(CHAT_ID, message).catch(() => {});
  }
}

// ===================== MC BOT =====================
function createMC() {
  if (cooldown || isConnecting) return;
  
  // Если старый бот еще существует, принудительно закрываем
  if (mcBot) {
    try { mcBot.quit(); } catch {}
    mcBot = null;
  }

  isConnecting = true;
  log(`🚀 Попытка входа на ${HOST}...`);

  mcBot = mineflayer.createBot({
    host: HOST,
    port: MC_PORT,
    username: "AgeraJoinMe",
    version: "1.8.9",
    plugins: {
      blocks: false,
      physics: false,
      inventory: false
    }
  });

  // Используем .once чтобы событие не дублировалось при ошибках
  mcBot.once("login", () => {
    isConnecting = false;
    log("✅ Бот успешно зашел на сервер!");
    reconnectAttempts = 0;
  });

  mcBot.on("chat", (username, message) => {
    if (username === mcBot.username) return;
    bot.telegram.sendMessage(CHAT_ID, `💬 [${username}]: ${message}`).catch(() => {});
  });

  mcBot.once("kicked", (reason) => {
    isConnecting = false;
    log(`❌ Кикнут: ${reason}`);
    scheduleReconnect();
  });

  mcBot.once("error", (err) => {
    isConnecting = false;
    log(`⚠️ Ошибка: ${err.message}`);
    if (err.message.includes("sourceStart")) {
      activateCooldown();
    } else {
      scheduleReconnect();
    }
  });

  mcBot.once("end", () => {
    isConnecting = false;
    log("🔌 Соединение разорвано (end)");
    scheduleReconnect();
  });
}

function activateCooldown() {
  if (cooldown) return;
  cooldown = true;
  isConnecting = false;
  log("💀 Критическая ошибка пакетов. Спим 60 сек...");
  
  if (mcBot) {
    try { mcBot.quit(); } catch {}
    mcBot = null;
  }
  
  setTimeout(() => {
    cooldown = false;
    reconnectAttempts = 0;
    createMC();
  }, 60000);
}

function scheduleReconnect() {
  if (cooldown || isConnecting) return;
  
  reconnectAttempts++;
  const delay = Math.min(5000 * reconnectAttempts, 30000);
  log(`🔁 Реконнект через ${delay/1000} сек...`);
  
  setTimeout(createMC, delay);
}

// ===================== TELEGRAM & WEB =====================
app.get("/", (req, res) => res.send("Bot is Running"));
app.use(bot.webhookCallback(`/bot${BOT_TOKEN}`));

bot.start((ctx) => ctx.reply("Бот телеметрии активен."));

bot.command("go", (ctx) => {
  ctx.reply("🔄 Перезагрузка Minecraft сессии...");
  isConnecting = false;
  cooldown = false;
  createMC();
});

// Глобальная защита процесса
process.on('uncaughtException', (err) => {
  if (err.message.includes('sourceStart')) {
    activateCooldown();
  } else {
    console.error('Unhandled Exception:', err);
  }
});

async function start() {
  if (PUBLIC_URL) {
    await bot.telegram.setWebhook(`${PUBLIC_URL}/bot${BOT_TOKEN}`);
    log(`📡 Webhook настроен`);
  }
  
  app.listen(PORT, () => {
    log(`🖥️ Сервер запущен на порту ${PORT}`);
    createMC();
  });
}

start();
