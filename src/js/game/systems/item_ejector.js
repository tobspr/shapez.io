import { globalConfig } from "../../core/config";
import { DrawParameters } from "../../core/draw_parameters";
import { createLogger } from "../../core/logging";
import { Rectangle } from "../../core/rectangle";
import { StaleAreaDetector } from "../../core/stale_area_detector";
import { dirInterval } from "../../core/utils";
import { enumDirection, enumDirectionToVector } from "../../core/vector";
import { ACHIEVEMENTS } from "../../platform/achievement_provider";
import { BaseItem } from "../base_item";
import { BeltComponent } from "../components/belt";
import { ItemAcceptorComponent } from "../components/item_acceptor";
import { ItemEjectorComponent } from "../components/item_ejector";
import { Entity } from "../entity";
import { GameSystemWithFilter } from "../game_system_with_filter";
import { MapChunkView } from "../map_chunk_view";

const logger = createLogger("systems/ejector");

export class ItemEjectorSystem extends GameSystemWithFilter {
    constructor(root) {
        super(root, [ItemEjectorComponent]);

        this.staleAreaDetector = new StaleAreaDetector({
            root: this.root,
            name: "item-ejector",
            recomputeMethod: this.recomputeArea.bind(this),
        });

        this.staleAreaDetector.recomputeOnComponentsChanged(
            [ItemEjectorComponent, ItemAcceptorComponent, BeltComponent],
            1
        );

        this.root.signals.postLoadHook.add(this.recomputeCacheFull, this);
    }

    /**
     * Recomputes an area after it changed
     * @param {Rectangle} area
     */
    recomputeArea(area) {
        /** @type {Set<number>} */
        const seenUids = new Set();
        for (let x = 0; x < area.w; ++x) {
            for (let y = 0; y < area.h; ++y) {
                const tileX = area.x + x;
                const tileY = area.y + y;
                // @NOTICE: Item ejector currently only supports regular layer
                const contents = this.root.map.getLayerContentXY(tileX, tileY, "regular");
                if (contents && contents.components.ItemEjector) {
                    if (!seenUids.has(contents.uid)) {
                        seenUids.add(contents.uid);
                        this.recomputeSingleEntityCache(contents);
                    }
                }
            }
        }
    }

    /**
     * Recomputes the whole cache after the game has loaded
     */
    recomputeCacheFull() {
        logger.log("Full cache recompute in post load hook");
        for (let i = this.allEntitiesArray.length - 1; i >= 0; --i) {
            const entity = this.allEntitiesArray[i];
            this.recomputeSingleEntityCache(entity);
        }
    }

    /**
     * @param {Entity} entity
     */
    recomputeSingleEntityCache(entity) {
        const ejectorComp = entity.components.ItemEjector;
        const staticComp = entity.components.StaticMapEntity;

        for (let slotIndex = 0; slotIndex < ejectorComp.slots.length; ++slotIndex) {
            const ejectorSlot = ejectorComp.slots[slotIndex];

            // Clear the old cache.
            ejectorSlot.cachedDestSlot = null;
            ejectorSlot.cachedTargetEntity = null;
            ejectorSlot.cachedBeltPath = null;

            // Figure out where and into which direction we eject items
            const ejectSlotWsTile = staticComp.localTileToWorld(ejectorSlot.pos);
            const ejectSlotWsDirection = staticComp.localDirectionToWorld(ejectorSlot.direction);
            const ejectSlotWsDirectionVector = enumDirectionToVector[ejectSlotWsDirection];
            const ejectSlotTargetWsTile = ejectSlotWsTile.add(ejectSlotWsDirectionVector);

            // Try to find the given acceptor component to take the item
            // Since there can be cross layer dependencies, check on all layers
            const targetEntities = this.root.map.getLayersContentsMultipleXY(
                ejectSlotTargetWsTile.x,
                ejectSlotTargetWsTile.y
            );

            for (let i = 0; i < targetEntities.length; ++i) {
                const targetEntity = targetEntities[i];

                const targetStaticComp = targetEntity.components.StaticMapEntity;
                const targetBeltComp = targetEntity.components.Belt;

                // Check for belts (special case)
                if (targetBeltComp) {
                    const beltAcceptingDirection = targetStaticComp.localDirectionToWorld(enumDirection.top);
                    if (ejectSlotWsDirection === beltAcceptingDirection) {
                        ejectorSlot.cachedTargetEntity = targetEntity;
                        ejectorSlot.cachedBeltPath = targetBeltComp.assignedPath;
                        break;
                    }
                }

                // Check for item acceptors
                const targetAcceptorComp = targetEntity.components.ItemAcceptor;
                if (!targetAcceptorComp) {
                    // Entity doesn't accept items
                    continue;
                }

                const matchingSlot = targetAcceptorComp.findMatchingSlot(
                    targetStaticComp.worldToLocalTile(ejectSlotTargetWsTile),
                    targetStaticComp.worldDirectionToLocal(ejectSlotWsDirection)
                );

                if (!matchingSlot) {
                    // No matching slot found
                    continue;
                }

                // A slot can always be connected to one other slot only
                ejectorSlot.cachedTargetEntity = targetEntity;
                ejectorSlot.cachedDestSlot = matchingSlot;
                break;
            }
        }
    }

