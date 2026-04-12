const { Telegraf } = require("telegraf");
const mineflayer = require("mineflayer");
const express = require("express");

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBHOOK_DOMAIN = process.env.WEBHOOK_DOMAIN; 
// пример: https://your-app.up.railway.app

const PORT = process.env.PORT || 3000;

const bot = new Telegraf(BOT_TOKEN);
const app = express();

app.use(express.json());

/* ===================== MC ===================== */
let mcBot = null;
let running = false;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function log(msg) {
  console.log(`[LOG ${new Date().toISOString()}] ${msg}`);
}

/* ===================== MC START ===================== */
async function startMC(code) {
  if (running) return;
  running = true;

  try {
    if (mcBot) {
      try { mcBot.quit(); } catch {}
      mcBot = null;
    }

    mcBot = mineflayer.createBot({
      host: "agerapvp.club",
      port: 25565,
      username: "Parabala_",
      auth: "offline",
      viewDistance: 2,
    });

    mcBot.once("login", () => log("MC login"));
    mcBot.once("spawn", async () => {
      log("MC spawn");

      await sleep(1200);

      mcBot.chat(`/login ${process.env.MC_PASSWORD}`);
      await sleep(2500);

      mcBot.chat(`/play ${code}`);
      await sleep(4000);

      mcBot.chat("/joinme");

      await sleep(3000);
      mcBot.quit();

      running = false;
    });

    mcBot.on("error", (e) => log("MC error: " + e.message));
    mcBot.on("end", () => {
      log("MC disconnected");
      running = false;
    });

  } catch (e) {
    log("MC crash: " + e.message);
    running = false;
  }
}

/* ===================== TELEGRAM ===================== */
bot.start((ctx) => ctx.reply("Webhook bot ready. Use /go <code>"));

bot.command("go", async (ctx) => {
  const code = ctx.message.text.split(" ")[1];
  if (!code) return ctx.reply("Use: /go <code>");

  ctx.reply(`Starting: ${code}`);
  startMC(code);
});

/* ===================== WEBHOOK ROUTE ===================== */
app.post(`/bot${BOT_TOKEN}`, (req, res) => {
  bot.handleUpdate(req.body);
  res.sendStatus(200);
});

/* ===================== HEALTH ===================== */
app.get("/", (req, res) => {
  res.send("Bot is running");
});

/* ===================== START WEBHOOK ===================== */
async function start() {
  await bot.telegram.deleteWebhook();

  await bot.telegram.setWebhook(
    `${WEBHOOK_DOMAIN}/bot${BOT_TOKEN}`
  );

  app.listen(PORT, () => {
    log("Server started on " + PORT);
    log("Webhook set to " + WEBHOOK_DOMAIN);
  });
}

start();
