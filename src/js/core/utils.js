import { T } from "../translations";

const bigNumberSuffixTranslationKeys = ["thousands", "millions", "billions", "trillions"];

/**
 * Returns if this platform is android
 * @returns {boolean}
 */
export function isAndroid() {
    if (!G_IS_MOBILE_APP) {
        return false;
    }
    const platform = window.device.platform;
    return platform === "Android" || platform === "amazon-fireos";
}

/**
 * Returns if this platform is iOs
 * @returns {boolean}
 */
export function isIos() {
    if (!G_IS_MOBILE_APP) {
        return false;
    }
    return window.device.platform === "iOS";
}

/**
 * Returns a platform name
 * @returns {"android" | "browser" | "ios" | "standalone" | "unknown"}
 */
export function getPlatformName() {
    if (G_IS_STANDALONE) {
        return "standalone";
    } else if (G_IS_BROWSER) {
        return "browser";
    } else if (G_IS_MOBILE_APP && isAndroid()) {
        return "android";
    } else if (G_IS_MOBILE_APP && isIos()) {
        return "ios";
    }
    return "unknown";
}

/**
 * Returns the IPC renderer, or null if not within the standalone
 * @returns {object|null}
 */
let ipcRenderer = null;
export function getIPCRenderer() {
    if (!G_IS_STANDALONE) {
        return null;
    }
    if (!ipcRenderer) {
        ipcRenderer = eval("require")("electron").ipcRenderer;
    }
    return ipcRenderer;
}

/**
 * Makes a new 2D array with undefined contents
 * @param {number} w
 * @param {number} h
 * @returns {Array<Array<any>>}
 */
export function make2DUndefinedArray(w, h) {
    const result = new Array(w);
    for (let x = 0; x < w; ++x) {
        result[x] = new Array(h);
    }
    return result;
}

/**
 * Creates a new map (an empty object without any props)
 */
export function newEmptyMap() {
    return Object.create(null);
}

/**
 * Returns a random integer in the range [start,end]
 * @param {number} start
 * @param {number} end
 */
export function randomInt(start, end) {
    return start + Math.round(Math.random() * (end - start));
}

/**
 * Access an object in a very annoying way, used for obsfuscation.
 * @param {any} obj
 * @param {Array<string>} keys
 */
export function accessNestedPropertyReverse(obj, keys) {
    let result = obj;
    for (let i = keys.length - 1; i >= 0; --i) {
        result = result[keys[i]];
    }
    return result;
}

/**
 * Chooses a random entry of an array
 * @template T
 * @param {T[]} arr
 * @returns {T}
 */
export function randomChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Deletes from an array by swapping with the last element
 * @param {Array<any>} array
 * @param {number} index
 */
export function fastArrayDelete(array, index) {
    if (index < 0 || index >= array.length) {
        throw new Error("Out of bounds");
    }
    // When the element is not the last element
    if (index !== array.length - 1) {
        // Get the last element, and swap it with the one we want to delete
        const last = array[array.length - 1];
        array[index] = last;
    }

    // Finally remove the last element
    array.length -= 1;
}

/**
 * Deletes from an array by swapping with the last element. Searches
 * for the value in the array first
 * @param {Array<any>} array
 * @param {any} value
 */
export function fastArrayDeleteValue(array, value) {
    if (array == null) {
        throw new Error("Tried to delete from non array!");
    }
    const index = array.indexOf(value);
    if (index < 0) {
        console.error("Value", value, "not contained in array:", array, "!");
        return value;
    }
    return fastArrayDelete(array, index);
}

/**
 * @see fastArrayDeleteValue
 * @param {Array<any>} array
 * @param {any} value
 */
export function fastArrayDeleteValueIfContained(array, value) {
    if (array == null) {
        throw new Error("Tried to delete from non array!");
    }
    const index = array.indexOf(value);
    if (index < 0) {
        return value;
    }
    return fastArrayDelete(array, index);
}

/**
 * Deletes from an array at the given index
 * @param {Array<any>} array
 * @param {number} index
 */
export function arrayDelete(array, index) {
    if (index < 0 || index >= array.length) {
        throw new Error("Out of bounds");
    }
    array.splice(index, 1);
}

