import { root } from "postcss";
import { enumDirection, Vector } from "../../core/vector";
import { enumLogicGateType, LogicGateComponent } from "../components/logic_gate";
import { enumPinSlotType, WiredPinsComponent } from "../components/wired_pins";
import { Entity } from "../entity";
import { defaultBuildingVariant, MetaBuilding } from "../meta_building";
import { GameRoot } from "../root";
import { enumHubGoalRewards } from "../tutorial_goals";

export class MetaComparatorBuilding extends MetaBuilding {
    constructor() {
        super("comparator");
    }

    /**
     * @param {string} variant
     */
    getSilhouetteColor(variant) {
        return MetaComparatorBuilding.silhouetteColors[variant]();
    }

    /**
     * @param {string} variant
     */
    getIsRemovable(variant) {
        return MetaComparatorBuilding.isRemovable[variant]();
    }

    /**
     * @param {string} variant
     */
    getIsRotateable(variant) {
        return MetaComparatorBuilding.isRotateable[variant]();
    }

    /**
     * @param {GameRoot} root
     */
    getAvailableVariants(root) {
        const variants = MetaComparatorBuilding.avaibleVariants;

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
        return MetaComparatorBuilding.layerByVariant[variant](root);
    }

    /**
     * @param {string} variant
     */
    getDimensions(variant) {
        return MetaComparatorBuilding.dimensions[variant]();
    }

    /**
     * @param {string} variant
     */
    getShowLayerPreview(variant) {
        return MetaComparatorBuilding.layerPreview[variant]();
    }

    /**
     * @param {number} rotation
     * @param {number} rotationVariant
     * @param {string} variant
     * @param {Entity} entity
     * @returns {Array<number>|null}
     */
    getSpecialOverlayRenderMatrix(rotation, rotationVariant, variant, entity) {
        let matrices = MetaComparatorBuilding.overlayMatrices[variant](entity, rotationVariant);
        return matrices ? matrices[rotation] : null;
    }

    /**
     * @param {string} variant
     */
    getRenderPins(variant) {
        return MetaComparatorBuilding.renderPins[variant]();
    }

    /**
     * Creates the entity at the given location
     * @param {Entity} entity
     */
    setupEntityComponents(entity) {
        MetaComparatorBuilding.setupEntityComponents.forEach(func => func(entity));
    }

    /**
     * @param {Entity} entity
     * @param {number} rotationVariant
     * @param {string} variant
     */
    updateVariants(entity, rotationVariant, variant) {
        MetaComparatorBuilding.componentVariations[variant](entity, rotationVariant);
    }
}

MetaComparatorBuilding.setupEntityComponents = [
    (entity, rotationVariant) =>
        entity.addComponent(
            new WiredPinsComponent({
                slots: [
                    {
                        pos: new Vector(0, 0),
                        direction: enumDirection.top,
                        type: enumPinSlotType.logicalEjector,
                    },
                    {
                        pos: new Vector(0, 0),
                        direction: enumDirection.left,
                        type: enumPinSlotType.logicalAcceptor,
                    },
                    {
                        pos: new Vector(0, 0),
                        direction: enumDirection.right,
                        type: enumPinSlotType.logicalAcceptor,
                    },
                ],
            })
        ),
    (entity, rotationVariant) =>
        entity.addComponent(
            new LogicGateComponent({
                type: enumLogicGateType.compare,
            })
        ),
];

MetaComparatorBuilding.overlayMatrices = {
    [defaultBuildingVariant]: () => null,
};

MetaComparatorBuilding.dimensions = {
    [defaultBuildingVariant]: () => new Vector(1, 1),
};

MetaComparatorBuilding.silhouetteColors = {
    [defaultBuildingVariant]: () => "#823cab",
};

MetaComparatorBuilding.isRemovable = {
    [defaultBuildingVariant]: () => true,
};

MetaComparatorBuilding.isRotateable = {
    [defaultBuildingVariant]: () => true,
};

MetaComparatorBuilding.renderPins = {
    [defaultBuildingVariant]: () => false,
};

MetaComparatorBuilding.layerPreview = {
    [defaultBuildingVariant]: () => "wires",
};

MetaComparatorBuilding.avaibleVariants = {
    [defaultBuildingVariant]: root =>
        root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_virtual_processing),
};

MetaComparatorBuilding.layerByVariant = {
    [defaultBuildingVariant]: () => "wires",
};

MetaComparatorBuilding.componentVariations = {
    [defaultBuildingVariant]: (entity, rotationVariant) => {
        entity.components.WiredPins.setSlots([
            {
                pos: new Vector(0, 0),
                direction: enumDirection.top,
                type: enumPinSlotType.logicalEjector,
            },
            {
                pos: new Vector(0, 0),
                direction: enumDirection.left,
                type: enumPinSlotType.logicalAcceptor,
            },
            {
                pos: new Vector(0, 0),
                direction: enumDirection.right,
                type: enumPinSlotType.logicalAcceptor,
            },
        ]);

        entity.components.LogicGate.type = enumLogicGateType.compare;
    },
};
