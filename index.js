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
  const gameCode = args[1]; // Берем код игры

  if (!gameCode) return ctx.reply("❌ Введи код, например: /go bw-d10");

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
    log("✅ Зашел. Цепочка таймеров запущена...");
    setTimeout(() => {
      activeMcBot.chat(`/l ${MC_PASSWORD}`);
      setTimeout(() => {
        activeMcBot.chat(`/play ${gameCode}`);
        setTimeout(() => {
          activeMcBot.chat("/joinme");
          ctx.reply(`✅ JoinMe отправлен! Бот ливнёт, если увидит «liv» в чате.`);
        }, 6000); 
      }, 4000); 
    }, 3000); 
  });

  // ПОИСК БУКВ "liv" В ЧАТЕ
  activeMcBot.on("message", (jsonMsg) => {
    const message = jsonMsg.toString().toLowerCase();
    
    // Если в сообщении есть "liv" (вместе, в любом месте строки)
    if (message.includes("liv")) {
      log(`🎯 Обнаружено "liv" в сообщении: ${message}`);
      
      if (activeMcBot) {
        activeMcBot.quit();
        activeMcBot = null;
        bot.telegram.sendMessage(CHAT_ID, `🔌 Бот ливнул! Найдено "liv" в чате:\n"${message}"`);
      }
    }
  });

  activeMcBot.on("error", (err) => log(`⚠️ Ошибка: ${err.message}`));
  activeMcBot.on("end", () => { activeMcBot = null; });
});

// Выход через Telegram
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
