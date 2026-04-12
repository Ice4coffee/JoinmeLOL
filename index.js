const { Telegraf } = require("telegraf");
const mineflayer = require("mineflayer");
const http = require("http");

/* ================= ENV ================= */
const BOT_TOKEN = process.env.BOT_TOKEN;
const MC_PASSWORD = process.env.MC_PASSWORD;
const WEBHOOK_DOMAIN = process.env.WEBHOOK_DOMAIN;
const PORT = process.env.PORT || 3000;

if (!BOT_TOKEN) throw new Error("BOT_TOKEN required");

/* ================= LOG ================= */
function log(msg) {
  console.log(`[LOG ${new Date().toISOString()}] ${msg}`);
}

/* ================= WEBHOOK FIX ================= */
function normalizeDomain(domain) {
  if (!domain) return null;

  let d = String(domain).trim();
  d = d.replace(/\/+$/, "");

  if (!d.startsWith("http://") && !d.startsWith("https://")) {
    d = "https://" + d;
  }

  return d;
}

/* ================= BOT ================= */
const bot = new Telegraf(BOT_TOKEN);
const path = `/bot${BOT_TOKEN}`;

/* ================= MC ================= */
let mc = null;
let running = false;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function disableChunks(bot) {
  try {
    const c = bot._client;
    if (!c) return;

    const packets = [
      "map_chunk",
      "map_chunk_bulk",
      "unload_chunk",
      "multi_block_change",
      "block_change",
      "update_block_entity",
      "block_action",
    ];

    for (const p of packets) {
      c.removeAllListeners(p);
      c.on(p, () => {});
    }

    log("Chunk protection enabled");
  } catch (e) {
    log("Chunk fix error: " + e.message);
  }
}

async function startMC(code) {
  if (running) return;
  running = true;

  try {
    if (mc) {
      try { mc.quit(); } catch {}
      mc = null;
    }

    mc = mineflayer.createBot({
      host: "agerapvp.club",
      port: 25565,
      username: "Parabala_",
      auth: "offline",
      version: "1.8.9",
    });

    mc.once("login", () => {
      log("MC login");
      disableChunks(mc);
    });

    mc.once("spawn", async () => {
      log("MC spawn");

      try {
        await sleep(1200);

        if (MC_PASSWORD) mc.chat(`/login ${MC_PASSWORD}`);
        await sleep(2500);

        mc.chat(`/play ${code}`);
        await sleep(4000);

        mc.chat("/joinme");

        await sleep(3000);
        mc.quit();

      } catch (e) {
        log("MC spawn error: " + e.message);
      }

      running = false;
    });

    mc.on("error", (e) => log("MC error: " + e.message));

    mc.on("end", () => {
      log("MC disconnected");
      running = false;
    });

  } catch (e) {
    log("MC crash: " + e.message);
    running = false;
  }
}

/* ================= TG ================= */
bot.start((ctx) => ctx.reply("Bot ready. Use /go <code>"));

bot.command("go", async (ctx) => {
  const code = ctx.message.text.split(" ")[1];
  if (!code) return ctx.reply("Usage: /go <code>");

  ctx.reply(`Starting: ${code}`);
  startMC(code);
});

/* ================= WEBHOOK ================= */
async function setupWebhook() {
  try {
    const base = normalizeDomain(WEBHOOK_DOMAIN);

    if (!base) {
      throw new Error("WEBHOOK_DOMAIN missing");
    }

    const url = `${base}${path}`;

    await bot.telegram.deleteWebhook();
    await bot.telegram.setWebhook(url);

    log("Webhook set → " + url);

  } catch (e) {
    log("Webhook error: " + e.message);
  }
}

/* ================= HTTP SERVER ================= */
const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === path) {
    let body = "";

    req.on("data", chunk => (body += chunk));

    req.on("end", () => {
      try {
        bot.handleUpdate(JSON.parse(body));
      } catch (e) {
        log("Update error: " + e.message);
      }
    });

    res.writeHead(200);
    res.end("OK");

  } else {
    res.writeHead(200);
    res.end("Bot running");
  }
});

/* ================= START ================= */
server.listen(PORT, async () => {
  log("Server started on " + PORT);
  await setupWebhook();
});
