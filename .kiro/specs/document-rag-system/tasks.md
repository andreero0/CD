# Implementation Plan - Document-Based RAG System

- [ ] 1. Create Dual Index Manager
  - Create `src/utils/dualIndexManager.js` with separate document and conversation indices
  - Implement initialization that loads or creates both indices
  - Add methods for adding chunks to each index separately
  - Implement parallel search across both indices
  - Add save/load methods for both indices with separate file paths
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [ ]* 1.1 Write property test for dual index isolation
  - **Property 2: Dual index isolation**
  - **Validates: Requirements 11.2, 11.3**

- [ ] 2. Implement Document Chunking Pipeline
  - Create `src/utils/documentEmbedder.js` module
  - Implement intelligent document chunking (500-1000 chars, preserve paragraphs)
  - Add overlap between chunks (100 chars) for context preservation
  - Extract metadata (section headers, page numbers) during chunking
  - Handle edge cases (very short documents, very long paragraphs)
  - _Requirements: 1.2, 9.1, 9.2_

- [ ]* 2.1 Write property test for document embedding completeness
  - **Property 1: Document embedding completeness**
  - **Validates: Requirements 1.2, 1.3, 1.4**

- [ ] 3. Create Document Embedding Pipeline
  - Implement `processDocumentForRAG()` function
  - Add batch embedding with progress callbacks
  - Generate embeddings for all document chunks
  - Store embeddings in document index with metadata
  - Save document index after processing
  - _Requirements: 1.3, 1.4, 2.1, 2.2, 2.3_

- [ ]* 3.1 Write property test for index persistence
  - **Property 7: Index persistence**
  - **Validates: Requirements 2.5, 8.3**

- [ ] 4. Add IPC Handlers for Document Embedding
  - Add `embed-document` IPC handler in `src/index.js`
  - Add `batch-embed-documents` IPC handler for multiple documents
  - Implement progress reporting via IPC events
  - Add error handling with fallback
  - _Requirements: 2.4, 12.1, 12.2, 12.3, 12.4, 12.5_

- [ ]* 4.1 Write property test for progress feedback completeness
  - **Property 10: Progress feedback completeness**
  - **Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5**

- [ ] 5. Implement Question Classifier
  - Create `src/utils/questionClassifier.js` module
  - Add pattern matching for behavioral questions
  - Add pattern matching for case questions
  - Add pattern matching for technical questions
  - Return classification with confidence score and document type filters
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ]* 5.1 Write property test for question classification consistency
  - **Property 5: Question classification consistency**
  - **Validates: Requirements 10.2**

- [ ] 6. Implement Hybrid Retrieval Engine
  - Add `hybridRetrieveContext()` function to `src/utils/ragController.js`
  - Implement parallel search of document and conversation indices
  - Add token budget allocation (50% documents, 50% conversation)
  - Implement result merging and deduplication
  - Add document type filtering based on question classification
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ]* 6.1 Write property test for hybrid retrieval completeness
  - **Property 3: Hybrid retrieval completeness**
  - **Validates: Requirements 5.1**

- [ ]* 6.2 Write property test for token budget allocation
  - **Property 4: Token budget allocation**
  - **Validates: Requirements 5.2, 5.5**

- [ ]* 6.3 Write property test for parallel search correctness
  - **Property 9: Parallel search correctness**
  - **Validates: Requirements 5.3**

- [ ] 7. Update Document Upload UI
  - Modify `src/components/views/DocumentsView.js` to trigger embedding after upload
  - Add document type selector (resume, story, framework, technical)
  - Add progress indicators for embedding process
  - Display success/error messages after embedding
  - Show which documents are embedded and ready for retrieval
  - _Requirements: 1.5, 6.1, 6.2, 12.5_

- [ ] 8. Implement XML Context Formatting for Hybrid Results
  - Create `formatHybridContext()` function
  - Format document chunks with XML tags including document name and type
  - Format conversation chunks with XML tags including speaker
  - Combine both contexts with clear separation
  - _Requirements: 5.4_

- [ ] 9. Integrate Hybrid Retrieval into Conversation Flow
  - Update `queryRAGIfNeeded()` in `src/utils/gemini.js` to use hybrid retrieval
  - Add question classification before retrieval
  - Route to appropriate retrieval strategy based on classification
  - Update context injection to handle both document and conversation context
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ]* 9.1 Write property test for document type filtering
  - **Property 6: Document type filtering**
  - **Validates: Requirements 6.3, 6.4, 6.5**

- [ ] 10. Implement Document Deletion and Index Cleanup
  - Add document deletion handler that removes embeddings from index
  - Implement index cleanup when documents are deleted
  - Add re-embedding support when documents are updated
  - Save index after cleanup operations
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [ ]* 10.1 Write property test for document deletion cleanup
  - **Property 8: Document deletion cleanup**
  - **Validates: Requirements 8.1**

- [ ] 11. Add Document Source Display in UI
  - Update response display to show which documents were used
  - Add document name and relevance score to UI
  - Implement click-to-view functionality for document sources
  - Show fallback indicator when no documents are found
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 12. Optimize for Large Documents
  - Add batch processing for documents with >10,000 words
  - Implement memory-efficient chunking for large documents
  - Add loading indicators for operations >2 seconds
  - Optimize index search performance for >1,000 chunks
  - _Requirements: 9.3, 9.4, 9.5_

- [ ] 13. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Integration Testing
  - Test full document upload → embedding → retrieval flow
  - Test hybrid retrieval with both indices populated
  - Test question classification → appropriate document retrieval
  - Test behavioral question → story bank retrieval
  - Test case question → framework retrieval
  - Test document deletion → index cleanup
  - Test concurrent document processing
  - Verify token budget allocation works correctly
  - Test fallback when document index is unavailable
  - _Requirements: All_

- [ ]* 14.1 Write integration test for full document RAG flow
  - Test document upload → chunking → embedding → storage
  - Test behavioral question → story retrieval
  - Test case question → framework retrieval
  - Test hybrid retrieval combining documents and conversation
  - Test token budget allocation
  - Test document deletion and index cleanup
  - _Requirements: All_
