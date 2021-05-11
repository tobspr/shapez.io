export function matchOverwriteRecursiveSettings(dest, src) {
    if (typeof dest !== "object" || typeof src !== "object") {
        return;
    }

    for (const key in src) {
        //console.log("copy", key);
        const data = src[key];
        if (typeof data === "object") {
            if (!dest[key]) dest[key] = {};
            matchOverwriteRecursiveSettings(dest[key], src[key]);
        } else if (typeof data === "string" || typeof data === "number" || typeof data === "boolean") {
            dest[key] = data;
        } else {
            console.log("Unknown type:", typeof data, "in key", key);
        }
    }
}
