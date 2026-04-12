const express = require("express");
const { Telegraf } = require("telegraf");
const mineflayer = require("mineflayer");

// ===================== ENV =====================
const BOT_TOKEN = process.env.BOT_TOKEN;
const PORT = process.env.PORT || 3000;
const HOST = process.env.MC_HOST || "production.agerapvp.club";
const MC_PORT = process.env.MC_PORT || 25565;
const PUBLIC_URL = process.env.PUBLIC_URL; // Railway URL

if (!BOT_TOKEN) {
  console.log("[FATAL] BOT_TOKEN not set");
  process.exit(1);
}

// ===================== TELEGRAM =====================
const bot = new Telegraf(BOT_TOKEN);

// ===================== EXPRESS (WEBHOOK) =====================
const app = express();
app.use(express.json());

// healthcheck
app.get("/", (req, res) => res.send("OK"));

// ===================== STATE =====================
let mcBot = null;
let reconnectAttempts = 0;
let cooldown = false;
let lastCrashTime = 0;

// ===================== LOG =====================
function log(msg) {
  console.log(`[LOG ${new Date().toISOString()}] ${msg}`);
}

// ===================== SAFE WEBHOOK =====================
async function setupWebhook() {
  try {
    if (!PUBLIC_URL) {
      log("❌ PUBLIC_URL missing → fallback to polling disabled webhook");
      return;
    }

    const url = `${PUBLIC_URL}/bot${BOT_TOKEN}`;

    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    await bot.telegram.setWebhook(url);

    log(`Webhook set → ${url}`);
  } catch (e) {
    log(`Webhook error: ${e.message}`);
  }
}

// ===================== MC SAFE CONNECT =====================
function createMC() {
  if (cooldown) {
    log("⏳ cooldown active → skip MC connect");
    return;
  }

  log(`MC connect → ${HOST}:${MC_PORT}`);

  mcBot = mineflayer.createBot({
    host: HOST,
    port: MC_PORT,
    username: "AgeraJoinMe",
    version: "1.8.9"
  });

  // ================= EVENTS =================

  mcBot.on("login", () => {
    log("MC login");
    reconnectAttempts = 0;
  });

  mcBot.on("kicked", (reason) => {
    log(`MC kicked: ${reason}`);

    if (Date.now() - lastCrashTime < 5000) {
      log("💀 HARD CHUNK CRASH → cooldown 60s");
      cooldown = true;

      setTimeout(() => {
        cooldown = false;
        reconnectAttempts = 0;
        createMC();
      }, 60000);

      return;
    }

    scheduleReconnect(reason);
  });

  mcBot.on("error", (err) => {
    log(`MC error: ${err.message}`);
    scheduleReconnect(err.message);
  });

  mcBot.on("end", () => {
    log("MC disconnected");
    scheduleReconnect("end");
  });

  // ================= CHUNK CRASH PROTECTION =================
  mcBot._client?.on("packet", (data, meta) => {
    try {
      // detect chunk spam / invalid packets
      if (meta?.name === "map_chunk" && data?.x === undefined) {
        return;
      }
    } catch {}
  });

  mcBot._client?.on("error", (e) => {
    if (String(e).includes("sourceStart")) {
      log("💥 Chunk crash detected");

      lastCrashTime = Date.now();
      mcBot.quit();

      cooldown = true;
      setTimeout(() => {
        cooldown = false;
        createMC();
      }, 60000);
    }
  });
}

// ================= RECONNECT LOGIC =================
function scheduleReconnect(reason) {
  if (cooldown) return;

  reconnectAttempts++;

  const delay = Math.min(3000 * reconnectAttempts, 30000);

  log(`🔁 reconnect (${reason}) in ${delay}ms`);

  setTimeout(() => {
    createMC();
  }, delay);
}

// ================= TELEGRAM =================
bot.start((ctx) => {
  ctx.reply("Bot online");
});

// command example
bot.command("go", (ctx) => {
  const arg = ctx.message.text.split(" ")[1];

  ctx.reply(`🪵 MC connect → ${arg || "default"}`);

  if (mcBot) {
    try {
      mcBot.quit();
    } catch {}
  }

  setTimeout(() => {
    createMC();
  }, 1000);
});

// ================= WEBHOOK ROUTE =================
app.use(bot.webhookCallback(`/bot${BOT_TOKEN}`));

// ================= START =================
async function start() {
  await setupWebhook();

  app.listen(PORT, () => {
    log(`Server started on ${PORT}`);
  });

  createMC();
}

start();