/**
 * Deletes the given value from an array
 * @param {Array<any>} array
 * @param {any} value
 */
export function arrayDeleteValue(array, value) {
    if (array == null) {
        throw new Error("Tried to delete from non array!");
    }
    const index = array.indexOf(value);
    if (index < 0) {
        console.error("Value", value, "not contained in array:", array, "!");
        return value;
    }
    return arrayDelete(array, index);
}

/**
 * Compare two floats for epsilon equality
 * @param {number} a
 * @param {number} b
 * @returns {boolean}
 */
export function epsilonCompare(a, b, epsilon = 1e-5) {
    return Math.abs(a - b) < epsilon;
}

/**
 * Interpolates two numbers
 * @param {number} a
 * @param {number} b
 * @param {number} x Mix factor, 0 means 100% a, 1 means 100%b, rest is interpolated
 */
export function lerp(a, b, x) {
    return a * (1 - x) + b * x;
}

/**
 * Finds a value which is nice to display, e.g. 15669 -> 15000. Also handles fractional stuff
 * @param {number} num
 */
export function findNiceValue(num) {
    if (num > 1e8) {
        return num;
    }
    if (num < 0.00001) {
        return 0;
    }

    let roundAmount = 1;
    if (num > 50000) {
        roundAmount = 10000;
    } else if (num > 20000) {
        roundAmount = 5000;
    } else if (num > 5000) {
        roundAmount = 1000;
    } else if (num > 2000) {
        roundAmount = 500;
    } else if (num > 1000) {
        roundAmount = 100;
    } else if (num > 100) {
        roundAmount = 20;
    } else if (num > 20) {
        roundAmount = 5;
    }

    const niceValue = Math.floor(num / roundAmount) * roundAmount;
    if (num >= 10) {
        return Math.round(niceValue);
    }
    if (num >= 1) {
        return Math.round(niceValue * 10) / 10;
    }

    return Math.round(niceValue * 100) / 100;
}

/**
 * Finds a nice integer value
 * @see findNiceValue
 * @param {number} num
 */
export function findNiceIntegerValue(num) {
    return Math.ceil(findNiceValue(num));
}

/**
 * Formats a big number
 * @param {number} num
 * @param {string=} separator The decimal separator for numbers like 50.1 (separator='.')
 * @returns {string}
 */
export function formatBigNumber(num, separator = T.global.decimalSeparator) {
    const sign = num < 0 ? "-" : "";
    num = Math.abs(num);

    if (num > 1e54) {
        return sign + T.global.infinite;
    }

    if (num < 10 && !Number.isInteger(num)) {
        return sign + num.toFixed(2);
    }
    if (num < 50 && !Number.isInteger(num)) {
        return sign + num.toFixed(1);
    }
    num = Math.floor(num);

    if (num < 1000) {
        return sign + "" + num;
    } else {
        let leadingDigits = num;
        let suffix = "";
        for (let suffixIndex = 0; suffixIndex < bigNumberSuffixTranslationKeys.length; ++suffixIndex) {
            leadingDigits = leadingDigits / 1000;
            suffix = T.global.suffix[bigNumberSuffixTranslationKeys[suffixIndex]];
            if (leadingDigits < 1000) {
                break;
            }
        }
        const leadingDigitsRounded = round1Digit(leadingDigits);
        const leadingDigitsNoTrailingDecimal = leadingDigitsRounded
            .toString()
            .replace(".0", "")
            .replace(".", separator);
        return sign + leadingDigitsNoTrailingDecimal + suffix;
    }
}

/**
 * Formats a big number, but does not add any suffix and instead uses its full representation
 * @param {number} num
 * @param {string=} divider The divider for numbers like 50,000 (divider=',')
 * @returns {string}
 */
export function formatBigNumberFull(num, divider = T.global.thousandsDivider) {
    if (num < 1000) {
        return num + "";
    }
    if (num > 1e54) {
        return T.global.infinite;
    }
    let rest = num;
    let out = "";
    while (rest >= 1000) {
        out = (rest % 1000).toString().padStart(3, "0") + divider + out;
        rest = Math.floor(rest / 1000);
    }
    out = rest + divider + out;

    return out.substring(0, out.length - 1);
}

/**
 * Waits two frames so the ui is updated
 * @returns {Promise<void>}
 */
