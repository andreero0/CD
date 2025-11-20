import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';
import { StatusBar } from '../app/StatusBar.js';
import { ScreenshotFeedback } from './ScreenshotFeedback.js';
import { TranscriptPanel } from './TranscriptPanel.js';
import { ViewModeSwitcher } from './ViewModeSwitcher.js';

export class AssistantView extends LitElement {
    static styles = css`
        :host {
            height: 100%;
            display: flex;
            flex-direction: column;
            position: relative;
        }

        * {
            font-family: 'Inter', sans-serif;
            cursor: default;
        }

        .assistant-content {
            display: flex;
            gap: 12px;
            height: calc(100% - 100px);
            flex: 1;
        }

        .main-section {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-width: 0;
        }

        .transcript-section {
            width: 320px;
            transition: all 0.3s ease-out;
        }

        .transcript-section.hidden {
            width: 0;
            overflow: hidden;
            opacity: 0;
        }

        .response-container {
            flex: 1;
            overflow-y: auto;
            border-radius: 10px;
            font-size: var(--response-font-size, 18px);
            line-height: 1.6;
            background: var(--main-content-background);
            padding: 16px;
            scroll-behavior: smooth;
            user-select: text;
            cursor: text;
        }

        /* Allow text selection for all content within the response container */
        .response-container * {
            user-select: text;
            cursor: text;
        }

        /* Restore default cursor for interactive elements */
        .response-container a {
            cursor: pointer;
        }

        /* Animated word-by-word reveal */
        .response-container [data-word] {
            opacity: 0;
            filter: blur(10px);
            display: inline-block;
            transition: opacity 0.5s, filter 0.5s;
        }
        .response-container [data-word].visible {
            opacity: 1;
            filter: blur(0px);
        }

        /* Markdown styling */
        .response-container h1,
        .response-container h2,
        .response-container h3,
        .response-container h4,
        .response-container h5,
        .response-container h6 {
            margin: 1.2em 0 0.6em 0;
            color: var(--text-color);
            font-weight: 600;
        }

        .response-container h1 {
            font-size: 1.8em;
        }
        .response-container h2 {
            font-size: 1.5em;
        }
        .response-container h3 {
            font-size: 1.3em;
        }
        .response-container h4 {
            font-size: 1.1em;
        }
        .response-container h5 {
            font-size: 1em;
        }
        .response-container h6 {
            font-size: 0.9em;
        }

        .response-container p {
            margin: 0.8em 0;
            color: var(--text-color);
        }

        .response-container ul,
        .response-container ol {
            margin: 0.8em 0;
            padding-left: 2em;
            color: var(--text-color);
        }

        .response-container li {
            margin: 0.4em 0;
        }

        .response-container blockquote {
            margin: 1em 0;
            padding: 0.5em 1em;
            border-left: 4px solid var(--focus-border-color);
            background: rgba(0, 122, 255, 0.1);
            font-style: italic;
        }

        .response-container code {
            background: rgba(255, 255, 255, 0.1);
            padding: 0.2em 0.4em;
            border-radius: 3px;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 0.85em;
        }

        .response-container pre {
            background: var(--input-background);
            border: 1px solid var(--button-border);
            border-radius: 6px;
            padding: 1em;
            overflow-x: auto;
            margin: 1em 0;
        }

        .response-container pre code {
            background: none;
            padding: 0;
            border-radius: 0;
        }

        .response-container a {
            color: var(--link-color);
            text-decoration: none;
        }

        .response-container a:hover {
            text-decoration: underline;
        }

        .response-container strong,
        .response-container b {
            font-weight: 600;
            color: var(--text-color);
        }

        .response-container em,
        .response-container i {
            font-style: italic;
        }

        .response-container hr {
            border: none;
            border-top: 1px solid var(--border-color);
            margin: 2em 0;
        }

        .response-container table {
            border-collapse: collapse;
            width: 100%;
            margin: 1em 0;
        }

        .response-container th,
        .response-container td {
            border: 1px solid var(--border-color);
            padding: 0.5em;
            text-align: left;
        }

        .response-container th {
            background: var(--input-background);
            font-weight: 600;
        }

        .response-container::-webkit-scrollbar {
            width: 8px;
        }

        .response-container::-webkit-scrollbar-track {
            background: var(--scrollbar-track);
            border-radius: 4px;
        }

        .response-container::-webkit-scrollbar-thumb {
            background: var(--scrollbar-thumb);
            border-radius: 4px;
        }

        .response-container::-webkit-scrollbar-thumb:hover {
            background: var(--scrollbar-thumb-hover);
        }

        .text-input-container {
            display: flex;
            gap: 10px;
            margin-top: 10px;
            align-items: center;
        }

        .text-input-container input {
            flex: 1;
            background: var(--input-background);
            color: var(--text-color);
            border: 1px solid var(--button-border);
            padding: 10px 14px;
            border-radius: 8px;
            font-size: 14px;
        }

        .text-input-container input:focus {
            outline: none;
            border-color: var(--focus-border-color);
            box-shadow: 0 0 0 3px var(--focus-box-shadow);
            background: var(--input-focus-background);
        }

        .text-input-container input::placeholder {
            color: var(--placeholder-color);
        }

        .text-input-container button {
            background: transparent;
            color: var(--start-button-background);
            border: none;
            padding: 0;
            border-radius: 100px;
        }

        .text-input-container button:hover {
            background: var(--text-input-button-hover);
        }

        .nav-button {
            background: transparent;
            color: white;
            border: none;
            padding: 4px;
            border-radius: 50%;
            font-size: 12px;
            display: flex;
            align-items: center;
            width: 36px;
            height: 36px;
            justify-content: center;
        }

        .nav-button:hover {
            background: rgba(255, 255, 255, 0.1);
        }

        .nav-button:disabled {
            opacity: 0.3;
        }

        .nav-button svg {
            stroke: white !important;
        }

        .response-counter {
            font-size: 12px;
            color: var(--description-color);
            white-space: nowrap;
            min-width: 60px;
            text-align: center;
        }

        .save-button {
            background: transparent;
            color: var(--start-button-background);
            border: none;
            padding: 4px;
            border-radius: 50%;
            font-size: 12px;
            display: flex;
            align-items: center;
            width: 36px;
            height: 36px;
            justify-content: center;
            cursor: pointer;
        }

        .save-button:hover {
            background: rgba(255, 255, 255, 0.1);
        }

        .save-button.saved {
            color: #4caf50;
        }

        .save-button svg {
            stroke: currentColor !important;
        }

        /* View Mode Styles */
        .toolbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            margin-bottom: 8px;
        }

        .toolbar.minimal-mode {
            display: none;
        }

        /* Minimal Mode - Clean, distraction-free */
        :host(.minimal-mode) .assistant-content {
            height: calc(100% - 80px);
        }

        :host(.minimal-mode) .response-container {
            font-size: var(--response-font-size, 24px);
            padding: 32px;
        }

        :host(.minimal-mode) .text-input-container {
            opacity: 0.3;
            transition: opacity 0.3s ease;
        }

        :host(.minimal-mode) .text-input-container:hover {
            opacity: 1;
        }

        /* Detailed Mode - All metadata visible */
        .response-metadata {
            display: none;
            background: var(--input-background);
            border: 1px solid var(--button-border);
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 12px;
            font-size: 13px;
        }

        :host(.detailed-mode) .response-metadata {
            display: block;
        }

        .metadata-question {
            font-weight: 600;
            color: var(--text-color);
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .metadata-timing {
            display: flex;
            gap: 16px;
            color: var(--description-color);
            font-size: 12px;
            margin-bottom: 8px;
        }

        .metadata-tags {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
        }

        .tag {
            background: var(--focus-border-color);
            color: white;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 500;
        }

        .action-buttons {
            display: none;
            gap: 8px;
            margin-top: 12px;
        }

        :host(.detailed-mode) .action-buttons {
            display: flex;
        }

        .action-btn {
            background: var(--input-background);
            color: var(--text-color);
            border: 1px solid var(--button-border);
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .action-btn:hover {
            background: var(--input-focus-background);
            border-color: var(--focus-border-color);
        }

        /* Split-Screen Mode - List + Detail */
        :host(.split-mode) .assistant-content {
            flex-direction: row;
            gap: 16px;
        }

        .response-list {
            display: none;
            width: 300px;
            background: var(--input-background);
            border-radius: 10px;
            padding: 12px;
            overflow-y: auto;
            flex-shrink: 0;
        }

        :host(.split-mode) .response-list {
            display: block;
        }

        .response-list-header {
            font-weight: 600;
            font-size: 14px;
            margin-bottom: 12px;
            color: var(--text-color);
        }

        .response-list-item {
            background: var(--main-content-background);
            border: 1px solid var(--button-border);
            border-radius: 8px;
            padding: 10px;
            margin-bottom: 8px;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .response-list-item:hover {
            border-color: var(--focus-border-color);
            background: var(--input-focus-background);
        }

        .response-list-item.active {
            border-color: var(--focus-border-color);
            background: var(--input-focus-background);
            box-shadow: 0 0 0 2px var(--focus-box-shadow);
        }

        .list-item-question {
            font-size: 12px;
            font-weight: 600;
            color: var(--text-color);
            margin-bottom: 4px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .list-item-preview {
            font-size: 11px;
            color: var(--description-color);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .list-item-meta {
            display: flex;
            justify-content: space-between;
            font-size: 10px;
            color: var(--description-color);
            margin-top: 6px;
        }

        :host(.split-mode) .main-section {
            flex: 1;
            min-width: 0;
        }
    `;

