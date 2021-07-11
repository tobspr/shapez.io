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
    console.warn("Failed to load steam api:", err);
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

    if (!initialized) {
        console.warn("Steam not initialized, won't be able to listen");
        return;
    }

    if (!greenworks) {
        console.warn("Greenworks not loaded, won't be able to listen");
        return;
    }

    console.log("Adding listeners");

    ipcMain.handle("steam:get-achievement-names", getAchievementNames);
    ipcMain.handle("steam:get-achievement", getAchievement);
    ipcMain.handle("steam:activate-achievement", activateAchievement);
    ipcMain.handle("steam:deactivate-achievement", deactivateAchievement);

    function bufferToHex(buffer) {
        return Array.from(new Uint8Array(buffer))
            .map(b => b.toString(16).padStart(2, "0"))
            .join("");
    }

    ipcMain.handle("steam:get-ticket", (event, arg) => {
        console.log("Requested steam ticket ...");
        return new Promise((resolve, reject) => {
            greenworks.getAuthSessionTicket(
                success => {
                    const ticketHex = bufferToHex(success.ticket);
                    resolve(ticketHex);
                },
                error => {
                    console.error("Failed to get steam ticket:", error);
                    reject(error);
                }
            );
        });
    });

    ipcMain.handle("steam:check-app-ownership", (event, appId) => {
        return Promise.resolve(greenworks.isDLCInstalled(appId));
    });
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

function getAchievement(event, id) {
    return new Promise((resolve, reject) => {
        greenworks.getAchievement(
            id,
            () => resolve(),
            err => reject(err)
        );
    });
}

function activateAchievement(event, id) {
    return new Promise((resolve, reject) => {
        greenworks.activateAchievement(
            id,
            is_achieved => resolve(is_achieved),
            err => reject(err)
        );
    });
}

function deactivateAchievement(event, id) {
    return new Promise((resolve, reject) => {
        greenworks.clearAchievement(
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
