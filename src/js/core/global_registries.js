import { SingletonFactory } from "./singleton_factory";
import { Factory } from "./factory";
import { GameMode } from "../game/game_mode";

// These factories are here to remove circular dependencies

/** @type {SingletonFactoryTemplate<import("../game/meta_building").MetaBuilding>} */
export let gMetaBuildingRegistry = new SingletonFactory();

/** @type {Object.<string, Array<Class<import("../game/meta_building").MetaBuilding>>>} */
export let gBuildingsByCategory = null;

/** @type {FactoryTemplate<import("../game/component").Component>} */
export let gComponentRegistry = new Factory("component");

/** @type {FactoryTemplate<GameMode>} */
export let gGameModeRegistry = new Factory("gamemode");

/** @type {FactoryTemplate<import("../game/time/base_game_speed").BaseGameSpeed>} */
export let gGameSpeedRegistry = new Factory("gamespeed");

/** @type {FactoryTemplate<import("../game/base_item").BaseItem>} */
export let gItemRegistry = new Factory("item");

// Helpers

/**
 * @param {Object.<string, Array<Class<import("../game/meta_building").MetaBuilding>>>} buildings
 */
export function initBuildingsByCategory(buildings) {
    gBuildingsByCategory = buildings;
}
