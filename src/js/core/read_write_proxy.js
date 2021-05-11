/* typehints:start */
import { Application } from "../application";
/* typehints:end */

import { sha1, CRC_PREFIX, computeCrc } from "./sensitive_utils.encrypt";
import { createLogger } from "./logging";
import { FILE_NOT_FOUND } from "../platform/storage";
import { accessNestedPropertyReverse } from "./utils";
import { IS_DEBUG, globalConfig } from "./config";
import { ExplainedResult } from "./explained_result";
import { decompressX64, compressX64 } from "./lzstring";
import { asyncCompressor, compressionPrefix } from "./async_compression";
import { compressObject, decompressObject } from "../savegame/savegame_compressor";
import { savegameInterfaces } from "../savegame/savegame_interface_registry";

const debounce = require("debounce-promise");

const logger = createLogger("read_write_proxy");

const salt = accessNestedPropertyReverse(globalConfig, ["file", "info"]);

// Helper which only writes / reads if verify() works. Also performs migration
export class ReadWriteProxy {
    constructor(app, filename) {
        /** @type {Application} */
        this.app = app;

        this.filename = filename;

        /** @type {object} */
        this.currentData = null;

        // TODO: EXTREMELY HACKY! To verify we need to do this a step later
        if (G_IS_DEV && IS_DEBUG) {
            setTimeout(() => {
                assert(
                    this.verify(this.getDefaultData()).result,
                    "Verify() failed for default data: " + this.verify(this.getDefaultData()).reason
                );
            });
        }

        /**
         * Store a debounced handler to prevent double writes
         */
        this.debouncedWrite = debounce(this.doWriteAsync.bind(this), 50);
    }

    // -- Methods to override

    /** @returns {ExplainedResult} */
    verify(data) {
        abstract;
        return ExplainedResult.bad();
    }

    // Should return the default data
    getDefaultData() {
        abstract;
        return {};
    }

    // Should return the current version as an integer
    getCurrentVersion() {
        abstract;
        return 0;
    }

    // Should migrate the data (Modify in place)
    /** @returns {ExplainedResult} */
    migrate(data) {
        abstract;
        return ExplainedResult.bad();
    }

    // -- / Methods

    // Resets whole data, returns promise
    resetEverythingAsync() {
        logger.warn("Reset data to default");
        this.currentData = this.getDefaultData();
        return this.writeAsync();
    }

    /**
     *
     * @param {object} obj
     */
    static serializeObject(obj) {
        const jsonString = JSON.stringify(compressObject(obj));
        const checksum = computeCrc(jsonString + salt);
        return compressionPrefix + compressX64(checksum + jsonString);
    }

    /**
     *
     * @param {object} text
     */
    static deserializeObject(text) {
        const decompressed = decompressX64(text.substr(compressionPrefix.length));
        if (!decompressed) {
            // LZ string decompression failure
            throw new Error("bad-content / decompression-failed");
        }
        if (decompressed.length < 40) {
            // String too short
            throw new Error("bad-content / payload-too-small");
        }

        // Compare stored checksum with actual checksum
        const checksum = decompressed.substring(0, 40);
        const jsonString = decompressed.substr(40);

        const desiredChecksum = checksum.startsWith(CRC_PREFIX)
            ? computeCrc(jsonString + salt)
            : sha1(jsonString + salt);

        if (desiredChecksum !== checksum) {
            // Checksum mismatch
            throw new Error("bad-content / checksum-mismatch");
        }

        const parsed = JSON.parse(jsonString);
        const decoded = decompressObject(parsed);
        return decoded;
    }

    /**
     * Writes the data asychronously, fails if verify() fails.
     * Debounces the operation by up to 50ms
     * @returns {Promise<void>}
     */
    writeAsync() {
        const verifyResult = this.internalVerifyEntry(this.currentData);

        if (!verifyResult.result) {
            logger.error("Tried to write invalid data to", this.filename, "reason:", verifyResult.reason);
            return Promise.reject(verifyResult.reason);
        }

        return this.debouncedWrite();
    }

    /**
     * Actually writes the data asychronously
     * @returns {Promise<void>}
     */
    doWriteAsync() {
        return asyncCompressor
            .compressObjectAsync(this.currentData)
            .then(compressed => {
                return this.app.storage.writeFileAsync(this.filename, compressed);
            })
            .then(() => {
                logger.log("📄 Wrote", this.filename);
            })
            .catch(err => {
                logger.error("Failed to write", this.filename, ":", err);
                throw err;
            });
    }

