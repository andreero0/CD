# Design Document - RAG System Fixes

## Overview

This design addresses critical bugs in the RAG (Retrieval-Augmented Generation) system that prevent it from functioning correctly. The fixes ensure proper async initialization, cross-environment compatibility, and robust error handling throughout the RAG pipeline.

## Architecture

The RAG system consists of several interconnected modules:

```
┌─────────────────┐
│  Gemini.js      │ ← Main conversation flow
│  (Renderer)     │
└────────┬────────┘
         │ IPC
         ▼
┌─────────────────┐
│  RAG Controller │ ← Orchestrates RAG operations
│  (Main Process) │
└────────┬────────┘
         │
    ┌────┴────┬────────────┬──────────────┐
    ▼         ▼            ▼              ▼
┌─────────┐ ┌──────────┐ ┌────────────┐ ┌──────────┐
│Embeddings│ │Vector    │ │RAG Storage │ │Document  │
│         │ │Search    │ │(IndexedDB) │ │Retriever │
└─────────┘ └──────────┘ └────────────┘ └──────────┘
```

## Components and Interfaces

### 1. Embeddings Module (`src/utils/embeddings.js`)

**Current Issues:**
- Pipeline initialization is async but called synchronously
- No lazy initialization guard
- Fails in test environments

**Fixed Interface:**
```javascript
// Async initialization with singleton pattern
async function initializeEmbeddings(): Promise<Pipeline>

// Generates embedding with automatic initialization
async function generateEmbedding(text: string): Promise<number[]>

// Batch processing with proper async handling
async function generateEmbeddings(texts: string[]): Promise<number[][]>

// Document chunking (synchronous, no changes needed)
function chunkDocument(document: string, chunkSize: number, overlap: number): Chunk[]
```

**Key Changes:**
- Add initialization lock to prevent race conditions
- Ensure pipeline is awaited before use
- Add timeout handling for model loading

### 2. Vector Search Module (`src/utils/vectorSearch.js`)

**Current Issues:**
- Assumes Electron `app` object is always available
- Fails in test environments
- No fallback path handling

**Fixed Interface:**
```javascript
// Safe path resolution with fallback
function getIndexPath(filename: string): string

// Load with environment detection
function loadIndex(filename?: string): boolean

// Save with environment detection
function saveIndex(filename?: string): string
```

**Key Changes:**
- Check for `app` availability before calling `getPath()`
- Use `process.cwd()` + `.rag-data/` as fallback
- Create directory if it doesn't exist

### 3. RAG Controller (`src/utils/ragController.js`)

**Current Issues:**
- No integration point for conversation flow
- Missing word count threshold logic
- Insufficient error handling

**Fixed Interface:**
```javascript
// Existing functions (no changes)
async function initializeRAG(): Promise<boolean>
async function retrieveContext(question: string, sessionId: string, options: object): Promise<object>
async function processConversationHistory(sessionId: string, history: array): Promise<object>

// No changes needed - controller is working correctly
```

### 4. Gemini Module (`src/utils/gemini.js`)

**Current Issues:**
- Missing `queryRAGIfNeeded` function
- No query classification logic
- RAG not integrated into conversation flow
- No XML formatting for retrieved context

