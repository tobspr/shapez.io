/* typehints:start */
import { Application } from "../application";
/* typehints:end */

import { ReadWriteProxy } from "../core/read_write_proxy";
import { BoolSetting, EnumSetting, RangeSetting, BaseSetting } from "./setting_types";
import { createLogger } from "../core/logging";
import { ExplainedResult } from "../core/explained_result";
import { applyGameTheme } from "../game/theme";
import { T } from "../translations";
import { LANGUAGES } from "../languages";
import { globalConfig, IS_DEBUG } from "../core/config";

const logger = createLogger("application_settings");

/**
 * @enum {string}
 */
export const enumCategories = {
    general: "general",
    userInterface: "userInterface",
    performance: "performance",
    advanced: "advanced",
    debug: "debug",
};

export const uiScales = [
    {
        id: "super_small",
        size: 0.6,
    },
    {
        id: "small",
        size: 0.8,
    },
    {
        id: "regular",
        size: 1,
    },
    {
        id: "large",
        size: 1.05,
    },
    {
        id: "huge",
        size: 1.1,
    },
];

export const scrollWheelSensitivities = [
    {
        id: "super_slow",
        scale: 0.25,
    },
    {
        id: "slow",
        scale: 0.5,
    },
    {
        id: "regular",
        scale: 1,
    },
    {
        id: "fast",
        scale: 2,
    },
    {
        id: "super_fast",
        scale: 4,
    },
];

export const movementSpeeds = [
    {
        id: "super_slow",
        multiplier: 0.25,
    },
    {
        id: "slow",
        multiplier: 0.5,
    },
    {
        id: "regular",
        multiplier: 1,
    },
    {
        id: "fast",
        multiplier: 2,
    },
    {
        id: "super_fast",
        multiplier: 4,
    },
    {
        id: "extremely_fast",
        multiplier: 8,
    },
];

export const autosaveIntervals = [
    {
        id: "one_minute",
        seconds: 60,
    },
    {
        id: "two_minutes",
        seconds: 120,
    },
    {
        id: "five_minutes",
        seconds: 5 * 60,
    },
    {
        id: "ten_minutes",
        seconds: 10 * 60,
    },
    {
        id: "twenty_minutes",
        seconds: 20 * 60,
    },
    {
        id: "disabled",
        seconds: null,
    },
];

const refreshRateOptions = ["30", "60", "120", "180", "240"];

if (G_IS_DEV) {
    refreshRateOptions.unshift("10");
    refreshRateOptions.unshift("5");
    refreshRateOptions.push("1000");
    refreshRateOptions.push("2000");
    refreshRateOptions.push("5000");
    refreshRateOptions.push("10000");
}

