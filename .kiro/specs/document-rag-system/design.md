# Design Document - Document-Based RAG System

## Overview

This design integrates document-based retrieval with the existing conversation history RAG system to create a unified, hybrid RAG system. When an interviewer asks a question, the system retrieves relevant content from BOTH your uploaded documents (resume, story bank, frameworks) AND past conversation history, providing comprehensive context to the AI.

## Architecture

### Unified RAG System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Interview Question                           │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              Question Classification & Intent Detection          │
│  (Behavioral? Case? Technical? → Determines retrieval strategy) │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Hybrid RAG Retrieval                          │
│                                                                   │
│  ┌──────────────────────┐         ┌──────────────────────┐     │
│  │  Document Index      │         │  Conversation Index  │     │
│  │  (Your Materials)    │         │  (Chat History)      │     │
│  │                      │         │                      │     │
│  │  • Resume            │         │  • Past Q&A          │     │
│  │  • Story Bank        │         │  • Previous Topics   │     │
│  │  • Frameworks        │         │  • Context           │     │
│  │  • Technical Docs    │         │                      │     │
│  └──────────┬───────────┘         └──────────┬───────────┘     │
│             │                                 │                  │
│             └────────────┬────────────────────┘                  │
│                          │                                       │
└──────────────────────────┼───────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              Context Merging & Token Management                  │
│  • Deduplicate overlapping content                               │
│  • Allocate token budget (50% docs, 50% conversation)           │
│  • Format with XML tags for clarity                             │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AI Response Generation                        │
│  Context: <documents>...</documents>                             │
│           <conversation>...</conversation>                       │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Document Embedding Pipeline (NEW)

**Purpose:** Automatically embed uploaded documents into the document index

**Interface:**
```javascript
/**
 * Process uploaded document and add to document index
 * @param {Object} document - Document from documentDB
 * @param {Function} progressCallback - Progress updates
 * @returns {Promise<Object>} - Processing result
 */
async function processDocumentForRAG(document, progressCallback) {
    // 1. Extract text from PDF (already exists in pdfParser.js)
    // 2. Chunk document intelligently (500-1000 chars, preserve paragraphs)
    // 3. Generate embeddings for each chunk
    // 4. Store in document index with metadata
    // 5. Save document index to disk
}

/**
 * Batch process multiple documents
 * @param {Array<Object>} documents - Array of documents
 * @returns {Promise<Object>} - Batch processing result
 */
async function batchProcessDocuments(documents) {
    // Process documents in parallel (max 3 concurrent)
    // Aggregate results
    // Update document index once at the end
}
```

### 2. Dual Index Manager (NEW)

**Purpose:** Manage separate indices for documents and conversation history

**Interface:**
```javascript
class DualIndexManager {
    constructor() {
        this.documentIndex = null;      // HNSW index for documents
        this.conversationIndex = null;  // HNSW index for conversation
        this.documentMetadata = {};     // Document chunk metadata
        this.conversationMetadata = {}; // Conversation chunk metadata
    }

    /**
     * Initialize both indices
     */
    async initialize() {
        // Load or create document index
        // Load or create conversation index
        // Load metadata for both
    }

    /**
     * Add document chunk to document index
     */
    async addDocumentChunk(embedding, metadata) {
        // Add to document index
        // Store metadata
        // Save document index
    }

    /**
     * Add conversation chunk to conversation index
     */
    async addConversationChunk(embedding, metadata) {
        // Add to conversation index
        // Store metadata
        // Save conversation index
    }

    /**
     * Search both indices in parallel
     */
    async hybridSearch(queryEmbedding, options) {
        // Search document index
        // Search conversation index
        // Merge and rank results
        // Return combined results
    }

    /**
     * Save both indices to disk
     */
    async saveIndices() {
        // Save document index to .rag-data/document_index.dat
        // Save conversation index to .rag-data/conversation_index.dat
        // Save metadata files
    }
}
```

### 3. Question Classifier (NEW)

**Purpose:** Classify questions to determine retrieval strategy

