# Implementation Plan - RAG System Fixes

- [x] 1. Install required dependencies
  - Install async-mutex for thread-safe HNSW operations
  - Install fake-indexeddb for testing IndexedDB in Node.js
  - Verify all dependencies are compatible with Electron
  - _Requirements: 8.1, Testing Strategy_

- [x] 2. Fix test infrastructure and imports
  - Convert rag.test.js to use ES module imports instead of CommonJS require()
  - Ensure all vitest imports use `import` syntax
  - Configure fake-indexeddb in vitest setup
  - Verify tests can load without import errors
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 2.1 Write property test for ES module compatibility
  - **Property 11: Error handling preserves system stability**
  - **Validates: Requirements 7.1**

- [x] 3. Fix vectorSearch.js environment detection and add thread safety
  - Add environment detection before importing Electron app
  - Implement fallback path resolution using process.cwd()
  - Create .rag-data directory if it doesn't exist
  - Wrap HNSW index in SafeHNSWIndex class with mutex protection
  - Update all write operations to use mutex
  - Update loadIndex and saveIndex to use safe path resolution
  - _Requirements: 2.1, 2.2, 2.5, 8.1, 8.2, 8.3, 8.4_

- [x] 3.1 Write property test for path resolution fallback
  - **Property 5: Path resolution fallback**
  - **Validates: Requirements 2.1, 2.2**

- [x] 3.2 Write property test for index save/load round-trip
  - **Property 4: Index save/load round-trip**
  - **Validates: Requirements 2.3, 2.4**

- [x] 3.3 Write property test for HNSW write serialization
  - **Property 13: HNSW write serialization**
  - **Validates: Requirements 8.1, 8.4**

- [x] 4. Fix ragStorage.js initialization
  - Add environment detection (check for window and indexedDB)
  - Only initialize IndexedDB if in browser environment
  - Wrap all storage functions with environment checks
  - Return null/empty results gracefully in Node.js
  - _Requirements: 4.1, 4.2, 4.5_

- [x] 4.1 Write property test for cross-environment compatibility
  - **Property 10: Cross-environment function compatibility**
  - **Validates: Requirements 4.5**

- [x] 4.2 Write property test for IndexedDB availability check
  - **Property 9: IndexedDB availability check**
  - **Validates: Requirements 4.1, 4.2**

- [x] 5. Improve embeddings.js with sliding window chunking
  - Replace fixed-size chunking with sliding window approach
  - Implement 4-6 turns per chunk with 20-25% overlap
  - Add token estimation and chunk splitting for 256-token limit
  - Preserve speaker attribution in chunk metadata
  - Include turn indices and timestamps
  - Ensure pipeline initialization is properly awaited
  - Add initialization lock to prevent race conditions
  - _Requirements: 1.2, 1.3, 1.5, 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 5.1 Write property test for embedding dimension consistency
  - **Property 1: Embedding dimension consistency**
  - **Validates: Requirements 1.3**

- [x] 5.2 Write property test for pipeline initialization idempotence
  - **Property 2: Pipeline initialization idempotence**
  - **Validates: Requirements 1.2**

- [x] 5.3 Write property test for batch processing order preservation
  - **Property 3: Batch processing preserves order**
  - **Validates: Requirements 1.4**

- [x] 5.4 Write property test for sliding window chunk overlap
  - **Property 14: Sliding window chunk overlap**
  - **Validates: Requirements 9.2**

- [x] 6. Implement queryRAGIfNeeded with intent classification
  - Add queryRAGIfNeeded function with pattern-based query classification
  - Implement factual/time-sensitive/creative query detection
  - Skip retrieval for creative/opinion queries
  - Call retrieveContext for factual queries
  - Return appropriate result objects (skip/success/fallback)
  - Add error handling with fallback
  - _Requirements: 3.1, 3.2, 3.6, 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 6.1 Write property test for query classification correctness
  - **Property 6: Query classification correctness**
  - **Validates: Requirements 3.1, 3.6, 6.1, 6.2**

- [x] 6.2 Write property test for RAG retrieval triggering
  - **Property 7: RAG retrieval triggers correctly**
  - **Validates: Requirements 3.2, 6.3**

- [x] 6.3 Write property test for XML context formatting
  - **Property 8: Context formatting with XML tags**
  - **Validates: Requirements 3.3, 6.4**

- [x] 7. Add accurate token counting with @xenova/transformers
  - Import and initialize AutoTokenizer from @xenova/transformers
  - Implement countTokens function using tokenizer.encode()
  - Implement truncateToTokenLimit for context truncation
  - Update chunk creation to use accurate token counts
  - Add token limit enforcement (256 tokens per chunk, 2000 for context)
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [x] 7.1 Write property test for token counting accuracy
  - **Property 17: Token counting accuracy**
  - **Validates: Requirements 11.1, 11.3**

- [x] 7.2 Write property test for context token limit enforcement
  - **Property 18: Context token limit enforcement**
  - **Validates: Requirements 11.3, 11.4**

- [x] 8. Update ragController with hybrid retrieval and XML formatting
  - Implement hybrid retrieval (top-k + threshold filtering)
  - Update similarity threshold to 0.70 for all-MiniLM-L6-v2
  - Add minimum results guarantee (3 results)
  - Add lowConfidence flag when results below threshold
  - Implement XML context formatting
  - Update retrieveContext to use accurate token counting
  - Update retrieveContext to use new chunking strategy
  - _Requirements: 3.3, 6.4, 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 8.1 Write property test for similarity threshold calibration
  - **Property 15: Similarity threshold calibration**
  - **Validates: Requirements 10.1, 10.3, 10.4**

- [x] 8.2 Write property test for low confidence indication
  - **Property 16: Low confidence indication**
  - **Validates: Requirements 10.5**

- [x] 9. Implement debounced embedding updates and lifecycle handlers
  - Add debounce function with 500ms delay
  - Wrap embedding generation in debounced function
  - Add semaphore to limit concurrent embeddings to 3
  - Implement app.on('before-quit') handler to save index
  - Implement app.on('window-all-closed') handler to save index
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [x] 9.1 Write property test for embedding update debouncing
  - **Property 19: Embedding update debouncing**
  - **Validates: Requirements 12.1**

- [x] 9.2 Write property test for index persistence on lifecycle events
  - **Property 20: Index persistence on lifecycle events**
  - **Validates: Requirements 12.3, 12.4**

- [x] 10. Add comprehensive error handling
  - Add try-catch blocks to all async RAG operations
  - Implement timeout handling for async operations (10 seconds)
  - Ensure errors are logged with context
  - Return fallback results on errors (never crash)
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 10.1 Write property test for async operation timeout handling
  - **Property 12: Async operation timeout handling**
  - **Validates: Requirements 7.5**

- [x] 11. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Integration testing and verification
  - Verify RAG system initializes correctly in Electron
  - Test conversation flow with RAG integration and intent classification
  - Verify embeddings generation works end-to-end with accurate token counting
  - Test vector search with real queries and 0.70 threshold
  - Verify IndexedDB storage in browser context
  - Test thread safety with concurrent operations
  - Verify XML context formatting in LLM prompts
  - Test debounced embedding updates
  - Test lifecycle event handlers (quit, window close)
  - _Requirements: All_

- [x] 12.1 Write integration test for full RAG flow
  - Test question → embeddings → search → context retrieval with XML formatting
  - Verify conversation history processing with sliding window chunks
  - Test RAG system across IPC boundary
  - Test concurrent write operations with mutex
  - Test low confidence indication when results below threshold
  - Test token counting and context truncation
  - _Requirements: All_
