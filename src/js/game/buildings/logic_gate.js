import { enumDirection, Vector } from "../../core/vector";
import { enumPinSlotType, WiredPinsComponent } from "../components/wired_pins";
import { Entity } from "../entity";
import { MetaBuilding, defaultBuildingVariant } from "../meta_building";
import { GameRoot } from "../root";
import { enumLogicGateType, LogicGateComponent } from "../components/logic_gate";
import { generateMatrixRotations } from "../../core/utils";
import { enumHubGoalRewards } from "../tutorial_goals";

export class MetaLogicGateBuilding extends MetaBuilding {
    constructor() {
        super("logic_gate");
    }

    /**
     * @param {string} variant
     */
    getSilhouetteColor(variant) {
        return MetaLogicGateBuilding.silhouetteColors[variant]();
    }

    /**
     * @param {string} variant
     */
    getDimensions(variant) {
        return MetaLogicGateBuilding.dimensions[variant]();
    }

    /**
     * @param {string} variant
     */
    getIsRemovable(variant) {
        return MetaLogicGateBuilding.isRemovable[variant]();
    }

    /**
     * @param {string} variant
     */
    getIsRotateable(variant) {
        return MetaLogicGateBuilding.isRotateable[variant]();
    }

    /**
     * @param {GameRoot} root
     */
    getAvailableVariants(root) {
        const variants = MetaLogicGateBuilding.avaibleVariants;

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
        return MetaLogicGateBuilding.layerByVariant[variant](root);
    }

    /**
     * @param {string} variant
     */
    getShowLayerPreview(variant) {
        return MetaLogicGateBuilding.layerPreview[variant]();
    }

    /**
     * @param {number} rotation
     * @param {number} rotationVariant
     * @param {string} variant
     * @param {Entity} entity
     * @returns {Array<number>|null}
     */
    getSpecialOverlayRenderMatrix(rotation, rotationVariant, variant, entity) {
        let matrices = MetaLogicGateBuilding.overlayMatrices[variant](entity, rotationVariant);
        return matrices ? matrices[rotation] : null;
    }

    /**
     * @param {string} variant
     */
    getRenderPins(variant) {
        return MetaLogicGateBuilding.renderPins[variant]();
    }

    /**
     * Creates the entity at the given location
     * @param {Entity} entity
     */
    setupEntityComponents(entity) {
        MetaLogicGateBuilding.setupEntityComponents.forEach(func => func(entity));
    }

    /**
     * @param {Entity} entity
     * @param {number} rotationVariant
     * @param {string} variant
     */
    updateVariants(entity, rotationVariant, variant) {
        MetaLogicGateBuilding.componentVariations[variant](entity, rotationVariant);
    }
}
MetaLogicGateBuilding.setupEntityComponents = [
    entity =>
        entity.addComponent(
            new WiredPinsComponent({
                slots: [],
            })
        ),
    entity => entity.addComponent(new LogicGateComponent({})),
];

MetaLogicGateBuilding.variants = {
    not: "not",
    xor: "xor",
    or: "or",
};

MetaLogicGateBuilding.overlayMatrices = {
    [defaultBuildingVariant]: (entity, rotationVariant) =>
        generateMatrixRotations([0, 1, 0, 1, 1, 1, 0, 1, 1]),
    [MetaLogicGateBuilding.variants.xor]: (entity, rotationVariant) =>
        generateMatrixRotations([0, 1, 0, 1, 1, 1, 0, 1, 1]),
    [MetaLogicGateBuilding.variants.or]: (entity, rotationVariant) =>
        generateMatrixRotations([0, 1, 0, 1, 1, 1, 0, 1, 1]),
    [MetaLogicGateBuilding.variants.not]: (entity, rotationVariant) =>
        generateMatrixRotations([0, 1, 0, 0, 1, 0, 0, 1, 0]),
};
MetaLogicGateBuilding.dimensions = {
    [defaultBuildingVariant]: () => new Vector(1, 1),
    [MetaLogicGateBuilding.variants.xor]: () => new Vector(1, 1),
    [MetaLogicGateBuilding.variants.or]: () => new Vector(1, 1),
    [MetaLogicGateBuilding.variants.not]: () => new Vector(1, 1),
};

MetaLogicGateBuilding.silhouetteColors = {
    [defaultBuildingVariant]: () => "#f48d41",
    [MetaLogicGateBuilding.variants.xor]: () => "#f4a241",
    [MetaLogicGateBuilding.variants.or]: () => "#f4d041",
    [MetaLogicGateBuilding.variants.not]: () => "#f44184",
};

MetaLogicGateBuilding.isRemovable = {
    [defaultBuildingVariant]: () => true,
    [MetaLogicGateBuilding.variants.xor]: () => true,
    [MetaLogicGateBuilding.variants.or]: () => true,
    [MetaLogicGateBuilding.variants.not]: () => true,
};

MetaLogicGateBuilding.isRotateable = {
    [defaultBuildingVariant]: () => true,
    [MetaLogicGateBuilding.variants.xor]: () => true,
    [MetaLogicGateBuilding.variants.or]: () => true,
    [MetaLogicGateBuilding.variants.not]: () => true,
};

MetaLogicGateBuilding.avaibleVariants = {
    [defaultBuildingVariant]: root => root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_logic_gates),
    [MetaLogicGateBuilding.variants.xor]: root =>
        root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_logic_gates),
    [MetaLogicGateBuilding.variants.or]: root =>
        root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_logic_gates),
    [MetaLogicGateBuilding.variants.not]: root =>
        root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_logic_gates),
};

MetaLogicGateBuilding.layerByVariant = {
    [defaultBuildingVariant]: root => "wires",
    [MetaLogicGateBuilding.variants.xor]: root => "wires",
    [MetaLogicGateBuilding.variants.or]: root => "wires",
    [MetaLogicGateBuilding.variants.not]: root => "wires",
};

MetaLogicGateBuilding.renderPins = {
    [defaultBuildingVariant]: () => false,
    [MetaLogicGateBuilding.variants.xor]: () => false,
    [MetaLogicGateBuilding.variants.or]: () => false,
    [MetaLogicGateBuilding.variants.not]: () => false,
};

MetaLogicGateBuilding.layerPreview = {
    [defaultBuildingVariant]: () => "wires",
    [MetaLogicGateBuilding.variants.xor]: () => "wires",
    [MetaLogicGateBuilding.variants.or]: () => "wires",
    [MetaLogicGateBuilding.variants.not]: () => "wires",
};

MetaLogicGateBuilding.componentVariations = {
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

        entity.components.LogicGate.type = enumLogicGateType.and;
    },

    [MetaLogicGateBuilding.variants.xor]: (entity, rotationVariant) => {
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

        entity.components.LogicGate.type = enumLogicGateType.xor;
    },

    [MetaLogicGateBuilding.variants.or]: (entity, rotationVariant) => {
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

        entity.components.LogicGate.type = enumLogicGateType.or;
    },
    [MetaLogicGateBuilding.variants.not]: (entity, rotationVariant) => {
        entity.components.WiredPins.setSlots([
            {
                pos: new Vector(0, 0),
                direction: enumDirection.top,
                type: enumPinSlotType.logicalEjector,
            },
            {
                pos: new Vector(0, 0),
                direction: enumDirection.bottom,
                type: enumPinSlotType.logicalAcceptor,
            },
        ]);

        entity.components.LogicGate.type = enumLogicGateType.not;
    },
};
