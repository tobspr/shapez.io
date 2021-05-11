import { Loader } from "../../core/loader";
import { enumDirection, Vector, enumAngleToDirection, enumDirectionToVector } from "../../core/vector";
import { ItemAcceptorComponent } from "../components/item_acceptor";
import { ItemEjectorComponent } from "../components/item_ejector";
import { enumUndergroundBeltMode, UndergroundBeltComponent } from "../components/underground_belt";
import { Entity } from "../entity";
import { MetaBuilding, defaultBuildingVariant } from "../meta_building";
import { GameRoot } from "../root";
import { globalConfig } from "../../core/config";
import { enumHubGoalRewards } from "../tutorial_goals";
import { formatItemsPerSecond, generateMatrixRotations } from "../../core/utils";
import { T } from "../../translations";

export class MetaUndergroundBeltBuilding extends MetaBuilding {
    constructor() {
        super("underground_belt");
    }

    /**
     * @param {string} variant
     */
    getSilhouetteColor(variant, rotationVariant) {
        return MetaUndergroundBeltBuilding.silhouetteColorsByRotation[rotationVariant]();
    }

    /**
     * @param {string} variant
     */
    getIsRemovable(variant) {
        return MetaUndergroundBeltBuilding.isRemovable[variant]();
    }

    /**
     * @param {string} variant
     */
    getIsRotateable(variant) {
        return MetaUndergroundBeltBuilding.isRotateable[variant]();
    }

    /**
     * @param {GameRoot} root
     */
    getAvailableVariants(root) {
        const variants = MetaUndergroundBeltBuilding.avaibleVariants;

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
        return MetaUndergroundBeltBuilding.layerByVariant[variant](root);
    }

    /**
     * @param {string} variant
     */
    getDimensions(variant) {
        return MetaUndergroundBeltBuilding.dimensions[variant]();
    }

    /**
     * @param {string} variant
     */
    getShowLayerPreview(variant) {
        return MetaUndergroundBeltBuilding.layerPreview[variant]();
    }

    /**
     * @param {number} rotation
     * @param {number} rotationVariant
     * @param {string} variant
     * @param {Entity} entity
     * @returns {Array<number>|null}
     */
    getSpecialOverlayRenderMatrix(rotation, rotationVariant, variant, entity) {
        let matrices = MetaUndergroundBeltBuilding.overlayMatricesByRotation[rotationVariant](
            entity,
            rotationVariant
        );
        return matrices ? matrices[rotation] : null;
    }

    /**
     * @param {string} variant
     */
    getRenderPins(variant) {
        return MetaUndergroundBeltBuilding.renderPins[variant]();
    }

    getFlipOrientationAfterPlacement() {
        return true;
    }

    getStayInPlacementMode() {
        return true;
    }

    /**
     * @param {number} rotationVariant
     * @param {string} variant
     */
    getPreviewSprite(rotationVariant, variant) {
        let suffix = "";
        if (variant !== defaultBuildingVariant) {
            suffix = "-" + variant;
        }

        switch (MetaUndergroundBeltBuilding.rotationVariantToMode[rotationVariant]) {
            case enumUndergroundBeltMode.sender:
                return Loader.getSprite("sprites/buildings/underground_belt_entry" + suffix + ".png");
            case enumUndergroundBeltMode.receiver:
                return Loader.getSprite("sprites/buildings/underground_belt_exit" + suffix + ".png");
            default:
                assertAlways(false, "Invalid rotation variant");
        }
    }

    /**
     * @param {number} rotationVariant
     * @param {string} variant
     */
    getBlueprintSprite(rotationVariant, variant) {
        let suffix = "";
        if (variant !== defaultBuildingVariant) {
            suffix = "-" + variant;
        }

        switch (MetaUndergroundBeltBuilding.rotationVariantToMode[rotationVariant]) {
            case enumUndergroundBeltMode.sender:
                return Loader.getSprite("sprites/blueprints/underground_belt_entry" + suffix + ".png");
            case enumUndergroundBeltMode.receiver:
                return Loader.getSprite("sprites/blueprints/underground_belt_exit" + suffix + ".png");
            default:
                assertAlways(false, "Invalid rotation variant");
        }
    }

