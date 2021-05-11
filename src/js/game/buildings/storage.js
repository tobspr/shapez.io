import { formatBigNumber } from "../../core/utils";
import { enumDirection, Vector } from "../../core/vector";
import { T } from "../../translations";
import { ItemAcceptorComponent } from "../components/item_acceptor";
import { ItemEjectorComponent } from "../components/item_ejector";
import { StorageComponent } from "../components/storage";
import { enumPinSlotType, WiredPinsComponent } from "../components/wired_pins";
import { Entity } from "../entity";
import { defaultBuildingVariant, MetaBuilding } from "../meta_building";
import { GameRoot } from "../root";
import { enumHubGoalRewards } from "../tutorial_goals";

const storageSize = 5000;

export class MetaStorageBuilding extends MetaBuilding {
    constructor() {
        super("storage");
    }

    /**
     * @param {string} variant
     */
    getSilhouetteColor(variant) {
        return MetaStorageBuilding.silhouetteColors[variant]();
    }

    /**
     * @param {string} variant
     */
    getIsRemovable(variant) {
        return MetaStorageBuilding.isRemovable[variant]();
    }

    /**
     * @param {string} variant
     */
    getIsRotateable(variant) {
        return MetaStorageBuilding.isRotateable[variant]();
    }

    /**
     * @param {GameRoot} root
     */
    getAvailableVariants(root) {
        const variants = MetaStorageBuilding.avaibleVariants;

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
        return MetaStorageBuilding.layerByVariant[variant](root);
    }

    /**
     * @param {string} variant
     */
    getDimensions(variant) {
        return MetaStorageBuilding.dimensions[variant]();
    }

    /**
     * @param {string} variant
     */
    getShowLayerPreview(variant) {
        return MetaStorageBuilding.layerPreview[variant]();
    }

    /**
     * @param {GameRoot} root
     * @param {string} variant
     * @returns {Array<[string, string]>}
     */
    getAdditionalStatistics(root, variant) {
        return MetaStorageBuilding.additionalStatistics[variant](root);
    }

    /**
     * @param {number} rotation
     * @param {number} rotationVariant
     * @param {string} variant
     * @param {Entity} entity
     * @returns {Array<number>|null}
     */
    getSpecialOverlayRenderMatrix(rotation, rotationVariant, variant, entity) {
        let matrices = MetaStorageBuilding.overlayMatrices[variant](entity, rotationVariant);
        return matrices ? matrices[rotation] : null;
    }

    /**
     * @param {string} variant
     */
    getRenderPins(variant) {
        return MetaStorageBuilding.renderPins[variant]();
    }

    /**
     * Creates the entity at the given location
     * @param {Entity} entity
     */
    setupEntityComponents(entity) {
        MetaStorageBuilding.setupEntityComponents.forEach(func => func(entity));
    }

    /**
     * @param {Entity} entity
     * @param {number} rotationVariant
     * @param {string} variant
     */
    updateVariants(entity, rotationVariant, variant) {
        MetaStorageBuilding.componentVariations[variant](entity, rotationVariant);
    }
}

MetaStorageBuilding.setupEntityComponents = [
    entity =>
        // Required, since the item processor needs this.
        entity.addComponent(
            new ItemEjectorComponent({
                slots: [
                    {
                        pos: new Vector(0, 0),
                        direction: enumDirection.top,
                    },
                    {
                        pos: new Vector(1, 0),
                        direction: enumDirection.top,
                    },
                ],
            })
        ),
    entity =>
        entity.addComponent(
            new ItemAcceptorComponent({
                slots: [
                    {
                        pos: new Vector(0, 1),
                        directions: [enumDirection.bottom],
                    },
                    {
                        pos: new Vector(1, 1),
                        directions: [enumDirection.bottom],
                    },
                ],
            })
        ),
    entity =>
        entity.addComponent(
            new StorageComponent({
                maximumStorage: storageSize,
            })
        ),
    entity =>
        entity.addComponent(
            new WiredPinsComponent({
                slots: [
                    {
                        pos: new Vector(1, 1),
                        direction: enumDirection.right,
                        type: enumPinSlotType.logicalEjector,
                    },
                    {
                        pos: new Vector(0, 1),
                        direction: enumDirection.left,
                        type: enumPinSlotType.logicalEjector,
                    },
                ],
            })
        ),
];

MetaStorageBuilding.dimensions = {
    [defaultBuildingVariant]: () => new Vector(2, 2),
};

MetaStorageBuilding.silhouetteColors = {
    [defaultBuildingVariant]: () => "#bbdf6d",
};

MetaStorageBuilding.isRemovable = {
    [defaultBuildingVariant]: () => true,
};

MetaStorageBuilding.isRotateable = {
    [defaultBuildingVariant]: () => true,
};

MetaStorageBuilding.additionalStatistics = {
    /**
     * @param {*} root
     * @returns {Array<[string, string]>}
     */
    [defaultBuildingVariant]: root => [
        [T.ingame.buildingPlacement.infoTexts.storage, formatBigNumber(storageSize)],
    ],
};

MetaStorageBuilding.overlayMatrices = {
    [defaultBuildingVariant]: (entity, rotationVariant) => null,
};

MetaStorageBuilding.avaibleVariants = {
    [defaultBuildingVariant]: root => root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_storage),
};

MetaStorageBuilding.layerByVariant = {
    [defaultBuildingVariant]: root => "regular",
};

MetaStorageBuilding.layerPreview = {
    [defaultBuildingVariant]: () => "wires",
};

MetaStorageBuilding.renderPins = {
    [defaultBuildingVariant]: () => true,
};

MetaStorageBuilding.componentVariations = {
    [defaultBuildingVariant]: (entity, rotationVariant) => {
        entity.components.ItemEjector.setSlots([
            {
                pos: new Vector(0, 0),
                direction: enumDirection.top,
            },
            {
                pos: new Vector(1, 0),
                direction: enumDirection.top,
            },
        ]);
        entity.components.ItemAcceptor.setSlots([
            {
                pos: new Vector(0, 1),
                directions: [enumDirection.bottom],
            },
            {
                pos: new Vector(1, 1),
                directions: [enumDirection.bottom],
            },
        ]);
        entity.components.Storage.maximumStorage = storageSize;
        entity.components.WiredPins.setSlots([
            {
                pos: new Vector(1, 1),
                direction: enumDirection.right,
                type: enumPinSlotType.logicalEjector,
            },
            {
                pos: new Vector(0, 1),
                direction: enumDirection.left,
                type: enumPinSlotType.logicalEjector,
            },
        ]);
    },
};
