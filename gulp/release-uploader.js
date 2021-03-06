const path = require("path");
const fs = require("fs");
const execSync = require("child_process").execSync;
const { Octokit } = require("@octokit/rest");
const buildutils = require("./buildutils");

function gulptasksReleaseUploader($, gulp, buildFolder) {
    const standaloneDir = path.join(__dirname, "..", "tmp_standalone_files");
    const darwinApp = path.join(standaloneDir, "shapez.io-standalone-darwin-x64", "shapez.io-standalone.app");
    const dmgName = "shapez.io-standalone.dmg";
    const dmgPath = path.join(standaloneDir, "shapez.io-standalone-darwin-x64", dmgName);

    gulp.task("standalone.uploadRelease.darwin64.cleanup", () => {
        return gulp.src(dmgPath, { read: false, allowEmpty: true }).pipe($.clean({ force: true }));
    });

    gulp.task("standalone.uploadRelease.darwin64.compress", cb => {
        console.log("Packaging disk image", dmgPath);
        execSync(`hdiutil create -format UDBZ -srcfolder ${darwinApp} ${dmgPath}`);
        cb();
    });

    gulp.task("standalone.uploadRelease.darwin64.upload", async cb => {
        const currentTag = buildutils.getTag();

        const octokit = new Octokit({
            auth: process.env.SHAPEZ_CLI_GITHUB_TOKEN,
        });

        const createdRelease = await octokit.request("POST /repos/{owner}/{repo}/releases", {
            owner: process.env.SHAPEZ_CLI_GITHUB_USER,
            repo: "shapez.io",
            tag_name: currentTag,
            name: currentTag,
            draft: true,
        });

        const {
            data: { id, upload_url },
        } = createdRelease;
        console.log(`Created release ${id} for tag ${currentTag}`);

        const dmgContents = fs.readFileSync(dmgPath);
        const dmgSize = fs.statSync(dmgPath).size;
        console.log("Uploading", dmgContents.length / 1024 / 1024, "MB to", upload_url);

        await octokit.request({
            method: "POST",
            url: upload_url,
            headers: {
                "content-type": "application/x-apple-diskimage",
            },
            name: dmgName,
            data: dmgContents,
        });

        cb();
    });

    gulp.task(
        "standalone.uploadRelease.darwin64",
        gulp.series(
            "standalone.uploadRelease.darwin64.cleanup",
            "standalone.uploadRelease.darwin64.compress",
            "standalone.uploadRelease.darwin64.upload"
        )
    );
}

module.exports = { gulptasksReleaseUploader };