export const allApplicationSettings = () => {
    const allApplicationSettings = [
        new EnumSetting("language", {
            options: Object.keys(LANGUAGES),
            valueGetter: key => key,
            textGetter: key => LANGUAGES[key].name,
            category: enumCategories.general,
            restartRequired: true,
            changeCb: (app, id) => null,
            magicValue: "auto-detect",
        }),

        new EnumSetting("uiScale", {
            options: uiScales.sort((a, b) => a.size - b.size),
            valueGetter: scale => scale.id,
            textGetter: scale => T.settings.labels.uiScale.scales[scale.id],
            category: enumCategories.userInterface,
            restartRequired: false,
            changeCb:
                /**
                 * @param {Application} app
                 */
                (app, id) => app.updateAfterUiScaleChanged(),
        }),

        new RangeSetting(
            "soundVolume",
            enumCategories.general,
            /**
             * @param {Application} app
             */
            (app, value) => app.sound.setSoundVolume(value)
        ),
        new RangeSetting(
            "musicVolume",
            enumCategories.general,
            /**
             * @param {Application} app
             */
            (app, value) => app.sound.setMusicVolume(value)
        ),

        new BoolSetting(
            "fullscreen",
            enumCategories.general,
            /**
             * @param {Application} app
             */
            (app, value) => {
                if (app.platformWrapper.getSupportsFullscreen()) {
                    app.platformWrapper.setFullscreen(value);
                }
            },
            /**
             * @param {Application} app
             */
            app => app.restrictionMgr.getHasExtendedSettings()
        ),

        new BoolSetting(
            "enableColorBlindHelper",
            enumCategories.general,
            /**
             * @param {Application} app
             */
            (app, value) => null
        ),

        new BoolSetting("offerHints", enumCategories.userInterface, (app, value) => {}),

        new EnumSetting("theme", {
            options: Object.keys(shapezAPI.themes),
            valueGetter: theme => theme,
            textGetter: theme => T.settings.labels.theme.themes[theme],
            category: enumCategories.userInterface,
            restartRequired: false,
            changeCb:
                /**
                 * @param {Application} app
                 */
                (app, id) => {
                    applyGameTheme(id);
                    document.documentElement.setAttribute("data-theme", id);
                },
            enabledCb:
                /**
                 * @param {Application} app
                 */
                app => app.restrictionMgr.getHasExtendedSettings(),
        }),

        new EnumSetting("autosaveInterval", {
            options: autosaveIntervals,
            valueGetter: interval => interval.id,
            textGetter: interval => T.settings.labels.autosaveInterval.intervals[interval.id],
            category: enumCategories.advanced,
            restartRequired: false,
            changeCb:
                /**
                 * @param {Application} app
                 */
                (app, id) => null,
        }),

        new EnumSetting("scrollWheelSensitivity", {
            options: scrollWheelSensitivities.sort((a, b) => a.scale - b.scale),
            valueGetter: scale => scale.id,
            textGetter: scale => T.settings.labels.scrollWheelSensitivity.sensitivity[scale.id],
            category: enumCategories.advanced,
            restartRequired: false,
            changeCb:
                /**
                 * @param {Application} app
                 */
                (app, id) => app.updateAfterUiScaleChanged(),
        }),

        new EnumSetting("movementSpeed", {
            options: movementSpeeds.sort((a, b) => a.multiplier - b.multiplier),
            valueGetter: multiplier => multiplier.id,
            textGetter: multiplier => T.settings.labels.movementSpeed.speeds[multiplier.id],
            category: enumCategories.advanced,
            restartRequired: false,
            changeCb: (app, id) => {},
        }),

        new BoolSetting("enableMousePan", enumCategories.advanced, (app, value) => {}),
        new BoolSetting("alwaysMultiplace", enumCategories.advanced, (app, value) => {}),
        new BoolSetting("zoomToCursor", enumCategories.advanced, (app, value) => {}),
        new BoolSetting("clearCursorOnDeleteWhilePlacing", enumCategories.advanced, (app, value) => {}),
        new BoolSetting("enableTunnelSmartplace", enumCategories.advanced, (app, value) => {}),
        new BoolSetting("vignette", enumCategories.userInterface, (app, value) => {}),
        new BoolSetting("compactBuildingInfo", enumCategories.userInterface, (app, value) => {}),
        new BoolSetting("disableCutDeleteWarnings", enumCategories.advanced, (app, value) => {}),
        new BoolSetting("rotationByBuilding", enumCategories.advanced, (app, value) => {}),
        new BoolSetting("displayChunkBorders", enumCategories.advanced, (app, value) => {}),
        new BoolSetting("pickMinerOnPatch", enumCategories.advanced, (app, value) => {}),
        new RangeSetting("mapResourcesScale", enumCategories.advanced, () => null),

        new EnumSetting("refreshRate", {
            options: refreshRateOptions,
            valueGetter: rate => rate,
            textGetter: rate => rate + " Hz",
            category: enumCategories.performance,
            restartRequired: false,
            changeCb: (app, id) => {},
            enabledCb:
                /**
                 * @param {Application} app
                 */
                app => app.restrictionMgr.getHasExtendedSettings(),
        }),

        new BoolSetting("lowQualityMapResources", enumCategories.performance, (app, value) => {}),
        new BoolSetting("disableTileGrid", enumCategories.performance, (app, value) => {}),
        new BoolSetting("lowQualityTextures", enumCategories.performance, (app, value) => {}),
        new BoolSetting("simplifiedBelts", enumCategories.performance, (app, value) => {}),
    ];

    if (IS_DEBUG) {
        for (let k in globalConfig.debug) {
            if (k.startsWith("_")) continue;
            const setting = new BoolSetting(`debug_${k}`, enumCategories.debug, (app, value) => {
                globalConfig.debug[k] = value;
            });
            setting.validate = () => true;
            T.settings.labels[`debug_${k}`] = {
                title: k.replace(/(?!^)([A-Z])/g, " $1"),
                description: globalConfig.debug[`_${k}`],
            };
            allApplicationSettings.push(setting);
        }
    }

    return allApplicationSettings;
};

export function getApplicationSettingById(id) {
    return allApplicationSettings().find(setting => setting.id === id);
}

