import { globalConfig, IS_MOBILE } from "../../core/config";
import { createLogger } from "../../core/logging";
import { queryParamOptions } from "../../core/query_parameters";
import { clamp } from "../../core/utils";
import { GamedistributionAdProvider } from "../ad_providers/gamedistribution";
import { NoAdProvider } from "../ad_providers/no_ad_provider";
import { PlatformWrapperInterface } from "../wrapper";
import { BrowserAchievementProvider } from "./browser_achievement_provider";
import { NoAchievementProvider } from "./no_achievement_provider";
import { StorageImplBrowser } from "./storage";
import { StorageImplBrowserIndexedDB } from "./storage_indexed_db";

const logger = createLogger("platform/browser");

export class PlatformWrapperImplBrowser extends PlatformWrapperInterface {
    initialize() {
        this.recaptchaTokenCallback = null;

        this.embedProvider = {
            id: "shapezio-website",
            adProvider: NoAdProvider,
            iframed: false,
            externalLinks: true,
            iogLink: true,
        };

        if (!G_IS_STANDALONE && queryParamOptions.embedProvider) {
            const providerId = queryParamOptions.embedProvider;
            this.embedProvider.iframed = true;
            this.embedProvider.iogLink = false;

            switch (providerId) {
                case "armorgames": {
                    this.embedProvider.id = "armorgames";
                    break;
                }

                case "iogames.space": {
                    this.embedProvider.id = "iogames.space";
                    this.embedProvider.iogLink = true;
                    break;
                }

                case "miniclip": {
                    this.embedProvider.id = "miniclip";
                    break;
                }

                case "gamedistribution": {
                    this.embedProvider.id = "gamedistribution";
                    this.embedProvider.externalLinks = false;
                    this.embedProvider.adProvider = GamedistributionAdProvider;
                    break;
                }

                case "kongregate": {
                    this.embedProvider.id = "kongregate";
                    break;
                }

                case "crazygames": {
                    this.embedProvider.id = "crazygames";
                    break;
                }

                default: {
                    logger.error("Got unsupported embed provider:", providerId);
                }
            }
        }

        logger.log("Embed provider:", this.embedProvider.id);

        return this.detectStorageImplementation()
            .then(() => this.initializeAdProvider())
            .then(() => this.initializeAchievementProvider())
            .then(() => super.initialize());
    }

    detectStorageImplementation() {
        return new Promise(resolve => {
            logger.log("Detecting storage");

            if (!window.indexedDB) {
                logger.log("Indexed DB not supported");
                this.app.storage = new StorageImplBrowser(this.app);
                resolve();
                return;
            }

            // Try accessing the indexedb
            let request;
            try {
                request = window.indexedDB.open("indexeddb_feature_detection", 1);
            } catch (ex) {
                logger.warn("Error while opening indexed db:", ex);
                this.app.storage = new StorageImplBrowser(this.app);
                resolve();
                return;
            }
            request.onerror = err => {
                logger.log("Indexed DB can *not* be accessed: ", err);
                logger.log("Using fallback to local storage");
                this.app.storage = new StorageImplBrowser(this.app);
                resolve();
            };
            request.onsuccess = () => {
                logger.log("Indexed DB *can* be accessed");
                this.app.storage = new StorageImplBrowserIndexedDB(this.app);
                resolve();
            };
        });
    }

    getId() {
        return "browser@" + this.embedProvider.id;
    }

    getUiScale() {
        if (IS_MOBILE) {
            return 1;
        }

        const avgDims = Math.min(this.app.screenWidth, this.app.screenHeight);
        return clamp((avgDims / 1000.0) * 1.9, 0.1, 10);
    }

    getSupportsRestart() {
        return true;
    }

    getTouchPanStrength() {
        return IS_MOBILE ? 1 : 0.5;
    }

    openExternalLink(url, force = false) {
        logger.log("Opening external:", url);
        if (force || this.embedProvider.externalLinks) {
            window.open(url);
        } else {
            // Do nothing
            alert(
                "This platform does not allow opening external links. You can play on https://shapez.io directly to open them.\n\nClicked Link: " +
                    url
            );
        }
    }

    performRestart() {
        logger.log("Performing restart");
        window.location.reload(true);
    }

    /**
     * Detects if there is an adblocker installed
     * @returns {Promise<boolean>}
     */
    detectAdblock() {
        return Promise.race([
            new Promise(resolve => {
                // If the request wasn't blocked within a very short period of time, this means
                // the adblocker is not active and the request was actually made -> ignore it then
                setTimeout(() => resolve(false), 30);
            }),
            new Promise(resolve => {
                fetch("https://googleads.g.doubleclick.net/pagead/id", {
                    method: "HEAD",
                    mode: "no-cors",
                })
                    .then(res => {
                        resolve(false);
                    })
                    .catch(err => {
                        resolve(true);
                    });
            }),
        ]);
    }

    initializeAdProvider() {
        if (G_IS_DEV && !globalConfig.debug.testAds) {
            logger.log("Ads disabled in local environment");
            return Promise.resolve();
        }

        // First, detect adblocker
        return this.detectAdblock().then(hasAdblocker => {
            if (hasAdblocker) {
                logger.log("Adblock detected");
                return;
            }

            const adProvider = this.embedProvider.adProvider;
            this.app.adProvider = new adProvider(this.app);
            return this.app.adProvider.initialize().catch(err => {
                logger.error("Failed to initialize ad provider, disabling ads:", err);
                this.app.adProvider = new NoAdProvider(this.app);
            });
        });
    }

    initializeAchievementProvider() {
        if (G_IS_DEV) {
            this.app.achievementProvider = new BrowserAchievementProvider(this.app);

            return this.app.achievementProvider.initialize().catch(err => {
                logger.error("Failed to initialize achievement provider, disabling:", err);

                this.app.achievementProvider = new NoAchievementProvider(this.app);
            });
        }

        return this.app.achievementProvider.initialize();
    }

    exitApp() {
        // Can not exit app
    }
}
