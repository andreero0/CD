import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';
import { TranscriptPanel } from './TranscriptPanel.js';

export class PracticeView extends LitElement {
    static styles = css`
        :host {
            display: flex;
            flex-direction: column;
            height: 100%;
            padding: 16px;
            gap: 16px;
        }

        * {
            font-family: 'Inter', sans-serif;
            cursor: default;
        }

        .practice-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px;
            background: var(--input-background);
            border-radius: 10px;
            border: 1px solid var(--border-color);
        }

        .header-title {
            font-size: 18px;
            font-weight: 600;
            color: var(--text-color);
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .mode-badge {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 4px 12px;
            border-radius: 16px;
            font-size: 12px;
            font-weight: 600;
        }

        .setup-container {
            display: flex;
            flex-direction: column;
            gap: 20px;
            padding: 24px;
            background: var(--input-background);
            border-radius: 10px;
            border: 1px solid var(--border-color);
        }

        .setup-row {
            display: flex;
            gap: 16px;
            align-items: flex-start;
        }

        .setup-group {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .setup-label {
            font-size: 13px;
            font-weight: 600;
            color: var(--text-color);
            margin-bottom: 4px;
        }

        .setup-description {
            font-size: 11px;
            color: var(--description-color);
            margin-bottom: 8px;
        }

        select, button {
            padding: 10px 14px;
            background: var(--main-content-background);
            color: var(--text-color);
            border: 1px solid var(--button-border);
            border-radius: 8px;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s;
        }

        select:hover, button:hover {
            border-color: var(--focus-border-color);
        }

        select:focus {
            outline: none;
            border-color: var(--focus-border-color);
            box-shadow: 0 0 0 3px var(--focus-box-shadow);
        }

        .start-button {
            background: var(--start-button-background);
            color: white;
            font-weight: 600;
            padding: 14px 32px;
            font-size: 15px;
            align-self: center;
            margin-top: 12px;
        }

        .start-button:hover {
            background: var(--start-button-hover);
        }

        .practice-content {
            display: flex;
            gap: 16px;
            flex: 1;
            min-height: 0;
        }

        .question-panel {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 16px;
            background: var(--input-background);
            border-radius: 10px;
            padding: 24px;
            border: 1px solid var(--border-color);
        }

        .question-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .question-counter {
            font-size: 13px;
            color: var(--description-color);
            font-weight: 500;
        }

        .question-text {
            font-size: 20px;
            line-height: 1.6;
            color: var(--text-color);
            padding: 24px;
            background: rgba(102, 126, 234, 0.1);
            border-left: 4px solid #667eea;
            border-radius: 8px;
            font-weight: 500;
        }

        .answer-section {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .answer-label {
            font-size: 14px;
            font-weight: 600;
            color: var(--text-color);
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .recording-indicator {
            display: inline-block;
            width: 8px;
            height: 8px;
            background: #ff3b30;
            border-radius: 50%;
            animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
        }

        .transcript-display {
            flex: 1;
            padding: 16px;
            background: var(--main-content-background);
            border: 1px solid var(--button-border);
            border-radius: 8px;
            overflow-y: auto;
            font-size: 14px;
            line-height: 1.6;
            color: var(--text-color);
            min-height: 100px;
        }

        .transcript-display:empty::before {
            content: 'Start speaking to see your answer here...';
            color: var(--placeholder-color);
            font-style: italic;
        }

        .feedback-panel {
            padding: 16px;
            background: rgba(52, 199, 89, 0.1);
            border-left: 4px solid #34c759;
            border-radius: 8px;
            font-size: 14px;
            color: var(--text-color);
        }

        .action-buttons {
            display: flex;
            gap: 12px;
            justify-content: center;
        }

        .next-button {
            background: var(--start-button-background);
            color: white;
            font-weight: 600;
        }

        .next-button:hover {
            background: var(--start-button-hover);
        }

        .end-button {
            background: transparent;
            border: 2px solid var(--border-color);
        }

        .end-button:hover {
            border-color: #ff3b30;
            color: #ff3b30;
        }

        .stats-panel {
            width: 280px;
            display: flex;
            flex-direction: column;
            gap: 16px;
        }

        .stat-card {
            background: var(--input-background);
            border: 1px solid var(--border-color);
            border-radius: 10px;
            padding: 16px;
        }

        .stat-title {
            font-size: 12px;
            color: var(--description-color);
            font-weight: 600;
            margin-bottom: 8px;
        }

        .stat-value {
            font-size: 24px;
            font-weight: 700;
            color: var(--text-color);
        }

        .stat-subtitle {
            font-size: 11px;
            color: var(--description-color);
            margin-top: 4px;
        }

        .summary-container {
            display: flex;
            flex-direction: column;
            gap: 20px;
            padding: 24px;
            background: var(--input-background);
            border-radius: 10px;
            border: 1px solid var(--border-color);
            text-align: center;
        }

        .summary-title {
            font-size: 24px;
            font-weight: 700;
            color: var(--text-color);
        }

        .summary-stats {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
            margin: 20px 0;
        }

        .summary-stat {
            padding: 16px;
            background: var(--main-content-background);
            border-radius: 8px;
        }

        .summary-stat-value {
            font-size: 28px;
            font-weight: 700;
            color: var(--start-button-background);
        }

        .summary-stat-label {
            font-size: 12px;
            color: var(--description-color);
            margin-top: 4px;
        }

        .transcript-section {
            width: 320px;
            min-width: 320px;
        }
    `;

