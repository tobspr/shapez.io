import { gMetaBuildingRegistry } from "../../core/global_registries.js";
import { createLogger } from "../../core/logging.js";
import { MetaBalancerBuilding } from "../../game/buildings/balancer.js";
import { MetaBeltBuilding } from "../../game/buildings/belt.js";
import { MetaCutterBuilding } from "../../game/buildings/cutter.js";
import { MetaHubBuilding } from "../../game/buildings/hub.js";
import { MetaMinerBuilding } from "../../game/buildings/miner.js";
import { MetaMixerBuilding } from "../../game/buildings/mixer.js";
import { MetaPainterBuilding } from "../../game/buildings/painter.js";
import { MetaRotaterBuilding } from "../../game/buildings/rotater.js";
import { MetaStackerBuilding } from "../../game/buildings/stacker.js";
import { MetaStorageBuilding } from "../../game/buildings/storage.js";
import { MetaTrashBuilding } from "../../game/buildings/trash.js";
import { MetaUndergroundBeltBuilding } from "../../game/buildings/underground_belt.js";
import { getCodeFromBuildingData } from "../../game/building_codes.js";
import { StaticMapEntityComponent } from "../../game/components/static_map_entity.js";
import { Entity } from "../../game/entity.js";
import { defaultBuildingVariant, MetaBuilding } from "../../game/meta_building.js";
import { SavegameInterface_V1005 } from "./1005.js";

const schema = require("./1006.json");
const logger = createLogger("savegame_interface/1006");

/**
 *
 * @param {typeof MetaBuilding} metaBuilding
 * @param {string=} variant
 * @param {number=} rotationVariant
 */
function findCode(metaBuilding, variant = defaultBuildingVariant, rotationVariant = 0) {
    return getCodeFromBuildingData(gMetaBuildingRegistry.findByClass(metaBuilding), variant, rotationVariant);
}

/**
 * Rebalances a value from the old balancing to the new one
 * @param {number} value
 * @returns {number}
 */
function rebalance(value) {
    return Math.round(Math.pow(value, 0.75));
}

export class SavegameInterface_V1006 extends SavegameInterface_V1005 {
    getVersion() {
        return 1006;
    }

    getSchemaUncached() {
        return schema;
    }

    static computeSpriteMapping() {
        return {
            // Belt
            "sprites/blueprints/belt_top.png": findCode(MetaBeltBuilding, defaultBuildingVariant, 0),
            "sprites/blueprints/belt_left.png": findCode(MetaBeltBuilding, defaultBuildingVariant, 1),
            "sprites/blueprints/belt_right.png": findCode(MetaBeltBuilding, defaultBuildingVariant, 2),

            // Splitter (=Balancer)
            "sprites/blueprints/splitter.png": findCode(MetaBalancerBuilding),
            "sprites/blueprints/splitter-compact.png": findCode(
                MetaBalancerBuilding,
                MetaBalancerBuilding.variants.merger
            ),
            "sprites/blueprints/splitter-compact-inverse.png": findCode(
                MetaBalancerBuilding,
                MetaBalancerBuilding.variants.mergerInverse
            ),

            // Underground belt
            "sprites/blueprints/underground_belt_entry.png": findCode(
                MetaUndergroundBeltBuilding,
                defaultBuildingVariant,
                0
            ),
            "sprites/blueprints/underground_belt_exit.png": findCode(
                MetaUndergroundBeltBuilding,
                defaultBuildingVariant,
                1
            ),

            "sprites/blueprints/underground_belt_entry-tier2.png": findCode(
                MetaUndergroundBeltBuilding,
                MetaUndergroundBeltBuilding.variants.tier2,
                0
            ),
            "sprites/blueprints/underground_belt_exit-tier2.png": findCode(
                MetaUndergroundBeltBuilding,
                MetaUndergroundBeltBuilding.variants.tier2,
                1
            ),

            // Miner
            "sprites/blueprints/miner.png": findCode(MetaMinerBuilding),
            "sprites/blueprints/miner-chainable.png": findCode(
                MetaMinerBuilding,
                MetaMinerBuilding.variants.chainable,
                0
            ),

            // Cutter
            "sprites/blueprints/cutter.png": findCode(MetaCutterBuilding),
            "sprites/blueprints/cutter-quad.png": findCode(
                MetaCutterBuilding,
                MetaCutterBuilding.variants.quad
            ),

            // Rotater
            "sprites/blueprints/rotater.png": findCode(MetaRotaterBuilding),
            "sprites/blueprints/rotater-ccw.png": findCode(
                MetaRotaterBuilding,
                MetaRotaterBuilding.variants.ccw
            ),

            // Stacker
            "sprites/blueprints/stacker.png": findCode(MetaStackerBuilding),

            // Mixer
            "sprites/blueprints/mixer.png": findCode(MetaMixerBuilding),

            // Painter
            "sprites/blueprints/painter.png": findCode(MetaPainterBuilding),
            "sprites/blueprints/painter-mirrored.png": findCode(
                MetaPainterBuilding,
                MetaPainterBuilding.variants.mirrored
            ),
            "sprites/blueprints/painter-double.png": findCode(
                MetaPainterBuilding,
                MetaPainterBuilding.variants.double
            ),
            "sprites/blueprints/painter-quad.png": findCode(
                MetaPainterBuilding,
                MetaPainterBuilding.variants.quad
            ),

            // Trash
            "sprites/blueprints/trash.png": findCode(MetaTrashBuilding),

            // Storage
            "sprites/blueprints/trash-storage.png": findCode(MetaStorageBuilding),
        };
    }