export function waitNextFrame() {
    return new Promise(function (resolve) {
        window.requestAnimationFrame(function () {
            window.requestAnimationFrame(function () {
                resolve();
            });
        });
    });
}

/**
 * Rounds 1 digit
 * @param {number} n
 * @returns {number}
 */
export function round1Digit(n) {
    return Math.floor(n * 10.0) / 10.0;
}

/**
 * Rounds 2 digits
 * @param {number} n
 * @returns {number}
 */
export function round2Digits(n) {
    return Math.floor(n * 100.0) / 100.0;
}

/**
 * Rounds 3 digits
 * @param {number} n
 * @returns {number}
 */
export function round3Digits(n) {
    return Math.floor(n * 1000.0) / 1000.0;
}

/**
 * Rounds 4 digits
 * @param {number} n
 * @returns {number}
 */
export function round4Digits(n) {
    return Math.floor(n * 10000.0) / 10000.0;
}

/**
 * Clamps a value between [min, max]
 * @param {number} v
 * @param {number=} minimum Default 0
 * @param {number=} maximum Default 1
 */
export function clamp(v, minimum = 0, maximum = 1) {
    return Math.max(minimum, Math.min(maximum, v));
}

/**
 * Helper method to create a new div element
 * @param {string=} id
 * @param {Array<string>=} classes
 * @param {string=} innerHTML
 */
function makeDivElement(id = null, classes = [], innerHTML = "") {
    const div = document.createElement("div");
    if (id) {
        div.id = id;
    }
    for (let i = 0; i < classes.length; ++i) {
        div.classList.add(classes[i]);
    }
    div.innerHTML = innerHTML;
    return div;
}

/**
 * Helper method to create a new div
 * @param {Element} parent
 * @param {string=} id
 * @param {Array<string>=} classes
 * @param {string=} innerHTML
 */
export function makeDiv(parent, id = null, classes = [], innerHTML = "") {
    const div = makeDivElement(id, classes, innerHTML);
    parent.appendChild(div);
    return div;
}

/**
 * Helper method to create a new button element
 * @param {Array<string>=} classes
 * @param {string=} innerHTML
 */
export function makeButtonElement(classes = [], innerHTML = "") {
    const element = document.createElement("button");
    for (let i = 0; i < classes.length; ++i) {
        element.classList.add(classes[i]);
    }
    element.classList.add("styledButton");
    element.innerHTML = innerHTML;
    return element;
}

/**
 * Helper method to create a new button
 * @param {Element} parent
 * @param {Array<string>=} classes
 * @param {string=} innerHTML
 */
export function makeButton(parent, classes = [], innerHTML = "") {
    const element = makeButtonElement(classes, innerHTML);
    parent.appendChild(element);
    return element;
}

/**
 * Removes all children of the given element
 * @param {Element} elem
 */
export function removeAllChildren(elem) {
    if (elem) {
        var range = document.createRange();
        range.selectNodeContents(elem);
        range.deleteContents();
    }
}

/**
 * Returns if the game supports this browser
 */
export function isSupportedBrowser() {
    // please note,
    // that IE11 now returns undefined again for window.chrome
    // and new Opera 30 outputs true for window.chrome
    // but needs to check if window.opr is not undefined
    // and new IE Edge outputs to true now for window.chrome
    // and if not iOS Chrome check
    // so use the below updated condition

    if (G_IS_MOBILE_APP || G_IS_STANDALONE) {
        return true;
    }

    // @ts-ignore
    var isChromium = window.chrome;
    var winNav = window.navigator;
    var vendorName = winNav.vendor;
    // @ts-ignore
    var isIEedge = winNav.userAgent.indexOf("Edge") > -1;
    var isIOSChrome = winNav.userAgent.match("CriOS");

    if (isIOSChrome) {
        // is Google Chrome on IOS
        return false;
    } else if (
        isChromium !== null &&
        typeof isChromium !== "undefined" &&
        vendorName === "Google Inc." &&
        isIEedge === false
    ) {
        // is Google Chrome
        return true;
    } else {
        // not Google Chrome
        return false;
    }
}

/**
 * Formats an amount of seconds into something like "5s ago"
 * @param {number} secs Seconds
 * @returns {string}
 */
