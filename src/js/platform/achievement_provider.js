/* typehints:start */
import { Application } from "../application";
import { Entity } from "../game/entity";
import { GameRoot } from "../game/root";
import { THEMES } from "../game/theme";
/* typehints:end */

import { enumAnalyticsDataSource } from "../game/production_analytics";
import { ShapeDefinition } from "../game/shape_definition";
import { ShapeItem } from "../game/items/shape_item";
import { globalConfig } from "../core/config";

export const ACHIEVEMENTS = {
    belt500Tiles: "belt500Tiles",
    blueprint100k: "blueprint100k",
    blueprint1m: "blueprint1m",
    completeLvl26: "completeLvl26",
    cutShape: "cutShape",
    darkMode: "darkMode",
    destroy1000: "destroy1000",
    irrelevantShape: "irrelevantShape",
    level100: "level100",
    level50: "level50",
    logoBefore18: "logoBefore18",
    mam: "mam",
    mapMarkers15: "mapMarkers15",
    noBeltUpgradesUntilBp: "noBeltUpgradesUntilBp",
    noInverseRotater: "noInverseRotater",
    oldLevel17: "oldLevel17",
    openWires: "openWires",
    paintShape: "paintShape",
    place5000Wires: "place5000Wires",
    placeBlueprint: "placeBlueprint",
    placeBp1000: "placeBp1000",
    play1h: "play1h",
    play10h: "play10h",
    play20h: "play20h",
    produceLogo: "produceLogo",
    produceMsLogo: "produceMsLogo",
    produceRocket: "produceRocket",
    rotateShape: "rotateShape",
    speedrunBp30: "speedrunBp30",
    speedrunBp60: "speedrunBp60",
    speedrunBp120: "speedrunBp120",
    stack4Layers: "stack4Layers",
    stackShape: "stackShape",
    store100Unique: "store100Unique",
    storeShape: "storeShape",
    throughputBp25: "throughputBp25",
    throughputBp50: "throughputBp50",
    throughputLogo25: "throughputLogo25",
    throughputLogo50: "throughputLogo50",
    throughputRocket10: "throughputRocket10",
    throughputRocket20: "throughputRocket20",
    trash1000: "trash1000",
    unlockWires: "unlockWires",
    upgradesTier5: "upgradesTier5",
    upgradesTier8: "upgradesTier8",
};

export const HIDDEN_ACHIEVEMENTS = [
    ACHIEVEMENTS.placeBp1000,
    ACHIEVEMENTS.darkMode,
    ACHIEVEMENTS.irrelevantShape,
    ACHIEVEMENTS.logoBefore18,
    ACHIEVEMENTS.mapMarkers15,
    ACHIEVEMENTS.produceMsLogo,
    ACHIEVEMENTS.belt500Tiles,
    ACHIEVEMENTS.oldLevel17,
];

/** @type {keyof typeof THEMES} */
const DARK_MODE = "dark";

const HOUR_1 = 3600; // Seconds
const HOUR_10 = HOUR_1 * 10;
const HOUR_20 = HOUR_1 * 20;
const ITEM_SHAPE = ShapeItem.getId();
const MINUTE_30 = 1800; // Seconds
const MINUTE_60 = MINUTE_30 * 2;
const MINUTE_120 = MINUTE_30 * 4;
const ROTATER_CCW_CODE = 12;
const ROTATER_180_CODE = 13;
const SHAPE_BP = "CbCbCbRb:CwCwCwCw";
const SHAPE_LOGO = "RuCw--Cw:----Ru--";
const SHAPE_MS_LOGO = "RgRyRbRr";
const SHAPE_OLD_LEVEL_17 = "WrRgWrRg:CwCrCwCr:SgSgSgSg";
const SHAPE_ROCKET = "CbCuCbCu:Sr------:--CrSrCr:CwCwCwCw";

/** @type {Layer} */
const WIRE_LAYER = "wires";

export class AchievementProviderInterface {
    /* typehints:start */
    collection = /** @type {AchievementCollection|undefined} */ (null);
    /* typehints:end */

    /** @param {Application} app */
    constructor(app) {
        this.app = app;
        this.storage = null;
    }

    /**
     * Initializes the achievement provider.
     * @returns {Promise<void>}
     */
    initialize() {
        abstract;
        return Promise.reject();
    }

    /**
     * Unlocks already unlocked achievements.
     * @returns {Promise<void>}
     */
    unlockUnlocked() {
        abstract;
        return Promise.reject();
    }

