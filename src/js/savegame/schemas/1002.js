import { createLogger } from "../../core/logging.js";
import { T } from "../../translations.js";
import { SavegameInterface_V1001 } from "./1001.js";

const schema = require("./1002.json");
const logger = createLogger("savegame_interface/1002");

export class SavegameInterface_V1002 extends SavegameInterface_V1001 {
    getVersion() {
        return 1002;
    }

    getSchemaUncached() {
        return schema;
    }

    /**
     * @param {import("../savegame_typedefs.js").SavegameData} data
     */
    static migrate1001to1002(data) {
        logger.log("Migrating 1001 to 1002");
        const dump = data.dump;
        if (!dump) {
            return true;
        }

        const entities = Array.isArray(dump.entities) ? dump.entities : [...dump.entities.values()];
        for (let i = 0; i < entities.length; ++i) {
            const entity = entities[i];
            const beltComp = entity.components.Belt;
            const ejectorComp = entity.components.ItemEjector;

            if (beltComp && ejectorComp) {
                // @ts-ignore
                ejectorComp.instantEject = true;
            }
        }
    }
}
