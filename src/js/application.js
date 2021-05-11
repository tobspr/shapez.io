import { AnimationFrame } from "./core/animation_frame";
import { BackgroundResourcesLoader } from "./core/background_resources_loader";
import { IS_MOBILE } from "./core/config";
import { GLOBAL_APP, setGlobalApp } from "./core/globals";
import { InputDistributor } from "./core/input_distributor";
import { Loader } from "./core/loader";
import { createLogger, logSection } from "./core/logging";
import { StateManager } from "./core/state_manager";
import { TrackedState } from "./core/tracked_state";
import { getPlatformName, waitNextFrame } from "./core/utils";
import { Vector } from "./core/vector";
import { AdProviderInterface } from "./platform/ad_provider";
import { NoAdProvider } from "./platform/ad_providers/no_ad_provider";
import { NoAchievementProvider } from "./platform/browser/no_achievement_provider";
import { AnalyticsInterface } from "./platform/analytics";
import { GoogleAnalyticsImpl } from "./platform/browser/google_analytics";
import { SoundImplBrowser } from "./platform/browser/sound";
import { PlatformWrapperImplBrowser } from "./platform/browser/wrapper";
import { PlatformWrapperImplElectron } from "./platform/electron/wrapper";
import { PlatformWrapperInterface } from "./platform/wrapper";
import { ApplicationSettings } from "./profile/application_settings";
import { SavegameManager } from "./savegame/savegame_manager";
import { AboutState } from "./states/about";
import { ChangelogState } from "./states/changelog";
import { InGameState } from "./states/ingame";
import { KeybindingsState } from "./states/keybindings";
import { MainMenuState } from "./states/main_menu";
import { MobileWarningState } from "./states/mobile_warning";
import { PreloadState } from "./states/preload";
import { SettingsState } from "./states/settings";
import { ShapezGameAnalytics } from "./platform/browser/game_analytics";
import { RestrictionManager } from "./core/restriction_manager";
import { AchievementProviderInterface } from "./platform/achievement_provider";

const logger = createLogger("application");

// Set the name of the hidden property and the change event for visibility
let pageHiddenPropName, pageVisibilityEventName;
if (typeof document.hidden !== "undefined") {
    // Opera 12.10 and Firefox 18 and later support
    pageHiddenPropName = "hidden";
    pageVisibilityEventName = "visibilitychange";
    // @ts-ignore
} else if (typeof document.msHidden !== "undefined") {
    pageHiddenPropName = "msHidden";
    pageVisibilityEventName = "msvisibilitychange";
    // @ts-ignore
} else if (typeof document.webkitHidden !== "undefined") {
    pageHiddenPropName = "webkitHidden";
    pageVisibilityEventName = "webkitvisibilitychange";
}

export class Application {
    constructor() {
        assert(!GLOBAL_APP, "Tried to construct application twice");
        logger.log("Creating application, platform =", getPlatformName());
        setGlobalApp(this);

        this.unloaded = false;

        // Global stuff
        this.settings = new ApplicationSettings(this);
        this.ticker = new AnimationFrame();
        this.stateMgr = new StateManager(this);
        this.savegameMgr = new SavegameManager(this);
        this.inputMgr = new InputDistributor(this);
        this.backgroundResourceLoader = new BackgroundResourcesLoader(this);

        // Restrictions (Like demo etc)
        this.restrictionMgr = new RestrictionManager(this);

        // Platform dependent stuff

        /** @type {import("./platform/storage").StorageInterface} */
        this.storage = null;

        /** @type {import("./platform/sound").SoundInterface} */
        this.sound = null;

        /** @type {PlatformWrapperInterface} */
        this.platformWrapper = null;

        /** @type {AchievementProviderInterface} */
        this.achievementProvider = null;

        /** @type {AdProviderInterface} */
        this.adProvider = null;

        /** @type {AnalyticsInterface} */
        this.analytics = null;

        /** @type {import("./platform/game_analytics").GameAnalyticsInterface} */
        this.gameAnalytics = null;

        this.initPlatformDependentInstances();

        // Track if the window is focused (only relevant for browser)
        this.focused = true;

        // Track if the window is visible
        this.pageVisible = true;

        // Track if the app is paused (cordova)
        this.applicationPaused = false;

        /** @type {TypedTrackedState<boolean>} */
        this.trackedIsRenderable = new TrackedState(this.onAppRenderableStateChanged, this);

        // Dimensions
        this.screenWidth = 0;
        this.screenHeight = 0;

        // Store the timestamp where we last checked for a screen resize, since orientationchange is unreliable with cordova
        this.lastResizeCheck = null;

        // Store the mouse position, or null if not available
        /** @type {Vector|null} */
        this.mousePosition = null;
    }

