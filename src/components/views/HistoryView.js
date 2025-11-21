import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';
import { resizeLayout } from '../../utils/windowResize.js';
import { ExportDialog } from './ExportDialog.js';

export class HistoryView extends LitElement {
    static styles = css`
        * {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            cursor: default;
            user-select: none;
        }

        :host {
            height: 100%;
            display: flex;
            flex-direction: column;
            width: 100%;
        }

        .history-container {
            height: 100%;
            display: flex;
            flex-direction: column;
        }

        .sessions-list {
            flex: 1;
            overflow-y: auto;
            margin-bottom: 16px;
            padding-bottom: 20px;
        }

        .session-item {
            background: var(--input-background);
            border: 1px solid var(--button-border);
            border-radius: 6px;
            padding: 12px;
            margin-bottom: 8px;
            cursor: pointer;
            transition: all 0.15s ease;
        }

        .session-item:hover {
            background: var(--hover-background);
            border-color: var(--focus-border-color);
        }

        .session-item.selected {
            background: var(--focus-box-shadow);
            border-color: var(--focus-border-color);
        }

        .session-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 6px;
        }

        .session-date {
            font-size: 12px;
            font-weight: 600;
            color: var(--text-color);
        }

        .session-time {
            font-size: 11px;
            color: var(--description-color);
        }

        .session-preview {
            font-size: 11px;
            color: var(--description-color);
            line-height: 1.3;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }

        .conversation-view {
            flex: 1;
            overflow-y: auto;
            background: var(--main-content-background);
            border: 1px solid var(--button-border);
            border-radius: 6px;
            padding: 12px;
            padding-bottom: 20px;
            user-select: text;
            cursor: text;
        }

        .message {
            margin-bottom: 6px;
            padding: 6px 10px;
            border-left: 3px solid transparent;
            font-size: 12px;
            line-height: 1.4;
            background: var(--input-background);
            border-radius: 0 4px 4px 0;
            user-select: text;
            cursor: text;
        }

        .message.user {
            border-left-color: #5865f2; /* Discord blue */
        }

        .message.ai {
            border-left-color: #ed4245; /* Discord red */
        }

        .back-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
        }

        .back-button {
            background: var(--button-background);
            color: var(--text-color);
            border: 1px solid var(--button-border);
            padding: 6px 12px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 500;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
            transition: all 0.15s ease;
        }

        .back-button:hover {
            background: var(--hover-background);
        }

        .legend {
            display: flex;
            gap: 12px;
            align-items: center;
        }

        .legend-item {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 11px;
            color: var(--description-color);
        }

        .legend-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
        }

        .legend-dot.user {
            background-color: #5865f2; /* Discord blue */
        }

        .legend-dot.ai {
            background-color: #ed4245; /* Discord red */
        }

        .empty-state {
            text-align: center;
            color: var(--description-color);
            font-size: 12px;
            margin-top: 32px;
        }

        .empty-state-title {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 6px;
            color: var(--text-color);
        }

        .loading {
            text-align: center;
            color: var(--description-color);
            font-size: 12px;
            margin-top: 32px;
        }

        /* Scrollbar styles for scrollable elements */
        .sessions-list::-webkit-scrollbar {
            width: 6px;
        }

        .sessions-list::-webkit-scrollbar-track {
            background: var(--scrollbar-track, rgba(0, 0, 0, 0.2));
            border-radius: 3px;
        }

        .sessions-list::-webkit-scrollbar-thumb {
            background: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2));
            border-radius: 3px;
        }

        .sessions-list::-webkit-scrollbar-thumb:hover {
            background: var(--scrollbar-thumb-hover, rgba(255, 255, 255, 0.3));
        }

        .conversation-view::-webkit-scrollbar {
            width: 6px;
        }

        .conversation-view::-webkit-scrollbar-track {
            background: var(--scrollbar-track, rgba(0, 0, 0, 0.2));
            border-radius: 3px;
        }

        .conversation-view::-webkit-scrollbar-thumb {
            background: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2));
            border-radius: 3px;
        }

        .conversation-view::-webkit-scrollbar-thumb:hover {
            background: var(--scrollbar-thumb-hover, rgba(255, 255, 255, 0.3));
        }

        .tabs-container {
            display: flex;
            gap: 8px;
            margin-bottom: 16px;
            border-bottom: 1px solid var(--button-border);
            padding-bottom: 8px;
        }

        .tab {
            background: transparent;
            color: var(--description-color);
            border: none;
            padding: 8px 16px;
            border-radius: 4px 4px 0 0;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.15s ease;
        }

        .tab:hover {
            background: var(--hover-background);
            color: var(--text-color);
        }

        .tab.active {
            background: var(--focus-box-shadow);
            color: var(--text-color);
            border-bottom: 2px solid var(--focus-border-color);
        }

        .saved-response-item {
            background: var(--input-background);
            border: 1px solid var(--button-border);
            border-radius: 6px;
            padding: 12px;
            margin-bottom: 8px;
            transition: all 0.15s ease;
        }

        .saved-response-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 8px;
        }

        .saved-response-profile {
            font-size: 11px;
            font-weight: 600;
            color: var(--focus-border-color);
            text-transform: capitalize;
        }

        .saved-response-date {
            font-size: 10px;
            color: var(--description-color);
        }

        .saved-response-content {
            font-size: 12px;
            color: var(--text-color);
            line-height: 1.4;
            user-select: text;
            cursor: text;
        }

        .delete-button {
            background: transparent;
            color: var(--description-color);
            border: none;
            padding: 4px;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.15s ease;
        }

        .delete-button:hover {
            background: rgba(255, 0, 0, 0.1);
            color: #ff4444;
        }

        .action-bar {
            display: flex;
            gap: 8px;
            margin-bottom: 12px;
            flex-wrap: wrap;
        }

        .action-button {
            background: var(--button-background);
            color: var(--text-color);
            border: 1px solid var(--button-border);
            padding: 6px 12px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.15s ease;
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .action-button:hover {
            background: var(--hover-background);
        }

        .action-button.danger {
            background: rgba(255, 68, 68, 0.1);
            color: #ff4444;
            border-color: rgba(255, 68, 68, 0.3);
        }

        .action-button.danger:hover {
            background: rgba(255, 68, 68, 0.2);
        }

        .action-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .session-item-wrapper {
            position: relative;
            display: flex;
            gap: 8px;
            align-items: center;
            margin-bottom: 8px;
        }

        .session-checkbox {
            cursor: pointer;
        }

        .session-item-actions {
            position: absolute;
            right: 8px;
            top: 8px;
            display: flex;
            gap: 4px;
            opacity: 0;
            transition: opacity 0.15s ease;
        }

        .session-item-wrapper:hover .session-item-actions {
            opacity: 1;
        }

        .session-action-button {
            background: var(--button-background);
            border: 1px solid var(--button-border);
            color: var(--text-color);
            padding: 4px;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.15s ease;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .session-action-button:hover {
            background: var(--hover-background);
        }

        .session-action-button.delete:hover {
            background: rgba(255, 0, 0, 0.1);
            color: #ff4444;
        }

        .session-action-button.archive:hover {
            background: rgba(255, 165, 0, 0.1);
            color: #ffaa00;
        }

        .confirm-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            backdrop-filter: blur(4px);
        }

        .confirm-dialog {
            background: var(--input-background);
            border: 1px solid var(--button-border);
            border-radius: 12px;
            padding: 24px;
            max-width: 400px;
            width: 90%;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        }

        .confirm-title {
            font-size: 18px;
            font-weight: 600;
            color: var(--text-color);
            margin-bottom: 12px;
        }

        .confirm-message {
            font-size: 13px;
            color: var(--description-color);
            margin-bottom: 20px;
            line-height: 1.4;
        }

        .confirm-actions {
            display: flex;
            gap: 8px;
            justify-content: flex-end;
        }

        .confirm-button {
            background: var(--button-background);
            color: var(--text-color);
            border: 1px solid var(--button-border);
            padding: 8px 16px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.15s ease;
        }

        .confirm-button:hover {
            background: var(--hover-background);
        }

        .confirm-button.danger {
            background: #ff4444;
            color: white;
            border-color: #ff4444;
        }

        .confirm-button.danger:hover {
            background: #ff6666;
        }

        .archived-badge {
            display: inline-block;
            background: rgba(255, 165, 0, 0.2);
            color: #ffaa00;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 10px;
            font-weight: 600;
            margin-left: 6px;
        }
    `;

