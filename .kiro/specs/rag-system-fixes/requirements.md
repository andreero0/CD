# Requirements Document - RAG System Fixes

## Introduction

The RAG (Retrieval-Augmented Generation) system in Prism has several critical bugs preventing it from functioning correctly. This specification addresses all identified issues to make the RAG system fully operational.

## Glossary

- **RAG System**: Retrieval-Augmented Generation system that enhances AI responses with relevant context from conversation history
- **Embeddings Pipeline**: The @xenova/transformers pipeline that generates vector embeddings from text
- **HNSW Index**: Hierarchical Navigable Small World index for efficient vector similarity search
- **Vector Search**: Finding similar text chunks using cosine similarity of embeddings
- **IndexedDB**: Browser-based database for storing embeddings and chunks
- **IPC**: Inter-Process Communication between Electron main and renderer processes

## Requirements

### Requirement 1

**User Story:** As a developer, I want the embeddings module to initialize correctly, so that text can be converted to vector embeddings.

#### Acceptance Criteria

1. WHEN the embeddings module is imported THEN the system SHALL load the @xenova/transformers library without errors
2. WHEN generateEmbedding is called THEN the system SHALL initialize the pipeline if not already initialized
3. WHEN the pipeline is initialized THEN the system SHALL return a valid embedding array of 384 dimensions
4. WHEN generateEmbeddings is called with multiple texts THEN the system SHALL process them in batches without blocking
5. WHEN the embeddings module is used in tests THEN the system SHALL handle the async initialization correctly

### Requirement 2

**User Story:** As a developer, I want the vector search index to load and save correctly, so that embeddings can be persisted across sessions.

#### Acceptance Criteria

1. WHEN loadIndex is called THEN the system SHALL check if the Electron app object is available
2. WHEN the app object is unavailable THEN the system SHALL use a fallback path for the index file
3. WHEN saveIndex is called THEN the system SHALL persist both the HNSW index and metadata to disk
4. WHEN the index file exists THEN the system SHALL load it successfully on initialization
5. WHEN running in test environment THEN the system SHALL handle missing app object gracefully

### Requirement 3

**User Story:** As a developer, I want the RAG controller to integrate with the Gemini conversation flow, so that relevant context is retrieved for questions.

#### Acceptance Criteria

1. WHEN an interviewer asks a question THEN the system SHALL classify the query intent to determine if retrieval is needed
2. WHEN the query is factual or time-sensitive THEN the system SHALL call retrieveContext with the question
3. WHEN retrieveContext returns relevant chunks THEN the system SHALL format them as XML-tagged context for the AI
4. WHEN no relevant chunks are found THEN the system SHALL fallback to normal conversation flow
5. WHEN RAG retrieval fails THEN the system SHALL log the error and continue without RAG context
6. WHEN the query is creative or opinion-based THEN the system SHALL skip retrieval and use direct LLM response

### Requirement 4

**User Story:** As a developer, I want the RAG storage module to initialize only in browser environments, so that tests don't fail due to missing IndexedDB.

#### Acceptance Criteria

1. WHEN the ragStorage module loads THEN the system SHALL check if IndexedDB is available
2. WHEN IndexedDB is unavailable THEN the system SHALL skip initialization without throwing errors
3. WHEN initRAGStorage is called explicitly THEN the system SHALL initialize the database
4. WHEN running in Node.js test environment THEN the system SHALL provide mock implementations
5. WHEN the module exports functions THEN the system SHALL ensure they work in both browser and test environments

### Requirement 5

**User Story:** As a developer, I want all test files to use proper ES module imports, so that vitest can run them correctly.

#### Acceptance Criteria

1. WHEN a test file imports vitest THEN the system SHALL use ES module import syntax
2. WHEN a test file imports project modules THEN the system SHALL use appropriate import syntax
3. WHEN tests run THEN the system SHALL not throw "cannot use require() with vitest" errors
4. WHEN tests import CommonJS modules THEN the system SHALL use dynamic import() where necessary
5. WHEN the test suite runs THEN the system SHALL execute all tests without import errors

### Requirement 6

**User Story:** As a developer, I want the queryRAGIfNeeded function to exist and work correctly, so that RAG integration works in the conversation flow.

#### Acceptance Criteria

