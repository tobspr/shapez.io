import { GameSystemWithFilter } from "../game_system_with_filter";
import { StorageComponent } from "../components/storage";
import { DrawParameters } from "../../core/draw_parameters";
import { formatBigNumber, lerp } from "../../core/utils";
import { Loader } from "../../core/loader";
import { BOOL_TRUE_SINGLETON, BOOL_FALSE_SINGLETON } from "../items/boolean_item";
import { MapChunkView } from "../map_chunk_view";

export class StorageSystem extends GameSystemWithFilter {
    constructor(root) {
        super(root, [StorageComponent]);

        this.storageOverlaySprite = Loader.getSprite("sprites/misc/storage_overlay.png");

        /**
         * Stores which uids were already drawn to avoid drawing entities twice
         * @type {Set<number>}
         */
        this.drawnUids = new Set();

        this.root.signals.gameFrameStarted.add(this.clearDrawnUids, this);
    }

    clearDrawnUids() {
        this.drawnUids.clear();
    }

    update() {
        for (let i = this.allEntitiesArray.length - 1; i >= 0; --i) {
            const entity = this.allEntitiesArray[i];
            const storageComp = entity.components.Storage;
            const pinsComp = entity.components.WiredPins;

            // Eject from storage
            if (storageComp.storedItem && storageComp.storedCount > 0) {
                const ejectorComp = entity.components.ItemEjector;

                const nextSlot = ejectorComp.getFirstFreeSlot();
                if (nextSlot !== null) {
                    if (ejectorComp.tryEject(nextSlot, storageComp.storedItem)) {
                        storageComp.storedCount--;

                        if (storageComp.storedCount === 0) {
                            storageComp.storedItem = null;
                        }
                    }
                }
            }

            let targetAlpha = storageComp.storedCount > 0 ? 1 : 0;
            storageComp.overlayOpacity = lerp(storageComp.overlayOpacity, targetAlpha, 0.05);

            pinsComp.slots[0].value = storageComp.storedItem;
            pinsComp.slots[1].value = storageComp.getIsFull() ? BOOL_TRUE_SINGLETON : BOOL_FALSE_SINGLETON;
        }
    }

    /**
     * @param {DrawParameters} parameters
     * @param {MapChunkView} chunk
     */
    drawChunk(parameters, chunk) {
        const contents = chunk.containedEntitiesByLayer.regular;
        for (let i = 0; i < contents.length; ++i) {
            const entity = contents[i];
            const storageComp = entity.components.Storage;
            if (!storageComp) {
                continue;
            }

            const storedItem = storageComp.storedItem;
            if (!storedItem) {
                continue;
            }

            if (this.drawnUids.has(entity.uid)) {
                continue;
            }

            this.drawnUids.add(entity.uid);

            const staticComp = entity.components.StaticMapEntity;

            const context = parameters.context;
            context.globalAlpha = storageComp.overlayOpacity;
            const center = staticComp.getTileSpaceBounds().getCenter().toWorldSpace();
            storedItem.drawItemCenteredClipped(center.x, center.y, parameters, 30);

            this.storageOverlaySprite.drawCached(parameters, center.x - 15, center.y + 15, 30, 15);

            if (parameters.visibleRect.containsCircle(center.x, center.y + 25, 20)) {
                context.font = "bold 10px GameFont";
                context.textAlign = "center";
                context.fillStyle = "#64666e";
                context.fillText(formatBigNumber(storageComp.storedCount), center.x, center.y + 25.5);
                context.textAlign = "left";
            }
            context.globalAlpha = 1;
        }
    }
}