    /**
     * Opportunity to do additional initialization work with the GameRoot.
     * @param {GameRoot} root
     * @returns {Promise<void>}
     */
    onLoad(root) {
        abstract;
        return Promise.reject();
    }

    /** @returns {boolean} */
    hasLoaded() {
        abstract;
        return false;
    }

    /**
     * Call to activate an achievement with the provider
     * @param {string} key - Maps to an Achievement
     * @returns {Promise<void>}
     */
    activate(key) {
        abstract;
        return Promise.reject();
    }

    /**
     * Checks if achievements are supported in the current build
     * @returns {boolean}
     */
    hasAchievements() {
        abstract;
        return false;
    }
}

export class Achievement {
    /** @param {string} key - An ACHIEVEMENTS key */
    constructor(key) {
        this.key = key;
        this.activate = null;
        this.activatePromise = null;
        this.receiver = null;
        this.signal = null;
    }

    init() {}

    isValid() {
        return true;
    }

    unlock() {
        if (!this.activatePromise) {
            this.activatePromise = this.activate(this.key);
        }

        return this.activatePromise;
    }
}

export class AchievementCollection {
    /**
     * @param {function} activate - Resolves when provider activation is complete
     * @param {function} deactivate - Resolves when provider deactivation is complete
     */
    constructor(activate, deactivate) {
        this.map = new Map();
        this.activate = activate;
        this.deactivate = deactivate;

        for (const key in ACHIEVEMENTS) {
            this.add(ACHIEVEMENTS[key], this.getAchievementOptions(ACHIEVEMENTS[key]));
        }
    }

    getAchievementOptions(key) {
        const enum_achievement_mappings = {
            [ACHIEVEMENTS.belt500Tiles]: {
                isValid: this.isBelt500TilesValid,
                signal: "entityAdded",
            },
            [ACHIEVEMENTS.blueprint100k]: this.createBlueprintOptions(100000),
            [ACHIEVEMENTS.blueprint1m]: this.createBlueprintOptions(1000000),
            [ACHIEVEMENTS.completeLvl26]: this.createLevelOptions(26),
            [ACHIEVEMENTS.cutShape]: {},
            [ACHIEVEMENTS.darkMode]: {
                isValid: this.isDarkModeValid,
            },
            [ACHIEVEMENTS.destroy1000]: {
                isValid: this.isDestroy1000Valid,
            },
            [ACHIEVEMENTS.irrelevantShape]: {
                isValid: this.isIrrelevantShapeValid,
                signal: "shapeDelivered",
            },
            [ACHIEVEMENTS.level100]: this.createLevelOptions(100),
            [ACHIEVEMENTS.level50]: this.createLevelOptions(50),
            [ACHIEVEMENTS.logoBefore18]: {
                isValid: this.isLogoBefore18Valid,
                signal: "itemProduced",
            },
            [ACHIEVEMENTS.mam]: {
                isValid: this.isMamValid,
            },
            [ACHIEVEMENTS.mapMarkers15]: {
                isValid: this.isMapMarkers15Valid,
            },
            [ACHIEVEMENTS.noBeltUpgradesUntilBp]: {
                isValid: this.isNoBeltUpgradesUntilBpValid,
                signal: "storyGoalCompleted",
            },
            [ACHIEVEMENTS.noInverseRotater]: {
                init: this.initNoInverseRotater,
                isValid: this.isNoInverseRotaterValid,
                signal: "storyGoalCompleted",
            },
            [ACHIEVEMENTS.oldLevel17]: this.createShapeOptions(SHAPE_OLD_LEVEL_17),
            [ACHIEVEMENTS.openWires]: {
                isValid: this.isOpenWiresValid,
                signal: "editModeChanged",
            },
            [ACHIEVEMENTS.paintShape]: {},
            [ACHIEVEMENTS.place5000Wires]: {
                isValid: this.isPlace5000WiresValid,
            },
            [ACHIEVEMENTS.placeBlueprint]: {
                isValid: this.isPlaceBlueprintValid,
            },
            [ACHIEVEMENTS.placeBp1000]: {
                isValid: this.isPlaceBp1000Valid,
            },
            [ACHIEVEMENTS.play1h]: this.createTimeOptions(HOUR_1),
            [ACHIEVEMENTS.play10h]: this.createTimeOptions(HOUR_10),
            [ACHIEVEMENTS.play20h]: this.createTimeOptions(HOUR_20),
            [ACHIEVEMENTS.produceLogo]: this.createShapeOptions(SHAPE_LOGO),
            [ACHIEVEMENTS.produceRocket]: this.createShapeOptions(SHAPE_ROCKET),
            [ACHIEVEMENTS.produceMsLogo]: this.createShapeOptions(SHAPE_MS_LOGO),
            [ACHIEVEMENTS.rotateShape]: {},
            [ACHIEVEMENTS.speedrunBp30]: this.createSpeedOptions(12, MINUTE_30),
            [ACHIEVEMENTS.speedrunBp60]: this.createSpeedOptions(12, MINUTE_60),
            [ACHIEVEMENTS.speedrunBp120]: this.createSpeedOptions(12, MINUTE_120),
            [ACHIEVEMENTS.stack4Layers]: {
                isValid: this.isStack4LayersValid,
                signal: "itemProduced",
            },
            [ACHIEVEMENTS.stackShape]: {},
            [ACHIEVEMENTS.store100Unique]: {
                init: this.initStore100Unique,
                isValid: this.isStore100UniqueValid,
                signal: "shapeDelivered",
            },
            [ACHIEVEMENTS.storeShape]: {
                init: this.initStoreShape,
                isValid: this.isStoreShapeValid,
            },
            [ACHIEVEMENTS.throughputBp25]: this.createRateOptions(SHAPE_BP, 25),
            [ACHIEVEMENTS.throughputBp50]: this.createRateOptions(SHAPE_BP, 50),
            [ACHIEVEMENTS.throughputLogo25]: this.createRateOptions(SHAPE_LOGO, 25),
            [ACHIEVEMENTS.throughputLogo50]: this.createRateOptions(SHAPE_LOGO, 50),
            [ACHIEVEMENTS.throughputRocket10]: this.createRateOptions(SHAPE_ROCKET, 25),
            [ACHIEVEMENTS.throughputRocket20]: this.createRateOptions(SHAPE_ROCKET, 50),
            [ACHIEVEMENTS.trash1000]: {
                init: this.initTrash1000,
                isValid: this.isTrash1000Valid,
            },
            [ACHIEVEMENTS.unlockWires]: this.createLevelOptions(20),
            [ACHIEVEMENTS.upgradesTier5]: this.createUpgradeOptions(5),
            [ACHIEVEMENTS.upgradesTier8]: this.createUpgradeOptions(8),
        };
        return enum_achievement_mappings[key];
    }