1. WHEN queryRAGIfNeeded is called with a question THEN the system SHALL classify the query using pattern matching and semantic signals
2. WHEN the query is creative or opinion-based THEN the system SHALL skip RAG retrieval and return a skip result
3. WHEN the query is factual, time-sensitive, or entity-rich THEN the system SHALL call retrieveContext from ragController
4. WHEN retrieveContext succeeds THEN the system SHALL return the retrieved context formatted with XML tags
5. WHEN retrieveContext fails THEN the system SHALL return a fallback result with error information

### Requirement 7

**User Story:** As a developer, I want comprehensive error handling throughout the RAG system, so that failures don't crash the application.

#### Acceptance Criteria

1. WHEN any RAG operation fails THEN the system SHALL log the error with context
2. WHEN embeddings generation fails THEN the system SHALL return a fallback response
3. WHEN vector search fails THEN the system SHALL continue conversation without RAG
4. WHEN index loading fails THEN the system SHALL initialize a new empty index
5. WHEN any async operation times out THEN the system SHALL handle it gracefully without hanging

### Requirement 8

**User Story:** As a developer, I want thread-safe HNSW index operations, so that concurrent writes don't corrupt the index.

#### Acceptance Criteria

1. WHEN multiple addPoint operations occur concurrently THEN the system SHALL serialize them using a mutex
2. WHEN saveIndex is called during active queries THEN the system SHALL wait for queries to complete
3. WHEN queries occur during index writes THEN the system SHALL queue them until the write completes
4. WHEN the index is being modified THEN the system SHALL prevent concurrent modifications
5. WHEN read operations occur THEN the system SHALL allow concurrent reads without blocking

### Requirement 9

**User Story:** As a developer, I want optimized chunking for conversational data, so that retrieval quality is maximized.

#### Acceptance Criteria

1. WHEN conversation history is chunked THEN the system SHALL use sliding window chunking with 4-6 turns per chunk
2. WHEN chunks overlap THEN the system SHALL use 20-25% overlap to preserve dialogue flow
3. WHEN chunks are created THEN the system SHALL preserve speaker attribution in chunk metadata
4. WHEN chunk size exceeds 256 tokens THEN the system SHALL split the chunk to stay within model limits
5. WHEN chunks are stored THEN the system SHALL include turn indices and timestamps in metadata

### Requirement 10

**User Story:** As a developer, I want calibrated similarity thresholds, so that retrieval accuracy is optimized for the embedding model.

#### Acceptance Criteria

1. WHEN using all-MiniLM-L6-v2 embeddings THEN the system SHALL use a minimum similarity threshold of 0.70
2. WHEN similarity scores are computed THEN the system SHALL convert HNSW cosine distances to similarities (1 - distance)
3. WHEN retrieving chunks THEN the system SHALL combine top-k with threshold filtering
4. WHEN no chunks exceed the threshold THEN the system SHALL return a minimum of 3 results
5. WHEN all results are below threshold THEN the system SHALL include a lowConfidence flag in the response metadata

### Requirement 11

**User Story:** As a developer, I want accurate token counting, so that context window limits are respected precisely.

#### Acceptance Criteria

1. WHEN estimating tokens for chunks THEN the system SHALL use @xenova/transformers tokenizer for accurate counts
2. WHEN chunks exceed 256 tokens THEN the system SHALL split them to stay within model limits
3. WHEN formatting context THEN the system SHALL count tokens accurately to stay below 2000 tokens (50% of 4K context)
4. WHEN context exceeds token limit THEN the system SHALL truncate lowest-relevance chunks first
5. WHEN truncating context THEN the system SHALL preserve the most recent conversation history and highest-relevance chunks

### Requirement 12

**User Story:** As a developer, I want controlled embedding update timing, so that system resources are used efficiently.

#### Acceptance Criteria

1. WHEN user input is received THEN the system SHALL debounce embedding generation with 500ms delay
2. WHEN a conversation turn completes THEN the system SHALL generate embeddings and update the index
3. WHEN the application is about to quit THEN the system SHALL save the index to disk
4. WHEN all windows close THEN the system SHALL persist the index before cleanup
5. WHEN embeddings are being generated THEN the system SHALL limit concurrent operations to 3
