import express from "express";
import mineflayer from "mineflayer";
import { Telegraf } from "telegraf";

/* ================= ENV ================= */
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const PORT = process.env.PORT || 3000;

const MC_HOST = process.env.MC_HOST;
const MC_PORT = Number(process.env.MC_PORT || 25565);
const MC_USER = process.env.MC_USER || "Bot";
const MC_PASSWORD = process.env.MC_PASSWORD || "";
const MC_VERSION = process.env.MC_VERSION || "1.8.9";

/* ================= SAFETY CHECK ================= */
if (!BOT_TOKEN || !MC_HOST) {
  throw new Error("Missing BOT_TOKEN or MC_HOST");
}

/* ================= TELEGRAM (WEBHOOK SAFE) ================= */
const bot = new Telegraf(BOT_TOKEN);

/* ================= EXPRESS (WEBHOOK SERVER) ================= */
const app = express();
app.use(express.json());

app.get("/", (_, res) => {
  res.send("MC-TG bot running");
});

/* Telegram webhook endpoint */
app.use(bot.webhookCallback(`/bot${BOT_TOKEN}`));

app.listen(PORT, async () => {
  log(`Server started on ${PORT}`);

  const url = process.env.WEBHOOK_URL; 
  if (!url) {
    log("❌ WEBHOOK_URL missing (auto fix mode)");
    return;
  }

  const fixedUrl = url.endsWith("/")
    ? url.slice(0, -1)
    : url;

  const full = `${fixedUrl}/bot${BOT_TOKEN}`;

  try {
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    await bot.telegram.setWebhook(full);
    log(`Webhook set → ${full}`);
  } catch (e) {
    log("Webhook error: " + e.message);
  }

  startMC();
});

/* ================= LOG ================= */
function log(msg) {
  console.log(`[LOG ${new Date().toISOString()}] ${msg}`);
  if (CHAT_ID) bot.telegram.sendMessage(CHAT_ID, `🪵 ${msg}`).catch(() => {});
}

/* ================= MC STATE ================= */
let mc = null;
let reconnectAttempts = 0;
let reconnectTimer = null;
let lastCode = "hub";
let antiLag = false;

/* ================= MC START ================= */
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

  /* ================= LOGIN FLOW ================= */
  mc.on("login", () => {
    log("MC login");

    setTimeout(() => {
      if (MC_PASSWORD) mc.chat(`/login ${MC_PASSWORD}`);
    }, 1500);
  });

  mc.on("spawn", () => {
    log("MC spawn");

    setTimeout(() => {
      mc.chat(`/play ${lastCode}`);

      setTimeout(() => {
        mc.chat(`/joinme`);
      }, 3000);

    }, 3000);
  });

  /* ================= ANTI-LAG ================= */
  let chunkCount = 0;
  let chunkReset = Date.now();

  function chunkSpike() {
    const now = Date.now();

    if (now - chunkReset > 5000) {
      chunkCount = 0;
      chunkReset = now;
    }

    chunkCount++;

    if (chunkCount > 200 && !antiLag) {
      antiLag = true;
      log("⚡ ANTI-LAG ON");

      setTimeout(() => {
        antiLag = false;
        log("⚡ ANTI-LAG OFF");
      }, 5000);
    }
  }

  mc._client.on("map_chunk", () => {
    chunkSpike();
    if (antiLag) return;
  });

  mc._client.on("map_chunk_bulk", () => {
    chunkSpike();
    if (antiLag) return;
  });

  /* ================= DISCONNECT HANDLERS ================= */
  function reconnect(reason) {
    reconnectAttempts++;

    const delay = Math.min(30000, 2000 * reconnectAttempts);

    log(`🔁 Reconnect (${reason}) in ${delay}ms`);

    if (reconnectTimer) clearTimeout(reconnectTimer);

    reconnectTimer = setTimeout(() => {
      startMC(lastCode);
    }, delay);
  }

  mc.on("end", () => reconnect("end"));
  mc.on("kicked", (r) => reconnect("kicked"));
  mc.on("error", (e) => reconnect(e.message));
}

/* ================= TELEGRAM COMMAND ================= */
bot.command("go", async (ctx) => {
  const code = ctx.message.text.split(" ")[1] || "hub";

  log(`/go → ${code}`);
  startMC(code);

  ctx.reply(`Connecting to ${code}`);
});