    // Reads the data asynchronously, fails if verify() fails
    readAsync() {
        // Start read request
        return (
            this.app.storage
                .readFileAsync(this.filename)

                // Check for errors during read
                .catch(err => {
                    if (err === FILE_NOT_FOUND) {
                        logger.log("File not found, using default data");

                        // File not found or unreadable, assume default file
                        return Promise.resolve(null);
                    }

                    return Promise.reject("file-error: " + err);
                })

                // Decrypt data (if its encrypted)
                // @ts-ignore
                .then(rawData => {
                    if (rawData == null) {
                        // So, the file has not been found, use default data
                        return JSON.stringify(compressObject(this.getDefaultData()));
                    }

                    if (rawData.startsWith(compressionPrefix)) {
                        const decompressed = decompressX64(rawData.substr(compressionPrefix.length));
                        if (!decompressed) {
                            // LZ string decompression failure
                            return Promise.reject("bad-content / decompression-failed");
                        }
                        if (decompressed.length < 40) {
                            // String too short
                            return Promise.reject("bad-content / payload-too-small");
                        }

                        // Compare stored checksum with actual checksum
                        const checksum = decompressed.substring(0, 40);
                        const jsonString = decompressed.substr(40);

                        const desiredChecksum = checksum.startsWith(CRC_PREFIX)
                            ? computeCrc(jsonString + salt)
                            : sha1(jsonString + salt);

                        if (desiredChecksum !== checksum) {
                            // Checksum mismatch
                            return Promise.reject(
                                "bad-content / checksum-mismatch: " + desiredChecksum + " vs " + checksum
                            );
                        }
                        return jsonString;
                    } else {
                        if (!G_IS_DEV) {
                            return Promise.reject("bad-content / missing-compression");
                        }
                    }
                    return rawData;
                })

                // Parse JSON, this could throw but that's fine
                .then(res => {
                    try {
                        return JSON.parse(res);
                    } catch (ex) {
                        logger.error(
                            "Failed to parse file content of",
                            this.filename,
                            ":",
                            ex,
                            "(content was:",
                            res,
                            ")"
                        );
                        throw new Error("invalid-serialized-data");
                    }
                })

                // Decompress
                .then(compressed => decompressObject(compressed))

                // Verify basic structure
                .then(contents => {
                    const result = this.internalVerifyBasicStructure(contents);
                    if (!result.isGood()) {
                        return Promise.reject("verify-failed: " + result.reason);
                    }
                    return contents;
                })

                // Check version and migrate if required
                .then(contents => {
                    if (contents.version > this.getCurrentVersion()) {
                        return Promise.reject("stored-data-is-newer");
                    }

                    if (contents.version < this.getCurrentVersion()) {
                        logger.log(
                            "Trying to migrate data object from version",
                            contents.version,
                            "to",
                            this.getCurrentVersion()
                        );
                        const migrationResult = this.migrate(contents); // modify in place
                        if (migrationResult.isBad()) {
                            return Promise.reject("migration-failed: " + migrationResult.reason);
                        }
                    }
                    return contents;
                })

                // Verify
                .then(contents => {
                    const verifyResult = this.internalVerifyEntry(contents);
                    if (!verifyResult.result) {
                        logger.error(
                            "Read invalid data from",
                            this.filename,
                            "reason:",
                            verifyResult.reason,
                            "contents:",
                            contents
                        );
                        return Promise.reject("invalid-data: " + verifyResult.reason);
                    }
                    return contents;
                })

                // Store
                .then(contents => {
                    this.currentData = contents;
                    logger.log("📄 Read data with version", this.currentData.version, "from", this.filename);
                    return contents;
                })

                // Catchall
                .catch(err => {
                    return Promise.reject("Failed to read " + this.filename + ": " + err);
                })
        );
    }

    /**
     * Deletes the file
     * @returns {Promise<void>}
     */
    deleteAsync() {
        return this.app.storage.deleteFileAsync(this.filename);
    }

    // Internal

    /** @returns {ExplainedResult} */
    internalVerifyBasicStructure(data) {
        if (!data) {
            return ExplainedResult.bad("Data is empty");
        }
        if (!savegameInterfaces[data.version] && data.version !== this.getCurrentVersion()) {
            return ExplainedResult.bad(
                `Data has invalid version: ${data.version} (expected ${this.getCurrentVersion()})`
            );
        }

        return ExplainedResult.good();
    }

    /** @returns {ExplainedResult} */
    internalVerifyEntry(data) {
        if (data.version !== this.getCurrentVersion()) {
            return ExplainedResult.bad(
                "Version mismatch, got " + data.version + " and expected " + this.getCurrentVersion()
            );
        }

        const verifyStructureError = this.internalVerifyBasicStructure(data);
        if (!verifyStructureError.isGood()) {
            return verifyStructureError;
        }
        return this.verify(data);
    }
}
