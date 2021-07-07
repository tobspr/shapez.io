/**
 * @returns {Promise<string>}
 */
export async function paste() {
    /* TODO: Add fallback method */
    return navigator.clipboard.readText();
}
