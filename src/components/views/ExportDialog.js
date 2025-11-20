import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';
import {
    exportAsMarkdown,
    exportAsPDF,
    downloadFile,
    copyToClipboard,
    generateFilename,
} from '../../utils/exportUtils.js';

export class ExportDialog extends LitElement {
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
            max-width: 550px;
            width: 90%;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
            max-height: 85vh;
            overflow-y: auto;
        }

        .dialog-content::-webkit-scrollbar {
            width: 6px;
        }

        .dialog-content::-webkit-scrollbar-track {
            background: var(--scrollbar-track);
            border-radius: 3px;
        }

        .dialog-content::-webkit-scrollbar-thumb {
            background: var(--scrollbar-thumb);
            border-radius: 3px;
        }

        .title {
            font-size: 22px;
            font-weight: 600;
            color: var(--text-color);
            margin-bottom: 8px;
        }

        .subtitle {
            font-size: 13px;
            color: var(--description-color);
            margin-bottom: 24px;
        }

        .section {
            margin-bottom: 24px;
        }

        .section-title {
            font-size: 14px;
            font-weight: 600;
            color: var(--text-color);
            margin-bottom: 12px;
        }

        .format-options {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
            margin-bottom: 16px;
        }

        .format-card {
            background: var(--main-content-background);
            border: 2px solid var(--button-border);
            border-radius: 10px;
            padding: 16px;
            cursor: pointer;
            transition: all 0.2s ease;
            text-align: center;
        }

        .format-card:hover {
            border-color: var(--focus-border-color);
            background: var(--input-focus-background);
        }

        .format-card.selected {
            border-color: var(--start-button-background);
            background: rgba(0, 122, 255, 0.1);
        }

        .format-icon {
            font-size: 32px;
            margin-bottom: 8px;
        }

        .format-name {
            font-size: 14px;
            font-weight: 600;
            color: var(--text-color);
            margin-bottom: 4px;
        }

        .format-desc {
            font-size: 11px;
            color: var(--description-color);
            line-height: 1.3;
        }

        .scope-options {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .scope-option {
            background: var(--main-content-background);
            border: 2px solid var(--button-border);
            border-radius: 8px;
            padding: 12px 16px;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .scope-option:hover {
            border-color: var(--focus-border-color);
            background: var(--input-focus-background);
        }

        .scope-option.selected {
            border-color: var(--start-button-background);
            background: rgba(0, 122, 255, 0.1);
        }

        .scope-info {
            flex: 1;
        }

        .scope-label {
            font-size: 13px;
            font-weight: 600;
            color: var(--text-color);
            margin-bottom: 2px;
        }

        .scope-desc {
            font-size: 11px;
            color: var(--description-color);
        }

        .scope-badge {
            background: var(--start-button-background);
            color: var(--start-button-color);
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
        }

        .checkbox-list {
            max-height: 200px;
            overflow-y: auto;
            background: var(--main-content-background);
            border: 1px solid var(--button-border);
            border-radius: 8px;
            padding: 12px;
            margin-top: 12px;
        }

        .checkbox-list::-webkit-scrollbar {
            width: 6px;
        }

        .checkbox-list::-webkit-scrollbar-track {
            background: var(--scrollbar-track);
            border-radius: 3px;
        }

        .checkbox-list::-webkit-scrollbar-thumb {
            background: var(--scrollbar-thumb);
            border-radius: 3px;
        }

        .checkbox-item {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            padding: 8px;
            border-radius: 6px;
            cursor: pointer;
            transition: background 0.15s ease;
        }

        .checkbox-item:hover {
            background: var(--input-background);
        }

        .checkbox-item input[type='checkbox'] {
            margin-top: 2px;
            cursor: pointer;
        }

        .checkbox-label {
            flex: 1;
            font-size: 12px;
            color: var(--text-color);
            line-height: 1.4;
            cursor: pointer;
        }

        .select-all {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            background: var(--input-background);
            border-radius: 6px;
            margin-bottom: 8px;
            cursor: pointer;
        }

        .select-all input[type='checkbox'] {
            cursor: pointer;
        }

        .select-all-label {
            font-size: 12px;
            font-weight: 600;
            color: var(--text-color);
            cursor: pointer;
        }

        .actions {
            display: flex;
            gap: 10px;
            margin-top: 24px;
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

        button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        button:disabled:hover {
            background: var(--input-background);
            border-color: var(--button-border);
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

        button.primary:disabled:hover {
            background: var(--start-button-background);
            border-color: var(--start-button-border);
        }

        button.secondary {
            background: transparent;
        }

        .status-message {
            margin-top: 12px;
            padding: 10px 14px;
            border-radius: 6px;
            font-size: 12px;
            text-align: center;
            animation: fadeIn 0.3s ease;
        }

        .status-message.success {
            background: rgba(76, 175, 80, 0.1);
            color: #4caf50;
            border: 1px solid rgba(76, 175, 80, 0.3);
        }

        .status-message.error {
            background: rgba(255, 68, 68, 0.1);
            color: #ff6b6b;
            border: 1px solid rgba(255, 68, 68, 0.3);
        }

        @keyframes fadeIn {
            from {
                opacity: 0;
                transform: translateY(-5px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
    `;

    static properties = {
        responses: { type: Array },
        sessionInfo: { type: Object },
        profile: { type: String },
        onClose: { type: Function },
        selectedFormat: { type: String, state: true },
        selectedScope: { type: String, state: true },
        selectedIndices: { type: Set, state: true },
        isExporting: { type: Boolean, state: true },
        statusMessage: { type: String, state: true },
        statusType: { type: String, state: true },
    };

    constructor() {
        super();
        this.responses = [];
        this.sessionInfo = {};
        this.profile = 'interview';
        this.onClose = () => {};
        this.selectedFormat = 'pdf';
        this.selectedScope = 'all';
        this.selectedIndices = new Set();
        this.isExporting = false;
        this.statusMessage = '';
        this.statusType = '';
    }

    handleFormatSelect(format) {
        this.selectedFormat = format;
    }

    handleScopeSelect(scope) {
        this.selectedScope = scope;
        if (scope !== 'selected') {
            this.selectedIndices.clear();
        }
    }

    handleCheckboxChange(index, checked) {
        if (checked) {
            this.selectedIndices.add(index);
        } else {
            this.selectedIndices.delete(index);
        }
        this.requestUpdate();
    }

    handleSelectAll(checked) {
        if (checked) {
            this.selectedIndices = new Set(this.responses.map((_, i) => i));
        } else {
            this.selectedIndices.clear();
        }
        this.requestUpdate();
    }

    getResponsesToExport() {
        if (this.selectedScope === 'current') {
            // Export only the last response
            return this.responses.length > 0 ? [this.responses[this.responses.length - 1]] : [];
        } else if (this.selectedScope === 'selected') {
            // Export selected responses
            return this.responses.filter((_, i) => this.selectedIndices.has(i));
        } else {
            // Export all responses
            return this.responses;
        }
    }

    showStatus(message, type = 'success') {
        this.statusMessage = message;
        this.statusType = type;
        setTimeout(() => {
            this.statusMessage = '';
            this.statusType = '';
        }, 3000);
    }

    async handleExport() {
        if (this.isExporting) return;

        const responsesToExport = this.getResponsesToExport();

        if (responsesToExport.length === 0) {
            this.showStatus('No responses to export', 'error');
            return;
        }

        this.isExporting = true;

        try {
            const exportData = {
                responses: responsesToExport,
                sessionInfo: this.sessionInfo,
                profile: this.profile,
            };

            if (this.selectedFormat === 'pdf') {
                const doc = await exportAsPDF(exportData);
                const filename = generateFilename('pdf', this.profile);
                doc.save(filename);
                this.showStatus(`PDF exported: ${filename}`, 'success');
            } else if (this.selectedFormat === 'markdown') {
                const markdown = exportAsMarkdown(exportData);
                const filename = generateFilename('md', this.profile);
                downloadFile(markdown, filename, 'text/markdown');
                this.showStatus(`Markdown exported: ${filename}`, 'success');
            }

            // Auto-close after successful export
            setTimeout(() => {
                this.onClose();
            }, 1500);
        } catch (error) {
            console.error('Export failed:', error);
            this.showStatus('Export failed: ' + error.message, 'error');
        } finally {
            this.isExporting = false;
        }
    }

    async handleCopyToClipboard() {
        const responsesToExport = this.getResponsesToExport();

        if (responsesToExport.length === 0) {
            this.showStatus('No responses to copy', 'error');
            return;
        }

        try {
            const markdown = exportAsMarkdown({
                responses: responsesToExport,
                sessionInfo: this.sessionInfo,
                profile: this.profile,
            });

            const success = await copyToClipboard(markdown);
            if (success) {
                this.showStatus('Copied to clipboard!', 'success');
            } else {
                this.showStatus('Failed to copy to clipboard', 'error');
            }
        } catch (error) {
            console.error('Copy failed:', error);
            this.showStatus('Copy failed: ' + error.message, 'error');
        }
    }

    render() {
        const responsesToExportCount = this.getResponsesToExport().length;
        const allSelected = this.selectedIndices.size === this.responses.length && this.responses.length > 0;

        return html`
            <div class="dialog-content">
                <div class="title">Export Responses</div>
                <div class="subtitle">
                    Choose format and options to export your interview responses
                </div>

                <div class="section">
                    <div class="section-title">Export Format</div>
                    <div class="format-options">
                        <div
                            class="format-card ${this.selectedFormat === 'pdf' ? 'selected' : ''}"
                            @click=${() => this.handleFormatSelect('pdf')}
                        >
                            <div class="format-icon">📄</div>
                            <div class="format-name">PDF Document</div>
                            <div class="format-desc">
                                Professional formatted document with table of contents
                            </div>
                        </div>
                        <div
                            class="format-card ${this.selectedFormat === 'markdown' ? 'selected' : ''}"
                            @click=${() => this.handleFormatSelect('markdown')}
                        >
                            <div class="format-icon">📝</div>
                            <div class="format-name">Markdown</div>
                            <div class="format-desc">
                                Text format perfect for note-taking apps
                            </div>
                        </div>
                    </div>
                </div>

                <div class="section">
                    <div class="section-title">Export Scope</div>
                    <div class="scope-options">
                        <div
                            class="scope-option ${this.selectedScope === 'all' ? 'selected' : ''}"
                            @click=${() => this.handleScopeSelect('all')}
                        >
                            <div class="scope-info">
                                <div class="scope-label">All Responses</div>
                                <div class="scope-desc">Export complete session history</div>
                            </div>
                            <div class="scope-badge">${this.responses.length}</div>
                        </div>
                        <div
                            class="scope-option ${this.selectedScope === 'selected' ? 'selected' : ''}"
                            @click=${() => this.handleScopeSelect('selected')}
                        >
                            <div class="scope-info">
                                <div class="scope-label">Selected Responses</div>
                                <div class="scope-desc">Choose specific responses to export</div>
                            </div>
                            <div class="scope-badge">${this.selectedIndices.size}</div>
                        </div>
                        <div
                            class="scope-option ${this.selectedScope === 'current' ? 'selected' : ''}"
                            @click=${() => this.handleScopeSelect('current')}
                        >
                            <div class="scope-info">
                                <div class="scope-label">Current Response</div>
                                <div class="scope-desc">Export only the most recent response</div>
                            </div>
                            <div class="scope-badge">1</div>
                        </div>
                    </div>

                    ${this.selectedScope === 'selected'
                        ? html`
                              <div class="checkbox-list">
                                  <div class="select-all" @click=${(e) => this.handleSelectAll(e.target.checked)}>
                                      <input
                                          type="checkbox"
                                          .checked=${allSelected}
                                          @click=${(e) => e.stopPropagation()}
                                          @change=${(e) => this.handleSelectAll(e.target.checked)}
                                      />
                                      <span class="select-all-label">Select All</span>
                                  </div>
                                  ${this.responses.map((response, index) => {
                                      const content =
                                          typeof response === 'string' ? response : response.content || response.response || response;
                                      const preview = content.substring(0, 80) + (content.length > 80 ? '...' : '');
                                      const isChecked = this.selectedIndices.has(index);

                                      return html`
                                          <div class="checkbox-item" @click=${() => this.handleCheckboxChange(index, !isChecked)}>
                                              <input
                                                  type="checkbox"
                                                  .checked=${isChecked}
                                                  @click=${(e) => e.stopPropagation()}
                                                  @change=${(e) => this.handleCheckboxChange(index, e.target.checked)}
                                              />
                                              <label class="checkbox-label">
                                                  <strong>Response ${index + 1}:</strong> ${preview}
                                              </label>
                                          </div>
                                      `;
                                  })}
                              </div>
                          `
                        : ''}
                </div>

                ${this.statusMessage
                    ? html`
                          <div class="status-message ${this.statusType}">
                              ${this.statusMessage}
                          </div>
                      `
                    : ''}

                <div class="actions">
                    <button @click=${this.onClose} ?disabled=${this.isExporting}>Cancel</button>
                    <button @click=${this.handleCopyToClipboard} ?disabled=${this.isExporting || responsesToExportCount === 0}>
                        Copy to Clipboard
                    </button>
                    <button class="primary" @click=${this.handleExport} ?disabled=${this.isExporting || responsesToExportCount === 0}>
                        ${this.isExporting ? 'Exporting...' : `Export (${responsesToExportCount})`}
                    </button>
                </div>
            </div>
        `;
    }
}

customElements.define('export-dialog', ExportDialog);
