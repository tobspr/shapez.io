import { formatItemsPerSecond } from "../../core/utils";
import { enumDirection, Vector } from "../../core/vector";
import { T } from "../../translations";
import { ItemAcceptorComponent } from "../components/item_acceptor";
import { ItemEjectorComponent } from "../components/item_ejector";
import {
    enumItemProcessorTypes,
    ItemProcessorComponent,
    enumItemProcessorRequirements,
} from "../components/item_processor";
import { Entity } from "../entity";
import { defaultBuildingVariant, MetaBuilding } from "../meta_building";
import { GameRoot } from "../root";
import { enumHubGoalRewards } from "../tutorial_goals";
import { WiredPinsComponent, enumPinSlotType } from "../components/wired_pins";

export class MetaPainterBuilding extends MetaBuilding {
    constructor() {
        super("painter");
    }

    /**
     * @param {string} variant
     */
    getSilhouetteColor(variant) {
        return MetaPainterBuilding.silhouetteColors[variant]();
    }

    /**
     * @param {string} variant
     */
    getIsRemovable(variant) {
        return MetaPainterBuilding.isRemovable[variant]();
    }

    /**
     * @param {string} variant
     */
    getIsRotateable(variant) {
        return MetaPainterBuilding.isRotateable[variant]();
    }

    /**
     * @param {GameRoot} root
     */
    getAvailableVariants(root) {
        const variants = MetaPainterBuilding.avaibleVariants;

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
        return MetaPainterBuilding.layerByVariant[variant](root);
    }

    /**
     * @param {string} variant
     */
    getDimensions(variant) {
        return MetaPainterBuilding.dimensions[variant]();
    }

    /**
     * @param {GameRoot} root
     * @param {string} variant
     * @returns {Array<[string, string]>}
     */
    getAdditionalStatistics(root, variant) {
        return MetaPainterBuilding.additionalStatistics[variant](root);
    }

    /**
     * @param {number} rotation
     * @param {number} rotationVariant
     * @param {string} variant
     * @param {Entity} entity
     * @returns {Array<number>|null}
     */
    getSpecialOverlayRenderMatrix(rotation, rotationVariant, variant, entity) {
        let matrices = MetaPainterBuilding.overlayMatrices[variant](entity, rotationVariant);
        return matrices ? matrices[rotation] : null;
    }

    /**
     * Creates the entity at the given location
     * @param {Entity} entity
     */
    setupEntityComponents(entity) {
        MetaPainterBuilding.setupEntityComponents.forEach(func => func(entity));
    }

    /**
     * @param {Entity} entity
     * @param {number} rotationVariant
     * @param {string} variant
     */
    updateVariants(entity, rotationVariant, variant) {
        MetaPainterBuilding.componentVariations[variant](entity, rotationVariant);
    }
}

MetaPainterBuilding.setupEntityComponents = [
    entity => entity.addComponent(new ItemProcessorComponent({})),
    entity =>
        entity.addComponent(
            new ItemEjectorComponent({
                slots: [{ pos: new Vector(1, 0), direction: enumDirection.right }],
            })
        ),
    entity =>
        entity.addComponent(
            new ItemAcceptorComponent({
                slots: [
                    {
                        pos: new Vector(0, 0),
                        directions: [enumDirection.left],
                        filter: "shape",
                    },
                    {
                        pos: new Vector(1, 0),
                        directions: [enumDirection.top],
                        filter: "color",
                    },
                ],
            })
        ),
];

MetaPainterBuilding.variants = {
    mirrored: "mirrored",
    double: "double",
    quad: "quad",
};

MetaPainterBuilding.silhouetteColors = {
    [defaultBuildingVariant]: () => "#cd9b7d",
    [MetaPainterBuilding.variants.mirrored]: () => "#cd9b7d",
    [MetaPainterBuilding.variants.double]: () => "#cd9b7d",
    [MetaPainterBuilding.variants.quad]: () => "#cd9b7d",
};

