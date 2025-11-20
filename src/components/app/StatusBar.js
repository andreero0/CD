import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';

export class StatusBar extends LitElement {
    static styles = css`
        :host {
            display: block;
            font-family: 'Inter', sans-serif;
        }

        .status-bar-container {
            background: var(--status-bar-background, rgba(0, 0, 0, 0.85));
            backdrop-filter: blur(10px);
            border-radius: 8px;
            padding: 8px 12px;
            border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
            transition: all 0.3s ease;
            margin-bottom: 8px;
        }

        .status-bar-container.collapsed {
            padding: 4px 12px;
        }

        .status-bar-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: pointer;
            user-select: none;
        }

        .status-bar-title {
            font-size: 11px;
            font-weight: 600;
            color: var(--text-color, #fff);
            opacity: 0.7;
            letter-spacing: 0.5px;
        }

        .toggle-icon {
            font-size: 10px;
            transition: transform 0.3s ease;
            color: var(--text-color, #fff);
            opacity: 0.7;
        }

        .toggle-icon.collapsed {
            transform: rotate(-90deg);
        }

        .status-bar-content {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 12px;
            margin-top: 10px;
            max-height: 200px;
            overflow: hidden;
            transition: max-height 0.3s ease, margin-top 0.3s ease;
        }

        .status-bar-content.collapsed {
            max-height: 0;
            margin-top: 0;
        }

        .status-item {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .status-label {
            font-size: 10px;
            color: var(--description-color, rgba(255, 255, 255, 0.6));
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .status-value {
            font-size: 13px;
            font-weight: 600;
            color: var(--text-color, #fff);
            font-variant-numeric: tabular-nums;
        }

        /* Color coding for states */
        .status-value.good {
            color: #4caf50;
        }

        .status-value.processing {
            color: #ffc107;
        }

        .status-value.error {
            color: #f44336;
        }

        .status-value.neutral {
            color: var(--text-color, #fff);
        }

        /* Audio level meter */
        .audio-meter {
            display: flex;
            gap: 2px;
            height: 20px;
            align-items: flex-end;
        }

        .audio-bar {
            width: 4px;
            background: var(--audio-bar-inactive, rgba(255, 255, 255, 0.2));
            border-radius: 2px;
            transition: background 0.1s ease, height 0.1s ease;
        }

        .audio-bar.active {
            background: linear-gradient(to top, #4caf50, #8bc34a);
        }

        .audio-bar.warning {
            background: linear-gradient(to top, #ff9800, #ffc107);
        }

        .audio-bar.danger {
            background: linear-gradient(to top, #f44336, #ff5722);
        }

        /* Screenshot timer progress */
        .screenshot-timer {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .timer-progress {
            width: 100%;
            height: 4px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 2px;
            overflow: hidden;
        }

        .timer-progress-bar {
            height: 100%;
            background: linear-gradient(to right, #2196f3, #03a9f4);
            border-radius: 2px;
            transition: width 0.3s ease;
        }

        .timer-text {
            font-size: 11px;
            color: var(--text-color, #fff);
            display: flex;
            justify-content: space-between;
        }

        /* AI State indicator */
        .ai-state-indicator {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
        }

        .ai-state-indicator.listening {
            background: rgba(76, 175, 80, 0.2);
            color: #4caf50;
        }

        .ai-state-indicator.thinking {
            background: rgba(255, 193, 7, 0.2);
            color: #ffc107;
        }

        .ai-state-indicator.complete {
            background: rgba(33, 150, 243, 0.2);
            color: #2196f3;
        }

        .ai-state-indicator.error {
            background: rgba(244, 67, 54, 0.2);
            color: #f44336;
        }

        .state-dot {
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

        /* Token usage progress bar */
        .token-progress {
            width: 100%;
            height: 6px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 3px;
            overflow: hidden;
            margin-top: 4px;
        }

        .token-progress-bar {
            height: 100%;
            border-radius: 3px;
            transition: width 0.3s ease, background 0.3s ease;
        }

        .token-progress-bar.good {
            background: linear-gradient(to right, #4caf50, #8bc34a);
        }

        .token-progress-bar.warning {
            background: linear-gradient(to right, #ff9800, #ffc107);
        }

        .token-progress-bar.danger {
            background: linear-gradient(to right, #f44336, #ff5722);
        }

        /* Responsive design */
        @media (max-width: 800px) {
            .status-bar-content {
                grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
                gap: 8px;
            }
        }
    `;

    static properties = {
        collapsed: { type: Boolean },
        audioLevels: { type: Object },
        screenshotInterval: { type: Number },
        lastScreenshotTime: { type: Number },
        nextScreenshotTime: { type: Number },
        aiState: { type: String },
        tokensUsed: { type: Number },
        tokensLimit: { type: Number },
        sessionStartTime: { type: Number },
        sessionDuration: { type: String },
        responseCount: { type: Number },
    };