    static properties = {
        responses: { type: Array },
        currentResponseIndex: { type: Number },
        selectedProfile: { type: String },
        onSendText: { type: Function },
        shouldAnimateResponse: { type: Boolean },
        savedResponses: { type: Array },
        startTime: { type: Number },
        screenshotInterval: { type: String },
        showTranscript: { type: Boolean },
        viewMode: { type: String },
    };

    constructor() {
        super();
        this.responses = [];
        this.currentResponseIndex = -1;
        this.selectedProfile = 'interview';
        this.onSendText = () => {};
        this._lastAnimatedWordCount = 0;
        this.startTime = 0;
        this.screenshotInterval = '5';
        this.showTranscript = localStorage.getItem('showTranscript') !== 'false'; // Show by default
        this.viewMode = localStorage.getItem('viewMode') || 'minimal';
        // Load saved responses from localStorage
        try {
            this.savedResponses = JSON.parse(localStorage.getItem('savedResponses') || '[]');
        } catch (e) {
            this.savedResponses = [];
        }
        this.boundKeyHandler = this.handleViewModeKeyboard.bind(this);
    }

    getProfileNames() {
        return {
            interview: 'Job Interview',
            sales: 'Sales Call',
            meeting: 'Business Meeting',
            presentation: 'Presentation',
            negotiation: 'Negotiation',
            exam: 'Exam Assistant',
        };
    }

