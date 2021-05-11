import { enumDirection, Vector } from "../../core/vector";
import { ItemAcceptorComponent } from "../components/item_acceptor";
import { ItemEjectorComponent } from "../components/item_ejector";
import { enumItemProcessorTypes, ItemProcessorComponent } from "../components/item_processor";
import { Entity } from "../entity";
import { MetaBuilding, defaultBuildingVariant } from "../meta_building";
import { GameRoot } from "../root";
import { enumHubGoalRewards } from "../tutorial_goals";
import { T } from "../../translations";
import { formatItemsPerSecond, generateMatrixRotations } from "../../core/utils";
import { BeltUnderlaysComponent } from "../components/belt_underlays";

export class MetaBalancerBuilding extends MetaBuilding {
    constructor() {
        super("balancer");
    }

    /**
     * @param {string} variant
     */
    getSilhouetteColor(variant) {
        return MetaBalancerBuilding.silhouetteColors[variant]();
    }

    /**
     * @param {string} variant
     */
    getIsRemovable(variant) {
        return MetaBalancerBuilding.isRemovable[variant]();
    }

    /**
     * @param {string} variant
     */
    getIsRotateable(variant) {
        return MetaBalancerBuilding.isRotateable[variant]();
    }

    /**
     * @param {GameRoot} root
     */
    getAvailableVariants(root) {
        const variants = MetaBalancerBuilding.avaibleVariants;

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
        return MetaBalancerBuilding.layerByVariant[variant](root);
    }

    /**
     * @param {string} variant
     */
    getDimensions(variant) {
        return MetaBalancerBuilding.dimensions[variant]();
    }

    /**
     * @param {string} variant
     */
    getShowLayerPreview(variant) {
        return MetaBalancerBuilding.layerPreview[variant]();
    }

    /**
     * @param {number} rotation
     * @param {number} rotationVariant
     * @param {string} variant
     * @param {Entity} entity
     * @returns {Array<number>|null}
     */
    getSpecialOverlayRenderMatrix(rotation, rotationVariant, variant, entity) {
        let matrices = MetaBalancerBuilding.overlayMatrices[variant](entity, rotationVariant);
        return matrices ? matrices[rotation] : null;
    }

    /**
     * @param {string} variant
     */
    getRenderPins(variant) {
        return MetaBalancerBuilding.renderPins[variant]();
    }

    /**
     * @param {GameRoot} root
     * @param {string} variant
     * @returns {Array<[string, string]>}
     */
    getAdditionalStatistics(root, variant) {
        return MetaBalancerBuilding.additionalStatistics[variant](root);
    }

    /**
     * Creates the entity at the given location
     * @param {Entity} entity
     */
    setupEntityComponents(entity) {
        MetaBalancerBuilding.setupEntityComponents.forEach(func => func(entity));
    }

    /**
     * @param {Entity} entity
     * @param {number} rotationVariant
     * @param {string} variant
     */
    updateVariants(entity, rotationVariant, variant) {
        MetaBalancerBuilding.componentVariations[variant](entity, rotationVariant);
    }
}

MetaBalancerBuilding.setupEntityComponents = [
    entity =>
        entity.addComponent(
            new ItemAcceptorComponent({
                slots: [], // set later
            })
        ),

    entity =>
        entity.addComponent(
            new ItemProcessorComponent({
                inputsPerCharge: 1,
                processorType: enumItemProcessorTypes.balancer,
            })
        ),

    entity =>
        entity.addComponent(
            new ItemEjectorComponent({
                slots: [], // set later
                renderFloatingItems: false,
            })
        ),

    entity => entity.addComponent(new BeltUnderlaysComponent({ underlays: [] })),
];

MetaBalancerBuilding.variants = {
    merger: "merger",
    mergerInverse: "merger-inverse",
    splitter: "splitter",
    splitterInverse: "splitter-inverse",
};

MetaBalancerBuilding.overlayMatrices = {
    [defaultBuildingVariant]: (entity, rotationVariant) => null,
    [MetaBalancerBuilding.variants.merger]: (entity, rotationVariant) =>
        generateMatrixRotations([0, 1, 0, 0, 1, 1, 0, 1, 0]),
    [MetaBalancerBuilding.variants.mergerInverse]: (entity, rotationVariant) =>
        generateMatrixRotations([0, 1, 0, 1, 1, 0, 0, 1, 0]),
    [MetaBalancerBuilding.variants.splitter]: (entity, rotationVariant) =>
        generateMatrixRotations([0, 1, 0, 0, 1, 1, 0, 1, 0]),
    [MetaBalancerBuilding.variants.splitterInverse]: (entity, rotationVariant) =>
        generateMatrixRotations([0, 1, 0, 1, 1, 0, 0, 1, 0]),
};