    static properties = {
        isSessionActive: { type: Boolean },
        selectedProfile: { type: String },
        selectedDifficulty: { type: String },
        selectedFlow: { type: String },
        currentQuestion: { type: String },
        currentAnswer: { type: String },
        feedback: { type: String },
        sessionStats: { type: Object },
        showSummary: { type: Boolean },
        sessionSummary: { type: Object },
    };

    constructor() {
        super();
        this.isSessionActive = false;
        this.selectedProfile = 'interview';
        this.selectedDifficulty = 'medium';
        this.selectedFlow = 'structured';
        this.currentQuestion = '';
        this.currentAnswer = '';
        this.feedback = '';
        this.sessionStats = {
            questionsAsked: 0,
            questionsAnswered: 0,
            sessionDuration: 0,
        };
        this.showSummary = false;
        this.sessionSummary = null;

        // Load practice mode utility
        if (window.practiceModeInstance) {
            this.practiceMode = window.practiceModeInstance;
        }
    }

    connectedCallback() {
        super.connectedCallback();

        // Listen for transcript updates
        if (window.electron) {
            const ipcRenderer = window.electron;

            this.handleTranscriptUpdate = (transcriptData) => {
                if (this.isSessionActive) {
                    // Accumulate the answer
                    const text = typeof transcriptData === 'string' ? transcriptData : transcriptData.text;
                    this.currentAnswer += ' ' + text;
                    this.requestUpdate();
                }
            };

            ipcRenderer.on('transcript-update', this.handleTranscriptUpdate);
        }

        // Update stats every second
        this.statsInterval = setInterval(() => {
            if (this.isSessionActive && this.practiceMode) {
                this.sessionStats = this.practiceMode.getSessionStats();
                this.requestUpdate();
            }
        }, 1000);
    }

    disconnectedCallback() {
        super.disconnectedCallback();

        if (window.electron) {
            const ipcRenderer = window.electron;
            if (this.handleTranscriptUpdate) {
                ipcRenderer.off('transcript-update', this.handleTranscriptUpdate);
            }
        }

        if (this.statsInterval) {
            clearInterval(this.statsInterval);
        }
    }