    constructor() {
        super();
        this.collapsed = localStorage.getItem('statusBarCollapsed') === 'true';
        this.audioLevels = { mic: 0, system: 0 };
        this.screenshotInterval = 5; // seconds
        this.lastScreenshotTime = 0;
        this.nextScreenshotTime = 0;
        this.aiState = 'idle'; // idle, listening, thinking, complete, error
        this.tokensUsed = 0;
        this.tokensLimit = 1000000; // 1M default
        this.sessionStartTime = 0;
        this.sessionDuration = '0:00';
        this.responseCount = 0;

        // Start real-time updates
        this._startUpdates();
    }

    connectedCallback() {
        super.connectedCallback();
        this._setupIpcListeners();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this._cleanupUpdates();
        this._cleanupIpcListeners();
    }

    _setupIpcListeners() {
        if (!window.electron) return;

        const ipcRenderer = window.electron;

        // Listen for status updates to determine AI state
        this._statusUpdateHandler = (status) => {
            this._updateAiStateFromStatus(status);
        };

        ipcRenderer.on('update-status', this._statusUpdateHandler);
    }

    _cleanupIpcListeners() {
        if (!window.electron) return;

        const ipcRenderer = window.electron;
        if (this._statusUpdateHandler) {
            ipcRenderer.removeListener('update-status', this._statusUpdateHandler);
        }
    }

    _updateAiStateFromStatus(status) {
        const statusLower = status.toLowerCase();

        if (statusLower.includes('listening')) {
            this.aiState = 'listening';
        } else if (statusLower.includes('thinking') || statusLower.includes('processing') || statusLower.includes('message sent')) {
            this.aiState = 'thinking';
        } else if (statusLower.includes('ready') || statusLower.includes('live') || statusLower.includes('complete')) {
            this.aiState = 'complete';
        } else if (statusLower.includes('error')) {
            this.aiState = 'error';
        }
    }

    _startUpdates() {
        // Update session duration every second
        this._durationInterval = setInterval(() => {
            if (this.sessionStartTime > 0) {
                const elapsed = Date.now() - this.sessionStartTime;
                this.sessionDuration = this._formatDuration(elapsed);
            }
        }, 1000);

        // Update screenshot timer every 100ms for smooth countdown
        this._screenshotInterval = setInterval(() => {
            this._updateScreenshotTimer();
        }, 100);

        // Simulate audio levels (in production, this would come from actual audio processing)
        this._audioInterval = setInterval(() => {
            this._updateAudioLevels();
        }, 100);

        // Update token usage from token tracker
        this._tokenInterval = setInterval(() => {
            this._updateTokenUsage();
        }, 2000);
    }

    _cleanupUpdates() {
        if (this._durationInterval) clearInterval(this._durationInterval);
        if (this._screenshotInterval) clearInterval(this._screenshotInterval);
        if (this._audioInterval) clearInterval(this._audioInterval);
        if (this._tokenInterval) clearInterval(this._tokenInterval);
    }

    _updateScreenshotTimer() {
        // Get actual screenshot timing from window.screenshotTracker if available
        if (window.screenshotTracker) {
            const tracker = window.screenshotTracker;
            if (tracker.isManualMode) {
                this.screenshotInterval = 'manual';
            } else {
                this.screenshotInterval = tracker.intervalSeconds;
                if (tracker.lastScreenshotTime > 0) {
                    this.lastScreenshotTime = tracker.lastScreenshotTime;
                    const now = Date.now();
                    const timeSinceLast = Math.floor((now - this.lastScreenshotTime) / 1000);
                    this.nextScreenshotTime = Math.max(0, this.screenshotInterval - timeSinceLast);
                    this.requestUpdate();
                }
            }
        }
    }

    _updateAudioLevels() {
        // Read real audio levels from window.audioTracker
        if (window.audioTracker) {
            const timeSinceUpdate = Date.now() - window.audioTracker.lastUpdate;

            // Decay levels if no recent update (>200ms means audio stopped)
            const decay = timeSinceUpdate > 200 ? Math.max(0, 1 - (timeSinceUpdate - 200) / 500) : 1.0;

            this.audioLevels = {
                mic: window.audioTracker.micLevel * decay,
                system: window.audioTracker.systemLevel * decay,
            };
        } else {
            // Fallback if tracker not initialized yet
            this.audioLevels = { mic: 0, system: 0 };
        }
        this.requestUpdate();
    }

    _updateTokenUsage() {
        // Try to get token usage from the renderer's token tracker
        try {
            // Get token info from window.tokenTracker
            if (window.tokenTracker) {
                this.tokensUsed = window.tokenTracker.getTokensInLastMinute();
                const maxTokens = parseInt(localStorage.getItem('maxTokensPerMin') || '1000000', 10);
                this.tokensLimit = maxTokens;
            }
        } catch (e) {
            // Silent fail - token tracking is optional
        }
    }

