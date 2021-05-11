const fs = require("fs");
const path = require("path");
const { ipcMain } = require("electron");

let greenworks = null;
let appId = null;
let initialized = false;

try {
    greenworks = require("shapez.io-private-artifacts/steam/greenworks");
    appId = parseInt(fs.readFileSync(path.join(__dirname, "steam_appid.txt"), "utf8"));
} catch (err) {
    // greenworks is not installed
    // throw err;
}

function init(isDev) {
    if (!greenworks) {
        return;
    }

    if (!isDev) {
        if (greenworks.restartAppIfNecessary(appId)) {
            console.log("Restarting ...");
            process.exit(0);
        }
    }

    if (!greenworks.init()) {
        console.log("Failed to initialize greenworks");
        process.exit(1);
    }

    initialized = true;
}

function listen() {
    ipcMain.handle("steam:is-initialized", isInitialized);

    if (!greenworks || !initialized) {
        console.log("Ignoring Steam IPC events");
        return;
    }

    ipcMain.handle("steam:get-achievement-names", getAchievementNames);
    ipcMain.handle("steam:activate-achievement", activateAchievement);
}

function isInitialized(event) {
    return Promise.resolve(initialized);
}

function getAchievementNames(event) {
    return new Promise((resolve, reject) => {
        try {
            const achievements = greenworks.getAchievementNames();
            resolve(achievements);
        } catch (err) {
            reject(err);
        }
    });
}

function activateAchievement(event, id) {
    return new Promise((resolve, reject) => {
        greenworks.activateAchievement(
            id,
            () => resolve(),
            err => reject(err)
        );
    });
}

module.exports = {
    init,
    listen,
};
