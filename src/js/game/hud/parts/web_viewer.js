import { InputReceiver } from "../../../core/input_receiver";
import { makeDiv } from "../../../core/utils";
import { KeyActionMapper, KEYMAPPINGS } from "../../key_action_mapper";
import { BaseHUDPart } from "../base_hud_part";
import { DynamicDomAttach } from "../dynamic_dom_attach";

export class HUDWebViewer extends BaseHUDPart {
    createElements(parent) {
        this.background = makeDiv(parent, "ingame_HUD_Web", ["ingameDialog"]);

        // DIALOG Inner / Wrapper
        this.dialogInner = makeDiv(this.background, null, ["dialogInner"]);
        this.title = makeDiv(this.dialogInner, null, ["title"], "Empty Web");
        this.closeButton = makeDiv(this.title, null, ["closeButton"]);
        this.trackClicks(this.closeButton, this.close);

        this.contentDiv = makeDiv(this.dialogInner, null, ["content"]);
    }

    initialize() {
        this.domAttach = new DynamicDomAttach(this.root, this.background, {
            attachClass: "visible",
        });

        this.inputReciever = new InputReceiver("web_viewer");
        this.keyActionMapper = new KeyActionMapper(this.root, this.inputReciever);

        this.keyActionMapper.getBinding(KEYMAPPINGS.general.back).add(this.close, this);
        this.keyActionMapper.getBinding(KEYMAPPINGS.ingame.menuClose).add(this.close, this);

        this.root.keyMapper.getBinding(KEYMAPPINGS.ingame.shapeViewer).add(this.openViewer, this);

        this.close();
    }

    show(url, title = null) {
        this.visible = true;
        this.root.app.inputMgr.makeSureAttachedAndOnTop(this.inputReciever);
        this.url = url;

        let ifrm = document.createElement("iframe");
        ifrm.setAttribute("id", "ingame_HUD_web_iframe");
        ifrm.setAttribute("src", this.url);
        if (!title) {
            let urlTag = document.createElement("a");
            urlTag.href = this.url;
            title = urlTag.hostname;
        }
        this.title.innerText = title;
        this.closeButton = makeDiv(this.title, null, ["closeButton"]);
        this.trackClicks(this.closeButton, this.close);

        this.contentDiv.innerHTML = "";
        this.contentDiv.appendChild(ifrm);
    }

    openViewer() {
        this.show("https://viewer.shapez.io/", "Shapes Generator");
    }

    close() {
        this.visible = false;
        this.root.app.inputMgr.makeSureDetached(this.inputReciever);
        this.update();
    }

    update() {
        this.domAttach.update(this.visible);
    }

    isBlockingOverlay() {
        return this.visible;
    }
}
