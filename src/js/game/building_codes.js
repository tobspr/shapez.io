/* typehints:start */
import { MetaBuilding } from "./meta_building";
import { AtlasSprite } from "../core/sprites";
import { Vector } from "../core/vector";
/* typehints:end */

/**
 * @typedef {{
 *   metaClass: typeof MetaBuilding,
 *   metaInstance?: MetaBuilding,
 *   variant?: string,
 *   rotationVariant?: number,
 *   tileSize?: Vector,
 *   sprite?: AtlasSprite,
 *   blueprintSprite?: AtlasSprite,
 *   silhouetteColor?: string
 * }} BuildingVariantIdentifier
 */

/**
 * Stores a lookup table for all building variants (for better performance)
 * @type {Object<number, BuildingVariantIdentifier>}
 */
export const gBuildingVariants = {
    // Set later
};

/**
 * Registers a new variant
 * @param {typeof MetaBuilding} meta
 * @param {string} variant
 * @param {number} rotationVariant
 */
export function registerBuildingVariant(
    meta,
    variant = "default" /* @TODO: Circular dependency, actually its defaultBuildingVariant */,
    rotationVariant = 0
) {
    // @ts-ignore
    let code = getCodeFromBuildingData(new meta(), variant, rotationVariant);
    assert(!gBuildingVariants[code], "Duplicate id: " + code);
    gBuildingVariants[code] = {
        metaClass: meta,
        variant,
        rotationVariant,
        // @ts-ignore
        tileSize: new meta().getDimensions(variant),
    };
}

/**
 *
 * @param {String} code
 * @returns {BuildingVariantIdentifier}
 */
export function getBuildingDataFromCode(code) {
    assert(gBuildingVariants[code], "Invalid building code: " + code);
    return gBuildingVariants[code];
}

/**
 * Finds the code for a given variant
 * @param {MetaBuilding} metaBuilding
 * @param {string} variant
 * @param {number} rotationVariant
 * @returns {String}
 */
export function getCodeFromBuildingData(metaBuilding, variant, rotationVariant = 0) {
    return metaBuilding.getId() + "/" + variant + "/" + rotationVariant;
}
