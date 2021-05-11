import { enumDirection, Vector } from "../../core/vector";
import { HubComponent } from "../components/hub";
import { ItemAcceptorComponent } from "../components/item_acceptor";
import { enumItemProcessorTypes, ItemProcessorComponent } from "../components/item_processor";
import { Entity } from "../entity";
import { defaultBuildingVariant, MetaBuilding } from "../meta_building";
import { WiredPinsComponent, enumPinSlotType } from "../components/wired_pins";
import { GameRoot } from "../root";

export class MetaHubBuilding extends MetaBuilding {
    constructor() {
        super("hub");
    }

    /**
     * @param {string} variant
     */
    getSilhouetteColor(variant) {
        return MetaHubBuilding.silhouetteColors[variant]();
    }

    /**
     * @param {string} variant
     */
    getDimensions(variant) {
        return MetaHubBuilding.dimensions[variant]();
    }

    /**
     * @param {string} variant
     */
    getIsRotateable(variant) {
        return MetaHubBuilding.isRotateable[variant]();
    }

    getBlueprintSprite() {
        return null;
    }

    getSprite() {
        return null;
    }

    /**
     * @param {string} variant
     */
    getIsRemovable(variant) {
        return MetaHubBuilding.isRemovable[variant]();
    }

    /**
     * Returns the edit layer of the building
     * @param {GameRoot} root
     * @param {string} variant
     * @returns {Layer}
     */
    getLayer(root, variant) {
        // @ts-ignore
        return MetaHubBuilding.layerByVariant[variant](root);
    }

    /**
     * @param {GameRoot} root
     */
    getAvailableVariants(root) {
        const variants = MetaHubBuilding.avaibleVariants;

        let available = [];
        for (const variant in variants) {
            if (variants[variant](root)) available.push(variant);
        }

        return available;
    }

    /**
     * @param {string} variant
     */
    getShowLayerPreview(variant) {
        return MetaHubBuilding.layerPreview[variant]();
    }

    /**
     * @param {number} rotation
     * @param {number} rotationVariant
     * @param {string} variant
     * @param {Entity} entity
     * @returns {Array<number>|null}
     */
    getSpecialOverlayRenderMatrix(rotation, rotationVariant, variant, entity) {
        let matrices = MetaHubBuilding.overlayMatrices[variant](entity, rotationVariant);
        return matrices ? matrices[rotation] : null;
    }

    /**
     * Creates the entity at the given location
     * @param {Entity} entity
     */
    setupEntityComponents(entity) {
        MetaHubBuilding.setupEntityComponents.forEach(func => func(entity));
    }

    /**
     * @param {Entity} entity
     * @param {number} rotationVariant
     * @param {string} variant
     */
    updateVariants(entity, rotationVariant, variant) {
        MetaHubBuilding.componentVariations[variant](entity, rotationVariant);
    }
}

MetaHubBuilding.canPipet = () => false;

MetaHubBuilding.setupEntityComponents = [
    entity => entity.addComponent(new HubComponent()),
    entity =>
        entity.addComponent(
            new ItemProcessorComponent({
                inputsPerCharge: 1,
                processorType: enumItemProcessorTypes.hub,
            })
        ),

    entity =>
        entity.addComponent(
            new WiredPinsComponent({
                slots: [
                    {
                        pos: new Vector(0, 2),
                        type: enumPinSlotType.logicalEjector,
                        direction: enumDirection.left,
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
                        directions: [enumDirection.top, enumDirection.left],
                        filter: "shape",
                    },
                    {
                        pos: new Vector(1, 0),
                        directions: [enumDirection.top],
                        filter: "shape",
                    },
                    {
                        pos: new Vector(2, 0),
                        directions: [enumDirection.top],
                        filter: "shape",
                    },
                    {
                        pos: new Vector(3, 0),
                        directions: [enumDirection.top, enumDirection.right],
                        filter: "shape",
                    },
                    {
                        pos: new Vector(0, 3),
                        directions: [enumDirection.bottom, enumDirection.left],
                        filter: "shape",
                    },
                    {
                        pos: new Vector(1, 3),
                        directions: [enumDirection.bottom],
                        filter: "shape",
                    },
                    {
                        pos: new Vector(2, 3),
                        directions: [enumDirection.bottom],
                        filter: "shape",
                    },
                    {
                        pos: new Vector(3, 3),
                        directions: [enumDirection.bottom, enumDirection.right],
                        filter: "shape",
                    },
                    {
                        pos: new Vector(0, 1),
                        directions: [enumDirection.left],
                        filter: "shape",
                    },
                    {
                        pos: new Vector(0, 2),
                        directions: [enumDirection.left],
                        filter: "shape",
                    },
                    {
                        pos: new Vector(0, 3),
                        directions: [enumDirection.left],
                        filter: "shape",
                    },
                    {
                        pos: new Vector(3, 1),
                        directions: [enumDirection.right],
                        filter: "shape",
                    },
                    {
                        pos: new Vector(3, 2),
                        directions: [enumDirection.right],
                        filter: "shape",
                    },
                    {
                        pos: new Vector(3, 3),
                        directions: [enumDirection.right],
                        filter: "shape",
                    },
                ],
            })
        ),
];

