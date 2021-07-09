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
import { HUDPuzzleImportExport } from "../hud/parts/puzzle_import_export";

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
     */
    constructor(root) {
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
        this.additionalHudParts.puzzleEditorDownload = HUDPuzzleImportExport;
    }

    getIsEditor() {
        /** @type {HUDPuzzleEditorSettings} */
        const editSettings = this.root.hud.parts.puzzleEditorSettings;
        return !editSettings.testMode;
    }
}
