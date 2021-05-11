/* eslint-disable quotes,no-undef */

const { app, BrowserWindow, Menu, MenuItem, ipcMain, shell } = require("electron");
const path = require("path");
const url = require("url");
const fs = require("fs");
const steam = require("./steam");
const asyncLock = require("async-lock");

const isDev = process.argv.indexOf("--dev") >= 0;
const isLocal = process.argv.indexOf("--local") >= 0;

const protocol = "shapezio";

const roamingFolder =
    process.env.APPDATA ||
    (process.platform == "darwin"
        ? process.env.HOME + "/Library/Preferences"
        : process.env.HOME + "/.local/share");
const shapezIOFolder = path.join(roamingFolder, "shapez.io");
let storePath = path.join(shapezIOFolder, "saves");

if (!fs.existsSync(storePath))
    // No try-catch by design
    fs.mkdirSync(storePath, { recursive: true });

/** @type {BrowserWindow} */
let win = null;
let menu = null;

function createWindow() {
    let faviconExtension = ".png";
    if (process.platform === "win32") {
        faviconExtension = ".ico";
    }

    win = new BrowserWindow({
        width: 1280,
        height: 800,
        show: false,
        backgroundColor: "#222428",
        useContentSize: true,
        minWidth: 800,
        minHeight: 600,
        title: "shapez.io Standalone",
        transparent: false,
        icon: path.join(__dirname, "favicon" + faviconExtension),
        // fullscreen: true,
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: true,
            webSecurity: false,
        },
        allowRunningInsecureContent: false,
    });

    if (isLocal) {
        win.loadURL("http://localhost:3005");
    } else {
        win.loadURL(
            url.format({
                pathname: path.join(__dirname, "index.html"),
                protocol: "file:",
                slashes: true,
            })
        );
    }
    win.webContents.session.clearCache();
    win.webContents.session.clearStorageData();

    win.webContents.on("new-window", (event, pth) => {
        event.preventDefault();
        shell.openExternal(pth);
    });

    win.on("closed", () => {
        console.log("Window closed");
        win = null;
        app.quit();
    });

    function handleWindowBeforeunload(event) {
        const confirmed = dialog.showMessageBox(remote.getCurrentWindow(), options) === 1;
        if (confirmed) {
            remote.getCurrentWindow().close();
        } else {
            event.returnValue = false;
        }
    }

    win.on("", handleWindowBeforeunload);

    if (isDev) {
        menu = new Menu();

        const mainItem = new MenuItem({
            label: "Toggle Dev Tools",
            click: () => win.toggleDevTools(),
            accelerator: "F12",
        });
        menu.append(mainItem);

        const reloadItem = new MenuItem({
            label: "Restart",
            click: () => win.reload(),
            accelerator: "F5",
        });
        menu.append(reloadItem);

        const fullscreenItem = new MenuItem({
            label: "Fullscreen",
            click: () => win.setFullScreen(!win.isFullScreen()),
            accelerator: "F11",
        });
        menu.append(fullscreenItem);

        Menu.setApplicationMenu(menu);
    } else {
        Menu.setApplicationMenu(null);
    }

    win.once("ready-to-show", () => {
        win.show();
        win.focus();
    });

    if (process.platform == "win32" && process.argv.length >= 2) {
        emitOpenedWithFile(process.argv[1]);
    }
}

if (!app.requestSingleInstanceLock()) {
    app.exit(0);
} else {
    app.on("second-instance", (event, commandLine, workingDirectory) => {
        if (process.platform !== "darwin") {
            // Find the arg that is our custom protocol url and emit event
            emitProtocol(argv.find(arg => arg.startsWith(`${protocol}://`)));
        }

        // Someone tried to run a second instance, we should focus
        if (win) {
            if (win.isMinimized()) {
                win.restore();
            }
            win.focus();
        }
    });
}

if (isDev && process.platform === "win32") {
    // Set the path of electron.exe and your app.
    // These two additional parameters are only available on windows.
    // Setting this is required to get this working in dev mode.
    app.setAsDefaultProtocolClient(protocol, process.execPath, [path.resolve(process.argv[1])]);
} else {
    app.setAsDefaultProtocolClient(protocol);
}

app.on("open-file", function (event, path) {
    event.preventDefault();
    emitOpenedWithFile(path);
});

app.on("open-url", function (event, url) {
    event.preventDefault();
    emitProtocol(url);
});

app.on("ready", createWindow);

app.on("window-all-closed", () => {
    console.log("All windows closed");
    app.quit();
});

ipcMain.on("set-fullscreen", (event, flag) => {
    win.setFullScreen(flag);
});

