// tokenCounter.js - Accurate token counting using @xenova/transformers
// Provides precise token counting for context window management

let tokenizer = null;
let tokenizerPromise = null;
let transformersModule = null;

/**
 * Load the transformers module (ES Module)
 */
async function loadTransformers() {
    if (transformersModule) {
        return transformersModule;
    }

    try {
        transformersModule = await import('@xenova/transformers');
        return transformersModule;
    } catch (error) {
        console.error('Failed to load @xenova/transformers for tokenization:', error);
        throw error;
    }
}

/**
 * Initialize the tokenizer
 * Uses a compatible tokenizer model for accurate token counting
 * @returns {Promise<AutoTokenizer>} - Initialized tokenizer
 */
async function initializeTokenizer() {
    if (tokenizer) {
        return tokenizer;
    }

    if (tokenizerPromise) {
        return tokenizerPromise;
    }

    console.log('Initializing tokenizer for accurate token counting...');

    try {
        const transformers = await loadTransformers();
        
        // Use a compatible tokenizer - Xenova/gpt-3.5-turbo is a good general-purpose choice
        // that provides accurate token counts for most text
        tokenizerPromise = transformers.AutoTokenizer.from_pretrained('Xenova/gpt-3.5-turbo');
        
        tokenizer = await tokenizerPromise;
        console.log('Tokenizer initialized successfully');
        return tokenizer;
    } catch (error) {
        console.error('Failed to initialize tokenizer:', error);
        tokenizerPromise = null;
        throw error;
    }
}

/**
 * Count tokens in text using the tokenizer
 * @param {string} text - Text to count tokens for
 * @returns {Promise<number>} - Accurate token count
 */
async function countTokens(text) {
    if (!text || typeof text !== 'string') {
        return 0;
    }

    try {
        const tok = await initializeTokenizer();
        const encoded = await tok.encode(text);
        return encoded.length;
    } catch (error) {
        console.error('Error counting tokens:', error);
        // Fallback to character-based estimation if tokenizer fails
        return Math.ceil(text.length / 4);
    }
}

/**
 * Truncate text to a maximum token limit
 * @param {string} text - Text to truncate
 * @param {number} maxTokens - Maximum number of tokens
 * @returns {Promise<string>} - Truncated text
 */
async function truncateToTokenLimit(text, maxTokens) {
    if (!text || typeof text !== 'string') {
        return '';
    }

    try {
        const tok = await initializeTokenizer();
        const encoded = await tok.encode(text);
        
        // If already within limit, return as-is
        if (encoded.length <= maxTokens) {
            return text;
        }

        // Truncate tokens and decode back to text
        const truncatedTokens = encoded.slice(0, maxTokens);
        const truncatedText = await tok.decode(truncatedTokens, { skip_special_tokens: true });
        
        console.log(`Truncated text from ${encoded.length} to ${maxTokens} tokens`);
        return truncatedText;
    } catch (error) {
        console.error('Error truncating text:', error);
        // Fallback to character-based truncation
        const estimatedChars = maxTokens * 4;
        return text.substring(0, estimatedChars);
    }
}

/**
 * Count tokens for multiple texts in batch
 * @param {string[]} texts - Array of texts to count tokens for
 * @returns {Promise<number[]>} - Array of token counts
 */
async function countTokensBatch(texts) {
    if (!Array.isArray(texts) || texts.length === 0) {
        return [];
    }

    try {
        const tok = await initializeTokenizer();
        const counts = await Promise.all(
            texts.map(async (text) => {
                if (!text || typeof text !== 'string') {
                    return 0;
                }
                const encoded = await tok.encode(text);
                return encoded.length;
            })
        );
        return counts;
    } catch (error) {
        console.error('Error counting tokens in batch:', error);
        // Fallback to character-based estimation
        return texts.map(text => Math.ceil((text?.length || 0) / 4));
    }
}

/**
 * Check if text exceeds token limit
 * @param {string} text - Text to check
 * @param {number} limit - Token limit
 * @returns {Promise<boolean>} - True if text exceeds limit
 */
async function exceedsTokenLimit(text, limit) {
    const tokenCount = await countTokens(text);
    return tokenCount > limit;
}

/**
 * Clean up tokenizer resources
 */
async function cleanup() {
    if (tokenizer) {
        console.log('Cleaning up tokenizer...');
        tokenizer = null;
        tokenizerPromise = null;
        transformersModule = null;
    }
}

module.exports = {
    initializeTokenizer,
    countTokens,
    truncateToTokenLimit,
    countTokensBatch,
    exceedsTokenLimit,
    cleanup,
};
