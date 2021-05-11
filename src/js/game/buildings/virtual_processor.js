import { Vector, enumDirection } from "../../core/vector";
import { LogicGateComponent, enumLogicGateType } from "../components/logic_gate";
import { WiredPinsComponent, enumPinSlotType } from "../components/wired_pins";
import { Entity } from "../entity";
import { defaultBuildingVariant, MetaBuilding } from "../meta_building";
import { GameRoot } from "../root";
import { enumHubGoalRewards } from "../tutorial_goals";
import { MetaCutterBuilding } from "./cutter";
import { MetaPainterBuilding } from "./painter";
import { MetaRotaterBuilding } from "./rotater";
import { MetaStackerBuilding } from "./stacker";

export class MetaVirtualProcessorBuilding extends MetaBuilding {
    constructor() {
        super("virtual_processor");
    }

    /**
     * @param {string} variant
     */
    getSilhouetteColor(variant) {
        return MetaVirtualProcessorBuilding.silhouetteColors[variant]();
    }

    /**
     * @param {string} variant
     */
    getIsRemovable(variant) {
        return MetaVirtualProcessorBuilding.isRemovable[variant]();
    }

    /**
     * @param {string} variant
     */
    getIsRotateable(variant) {
        return MetaVirtualProcessorBuilding.isRotateable[variant]();
    }

    /**
     * @param {GameRoot} root
     */
    getAvailableVariants(root) {
        const variants = MetaVirtualProcessorBuilding.avaibleVariants;

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
        return MetaVirtualProcessorBuilding.layerByVariant[variant](root);
    }

    /**
     * @param {string} variant
     */
    getDimensions(variant) {
        return MetaVirtualProcessorBuilding.dimensions[variant]();
    }

    /**
     * @param {string} variant
     */
    getShowLayerPreview(variant) {
        return MetaVirtualProcessorBuilding.layerPreview[variant]();
    }

    /**
     * @param {number} rotation
     * @param {number} rotationVariant
     * @param {string} variant
     * @param {Entity} entity
     * @returns {Array<number>|null}
     */
    getSpecialOverlayRenderMatrix(rotation, rotationVariant, variant, entity) {
        let matrices = MetaVirtualProcessorBuilding.overlayMatrices[variant](entity, rotationVariant);
        return matrices ? matrices[rotation] : null;
    }

    /**
     * @param {string} variant
     */
    getRenderPins(variant) {
        return MetaVirtualProcessorBuilding.renderPins[variant]();
    }

    /**
     * Creates the entity at the given location
     * @param {Entity} entity
     */
    setupEntityComponents(entity) {
        MetaVirtualProcessorBuilding.setupEntityComponents.forEach(func => func(entity));
    }

    /**
     * @param {Entity} entity
     * @param {number} rotationVariant
     * @param {string} variant
     */
    updateVariants(entity, rotationVariant, variant) {
        MetaVirtualProcessorBuilding.componentVariations[variant](entity, rotationVariant);
    }
}

MetaVirtualProcessorBuilding.setupEntityComponents = [
    entity =>
        entity.addComponent(
            new WiredPinsComponent({
                slots: [],
            })
        ),
    entity => entity.addComponent(new LogicGateComponent({})),
];

MetaVirtualProcessorBuilding.variants = {
    rotater: "rotater",
    unstacker: "unstacker",
    stacker: "stacker",
    painter: "painter",
};

MetaVirtualProcessorBuilding.overlayMatrices = {
    [defaultBuildingVariant]: (entity, rotationVariant) => null,
    [MetaVirtualProcessorBuilding.variants.rotater]: (entity, rotationVariant) => null,
    [MetaVirtualProcessorBuilding.variants.unstacker]: (entity, rotationVariant) => null,
    [MetaVirtualProcessorBuilding.variants.stacker]: (entity, rotationVariant) => null,
    [MetaVirtualProcessorBuilding.variants.painter]: (entity, rotationVariant) => null,
};

MetaVirtualProcessorBuilding.avaibleVariants = {
    [defaultBuildingVariant]: root =>
        root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_virtual_processing),
    [MetaVirtualProcessorBuilding.variants.rotater]: root =>
        root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_virtual_processing),
    [MetaVirtualProcessorBuilding.variants.unstacker]: root =>
        root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_virtual_processing),
    [MetaVirtualProcessorBuilding.variants.stacker]: root =>
        root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_virtual_processing),
    [MetaVirtualProcessorBuilding.variants.painter]: root =>
        root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_virtual_processing),
};

MetaVirtualProcessorBuilding.dimensions = {
    [defaultBuildingVariant]: () => new Vector(1, 1),
    [MetaVirtualProcessorBuilding.variants.rotater]: () => new Vector(1, 1),
    [MetaVirtualProcessorBuilding.variants.unstacker]: () => new Vector(1, 1),
    [MetaVirtualProcessorBuilding.variants.stacker]: () => new Vector(1, 1),
    [MetaVirtualProcessorBuilding.variants.painter]: () => new Vector(1, 1),
};

