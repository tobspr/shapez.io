import { gGameModeRegistry } from "../core/global_registries";
import { RegularGameMode } from "./modes/regular";

export function addVanillaGameModesToAPI() {
    shapezAPI.ingame.gamemodes[RegularGameMode.getId()] = RegularGameMode;
}

export function initGameModeRegistry() {
    for (const gamemodeKey in shapezAPI.ingame.gamemodes) {
        if (!shapezAPI.ingame.gamemodes.hasOwnProperty(gamemodeKey)) continue;
        gGameModeRegistry.register(shapezAPI.ingame.gamemodes[gamemodeKey]);
    }
}
