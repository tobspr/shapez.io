import { getIPCRenderer } from "../core/utils";
import { matchOverwriteRecursive } from "../translations";
import { ShapezAPI } from "./mod";
import { matchOverwriteRecursiveSettings } from "./overwrite";

/**
 * @typedef {{
 *  mods: [
 *      {
 *          url: string,
 *          id: string,
 *          config: {},
 *          settings: {},
 *      },
 *  ],
 *  modOrder?: [],
 * }} ModPack
 */

const Toposort = require("toposort-class");

const INFOType = {
    title: "",
    id: "",
    description: "",
    authors: [],
    version: "",
    gameVersion: 0,
    dependencies: [],
    incompatible: [],
    translations: {},
    settings: {},
    updateStaticSettings: () => {},
    updateStaticTranslations: id => {},
    gameInitializedRootClasses: root => {},
    gameInitializedRootManagers: root => {},
    gameBeforeFirstUpdate: root => {},
    main: () => {},
};

export class ModManager {
    /**
     *
     * @param {ModPack} modPack
     */
    constructor(user, modPack = undefined) {
        /** @type {Map<String, import("./mod").ModInfo>} */
        this.mods = new Map();

        this.modPack = modPack;

        window["shapezAPI"] = new ShapezAPI(user);

        /**
         * Registers a mod
         * @param {import("./mod").ModInfo} mod
         */
        window["registerMod"] = mod => {
            this.registerMod(mod);
        };
    }

    registerMod(mod) {
        for (const key in INFOType) {
            if (!INFOType.hasOwnProperty(key)) continue;
            if (mod.hasOwnProperty(key)) continue;

            if (mod.id) console.warn("Mod with mod id: " + mod.id + " has no " + key + " specified");
            else console.warn("Unknown mod has no " + key + " specified");

            return;
        }

        if (!mod.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
            console.warn("Mod with mod id: " + mod.id + " has no uuid");
            return;
        }

        if (this.mods.has(mod.id)) {
            console.warn("Mod with mod id: " + mod.id + " already registerd");
            return;
        }

        this.mods.set(mod.id, mod);
    }

    /**
     * Adds a mod to the page
     * @param {String} url
     * @returns {Promise}
     */
    addMod(url, fromFile = false) {
        if (fromFile && G_IS_STANDALONE) {
            return new Promise((resolve, reject) => {
                getIPCRenderer()
                    .invoke("fs-job", {
                        folder: "mods",
                        type: "read",
                        filename: url,
                    })
                    .then(modCodeResult => {
                        if (!modCodeResult.success) return reject("Mod is invalid");

                        const modCode = modCodeResult.data;
                        const modScript = document.createElement("script");
                        modScript.textContent = modCode;
                        modScript.type = "text/javascript";
                        try {
                            document.head.appendChild(modScript);
                            resolve();
                        } catch (ex) {
                            console.error("Failed to insert mod, bad js:", ex);
                            this.nextModResolver = null;
                            this.nextModRejector = null;
                            reject("Mod is invalid");
                        }
                    });
            });
        } else
            return Promise.race([
                new Promise((resolve, reject) => {
                    setTimeout(reject, 60 * 1000);
                }),
                fetch(url, {
                    method: "GET",
                    cache: "no-cache",
                }),
            ])
                .then(res => res.text())
                .catch(err => {
                    assert(this, "Failed to load mod:", err);
                    return Promise.reject("Downloading from '" + url + "' timed out");
                })
                .then(modCode => {
                    return Promise.race([
                        new Promise((resolve, reject) => {
                            setTimeout(reject, 60 * 1000);
                        }),
                        new Promise((resolve, reject) => {
                            this.nextModResolver = resolve;
                            this.nextModRejector = reject;

                            const modScript = document.createElement("script");
                            modScript.textContent = modCode;
                            modScript.type = "text/javascript";
                            try {
                                document.head.appendChild(modScript);
                                resolve();
                            } catch (ex) {
                                console.error("Failed to insert mod, bad js:", ex);
                                this.nextModResolver = null;
                                this.nextModRejector = null;
                                reject("Mod is invalid");
                            }
                        }),
                    ]);
                })
                .catch(err => {
                    assert(this, "Failed to initializing mod:", err);
                    return Promise.reject("Initializing mod failed: " + err);
                });
    }

    addModPackMods() {
        if (this.modPack && this.modPack.mods) {
            let promise = Promise.resolve(null);

            for (let i = 0; i < this.modPack.mods.length; i++) {
                if (this.modPack.mods[i].url) {
                    promise = promise.then(() => {
                        return this.addMod(this.modPack.mods[i].url);
                    });
                }
            }
            return promise;
        }
        return Promise.reject();
    }

    /**
     * Adds a mod to the page
     * @param {Array<String>} urls
     */
    addMods(urls) {
        let promise = Promise.resolve(null);

        for (let i = 0; i < urls.length; ++i) {
            const url = urls[i];

            promise = promise.then(() => {
                return this.addMod(url);
            });
        }

        return promise;
    }

    /**
     * Loads all mods in the mods list
     */
    loadMods() {
        shapezAPI.mods = this.mods;

        if (!this.modPack || !this.modPack.modOrder) {
            var sorter = new Toposort();
            for (const [id, mod] of this.mods.entries()) {
                let isMissingDependecie = false;
                let missingDependecie = "";
                for (let i = 0; i < mod.dependencies.length; i++) {
                    const dependencie = mod.dependencies[i];
                    if (this.mods.has(dependencie)) continue;
                    isMissingDependecie = true;
                    missingDependecie = dependencie;
                }

                if (isMissingDependecie) {
                    console.warn(
                        "Mod with mod id: " +
                            mod.id +
                            " is disabled because it's missings the dependecie " +
                            missingDependecie
                    );
                    continue;
                } else sorter.add(id, mod.dependencies);
            }
            shapezAPI.modOrder = sorter.sort().reverse();
        } else {
            /** @typedef {string[]} */
            shapezAPI.modOrder = this.modPack.modOrder;
            for (const [id, mod] of this.mods.entries()) {
                if (shapezAPI.modOrder.includes(id)) continue;
                shapezAPI.modOrder.push(id);
            }
        }

        for (let i = 0; i < shapezAPI.modOrder.length; i++) {
            this.loadMod(shapezAPI.modOrder[i]);
        }
    }

    /**
     * Calls the main mod function
     * @param {String} id
     */
    loadMod(id) {
        var mod = this.mods.get(id);
        for (const [id, currentMod] of this.mods.entries()) {
            if (mod.incompatible.indexOf(id) >= 0) {
                console.warn(
                    "Mod with mod id: " + mod.id + " is disabled because it's incompatible with " + id
                );
                return;
            }
        }
        const language = mod.translations["en"];
        if (language) {
            matchOverwriteRecursive(shapezAPI.translations, language);
        }

        if (this.modPack && this.modPack.mods) {
            const settings = this.modPack.mods.find(mod => mod.id === id).settings;
            if (settings) {
                matchOverwriteRecursiveSettings(mod.settings, settings);
            }
        }

        if (this.modPack && this.modPack.mods) mod.main(this.modPack.mods.find(mod => mod.id === id).config);
        else mod.main();
    }
}
