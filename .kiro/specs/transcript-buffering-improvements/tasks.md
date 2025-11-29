# Implementation Plan

- [ ] 1. Set up testing infrastructure
  - Install fast-check library for property-based testing
  - Configure test runner for minimum 100 iterations per property test
  - Create test utilities for generating test data
  - _Requirements: All testing requirements_

- [ ] 2. Implement text normalization
  - Write normalizeText() function with Unicode handling, tab conversion, and punctuation spacing
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ]* 2.1 Write property test for text normalization
  - **Property 2: Text normalization preserves content**
  - **Validates: Requirements 5.1, 5.2, 5.3**

- [ ] 3. Implement adaptive timeout logic
  - Write getAdaptiveTimeout() function with state-based timeout selection
  - Define timeout constants (IDLE_TIMEOUT=2000, MONITORING_TIMEOUT=3000, SLOW_START_TIMEOUT=3000)
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [ ]* 3.1 Write property test for adaptive timeouts
  - **Property 12: Adaptive timeout selection**
  - **Validates: Requirements 12.1, 12.2, 12.3**

- [ ] 4. Enhance transcript buffer with minimum word threshold
  - Add MIN_WORD_THRESHOLD constant (5 words)
  - Modify shouldFlushBuffer() to check word count before flushing
  - Add word counting logic to buffer state
  - _Requirements: 1.2, 1.3_

- [ ]* 4.1 Write property test for minimum word threshold
  - **Property 1: Minimum word threshold enforcement**
  - **Validates: Requirements 1.2, 1.5**

- [ ] 5. Implement speaker change handling
  - Add speaker change detection in bufferTranscript()
  - Implement flush logic for buffers ≥ 5 words on speaker change
  - Implement discard logic for buffers < 5 words on speaker change
  - _Requirements: 1.6, 1.7_

- [ ]* 5.1 Write property test for speaker change flush
  - **Property 3: Speaker change flushes valid buffers**
  - **Validates: Requirements 1.6**

- [ ]* 5.2 Write property test for speaker change discard
  - **Property 4: Speaker change discards invalid buffers**
  - **Validates: Requirements 1.7**

- [ ] 6. Implement debounced context injection
  - Add CONTEXT_DEBOUNCE_DELAY constant (500ms)
  - Write scheduleContextInjection() with debounce timer
  - Write cancelDebounce() for cleanup
  - Modify context injection to use debouncing
  - _Requirements: 2.1, 2.2, 2.5_

- [ ]* 6.1 Write property test for debounce coalescing
  - **Property 5: Debounce coalesces rapid changes**
  - **Validates: Requirements 2.1, 2.2**

- [ ] 7. Implement context buffer size limits
  - Add CONTEXT_MAX_SIZE (1000) and CONTEXT_HARD_LIMIT (2000) constants
  - Implement immediate send when buffer exceeds 1000 chars
  - Implement truncation when buffer exceeds 2000 chars
  - Add logging for truncation events
  - _Requirements: 2.6, 2.7_

- [ ]* 7.1 Write property test for context size triggers
  - **Property 6: Context size triggers immediate send**
  - **Validates: Requirements 2.6**

- [ ]* 7.2 Write property test for context truncation
  - **Property 7: Context truncation at hard limit**
  - **Validates: Requirements 2.7**

- [ ] 8. Implement turn history tracking
  - Add CONTEXT_TURN_HISTORY constant (3 turns)
  - Modify buildContextMessage() to include last 3 turns with speaker labels
  - Add turn history data structure to context state
  - _Requirements: 2.8_

- [ ] 9. Enhance AI response handling
  - Implement parsePracticeTags() function with regex for suggestion/feedback tags
  - Implement shouldInterruptAI() detection logic
  - Modify handleAIResponse() to clear buffer on new response start
  - Add interruption marking when user speaks during AI generation
  - _Requirements: 7.1, 7.2, 7.5, 7.6, 7.7, 7.8_

- [ ]* 9.1 Write property test for AI response buffer clearing
  - **Property 8: AI response buffer clearing**
  - **Validates: Requirements 7.1**

- [ ]* 9.2 Write property test for interruption detection
  - **Property 9: Interruption detection**
  - **Validates: Requirements 7.2, 7.5**

- [ ]* 9.3 Write property test for tag extraction
  - **Property 10: Tag extraction correctness**
  - **Validates: Requirements 7.6**

- [ ]* 9.4 Write property test for unknown tag handling
  - **Property 11: Unknown tag handling**
  - **Validates: Requirements 7.8**

- [ ] 10. Implement error handling and resilience
  - Add try-catch blocks for malformed transcription data
  - Implement retry logic for failed context injection (1 retry after 1s)
  - Add text sanitization for corrupted buffer content
  - Add fallback to console logging when session logging fails
  - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [ ]* 10.1 Write property test for error resilience
  - **Property 12: Error resilience**
  - **Validates: Requirements 10.1**

- [ ]* 10.2 Write property test for retry logic
  - **Property 13: Retry logic**
  - **Validates: Requirements 10.2**

- [ ] 11. Enhance session logger
  - Add logDebounce() method for debounce activity logging
  - Add logBufferRejection() method for rejected fragment logging
  - Add logContextTruncation() method for truncation logging
  - Update existing log methods to include new information
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ]* 11.1 Write property test for logging behavior
  - **Property 4: Logging completeness**
  - **Validates: Requirements 4.1, 4.2, 4.3**

- [ ] 12. Integrate with conversation state machine
  - Import conversationState from conversationState.js
  - Pass current state to getAdaptiveTimeout()
  - Update state transitions when suggestions/feedback are detected
  - Track suggestions for adherence measurement
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 13.1, 13.2, 13.3, 13.4, 13.5_

- [ ] 13. Integrate with audio correlation system
  - Verify FIFO queue behavior is maintained
  - Add queue overflow detection (>100 entries)
  - Add correlation drift warning logging
  - Ensure speaker attribution uses correlation results
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7_

- [ ]* 13.1 Write property test for audio correlation FIFO
  - **Property 14: Audio correlation FIFO ordering**
  - **Validates: Requirements 14.1, 14.2, 14.3**

- [ ] 14. Integrate with RAG system
  - Add word count check (>10 words) before RAG query
  - Implement sequential context sending (main context first, then RAG)
  - Add error handling for RAG query failures
  - Wrap RAG context in relevantHistory tags
  - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

- [ ]* 14.1 Write property test for RAG query threshold
  - **Property 15: RAG query threshold**
  - **Validates: Requirements 15.1**

- [ ] 15. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 16. Update configuration constants documentation
  - Document all new constants at top of gemini.js
  - Add comments explaining timeout priorities
  - Document debounce and buffer size limits
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ]* 17. Write integration tests
  - Test full transcript flow: Audio → Correlation → Buffer → UI
  - Test context injection flow: Transcript → Debounce → Context → AI
  - Test coaching loop: Question → Suggestion → User Response → Feedback
  - Test RAG integration: Question → RAG Query → Context Enhancement
  - Test error recovery: Failure → Retry → Fallback

- [ ]* 18. Write performance tests
  - Verify debounce latency ≤ 500ms
  - Verify buffer flush latency ≤ 100ms to UI
  - Verify context injection ≤ 1000ms API call
  - Verify RAG query ≤ 500ms

- [ ] 19. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
