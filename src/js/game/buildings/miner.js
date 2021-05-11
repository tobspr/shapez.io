import { enumDirection, Vector } from "../../core/vector";
import { ItemEjectorComponent } from "../components/item_ejector";
import { MinerComponent } from "../components/miner";
import { Entity } from "../entity";
import { MetaBuilding, defaultBuildingVariant } from "../meta_building";
import { GameRoot } from "../root";
import { enumHubGoalRewards } from "../tutorial_goals";
import { T } from "../../translations";
import { formatItemsPerSecond, generateMatrixRotations } from "../../core/utils";

export class MetaMinerBuilding extends MetaBuilding {
    constructor() {
        super("miner");
    }

    /**
     * @param {string} variant
     */
    getSilhouetteColor(variant) {
        return MetaMinerBuilding.silhouetteColors[variant]();
    }

    /**
     * @param {string} variant
     */
    getIsRemovable(variant) {
        return MetaMinerBuilding.isRemovable[variant]();
    }

    /**
     * @param {string} variant
     */
    getIsRotateable(variant) {
        return MetaMinerBuilding.isRotateable[variant]();
    }

    /**
     * @param {GameRoot} root
     */
    getAvailableVariants(root) {
        const variants = MetaMinerBuilding.avaibleVariants;

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
        return MetaMinerBuilding.layerByVariant[variant](root);
    }

    /**
     * @param {string} variant
     */
    getDimensions(variant) {
        return MetaMinerBuilding.dimensions[variant]();
    }

    /**
     * @param {GameRoot} root
     * @param {string} variant
     * @returns {Array<[string, string]>}
     */
    getAdditionalStatistics(root, variant) {
        return MetaMinerBuilding.additionalStatistics[variant](root);
    }

    /**
     * @param {number} rotation
     * @param {number} rotationVariant
     * @param {string} variant
     * @param {Entity} entity
     * @returns {Array<number>|null}
     */
    getSpecialOverlayRenderMatrix(rotation, rotationVariant, variant, entity) {
        let matrices = MetaMinerBuilding.overlayMatrices[variant](entity, rotationVariant);
        return matrices ? matrices[rotation] : null;
    }

    /**
     * Creates the entity at the given location
     * @param {Entity} entity
     */
    setupEntityComponents(entity) {
        MetaMinerBuilding.setupEntityComponents.forEach(func => func(entity));
    }

    /**
     * @param {Entity} entity
     * @param {number} rotationVariant
     * @param {string} variant
     */
    updateVariants(entity, rotationVariant, variant) {
        MetaMinerBuilding.componentVariations[variant](entity, rotationVariant);
    }
}

MetaMinerBuilding.setupEntityComponents = [
    entity => entity.addComponent(new MinerComponent({})),
    entity =>
        entity.addComponent(
            new ItemEjectorComponent({
                slots: [{ pos: new Vector(0, 0), direction: enumDirection.top }],
            })
        ),
];
MetaMinerBuilding.variants = {
    chainable: "chainable",
};

MetaMinerBuilding.silhouetteColors = {
    [defaultBuildingVariant]: () => "#b37dcd",
    [MetaMinerBuilding.variants.chainable]: () => "#b37dcd",
};

MetaMinerBuilding.dimensions = {
    [defaultBuildingVariant]: () => new Vector(1, 1),
    [MetaMinerBuilding.variants.chainable]: () => new Vector(1, 1),
};

MetaMinerBuilding.isRemovable = {
    [defaultBuildingVariant]: () => true,
    [MetaMinerBuilding.variants.chainable]: () => true,
};

MetaMinerBuilding.isRotateable = {
    [defaultBuildingVariant]: () => true,
    [MetaMinerBuilding.variants.chainable]: () => true,
};

MetaMinerBuilding.layerByVariant = {
    [defaultBuildingVariant]: root => "regular",
    [MetaMinerBuilding.variants.chainable]: root => "regular",
};

MetaMinerBuilding.overlayMatrices = {
    [defaultBuildingVariant]: (entity, rotationVariant) =>
        generateMatrixRotations([1, 1, 1, 1, 0, 1, 1, 1, 1]),
    [MetaMinerBuilding.variants.chainable]: (entity, rotationVariant) =>
        generateMatrixRotations([0, 1, 0, 1, 1, 1, 1, 1, 1]),
};

MetaMinerBuilding.avaibleVariants = {
    [defaultBuildingVariant]: root =>
        !root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_miner_chainable),
    [MetaMinerBuilding.variants.chainable]: root =>
        root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_miner_chainable),
};

MetaMinerBuilding.additionalStatistics = {
    /**
     * @param {*} root
     * @returns {Array<[string, string]>}
     */
    [defaultBuildingVariant]: root => [
        [T.ingame.buildingPlacement.infoTexts.speed, formatItemsPerSecond(root.hubGoals.getMinerBaseSpeed())],
    ],
    /**
     * @param {*} root
     * @returns {Array<[string, string]>}
     */
    [MetaMinerBuilding.variants.chainable]: root => [
        [T.ingame.buildingPlacement.infoTexts.speed, formatItemsPerSecond(root.hubGoals.getMinerBaseSpeed())],
    ],
};

MetaMinerBuilding.componentVariations = {
    [defaultBuildingVariant]: (entity, rotationVariant) => {
        entity.components.Miner.chainable = false;
    },

    [MetaMinerBuilding.variants.chainable]: (entity, rotationVariant) => {
        entity.components.Miner.chainable = true;
    },
};
