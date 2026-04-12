const express = require("express");
const { Telegraf } = require("telegraf");
const mineflayer = require("mineflayer");

// ===================== CONFIG =====================
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = "8322294514"; 
const MC_PASSWORD = process.env.MC_PASSWORD || "ВАШ_ПАРОЛЬ"; // Укажи пароль тут или в Railway
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
let isConnecting = false;

function log(msg) {
  const message = `[LOG ${new Date().toISOString()}] ${msg}`;
  console.log(message);
  if (msg.includes("✅") || msg.includes("❌") || msg.includes("🔑")) {
    bot.telegram.sendMessage(CHAT_ID, message).catch(() => {});
  }
}

// ===================== MC BOT =====================
function createMC() {
  if (cooldown || isConnecting) return;
  
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

  mcBot.once("login", () => {
    isConnecting = false;
    log("✅ Бот успешно зашел на сервер!");
    reconnectAttempts = 0;
  });

  mcBot.on("chat", (username, message) => {
    if (username === mcBot.username) return;

    const msg = message.toLowerCase();
    // Логика авто-логина
    if (msg.includes("/login") || msg.includes("авторизуйтесь") || msg.includes("войдите")) {
      log("🔑 Обнаружен запрос логина. Отправляю пароль...");
      mcBot.chat(`/login ${MC_PASSWORD}`);
    }

    // Пересылка чата в Telegram
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
    log("🔌 Соединение разорвано");
    scheduleReconnect();
  });
}

function activateCooldown() {
  if (cooldown) return;
  cooldown = true;
  isConnecting = false;
  log("💀 Ошибка чанков. Режим ожидания 60 сек...");
  if (mcBot) try { mcBot.quit(); } catch {}
  setTimeout(() => {
    cooldown = false;
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
app.get("/", (req, res) => res.send("MC-TG Bridge is Online"));
app.use(bot.webhookCallback(`/bot${BOT_TOKEN}`));

bot.start((ctx) => ctx.reply("Бот активен. Пиши текст, чтобы отправить в игру."));

// Команда ручного перезапуска
bot.command("go", (ctx) => {
  ctx.reply("🔄 Перезагрузка сессии...");
  isConnecting = false;
  cooldown = false;
  createMC();
});

// Отправка сообщений из TG в MC чат
bot.on("text", (ctx) => {
  if (ctx.from.id.toString() !== CHAT_ID) return;
  if (ctx.message.text.startsWith("/")) return;

  if (mcBot && mcBot.entity) {
    mcBot.chat(ctx.message.text);
    ctx.reply(`📤 В игре: ${ctx.message.text}`);
  } else {
    ctx.reply("⚠️ Бот не на сервере.");
  }
});

// Глобальный перехват
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
    log(`📡 Webhook активирован`);
  }
  
  app.listen(PORT, () => {
    log(`🖥️ Сервер запущен на порту ${PORT}`);
    createMC();
  });
}

start();
