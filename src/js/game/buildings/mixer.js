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

export class MetaMixerBuilding extends MetaBuilding {
    constructor() {
        super("mixer");
    }

    /**
     * @param {string} variant
     */
    getSilhouetteColor(variant) {
        return MetaMixerBuilding.silhouetteColors[variant]();
    }

    /**
     * @param {string} variant
     */
    getIsRemovable(variant) {
        return MetaMixerBuilding.isRemovable[variant]();
    }

    /**
     * @param {string} variant
     */
    getIsRotateable(variant) {
        return MetaMixerBuilding.isRotateable[variant]();
    }

    /**
     * @param {GameRoot} root
     */
    getAvailableVariants(root) {
        const variants = MetaMixerBuilding.avaibleVariants;

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
        return MetaMixerBuilding.layerByVariant[variant](root);
    }

    /**
     * @param {string} variant
     */
    getDimensions(variant) {
        return MetaMixerBuilding.dimensions[variant]();
    }

    /**
     * @param {GameRoot} root
     * @param {string} variant
     * @returns {Array<[string, string]>}
     */
    getAdditionalStatistics(root, variant) {
        return MetaMixerBuilding.additionalStatistics[variant](root);
    }

    /**
     * @param {number} rotation
     * @param {number} rotationVariant
     * @param {string} variant
     * @param {Entity} entity
     * @returns {Array<number>|null}
     */
    getSpecialOverlayRenderMatrix(rotation, rotationVariant, variant, entity) {
        let matrices = MetaMixerBuilding.overlayMatrices[variant](entity, rotationVariant);
        return matrices ? matrices[rotation] : null;
    }

    /**
     * Creates the entity at the given location
     * @param {Entity} entity
     */
    setupEntityComponents(entity) {
        MetaMixerBuilding.setupEntityComponents.forEach(func => func(entity));
    }

    /**
     * @param {Entity} entity
     * @param {number} rotationVariant
     * @param {string} variant
     */
    updateVariants(entity, rotationVariant, variant) {
        MetaMixerBuilding.componentVariations[variant](entity, rotationVariant);
    }
}

MetaMixerBuilding.setupEntityComponents = [
    entity =>
        entity.addComponent(
            new ItemProcessorComponent({
                inputsPerCharge: 2,
                processorType: enumItemProcessorTypes.mixer,
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
                        filter: "color",
                    },
                    {
                        pos: new Vector(1, 0),
                        directions: [enumDirection.bottom],
                        filter: "color",
                    },
                ],
            })
        ),
];

MetaMixerBuilding.silhouetteColors = {
    [defaultBuildingVariant]: () => "#cdbb7d",
};

MetaMixerBuilding.dimensions = {
    [defaultBuildingVariant]: () => new Vector(2, 1),
};

MetaMixerBuilding.isRemovable = {
    [defaultBuildingVariant]: () => true,
};

MetaMixerBuilding.isRotateable = {
    [defaultBuildingVariant]: () => true,
};

MetaMixerBuilding.layerByVariant = {
    [defaultBuildingVariant]: root => "regular",
};

MetaMixerBuilding.overlayMatrices = {
    [defaultBuildingVariant]: (entity, rotationVariant) => null,
};

MetaMixerBuilding.avaibleVariants = {
    [defaultBuildingVariant]: root => root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_mixer),
};

MetaMixerBuilding.additionalStatistics = {
    /**
     * @param {*} root
     * @returns {Array<[string, string]>}
     */
    [defaultBuildingVariant]: root => [
        [
            T.ingame.buildingPlacement.infoTexts.speed,
            formatItemsPerSecond(root.hubGoals.getProcessorBaseSpeed(enumItemProcessorTypes.mixer)),
        ],
    ],
};

MetaMixerBuilding.componentVariations = {
    [defaultBuildingVariant]: (entity, rotationVariant) => {
        entity.components.ItemProcessor.inputsPerCharge = 2;

        entity.components.ItemProcessor.type = enumItemProcessorTypes.mixer;

        entity.components.ItemEjector.setSlots([{ pos: new Vector(0, 0), direction: enumDirection.top }]);

        entity.components.ItemAcceptor.setSlots([
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
        ]);
    },
};
