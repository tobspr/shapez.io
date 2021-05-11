import { ItemProducerComponent } from "../components/item_producer";
import { GameSystemWithFilter } from "../game_system_with_filter";

export class ItemProducerSystem extends GameSystemWithFilter {
    constructor(root) {
        super(root, [ItemProducerComponent]);
    }

    static getId() {
        return "itemProducer";
    }

    update() {
        for (let i = 0; i < this.allEntities.length; ++i) {
            const entity = this.allEntities[i];
            const pinsComp = entity.components.WiredPins;
            const pin = pinsComp.slots[0];
            const network = pin.linkedNetwork;

            if (!network || !network.hasValue()) {
                continue;
            }

            const ejectorComp = entity.components.ItemEjector;
            ejectorComp.tryEject(0, network.currentValue);
        }
    }
}
