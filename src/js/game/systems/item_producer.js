/* typehints:start */
import { GameRoot } from "../root";
/* typehints:end */

import { ItemProducerComponent } from "../components/item_producer";
import { GameSystemWithFilter } from "../game_system_with_filter";

export class ItemProducerSystem extends GameSystemWithFilter {
    /** @param {GameRoot} root */
    constructor(root) {
        super(root, [ItemProducerComponent]);
        this.item = null;
    }

    update() {
        for (let i = this.allEntitiesArray.length - 1; i >= 0; --i) {
            const entity = this.allEntitiesArray[i];
            const pinsComp = entity.components.WiredPins;
            if (!pinsComp) {
                continue;
            }

            const pin = pinsComp.slots[0];
            const network = pin.linkedNetwork;

            if (!network || !network.hasValue()) {
                continue;
            }

            this.item = network.currentValue;
            ejectorComp.tryEject(0, this.item);
        }
    }
}