**New Function:**
```javascript
/**
 * Query RAG system using intent-based classification
 * @param {string} question - The question text
 * @param {string} sessionId - Current session ID
 * @param {Array} conversationHistory - Recent conversation turns
 * @returns {Promise<object>} - RAG result or skip indicator
 */
async function queryRAGIfNeeded(question, sessionId, conversationHistory = []) {
    // Classify query intent using pattern matching and semantic signals
    const signals = {
        // Time-sensitive queries need fresh retrieval
        needsFreshInfo: /latest|current|today|now|recent|2024|2025/i.test(question),
        
        // Factual patterns benefit from retrieval
        isFactual: /what is|who is|when did|how many|define|explain|describe/i.test(question),
        
        // Creative/opinion queries skip retrieval
        isCreative: /write|create|imagine|opinion|think about|feel about/i.test(question),
        
        // Named entities suggest factual grounding needed
        hasEntities: /[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/.test(question)
    };
    
    // Skip retrieval for creative queries
    if (signals.isCreative && !signals.needsFreshInfo) {
        console.log('[RAG] Skipping RAG - creative/opinion query');
        return {
            usedRAG: false,
            skipped: true,
            reason: 'creative_query',
            strategy: 'direct'
        };
    }
    
    // Retrieve for factual, time-sensitive, or entity-rich queries
    if (signals.needsFreshInfo || signals.isFactual || signals.hasEntities) {
        try {
            const result = await retrieveContext(question, sessionId, {
                topK: 5,
                minScore: 0.70, // Calibrated for all-MiniLM-L6-v2
                maxTokens: 2000, // Stay below 50% of 4K context window (research: cap at 50%)
                minResults: 3,   // Guarantee minimum results even if below threshold
                includeMetadata: true,
                formatAsXML: true
            });
            
            // Add low confidence warning if results below threshold
            if (result.lowConfidence) {
                console.warn('[RAG] Low confidence retrieval - results below similarity threshold');
            }
            
            return result;
        } catch (error) {
            console.error('[RAG] Error retrieving context:', error);
            return {
                usedRAG: false,
                fallback: true,
                reason: 'error',
                error: error.message
            };
        }
    }
    
    // Default: skip retrieval for ambiguous cases
    console.log('[RAG] Skipping RAG - query does not match retrieval criteria');
    return {
        usedRAG: false,
        skipped: true,
        reason: 'no_retrieval_needed',
        strategy: 'context-only'
    };
}
```

### 5. RAG Storage Module (`src/utils/ragStorage.js`)

**Current Issues:**
- Tries to initialize IndexedDB immediately on module load
- Fails in Node.js test environments
- No environment detection

**Fixed Approach:**
```javascript
// Only initialize if in browser environment
if (typeof window !== 'undefined' && typeof indexedDB !== 'undefined') {
    initRAGStorage().catch(console.error);
}

// Export functions that check environment before use
async function saveEmbedding(embeddingData) {
    if (typeof indexedDB === 'undefined') {
        console.warn('IndexedDB not available, skipping save');
        return null;
    }
    // ... rest of implementation
}
```

## Data Models

### Embedding
```javascript
{
    id: number,              // Auto-increment ID
    sessionId: string,       // Session identifier
    embedding: number[],     // 384-dimensional vector
    text: string,           // Original text chunk
    chunkIndex: number,     // Position in document
    timestamp: number       // Creation time
}
```

