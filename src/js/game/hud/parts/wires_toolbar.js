import { HUDBaseToolbar } from "./base_toolbar";
import { MetaWireBuilding } from "../../buildings/wire";
import { MetaConstantSignalBuilding } from "../../buildings/constant_signal";
import { MetaLogicGateBuilding } from "../../buildings/logic_gate";
import { MetaLeverBuilding } from "../../buildings/lever";
import { MetaWireTunnelBuilding } from "../../buildings/wire_tunnel";
import { MetaVirtualProcessorBuilding } from "../../buildings/virtual_processor";
import { MetaTransistorBuilding } from "../../buildings/transistor";
import { MetaAnalyzerBuilding } from "../../buildings/analyzer";
import { MetaComparatorBuilding } from "../../buildings/comparator";
import { MetaReaderBuilding } from "../../buildings/reader";
import { MetaFilterBuilding } from "../../buildings/filter";
import { MetaDisplayBuilding } from "../../buildings/display";
import { MetaStorageBuilding } from "../../buildings/storage";

export class HUDWiresToolbar extends HUDBaseToolbar {
    constructor(root) {
        super(root, {
            primaryBuildings: HUDWiresToolbar.bar.primaryBuildings,
            secondaryBuildings: HUDWiresToolbar.bar.secondaryBuildings,
            visibilityCondition: () =>
                !this.root.camera.getIsMapOverlayActive() && this.root.currentLayer === "wires",
            htmlElementId: HUDWiresToolbar.bar.htmlElementId,
            layer: "wires",
        });
    }
}

HUDWiresToolbar.bar = {
    primaryBuildings: [
        MetaWireBuilding,
        MetaWireTunnelBuilding,
        MetaConstantSignalBuilding,
        MetaLogicGateBuilding,
        MetaVirtualProcessorBuilding,
        MetaAnalyzerBuilding,
        MetaComparatorBuilding,
        MetaTransistorBuilding,
    ],
    secondaryBuildings: [
        MetaStorageBuilding,
        MetaReaderBuilding,
        MetaLeverBuilding,
        MetaFilterBuilding,
        MetaDisplayBuilding,
    ],
    htmlElementId: "ingame_HUD_wires_toolbar",
};