    _formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
        } else {
            return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
        }
    }

    toggleCollapse() {
        this.collapsed = !this.collapsed;
        localStorage.setItem('statusBarCollapsed', this.collapsed.toString());
    }

    renderAudioMeter(level, label) {
        const bars = 8;
        const activeBars = Math.floor(level * bars);

        return html`
            <div class="status-item">
                <div class="status-label">${label}</div>
                <div class="audio-meter">
                    ${Array.from({ length: bars }, (_, i) => {
                        let className = 'audio-bar';
                        if (i < activeBars) {
                            className += ' active';
                            if (i >= bars * 0.7) className += ' danger';
                            else if (i >= bars * 0.5) className += ' warning';
                        }
                        return html`<div class="${className}" style="height: ${((i + 1) / bars) * 100}%"></div>`;
                    })}
                </div>
            </div>
        `;
    }

    renderScreenshotTimer() {
        if (this.screenshotInterval === 'manual' || this.screenshotInterval === 'Manual') {
            return html`
                <div class="status-item">
                    <div class="status-label">Screenshot</div>
                    <div class="status-value neutral">Manual</div>
                </div>
            `;
        }

        const timeSinceLast = this.lastScreenshotTime > 0
            ? Math.floor((Date.now() - this.lastScreenshotTime) / 1000)
            : 0;
        const progress = (timeSinceLast / this.screenshotInterval) * 100;

        return html`
            <div class="status-item">
                <div class="status-label">📸 Screenshot</div>
                <div class="screenshot-timer">
                    <div class="timer-text">
                        <span>Last: ${timeSinceLast}s ago</span>
                        <span>Next: ${this.nextScreenshotTime}s</span>
                    </div>
                    <div class="timer-progress">
                        <div class="timer-progress-bar" style="width: ${Math.min(progress, 100)}%"></div>
                    </div>
                </div>
            </div>
        `;
    }

    renderAiState() {
        const stateConfig = {
            idle: { icon: '■', label: 'Idle' },
            listening: { icon: '●', label: 'Listening' },
            thinking: { icon: '◐', label: 'Thinking' },
            complete: { icon: '✓', label: 'Complete' },
            error: { icon: '✗', label: 'Error' },
        };

        const config = stateConfig[this.aiState] || stateConfig.idle;

        return html`
            <div class="status-item">
                <div class="status-label">AI State</div>
                <div class="ai-state-indicator ${this.aiState}">
                    <span class="state-dot"></span>
                    <span>${config.icon} ${config.label}</span>
                </div>
            </div>
        `;
    }

    renderTokenUsage() {
        const percentage = (this.tokensUsed / this.tokensLimit) * 100;
        const formattedUsed = this.tokensUsed >= 1000
            ? `${(this.tokensUsed / 1000).toFixed(1)}K`
            : this.tokensUsed;
        const formattedLimit = this.tokensLimit >= 1000
            ? `${(this.tokensLimit / 1000).toFixed(0)}K`
            : this.tokensLimit;

        let colorClass = 'good';
        if (percentage >= 80) colorClass = 'danger';
        else if (percentage >= 60) colorClass = 'warning';

        return html`
            <div class="status-item">
                <div class="status-label">Tokens (1min)</div>
                <div class="status-value ${colorClass}">
                    ${formattedUsed} / ${formattedLimit}
                </div>
                <div class="token-progress">
                    <div class="token-progress-bar ${colorClass}" style="width: ${Math.min(percentage, 100)}%"></div>
                </div>
            </div>
        `;
    }

    render() {
        return html`
            <div class="status-bar-container ${this.collapsed ? 'collapsed' : ''}">
                <div class="status-bar-header" @click=${this.toggleCollapse}>
                    <div class="status-bar-title">SYSTEM STATUS</div>
                    <div class="toggle-icon ${this.collapsed ? 'collapsed' : ''}">▼</div>
                </div>
                <div class="status-bar-content ${this.collapsed ? 'collapsed' : ''}">
                    ${this.renderAudioMeter(this.audioLevels.mic, 'Mic')}
                    ${this.renderAudioMeter(this.audioLevels.system, 'System')}
                    ${this.renderScreenshotTimer()}
                    ${this.renderAiState()}
                    ${this.renderTokenUsage()}
                    <div class="status-item">
                        <div class="status-label">Duration</div>
                        <div class="status-value neutral">${this.sessionDuration}</div>
                    </div>
                    <div class="status-item">
                        <div class="status-label">Responses</div>
                        <div class="status-value good">${this.responseCount}</div>
                    </div>
                </div>
            </div>
        `;
    }
}

customElements.define('status-bar', StatusBar);
