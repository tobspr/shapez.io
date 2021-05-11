import { globalConfig } from "../../core/config";
import { Loader } from "../../core/loader";
import { BaseItem } from "../base_item";
import { enumColors } from "../colors";
import { DisplayComponent } from "../components/display";
import { GameSystemWithFilter } from "../game_system_with_filter";
import { isTrueItem } from "../items/boolean_item";
import { ColorItem } from "../items/color_item";
import { MapChunkView } from "../map_chunk_view";

export class DisplaySystem extends GameSystemWithFilter {
    constructor(root) {
        super(root, [DisplayComponent]);

        /** @type {Object<string, import("../../core/sprites").AtlasSprite>} */
        this.displaySprites = {};

        for (const colorId in enumColors) {
            if (colorId === enumColors.uncolored) {
                continue;
            }
            DisplaySystem.displaySprites[colorId] = Loader.getSprite(
                "sprites/wires/display/" + colorId + ".png"
            );
        }
    }

    static getId() {
        return "display";
    }

    /**
     * Returns the color / value a display should show
     * @param {BaseItem} value
     * @returns {BaseItem}
     */
    getDisplayItem(value) {
        if (!value) {
            return null;
        }

        return DisplaySystem.displayItemType[value.getItemType()](value);
    }

    /**
     * Draws a given chunk
     * @param {import("../../core/draw_parameters").DrawParameters} parameters
     * @param {MapChunkView} chunk
     */
    drawChunk_ForegroundStaticLayer(parameters, chunk) {
        const contents = chunk.containedEntitiesByLayer.regular;
        for (let i = 0; i < contents.length; ++i) {
            const entity = contents[i];
            if (entity && entity.components.Display) {
                const pinsComp = entity.components.WiredPins;
                const network = pinsComp.slots[0].linkedNetwork;

                if (!network || !network.hasValue()) {
                    continue;
                }

                const value = this.getDisplayItem(network.currentValue);

                if (!value) {
                    continue;
                }

                const origin = entity.components.StaticMapEntity.origin;
                DisplaySystem.displayItem[value.getItemType()](parameters, value, origin, globalConfig);
            }
        }
    }
}

DisplaySystem.displaySprites = [];
DisplaySystem.displayItemType = {
    boolean: value => (isTrueItem(value) ? ColorItem.ITEM_SINGLETONS[enumColors.white] : null),

    color: value =>
        /**@type {ColorItem} */
        (value).color === enumColors.uncolored ? null : /**@type {ColorItem} */ (value),

    shape: value => value,
};

DisplaySystem.displayItem = {
    color: (parameters, value, origin, globalConfig) =>
        DisplaySystem.displaySprites[/** @type {ColorItem} */ (value).color].drawCachedCentered(
            parameters,
            (origin.x + 0.5) * globalConfig.tileSize,
            (origin.y + 0.5) * globalConfig.tileSize,
            globalConfig.tileSize
        ),

    shape: (parameters, value, origin, globalConfig) =>
        value.drawItemCenteredClipped(
            (origin.x + 0.5) * globalConfig.tileSize,
            (origin.y + 0.5) * globalConfig.tileSize,
            parameters,
            DisplaySystem.shapeRadius(),
            DisplaySystem.shapeBackground()
        ),
};

DisplaySystem.shapeRadius = () => 30;
DisplaySystem.shapeBackground = () => true;
