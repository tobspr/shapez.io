/* typehints:start */
import { Application } from "../../application";
import { GameRoot } from "../../game/root";
/* typehints:end */

import { createLogger } from "../../core/logging";
import { getIPCRenderer } from "../../core/utils";
import { ACHIEVEMENTS, AchievementCollection, AchievementProviderInterface } from "../achievement_provider";

const logger = createLogger("achievements/steam");

const ACHIEVEMENT_IDS = {
    [ACHIEVEMENTS.belt500Tiles]: "belt_500_tiles",
    [ACHIEVEMENTS.blueprint100k]: "blueprint_100k",
    [ACHIEVEMENTS.blueprint1m]: "blueprint_1m",
    [ACHIEVEMENTS.completeLvl26]: "complete_lvl_26",
    [ACHIEVEMENTS.cutShape]: "cut_shape",
    [ACHIEVEMENTS.darkMode]: "dark_mode",
    [ACHIEVEMENTS.destroy1000]: "destroy_1000",
    [ACHIEVEMENTS.irrelevantShape]: "irrelevant_shape",
    [ACHIEVEMENTS.level100]: "level_100",
    [ACHIEVEMENTS.level50]: "level_50",
    [ACHIEVEMENTS.logoBefore18]: "logo_before_18",
    [ACHIEVEMENTS.mam]: "mam",
    [ACHIEVEMENTS.mapMarkers15]: "map_markers_15",
    [ACHIEVEMENTS.openWires]: "open_wires",
    [ACHIEVEMENTS.oldLevel17]: "old_level_17",
    [ACHIEVEMENTS.noBeltUpgradesUntilBp]: "no_belt_upgrades_until_bp",
    [ACHIEVEMENTS.noInverseRotater]: "no_inverse_rotator", // [sic]
    [ACHIEVEMENTS.paintShape]: "paint_shape",
    [ACHIEVEMENTS.place5000Wires]: "place_5000_wires",
    [ACHIEVEMENTS.placeBlueprint]: "place_blueprint",
    [ACHIEVEMENTS.placeBp1000]: "place_bp_1000",
    [ACHIEVEMENTS.play1h]: "play_1h",
    [ACHIEVEMENTS.play10h]: "play_10h",
    [ACHIEVEMENTS.play20h]: "play_20h",
    [ACHIEVEMENTS.produceLogo]: "produce_logo",
    [ACHIEVEMENTS.produceMsLogo]: "produce_ms_logo",
    [ACHIEVEMENTS.produceRocket]: "produce_rocket",
    [ACHIEVEMENTS.rotateShape]: "rotate_shape",
    [ACHIEVEMENTS.speedrunBp30]: "speedrun_bp_30",
    [ACHIEVEMENTS.speedrunBp60]: "speedrun_bp_60",
    [ACHIEVEMENTS.speedrunBp120]: "speedrun_bp_120",
    [ACHIEVEMENTS.stack4Layers]: "stack_4_layers",
    [ACHIEVEMENTS.stackShape]: "stack_shape",
    [ACHIEVEMENTS.store100Unique]: "store_100_unique",
    [ACHIEVEMENTS.storeShape]: "store_shape",
    [ACHIEVEMENTS.throughputBp25]: "throughput_bp_25",
    [ACHIEVEMENTS.throughputBp50]: "throughput_bp_50",
    [ACHIEVEMENTS.throughputLogo25]: "throughput_logo_25",
    [ACHIEVEMENTS.throughputLogo50]: "throughput_logo_50",
    [ACHIEVEMENTS.throughputRocket10]: "throughput_rocket_10",
    [ACHIEVEMENTS.throughputRocket20]: "throughput_rocket_20",
    [ACHIEVEMENTS.trash1000]: "trash_1000",
    [ACHIEVEMENTS.unlockWires]: "unlock_wires",
    [ACHIEVEMENTS.upgradesTier5]: "upgrades_tier_5",
    [ACHIEVEMENTS.upgradesTier8]: "upgrades_tier_8",
};

export class SteamAchievementProvider extends AchievementProviderInterface {
    /** @param {Application} app */
    constructor(app) {
        super(app);

        this.initialized = false;
        this.collection = new AchievementCollection(this.activate.bind(this), this.deactivate.bind(this));

        if (G_IS_DEV) {
            for (let key in ACHIEVEMENT_IDS) {
                assert(this.collection.map.has(key), "Key not found in collection: " + key);
            }
        }

        logger.log("Collection created with", this.collection.map.size, "achievements");
    }

    /** @returns {boolean} */
    hasAchievements() {
        return true;
    }

    /**
     * @param {GameRoot} root
     * @returns {Promise<void>}
     */
    onLoad(root) {
        this.root = root;

        try {
            this.collection = new AchievementCollection(this.activate.bind(this), this.deactivate.bind(this));
            this.collection.initialize(root);

            let promise = Promise.resolve();

            //Unlock already unlocked
            for (const id in ACHIEVEMENT_IDS) {
                promise.then(() =>
                    this.ipc.invoke("steam:get-achievement", ACHIEVEMENT_IDS[id]).then(is_achieved => {
                        if (is_achieved) this.collection.unlock(id, null, true);
                        return Promise.resolve();
                    })
                );
            }

            return promise.then(() => {
                logger.log("Initialized", this.collection.map.size, "relevant achievements");
                return Promise.resolve();
            });
        } catch (err) {
            logger.error("Failed to initialize the collection");
            return Promise.reject(err);
        }
    }

    /** @returns {Promise<void>} */
    initialize() {
        if (!G_IS_STANDALONE) {
            logger.warn("Steam unavailable. Achievements won't sync.");
            return Promise.resolve();
        }

        if (G_WEGAME_VERSION) {
            return Promise.resolve();
        }

        this.ipc = getIPCRenderer();

        return this.ipc.invoke("steam:is-initialized").then(initialized => {
            this.initialized = initialized;

            if (!this.initialized) {
                logger.warn("Steam failed to intialize. Achievements won't sync.");
            } else {
                logger.log("Steam achievement provider initialized");
            }
        });
    }

    unlockUnlocked() {
        let promise = Promise.resolve();

        //Unlock already unlocked
        for (const id in ACHIEVEMENT_IDS) {
            promise.then(() =>
                this.ipc.invoke("steam:get-achievement", ACHIEVEMENT_IDS[id]).then(is_achieved => {
                    if (is_achieved) this.collection.unlock(id, null, true);
                    return Promise.resolve();
                })
            );
        }

        return promise;
    }

    /**
     * @param {string} key
     * @returns {Promise<void>}
     */
    activate(key) {
        let promise;

        if (G_WEGAME_VERSION) {
            return Promise.resolve();
        }

        if (!this.initialized) {
            promise = Promise.resolve();
        } else {
            promise = this.ipc.invoke("steam:activate-achievement", ACHIEVEMENT_IDS[key]);
        }

        return promise
            .then(() => {
                logger.log("Achievement activated:", key);
            })
            .catch(err => {
                logger.error("Failed to activate achievement:", key, err);
                throw err;
            });
    }

    /**
     * @param {string} key
     * @returns {Promise<void>}
     */
    deactivate(key) {
        let promise;

        if (!this.initialized) {
            promise = Promise.resolve();
        } else {
            promise = this.ipc.invoke("steam:deactivate-achievement", ACHIEVEMENT_IDS[key]);
        }

        return promise
            .then(() => {
                logger.log("Achievement deactivated:", key);
            })
            .catch(err => {
                logger.error("Failed to deactivate achievement:", key, err);
                throw err;
            });
    }
}
