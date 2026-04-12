const { Telegraf } = require("telegraf");
const mineflayer = require("mineflayer");
const { resolveSrv } = require("dns/promises");

const BOT_TOKEN = process.env.BOT_TOKEN;
const MC_PASSWORD = process.env.MC_PASSWORD;

const bot = new Telegraf(BOT_TOKEN);

let mcBot = null;
let currentGameCode = null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function log(msg) {
  console.log(`[LOG] ${new Date().toISOString()} | ${msg}`);
}

/* ================== SRV RESOLVE ================== */
async function resolveMcEndpoint(host, port) {
  try {
    const srv = await resolveSrv(`_minecraft._tcp.${host}`);

    if (srv && srv.length) {
      srv.sort((a, b) => a.priority - b.priority || b.weight - a.weight);
      const best = srv[0];

      log(`SRV resolved -> ${best.name}:${best.port}`);

      return {
        host: best.name,
        port: best.port,
      };
    }
  } catch (e) {
    log("SRV resolve failed, using direct: " + e.message);
  }

  return {
    host,
    port,
  };
}

/* ================== MC BOT ================== */
function createMcBot(gameCode) {
  currentGameCode = gameCode;

  log("Создаю Minecraft бота...");

  mcBot = mineflayer.createBot({
    host: "agerapvp.club",
    port: 25565,
    username: "Parabala_",
    auth: "offline",
    version: "1.8.9",
    viewDistance: 1,
  });

  mcBot.on("login", () => {
    log("MC login");
  });

  mcBot.on("spawn", async () => {
    log("MC spawn");

    await sleep(1000);

    log("Отправляю /login");
    if (MC_PASSWORD) {
      mcBot.chat(`/login ${MC_PASSWORD}`);
    }

    await sleep(3000);

    log(`Отправляю /play ${currentGameCode}`);
    mcBot.chat(`/play ${currentGameCode}`);

    await sleep(5000);

    log("Отправляю /joinme");
    mcBot.chat("/joinme");

    const delay = 2000 + Math.random() * 3000;
    log(`Жду ${Math.round(delay)}ms перед выходом`);

    await sleep(delay);

    log("Выход из сервера");
    mcBot.quit();
  });

  mcBot.on("kicked", (reason) => {
    log("KICKED: " + reason);
  });

  mcBot.on("error", (err) => {
    log("ERROR: " + err.message);
  });

  mcBot.on("end", () => {
    log("MC disconnected");
    mcBot = null;
  });
}

/* ================== TELEGRAM ================== */
bot.start((ctx) => {
  ctx.reply("Бот запущен. Используй /go <код>");
  log("Telegram bot started");
});

bot.command("go", async (ctx) => {
  const parts = ctx.message.text.split(" ");
  const gameCode = parts[1];

  if (!gameCode) {
    return ctx.reply("Использование: /go <код_игры>");
  }

  if (mcBot) {
    return ctx.reply("Minecraft бот уже запущен");
  }

  ctx.reply(`Запускаю Minecraft бота: ${gameCode}`);
  log(`/go -> ${gameCode}`);

  createMcBot(gameCode);
});

bot.launch();
log("Telegram bot running");
