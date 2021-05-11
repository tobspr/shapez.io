import { createLogger } from "../../core/logging.js";
import { codes } from "../../modloader/old_buildings_codes.js";
import { SavegameInterface_V1007 } from "./1007.js";

const schema = require("./ML01.json");
const logger = createLogger("savegame_interface/modloader");

export class SavegameInterface_ML01 extends SavegameInterface_V1007 {
    // @ts-ignore
    getVersion() {
        return "ML01";
    }

    getSchemaUncached() {
        return schema;
    }

    /**
     * @param {import("../savegame_typedefs.js").SavegameData} data
     */
    static migrate1008toML01(data) {
        logger.log("Migrating 1008 to ML01");
        const dump = data.dump;
        if (!dump) {
            return true;
        }

        for (let i = 0; i < dump.entities.length; i++) {
            dump.entities[i].components.StaticMapEntity.code =
                codes[dump.entities[i].components.StaticMapEntity.code];
        }
    }
}
