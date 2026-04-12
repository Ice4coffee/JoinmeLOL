const { Telegraf } = require("telegraf");
const mineflayer = require("mineflayer");
const { resolveSrv } = require("dns/promises");

const BOT_TOKEN = process.env.BOT_TOKEN;
const MC_PASSWORD = process.env.MC_PASSWORD;

const bot = new Telegraf(BOT_TOKEN);

let mcBot = null;
let currentGameCode = null;
let connecting = false;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function log(msg) {
  console.log(`[LOG] ${new Date().toISOString()} | ${msg}`);
}

/* ================== SRV ================== */
async function resolveMc(host, port) {
  try {
    const srv = await resolveSrv(`_minecraft._tcp.${host}`);
    if (srv?.length) {
      srv.sort((a, b) => a.priority - b.priority || b.weight - a.weight);
      const best = srv[0];
      return { host: best.name, port: best.port };
    }
  } catch {}

  return { host, port };
}

/* ================== ANTI CRASH PATCH ================== */
function applyAntiCrash(bot) {
  const c = bot?._client;
  if (!c) return;

  const blockedPackets = [
    "map_chunk",
    "map_chunk_bulk",
    "unload_chunk",
    "multi_block_change",
    "block_change",
  ];

  for (const p of blockedPackets) {
    try {
      c.removeAllListeners(p);
      c.on(p, () => {});
    } catch {}
  }

  log("🛡 Chunk crash protection enabled");
}

/* ================== MC CONNECT ================== */
async function createMcBot(gameCode) {
  if (connecting) return;
  connecting = true;

  currentGameCode = gameCode;

  try {
    if (mcBot) {
      try { mcBot.quit(); } catch {}
      mcBot = null;
    }

    const ep = await resolveMc("agerapvp.club", 25565);

    log(`Connecting to ${ep.host}:${ep.port}`);

    mcBot = mineflayer.createBot({
      host: ep.host,
      port: ep.port,
      username: "Parabala_",
      auth: "offline",

      // ❗ ВАЖНО: НЕ ставим version (это ломает часть серверов)
      viewDistance: 2,
    });

    mcBot.once("login", () => {
      log("✔ login");
      applyAntiCrash(mcBot);
    });

    mcBot.once("spawn", async () => {
      log("✔ spawn");

      await sleep(1000);

      try {
        if (MC_PASSWORD) {
          log("sending /login");
          mcBot.chat(`/login ${MC_PASSWORD}`);
        }
      } catch {}

      await sleep(2500);

      try {
        log(`sending /play ${currentGameCode}`);
        mcBot.chat(`/play ${currentGameCode}`);
      } catch {}

      await sleep(4000);

      try {
        log("sending /joinme");
        mcBot.chat("/joinme");
      } catch {}

      const delay = 2000 + Math.random() * 3000;
      log(`waiting ${Math.round(delay)}ms`);

      await sleep(delay);

      try {
        mcBot.quit();
      } catch {}
    });

    mcBot.on("kicked", (r) => log("KICKED: " + r));
    mcBot.on("error", (e) => log("ERROR: " + e.message));

    mcBot.on("end", () => {
      log("disconnected");
      mcBot = null;
      connecting = false;
    });

  } catch (e) {
    log("CONNECT ERROR: " + e.message);
    connecting = false;
  }
}

/* ================== TELEGRAM ================== */
bot.start((ctx) => {
  ctx.reply("Bot ready. Use /go <code>");
});

bot.command("go", async (ctx) => {
  const gameCode = ctx.message.text.split(" ")[1];

  if (!gameCode) return ctx.reply("Use: /go <code>");

  if (mcBot) return ctx.reply("MC bot already running");

  ctx.reply(`Starting MC bot: ${gameCode}`);
  log("/go " + gameCode);

  createMcBot(gameCode);
});

bot.launch();
log("Telegram bot running");
