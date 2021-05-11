import { formatItemsPerSecond } from "../../core/utils";
import { enumDirection, Vector } from "../../core/vector";
import { T } from "../../translations";
import { ItemAcceptorComponent } from "../components/item_acceptor";
import { ItemEjectorComponent } from "../components/item_ejector";
import { enumItemProcessorTypes, ItemProcessorComponent } from "../components/item_processor";
import { Entity } from "../entity";
import { defaultBuildingVariant, MetaBuilding } from "../meta_building";
import { GameRoot } from "../root";
import { enumHubGoalRewards } from "../tutorial_goals";

export class MetaStackerBuilding extends MetaBuilding {
    constructor() {
        super("stacker");
    }

    /**
     * @param {string} variant
     */
    getSilhouetteColor(variant) {
        return MetaStackerBuilding.silhouetteColors[variant]();
    }

    /**
     * @param {string} variant
     */
    getIsRemovable(variant) {
        return MetaStackerBuilding.isRemovable[variant]();
    }

    /**
     * @param {string} variant
     */
    getIsRotateable(variant) {
        return MetaStackerBuilding.isRotateable[variant]();
    }

    /**
     * @param {GameRoot} root
     */
    getAvailableVariants(root) {
        const variants = MetaStackerBuilding.avaibleVariants;

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
        return MetaStackerBuilding.layerByVariant[variant](root);
    }

    /**
     * @param {string} variant
     */
    getDimensions(variant) {
        return MetaStackerBuilding.dimensions[variant]();
    }

    /**
     * @param {string} variant
     */
    getShowLayerPreview(variant) {
        return MetaStackerBuilding.layerPreview[variant]();
    }

    /**
     * @param {GameRoot} root
     * @param {string} variant
     * @returns {Array<[string, string]>}
     */
    getAdditionalStatistics(root, variant) {
        return MetaStackerBuilding.additionalStatistics[variant](root);
    }

    /**
     * @param {number} rotation
     * @param {number} rotationVariant
     * @param {string} variant
     * @param {Entity} entity
     * @returns {Array<number>|null}
     */
    getSpecialOverlayRenderMatrix(rotation, rotationVariant, variant, entity) {
        let matrices = MetaStackerBuilding.overlayMatrices[variant](entity, rotationVariant);
        return matrices ? matrices[rotation] : null;
    }

    /**
     * @param {string} variant
     */
    getRenderPins(variant) {
        return MetaStackerBuilding.renderPins[variant]();
    }

    /**
     * Creates the entity at the given location
     * @param {Entity} entity
     */
    setupEntityComponents(entity) {
        MetaStackerBuilding.setupEntityComponents.forEach(func => func(entity));
    }

    /**
     * @param {Entity} entity
     * @param {number} rotationVariant
     * @param {string} variant
     */
    updateVariants(entity, rotationVariant, variant) {
        MetaStackerBuilding.componentVariations[variant](entity, rotationVariant);
    }
}

MetaStackerBuilding.setupEntityComponents = [
    entity =>
        entity.addComponent(
            new ItemProcessorComponent({
                inputsPerCharge: 2,
                processorType: enumItemProcessorTypes.stacker,
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
                    {
                        pos: new Vector(1, 0),
                        directions: [enumDirection.bottom],
                        filter: "shape",
                    },
                ],
            })
        ),
];

MetaStackerBuilding.dimensions = {
    [defaultBuildingVariant]: () => new Vector(2, 1),
};

MetaStackerBuilding.silhouetteColors = {
    [defaultBuildingVariant]: () => "#9fcd7d",
};

MetaStackerBuilding.overlayMatrices = {
    [defaultBuildingVariant]: (entity, rotationVariant) => null,
};

MetaStackerBuilding.avaibleVariants = {
    [defaultBuildingVariant]: root => root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_stacker),
};

MetaStackerBuilding.isRemovable = {
    [defaultBuildingVariant]: () => true,
};

MetaStackerBuilding.isRotateable = {
    [defaultBuildingVariant]: () => true,
};

MetaStackerBuilding.layerByVariant = {
    [defaultBuildingVariant]: root => "regular",
};

MetaStackerBuilding.layerPreview = {
    [defaultBuildingVariant]: () => null,
};

MetaStackerBuilding.renderPins = {
    [defaultBuildingVariant]: () => null,
};

MetaStackerBuilding.additionalStatistics = {
    /**
     * @param {*} root
     * @returns {Array<[string, string]>}
     */
    [defaultBuildingVariant]: root => [
        [
            T.ingame.buildingPlacement.infoTexts.speed,
            formatItemsPerSecond(root.hubGoals.getProcessorBaseSpeed(enumItemProcessorTypes.stacker)),
        ],
    ],
};

MetaStackerBuilding.componentVariations = {
    [defaultBuildingVariant]: (entity, rotationVariant) => {
        entity.components.ItemProcessor.inputsPerCharge = 2;

        entity.components.ItemProcessor.type = enumItemProcessorTypes.stacker;

        entity.components.ItemEjector.setSlots([{ pos: new Vector(0, 0), direction: enumDirection.top }]);

        entity.components.ItemAcceptor.setSlots([
            {
                pos: new Vector(0, 0),
                directions: [enumDirection.bottom],
                filter: "shape",
            },
            {
                pos: new Vector(1, 0),
                directions: [enumDirection.bottom],
                filter: "shape",
            },
        ]);
    },
};
