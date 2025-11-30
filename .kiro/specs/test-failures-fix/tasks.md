# Implementation Plan

- [ ] 1. Fix context injection debouncing test mocking
  - [ ] 1.1 Convert test file to use proper ES6 imports for vitest
    - Update import statements to use `import` instead of `require` for vitest
    - Ensure vi, describe, it, expect, beforeEach, afterEach are imported
    - _Requirements: 1.1, 1.3_
  
  - [ ] 1.2 Fix sessionLogger mock setup
    - Ensure mock is created before module import
    - Verify mock functions are properly tracked
    - _Requirements: 1.2_
  
  - [ ] 1.3 Fix timer mocking in tests
    - Replace `vi.restoreAllTimers()` with proper cleanup
    - Ensure timers are advanced correctly in tests
    - _Requirements: 1.3_
  
  - [ ] 1.4 Run context injection tests to verify fixes
    - Execute: `npm test -- src/__tests__/contextInjectionDebouncing.test.js --run`
    - Verify all 8 tests pass
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ] 2. Fix transcript integration tests
  - [ ] 2.1 Fix conversation state mock calls
    - Investigate why mocks aren't being called
    - Ensure functions are properly exported and imported
    - _Requirements: 2.1, 2.2, 2.3_
  
  - [ ] 2.2 Fix RAG query word count threshold
    - Check word counting logic in queryRAGIfNeeded
    - Ensure threshold is exactly 10 words
    - Handle edge cases (punctuation, empty strings)
    - _Requirements: 2.4_
  
  - [ ] 2.3 Fix state transition logic
    - Review state machine implementation
    - Ensure IDLE state is properly maintained
    - _Requirements: 2.5_
  
  - [ ] 2.4 Run transcript integration tests to verify fixes
    - Execute: `npm test -- src/__tests__/transcript-integration.test.js --run`
    - Verify all 10 tests pass
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 3. Fix speaker attribution tests
  - [ ] 3.1 Fix removeStaleChunks() to preserve recent chunks
    - Review chunk removal logic
    - Ensure only chunks older than 5 seconds are removed
    - Verify recent chunks are preserved
    - _Requirements: 3.1, 3.2_
  
  - [ ] 3.2 Fix FIFO ordering in determineSpeakerFromCorrelation()
    - Ensure oldest chunk is processed first
    - Verify queue ordering is maintained
    - _Requirements: 3.3_
  
  - [ ] 3.3 Fix queue drift recovery
    - Ensure queue size is properly tracked
    - Verify recovery mechanism works
    - _Requirements: 3.4_
  
  - [ ] 3.4 Fix queue size history updates
    - Ensure history reflects correct queue size after removal
    - _Requirements: 3.5_
  
  - [ ] 3.5 Run speaker attribution tests to verify fixes
    - Execute: `npm test -- tests/utils/speakerAttribution.test.js --run`
    - Verify all 6 failing tests now pass
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 4. Fix transcript buffer word threshold tests
  - [ ] 4.1 Fix word counting to handle punctuation correctly
    - Update word counting logic to filter punctuation-only strings
    - Ensure empty strings don't count as words
    - _Requirements: 4.4, 4.5_
  
  - [ ] 4.2 Fix minimum word threshold enforcement
    - Ensure buffers with < 5 words are not flushed
    - _Requirements: 4.1_
  
  - [ ] 4.3 Fix speaker change buffer flushing
    - Ensure valid buffers (≥5 words) are flushed on speaker change
    - Ensure invalid buffers (<5 words) are discarded on speaker change
    - _Requirements: 4.2, 4.3_
  
  - [ ] 4.4 Run transcript buffer tests to verify fixes
    - Execute: `npm test -- tests/transcript-buffer.test.js --run`
    - Verify all 3 failing tests now pass
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 5. Fix Gemini conversation tests
  - [ ] 5.1 Fix AI interruption detection
    - Review shouldInterruptAI() logic
    - Ensure it returns true when AI is speaking
    - _Requirements: 5.1_
  
  - [ ] 5.2 Fix AI response parsing with practice tags
    - Review response parsing logic
    - Ensure practice tags are correctly extracted
    - Handle special characters in responses
    - _Requirements: 5.2, 5.4_
  
  - [ ] 5.3 Fix interrupted AI response handling
    - Ensure interruption is detected correctly
    - Verify state is reset properly
    - _Requirements: 5.3, 5.5_
  
  - [ ] 5.4 Run Gemini conversation tests to verify fixes
    - Execute: `npm test -- src/__tests__/geminiConversation.test.js --run`
    - Verify all 3 failing tests now pass
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 6. Fix speaker format test
  - [ ] 6.1 Update speaker label format expectations
    - Review formatSpeakerResults() implementation
    - Update test expectations to match actual format
    - Or update implementation to match expected format
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  
  - [ ] 6.2 Run speaker format test to verify fix
    - Execute: `npm test -- src/__tests__/speakerFormat.test.js --run`
    - Verify test passes
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 7. Fix RAG integration tests
  - [ ] 7.1 Fix similarity threshold retrieval
    - Review vector search logic
    - Ensure 0.70 threshold is applied correctly
    - Verify usedRAG flag is set correctly
    - _Requirements: 7.1, 7.3, 7.5_
  
  - [ ] 7.2 Fix XML context formatting
    - Ensure document IDs are included
    - Ensure relevance scores are included
    - _Requirements: 7.2_
  
  - [ ] 7.3 Run RAG integration tests to verify fixes
    - Execute: `npm test -- src/__tests__/rag-integration.test.js --run`
    - Verify all 2 failing tests now pass
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 8. Final verification
  - [ ] 8.1 Run full test suite
    - Execute: `npm test -- --run`
    - Verify all tests pass (or are properly skipped)
    - _Requirements: All_
  
  - [ ] 8.2 Document any skipped tests
    - Create list of skipped tests with reasons
    - Add TODO comments for future implementation
    - _Requirements: 8.2, 8.3, 8.4_
  
  - [ ] 8.3 Update test documentation
    - Document test structure and organization
    - Add comments for complex test logic
    - _Requirements: 8.5_
