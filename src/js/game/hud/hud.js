/* typehints:start */
import { GameRoot } from "../root";
/* typehints:end */

/* dev:start */
import { TrailerMaker } from "./trailer_maker";
/* dev:end */

import { Signal } from "../../core/signal";
import { DrawParameters } from "../../core/draw_parameters";
import { HUDBuildingsToolbar } from "./parts/buildings_toolbar";
import { HUDBuildingPlacer } from "./parts/building_placer";
import { HUDBlueprintPlacer } from "./parts/blueprint_placer";
import { HUDKeybindingOverlay } from "./parts/keybinding_overlay";
import { HUDUnlockNotification } from "./parts/unlock_notification";
import { HUDGameMenu } from "./parts/game_menu";
import { HUDShop } from "./parts/shop";
import { IS_MOBILE, globalConfig } from "../../core/config";
import { HUDMassSelector } from "./parts/mass_selector";
import { HUDVignetteOverlay } from "./parts/vignette_overlay";
import { HUDStatistics } from "./parts/statistics";
import { MetaBuilding } from "../meta_building";
import { HUDPinnedShapes } from "./parts/pinned_shapes";
import { ShapeDefinition } from "../shape_definition";
import { HUDNotifications, enumNotificationType } from "./parts/notifications";
import { HUDSettingsMenu } from "./parts/settings_menu";
import { HUDDebugInfo } from "./parts/debug_info";
import { HUDEntityDebugger } from "./parts/entity_debugger";
import { KEYMAPPINGS } from "../key_action_mapper";
import { HUDWatermark } from "./parts/watermark";
import { HUDModalDialogs } from "./parts/modal_dialogs";
import { HUDPartTutorialHints } from "./parts/tutorial_hints";
import { HUDWaypoints } from "./parts/waypoints";
import { HUDInteractiveTutorial } from "./parts/interactive_tutorial";
import { HUDScreenshotExporter } from "./parts/screenshot_exporter";
import { HUDColorBlindHelper } from "./parts/color_blind_helper";
import { HUDShapeViewer } from "./parts/shape_viewer";
import { HUDWiresOverlay } from "./parts/wires_overlay";
import { HUDChangesDebugger } from "./parts/debug_changes";
import { queryParamOptions } from "../../core/query_parameters";
import { HUDSandboxController } from "./parts/sandbox_controller";
import { HUDWiresToolbar } from "./parts/wires_toolbar";
import { HUDWireInfo } from "./parts/wire_info";
import { HUDLeverToggle } from "./parts/lever_toggle";
import { HUDLayerPreview } from "./parts/layer_preview";
import { HUDMinerHighlight } from "./parts/miner_highlight";
import { HUDBetaOverlay } from "./parts/beta_overlay";
import { HUDStandaloneAdvantages } from "./parts/standalone_advantages";
import { HUDCatMemes } from "./parts/cat_memes";
import { HUDTutorialVideoOffer } from "./parts/tutorial_video_offer";
import { Entity } from "../entity";

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
            buildingsSelectedForCopy: /** @type {TypedSignal<[Array<Entity>]>} */ (new Signal()),
            pasteBlueprintRequested: /** @type {TypedSignal<[]>} */ (new Signal()),
            viewShapeDetailsRequested: /** @type {TypedSignal<[ShapeDefinition]>} */ (new Signal()),
            unlockNotificationFinished: /** @type {TypedSignal<[]>} */ (new Signal()),
        };

        this.parts = {
            buildingsToolbar: new HUDBuildingsToolbar(this.root),
            wiresToolbar: new HUDWiresToolbar(this.root),
            blueprintPlacer: new HUDBlueprintPlacer(this.root),
            buildingPlacer: new HUDBuildingPlacer(this.root),
            unlockNotification: new HUDUnlockNotification(this.root),
            gameMenu: new HUDGameMenu(this.root),
            massSelector: new HUDMassSelector(this.root),
            shop: new HUDShop(this.root),
            statistics: new HUDStatistics(this.root),
            waypoints: new HUDWaypoints(this.root),
            wireInfo: new HUDWireInfo(this.root),
            leverToggle: new HUDLeverToggle(this.root),

            // Must always exist
            pinnedShapes: new HUDPinnedShapes(this.root),
            notifications: new HUDNotifications(this.root),
            settingsMenu: new HUDSettingsMenu(this.root),
            debugInfo: new HUDDebugInfo(this.root),
            dialogs: new HUDModalDialogs(this.root),
            screenshotExporter: new HUDScreenshotExporter(this.root),
            shapeViewer: new HUDShapeViewer(this.root),

            wiresOverlay: new HUDWiresOverlay(this.root),
            layerPreview: new HUDLayerPreview(this.root),

            minerHighlight: new HUDMinerHighlight(this.root),
            tutorialVideoOffer: new HUDTutorialVideoOffer(this.root),

            // Typing hints
            /* typehints:start */
            /** @type {HUDChangesDebugger} */
            changesDebugger: null,
            /* typehints:end */
        };

        if (!IS_MOBILE) {
            this.parts.keybindingOverlay = new HUDKeybindingOverlay(this.root);
        }

        if (G_IS_DEV && globalConfig.debug.enableEntityInspector) {
            this.parts.entityDebugger = new HUDEntityDebugger(this.root);
        }

        if (this.root.app.restrictionMgr.getIsStandaloneMarketingActive()) {
            this.parts.watermark = new HUDWatermark(this.root);
            this.parts.standaloneAdvantages = new HUDStandaloneAdvantages(this.root);
            this.parts.catMemes = new HUDCatMemes(this.root);
        }

        if (G_IS_DEV && globalConfig.debug.renderChanges) {
            this.parts.changesDebugger = new HUDChangesDebugger(this.root);
        }

        if (this.root.app.settings.getAllSettings().offerHints) {
            this.parts.tutorialHints = new HUDPartTutorialHints(this.root);
            this.parts.interactiveTutorial = new HUDInteractiveTutorial(this.root);
        }

        if (this.root.app.settings.getAllSettings().vignette) {
            this.parts.vignetteOverlay = new HUDVignetteOverlay(this.root);
        }

        if (this.root.app.settings.getAllSettings().enableColorBlindHelper) {
            this.parts.colorBlindHelper = new HUDColorBlindHelper(this.root);
        }

        if (queryParamOptions.sandboxMode || G_IS_DEV) {
            this.parts.sandboxController = new HUDSandboxController(this.root);
        }

        if (!G_IS_RELEASE && !G_IS_DEV) {
            this.parts.betaOverlay = new HUDBetaOverlay(this.root);
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
