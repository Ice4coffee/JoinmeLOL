const express = require("express");
const { Telegraf } = require("telegraf");
const mineflayer = require("mineflayer");

// Конфигурация из переменных окружения
const BOT_TOKEN = process.env.BOT_TOKEN;
const MC_PASSWORD = process.env.MC_PASSWORD;
const PORT = process.env.PORT || 3000;
const HOST = "production.agerapvp.club";

const bot = new Telegraf(BOT_TOKEN);
const app = express();
app.use(express.json());

// Хелсчек для Railway
app.get("/", (req, res) => res.send("Bot is active"));

function log(msg) {
  console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);
}

bot.command("go", async (ctx) => {
  const gameCode = ctx.message.text.split(" ")[1];

  if (!gameCode) {
    return ctx.reply("❌ Ошибка! Введи код игры, например: /go bw-d10");
  }

  ctx.reply(`🚀 Запуск процесса для ${gameCode}...`);
  log(`Запуск: ник Parabala_, цель ${gameCode}`);

  const mcBot = mineflayer.createBot({
    host: HOST,
    username: "Parabala_",
    version: "1.8.9",
    plugins: { blocks: false, physics: false, inventory: false }
  });

  // 1. ЛОГИН
  mcBot.once("login", () => {
    log("✅ Зашел на сервер. Ожидание спавна для логина...");
    
    setTimeout(() => {
      mcBot.chat(`/l ${MC_PASSWORD}`);
      log("🔑 Отправлена команда /l [password]");
    }, 2000);
  });

  // 2. ПЕРЕХОД (через 3 сек после логина)
  mcBot.on("spawn", function handleSpawn() {
    // Используем одноразовое срабатывание для цепочки после логина
    mcBot.removeListener("spawn", handleSpawn);
    
    setTimeout(() => {
      log(`📨 Переход в режим: /play ${gameCode}`);
      mcBot.chat(`/play ${gameCode}`);

      // 3. JOINME (через 5 сек после /play)
      setTimeout(() => {
        log("📢 Отправка команды /joinme");
        mcBot.chat("/joinme");

        // 4. ВЫХОД (рандом 2-5 сек)
        const exitDelay = Math.floor(Math.random() * (5000 - 2000 + 1) + 2000);
        setTimeout(() => {
          log(`🔌 Завершение работы. Пауза была: ${exitDelay}мс`);
          mcBot.quit();
          ctx.reply(`✅ Успешно! /joinme отправлен в ${gameCode}.`);
        }, exitDelay);

      }, 5000);

    }, 3000);
  });

  mcBot.on("error", (err) => {
    log(`⚠️ Ошибка MC: ${err.message}`);
    ctx.reply(`⚠️ Ошибка: ${err.message}`);
  });

  mcBot.on("kicked", (reason) => {
    log(`❌ Кикнут: ${reason}`);
  });
});

app.listen(PORT, () => {
  log(`🖥️ Сервер запущен на порту ${PORT}`);
});

// Запуск Telegraf (Polling для простоты, если не указан PUBLIC_URL)
bot.launch();
