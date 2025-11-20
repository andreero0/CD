import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';
import { AppHeader } from './AppHeader.js';
import { MainView } from '../views/MainView.js';
import { CustomizeView } from '../views/CustomizeView.js';
import { HelpView } from '../views/HelpView.js';
import { HistoryView } from '../views/HistoryView.js';
import { AssistantView } from '../views/AssistantView.js';
import { OnboardingView } from '../views/OnboardingView.js';
import { AdvancedView } from '../views/AdvancedView.js';
import { LaunchWizard } from '../views/LaunchWizard.js';
import { ReconnectionOverlay } from '../views/ReconnectionOverlay.js';
import { SessionEndDialog } from '../views/SessionEndDialog.js';
import { ErrorNotification } from '../views/ErrorNotification.js';
import { DocumentsView } from '../views/DocumentsView.js';

export class CheatingDaddyApp extends LitElement {
    static styles = css`
        * {
            box-sizing: border-box;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            margin: 0px;
            padding: 0px;
            cursor: default;
            user-select: none;
        }

        :host {
            display: block;
            width: 100%;
            height: 100vh;
            background-color: var(--background-transparent);
            color: var(--text-color);
        }

        .window-container {
            height: 100vh;
            border-radius: 7px;
            overflow: hidden;
        }

        .container {
            display: flex;
            flex-direction: column;
            height: 100%;
        }

        .main-content {
            flex: 1;
            padding: var(--main-content-padding);
            overflow-y: auto;
            margin-top: var(--main-content-margin-top);
            border-radius: var(--content-border-radius);
            transition: all 0.15s ease-out;
            background: var(--main-content-background);
        }

        .main-content.with-border {
            border: 1px solid var(--border-color);
        }

        .main-content.assistant-view {
            padding: 10px;
            border: none;
        }

        .main-content.onboarding-view {
            padding: 0;
            border: none;
            background: transparent;
        }

        .main-content.wizard-view {
            padding: 0;
            border: none;
            background: transparent;
        }

        .view-container {
            opacity: 1;
            transform: translateY(0);
            transition: opacity 0.15s ease-out, transform 0.15s ease-out;
            height: 100%;
        }

        .view-container.entering {
            opacity: 0;
            transform: translateY(10px);
        }

        ::-webkit-scrollbar {
            width: 6px;
            height: 6px;
        }

        ::-webkit-scrollbar-track {
            background: var(--scrollbar-background);
            border-radius: 3px;
        }

        ::-webkit-scrollbar-thumb {
            background: var(--scrollbar-thumb);
            border-radius: 3px;
        }

        ::-webkit-scrollbar-thumb:hover {
            background: var(--scrollbar-thumb-hover);
        }
    `;

    static properties = {
        currentView: { type: String },
        statusText: { type: String },
        startTime: { type: Number },
        isRecording: { type: Boolean },
        sessionActive: { type: Boolean },
        selectedProfile: { type: String },
        selectedLanguage: { type: String },
        responses: { type: Array },
        currentResponseIndex: { type: Number },
        selectedScreenshotInterval: { type: String },
        selectedImageQuality: { type: String },
        layoutMode: { type: String },
        advancedMode: { type: Boolean },
        _viewInstances: { type: Object, state: true },
        _isClickThrough: { state: true },
        _awaitingNewResponse: { state: true },
        shouldAnimateResponse: { type: Boolean },
        showReconnectionOverlay: { type: Boolean, state: true },
        reconnectionData: { type: Object, state: true },
        showSessionEndDialog: { type: Boolean, state: true },
        sessionSummary: { type: Object, state: true },
    };

    constructor() {
        super();
        this.currentView = localStorage.getItem('onboardingCompleted') ? 'main' : 'onboarding';
        this.statusText = '';
        this.startTime = null;
        this.isRecording = false;
        this.sessionActive = false;
        this.selectedProfile = localStorage.getItem('selectedProfile') || 'interview';
        this.selectedLanguage = localStorage.getItem('selectedLanguage') || 'en-US';
        this.selectedScreenshotInterval = localStorage.getItem('selectedScreenshotInterval') || '5';
        this.selectedImageQuality = localStorage.getItem('selectedImageQuality') || 'medium';
        this.layoutMode = localStorage.getItem('layoutMode') || 'normal';
        this.advancedMode = localStorage.getItem('advancedMode') === 'true';
        this.responses = [];
        this.currentResponseIndex = -1;
        this._viewInstances = new Map();
        this._isClickThrough = false;
        this._awaitingNewResponse = false;
        this._currentResponseIsComplete = true;
        this.shouldAnimateResponse = false;
        this.showReconnectionOverlay = false;
        this.reconnectionData = { attempt: 0, maxAttempts: 3, secondsUntilRetry: 0, isRetrying: false };
        this.showSessionEndDialog = false;
        this.sessionSummary = null;

        // Initialize error notification ref
        this.errorNotificationRef = null;

        // Apply layout mode to document root
        this.updateLayoutMode();
    }

