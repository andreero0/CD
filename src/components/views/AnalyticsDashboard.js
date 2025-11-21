import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';

/**
 * AnalyticsDashboard Component
 * Displays real-time and post-session analytics:
 * - Adherence score
 * - Response time metrics
 * - Filler word tracking
 * - Turn count
 * - Session duration
 * - Suggestion history
 * - Export functionality
 */
export class AnalyticsDashboard extends LitElement {
    static styles = css`
        :host {
            display: block;
            font-family: 'Inter', sans-serif;
            height: 100%;
            overflow-y: auto;
        }

        .dashboard-container {
            padding: 16px;
            max-width: 1200px;
            margin: 0 auto;
        }

        .dashboard-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 12px;
            border-bottom: 2px solid var(--border-color, rgba(255, 255, 255, 0.1));
        }

        .dashboard-title {
            font-size: 20px;
            font-weight: 600;
            color: var(--text-color, #fff);
        }

        .export-buttons {
            display: flex;
            gap: 8px;
        }

        .export-button {
            background: rgba(33, 150, 243, 0.2);
            color: #2196f3;
            border: 1px solid #2196f3;
            padding: 8px 14px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .export-button:hover {
            background: rgba(33, 150, 243, 0.3);
            transform: translateY(-1px);
        }

        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin-bottom: 24px;
        }

        .metric-card {
            background: var(--card-background, rgba(0, 0, 0, 0.5));
            border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
            border-radius: 8px;
            padding: 16px;
            transition: all 0.3s ease;
        }

        .metric-card:hover {
            border-color: rgba(255, 255, 255, 0.2);
            transform: translateY(-2px);
        }

        .metric-label {
            font-size: 11px;
            color: var(--description-color, rgba(255, 255, 255, 0.6));
            font-weight: 500;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .metric-value {
            font-size: 28px;
            font-weight: 700;
            color: var(--text-color, #fff);
            margin-bottom: 4px;
            font-variant-numeric: tabular-nums;
        }

        .metric-value.good {
            color: #4caf50;
        }

        .metric-value.warning {
            color: #ff9800;
        }

        .metric-value.poor {
            color: #f44336;
        }

        .metric-unit {
            font-size: 14px;
            color: var(--description-color, rgba(255, 255, 255, 0.6));
            font-weight: 400;
        }

        .metric-trend {
            font-size: 11px;
            margin-top: 4px;
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .trend-up {
            color: #4caf50;
        }

        .trend-down {
            color: #f44336;
        }

        .section-header {
            font-size: 16px;
            font-weight: 600;
            color: var(--text-color, #fff);
            margin: 24px 0 12px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .chart-container {
            background: var(--card-background, rgba(0, 0, 0, 0.5));
            border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 24px;
        }

        .adherence-chart {
            height: 200px;
            display: flex;
            align-items: flex-end;
            gap: 4px;
            padding: 12px;
        }

        .adherence-bar {
            flex: 1;
            background: linear-gradient(to top, #2196f3, #03a9f4);
            border-radius: 4px 4px 0 0;
            min-height: 4px;
            transition: all 0.3s ease;
            position: relative;
            cursor: pointer;
        }

        .adherence-bar:hover {
            opacity: 0.8;
        }

        .adherence-bar.good {
            background: linear-gradient(to top, #4caf50, #8bc34a);
        }

        .adherence-bar.warning {
            background: linear-gradient(to top, #ff9800, #ffc107);
        }

        .adherence-bar.poor {
            background: linear-gradient(to top, #f44336, #ff5722);
        }

        .suggestion-history {
            max-height: 400px;
            overflow-y: auto;
        }

        .suggestion-item {
            background: var(--card-background, rgba(0, 0, 0, 0.5));
            border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
            border-radius: 6px;
            padding: 12px;
            margin-bottom: 12px;
            transition: all 0.2s ease;
        }

        .suggestion-item:hover {
            border-color: rgba(255, 255, 255, 0.2);
        }

        .suggestion-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }

        .suggestion-timestamp {
            font-size: 10px;
            color: var(--description-color, rgba(255, 255, 255, 0.5));
        }

        .suggestion-score {
            font-size: 12px;
            font-weight: 600;
            padding: 3px 8px;
            border-radius: 12px;
        }

        .suggestion-score.good {
            background: rgba(76, 175, 80, 0.2);
            color: #4caf50;
        }

        .suggestion-score.warning {
            background: rgba(255, 152, 0, 0.2);
            color: #ff9800;
        }

        .suggestion-score.poor {
            background: rgba(244, 67, 54, 0.2);
            color: #f44336;
        }

        .suggestion-text {
            font-size: 12px;
            margin-bottom: 6px;
        }

        .suggestion-label {
            font-weight: 600;
            color: var(--description-color, rgba(255, 255, 255, 0.7));
            margin-bottom: 4px;
        }

        .suggestion-content {
            color: var(--text-color, #fff);
            line-height: 1.4;
        }

        .filler-breakdown {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
            gap: 8px;
        }

        .filler-item {
            background: rgba(255, 255, 255, 0.05);
            padding: 8px;
            border-radius: 6px;
            text-align: center;
        }

        .filler-word {
            font-size: 11px;
            color: var(--description-color, rgba(255, 255, 255, 0.6));
            margin-bottom: 4px;
        }

        .filler-count {
            font-size: 18px;
            font-weight: 700;
            color: #ff9800;
        }

        .empty-state {
            text-align: center;
            padding: 40px;
            color: var(--description-color, rgba(255, 255, 255, 0.6));
        }

        .empty-icon {
            font-size: 48px;
            margin-bottom: 16px;
            opacity: 0.5;
        }

        .turn-counts {
            display: flex;
            gap: 16px;
            flex-wrap: wrap;
        }

        .turn-count-item {
            flex: 1;
            min-width: 150px;
            background: rgba(255, 255, 255, 0.05);
            padding: 12px;
            border-radius: 6px;
            text-align: center;
        }

        .turn-speaker {
            font-size: 12px;
            color: var(--description-color, rgba(255, 255, 255, 0.6));
            margin-bottom: 6px;
        }

        .turn-number {
            font-size: 24px;
            font-weight: 700;
            color: #2196f3;
        }

        ::-webkit-scrollbar {
            width: 8px;
        }

        ::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.2);
            border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.3);
        }
    `;

