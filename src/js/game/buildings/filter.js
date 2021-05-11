import { formatItemsPerSecond } from "../../core/utils";
import { enumDirection, Vector } from "../../core/vector";
import { T } from "../../translations";
import { FilterComponent } from "../components/filter";
import { ItemAcceptorComponent } from "../components/item_acceptor";
import { ItemEjectorComponent } from "../components/item_ejector";
import { enumPinSlotType, WiredPinsComponent } from "../components/wired_pins";
import { Entity } from "../entity";
import { defaultBuildingVariant, MetaBuilding } from "../meta_building";
import { GameRoot } from "../root";
import { enumHubGoalRewards } from "../tutorial_goals";

export class MetaFilterBuilding extends MetaBuilding {
    constructor() {
        super("filter");
    }

    /**
     * @param {string} variant
     */
    getSilhouetteColor(variant) {
        return MetaFilterBuilding.silhouetteColors[variant]();
    }

    /**
     * @param {string} variant
     */
    getIsRemovable(variant) {
        return MetaFilterBuilding.isRemovable[variant]();
    }

    /**
     * @param {string} variant
     */
    getIsRotateable(variant) {
        return MetaFilterBuilding.isRotateable[variant]();
    }

    /**
     * @param {GameRoot} root
     */
    getAvailableVariants(root) {
        const variants = MetaFilterBuilding.avaibleVariants;

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
        //@ts-ignore
        return MetaFilterBuilding.layerByVariant[defaultBuildingVariant](root);
    }

    /**
     * @param {string} variant
     */
    getDimensions(variant) {
        return MetaFilterBuilding.dimensions[variant]();
    }

    /**
     * @param {string} variant
     */
    getShowLayerPreview(variant) {
        return MetaFilterBuilding.layerPreview[variant]();
    }

    /**
     * @param {GameRoot} root
     * @param {string} variant
     * @returns {Array<[string, string]>}
     */
    getAdditionalStatistics(root, variant) {
        return MetaFilterBuilding.additionalStatistics[variant](root);
    }

    /**
     * @param {number} rotation
     * @param {number} rotationVariant
     * @param {string} variant
     * @param {Entity} entity
     * @returns {Array<number>|null}
     */
    getSpecialOverlayRenderMatrix(rotation, rotationVariant, variant, entity) {
        let matrices = MetaFilterBuilding.overlayMatrices[variant](entity, rotationVariant);
        return matrices ? matrices[rotation] : null;
    }

    /**
     * @param {string} variant
     */
    getRenderPins(variant) {
        return MetaFilterBuilding.renderPins[variant]();
    }

    /**
     * Creates the entity at the given location
     * @param {Entity} entity
     */
    setupEntityComponents(entity) {
        MetaFilterBuilding.setupEntityComponents.forEach(func => func(entity));
    }

    /**
     * @param {Entity} entity
     * @param {number} rotationVariant
     * @param {string} variant
     */
    updateVariants(entity, rotationVariant, variant) {
        MetaFilterBuilding.componentVariations[variant](entity, rotationVariant);
    }
}

MetaFilterBuilding.setupEntityComponents = [
    entity =>
        entity.addComponent(
            new WiredPinsComponent({
                slots: [
                    {
                        pos: new Vector(0, 0),
                        direction: enumDirection.left,
                        type: enumPinSlotType.logicalAcceptor,
                    },
                ],
            })
        ),

    entity =>
        entity.addComponent(
            new ItemAcceptorComponent({
                slots: [
                    {
                        pos: new Vector(0, 0),
                        directions: [enumDirection.bottom],
                    },
                ],
            })
        ),

    entity =>
        entity.addComponent(
            new ItemEjectorComponent({
                slots: [
                    {
                        pos: new Vector(0, 0),
                        direction: enumDirection.top,
                    },
                    {
                        pos: new Vector(1, 0),
                        direction: enumDirection.right,
                    },
                ],
            })
        ),

    entity => entity.addComponent(new FilterComponent()),
];

MetaFilterBuilding.overlayMatrices = {
    [defaultBuildingVariant]: () => null,
};

MetaFilterBuilding.dimensions = {
    [defaultBuildingVariant]: () => new Vector(2, 1),
};

MetaFilterBuilding.silhouetteColors = {
    [defaultBuildingVariant]: () => "#c45c2e",
};

MetaFilterBuilding.isRemovable = {
    [defaultBuildingVariant]: () => true,
};

MetaFilterBuilding.isRotateable = {
    [defaultBuildingVariant]: () => true,
};

MetaFilterBuilding.avaibleVariants = {
    [defaultBuildingVariant]: root => root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_filter),
};

MetaFilterBuilding.layerByVariant = {
    [defaultBuildingVariant]: root => "regular",
};

MetaFilterBuilding.layerPreview = {
    [defaultBuildingVariant]: () => "wires",
};

MetaFilterBuilding.additionalStatistics = {
    [defaultBuildingVariant]: root => [
        [T.ingame.buildingPlacement.infoTexts.speed, formatItemsPerSecond(root.hubGoals.getBeltBaseSpeed())],
    ],
};

MetaFilterBuilding.renderPins = {
    [defaultBuildingVariant]: () => true,
};

MetaFilterBuilding.componentVariations = {
    [defaultBuildingVariant]: (entity, rotationVariant) => {
        entity.components.WiredPins.setSlots([
            {
                pos: new Vector(0, 0),
                direction: enumDirection.left,
                type: enumPinSlotType.logicalAcceptor,
            },
        ]);

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
                pos: new Vector(1, 0),
                direction: enumDirection.right,
            },
        ]);
    },
};
