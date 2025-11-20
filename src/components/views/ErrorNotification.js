import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';

export class ErrorNotification extends LitElement {
    static styles = css`
        :host {
            position: fixed;
            top: 80px;
            right: 20px;
            z-index: 9998;
            max-width: 400px;
        }

        * {
            font-family: 'Inter', sans-serif;
            user-select: none;
        }

        .notification {
            background: var(--input-background);
            border: 1px solid var(--button-border);
            border-radius: 12px;
            padding: 16px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            margin-bottom: 12px;
            animation: slideIn 0.3s ease-out;
        }

        @keyframes slideIn {
            from {
                transform: translateX(120%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }

        .notification.error {
            border-left: 4px solid #ff6b6b;
        }

        .notification.warning {
            border-left: 4px solid #ffa500;
        }

        .notification.info {
            border-left: 4px solid #007aff;
        }

        .notification-header {
            display: flex;
            align-items: flex-start;
            gap: 12px;
            margin-bottom: 8px;
        }

        .notification-icon {
            flex-shrink: 0;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            font-weight: 600;
        }

        .notification.error .notification-icon {
            background: rgba(255, 68, 68, 0.2);
            color: #ff6b6b;
        }

        .notification.warning .notification-icon {
            background: rgba(255, 165, 0, 0.2);
            color: #ffa500;
        }

        .notification.info .notification-icon {
            background: rgba(0, 122, 255, 0.2);
            color: #007aff;
        }

        .notification-content {
            flex: 1;
        }

        .notification-title {
            font-size: 14px;
            font-weight: 600;
            color: var(--text-color);
            margin-bottom: 4px;
        }

        .notification-message {
            font-size: 13px;
            color: var(--description-color);
            line-height: 1.4;
            margin-bottom: 8px;
        }

        .notification-actions {
            display: flex;
            flex-direction: column;
            gap: 6px;
            margin-top: 12px;
        }

        .recovery-step {
            display: flex;
            align-items: start;
            gap: 8px;
            font-size: 12px;
            color: var(--description-color);
            padding: 6px 8px;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 6px;
        }

        .recovery-step-number {
            flex-shrink: 0;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: var(--button-border);
            color: var(--text-color);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            font-weight: 600;
        }

        .action-buttons {
            display: flex;
            gap: 8px;
            margin-top: 12px;
        }

        button {
            flex: 1;
            background: var(--input-background);
            color: var(--text-color);
            border: 1px solid var(--button-border);
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 12px;
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
        }

        .close-button {
            flex-shrink: 0;
            width: 20px;
            height: 20px;
            border: none;
            background: transparent;
            color: var(--description-color);
            cursor: pointer;
            font-size: 16px;
            padding: 0;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .close-button:hover {
            color: var(--text-color);
            background: rgba(255, 255, 255, 0.1);
            border-radius: 50%;
        }
    `;

    static properties = {
        notifications: { type: Array },
    };

    constructor() {
        super();
        this.notifications = [];
    }

    addNotification(notification) {
        const id = Date.now() + Math.random();
        const newNotification = {
            id,
            ...notification,
        };
        this.notifications = [...this.notifications, newNotification];

        // Auto-dismiss after 10 seconds unless it's persistent
        if (!notification.persistent) {
            setTimeout(() => {
                this.removeNotification(id);
            }, 10000);
        }

        this.requestUpdate();
    }

    removeNotification(id) {
        this.notifications = this.notifications.filter(n => n.id !== id);
        this.requestUpdate();
    }

    getIcon(type) {
        switch (type) {
            case 'error':
                return '!';
            case 'warning':
                return '⚠';
            case 'info':
                return 'i';
            default:
                return '!';
        }
    }

    render() {
        if (this.notifications.length === 0) {
            return html``;
        }

        return html`
            ${this.notifications.map(notification => html`
                <div class="notification ${notification.type || 'info'}">
                    <div class="notification-header">
                        <div class="notification-icon">
                            ${this.getIcon(notification.type)}
                        </div>
                        <div class="notification-content">
                            <div class="notification-title">${notification.title}</div>
                            <div class="notification-message">${notification.message}</div>
                        </div>
                        <button class="close-button" @click=${() => this.removeNotification(notification.id)}>
                            ×
                        </button>
                    </div>

                    ${notification.recoverySteps && notification.recoverySteps.length > 0 ? html`
                        <div class="notification-actions">
                            ${notification.recoverySteps.map((step, index) => html`
                                <div class="recovery-step">
                                    <div class="recovery-step-number">${index + 1}</div>
                                    <div>${step}</div>
                                </div>
                            `)}
                        </div>
                    ` : ''}

                    ${notification.actions && notification.actions.length > 0 ? html`
                        <div class="action-buttons">
                            ${notification.actions.map(action => html`
                                <button
                                    class="${action.primary ? 'primary' : ''}"
                                    @click=${() => {
                                        action.onClick();
                                        if (action.dismissOnClick) {
                                            this.removeNotification(notification.id);
                                        }
                                    }}
                                >
                                    ${action.label}
                                </button>
                            `)}
                        </div>
                    ` : ''}
                </div>
            `)}
        `;
    }
}

customElements.define('error-notification', ErrorNotification);
