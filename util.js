const Discord = require("discord.js");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { compressToEncodedURIComponent } = require("lz-string");
const { TPStoCanvas, parseTPS } = require("./TPS-Ninja/src");
const { Ply } = require("./TPS-Ninja/src/Ply");

// Constants
const DELETE_TIMER_MS = 864e5;
const INACTIVE_MESSAGES = [
  "It's been a while since your last move. Please take your turn soon, @player.",
  "Ready to jump back in, @player? The game is waiting for your move!",
  "Hey, @player. Just wanted to let you know it's still your turn.",
  "@player the game awaits your next move. What are you gonna do?",
  "Hey @player, we're eager to see your next move. You got this!",
  "Hope all is well, @player! It's your turn when you're ready.",
  "@player, the game needs you! Make your move when you can.",
  "Still thinking, @player? Don't stress it, just have fun!",
  "Long time no see, @player! Don't forget, it's your turn.",
  "The game's still here, @player! It's your turn to play.",
  "@player, time to pick up where we left off! Your move.",
  "@player, it's your turn! Let's keep the game rolling.",
  "Just a friendly reminder, @player: it's your turn!",
  "We've missed you, @player! Time to make your move.",
  "Hey @player, we've been waiting! It's your turn.",
  "It's your turn, @player! What's your next move?",
  "Your turn, @player! Let's see what you've got.",
  "@player, it's your turn. Ready to make a move?",
  "Don't forget, @player, it's your turn now!",
];

// Persisting variables

let client;
const defaultTheme = "discord";
const deleteTimers = {};
const inactiveTimers = {};
const reminderTimers = {};

// Non-exported functions

function tagDateTime() {
  const pad = (num) => {
    return (num < 9 ? "0" : "") + num;
  };
  const now = new Date();
  return (
    `[Date "${now.getUTCFullYear()}.${pad(now.getUTCMonth() + 1)}.${pad(
      now.getUTCDate()
    )}"]\n` +
    `[Time "${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(
      now.getUTCSeconds()
    )}"]\n`
  );
}

function getLastFilename(msg) {
  let tpsDir = path.join(
    __dirname,
    "data",
    msg.channelId || msg.channel.id,
    "tps"
  );
  if (!fs.existsSync(tpsDir)) {
    return false;
  }
  let files = fs.readdirSync(tpsDir);
  files.sort();
  return files && files.length
    ? path.join(tpsDir, files[files.length - 1])
    : false;
}

function createTimer(timer, channelId) {
  const { type, timestamp } = timer;
  try {
    const timersDir = path.join(__dirname, "data", channelId, "timers");
    const timerPath = path.join(
      timersDir,
      type === "reminder" ? `${type}.${timestamp}.json` : `${type}.json`
    );
    fs.mkdirSync(timersDir, { recursive: true });
    fs.writeFileSync(timerPath, JSON.stringify(timer));
    module.exports.setTimer(timer, channelId);
  } catch (err) {
    console.error(`Failed to save timer ${timerPath}:`, err);
  }
}

function clearTimer(type, channelId, timestamp) {
  const timerDir = path.join(__dirname, "data", channelId, "timers");
  let timerId;
  let filePath;
  switch (type) {
    case "delete":
      timerId = deleteTimers[channelId];
      if (timerId) {
        clearTimeout(timerId);
        delete deleteTimers[timerId];
      }
      filePath = path.join(timerDir, `${type}.json`);
      break;
    case "inactive":
      timerId = inactiveTimers[channelId];
      if (timerId) {
        clearTimeout(timerId);
        delete inactiveTimers[timerId];
      }
      filePath = path.join(timerDir, `${type}.json`);
      break;
    case "reminder":
      timerId = reminderTimers[`${channelId}.${timestamp}`];
      if (timerId) {
        clearTimeout(timerId);
        delete reminderTimers[`${channelId}.${timestamp}`];
      }
      filePath = path.join(timerDir, `${type}.${timestamp}.json`);
      break;
  }
  if (filePath) {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      // Assume file doesn't exist
    }
  }
}

