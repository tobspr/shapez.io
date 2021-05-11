import { enumDirection, Vector } from "../../core/vector";
import { enumPinSlotType, WiredPinsComponent } from "../components/wired_pins";
import { Entity } from "../entity";
import { defaultBuildingVariant, MetaBuilding } from "../meta_building";
import { GameRoot } from "../root";
import { ConstantSignalComponent } from "../components/constant_signal";
import { generateMatrixRotations } from "../../core/utils";
import { enumHubGoalRewards } from "../tutorial_goals";

export class MetaConstantSignalBuilding extends MetaBuilding {
    constructor() {
        super("constant_signal");
    }

    /**
     * @param {string} variant
     */
    getSilhouetteColor(variant) {
        return MetaConstantSignalBuilding.silhouetteColors[variant]();
    }

    /**
     * @param {string} variant
     */
    getIsRemovable(variant) {
        return MetaConstantSignalBuilding.isRemovable[variant]();
    }

    /**
     * @param {string} variant
     */
    getIsRotateable(variant) {
        return MetaConstantSignalBuilding.isRotateable[variant]();
    }

    /**
     * @param {GameRoot} root
     */
    getAvailableVariants(root) {
        const variants = MetaConstantSignalBuilding.avaibleVariants;

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
        return MetaConstantSignalBuilding.layerByVariant[variant](root);
    }

    /**
     * @param {string} variant
     */
    getDimensions(variant) {
        return MetaConstantSignalBuilding.dimensions[variant]();
    }

    /**
     * @param {string} variant
     */
    getShowLayerPreview(variant) {
        return MetaConstantSignalBuilding.layerPreview[variant]();
    }

    /**
     * @param {number} rotation
     * @param {number} rotationVariant
     * @param {string} variant
     * @param {Entity} entity
     * @returns {Array<number>|null}
     */
    getSpecialOverlayRenderMatrix(rotation, rotationVariant, variant, entity) {
        let matrices = MetaConstantSignalBuilding.overlayMatrices[variant](entity, rotationVariant);
        return matrices ? matrices[rotation] : null;
    }

    /**
     * @param {string} variant
     */
    getRenderPins(variant) {
        return MetaConstantSignalBuilding.renderPins[variant]();
    }

    /**
     * Creates the entity at the given location
     * @param {Entity} entity
     */
    setupEntityComponents(entity) {
        MetaConstantSignalBuilding.setupEntityComponents.forEach(func => func(entity));
    }

    /**
     * @param {Entity} entity
     * @param {number} rotationVariant
     * @param {string} variant
     */
    updateVariants(entity, rotationVariant, variant) {
        MetaConstantSignalBuilding.componentVariations[variant](entity, rotationVariant);
    }
}

MetaConstantSignalBuilding.setupEntityComponents = [
    entity =>
        entity.addComponent(
            new WiredPinsComponent({
                slots: [
                    {
                        pos: new Vector(0, 0),
                        direction: enumDirection.top,
                        type: enumPinSlotType.logicalEjector,
                    },
                ],
            })
        ),
    entity => entity.addComponent(new ConstantSignalComponent({})),
];

MetaConstantSignalBuilding.overlayMatrices = {
    [defaultBuildingVariant]: (entity, rotationVariant) =>
        generateMatrixRotations([0, 1, 0, 1, 1, 1, 1, 1, 1]),
};

MetaConstantSignalBuilding.dimensions = {
    [defaultBuildingVariant]: () => new Vector(1, 1),
};

MetaConstantSignalBuilding.silhouetteColors = {
    [defaultBuildingVariant]: () => "#2b84fd",
};

MetaConstantSignalBuilding.isRemovable = {
    [defaultBuildingVariant]: () => true,
};

MetaConstantSignalBuilding.isRotateable = {
    [defaultBuildingVariant]: () => true,
};

MetaConstantSignalBuilding.renderPins = {
    [defaultBuildingVariant]: () => false,
};

MetaConstantSignalBuilding.avaibleVariants = {
    [defaultBuildingVariant]: root =>
        root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_constant_signal),
};

MetaConstantSignalBuilding.layerByVariant = {
    [defaultBuildingVariant]: root => "wires",
};

MetaConstantSignalBuilding.layerPreview = {
    [defaultBuildingVariant]: () => "wires",
};

MetaConstantSignalBuilding.componentVariations = {
    [defaultBuildingVariant]: (entity, rotationVariant) => {
        entity.components.WiredPins.setSlots([
            {
                pos: new Vector(0, 0),
                direction: enumDirection.top,
                type: enumPinSlotType.logicalEjector,
            },
        ]);
    },
};
