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
        this.root.map.getAggregateForChunk(this.x, this.y, true).markDirty(this.x, this.y);
    }

    /**
     * Draws the background layer
     * @param {DrawParameters} parameters
     */
    drawBackgroundLayer(parameters) {
        const systems = this.root.systemMgr.systems;
        if (systems.zone) {
            systems.zone.drawChunk(parameters, this);
        }

        if (this.root.gameMode.hasResources()) {
            systems.mapResources.drawChunk(parameters, this);
        }

        systems.beltUnderlays.drawChunk(parameters, this);
        systems.belt.drawChunk(parameters, this);
    }

    /**
     * Draws the dynamic foreground layer
     * @param {DrawParameters} parameters
     */
    drawForegroundDynamicLayer(parameters) {
        const systems = this.root.systemMgr.systems;

        systems.itemEjector.drawChunk(parameters, this);
        systems.itemAcceptor.drawChunk(parameters, this);
        systems.miner.drawChunk(parameters, this);
    }

    /**
     * Draws the static foreground layer
     * @param {DrawParameters} parameters
     */
    drawForegroundStaticLayer(parameters) {
        const systems = this.root.systemMgr.systems;

        systems.staticMapEntities.drawChunk(parameters, this);
        systems.lever.drawChunk(parameters, this);
        systems.display.drawChunk(parameters, this);
        systems.storage.drawChunk(parameters, this);
        systems.constantProducer.drawChunk(parameters, this);
        systems.goalAcceptor.drawChunk(parameters, this);
        systems.itemProcessorOverlays.drawChunk(parameters, this);
    }

    /**
     * @param {DrawParameters} parameters
     * @param {number} xoffs
     * @param {number} yoffs
     * @param {number} diameter
     */
    drawOverlayPatches(parameters, xoffs, yoffs, diameter) {
        for (let i = 0; i < this.patches.length; ++i) {
            const patch = this.patches[i];
            if (patch.item.getItemType() === "shape") {
                const destX = xoffs + patch.pos.x * globalConfig.tileSize;
                const destY = yoffs + patch.pos.y * globalConfig.tileSize;
                patch.item.drawItemCenteredClipped(destX, destY, parameters, diameter);
            }
        }
    }

    /**
     *
     * @param {CanvasRenderingContext2D} context
     * @param {number} w
     * @param {number} h
     * @param {number=} xoffs
     * @param {number=} yoffs
     */
    generateOverlayBuffer(context, w, h, xoffs, yoffs) {
        context.fillStyle =
            this.containedEntities.length > 0
                ? THEME.map.chunkOverview.filled
                : THEME.map.chunkOverview.empty;
        context.fillRect(xoffs, yoffs, w, h);

        if (this.root.app.settings.getAllSettings().displayChunkBorders) {
            context.fillStyle = THEME.map.chunkBorders;
            context.fillRect(xoffs, yoffs, w, 1);
            context.fillRect(xoffs, yoffs + 1, 1, h);
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
                                xoffs + x * CHUNK_OVERLAY_RES,
                                yoffs + y * CHUNK_OVERLAY_RES,
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
                                        xoffs + x * CHUNK_OVERLAY_RES + dx,
                                        yoffs + y * CHUNK_OVERLAY_RES + dy,
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
                            xoffs + x * CHUNK_OVERLAY_RES,
                            yoffs + y * CHUNK_OVERLAY_RES,
                            CHUNK_OVERLAY_RES,
                            CHUNK_OVERLAY_RES
                        );

                        continue;
                    }
                }

                const lowerContent = lowerArray[y];
                if (lowerContent) {
                    context.fillStyle = lowerContent.getBackgroundColorAsResource();
                    context.fillRect(
                        xoffs + x * CHUNK_OVERLAY_RES,
                        yoffs + y * CHUNK_OVERLAY_RES,
                        CHUNK_OVERLAY_RES,
                        CHUNK_OVERLAY_RES
                    );
                }
            }
        }

        if (this.root.currentLayer === "wires") {
            // Draw wires overlay

            context.fillStyle = THEME.map.wires.overlayColor;
            context.fillRect(xoffs, yoffs, w, h);

            for (let x = 0; x < globalConfig.mapChunkSize; ++x) {
                const wiresArray = this.wireContents[x];
                for (let y = 0; y < globalConfig.mapChunkSize; ++y) {
                    const content = wiresArray[y];
                    if (!content) {
                        continue;
                    }
                    MapChunkView.drawSingleWiresOverviewTile({
                        context,
                        x: xoffs + x * CHUNK_OVERLAY_RES,
                        y: yoffs + y * CHUNK_OVERLAY_RES,
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
    static drawSingleWiresOverviewTile({ context, x, y, entity, tileSizePixels, overrideColor = null }) {
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
        const systems = this.root.systemMgr.systems;
        systems.wire.drawChunk(parameters, this);
        systems.staticMapEntities.drawWiresChunk(parameters, this);
        systems.wiredPins.drawChunk(parameters, this);
    }
}