### RAG Result
```javascript
{
    usedRAG: boolean,           // Whether RAG was used
    fallback: boolean,          // Whether fallback was triggered
    skipped: boolean,           // Whether query was skipped
    reason: string,             // Reason for fallback/skip
    context: string,            // Retrieved context text (XML formatted)
    chunks: Array<{             // Retrieved chunks
        text: string,
        score: number,
        chunkIndex: number,
        metadata: object        // Turn indices, speakers, timestamps
    }>,
    tokensUsed: number,         // Actual token count (from tokenizer)
    avgScore: number,           // Average similarity score
    lowConfidence: boolean,     // True if results below threshold
    belowThresholdCount: number, // Number of results below 0.70
    strategy: string,           // 'direct', 'single-step', 'context-only'
    error: string              // Error message (if failed)
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Embedding dimension consistency
*For any* text input, the generated embedding should be an array of exactly 384 numbers
**Validates: Requirements 1.3**

### Property 2: Pipeline initialization idempotence
*For any* sequence of calls to generateEmbedding, the pipeline should only be initialized once
**Validates: Requirements 1.2**

### Property 3: Batch processing preserves order
*For any* array of texts, generateEmbeddings should return embeddings in the same order as the input texts
**Validates: Requirements 1.4**

### Property 4: Index save/load round-trip
*For any* valid HNSW index with metadata, saving then loading should produce an equivalent index with the same number of elements
**Validates: Requirements 2.3, 2.4**

### Property 5: Path resolution fallback
*For any* environment where app.getPath() is unavailable, getIndexPath should return a valid fallback path without throwing errors
**Validates: Requirements 2.1, 2.2**

### Property 6: Query classification correctness
*For any* question text, queryRAGIfNeeded should skip retrieval for creative/opinion queries and retrieve for factual/time-sensitive queries
**Validates: Requirements 3.1, 3.6, 6.1, 6.2**

### Property 7: RAG retrieval triggers correctly
*For any* factual or time-sensitive question, queryRAGIfNeeded should call retrieveContext
**Validates: Requirements 3.2, 6.3**

### Property 8: Context formatting with XML tags
*For any* non-empty array of chunks, the formatted context should be wrapped in XML tags with document IDs and relevance scores
**Validates: Requirements 3.3, 6.4**

### Property 9: IndexedDB availability check
*For any* environment, ragStorage functions should check for IndexedDB availability before attempting to use it
**Validates: Requirements 4.1, 4.2**

### Property 10: Cross-environment function compatibility
*For any* ragStorage function, calling it in Node.js should not throw errors, even if it returns null/empty results
**Validates: Requirements 4.5**

### Property 11: Error handling preserves system stability
*For any* RAG operation that throws an error, the system should log the error and return a fallback result without crashing
**Validates: Requirements 7.1, 7.2, 7.3**

### Property 12: Async operation timeout handling
*For any* async RAG operation, if it exceeds a reasonable timeout (e.g., 10 seconds), it should be cancelled and return a fallback result
**Validates: Requirements 7.5**

### Property 13: HNSW write serialization
*For any* sequence of concurrent addPoint operations, they should be serialized such that no two writes occur simultaneously
**Validates: Requirements 8.1, 8.4**

### Property 14: Sliding window chunk overlap
*For any* conversation history, chunks should overlap by 20-25% (2-3 turns) to preserve dialogue flow
**Validates: Requirements 9.2**

### Property 15: Similarity threshold calibration
*For any* vector search with all-MiniLM-L6-v2 embeddings, results below 0.70 similarity should be filtered unless minimum result count is not met
**Validates: Requirements 10.1, 10.3, 10.4**

### Property 16: Low confidence indication
*For any* retrieval result where all chunks are below the similarity threshold, the lowConfidence flag should be set to true
**Validates: Requirements 10.5**

### Property 17: Token counting accuracy
*For any* text, the token count from @xenova/transformers tokenizer should match the actual tokens consumed by the model
**Validates: Requirements 11.1, 11.3**

### Property 18: Context token limit enforcement
*For any* retrieved context, the total token count should not exceed 2000 tokens (50% of 4K context window)
**Validates: Requirements 11.3, 11.4**

### Property 19: Embedding update debouncing
*For any* sequence of rapid user inputs within 500ms, only the final input should trigger embedding generation
**Validates: Requirements 12.1**

### Property 20: Index persistence on lifecycle events
*For any* application quit or window close event, the index should be saved to disk before the application exits
**Validates: Requirements 12.3, 12.4**

## Error Handling

### Embeddings Module
- **Pipeline initialization failure**: Log error, retry once after 2 seconds, then fail gracefully
- **Model loading timeout**: Set 30-second timeout, return error if exceeded
- **Invalid input**: Validate text is non-empty string, throw descriptive error

### Vector Search Module
- **Index file not found**: Initialize new empty index
- **Corrupted index file**: Log error, delete corrupted file, initialize new index
- **Path resolution failure**: Use fallback path in current working directory

### RAG Controller
- **Embeddings generation failure**: Return fallback result with `usedRAG: false`
- **Vector search failure**: Return fallback result, log error
- **Empty index**: Return fallback result with reason "no_data"

### Gemini Integration
- **queryRAGIfNeeded failure**: Log error, continue conversation without RAG
- **retrieveContext timeout**: Return fallback after 5 seconds
- **Invalid question input**: Skip RAG, continue normal flow

## Testing Strategy

### Unit Tests
- Test embeddings module initialization in isolation
- Test vector search path resolution with mocked `app` object
- Test queryRAGIfNeeded word counting logic
- Test ragStorage environment detection

### Property-Based Tests
We will use the `fast-check` library for property-based testing.

**Configuration**: Each property test should run a minimum of 100 iterations.

**Tagging**: Each property-based test must include a comment with this format:
```javascript
// Feature: rag-system-fixes, Property 1: Embedding dimension consistency
```

**Property Test Examples:**

1. **Property 1: Embedding dimension consistency**
   - Generate random text strings
   - Call generateEmbedding for each
   - Assert result is array of length 384

2. **Property 6: Word count threshold enforcement**
   - Generate questions with 1-20 words
   - Call queryRAGIfNeeded
   - Assert skipped if ≤10 words, queried if >10 words

3. **Property 11: Error handling preserves system stability**
   - Inject random errors into RAG operations
   - Verify system returns fallback results
   - Verify no uncaught exceptions

### Integration Tests
- Test full RAG flow: question → embeddings → search → context
- Test conversation flow with RAG enabled
- Test RAG system across Electron main/renderer boundary

### Test File Fixes
Convert all test files to use ES module imports:
```javascript
// Before (CommonJS)
const { describe, it, expect } = require('vitest');

