// @ts-nocheck
import { createLogger } from "./logging";

/**
 * Logger for assert function
 */
const logger = createLogger("assert");

/**
 * Is assertion error shown
 */
let assertionErrorShown = false;

/**
 * Adds the assert function to the window
 */
function initAssert() {
    /**
     * Expects a given condition to be true
     * @param {Boolean} condition
     * @param  {...String} failureMessage
     */
    window.assert = function (condition, ...failureMessage) {
        if (!condition) {
            logger.error("assertion failed:", ...failureMessage);
            if (!assertionErrorShown) {
                // alert("Assertion failed (the game will try to continue to run): \n\n" + failureMessage);
                assertionErrorShown = true;
            }
            throw new Error("AssertionError: " + failureMessage.join(" "));
        }
    };
}

initAssert();
