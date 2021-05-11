import { globalConfig } from "../../core/config";
import { DrawParameters } from "../../core/draw_parameters";
import { Loader } from "../../core/loader";
import { types } from "../../savegame/serialization";
import { BaseItem } from "../base_item";
import { enumColors } from "../colors";
import { THEME } from "../theme";

export class ColorItem extends BaseItem {
    static getId() {
        return "color";
    }

    static getSchema() {
        return types.enum(enumColors);
    }

    serialize() {
        return this.color;
    }

    deserialize(data) {
        this.color = data;
    }

    /** @returns {"color"} **/
    getItemType() {
        return "color";
    }

    /**
     * @returns {string}
     */
    getAsCopyableKey() {
        return this.color;
    }

    /**
     * @param {BaseItem} other
     */
    equalsImpl(other) {
        return this.color === /** @type {ColorItem} */ (other).color;
    }

    /**
     * @param {enumColors} color
     */
    constructor(color) {
        super();
        this.color = color;
    }

    getBackgroundColorAsResource() {
        return THEME.map.resources[this.color];
    }

    /**
     * Draws the item to a canvas
     * @param {CanvasRenderingContext2D} context
     * @param {number} size
     */
    drawFullSizeOnCanvas(context, size) {
        if (!this.cachedSprite) {
            this.cachedSprite = Loader.getSprite("sprites/colors/" + this.color + ".png");
        }
        this.cachedSprite.drawCentered(context, size / 2, size / 2, size);
    }

    /**
     * @param {number} x
     * @param {number} y
     * @param {number} diameter
     * @param {DrawParameters} parameters
     */
    drawItemCenteredClipped(x, y, parameters, diameter = globalConfig.defaultItemDiameter) {
        const realDiameter = diameter * 0.6;
        const func = ColorItem.drawingFunctionByColor[this.color];

        if (func) {
            func(x, y, parameters, realDiameter, this.color);
            return;
        }

        if (!this.cachedSprite) {
            this.cachedSprite = Loader.getSprite("sprites/colors/" + this.color + ".png");
        }
        this.cachedSprite.drawCachedCentered(parameters, x, y, realDiameter);
    }
}

ColorItem.drawingFunctionByColor = {};

ColorItem.resolveSingleton = (root, itemData) => {
    return ColorItem.ITEM_SINGLETONS[itemData];
};

/**
 * Singleton instances
 * @type {Object<enumColors, ColorItem>}
 */
ColorItem.ITEM_SINGLETONS = {};

for (const color in enumColors) {
    ColorItem.ITEM_SINGLETONS[color] = new ColorItem(color);
}