function getInactiveMessage(playerId, seed, index) {
  const messages = shuffle(INACTIVE_MESSAGES, seed);
  return messages[index % messages.length].replace("@player", `<@${playerId}>`);
}

function shuffle(array, seed) {
  array = array.concat();
  let m = array.length;
  let i;

  while (m) {
    i = Math.floor(seedRandom(seed) * m--);
    [array[m], array[i]] = [array[i], array[m]];
    ++seed;
  }

  return array;
}

function seedRandom(seed) {
  var x = Math.sin(seed++) * 1e4;
  return x - Math.floor(x);
}

Ply.prototype.toString = function () {
  let minDistribution, minPieceCount;
  if (this.movement) {
    this.specialPiece = "";
    minDistribution =
      this.pieceCount === this.distribution ? "" : this.distribution;
    minPieceCount = this.pieceCount === "1" ? "" : this.pieceCount;
  }
  return (
    (minPieceCount || "") +
    (this.specialPiece || "") +
    this.column +
    this.row +
    (this.direction || "") +
    (minDistribution || "") +
    (this.wallSmash || "") +
    (this.evalText || "")
  );
};

// Exported functions

module.exports = {
  createClient() {
    client = new Discord.Client({
      intents: [
        Discord.GatewayIntentBits.Guilds,
        Discord.GatewayIntentBits.GuildMessages,
        Discord.GatewayIntentBits.MessageContent,
      ],
    });
    return client;
  },

  // Helper functions

  validPly(cmd) {
    return /^(\d)?([CcSs])?([a-hA-H])([1-8])(([<>+-])([1-8]+)?\*?)?['"’”?!]*$/i.test(
      cmd
    );
  },

  async handleMove(msg, ply) {
    if (!module.exports.isGameOngoing(msg)) return;

    let gameData = module.exports.getGameData(msg);
    if (!gameData) return;

    if (!module.exports.isPlayer(msg.author.id, gameData)) {
      return;
    }

    if (
      (gameData.turnMarker === "1" && msg.author.id != gameData.player1Id) ||
      (gameData.turnMarker === "2" && msg.author.id != gameData.player2Id)
    ) {
      return module.exports.sendMessage(
        msg,
        "You are not the active player.",
        true
      );
    }

    let canvas;
    try {
      ply = new Ply(ply.replace("’", "'").replace("”", '"')).toString();
      canvas = module.exports.drawBoard(
        gameData,
        module.exports.getTheme(msg),
        ply
      );
    } catch (err) {
      if (!/^Invalid|stones remaining$/.test(err.message)) {
        console.error(err);
      }
      return module.exports.sendMessage(msg, "Invalid move.", true);
    }

    if (gameData.gameId) {
      module.exports.addPlyToPtnFile(gameData.gameId, ply);
    }

    let nextPlayer = gameData.player1Id;
    if (gameData.turnMarker === "1") nextPlayer = gameData.player2Id;

    if (!canvas.isGameEnd) {
      // Game is still in progress
      module.exports.saveGameData(msg, { tps: canvas.id, ply });
      if (!msg.channel.name.includes("🆚")) {
        module.exports.renameChannel(msg, true);
      }
      const message = module.exports.getTurnMessage(gameData, canvas, ply);
      await module.exports.sendPngToDiscord(msg, canvas, message);

      module.exports.clearInactiveTimer(msg);
      module.exports.setInactiveTimer(msg, gameData, canvas);
    } else {
      // Game is over
      const result = canvas.id;
      module.exports.cleanupFiles(msg.channel.id);
      if (gameData.gameId) {
        module.exports.addToHistoryFile({
          gameId: gameData.gameId,
          player1: gameData.player1,
          player2: gameData.player2,
          komi: gameData.komi,
          opening: gameData.opening,
          result: result,
        });
      }
      await module.exports.sendPngToDiscord(
        msg,
        canvas,
        `${ply} | GG <@${nextPlayer}>! Game Ended ${result}\nHere's a link to the completed game:\nID: [${
          gameData.gameId
        }](${module.exports.getLink(gameData.gameId)})`
      );
      module.exports.clearInactiveTimer(msg);
      module.exports.setDeleteTimer(msg);
      return module.exports.renameChannel(msg, false);
    }
  },

  getPlies(gameId) {
    let ptn;
    let filePath = path.join(__dirname, "ptn", `${gameId}.ptn`);
    try {
      ptn = fs.readFileSync(filePath, "utf8");
    } catch (err) {
      if (!err.message.includes("no such file or directory")) {
        console.error(err);
      }
    }
    if (!ptn) {
      throw "Game not found";
    } else {
      return ptn;
    }
  },

  getLink(gameId) {
    return `<https://ptn.ninja/${compressToEncodedURIComponent(
      module.exports.getPlies(gameId)
    )}>`;
  },

  getGameData(msg) {
    const channelDir = path.join(
      __dirname,
      "data",
      msg.channelId || msg.channel.id
    );
    const metaDir = path.join(channelDir, "meta");
    const tpsDir = path.join(channelDir, "tps");
    let data;

    try {
      // Get meta info
      data = JSON.parse(
        fs.readFileSync(path.join(metaDir, "game.json"), "utf8")
      );

      // Get the latest board state
      if (fs.existsSync(tpsDir)) {
        const filename = getLastFilename(msg);
        [data.tps, data.hl] = fs.readFileSync(filename, "utf8").split("\n");
        const parsedTPS = parseTPS(data.tps);
        data.turnMarker = String(parsedTPS.player);
        data.moveNumber = Number(parsedTPS.linenum);
      }
    } catch (err) {
      // On error we assume that the file doesn't exist
    }
    return data;
  },

  saveGameData(msg, { gameData, tps, ply }) {
    const channelDir = path.join(
      __dirname,
      "data",
      msg.channelId || msg.channel.id
    );
    const metaDir = path.join(channelDir, "meta");
    const tpsDir = path.join(channelDir, "tps");

    // Meta data
    if (gameData) {
      try {
        fs.mkdirSync(metaDir, { recursive: true });
        fs.writeFileSync(
          path.join(metaDir, "game.json"),
          JSON.stringify(gameData)
        );
      } catch (err) {
        console.error(err);
      }
    }

    // Board state
    let filename = Date.now() + crypto.randomBytes(2).toString("hex");
    while (filename.length < 19) {
      filename = "0" + filename;
    }
    if (ply) {
      tps += "\n" + ply;
    }
    try {
      fs.mkdirSync(tpsDir, { recursive: true });
      fs.writeFileSync(path.join(tpsDir, filename + ".tps"), tps);
    } catch (err) {
      console.error(err);
    }
  },

  isPlayer(playerId, gameData) {
    return playerId === gameData.player1Id || playerId === gameData.player2Id;
  },

  drawBoard(gameData, theme, ply) {
    let moveNumber = gameData.moveNumber;
    if (!ply && gameData.hl && gameData.turnMarker === "1") {
      moveNumber -= 1;
    }
    let options = {
      ...gameData,
      moveNumber,
      theme,
      bgAlpha: 0,
      padding: false,
      font: "roboto",
    };
    if (ply) {
      options.ply = ply;
    }
    let canvas = TPStoCanvas(options);
    canvas.filename = `${moveNumber || 0}${
      gameData.turnMarker === "2" ? "b" : "w"
    }.png`;
    canvas.komi = gameData.komi;
    canvas.blind = gameData.blind;
    return canvas;
  },

  getTheme(msg) {
    const metaDir = path.join(
      __dirname,
      "data",
      msg.channelId || msg.channel.id,
      "meta"
    );
    try {
      return (
        fs.readFileSync(path.join(metaDir, "theme"), "utf8") || defaultTheme
      );
    } catch (err) {
      if (!err.message.includes("no such file or directory")) {
        console.error(err);
      }
    }
    return defaultTheme;
  },

  setTheme(msg, theme) {
    const metaDir = path.join(
      __dirname,
      "data",
      msg.channelId || msg.channel.id,
      "meta"
    );
    try {
      if (typeof theme !== "string") {
        if (theme.id && theme.isBuildIn) {
          theme = theme.id;
        } else {
          theme = JSON.stringify(theme);
        }
      }
      fs.mkdirSync(metaDir, { recursive: true });
      fs.writeFileSync(path.join(metaDir, "theme"), theme);
      return true;
    } catch (err) {
      module.exports.sendMessage(
        msg,
        "Something went wrong when I tried to save the theme.",
        true
      );
      console.error(err);
      return false;
    }
  },

  getTurnMessage(gameData, canvas, ply = gameData.hl) {
    const nextPlayer = gameData[`player${canvas.player}Id`];
    let message = `Your turn ${canvas.linenum}, <@${nextPlayer}>.`;
    if (ply) {
      const lastPlayer = canvas.player == 1 ? 2 : 1;
      message = ply + " | " + message;
      if (/''|"/.test(ply)) {
        message += "\n*" + gameData[`player${lastPlayer}`];
        message += ply.includes("?")
          ? " thinks that might be"
          : " is pretty sure that's";
        message += " Tinuë.*";
      } else if (/'/.test(ply)) {
        message += "\n*Tak!*";
      }
    } else {
      message +=
        "\nType a valid move in [PTN](<https://ustak.org/portable-tak-notation/>) to play.";
    }
    return message;
  },

  deleteLastTurn(msg, gameData) {
    try {
      fs.unlinkSync(getLastFilename(msg));
      if (gameData.gameId) {
        let filePath = path.join(__dirname, "ptn", `${gameData.gameId}.ptn`);
        let data = fs.readFileSync(filePath, "utf8");
        data = data.substring(0, data.lastIndexOf(" "));
        fs.writeFileSync(filePath, data);
      }
    } catch (err) {
      console.error(err);
    }
  },

  renameChannel(msg, inProgress) {
    return msg.channel
      .setName(
        inProgress
          ? msg.channel.name.replace("-vs-", "-🆚-")
          : msg.channel.name.replace("-🆚-", "-vs-")
      )
      .catch((err) => console.error(err));
  },

  isGameChannel(msg) {
    return fs.existsSync(
      path.join(
        __dirname,
        "data",
        msg.channelId || msg.channel.id,
        "meta",
        "game.json"
      )
    );
  },

  isGameOngoing(msg) {
    return fs.existsSync(
      path.join(__dirname, "data", msg.channelId || msg.channel.id, "tps")
    );
  },

  cleanupFiles(channelId, channelDeleted = false) {
    const channelDir = path.join(__dirname, "data", channelId);
    try {
      if (channelDeleted) {
        fs.rmSync(channelDir, { recursive: true, force: true });
      } else {
        if (!fs.existsSync(channelDir)) {
          return false;
        } else {
          return fs.rmSync(path.join(channelDir, "tps"), {
            recursive: true,
            force: true,
          });
        }
      }
      // Clean up timers
      if (channelId in deleteTimers) {
        clearTimer("delete", channelId);
      }
      if (channelId in inactiveTimers) {
        clearTimer("inactive", channelId);
      }
      Object.keys(reminderTimers).forEach((id) => {
        if (id.startsWith(channelId + ".")) {
          clearTimer("reminder", channelId, id.split(".")[1]);
        }
      });
    } catch (err) {
      console.error(err);
    }
  },

  createPtnFile(gameData) {
    const ptnDir = path.join(__dirname, "ptn");
    try {
      fs.mkdirSync(ptnDir, { recursive: true });
    } catch (err) {
      console.error(err);
    }

    let gameId = Date.now() + crypto.randomBytes(2).toString("hex");
    let filePath = path.join(ptnDir, `${gameId}.ptn`);
    let data =
      tagDateTime() +
      `[Site "https://github.com/humanat/takBot"]\n` +
      `[Player1 "${gameData.player1}"]\n` +
      `[Player2 "${gameData.player2}"]\n` +
      `[Size "${gameData.size}"]\n`;
    if (gameData.komi) {
      data += `[Komi "${gameData.komi}"]\n`;
    }
    if (gameData.opening != "swap") {
      data += `[Opening "${gameData.opening}"]\n`;
    }
    if (gameData.initialTPS) {
      data += `[TPS "${gameData.initialTPS}"]\n`;
    }
    if (gameData.caps) {
      data += `[caps "${gameData.caps}"]\n`;
    }
    if (gameData.flats) {
      data += `[flats "${gameData.flats}"]\n`;
    }
    try {
      fs.writeFileSync(filePath, data);
    } catch (err) {
      console.error(err);
    }
    return gameId;
  },

  deletePtnFile(gameData) {
    if (!gameData || !gameData.gameId) {
      return false;
    }
    try {
      fs.unlinkSync(path.join(__dirname, "ptn", `${gameData.gameId}.ptn`));
    } catch (err) {
      console.error(err);
    }
    return true;
  },

  addPlyToPtnFile(gameId, ply) {
    const filePath = path.join(__dirname, "ptn", `${gameId}.ptn`);
    try {
      let data = fs.readFileSync(filePath, "utf8");
      data += " " + ply;
      fs.writeFileSync(filePath, data);
    } catch (err) {
      console.error(err);
    }
  },

  addToHistoryFile({ gameId, player1, player2, komi, opening, result }) {
    let historyFilename = path.join(__dirname, "results.db");
    let ptnFilename = path.join(__dirname, "ptn", `${gameId}.ptn`);
    let resultString = `${gameId}, ${player1}, ${player2}, ${komi}, ${opening}, ${result}\n`;
    try {
      fs.appendFileSync(historyFilename, resultString);
      // Update PTN
      let data = fs.readFileSync(ptnFilename, "utf8").replace(/\]\[/g, "]\n[");
      let lastTag = data.indexOf(/\]\s+[!\[]/) + 1;
      data =
        data.substring(0, lastTag) +
        tagDateTime() +
        `[Result "${result}"]\n` +
        data.substring(lastTag) +
        "\n" +
        result;
      fs.writeFileSync(ptnFilename, data);
    } catch (err) {
      console.error(err);
    }
  },

  getHistoryFromFile(page) {
    try {
      if (isNaN(page) || page < 1) {
        return;
      }
      let filename = path.join(__dirname, "results.db");
      let gamesPerPage = 10;
      let history = fs.readFileSync(filename, "utf8");
      let historyArray = history.split("\n");
      let header = historyArray[0];
      historyArray.shift();
      while (historyArray[historyArray.length - 1] == "") {
        historyArray.pop();
      }
      let numPages = Math.ceil(historyArray.length / gamesPerPage);
      if (page > numPages) {
        return;
      }
      historyArray = historyArray.reverse();
      historyArray = historyArray.slice(
        (page - 1) * gamesPerPage,
        page * gamesPerPage
      );
      history =
        `Page ${page} of ${numPages}\n\n${header}\n` + historyArray.join("\n");
      return history;
    } catch (err) {
      console.error(err);
    }
  },

  async handleDelete(msg, playerId) {
    const channel = msg.channel;
    if (!channel) {
      console.log("Channel not found:", channel.id);
      return;
    }
    if (module.exports.isGameOngoing(msg)) {
      return module.exports.sendMessage(
        msg,
        "There is an ongoing game in this channel! If you're sure you about this, please use `/end` first, then try again.",
        true
      );
    } else {
      if (!module.exports.isGameChannel(msg)) {
        return module.exports.sendMessage(
          msg,
          "I can't delete this channel.",
          true
        );
      } else {
        try {
          await module.exports.sendMessage(
            msg,
            "Deleting channel. Please be patient, as this sometimes takes a while.",
            true
          );
          return channel.delete();
        } catch (err) {
          console.error(err);
          return module.exports.sendMessage(
            msg,
            "Sorry, I wasn't able to delete the channel; something went wrong.",
            true
          );
        }
      }
    }
  },

  async setTimer(timer, channelId) {
    let { type, timestamp, playerId, interval, seed, index } = timer;
    let channel;
    try {
      channel = await client.channels.fetch(channelId);
    } catch (err) {
      console.log("Channel not found:", channelId);
      return false;
    }
    const delay = timestamp * 1e3 - new Date().getTime();
    switch (type) {
      case "delete":
        deleteTimers[channelId] = setTimeout(
          module.exports.handleDelete,
          delay,
          { channel },
          playerId
        );
        break;
      case "inactive":
        if (!seed) {
          seed = Math.random() * 1e4;
        }
        if (!index) {
          index = 0;
        }
        inactiveTimers[channelId] = setTimeout(() => {
          module.exports.sendMessage(
            { channel },
            getInactiveMessage(playerId, seed, index),
            true
          );
          if (!interval) {
            interval = DELETE_TIMER_MS;
          }
          timestamp = Math.round((new Date().getTime() + interval) / 1e3);
          index = (index + 1) % INACTIVE_MESSAGES.length;
          createTimer(
            { type, timestamp, playerId, interval, seed, index },
            channelId
          );
        }, delay);
        break;
      case "reminder":
        reminderTimers[`${channelId}.${timestamp}`] = setTimeout(() => {
          module.exports.sendMessage(
            { channel },
            `Hey <@${playerId}>, you wanted me to remind you about this channel.`,
            true
          );
          clearTimer(type, channelId, timestamp);
        }, delay);
        break;
    }
    return true;
  },

  async setDeleteTimer(msg) {
    const delay = DELETE_TIMER_MS;
    const timestamp = Math.round((new Date().getTime() + delay) / 1e3);
    await msg.channel.send(
      `This channel will self-destruct <t:${timestamp}:R> unless a new game is started.`
    );
    createTimer(
      {
        type: "delete",
        timestamp,
        playerId: msg.author ? msg.author.id : msg.member.id,
      },
      msg.channelId || msg.channel.id
    );
  },

  clearDeleteTimer(msg) {
    clearTimer("delete", msg.channelId || msg.channel.id);
  },

  setInactiveTimer(msg, gameData, canvas) {
    const interval = gameData.inactiveInterval || DELETE_TIMER_MS;
    if (interval < 0) {
      // Reminders disabled
      return;
    }
    const timestamp = Math.round((new Date().getTime() + interval) / 1e3);
    createTimer(
      {
        type: "inactive",
        timestamp,
        playerId: gameData[`player${canvas.player}Id`],
        interval,
      },
      msg.channelId || msg.channel.id
    );
  },

  clearInactiveTimer(msg) {
    clearTimer("inactive", msg.channelId || msg.channel.id);
  },

  async setReminder(msg, delay) {
    const timestamp = Math.round((new Date().getTime() + delay) / 1e3);
    await module.exports.sendMessage(
      msg,
      `OK, I will ping you in this channel <t:${timestamp}:R>.`
    );
    createTimer(
      {
        type: "reminder",
        timestamp,
        playerId: msg.author ? msg.author.id : msg.member.id,
      },
      msg.channelId || msg.channel.id
    );
  },

  // Functions to send to Discord

  async sendPngToDiscord(msg, canvas, message) {
    const files = [];
    if (!canvas.blind) {
      files.push(
        new Discord.AttachmentBuilder(canvas.toBuffer(), {
          name: canvas.filename,
          description: `${canvas.id} ${canvas.komi}`,
        })
      );
    }

    try {
      const content = {
        content: message,
        files,
      };
      if (!msg.type || !msg.reply) {
        // Normal message
        await msg.channel.send(content);
      } else {
        // Assume slash command interaction
        await msg.reply(content);
      }
    } catch (err) {
      console.error(err);
    }
  },

  async sendMessage(msg, content, ephemeral = false) {
    try {
      const send =
        msg.reply && !msg.replied && !msg.deferred
          ? (content) => msg.reply({ content, ephemeral })
          : (content) => msg.channel.send(content);
      if (typeof content == "string" && content.length <= 2000) {
        await send(content);
      } else {
        await send("I wanted to send a message but it was too long 😢");
      }
    } catch (err) {
      console.error(err);
    }
  },

  async sendHelp(msg) {
    let help = fs.readFileSync(path.join(__dirname, "USAGE.md"), "utf8");
    help = help.substring(help.indexOf("\n") + 1);
    return module.exports.sendMessage(msg, help, true);
  },
};
