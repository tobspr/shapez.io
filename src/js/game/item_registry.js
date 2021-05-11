import { gItemRegistry } from "../core/global_registries";
import { ShapeItem } from "./items/shape_item";
import { ColorItem } from "./items/color_item";
import { BooleanItem } from "./items/boolean_item";

export function addVanillaItemsToAPI() {
    shapezAPI.ingame.items[ShapeItem.getId()] = ShapeItem;
    shapezAPI.ingame.items[ColorItem.getId()] = ColorItem;
    shapezAPI.ingame.items[BooleanItem.getId()] = BooleanItem;
}

export function initItemRegistry() {
    for (const itemId in shapezAPI.ingame.items) {
        if (!shapezAPI.ingame.items.hasOwnProperty(itemId)) continue;
        const itemClass = shapezAPI.ingame.items[itemId];
        gItemRegistry.register(itemClass);
    }
}
