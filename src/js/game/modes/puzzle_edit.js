/* typehints:start */
import { GameRoot } from "../root";
/* typehints:end */

import { enumGameModeIds } from "../game_mode";
import { PuzzleGameMode } from "./puzzle";
import { MetaStorageBuilding } from "../buildings/storage";
import { MetaReaderBuilding } from "../buildings/reader";
import { MetaFilterBuilding } from "../buildings/filter";
import { MetaDisplayBuilding } from "../buildings/display";
import { MetaLeverBuilding } from "../buildings/lever";
import { MetaItemProducerBuilding } from "../buildings/item_producer";
import { MetaMinerBuilding } from "../buildings/miner";
import { MetaWireBuilding } from "../buildings/wire";
import { MetaWireTunnelBuilding } from "../buildings/wire_tunnel";
import { MetaConstantSignalBuilding } from "../buildings/constant_signal";
import { MetaLogicGateBuilding } from "../buildings/logic_gate";
import { MetaVirtualProcessorBuilding } from "../buildings/virtual_processor";
import { MetaAnalyzerBuilding } from "../buildings/analyzer";
import { MetaComparatorBuilding } from "../buildings/comparator";
import { MetaTransistorBuilding } from "../buildings/transistor";
import { HUDPuzzleEditorControls } from "../hud/parts/puzzle_editor_controls";
import { HUDPuzzleEditorReview } from "../hud/parts/puzzle_editor_review";
import { HUDPuzzleEditorSettings } from "../hud/parts/puzzle_editor_settings";
import { createLogger } from "../../core/logging";
import { PuzzleSerializer } from "../../savegame/puzzle_serializer";
import { T } from "../../translations";
import { gMetaBuildingRegistry } from "../../core/global_registries";
import { HUDPuzzleEditorDownload } from "../hud/parts/puzzle_editor_download";

const logger = createLogger("puzzle-edit");

export class PuzzleEditGameMode extends PuzzleGameMode {
    static getId() {
        return enumGameModeIds.puzzleEdit;
    }

    static getSchema() {
        return {};
    }

    /**
     * @param {GameRoot} root
     * @param {object} payload
     * @param {import("../../savegame/savegame_typedefs").PuzzleGameData} payload.gameData
     * @param {boolean} payload.startInTestMode
     */
    constructor(root, { gameData = null, startInTestMode = false }) {
        super(root);

        this.hiddenBuildings = [
            MetaStorageBuilding,
            MetaReaderBuilding,
            MetaFilterBuilding,
            MetaDisplayBuilding,
            MetaLeverBuilding,
            MetaItemProducerBuilding,
            MetaMinerBuilding,

            MetaWireBuilding,
            MetaWireTunnelBuilding,
            MetaConstantSignalBuilding,
            MetaLogicGateBuilding,
            MetaVirtualProcessorBuilding,
            MetaAnalyzerBuilding,
            MetaComparatorBuilding,
            MetaTransistorBuilding,
        ];

        this.additionalHudParts.puzzleEditorControls = HUDPuzzleEditorControls;
        this.additionalHudParts.puzzleEditorReview = HUDPuzzleEditorReview;
        this.additionalHudParts.puzzleEditorSettings = HUDPuzzleEditorSettings;
        this.additionalHudParts.puzzleEditorDownload = HUDPuzzleEditorDownload;

        this.gameData = gameData;

        if (gameData) {
            root.signals.postLoadHook.add(() => this.loadPuzzle(gameData), this);
        }

        this.startInTestMode = startInTestMode;
    }

    /**
     * @param {import("../../savegame/savegame_typedefs").PuzzleGameData} puzzle
     */
    loadPuzzle(puzzle) {
        let errorText;
        logger.log("Loading puzzle", puzzle);

        // set zone and add buildings
        try {
            this.zoneWidth = puzzle.bounds.w;
            this.zoneHeight = puzzle.bounds.h;
            errorText = new PuzzleSerializer().deserializePuzzle(this.root, puzzle);
        } catch (ex) {
            errorText = ex.message || ex;
        }

        if (errorText) {
            this.root.gameState.moveToState("PuzzleMenuState", {
                error: {
                    title: T.dialogs.puzzleLoadError.title,
                    desc: T.dialogs.puzzleLoadError.desc + " " + errorText,
                },
            });
        }

        const toolbar = this.root.hud.parts.buildingsToolbar;

        // lock excluded buildings
        for (let i = 0; i < this.gameData.excludedBuildings.length; ++i) {
            const id = this.gameData.excludedBuildings[i];

            if (!gMetaBuildingRegistry.hasId(id)) {
                continue;
            }
            toolbar.toggleBuildingLock(gMetaBuildingRegistry.findById(id));
        }

        if (this.startInTestMode) {
            this.root.hud.parts.puzzleEditorSettings.toggleTestMode();
        }
    }

    getIsEditor() {
        /** @type {HUDPuzzleEditorSettings} */
        const editSettings = this.root.hud.parts.puzzleEditorSettings;
        return !editSettings.testMode;
    }
}
