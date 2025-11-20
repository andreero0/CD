import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';

export class ViewModeSwitcher extends LitElement {
    static styles = css`
        :host {
            display: flex;
            gap: 8px;
            align-items: center;
        }

        .mode-button {
            background: var(--input-background);
            color: var(--text-color);
            border: 1px solid var(--button-border);
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
            transition: all 0.2s ease;
        }

        .mode-button:hover {
            background: var(--input-focus-background);
            border-color: var(--focus-border-color);
        }

        .mode-button.active {
            background: var(--start-button-background);
            color: var(--start-button-color);
            border-color: var(--start-button-border);
        }

        .mode-icon {
            width: 14px;
            height: 14px;
        }

        .keyboard-hint {
            color: var(--description-color);
            font-size: 10px;
            opacity: 0.7;
        }
    `;

    static properties = {
        currentMode: { type: String },
        onModeChange: { type: Function },
    };

    constructor() {
        super();
        this.currentMode = localStorage.getItem('viewMode') || 'minimal';
        this.onModeChange = () => {};
    }

    handleModeChange(mode) {
        this.currentMode = mode;
        localStorage.setItem('viewMode', mode);
        this.onModeChange(mode);
        this.requestUpdate();
    }

    render() {
        return html`
            <button
                class="mode-button ${this.currentMode === 'minimal' ? 'active' : ''}"
                @click=${() => this.handleModeChange('minimal')}
                title="Minimal Mode (M)"
            >
                <svg class="mode-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <rect x="4" y="4" width="16" height="16" rx="2" stroke-width="2"></rect>
                </svg>
                <span>Minimal</span>
                <span class="keyboard-hint">M</span>
            </button>

            <button
                class="mode-button ${this.currentMode === 'detailed' ? 'active' : ''}"
                @click=${() => this.handleModeChange('detailed')}
                title="Detailed Mode (D)"
            >
                <svg class="mode-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <rect x="4" y="4" width="16" height="16" rx="2" stroke-width="2"></rect>
                    <line x1="8" y1="8" x2="16" y2="8" stroke-width="2"></line>
                    <line x1="8" y1="12" x2="16" y2="12" stroke-width="2"></line>
                    <line x1="8" y1="16" x2="12" y2="16" stroke-width="2"></line>
                </svg>
                <span>Detailed</span>
                <span class="keyboard-hint">D</span>
            </button>

            <button
                class="mode-button ${this.currentMode === 'split' ? 'active' : ''}"
                @click=${() => this.handleModeChange('split')}
                title="Split-Screen Mode (S)"
            >
                <svg class="mode-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <rect x="4" y="4" width="16" height="16" rx="2" stroke-width="2"></rect>
                    <line x1="12" y1="4" x2="12" y2="20" stroke-width="2"></line>
                </svg>
                <span>Split</span>
                <span class="keyboard-hint">S</span>
            </button>
        `;
    }
}

customElements.define('view-mode-switcher', ViewModeSwitcher);