    static properties = {
        sessions: { type: Array },
        selectedSession: { type: Object },
        loading: { type: Boolean },
        activeTab: { type: String },
        savedResponses: { type: Array },
        showExportDialog: { type: Boolean, state: true },
        exportResponses: { type: Array, state: true },
        exportSessionInfo: { type: Object, state: true },
        exportProfile: { type: String, state: true },
        selectionMode: { type: Boolean, state: true },
        selectedSessions: { type: Set, state: true },
        showArchived: { type: Boolean, state: true },
        confirmDialog: { type: Object, state: true },
    };

    constructor() {
        super();
        this.sessions = [];
        this.selectedSession = null;
        this.loading = true;
        this.activeTab = 'sessions';
        this.showExportDialog = false;
        this.exportResponses = [];
        this.exportSessionInfo = {};
        this.exportProfile = 'interview';
        this.selectionMode = false;
        this.selectedSessions = new Set();
        this.showArchived = false;
        this.confirmDialog = null;
        // Load saved responses from localStorage
        try {
            this.savedResponses = JSON.parse(localStorage.getItem('savedResponses') || '[]');
        } catch (e) {
            this.savedResponses = [];
        }
        this.loadSessions();
    }

    connectedCallback() {
        super.connectedCallback();
        // Resize window for this view
        resizeLayout();
    }

