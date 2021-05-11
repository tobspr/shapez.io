import { enumDirection, Vector } from "../../core/vector";
import { ItemEjectorComponent } from "../components/item_ejector";
import { ItemProducerComponent } from "../components/item_producer";
import { enumPinSlotType, WiredPinsComponent } from "../components/wired_pins";
import { Entity } from "../entity";
import { defaultBuildingVariant, MetaBuilding } from "../meta_building";
import { GameRoot } from "../root";

export class MetaItemProducerBuilding extends MetaBuilding {
    constructor() {
        super("item_producer");
    }

    /**
     * @param {string} variant
     */
    getSilhouetteColor(variant) {
        return MetaItemProducerBuilding.silhouetteColors[variant]();
    }

    /**
     * @param {string} variant
     */
    getDimensions(variant) {
        return MetaItemProducerBuilding.dimensions[variant]();
    }

    /**
     * @param {string} variant
     */
    getIsRemovable(variant) {
        return MetaItemProducerBuilding.isRemovable[variant]();
    }

    /**
     * @param {string} variant
     */
    getIsRotateable(variant) {
        return MetaItemProducerBuilding.isRotateable[variant]();
    }

    /**
     * @param {GameRoot} root
     */
    getAvailableVariants(root) {
        const variants = MetaItemProducerBuilding.avaibleVariants;

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
        return MetaItemProducerBuilding.layerByVariant[variant](root);
    }

    /**
     * @param {string} variant
     */
    getShowLayerPreview(variant) {
        return MetaItemProducerBuilding.layerPreview[variant]();
    }

    /**
     * Creates the entity at the given location
     * @param {Entity} entity
     */
    setupEntityComponents(entity) {
        MetaItemProducerBuilding.setupEntityComponents.forEach(func => func(entity));
    }

    /**
     * @param {Entity} entity
     * @param {number} rotationVariant
     * @param {string} variant
     */
    updateVariants(entity, rotationVariant, variant) {
        MetaItemProducerBuilding.componentVariations[variant](entity, rotationVariant);
    }
}

MetaItemProducerBuilding.setupEntityComponents = [
    entity =>
        entity.addComponent(
            new ItemEjectorComponent({
                slots: [{ pos: new Vector(0, 0), direction: enumDirection.top }],
            })
        ),
    entity =>
        entity.addComponent(
            new WiredPinsComponent({
                slots: [
                    {
                        pos: new Vector(0, 0),
                        type: enumPinSlotType.logicalAcceptor,
                        direction: enumDirection.bottom,
                    },
                ],
            })
        ),

    entity => entity.addComponent(new ItemProducerComponent()),
];

MetaItemProducerBuilding.overlayMatrices = {
    [defaultBuildingVariant]: (entity, rotationVariant) => null,
};

MetaItemProducerBuilding.dimensions = {
    [defaultBuildingVariant]: () => new Vector(1, 1),
};

MetaItemProducerBuilding.silhouetteColors = {
    [defaultBuildingVariant]: () => "#b37dcd",
};

MetaItemProducerBuilding.isRemovable = {
    [defaultBuildingVariant]: () => true,
};

MetaItemProducerBuilding.isRotateable = {
    [defaultBuildingVariant]: () => true,
};

MetaItemProducerBuilding.avaibleVariants = {
    [defaultBuildingVariant]: root => true,
};

MetaItemProducerBuilding.layerByVariant = {
    [defaultBuildingVariant]: root => "regular",
};

MetaItemProducerBuilding.layerPreview = {
    [defaultBuildingVariant]: () => "wires",
};

MetaItemProducerBuilding.componentVariations = {
    [defaultBuildingVariant]: (entity, rotationVariant) => {
        entity.components.ItemEjector.setSlots([{ pos: new Vector(0, 0), direction: enumDirection.top }]);

        entity.components.WiredPins.setSlots([
            {
                pos: new Vector(0, 0),
                type: enumPinSlotType.logicalAcceptor,
                direction: enumDirection.bottom,
            },
        ]);
    },
};
