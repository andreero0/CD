import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';

export class TranscriptPanel extends LitElement {
    static styles = css`
        :host {
            display: flex;
            flex-direction: column;
            height: 100%;
            background: var(--input-background, rgba(255, 255, 255, 0.05));
            border-radius: 8px;
            overflow: hidden;
            border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
        }

        .transcript-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            background: var(--input-background, rgba(255, 255, 255, 0.08));
            border-bottom: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
        }

        .transcript-title {
            font-size: 14px;
            font-weight: 600;
            color: var(--text-color, white);
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .transcript-badge {
            background: var(--focus-border-color, #007aff);
            color: white;
            font-size: 11px;
            padding: 2px 8px;
            border-radius: 12px;
            font-weight: 600;
        }

        .toggle-button {
            background: transparent;
            border: 1px solid var(--border-color, rgba(255, 255, 255, 0.2));
            color: var(--text-color, white);
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s;
        }

        .toggle-button:hover {
            background: rgba(255, 255, 255, 0.1);
            border-color: var(--focus-border-color, #007aff);
        }

        .transcript-content {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
            scroll-behavior: smooth;
        }

        .transcript-entry {
            margin-bottom: 12px;
            padding: 8px 12px;
            border-radius: 6px;
            background: rgba(255, 255, 255, 0.03);
            border-left: 3px solid transparent;
            transition: all 0.2s;
            animation: slideIn 0.3s ease-out;
        }

        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateX(-10px);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }

        .transcript-entry.interviewer {
            border-left-color: #007aff;
            background: rgba(0, 122, 255, 0.08);
        }

        .transcript-entry.candidate {
            border-left-color: #34c759;
            background: rgba(52, 199, 89, 0.08);
        }

        .speaker-label {
            font-size: 12px;
            font-weight: 600;
            margin-bottom: 4px;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .speaker-label.interviewer {
            color: #007aff;
        }

        .speaker-label.candidate {
            color: #34c759;
        }

        .transcript-text {
            font-size: 13px;
            line-height: 1.5;
            color: var(--text-color, white);
            opacity: 0.9;
        }

        .transcript-content::-webkit-scrollbar {
            width: 6px;
        }

        .transcript-content::-webkit-scrollbar-track {
            background: var(--scrollbar-track, rgba(255, 255, 255, 0.05));
            border-radius: 3px;
        }

        .transcript-content::-webkit-scrollbar-thumb {
            background: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2));
            border-radius: 3px;
        }

        .transcript-content::-webkit-scrollbar-thumb:hover {
            background: var(--scrollbar-thumb-hover, rgba(255, 255, 255, 0.3));
        }

        .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: var(--description-color, rgba(255, 255, 255, 0.5));
            font-size: 13px;
            text-align: center;
            padding: 20px;
        }

        .empty-icon {
            font-size: 32px;
            margin-bottom: 8px;
        }

        :host(.collapsed) .transcript-content {
            display: none;
        }

        :host(.collapsed) {
            height: auto;
        }
    `;

    static properties = {
        transcriptEntries: { type: Array },
        isCollapsed: { type: Boolean },
    };

    constructor() {
        super();
        this.transcriptEntries = [];
        this.isCollapsed = false;
    }

    addTranscriptEntry(text) {
        // Parse the speaker format: "[Interviewer]: text" or "[Candidate]: text"
        // Updated regex to support multi-word speaker labels like "[Interviewer 1]:", "[Audience Member]:", etc.
        const speakerRegex = /\[([^\]]+)\]:\s*(.+)/;
        const match = text.match(speakerRegex);

        if (match) {
            const speaker = match[1];
            const transcript = match[2].trim();

            // Only add if not empty
            if (transcript) {
                this.transcriptEntries = [
                    ...this.transcriptEntries,
                    {
                        speaker: speaker,
                        text: transcript,
                        timestamp: new Date().toISOString(),
                    },
                ];

                // Auto-scroll to bottom after adding new entry
                this.requestUpdate();
                setTimeout(() => this.scrollToBottom(), 100);
            }
        }
    }

    parseAndAddTranscript(formattedText) {
        // Parse multi-line transcript with speaker labels
        const lines = formattedText.split('\n');
        lines.forEach(line => {
            if (line.trim()) {
                this.addTranscriptEntry(line);
            }
        });
    }

    clearTranscript() {
        this.transcriptEntries = [];
    }

    toggleCollapse() {
        this.isCollapsed = !this.isCollapsed;
        if (this.isCollapsed) {
            this.classList.add('collapsed');
        } else {
            this.classList.remove('collapsed');
        }
    }

    scrollToBottom() {
        const content = this.shadowRoot?.querySelector('.transcript-content');
        if (content) {
            content.scrollTop = content.scrollHeight;
        }
    }

    getSpeakerIcon(speaker) {
        // "You" is the candidate/user, everyone else is the other party
        return speaker === 'You' ? '◀' : '▶';
    }

    getSpeakerClass(speaker) {
        // "You" is the candidate/user, everyone else is the other party (interviewer, prospect, etc.)
        return speaker === 'You' ? 'candidate' : 'interviewer';
    }

    getSpeakerLabel(speaker) {
        // Display the speaker label as-is, as it comes from the backend with proper context
        // (e.g., "Interviewer 1", "Decision Maker", "Prospect", etc.)
        return speaker;
    }

    render() {
        const hasEntries = this.transcriptEntries.length > 0;

        return html`
            <div class="transcript-header">
                <div class="transcript-title">
                    <span>Transcript</span>
                    ${hasEntries ? html`<span class="transcript-badge">${this.transcriptEntries.length}</span>` : ''}
                </div>
                <button class="toggle-button" @click=${this.toggleCollapse}>
                    ${this.isCollapsed ? 'Show' : 'Hide'}
                </button>
            </div>

            <div class="transcript-content">
                ${hasEntries
                    ? this.transcriptEntries.map(
                          entry => html`
                              <div class="transcript-entry ${this.getSpeakerClass(entry.speaker)}">
                                  <div class="speaker-label ${this.getSpeakerClass(entry.speaker)}">
                                      <span>${this.getSpeakerIcon(entry.speaker)}</span>
                                      <span>${this.getSpeakerLabel(entry.speaker)}:</span>
                                  </div>
                                  <div class="transcript-text">${entry.text}</div>
                              </div>
                          `
                      )
                    : html`
                          <div class="empty-state">
                              <div class="empty-icon">●</div>
                              <div>Waiting for conversation...</div>
                              <div style="font-size: 11px; margin-top: 4px; opacity: 0.7;">Transcript will appear here as you speak</div>
                          </div>
                      `}
            </div>
        `;
    }
}

customElements.define('transcript-panel', TranscriptPanel);
