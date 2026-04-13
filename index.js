const express = require("express");
const { Telegraf } = require("telegraf");
const mineflayer = require("mineflayer");

const BOT_TOKEN = process.env.BOT_TOKEN;
const MC_PASSWORD = process.env.MC_PASSWORD;
const CHAT_ID = "8322294514"; 
const PORT = process.env.PORT || 3000;
const HOST = "production.agerapvp.club";

const bot = new Telegraf(BOT_TOKEN);
const app = express();
app.use(express.json());

let activeMcBot = null;

function log(msg) {
  console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);
}

bot.command("go", (ctx) => {
  const args = ctx.message.text.split(" ");
  const gameCode = args[1];

  if (!gameCode) {
    return ctx.reply("❌ Введи код, например: /go bw-d10");
  }

  // Если бот уже запущен, выходим из него перед новым запуском
  if (activeMcBot) {
    try { activeMcBot.quit(); } catch(e) {}
    activeMcBot = null;
  }

  ctx.reply(`🚀 Parabala_ заходит в ${gameCode}...`);
  
  activeMcBot = mineflayer.createBot({
    host: HOST,
    username: "Parabala_",
    version: "1.8.9",
    plugins: { blocks: false, physics: false, inventory: false }
  });

  activeMcBot.once("login", () => {
    log("✅ Зашел на сервер. Жду 3 сек для логина...");

    setTimeout(() => {
      activeMcBot.chat(`/l ${MC_PASSWORD}`);
      log("🔑 Пароль отправлен.");

      setTimeout(() => {
        log(`📨 Переход в ${gameCode}...`);
        activeMcBot.chat(`/play ${gameCode}`);

        setTimeout(() => {
          log("📢 Отправка /joinme...");
          activeMcBot.chat("/joinme");
          ctx.reply(`✅ JoinMe отправлен! Бот остается на сервере.\nНапиши «liv», чтобы он вышел.`);
        }, 6000); 

      }, 4000); 
    }, 3000); 
  });

  activeMcBot.on("error", (err) => log(`⚠️ Ошибка: ${err.message}`));
  activeMcBot.on("end", () => { activeMcBot = null; });
});

// ОБРАБОТКА ВЫХОДА ПО КОМАНДЕ "liv"
bot.on("text", (ctx) => {
  const msg = ctx.message.text.toLowerCase();
  if ((msg === "liv" || msg === "лив") && activeMcBot) {
    activeMcBot.quit();
    activeMcBot = null;
    ctx.reply("🔌 Бот успешно вышел с сервера.");
    log("Команда 'liv' выполнена.");
  }
});

app.get("/", (req, res) => res.send("OK"));
app.listen(PORT, () => log(`Сервер на порту ${PORT}`));
bot.launch();
