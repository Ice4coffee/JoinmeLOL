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

  if (!gameCode) return ctx.reply("❌ Введи код, например: /go bw-d10");

  if (activeMcBot) {
    try { activeMcBot.quit(); } catch(e) {}
    activeMcBot = null;
  }

  ctx.reply(`🚀 Fast Start: Parabala_ → ${gameCode}`);
  
  activeMcBot = mineflayer.createBot({
    host: HOST,
    username: "Parabala_",
    version: "1.8.9",
    plugins: { blocks: false, physics: false, inventory: false }
  });

  activeMcBot.once("login", () => {
    log("✅ Зашел. Быстрая цепочка...");
    
    // 1. Быстрый логин
    setTimeout(() => {
      activeMcBot.chat(`/l ${MC_PASSWORD}`);
      log("🔑 Логин отправлен");

      // 2. Быстрый переход
      setTimeout(() => {
        log(`📨 Команда: /play ${gameCode}`);
        activeMcBot.chat(`/play ${gameCode}`);

        // 3. Быстрый JoinMe
        setTimeout(() => {
          log("📢 Команда: /joinme");
          activeMcBot.chat("/joinme");
          ctx.reply(`✅ JoinMe отправлен в ${gameCode}!`);
        }, 2500); // 2.5 сек на прогрузку игры

      }, 1500); // 1.5 сек после пароля

    }, 1500); // 1.5 сек после коннекта
  });

  activeMcBot.on("message", (jsonMsg) => {
    const message = jsonMsg.toString().toLowerCase();
    if (message.includes("liv")) {
      log(`🎯 Детект "liv": ${message}`);
      if (activeMcBot) {
        activeMcBot.quit();
        activeMcBot = null;
        bot.telegram.sendMessage(CHAT_ID, `🔌 Бот ливнул (детект liv в чате).`);
      }
    }
  });

  activeMcBot.on("error", (err) => log(`⚠️ Ошибка: ${err.message}`));
  activeMcBot.on("end", () => { activeMcBot = null; });
});

bot.on("text", (ctx) => {
  if (ctx.message.text.toLowerCase() === "liv" && activeMcBot) {
    activeMcBot.quit();
    activeMcBot = null;
    ctx.reply("🔌 Бот вышел.");
  }
});

app.get("/", (req, res) => res.send("OK"));
app.listen(PORT, () => log(`Сервер на порту ${PORT}`));
bot.launch();