    connectedCallback() {
        super.connectedCallback();

        // Set up IPC listeners if needed
        if (window.electron) {
            const ipcRenderer = window.electron;
            ipcRenderer.on('update-response', (response) => {
                this.setResponse(response);
            });
            ipcRenderer.on('update-status', (status) => {
                this.setStatus(status);
            });
            ipcRenderer.on('click-through-toggled', (isEnabled) => {
                this._isClickThrough = isEnabled;
            });

            // Reconnection event listeners
            ipcRenderer.on('reconnection-status', (data) => {
                this.showReconnectionOverlay = true;
                this.reconnectionData = { ...data, hasError: false };
                this.requestUpdate();
            });

            ipcRenderer.on('reconnection-success', (data) => {
                this.showReconnectionOverlay = false;
                this.addErrorNotification({
                    type: 'info',
                    title: 'Connected',
                    message: data.message,
                });
                this.requestUpdate();
            });

            ipcRenderer.on('reconnection-failed', (data) => {
                this.reconnectionData = {
                    ...this.reconnectionData,
                    hasError: true,
                    errorMessage: data.message,
                };
                this.requestUpdate();
            });

            ipcRenderer.on('reconnection-error', (data) => {
                this.reconnectionData = {
                    ...data,
                    hasError: true,
                    errorMessage: data.error,
                    isRetrying: false,
                };
                this.requestUpdate();
            });
        }

        // Initialize session stats when starting a session
        if (window.sessionStats) {
            window.sessionStats.start();
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (window.electron) {
            const ipcRenderer = window.electron;
            ipcRenderer.removeAllListeners('update-response');
            ipcRenderer.removeAllListeners('update-status');
            ipcRenderer.removeAllListeners('click-through-toggled');
            ipcRenderer.removeAllListeners('reconnection-status');
            ipcRenderer.removeAllListeners('reconnection-success');
            ipcRenderer.removeAllListeners('reconnection-failed');
            ipcRenderer.removeAllListeners('reconnection-error');
        }
    }

    // Helper method to add error notifications
    addErrorNotification(notification) {
        const errorNotificationElement = this.shadowRoot?.querySelector('error-notification');
        if (errorNotificationElement) {
            errorNotificationElement.addNotification(notification);
        }
    }

    // Reconnection overlay handlers
    handleReconnectionRetry() {
        // Trigger manual retry
        if (window.electron) {
            const ipcRenderer = window.electron;
            ipcRenderer.invoke('retry-connection');
        }
    }

    handleReconnectionCancel() {
        this.showReconnectionOverlay = false;
        this.handleClose();
    }

    // Session end dialog handlers
    handleSessionEndRequest() {
        if (!window.sessionStats) {
            // If stats not available, just close
            this.handleClose();
            return;
        }

        this.sessionSummary = window.sessionStats.getSummary();
        this.showSessionEndDialog = true;
        this.requestUpdate();
    }

    async handleExportPDF() {
        // TODO: Implement PDF export functionality
        this.addErrorNotification({
            type: 'info',
            title: 'Export PDF',
            message: 'PDF export feature coming soon!',
        });
        this.showSessionEndDialog = false;
    }

    async handleSaveToHistory() {
        if (window.sessionStats) {
            const sessionData = window.sessionStats.exportSession();

            // Save to IndexedDB via the existing conversation storage
            if (window.cheddar) {
                try {
                    await window.cheddar.initConversationStorage();
                    const sessionId = Date.now().toString();

                    // Get the conversation session and add our stats
                    if (window.electron) {
                        const ipcRenderer = window.electron;
                        const result = await ipcRenderer.invoke('get-current-session');
                        if (result.success) {
                            // Merge the session data
                            const fullSessionData = {
                                sessionId: sessionId,
                                timestamp: parseInt(sessionId),
                                conversationHistory: result.data?.conversationHistory || [],
                                ...sessionData,
                                lastUpdated: Date.now(),
                            };

                            // Actually save to IndexedDB
                            await window.cheddar.saveConversationSession(sessionId, fullSessionData.conversationHistory);
                            console.log('Saved session to history:', sessionId);
                        }
                    }

                    this.addErrorNotification({
                        type: 'info',
                        title: 'Saved',
                        message: 'Session saved to history',
                    });
                } catch (error) {
                    console.error('Error saving session:', error);
                    this.addErrorNotification({
                        type: 'error',
                        title: 'Save Failed',
                        message: 'Failed to save session to history',
                    });
                }
            }
        }

        this.showSessionEndDialog = false;
        await this.handleCloseSession();
    }

    async handleEndWithoutSaving() {
        this.showSessionEndDialog = false;
        await this.handleCloseSession();
    }

    handleCancelSessionEnd() {
        this.showSessionEndDialog = false;
        this.requestUpdate();
    }

    async handleCloseSession() {
        cheddar.stopCapture();

        // Close the session
        if (window.electron) {
            const ipcRenderer = window.electron;
            await ipcRenderer.invoke('close-session');
        }

        if (window.sessionStats) {
            window.sessionStats.end();
        }

        this.sessionActive = false;
        this.currentView = 'main';
        console.log('Session closed');
    }

    setStatus(text) {
        this.statusText = text;
        
        // Mark response as complete when we get certain status messages
        if (text.includes('Ready') || text.includes('Listening') || text.includes('Error')) {
            this._currentResponseIsComplete = true;
            console.log('[setStatus] Marked current response as complete');
        }
    }

    setResponse(response) {
        // Check if this looks like a filler response (very short responses to hmm, ok, etc)
        const isFillerResponse =
            response.length < 30 &&
            (response.toLowerCase().includes('hmm') ||
                response.toLowerCase().includes('okay') ||
                response.toLowerCase().includes('next') ||
                response.toLowerCase().includes('go on') ||
                response.toLowerCase().includes('continue'));

        if (this._awaitingNewResponse || this.responses.length === 0) {
            // Always add as new response when explicitly waiting for one
            this.responses = [...this.responses, response];
            this.currentResponseIndex = this.responses.length - 1;
            this._awaitingNewResponse = false;
            this._currentResponseIsComplete = false;
            console.log('[setResponse] Pushed new response:', response);

            // Track in session stats
            if (window.sessionStats) {
                window.sessionStats.analyzeResponse(response);
            }

            // Link response to question context
            if (window.responseContext) {
                const responseId = `response_${this.currentResponseIndex}`;
                window.responseContext.linkResponse(responseId, response);
            }
        } else if (!this._currentResponseIsComplete && !isFillerResponse && this.responses.length > 0) {
            // For substantial responses, update the last one (streaming behavior)
            // Only update if the current response is not marked as complete
            this.responses = [...this.responses.slice(0, this.responses.length - 1), response];
            console.log('[setResponse] Updated last response:', response);

            // Update the linked response context
            if (window.responseContext && this.currentResponseIndex >= 0) {
                const responseId = `response_${this.currentResponseIndex}`;
                const existingContext = window.responseContext.getContext(responseId);
                if (existingContext) {
                    existingContext.responseText = response;
                }
            }
        } else {
            // For filler responses or when current response is complete, add as new
            this.responses = [...this.responses, response];
            this.currentResponseIndex = this.responses.length - 1;
            this._currentResponseIsComplete = false;
            console.log('[setResponse] Added response as new:', response);

            // Track in session stats
            if (window.sessionStats) {
                window.sessionStats.analyzeResponse(response);
            }

            // Link response to question context
            if (window.responseContext) {
                const responseId = `response_${this.currentResponseIndex}`;
                window.responseContext.linkResponse(responseId, response);
            }
        }
        this.shouldAnimateResponse = true;
        this.requestUpdate();
    }

    // Header event handlers
    handleCustomizeClick() {
        this.currentView = 'customize';
        this.requestUpdate();
    }

    handleHelpClick() {
        this.currentView = 'help';
        this.requestUpdate();
    }

    handleHistoryClick() {
        this.currentView = 'history';
        this.requestUpdate();
    }

    handleAdvancedClick() {
        this.currentView = 'advanced';
        this.requestUpdate();
    }

    handleDocumentsClick() {
        this.currentView = 'documents';
        this.requestUpdate();
    }

    async handleClose() {
        if (this.currentView === 'customize' || this.currentView === 'help' || this.currentView === 'history' || this.currentView === 'documents') {
            this.currentView = 'main';
        } else if (this.currentView === 'assistant') {
            // Show session end dialog with summary
            this.handleSessionEndRequest();
        } else {
            // Quit the entire application
            if (window.electron) {
                const ipcRenderer = window.electron;
                await ipcRenderer.invoke('quit-application');
            }
        }
    }

    async handleHideToggle() {
        if (window.electron) {
            const ipcRenderer = window.electron;
            await ipcRenderer.invoke('toggle-window-visibility');
        }
    }

    // Main view event handlers
    async handleStart() {
        // check if api key is empty do nothing
        const apiKey = localStorage.getItem('apiKey')?.trim();
        if (!apiKey || apiKey === '') {
            // Trigger the red blink animation on the API key input
            const mainView = this.shadowRoot.querySelector('main-view');
            if (mainView && mainView.triggerApiKeyError) {
                mainView.triggerApiKeyError();
            }
            return;
        }

        // Show launch wizard instead of going directly to assistant view
        this.currentView = 'wizard';
    }

    async handleStartDemo() {
        // Set demo mode flag
        localStorage.setItem('demoMode', 'true');

        // Import demo data and set some sample responses
        try {
            const { demoResponses } = await import('../../demoData.js');

            // Set demo responses to show users what the app can do
            this.responses = demoResponses.slice(0, 3).map(demo =>
                `**Question:** ${demo.question}\n\n**With Context:**\n${demo.withContext}\n\n**Context Used:** ${demo.contextUsed}`
            );
            this.currentResponseIndex = 0;

            // Go directly to assistant view
            this.currentView = 'assistant';
            this.setStatus('Demo Mode - Showing sample responses');
        } catch (error) {
            console.error('Error loading demo data:', error);
            this.setStatus('Failed to start demo mode');
        }
    }

    // Launch wizard event handlers
    async handleWizardComplete(event) {
        const { screenStream, microphoneStream } = event.detail;

        // Initialize Gemini with selected profile and language
        await cheddar.initializeGemini(this.selectedProfile, this.selectedLanguage);

        // Start capture with the pre-approved media streams
        // Note: We'll need to update startCapture to optionally accept existing streams
        cheddar.startCapture(this.selectedScreenshotInterval, this.selectedImageQuality, screenStream, microphoneStream);

        this.responses = [];
        this.currentResponseIndex = -1;
        this.startTime = Date.now();
        this.currentView = 'assistant';
    }

    handleWizardCancel() {
        this.currentView = 'main';
    }

    async handleAPIKeyHelp() {
        if (window.electron) {
            const ipcRenderer = window.electron;
            await ipcRenderer.invoke('open-external', 'https://cheatingdaddy.com/help/api-key');
        }
    }

    // Customize view event handlers
    handleProfileChange(profile) {
        this.selectedProfile = profile;
    }

    handleLanguageChange(language) {
        this.selectedLanguage = language;
    }

    handleScreenshotIntervalChange(interval) {
        this.selectedScreenshotInterval = interval;
    }

    handleImageQualityChange(quality) {
        this.selectedImageQuality = quality;
        localStorage.setItem('selectedImageQuality', quality);
    }

    handleAdvancedModeChange(advancedMode) {
        this.advancedMode = advancedMode;
        localStorage.setItem('advancedMode', advancedMode.toString());
    }

    handleBackClick() {
        this.currentView = 'main';
        this.requestUpdate();
    }

    // Help view event handlers
    async handleExternalLinkClick(url) {
        if (window.electron) {
            const ipcRenderer = window.electron;
            await ipcRenderer.invoke('open-external', url);
        }
    }

    // Assistant view event handlers
    async handleSendText(message) {
        // Capture the question in response context
        if (window.responseContext) {
            window.responseContext.captureQuestion(message);
        }

        const result = await window.cheddar.sendTextMessage(message);

        if (!result.success) {
            console.error('Failed to send message:', result.error);
            this.setStatus('Error sending message: ' + result.error);
        } else {
            this.setStatus('Message sent...');
            this._awaitingNewResponse = true;
        }
    }

    handleResponseIndexChanged(e) {
        this.currentResponseIndex = e.detail.index;
        this.shouldAnimateResponse = false;
        this.requestUpdate();
    }

    // Onboarding event handlers
    handleOnboardingComplete() {
        this.currentView = 'main';
    }

    updated(changedProperties) {
        super.updated(changedProperties);

        // Only notify main process of view change if the view actually changed
        if (changedProperties.has('currentView') && window.electron) {
            const ipcRenderer = window.electron;
            ipcRenderer.send('view-changed', this.currentView);

            // Add a small delay to smooth out the transition
            const viewContainer = this.shadowRoot?.querySelector('.view-container');
            if (viewContainer) {
                viewContainer.classList.add('entering');
                requestAnimationFrame(() => {
                    viewContainer.classList.remove('entering');
                });
            }
        }

        // Only update localStorage when these specific properties change
        if (changedProperties.has('selectedProfile')) {
            localStorage.setItem('selectedProfile', this.selectedProfile);
        }
        if (changedProperties.has('selectedLanguage')) {
            localStorage.setItem('selectedLanguage', this.selectedLanguage);
        }
        if (changedProperties.has('selectedScreenshotInterval')) {
            localStorage.setItem('selectedScreenshotInterval', this.selectedScreenshotInterval);
        }
        if (changedProperties.has('selectedImageQuality')) {
            localStorage.setItem('selectedImageQuality', this.selectedImageQuality);
        }
        if (changedProperties.has('layoutMode')) {
            this.updateLayoutMode();
        }
        if (changedProperties.has('advancedMode')) {
            localStorage.setItem('advancedMode', this.advancedMode.toString());
        }
    }

    renderCurrentView() {
        // Only re-render the view if it hasn't been cached or if critical properties changed
        const viewKey = `${this.currentView}-${this.selectedProfile}-${this.selectedLanguage}`;

        switch (this.currentView) {
            case 'onboarding':
                return html`
                    <onboarding-view .onComplete=${() => this.handleOnboardingComplete()} .onClose=${() => this.handleClose()}></onboarding-view>
                `;

            case 'main':
                return html`
                    <main-view
                        .onStart=${() => this.handleStart()}
                        .onStartDemo=${() => this.handleStartDemo()}
                        .onAPIKeyHelp=${() => this.handleAPIKeyHelp()}
                        .onLayoutModeChange=${layoutMode => this.handleLayoutModeChange(layoutMode)}
                    ></main-view>
                `;

            case 'customize':
                return html`
                    <customize-view
                        .selectedProfile=${this.selectedProfile}
                        .selectedLanguage=${this.selectedLanguage}
                        .selectedScreenshotInterval=${this.selectedScreenshotInterval}
                        .selectedImageQuality=${this.selectedImageQuality}
                        .layoutMode=${this.layoutMode}
                        .advancedMode=${this.advancedMode}
                        .onProfileChange=${profile => this.handleProfileChange(profile)}
                        .onLanguageChange=${language => this.handleLanguageChange(language)}
                        .onScreenshotIntervalChange=${interval => this.handleScreenshotIntervalChange(interval)}
                        .onImageQualityChange=${quality => this.handleImageQualityChange(quality)}
                        .onLayoutModeChange=${layoutMode => this.handleLayoutModeChange(layoutMode)}
                        .onAdvancedModeChange=${advancedMode => this.handleAdvancedModeChange(advancedMode)}
                    ></customize-view>
                `;

            case 'help':
                return html` <help-view .onExternalLinkClick=${url => this.handleExternalLinkClick(url)}></help-view> `;

            case 'history':
                return html` <history-view></history-view> `;

            case 'advanced':
                return html` <advanced-view></advanced-view> `;

            case 'wizard':
                return html`
                    <launch-wizard
                        .profile=${this.selectedProfile}
                        .language=${this.selectedLanguage}
                        .onComplete=${(mediaStreams) => this.handleWizardComplete({ detail: mediaStreams })}
                        .onCancel=${() => this.handleWizardCancel()}
                    ></launch-wizard>
                `;

            case 'assistant':
                return html`
                    <assistant-view
                        .responses=${this.responses}
                        .currentResponseIndex=${this.currentResponseIndex}
                        .selectedProfile=${this.selectedProfile}
                        .startTime=${this.startTime}
                        .screenshotInterval=${this.selectedScreenshotInterval}
                        .onSendText=${message => this.handleSendText(message)}
                        .shouldAnimateResponse=${this.shouldAnimateResponse}
                        @response-index-changed=${this.handleResponseIndexChanged}
                        @response-animation-complete=${() => {
                            this.shouldAnimateResponse = false;
                            this._currentResponseIsComplete = true;
                            console.log('[response-animation-complete] Marked current response as complete');
                            this.requestUpdate();
                        }}
                    ></assistant-view>
                `;

            case 'documents':
                return html` <documents-view></documents-view> `;

            default:
                return html`<div>Unknown view: ${this.currentView}</div>`;
        }
    }

    render() {
        const mainContentClass = `main-content ${
            this.currentView === 'assistant' ? 'assistant-view' :
            this.currentView === 'onboarding' ? 'onboarding-view' :
            this.currentView === 'wizard' ? 'wizard-view' :
            'with-border'
        }`;

        return html`
            <div class="window-container">
                <div class="container">
                    <app-header
                        .currentView=${this.currentView}
                        .statusText=${this.statusText}
                        .startTime=${this.startTime}
                        .advancedMode=${this.advancedMode}
                        .onCustomizeClick=${() => this.handleCustomizeClick()}
                        .onHelpClick=${() => this.handleHelpClick()}
                        .onHistoryClick=${() => this.handleHistoryClick()}
                        .onDocumentsClick=${() => this.handleDocumentsClick()}
                        .onAdvancedClick=${() => this.handleAdvancedClick()}
                        .onCloseClick=${() => this.handleClose()}
                        .onBackClick=${() => this.handleBackClick()}
                        .onHideToggleClick=${() => this.handleHideToggle()}
                        ?isClickThrough=${this._isClickThrough}
                    ></app-header>
                    <div class="${mainContentClass}">
                        <div class="view-container">${this.renderCurrentView()}</div>
                    </div>
                </div>

                <!-- Error Notifications -->
                <error-notification></error-notification>

                <!-- Reconnection Overlay -->
                ${this.showReconnectionOverlay ? html`
                    <reconnection-overlay
                        .reconnectionAttempt=${this.reconnectionData.attempt}
                        .maxAttempts=${this.reconnectionData.maxAttempts}
                        .secondsUntilRetry=${this.reconnectionData.secondsUntilRetry}
                        .isRetrying=${this.reconnectionData.isRetrying}
                        .hasError=${this.reconnectionData.hasError}
                        .errorMessage=${this.reconnectionData.errorMessage}
                        .onRetry=${() => this.handleReconnectionRetry()}
                        .onCancel=${() => this.handleReconnectionCancel()}
                    ></reconnection-overlay>
                ` : ''}

                <!-- Session End Dialog -->
                ${this.showSessionEndDialog && this.sessionSummary ? html`
                    <session-end-dialog
                        .sessionDuration=${this.sessionSummary.duration}
                        .totalResponses=${this.sessionSummary.totalResponses}
                        .unsavedResponses=${this.sessionSummary.unsavedResponses}
                        .topics=${this.sessionSummary.topics}
                        .tokenUsage=${this.sessionSummary.tokenUsage}
                        .responses=${this.responses}
                        .sessionInfo=${{
                            timestamp: this.startTime,
                            startTime: this.startTime,
                            endTime: Date.now(),
                            topics: this.sessionSummary.topics
                        }}
                        .profile=${this.selectedProfile}
                        .onExportPDF=${() => this.handleExportPDF()}
                        .onSaveToHistory=${() => this.handleSaveToHistory()}
                        .onEndWithoutSaving=${() => this.handleEndWithoutSaving()}
                        .onCancel=${() => this.handleCancelSessionEnd()}
                    ></session-end-dialog>
                ` : ''}
            </div>
        `;
    }

    updateLayoutMode() {
        // Apply or remove compact layout class to document root
        if (this.layoutMode === 'compact') {
            document.documentElement.classList.add('compact-layout');
        } else {
            document.documentElement.classList.remove('compact-layout');
        }
    }

    async handleLayoutModeChange(layoutMode) {
        this.layoutMode = layoutMode;
        localStorage.setItem('layoutMode', layoutMode);
        this.updateLayoutMode();

        // Notify main process about layout change for window resizing
        if (window.electron) {
            try {
                const ipcRenderer = window.electron;
                await ipcRenderer.invoke('update-sizes');
            } catch (error) {
                console.error('Failed to update sizes in main process:', error);
            }
        }

        this.requestUpdate();
    }
}

customElements.define('cheating-daddy-app', CheatingDaddyApp);
