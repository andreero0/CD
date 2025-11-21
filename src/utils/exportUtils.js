/**
 * Export utility functions for PDF and Markdown generation
 */

/**
 * Format duration from milliseconds to readable string
 */
function formatDuration(startTime, endTime = Date.now()) {
    const duration = Math.floor((endTime - startTime) / 1000);
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = duration % 60;

    if (hours > 0) {
        return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
    } else {
        return `${seconds}s`;
    }
}

/**
 * Format timestamp to readable string
 */
function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

/**
 * Export responses as Markdown
 * @param {Object} options - Export options
 * @param {Array} options.responses - Array of response objects
 * @param {Object} options.sessionInfo - Session metadata
 * @param {String} options.profile - Session profile type
 * @returns {String} - Markdown formatted string
 */
export function exportAsMarkdown({ responses, sessionInfo = {}, profile = 'interview' }) {
    const profileNames = {
        interview: 'Job Interview',
        sales: 'Sales Call',
        meeting: 'Business Meeting',
        presentation: 'Presentation',
        negotiation: 'Negotiation',
        exam: 'Exam Assistant',
    };

    const sessionDate = sessionInfo.timestamp ? new Date(sessionInfo.timestamp) : new Date();
    const duration = sessionInfo.startTime
        ? formatDuration(sessionInfo.startTime, sessionInfo.endTime || Date.now())
        : 'N/A';
    const profileName = profileNames[profile] || profile;

    // Build YAML frontmatter
    let markdown = '---\n';
    markdown += `title: "${profileName} Session"\n`;
    markdown += `date: ${sessionDate.toISOString()}\n`;
    markdown += `duration: ${duration}\n`;
    markdown += `responses: ${responses.length}\n`;
    markdown += `profile: ${profile}\n`;
    markdown += '---\n\n';

    // Title
    markdown += `# ${profileName} Session - ${sessionDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    })}\n\n`;

    // Session metadata
    markdown += `**Duration:** ${duration} | **Responses:** ${responses.length}\n\n`;

    if (sessionInfo.topics && sessionInfo.topics.length > 0) {
        markdown += `**Topics:** ${sessionInfo.topics.map(t => t.name).join(', ')}\n\n`;
    }

    markdown += '---\n\n';

    // Add each response
    responses.forEach((response, index) => {
        const responseObj = typeof response === 'string' ? { content: response } : response;
        const content = responseObj.content || responseObj.response || response;
        const timestamp = responseObj.timestamp
            ? formatTimestamp(responseObj.timestamp)
            : 'N/A';

        markdown += `## Response ${index + 1}\n\n`;
        markdown += `**Time:** ${timestamp}\n\n`;
        markdown += `${content}\n\n`;
        markdown += '---\n\n';
    });

    // Footer
    markdown += `\n*Exported from Prism on ${new Date().toLocaleDateString()}*\n`;

    return markdown;
}

/**
 * Export responses as PDF
 * @param {Object} options - Export options
 * @param {Array} options.responses - Array of response objects
 * @param {Object} options.sessionInfo - Session metadata
 * @param {String} options.profile - Session profile type
 * @returns {Promise<jsPDF>} - jsPDF instance
 */
