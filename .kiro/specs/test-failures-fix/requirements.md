# Requirements Document

## Introduction

The Prism application has 34 failing tests across multiple test suites. These failures need to be systematically addressed to ensure code quality and prevent regressions. The failures span several areas: context injection debouncing, transcript integration, speaker attribution, transcript buffering, Gemini conversation handling, speaker formatting, and RAG integration.

## Glossary

- **Vitest**: JavaScript testing framework used in the project
- **Property-Based Testing (PBT)**: Testing approach that validates properties across many randomly generated inputs
- **Mock**: Test double that simulates behavior of real objects
- **RAG**: Retrieval-Augmented Generation system for context enhancement
- **Speaker Attribution**: System for identifying who is speaking in audio transcripts
- **Context Injection**: Process of sending contextual information to the AI
- **Debouncing**: Technique to delay execution until after a period of inactivity

## Requirements

### Requirement 1

**User Story:** As a developer, I want all context injection debouncing tests to pass, so that I can ensure the debouncing logic works correctly.

#### Acceptance Criteria

1. WHEN vitest mocking is used THEN the vi object SHALL be properly available in tests
2. WHEN sessionLogger is mocked THEN the mock SHALL properly track function calls
3. WHEN fake timers are used THEN they SHALL be properly restored after each test
4. WHEN context size exceeds limits THEN the system SHALL handle truncation correctly
5. WHEN debounce is cancelled THEN the system SHALL clear timers and reset state

### Requirement 2

**User Story:** As a developer, I want all transcript integration tests to pass, so that I can ensure conversation state and RAG integration work correctly.

#### Acceptance Criteria

1. WHEN conversation state is queried THEN the mock SHALL be called appropriately
2. WHEN suggestions are tracked THEN the conversationState module SHALL receive the data
3. WHEN user responses are compared THEN the comparison logic SHALL execute correctly
4. WHEN RAG is queried THEN the word count threshold SHALL be enforced at exactly 10 words
5. WHEN state transitions occur THEN they SHALL follow valid state machine rules

### Requirement 3

**User Story:** As a developer, I want all speaker attribution tests to pass, so that I can ensure speaker identification works correctly.

#### Acceptance Criteria

1. WHEN stale chunks are removed THEN recent chunks SHALL be preserved
2. WHEN chunks have mixed timestamps THEN only fresh chunks SHALL remain
3. WHEN speakers are determined THEN FIFO order SHALL be maintained
4. WHEN queue drift occurs THEN the system SHALL recover correctly
5. WHEN queue size history is updated THEN it SHALL reflect the correct size

### Requirement 4

**User Story:** As a developer, I want all transcript buffer tests to pass, so that I can ensure word threshold enforcement works correctly.

#### Acceptance Criteria

1. WHEN buffers contain insufficient words THEN they SHALL not be flushed
2. WHEN speaker changes occur THEN valid buffers SHALL be flushed
3. WHEN speaker changes occur THEN invalid buffers SHALL be discarded
4. WHEN punctuation-only content is buffered THEN it SHALL be handled correctly
5. WHEN empty strings are buffered THEN they SHALL not count as words

### Requirement 5

**User Story:** As a developer, I want all Gemini conversation tests to pass, so that I can ensure AI response handling works correctly.

#### Acceptance Criteria

1. WHEN AI is speaking THEN interruption detection SHALL work correctly
2. WHEN AI responses contain practice tags THEN they SHALL be parsed correctly
3. WHEN AI responses are interrupted THEN the system SHALL handle it gracefully
4. WHEN responses contain special characters THEN they SHALL be sanitized
5. WHEN response buffers are cleared THEN state SHALL be reset properly

### Requirement 6

**User Story:** As a developer, I want speaker format tests to pass, so that I can ensure diarization results are formatted correctly.

#### Acceptance Criteria

1. WHEN diarization results are formatted THEN speaker labels SHALL match expected format
2. WHEN speaker IDs are mapped THEN they SHALL use consistent naming (Interviewer, Candidate)
3. WHEN multiple speakers are present THEN each SHALL have a distinct label
4. WHEN formatting is applied THEN it SHALL preserve the transcript content
5. WHEN speaker labels are generated THEN they SHALL follow the project conventions

### Requirement 7

**User Story:** As a developer, I want RAG integration tests to pass, so that I can ensure context retrieval works correctly.

#### Acceptance Criteria

1. WHEN similarity threshold is 0.70 THEN relevant context SHALL be retrieved
2. WHEN context is formatted as XML THEN it SHALL include document IDs and relevance scores
3. WHEN vector search is performed THEN results SHALL meet the similarity threshold
4. WHEN no results meet threshold THEN the system SHALL handle it gracefully
5. WHEN RAG is queried THEN the response SHALL indicate whether RAG was used

### Requirement 8

**User Story:** As a developer, I want integration tests to be properly structured, so that they can be implemented when ready.

#### Acceptance Criteria

1. WHEN integration tests are run THEN they SHALL have proper imports and setup
2. WHEN placeholder tests exist THEN they SHALL be marked as skipped
3. WHEN tests require internal state THEN they SHALL document what needs to be exported
4. WHEN tests are skipped THEN they SHALL include TODO comments explaining why
5. WHEN tests are ready to implement THEN they SHALL have clear requirements