MetaVirtualProcessorBuilding.isRemovable = {
    [defaultBuildingVariant]: () => true,
    [MetaVirtualProcessorBuilding.variants.rotater]: () => true,
    [MetaVirtualProcessorBuilding.variants.unstacker]: () => true,
    [MetaVirtualProcessorBuilding.variants.stacker]: () => true,
    [MetaVirtualProcessorBuilding.variants.painter]: () => true,
};

MetaVirtualProcessorBuilding.isRotateable = {
    [defaultBuildingVariant]: () => true,
    [MetaVirtualProcessorBuilding.variants.rotater]: () => true,
    [MetaVirtualProcessorBuilding.variants.unstacker]: () => true,
    [MetaVirtualProcessorBuilding.variants.stacker]: () => true,
    [MetaVirtualProcessorBuilding.variants.painter]: () => true,
};

MetaVirtualProcessorBuilding.renderPins = {
    [defaultBuildingVariant]: () => false,
    [MetaVirtualProcessorBuilding.variants.rotater]: () => false,
    [MetaVirtualProcessorBuilding.variants.unstacker]: () => false,
    [MetaVirtualProcessorBuilding.variants.stacker]: () => false,
    [MetaVirtualProcessorBuilding.variants.painter]: () => false,
};

MetaVirtualProcessorBuilding.layerPreview = {
    [defaultBuildingVariant]: () => "wires",
    [MetaVirtualProcessorBuilding.variants.rotater]: () => "wires",
    [MetaVirtualProcessorBuilding.variants.unstacker]: () => "wires",
    [MetaVirtualProcessorBuilding.variants.stacker]: () => "wires",
    [MetaVirtualProcessorBuilding.variants.painter]: () => "wires",
};

MetaVirtualProcessorBuilding.layerByVariant = {
    [defaultBuildingVariant]: root => "wires",
    [MetaVirtualProcessorBuilding.variants.rotater]: root => "wires",
    [MetaVirtualProcessorBuilding.variants.unstacker]: root => "wires",
    [MetaVirtualProcessorBuilding.variants.stacker]: root => "wires",
    [MetaVirtualProcessorBuilding.variants.painter]: root => "wires",
};

MetaVirtualProcessorBuilding.silhouetteColors = {
    [defaultBuildingVariant]: () => MetaCutterBuilding.silhouetteColors[defaultBuildingVariant],
    [MetaVirtualProcessorBuilding.variants.rotater]: () =>
        MetaRotaterBuilding.silhouetteColors[defaultBuildingVariant],
    [MetaVirtualProcessorBuilding.variants.unstacker]: () =>
        MetaStackerBuilding.silhouetteColors[defaultBuildingVariant],
    [MetaVirtualProcessorBuilding.variants.stacker]: () =>
        MetaStackerBuilding.silhouetteColors[defaultBuildingVariant],
    [MetaVirtualProcessorBuilding.variants.painter]: () =>
        MetaPainterBuilding.silhouetteColors[defaultBuildingVariant],
};

MetaVirtualProcessorBuilding.componentVariations = {
    [defaultBuildingVariant]: (entity, rotationVariant) => {
        entity.components.WiredPins.setSlots([
            {
                pos: new Vector(0, 0),
                direction: enumDirection.left,
                type: enumPinSlotType.logicalEjector,
            },
            {
                pos: new Vector(0, 0),
                direction: enumDirection.right,
                type: enumPinSlotType.logicalEjector,
            },
            {
                pos: new Vector(0, 0),
                direction: enumDirection.bottom,
                type: enumPinSlotType.logicalAcceptor,
            },
        ]);

        entity.components.LogicGate.type = enumLogicGateType.cutter;
    },

    [MetaVirtualProcessorBuilding.variants.rotater]: (entity, rotationVariant) => {
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

        entity.components.LogicGate.type = enumLogicGateType.rotater;
    },

    [MetaVirtualProcessorBuilding.variants.unstacker]: (entity, rotationVariant) => {
        entity.components.WiredPins.setSlots([
            {
                pos: new Vector(0, 0),
                direction: enumDirection.left,
                type: enumPinSlotType.logicalEjector,
            },
            {
                pos: new Vector(0, 0),
                direction: enumDirection.right,
                type: enumPinSlotType.logicalEjector,
            },
            {
                pos: new Vector(0, 0),
                direction: enumDirection.bottom,
                type: enumPinSlotType.logicalAcceptor,
            },
        ]);

        entity.components.LogicGate.type = enumLogicGateType.unstacker;
    },

    [MetaVirtualProcessorBuilding.variants.stacker]: (entity, rotationVariant) => {
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
            {
                pos: new Vector(0, 0),
                direction: enumDirection.right,
                type: enumPinSlotType.logicalAcceptor,
            },
        ]);

        entity.components.LogicGate.type = enumLogicGateType.stacker;
    },

    [MetaVirtualProcessorBuilding.variants.painter]: (entity, rotationVariant) => {
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
            {
                pos: new Vector(0, 0),
                direction: enumDirection.right,
                type: enumPinSlotType.logicalAcceptor,
            },
        ]);

        entity.components.LogicGate.type = enumLogicGateType.painter;
    },
};
