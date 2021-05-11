import { RegularGameSpeed } from "./time/regular_game_speed";
import { gGameSpeedRegistry } from "../core/global_registries";
import { FastForwardGameSpeed } from "./time/fast_forward_game_speed";
import { PausedGameSpeed } from "./time/paused_game_speed";

export function addVanillaGameSpeedToAPI() {
    shapezAPI.ingame.gamespeed[RegularGameSpeed.getId()] = RegularGameSpeed;
    shapezAPI.ingame.gamespeed[FastForwardGameSpeed.getId()] = FastForwardGameSpeed;
    shapezAPI.ingame.gamespeed[PausedGameSpeed.getId()] = PausedGameSpeed;
}

export function initGameSpeedRegistry() {
    for (const gamespeedKey in shapezAPI.ingame.gamespeed) {
        if (!shapezAPI.ingame.gamespeed.hasOwnProperty(gamespeedKey)) continue;
        gGameSpeedRegistry.register(shapezAPI.ingame.gamespeed[gamespeedKey]);
    }
}