**Interface:**
```javascript
/**
 * Classify question type and determine retrieval strategy
 * @param {string} question - The interviewer's question
 * @returns {Object} - Classification result
 */
function classifyQuestion(question) {
    return {
        type: 'behavioral' | 'case' | 'technical' | 'general',
        confidence: 0.0-1.0,
        documentTypes: ['story', 'resume'] | ['framework'] | ['technical'],
        retrievalStrategy: 'documents_primary' | 'conversation_primary' | 'balanced'
    };
}

// Classification patterns
const BEHAVIORAL_PATTERNS = [
    /tell me about a time/i,
    /describe a situation/i,
    /give me an example/i,
    /how did you handle/i,
    /what would you do if/i
];

const CASE_PATTERNS = [
    /how would you approach/i,
    /estimate/i,
    /market size/i,
    /profitability/i,
    /framework/i,
    /break down/i
];

const TECHNICAL_PATTERNS = [
    /how does.*work/i,
    /explain.*technically/i,
    /implement/i,
    /algorithm/i,
    /system design/i
];
```

### 4. Hybrid Retrieval Engine (ENHANCED)

**Purpose:** Retrieve from both documents and conversation, merge results

**Enhanced Interface:**
```javascript
/**
 * Retrieve context from both documents and conversation
 * @param {string} question - The question
 * @param {string} sessionId - Current session
 * @param {Object} options - Retrieval options
 * @returns {Promise<Object>} - Hybrid retrieval result
 */
async function hybridRetrieveContext(question, sessionId, options = {}) {
    const {
        topK = 5,
        minScore = 0.70,
        maxTokens = 2000,
        documentWeight = 0.5,  // 50% token budget for documents
        conversationWeight = 0.5  // 50% token budget for conversation
    } = options;

    // 1. Classify question
    const classification = classifyQuestion(question);

    // 2. Generate query embedding
    const queryEmbedding = await generateEmbedding(question);

    // 3. Search both indices in parallel
    const [documentResults, conversationResults] = await Promise.all([
        searchDocumentIndex(queryEmbedding, {
            topK,
            minScore,
            documentTypes: classification.documentTypes
        }),
        searchConversationIndex(queryEmbedding, {
            topK,
            minScore,
            sessionId
        })
    ]);

    // 4. Allocate token budget
    const documentTokenBudget = Math.floor(maxTokens * documentWeight);
    const conversationTokenBudget = Math.floor(maxTokens * conversationWeight);

    // 5. Select top results within budget
    const selectedDocuments = selectWithinBudget(documentResults, documentTokenBudget);
    const selectedConversation = selectWithinBudget(conversationResults, conversationTokenBudget);

    // 6. Format with XML tags
    const documentContext = formatDocumentContext(selectedDocuments);
    const conversationContext = formatConversationContext(selectedConversation);

    return {
        usedRAG: true,
        documentContext,
        conversationContext,
        combinedContext: `${documentContext}\n\n${conversationContext}`,
        documentChunks: selectedDocuments,
        conversationChunks: selectedConversation,
        tokensUsed: countTokens(documentContext) + countTokens(conversationContext),
        classification
    };
}
```

### 5. Document Upload Handler (ENHANCED)

**Purpose:** Trigger embedding pipeline when documents are uploaded

**Enhanced Interface:**
```javascript
// In DocumentsView.js - after document upload
async handleDocumentUpload(files) {
    for (const file of files) {
        try {
            // 1. Parse PDF (existing)
            const processedDoc = await processPDFFile(file);

            // 2. Add to database (existing)
            const docId = await documentDB.addDocument(processedDoc);

            // 3. NEW: Trigger embedding pipeline
            this.showProgress(`Embedding ${file.name}...`);
            await window.embedDocument(docId, (progress) => {
                this.updateProgress(progress);
            });

            this.showSuccess(`${file.name} ready for retrieval!`);
        } catch (error) {
            this.showError(`Failed to process ${file.name}`);
        }
    }
}
```

## Data Models

### Document Chunk
```javascript
{
    id: number,              // Auto-increment ID
    documentId: number,      // Reference to document in documentDB
    documentName: string,    // e.g., "Resume.pdf"
    documentType: string,    // "resume" | "story" | "framework" | "technical"
    chunkIndex: number,      // Position in document
    text: string,           // Chunk content
    embedding: number[],    // 384-dimensional vector
    pageNumber: number,     // PDF page number
    tokenCount: number,     // Accurate token count
    metadata: {
        section: string,    // e.g., "Work Experience", "Education"
        keywords: string[], // Extracted keywords
        timestamp: number   // When embedded
    }
}
```

