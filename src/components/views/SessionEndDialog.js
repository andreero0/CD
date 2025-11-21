import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';
import { ExportDialog } from './ExportDialog.js';

export class SessionEndDialog extends LitElement {
    static styles = css`
        :host {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            backdrop-filter: blur(4px);
        }

        * {
            font-family: 'Inter', sans-serif;
            user-select: none;
        }

        .dialog-content {
            background: var(--input-background);
            border: 1px solid var(--button-border);
            border-radius: 16px;
            padding: 32px;
            max-width: 500px;
            width: 90%;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        }

        .title {
            font-size: 22px;
            font-weight: 600;
            color: var(--text-color);
            margin-bottom: 16px;
        }

        .warning {
            font-size: 14px;
            color: #ffa500;
            margin-bottom: 24px;
            padding: 12px;
            background: rgba(255, 165, 0, 0.1);
            border-radius: 8px;
            border: 1px solid rgba(255, 165, 0, 0.3);
        }

        .summary {
            background: var(--main-content-background);
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 24px;
        }

        .summary-title {
            font-size: 16px;
            font-weight: 600;
            color: var(--text-color);
            margin-bottom: 16px;
        }

        .stat-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
            margin-bottom: 16px;
        }

        .stat {
            text-align: center;
        }

        .stat-value {
            font-size: 24px;
            font-weight: 700;
            color: var(--start-button-background);
            margin-bottom: 4px;
        }

        .stat-label {
            font-size: 12px;
            color: var(--description-color);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .topics {
            margin-top: 16px;
            padding-top: 16px;
            border-top: 1px solid var(--button-border);
        }

        .topics-title {
            font-size: 13px;
            font-weight: 600;
            color: var(--text-color);
            margin-bottom: 8px;
        }

        .topic-tags {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }

        .topic-tag {
            background: rgba(0, 122, 255, 0.1);
            color: var(--link-color);
            padding: 4px 12px;
            border-radius: 16px;
            font-size: 12px;
            font-weight: 500;
            border: 1px solid rgba(0, 122, 255, 0.2);
        }

        .topic-count {
            background: rgba(0, 122, 255, 0.2);
            padding: 0px 6px;
            border-radius: 8px;
            margin-left: 4px;
            font-size: 11px;
        }

        .actions {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .action-row {
            display: flex;
            gap: 10px;
        }

        button {
            flex: 1;
            background: var(--input-background);
            color: var(--text-color);
            border: 1px solid var(--button-border);
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        button:hover {
            background: var(--input-focus-background);
            border-color: var(--focus-border-color);
        }

        button.primary {
            background: var(--start-button-background);
            color: var(--start-button-color);
            border-color: var(--start-button-border);
        }

        button.primary:hover {
            background: var(--start-button-hover-background);
            border-color: var(--start-button-hover-border);
        }

        button.danger {
            background: rgba(255, 68, 68, 0.1);
            color: #ff6b6b;
            border-color: rgba(255, 68, 68, 0.3);
        }

        button.danger:hover {
            background: rgba(255, 68, 68, 0.2);
            border-color: rgba(255, 68, 68, 0.5);
        }

        button.cancel {
            background: transparent;
        }

        button.cancel:hover {
            background: rgba(255, 255, 255, 0.05);
        }
    `;

    static properties = {
        sessionDuration: { type: String },
        totalResponses: { type: Number },
        unsavedResponses: { type: Number },
        topics: { type: Array },
        tokenUsage: { type: Number },
        responses: { type: Array },
        sessionInfo: { type: Object },
        profile: { type: String },
        onSaveToHistory: { type: Function },
        onEndWithoutSaving: { type: Function },
        onCancel: { type: Function },
        showExportDialog: { type: Boolean, state: true },
    };

    constructor() {
        super();
        this.sessionDuration = '0m 0s';
        this.totalResponses = 0;
        this.unsavedResponses = 0;
        this.topics = [];
        this.tokenUsage = 0;
        this.responses = [];
        this.sessionInfo = {};
        this.profile = 'interview';
        this.onSaveToHistory = () => {};
        this.onEndWithoutSaving = () => {};
        this.onCancel = () => {};
        this.showExportDialog = false;
    }

    handleExportClick() {
        this.showExportDialog = true;
    }

    handleCloseExportDialog() {
        this.showExportDialog = false;
    }

    formatTokens(tokens) {
        if (tokens >= 1000) {
            return (tokens / 1000).toFixed(1) + 'K';
        }
        return tokens.toString();
    }

    render() {
        return html`
            <div class="dialog-content">
                <div class="title">End Session?</div>

                ${this.unsavedResponses > 0 ? html`
                    <div class="warning">
                        You have ${this.unsavedResponses} unsaved response${this.unsavedResponses !== 1 ? 's' : ''}
                    </div>
                ` : ''}

                <div class="summary">
                    <div class="summary-title">Session Summary</div>

                    <div class="stat-grid">
                        <div class="stat">
                            <div class="stat-value">${this.sessionDuration}</div>
                            <div class="stat-label">Duration</div>
                        </div>
                        <div class="stat">
                            <div class="stat-value">${this.totalResponses}</div>
                            <div class="stat-label">Responses</div>
                        </div>
                        <div class="stat">
                            <div class="stat-value">${this.formatTokens(this.tokenUsage)}</div>
                            <div class="stat-label">Tokens</div>
                        </div>
                        <div class="stat">
                            <div class="stat-value">${this.topics.length}</div>
                            <div class="stat-label">Topics</div>
                        </div>
                    </div>

                    ${this.topics.length > 0 ? html`
                        <div class="topics">
                            <div class="topics-title">Topics Covered</div>
                            <div class="topic-tags">
                                ${this.topics.map(topic => html`
                                    <div class="topic-tag">
                                        ${topic.name}
                                        <span class="topic-count">${topic.count}</span>
                                    </div>
                                `)}
                            </div>
                        </div>
                    ` : ''}
                </div>

                <div class="actions">
                    <div class="action-row">
                        <button class="primary" @click=${this.onSaveToHistory}>
                            Save to History
                        </button>
                        <button @click=${this.handleExportClick}>
                            Export
                        </button>
                    </div>
                    <div class="action-row">
                        <button class="danger" @click=${this.onEndWithoutSaving}>
                            End Without Saving
                        </button>
                        <button class="cancel" @click=${this.onCancel}>
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
            ${this.showExportDialog
                ? html`
                      <export-dialog
                          .responses=${this.responses}
                          .sessionInfo=${this.sessionInfo}
                          .profile=${this.profile}
                          .onClose=${() => this.handleCloseExportDialog()}
                      ></export-dialog>
                  `
                : ''}
        `;
    }
}

customElements.define('session-end-dialog', SessionEndDialog);
