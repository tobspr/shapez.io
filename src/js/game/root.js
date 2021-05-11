/* eslint-disable no-unused-vars */
import { Signal } from "../core/signal";
import { RandomNumberGenerator } from "../core/rng";
import { createLogger } from "../core/logging";

// Type hints
/* typehints:start */
import { GameTime } from "./time/game_time";
import { EntityManager } from "./entity_manager";
import { GameSystemManager } from "./game_system_manager";
import { AchievementProxy } from "./achievement_proxy";
import { GameHUD } from "./hud/hud";
import { MapView } from "./map_view";
import { Camera } from "./camera";
import { InGameState } from "../states/ingame";
import { AutomaticSave } from "./automatic_save";
import { Application } from "../application";
import { SoundProxy } from "./sound_proxy";
import { Savegame } from "../savegame/savegame";
import { GameLogic } from "./logic";
import { ShapeDefinitionManager } from "./shape_definition_manager";
import { HubGoals } from "./hub_goals";
import { BufferMaintainer } from "../core/buffer_maintainer";
import { ProductionAnalytics } from "./production_analytics";
import { Entity } from "./entity";
import { ShapeDefinition } from "./shape_definition";
import { BaseItem } from "./base_item";
import { DynamicTickrate } from "./dynamic_tickrate";
import { KeyActionMapper } from "./key_action_mapper";
import { Vector } from "../core/vector";
import { GameMode } from "./game_mode";
/* typehints:end */

const logger = createLogger("game/root");

/** @type {Array<Layer>} */
export const layers = ["regular", "wires"];

/**
 * The game root is basically the whole game state at a given point,
 * combining all important classes. We don't have globals, but this
 * class is passed to almost all game classes.
 */
export class GameRoot {
    /**
     * Constructs a new game root
     * @param {Application} app
     */
    constructor(app) {
        this.app = app;

        /** @type {Savegame} */
        this.savegame = null;

        /** @type {InGameState} */
        this.gameState = null;

        /** @type {KeyActionMapper} */
        this.keyMapper = null;

        // Store game dimensions
        this.gameWidth = 500;
        this.gameHeight = 500;

        // Stores whether the current session is a fresh game (true), or was continued (false)
        /** @type {boolean} */
        this.gameIsFresh = true;

        // Stores whether the logic is already initialized
        /** @type {boolean} */
        this.logicInitialized = false;

        // Stores whether the game is already initialized, that is, all systems etc have been created
        /** @type {boolean} */
        this.gameInitialized = false;

        /**
         * Whether a bulk operation is running
         */
        this.bulkOperationRunning = false;

        //////// Other properties ///////

        /** @type {Camera} */
        this.camera = null;

        /** @type {HTMLCanvasElement} */
        this.canvas = null;

        /** @type {CanvasRenderingContext2D} */
        this.context = null;

        /** @type {MapView} */
        this.map = null;

        /** @type {GameLogic} */
        this.logic = null;

        /** @type {EntityManager} */
        this.entityMgr = null;

        /** @type {GameHUD} */
        this.hud = null;

        /** @type {GameSystemManager} */
        this.systemMgr = null;

        /** @type {GameTime} */
        this.time = null;

        /** @type {HubGoals} */
        this.hubGoals = null;

        /** @type {BufferMaintainer} */
        this.buffers = null;

        /** @type {AutomaticSave} */
        this.automaticSave = null;

        /** @type {SoundProxy} */
        this.soundProxy = null;

        /** @type {AchievementProxy} */
        this.achievementProxy = null;

        /** @type {ShapeDefinitionManager} */
        this.shapeDefinitionMgr = null;

        /** @type {ProductionAnalytics} */
        this.productionAnalytics = null;

        /** @type {DynamicTickrate} */
        this.dynamicTickrate = null;

        /** @type {Layer} */
        this.currentLayer = "regular";

        /** @type {GameMode} */
        this.gameMode = null;

        this.signals = {
            // Entities
            entityManuallyPlaced: /** @type {TypedSignal<[Entity]>} */ (new Signal()),
            entityAdded: /** @type {TypedSignal<[Entity, Boolean]>} */ (new Signal()),
            entityChanged: /** @type {TypedSignal<[Entity]>} */ (new Signal()),
            entityGotNewComponent: /** @type {TypedSignal<[Entity]>} */ (new Signal()),
            entityComponentRemoved: /** @type {TypedSignal<[Entity]>} */ (new Signal()),
            entityQueuedForDestroy: /** @type {TypedSignal<[Entity]>} */ (new Signal()),
            entityDestroyed: /** @type {TypedSignal<[Entity]>} */ (new Signal()),

            // Global
            resized: /** @type {TypedSignal<[number, number]>} */ (new Signal()),
            readyToRender: /** @type {TypedSignal<[]>} */ (new Signal()),
            aboutToDestruct: /** @type {TypedSignal<[]>} */ new Signal(),

            // Game Hooks
            gameSaved: /** @type {TypedSignal<[]>} */ (new Signal()), // Game got saved
            gameRestored: /** @type {TypedSignal<[]>} */ (new Signal()), // Game got restored

            gameFrameStarted: /** @type {TypedSignal<[]>} */ (new Signal()), // New frame

            storyGoalCompleted: /** @type {TypedSignal<[number, string]>} */ (new Signal()),
            upgradePurchased: /** @type {TypedSignal<[string]>} */ (new Signal()),

            // Called right after game is initialized
            postLoadHook: /** @type {TypedSignal<[]>} */ (new Signal()),

            shapeDelivered: /** @type {TypedSignal<[ShapeDefinition]>} */ (new Signal()),
            itemProduced: /** @type {TypedSignal<[BaseItem]>} */ (new Signal()),

            bulkOperationFinished: /** @type {TypedSignal<[]>} */ (new Signal()),

            editModeChanged: /** @type {TypedSignal<[Layer]>} */ (new Signal()),

            // Called to check if an entity can be placed, second parameter is an additional offset.
            // Use to introduce additional placement checks
            prePlacementCheck: /** @type {TypedSignal<[Entity, Vector, Boolean]>} */ (new Signal()),

            // Called before actually placing an entity, use to perform additional logic
            // for freeing space before actually placing.
            freeEntityAreaBeforeBuild: /** @type {TypedSignal<[Entity]>} */ (new Signal()),

            // Called with an achievement key and necessary args to validate it can be unlocked.
            achievementCheck: /** @type {TypedSignal<[string, any]>} */ (new Signal()),
            bulkAchievementCheck: /** @type {TypedSignal<(string|any)[]>} */ (new Signal()),
        };

        // RNG's
        /** @type {Object.<string, Object.<string, RandomNumberGenerator>>} */
        this.rngs = {};

        // Work queue
        this.queue = {
            requireRedraw: false,
        };
    }

    /**
     * Destructs the game root
     */
    destruct() {
        logger.log("destructing root");
        this.signals.aboutToDestruct.dispatch();

        this.reset();
    }

    /**
     * Resets the whole root and removes all properties
     */
    reset() {
        if (this.signals) {
            // Destruct all signals
            for (let i = 0; i < this.signals.length; ++i) {
                this.signals[i].removeAll();
            }
        }

        if (this.hud) {
            this.hud.cleanup();
        }
        if (this.camera) {
            this.camera.cleanup();
        }

        // Finally free all properties
        for (let prop in this) {
            if (this.hasOwnProperty(prop)) {
                delete this[prop];
            }
        }
    }
}
