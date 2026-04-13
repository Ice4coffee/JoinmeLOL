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

  // Принудительная очистка старого процесса
  if (activeMcBot) {
    log("Очистка старой сессии...");
    try { activeMcBot.quit(); } catch(e) {}
    activeMcBot = null;
  }

  ctx.reply(`🚀 Коннект Parabala_ → ${gameCode}...`);
  
  activeMcBot = mineflayer.createBot({
    host: HOST,
    port: 25565,
    username: "Parabala_",
    version: "1.8.9",
    // Минимальный набор плагинов для стабильности
    hideErrors: false 
  });

  // Логгирование процесса подключения
  activeMcBot.on("connect", () => log("🔗 Установлено соединение с сокетом..."));
  
  activeMcBot.once("login", () => {
    log("✅ Зашел на сервер. Запуск таймеров...");
    
    setTimeout(() => {
      if (activeMcBot) activeMcBot.chat(`/l ${MC_PASSWORD}`);
      log("🔑 Логин отправлен");

      setTimeout(() => {
        if (activeMcBot) activeMcBot.chat(`/play ${gameCode}`);
        log(`📨 Команда /play ${gameCode}`);

        setTimeout(() => {
          if (activeMcBot) activeMcBot.chat("/joinme");
          log("📢 Команда /joinme");
          ctx.reply(`✅ Все команды отправлены в ${gameCode}!`);
        }, 2000); 

      }, 1500); 
    }, 1500); 
  });

  // Если не заходит, это событие скажет почему
  activeMcBot.on("error", (err) => {
    log(`⚠️ КРИТИЧЕСКАЯ ОШИБКА: ${err.message}`);
    ctx.reply(`⚠️ Ошибка подключения: ${err.message}`);
  });

  activeMcBot.on("kicked", (reason) => {
    const r = JSON.parse(reason).text || reason;
    log(`❌ КИКНУТ: ${r}`);
    ctx.reply(`❌ Кик: ${r}`);
  });

  activeMcBot.on("message", (jsonMsg) => {
    const message = jsonMsg.toString().toLowerCase();
    if (message.includes("liv")) {
      if (activeMcBot) {
        activeMcBot.quit();
        activeMcBot = null;
        bot.telegram.sendMessage(CHAT_ID, `🔌 Ливнул (детект liv в чате).`);
      }
    }
  });

  activeMcBot.on("end", () => {
    log("🔌 Соединение закрыто");
    activeMcBot = null;
  });
});

bot.on("text", (ctx) => {
  if (ctx.message.text.toLowerCase() === "liv" && activeMcBot) {
    activeMcBot.quit();
    activeMcBot = null;
    ctx.reply("🔌 Вышел.");
  }
});

app.get("/", (req, res) => res.send("Bot Status: OK"));
app.listen(PORT, () => log(`Сервер на порту ${PORT}`));
bot.launch();
