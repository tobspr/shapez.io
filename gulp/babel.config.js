module.exports = function (api) {
    api.cache(true);
    const presets = [
        [
            "@babel/preset-env",
            {
                targets: "cover 99.5%",
                useBuiltIns: "usage",
                corejs: 3,
                loose: true,
                spec: false,
                modules: "auto",
            },
        ],
    ];
    const plugins = [
        ["@babel/plugin-proposal-class-properties", { loose: true }],

        "closure-elimination",
        // var is faster than let and const!
        [
            "@babel/plugin-transform-block-scoping",
            {
                throwIfClosureRequired: false,
            },
        ],
        [
            "@babel/plugin-transform-classes",
            {
                loose: true,
            },
        ],
    ];
    return {
        presets,
        plugins,
        highlightCode: true,
        sourceType: "module",
        sourceMaps: false,
        parserOpts: {},
        only: ["../src/js"],
        generatorOpts: {
            retainLines: false,
            compact: true,
            minified: true,
            comments: true,
        },
    };
};
