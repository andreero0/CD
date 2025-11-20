import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';

export class LaunchWizard extends LitElement {
    static styles = css`
        * {
            font-family: 'Inter', sans-serif;
            cursor: default;
            user-select: none;
            box-sizing: border-box;
        }

        :host {
            display: block;
            width: 100%;
            height: 100%;
            position: fixed;
            top: 0;
            left: 0;
            overflow: hidden;
        }

        .wizard-container {
            position: relative;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            overflow: hidden;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 40px;
        }

        .progress-bar-container {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: rgba(255, 255, 255, 0.1);
        }

        .progress-bar {
            height: 100%;
            background: linear-gradient(90deg, #4facfe 0%, #00f2fe 100%);
            transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .wizard-content {
            max-width: 600px;
            width: 100%;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            padding: 48px;
            backdrop-filter: blur(10px);
            animation: slideUp 0.5s ease-out;
        }

        @keyframes slideUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .step-indicator {
            text-align: center;
            margin-bottom: 32px;
        }

        .step-number {
            font-size: 14px;
            font-weight: 600;
            color: #4facfe;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 8px;
        }

        .step-title {
            font-size: 32px;
            font-weight: 700;
            color: #ffffff;
            margin-bottom: 12px;
        }

        .step-description {
            font-size: 16px;
            color: rgba(255, 255, 255, 0.7);
            line-height: 1.6;
        }

        .checks-container {
            margin: 32px 0;
        }

        .check-item {
            display: flex;
            align-items: center;
            padding: 16px;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 8px;
            margin-bottom: 12px;
            transition: all 0.3s ease;
        }

        .check-item.checking {
            border-color: rgba(79, 172, 254, 0.5);
            background: rgba(79, 172, 254, 0.05);
        }

        .check-item.success {
            border-color: rgba(46, 213, 115, 0.5);
            background: rgba(46, 213, 115, 0.05);
        }

        .check-item.error {
            border-color: rgba(255, 71, 87, 0.5);
            background: rgba(255, 71, 87, 0.05);
        }

        .check-icon {
            width: 32px;
            height: 32px;
            margin-right: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }

        .check-icon svg {
            width: 24px;
            height: 24px;
        }

        .spinner {
            width: 20px;
            height: 20px;
            border: 3px solid rgba(79, 172, 254, 0.3);
            border-top-color: #4facfe;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        .check-details {
            flex: 1;
        }

        .check-label {
            font-size: 15px;
            font-weight: 500;
            color: #ffffff;
            margin-bottom: 4px;
        }

        .check-message {
            font-size: 13px;
            color: rgba(255, 255, 255, 0.6);
        }

        .permission-card {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 20px;
        }

        .permission-title {
            font-size: 18px;
            font-weight: 600;
            color: #ffffff;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .permission-description {
            font-size: 14px;
            color: rgba(255, 255, 255, 0.7);
            line-height: 1.6;
            margin-bottom: 16px;
        }

        .permission-example {
            background: rgba(0, 0, 0, 0.3);
            border-radius: 8px;
            padding: 16px;
            margin-top: 12px;
        }

        .permission-example-title {
            font-size: 13px;
            font-weight: 600;
            color: rgba(255, 255, 255, 0.8);
            margin-bottom: 8px;
        }

        .permission-example-text {
            font-size: 12px;
            color: rgba(255, 255, 255, 0.6);
            line-height: 1.5;
        }

        .countdown-container {
            text-align: center;
            padding: 60px 0;
        }

        .countdown-number {
            font-size: 120px;
            font-weight: 900;
            color: #4facfe;
            line-height: 1;
            animation: countdownPulse 1s ease-in-out;
        }

        @keyframes countdownPulse {
            0% {
                transform: scale(0.8);
                opacity: 0;
            }
            50% {
                transform: scale(1.1);
            }
            100% {
                transform: scale(1);
                opacity: 1;
            }
        }

        .countdown-text {
            font-size: 24px;
            color: rgba(255, 255, 255, 0.8);
            margin-top: 24px;
        }

        .go-text {
            font-size: 120px;
            font-weight: 900;
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 50%, #46df7f 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            animation: goAnimation 0.8s ease-out;
        }

        @keyframes goAnimation {
            0% {
                transform: scale(0.5) rotate(-5deg);
                opacity: 0;
            }
            50% {
                transform: scale(1.2) rotate(2deg);
            }
            100% {
                transform: scale(1) rotate(0deg);
                opacity: 1;
            }
        }

        .wizard-actions {
            display: flex;
            gap: 12px;
            justify-content: flex-end;
            margin-top: 32px;
        }

        .wizard-button {
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            border: none;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .wizard-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .wizard-button.secondary {
            background: rgba(255, 255, 255, 0.1);
            color: #ffffff;
            border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .wizard-button.secondary:hover:not(:disabled) {
            background: rgba(255, 255, 255, 0.15);
        }

        .wizard-button.primary {
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
            color: #ffffff;
            border: none;
        }

        .wizard-button.primary:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(79, 172, 254, 0.4);
        }

        .wizard-button.danger {
            background: rgba(255, 71, 87, 0.1);
            color: #ff4757;
            border: 1px solid rgba(255, 71, 87, 0.3);
        }

        .wizard-button.danger:hover:not(:disabled) {
            background: rgba(255, 71, 87, 0.2);
        }

        .error-message {
            background: rgba(255, 71, 87, 0.1);
            border: 1px solid rgba(255, 71, 87, 0.3);
            border-radius: 8px;
            padding: 16px;
            margin-top: 16px;
            color: #ff4757;
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .info-box {
            background: rgba(79, 172, 254, 0.1);
            border: 1px solid rgba(79, 172, 254, 0.3);
            border-radius: 8px;
            padding: 16px;
            margin-top: 16px;
            color: #4facfe;
            font-size: 14px;
            line-height: 1.6;
        }

        .permission-status {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .permission-status.pending {
            background: rgba(255, 193, 7, 0.1);
            color: #ffc107;
        }

        .permission-status.granted {
            background: rgba(46, 213, 115, 0.1);
            color: #2ed573;
        }

        .permission-status.denied {
            background: rgba(255, 71, 87, 0.1);
            color: #ff4757;
        }
    `;

