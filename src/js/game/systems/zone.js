/* typehints:start */
import { DrawParameters } from "../../core/draw_parameters";
import { MapChunkView } from "../map_chunk_view";
import { GameRoot } from "../root";
/* typehints:end */

import { globalConfig } from "../../core/config";
import { STOP_PROPAGATION } from "../../core/signal";
import { GameSystem } from "../game_system";
import { THEME } from "../theme";
import { Entity } from "../entity";
import { Vector } from "../../core/vector";

export class ZoneSystem extends GameSystem {
    /** @param {GameRoot} root */
    constructor(root) {
        super(root);
        this.drawn = false;
        this.root.signals.prePlacementCheck.add(this.prePlacementCheck, this);

        this.root.signals.gameFrameStarted.add(() => {
            this.drawn = false;
        });
    }

    /**
     *
     * @param {Entity} entity
     * @param {Vector | undefined} tile
     * @returns
     */
    prePlacementCheck(entity, tile = null) {
        const staticComp = entity.components.StaticMapEntity;

        if (!staticComp) {
            return;
        }

        const mode = this.root.gameMode;

        const zones = mode.getBuildableZones();
        if (!zones) {
            return;
        }

        const transformed = staticComp.getTileSpaceBounds();
        if (tile) {
            transformed.x += tile.x;
            transformed.y += tile.y;
        }

        if (!zones.some(zone => zone.intersectsFully(transformed))) {
            return STOP_PROPAGATION;
        }
    }

    /**
     * Draws the zone
     * @param {DrawParameters} parameters
     * @param {MapChunkView} chunk
     */
    drawChunk(parameters, chunk) {
        if (this.drawn) {
            // double oof
            return;
        }
        this.drawn = true;

        const mode = this.root.gameMode;

        const zones = mode.getBuildableZones();
        if (!zones) {
            return;
        }

        const zone = zones[0].allScaled(globalConfig.tileSize);
        const context = parameters.context;

        context.lineWidth = 2;
        context.strokeStyle = THEME.map.zone.borderSolid;
        context.beginPath();
        context.rect(zone.x - 1, zone.y - 1, zone.w + 2, zone.h + 2);
        context.stroke();

        const outer = zone;
        const padding = 40 * globalConfig.tileSize;
        context.fillStyle = THEME.map.zone.outerColor;
        context.fillRect(outer.x + outer.w, outer.y, padding, outer.h);
        context.fillRect(outer.x - padding, outer.y, padding, outer.h);
        context.fillRect(
            outer.x - padding - globalConfig.tileSize,
            outer.y - padding,
            2 * padding + zone.w + 2 * globalConfig.tileSize,
            padding
        );
        context.fillRect(
            outer.x - padding - globalConfig.tileSize,
            outer.y + outer.h,
            2 * padding + zone.w + 2 * globalConfig.tileSize,
            padding
        );

        context.globalAlpha = 1;

        // render zone indicators with letters and numbers

        context.font = "10px GameFont";
        context.fillStyle = "#626262";
        context.textAlign = "center";

        const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

        const halfTile = globalConfig.halfTileSize;
        const pixelGap = 9;
        const topLeft = zone.topLeft().add(new Vector(-pixelGap, -pixelGap));

        for (let i = 0; i < zones[0].h; ++i) {
            const letter = alphabet[i];

            const pxOffset = halfTile + i * globalConfig.tileSize + pixelGap;

            context.fillText(letter, topLeft.x, topLeft.y + pxOffset + 5);
        }

        for (let i = 0; i < zones[0].w; ++i) {
            const pxOffset = halfTile + i * globalConfig.tileSize + pixelGap;

            context.fillText((i + 1).toString(), topLeft.x + pxOffset, topLeft.y + 3);
        }
    }
}
