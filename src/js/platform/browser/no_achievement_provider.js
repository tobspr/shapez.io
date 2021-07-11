import { AchievementProviderInterface } from "../achievement_provider";

export class NoAchievementProvider extends AchievementProviderInterface {
    hasAchievements() {
        return false;
    }

    hasLoaded() {
        return false;
    }

    initialize() {
        return Promise.resolve();
    }

    onLoad() {
        return Promise.reject(new Error("No achievements to load"));
    }

    activate() {
        return Promise.resolve();
    }

    deactivate() {
        return Promise.resolve();
    }
}