    async loadSessions() {
        try {
            this.loading = true;
            this.sessions = await prism.getAllConversationSessions();
        } catch (error) {
            console.error('Error loading conversation sessions:', error);
            this.sessions = [];
        } finally {
            this.loading = false;
        }
    }

    formatDate(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    getSessionPreview(session) {
        if (!session.conversationHistory || session.conversationHistory.length === 0) {
            return 'No conversation yet';
        }

        const firstTurn = session.conversationHistory[0];
        const preview = firstTurn.transcription || firstTurn.ai_response || 'Empty conversation';
        return preview.length > 100 ? preview.substring(0, 100) + '...' : preview;
    }

    handleSessionClick(session) {
        this.selectedSession = session;
    }

    handleBackClick() {
        this.selectedSession = null;
    }

    handleTabClick(tab) {
        this.activeTab = tab;
    }

    deleteSavedResponse(index) {
        this.savedResponses = this.savedResponses.filter((_, i) => i !== index);
        localStorage.setItem('savedResponses', JSON.stringify(this.savedResponses));
        this.requestUpdate();
    }

    handleExportSavedResponses() {
        this.exportResponses = this.savedResponses.map(saved => ({
            content: saved.response,
            timestamp: saved.timestamp,
        }));
        this.exportSessionInfo = {
            timestamp: Date.now(),
        };
        this.exportProfile = this.savedResponses.length > 0 ? this.savedResponses[0].profile : 'interview';
        this.showExportDialog = true;
    }

    handleExportSession() {
        if (!this.selectedSession) return;

        const { conversationHistory } = this.selectedSession;
        const responses = [];

        if (conversationHistory) {
            conversationHistory.forEach(turn => {
                if (turn.ai_response) {
                    responses.push({
                        content: turn.ai_response,
                        timestamp: turn.timestamp,
                    });
                }
            });
        }

        this.exportResponses = responses;
        this.exportSessionInfo = {
            timestamp: this.selectedSession.timestamp,
        };
        this.exportProfile = this.selectedSession.profile || 'interview';
        this.showExportDialog = true;
    }

    handleCloseExportDialog() {
        this.showExportDialog = false;
    }

    toggleSelectionMode() {
        this.selectionMode = !this.selectionMode;
        if (!this.selectionMode) {
            this.selectedSessions.clear();
        }
        this.requestUpdate();
    }

    toggleSessionSelection(sessionId) {
        if (this.selectedSessions.has(sessionId)) {
            this.selectedSessions.delete(sessionId);
        } else {
            this.selectedSessions.add(sessionId);
        }
        this.requestUpdate();
    }

    selectAllSessions() {
        const visibleSessions = this.getVisibleSessions();
        visibleSessions.forEach(session => this.selectedSessions.add(session.sessionId));
        this.requestUpdate();
    }

    deselectAllSessions() {
        this.selectedSessions.clear();
        this.requestUpdate();
    }

    showConfirmDialog(title, message, onConfirm) {
        this.confirmDialog = { title, message, onConfirm };
    }

    closeConfirmDialog() {
        this.confirmDialog = null;
    }

    async handleDeleteSession(sessionId, event) {
        if (event) {
            event.stopPropagation();
        }

        this.showConfirmDialog(
            'Delete Conversation',
            'Are you sure you want to delete this conversation? This action cannot be undone.',
            async () => {
                try {
                    const isViewingThisSession = this.selectedSession?.sessionId === sessionId;
                    await prism.deleteConversationSession(sessionId);
                    await this.loadSessions();

                    // If we were viewing this session, go back to list
                    if (isViewingThisSession) {
                        this.selectedSession = null;
                    }

                    this.closeConfirmDialog();
                } catch (error) {
                    console.error('Error deleting session:', error);
                    alert('Failed to delete conversation. Please try again.');
                }
            }
        );
    }

    async handleDeleteSelected() {
        const count = this.selectedSessions.size;
        if (count === 0) return;

        this.showConfirmDialog(
            'Delete Multiple Conversations',
            `Are you sure you want to delete ${count} conversation${count > 1 ? 's' : ''}? This action cannot be undone.`,
            async () => {
                try {
                    const sessionIds = Array.from(this.selectedSessions);
                    await prism.deleteMultipleConversationSessions(sessionIds);
                    this.selectedSessions.clear();
                    this.selectionMode = false;
                    await this.loadSessions();
                    this.closeConfirmDialog();
                } catch (error) {
                    console.error('Error deleting sessions:', error);
                    alert('Failed to delete conversations. Please try again.');
                }
            }
        );
    }

    async handleClearAll() {
        const count = this.getVisibleSessions().length;
        if (count === 0) return;

        const archiveText = this.showArchived ? ' archived' : '';
        this.showConfirmDialog(
            `Clear All${archiveText ? ' Archived' : ''} Conversations`,
            `Are you sure you want to delete all ${count}${archiveText} conversation${count > 1 ? 's' : ''}? This action cannot be undone.`,
            async () => {
                try {
                    if (this.showArchived) {
                        // Delete only archived sessions
                        const archivedSessionIds = this.sessions
                            .filter(s => s.archived)
                            .map(s => s.sessionId);
                        await prism.deleteMultipleConversationSessions(archivedSessionIds);
                    } else {
                        // Clear all sessions
                        await prism.clearAllConversationSessions();
                    }
                    await this.loadSessions();
                    this.closeConfirmDialog();
                } catch (error) {
                    console.error('Error clearing sessions:', error);
                    alert('Failed to clear conversations. Please try again.');
                }
            }
        );
    }

    async handleArchiveSession(sessionId, event) {
        if (event) {
            event.stopPropagation();
        }

        try {
            const session = this.sessions.find(s => s.sessionId === sessionId);
            const isArchived = session?.archived;
            await prism.archiveConversationSession(sessionId, !isArchived);
            await this.loadSessions();
        } catch (error) {
            console.error('Error archiving session:', error);
            alert('Failed to archive conversation. Please try again.');
        }
    }

    toggleShowArchived() {
        this.showArchived = !this.showArchived;
    }

    getVisibleSessions() {
        return this.sessions.filter(session => {
            if (this.showArchived) {
                return session.archived === true;
            } else {
                return !session.archived;
            }
        });
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

    renderSessionsList() {
        if (this.loading) {
            return html`<div class="loading">Loading conversation history...</div>`;
        }

        const visibleSessions = this.getVisibleSessions();
        const archivedCount = this.sessions.filter(s => s.archived).length;

        if (this.sessions.length === 0) {
            return html`
                <div class="empty-state">
                    <div class="empty-state-title">No conversations yet</div>
                    <div>Start a session to see your conversation history here</div>
                </div>
            `;
        }

        if (visibleSessions.length === 0 && this.showArchived) {
            return html`
                <div class="action-bar">
                    <button class="action-button" @click=${this.toggleShowArchived}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M15 6l-6 6 6 6"/>
                        </svg>
                        Back to Active
                    </button>
                </div>
                <div class="empty-state">
                    <div class="empty-state-title">No archived conversations</div>
                    <div>Archive conversations to organize your history</div>
                </div>
            `;
        }

        const allSelected = visibleSessions.length > 0 && visibleSessions.every(s => this.selectedSessions.has(s.sessionId));

        return html`
            <div class="action-bar">
                ${!this.showArchived
                    ? html`
                          <button class="action-button" @click=${this.toggleSelectionMode}>
                              ${this.selectionMode ? 'Cancel Selection' : 'Select Multiple'}
                          </button>
                          ${this.selectionMode
                              ? html`
                                    <button class="action-button" @click=${allSelected ? this.deselectAllSessions : this.selectAllSessions}>
                                        ${allSelected ? 'Deselect All' : 'Select All'}
                                    </button>
                                    <button class="action-button danger" @click=${this.handleDeleteSelected} ?disabled=${this.selectedSessions.size === 0}>
                                        Delete Selected (${this.selectedSessions.size})
                                    </button>
                                `
                              : ''}
                          ${archivedCount > 0
                              ? html`
                                    <button class="action-button" @click=${this.toggleShowArchived}>
                                        View Archived (${archivedCount})
                                    </button>
                                `
                              : ''}
                          ${visibleSessions.length > 0
                              ? html`
                                    <button class="action-button danger" @click=${this.handleClearAll}>
                                        Clear All
                                    </button>
                                `
                              : ''}
                      `
                    : html`
                          <button class="action-button" @click=${this.toggleShowArchived}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                  <path d="M15 6l-6 6 6 6"/>
                              </svg>
                              Back to Active
                          </button>
                          ${visibleSessions.length > 0
                              ? html`
                                    <button class="action-button danger" @click=${this.handleClearAll}>
                                        Delete All Archived
                                    </button>
                                `
                              : ''}
                      `}
            </div>
            <div class="sessions-list">
                ${visibleSessions.map(
                    session => html`
                        <div class="session-item-wrapper">
                            ${this.selectionMode
                                ? html`
                                      <input
                                          type="checkbox"
                                          class="session-checkbox"
                                          .checked=${this.selectedSessions.has(session.sessionId)}
                                          @change=${() => this.toggleSessionSelection(session.sessionId)}
                                      />
                                  `
                                : ''}
                            <button class="session-item ${this.selectionMode ? '' : ''}" @click=${() => !this.selectionMode && this.handleSessionClick(session)}>
                                <div class="session-header">
                                    <div class="session-date">
                                        ${this.formatDate(session.timestamp)}
                                        ${session.archived ? html`<span class="archived-badge">ARCHIVED</span>` : ''}
                                    </div>
                                    <div class="session-time">${this.formatTime(session.timestamp)}</div>
                                </div>
                                <div class="session-preview">${this.getSessionPreview(session)}</div>
                                ${!this.selectionMode
                                    ? html`
                                          <div class="session-item-actions">
                                              <button
                                                  class="session-action-button archive"
                                                  @click=${(e) => this.handleArchiveSession(session.sessionId, e)}
                                                  title="${session.archived ? 'Unarchive' : 'Archive'} conversation"
                                              >
                                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                      <path d="M3 3h18v6H3zM3 9h18v12H3zM9 14h6"/>
                                                  </svg>
                                              </button>
                                              <button
                                                  class="session-action-button delete"
                                                  @click=${(e) => this.handleDeleteSession(session.sessionId, e)}
                                                  title="Delete conversation"
                                              >
                                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                      <path d="M3 6h18M8 6V4h8v2M10 11v6M14 11v6M5 6h14l-1 14H6z"/>
                                                  </svg>
                                              </button>
                                          </div>
                                      `
                                    : ''}
                            </button>
                        </div>
                    `
                )}
            </div>
        `;
    }

    renderSavedResponses() {
        if (this.savedResponses.length === 0) {
            return html`
                <div class="empty-state">
                    <div class="empty-state-title">No saved responses</div>
                    <div>Use the save button during conversations to save important responses</div>
                </div>
            `;
        }

        const profileNames = this.getProfileNames();

        return html`
            <div class="sessions-list">
                ${this.savedResponses.map(
                    (saved, index) => html`
                        <div class="saved-response-item">
                            <div class="saved-response-header">
                                <div>
                                    <div class="saved-response-profile">${profileNames[saved.profile] || saved.profile}</div>
                                    <div class="saved-response-date">${this.formatTimestamp(saved.timestamp)}</div>
                                </div>
                                <button class="delete-button" @click=${() => this.deleteSavedResponse(index)} title="Delete saved response" aria-label="Delete saved response">
                                    <svg aria-hidden="true"
                                        width="16px"
                                        height="16px"
                                        stroke-width="1.7"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                    >
                                        <path
                                            d="M6 6L18 18M6 18L18 6"
                                            stroke="currentColor"
                                            stroke-width="1.7"
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                        ></path>
                                    </svg>
                                </button>
                            </div>
                            <div class="saved-response-content">${saved.response}</div>
                        </div>
                    `
                )}
            </div>
        `;
    }

    renderConversationView() {
        if (!this.selectedSession) return html``;

        const { conversationHistory } = this.selectedSession;

        // Flatten the conversation turns into individual messages
        const messages = [];
        if (conversationHistory) {
            conversationHistory.forEach(turn => {
                if (turn.transcription) {
                    messages.push({
                        type: 'user',
                        content: turn.transcription,
                        timestamp: turn.timestamp,
                    });
                }
                if (turn.ai_response) {
                    messages.push({
                        type: 'ai',
                        content: turn.ai_response,
                        timestamp: turn.timestamp,
                    });
                }
            });
        }

        return html`
            <div class="back-header">
                <button class="back-button" @click=${this.handleBackClick}>
                    <svg
                        width="16px"
                        height="16px"
                        stroke-width="1.7"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        color="currentColor"
                    >
                        <path d="M15 6L9 12L15 18" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"></path>
                    </svg>
                    Back to Sessions
                </button>
                <button class="back-button" @click=${(e) => this.handleArchiveSession(this.selectedSession.sessionId, e)} title="${this.selectedSession.archived ? 'Unarchive' : 'Archive'} this session">
                    <svg
                        width="16px"
                        height="16px"
                        stroke-width="1.7"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        color="currentColor"
                    >
                        <path d="M3 3h18v6H3zM3 9h18v12H3zM9 14h6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"></path>
                    </svg>
                    ${this.selectedSession.archived ? 'Unarchive' : 'Archive'}
                </button>
                <button class="back-button" @click=${this.handleExportSession} title="Export this session">
                    <svg
                        width="16px"
                        height="16px"
                        stroke-width="1.7"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        color="currentColor"
                    >
                        <path d="M6 20L18 20" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"></path>
                        <path d="M12 16V4M12 4L15.5 7.5M12 4L8.5 7.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"></path>
                    </svg>
                    Export
                </button>
                <button class="back-button" @click=${(e) => this.handleDeleteSession(this.selectedSession.sessionId, e)} title="Delete this session" style="color: #ff4444;">
                    <svg
                        width="16px"
                        height="16px"
                        stroke-width="1.7"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        color="currentColor"
                    >
                        <path d="M3 6h18M8 6V4h8v2M10 11v6M14 11v6M5 6h14l-1 14H6z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"></path>
                    </svg>
                    Delete
                </button>
                <div class="legend">
                    <div class="legend-item">
                        <div class="legend-dot user"></div>
                        <span>Them</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-dot ai"></div>
                        <span>Suggestion</span>
                    </div>
                </div>
            </div>
            <div class="conversation-view">
                ${messages.length > 0
                    ? messages.map(message => html` <div class="message ${message.type}">${message.content}</div> `)
                    : html`<div class="empty-state">No conversation data available</div>`}
            </div>
            ${this.showExportDialog
                ? html`
                      <export-dialog
                          .responses=${this.exportResponses}
                          .sessionInfo=${this.exportSessionInfo}
                          .profile=${this.exportProfile}
                          .onClose=${() => this.handleCloseExportDialog()}
                      ></export-dialog>
                  `
                : ''}
        `;
    }

    render() {
        if (this.selectedSession) {
            return html`<div class="history-container">${this.renderConversationView()}</div>`;
        }

        return html`
            <div class="history-container">
                <div class="tabs-container">
                    <button class="tab ${this.activeTab === 'sessions' ? 'active' : ''}" @click=${() => this.handleTabClick('sessions')}>
                        Conversation History
                    </button>
                    <button class="tab ${this.activeTab === 'saved' ? 'active' : ''}" @click=${() => this.handleTabClick('saved')}>
                        Saved Responses (${this.savedResponses.length})
                    </button>
                    ${this.activeTab === 'saved' && this.savedResponses.length > 0
                        ? html`
                              <button
                                  class="tab"
                                  @click=${this.handleExportSavedResponses}
                                  style="margin-left: auto; background: var(--start-button-background); color: var(--start-button-color);"
                                  title="Export all saved responses"
                              >
                                  Export All
                              </button>
                          `
                        : ''}
                </div>
                ${this.activeTab === 'sessions' ? this.renderSessionsList() : this.renderSavedResponses()}
                ${this.showExportDialog
                    ? html`
                          <export-dialog
                              .responses=${this.exportResponses}
                              .sessionInfo=${this.exportSessionInfo}
                              .profile=${this.exportProfile}
                              .onClose=${() => this.handleCloseExportDialog()}
                          ></export-dialog>
                      `
                    : ''}
                ${this.confirmDialog
                    ? html`
                          <div class="confirm-overlay" @click=${this.closeConfirmDialog}>
                              <div class="confirm-dialog" @click=${(e) => e.stopPropagation()}>
                                  <div class="confirm-title">${this.confirmDialog.title}</div>
                                  <div class="confirm-message">${this.confirmDialog.message}</div>
                                  <div class="confirm-actions">
                                      <button class="confirm-button" @click=${this.closeConfirmDialog}>
                                          Cancel
                                      </button>
                                      <button class="confirm-button danger" @click=${this.confirmDialog.onConfirm}>
                                          Confirm
                                      </button>
                                  </div>
                              </div>
                          </div>
                      `
                    : ''}
            </div>
        `;
    }
}

customElements.define('history-view', HistoryView);
