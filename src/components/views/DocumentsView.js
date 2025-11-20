import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';
import { documentDB } from '../../utils/documentDB.js';
import { processPDFFile, formatFileSize, formatNumber } from '../../utils/pdfParser.js';

export class DocumentsView extends LitElement {
    static styles = css`
        * {
            font-family: 'Inter', sans-serif;
            cursor: default;
            user-select: none;
        }

        :host {
            display: block;
            height: 100%;
        }

        .container {
            display: flex;
            flex-direction: column;
            height: 100%;
            gap: 20px;
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 12px;
            border-bottom: 1px solid var(--border-color);
        }

        .title {
            font-size: 18px;
            font-weight: 600;
            color: var(--text-color);
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .add-button {
            background: var(--start-button-background);
            color: var(--start-button-color);
            border: 1px solid var(--start-button-border);
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
            transition: all 0.2s ease;
        }

        .add-button:hover {
            background: var(--start-button-hover-background);
            border-color: var(--start-button-hover-border);
        }

        .upload-area {
            border: 2px dashed var(--border-color);
            border-radius: 12px;
            padding: 40px;
            text-align: center;
            background: var(--input-background);
            transition: all 0.2s ease;
            cursor: pointer;
        }

        .upload-area.dragging {
            border-color: var(--focus-border-color);
            background: var(--input-focus-background);
        }

        .upload-area.hidden {
            display: none;
        }

        .upload-icon {
            font-size: 48px;
            margin-bottom: 12px;
            opacity: 0.5;
        }

        .upload-text {
            color: var(--text-color);
            font-size: 14px;
            margin-bottom: 8px;
        }

        .upload-subtext {
            color: var(--placeholder-color);
            font-size: 12px;
        }

        .documents-list {
            flex: 1;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .empty-state {
            text-align: center;
            padding: 60px 20px;
            color: var(--placeholder-color);
        }

        .empty-state-icon {
            font-size: 64px;
            margin-bottom: 16px;
            opacity: 0.3;
        }

        .document-card {
            background: var(--input-background);
            border: 1px solid var(--border-color);
            border-radius: 10px;
            padding: 16px;
            transition: all 0.2s ease;
        }

        .document-card:hover {
            border-color: var(--focus-border-color);
            background: var(--input-focus-background);
        }

        .document-header {
            display: flex;
            align-items: flex-start;
            gap: 12px;
            margin-bottom: 8px;
        }

        .document-icon {
            font-size: 24px;
            flex-shrink: 0;
        }

        .document-info {
            flex: 1;
            min-width: 0;
        }

        .document-name {
            font-weight: 500;
            font-size: 14px;
            color: var(--text-color);
            margin-bottom: 4px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .document-meta {
            font-size: 12px;
            color: var(--placeholder-color);
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
        }

        .document-actions {
            display: flex;
            gap: 8px;
        }

        .icon-button {
            background: transparent;
            border: 1px solid var(--border-color);
            border-radius: 6px;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s ease;
            font-size: 16px;
        }

        .icon-button:hover {
            background: var(--input-focus-background);
            border-color: var(--focus-border-color);
        }

        .icon-button.delete:hover {
            background: rgba(255, 68, 68, 0.1);
            border-color: #ff4444;
            color: #ff4444;
        }

        .document-stats {
            display: flex;
            gap: 16px;
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px solid var(--border-color);
        }

        .stat {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
            color: var(--placeholder-color);
        }

        .stat-icon {
            font-size: 14px;
        }

        .stat-value {
            font-weight: 500;
            color: var(--text-color);
        }

        .status-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 500;
            background: rgba(34, 197, 94, 0.1);
            color: #22c55e;
        }

        .progress-container {
            margin-top: 8px;
        }

        .progress-bar {
            width: 100%;
            height: 4px;
            background: var(--border-color);
            border-radius: 2px;
            overflow: hidden;
        }

        .progress-fill {
            height: 100%;
            background: var(--focus-border-color);
            transition: width 0.3s ease;
        }

        .progress-text {
            font-size: 11px;
            color: var(--placeholder-color);
            margin-top: 4px;
        }

        .preview-modal {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            padding: 20px;
        }

        .preview-content {
            background: var(--background-transparent);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            max-width: 800px;
            max-height: 80vh;
            width: 100%;
            display: flex;
            flex-direction: column;
        }

        .preview-header {
            padding: 16px;
            border-bottom: 1px solid var(--border-color);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .preview-title {
            font-weight: 600;
            font-size: 16px;
            color: var(--text-color);
        }

        .preview-body {
            padding: 16px;
            overflow-y: auto;
            flex: 1;
        }

        .preview-text {
            color: var(--text-color);
            font-size: 13px;
            line-height: 1.6;
            white-space: pre-wrap;
            word-wrap: break-word;
        }

        .chunk-section {
            margin-bottom: 24px;
            padding: 12px;
            background: var(--input-background);
            border-radius: 8px;
            border: 1px solid var(--border-color);
        }

        .chunk-header {
            font-weight: 500;
            font-size: 12px;
            color: var(--placeholder-color);
            margin-bottom: 8px;
        }

        input[type="file"] {
            display: none;
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
        documents: { type: Array },
        isUploading: { type: Boolean },
        uploadProgress: { type: Number },
        isDragging: { type: Boolean },
        previewDocument: { type: Object },
        showUploadArea: { type: Boolean },
    };

    constructor() {
        super();
        this.documents = [];
        this.isUploading = false;
        this.uploadProgress = 0;
        this.isDragging = false;
        this.previewDocument = null;
        this.showUploadArea = true;
    }

    async connectedCallback() {
        super.connectedCallback();
        await this.loadDocuments();
    }

    async loadDocuments() {
        try {
            this.documents = await documentDB.getAllDocuments();
            this.showUploadArea = this.documents.length === 0;
        } catch (error) {
            console.error('Error loading documents:', error);
        }
    }

    handleAddClick() {
        const fileInput = this.shadowRoot.querySelector('input[type="file"]');
        fileInput.click();
    }

    handleDragEnter(e) {
        e.preventDefault();
        this.isDragging = true;
    }

    handleDragOver(e) {
        e.preventDefault();
        this.isDragging = true;
    }

    handleDragLeave(e) {
        e.preventDefault();
        this.isDragging = false;
    }

    async handleDrop(e) {
        e.preventDefault();
        this.isDragging = false;

        const files = Array.from(e.dataTransfer.files).filter(file => file.type === 'application/pdf');

        if (files.length === 0) {
            console.warn('No PDF files found in drop');
            return;
        }

        console.log(`Processing ${files.length} PDF file(s):`, files.map(f => f.name).join(', '));
        await this.uploadFiles(files);
    }

    async handleFileSelect(e) {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            await this.uploadFiles(files);
        }
        // Reset input
        e.target.value = '';
    }

    async uploadFiles(files) {
        this.isUploading = true;
        this.uploadProgress = 0;

        let successCount = 0;
        let failedFiles = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
                // Update progress
                this.uploadProgress = Math.round(((i + 0.5) / files.length) * 100);

                console.log(`Processing PDF ${i + 1}/${files.length}: ${file.name}`);

                // Process PDF
                const processedDoc = await processPDFFile(file);

                // Add to database
                await documentDB.addDocument(processedDoc);

                successCount++;
                console.log(`✓ Successfully processed: ${file.name}`);

                // Update progress
                this.uploadProgress = Math.round(((i + 1) / files.length) * 100);
            } catch (error) {
                console.error('Error uploading file:', file.name, error);
                failedFiles.push({ name: file.name, error: error.message });
                // Continue with next file
            }
        }

        // Reload documents
        await this.loadDocuments();

        this.isUploading = false;
        this.uploadProgress = 0;

        // Show notification based on results
        const app = document.querySelector('prism-app');
        if (app && app.addErrorNotification) {
            if (successCount > 0 && failedFiles.length === 0) {
                // All files succeeded
                app.addErrorNotification({
                    type: 'info',
                    title: 'Documents Uploaded',
                    message: `Successfully processed ${successCount} document${successCount > 1 ? 's' : ''}. Documents are now available for context during interviews.`,
                });
            } else if (successCount > 0 && failedFiles.length > 0) {
                // Partial success
                app.addErrorNotification({
                    type: 'warning',
                    title: 'Partial Upload',
                    message: `Processed ${successCount} of ${files.length} documents. ${failedFiles.length} file${failedFiles.length > 1 ? 's' : ''} failed: ${failedFiles.map(f => f.name).join(', ')}`,
                });
            } else if (failedFiles.length > 0) {
                // All failed
                app.addErrorNotification({
                    type: 'error',
                    title: 'Upload Failed',
                    message: `Failed to process ${failedFiles.length} document${failedFiles.length > 1 ? 's' : ''}. Please ensure they are valid PDF files.`,
                    recoverySteps: [
                        'Check that the files are valid PDF documents',
                        'Ensure PDFs are not password-protected or corrupted',
                        'Try uploading files one at a time',
                    ],
                });
            }
        }
    }

    async handlePreview(doc) {
        this.previewDocument = doc;
    }

    closePreview() {
        this.previewDocument = null;
    }

    async handleDelete(doc) {
        if (confirm(`Are you sure you want to delete "${doc.fileName}"?`)) {
            try {
                await documentDB.deleteDocument(doc.id);
                await this.loadDocuments();
            } catch (error) {
                console.error('Error deleting document:', error);
            }
        }
    }

    renderUploadArea() {
        if (!this.showUploadArea && this.documents.length > 0) {
            return '';
        }

        return html`
            <div
                class="upload-area ${this.isDragging ? 'dragging' : ''}"
                @dragover=${this.handleDragOver}
                @dragleave=${this.handleDragLeave}
                @drop=${this.handleDrop}
                @click=${this.handleAddClick}
            >
                <div class="upload-icon">📄</div>
                <div class="upload-text">Drag and drop PDF files here</div>
                <div class="upload-subtext">or click to browse</div>
                ${this.isUploading
                    ? html`
                          <div class="progress-container">
                              <div class="progress-bar">
                                  <div class="progress-fill" style="width: ${this.uploadProgress}%"></div>
                              </div>
                              <div class="progress-text">Uploading... ${this.uploadProgress}%</div>
                          </div>
                      `
                    : ''}
            </div>
        `;
    }

    renderDocumentCard(doc) {
        return html`
            <div class="document-card">
                <div class="document-header">
                    <div class="document-icon">📝</div>
                    <div class="document-info">
                        <div class="document-name">${doc.fileName}</div>
                        <div class="document-meta">
                            <span>${doc.numPages} pages</span>
                            <span>${formatNumber(doc.totalTokens)} tokens</span>
                            <span>${formatFileSize(doc.fileSize)}</span>
                        </div>
                    </div>
                    <div class="document-actions">
                        <button class="icon-button" @click=${() => this.handlePreview(doc)} title="Preview">👁️</button>
                        <button class="icon-button delete" @click=${() => this.handleDelete(doc)} title="Delete">🗑️</button>
                    </div>
                </div>
                <div class="document-stats">
                    <div class="stat">
                        <span class="stat-icon">✓</span>
                        <span>Indexed</span>
                    </div>
                    <div class="stat">
                        <span class="stat-icon">📦</span>
                        <span class="stat-value">${doc.chunkCount}</span>
                        <span>chunks</span>
                    </div>
                    <div class="stat">
                        <span class="status-badge">
                            <span>✓</span>
                            <span>Ready</span>
                        </span>
                    </div>
                </div>
            </div>
        `;
    }

    renderPreviewModal() {
        if (!this.previewDocument) {
            return '';
        }

        return html`
            <div class="preview-modal" @click=${this.closePreview}>
                <div class="preview-content" @click=${e => e.stopPropagation()}>
                    <div class="preview-header">
                        <div class="preview-title">${this.previewDocument.fileName}</div>
                        <button class="icon-button" @click=${this.closePreview}>✕</button>
                    </div>
                    <div class="preview-body">
                        ${this.previewDocument.chunks && this.previewDocument.chunks.length > 0
                            ? this.previewDocument.chunks.map(
                                  (chunk, index) => html`
                                      <div class="chunk-section">
                                          <div class="chunk-header">
                                              Chunk ${index + 1} of ${this.previewDocument.chunkCount} (${chunk.tokens} tokens,
                                              ${chunk.sentences} sentences)
                                          </div>
                                          <div class="preview-text">${chunk.text}</div>
                                      </div>
                                  `
                              )
                            : html` <div class="preview-text">${this.previewDocument.text}</div> `}
                    </div>
                </div>
            </div>
        `;
    }

    render() {
        return html`
            <div class="container">
                <div class="header">
                    <div class="title">
                        <span>📄</span>
                        <span>My Documents</span>
                    </div>
                    ${this.documents.length > 0
                        ? html`
                              <button class="add-button" @click=${this.handleAddClick}>
                                  <span>+</span>
                                  <span>Add Document</span>
                              </button>
                          `
                        : ''}
                </div>

                ${this.renderUploadArea()}

                <div class="documents-list">
                    ${this.documents.length === 0 && !this.showUploadArea
                        ? html`
                              <div class="empty-state">
                                  <div class="empty-state-icon">📄</div>
                                  <div>No documents uploaded yet</div>
                              </div>
                          `
                        : this.documents.map(doc => this.renderDocumentCard(doc))}
                </div>

                <input type="file" accept=".pdf" multiple @change=${this.handleFileSelect} />
            </div>

            ${this.renderPreviewModal()}
        `;
    }
}

customElements.define('documents-view', DocumentsView);