MetaBalancerBuilding.avaibleVariants = {
    [defaultBuildingVariant]: root => root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_balancer),
    [MetaBalancerBuilding.variants.merger]: root =>
        root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_merger),
    [MetaBalancerBuilding.variants.mergerInverse]: root =>
        root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_merger),
    [MetaBalancerBuilding.variants.splitter]: root =>
        root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_splitter),
    [MetaBalancerBuilding.variants.splitterInverse]: root =>
        root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_splitter),
};

MetaBalancerBuilding.dimensions = {
    [defaultBuildingVariant]: () => new Vector(2, 1),
    [MetaBalancerBuilding.variants.merger]: () => new Vector(1, 1),
    [MetaBalancerBuilding.variants.mergerInverse]: () => new Vector(1, 1),
    [MetaBalancerBuilding.variants.splitter]: () => new Vector(1, 1),
    [MetaBalancerBuilding.variants.splitterInverse]: () => new Vector(1, 1),
};

MetaBalancerBuilding.isRemovable = {
    [defaultBuildingVariant]: () => true,
    [MetaBalancerBuilding.variants.merger]: () => true,
    [MetaBalancerBuilding.variants.mergerInverse]: () => true,
    [MetaBalancerBuilding.variants.splitter]: () => true,
    [MetaBalancerBuilding.variants.splitterInverse]: () => true,
};

MetaBalancerBuilding.isRotateable = {
    [defaultBuildingVariant]: () => true,
    [MetaBalancerBuilding.variants.merger]: () => true,
    [MetaBalancerBuilding.variants.mergerInverse]: () => true,
    [MetaBalancerBuilding.variants.splitter]: () => true,
    [MetaBalancerBuilding.variants.splitterInverse]: () => true,
};

MetaBalancerBuilding.renderPins = {
    [defaultBuildingVariant]: () => null,
    [MetaBalancerBuilding.variants.merger]: () => null,
    [MetaBalancerBuilding.variants.mergerInverse]: () => null,
    [MetaBalancerBuilding.variants.splitter]: () => null,
    [MetaBalancerBuilding.variants.splitterInverse]: () => null,
};

MetaBalancerBuilding.layerPreview = {
    [defaultBuildingVariant]: () => null,
    [MetaBalancerBuilding.variants.merger]: () => null,
    [MetaBalancerBuilding.variants.mergerInverse]: () => null,
    [MetaBalancerBuilding.variants.splitter]: () => null,
    [MetaBalancerBuilding.variants.splitterInverse]: () => null,
};

MetaBalancerBuilding.layerByVariant = {
    [defaultBuildingVariant]: root => "regular",
    [MetaBalancerBuilding.variants.merger]: root => "regular",
    [MetaBalancerBuilding.variants.mergerInverse]: root => "regular",
    [MetaBalancerBuilding.variants.splitter]: root => "regular",
    [MetaBalancerBuilding.variants.splitterInverse]: root => "regular",
};

MetaBalancerBuilding.additionalStatistics = {
    /**
     * @param {*} root
     * @returns {Array<[string, string]>}
     */
    [defaultBuildingVariant]: root => [
        [
            T.ingame.buildingPlacement.infoTexts.speed,
            formatItemsPerSecond(root.hubGoals.getProcessorBaseSpeed(enumItemProcessorTypes.balancer)),
        ],
    ],
    /**
     * @param {*} root
     * @returns {Array<[string, string]>}
     */
    [MetaBalancerBuilding.variants.merger]: root => [
        [
            T.ingame.buildingPlacement.infoTexts.speed,
            formatItemsPerSecond(root.hubGoals.getProcessorBaseSpeed(enumItemProcessorTypes.balancer) / 2),
        ],
    ],
    /**
     * @param {*} root
     * @returns {Array<[string, string]>}
     */
    [MetaBalancerBuilding.variants.mergerInverse]: root => [
        [
            T.ingame.buildingPlacement.infoTexts.speed,
            formatItemsPerSecond(root.hubGoals.getProcessorBaseSpeed(enumItemProcessorTypes.balancer) / 2),
        ],
    ],
    /**
     * @param {*} root
     * @returns {Array<[string, string]>}
     */
    [MetaBalancerBuilding.variants.splitter]: root => [
        [
            T.ingame.buildingPlacement.infoTexts.speed,
            formatItemsPerSecond(root.hubGoals.getProcessorBaseSpeed(enumItemProcessorTypes.balancer) / 2),
        ],
    ],
    /**
     * @param {*} root
     * @returns {Array<[string, string]>}
     */
    [MetaBalancerBuilding.variants.splitterInverse]: root => [
        [
            T.ingame.buildingPlacement.infoTexts.speed,
            formatItemsPerSecond(root.hubGoals.getProcessorBaseSpeed(enumItemProcessorTypes.balancer) / 2),
        ],
    ],
};