    static properties = {
        metrics: { type: Object },
        suggestionHistory: { type: Array },
        adherenceHistory: { type: Array },
    };

    constructor() {
        super();
        this.metrics = {
            adherenceScore: 0,
            averageResponseTime: 0,
            fillerWordCount: 0,
            fillerWordBreakdown: {},
            turnCounts: {},
            totalTurns: 0,
            sessionDuration: 0,
            sessionDurationFormatted: '0s',
            suggestionCount: 0,
            matchedSuggestions: 0
        };
        this.suggestionHistory = [];
        this.adherenceHistory = [];

        // Update interval
        this._updateInterval = null;
    }

    connectedCallback() {
        super.connectedCallback();

        // Start real-time updates
        this._updateInterval = setInterval(() => {
            this.updateMetrics();
        }, 2000); // Update every 2 seconds

        // Initial update
        this.updateMetrics();

        // Listen for analytics updates from main process
        if (window.electron) {
            this._analyticsUpdateHandler = (data) => {
                this.handleAnalyticsUpdate(data);
            };
            window.electron.on('analytics-update', this._analyticsUpdateHandler);
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();

        if (this._updateInterval) {
            clearInterval(this._updateInterval);
        }

        if (window.electron && this._analyticsUpdateHandler) {
            window.electron.off('analytics-update', this._analyticsUpdateHandler);
        }
    }

    updateMetrics() {
        // Get metrics from sessionAnalytics if available
        if (window.sessionAnalytics) {
            this.metrics = window.sessionAnalytics.getRealTimeMetrics();
            this.suggestionHistory = window.sessionAnalytics.getSuggestionHistory();
            this.adherenceHistory = window.sessionAnalytics.adherenceScores || [];
            this.requestUpdate();
        }
    }

    handleAnalyticsUpdate(data) {
        if (data.metrics) {
            this.metrics = { ...this.metrics, ...data.metrics };
        }
        if (data.suggestionHistory) {
            this.suggestionHistory = data.suggestionHistory;
        }
        if (data.adherenceHistory) {
            this.adherenceHistory = data.adherenceHistory;
        }
        this.requestUpdate();
    }

    getScoreClass(score) {
        if (score >= 70) return 'good';
        if (score >= 40) return 'warning';
        return 'poor';
    }

    formatTime(ms) {
        if (ms < 1000) return `${ms}ms`;
        const seconds = Math.floor(ms / 1000);
        if (seconds < 60) return `${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        return `${minutes}m ${seconds % 60}s`;
    }

    formatTimestamp(isoString) {
        const date = new Date(isoString);
        return date.toLocaleTimeString();
    }

    async exportJSON() {
        if (!window.sessionAnalytics) {
            console.error('sessionAnalytics not available');
            return;
        }

        try {
            const jsonData = window.sessionAnalytics.exportAsJSON(true);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `session-analytics-${timestamp}.json`;

            if (window.electron) {
                // Use Electron's save dialog
                const result = await window.electron.invoke('save-file', {
                    content: jsonData,
                    filename: filename,
                    filters: [
                        { name: 'JSON Files', extensions: ['json'] },
                        { name: 'All Files', extensions: ['*'] }
                    ],
                    isBinary: false
                });

                if (result.success) {
                    console.log('Session analytics exported to:', result.filePath);
                    this.showNotification('Analytics exported successfully!');
                }
            } else {
                // Fallback: download in browser
                const blob = new Blob([jsonData], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.click();
                URL.revokeObjectURL(url);
            }
        } catch (error) {
            console.error('Error exporting analytics:', error);
            this.showNotification('Failed to export analytics', 'error');
        }
    }

    async exportPDF() {
        // This would require jsPDF library which is already in dependencies
        if (!window.jspdf) {
            console.error('jsPDF not loaded');
            this.showNotification('PDF export not available', 'error');
            return;
        }

        try {
            const report = window.sessionAnalytics.generateSessionReport();

            // Create PDF (simplified version - would need full implementation)
            const doc = new window.jspdf.jsPDF();

            doc.setFontSize(18);
            doc.text('Session Analytics Report', 20, 20);

            doc.setFontSize(12);
            doc.text(`Duration: ${report.sessionInfo.durationFormatted}`, 20, 40);
            doc.text(`Adherence Score: ${report.metrics.adherenceScore}%`, 20, 50);
            doc.text(`Total Turns: ${report.metrics.totalTurns}`, 20, 60);
            doc.text(`Filler Words: ${report.metrics.totalFillerWords}`, 20, 70);

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `session-analytics-${timestamp}.pdf`;

            if (window.electron) {
                const pdfData = doc.output('arraybuffer');
                const base64 = btoa(String.fromCharCode(...new Uint8Array(pdfData)));

                const result = await window.electron.invoke('save-file', {
                    content: base64,
                    filename: filename,
                    filters: [
                        { name: 'PDF Files', extensions: ['pdf'] },
                        { name: 'All Files', extensions: ['*'] }
                    ],
                    isBinary: true
                });

                if (result.success) {
                    console.log('PDF exported to:', result.filePath);
                    this.showNotification('PDF exported successfully!');
                }
            } else {
                doc.save(filename);
            }
        } catch (error) {
            console.error('Error exporting PDF:', error);
            this.showNotification('Failed to export PDF', 'error');
        }
    }

    showNotification(message, type = 'success') {
        // Simple notification - could be enhanced
        console.log(`[${type.toUpperCase()}] ${message}`);
    }

    renderMetrics() {
        return html`
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-label">📊 Adherence Score</div>
                    <div class="metric-value ${this.getScoreClass(this.metrics.adherenceScore)}">
                        ${this.metrics.adherenceScore}<span class="metric-unit">%</span>
                    </div>
                </div>

                <div class="metric-card">
                    <div class="metric-label">⏱️ Avg Response Time</div>
                    <div class="metric-value">
                        ${this.formatTime(this.metrics.averageResponseTime)}
                    </div>
                </div>

                <div class="metric-card">
                    <div class="metric-label">💬 Filler Words</div>
                    <div class="metric-value warning">
                        ${this.metrics.fillerWordCount}
                    </div>
                </div>

                <div class="metric-card">
                    <div class="metric-label">🔄 Total Turns</div>
                    <div class="metric-value">
                        ${this.metrics.totalTurns}
                    </div>
                </div>

                <div class="metric-card">
                    <div class="metric-label">⏰ Duration</div>
                    <div class="metric-value">
                        ${this.metrics.sessionDurationFormatted}
                    </div>
                </div>

                <div class="metric-card">
                    <div class="metric-label">🎯 Suggestions</div>
                    <div class="metric-value">
                        ${this.metrics.matchedSuggestions}<span class="metric-unit">/${this.metrics.suggestionCount}</span>
                    </div>
                </div>
            </div>
        `;
    }

    renderAdherenceChart() {
        if (this.adherenceHistory.length === 0) {
            return html`
                <div class="empty-state">
                    <div class="empty-icon">📈</div>
                    <p>No adherence data yet. Start following AI suggestions!</p>
                </div>
            `;
        }

        const maxHeight = 180;
        const bars = this.adherenceHistory.slice(-20); // Show last 20

        return html`
            <div class="adherence-chart">
                ${bars.map(score => {
                    const height = (score / 100) * maxHeight;
                    const scoreClass = this.getScoreClass(score);
                    return html`
                        <div
                            class="adherence-bar ${scoreClass}"
                            style="height: ${height}px"
                            title="Adherence: ${score}%"
                        ></div>
                    `;
                })}
            </div>
        `;
    }

    renderSuggestionHistory() {
        if (this.suggestionHistory.length === 0) {
            return html`
                <div class="empty-state">
                    <div class="empty-icon">💡</div>
                    <p>No suggestions yet. AI will provide suggestions during the session.</p>
                </div>
            `;
        }

        return html`
            <div class="suggestion-history">
                ${this.suggestionHistory.map(item => {
                    const scoreClass = item.adherenceScore !== null
                        ? this.getScoreClass(item.adherenceScore)
                        : 'warning';

                    return html`
                        <div class="suggestion-item">
                            <div class="suggestion-header">
                                <span class="suggestion-timestamp">${this.formatTimestamp(item.timestamp)}</span>
                                ${item.adherenceScore !== null ? html`
                                    <span class="suggestion-score ${scoreClass}">
                                        ${item.adherenceScore}%
                                    </span>
                                ` : ''}
                            </div>
                            <div class="suggestion-text">
                                <div class="suggestion-label">AI Suggested:</div>
                                <div class="suggestion-content">${item.suggested}</div>
                            </div>
                            ${item.actual ? html`
                                <div class="suggestion-text">
                                    <div class="suggestion-label">You Said:</div>
                                    <div class="suggestion-content">${item.actual}</div>
                                </div>
                            ` : html`
                                <div class="suggestion-text">
                                    <div class="suggestion-label" style="color: #ff9800;">Waiting for response...</div>
                                </div>
                            `}
                        </div>
                    `;
                })}
            </div>
        `;
    }

    renderFillerBreakdown() {
        const breakdown = this.metrics.fillerWordBreakdown;
        const entries = Object.entries(breakdown);

        if (entries.length === 0) {
            return html`<p style="color: var(--description-color, rgba(255, 255, 255, 0.6));">No filler words detected yet.</p>`;
        }

        return html`
            <div class="filler-breakdown">
                ${entries.map(([word, count]) => html`
                    <div class="filler-item">
                        <div class="filler-word">${word}</div>
                        <div class="filler-count">${count}</div>
                    </div>
                `)}
            </div>
        `;
    }

    renderTurnCounts() {
        const counts = this.metrics.turnCounts;
        const entries = Object.entries(counts);

        if (entries.length === 0) {
            return html`<p style="color: var(--description-color, rgba(255, 255, 255, 0.6));">No conversation turns yet.</p>`;
        }

        return html`
            <div class="turn-counts">
                ${entries.map(([speaker, count]) => html`
                    <div class="turn-count-item">
                        <div class="turn-speaker">${speaker}</div>
                        <div class="turn-number">${count}</div>
                    </div>
                `)}
            </div>
        `;
    }

    render() {
        return html`
            <div class="dashboard-container">
                <div class="dashboard-header">
                    <div class="dashboard-title">Session Analytics</div>
                    <div class="export-buttons">
                        <button class="export-button" @click=${this.exportJSON}>
                            📄 Export JSON
                        </button>
                        <button class="export-button" @click=${this.exportPDF}>
                            📑 Export PDF
                        </button>
                    </div>
                </div>

                <div class="section-header">📊 Real-Time Metrics</div>
                ${this.renderMetrics()}

                <div class="section-header">📈 Adherence Over Time</div>
                <div class="chart-container">
                    ${this.renderAdherenceChart()}
                </div>

                <div class="section-header">💬 Filler Words Breakdown</div>
                <div class="chart-container">
                    ${this.renderFillerBreakdown()}
                </div>

                <div class="section-header">🔄 Turn Counts</div>
                <div class="chart-container">
                    ${this.renderTurnCounts()}
                </div>

                <div class="section-header">💡 Suggestion History</div>
                ${this.renderSuggestionHistory()}
            </div>
        `;
    }
}

customElements.define('analytics-dashboard', AnalyticsDashboard);
