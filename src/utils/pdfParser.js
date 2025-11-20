/**
 * PDF parsing and text chunking utilities
 * Handles PDF extraction and text segmentation for RAG system
 */

/**
 * Parse a PDF file and extract text
 * @param {ArrayBuffer} fileBuffer - PDF file buffer
 * @returns {Promise<Object>} Parsed PDF data
 */
export async function parsePDF(fileBuffer) {
    try {
        // Import pdf-parse dynamically for Electron compatibility
        const pdfParse = window.require ? window.require('pdf-parse') : null;

        if (!pdfParse) {
            throw new Error('pdf-parse not available');
        }

        const data = await pdfParse(Buffer.from(fileBuffer));

        return {
            text: data.text,
            numPages: data.numpages,
            info: data.info,
            metadata: data.metadata,
        };
    } catch (error) {
        console.error('Error parsing PDF:', error);
        throw new Error('Failed to parse PDF: ' + error.message);
    }
}

/**
 * Estimate token count for text
 * Uses a simple heuristic: ~4 characters per token (GPT-style tokenization)
 * @param {string} text - Text to count tokens for
 * @returns {number} Estimated token count
 */
export function estimateTokenCount(text) {
    if (!text) return 0;

    // Simple heuristic: average of 4 characters per token
    // More accurate would be to use a tokenizer, but this works for estimation
    return Math.ceil(text.length / 4);
}

/**
 * Split text into sentences
 * @param {string} text - Text to split
 * @returns {Array<string>} Array of sentences
 */
function splitIntoSentences(text) {
    // Split on sentence boundaries while preserving the delimiter
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    return sentences.map(s => s.trim()).filter(s => s.length > 0);
}

/**
 * Chunk text into segments of target token size
 * @param {string} text - Text to chunk
 * @param {number} minTokens - Minimum tokens per chunk (default: 200)
 * @param {number} maxTokens - Maximum tokens per chunk (default: 400)
 * @returns {Array<Object>} Array of chunks with text and metadata
 */
export function chunkText(text, minTokens = 200, maxTokens = 400) {
    const chunks = [];
    const sentences = splitIntoSentences(text);

    let currentChunk = '';
    let currentTokens = 0;
    let chunkIndex = 0;

    for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i];
        const sentenceTokens = estimateTokenCount(sentence);

        // If adding this sentence would exceed max tokens and we have content
        if (currentTokens + sentenceTokens > maxTokens && currentTokens > 0) {
            // Save current chunk if it meets minimum token requirement
            if (currentTokens >= minTokens) {
                chunks.push({
                    index: chunkIndex++,
                    text: currentChunk.trim(),
                    tokens: currentTokens,
                    sentences: currentChunk.split(/[.!?]+/).filter(s => s.trim().length > 0).length,
                });
                currentChunk = '';
                currentTokens = 0;
            }
        }

        // Add sentence to current chunk
        currentChunk += (currentChunk ? ' ' : '') + sentence;
        currentTokens += sentenceTokens;

        // If this chunk is at a good size, save it
        if (currentTokens >= minTokens && currentTokens <= maxTokens) {
            // Look ahead to see if the next sentence would fit
            const nextSentence = sentences[i + 1];
            if (nextSentence) {
                const nextTokens = estimateTokenCount(nextSentence);
                if (currentTokens + nextTokens > maxTokens) {
                    // Save current chunk
                    chunks.push({
                        index: chunkIndex++,
                        text: currentChunk.trim(),
                        tokens: currentTokens,
                        sentences: currentChunk.split(/[.!?]+/).filter(s => s.trim().length > 0).length,
                    });
                    currentChunk = '';
                    currentTokens = 0;
                }
            }
        }
    }

    // Add remaining text as final chunk
    if (currentChunk.trim().length > 0) {
        chunks.push({
            index: chunkIndex,
            text: currentChunk.trim(),
            tokens: currentTokens,
            sentences: currentChunk.split(/[.!?]+/).filter(s => s.trim().length > 0).length,
        });
    }

    return chunks;
}

/**
 * Process a PDF file completely: parse and chunk
 * @param {File} file - PDF file object
 * @returns {Promise<Object>} Processed document with metadata and chunks
 */
export async function processPDFFile(file) {
    try {
        // Read file as ArrayBuffer
        const fileBuffer = await file.arrayBuffer();

        // Parse PDF
        const pdfData = await parsePDF(fileBuffer);

        // Clean up text (remove excessive whitespace, normalize line breaks)
        const cleanText = pdfData.text
            .replace(/\r\n/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .replace(/[ \t]+/g, ' ')
            .trim();

        // Chunk the text
        const chunks = chunkText(cleanText);

        // Calculate total tokens
        const totalTokens = chunks.reduce((sum, chunk) => sum + chunk.tokens, 0);

        return {
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            numPages: pdfData.numPages,
            text: cleanText,
            chunks: chunks,
            chunkCount: chunks.length,
            totalTokens: totalTokens,
            metadata: pdfData.info,
            type: 'pdf',
        };
    } catch (error) {
        console.error('Error processing PDF file:', error);
        throw error;
    }
}

/**
 * Format file size for display
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
export function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Format number with commas
 * @param {number} num - Number to format
 * @returns {string} Formatted number
 */
export function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
