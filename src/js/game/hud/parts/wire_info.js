import { globalConfig } from "../../../core/config";
import { MapChunkView } from "../../map_chunk_view";
import { WireNetwork } from "../../systems/wire";
import { THEME } from "../../theme";
import { BaseHUDPart } from "../base_hud_part";
import { Loader } from "../../../core/loader";

export class HUDWireInfo extends BaseHUDPart {
    initialize() {
        this.spriteEmpty = Loader.getSprite("sprites/wires/network_empty.png");
        this.spriteConflict = Loader.getSprite("sprites/wires/network_conflict.png");
    }

    /**
     *
     * @param {import("../../../core/draw_parameters").DrawParameters} parameters
     */
    drawOverlays(parameters) {
        if (this.root.currentLayer !== "wires") {
            // Not in the wires layer
            return;
        }

        const mousePos = this.root.app.mousePosition;
        if (!mousePos) {
            // No mouse
            return;
        }

        const worldPos = this.root.camera.screenToWorld(mousePos);
        const tile = worldPos.toTileSpace();
        const entity = this.root.map.getLayerContentXY(tile.x, tile.y, "wires");

        if (!entity) {
            // No entity
            return;
        }

        if (
            !this.root.camera.getIsMapOverlayActive() &&
            !this.root.logic.getIsEntityIntersectedWithMatrix(entity, worldPos)
        ) {
            // Detailed intersection check
            return;
        }

        const networks = this.root.logic.getEntityWireNetworks(entity, tile);
        if (networks === null) {
            // This entity will never be able to be connected
            return;
        }

        if (networks.length === 0) {
            // No network at all
            return;
        }

        for (let i = 0; i < networks.length; ++i) {
            const network = networks[i];
            this.drawHighlightedNetwork(parameters, network);
        }

        if (networks.length === 1) {
            const network = networks[0];

            if (network.valueConflict) {
                this.spriteConflict.draw(parameters.context, mousePos.x + 15, mousePos.y - 10, 60, 60);
            } else if (!network.currentValue) {
                this.spriteEmpty.draw(parameters.context, mousePos.x + 15, mousePos.y - 10, 60, 60);
            } else {
                network.currentValue.drawItemCenteredClipped(
                    mousePos.x + 40,
                    mousePos.y + 10,
                    parameters,
                    60
                );
            }
        }
    }

    /**
     *
     *
     * @param {import("../../../core/draw_parameters").DrawParameters} parameters
     * @param {WireNetwork} network
     */
    drawHighlightedNetwork(parameters, network) {
        parameters.context.globalAlpha = 0.5;

        for (let i = 0; i < network.wires.length; ++i) {
            const wire = network.wires[i];
            const staticComp = wire.components.StaticMapEntity;
            const screenTile = this.root.camera.worldToScreen(staticComp.origin.toWorldSpace());
            MapChunkView.drawSingleOverviewTile({
                context: parameters.context,
                x: screenTile.x,
                y: screenTile.y,
                entity: wire,
                tileSizePixels: globalConfig.tileSize * this.root.camera.zoomLevel,
                overrideColor: THEME.map.wires.highlightColor,
            });
        }

        for (let i = 0; i < network.tunnels.length; ++i) {
            const tunnel = network.tunnels[i];
            const staticComp = tunnel.components.StaticMapEntity;
            const screenTile = this.root.camera.worldToScreen(staticComp.origin.toWorldSpace());
            MapChunkView.drawSingleOverviewTile({
                context: parameters.context,
                x: screenTile.x,
                y: screenTile.y,
                entity: tunnel,
                tileSizePixels: globalConfig.tileSize * this.root.camera.zoomLevel,
                overrideColor: THEME.map.wires.highlightColor,
            });
        }
        parameters.context.globalAlpha = 1;
    }
}