### Hybrid Retrieval Result
```javascript
{
    usedRAG: boolean,
    documentContext: string,        // XML-formatted document chunks
    conversationContext: string,    // XML-formatted conversation chunks
    combinedContext: string,        // Both combined
    documentChunks: Array<{
        text: string,
        score: number,
        documentName: string,
        documentType: string,
        pageNumber: number
    }>,
    conversationChunks: Array<{
        text: string,
        score: number,
        speaker: string,
        timestamp: number
    }>,
    tokensUsed: number,
    classification: {
        type: string,
        confidence: number,
        documentTypes: string[]
    },
    lowConfidence: boolean
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Document embedding completeness
*For any* uploaded document, all text content should be chunked and embedded into the document index
**Validates: Requirements 1.2, 1.3, 1.4**

### Property 2: Dual index isolation
*For any* embedding operation, document embeddings should only be added to the document index, and conversation embeddings should only be added to the conversation index
**Validates: Requirements 11.2, 11.3**

### Property 3: Hybrid retrieval completeness
*For any* question, the hybrid retrieval should query BOTH document and conversation indices
**Validates: Requirements 5.1**

### Property 4: Token budget allocation
*For any* hybrid retrieval, the combined token count should not exceed the specified maxTokens limit
**Validates: Requirements 5.2, 5.5**

### Property 5: Question classification consistency
*For any* behavioral question, the system should prioritize story and resume documents
**Validates: Requirements 10.2**

### Property 6: Document type filtering
*For any* retrieval with document type filter, only chunks from matching document types should be returned
**Validates: Requirements 6.3, 6.4, 6.5**

### Property 7: Index persistence
*For any* document embedding operation, the document index should be saved to disk immediately after completion
**Validates: Requirements 2.5, 8.3**

### Property 8: Document deletion cleanup
*For any* deleted document, all its embeddings should be removed from the document index
**Validates: Requirements 8.1**

### Property 9: Parallel search correctness
*For any* hybrid search, results from document and conversation indices should be merged without duplication
**Validates: Requirements 5.3**

### Property 10: Progress feedback completeness
*For any* document processing operation, progress updates should be sent at each major step
**Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5**

## Error Handling

### Document Embedding Pipeline
- **PDF parsing failure**: Log error, skip document, continue with others
- **Embedding generation failure**: Retry once, then skip chunk
- **Index save failure**: Retry 3 times with exponential backoff
- **Memory overflow**: Process documents in smaller batches

### Hybrid Retrieval
- **Document index unavailable**: Fall back to conversation-only retrieval
- **Conversation index unavailable**: Fall back to document-only retrieval
- **Both indices unavailable**: Return fallback response with error flag
- **Timeout (>5s)**: Return partial results with timeout flag

### Index Management
- **Corrupted document index**: Rebuild from stored documents
- **Corrupted conversation index**: Rebuild from conversation history
- **Disk space full**: Alert user, pause embedding operations

## Testing Strategy

### Unit Tests
- Test document chunking with various PDF structures
- Test question classification with sample questions
- Test token budget allocation with different weights
- Test index isolation (documents vs conversation)

### Property-Based Tests
We will use the `fast-check` library for property-based testing.

**Configuration**: Each property test should run a minimum of 100 iterations.

**Tagging**: Each property-based test must include a comment with this format:
```javascript
// Feature: document-rag-system, Property 1: Document embedding completeness
```

### Integration Tests
- Test full document upload → embedding → retrieval flow
- Test hybrid retrieval with both indices populated
- Test question classification → appropriate retrieval
- Test document deletion → index cleanup
- Test concurrent document processing

## Implementation Notes

### Document Chunking Strategy

```javascript
function chunkDocument(text, options = {}) {
    const {
        minChunkSize = 500,
        maxChunkSize = 1000,
        overlapSize = 100
    } = options;

    const chunks = [];
    const paragraphs = text.split(/\n\n+/);
    let currentChunk = '';
    let chunkIndex = 0;

    for (const paragraph of paragraphs) {
        // If adding paragraph exceeds max, save current chunk
        if (currentChunk.length + paragraph.length > maxChunkSize && currentChunk.length >= minChunkSize) {
            chunks.push({
                text: currentChunk.trim(),
                index: chunkIndex++,
                startPos: text.indexOf(currentChunk),
                endPos: text.indexOf(currentChunk) + currentChunk.length
            });

            // Start new chunk with overlap
            const overlapText = currentChunk.slice(-overlapSize);
            currentChunk = overlapText + ' ' + paragraph;
        } else {
            currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
        }
    }

    // Add final chunk
    if (currentChunk.length >= minChunkSize) {
        chunks.push({
            text: currentChunk.trim(),
            index: chunkIndex,
            startPos: text.indexOf(currentChunk),
            endPos: text.indexOf(currentChunk) + currentChunk.length
        });
    }

    return chunks;
}
```

### XML Context Formatting

```javascript
function formatHybridContext(documentChunks, conversationChunks) {
    const documentXML = `<documents>
${documentChunks.map((chunk, idx) => `  <document id="${idx + 1}" name="${chunk.documentName}" type="${chunk.documentType}" relevance="${chunk.score.toFixed(2)}">
${chunk.text}
  </document>`).join('\n')}
</documents>`;

    const conversationXML = `<conversation_history>
${conversationChunks.map((chunk, idx) => `  <turn id="${idx + 1}" speaker="${chunk.speaker}" relevance="${chunk.score.toFixed(2)}">
${chunk.text}
  </turn>`).join('\n')}
</conversation_history>`;

    return `${documentXML}\n\n${conversationXML}`;
}
```

### IPC Handlers for Document Embedding

```javascript
// In main process (index.js)
ipcMain.handle('embed-document', async (event, documentId) => {
    try {
        // 1. Get document from renderer
        const document = await getDocumentFromRenderer(documentId);

        // 2. Chunk document
        const chunks = chunkDocument(document.content);

        // 3. Generate embeddings
        const embeddings = await generateEmbeddings(chunks.map(c => c.text));

        // 4. Add to document index
        for (let i = 0; i < chunks.length; i++) {
            await dualIndexManager.addDocumentChunk(embeddings[i], {
                documentId,
                documentName: document.fileName,
                documentType: document.type,
                chunkIndex: i,
                text: chunks[i].text,
                pageNumber: chunks[i].pageNumber
            });
        }

        // 5. Save document index
        await dualIndexManager.saveIndices();

        return { success: true, chunksProcessed: chunks.length };
    } catch (error) {
        console.error('[Document Embedding] Error:', error);
        return { success: false, error: error.message };
    }
});
```

## Performance Considerations

- **Batch embedding**: Process up to 10 documents concurrently
- **Index size limits**: Document index max 10,000 chunks, conversation index max 5,000 chunks
- **Search optimization**: Use HNSW ef_search parameter tuning for large indices
- **Caching**: Cache document embeddings to avoid re-computation
- **Lazy loading**: Load indices on-demand, not at startup

## Integration with Existing System

### Changes to Existing Files

**src/utils/ragController.js:**
- Add `DualIndexManager` class
- Update `initializeRAG()` to initialize both indices
- Add `hybridRetrieveContext()` function
- Keep existing `retrieveContext()` for backward compatibility

**src/utils/gemini.js:**
- Update `queryRAGIfNeeded()` to use hybrid retrieval
- Add question classification logic
- Update context formatting to handle both sources

**src/components/views/DocumentsView.js:**
- Add embedding trigger after document upload
- Add progress indicators for embedding
- Add document type selector

**src/index.js:**
- Add IPC handler for `embed-document`
- Add IPC handler for `batch-embed-documents`
- Initialize `DualIndexManager` on startup

### New Files

- `src/utils/documentEmbedder.js` - Document embedding pipeline
- `src/utils/questionClassifier.js` - Question classification
- `src/utils/dualIndexManager.js` - Dual index management
- `src/__tests__/document-rag.test.js` - Integration tests

## Migration Path

1. **Phase 1**: Create dual index manager (keep existing conversation index working)
2. **Phase 2**: Add document embedding pipeline
3. **Phase 3**: Implement hybrid retrieval
4. **Phase 4**: Update UI to show document sources
5. **Phase 5**: Add question classification and smart routing

This ensures the existing conversation RAG continues working while we build document RAG.