export function formatSecondsToTimeAgo(secs) {
    const seconds = Math.floor(secs);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) {
        if (seconds === 1) {
            return T.global.time.oneSecondAgo;
        }
        return T.global.time.xSecondsAgo.replace("<x>", "" + seconds);
    } else if (minutes < 60) {
        if (minutes === 1) {
            return T.global.time.oneMinuteAgo;
        }
        return T.global.time.xMinutesAgo.replace("<x>", "" + minutes);
    } else if (hours < 24) {
        if (hours === 1) {
            return T.global.time.oneHourAgo;
        }
        return T.global.time.xHoursAgo.replace("<x>", "" + hours);
    } else {
        if (days === 1) {
            return T.global.time.oneDayAgo;
        }
        return T.global.time.xDaysAgo.replace("<x>", "" + days);
    }
}

/**
 * Formats seconds into a readable string like "5h 23m"
 * @param {number} secs Seconds
 * @returns {string}
 */
export function formatSeconds(secs) {
    const trans = T.global.time;
    secs = Math.ceil(secs);
    if (secs < 60) {
        return trans.secondsShort.replace("<seconds>", "" + secs);
    } else if (secs < 60 * 60) {
        const minutes = Math.floor(secs / 60);
        const seconds = secs % 60;
        return trans.minutesAndSecondsShort
            .replace("<seconds>", "" + seconds)
            .replace("<minutes>", "" + minutes);
    } else {
        const hours = Math.floor(secs / 3600);
        const minutes = Math.floor(secs / 60) % 60;
        return trans.hoursAndMinutesShort.replace("<minutes>", "" + minutes).replace("<hours>", "" + hours);
    }
}

/**
 * Formats a number like 2.51 to "2.5"
 * @param {number} speed
 * @param {string=} separator The decimal separator for numbers like 50.1 (separator='.')
 */
export function round1DigitLocalized(speed, separator = T.global.decimalSeparator) {
    return round1Digit(speed).toString().replace(".", separator);
}

/**
 * Formats a number like 2.51 to "2.51 items / s"
 * @param {number} speed
 * @param {boolean=} double
 * @param {string=} separator The decimal separator for numbers like 50.1 (separator='.')
 */
export function formatItemsPerSecond(speed, double = false, separator = T.global.decimalSeparator) {
    return (
        (speed === 1.0
            ? T.ingame.buildingPlacement.infoTexts.oneItemPerSecond
            : T.ingame.buildingPlacement.infoTexts.itemsPerSecond.replace(
                  "<x>",
                  round2Digits(speed).toString().replace(".", separator)
              )) + (double ? "  " + T.ingame.buildingPlacement.infoTexts.itemsPerSecondDouble : "")
    );
}

/**
 * Rotates a flat 3x3 matrix clockwise
 * Entries:
 * 0 lo
 * 1 mo
 * 2 ro
 * 3 lm
 * 4 mm
 * 5 rm
 * 6 lu
 * 7 mu
 * 8 ru
 * @param {Array<number>} flatMatrix
 */

export function rotateFlatMatrix3x3(flatMatrix) {
    return [
        flatMatrix[6],
        flatMatrix[3],
        flatMatrix[0],
        flatMatrix[7],
        flatMatrix[4],
        flatMatrix[1],
        flatMatrix[8],
        flatMatrix[5],
        flatMatrix[2],
    ];
}

/**
 * Generates rotated variants of the matrix
 * @param {Array<number>} originalMatrix
 * @returns {Object<number, Array<number>>}
 */
export function generateMatrixRotations(originalMatrix) {
    const result = {
        0: originalMatrix,
    };

    originalMatrix = rotateFlatMatrix3x3(originalMatrix);
    result[90] = originalMatrix;

    originalMatrix = rotateFlatMatrix3x3(originalMatrix);
    result[180] = originalMatrix;

    originalMatrix = rotateFlatMatrix3x3(originalMatrix);
    result[270] = originalMatrix;

    return result;
}

/**
 *
 * @typedef {{
 *   top: any,
 *   right: any,
 *   bottom: any,
 *   left: any
 * }} DirectionalObject
 */

/**
 * Rotates a directional object
 * @param {DirectionalObject} obj
 * @returns {DirectionalObject}
 */