    /**
     * @param {import("../savegame_typedefs.js").SavegameData} data
     */
    static migrate1005to1006(data) {
        logger.log("Migrating 1005 to 1006");
        const dump = data.dump;
        if (!dump) {
            return true;
        }

        // Reduce stored shapes
        const stored = dump.hubGoals.storedShapes;
        for (const shapeKey in stored) {
            stored[shapeKey] = rebalance(stored[shapeKey]);
        }

        // Reset final game shape
        stored["RuCw--Cw:----Ru--"] = 0;

        // Reduce goals
        if (dump.hubGoals.currentGoal) {
            dump.hubGoals.currentGoal.required = rebalance(dump.hubGoals.currentGoal.required);
        }

        let level = Math.min(19, dump.hubGoals.level);

        const levelMapping = {
            14: 15,
            15: 16,
            16: 17,
            17: 18,
            18: 19,
            19: 20,
        };

        dump.hubGoals.level = levelMapping[level] || level;

        // Update entities
        const entities = dump.entities;
        for (let i = 0; i < entities.length; ++i) {
            const entity = entities[i];
            const components = entity.components;
            this.migrateStaticComp1005to1006(entity);

            // HUB
            if (components.Hub) {
                // @ts-ignore
                components.Hub = {};
            }

            // Item Processor
            if (components.ItemProcessor) {
                // @ts-ignore
                components.ItemProcessor = {
                    nextOutputSlot: 0,
                };
            }

            // OLD: Unremovable component
            // @ts-ignore
            if (components.Unremovable) {
                // @ts-ignore
                delete components.Unremovable;
            }

            // OLD: ReplaceableMapEntity
            // @ts-ignore
            if (components.ReplaceableMapEntity) {
                // @ts-ignore
                delete components.ReplaceableMapEntity;
            }

            // ItemAcceptor
            if (components.ItemAcceptor) {
                // @ts-ignore
                components.ItemAcceptor = {};
            }

            // Belt
            if (components.Belt) {
                // @ts-ignore
                components.Belt = {};
            }

            // Item Ejector
            if (components.ItemEjector) {
                // @ts-ignore
                components.ItemEjector = {
                    slots: [],
                };
            }

            // UndergroundBelt
            if (components.UndergroundBelt) {
                // @ts-ignore
                components.UndergroundBelt = {
                    pendingItems: [],
                };
            }

            // Miner
            if (components.Miner) {
                // @ts-ignore
                delete components.Miner.chainable;

                components.Miner.lastMiningTime = 0;
                components.Miner.itemChainBuffer = [];
            }

            // Storage
            if (components.Storage) {
                // @ts-ignore
                components.Storage = {
                    storedCount: rebalance(components.Storage.storedCount),
                    storedItem: null,
                };
            }
        }
    }

    /**
     *
     * @param {Entity} entity
     */
    static migrateStaticComp1005to1006(entity) {
        const spriteMapping = this.computeSpriteMapping();
        const staticComp = entity.components.StaticMapEntity;

        /** @type {StaticMapEntityComponent} */
        const newStaticComp = {};
        newStaticComp.origin = staticComp.origin;
        newStaticComp.originalRotation = staticComp.originalRotation;
        newStaticComp.rotation = staticComp.rotation;

        // @ts-ignore
        newStaticComp.code = spriteMapping[staticComp.blueprintSpriteKey];

        // Hub special case
        if (entity.components.Hub) {
            newStaticComp.code = findCode(MetaHubBuilding);
        }

        // Belt special case
        if (entity.components.Belt) {
            const actualCode = {
                top: findCode(MetaBeltBuilding, defaultBuildingVariant, 0),
                left: findCode(MetaBeltBuilding, defaultBuildingVariant, 1),
                right: findCode(MetaBeltBuilding, defaultBuildingVariant, 2),
            }[entity.components.Belt.direction];
            if (actualCode !== newStaticComp.code) {
                if (G_IS_DEV) {
                    console.warn("Belt mismatch");
                }
                newStaticComp.code = actualCode;
            }
        }

        if (!newStaticComp.code) {
            throw new Error(
                // @ts-ignore
                "1006 Migration: Could not reconstruct code for " + staticComp.blueprintSpriteKey
            );
        }

        entity.components.StaticMapEntity = newStaticComp;
    }
}
