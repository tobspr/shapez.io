/* typehints:start */
import { Application } from "../../application";
import { GameRoot } from "../../game/root";
/* typehints:end */

import { createLogger } from "../../core/logging";
import { AchievementCollection, AchievementProviderInterface, ACHIEVEMENTS } from "../achievement_provider";
import { ReadWriteProxy } from "../../core/read_write_proxy";
import { ExplainedResult } from "../../core/explained_result";

const logger = createLogger("achievements/browser");

export class BrowserAchievementStorage extends ReadWriteProxy {
    constructor(app) {
        super(app, "app_achievements.bin");
    }

    initialize() {
        return this.readAsync().then(() => {
            console.log(this.currentData);
            return Promise.resolve();
        });
    }

    save() {
        return this.writeAsync();
    }

    /** @returns {ExplainedResult} */
    verify(data) {
        if (!data.unlocked) {
            return ExplainedResult.bad("missing key 'unlocked'");
        }
        if (!Array.isArray(data.unlocked)) {
            return ExplainedResult.bad("Bad array 'unlocked'");
        }

        for (let i = 0; i < data.unlocked.length; i++) {
            const achievement = data.unlocked[i];
            let exists = false;
            for (const key in ACHIEVEMENTS) {
                if (ACHIEVEMENTS[key] === achievement) {
                    exists = true;
                    break;
                }
            }
        }

        return ExplainedResult.good();
    }

    // Should return the default data
    getDefaultData() {
        return {
            version: this.getCurrentVersion(),
            unlocked: [],
        };
    }

    // Should return the current version as an integer
    getCurrentVersion() {
        return 0;
    }

    // Should migrate the data (Modify in place)
    /** @returns {ExplainedResult} */
    migrate(data) {
        return ExplainedResult.good();
    }
}

export class BrowserAchievementProvider extends AchievementProviderInterface {
    /** @param {Application} app */
    constructor(app) {
        super(app);

        this.initialized = false;
        this.collection = new AchievementCollection(this.activate.bind(this), this.deactivate.bind(this));
        this.storage = new BrowserAchievementStorage(app);
        if (G_IS_DEV) {
            for (let key in ACHIEVEMENTS) {
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

            //Unlock already unlocked
            for (let i = 0; i < this.storage.currentData.unlocked.length; i++) {
                const achievement = this.storage.currentData.unlocked[i];
                this.collection.unlock(achievement, null, true);
            }

            logger.log("Initialized", this.collection.map.size, "relevant achievements");
            return Promise.resolve();
        } catch (err) {
            logger.error("Failed to initialize the collection");
            return Promise.reject(err);
        }
    }

    unlockUnlocked() {
        let promise = Promise.resolve();

        //Unlock already unlocked
        for (let i = 0; i < this.storage.currentData.unlocked.length; i++) {
            promise.then(() => {
                const achievement = this.storage.currentData.unlocked[i];
                this.collection.unlock(achievement, null, true);
            });
        }

        return promise;
    }

    /** @returns {Promise<void>} */
    initialize() {
        return Promise.resolve();
    }

    /**
     * @param {string} key
     * @returns {Promise<void>}
     */
    activate(key) {
        return Promise.resolve()
            .then(() => {
                if (!this.storage.currentData.unlocked.includes(key))
                    this.storage.currentData.unlocked.push(key);

                return Promise.resolve();
            })
            .then(() => this.storage.save())
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
        return Promise.resolve()
            .then(() => {
                if (this.storage.currentData.unlocked.includes(key))
                    this.storage.currentData.unlocked.splice(
                        this.storage.currentData.unlocked.indexOf(key),
                        1
                    );
                return Promise.resolve();
            })
            .then(() => this.storage.save())
            .then(() => {
                logger.log("Achievement deactivated:", key);
            })
            .catch(err => {
                logger.error("Failed to deactivate achievement:", key, err);
                throw err;
            });
    }
}
