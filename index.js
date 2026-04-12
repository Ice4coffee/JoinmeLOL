const express = require("express");
const mineflayer = require("mineflayer");
const { Telegraf } = require("telegraf");

/* ================= ENV ================= */
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

const PORT = process.env.PORT || 3000;

const MC_HOST = process.env.MC_HOST;
const MC_PORT = Number(process.env.MC_PORT || 25565);
const MC_USER = process.env.MC_USER || "Bot";
const MC_PASSWORD = process.env.MC_PASSWORD || "";
const MC_VERSION = process.env.MC_VERSION || "1.8.9";

/* ================= CHECK ================= */
if (!BOT_TOKEN || !MC_HOST) {
  throw new Error("Missing BOT_TOKEN or MC_HOST");
}

/* ================= TELEGRAM ================= */
const bot = new Telegraf(BOT_TOKEN);

/* ================= EXPRESS ================= */
const app = express();
app.use(express.json());

app.get("/", (_, res) => res.send("OK"));

app.use(bot.webhookCallback(`/bot${BOT_TOKEN}`));

app.listen(PORT, async () => {
  log("Server started on " + PORT);

  const base = process.env.WEBHOOK_URL;
  if (!base) return log("WEBHOOK_URL missing");

  const url = `${base}/bot${BOT_TOKEN}`;

  try {
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    await bot.telegram.setWebhook(url);
    log("Webhook set → " + url);
  } catch (e) {
    log("Webhook error: " + e.message);
  }

  startMC();
});

/* ================= LOG ================= */
function log(msg) {
  console.log("[LOG]", msg);
  if (CHAT_ID) bot.telegram.sendMessage(CHAT_ID, "🪵 " + msg).catch(() => {});
}

/* ================= MC STATE ================= */
let mc = null;
let reconnects = 0;
let lastCode = "hub";
let crashLock = false;

/* ================= START MC ================= */
function startMC(code = "hub") {
  lastCode = code;

  if (mc) {
    try { mc.quit(); } catch {}
    mc = null;
  }

  log(`MC connect → ${MC_HOST}:${MC_PORT}`);

  mc = mineflayer.createBot({
    host: MC_HOST,
    port: MC_PORT,
    username: MC_USER,
    version: MC_VERSION,
    viewDistance: 2, // IMPORTANT
  });

  /* ================= LOGIN ================= */
  mc.on("login", () => {
    log("MC login");

    if (MC_PASSWORD) {
      setTimeout(() => {
        mc.chat(`/login ${MC_PASSWORD}`);
      }, 1500);
    }
  });

  /* ================= SPAWN FLOW ================= */
  mc.on("spawn", () => {
    log("MC spawn");

    setTimeout(() => {
      mc.chat(`/play ${lastCode}`);

      setTimeout(() => {
        mc.chat("/joinme");
      }, 3000);

    }, 3000);
  });

  /* ================= CRITICAL FIX: DISABLE CHUNK CRASH ================= */

  mc._client.on("map_chunk", () => {
    // полностью игнорируем chunk parsing
    return;
  });

  mc._client.on("map_chunk_bulk", () => {
    return;
  });

  /* ================= ANTI CRASH LOCK ================= */
  function reconnect(reason) {
    if (crashLock) return;

    // 💀 hard crash protection
    if (String(reason).includes("sourceStart")) {
      crashLock = true;

      log("💀 HARD CHUNK CRASH → cooldown 60s");

      setTimeout(() => {
        crashLock = false;
        startMC(lastCode);
      }, 60000);

      return;
    }

    reconnects++;

    const delay = Math.min(30000, reconnects * 3000);

    log(`🔁 reconnect (${reason}) in ${delay}ms`);

    setTimeout(() => {
      startMC(lastCode);
    }, delay);
  }

  mc.on("end", () => reconnect("end"));
  mc.on("kicked", (r) => reconnect("kicked"));
  mc.on("error", (e) => reconnect(e.message));
}

/* ================= TELEGRAM COMMAND ================= */
bot.command("go", (ctx) => {
  const code = ctx.message.text.split(" ")[1] || "hub";

  log("/go " + code);
  startMC(code);

  ctx.reply("Connecting...");
});
