import { globalConfig } from "../../core/config";
import { BaseItem } from "../base_item";
import { FilterComponent } from "../components/filter";
import { Entity } from "../entity";
import { GameSystemWithFilter } from "../game_system_with_filter";
import { BOOL_TRUE_SINGLETON } from "../items/boolean_item";

const MAX_ITEMS_IN_QUEUE = 2;

export class FilterSystem extends GameSystemWithFilter {
    constructor(root) {
        super(root, [FilterComponent]);
    }

    static getId() {
        return "filter";
    }

    update() {
        const progress =
            this.root.dynamicTickrate.deltaSeconds *
            this.root.hubGoals.getBeltBaseSpeed() *
            globalConfig.itemSpacingOnBelts;

        const requiredProgress = 1 - progress;

        for (let i = 0; i < this.allEntities.length; ++i) {
            const entity = this.allEntities[i];
            const filterComp = entity.components.Filter;
            const ejectorComp = entity.components.ItemEjector;

            // Process payloads
            const slotsAndLists = [filterComp.pendingItemsToLeaveThrough, filterComp.pendingItemsToReject];
            for (let slotIndex = 0; slotIndex < slotsAndLists.length; ++slotIndex) {
                const pendingItems = slotsAndLists[slotIndex];

                for (let j = 0; j < pendingItems.length; ++j) {
                    const nextItem = pendingItems[j];
                    // Advance next item
                    nextItem.progress = Math.min(requiredProgress, nextItem.progress + progress);
                    // Check if it's ready to eject
                    if (nextItem.progress >= requiredProgress - 1e-5) {
                        if (ejectorComp.tryEject(slotIndex, nextItem.item)) {
                            pendingItems.shift();
                        }
                    }
                }
            }
        }
    }

    /**
     *
     * @param {Entity} entity
     * @param {number} slot
     * @param {BaseItem} item
     */
    tryAcceptItem(entity, slot, item) {
        const network = entity.components.WiredPins.slots[0].linkedNetwork;
        if (!network || !network.hasValue()) {
            // Filter is not connected
            return false;
        }

        const value = network.currentValue;
        const filterComp = entity.components.Filter;
        assert(filterComp, "entity is no filter");

        // Figure out which list we have to check
        let listToCheck = FilterSystem.listToCheck(entity, slot, item, filterComp, value);

        if (listToCheck.length >= MAX_ITEMS_IN_QUEUE) {
            // Busy
            return false;
        }

        // Actually accept item
        listToCheck.push({
            item,
            progress: 0.0,
        });
        return true;
    }
}

FilterSystem.listToCheck = (entity, slot, item, filterComp, networkValue) =>
    networkValue.equals(BOOL_TRUE_SINGLETON) || networkValue.equals(item)
        ? filterComp.pendingItemsToLeaveThrough
        : filterComp.pendingItemsToReject;
