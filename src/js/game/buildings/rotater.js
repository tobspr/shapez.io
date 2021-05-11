import { formatItemsPerSecond, generateMatrixRotations } from "../../core/utils";
import { enumDirection, Vector } from "../../core/vector";
import { T } from "../../translations";
import { ItemAcceptorComponent } from "../components/item_acceptor";
import { ItemEjectorComponent } from "../components/item_ejector";
import { enumItemProcessorTypes, ItemProcessorComponent } from "../components/item_processor";
import { Entity } from "../entity";
import { defaultBuildingVariant, MetaBuilding } from "../meta_building";
import { GameRoot } from "../root";
import { enumHubGoalRewards } from "../tutorial_goals";

export class MetaRotaterBuilding extends MetaBuilding {
    constructor() {
        super("rotater");
    }

    /**
     * @param {string} variant
     */
    getSilhouetteColor(variant) {
        return MetaRotaterBuilding.silhouetteColors[variant]();
    }

    /**
     * @param {string} variant
     */
    getIsRemovable(variant) {
        return MetaRotaterBuilding.isRemovable[variant]();
    }

    /**
     * @param {string} variant
     */
    getIsRotateable(variant) {
        return MetaRotaterBuilding.isRotateable[variant]();
    }

    /**
     * @param {GameRoot} root
     */
    getAvailableVariants(root) {
        const variants = MetaRotaterBuilding.avaibleVariants;

        let available = [];
        for (const variant in variants) {
            if (variants[variant](root)) available.push(variant);
        }

        return available;
    }

    /**
     * Returns the edit layer of the building
     * @param {GameRoot} root
     * @param {string} variant
     * @returns {Layer}
     */
    getLayer(root, variant) {
        // @ts-ignore
        return MetaRotaterBuilding.layerByVariant[variant](root);
    }

    /**
     * @param {string} variant
     */
    getDimensions(variant) {
        return MetaRotaterBuilding.dimensions[variant]();
    }

    /**
     * @param {string} variant
     */
    getShowLayerPreview(variant) {
        return MetaRotaterBuilding.layerPreview[variant]();
    }

    /**
     * @param {GameRoot} root
     * @param {string} variant
     * @returns {Array<[string, string]>}
     */
    getAdditionalStatistics(root, variant) {
        return MetaRotaterBuilding.additionalStatistics[variant](root);
    }

    /**
     * @param {number} rotation
     * @param {number} rotationVariant
     * @param {string} variant
     * @param {Entity} entity
     * @returns {Array<number>|null}
     */
    getSpecialOverlayRenderMatrix(rotation, rotationVariant, variant, entity) {
        let matrices = MetaRotaterBuilding.overlayMatrices[variant](entity, rotationVariant);
        return matrices ? matrices[rotation] : null;
    }

    /**
     * @param {string} variant
     */
    getRenderPins(variant) {
        return MetaRotaterBuilding.renderPins[variant]();
    }

    /**
     * Creates the entity at the given location
     * @param {Entity} entity
     */
    setupEntityComponents(entity) {
        MetaRotaterBuilding.setupEntityComponents.forEach(func => func(entity));
    }

    /**
     * @param {Entity} entity
     * @param {number} rotationVariant
     * @param {string} variant
     */
    updateVariants(entity, rotationVariant, variant) {
        MetaRotaterBuilding.componentVariations[variant](entity, rotationVariant);
    }
}

MetaRotaterBuilding.setupEntityComponents = [
    entity =>
        entity.addComponent(
            new ItemProcessorComponent({
                inputsPerCharge: 1,
                processorType: enumItemProcessorTypes.rotater,
            })
        ),
    entity =>
        entity.addComponent(
            new ItemEjectorComponent({
                slots: [{ pos: new Vector(0, 0), direction: enumDirection.top }],
            })
        ),
    entity =>
        entity.addComponent(
            new ItemAcceptorComponent({
                slots: [
                    {
                        pos: new Vector(0, 0),
                        directions: [enumDirection.bottom],
                        filter: "shape",
                    },
                ],
            })
        ),
];

MetaRotaterBuilding.variants = {
    ccw: "ccw",
    rotate180: "rotate180",
};

MetaRotaterBuilding.dimensions = {
    [defaultBuildingVariant]: () => new Vector(1, 1),
    [MetaRotaterBuilding.variants.ccw]: () => new Vector(1, 1),
    [MetaRotaterBuilding.variants.rotate180]: () => new Vector(1, 1),
};