    getCurrentResponse() {
        const profileNames = this.getProfileNames();
        return this.responses.length > 0 && this.currentResponseIndex >= 0
            ? this.responses[this.currentResponseIndex]
            : `Hey, Im listening to your ${profileNames[this.selectedProfile] || 'session'}?`;
    }

    renderMarkdown(content) {
        // Check if marked is available
        if (typeof window !== 'undefined' && window.marked) {
            try {
                // Configure marked for better security and formatting
                window.marked.setOptions({
                    breaks: true,
                    gfm: true,
                    sanitize: false, // We trust the AI responses
                });
                let rendered = window.marked.parse(content);
                rendered = this.wrapWordsInSpans(rendered);
                return rendered;
            } catch (error) {
                console.warn('Error parsing markdown:', error);
                return content; // Fallback to plain text
            }
        }
        console.log('Marked not available, using plain text');
        return content; // Fallback if marked is not available
    }

    wrapWordsInSpans(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const tagsToSkip = ['PRE'];

        function wrap(node) {
            if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() && !tagsToSkip.includes(node.parentNode.tagName)) {
                const words = node.textContent.split(/(\s+)/);
                const frag = document.createDocumentFragment();
                words.forEach(word => {
                    if (word.trim()) {
                        const span = document.createElement('span');
                        span.setAttribute('data-word', '');
                        span.textContent = word;
                        frag.appendChild(span);
                    } else {
                        frag.appendChild(document.createTextNode(word));
                    }
                });
                node.parentNode.replaceChild(frag, node);
            } else if (node.nodeType === Node.ELEMENT_NODE && !tagsToSkip.includes(node.tagName)) {
                Array.from(node.childNodes).forEach(wrap);
            }
        }
        Array.from(doc.body.childNodes).forEach(wrap);
        return doc.body.innerHTML;
    }

    getResponseCounter() {
        return this.responses.length > 0 ? `${this.currentResponseIndex + 1}/${this.responses.length}` : '';
    }

    navigateToPreviousResponse() {
        if (this.currentResponseIndex > 0) {
            this.currentResponseIndex--;
            this.dispatchEvent(
                new CustomEvent('response-index-changed', {
                    detail: { index: this.currentResponseIndex },
                })
            );
            this.requestUpdate();
        }
    }

    navigateToNextResponse() {
        if (this.currentResponseIndex < this.responses.length - 1) {
            this.currentResponseIndex++;
            this.dispatchEvent(
                new CustomEvent('response-index-changed', {
                    detail: { index: this.currentResponseIndex },
                })
            );
            this.requestUpdate();
        }
    }

    scrollResponseUp() {
        const container = this.shadowRoot.querySelector('.response-container');
        if (container) {
            const scrollAmount = container.clientHeight * 0.3; // Scroll 30% of container height
            container.scrollTop = Math.max(0, container.scrollTop - scrollAmount);
        }
    }

    scrollResponseDown() {
        const container = this.shadowRoot.querySelector('.response-container');
        if (container) {
            const scrollAmount = container.clientHeight * 0.3; // Scroll 30% of container height
            container.scrollTop = Math.min(container.scrollHeight - container.clientHeight, container.scrollTop + scrollAmount);
        }
    }

    loadFontSize() {
        const fontSize = localStorage.getItem('fontSize');
        if (fontSize !== null) {
            const fontSizeValue = parseInt(fontSize, 10) || 20;
            const root = document.documentElement;
            root.style.setProperty('--response-font-size', `${fontSizeValue}px`);
        }
    }

    handleViewModeKeyboard(e) {
        // Only trigger if not typing in an input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }

        // M for Minimal, D for Detailed, S for Split
        if (e.key.toLowerCase() === 'm') {
            this.handleViewModeChange('minimal');
        } else if (e.key.toLowerCase() === 'd') {
            this.handleViewModeChange('detailed');
        } else if (e.key.toLowerCase() === 's') {
            this.handleViewModeChange('split');
        }
    }

    handleViewModeChange(mode) {
        this.viewMode = mode;
        localStorage.setItem('viewMode', mode);
        this.updateViewModeClass();
        this.requestUpdate();
    }

    updateViewModeClass() {
        // Remove all mode classes
        this.classList.remove('minimal-mode', 'detailed-mode', 'split-mode');
        // Add current mode class
        this.classList.add(`${this.viewMode}-mode`);
    }

    connectedCallback() {
        super.connectedCallback();

        // Load and apply font size
        this.loadFontSize();

        // Apply view mode class
        this.updateViewModeClass();

        // Add keyboard listener for view mode shortcuts
        document.addEventListener('keydown', this.boundKeyHandler);

        // Set up IPC listeners for keyboard shortcuts
        if (window.require) {
            const { ipcRenderer } = window.require('electron');

            this.handlePreviousResponse = () => {
                console.log('Received navigate-previous-response message');
                this.navigateToPreviousResponse();
            };

            this.handleNextResponse = () => {
                console.log('Received navigate-next-response message');
                this.navigateToNextResponse();
            };

            this.handleScrollUp = () => {
                console.log('Received scroll-response-up message');
                this.scrollResponseUp();
            };

            this.handleScrollDown = () => {
                console.log('Received scroll-response-down message');
                this.scrollResponseDown();
            };

            this.handleScreenshotCaptured = (event, imageData) => {
                console.log('Screenshot captured');
                const screenshotFeedback = this.shadowRoot.querySelector('screenshot-feedback');
                if (screenshotFeedback) {
                    screenshotFeedback.captureScreenshot(imageData);
                }
            };

            this.handleTranscriptUpdate = (event, transcript) => {
                console.log('Transcript update:', transcript);
                const transcriptPanel = this.shadowRoot.querySelector('transcript-panel');
                if (transcriptPanel) {
                    transcriptPanel.parseAndAddTranscript(transcript);
                }
            };

            ipcRenderer.on('navigate-previous-response', this.handlePreviousResponse);
            ipcRenderer.on('navigate-next-response', this.handleNextResponse);
            ipcRenderer.on('scroll-response-up', this.handleScrollUp);
            ipcRenderer.on('scroll-response-down', this.handleScrollDown);
            ipcRenderer.on('screenshot-captured', this.handleScreenshotCaptured);
            ipcRenderer.on('transcript-update', this.handleTranscriptUpdate);
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();

        // Remove keyboard listener
        document.removeEventListener('keydown', this.boundKeyHandler);

        // Clean up IPC listeners
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            if (this.handlePreviousResponse) {
                ipcRenderer.removeListener('navigate-previous-response', this.handlePreviousResponse);
            }
            if (this.handleNextResponse) {
                ipcRenderer.removeListener('navigate-next-response', this.handleNextResponse);
            }
            if (this.handleScrollUp) {
                ipcRenderer.removeListener('scroll-response-up', this.handleScrollUp);
            }
            if (this.handleScrollDown) {
                ipcRenderer.removeListener('scroll-response-down', this.handleScrollDown);
            }
            if (this.handleScreenshotCaptured) {
                ipcRenderer.removeListener('screenshot-captured', this.handleScreenshotCaptured);
            }
            if (this.handleTranscriptUpdate) {
                ipcRenderer.removeListener('transcript-update', this.handleTranscriptUpdate);
            }
        }
    }

    toggleTranscript() {
        this.showTranscript = !this.showTranscript;
        localStorage.setItem('showTranscript', this.showTranscript.toString());
        this.requestUpdate();
    }

    async handleSendText() {
        const textInput = this.shadowRoot.querySelector('#textInput');
        if (textInput && textInput.value.trim()) {
            const message = textInput.value.trim();
            textInput.value = ''; // Clear input
            await this.onSendText(message);
        }
    }

    handleTextKeydown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.handleSendText();
        }
    }

    scrollToBottom() {
        setTimeout(() => {
            const container = this.shadowRoot.querySelector('.response-container');
            if (container) {
                container.scrollTop = container.scrollHeight;
            }
        }, 0);
    }

    saveCurrentResponse() {
        const currentResponse = this.getCurrentResponse();
        if (currentResponse && !this.isResponseSaved()) {
            this.savedResponses = [
                ...this.savedResponses,
                {
                    response: currentResponse,
                    timestamp: new Date().toISOString(),
                    profile: this.selectedProfile,
                },
            ];
            // Save to localStorage for persistence
            localStorage.setItem('savedResponses', JSON.stringify(this.savedResponses));
            this.requestUpdate();
        }
    }

    isResponseSaved() {
        const currentResponse = this.getCurrentResponse();
        return this.savedResponses.some(saved => saved.response === currentResponse);
    }

    prefersReducedMotion() {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    firstUpdated() {
        super.firstUpdated();
        this.updateResponseContent();
    }

    updated(changedProperties) {
        super.updated(changedProperties);
        if (changedProperties.has('responses') || changedProperties.has('currentResponseIndex')) {
            if (changedProperties.has('currentResponseIndex')) {
                this._lastAnimatedWordCount = 0;
            }
            this.updateResponseContent();
        }
    }

    getResponseContext(index) {
        if (!window.responseContext) return null;
        const responseId = `response_${index}`;
        return window.responseContext.getContext(responseId);
    }

    handleCopyResponse() {
        const currentResponse = this.getCurrentResponse();
        if (navigator.clipboard) {
            navigator.clipboard.writeText(currentResponse);
        }
    }

    handleExportResponse() {
        const currentResponse = this.getCurrentResponse();
        const context = this.getResponseContext(this.currentResponseIndex);

        const exportData = {
            question: context?.question || 'Voice/Screen Question',
            answer: currentResponse,
            timestamp: new Date().toISOString(),
            tags: context?.tags || [],
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `response_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    handleSelectResponse(index) {
        this.currentResponseIndex = index;
        this.dispatchEvent(
            new CustomEvent('response-index-changed', {
                detail: { index },
            })
        );
        this.requestUpdate();
    }

    updateResponseContent() {
        console.log('updateResponseContent called');
        const container = this.shadowRoot.querySelector('#responseContainer');
        if (container) {
            const currentResponse = this.getCurrentResponse();
            console.log('Current response:', currentResponse);
            const renderedResponse = this.renderMarkdown(currentResponse);
            console.log('Rendered response:', renderedResponse);
            container.innerHTML = renderedResponse;
            const words = container.querySelectorAll('[data-word]');

            // Skip animation if user prefers reduced motion
            const shouldSkipAnimation = this.prefersReducedMotion();

            if (this.shouldAnimateResponse && !shouldSkipAnimation) {
                for (let i = 0; i < this._lastAnimatedWordCount && i < words.length; i++) {
                    words[i].classList.add('visible');
                }
                for (let i = this._lastAnimatedWordCount; i < words.length; i++) {
                    words[i].classList.remove('visible');
                    setTimeout(() => {
                        words[i].classList.add('visible');
                        if (i === words.length - 1) {
                            this.dispatchEvent(new CustomEvent('response-animation-complete', { bubbles: true, composed: true }));
                        }
                    }, (i - this._lastAnimatedWordCount) * 100);
                }
                this._lastAnimatedWordCount = words.length;
            } else {
                // Instantly show all words if reduced motion is preferred or animation is disabled
                words.forEach(word => word.classList.add('visible'));
                this._lastAnimatedWordCount = words.length;
                if (this.shouldAnimateResponse) {
                    // Dispatch completion event immediately when animation is skipped
                    this.dispatchEvent(new CustomEvent('response-animation-complete', { bubbles: true, composed: true }));
                }
            }
        } else {
            console.log('Response container not found');
        }
    }

    renderMetadata() {
        const context = this.getResponseContext(this.currentResponseIndex);
        if (!context && !window.responseContext) return html``;

        const question = context?.question || 'Voice/Screen Question';
        const timeAgo = context ? window.responseContext.formatTimeAgo(context.askedAt) : 'Just now';
        const genTime = context ? window.responseContext.formatGenerationTime(context.generationTime) : '0s';
        const tags = context?.tags || [];

        return html`
            <div class="response-metadata">
                <div class="metadata-question">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle cx="12" cy="12" r="10" stroke-width="2"></circle>
                        <path d="M9 9h6v6h-6z" stroke-width="2"></path>
                    </svg>
                    Question: "${question}"
                </div>
                <div class="metadata-timing">
                    <span>Asked: ${timeAgo}</span>
                    <span>Generated in: ${genTime}</span>
                </div>
                <div class="metadata-tags">
                    ${tags.map(tag => html`<span class="tag">#${tag}</span>`)}
                </div>
            </div>
        `;
    }

    renderActionButtons() {
        return html`
            <div class="action-buttons">
                <button class="action-btn" @click=${this.handleCopyResponse} title="Copy response">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke-width="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke-width="2"></path>
                    </svg>
                    Copy
                </button>
                <button class="action-btn" @click=${this.handleExportResponse} title="Export response">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke-width="2"></path>
                        <polyline points="7 10 12 15 17 10" stroke-width="2"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3" stroke-width="2"></line>
                    </svg>
                    Export
                </button>
                <button class="action-btn saved" @click=${this.saveCurrentResponse} title="Star response">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="${this.isResponseSaved() ? 'currentColor' : 'none'}" stroke="currentColor">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke-width="2"></polygon>
                    </svg>
                    Star
                </button>
            </div>
        `;
    }

    renderResponseList() {
        return html`
            <div class="response-list">
                <div class="response-list-header">Responses (${this.responses.length})</div>
                ${this.responses.map((response, index) => {
                    const context = this.getResponseContext(index);
                    const question = context?.question || 'Voice/Screen Question';
                    const preview = response.substring(0, 50) + (response.length > 50 ? '...' : '');
                    const timeAgo = context && window.responseContext
                        ? window.responseContext.formatTimeAgo(context.askedAt)
                        : 'Recently';

                    return html`
                        <div
                            class="response-list-item ${index === this.currentResponseIndex ? 'active' : ''}"
                            @click=${() => this.handleSelectResponse(index)}
                        >
                            <div class="list-item-question">${question}</div>
                            <div class="list-item-preview">${preview}</div>
                            <div class="list-item-meta">
                                <span>#${index + 1}</span>
                                <span>${timeAgo}</span>
                            </div>
                        </div>
                    `;
                })}
            </div>
        `;
    }

    render() {
        const currentResponse = this.getCurrentResponse();
        const responseCounter = this.getResponseCounter();
        const isSaved = this.isResponseSaved();

        return html`
            <!-- Screenshot feedback overlay -->
            <screenshot-feedback></screenshot-feedback>

            <status-bar
                .sessionStartTime=${this.startTime}
                .screenshotInterval=${parseInt(this.screenshotInterval) || 5}
                .responseCount=${this.responses.length}
            ></status-bar>

            <!-- Toolbar with view mode switcher -->
            <div class="toolbar ${this.viewMode === 'minimal' ? 'minimal-mode' : ''}">
                <view-mode-switcher
                    .currentMode=${this.viewMode}
                    .onModeChange=${(mode) => this.handleViewModeChange(mode)}
                ></view-mode-switcher>
            </div>

            <div class="assistant-content">
                <!-- Response list for split-screen mode -->
                ${this.viewMode === 'split' ? this.renderResponseList() : ''}

                <div class="main-section">
                    <!-- Metadata for detailed mode -->
                    ${this.viewMode === 'detailed' ? this.renderMetadata() : ''}

                    <div
                        class="response-container"
                        id="responseContainer"
                        role="status"
                        aria-live="polite"
                        aria-atomic="true"
                        aria-label="AI response"
                    ></div>

                    <!-- Action buttons for detailed mode -->
                    ${this.viewMode === 'detailed' ? this.renderActionButtons() : ''}
                </div>

                <!-- Transcript panel -->
                <div class="transcript-section ${this.showTranscript ? '' : 'hidden'}">
                    <transcript-panel></transcript-panel>
                </div>
            </div>

            <div class="text-input-container">
                <button
                    class="nav-button"
                    @click=${this.navigateToPreviousResponse}
                    ?disabled=${this.currentResponseIndex <= 0}
                    aria-label="Previous response"
                >
                    <?xml version="1.0" encoding="UTF-8"?><svg
                        width="24px"
                        height="24px"
                        stroke-width="1.7"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        color="#ffffff"
                        aria-hidden="true"
                    >
                        <path d="M15 6L9 12L15 18" stroke="#ffffff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"></path>
                    </svg>
                </button>

                ${this.responses.length > 0 ? html` <span class="response-counter" role="status" aria-live="polite" aria-label="Response counter">${responseCounter}</span> ` : ''}

                <button
                    class="save-button ${isSaved ? 'saved' : ''}"
                    @click=${this.saveCurrentResponse}
                    title="${isSaved ? 'Response saved' : 'Save this response'}"
                    aria-label="${isSaved ? 'Response saved' : 'Save this response'}"
                >
                    <?xml version="1.0" encoding="UTF-8"?><svg
                        width="24px"
                        height="24px"
                        stroke-width="1.7"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                    >
                        <path
                            d="M5 20V5C5 3.89543 5.89543 3 7 3H16.1716C16.702 3 17.2107 3.21071 17.5858 3.58579L19.4142 5.41421C19.7893 5.78929 20 6.29799 20 6.82843V20C20 21.1046 19.1046 22 18 22H7C5.89543 22 5 21 5 20Z"
                            stroke="currentColor"
                            stroke-width="1.7"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        ></path>
                        <path d="M15 22V13H9V22" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"></path>
                        <path d="M9 3V8H15" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"></path>
                    </svg>
                </button>

                <button
                    class="save-button"
                    @click=${this.toggleTranscript}
                    title="${this.showTranscript ? 'Hide transcript' : 'Show transcript'}"
                    aria-label="${this.showTranscript ? 'Hide transcript' : 'Show transcript'}"
                >
                    <span style="font-size: 16px;">${this.showTranscript ? 'Hide' : 'Show'}</span>
                </button>

                <input
                    type="text"
                    id="textInput"
                    placeholder="Type a message to the AI..."
                    @keydown=${this.handleTextKeydown}
                    aria-label="Message input"
                />

                <button
                    class="nav-button"
                    @click=${this.navigateToNextResponse}
                    ?disabled=${this.currentResponseIndex >= this.responses.length - 1}
                    aria-label="Next response"
                >
                    <?xml version="1.0" encoding="UTF-8"?><svg
                        width="24px"
                        height="24px"
                        stroke-width="1.7"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        color="#ffffff"
                        aria-hidden="true"
                    >
                        <path d="M9 6L15 12L9 18" stroke="#ffffff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"></path>
                    </svg>
                </button>
            </div>
        `;
    }
}

customElements.define('assistant-view', AssistantView);