class SettingsStorage {
    constructor() {
        this.uiScale = "regular";
        this.fullscreen = G_IS_STANDALONE;

        this.soundVolume = 1.0;
        this.musicVolume = 1.0;

        this.theme = "light";
        this.refreshRate = "60";
        this.scrollWheelSensitivity = "regular";
        this.movementSpeed = "regular";
        this.language = "auto-detect";
        this.autosaveInterval = "two_minutes";

        this.alwaysMultiplace = false;
        this.offerHints = true;
        this.enableTunnelSmartplace = true;
        this.vignette = true;
        this.compactBuildingInfo = false;
        this.disableCutDeleteWarnings = false;
        this.rotationByBuilding = true;
        this.clearCursorOnDeleteWhilePlacing = true;
        this.displayChunkBorders = false;
        this.pickMinerOnPatch = true;
        this.enableMousePan = true;

        this.enableColorBlindHelper = false;

        this.lowQualityMapResources = false;
        this.disableTileGrid = false;
        this.lowQualityTextures = false;
        this.simplifiedBelts = false;
        this.zoomToCursor = true;
        this.mapResourcesScale = 0.5;

        /**
         * @type {Object.<string, number>}
         */
        this.keybindingOverrides = {};
    }
}

export class ApplicationSettings extends ReadWriteProxy {
    constructor(app) {
        super(app, "app_settings.bin");
    }

    initialize() {
        // Read and directly write latest data back
        return this.readAsync()
            .then(() => {
                // Apply default setting callbacks
                const settings = this.getAllSettings();
                for (let i = 0; i < allApplicationSettings().length; ++i) {
                    const handle = allApplicationSettings()[i];
                    handle.apply(this.app, settings[handle.id]);
                }
            })

            .then(() => this.writeAsync());
    }

    save() {
        return this.writeAsync();
    }

    // Getters

    /**
     * @returns {SettingsStorage}
     */
    getAllSettings() {
        return this.currentData.settings;
    }

    /**
     * @param {string} key
     */
    getSetting(key) {
        if (!key.startsWith("debug_")) {
            assert(this.getAllSettings().hasOwnProperty(key), "Setting not known: " + key);
        }
        return this.getAllSettings()[key];
    }

    getInterfaceScaleId() {
        if (!this.currentData) {
            // Not initialized yet
            return "regular";
        }
        return this.getAllSettings().uiScale;
    }

    getDesiredFps() {
        return parseInt(this.getAllSettings().refreshRate);
    }

    getInterfaceScaleValue() {
        const id = this.getInterfaceScaleId();
        for (let i = 0; i < uiScales.length; ++i) {
            if (uiScales[i].id === id) {
                return uiScales[i].size;
            }
        }
        logger.error("Unknown ui scale id:", id);
        return 1;
    }

    getScrollWheelSensitivity() {
        const id = this.getAllSettings().scrollWheelSensitivity;
        for (let i = 0; i < scrollWheelSensitivities.length; ++i) {
            if (scrollWheelSensitivities[i].id === id) {
                return scrollWheelSensitivities[i].scale;
            }
        }
        logger.error("Unknown scroll wheel sensitivity id:", id);
        return 1;
    }

    getMovementSpeed() {
        const id = this.getAllSettings().movementSpeed;
        for (let i = 0; i < movementSpeeds.length; ++i) {
            if (movementSpeeds[i].id === id) {
                return movementSpeeds[i].multiplier;
            }
        }
        logger.error("Unknown movement speed id:", id);
        return 1;
    }

    getAutosaveIntervalSeconds() {
        const id = this.getAllSettings().autosaveInterval;
        for (let i = 0; i < autosaveIntervals.length; ++i) {
            if (autosaveIntervals[i].id === id) {
                return autosaveIntervals[i].seconds;
            }
        }
        logger.error("Unknown autosave interval id:", id);
        return 120;
    }

    getIsFullScreen() {
        return this.getAllSettings().fullscreen;
    }

    getKeybindingOverrides() {
        return this.getAllSettings().keybindingOverrides;
    }

    getLanguage() {
        return this.getAllSettings().language;
    }

    // Setters

    updateLanguage(id) {
        assert(LANGUAGES[id], "Language not known: " + id);
        return this.updateSetting("language", id);
    }

    /**
     * @param {string} key
     * @param {string|boolean|number} value
     */
    updateSetting(key, value) {
        for (let i = 0; i < allApplicationSettings().length; ++i) {
            const setting = allApplicationSettings()[i];
            if (setting.id === key) {
                if (!setting.validate(value)) {
                    assertAlways(false, "Bad setting value: " + key);
                }
                this.getAllSettings()[key] = value;
                if (setting.changeCb) {
                    setting.changeCb(this.app, value);
                }
                return this.writeAsync();
            }
        }
        assertAlways(false, "Unknown setting: " + key);
    }

    /**
     * Sets a new keybinding override
     * @param {string} keybindingId
     * @param {number} keyCode
     */
    updateKeybindingOverride(keybindingId, keyCode) {
        assert(Number.isInteger(keyCode), "Not a valid key code: " + keyCode);
        this.getAllSettings().keybindingOverrides[keybindingId] = keyCode;
        return this.writeAsync();
    }