MetaBalancerBuilding.silhouetteColors = {
    [defaultBuildingVariant]: () => "#555759",
    [MetaBalancerBuilding.variants.merger]: () => "#555759",
    [MetaBalancerBuilding.variants.mergerInverse]: () => "#555759",
    [MetaBalancerBuilding.variants.splitter]: () => "#555759",
    [MetaBalancerBuilding.variants.splitterInverse]: () => "#555759",
};

MetaBalancerBuilding.componentVariations = {
    [defaultBuildingVariant]: (entity, rotationVariant) => {
        entity.components.ItemAcceptor.setSlots([
            {
                pos: new Vector(0, 0),
                directions: [enumDirection.bottom],
            },
            {
                pos: new Vector(1, 0),
                directions: [enumDirection.bottom],
            },
        ]);

        entity.components.ItemEjector.setSlots([
            { pos: new Vector(0, 0), direction: enumDirection.top },
            { pos: new Vector(1, 0), direction: enumDirection.top },
        ]);

        entity.components.BeltUnderlays.underlays = [
            { pos: new Vector(0, 0), direction: enumDirection.top },
            { pos: new Vector(1, 0), direction: enumDirection.top },
        ];
    },

    [MetaBalancerBuilding.variants.merger]: (entity, rotationVariant) => {
        entity.components.ItemAcceptor.setSlots([
            {
                pos: new Vector(0, 0),
                directions: [enumDirection.bottom],
            },
            {
                pos: new Vector(0, 0),
                directions: [enumDirection.right],
            },
        ]);

        entity.components.ItemEjector.setSlots([{ pos: new Vector(0, 0), direction: enumDirection.top }]);

        entity.components.BeltUnderlays.underlays = [{ pos: new Vector(0, 0), direction: enumDirection.top }];
    },

    [MetaBalancerBuilding.variants.mergerInverse]: (entity, rotationVariant) => {
        entity.components.ItemAcceptor.setSlots([
            {
                pos: new Vector(0, 0),
                directions: [enumDirection.bottom],
            },
            {
                pos: new Vector(0, 0),
                directions: [enumDirection.left],
            },
        ]);

        entity.components.ItemEjector.setSlots([{ pos: new Vector(0, 0), direction: enumDirection.top }]);

        entity.components.BeltUnderlays.underlays = [{ pos: new Vector(0, 0), direction: enumDirection.top }];
    },

    [MetaBalancerBuilding.variants.splitter]: (entity, rotationVariant) => {
        {
            entity.components.ItemAcceptor.setSlots([
                {
                    pos: new Vector(0, 0),
                    directions: [enumDirection.bottom],
                },
            ]);

            entity.components.ItemEjector.setSlots([
                {
                    pos: new Vector(0, 0),
                    direction: enumDirection.top,
                },
                {
                    pos: new Vector(0, 0),
                    direction: enumDirection.right,
                },
            ]);

            entity.components.BeltUnderlays.underlays = [
                { pos: new Vector(0, 0), direction: enumDirection.top },
            ];
        }
    },

    [MetaBalancerBuilding.variants.splitterInverse]: (entity, rotationVariant) => {
        {
            entity.components.ItemAcceptor.setSlots([
                {
                    pos: new Vector(0, 0),
                    directions: [enumDirection.bottom],
                },
            ]);

            entity.components.ItemEjector.setSlots([
                {
                    pos: new Vector(0, 0),
                    direction: enumDirection.top,
                },
                {
                    pos: new Vector(0, 0),
                    direction: enumDirection.left,
                },
            ]);

            entity.components.BeltUnderlays.underlays = [
                { pos: new Vector(0, 0), direction: enumDirection.top },
            ];
        }
    },
};
