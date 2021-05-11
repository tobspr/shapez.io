import { ExplainedResult } from "../core/explained_result";
import { createLogger } from "../core/logging";
import { ReadWriteProxy } from "../core/read_write_proxy";
import { globalConfig } from "../core/config";
import { Savegame } from "./savegame";
const logger = createLogger("savegame_manager");

const Rusha = require("rusha");

/** @enum {string} */
export const enumLocalSavegameStatus = {
    offline: "offline",
    synced: "synced",
};

export class SavegameManager extends ReadWriteProxy {
    constructor(app) {
        super(app, "savegames.bin");

        this.currentData = this.getDefaultData();
    }

    // RW Proxy Impl
    /**
     * @returns {import("./savegame_typedefs").SavegamesData}
     */
    getDefaultData() {
        return {
            version: this.getCurrentVersion(),
            savegames: [],
        };
    }

    getCurrentVersion() {
        return 1002;
    }

    verify(data) {
        // @TODO
        return ExplainedResult.good();
    }

    /**
     *
     * @param {import("./savegame_typedefs").SavegamesData} data
     */
    migrate(data) {
        if (data.version < 1001) {
            data.savegames.forEach(savegame => {
                savegame.level = 0;
            });
            data.version = 1001;
        }

        if (data.version < 1002) {
            data.savegames.forEach(savegame => {
                savegame.name = null;
            });
            data.version = 1002;
        }

        return ExplainedResult.good();
    }

    // End rw proxy

    /**
     * @returns {Array<import("./savegame_typedefs").SavegameMetadata>}
     */
    getSavegamesMetaData() {
        return this.currentData.savegames;
    }

    /**
     *
     * @param {string} internalId
     * @returns {Savegame}
     */
    getSavegameById(internalId) {
        const metadata = this.getGameMetaDataByInternalId(internalId);
        if (!metadata) {
            return null;
        }
        return new Savegame(this.app, { internalId, metaDataRef: metadata });
    }

    /**
     * Returns if this manager has any savegame of a 1.1.19 version, which
     * enables all levels
     */
    getHasAnyLegacySavegames() {
        return this.currentData.savegames.some(savegame => savegame.version === 1005 || savegame.level > 14);
    }

    /**
     * Deletes a savegame
     * @param {import("./savegame_typedefs").SavegameMetadata} game
     */
    deleteSavegame(game) {
        const handle = new Savegame(this.app, {
            internalId: game.internalId,
            metaDataRef: game,
        });

        return handle.deleteAsync().then(() => {
            for (let i = 0; i < this.currentData.savegames.length; ++i) {
                const potentialGame = this.currentData.savegames[i];
                if (potentialGame.internalId === handle.internalId) {
                    this.currentData.savegames.splice(i, 1);
                    break;
                }
            }

            return this.writeAsync();
        });
    }

    /**
     * Returns a given games metadata by id
     * @param {string} id
     * @returns {import("./savegame_typedefs").SavegameMetadata}
     */
    getGameMetaDataByInternalId(id) {
        for (let i = 0; i < this.currentData.savegames.length; ++i) {
            const data = this.currentData.savegames[i];
            if (data.internalId === id) {
                return data;
            }
        }
        logger.error("Savegame internal id not found:", id);
        return null;
    }

    /**
     * Creates a new savegame
     * @returns {Savegame}
     */
    createNewSavegame(gamemode) {
        const id = this.generateInternalId();

        const metaData = /** @type {import("./savegame_typedefs").SavegameMetadata} */ ({
            lastUpdate: Date.now(),
            version: Savegame.getCurrentVersion(),
            internalId: id,
        });

        this.currentData.savegames.push(metaData);

        // Notice: This is async and happening in the background
        this.updateAfterSavegamesChanged();

        return new Savegame(
            this.app,
            {
                internalId: id,
                metaDataRef: metaData,
            },
            gamemode
        );
    }

    /**
     * Attempts to import a savegame
     * @param {object} data
     */
    importSavegame(data) {
        const savegame = this.createNewSavegame();

        // Track legacy savegames
        const isOldSavegame = data.version < 1006;

        const migrationResult = savegame.migrate(data);
        if (migrationResult.isBad()) {
            return Promise.reject("Failed to migrate: " + migrationResult.reason);
        }

        savegame.currentData = data;
        const verification = savegame.verify(data);
        if (verification.isBad()) {
            return Promise.reject("Verification failed: " + verification.result);
        }

        return savegame
            .writeSavegameAndMetadata()
            .then(() => this.updateAfterSavegamesChanged())
            .then(() => this.app.restrictionMgr.onHasLegacySavegamesChanged(isOldSavegame));
    }

    /**
     * Hook after the savegames got changed
     */
    updateAfterSavegamesChanged() {
        return this.sortSavegames()
            .then(() => this.writeAsync())
            .then(() => this.app.restrictionMgr.onHasLegacySavegamesChanged(this.getHasAnyLegacySavegames()));
    }

    /**
     * Sorts all savegames by their creation time descending
     * @returns {Promise<any>}
     */
    sortSavegames() {
        this.currentData.savegames.sort((a, b) => b.lastUpdate - a.lastUpdate);
        let promiseChain = Promise.resolve();
        while (this.currentData.savegames.length > 30) {
            const toRemove = this.currentData.savegames.pop();

            // Try to remove the savegame since its no longer available
            const game = new Savegame(this.app, {
                internalId: toRemove.internalId,
                metaDataRef: toRemove,
            });
            promiseChain = promiseChain
                .then(() => game.deleteAsync())
                .then(
                    () => {},
                    err => {
                        logger.error(this, "Failed to remove old savegame:", toRemove, ":", err);
                    }
                );
        }

        return promiseChain;
    }

    /**
     * Helper method to generate a new internal savegame id
     */
    generateInternalId() {
        return Rusha.createHash()
            .update(Date.now() + "/" + Math.random())
            .digest("hex");
    }

    // End

    initialize() {
        // First read, then directly write to ensure we have the latest data
        // @ts-ignore
        return this.readAsync().then(() => {
            if (G_IS_DEV && globalConfig.debug.disableSavegameWrite) {
                return Promise.resolve();
            }
            return this.updateAfterSavegamesChanged();
        });
    }
}
