import { SavegameInterface_V1000 } from "./1000.js";
import { createLogger } from "../../core/logging.js";
import { T } from "../../translations.js";
import { TypeVector, TypeNumber, TypeString, TypeNullable } from "../serialization_data_types.js";

const schema = require("./1001.json");

const logger = createLogger("savegame_interface/1001");

export class SavegameInterface_V1001 extends SavegameInterface_V1000 {
    getVersion() {
        return 1001;
    }

    getSchemaUncached() {
        return schema;
    }

    /**
     * @param {import("../savegame_typedefs.js").SavegameData} data
     */
    static migrate1000to1001(data) {
        logger.log("Migrating 1000 to 1001");
        const dump = data.dump;
        if (!dump) {
            return true;
        }

        dump.pinnedShapes = {
            shapes: [],
        };
        dump.waypoints = {
            waypoints: [
                {
                    label: T.ingame.waypoints.hub,
                    center: { x: 0, y: 0 },
                    zoomLevel: 3,
                    deletable: false,
                },
            ],
        };

        const entities = Array.isArray(dump.entities) ? dump.entities : [...dump.entities.values()];
        for (let i = 0; i < entities.length; ++i) {
            const entity = entities[i];

            /**
             * @typedef {{
             *   origin: TypeVector,
             *   tileSize: TypeVector,
             *   rotation: TypeNumber,
             *   originalRotation: TypeNumber,
             *   spriteKey?: string,
             *   blueprintSpriteKey: string,
             *   silhouetteColor: string
             * }} OldStaticMapEntity
             */

            // Here we mock the old type of the StaticMapEntity before the change to using
            // a building ID based system (see building_codes.js) to stop the linter from
            // complaining that the type doesn't have the properties.
            // The ignored error is the error that the types do not overlap.  In the case
            // of a v1000 save though, the data will match the mocked type above.
            /** @type OldStaticMapEntity **/
            // @ts-ignore
            const staticComp = entity.components.StaticMapEntity;
            const beltComp = entity.components.Belt;
            if (staticComp) {
                if (staticComp.spriteKey) {
                    staticComp.blueprintSpriteKey = staticComp.spriteKey.replace(
                        "sprites/buildings",
                        "sprites/blueprints"
                    );
                } else {
                    if (entity.components.Hub) {
                        staticComp.blueprintSpriteKey = "";
                    } else if (beltComp) {
                        const direction = beltComp.direction;
                        staticComp.blueprintSpriteKey = "sprites/blueprints/belt_" + direction + ".png";
                    } else {
                        assertAlways(false, "Could not deduct entity type for migrating 1000 -> 1001");
                    }
                }
            }
        }
    }
}
