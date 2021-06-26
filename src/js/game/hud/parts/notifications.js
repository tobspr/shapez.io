import { makeDiv } from "../../../core/utils";
import { T } from "../../../translations";
import { BaseHUDPart } from "../base_hud_part";

function makeDivElement(id = null, classes = [], innerHTML = "") {
    const div = document.createElement("div");
    if (id) {
        div.id = id;
    }
    for (let i = 0; i < classes.length; ++i) {
        div.classList.add(classes[i]);
    }
    div.innerHTML = innerHTML;
    return div;
}

function makeDivAfter(sibling, id = null, classes = [], innerHTML = "") {
    const div = makeDivElement(id, classes, innerHTML);
    if (sibling.nextElementSibling) sibling.parentNode.insertBefore(div, sibling.nextElementSibling);
    else sibling.parentNode.appendChild(div);
    return div;
}

/** @enum {string} */
export const enumNotificationType = {
    saved: "saved",
    upgrade: "upgrade",
    success: "success",
};

const notificationDuration = 3;

export class HUDNotifications extends BaseHUDPart {
    createElements(parent) {
        this.element = makeDiv(parent, "ingame_HUD_Notifications", [], ``);

        this.hoverElement = makeDiv(this.element, "notificationHover");
        this.hoverElement.style.minHeight = "0";
        this.hoverElement.style.padding = "0";
        this.hoverElement.style.margin = "0";

        this.paddingElement = makeDiv(this.element, "notificationPadding");
    }

    initialize() {
        this.root.hud.signals.notification.add(this.onNotification, this);

        /** @type {Array<{ element: HTMLElement, expireAt: number}>} */
        this.notificationElements = [];

        this.visibleNotificationElements = [];

        // Automatic notifications
        this.root.signals.gameSaved.add(() =>
            this.onNotification(T.ingame.notifications.gameSaved, enumNotificationType.saved)
        );
    }

    /**
     * @param {string} message
     * @param {enumNotificationType} type
     */
    onNotification(message, type) {
        const element = makeDivAfter(this.hoverElement, null, ["notification", "type-" + type], message);
        element.setAttribute("data-icon", "icons/notification_" + type + ".png");

        const notification = {
            element,
            expireAt: this.root.time.realtimeNow() + notificationDuration,
        };

        if (this.hoverElement.hasAttribute("style")) this.hoverElement.removeAttribute("style");
        this.visibleNotificationElements.push(this.notificationElements.push(notification) - 1);
    }

    update() {
        const now = this.root.time.realtimeNow();
        for (let i = 0; i < this.visibleNotificationElements.length; ++i) {
            const handle = this.notificationElements[this.visibleNotificationElements[i]];
            if (handle.expireAt <= now) {
                this.visibleNotificationElements.splice(i, 1);
            }
        }
    }
}
