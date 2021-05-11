export const VANILLA_THEMES = {
    dark: require("./themes/dark.json"),
    light: require("./themes/light.json"),
};

export let THEME = VANILLA_THEMES.light;

export function applyGameTheme(id) {
    THEME = shapezAPI.themes[id];
}
