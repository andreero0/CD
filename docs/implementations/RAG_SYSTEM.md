# RAG System Documentation

## Overview

The RAG (Retrieval-Augmented Generation) system enhances the AI assistant's ability to answer questions by retrieving only the most relevant context from conversation history, rather than sending the entire conversation every time.

## Architecture

### Components

1. **Embeddings Service** (`src/utils/embeddings.js`)
   - Uses `@xenova/transformers` with the `all-MiniLM-L6-v2` model
   - Generates 384-dimensional embeddings locally (no API calls)
   - Chunks documents into manageable pieces (500 chars with 100 char overlap)

2. **Vector Search** (`src/utils/vectorSearch.js`)
   - Uses `hnswlib-node` for fast k-nearest neighbor search
   - HNSW (Hierarchical Navigable Small World) algorithm
   - Cosine similarity for semantic matching
   - Supports up to 10,000 document chunks

3. **RAG Controller** (`src/utils/ragController.js`)
   - Coordinates between embeddings and vector search
   - Implements hybrid retrieval strategy
   - Manages index lifecycle (load/save)

4. **RAG Storage** (`src/utils/ragStorage.js`)
   - IndexedDB storage for embeddings and chunks
   - Separate database from conversation history
   - Efficient querying by session ID

5. **RAG IPC** (`src/utils/ragIpc.js`)
   - Exposes RAG functionality to renderer process
   - IPC handlers for all RAG operations

6. **RAG Client** (`src/utils/ragClient.js`)
   - Renderer-side wrapper for easy RAG access
   - Available as `window.ragClient`

## How It Works

### 1. Document Processing

When a conversation turn is saved:

```javascript
// Main process (gemini.js)
saveConversationTurn(transcription, aiResponse);
  ↓
processNewTurn(sessionId, conversationTurn);
  ↓
// RAG Controller chunks the transcription
chunks = chunkDocument(transcription, 500, 100);
  ↓
// Generate embeddings for each chunk
embeddings = generateEmbeddings(chunks);
  ↓
// Add to vector index
addBatchToIndex(chunks, embeddings);
```

### 2. Context Retrieval

When answering a question:

```javascript
// Retrieve relevant context
result = retrieveContext(question, sessionId, options);
  ↓
// Generate embedding for question
queryEmbedding = generateEmbedding(question);
  ↓
// Search for similar chunks
results = search(queryEmbedding, topK=5, minScore=0.6);
  ↓
// Build context from top chunks
context = buildContext(results, maxTokens=500);
```

### 3. Hybrid Approach

The system uses a hybrid approach for optimal results:

- **Metadata** (100 tokens): Always includes critical session info
- **Retrieved Chunks** (400 tokens): Most relevant conversation excerpts
- **Fallback**: If similarity scores are too low, falls back to full context

## Configuration

### Default Settings

```javascript
const options = {
    topK: 5,              // Number of chunks to retrieve
    minScore: 0.6,        // Minimum similarity score (0.0 to 1.0)
    includeMetadata: true, // Include session metadata
    maxTokens: 500,       // Max tokens for retrieved context
    metadataTokens: 100,  // Tokens reserved for metadata
    fallbackToFull: true  // Fallback to full context if needed
};
```

### Token Estimates

- **Without RAG**: ~4000 tokens (full conversation history)
- **With RAG**: ~500 tokens (metadata + relevant chunks)
- **Savings**: ~87.5% reduction in context size

## API Reference

### Main Process (Node.js)

#### RAG Controller

```javascript
const { initializeRAG, retrieveContext, processNewTurn } = require('./utils/ragController');

// Initialize
await initializeRAG();

// Process conversation history
await processConversationHistory(sessionId, conversationHistory);

// Retrieve context for a question
const result = await retrieveContext(question, sessionId, options);

// Process new conversation turn
await processNewTurn(sessionId, turn);
```

### Renderer Process

```javascript
// Available as window.ragClient

// Initialize
await window.ragClient.initializeRAG();

// Retrieve context
const result = await window.ragClient.retrieveContext(
    question,
    sessionId,
    { topK: 5, minScore: 0.6 }
);

if (result.usedRAG) {
    console.log('Retrieved context:', result.context);
    console.log('Chunks used:', result.chunks.length);
    console.log('Avg similarity:', result.avgScore);
} else {
    console.log('Fallback used:', result.reason);
}

// Get stats
const stats = await window.ragClient.getRAGStats();
console.log('Index stats:', stats);
```

## Performance

### Embeddings Generation

- **Model**: all-MiniLM-L6-v2 (22MB quantized)
- **Speed**: ~50-100 chunks/second on modern hardware
- **Dimensions**: 384 (compact, efficient)

### Vector Search

- **Algorithm**: HNSW (logarithmic search time)
- **Search Time**: <10ms for 10,000 vectors
- **Memory**: ~15MB for 10,000 384-dim vectors

### Token Savings

Example with 20-turn conversation:

- **Full context**: ~4000 tokens
- **RAG context**: ~500 tokens
- **Reduction**: 87.5%
- **API cost savings**: 87.5% per request

## Storage

### IndexedDB Schema

**Database**: `RAGStorage`

**Object Stores**:

1. `embeddings`
   - `id` (auto-increment): Primary key
   - `sessionId`: Session identifier
   - `chunkIndex`: Chunk index within session
   - `embedding`: 384-dim float array
   - `timestamp`: Creation time

2. `chunks`
   - `id` (auto-increment): Primary key
   - `sessionId`: Session identifier
   - `embeddingId`: Reference to embedding
   - `text`: Chunk text content
   - `startPos`, `endPos`: Position in original document
   - `timestamp`: Creation time

### Disk Storage

HNSW index is persisted to disk:

- **Location**: `{userData}/hnsw_index.dat`
- **Metadata**: `{userData}/hnsw_metadata.json`
- **Auto-save**: After each batch operation

## Troubleshooting

### Common Issues

1. **"HNSW index not initialized"**
   - Call `initializeRAG()` before using the system
   - Check console for initialization errors

2. **"No valid chunks created"**
   - Ensure transcription text is not empty
   - Check chunk size settings (default: 500 chars)

3. **"Low similarity scores"**
   - System automatically falls back to full context
   - Consider lowering `minScore` threshold
   - Check if question relates to conversation history

4. **Performance issues**
   - Embeddings generation is CPU-intensive
   - First use downloads model (~22MB)
   - Subsequent uses are faster (model cached)

## Testing

Run the test suite:

```bash
npm test -- src/__tests__/rag.test.js
```

Test coverage includes:
- Embeddings generation
- Document chunking
- Vector similarity
- Index operations
- Integration tests

## Future Improvements

1. **Incremental Updates**: Update index without full rebuild
2. **Compression**: Compress embeddings for storage efficiency
3. **Multi-modal**: Support image/audio embeddings
4. **Fine-tuning**: Train model on domain-specific data
5. **Batch Processing**: Process multiple sessions in parallel

## References

- [@xenova/transformers](https://github.com/xenova/transformers.js)
- [hnswlib-node](https://github.com/yoshoku/hnswlib-node)
- [all-MiniLM-L6-v2](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2)
- [HNSW Algorithm](https://arxiv.org/abs/1603.09320)