    /**
     * Initializes all platform instances
     */
    initPlatformDependentInstances() {
        logger.log("Creating platform dependent instances (standalone=", G_IS_STANDALONE, ")");

        if (G_IS_STANDALONE) {
            this.platformWrapper = new PlatformWrapperImplElectron(this);
        } else {
            this.platformWrapper = new PlatformWrapperImplBrowser(this);
        }

        // Start with empty ad provider
        this.adProvider = new NoAdProvider(this);
        this.sound = new SoundImplBrowser(this);
        this.analytics = new GoogleAnalyticsImpl(this);
        this.gameAnalytics = new ShapezGameAnalytics(this);
        this.achievementProvider = new NoAchievementProvider(this);
    }

    /**
     * Registers all game states
     */
    registerStates() {
        for (const stateKey in Application.states) {
            if (!Object.hasOwnProperty.call(Application.states, stateKey)) continue;
            this.stateMgr.register(Application.states[stateKey]);
        }
    }

    /**
     * Registers all event listeners
     */
    registerEventListeners() {
        window.addEventListener("focus", this.onFocus.bind(this));
        window.addEventListener("blur", this.onBlur.bind(this));

        window.addEventListener("resize", () => this.checkResize(), true);
        window.addEventListener("orientationchange", () => this.checkResize(), true);

        if (!G_IS_MOBILE_APP && !IS_MOBILE) {
            window.addEventListener("mousemove", this.handleMousemove.bind(this));
            window.addEventListener("mouseout", this.handleMousemove.bind(this));
            window.addEventListener("mouseover", this.handleMousemove.bind(this));
            window.addEventListener("mouseleave", this.handleMousemove.bind(this));
        }

        // Unload events
        window.addEventListener("beforeunload", this.onBeforeUnload.bind(this), true);
        window.addEventListener("unload", this.onUnload.bind(this), true);

        document.addEventListener(pageVisibilityEventName, this.handleVisibilityChange.bind(this), false);

        // Track touches so we can update the focus appropriately
        document.addEventListener("touchstart", this.updateFocusAfterUserInteraction.bind(this), true);
        document.addEventListener("touchend", this.updateFocusAfterUserInteraction.bind(this), true);
    }

    /**
     * Checks the focus after a touch
     * @param {TouchEvent} event
     */
    updateFocusAfterUserInteraction(event) {
        const target = /** @type {HTMLElement} */ (event.target);
        if (!target || !target.tagName) {
            // Safety check
            logger.warn("Invalid touchstart/touchend event:", event);
            return;
        }

        // When clicking an element which is not the currently focused one, defocus it
        if (target !== document.activeElement) {
            // @ts-ignore
            if (document.activeElement.blur) {
                // @ts-ignore
                document.activeElement.blur();
            }
        }

        // If we click an input field, focus it now
        if (target.tagName.toLowerCase() === "input") {
            // We *really* need the focus
            waitNextFrame().then(() => target.focus());
        }
    }

    /**
     * Handles a page visibility change event
     * @param {Event} event
     */
    handleVisibilityChange(event) {
        window.focus();
        const pageVisible = !document[pageHiddenPropName];
        if (pageVisible !== this.pageVisible) {
            this.pageVisible = pageVisible;
            logger.log("Visibility changed:", this.pageVisible);
            this.trackedIsRenderable.set(this.isRenderable());
        }
    }

    /**
     * Handles a mouse move event
     * @param {MouseEvent} event
     */
    handleMousemove(event) {
        this.mousePosition = new Vector(event.clientX, event.clientY);
    }

    /**
     * Internal on focus handler
     */
    onFocus() {
        this.focused = true;
    }

    /**
     * Internal blur handler
     */
    onBlur() {
        this.focused = false;
    }