// After (ES Module)
import { describe, it, expect } from 'vitest';
```

## Implementation Notes

### Thread-Safe HNSW Index with Mutex
```javascript
const { Mutex } = require('async-mutex');

class SafeHNSWIndex {
    constructor(space, dimensions) {
        this.index = new HierarchicalNSW(space, dimensions);
        this.writeMutex = new Mutex();
    }
    
    async addPoint(vector, id) {
        await this.writeMutex.runExclusive(() => {
            this.index.addPoint(vector, id);
        });
    }
    
    async addBatch(vectors, ids) {
        await this.writeMutex.runExclusive(() => {
            for (let i = 0; i < vectors.length; i++) {
                this.index.addPoint(vectors[i], ids[i]);
            }
        });
    }
    
    // Queries can run concurrently (read-only)
    searchKnn(vector, k) {
        return this.index.searchKnn(vector, k);
    }
    
    async saveIndex(path) {
        await this.writeMutex.runExclusive(() => {
            this.index.writeIndexSync(path);
        });
    }
}
```

### Sliding Window Chunking for Conversations
```javascript
function chunkConversationHistory(turns, options = {}) {
    const turnsPerChunk = options.turnsPerChunk || 5;
    const overlapTurns = Math.ceil(turnsPerChunk * 0.25); // 25% overlap
    const maxTokens = options.maxTokens || 256; // MiniLM-L6-v2 limit
    
    const chunks = [];
    const step = turnsPerChunk - overlapTurns;
    
    for (let i = 0; i < turns.length; i += step) {
        const windowTurns = turns.slice(i, i + turnsPerChunk);
        if (windowTurns.length < 2) break;
        
        // Preserve speaker attribution
        const content = windowTurns
            .map(t => `${t.speaker}: ${t.message}`)
            .join('\n');
        
        // Estimate tokens (rough: 1 token ≈ 4 chars)
        const estimatedTokens = Math.ceil(content.length / 4);
        
        // Split if exceeds token limit
        if (estimatedTokens > maxTokens) {
            // Reduce turns per chunk and retry
            const reducedTurns = Math.floor(turnsPerChunk * 0.7);
            const subChunks = chunkConversationHistory(
                windowTurns, 
                { ...options, turnsPerChunk: reducedTurns }
            );
            chunks.push(...subChunks);
            continue;
        }
        
        chunks.push({
            text: content,
            index: chunks.length,
            metadata: {
                turnRange: [i, Math.min(i + turnsPerChunk - 1, turns.length - 1)],
                speakers: [...new Set(windowTurns.map(t => t.speaker))],
                timestampStart: windowTurns[0]?.timestamp,
                timestampEnd: windowTurns[windowTurns.length - 1]?.timestamp,
                hasOverlap: i > 0,
                estimatedTokens
            }
        });
    }
    
    return chunks;
}
```

### XML Context Formatting
```javascript
function formatContextAsXML(chunks) {
    const documents = chunks.map((chunk, idx) => {
        return `  <document id="${idx + 1}" relevance="${chunk.score.toFixed(2)}">
${chunk.text}
  </document>`;
    }).join('\n');
    
    return `<retrieved_context>
${documents}
</retrieved_context>`;
}
```

### Accurate Token Counting
```javascript
const { AutoTokenizer } = require('@xenova/transformers');

let tokenizer = null;

async function getTokenizer() {
    if (!tokenizer) {
        tokenizer = await AutoTokenizer.from_pretrained('Xenova/llama-3-tokenizer');
    }
    return tokenizer;
}

async function countTokens(text) {
    const tok = await getTokenizer();
    return tok.encode(text).length;
}