MetaRotaterBuilding.silhouetteColors = {
    [defaultBuildingVariant]: () => "#7dc6cd",
    [MetaRotaterBuilding.variants.ccw]: () => "#7dc6cd",
    [MetaRotaterBuilding.variants.rotate180]: () => "#7dc6cd",
};

MetaRotaterBuilding.overlayMatrices = {
    [defaultBuildingVariant]: (entity, rotationVariant) =>
        generateMatrixRotations([0, 1, 1, 1, 1, 0, 0, 1, 1]),
    [MetaRotaterBuilding.variants.ccw]: (entity, rotationVariant) =>
        generateMatrixRotations([1, 1, 0, 0, 1, 1, 1, 1, 0]),
    [MetaRotaterBuilding.variants.rotate180]: (entity, rotationVariant) =>
        generateMatrixRotations([1, 1, 0, 1, 1, 1, 0, 1, 1]),
};

MetaRotaterBuilding.avaibleVariants = {
    [defaultBuildingVariant]: root => root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_rotater),
    [MetaRotaterBuilding.variants.ccw]: root =>
        root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_rotater_ccw),
    [MetaRotaterBuilding.variants.rotate180]: root =>
        root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_rotater_180),
};

MetaRotaterBuilding.isRemovable = {
    [defaultBuildingVariant]: () => true,
    [MetaRotaterBuilding.variants.ccw]: () => true,
    [MetaRotaterBuilding.variants.rotate180]: () => true,
};

MetaRotaterBuilding.isRotateable = {
    [defaultBuildingVariant]: () => true,
    [MetaRotaterBuilding.variants.ccw]: () => true,
    [MetaRotaterBuilding.variants.rotate180]: () => true,
};

MetaRotaterBuilding.layerByVariant = {
    [defaultBuildingVariant]: root => "regular",
    [MetaRotaterBuilding.variants.ccw]: root => "regular",
    [MetaRotaterBuilding.variants.rotate180]: root => "regular",
};

MetaRotaterBuilding.layerPreview = {
    [defaultBuildingVariant]: () => null,
    [MetaRotaterBuilding.variants.ccw]: () => null,
    [MetaRotaterBuilding.variants.rotate180]: () => null,
};

MetaRotaterBuilding.renderPins = {
    [defaultBuildingVariant]: () => null,
    [MetaRotaterBuilding.variants.ccw]: () => null,
    [MetaRotaterBuilding.variants.rotate180]: () => null,
};

MetaRotaterBuilding.additionalStatistics = {
    /**
     * @param {*} root
     * @returns {Array<[string, string]>}
     */
    [defaultBuildingVariant]: root => [
        [
            T.ingame.buildingPlacement.infoTexts.speed,
            formatItemsPerSecond(root.hubGoals.getProcessorBaseSpeed(enumItemProcessorTypes.rotater)),
        ],
    ],
    /**
     * @param {*} root
     * @returns {Array<[string, string]>}
     */
    [MetaRotaterBuilding.variants.ccw]: root => [
        [
            T.ingame.buildingPlacement.infoTexts.speed,
            formatItemsPerSecond(root.hubGoals.getProcessorBaseSpeed(enumItemProcessorTypes.rotaterCCW)),
        ],
    ],
    /**
     * @param {*} root
     * @returns {Array<[string, string]>}
     */
    [MetaRotaterBuilding.variants.rotate180]: root => [
        [
            T.ingame.buildingPlacement.infoTexts.speed,
            formatItemsPerSecond(root.hubGoals.getProcessorBaseSpeed(enumItemProcessorTypes.rotater180)),
        ],
    ],
};

MetaRotaterBuilding.componentVariations = {
    [defaultBuildingVariant]: (entity, rotationVariant) => {
        entity.components.ItemProcessor.type = enumItemProcessorTypes.rotater;
    },

    [MetaRotaterBuilding.variants.ccw]: (entity, rotationVariant) => {
        entity.components.ItemProcessor.type = enumItemProcessorTypes.rotaterCCW;
    },

    [MetaRotaterBuilding.variants.rotate180]: (entity, rotationVariant) => {
        entity.components.ItemProcessor.type = enumItemProcessorTypes.rotater180;
    },
};