MetaPainterBuilding.dimensions = {
    [defaultBuildingVariant]: () => new Vector(2, 1),
    [MetaPainterBuilding.variants.mirrored]: () => new Vector(2, 1),
    [MetaPainterBuilding.variants.double]: () => new Vector(2, 2),
    [MetaPainterBuilding.variants.quad]: () => new Vector(4, 1),
};

MetaPainterBuilding.isRemovable = {
    [defaultBuildingVariant]: () => true,
    [MetaPainterBuilding.variants.mirrored]: () => true,
    [MetaPainterBuilding.variants.double]: () => true,
    [MetaPainterBuilding.variants.quad]: () => true,
};

MetaPainterBuilding.isRotateable = {
    [defaultBuildingVariant]: () => true,
    [MetaPainterBuilding.variants.mirrored]: () => true,
    [MetaPainterBuilding.variants.double]: () => true,
    [MetaPainterBuilding.variants.quad]: () => true,
};

MetaPainterBuilding.layerByVariant = {
    [defaultBuildingVariant]: root => "regular",
    [MetaPainterBuilding.variants.mirrored]: root => "regular",
    [MetaPainterBuilding.variants.double]: root => "regular",
    [MetaPainterBuilding.variants.quad]: root => "regular",
};

MetaPainterBuilding.overlayMatrices = {
    [defaultBuildingVariant]: (entity, rotationVariant) => null,
    [MetaPainterBuilding.variants.mirrored]: (entity, rotationVariant) => null,
    [MetaPainterBuilding.variants.double]: (entity, rotationVariant) => null,
    [MetaPainterBuilding.variants.quad]: (entity, rotationVariant) => null,
};

MetaPainterBuilding.avaibleVariants = {
    [defaultBuildingVariant]: root => root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_painter),
    [MetaPainterBuilding.variants.mirrored]: root =>
        root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_painter),
    [MetaPainterBuilding.variants.double]: root =>
        root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_painter_double),
    [MetaPainterBuilding.variants.quad]: root =>
        root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_wires_painter_and_levers),
};

MetaPainterBuilding.additionalStatistics = {
    /**
     * @param {*} root
     * @returns {Array<[string, string]>}
     */
    [defaultBuildingVariant]: root => [
        [
            T.ingame.buildingPlacement.infoTexts.speed,
            formatItemsPerSecond(root.hubGoals.getProcessorBaseSpeed(enumItemProcessorTypes.painter)),
        ],
    ],
    /**
     * @param {*} root
     * @returns {Array<[string, string]>}
     */
    [MetaPainterBuilding.variants.mirrored]: root => [
        [
            T.ingame.buildingPlacement.infoTexts.speed,
            formatItemsPerSecond(root.hubGoals.getProcessorBaseSpeed(enumItemProcessorTypes.painter)),
        ],
    ],
    /**
     * @param {*} root
     * @returns {Array<[string, string]>}
     */
    [MetaPainterBuilding.variants.double]: root => [
        [
            T.ingame.buildingPlacement.infoTexts.speed,
            formatItemsPerSecond(root.hubGoals.getProcessorBaseSpeed(enumItemProcessorTypes.painterDouble)),
        ],
    ],
    /**
     * @param {*} root
     * @returns {Array<[string, string]>}
     */
    [MetaPainterBuilding.variants.quad]: root => [
        [
            T.ingame.buildingPlacement.infoTexts.speed,
            formatItemsPerSecond(root.hubGoals.getProcessorBaseSpeed(enumItemProcessorTypes.painterQuad)),
        ],
    ],
};

