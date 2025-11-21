import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';

/**
 * CoachingControls Component
 * Provides manual controls for AI coaching during sessions:
 * - Pause/Resume coaching
 * - Coaching intensity slider
 * - Request alternative answers
 * - Freeform mode toggle
 */
export class CoachingControls extends LitElement {
    static styles = css`
        :host {
            display: block;
            font-family: 'Inter', sans-serif;
        }

        .controls-container {
            background: var(--control-background, rgba(0, 0, 0, 0.85));
            backdrop-filter: blur(10px);
            border-radius: 8px;
            padding: 12px;
            border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
            transition: all 0.3s ease;
        }

        .controls-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
        }

        .controls-title {
            font-size: 11px;
            font-weight: 600;
            color: var(--text-color, #fff);
            opacity: 0.7;
            letter-spacing: 0.5px;
        }

        .status-indicator {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 10px;
            font-weight: 600;
            transition: all 0.3s ease;
        }

        .status-indicator.active {
            background: rgba(76, 175, 80, 0.2);
            color: #4caf50;
        }

        .status-indicator.paused {
            background: rgba(255, 193, 7, 0.2);
            color: #ffc107;
        }

        .status-indicator.freeform {
            background: rgba(33, 150, 243, 0.2);
            color: #2196f3;
        }

        .status-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: currentColor;
            animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
            0%, 100% {
                opacity: 1;
            }
            50% {
                opacity: 0.5;
            }
        }

        .controls-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            margin-bottom: 12px;
        }

        .control-button {
            background: rgba(255, 255, 255, 0.05);
            color: var(--text-color, #fff);
            border: 1px solid rgba(255, 255, 255, 0.1);
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            gap: 6px;
            justify-content: center;
        }

        .control-button:hover {
            background: rgba(255, 255, 255, 0.1);
            border-color: rgba(255, 255, 255, 0.2);
            transform: translateY(-1px);
        }

        .control-button:active {
            transform: translateY(0);
        }

        .control-button.active {
            background: rgba(76, 175, 80, 0.2);
            border-color: #4caf50;
            color: #4caf50;
        }

        .control-button.paused {
            background: rgba(255, 193, 7, 0.2);
            border-color: #ffc107;
            color: #ffc107;
        }

        .control-button.freeform {
            background: rgba(33, 150, 243, 0.2);
            border-color: #2196f3;
            color: #2196f3;
        }

        .control-button.alternative {
            background: rgba(156, 39, 176, 0.2);
            border-color: #9c27b0;
            color: #9c27b0;
        }

        .control-button:disabled {
            opacity: 0.4;
            cursor: not-allowed;
            transform: none;
        }

        .intensity-control {
            grid-column: 1 / -1;
            background: rgba(255, 255, 255, 0.05);
            padding: 10px 12px;
            border-radius: 6px;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .intensity-label {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
            font-size: 11px;
            color: var(--text-color, #fff);
            opacity: 0.8;
        }

        .intensity-value {
            font-weight: 600;
            color: #2196f3;
        }

        .intensity-slider {
            width: 100%;
            height: 6px;
            border-radius: 3px;
            background: rgba(255, 255, 255, 0.1);
            outline: none;
            -webkit-appearance: none;
            appearance: none;
            cursor: pointer;
        }

        .intensity-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: #2196f3;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .intensity-slider::-moz-range-thumb {
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: #2196f3;
            cursor: pointer;
            border: none;
            transition: all 0.2s ease;
        }

        .intensity-slider::-webkit-slider-thumb:hover {
            transform: scale(1.2);
            box-shadow: 0 0 10px rgba(33, 150, 243, 0.5);
        }

        .intensity-slider::-moz-range-thumb:hover {
            transform: scale(1.2);
            box-shadow: 0 0 10px rgba(33, 150, 243, 0.5);
        }

        .intensity-labels {
            display: flex;
            justify-content: space-between;
            margin-top: 4px;
            font-size: 9px;
            color: var(--description-color, rgba(255, 255, 255, 0.6));
        }

        .keyboard-hint {
            font-size: 9px;
            color: var(--description-color, rgba(255, 255, 255, 0.5));
            text-align: center;
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px solid rgba(255, 255, 255, 0.05);
        }

        .kbd {
            background: rgba(255, 255, 255, 0.1);
            padding: 2px 4px;
            border-radius: 3px;
            font-family: monospace;
            font-size: 8px;
        }

        .button-icon {
            font-size: 12px;
        }
    `;

    static properties = {
        isPaused: { type: Boolean },
        isFreeformMode: { type: Boolean },
        intensity: { type: Number },
        isSessionActive: { type: Boolean },
    };

    constructor() {
        super();
        this.isPaused = false;
        this.isFreeformMode = false;
        this.intensity = 1; // 0 = Supportive, 1 = Balanced, 2 = Aggressive
        this.isSessionActive = false;

        // Bind keyboard handler
        this.boundKeyboardHandler = this.handleKeyboard.bind(this);
    }

