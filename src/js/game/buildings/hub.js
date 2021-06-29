import { enumDirection, Vector } from "../../core/vector";
import { HubComponent } from "../components/hub";
import { ItemAcceptorComponent } from "../components/item_acceptor";
import { enumItemProcessorTypes, ItemProcessorComponent } from "../components/item_processor";
import { Entity } from "../entity";
import { MetaBuilding } from "../meta_building";
import { WiredPinsComponent, enumPinSlotType } from "../components/wired_pins";

export class MetaHubBuilding extends MetaBuilding {
    constructor() {
        super("hub");
    }

    getDimensions() {
        return new Vector(4, 4);
    }

    getSilhouetteColor() {
        return "#eb5555";
    }

    getIsRotateable() {
        return false;
    }

    getBlueprintSprite() {
        return null;
    }

    getSprite() {
        // We render it ourself
        return null;
    }

    getIsRemovable() {
        return false;
    }

    /**
     * Creates the entity at the given location
     * @param {Entity} entity
     */
    setupEntityComponents(entity) {
        entity.addComponent(new HubComponent());
        entity.addComponent(
            new ItemProcessorComponent({
                inputsPerCharge: 1,
                processorType: enumItemProcessorTypes.hub,
            })
        );

        entity.addComponent(
            new WiredPinsComponent({
                slots: [
                    {
                        pos: new Vector(0, 2),
                        type: enumPinSlotType.logicalEjector,
                        direction: enumDirection.left,
                    },
                    {
                        pos: new Vector(3, 2),
                        type: enumPinSlotType.logicalEjector,
                        direction: enumDirection.right,
                    },
                    {
                        pos: new Vector(0, 3),
                        type: enumPinSlotType.logicalEjector,
                        direction: enumDirection.left,
                    },
                    {
                        pos: new Vector(3, 3),
                        type: enumPinSlotType.logicalEjector,
                        direction: enumDirection.right,
                    },
                ],
            })
        );

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
        );
    }
}
