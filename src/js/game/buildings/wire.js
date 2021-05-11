import { Loader } from "../../core/loader";
import { generateMatrixRotations } from "../../core/utils";
import { enumDirection, Vector } from "../../core/vector";
import { SOUNDS } from "../../platform/sound";
import { enumWireType, WireComponent } from "../components/wire";
import { Entity } from "../entity";
import { defaultBuildingVariant, MetaBuilding } from "../meta_building";
import { GameRoot } from "../root";
import { enumHubGoalRewards } from "../tutorial_goals";

export class MetaWireBuilding extends MetaBuilding {
    constructor() {
        super("wire");
    }

    /**
     * @param {string} variant
     */
    getSilhouetteColor(variant) {
        return MetaWireBuilding.silhouetteColors[variant]();
    }

    /**
     * @param {GameRoot} root
     */
    getIsUnlocked(root) {
        return this.getAvailableVariants(root).length > 0;
    }

    /**
     * @param {string} variant
     */
    getIsRemovable(variant) {
        return MetaWireBuilding.isRemovable[variant]();
    }

    /**
     * @param {string} variant
     */
    getIsRotateable(variant) {
        return MetaWireBuilding.isRotateable[variant]();
    }

    /**
     * @param {GameRoot} root
     */
    getAvailableVariants(root) {
        const variants = MetaWireBuilding.avaibleVariants;

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
        return MetaWireBuilding.layerByVariant[variant](root);
    }

    /**
     * @param {string} variant
     */
    getDimensions(variant) {
        return MetaWireBuilding.dimensions[variant]();
    }

    /**
     * @param {string} variant
     */
    getShowLayerPreview(variant) {
        return MetaWireBuilding.layerPreview[variant]();
    }

    /**
     * @param {number} rotation
     * @param {number} rotationVariant
     * @param {string} variant
     * @param {Entity} entity
     * @returns {Array<number>|null}
     */
    getSpecialOverlayRenderMatrix(rotation, rotationVariant, variant, entity) {
        let matrices = MetaWireBuilding.overlayMatrices[
            MetaWireBuilding.rotationVariantToType[rotationVariant]
        ](entity, rotationVariant);
        return matrices ? matrices[rotation] : null;
    }

    /**
     * @param {string} variant
     */
    getRenderPins(variant) {
        return MetaWireBuilding.renderPins[variant]();
    }

    getHasDirectionLockAvailable() {
        return true;
    }

    getStayInPlacementMode() {
        return true;
    }

    getPlacementSound(variant) {
        return MetaWireBuilding.placementSounds[variant];
    }

    getRotateAutomaticallyWhilePlacing(variant) {
        return true;
    }

    getSprite(variant) {
        return null;
    }

    getIsReplaceable(variant) {
        return MetaWireBuilding.isReplaceable[variant]();
    }

    /**
     * Creates the entity at the given location
     * @param {Entity} entity
     */
    setupEntityComponents(entity) {
        MetaWireBuilding.setupEntityComponents.forEach(func => func(entity));
    }

    /**
     * @param {Entity} entity
     * @param {number} rotationVariant
     * @param {string} variant
     */
    updateVariants(entity, rotationVariant, variant) {
        MetaWireBuilding.componentVariations[variant](entity, rotationVariant);
    }

    /**
     *
     * @param {number} rotationVariant
     * @param {string} variant
     * @returns {import("../../core/sprites").AtlasSprite}
     */
    getPreviewSprite(rotationVariant, variant) {
        const wireVariant = MetaWireBuilding.wireVariantToVariant[variant];
        switch (MetaWireBuilding.rotationVariantToType[rotationVariant]) {
            case enumWireType.forward: {
                return Loader.getSprite("sprites/wires/sets/" + wireVariant + "_forward.png");
            }
            case enumWireType.turn: {
                return Loader.getSprite("sprites/wires/sets/" + wireVariant + "_turn.png");
            }
            case enumWireType.split: {
                return Loader.getSprite("sprites/wires/sets/" + wireVariant + "_split.png");
            }
            case enumWireType.cross: {
                return Loader.getSprite("sprites/wires/sets/" + wireVariant + "_cross.png");
            }
            default: {
                assertAlways(false, "Invalid wire rotation variant");
            }
        }
    }

    getBlueprintSprite(rotationVariant, variant) {
        return this.getPreviewSprite(rotationVariant, variant);
    }

