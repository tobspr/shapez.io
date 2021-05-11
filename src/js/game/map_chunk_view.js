import { globalConfig } from "../core/config";
import { DrawParameters } from "../core/draw_parameters";
import { getBuildingDataFromCode } from "./building_codes";
import { Entity } from "./entity";
import { MapChunk } from "./map_chunk";
import { GameRoot } from "./root";
import { THEME } from "./theme";
import { drawSpriteClipped } from "../core/draw_utils";

export const CHUNK_OVERLAY_RES = 3;

export class MapChunkView extends MapChunk {
    /**
     *
     * @param {GameRoot} root
     * @param {number} x
     * @param {number} y
     */
    constructor(root, x, y) {
        super(root, x, y);

        /**
         * Whenever something changes, we increase this number - so we know we need to redraw
         */
        this.renderIteration = 0;

        this.markDirty();
    }

    /**
     * Marks this chunk as dirty, rerendering all caches
     */
    markDirty() {
        ++this.renderIteration;
        this.renderKey = this.x + "/" + this.y + "@" + this.renderIteration;
    }

    /**
     * Draws the background layer
     * @param {DrawParameters} parameters
     */
    drawBackgroundLayer(parameters) {
        const order = this.root.systemMgr.renderOrderBackground;
        const systems = this.root.systemMgr.systems;
        const systemsWithoutOrderd = Object.keys(systems).filter(system => !order.includes(system));
        const renderOrder = [...systemsWithoutOrderd, ...order];
        for (let i = 0; i < renderOrder.length; i++) {
            const system = systems[renderOrder[i]];
            if (typeof system.drawChunk_BackgroundLayer !== "function") continue;
            system.drawChunk_BackgroundLayer(parameters, this);
        }
    }

    /**
     * Draws the dynamic foreground layer
     * @param {DrawParameters} parameters
     */
    drawForegroundDynamicLayer(parameters) {
        const order = this.root.systemMgr.renderOrderDynamic;
        const systems = this.root.systemMgr.systems;
        const systemsWithoutOrderd = Object.keys(systems).filter(system => !order.includes(system));
        const renderOrder = [...systemsWithoutOrderd, ...order];
        for (let i = 0; i < renderOrder.length; i++) {
            const system = systems[renderOrder[i]];
            if (typeof system.drawChunk_ForegroundDynamicLayer !== "function") continue;
            system.drawChunk_ForegroundDynamicLayer(parameters, this);
        }
    }

    /**
     * Draws the static foreground layer
     * @param {DrawParameters} parameters
     */
    drawForegroundStaticLayer(parameters) {
        const order = this.root.systemMgr.renderOrderStatic;
        const systems = this.root.systemMgr.systems;
        const systemsWithoutOrderd = Object.keys(systems).filter(system => !order.includes(system));
        const renderOrder = [...systemsWithoutOrderd, ...order];
        for (let i = 0; i < renderOrder.length; i++) {
            const system = systems[renderOrder[i]];
            if (typeof system.drawChunk_ForegroundStaticLayer !== "function") continue;
            system.drawChunk_ForegroundStaticLayer(parameters, this);
        }
    }