    update() {
        this.staleAreaDetector.update();

        // Precompute effective belt speed
        let progressGrowth = 2 * this.root.dynamicTickrate.deltaSeconds;

        if (G_IS_DEV && globalConfig.debug.instantBelts) {
            progressGrowth = 1;
        }

        // Go over all cache entries
        for (let i = this.allEntitiesArray.length - 1; i >= 0; --i) {
            const sourceEntity = this.allEntitiesArray[i];
            const sourceEjectorComp = sourceEntity.components.ItemEjector;

            const slots = sourceEjectorComp.slots;
            for (let j = 0; j < slots.length; ++j) {
                const sourceSlot = slots[j];
                const item = sourceSlot.item;
                if (!item) {
                    // No item available to be ejected
                    continue;
                }

                // Advance items on the slot
                sourceSlot.progress = Math.min(
                    1,
                    sourceSlot.progress +
                        progressGrowth *
                            this.root.hubGoals.getBeltBaseSpeed() *
                            globalConfig.itemSpacingOnBelts
                );

                if (G_IS_DEV && globalConfig.debug.disableEjectorProcessing) {
                    sourceSlot.progress = 1.0;
                }

                // Check if we are still in the process of ejecting, can't proceed then
                if (sourceSlot.progress < 1.0) {
                    continue;
                }

                // Check if we are ejecting to a belt path
                const destPath = sourceSlot.cachedBeltPath;
                if (destPath) {
                    // Try passing the item over
                    if (destPath.tryAcceptItem(item)) {
                        sourceSlot.item = null;
                    }

                    // Always stop here, since there can *either* be a belt path *or*
                    // a slot
                    continue;
                }

                // Check if the target acceptor can actually accept this item
                const destEntity = sourceSlot.cachedTargetEntity;
                const destSlot = sourceSlot.cachedDestSlot;
                if (destSlot) {
                    const targetAcceptorComp = destEntity.components.ItemAcceptor;
                    if (!targetAcceptorComp.canAcceptItem(destSlot.index, item)) {
                        continue;
                    }

                    // Try to hand over the item
                    if (this.tryPassOverItem(item, destEntity, destSlot.index)) {
                        // Handover successful, clear slot
                        if (!this.root.app.settings.getAllSettings().simplifiedBelts) {
                            targetAcceptorComp.onItemAccepted(
                                destSlot.index,
                                destSlot.acceptedDirection,
                                item
                            );
                        }
                        sourceSlot.item = null;
                        continue;
                    }
                }
            }
        }
    }