async function truncateToTokenLimit(text, maxTokens) {
    const tok = await getTokenizer();
    const tokens = tok.encode(text);
    if (tokens.length <= maxTokens) return text;
    return tok.decode(tokens.slice(0, maxTokens));
}
```

### Hybrid Retrieval with Threshold and Top-K
```javascript
async function hybridRetrieval(queryVector, index, options = {}) {
    const topK = options.topK || 10;
    const minThreshold = options.minThreshold || 0.70; // Calibrated for MiniLM
    const minResults = options.minResults || 3;
    
    const { neighbors, distances } = index.searchKnn(queryVector, topK);
    
    // Convert HNSW cosine distances to similarities
    const results = neighbors.map((id, i) => ({
        id,
        similarity: 1 - distances[i],
        metadata: indexMetadata.documentChunks[id]
    }));
    
    // Filter by threshold
    const thresholdFiltered = results.filter(r => r.similarity >= minThreshold);
    const belowThresholdCount = results.length - thresholdFiltered.length;
    
    // Guarantee minimum results even if below threshold
    let finalResults;
    let lowConfidence = false;
    
    if (thresholdFiltered.length < minResults) {
        console.warn(`[RAG] Only ${thresholdFiltered.length} results above threshold ${minThreshold}, returning top ${minResults}`);
        finalResults = results.slice(0, minResults);
        lowConfidence = true;
    } else {
        finalResults = thresholdFiltered;
    }
    
    return {
        results: finalResults,
        lowConfidence,
        belowThresholdCount,
        avgScore: finalResults.reduce((sum, r) => sum + r.similarity, 0) / finalResults.length
    };
}
```

### Debounced Embedding Updates
```javascript
function debounce(fn, delay) {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };
}

const debouncedEmbedUpdate = debounce(async (text, sessionId) => {
    try {
        const embedding = await generateEmbedding(text);
        await addToIndex(embedding, { sessionId, text, timestamp: Date.now() });
        await saveIndex();
    } catch (error) {
        console.error('[RAG] Error updating embeddings:', error);
    }
}, 500); // 500ms debounce as per research

// Lifecycle event handlers
app.on('before-quit', async (event) => {
    event.preventDefault();
    console.log('[RAG] Saving index before quit...');
    await saveIndex();
    app.quit();
});

app.on('window-all-closed', async () => {
    await saveIndex();
    if (process.platform !== 'darwin') app.quit();
});
```

### Async Initialization Pattern
```javascript
let embeddingPipeline = null;
let initPromise = null;

async function initializeEmbeddings() {
    if (embeddingPipeline) return embeddingPipeline;
    if (initPromise) return initPromise;
    
    initPromise = (async () => {
        const transformers = await import('@xenova/transformers');
        embeddingPipeline = await transformers.pipeline(
            'feature-extraction',
            'Xenova/all-MiniLM-L6-v2',
            { quantized: true }
        );
        return embeddingPipeline;
    })();
    
    return initPromise;
}
```

### Environment Detection Pattern
```javascript
function isElectronMain() {
    return typeof process !== 'undefined' && 
           process.versions && 
           process.versions.electron &&
           process.type === 'browser';
}

function isBrowser() {
    return typeof window !== 'undefined' && 
           typeof indexedDB !== 'undefined';
}

function isNodeTest() {
    return typeof process !== 'undefined' && 
           process.env.NODE_ENV === 'test';
}
```

### Path Resolution Pattern
```javascript
function getIndexPath(filename = 'hnsw_index.dat') {
    try {
        // Try Electron app path first
        if (typeof app !== 'undefined' && app.getPath) {
            return path.join(app.getPath('userData'), filename);
        }
    } catch (error) {
        console.warn('app.getPath() not available, using fallback');
    }
    
    // Fallback to current working directory
    const fallbackDir = path.join(process.cwd(), '.rag-data');
    if (!fs.existsSync(fallbackDir)) {
        fs.mkdirSync(fallbackDir, { recursive: true });
    }
    return path.join(fallbackDir, filename);
}
```

## Performance Considerations

- **Embeddings batching**: Process up to 32 texts per batch to avoid memory issues
- **Index size limit**: Set max 10,000 elements to prevent performance degradation
- **Context token limit**: Cap retrieved context at 400 tokens to preserve response quality
- **Async operations**: Use Promise.race() with timeouts to prevent hanging

## Security Considerations

- **Input validation**: Sanitize all text inputs before generating embeddings
- **Path traversal**: Validate file paths to prevent directory traversal attacks
- **Resource limits**: Enforce limits on embedding batch sizes and index sizes
- **Error messages**: Don't expose internal paths or sensitive data in error messages
