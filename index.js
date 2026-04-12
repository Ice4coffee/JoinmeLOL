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

app.get("/", (req, res) => {
  res.send("MC-TG bot running");
});

app.use(bot.webhookCallback(`/bot${BOT_TOKEN}`));

app.listen(PORT, async () => {
  log("Server started on " + PORT);

  const baseUrl = process.env.WEBHOOK_URL;

  if (!baseUrl) {
    log("WEBHOOK_URL missing");
    return;
  }

  const url = `${baseUrl}/bot${BOT_TOKEN}`;

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

  if (CHAT_ID) {
    bot.telegram.sendMessage(CHAT_ID, "🪵 " + msg).catch(() => {});
  }
}

/* ================= MC ================= */
let mc = null;
let reconnects = 0;
let lastCode = "hub";

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
  });

  /* LOGIN */
  mc.on("login", () => {
    log("MC login");

    if (MC_PASSWORD) {
      setTimeout(() => {
        mc.chat(`/login ${MC_PASSWORD}`);
      }, 1500);
    }
  });

  /* SPAWN FLOW */
  mc.on("spawn", () => {
    log("MC spawn");

    setTimeout(() => {
      mc.chat(`/play ${lastCode}`);

      setTimeout(() => {
        mc.chat("/joinme");
      }, 3000);

    }, 3000);
  });

  /* ================= ANTI CRASH CHUNK FIX ================= */
  let chunkCount = 0;
  let start = Date.now();

  function spike() {
    if (Date.now() - start > 5000) {
      chunkCount = 0;
      start = Date.now();
    }

    chunkCount++;

    if (chunkCount > 200) {
      log("⚡ ANTI-LAG ACTIVE");
      return true;
    }

    return false;
  }

  mc._client.on("map_chunk", () => {
    if (spike()) return;
  });

  mc._client.on("map_chunk_bulk", () => {
    if (spike()) return;
  });

  /* ================= RECONNECT ================= */
  function reconnect(reason) {
    reconnects++;

    const delay = Math.min(30000, reconnects * 2000);

    log(`🔁 reconnect (${reason}) in ${delay}ms`);

    setTimeout(() => {
      startMC(lastCode);
    }, delay);
  }

  mc.on("end", () => reconnect("end"));
  mc.on("kicked", () => reconnect("kicked"));
  mc.on("error", (e) => reconnect(e.message));
}

/* ================= COMMAND ================= */
bot.command("go", (ctx) => {
  const code = ctx.message.text.split(" ")[1] || "hub";

  log("/go " + code);
  startMC(code);

  ctx.reply("Connecting...");
});