    async handleStartSession() {
        if (!window.practiceModeInstance) {
            console.error('[PracticeView] Practice mode instance not found');
            return;
        }

        this.practiceMode = window.practiceModeInstance;

        // Start the practice session
        const firstQuestion = this.practiceMode.startPracticeSession(
            this.selectedProfile,
            this.selectedDifficulty,
            this.selectedFlow
        );

        if (firstQuestion) {
            this.currentQuestion = firstQuestion;
            this.currentAnswer = '';
            this.feedback = '';
            this.isSessionActive = true;
            this.showSummary = false;

            // Notify the app that we're in practice mode
            if (window.prism) {
                await window.prism.setPracticeModeEnabled(true);

                // Send the first question to the AI system
                await window.prism.sendPracticeModeQuestion(firstQuestion);
            }

            this.requestUpdate();
        }
    }

    async handleNextQuestion() {
        if (!this.practiceMode) return;

        // Evaluate the current answer
        const evaluation = this.practiceMode.evaluateAnswer(this.currentAnswer);
        this.feedback = this.practiceMode.provideFeedback(evaluation);

        // Get the next question
        const nextQuestion = this.practiceMode.getNextQuestion();

        if (nextQuestion) {
            // Move to next question
            this.currentQuestion = nextQuestion;
            this.currentAnswer = '';

            // Send the next question to AI
            if (window.prism) {
                await window.prism.sendPracticeModeQuestion(nextQuestion);
            }

            // Clear feedback after a delay
            setTimeout(() => {
                this.feedback = '';
                this.requestUpdate();
            }, 3000);
        } else {
            // No more questions - end session
            this.handleEndSession();
        }

        this.requestUpdate();
    }

    async handleEndSession() {
        if (!this.practiceMode) return;

        // Get session summary
        this.sessionSummary = this.practiceMode.endSession();
        this.isSessionActive = false;
        this.showSummary = true;

        // Disable practice mode
        if (window.prism) {
            await window.prism.setPracticeModeEnabled(false);
        }

        this.requestUpdate();
    }

    handleBackToSetup() {
        this.showSummary = false;
        this.isSessionActive = false;
        this.currentQuestion = '';
        this.currentAnswer = '';
        this.feedback = '';
        this.sessionSummary = null;
        this.requestUpdate();
    }

    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    renderSetup() {
        return html`
            <div class="setup-container">
                <div class="setup-row">
                    <div class="setup-group">
                        <div class="setup-label">Profile</div>
                        <div class="setup-description">Choose what type of conversation to practice</div>
                        <select @change=${(e) => this.selectedProfile = e.target.value} .value=${this.selectedProfile}>
                            <option value="interview">Job Interview</option>
                            <option value="sales">Sales Call</option>
                            <option value="negotiation">Negotiation</option>
                        </select>
                    </div>

                    <div class="setup-group">
                        <div class="setup-label">Difficulty</div>
                        <div class="setup-description">Select the challenge level</div>
                        <select @change=${(e) => this.selectedDifficulty = e.target.value} .value=${this.selectedDifficulty}>
                            <option value="easy">Easy - Basic questions</option>
                            <option value="medium">Medium - Standard questions</option>
                            <option value="hard">Hard - Complex scenarios</option>
                        </select>
                    </div>

                    <div class="setup-group">
                        <div class="setup-label">Flow</div>
                        <div class="setup-description">Choose the practice structure</div>
                        <select @change=${(e) => this.selectedFlow = e.target.value} .value=${this.selectedFlow}>
                            <option value="structured">Structured - Full interview flow</option>
                            <option value="rapid-fire">Rapid Fire - 10 quick questions</option>
                            <option value="deep-dive">Deep Dive - Single topic exploration</option>
                        </select>
                    </div>
                </div>

                <button class="start-button" @click=${this.handleStartSession}>
                    Start Practice Session
                </button>
            </div>
        `;
    }