MetaPainterBuilding.componentVariations = {
    [defaultBuildingVariant]: (entity, rotationVariant) => {
        if (entity.components.WiredPins) {
            entity.removeComponent(WiredPinsComponent);
        }

        entity.components.ItemAcceptor.setSlots([
            {
                pos: new Vector(0, 0),
                directions: [enumDirection.left],
                filter: "shape",
            },
            {
                pos: new Vector(1, 0),
                directions: [enumDirection.top],
                filter: "color",
            },
        ]);

        entity.components.ItemEjector.setSlots([{ pos: new Vector(1, 0), direction: enumDirection.right }]);

        entity.components.ItemProcessor.type = enumItemProcessorTypes.painter;
        entity.components.ItemProcessor.processingRequirement = null;
        entity.components.ItemProcessor.inputsPerCharge = 2;
    },

    [MetaPainterBuilding.variants.mirrored]: (entity, rotationVariant) => {
        if (entity.components.WiredPins) {
            entity.removeComponent(WiredPinsComponent);
        }

        entity.components.ItemAcceptor.setSlots([
            {
                pos: new Vector(0, 0),
                directions: [enumDirection.left],
                filter: "shape",
            },
            {
                pos: new Vector(1, 0),
                directions: [enumDirection.bottom],
                filter: "color",
            },
        ]);

        entity.components.ItemEjector.setSlots([{ pos: new Vector(1, 0), direction: enumDirection.right }]);

        entity.components.ItemProcessor.type = enumItemProcessorTypes.painter;
        entity.components.ItemProcessor.processingRequirement = null;
        entity.components.ItemProcessor.inputsPerCharge = 2;
    },

    [MetaPainterBuilding.variants.double]: (entity, rotationVariant) => {
        if (entity.components.WiredPins) {
            entity.removeComponent(WiredPinsComponent);
        }

        entity.components.ItemAcceptor.setSlots([
            {
                pos: new Vector(0, 0),
                directions: [enumDirection.left],
                filter: "shape",
            },
            {
                pos: new Vector(0, 1),
                directions: [enumDirection.left],
                filter: "shape",
            },
            {
                pos: new Vector(1, 0),
                directions: [enumDirection.top],
                filter: "color",
            },
        ]);

        entity.components.ItemEjector.setSlots([{ pos: new Vector(1, 0), direction: enumDirection.right }]);

        entity.components.ItemProcessor.type = enumItemProcessorTypes.painterDouble;
        entity.components.ItemProcessor.processingRequirement = null;
        entity.components.ItemProcessor.inputsPerCharge = 3;
    },

    [MetaPainterBuilding.variants.quad]: (entity, rotationVariant) => {
        if (!entity.components.WiredPins) {
            entity.addComponent(new WiredPinsComponent({ slots: [] }));
        }

        entity.components.WiredPins.setSlots([
            {
                pos: new Vector(0, 0),
                direction: enumDirection.bottom,
                type: enumPinSlotType.logicalAcceptor,
            },
            {
                pos: new Vector(1, 0),
                direction: enumDirection.bottom,
                type: enumPinSlotType.logicalAcceptor,
            },
            {
                pos: new Vector(2, 0),
                direction: enumDirection.bottom,
                type: enumPinSlotType.logicalAcceptor,
            },
            {
                pos: new Vector(3, 0),
                direction: enumDirection.bottom,
                type: enumPinSlotType.logicalAcceptor,
            },
        ]);

        entity.components.ItemAcceptor.setSlots([
            {
                pos: new Vector(0, 0),
                directions: [enumDirection.left],
                filter: "shape",
            },
            {
                pos: new Vector(0, 0),
                directions: [enumDirection.bottom],
                filter: "color",
            },
            {
                pos: new Vector(1, 0),
                directions: [enumDirection.bottom],
                filter: "color",
            },
            {
                pos: new Vector(2, 0),
                directions: [enumDirection.bottom],
                filter: "color",
            },
            {
                pos: new Vector(3, 0),
                directions: [enumDirection.bottom],
                filter: "color",
            },
        ]);

        entity.components.ItemEjector.setSlots([{ pos: new Vector(0, 0), direction: enumDirection.top }]);

        entity.components.ItemProcessor.type = enumItemProcessorTypes.painterQuad;
        entity.components.ItemProcessor.processingRequirement = enumItemProcessorRequirements.painterQuad;
        entity.components.ItemProcessor.inputsPerCharge = 5;
    },
};
