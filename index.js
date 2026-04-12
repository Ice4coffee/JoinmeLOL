const express = require("express");
const { Telegraf } = require("telegraf");
const mineflayer = require("mineflayer");

// ===================== CONFIG =====================
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = "8322294514"; // Твой ID
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

function log(msg) {
  const message = `[LOG ${new Date().toISOString()}] ${msg}`;
  console.log(message);
  // Опционально: слать важные логи в ТГ
  if (msg.includes("login") || msg.includes("kicked")) {
    bot.telegram.sendMessage(CHAT_ID, message).catch(() => {});
  }
}

// ===================== MC BOT =====================
function createMC() {
  if (cooldown) return;

  log(`🚀 Подключение к MC → ${HOST}`);

  mcBot = mineflayer.createBot({
    host: HOST,
    port: MC_PORT,
    username: "AgeraJoinMe",
    version: "1.8.9",
    // ГЛАВНОЕ ИСПРАВЛЕНИЕ: Отключаем блоки, чтобы не было ошибки sourceStart
    plugins: {
      blocks: false,
      physics: false,
      inventory: false
    }
  });

  mcBot.on("login", () => {
    log("✅ Бот зашел на сервер!");
    reconnectAttempts = 0;
  });

  mcBot.on("chat", (username, message) => {
    if (username === mcBot.username) return;
    bot.telegram.sendMessage(CHAT_ID, `💬 [${username}]: ${message}`).catch(() => {});
  });

  mcBot.on("kicked", (reason) => {
    log(`❌ Кикнут: ${reason}`);
    scheduleReconnect();
  });

  mcBot.on("error", (err) => {
    log(`⚠️ Ошибка: ${err.message}`);
    if (err.message.includes("sourceStart")) {
      activateCooldown();
    } else {
      scheduleReconnect();
    }
  });

  mcBot.on("end", () => {
    log("🔌 Отключено");
    scheduleReconnect();
  });
}

function activateCooldown() {
  if (cooldown) return;
  log("💀 Критическая ошибка пакетов. Спим 60 сек...");
  cooldown = true;
  if (mcBot) try { mcBot.quit(); } catch {}
  
  setTimeout(() => {
    cooldown = false;
    reconnectAttempts = 0;
    createMC();
  }, 60000);
}

function scheduleReconnect() {
  if (cooldown) return;
  reconnectAttempts++;
  const delay = Math.min(5000 * reconnectAttempts, 30000);
  log(`🔁 Реконнект через ${delay/1000} сек...`);
  setTimeout(createMC, delay);
}

// ===================== TELEGRAM & WEB =====================
app.get("/", (req, res) => res.send("Bot is Running"));
app.use(bot.webhookCallback(`/bot${BOT_TOKEN}`));

bot.start((ctx) => ctx.reply("Бот телеметрии запущен!"));
bot.command("go", (ctx) => {
  ctx.reply("Перезапуск MC клиента...");
  if (mcBot) try { mcBot.quit(); } catch {}
  setTimeout(createMC, 2000);
});

// Глобальный перехват, чтобы процесс не умирал
process.on('uncaughtException', (err) => {
  console.error('CRITICAL UNCAUGHT ERROR:', err);
  if (err.message.includes('sourceStart')) {
    activateCooldown();
  }
});

async function start() {
  if (PUBLIC_URL) {
    const url = `${PUBLIC_URL}/bot${BOT_TOKEN}`;
    await bot.telegram.setWebhook(url);
    log(`📡 Webhook установлен: ${url}`);
  }
  
  app.listen(PORT, () => {
    log(`🖥️ Сервер на порту ${PORT}`);
    createMC();
  });
}

start();