MetaHubBuilding.silhouetteColors = {
    [defaultBuildingVariant]: () => "#eb5555",
};

MetaHubBuilding.dimensions = {
    [defaultBuildingVariant]: () => new Vector(4, 4),
};

MetaHubBuilding.isRemovable = {
    [defaultBuildingVariant]: () => false,
};

MetaHubBuilding.isRotateable = {
    [defaultBuildingVariant]: () => false,
};

MetaHubBuilding.overlayMatrices = {
    [defaultBuildingVariant]: (entity, rotationVariant) => null,
};

MetaHubBuilding.avaibleVariants = {
    [defaultBuildingVariant]: root => false,
};

MetaHubBuilding.layerByVariant = {
    [defaultBuildingVariant]: root => "regular",
};

MetaHubBuilding.layerPreview = {
    [defaultBuildingVariant]: () => false,
};

MetaHubBuilding.componentVariations = {
    [defaultBuildingVariant]: (entity, rotationVariant) => {
        entity.components.ItemProcessor.inputsPerCharge = 1;

        entity.components.ItemProcessor.type = enumItemProcessorTypes.hub;

        entity.components.WiredPins.setSlots([
            {
                pos: new Vector(0, 2),
                type: enumPinSlotType.logicalEjector,
                direction: enumDirection.left,
            },
        ]);

        entity.components.ItemAcceptor.setSlots([
            {
                pos: new Vector(0, 0),
                directions: [enumDirection.top, enumDirection.left],
                filter: "shape",
            },
            {
                pos: new Vector(1, 0),
                directions: [enumDirection.top],
                filter: "shape",
            },
            {
                pos: new Vector(2, 0),
                directions: [enumDirection.top],
                filter: "shape",
            },
            {
                pos: new Vector(3, 0),
                directions: [enumDirection.top, enumDirection.right],
                filter: "shape",
            },
            {
                pos: new Vector(0, 3),
                directions: [enumDirection.bottom, enumDirection.left],
                filter: "shape",
            },
            {
                pos: new Vector(1, 3),
                directions: [enumDirection.bottom],
                filter: "shape",
            },
            {
                pos: new Vector(2, 3),
                directions: [enumDirection.bottom],
                filter: "shape",
            },
            {
                pos: new Vector(3, 3),
                directions: [enumDirection.bottom, enumDirection.right],
                filter: "shape",
            },
            {
                pos: new Vector(0, 1),
                directions: [enumDirection.left],
                filter: "shape",
            },
            {
                pos: new Vector(0, 2),
                directions: [enumDirection.left],
                filter: "shape",
            },
            {
                pos: new Vector(0, 3),
                directions: [enumDirection.left],
                filter: "shape",
            },
            {
                pos: new Vector(3, 1),
                directions: [enumDirection.right],
                filter: "shape",
            },
            {
                pos: new Vector(3, 2),
                directions: [enumDirection.right],
                filter: "shape",
            },
            {
                pos: new Vector(3, 3),
                directions: [enumDirection.right],
                filter: "shape",
            },
        ]);
    },
};