    static properties = {
        currentStep: { type: Number },
        preflightChecks: { type: Object },
        permissionStates: { type: Object },
        countdownNumber: { type: Number },
        errorMessage: { type: String },
        onComplete: { type: Function },
        onCancel: { type: Function },
        profile: { type: String },
        language: { type: String },
    };

    constructor() {
        super();
        this.currentStep = 1;
        this.preflightChecks = {
            apiKey: { status: 'pending', message: '' },
            browser: { status: 'pending', message: '' },
            connection: { status: 'pending', message: '' },
        };
        this.permissionStates = {
            screen: { status: 'pending', stream: null },
            microphone: { status: 'pending', stream: null },
        };
        this.countdownNumber = 3;
        this.errorMessage = '';
        this.onComplete = () => {};
        this.onCancel = () => {};
        this.profile = 'interview';
        this.language = 'en-US';
    }

    connectedCallback() {
        super.connectedCallback();
        // Auto-start preflight checks when wizard loads
        this.runPreflightChecks();
    }

    getProgressPercentage() {
        return (this.currentStep / 3) * 100;
    }

    async runPreflightChecks() {
        this.errorMessage = '';

        // Check 1: API Key Validation
        await this.checkApiKey();
        await this.delay(300);

        // Check 2: Browser Compatibility
        await this.checkBrowserCompatibility();
        await this.delay(300);

        // Check 3: Connection Test
        await this.checkConnection();
    }

