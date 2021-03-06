const { join, resolve } = require("path");
const { readFileSync, readdirSync, writeFileSync } = require("fs");

const suffixToScale = {
    lq: "0.25",
    mq: "0.5",
    hq: "0.75",
};

function convert(srcDir) {
    const full = resolve(srcDir);
    const srcFiles = readdirSync(full)
        .filter(n => n.endsWith(".atlas"))
        .map(n => join(full, n));

    for (const atlas of srcFiles) {
        console.log(`Processing: ${atlas}`);

        // Read all text, split it into line array
        // and filter all empty lines
        const lines = readFileSync(atlas, "utf-8")
            .split("\n")
            .filter(n => n.trim());

        // Get source image name
        const image = lines.shift();
        const srcMeta = {};

        // Read all metadata (supports only one page)
        while (true) {
            const kv = lines.shift().split(":");
            if (kv.length != 2) {
                lines.unshift(kv[0]);
                break;
            }

            srcMeta[kv[0]] = kv[1].trim();
        }

        const frames = {};
        let current = null;

        lines.push("Dummy line to make it convert last frame");

        for (const line of lines) {
            if (!line.startsWith("  ")) {
                // New frame, convert previous if it exists
                if (current != null) {
                    let { name, rotate, xy, size, orig, offset, index } = current;

                    // Convert to arrays because Node.js doesn't
                    // support latest JS features
                    xy = xy.split(",").map(v => Number(v));
                    size = size.split(",").map(v => Number(v));
                    orig = orig.split(",").map(v => Number(v));
                    offset = offset.split(",").map(v => Number(v));

                    // GDX TexturePacker removes index suffixes
                    const indexSuff = index != -1 ? `_${index}` : "";
                    const isTrimmed = size != orig;

                    frames[`${name}${indexSuff}.png`] = {
                        // Bounds on atlas
                        frame: {
                            x: xy[0],
                            y: xy[1],
                            w: size[0],
                            h: size[1],
                        },

                        // Whether image was rotated
                        rotated: rotate == "true",
                        trimmed: isTrimmed,

                        // How is the image trimmed
                        spriteSourceSize: {
                            x: offset[0],
                            y: orig[1] - size[1] - offset[1],
                            w: size[0],
                            h: size[1],
                        },

                        sourceSize: {
                            w: orig[0],
                            h: orig[1],
                        },
                    };
                }

                // Simple object that will hold other metadata
                current = {
                    name: line,
                };
            } else {
                // Read and set current image metadata
                const kv = line.split(":").map(v => v.trim());
                current[kv[0]] = isNaN(Number(kv[1])) ? kv[1] : Number(kv[1]);
            }
        }

        const atlasSize = srcMeta.size.split(",").map(v => Number(v));
        const atlasScale = suffixToScale[atlas.match(/_(\w+)\.atlas$/)[1]];

        const result = JSON.stringify({
            frames,
            meta: {
                image,
                format: srcMeta.format,
                size: {
                    w: atlasSize[0],
                    h: atlasSize[1],
                },
                scale: atlasScale.toString(),
            },
        });

        writeFileSync(atlas.replace(".atlas", ".json"), result, {
            encoding: "utf-8",
        });
    }
}

if (require.main == module) {
    convert(process.argv[2]);
}

module.exports = { convert };