ipcMain.on("exit-app", (event, flag) => {
    win.close();
    app.quit();
});

let renameCounter = 1;

const fileLock = new asyncLock({
    timeout: 30000,
    maxPending: 1000,
});

function niceFileName(filename) {
    return filename.replace(storePath, "@");
}

async function writeFileSafe(filename, contents) {
    ++renameCounter;
    const prefix = "[ " + renameCounter + ":" + niceFileName(filename) + " ] ";
    const transactionId = String(new Date().getTime()) + "." + renameCounter;

    if (fileLock.isBusy()) {
        console.warn(prefix, "Concurrent write process on", filename);
    }

    fileLock.acquire(filename, async () => {
        console.log(prefix, "Starting write on", niceFileName(filename), "in transaction", transactionId);

        if (!fs.existsSync(filename)) {
            // this one is easy
            console.log(prefix, "Writing file instantly because it does not exist:", niceFileName(filename));
            await fs.promises.writeFile(filename, contents, { encoding: "utf8" });
            return;
        }

        // first, write a temporary file (.tmp-XXX)
        const tempName = filename + ".tmp-" + transactionId;
        console.log(prefix, "Writing temporary file", niceFileName(tempName));
        await fs.promises.writeFile(tempName, contents, { encoding: "utf8" });

        // now, rename the original file to (.backup-XXX)
        const oldTemporaryName = filename + ".backup-" + transactionId;
        console.log(
            prefix,
            "Renaming old file",
            niceFileName(filename),
            "to",
            niceFileName(oldTemporaryName)
        );
        await fs.promises.rename(filename, oldTemporaryName);

        // now, rename the temporary file (.tmp-XXX) to the target
        console.log(
            prefix,
            "Renaming the temporary file",
            niceFileName(tempName),
            "to the original",
            niceFileName(filename)
        );
        await fs.promises.rename(tempName, filename);

        // we are done now, try to create a backup, but don't fail if the backup fails
        try {
            // check if there is an old backup file
            const backupFileName = filename + ".backup";
            if (fs.existsSync(backupFileName)) {
                console.log(prefix, "Deleting old backup file", niceFileName(backupFileName));
                // delete the old backup
                await fs.promises.unlink(backupFileName);
            }

            // rename the old file to the new backup file
            console.log(prefix, "Moving", niceFileName(oldTemporaryName), "to the backup file location");
            await fs.promises.rename(oldTemporaryName, backupFileName);
        } catch (ex) {
            console.error(prefix, "Failed to switch backup files:", ex);
        }
    });
}

async function performFsJob(job) {
    let parent = storePath;

    if (job.folder) parent = path.join(shapezIOFolder, job.folder);

    const fname = path.join(parent, job.filename);
    const relative = path.relative(shapezIOFolder, fname);

    //If not a child of parent
    if (!relative && !relative.startsWith("..") && !path.isAbsolute(relative))
        return {
            error: "Cannot get above parent folder",
        };

    if (!fs.existsSync(parent)) fs.mkdirSync(parent, { recursive: true });

    switch (job.type) {
        case "readDir": {
            let contents = "";
            try {
                contents = fs.readdirSync(fname, { encoding: "utf8" });
            } catch (ex) {
                return {
                    error: ex,
                };
            }
            return {
                success: true,
                data: contents,
            };
        }
        case "read": {
            if (!fs.existsSync(fname)) {
                return {
                    // Special FILE_NOT_FOUND error code
                    error: "file_not_found",
                };
            }

            try {
                const data = await fs.promises.readFile(fname, { encoding: "utf8" });
                return {
                    success: true,
                    data,
                };
            } catch (ex) {
                return {
                    error: ex,
                };
            }
        }
        case "write": {
            try {
                await writeFileSafe(fname, job.contents);
                return {
                    success: true,
                    data: job.contents,
                };
            } catch (ex) {
                return {
                    error: ex,
                };
            }
        }

        case "delete": {
            try {
                await fs.promises.unlink(fname);
            } catch (ex) {
                return {
                    error: ex,
                };
            }

            return {
                success: true,
                data: null,
            };
        }

        default:
            throw new Error("Unkown fs job: " + job.type);
    }
}

ipcMain.handle("fs-job", (event, arg) => performFsJob(arg));

const emitProtocol = url => {
    const protocol = url.split("://")[0],
        args = url.split("://")[1];
    ipcMain.emit("protocol-request", protocol, args.split("/"));
};

const emitOpenedWithFile = path => {
    const content = fs.readFileSync(path, "utf-8");
    ipcMain.emit("opened-with-file", path, content);
};

steam.init(isDev);
steam.listen();