    /**
     * Resets a given keybinding override
     * @param {string} id
     */
    resetKeybindingOverride(id) {
        delete this.getAllSettings().keybindingOverrides[id];
        return this.writeAsync();
    }
    /**
     * Resets all keybinding overrides
     */
    resetKeybindingOverrides() {
        this.getAllSettings().keybindingOverrides = {};
        return this.writeAsync();
    }

    // RW Proxy impl
    verify(data) {
        if (!data.settings) {
            return ExplainedResult.bad("missing key 'settings'");
        }
        if (typeof data.settings !== "object") {
            return ExplainedResult.bad("Bad settings object");
        }

        const settings = data.settings;
        for (let i = 0; i < allApplicationSettings().length; ++i) {
            const setting = allApplicationSettings()[i];
            const storedValue = settings[setting.id];
            if (!setting.validate(storedValue)) {
                return ExplainedResult.bad(
                    "Bad setting value for " +
                        setting.id +
                        ": " +
                        storedValue +
                        " @ settings version " +
                        data.version +
                        " (latest is " +
                        this.getCurrentVersion() +
                        ")"
                );
            }
        }
        return ExplainedResult.good();
    }

    getDefaultData() {
        return {
            version: this.getCurrentVersion(),
            settings: new SettingsStorage(),
        };
    }

    getCurrentVersion() {
        return 30;
    }

    /** @param {{settings: SettingsStorage, version: number}} data */
    migrate(data) {
        // Simply reset before
        if (data.version < 5) {
            data.settings = new SettingsStorage();
            data.version = this.getCurrentVersion();
            return ExplainedResult.good();
        }

        if (data.version < 6) {
            data.settings.alwaysMultiplace = false;
            data.version = 6;
        }

        if (data.version < 7) {
            data.settings.offerHints = true;
            data.version = 7;
        }

        if (data.version < 8) {
            data.settings.scrollWheelSensitivity = "regular";
            data.version = 8;
        }

        if (data.version < 9) {
            data.settings.language = "auto-detect";
            data.version = 9;
        }

        if (data.version < 10) {
            data.settings.movementSpeed = "regular";
            data.version = 10;
        }

        if (data.version < 11) {
            data.settings.enableTunnelSmartplace = true;
            data.version = 11;
        }

        if (data.version < 12) {
            data.settings.vignette = true;
            data.version = 12;
        }

        if (data.version < 13) {
            data.settings.compactBuildingInfo = false;
            data.version = 13;
        }

        if (data.version < 14) {
            data.settings.disableCutDeleteWarnings = false;
            data.version = 14;
        }

        if (data.version < 15) {
            data.settings.autosaveInterval = "two_minutes";
            data.version = 15;
        }

        if (data.version < 16) {
            // RE-ENABLE this setting, it already existed
            data.settings.enableTunnelSmartplace = true;
            data.version = 16;
        }

        if (data.version < 17) {
            data.settings.enableColorBlindHelper = false;
            data.version = 17;
        }

        if (data.version < 18) {
            data.settings.rotationByBuilding = true;
            data.version = 18;
        }

        if (data.version < 19) {
            data.settings.lowQualityMapResources = false;
            data.version = 19;
        }

        if (data.version < 20) {
            data.settings.disableTileGrid = false;
            data.version = 20;
        }

        if (data.version < 21) {
            data.settings.lowQualityTextures = false;
            data.version = 21;
        }

        if (data.version < 22) {
            data.settings.clearCursorOnDeleteWhilePlacing = true;
            data.version = 22;
        }

        if (data.version < 23) {
            data.settings.displayChunkBorders = false;
            data.version = 23;
        }

        if (data.version < 24) {
            data.settings.refreshRate = "60";
        }

        if (data.version < 25) {
            data.settings.musicVolume = 0.5;
            data.settings.soundVolume = 0.5;

            // @ts-ignore
            delete data.settings.musicMuted;
            // @ts-ignore
            delete data.settings.soundsMuted;
            data.version = 25;
        }

        if (data.version < 26) {
            data.settings.pickMinerOnPatch = true;
            data.version = 26;
        }

        if (data.version < 27) {
            data.settings.simplifiedBelts = false;
            data.version = 27;
        }

        if (data.version < 28) {
            data.settings.enableMousePan = true;
            data.version = 28;
        }

        if (data.version < 29) {
            data.settings.zoomToCursor = true;
            data.version = 29;
        }

        if (data.version < 30) {
            data.settings.mapResourcesScale = 0.5;

            // Re-enable hints as well
            data.settings.offerHints = true;

            data.version = 30;
        }

        return ExplainedResult.good();
    }
}
