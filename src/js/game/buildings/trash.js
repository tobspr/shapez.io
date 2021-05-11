import { generateMatrixRotations } from "../../core/utils";
import { enumDirection, Vector } from "../../core/vector";
import { ACHIEVEMENTS } from "../../platform/achievement_provider";
import { ItemAcceptorComponent } from "../components/item_acceptor";
import { enumItemProcessorTypes, ItemProcessorComponent } from "../components/item_processor";
import { Entity } from "../entity";
import { defaultBuildingVariant, MetaBuilding } from "../meta_building";
import { GameRoot } from "../root";
import { enumHubGoalRewards } from "../tutorial_goals";

const overlayMatrix = generateMatrixRotations([1, 1, 0, 1, 1, 1, 0, 1, 1]);

export class MetaTrashBuilding extends MetaBuilding {
    constructor() {
        super("trash");
    }

    /**
     * @param {string} variant
     */
    getSilhouetteColor(variant) {
        return MetaTrashBuilding.silhouetteColors[variant]();
    }

    /**
     * @param {string} variant
     */
    getIsRemovable(variant) {
        return MetaTrashBuilding.isRemovable[variant]();
    }

    /**
     * @param {string} variant
     */
    getIsRotateable(variant) {
        return MetaTrashBuilding.isRotateable[variant]();
    }

    /**
     * @param {GameRoot} root
     */
    getAvailableVariants(root) {
        const variants = MetaTrashBuilding.avaibleVariants;

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
        return MetaTrashBuilding.layerByVariant[variant](root);
    }

    /**
     * @param {string} variant
     */
    getDimensions(variant) {
        return MetaTrashBuilding.dimensions[variant]();
    }

    /**
     * @param {string} variant
     */
    getShowLayerPreview(variant) {
        return MetaTrashBuilding.layerPreview[variant]();
    }

    /**
     * @param {number} rotation
     * @param {number} rotationVariant
     * @param {string} variant
     * @param {Entity} entity
     * @returns {Array<number>|null}
     */
    getSpecialOverlayRenderMatrix(rotation, rotationVariant, variant, entity) {
        let matrices = MetaTrashBuilding.overlayMatrices[variant](entity, rotationVariant);
        return matrices ? matrices[rotation] : null;
    }

    /**
     * @param {string} variant
     */
    getRenderPins(variant) {
        return MetaTrashBuilding.renderPins[variant]();
    }

    addAchievementReceiver(entity) {
        if (!entity.root) {
            return;
        }

        const itemProcessor = entity.components.ItemProcessor;
        const tryTakeItem = itemProcessor.tryTakeItem.bind(itemProcessor);

        itemProcessor.tryTakeItem = () => {
            const taken = tryTakeItem(...arguments);

            if (taken) {
                entity.root.signals.achievementCheck.dispatch(ACHIEVEMENTS.trash1000, 1);
            }

            return taken;
        };
    }

    /**
     * Creates the entity at the given location
     * @param {Entity} entity
     */
    setupEntityComponents(entity) {
        MetaTrashBuilding.setupEntityComponents.forEach(func => func.bind(this)(entity));
    }

    /**
     * @param {Entity} entity
     * @param {number} rotationVariant
     * @param {string} variant
     */
    updateVariants(entity, rotationVariant, variant) {
        MetaTrashBuilding.componentVariations[variant].bind(this)(entity, rotationVariant);
    }
}

MetaTrashBuilding.setupEntityComponents = [
    entity =>
        entity.addComponent(
            new ItemAcceptorComponent({
                slots: [
                    {
                        pos: new Vector(0, 0),
                        directions: [
                            enumDirection.top,
                            enumDirection.right,
                            enumDirection.bottom,
                            enumDirection.left,
                        ],
                    },
                ],
            })
        ),
    entity =>
        entity.addComponent(
            new ItemProcessorComponent({
                inputsPerCharge: 1,
                processorType: enumItemProcessorTypes.trash,
            })
        ),

    function (entity) {
        // @ts-ignore
        this.addAchievementReceiver(entity);
    },
];

MetaTrashBuilding.overlayMatrices = {
    [defaultBuildingVariant]: (entity, rotationVariant) =>
        generateMatrixRotations([1, 1, 0, 1, 1, 1, 0, 1, 1]),
};

MetaTrashBuilding.dimensions = {
    [defaultBuildingVariant]: () => new Vector(1, 1),
};

MetaTrashBuilding.silhouetteColors = {
    [defaultBuildingVariant]: () => "#ed1d5d",
};

MetaTrashBuilding.isRemovable = {
    [defaultBuildingVariant]: () => true,
};

MetaTrashBuilding.isRotateable = {
    [defaultBuildingVariant]: () => true,
};

MetaTrashBuilding.renderPins = {
    [defaultBuildingVariant]: () => false,
};

MetaTrashBuilding.layerByVariant = {
    [defaultBuildingVariant]: root => "regular",
};

MetaTrashBuilding.layerPreview = {
    [defaultBuildingVariant]: () => null,
};

MetaTrashBuilding.avaibleVariants = {
    [defaultBuildingVariant]: root =>
        root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_cutter_and_trash),
};

MetaTrashBuilding.componentVariations = {
    [defaultBuildingVariant]: (entity, rotationVariant) => {
        entity.components.ItemAcceptor.setSlots([
            {
                pos: new Vector(0, 0),
                directions: [
                    enumDirection.top,
                    enumDirection.right,
                    enumDirection.bottom,
                    enumDirection.left,
                ],
            },
        ]);

        entity.components.ItemProcessor.inputsPerCharge = 1;

        entity.components.ItemProcessor.type = enumItemProcessorTypes.trash;
    },
};
