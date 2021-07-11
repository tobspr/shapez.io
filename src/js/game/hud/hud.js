import { globalConfig } from "../../core/config";
import { DrawParameters } from "../../core/draw_parameters";
import { Signal } from "../../core/signal";
import { KEYMAPPINGS } from "../key_action_mapper";
import { MetaBuilding } from "../meta_building";
import { GameRoot } from "../root";
import { ShapeDefinition } from "../shape_definition";
import { HUDAchievements } from "./parts/achievements";
import { HUDBetaOverlay } from "./parts/beta_overlay";
import { HUDBlueprintPlacer } from "./parts/blueprint_placer";
import { HUDBuildingsToolbar } from "./parts/buildings_toolbar";
import { HUDBuildingPlacer } from "./parts/building_placer";
import { HUDColorBlindHelper } from "./parts/color_blind_helper";
import { HUDConstantSignalEdit } from "./parts/constant_signal_edit";
import { HUDChangesDebugger } from "./parts/debug_changes";
import { HUDDebugInfo } from "./parts/debug_info";
import { HUDEntityDebugger } from "./parts/entity_debugger";
import { HUDGameMenu } from "./parts/game_menu";
import { HUDLeverToggle } from "./parts/lever_toggle";
import { HUDMassSelector } from "./parts/mass_selector";
import { HUDModalDialogs } from "./parts/modal_dialogs";
import { enumNotificationType } from "./parts/notifications";
import { HUDSettingsMenu } from "./parts/settings_menu";
import { HUDShop } from "./parts/shop";
import { HUDStatistics } from "./parts/statistics";
import { HUDUnlockNotification } from "./parts/unlock_notification";
import { HUDVignetteOverlay } from "./parts/vignette_overlay";
import { HUDWaypoints } from "./parts/waypoints";
import { HUDWireInfo } from "./parts/wire_info";
import { TrailerMaker } from "./trailer_maker";

export class GameHUD {
    /**
     * @param {GameRoot} root
     */
    constructor(root) {
        this.root = root;
    }

    /**
     * Initializes the hud parts
     */
    initialize() {
        this.signals = {
            buildingSelectedForPlacement: /** @type {TypedSignal<[MetaBuilding|null]>} */ (new Signal()),
            selectedPlacementBuildingChanged: /** @type {TypedSignal<[MetaBuilding|null]>} */ (new Signal()),
            shapePinRequested: /** @type {TypedSignal<[ShapeDefinition]>} */ (new Signal()),
            shapeUnpinRequested: /** @type {TypedSignal<[string]>} */ (new Signal()),
            notification: /** @type {TypedSignal<[string, enumNotificationType]>} */ (new Signal()),
            buildingsSelectedForCopy: /** @type {TypedSignal<[Array<number>]>} */ (new Signal()),
            pasteBlueprintRequested: /** @type {TypedSignal<[]>} */ (new Signal()),
            viewShapeDetailsRequested: /** @type {TypedSignal<[ShapeDefinition]>} */ (new Signal()),
            unlockNotificationFinished: /** @type {TypedSignal<[]>} */ (new Signal()),
        };

        this.parts = {
            buildingsToolbar: new HUDBuildingsToolbar(this.root),

            blueprintPlacer: new HUDBlueprintPlacer(this.root),
            buildingPlacer: new HUDBuildingPlacer(this.root),
            unlockNotification: new HUDUnlockNotification(this.root),
            gameMenu: new HUDGameMenu(this.root),
            massSelector: new HUDMassSelector(this.root),
            shop: new HUDShop(this.root),
            statistics: new HUDStatistics(this.root),
            achievements: new HUDAchievements(this.root),
            waypoints: new HUDWaypoints(this.root),
            wireInfo: new HUDWireInfo(this.root),
            leverToggle: new HUDLeverToggle(this.root),
            constantSignalEdit: new HUDConstantSignalEdit(this.root),

            // Must always exist
            settingsMenu: new HUDSettingsMenu(this.root),
            debugInfo: new HUDDebugInfo(this.root),
            dialogs: new HUDModalDialogs(this.root),

            // Typing hints
            /* typehints:start */
            /** @type {HUDChangesDebugger} */
            changesDebugger: null,
            /* typehints:end */
        };

        if (G_IS_DEV && globalConfig.debug.enableEntityInspector) {
            this.parts.entityDebugger = new HUDEntityDebugger(this.root);
        }

        if (G_IS_DEV && globalConfig.debug.renderChanges) {
            this.parts.changesDebugger = new HUDChangesDebugger(this.root);
        }

        if (this.root.app.settings.getAllSettings().vignette) {
            this.parts.vignetteOverlay = new HUDVignetteOverlay(this.root);
        }

        if (this.root.app.settings.getAllSettings().enableColorBlindHelper) {
            this.parts.colorBlindHelper = new HUDColorBlindHelper(this.root);
        }

        if (!G_IS_RELEASE && !G_IS_DEV) {
            this.parts.betaOverlay = new HUDBetaOverlay(this.root);
        }

        const additionalParts = this.root.gameMode.additionalHudParts;
        for (const [partId, part] of Object.entries(additionalParts)) {
            this.parts[partId] = new part(this.root);
        }

        const frag = document.createDocumentFragment();
        for (const key in this.parts) {
            this.parts[key].createElements(frag);
        }

        document.body.appendChild(frag);

        for (const key in this.parts) {
            this.parts[key].initialize();
        }

        this.root.keyMapper.getBinding(KEYMAPPINGS.ingame.toggleHud).add(this.toggleUi, this);

        /* dev:start */
        if (G_IS_DEV && globalConfig.debug.renderForTrailer) {
            this.trailerMaker = new TrailerMaker(this.root);
        }
        /* dev:end*/
    }

