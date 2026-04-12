const { Telegraf } = require("telegraf");
const mineflayer = require("mineflayer");

const BOT_TOKEN = process.env.BOT_TOKEN;
const MC_PASSWORD = process.env.MC_PASSWORD;

const bot = new Telegraf(BOT_TOKEN);

let mcBot = null;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function log(msg) {
  console.log(`[LOG] ${new Date().toISOString()} | ${msg}`);
}

function createMcBot(gameCode) {
  log("Создаю Minecraft бота...");

  mcBot = mineflayer.createBot({
    host: "agerapvp.club",
    username: "Parabala_",
    auth: "offline" // если premium — поменяешь на "microsoft"
  });

  mcBot.on("spawn", async () => {
    log("Minecraft бот заспавнился");

    await sleep(1000);

    log("Отправляю логин /l ...");
    mcBot.chat(`/l ${MC_PASSWORD}`);

    await sleep(3000);

    log(`Переход в режим: ${gameCode}`);
    mcBot.chat(`/play ${gameCode}`);

    await sleep(5000);

    log("Вход в игру завершён, отправляю /joinme");
    mcBot.chat("/joinme");

    const delay = 2000 + Math.random() * 3000;
    log(`Ожидание ${Math.round(delay)}ms перед выходом`);

    await sleep(delay);

    log("Отключение Minecraft бота...");
    mcBot.quit();
  });

  mcBot.on("end", () => {
    log("Minecraft бот отключился");
    mcBot = null;
  });

  mcBot.on("error", (err) => {
    log("Ошибка MC бота: " + err.message);
  });
}

bot.start((ctx) => {
  ctx.reply("Бот запущен. Используй /go <код>");
  log("Telegram бот стартовал");
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

  ctx.reply(`Запускаю Minecraft бота для ${gameCode}`);
  log(`Получена команда /go ${gameCode}`);

  createMcBot(gameCode);
});

bot.launch();
log("Telegram бот запущен");