    /** @param {GameRoot} root */
    initialize(root) {
        this.root = root;
        this.root.signals.achievementCheck.add(this.unlock, this);
        this.root.signals.bulkAchievementCheck.add(this.bulkUnlock, this);

        for (let [key, achievement] of this.map.entries()) {
            if (achievement.signal) {
                achievement.receiver = this.unlock.bind(this, key);
                this.root.signals[achievement.signal].add(achievement.receiver);
            }

            if (achievement.init) {
                achievement.init();
            }
        }

        if (!this.hasDefaultReceivers()) {
            this.root.signals.achievementCheck.remove(this.unlock);
            this.root.signals.bulkAchievementCheck.remove(this.bulkUnlock);
        }
    }

    /**
     * @param {string} key - Maps to an Achievement
     * @param {object} [options]
     * @param {function} [options.init]
     * @param {function} [options.isValid]
     * @param {string} [options.signal]
     */
    add(key, options = {}, init = false) {
        if (G_IS_DEV) {
            assert(ACHIEVEMENTS[key], "Achievement key not found: ", key);
        }

        const achievement = new Achievement(key);

        achievement.activate = this.activate;

        if (options.init) {
            achievement.init = options.init.bind(this, achievement);
        }

        if (options.isValid) {
            achievement.isValid = options.isValid.bind(this);
        }

        if (options.signal) {
            achievement.signal = options.signal;
        }

        this.map.set(key, achievement);

        if (init) {
            if (achievement.signal) {
                achievement.receiver = this.unlock.bind(this, key, false);
                this.root.signals[achievement.signal].add(achievement.receiver);
            }

            if (achievement.init) achievement.init();
        }
    }

    bulkUnlock() {
        for (let i = 0; i < arguments.length; i += 2) {
            this.unlock(arguments[i], arguments[i + 1]);
        }
    }