    /**
     * @param {number} rotationVariant
     * @param {string} variant
     */
    getSprite(rotationVariant, variant) {
        return this.getPreviewSprite(rotationVariant, variant);
    }

    /**
     * Creates the entity at the given location
     * @param {Entity} entity
     */
    setupEntityComponents(entity) {
        MetaUndergroundBeltBuilding.setupEntityComponents.forEach(func => func(entity));
    }

    /**
     * Should compute the optimal rotation variant on the given tile
     * @param {object} param0
     * @param {GameRoot} param0.root
     * @param {Vector} param0.tile
     * @param {number} param0.rotation
     * @param {string} param0.variant
     * @param {Layer} param0.layer
     * @return {{ rotation: number, rotationVariant: number, connectedEntities?: Array<Entity> }}
     */
    computeOptimalDirectionAndRotationVariantAtTile({ root, tile, rotation, variant, layer }) {
        const searchDirection = enumAngleToDirection[rotation];
        const searchVector = enumDirectionToVector[searchDirection];
        const tier = MetaUndergroundBeltBuilding.variantToTier[variant];

        const targetRotation = (rotation + 180) % 360;
        const targetSenderRotation = rotation;

        for (
            let searchOffset = 1;
            searchOffset <= globalConfig.undergroundBeltMaxTilesByTier[tier];
            ++searchOffset
        ) {
            tile = tile.addScalars(searchVector.x, searchVector.y);

            const contents = root.map.getTileContent(tile, "regular");
            if (contents) {
                const undergroundComp = contents.components.UndergroundBelt;
                if (undergroundComp && undergroundComp.tier === tier) {
                    const staticComp = contents.components.StaticMapEntity;
                    if (staticComp.rotation === targetRotation) {
                        if (undergroundComp.mode !== enumUndergroundBeltMode.sender) {
                            // If we encounter an underground receiver on our way which is also faced in our direction, we don't accept that
                            break;
                        }
                        return {
                            rotation: targetRotation,
                            rotationVariant: 1,
                            connectedEntities: [contents],
                        };
                    } else if (staticComp.rotation === targetSenderRotation) {
                        // Draw connections to receivers
                        if (undergroundComp.mode === enumUndergroundBeltMode.receiver) {
                            return {
                                rotation: rotation,
                                rotationVariant: 0,
                                connectedEntities: [contents],
                            };
                        } else {
                            break;
                        }
                    }
                }
            }
        }

        return {
            rotation,
            rotationVariant: 0,
        };
    }

    /**
     * @param {Entity} entity
     * @param {number} rotationVariant
     * @param {string} variant
     */
    updateVariants(entity, rotationVariant, variant) {
        const mode = MetaUndergroundBeltBuilding.rotationVariantToMode[rotationVariant];
        entity.components.UndergroundBelt.tier = MetaUndergroundBeltBuilding.variantToTier[variant];
        MetaUndergroundBeltBuilding.componentVariationsByRotation[mode](entity, rotationVariant);
    }
}

MetaUndergroundBeltBuilding.setupEntityComponents = [
    // Required, since the item processor needs this.
    entity =>
        entity.addComponent(
            new ItemEjectorComponent({
                slots: [],
            })
        ),
    entity => entity.addComponent(new UndergroundBeltComponent({})),
    entity =>
        entity.addComponent(
            new ItemAcceptorComponent({
                slots: [],
            })
        ),
];

MetaUndergroundBeltBuilding.rotationVariants = [0, 1];

MetaUndergroundBeltBuilding.variants = {
    tier2: "tier2",
};

MetaUndergroundBeltBuilding.overlayMatricesByRotation = [
    // Sender
    (entity, rotationVariant) => generateMatrixRotations([1, 1, 1, 0, 1, 0, 0, 1, 0]),
    // Receiver
    (entity, rotationVariant) => generateMatrixRotations([0, 1, 0, 0, 1, 0, 1, 1, 1]),
];