    /**
     * Overlay
     * @param {DrawParameters} parameters
     */
    drawOverlay(parameters) {
        const overlaySize = globalConfig.mapChunkSize * CHUNK_OVERLAY_RES;
        const sprite = this.root.buffers.getForKey({
            key: "chunk@" + this.root.currentLayer,
            subKey: this.renderKey,
            w: overlaySize,
            h: overlaySize,
            dpi: 1,
            redrawMethod: this.generateOverlayBuffer.bind(this),
        });

        const dims = globalConfig.mapChunkWorldSize;
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
            originalW: overlaySize,
            originalH: overlaySize,
        });

        parameters.context.imageSmoothingEnabled = true;
        const resourcesScale = this.root.app.settings.getAllSettings().mapResourcesScale;

        // Draw patch items
        if (this.root.currentLayer === "regular" && resourcesScale > 0.05) {
            const diameter = (70 / Math.pow(parameters.zoomLevel, 0.35)) * (0.2 + 2 * resourcesScale);

            for (let i = 0; i < this.patches.length; ++i) {
                const patch = this.patches[i];
                if (patch.item.getItemType && patch.item.getItemType() === "shape") {
                    const destX = this.x * dims + patch.pos.x * globalConfig.tileSize;
                    const destY = this.y * dims + patch.pos.y * globalConfig.tileSize;
                    patch.item.drawItemCenteredClipped(destX, destY, parameters, diameter);
                }
            }
        }
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
        context.fillStyle =
            this.containedEntities.length > 0
                ? THEME.map.chunkOverview.filled
                : THEME.map.chunkOverview.empty;
        context.fillRect(0, 0, w, h);

        if (this.root.app.settings.getAllSettings().displayChunkBorders) {
            context.fillStyle = THEME.map.chunkBorders;
            context.fillRect(0, 0, w, 1);
            context.fillRect(0, 1, 1, h);
        }

        for (let x = 0; x < globalConfig.mapChunkSize; ++x) {
            const lowerArray = this.lowerLayer[x];
            const upperArray = this.contents[x];
            for (let y = 0; y < globalConfig.mapChunkSize; ++y) {
                const upperContent = upperArray[y];
                if (upperContent) {
                    const staticComp = upperContent.components.StaticMapEntity;
                    const data = getBuildingDataFromCode(staticComp.code);
                    const metaBuilding = data.metaInstance;

                    const overlayMatrix = metaBuilding.getSpecialOverlayRenderMatrix(
                        staticComp.rotation,
                        data.rotationVariant,
                        data.variant,
                        upperContent
                    );

                    if (overlayMatrix) {
                        // Draw lower content first since it "shines" through
                        const lowerContent = lowerArray[y];
                        if (lowerContent) {
                            context.fillStyle = lowerContent.getBackgroundColorAsResource();
                            context.fillRect(
                                x * CHUNK_OVERLAY_RES,
                                y * CHUNK_OVERLAY_RES,
                                CHUNK_OVERLAY_RES,
                                CHUNK_OVERLAY_RES
                            );
                        }

                        context.fillStyle = metaBuilding.getSilhouetteColor(
                            data.variant,
                            data.rotationVariant
                        );
                        for (let dx = 0; dx < 3; ++dx) {
                            for (let dy = 0; dy < 3; ++dy) {
                                const isFilled = overlayMatrix[dx + dy * 3];
                                if (isFilled) {
                                    context.fillRect(
                                        x * CHUNK_OVERLAY_RES + dx,
                                        y * CHUNK_OVERLAY_RES + dy,
                                        1,
                                        1
                                    );
                                }
                            }
                        }

                        continue;
                    } else {
                        context.fillStyle = metaBuilding.getSilhouetteColor(
                            data.variant,
                            data.rotationVariant
                        );
                        context.fillRect(
                            x * CHUNK_OVERLAY_RES,
                            y * CHUNK_OVERLAY_RES,
                            CHUNK_OVERLAY_RES,
                            CHUNK_OVERLAY_RES
                        );

                        continue;
                    }
                }

                const lowerContent = lowerArray[y];
                if (lowerContent) {
                    if (lowerContent.getBackgroundColorAsResource) {
                        context.fillStyle = lowerContent.getBackgroundColorAsResource();
                    } else {
                        // @ts-ignore
                        context.fillStyle = lowerContent;
                    }
                    context.fillRect(
                        x * CHUNK_OVERLAY_RES,
                        y * CHUNK_OVERLAY_RES,
                        CHUNK_OVERLAY_RES,
                        CHUNK_OVERLAY_RES
                    );
                }
            }
        }

        if (this.root.currentLayer === "wires") {
            // Draw layers overlay

            context.fillStyle = THEME.map.wires.overlayColor;
            context.fillRect(0, 0, w, h);

            for (let x = 0; x < globalConfig.mapChunkSize; ++x) {
                const wiresArray = this.wireContents[x];
                for (let y = 0; y < globalConfig.mapChunkSize; ++y) {
                    const content = wiresArray[y];
                    if (!content) {
                        continue;
                    }
                    MapChunkView.drawSingleOverviewTile({
                        context,
                        x: x * CHUNK_OVERLAY_RES,
                        y: y * CHUNK_OVERLAY_RES,
                        entity: content,
                        tileSizePixels: CHUNK_OVERLAY_RES,
                    });
                }
            }
        } else if (this.root.currentLayer !== "regular") {
            for (let x = 0; x < globalConfig.mapChunkSize; ++x) {
                const array = this.layersContents[this.root.currentLayer][x];
                for (let y = 0; y < globalConfig.mapChunkSize; ++y) {
                    const content = array[y];
                    if (!content) {
                        continue;
                    }
                    MapChunkView.drawSingleOverviewTile({
                        context,
                        x: x * CHUNK_OVERLAY_RES,
                        y: y * CHUNK_OVERLAY_RES,
                        entity: content,
                        tileSizePixels: CHUNK_OVERLAY_RES,
                    });
                }
            }
        }
    }

    /**
     * @param {object} param0
     * @param {CanvasRenderingContext2D} param0.context
     * @param {number} param0.x
     * @param {number} param0.y
     * @param {Entity} param0.entity
     * @param {number} param0.tileSizePixels
     * @param {string=} param0.overrideColor Optionally override the color to be rendered
     */
    static drawSingleOverviewTile({ context, x, y, entity, tileSizePixels, overrideColor = null }) {
        const staticComp = entity.components.StaticMapEntity;
        const data = getBuildingDataFromCode(staticComp.code);
        const metaBuilding = data.metaInstance;
        const overlayMatrix = metaBuilding.getSpecialOverlayRenderMatrix(
            staticComp.rotation,
            data.rotationVariant,
            data.variant,
            entity
        );
        context.fillStyle =
            overrideColor || metaBuilding.getSilhouetteColor(data.variant, data.rotationVariant);
        if (overlayMatrix) {
            for (let dx = 0; dx < 3; ++dx) {
                for (let dy = 0; dy < 3; ++dy) {
                    const isFilled = overlayMatrix[dx + dy * 3];
                    if (isFilled) {
                        context.fillRect(
                            x + (dx * tileSizePixels) / CHUNK_OVERLAY_RES,
                            y + (dy * tileSizePixels) / CHUNK_OVERLAY_RES,
                            tileSizePixels / CHUNK_OVERLAY_RES,
                            tileSizePixels / CHUNK_OVERLAY_RES
                        );
                    }
                }
            }
        } else {
            context.fillRect(x, y, tileSizePixels, tileSizePixels);
        }
    }

    /**
     * Draws the wires layer
     * @param {DrawParameters} parameters
     */
    drawWiresForegroundLayer(parameters) {
        const order = this.root.systemMgr.renderOrderWires;
        const systems = this.root.systemMgr.systems;
        const systemsWithoutOrderd = Object.keys(systems).filter(system => !order.includes(system));
        const renderOrder = [...systemsWithoutOrderd, ...order];
        for (let i = 0; i < renderOrder.length; i++) {
            const system = systems[renderOrder[i]];
            if (typeof system.drawChunk_WiresForegroundLayer !== "function") continue;
            system.drawChunk_WiresForegroundLayer(parameters, this);
        }
    }

    /**
     * Draws the layer
     * @param {DrawParameters} parameters
     * @param {Layer} layer
     */
    drawForegroundLayer(parameters, layer) {
        const order = this.root.systemMgr.renderOrderForeground;
        const systems = this.root.systemMgr.systems;
        const systemsWithoutOrderd = Object.keys(systems).filter(system => !order.includes(system));
        const renderOrder = [...systemsWithoutOrderd, ...order];
        for (let i = 0; i < renderOrder.length; i++) {
            const system = systems[renderOrder[i]];
            if (typeof system.drawChunk_ForegroundLayer !== "function") continue;
            system.drawChunk_ForegroundLayer(parameters, this, layer);
        }
    }
}