    async checkApiKey() {
        this.preflightChecks = {
            ...this.preflightChecks,
            apiKey: { status: 'checking', message: 'Validating API key...' },
        };

        const apiKey = localStorage.getItem('apiKey')?.trim();

        if (!apiKey) {
            this.preflightChecks = {
                ...this.preflightChecks,
                apiKey: { status: 'error', message: 'No API key found' },
            };
            return;
        }

        try {
            // Test API key with a simple validation call
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
            );

            if (response.ok) {
                this.preflightChecks = {
                    ...this.preflightChecks,
                    apiKey: { status: 'success', message: 'API key validated' },
                };
            } else {
                this.preflightChecks = {
                    ...this.preflightChecks,
                    apiKey: { status: 'error', message: 'Invalid API key' },
                };
            }
        } catch (error) {
            this.preflightChecks = {
                ...this.preflightChecks,
                apiKey: { status: 'error', message: 'Failed to validate API key' },
            };
        }
    }

    async checkBrowserCompatibility() {
        this.preflightChecks = {
            ...this.preflightChecks,
            browser: { status: 'checking', message: 'Checking browser compatibility...' },
        };

        await this.delay(500);

        const hasMediaDevices = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
        const hasGetUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

        if (hasMediaDevices && hasGetUserMedia) {
            this.preflightChecks = {
                ...this.preflightChecks,
                browser: { status: 'success', message: 'Browser fully compatible' },
            };
        } else {
            this.preflightChecks = {
                ...this.preflightChecks,
                browser: { status: 'error', message: 'Browser missing required APIs' },
            };
        }
    }

    async checkConnection() {
        this.preflightChecks = {
            ...this.preflightChecks,
            connection: { status: 'checking', message: 'Testing connection...' },
        };

        await this.delay(500);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch('https://generativelanguage.googleapis.com', {
                signal: controller.signal,
                method: 'HEAD',
            });

            clearTimeout(timeoutId);

            this.preflightChecks = {
                ...this.preflightChecks,
                connection: { status: 'success', message: 'Connection established' },
            };
        } catch (error) {
            this.preflightChecks = {
                ...this.preflightChecks,
                connection: { status: 'error', message: 'Connection failed' },
            };
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    canProceedFromStep1() {
        return (
            this.preflightChecks.apiKey.status === 'success' &&
            this.preflightChecks.browser.status === 'success' &&
            this.preflightChecks.connection.status === 'success'
        );
    }

    async handleNextStep() {
        if (this.currentStep === 1) {
            if (this.canProceedFromStep1()) {
                this.currentStep = 2;
            }
        } else if (this.currentStep === 2) {
            // Request permissions before proceeding to countdown
            await this.requestAllPermissions();
        }
    }

    async requestAllPermissions() {
        this.errorMessage = '';

        // Request screen share first
        await this.requestScreenPermission();

        // Only proceed to microphone if screen share was granted
        if (this.permissionStates.screen.status === 'granted') {
            await this.requestMicrophonePermission();

            // If both permissions granted, move to countdown
            if (this.permissionStates.microphone.status === 'granted') {
                this.currentStep = 3;
                this.startCountdown();
            }
        }
    }

    async requestScreenPermission() {
        this.permissionStates = {
            ...this.permissionStates,
            screen: { status: 'requesting', stream: null },
        };

        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    frameRate: 1,
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                },
                audio: false,
            });

            this.permissionStates = {
                ...this.permissionStates,
                screen: { status: 'granted', stream },
            };
        } catch (error) {
            this.permissionStates = {
                ...this.permissionStates,
                screen: { status: 'denied', stream: null },
            };
            this.errorMessage = 'Screen sharing permission was denied. Please allow screen sharing to continue.';
        }
    }

    async requestMicrophonePermission() {
        const audioMode = localStorage.getItem('audioMode') || 'speaker_only';

        // Skip microphone if not needed
        if (audioMode === 'speaker_only') {
            this.permissionStates = {
                ...this.permissionStates,
                microphone: { status: 'granted', stream: null },
            };
            return;
        }

        this.permissionStates = {
            ...this.permissionStates,
            microphone: { status: 'requesting', stream: null },
        };

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: 24000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
                video: false,
            });

            this.permissionStates = {
                ...this.permissionStates,
                microphone: { status: 'granted', stream },
            };
        } catch (error) {
            this.permissionStates = {
                ...this.permissionStates,
                microphone: { status: 'denied', stream: null },
            };
            this.errorMessage = 'Microphone permission was denied. You can continue but voice input will not work.';
        }
    }

    async startCountdown() {
        this.countdownNumber = 3;

        for (let i = 3; i >= 1; i--) {
            this.countdownNumber = i;
            await this.delay(1000);
        }

        this.countdownNumber = 0;
        await this.delay(500);

        // Complete wizard and pass media streams
        this.onComplete({
            screenStream: this.permissionStates.screen.stream,
            microphoneStream: this.permissionStates.microphone.stream,
        });
    }

    handleRetryPreflight() {
        this.preflightChecks = {
            apiKey: { status: 'pending', message: '' },
            browser: { status: 'pending', message: '' },
            connection: { status: 'pending', message: '' },
        };
        this.runPreflightChecks();
    }

    handleBack() {
        if (this.currentStep > 1) {
            this.currentStep--;
            this.errorMessage = '';
        }
    }

    handleCancel() {
        // Clean up any granted permissions
        if (this.permissionStates.screen.stream) {
            this.permissionStates.screen.stream.getTracks().forEach(track => track.stop());
        }
        if (this.permissionStates.microphone.stream) {
            this.permissionStates.microphone.stream.getTracks().forEach(track => track.stop());
        }
        this.onCancel();
    }

    renderCheckIcon(status) {
        if (status === 'checking') {
            return html`<div class="spinner"></div>`;
        } else if (status === 'success') {
            return html`
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20 6L9 17L4 12" stroke="#2ed573" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            `;
        } else if (status === 'error') {
            return html`
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6 6L18 18M6 18L18 6" stroke="#ff4757" stroke-width="3" stroke-linecap="round"/>
                </svg>
            `;
        }
        return html`
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
            </svg>
        `;
    }

    renderStep1() {
        return html`
            <div class="step-indicator">
                <div class="step-number">Step 1 of 3</div>
                <div class="step-title">Pre-flight Check</div>
                <div class="step-description">
                    Validating your setup before launch
                </div>
            </div>

            <div class="checks-container">
                <div class="check-item ${this.preflightChecks.apiKey.status}">
                    <div class="check-icon">
                        ${this.renderCheckIcon(this.preflightChecks.apiKey.status)}
                    </div>
                    <div class="check-details">
                        <div class="check-label">API Key Validation</div>
                        <div class="check-message">${this.preflightChecks.apiKey.message}</div>
                    </div>
                </div>

                <div class="check-item ${this.preflightChecks.browser.status}">
                    <div class="check-icon">
                        ${this.renderCheckIcon(this.preflightChecks.browser.status)}
                    </div>
                    <div class="check-details">
                        <div class="check-label">Browser Compatibility</div>
                        <div class="check-message">${this.preflightChecks.browser.message}</div>
                    </div>
                </div>

                <div class="check-item ${this.preflightChecks.connection.status}">
                    <div class="check-icon">
                        ${this.renderCheckIcon(this.preflightChecks.connection.status)}
                    </div>
                    <div class="check-details">
                        <div class="check-label">Connection Test</div>
                        <div class="check-message">${this.preflightChecks.connection.message}</div>
                    </div>
                </div>
            </div>

            <div class="wizard-actions">
                <button class="wizard-button secondary" @click=${this.handleCancel}>
                    Cancel
                </button>
                ${!this.canProceedFromStep1() ? html`
                    <button class="wizard-button secondary" @click=${this.handleRetryPreflight}>
                        Retry Checks
                    </button>
                ` : ''}
                <button
                    class="wizard-button primary"
                    @click=${this.handleNextStep}
                    ?disabled=${!this.canProceedFromStep1()}
                >
                    Continue
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M9 6L15 12L9 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
            </div>
        `;
    }

    renderStep2() {
        const audioMode = localStorage.getItem('audioMode') || 'speaker_only';
        const needsMicrophone = audioMode === 'mic_only' || audioMode === 'both';

        return html`
            <div class="step-indicator">
                <div class="step-number">Step 2 of 3</div>
                <div class="step-title">Permission Setup</div>
                <div class="step-description">
                    Grant required permissions to start your session
                </div>
            </div>

            <div class="permission-card">
                <div class="permission-title">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="3" y="3" width="18" height="14" rx="2" stroke="currentColor" stroke-width="2"/>
                        <path d="M8 21h8M12 17v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    Screen Sharing
                    <span class="permission-status ${this.permissionStates.screen.status}">
                        ${this.permissionStates.screen.status}
                    </span>
                </div>
                <div class="permission-description">
                    We need to capture your screen to provide AI assistance based on what you're seeing.
                    This allows the AI to understand the context and provide relevant help.
                </div>
                <div class="permission-example">
                    <div class="permission-example-title">What will be captured:</div>
                    <div class="permission-example-text">
                        • Screenshot of your screen at regular intervals<br>
                        • Visual content to analyze questions and problems<br>
                        • Your browser or application window content
                    </div>
                </div>
            </div>

            ${needsMicrophone ? html`
                <div class="permission-card">
                    <div class="permission-title">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect x="9" y="2" width="6" height="11" rx="3" stroke="currentColor" stroke-width="2"/>
                            <path d="M5 10v2a7 7 0 0014 0v-2M12 19v4M8 23h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                        Microphone Access
                        <span class="permission-status ${this.permissionStates.microphone.status}">
                            ${this.permissionStates.microphone.status}
                        </span>
                    </div>
                    <div class="permission-description">
                        Microphone access allows you to ask questions verbally and have conversations with the AI assistant.
                    </div>
                    <div class="permission-example">
                        <div class="permission-example-title">What will be captured:</div>
                        <div class="permission-example-text">
                            • Your voice input for questions<br>
                            • Audio conversations during interviews<br>
                            • Voice commands and queries
                        </div>
                    </div>
                </div>
            ` : html`
                <div class="info-box">
                    <strong>Note:</strong> Microphone permission is not required for your current audio mode (${audioMode}).
                    You can change this in the settings if needed.
                </div>
            `}

            ${this.errorMessage ? html`
                <div class="error-message">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                        <path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    ${this.errorMessage}
                </div>
            ` : ''}

            <div class="wizard-actions">
                <button class="wizard-button secondary" @click=${this.handleBack}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M15 6L9 12L15 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    Back
                </button>
                <button class="wizard-button secondary" @click=${this.handleCancel}>
                    Cancel
                </button>
                ${this.permissionStates.screen.status === 'denied' || this.permissionStates.microphone.status === 'denied' ? html`
                    <button class="wizard-button primary" @click=${this.requestAllPermissions}>
                        Retry Permissions
                    </button>
                ` : html`
                    <button class="wizard-button primary" @click=${this.handleNextStep}>
                        Grant Permissions
                    </button>
                `}
            </div>
        `;
    }

    renderStep3() {
        return html`
            <div class="countdown-container">
                ${this.countdownNumber > 0 ? html`
                    <div class="countdown-number">${this.countdownNumber}</div>
                    <div class="countdown-text">Get ready...</div>
                ` : html`
                    <div class="go-text">GO!</div>
                    <div class="countdown-text">Starting your session...</div>
                `}
            </div>
        `;
    }

    render() {
        return html`
            <div class="wizard-container">
                <div class="progress-bar-container">
                    <div class="progress-bar" style="width: ${this.getProgressPercentage()}%"></div>
                </div>

                <div class="wizard-content">
                    ${this.currentStep === 1 ? this.renderStep1() : ''}
                    ${this.currentStep === 2 ? this.renderStep2() : ''}
                    ${this.currentStep === 3 ? this.renderStep3() : ''}
                </div>
            </div>
        `;
    }
}

customElements.define('launch-wizard', LaunchWizard);
