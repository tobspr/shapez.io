require("colors");
const packager = require("electron-packager");
const pj = require("../electron/package.json");
const path = require("path");
const { getVersion } = require("./buildutils");
const fs = require("fs");
const fse = require("fs-extra");
const buildutils = require("./buildutils");
const execSync = require("child_process").execSync;

function gulptasksStandalone($, gulp) {
    const electronBaseDir = path.join(__dirname, "..", "electron");
    const targets = [
        {
            tempDestDir: path.join(__dirname, "..", "tmp_standalone_files"),
            suffix: "",
            taskPrefix: "",
        },
        {
            tempDestDir: path.join(__dirname, "..", "tmp_standalone_files_china"),
            suffix: "china",
            taskPrefix: "china.",
        },
    ];

    for (const { tempDestDir, suffix, taskPrefix } of targets) {
        const tempDestBuildDir = path.join(tempDestDir, "built");

        gulp.task(taskPrefix + "standalone.prepare.cleanup", () => {
            return gulp.src(tempDestDir, { read: false, allowEmpty: true }).pipe($.clean({ force: true }));
        });

        gulp.task(taskPrefix + "standalone.prepare.copyPrefab", () => {
            const requiredFiles = [
                path.join(electronBaseDir, "node_modules", "**", "*.*"),
                path.join(electronBaseDir, "node_modules", "**", ".*"),
                path.join(electronBaseDir, "steam_appid.txt"),
                path.join(electronBaseDir, "favicon*"),

                // fails on platforms which support symlinks
                // https://github.com/gulpjs/gulp/issues/1427
                // path.join(electronBaseDir, "node_modules", "**", "*"),
            ];
            return gulp.src(requiredFiles, { base: electronBaseDir }).pipe(gulp.dest(tempDestBuildDir));
        });

        gulp.task(taskPrefix + "standalone.prepare.writePackageJson", cb => {
            const packageJsonString = JSON.stringify(
                {
                    scripts: {
                        start: pj.scripts.start,
                    },
                    devDependencies: pj.devDependencies,
                    dependencies: pj.dependencies,
                    optionalDependencies: pj.optionalDependencies,
                },
                null,
                4
            );

            fs.writeFileSync(path.join(tempDestBuildDir, "package.json"), packageJsonString);

            cb();
        });

        gulp.task(taskPrefix + "standalone.prepareVDF", cb => {
            const hash = buildutils.getRevision();

            const steampipeDir = path.join(__dirname, "steampipe", "scripts");
            const templateContents = fs
                .readFileSync(path.join(steampipeDir, "app.vdf.template"), { encoding: "utf-8" })
                .toString();

            const convertedContents = templateContents.replace("$DESC$", "Commit " + hash);
            fs.writeFileSync(path.join(steampipeDir, "app.vdf"), convertedContents);

            cb();
        });

        gulp.task(taskPrefix + "standalone.prepare.minifyCode", () => {
            return gulp.src(path.join(electronBaseDir, "*.js")).pipe(gulp.dest(tempDestBuildDir));
        });

        gulp.task(taskPrefix + "standalone.prepare.copyGamefiles", () => {
            return gulp.src("../build/**/*.*", { base: "../build" }).pipe(gulp.dest(tempDestBuildDir));
        });

        gulp.task(taskPrefix + "standalone.killRunningInstances", cb => {
            try {
                execSync("taskkill /F /IM shapezio.exe");
            } catch (ex) {
                console.warn("Failed to kill running instances, maybe none are up.");
            }
            cb();
        });

        gulp.task(
            taskPrefix + "standalone.prepare",
            gulp.series(
                taskPrefix + "standalone.killRunningInstances",
                taskPrefix + "standalone.prepare.cleanup",
                taskPrefix + "standalone.prepare.copyPrefab",
                taskPrefix + "standalone.prepare.writePackageJson",
                taskPrefix + "standalone.prepare.minifyCode",
                taskPrefix + "standalone.prepare.copyGamefiles"
            )
        );

        /**
         *
         * @param {'win32'|'linux'} platform
         * @param {'x64'|'ia32'} arch
         * @param {function():void} cb
         */
        function packageStandalone(platform, arch, cb) {
            const tomlFile = fs.readFileSync(path.join(__dirname, ".itch.toml"));
            const privateArtifactsPath = "node_modules/shapez.io-private-artifacts";

            let asar;
            if (fs.existsSync(path.join(tempDestBuildDir, privateArtifactsPath))) {
                asar = { unpackDir: privateArtifactsPath };
            } else {
                asar = true;
            }

            packager({
                dir: tempDestBuildDir,
                appCopyright: "Tobias Springer",
                appVersion: getVersion(),
                buildVersion: "1.0.0",
                arch,
                platform,
                asar: asar,
                executableName: "shapezio",
                icon: path.join(electronBaseDir, "favicon"),
                name: "shapez.io-standalone" + suffix,
                out: tempDestDir,
                overwrite: true,
                appBundleId: "io.shapez.standalone",
                appCategoryType: "public.app-category.games",
                //TODO: build for macOS was removed
                // ...(platform === "darwin" && {
                //     protocols: [
                //         {
                //             name: "shapezio",
                //             schemes: ["shapezio"],
                //         },
                //     ],
                // }),
            }).then(
                appPaths => {
                    console.log("Packages created:", appPaths);
                    appPaths.forEach(appPath => {
                        if (!fs.existsSync(appPath)) {
                            console.error("Bad app path gotten:", appPath);
                            return;
                        }

                        fs.writeFileSync(
                            path.join(appPath, "LICENSE"),
                            fs.readFileSync(path.join(__dirname, "..", "LICENSE"))
                        );

                        fse.copySync(
                            path.join(tempDestBuildDir, "steam_appid.txt"),
                            path.join(appPath, "steam_appid.txt")
                        );

                        fs.writeFileSync(path.join(appPath, ".itch.toml"), tomlFile);

                        if (platform === "linux") {
                            fs.writeFileSync(
                                path.join(appPath, "play.sh"),
                                '#!/usr/bin/env bash\n./shapezio --no-sandbox "$@"\n'
                            );
                            fs.chmodSync(path.join(appPath, "play.sh"), 0o775);
                        }
                    });

                    cb();
                },
                err => {
                    console.error("Packaging error:", err);
                    cb();
                }
            );
        }

        gulp.task(taskPrefix + "standalone.package.prod.win64", cb => packageStandalone("win32", "x64", cb));
        gulp.task(taskPrefix + "standalone.package.prod.linux64", cb =>
            packageStandalone("linux", "x64", cb)
        );

        gulp.task(
            taskPrefix + "standalone.package.prod",
            gulp.series(
                taskPrefix + "standalone.prepare",
                gulp.parallel(
                    taskPrefix + "standalone.package.prod.win64",
                    taskPrefix + "standalone.package.prod.linux64"
                )
            )
        );
    }
}

module.exports = { gulptasksStandalone };
