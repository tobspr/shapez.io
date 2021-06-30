/* typehints:start */
import { Entity } from "./entity";
import { GameRoot } from "./root";
/* typehints:end */

import { globalConfig } from "../core/config";
import { createLogger } from "../core/logging";
import { ACHIEVEMENTS } from "../platform/achievement_provider";
import { getBuildingDataFromCode } from "./building_codes";

const logger = createLogger("achievement_proxy");

const ROTATER = "rotater";
const DEFAULT = "default";

export class AchievementProxy {
    /** @param {GameRoot} root */
    constructor(root) {
        this.root = root;
        this.provider = this.root.app.achievementProvider;
        this.disabled = true;

        if (G_IS_DEV && globalConfig.debug.testAchievements) {
            // still enable the proxy
        } else if (!this.provider.hasAchievements()) {
            return;
        }

        this.sliceTime = 0;

        this.root.signals.postLoadHook.add(this.onLoad, this);
    }

    onLoad() {
        if (!this.root.gameMode.hasAchievements()) {
            logger.log("Disabling achievements because game mode does not have achievements");
            this.disabled = true;
            return;
        }

        this.provider
            .onLoad(this.root)
            .then(() => {
                this.disabled = false;
                logger.log("Recieving achievement signals");
                this.initialize();
            })
            .catch(err => {
                this.disabled = true;
                logger.error("Ignoring achievement signals", err);
            });
    }

    initialize() {
        this.root.signals.achievementCheck.dispatch(ACHIEVEMENTS.darkMode);

        if (this.has(ACHIEVEMENTS.mam)) {
            this.root.signals.entityAdded.add(this.onMamFailure, this);
            this.root.signals.entityDestroyed.add(this.onMamFailure, this);
            this.root.signals.storyGoalCompleted.add(this.onStoryGoalCompleted, this);
        }

        if (this.has(ACHIEVEMENTS.noInverseRotater)) {
            this.root.signals.entityAdded.add(this.onEntityAdded, this);
        }

        this.startSlice();
    }

    startSlice() {
        this.sliceTime = this.root.time.now();

        this.root.signals.bulkAchievementCheck.dispatch(
            ACHIEVEMENTS.storeShape,
            this.sliceTime,
            ACHIEVEMENTS.throughputBp25,
            this.sliceTime,
            ACHIEVEMENTS.throughputBp50,
            this.sliceTime,
            ACHIEVEMENTS.throughputLogo25,
            this.sliceTime,
            ACHIEVEMENTS.throughputLogo50,
            this.sliceTime,
            ACHIEVEMENTS.throughputRocket10,
            this.sliceTime,
            ACHIEVEMENTS.throughputRocket20,
            this.sliceTime,
            ACHIEVEMENTS.play1h,
            this.sliceTime,
            ACHIEVEMENTS.play10h,
            this.sliceTime,
            ACHIEVEMENTS.play20h,
            this.sliceTime
        );
    }

    update() {
        if (this.disabled) {
            return;
        }

        if (this.root.time.now() - this.sliceTime > globalConfig.achievementSliceDuration) {
            this.startSlice();
        }
    }

    /**
     * @param {string} key
     * @returns {boolean}
     */
    has(key) {
        if (!this.provider.collection) {
            return false;
        }
        return this.provider.collection.map.has(key);
    }

    /** @param {Entity} entity */
    onEntityAdded(entity) {
        if (!entity.components.StaticMapEntity) {
            return;
        }

        const building = getBuildingDataFromCode(entity.components.StaticMapEntity.code);

        if (building.metaInstance.id !== ROTATER) {
            return;
        }

        if (building.variant === DEFAULT) {
            return;
        }

        this.root.savegame.currentData.stats.usedInverseRotater = true;
        this.root.signals.entityAdded.remove(this.onEntityAdded);
    }

    /** @param {number} level */
    onStoryGoalCompleted(level) {
        if (level > 26) {
            this.root.signals.entityAdded.add(this.onMamFailure, this);
            this.root.signals.entityDestroyed.add(this.onMamFailure, this);
        }

        this.root.signals.achievementCheck.dispatch(ACHIEVEMENTS.mam);

        // reset on every level
        this.root.savegame.currentData.stats.failedMam = false;
    }

    onMamFailure() {
        this.root.savegame.currentData.stats.failedMam = true;
    }
}