    renderActiveSession() {
        return html`
            <div class="practice-content">
                <div class="question-panel">
                    <div class="question-header">
                        <div class="question-counter">
                            Question ${this.sessionStats.questionsAsked} • ${this.formatDuration(this.sessionStats.sessionDuration)}
                        </div>
                    </div>

                    <div class="question-text">
                        ${this.currentQuestion}
                    </div>

                    <div class="answer-section">
                        <div class="answer-label">
                            <span class="recording-indicator"></span>
                            Your Answer (speak naturally)
                        </div>
                        <div class="transcript-display">
                            ${this.currentAnswer}
                        </div>
                    </div>

                    ${this.feedback ? html`
                        <div class="feedback-panel">
                            ${this.feedback}
                        </div>
                    ` : ''}

                    <div class="action-buttons">
                        <button class="next-button" @click=${this.handleNextQuestion}>
                            Next Question
                        </button>
                        <button class="end-button" @click=${this.handleEndSession}>
                            End Session
                        </button>
                    </div>
                </div>

                <div class="stats-panel">
                    <div class="stat-card">
                        <div class="stat-title">Questions</div>
                        <div class="stat-value">${this.sessionStats.questionsAsked}</div>
                        <div class="stat-subtitle">${this.sessionStats.questionsAnswered} answered</div>
                    </div>

                    <div class="stat-card">
                        <div class="stat-title">Time</div>
                        <div class="stat-value">${this.formatDuration(this.sessionStats.sessionDuration)}</div>
                        <div class="stat-subtitle">Session duration</div>
                    </div>

                    <div class="stat-card">
                        <div class="stat-title">Mode</div>
                        <div class="stat-value">${this.selectedDifficulty}</div>
                        <div class="stat-subtitle">${this.selectedFlow}</div>
                    </div>

                    <!-- Transcript Panel -->
                    <div class="transcript-section">
                        <transcript-panel></transcript-panel>
                    </div>
                </div>
            </div>
        `;
    }

    renderSummary() {
        if (!this.sessionSummary) return html``;

        return html`
            <div class="summary-container">
                <div class="summary-title">Practice Session Complete!</div>

                <div class="summary-stats">
                    <div class="summary-stat">
                        <div class="summary-stat-value">${this.sessionSummary.questionsAsked}</div>
                        <div class="summary-stat-label">Questions Asked</div>
                    </div>
                    <div class="summary-stat">
                        <div class="summary-stat-value">${this.sessionSummary.questionsAnswered}</div>
                        <div class="summary-stat-label">Questions Answered</div>
                    </div>
                    <div class="summary-stat">
                        <div class="summary-stat-value">${this.formatDuration(this.sessionSummary.duration)}</div>
                        <div class="summary-stat-label">Total Time</div>
                    </div>
                    <div class="summary-stat">
                        <div class="summary-stat-value">${this.sessionSummary.averageAnswerLength}</div>
                        <div class="summary-stat-label">Avg Words/Answer</div>
                    </div>
                    <div class="summary-stat">
                        <div class="summary-stat-value">${this.sessionSummary.averageAnswerTime}s</div>
                        <div class="summary-stat-label">Avg Answer Time</div>
                    </div>
                    <div class="summary-stat">
                        <div class="summary-stat-value">${this.sessionSummary.difficulty}</div>
                        <div class="summary-stat-label">Difficulty</div>
                    </div>
                </div>

                <div class="action-buttons">
                    <button class="start-button" @click=${this.handleStartSession}>
                        Start Another Session
                    </button>
                    <button class="end-button" @click=${this.handleBackToSetup}>
                        Back to Setup
                    </button>
                </div>
            </div>
        `;
    }

    render() {
        return html`
            <div class="practice-header">
                <div class="header-title">
                    <span>Practice Mode</span>
                    <span class="mode-badge">AI Interviewer</span>
                </div>
            </div>

            ${this.showSummary ? this.renderSummary() :
              this.isSessionActive ? this.renderActiveSession() :
              this.renderSetup()}
        `;
    }
}

customElements.define('practice-view', PracticeView);
