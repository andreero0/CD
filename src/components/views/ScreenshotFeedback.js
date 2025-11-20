import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';

export class ScreenshotFeedback extends LitElement {
    static styles = css`
        :host {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 1000;
        }

        /* Flash animation overlay */
        .flash-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            border: 4px solid var(--focus-border-color, #007aff);
            border-radius: 10px;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.3s ease-out;
        }

        .flash-overlay.active {
            opacity: 1;
            animation: flash-pulse 0.6s ease-out;
        }

        @keyframes flash-pulse {
            0% {
                opacity: 1;
                border-width: 4px;
            }
            50% {
                opacity: 0.8;
                border-width: 6px;
            }
            100% {
                opacity: 0;
                border-width: 4px;
            }
        }

        /* Thumbnail container */
        .thumbnail-container {
            position: absolute;
            bottom: 80px;
            right: 20px;
            width: 80px;
            height: 60px;
            border-radius: 8px;
            background: var(--input-background, rgba(255, 255, 255, 0.1));
            border: 2px solid var(--border-color, rgba(255, 255, 255, 0.2));
            overflow: hidden;
            cursor: pointer;
            pointer-events: auto;
            transition: all 0.2s ease-out;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .thumbnail-container:hover {
            transform: scale(1.05);
            border-color: var(--focus-border-color, #007aff);
            box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
        }

        .thumbnail-container.hidden {
            display: none;
        }

        .thumbnail-image {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        .thumbnail-image.blurred {
            filter: blur(8px);
        }

        .thumbnail-badge {
            position: absolute;
            top: 4px;
            right: 4px;
            background: var(--focus-border-color, #007aff);
            color: white;
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 4px;
            font-weight: 600;
        }

        /* Full-size preview modal */
        .preview-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.3s ease-out;
            z-index: 2000;
        }

        .preview-modal.active {
            opacity: 1;
            pointer-events: auto;
        }

        .preview-content {
            max-width: 90%;
            max-height: 90%;
            border-radius: 8px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        }

        .preview-close {
            position: absolute;
            top: 20px;
            right: 20px;
            background: rgba(255, 255, 255, 0.2);
            color: white;
            border: none;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            font-size: 24px;
            cursor: pointer;
            pointer-events: auto;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s;
        }

        .preview-close:hover {
            background: rgba(255, 255, 255, 0.3);
        }

        .blur-toggle {
            position: absolute;
            bottom: 4px;
            left: 4px;
            background: rgba(0, 0, 0, 0.6);
            color: white;
            border: none;
            border-radius: 4px;
            padding: 2px 6px;
            font-size: 9px;
            cursor: pointer;
            pointer-events: auto;
            transition: background 0.2s;
        }

        .blur-toggle:hover {
            background: rgba(0, 0, 0, 0.8);
        }
    `;

    static properties = {
        lastScreenshot: { type: String },
        showPreview: { type: Boolean },
        isBlurred: { type: Boolean },
        screenshotCount: { type: Number },
    };

    constructor() {
        super();
        this.lastScreenshot = null;
        this.showPreview = false;
        this.isBlurred = true; // Blur by default for privacy
        this.screenshotCount = 0;
    }

    captureScreenshot(imageData) {
        // Store the screenshot
        this.lastScreenshot = imageData;
        this.screenshotCount++;

        // Trigger flash animation
        this.triggerFlash();

        this.requestUpdate();
    }

    triggerFlash() {
        const flashOverlay = this.shadowRoot?.querySelector('.flash-overlay');
        if (flashOverlay) {
            flashOverlay.classList.remove('active');
            // Force reflow
            void flashOverlay.offsetWidth;
            flashOverlay.classList.add('active');

            // Remove after animation
            setTimeout(() => {
                flashOverlay.classList.remove('active');
            }, 600);
        }
    }

    toggleBlur() {
        this.isBlurred = !this.isBlurred;
    }

    openPreview() {
        if (this.lastScreenshot) {
            this.showPreview = true;
        }
    }

    closePreview() {
        this.showPreview = false;
    }

    render() {
        const hasThumbnail = this.lastScreenshot !== null;

        return html`
            <!-- Flash animation overlay -->
            <div class="flash-overlay"></div>

            <!-- Thumbnail preview -->
            <div class="thumbnail-container ${hasThumbnail ? '' : 'hidden'}" @click=${this.openPreview}>
                ${hasThumbnail
                    ? html`
                          <img src="data:image/jpeg;base64,${this.lastScreenshot}" class="thumbnail-image ${this.isBlurred ? 'blurred' : ''}" alt="Screenshot" />
                          <div class="thumbnail-badge">${this.screenshotCount}</div>
                          <button class="blur-toggle" @click=${e => { e.stopPropagation(); this.toggleBlur(); }} title="${this.isBlurred ? 'Show' : 'Hide'}">
                              ${this.isBlurred ? '👁️' : '🔒'}
                          </button>
                      `
                    : ''}
            </div>

            <!-- Full-size preview modal -->
            <div class="preview-modal ${this.showPreview ? 'active' : ''}" @click=${this.closePreview}>
                ${this.showPreview && this.lastScreenshot
                    ? html`
                          <img src="data:image/jpeg;base64,${this.lastScreenshot}" class="preview-content" alt="Screenshot Preview" />
                          <button class="preview-close" @click=${this.closePreview}>×</button>
                      `
                    : ''}
            </div>
        `;
    }
}

customElements.define('screenshot-feedback', ScreenshotFeedback);
