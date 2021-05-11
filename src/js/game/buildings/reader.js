import { enumDirection, Vector } from "../../core/vector";
import { ItemAcceptorComponent } from "../components/item_acceptor";
import { ItemEjectorComponent } from "../components/item_ejector";
import { enumItemProcessorTypes, ItemProcessorComponent } from "../components/item_processor";
import { enumPinSlotType, WiredPinsComponent } from "../components/wired_pins";
import { Entity } from "../entity";
import { defaultBuildingVariant, MetaBuilding } from "../meta_building";
import { GameRoot } from "../root";
import { BeltUnderlaysComponent } from "../components/belt_underlays";
import { BeltReaderComponent } from "../components/belt_reader";
import { enumHubGoalRewards } from "../tutorial_goals";
import { generateMatrixRotations, formatItemsPerSecond } from "../../core/utils";
import { T } from "../../translations";

export class MetaReaderBuilding extends MetaBuilding {
    constructor() {
        super("reader");
    }

    /**
     * @param {string} variant
     */
    getSilhouetteColor(variant) {
        return MetaReaderBuilding.silhouetteColors[variant]();
    }

    /**
     * @param {string} variant
     */
    getIsRemovable(variant) {
        return MetaReaderBuilding.isRemovable[variant]();
    }

    /**
     * @param {string} variant
     */
    getIsRotateable(variant) {
        return MetaReaderBuilding.isRotateable[variant]();
    }

    /**
     * @param {GameRoot} root
     */
    getAvailableVariants(root) {
        const variants = MetaReaderBuilding.avaibleVariants;

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
        return MetaReaderBuilding.layerByVariant[variant](root);
    }

    /**
     * @param {string} variant
     */
    getDimensions(variant) {
        return MetaReaderBuilding.dimensions[variant]();
    }

    /**
     * @param {string} variant
     */
    getShowLayerPreview(variant) {
        return MetaReaderBuilding.layerPreview[variant]();
    }

    /**
     * @param {GameRoot} root
     * @param {string} variant
     * @returns {Array<[string, string]>}
     */
    getAdditionalStatistics(root, variant) {
        return MetaReaderBuilding.additionalStatistics[variant](root);
    }

    /**
     * @param {number} rotation
     * @param {number} rotationVariant
     * @param {string} variant
     * @param {Entity} entity
     * @returns {Array<number>|null}
     */
    getSpecialOverlayRenderMatrix(rotation, rotationVariant, variant, entity) {
        let matrices = MetaReaderBuilding.overlayMatrices[variant](entity, rotationVariant);
        return matrices ? matrices[rotation] : null;
    }

    /**
     * @param {string} variant
     */
    getRenderPins(variant) {
        return MetaReaderBuilding.renderPins[variant]();
    }

    /**
     * Creates the entity at the given location
     * @param {Entity} entity
     */
    setupEntityComponents(entity) {
        MetaReaderBuilding.setupEntityComponents.forEach(func => func(entity));
    }

    /**
     * @param {Entity} entity
     * @param {number} rotationVariant
     * @param {string} variant
     */
    updateVariants(entity, rotationVariant, variant) {
        MetaReaderBuilding.componentVariations[variant](entity, rotationVariant);
    }
}

MetaReaderBuilding.setupEntityComponents = [
    entity =>
        entity.addComponent(
            new WiredPinsComponent({
                slots: [
                    {
                        pos: new Vector(0, 0),
                        direction: enumDirection.right,
                        type: enumPinSlotType.logicalEjector,
                    },
                    {
                        pos: new Vector(0, 0),
                        direction: enumDirection.left,
                        type: enumPinSlotType.logicalEjector,
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
                ],
            })
        ),
    entity =>
        entity.addComponent(
            new ItemProcessorComponent({
                processorType: enumItemProcessorTypes.reader,
                inputsPerCharge: 1,
            })
        ),
    entity =>
        entity.addComponent(
            new BeltUnderlaysComponent({
                underlays: [
                    {
                        pos: new Vector(0, 0),
                        direction: enumDirection.top,
                    },
                ],
            })
        ),
    entity => entity.addComponent(new BeltReaderComponent()),
];

MetaReaderBuilding.dimensions = {
    [defaultBuildingVariant]: () => new Vector(1, 1),
};

MetaReaderBuilding.silhouetteColors = {
    [defaultBuildingVariant]: () => "#25fff2",
};

MetaReaderBuilding.isRemovable = {
    [defaultBuildingVariant]: () => true,
};

MetaReaderBuilding.isRotateable = {
    [defaultBuildingVariant]: () => true,
};

MetaReaderBuilding.additionalStatistics = {
    [defaultBuildingVariant]: root => [
        [T.ingame.buildingPlacement.infoTexts.speed, formatItemsPerSecond(root.hubGoals.getBeltBaseSpeed())],
    ],
};

MetaReaderBuilding.overlayMatrices = {
    [defaultBuildingVariant]: (entity, rotationVariant) =>
        generateMatrixRotations([0, 1, 0, 0, 1, 0, 0, 1, 0]),
};

MetaReaderBuilding.avaibleVariants = {
    [defaultBuildingVariant]: root => root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_belt_reader),
};

MetaReaderBuilding.layerByVariant = {
    [defaultBuildingVariant]: root => "regular",
};

MetaReaderBuilding.layerPreview = {
    [defaultBuildingVariant]: () => "wires",
};

MetaReaderBuilding.renderPins = {
    [defaultBuildingVariant]: () => true,
};

MetaReaderBuilding.componentVariations = {
    [defaultBuildingVariant]: (entity, rotationVariant) => {
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
        ]);

        entity.components.ItemProcessor.inputsPerCharge = 1;

        entity.components.ItemProcessor.type = enumItemProcessorTypes.reader;

        entity.components.BeltUnderlays.underlays = [
            {
                pos: new Vector(0, 0),
                direction: enumDirection.top,
            },
        ];
    },
};