export async function exportAsPDF({ responses, sessionInfo = {}, profile = 'interview' }) {
    // Dynamic import for jsPDF
    const { jsPDF } = await import('jspdf');

    const profileNames = {
        interview: 'Job Interview',
        sales: 'Sales Call',
        meeting: 'Business Meeting',
        presentation: 'Presentation',
        negotiation: 'Negotiation',
        exam: 'Exam Assistant',
    };

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const maxWidth = pageWidth - 2 * margin;
    let yPosition = margin;

    const sessionDate = sessionInfo.timestamp ? new Date(sessionInfo.timestamp) : new Date();
    const duration = sessionInfo.startTime
        ? formatDuration(sessionInfo.startTime, sessionInfo.endTime || Date.now())
        : 'N/A';
    const profileName = profileNames[profile] || profile;

    // Helper function to check if we need a new page
    const checkPageBreak = (neededSpace) => {
        if (yPosition + neededSpace > pageHeight - margin) {
            doc.addPage();
            yPosition = margin;
            return true;
        }
        return false;
    };

    // Helper function to add text with word wrapping
    const addWrappedText = (text, fontSize, fontStyle = 'normal', color = [0, 0, 0]) => {
        doc.setFontSize(fontSize);
        doc.setFont('helvetica', fontStyle);
        doc.setTextColor(...color);

        const lines = doc.splitTextToSize(text, maxWidth);
        const lineHeight = fontSize * 0.5;

        lines.forEach((line, index) => {
            checkPageBreak(lineHeight);
            doc.text(line, margin, yPosition);
            yPosition += lineHeight;
        });

        return yPosition;
    };

    // Title Page
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text(profileName, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;

    doc.setFontSize(16);
    doc.setFont('helvetica', 'normal');
    doc.text('Session Report', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 20;

    // Session metadata box
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(245, 245, 245);
    const boxHeight = 40;
    checkPageBreak(boxHeight);
    doc.roundedRect(margin, yPosition, maxWidth, boxHeight, 3, 3, 'FD');

    yPosition += 10;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Date:', margin + 5, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(
        sessionDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        }),
        margin + 30,
        yPosition
    );

    yPosition += 8;
    doc.setFont('helvetica', 'bold');
    doc.text('Duration:', margin + 5, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(duration, margin + 30, yPosition);

    yPosition += 8;
    doc.setFont('helvetica', 'bold');
    doc.text('Responses:', margin + 5, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(responses.length.toString(), margin + 30, yPosition);

    yPosition += 15;

    // Topics if available
    if (sessionInfo.topics && sessionInfo.topics.length > 0) {
        checkPageBreak(20);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Topics Covered:', margin, yPosition);
        yPosition += 7;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        const topicsText = sessionInfo.topics.map(t => `${t.name} (${t.count})`).join(', ');
        addWrappedText(topicsText, 10, 'normal', [100, 100, 100]);
        yPosition += 5;
    }

    // Table of Contents
    checkPageBreak(30);
    yPosition += 10;
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Table of Contents', margin, yPosition);
    yPosition += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    responses.forEach((response, index) => {
        checkPageBreak(7);
        const responseObj = typeof response === 'string' ? { content: response } : response;
        const preview =
            (responseObj.content || responseObj.response || response).substring(0, 60) + '...';
        doc.text(`${index + 1}. Response ${index + 1}: ${preview}`, margin + 5, yPosition);
        yPosition += 7;
    });

    // Start new page for responses
    doc.addPage();
    yPosition = margin;

    // Add each response
    responses.forEach((response, index) => {
        const responseObj = typeof response === 'string' ? { content: response } : response;
        const content = responseObj.content || responseObj.response || response;
        const timestamp = responseObj.timestamp
            ? formatTimestamp(responseObj.timestamp)
            : 'N/A';

        // Response header
        checkPageBreak(25);
        doc.setFillColor(240, 240, 240);
        doc.rect(margin, yPosition, maxWidth, 12, 'F');

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(`Response ${index + 1}`, margin + 3, yPosition + 8);

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(`Time: ${timestamp}`, pageWidth - margin - 50, yPosition + 8);

        yPosition += 15;
        doc.setTextColor(0, 0, 0);

        // Response content
        checkPageBreak(15);
        addWrappedText(content, 10, 'normal');
        yPosition += 10;

        // Separator line
        if (index < responses.length - 1) {
            checkPageBreak(5);
            doc.setDrawColor(200, 200, 200);
            doc.line(margin, yPosition, pageWidth - margin, yPosition);
            yPosition += 10;
        }
    });

    // Footer on each page
    const totalPages = doc.internal.pages.length - 1;
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(150, 150, 150);
        doc.text(
            `Generated by Prism - Page ${i} of ${totalPages}`,
            pageWidth / 2,
            pageHeight - 10,
            { align: 'center' }
        );
    }

    return doc;
}

/**
 * Download exported data as a file
 * @param {String|ArrayBuffer|Uint8Array} content - File content
 * @param {String} filename - Filename with extension
 * @param {String} mimeType - MIME type
 * @param {Boolean} isBinary - Whether content is binary data
 * @returns {Promise<Object>} - Result object with success status
 */
export async function downloadFile(content, filename, mimeType = 'text/plain', isBinary = false) {
    // Use Electron IPC for file saving when available
    if (window.electron && window.electron.invoke) {
        try {
            // Determine file filter based on file extension
            const ext = filename.split('.').pop().toLowerCase();
            const filters = [];

            if (ext === 'pdf') {
                filters.push({ name: 'PDF Document', extensions: ['pdf'] });
            } else if (ext === 'md') {
                filters.push({ name: 'Markdown', extensions: ['md'] });
            } else if (ext === 'txt') {
                filters.push({ name: 'Text File', extensions: ['txt'] });
            }
            filters.push({ name: 'All Files', extensions: ['*'] });

            // Convert binary data to base64 for IPC transfer
            let contentToSend = content;
            if (isBinary && content instanceof Uint8Array) {
                // Convert Uint8Array to base64 string
                const binary = String.fromCharCode.apply(null, content);
                contentToSend = btoa(binary);
            } else if (isBinary && content instanceof ArrayBuffer) {
                // Convert ArrayBuffer to base64 string
                const uint8 = new Uint8Array(content);
                const binary = String.fromCharCode.apply(null, uint8);
                contentToSend = btoa(binary);
            }

            const result = await window.electron.invoke('save-file', {
                content: contentToSend,
                filename: filename,
                filters: filters,
                isBinary: isBinary
            });

            return result;
        } catch (error) {
            console.error('Error using Electron file save:', error);
            // Fall through to browser download method
        }
    }

    // Fallback: Browser download method
    try {
        let blob;
        if (isBinary && (content instanceof Uint8Array || content instanceof ArrayBuffer)) {
            blob = new Blob([content], { type: mimeType });
        } else {
            blob = new Blob([content], { type: mimeType });
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        return { success: true, message: 'File downloaded' };
    } catch (error) {
        console.error('Error downloading file:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Copy text to clipboard
 * @param {String} text - Text to copy
 * @returns {Promise<Boolean>} - Success status
 */
export async function copyToClipboard(text) {
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        } else {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            const success = document.execCommand('copy');
            document.body.removeChild(textarea);
            return success;
        }
    } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        return false;
    }
}

/**
 * Generate filename for export
 * @param {String} format - File format (pdf, md)
 * @param {String} profile - Session profile
 * @returns {String} - Generated filename
 */
export function generateFilename(format, profile = 'session') {
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0];
    const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-');
    return `prism-${profile}-${dateStr}-${timeStr}.${format}`;
}