MetaUndergroundBeltBuilding.rotationVariantToMode = [
    enumUndergroundBeltMode.sender,
    enumUndergroundBeltMode.receiver,
];

MetaUndergroundBeltBuilding.variantToTier = {
    [defaultBuildingVariant]: 0,
    [MetaUndergroundBeltBuilding.variants.tier2]: 1,
};

MetaUndergroundBeltBuilding.dimensions = {
    [defaultBuildingVariant]: () => new Vector(1, 1),
    [MetaUndergroundBeltBuilding.variants.tier2]: () => new Vector(1, 1),
};

MetaUndergroundBeltBuilding.silhouetteColorsByRotation = [() => "#6d9dff", () => "#71ff9c"];

MetaUndergroundBeltBuilding.isRemovable = {
    [defaultBuildingVariant]: () => true,
    [MetaUndergroundBeltBuilding.variants.tier2]: () => true,
};

MetaUndergroundBeltBuilding.isRotateable = {
    [defaultBuildingVariant]: () => true,
    [MetaUndergroundBeltBuilding.variants.tier2]: () => true,
};

MetaUndergroundBeltBuilding.renderPins = {
    [defaultBuildingVariant]: () => null,
    [MetaUndergroundBeltBuilding.variants.tier2]: () => null,
};

MetaUndergroundBeltBuilding.layerPreview = {
    [defaultBuildingVariant]: () => null,
    [MetaUndergroundBeltBuilding.variants.tier2]: () => null,
};

MetaUndergroundBeltBuilding.avaibleVariants = {
    [defaultBuildingVariant]: root => root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_tunnel),
    [MetaUndergroundBeltBuilding.variants.tier2]: root =>
        root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_underground_belt_tier_2),
};

MetaUndergroundBeltBuilding.layerByVariant = {
    [defaultBuildingVariant]: root => "regular",
    [MetaUndergroundBeltBuilding.variants.tier2]: root => "regular",
};

MetaUndergroundBeltBuilding.additionalStatistics = {
    /**
     * @param {*} root
     * @returns {Array<[string, string]>}
     */
    [defaultBuildingVariant]: root => {
        const rangeTiles = globalConfig.undergroundBeltMaxTilesByTier[0];

        const beltSpeed = root.hubGoals.getUndergroundBeltBaseSpeed();
        return [
            [
                T.ingame.buildingPlacement.infoTexts.range,
                T.ingame.buildingPlacement.infoTexts.tiles.replace("<x>", "" + rangeTiles),
            ],
            [T.ingame.buildingPlacement.infoTexts.speed, formatItemsPerSecond(beltSpeed)],
        ];
    },

    /**
     * @param {*} root
     * @returns {Array<[string, string]>}
     */
    [MetaUndergroundBeltBuilding.variants.tier2]: root => {
        const rangeTiles = globalConfig.undergroundBeltMaxTilesByTier[1];

        const beltSpeed = root.hubGoals.getUndergroundBeltBaseSpeed();
        return [
            [
                T.ingame.buildingPlacement.infoTexts.range,
                T.ingame.buildingPlacement.infoTexts.tiles.replace("<x>", "" + rangeTiles),
            ],
            [T.ingame.buildingPlacement.infoTexts.speed, formatItemsPerSecond(beltSpeed)],
        ];
    },
};

MetaUndergroundBeltBuilding.componentVariationsByRotation = {
    [enumUndergroundBeltMode.sender]: (entity, rotationVariant) => {
        entity.components.UndergroundBelt.mode = enumUndergroundBeltMode.sender;
        entity.components.ItemEjector.setSlots([]);
        entity.components.ItemAcceptor.setSlots([
            {
                pos: new Vector(0, 0),
                directions: [enumDirection.bottom],
            },
        ]);
    },

    [enumUndergroundBeltMode.receiver]: (entity, rotationVariant) => {
        entity.components.UndergroundBelt.mode = enumUndergroundBeltMode.receiver;
        entity.components.ItemAcceptor.setSlots([]);
        entity.components.ItemEjector.setSlots([
            {
                pos: new Vector(0, 0),
                direction: enumDirection.top,
            },
        ]);
    },
};