    /**
     * @param {string} key - Maps to an Achievement
     * @param {any} data - Data received from signal dispatches for validation
     */
    unlock(key, data, force = false) {
        if (!this.map.has(key)) {
            return;
        }

        const achievement = this.map.get(key);

        if (force !== true && !achievement.isValid(data)) return;

        achievement
            .unlock()
            .then(() => {
                if (this.map.has(key)) this.root.signals.achievementCompleted.dispatch(key, data);
                this.onActivate(null, key);
            })
            .catch(err => {
                this.onActivate(err, key);
            });
    }

    /**
     * @param {string} key - Maps to an Achievement
     */
    lock(key) {
        this.add(key, this.getAchievementOptions(key), true);
        this.deactivate(key);
    }

    /**
     * Cleans up after achievement activation attempt with the provider. Could
     * utilize err to retry some number of times if needed.
     * @param {?Error} err - Error is null if activation was successful
     * @param {string} key - Maps to an Achievement
     */
    onActivate(err, key) {
        this.remove(key);

        if (!this.hasDefaultReceivers()) {
            this.root.signals.achievementCheck.remove(this.unlock);
        }
    }

    /** @param {string} key - Maps to an Achievement */
    remove(key) {
        const achievement = this.map.get(key);
        if (achievement) {
            if (achievement.receiver) {
                this.root.signals[achievement.signal].remove(achievement.receiver);
            }

            this.map.delete(key);
        }
    }

    /**
     * Check if the collection-level achievementCheck receivers are still
     * necessary.
     */
    hasDefaultReceivers() {
        if (!this.map.size) {
            return false;
        }

        for (let achievement of this.map.values()) {
            if (!achievement.signal) {
                return true;
            }
        }

        return false;
    }

    /*
     * Remaining methods exist to extend Achievement instances within the
     * collection.
     */

    hasAllUpgradesAtLeastAtTier(tier) {
        const upgrades = this.root.gameMode.getUpgrades();

        for (let upgradeId in upgrades) {
            if (this.root.hubGoals.getUpgradeLevel(upgradeId) < tier - 1) {
                return false;
            }
        }

        return true;
    }

    /**
     * @param {ShapeItem} item
     * @param {string} shape
     * @returns {boolean}
     */
    isShape(item, shape) {
        return item.getItemType() === ITEM_SHAPE && item.definition.getHash() === shape;
    }

    createBlueprintOptions(count) {
        return {
            init: ({ key }) => this.unlock(key, ShapeDefinition.fromShortKey(SHAPE_BP)),
            isValid: definition =>
                definition.cachedHash === SHAPE_BP && this.root.hubGoals.storedShapes[SHAPE_BP] >= count,
            signal: "shapeDelivered",
        };
    }

    createLevelOptions(level) {
        return {
            init: ({ key }) => this.unlock(key, this.root.hubGoals.level),
            isValid: currentLevel => currentLevel > level,
            signal: "storyGoalCompleted",
        };
    }

    createRateOptions(shape, rate) {
        return {
            isValid: () => {
                return (
                    this.root.productionAnalytics.getCurrentShapeRateRaw(
                        enumAnalyticsDataSource.delivered,
                        this.root.shapeDefinitionMgr.getShapeFromShortKey(shape)
                    ) /
                        globalConfig.analyticsSliceDurationSeconds >=
                    rate
                );
            },
        };
    }

    createShapeOptions(shape) {
        return {
            isValid: item => this.isShape(item, shape),
            signal: "itemProduced",
        };
    }

    createSpeedOptions(level, time) {
        return {
            isValid: currentLevel => currentLevel >= level && this.root.time.now() < time,
            signal: "storyGoalCompleted",
        };
    }

    createTimeOptions(duration) {
        return {
            isValid: () => this.root.time.now() >= duration,
        };
    }

    createUpgradeOptions(tier) {
        return {
            init: ({ key }) => this.unlock(key, false, null),
            isValid: () => this.hasAllUpgradesAtLeastAtTier(tier),
            signal: "upgradePurchased",
        };
    }

    /** @param {Entity} entity @returns {boolean} */
    isBelt500TilesValid(entity) {
        return entity.components.Belt && entity.components.Belt.assignedPath.totalLength >= 500;
    }

    /** @returns {boolean} */
    isDarkModeValid() {
        return this.root.app.settings.currentData.settings.theme === DARK_MODE;
    }

    /** @param {number} count @returns {boolean} */
    isDestroy1000Valid(count) {
        return count >= 1000;
    }

