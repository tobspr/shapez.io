// Globals defined by webpack

declare const G_IS_DEV: boolean;
declare function assert(condition: boolean | object | string, ...errorMessage: string[]): void;
declare function assertAlways(condition: boolean | object | string, ...errorMessage: string[]): void;

declare const abstract: void;

declare const G_APP_ENVIRONMENT: string;
declare const G_HAVE_ASSERT: boolean;
declare const G_BUILD_TIME: number;
declare const G_IS_STANDALONE: boolean;
declare const G_IS_BROWSER: boolean;
declare const G_IS_MOBILE_APP: boolean;

declare const G_BUILD_COMMIT_HASH: string;
declare const G_TRACKING_ENDPOINT: string;
declare const G_BUILD_VERSION: string;
declare const G_ALL_UI_IMAGES: Array<string>;
declare const G_IS_RELEASE: boolean;

declare const G_CHINA_VERSION: boolean;

// Polyfills
declare interface String {
    replaceAll(search: string, replacement: string): string;
}

declare interface CanvasRenderingContext2D {
    beginRoundedRect(x: number, y: number, w: number, h: number, r: number): void;
    beginCircle(x: number, y: number, r: number): void;

    msImageSmoothingEnabled: boolean;
    mozImageSmoothingEnabled: boolean;
    webkitImageSmoothingEnabled: boolean;
}

// Just for compatibility with the shared code
declare interface Logger {
    log(...args);
    warn(...args);
    info(...args);
    error(...args);
}

// Cordova
declare interface Device {
    uuid: string;
    platform: string;
    available: boolean;
    version: string;
    cordova: string;
    model: string;
    manufacturer: string;
    isVirtual: boolean;
    serial: string;
}

declare interface MobileAccessibility {
    usePreferredTextZoom(boolean);
}

declare interface Window {
    // Cordova
    device: Device;
    StatusBar: any;
    AndroidFullScreen: any;
    AndroidNotch: any;
    plugins: any;

    // Adinplay
    aiptag: any;
    adPlayer: any;
    aipPlayer: any;
    MobileAccessibility: MobileAccessibility;
    LocalFileSystem: any;

    // Debugging
    activeClickDetectors: Array<any>;

    // Experimental/Newer apis
    FontFace: any;
    TouchEvent: undefined | TouchEvent;

    // Thirdparty
    XPayStationWidget: any;
    Sentry: any;
    LogRocket: any;
    grecaptcha: any;
    gtag: any;
    cpmstarAPI: any;

    // Mods
    registerMod: any;
    anyModLoaded: any;

    webkitRequestAnimationFrame();

    assert(condition: boolean, failureMessage: string);

    coreThreadLoadedCb();
}

declare interface Navigator {
    app: any;
    device: any;
    splashscreen: any;
}

// FontFace
declare interface Document {
    fonts: any;
}

// Webpack
declare interface WebpackContext {
    keys(): Array<string>;
}

declare interface NodeRequire {
    context(src: string, flag: boolean, regexp: RegExp): WebpackContext;
}

declare interface Object {
    entries(obj: object): Array<[string, any]>;
}

declare interface Math {
    radians(number): number;
    degrees(number): number;
}

declare type Class<T = unknown> = new (...args: any[]) => T;

declare interface String {
    padStart(size: number, fill?: string): string;
    padEnd(size: number, fill: string): string;
}

declare interface FactoryTemplate<T> {
    entries: Array<Class<T>>;
    entryIds: Array<string>;
    idToEntry: any;

    getId(): string;
    getAllIds(): Array<string>;
    register(entry: Class<T>): void;
    hasId(id: string): boolean;
    findById(id: string): Class<T>;
    getEntries(): Array<Class<T>>;
    getNumEntries(): number;
}

declare interface SingletonFactoryTemplate<T> {
    entries: Array<T>;
    idToEntry: any;

    getId(): string;
    getAllIds(): Array<string>;
    register(classHandle: Class<T>): void;
    hasId(id: string): boolean;
    findById(id: string): T;
    findByClass(classHandle: Class<T>): T;
    getEntries(): Array<T>;
    getNumEntries(): number;
}

declare interface SignalTemplate0 {
    add(receiver: () => string | void, scope: null | any);
    dispatch(): string | void;
    remove(receiver: () => string | void);
    removeAll();
}

declare class TypedTrackedState<T> {
    constructor(callbackMethod?: (value: T) => void, callbackScope?: any);

    set(value: T, changeHandler?: (value: T) => void, changeScope?: any): void;

    setSilent(value: any): void;
    get(): T;
}

declare const STOP_PROPAGATION = "stop_propagation";

declare interface TypedSignal<T extends Array<any>> {
    add(receiver: (...args: T) => /* STOP_PROPAGATION */ string | void, scope?: object);
    remove(receiver: (...args: T) => /* STOP_PROPAGATION */ string | void);

    dispatch(...args: T): /* STOP_PROPAGATION */ string | void;

    removeAll();
}

declare type Layer = "regular" | "wires";
declare type ItemType = "shape" | "color" | "boolean";

declare module "worker-loader?inline=true&fallback=false!*" {
    class WebpackWorker extends Worker {
        constructor();
    }

    export default WebpackWorker;
}

declare let shapezAPI: import("../js/modloader/mod").ShapezAPI;