    /**
     * Attempts to close all overlays
     */
    closeAllOverlays() {
        for (const key in this.parts) {
            this.parts[key].close();
        }
    }

    /**
     * Returns true if the game logic should be paused
     */
    shouldPauseGame() {
        for (const key in this.parts) {
            if (this.parts[key].shouldPauseGame()) {
                return true;
            }
        }
        return false;
    }

    /**
     * Returns true if the rendering can be paused
     */
    shouldPauseRendering() {
        for (const key in this.parts) {
            if (this.parts[key].shouldPauseRendering()) {
                return true;
            }
        }
        return false;
    }

    /**
     * Returns true if the rendering can be paused
     */
    hasBlockingOverlayOpen() {
        for (const key in this.parts) {
            if (this.parts[key].isBlockingOverlay()) {
                return true;
            }
        }
        return false;
    }

    /**
     * Toggles the ui
     */
    toggleUi() {
        document.body.classList.toggle("uiHidden");
    }

    /**
     * Updates all parts
     */
    update() {
        if (!this.root.gameInitialized) {
            return;
        }

        for (const key in this.parts) {
            this.parts[key].update();
        }

        /* dev:start */
        if (this.trailerMaker) {
            this.trailerMaker.update();
        }
        /* dev:end*/
    }

    /**
     * Draws all parts
     * @param {DrawParameters} parameters
     */
    draw(parameters) {
        const partsOrder = [
            "massSelector",
            "buildingPlacer",
            "blueprintPlacer",
            "colorBlindHelper",
            "changesDebugger",
            "minerHighlight",
        ];

        for (let i = 0; i < partsOrder.length; ++i) {
            if (this.parts[partsOrder[i]]) {
                this.parts[partsOrder[i]].draw(parameters);
            }
        }
    }

    /**
     * Draws all part overlays
     * @param {DrawParameters} parameters
     */
    drawOverlays(parameters) {
        const partsOrder = ["waypoints", "watermark", "wireInfo"];

        for (let i = 0; i < partsOrder.length; ++i) {
            if (this.parts[partsOrder[i]]) {
                this.parts[partsOrder[i]].drawOverlays(parameters);
            }
        }
    }

    /**
     * Cleans up everything
     */
    cleanup() {
        for (const key in this.parts) {
            this.parts[key].cleanup();
        }

        for (const key in this.signals) {
            this.signals[key].removeAll();
        }
    }
}
