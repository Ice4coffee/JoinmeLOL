const { Telegraf } = require("telegraf");
const mineflayer = require("mineflayer");
const { resolveSrv } = require("dns/promises");

const BOT_TOKEN = process.env.BOT_TOKEN;
const MC_PASSWORD = process.env.MC_PASSWORD;

const bot = new Telegraf(BOT_TOKEN);

let mcBot = null;
let mcRunning = false;
let tgStarted = false;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function log(msg) {
  console.log(`[LOG ${new Date().toISOString()}] ${msg}`);
}

/* ===================== TELEGRAM SAFE START ===================== */
async function startTelegram() {
  if (tgStarted) return;
  tgStarted = true;

  while (true) {
    try {
      log("Starting Telegram bot...");

      await bot.launch({
        dropPendingUpdates: true,
      });

      log("Telegram bot running");
      break;

    } catch (e) {
      log("Telegram launch error: " + e.message);
      await sleep(5000);
    }
  }
}

/* ===================== SRV ===================== */
async function resolveMc(host, port) {
  try {
    const srv = await resolveSrv(`_minecraft._tcp.${host}`);
    if (srv?.length) {
      srv.sort((a, b) => a.priority - b.priority || b.weight - a.weight);
      return { host: srv[0].name, port: srv[0].port };
    }
  } catch {}
  return { host, port };
}

/* ===================== MC ANTI CRASH ===================== */
function protectChunks(bot) {
  const c = bot?._client;
  if (!c) return;

  const block = [
    "map_chunk",
    "map_chunk_bulk",
    "unload_chunk",
    "multi_block_change",
  ];

  for (const p of block) {
    try {
      c.removeAllListeners(p);
      c.on(p, () => {});
    } catch {}
  }

  log("Chunk protection enabled");
}

/* ===================== MC CONNECT ===================== */
async function startMC(gameCode) {
  if (mcRunning) return;
  mcRunning = true;

  try {
    if (mcBot) {
      try { mcBot.quit(); } catch {}
      mcBot = null;
    }

    const ep = await resolveMc("agerapvp.club", 25565);

    log(`MC connect -> ${ep.host}:${ep.port}`);

    mcBot = mineflayer.createBot({
      host: ep.host,
      port: ep.port,
      username: "Parabala_",
      auth: "offline",
      viewDistance: 2,
    });

    mcBot.once("login", () => {
      log("MC login");
      protectChunks(mcBot);
    });

    mcBot.once("spawn", async () => {
      log("MC spawn");

      await sleep(1200);

      if (MC_PASSWORD) {
        mcBot.chat(`/login ${MC_PASSWORD}`);
        log("sent /login");
      }

      await sleep(2500);

      mcBot.chat(`/play ${gameCode}`);
      log("sent /play " + gameCode);

      await sleep(4000);

      mcBot.chat("/joinme");
      log("sent /joinme");

      const delay = 2000 + Math.random() * 3000;
      await sleep(delay);

      try { mcBot.quit(); } catch {}

      mcRunning = false;
    });

    mcBot.on("kicked", (r) => log("KICKED: " + r));
    mcBot.on("error", (e) => log("ERROR: " + e.message));

    mcBot.on("end", () => {
      log("MC disconnected");
      mcRunning = false;
      mcBot = null;
    });

  } catch (e) {
    log("MC ERROR: " + e.message);
    mcRunning = false;
  }
}

/* ===================== QUEUE PROTECTION ===================== */
let queue = [];
let processing = false;

async function processQueue() {
  if (processing) return;
  processing = true;

  while (queue.length > 0) {
    const code = queue.shift();
    await startMC(code);
    await sleep(2000);
  }

  processing = false;
}

/* ===================== TELEGRAM COMMAND ===================== */
bot.start((ctx) => {
  ctx.reply("Production bot ready. Use /go <code>");
});

bot.command("go", async (ctx) => {
  const code = ctx.message.text.split(" ")[1];

  if (!code) return ctx.reply("Use: /go <code>");

  queue.push(code);
  ctx.reply(`Queued: ${code}`);

  processQueue();
});

/* ===================== GLOBAL ERROR SAFETY ===================== */
process.on("unhandledRejection", (e) => {
  log("UNHANDLED: " + e.message);
});

process.on("uncaughtException", (e) => {
  log("CRASH: " + e.message);
});

/* ===================== START ===================== */
startTelegram();
