import { globalConfig } from "../../core/config";
import { DrawParameters } from "../../core/draw_parameters";
import { GameSystem } from "../game_system";
import { MapChunkView } from "../map_chunk_view";

export class StaticMapEntitySystem extends GameSystem {
    constructor(root) {
        super(root);

        /** @type {Set<number>} */
        this.drawnUids = new Set();

        this.root.signals.gameFrameStarted.add(this.clearUidList, this);
    }

    static getId() {
        return "staticMapEntities";
    }

    /**
     * Clears the uid list when a new frame started
     */
    clearUidList() {
        this.drawnUids.clear();
    }

    /**
     * Draws the static entities
     * @param {DrawParameters} parameters
     * @param {MapChunkView} chunk
     */
    drawChunk_ForegroundStaticLayer(parameters, chunk) {
        if (G_IS_DEV && globalConfig.debug.doNotRenderStatics) {
            return;
        }

        const contents = chunk.containedEntitiesByLayer.regular;
        for (let i = 0; i < contents.length; ++i) {
            const entity = contents[i];

            const staticComp = entity.components.StaticMapEntity;
            const sprite = staticComp.getSprite();
            if (sprite) {
                // Avoid drawing an entity twice which has been drawn for
                // another chunk already
                if (this.drawnUids.has(entity.uid)) {
                    continue;
                }

                this.drawnUids.add(entity.uid);
                staticComp.drawSpriteOnBoundsClipped(parameters, sprite, 2);
            }
        }
    }

    /**
     * Draws the static wire entities
     * @param {DrawParameters} parameters
     * @param {MapChunkView} chunk
     */
    drawChunk_WiresForegroundLayer(parameters, chunk) {
        if (G_IS_DEV && globalConfig.debug.doNotRenderStatics) {
            return;
        }

        const drawnUids = new Set();
        const contents = chunk.wireContents;
        for (let y = 0; y < globalConfig.mapChunkSize; ++y) {
            for (let x = 0; x < globalConfig.mapChunkSize; ++x) {
                const entity = contents[x][y];
                if (entity) {
                    if (drawnUids.has(entity.uid)) {
                        continue;
                    }
                    drawnUids.add(entity.uid);
                    const staticComp = entity.components.StaticMapEntity;

                    const sprite = staticComp.getSprite();
                    if (sprite) {
                        staticComp.drawSpriteOnBoundsClipped(parameters, sprite, 2);
                    }
                }
            }
        }
    }

    /**
     * Draws the static wire entities
     * @param {DrawParameters} parameters
     * @param {MapChunkView} chunk
     * @param {string} layer
     */
    drawChunk_ForegroundLayer(parameters, chunk, layer) {
        const drawnUids = new Set();
        const contents = chunk.layersContents.get(layer);
        for (let y = 0; y < globalConfig.mapChunkSize; ++y) {
            for (let x = 0; x < globalConfig.mapChunkSize; ++x) {
                const entity = contents[x][y];
                if (entity) {
                    if (drawnUids.has(entity.uid)) {
                        continue;
                    }
                    drawnUids.add(entity.uid);
                    const staticComp = entity.components.StaticMapEntity;

                    const sprite = staticComp.getSprite();
                    if (sprite) {
                        staticComp.drawSpriteOnBoundsClipped(parameters, sprite, 2);
                    }
                }
            }
        }
    }
}
