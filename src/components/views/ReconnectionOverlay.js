import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';

export class ReconnectionOverlay extends LitElement {
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

        .overlay-content {
            background: var(--input-background);
            border: 1px solid var(--button-border);
            border-radius: 16px;
            padding: 32px;
            max-width: 400px;
            text-align: center;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        }

        .spinner {
            width: 64px;
            height: 64px;
            margin: 0 auto 24px;
            border: 4px solid var(--button-border);
            border-top-color: var(--start-button-background);
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        .title {
            font-size: 20px;
            font-weight: 600;
            color: var(--text-color);
            margin-bottom: 12px;
        }

        .message {
            font-size: 14px;
            color: var(--description-color);
            margin-bottom: 8px;
            line-height: 1.5;
        }

        .attempt-info {
            font-size: 13px;
            color: var(--description-color);
            margin-bottom: 24px;
        }

        .countdown {
            color: var(--start-button-background);
            font-weight: 600;
        }

        .actions {
            display: flex;
            gap: 12px;
            justify-content: center;
        }

        button {
            background: var(--input-background);
            color: var(--text-color);
            border: 1px solid var(--button-border);
            padding: 10px 20px;
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

        .error-state .title {
            color: #ff6b6b;
        }

        .error-state .spinner {
            border-top-color: #ff6b6b;
            animation: none;
        }
    `;

    static properties = {
        reconnectionAttempt: { type: Number },
        maxAttempts: { type: Number },
        secondsUntilRetry: { type: Number },
        isRetrying: { type: Boolean },
        hasError: { type: Boolean },
        errorMessage: { type: String },
        onRetry: { type: Function },
        onCancel: { type: Function },
    };

    constructor() {
        super();
        this.reconnectionAttempt = 1;
        this.maxAttempts = 3;
        this.secondsUntilRetry = 2;
        this.isRetrying = true;
        this.hasError = false;
        this.errorMessage = '';
        this.onRetry = () => {};
        this.onCancel = () => {};
    }

    handleRetry() {
        this.onRetry();
    }

    handleCancel() {
        this.onCancel();
    }

    render() {
        const containerClass = this.hasError ? 'overlay-content error-state' : 'overlay-content';

        return html`
            <div class="${containerClass}">
                <div class="spinner"></div>

                <div class="title">
                    ${this.hasError
                        ? 'Connection Failed'
                        : this.isRetrying
                            ? 'Reconnecting...'
                            : 'Connection Lost'}
                </div>

                <div class="message">
                    ${this.hasError
                        ? this.errorMessage || 'Unable to reconnect to the session'
                        : this.isRetrying
                            ? `Attempting to restore your session`
                            : 'Your session has been interrupted'}
                </div>

                ${!this.hasError ? html`
                    <div class="attempt-info">
                        Attempt ${this.reconnectionAttempt} of ${this.maxAttempts}
                        ${this.isRetrying ? html`
                            <span class="countdown">(${this.secondsUntilRetry}s)</span>
                        ` : ''}
                    </div>
                ` : ''}

                <div class="actions">
                    ${this.hasError || !this.isRetrying ? html`
                        <button class="primary" @click=${this.handleRetry}>
                            Retry Now
                        </button>
                    ` : ''}
                    <button @click=${this.handleCancel}>
                        End Session
                    </button>
                </div>
            </div>
        `;
    }
}

customElements.define('reconnection-overlay', ReconnectionOverlay);
