import { globalConfig } from "../core/config";
import { DrawParameters } from "../core/draw_parameters";
import { MapChunk } from "./map_chunk";
import { GameRoot } from "./root";
import { drawSpriteClipped } from "../core/draw_utils";

export const CHUNK_OVERLAY_RES = 3;

export class MapChunkAggregate {
    /**
     *
     * @param {GameRoot} root
     * @param {number} x
     * @param {number} y
     */
    constructor(root, x, y) {
        this.root = root;
        this.x = x;
        this.y = y;

        /**
         * Whenever something changes, we increase this number - so we know we need to redraw
         */
        this.renderIteration = 0;
        this.dirty = false;
        /** @type {Array<boolean>} */
        this.dirtyList = new Array(globalConfig.chunkAggregateSize ** 2).fill(true);
        this.markDirty(0, 0);
    }

    /**
     * Marks this chunk as dirty, rerendering all caches
     * @param {number} chunkX
     * @param {number} chunkY
     */
    markDirty(chunkX, chunkY) {
        const relX = chunkX % globalConfig.chunkAggregateSize;
        const relY = chunkY % globalConfig.chunkAggregateSize;
        this.dirtyList[relY * globalConfig.chunkAggregateSize + relX] = true;
        if (this.dirty) {
            return;
        }
        this.dirty = true;
        ++this.renderIteration;
        this.renderKey = this.x + "/" + this.y + "@" + this.renderIteration;
    }

    /**
     *
     * @param {HTMLCanvasElement} canvas
     * @param {CanvasRenderingContext2D} context
     * @param {number} w
     * @param {number} h
     * @param {number} dpi
     */
    generateOverlayBuffer(canvas, context, w, h, dpi) {
        const prevKey = this.x + "/" + this.y + "@" + (this.renderIteration - 1);
        const prevBuffer = this.root.buffers.getForKeyOrNullNoUpdate({
            key: "agg@" + this.root.currentLayer,
            subKey: prevKey,
        });

        const overlaySize = globalConfig.mapChunkSize * CHUNK_OVERLAY_RES;
        let onlyDirty = false;
        if (prevBuffer) {
            context.drawImage(prevBuffer, 0, 0);
            onlyDirty = true;
        }

        for (let x = 0; x < globalConfig.chunkAggregateSize; x++) {
            for (let y = 0; y < globalConfig.chunkAggregateSize; y++) {
                if (onlyDirty && !this.dirtyList[globalConfig.chunkAggregateSize * y + x]) continue;
                this.root.map
                    .getChunk(
                        this.x * globalConfig.chunkAggregateSize + x,
                        this.y * globalConfig.chunkAggregateSize + y,
                        true
                    )
                    .generateOverlayBuffer(
                        context,
                        overlaySize,
                        overlaySize,
                        x * overlaySize,
                        y * overlaySize
                    );
            }
        }

        this.dirty = false;
        this.dirtyList.fill(false);
    }

    /**
     * Overlay
     * @param {DrawParameters} parameters
     */
    drawOverlay(parameters) {
        const aggregateOverlaySize =
            globalConfig.mapChunkSize * globalConfig.chunkAggregateSize * CHUNK_OVERLAY_RES;
        const sprite = this.root.buffers.getForKey({
            key: "agg@" + this.root.currentLayer,
            subKey: this.renderKey,
            w: aggregateOverlaySize,
            h: aggregateOverlaySize,
            dpi: 1,
            redrawMethod: this.generateOverlayBuffer.bind(this),
        });

        const dims = globalConfig.mapChunkWorldSize * globalConfig.chunkAggregateSize;
        const extrude = 0.05;

        // Draw chunk "pixel" art
        parameters.context.imageSmoothingEnabled = false;
        drawSpriteClipped({
            parameters,
            sprite,
            x: this.x * dims - extrude,
            y: this.y * dims - extrude,
            w: dims + 2 * extrude,
            h: dims + 2 * extrude,
            originalW: aggregateOverlaySize,
            originalH: aggregateOverlaySize,
        });

        parameters.context.imageSmoothingEnabled = true;
        const resourcesScale = this.root.app.settings.getAllSettings().mapResourcesScale;

        // Draw patch items
        if (this.root.currentLayer === "regular" && resourcesScale > 0.05) {
            const diameter = (70 / Math.pow(parameters.zoomLevel, 0.35)) * (0.2 + 2 * resourcesScale);

            for (let x = 0; x < globalConfig.chunkAggregateSize; x++) {
                for (let y = 0; y < globalConfig.chunkAggregateSize; y++) {
                    this.root.map
                        .getChunk(this.x + x, this.y + y, true)
                        .drawOverlayPatches(
                            parameters,
                            this.x * dims + x * globalConfig.mapChunkSize * CHUNK_OVERLAY_RES,
                            this.y * dims + y * globalConfig.mapChunkSize * CHUNK_OVERLAY_RES,
                            diameter
                        );
                }
            }
        }
    }
}