    /**
     *
     * @param {BaseItem} item
     * @param {Entity} receiver
     * @param {number} slotIndex
     */
    tryPassOverItem(item, receiver, slotIndex) {
        // Try figuring out how what to do with the item
        // @TODO: Kinda hacky. How to solve this properly? Don't want to go through inheritance hell.

        const beltComp = receiver.components.Belt;
        if (beltComp) {
            const path = beltComp.assignedPath;
            assert(path, "belt has no path");
            if (path.tryAcceptItem(item)) {
                return true;
            }
            // Belt can have nothing else
            return false;
        }

        ////////////////////////////////////////////////////////////////////////////////
        ////////////////////////////////////////////////////////////////////////////////
        //
        // NOTICE ! THIS CODE IS DUPLICATED IN THE BELT PATH FOR PERFORMANCE REASONS
        //
        ////////////////////////////////////////////////////////////////////////////////
        ////////////////////////////////////////////////////////////////////////////////

        const itemProcessorComp = receiver.components.ItemProcessor;
        if (itemProcessorComp) {
            // Check for potential filters
            if (!this.root.systemMgr.systems.itemProcessor.checkRequirements(receiver, item, slotIndex)) {
                return false;
            }

            // Its an item processor ..
            if (itemProcessorComp.tryTakeItem(item, slotIndex)) {
                return true;
            }
            // Item processor can have nothing else
            return false;
        }

        const undergroundBeltComp = receiver.components.UndergroundBelt;
        if (undergroundBeltComp) {
            // Its an underground belt. yay.
            if (
                undergroundBeltComp.tryAcceptExternalItem(
                    item,
                    this.root.hubGoals.getUndergroundBeltBaseSpeed()
                )
            ) {
                return true;
            }

            // Underground belt can have nothing else
            return false;
        }

        const storageComp = receiver.components.Storage;
        if (storageComp) {
            // It's a storage
            if (storageComp.canAcceptItem(item)) {
                storageComp.takeItem(item);
                return true;
            }

            // Storage can't have anything else
            return false;
        }

        const filterComp = receiver.components.Filter;
        if (filterComp) {
            // It's a filter! Unfortunately the filter has to know a lot about it's
            // surrounding state and components, so it can't be within the component itself.
            if (this.root.systemMgr.systems.filter.tryAcceptItem(receiver, slotIndex, item)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param {DrawParameters} parameters
     * @param {MapChunkView} chunk
     */
    drawChunk(parameters, chunk) {
        if (this.root.app.settings.getAllSettings().simplifiedBelts) {
            // Disabled in potato mode
            return;
        }

        const contents = chunk.containedEntitiesByLayer.regular;

        for (let i = 0; i < contents.length; ++i) {
            const entity = contents[i];
            const ejectorComp = entity.components.ItemEjector;
            if (!ejectorComp) {
                continue;
            }

            const staticComp = entity.components.StaticMapEntity;

            for (let i = 0; i < ejectorComp.slots.length; ++i) {
                const slot = ejectorComp.slots[i];
                const ejectedItem = slot.item;

                if (!ejectedItem) {
                    // No item
                    continue;
                }

                if (!ejectorComp.renderFloatingItems && !slot.cachedTargetEntity) {
                    // Not connected to any building
                    continue;
                }

                // Limit the progress to the maximum available space on the next belt (also see #1000)
                let progress = slot.progress;
                const nextBeltPath = slot.cachedBeltPath;
                if (nextBeltPath) {
                    /*
                    If you imagine the track between the center of the building and the center of the first belt as
                    a range from 0 to 1:

                           Building              Belt
                    |         X         |         X         |
                    |         0...................1         |

                    And for example the first item on belt has a distance of 0.4 to the beginning of the belt:

                           Building              Belt
                    |         X         |         X         |
                    |         0...................1         |
                                               ^ item

                    Then the space towards this first item is always 0.5 (the distance from the center of the building to the beginning of the belt)
                    PLUS the spacing to the item, so in this case 0.5 + 0.4 = 0.9:

                    Building              Belt
                    |         X         |         X         |
                    |         0...................1         |
                                               ^ item @ 0.9

                    Since items must not get clashed, we need to substract some spacing (lets assume it is 0.6, exact value see globalConfig.itemSpacingOnBelts),
                    So we do 0.9 - globalConfig.itemSpacingOnBelts = 0.3

                    Building              Belt
                    |         X         |         X         |
                    |         0...................1         |
                                    ^           ^ item @ 0.9
                                    ^ max progress = 0.3

                    Because now our range actually only goes to the end of the building, and not towards the center of the building, we need to multiply
                    all values by 2:

                    Building              Belt
                    |         X         |         X         |
                    |         0.........1.........2         |
                                    ^           ^ item @ 1.8
                                    ^ max progress = 0.6

                    And that's it! If you summarize the calculations from above into a formula, you get the one below.
                    */

                    const maxProgress =
                        (0.5 + nextBeltPath.spacingToFirstItem - globalConfig.itemSpacingOnBelts) * 2;
                    progress = Math.min(maxProgress, progress);
                }

                // Skip if the item would barely be visible
                if (progress < 0.05) {
                    continue;
                }

                const realPosition = staticComp.localTileToWorld(slot.pos);
                if (!chunk.tileSpaceRectangle.containsPoint(realPosition.x, realPosition.y)) {
                    // Not within this chunk
                    continue;
                }

                const realDirection = staticComp.localDirectionToWorld(slot.direction);
                const realDirectionVector = enumDirectionToVector[realDirection];

                const tileX = realPosition.x + 0.5 + realDirectionVector.x * 0.5 * progress;
                const tileY = realPosition.y + 0.5 + realDirectionVector.y * 0.5 * progress;

                const worldX = tileX * globalConfig.tileSize;
                const worldY = tileY * globalConfig.tileSize;

                ejectedItem.drawItemCenteredClipped(
                    worldX,
                    worldY,
                    parameters,
                    globalConfig.defaultItemDiameter
                );
            }
        }
    }
}
