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

  ctx.reply(`🚀 Запуск Parabala_ → ${gameCode}`);
  
  activeMcBot = mineflayer.createBot({
    host: HOST,
    username: "Parabala_",
    version: "1.8.9",
    // СТРОГО ОТКЛЮЧАЕМ ПЛАГИНЫ, чтобы бот не вылетал сам по себе
    plugins: {
      blocks: false,
      physics: false,
      inventory: false,
      entities: false
    }
  });

  activeMcBot.once("login", () => {
    log("✅ Зашел. Выполняю команды...");
    
    setTimeout(() => {
      if (activeMcBot) activeMcBot.chat(`/l ${MC_PASSWORD}`);
      
      setTimeout(() => {
        if (activeMcBot) activeMcBot.chat(`/play ${gameCode}`);

        setTimeout(() => {
          if (activeMcBot) {
            activeMcBot.chat("/joinme");
            log("📢 JoinMe отправлен. Бот остается в сети.");
            ctx.reply(`✅ Все готово! Бот в игре. Жду «liv» для выхода.`);
          }
        }, 3000); // 3 сек на переход
      }, 2000); // 2 сек после логина
    }, 2000); // 2 сек после входа
  });

  // ОБРАБОТКА ЧАТА (ВЫХОД ПО СЛОВУ LIV)
  activeMcBot.on("message", (jsonMsg) => {
    const message = jsonMsg.toString();
    const lowMsg = message.toLowerCase();
    
    // Выходим только если "liv" написали ДРУГИЕ (не сам бот в пароле)
    if (lowMsg.includes("liv")) {
      // Проверка: если сообщение содержит наш пароль, игнорируем (защита от самокика)
      if (MC_PASSWORD && lowMsg.includes(MC_PASSWORD.toLowerCase())) return;

      log(`🎯 Детект "liv" в чате: ${message}`);
      if (activeMcBot) {
        activeMcBot.quit();
        activeMcBot = null;
        bot.telegram.sendMessage(CHAT_ID, `🔌 Бот ливнул по команде из чата:\n"${message}"`);
      }
    }
  });

  activeMcBot.on("error", (err) => log(`⚠️ Ошибка: ${err.message}`));
  activeMcBot.on("kicked", (reason) => log(`❌ Кик: ${reason}`));
  activeMcBot.on("end", () => {
    log("🔌 Соединение закрыто (end)");
    activeMcBot = null;
  });
});

// Выход через Telegram
bot.on("text", (ctx) => {
  const text = ctx.message.text.toLowerCase();
  if ((text === "liv" || text === "лив") && activeMcBot) {
    activeMcBot.quit();
    activeMcBot = null;
    ctx.reply("🔌 Вышел.");
  }
});

app.get("/", (req, res) => res.send("OK"));
app.listen(PORT, () => log(`Сервер на порту ${PORT}`));
bot.launch();