    /** @param {ShapeDefinition} definition @returns {boolean} */
    isIrrelevantShapeValid(definition) {
        const levels = this.root.gameMode.getLevelDefinitions();
        for (let i = 0; i < levels.length; i++) {
            if (definition.cachedHash === levels[i].shape) {
                return false;
            }
        }

        const upgrades = this.root.gameMode.getUpgrades();
        for (let upgradeId in upgrades) {
            for (const tier in upgrades[upgradeId]) {
                const requiredShapes = upgrades[upgradeId][tier].required;
                for (let i = 0; i < requiredShapes.length; i++) {
                    if (definition.cachedHash === requiredShapes[i].shape) {
                        return false;
                    }
                }
            }
        }

        return true;
    }

    /** @param {ShapeItem} item @returns {boolean} */
    isLogoBefore18Valid(item) {
        return this.root.hubGoals.level < 18 && this.isShape(item, SHAPE_LOGO);
    }

    /** @returns {boolean} */
    isMamValid() {
        return this.root.hubGoals.level > 27 && !this.root.savegame.currentData.stats.failedMam;
    }

    /** @param {number} count @returns {boolean} */
    isMapMarkers15Valid(count) {
        return count >= 15;
    }

    /**
     * @param {number} level
     * @returns {boolean}
     */
    isNoBeltUpgradesUntilBpValid(level) {
        return level >= 12 && this.root.hubGoals.upgradeLevels.belt === 0;
    }

    initNoInverseRotater() {
        if (this.root.savegame.currentData.stats.usedInverseRotater === true) {
            return;
        }

        const entities = this.root.entityMgr.componentToEntity.StaticMapEntity;

        let usedInverseRotater = false;
        for (var i = 0; i < entities.length; i++) {
            const entity = entities[i].components.StaticMapEntity;

            if (entity.code === ROTATER_CCW_CODE || entity.code === ROTATER_180_CODE) {
                usedInverseRotater = true;
                break;
            }
        }

        this.root.savegame.currentData.stats.usedInverseRotater = usedInverseRotater;
    }

    /** @param {number} level @returns {boolean} */
    isNoInverseRotaterValid(level) {
        return level >= 14 && !this.root.savegame.currentData.stats.usedInverseRotater;
    }

    /** @param {string} currentLayer @returns {boolean} */
    isOpenWiresValid(currentLayer) {
        return currentLayer === WIRE_LAYER;
    }

    /** @param {Entity} entity @returns {boolean} */
    isPlace5000WiresValid(entity) {
        return (
            entity.components.Wire &&
            entity.registered &&
            entity.root.entityMgr.componentToEntity.Wire.length >= 5000
        );
    }

    /** @param {number} count @returns {boolean} */
    isPlaceBlueprintValid(count) {
        return count != 0;
    }

    /** @param {number} count @returns {boolean} */
    isPlaceBp1000Valid(count) {
        return count >= 1000;
    }

    /** @param {ShapeItem} item @returns {boolean} */
    isStack4LayersValid(item) {
        return item.getItemType() === ITEM_SHAPE && item.definition.layers.length === 4;
    }

    /** @param {Achievement} achievement */
    initStore100Unique({ key }) {
        this.unlock(key, false, null);
    }

    /** @returns {boolean} */
    isStore100UniqueValid() {
        return Object.keys(this.root.hubGoals.storedShapes).length >= 100;
    }

    /** @param {Achievement} achievement */
    initStoreShape({ key }) {
        this.unlock(key, false, null);
    }

    /** @returns {boolean} */
    isStoreShapeValid() {
        const entities = this.root.systemMgr.systems.storage.allEntities;

        if (entities.length === 0) {
            return false;
        }

        for (var i = 0; i < entities.length; i++) {
            if (entities[i].components.Storage.storedCount > 0) {
                return true;
            }
        }

        return false;
    }

    /** @param {Achievement} achievement */
    initTrash1000({ key }) {
        if (Number(this.root.savegame.currentData.stats.trashedCount)) {
            this.unlock(key, 0);
            return;
        }

        this.root.savegame.currentData.stats.trashedCount = 0;
    }

    /** @param {number} count @returns {boolean} */
    isTrash1000Valid(count) {
        this.root.savegame.currentData.stats.trashedCount += count;

        return this.root.savegame.currentData.stats.trashedCount >= 1000;
    }
}