    connectedCallback() {
        super.connectedCallback();

        // Listen for keyboard shortcuts
        document.addEventListener('keydown', this.boundKeyboardHandler);

        // Listen for session status to enable/disable controls
        if (window.electron) {
            this._statusUpdateHandler = (status) => {
                this.isSessionActive = status &&
                    !status.toLowerCase().includes('error') &&
                    !status.toLowerCase().includes('closed');
            };
            window.electron.on('update-status', this._statusUpdateHandler);
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        document.removeEventListener('keydown', this.boundKeyboardHandler);

        if (window.electron && this._statusUpdateHandler) {
            window.electron.off('update-status', this._statusUpdateHandler);
        }
    }

    handleKeyboard(e) {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const modifierKey = isMac ? e.metaKey : e.ctrlKey;

        if (!modifierKey) return;

        switch (e.key.toLowerCase()) {
            case 'p':
                e.preventDefault();
                this.togglePause();
                break;
            case 'a':
                e.preventDefault();
                this.requestAlternative();
                break;
            case 'f':
                e.preventDefault();
                this.toggleFreeform();
                break;
        }
    }

    togglePause() {
        if (!this.isSessionActive) return;

        this.isPaused = !this.isPaused;
        this._sendControlUpdate('pause', this.isPaused);

        // Dispatch custom event for other components
        this.dispatchEvent(new CustomEvent('coaching-paused', {
            detail: { isPaused: this.isPaused },
            bubbles: true,
            composed: true
        }));
    }

    toggleFreeform() {
        if (!this.isSessionActive) return;

        this.isFreeformMode = !this.isFreeformMode;

        // If enabling freeform, also pause coaching
        if (this.isFreeformMode) {
            this.isPaused = true;
        }

        this._sendControlUpdate('freeform', this.isFreeformMode);

        // Dispatch custom event
        this.dispatchEvent(new CustomEvent('freeform-toggled', {
            detail: { isFreeformMode: this.isFreeformMode },
            bubbles: true,
            composed: true
        }));
    }

    changeIntensity(e) {
        this.intensity = parseInt(e.target.value, 10);
        this._sendControlUpdate('intensity', this.intensity);

        // Dispatch custom event
        this.dispatchEvent(new CustomEvent('intensity-changed', {
            detail: { intensity: this.intensity },
            bubbles: true,
            composed: true
        }));
    }

    requestAlternative() {
        if (!this.isSessionActive || this.isPaused || this.isFreeformMode) return;

        this._sendControlUpdate('alternative', true);

        // Dispatch custom event
        this.dispatchEvent(new CustomEvent('alternative-requested', {
            detail: { timestamp: Date.now() },
            bubbles: true,
            composed: true
        }));

        // Visual feedback
        const button = this.shadowRoot.querySelector('.alternative');
        if (button) {
            button.textContent = '⟳ Generating...';
            setTimeout(() => {
                button.innerHTML = '<span class="button-icon">⟳</span> Alternative Answer';
            }, 2000);
        }
    }

    _sendControlUpdate(type, value) {
        if (!window.electron) return;

        const channelMap = {
            'pause': 'set-coaching-paused',
            'intensity': 'set-coaching-intensity',
            'alternative': 'request-alternative-answer',
            'freeform': 'set-freeform-mode'
        };

        const channel = channelMap[type];
        if (channel) {
            window.electron.invoke(channel, value).catch(err => {
                console.error(`Error sending ${type} control:`, err);
            });
        }
    }

    getIntensityLabel() {
        const labels = ['Supportive', 'Balanced', 'Aggressive'];
        return labels[this.intensity] || 'Balanced';
    }

    getStatusText() {
        if (this.isFreeformMode) return 'Freeform Mode';
        if (this.isPaused) return 'Coaching Paused';
        return 'Coaching Active';
    }

    getStatusClass() {
        if (this.isFreeformMode) return 'freeform';
        if (this.isPaused) return 'paused';
        return 'active';
    }

    render() {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const modKey = isMac ? 'Cmd' : 'Ctrl';

        return html`
            <div class="controls-container">
                <div class="controls-header">
                    <div class="controls-title">COACHING CONTROLS</div>
                    <div class="status-indicator ${this.getStatusClass()}">
                        <span class="status-dot"></span>
                        <span>${this.getStatusText()}</span>
                    </div>
                </div>

                <div class="controls-grid">
                    <button
                        class="control-button ${this.isPaused ? 'paused' : 'active'}"
                        @click=${this.togglePause}
                        ?disabled=${!this.isSessionActive}
                        title="Pause/Resume AI coaching (${modKey}+P)"
                    >
                        <span class="button-icon">${this.isPaused ? '▶' : '⏸'}</span>
                        ${this.isPaused ? 'Resume' : 'Pause'}
                    </button>

                    <button
                        class="control-button ${this.isFreeformMode ? 'freeform' : ''}"
                        @click=${this.toggleFreeform}
                        ?disabled=${!this.isSessionActive}
                        title="Toggle freeform mode (${modKey}+F)"
                    >
                        <span class="button-icon">💭</span>
                        ${this.isFreeformMode ? 'End Freeform' : 'Freeform'}
                    </button>

                    <button
                        class="control-button alternative"
                        @click=${this.requestAlternative}
                        ?disabled=${!this.isSessionActive || this.isPaused || this.isFreeformMode}
                        title="Request alternative answer (${modKey}+A)"
                    >
                        <span class="button-icon">⟳</span>
                        Alternative Answer
                    </button>

                    <div class="intensity-control">
                        <div class="intensity-label">
                            <span>Coaching Intensity</span>
                            <span class="intensity-value">${this.getIntensityLabel()}</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="2"
                            step="1"
                            .value=${this.intensity.toString()}
                            @input=${this.changeIntensity}
                            class="intensity-slider"
                            ?disabled=${!this.isSessionActive}
                        />
                        <div class="intensity-labels">
                            <span>Supportive</span>
                            <span>Balanced</span>
                            <span>Aggressive</span>
                        </div>
                    </div>
                </div>

                <div class="keyboard-hint">
                    Shortcuts: <span class="kbd">${modKey}+P</span> Pause •
                    <span class="kbd">${modKey}+A</span> Alternative •
                    <span class="kbd">${modKey}+F</span> Freeform
                </div>
            </div>
        `;
    }
}

customElements.define('coaching-controls', CoachingControls);
