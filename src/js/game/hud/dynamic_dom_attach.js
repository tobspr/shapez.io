import { TrackedState } from "../../core/tracked_state";
import { GameRoot } from "../root";

// Automatically attaches and detaches elements from the dom
// Also supports detaching elements after a given time, useful if there is a
// hide animation like for the tooltips

// Also attaches a class name if desired

export class DynamicDomAttach {
    /**
     *
     * @param {GameRoot} root
     * @param {HTMLElement} element
     * @param {object} param2
     * @param {number=} param2.timeToKeepSeconds How long to keep the element visible (in ms) after it should be hidden.
     *                                           Useful for fade-out effects
     * @param {string=} param2.attachClass If set, attaches a class while the element is visible
     * @param {boolean=} param2.trackHover If set, attaches the 'hovered' class if the cursor is above the element. Useful
     *                                     for fading out the element if its below the cursor for example.
     * @param {boolean=} param2.prepend If set, adds the element before other childs
     */
    constructor(
        root,
        element,
        { timeToKeepSeconds = 0, attachClass = null, trackHover = false, prepend = false } = {}
    ) {
        /** @type {GameRoot} */
        this.root = root;

        /** @type {HTMLElement} */
        this.element = element;
        this.parent = this.element.parentElement;
        assert(this.parent, "Dom attach created without parent");

        this.attachClass = attachClass;
        this.trackHover = trackHover;

        this.timeToKeepSeconds = timeToKeepSeconds;
        this.lastVisibleTime = 0;

        this.prepend = prepend;

        // We start attached, so detach the node first
        this.attached = true;
        this.internalDetach();

        this.internalIsClassAttached = false;
        this.classAttachTimeout = null;

        // Store the last bounds we computed
        /** @type {DOMRect} */
        this.lastComputedBounds = null;
        this.lastComputedBoundsTime = -1;

        // Track the 'hovered' class
        this.trackedIsHovered = new TrackedState(this.setIsHoveredClass, this);
    }

    /**
     * Internal method to attach the element
     */
    internalAttach() {
        if (!this.attached) {
            if (this.prepend) this.parent.insertBefore(this.element, this.parent.firstChild);
            else this.parent.appendChild(this.element);
            assert(this.element.parentElement === this.parent, "Invalid parent #1");
            this.attached = true;
        }
    }

    /**
     * Internal method to detach the element
     */
    internalDetach() {
        if (this.attached) {
            assert(this.element.parentElement === this.parent, "Invalid parent #2");
            this.element.parentElement.removeChild(this.element);
            this.attached = false;
        }
    }

    /**
     * Returns whether the element is currently attached
     */
    isAttached() {
        return this.attached;
    }

    /**
     * Actually sets the 'hovered' class
     * @param {boolean} isHovered
     */
    setIsHoveredClass(isHovered) {
        this.element.classList.toggle("hovered", isHovered);
    }

    /**
     * Call this every frame, and the dom attach class will take care of
     * everything else
     * @param {boolean} isVisible Whether the element should currently be visible or not
     */
    update(isVisible) {
        if (isVisible) {
            this.lastVisibleTime = this.root ? this.root.time.realtimeNow() : 0;
            this.internalAttach();

            if (this.trackHover && this.root) {
                let bounds = this.lastComputedBounds;

                // Recompute bounds only once in a while
                if (!bounds || this.root.time.realtimeNow() - this.lastComputedBoundsTime > 1.0) {
                    bounds = this.lastComputedBounds = this.element.getBoundingClientRect();
                    this.lastComputedBoundsTime = this.root.time.realtimeNow();
                }

                const mousePos = this.root.app.mousePosition;
                if (mousePos) {
                    this.trackedIsHovered.set(
                        mousePos.x > bounds.left &&
                            mousePos.x < bounds.right &&
                            mousePos.y > bounds.top &&
                            mousePos.y < bounds.bottom
                    );
                }
            }
        } else {
            if (!this.root || this.root.time.realtimeNow() - this.lastVisibleTime >= this.timeToKeepSeconds) {
                this.internalDetach();
            }
        }

        if (this.attachClass && isVisible !== this.internalIsClassAttached) {
            // State changed
            this.internalIsClassAttached = isVisible;

            if (this.classAttachTimeout) {
                clearTimeout(this.classAttachTimeout);
                this.classAttachTimeout = null;
            }

            if (isVisible) {
                this.classAttachTimeout = setTimeout(() => {
                    this.element.classList.add(this.attachClass);
                }, 15);
            } else {
                this.element.classList.remove(this.attachClass);
            }
        }
    }
}