    /**
     * Returns if the app is currently visible
     */
    isRenderable() {
        return !this.applicationPaused && this.pageVisible;
    }

    onAppRenderableStateChanged(renderable) {
        logger.log("Application renderable:", renderable);
        window.focus();
        const currentState = this.stateMgr.getCurrentState();
        if (!renderable) {
            if (currentState) {
                currentState.onAppPause();
            }
        } else {
            if (currentState) {
                currentState.onAppResume();
            }
            this.checkResize();
        }

        this.sound.onPageRenderableStateChanged(renderable);
    }

    /**
     * Internal unload handler
     */
    onUnload(event) {
        if (!this.unloaded) {
            logSection("UNLOAD HANDLER", "#f77");
            this.unloaded = true;
            const currentState = this.stateMgr.getCurrentState();
            if (currentState) {
                currentState.onBeforeExit();
            }
            this.deinitialize();
        }
    }

    /**
     * Internal before-unload handler
     */
    onBeforeUnload(event) {
        logSection("BEFORE UNLOAD HANDLER", "#f77");
        const currentState = this.stateMgr.getCurrentState();

        if (!G_IS_DEV && currentState && currentState.getHasUnloadConfirmation()) {
            if (!G_IS_STANDALONE) {
                // Need to show a "Are you sure you want to exit"
                event.preventDefault();
                event.returnValue = "Are you sure you want to exit?";
            }
        }
    }

    /**
     * Boots the application
     */
    async boot() {
        console.log("Booting ...");

        this.registerStates();
        this.registerEventListeners();

        Loader.linkAppAfterBoot(this);

        // Check for mobile
        if (IS_MOBILE) {
            this.stateMgr.moveToState("MobileWarningState");
        } else {
            this.stateMgr.moveToState("PreloadState");
        }

        // Starting rendering
        this.ticker.frameEmitted.add(this.onFrameEmitted, this);
        this.ticker.bgFrameEmitted.add(this.onBackgroundFrame, this);
        this.ticker.start();

        window.focus();
    }

    /**
     * Deinitializes the application
     */
    deinitialize() {
        return this.sound.deinitialize();
    }

    /**
     * Background frame update callback
     * @param {number} dt
     */
    onBackgroundFrame(dt) {
        if (this.isRenderable()) {
            return;
        }

        const currentState = this.stateMgr.getCurrentState();
        if (currentState) {
            currentState.onBackgroundTick(dt);
        }
    }

    /**
     * Frame update callback
     * @param {number} dt
     */
    onFrameEmitted(dt) {
        if (!this.isRenderable()) {
            return;
        }

        const time = performance.now();

        // Periodically check for resizes, this is expensive (takes 2-3ms so only do it once in a while!)
        if (!this.lastResizeCheck || time - this.lastResizeCheck > 1000) {
            this.checkResize();
            this.lastResizeCheck = time;
        }

        const currentState = this.stateMgr.getCurrentState();
        if (currentState) {
            currentState.onRender(dt);
        }
    }

    /**
     * Checks if the app resized. Only does this once in a while
     * @param {boolean} forceUpdate Forced update of the dimensions
     */
    checkResize(forceUpdate = false) {
        const w = window.innerWidth;
        const h = window.innerHeight;
        if (this.screenWidth !== w || this.screenHeight !== h || forceUpdate) {
            this.screenWidth = w;
            this.screenHeight = h;
            const currentState = this.stateMgr.getCurrentState();
            if (currentState) {
                currentState.onResized(this.screenWidth, this.screenHeight);
            }

            const scale = this.getEffectiveUiScale();
            waitNextFrame().then(() => document.documentElement.style.setProperty("--ui-scale", `${scale}`));
            window.focus();
        }
    }

    /**
     * Returns the effective ui sclae
     */
    getEffectiveUiScale() {
        return this.platformWrapper.getUiScale() * this.settings.getInterfaceScaleValue();
    }

    /**
     * Callback after ui scale has changed
     */
    updateAfterUiScaleChanged() {
        this.checkResize(true);
    }
}

Application.trackClicks = undefined;
Application.getMainContentHTML = undefined;
Application.states = {
    PreloadState,
    MobileWarningState,
    MainMenuState,
    InGameState,
    SettingsState,
    KeybindingsState,
    AboutState,
    ChangelogState,
};
