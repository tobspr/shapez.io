import { types } from "../savegame/serialization";
import { gItemRegistry } from "../core/global_registries";

/**
 * Resolves items so we share instances
 * @param {import("./root").GameRoot} root
 * @param {{$: string, data: any }} data
 */
export function itemResolverSingleton(root, data) {
    const itemType = data.$;
    const itemData = data.data;

    for (const itemId in shapezAPI.ingame.items) {
        if (!shapezAPI.ingame.items.hasOwnProperty(itemId)) continue;
        const itemClass = shapezAPI.ingame.items[itemId];
        if (itemType !== itemClass.getId()) continue;
        return itemClass.resolveSingleton(root, itemData);
    }
    assertAlways(false, "Unknown item type: " + itemType);
}

export const typeItemSingleton = types.obj(gItemRegistry, itemResolverSingleton);