    /**
     * Should compute the optimal rotation variant on the given tile
     * @param {object} param0
     * @param {GameRoot} param0.root
     * @param {Vector} param0.tile
     * @param {number} param0.rotation
     * @param {string} param0.variant
     * @param {string} param0.layer
     * @return {{ rotation: number, rotationVariant: number, connectedEntities?: Array<Entity> }}
     */
    computeOptimalDirectionAndRotationVariantAtTile({ root, tile, rotation, variant, layer }) {
        const wireVariant = MetaWireBuilding.wireVariantToVariant[variant];
        const connections = {
            // @ts-ignore
            top: root.logic.computeWireEdgeStatus({ tile, wireVariant, edge: enumDirection.top }),
            // @ts-ignore
            right: root.logic.computeWireEdgeStatus({ tile, wireVariant, edge: enumDirection.right }),
            // @ts-ignore
            bottom: root.logic.computeWireEdgeStatus({ tile, wireVariant, edge: enumDirection.bottom }),
            // @ts-ignore
            left: root.logic.computeWireEdgeStatus({ tile, wireVariant, edge: enumDirection.left }),
        };

        let flag = 0;
        flag |= connections.top ? 0x1000 : 0;
        flag |= connections.right ? 0x100 : 0;
        flag |= connections.bottom ? 0x10 : 0;
        flag |= connections.left ? 0x1 : 0;

        let targetType = enumWireType.forward;

        // First, reset rotation
        rotation = 0;

        switch (flag) {
            case 0x0000:
                // Nothing
                break;

            case 0x0001:
                // Left
                rotation += 90;
                break;

            case 0x0010:
                // Bottom
                // END
                break;

            case 0x0011:
                // Bottom | Left
                targetType = enumWireType.turn;
                rotation += 90;
                break;

            case 0x0100:
                // Right
                rotation += 90;
                break;

            case 0x0101:
                // Right | Left
                rotation += 90;
                break;

            case 0x0110:
                // Right | Bottom
                targetType = enumWireType.turn;
                break;

            case 0x0111:
                // Right | Bottom | Left
                targetType = enumWireType.split;
                break;

            case 0x1000:
                // Top
                break;

            case 0x1001:
                // Top | Left
                targetType = enumWireType.turn;
                rotation += 180;
                break;

            case 0x1010:
                // Top | Bottom
                break;

            case 0x1011:
                // Top | Bottom | Left
                targetType = enumWireType.split;
                rotation += 90;
                break;

            case 0x1100:
                // Top | Right
                targetType = enumWireType.turn;
                rotation -= 90;
                break;

            case 0x1101:
                // Top | Right | Left
                targetType = enumWireType.split;
                rotation += 180;
                break;

            case 0x1110:
                // Top | Right | Bottom
                targetType = enumWireType.split;
                rotation -= 90;
                break;

            case 0x1111:
                // Top | Right | Bottom | Left
                targetType = enumWireType.cross;
                break;
        }

        return {
            // Clamp rotation
            rotation: (rotation + 360 * 10) % 360,
            rotationVariant: MetaWireBuilding.rotationVariantToType.indexOf(targetType),
        };
    }
}

MetaWireBuilding.setupEntityComponents = [entity => entity.addComponent(new WireComponent({}))];

MetaWireBuilding.variants = {
    second: "second",
};
MetaWireBuilding.wireVariants = {
    first: "first",
    [MetaWireBuilding.variants.second]: "second",
};

MetaWireBuilding.rotationVariants = [0, 1, 2, 3];

MetaWireBuilding.placementSounds = {
    [defaultBuildingVariant]: SOUNDS.placeBelt,
    [MetaWireBuilding.variants.second]: SOUNDS.placeBelt,
};

MetaWireBuilding.wireVariantToVariant = {
    [defaultBuildingVariant]: "first",
    [MetaWireBuilding.variants.second]: "second",
};

MetaWireBuilding.rotationVariantToType = [
    enumWireType.forward,
    enumWireType.turn,
    enumWireType.split,
    enumWireType.cross,
];

MetaWireBuilding.overlayMatrices = {
    [enumWireType.forward]: (entity, rotationVariant) => generateMatrixRotations([0, 1, 0, 0, 1, 0, 0, 1, 0]),
    [enumWireType.split]: (entity, rotationVariant) => generateMatrixRotations([0, 0, 0, 1, 1, 1, 0, 1, 0]),
    [enumWireType.turn]: (entity, rotationVariant) => generateMatrixRotations([0, 0, 0, 0, 1, 1, 0, 1, 0]),
    [enumWireType.cross]: (entity, rotationVariant) => generateMatrixRotations([0, 1, 0, 1, 1, 1, 0, 1, 0]),
};

MetaWireBuilding.avaibleVariants = {
    [defaultBuildingVariant]: root =>
        root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_wires_painter_and_levers),
    [MetaWireBuilding.variants.second]: root =>
        root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_wires_painter_and_levers),
};

MetaWireBuilding.dimensions = {
    [defaultBuildingVariant]: () => new Vector(1, 1),
    [MetaWireBuilding.variants.second]: () => new Vector(1, 1),
};

MetaWireBuilding.isRemovable = {
    [defaultBuildingVariant]: () => true,
    [MetaWireBuilding.variants.second]: () => true,
};

MetaWireBuilding.isReplaceable = {
    [defaultBuildingVariant]: () => true,
    [MetaWireBuilding.variants.second]: () => true,
};

MetaWireBuilding.isRotateable = {
    [defaultBuildingVariant]: () => true,
    [MetaWireBuilding.variants.second]: () => true,
};

MetaWireBuilding.renderPins = {
    [defaultBuildingVariant]: () => null,
    [MetaWireBuilding.variants.second]: () => null,
};

MetaWireBuilding.layerPreview = {
    [defaultBuildingVariant]: () => "wires",
    [MetaWireBuilding.variants.second]: () => "wires",
};

MetaWireBuilding.layerByVariant = {
    [defaultBuildingVariant]: root => "wires",
    [MetaWireBuilding.variants.second]: root => "wires",
};

MetaWireBuilding.silhouetteColors = {
    [defaultBuildingVariant]: () => "#61ef6f",
    [MetaWireBuilding.variants.second]: () => "#61ef6f",
};

MetaWireBuilding.componentVariations = {
    [defaultBuildingVariant]: (entity, rotationVariant) => {
        entity.components.Wire.type = MetaWireBuilding.rotationVariantToType[rotationVariant];
        entity.components.Wire.variant = "first";
    },

    [MetaWireBuilding.variants.second]: (entity, rotationVariant) => {
        entity.components.Wire.type = MetaWireBuilding.rotationVariantToType[rotationVariant];
        entity.components.Wire.variant = "second";
    },
};