export function rotateDirectionalObject(obj, rotation) {
    const queue = [obj.top, obj.right, obj.bottom, obj.left];
    while (rotation !== 0) {
        rotation -= 90;
        queue.push(queue.shift());
    }

    return {
        top: queue[0],
        right: queue[1],
        bottom: queue[2],
        left: queue[3],
    };
}

/**
 * Modulo which works for negative numbers
 * @param {number} n
 * @param {number} m
 */
export function safeModulo(n, m) {
    return ((n % m) + m) % m;
}

/**
 * Returns a smooth pulse between 0 and 1
 * @param {number} time time in seconds
 * @returns {number}
 */
export function smoothPulse(time) {
    return Math.sin(time * 4) * 0.5 + 0.5;
}

let logIntervals = {};
const intervalStyle = "color: grey; font-style: inherit";
const keyStyle = "color: purple; font-style: italic";
const revertStyle = "color: inherit; font-style: inherit";

export function logInterval(key, frames, message, ...args) {
    let interval = logIntervals[key] || 0;
    if (++interval > frames) {
        console.log(
            `%clogInterval [%c${key}%c]: \t%c` + message,
            intervalStyle,
            keyStyle,
            intervalStyle,
            revertStyle,
            ...args
        );
        interval = 0;
    }
    logIntervals[key] = interval;
}

export function dirInterval(key, frames, object, premessage, ...args) {
    let interval = logIntervals[key] || 0;
    if (++interval > frames) {
        console.log(
            `%cdirInterval [%c${key}%c]: \t%c` + (premessage || ""),
            intervalStyle,
            keyStyle,
            intervalStyle,
            revertStyle,
            ...args
        );
        console.dir(object);
        interval = 0;
    }
    logIntervals[key] = interval;
}

/**
 * Fills in a <link> tag
 * @param {string} translation
 * @param {string} link
 */
export function fillInLinkIntoTranslation(translation, link) {
    return translation
        .replace("<link>", "<a href='" + link + "' target='_blank'>")
        .replace("</link>", "</a>");
}

/**
 * Generates a file download
 * @param {string} filename
 * @param {string} text
 */
export function generateFileDownload(filename, text) {
    var element = document.createElement("a");
    element.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(text));
    element.setAttribute("download", filename);

    element.style.display = "none";
    document.body.appendChild(element);

    element.click();
    document.body.removeChild(element);
}

/**
 * Starts a file chooser
 * @param {string} acceptedType
 */
export function startFileChoose(acceptedType = ".bin") {
    var input = document.createElement("input");
    input.type = "file";
    input.accept = acceptedType;

    return new Promise(resolve => {
        input.onchange = _ => resolve(input.files[0]);
        input.click();
    });
}

const MAX_ROMAN_NUMBER = 49;
const romanLiteralsCache = ["0"];

/**
 *
 * @param {number} number
 * @returns {string}
 */
export function getRomanNumber(number) {
    number = Math.max(0, Math.round(number));
    if (romanLiteralsCache[number]) {
        return romanLiteralsCache[number];
    }

    if (number > MAX_ROMAN_NUMBER) {
        return String(number);
    }

    function formatDigit(digit, unit, quintuple, decuple) {
        switch (digit) {
            case 0:
                return "";
            case 1: // I
                return unit;
            case 2: // II
                return unit + unit;
            case 3: // III
                return unit + unit + unit;
            case 4: // IV
                return unit + quintuple;
            case 9: // IX
                return unit + decuple;
            default:
                // V, VI, VII, VIII
                return quintuple + formatDigit(digit - 5, unit, quintuple, decuple);
        }
    }

    let thousands = Math.floor(number / 1000);
    let thousandsPart = "";
    while (thousands > 0) {
        thousandsPart += "M";
        thousands -= 1;
    }

    const hundreds = Math.floor((number % 1000) / 100);
    const hundredsPart = formatDigit(hundreds, "C", "D", "M");

    const tens = Math.floor((number % 100) / 10);
    const tensPart = formatDigit(tens, "X", "L", "C");

    const units = number % 10;
    const unitsPart = formatDigit(units, "I", "V", "X");

    const formatted = thousandsPart + hundredsPart + tensPart + unitsPart;

    romanLiteralsCache[number] = formatted;
    return formatted;
}
