# Requirements Document

## Introduction

This specification addresses critical bugs in the real-time coaching flow that cause transcript fragmentation, AI interruptions, and poor user experience. The system currently sends every word fragment immediately to the AI, causing constant interruptions instead of allowing users to speak complete thoughts. This breaks the intended coaching flow where the AI should suggest responses, let the user speak naturally, monitor adherence, and only respond when the user completes their thought.

## Glossary

- **Transcript Buffering System**: Component that accumulates speech fragments and sends complete thoughts based on sentence endings, pauses, or timeouts
- **Gemini Live API**: Google's real-time audio streaming and transcription service
- **Speaker Attribution**: System that identifies whether audio comes from system (interviewer) or microphone (user)
- **Context Injection**: Mechanism that sends speaker-labeled transcript history to the AI
- **Coaching Flow**: The intended interaction pattern: AI suggests → User speaks → AI monitors → AI responds
- **Speech Fragment**: Individual word or partial sentence received from the transcription API
- **Sentence Completion**: Detection of complete thoughts using punctuation, pauses, or speaker changes
- **Screenshot Capture**: Automated screen capture sent to AI for visual context
- **Response Concatenation**: Combining AI response fragments into coherent messages
- **Message Buffer**: Temporary storage for accumulating AI response parts

## Requirements

### Requirement 1

**User Story:** As a user, I want to speak complete thoughts without AI interruption, so that I can maintain natural conversation flow during coaching sessions.

#### Acceptance Criteria

1. WHEN a user speaks multiple words forming a sentence THEN the Transcript Buffering System SHALL accumulate all words until sentence completion before sending to the renderer
2. WHEN a sentence ends with punctuation (period, exclamation mark, or question mark) THEN the Transcript Buffering System SHALL immediately send the complete buffered sentence
3. WHEN 2 seconds of silence occurs after the last speech fragment THEN the Transcript Buffering System SHALL send the buffered speech as a timeout-triggered completion
4. WHEN the timeout check executes THEN the Transcript Buffering System SHALL calculate time elapsed BEFORE updating the last speech timestamp
5. WHEN buffering speech fragments THEN the Transcript Buffering System SHALL log progress every 5 words to aid debugging

### Requirement 2

**User Story:** As a user, I want the AI to provide clean, artifact-free responses, so that I can read coaching suggestions without confusion.

#### Acceptance Criteria

1. WHEN the AI starts a new response turn THEN the Message Buffer SHALL be completely cleared before accumulating new text
2. WHEN the AI generation completes THEN the Message Buffer SHALL be cleared and marked as complete
3. WHEN the AI response is interrupted THEN the Message Buffer SHALL be immediately cleared and marked as complete
4. WHEN concatenating response fragments THEN the Message Buffer SHALL prevent artifacts like "OnGood" or "GotToTo" from appearing
5. WHEN the generation complete flag is true THEN the Message Buffer SHALL start fresh for the next AI response

### Requirement 3

**User Story:** As a user, I want screenshot captures to be throttled, so that I don't burn through API quota unnecessarily.

#### Acceptance Criteria

1. WHEN a screenshot capture is requested THEN the Screenshot Capture System SHALL check if 60 seconds have elapsed since the last capture
2. WHEN less than 60 seconds have elapsed since the last capture THEN the Screenshot Capture System SHALL skip the capture and log the throttle event
3. WHEN 60 seconds or more have elapsed since the last capture THEN the Screenshot Capture System SHALL proceed with the capture
4. WHEN the application starts THEN the Screenshot Capture System SHALL initialize the last capture timestamp to allow immediate first capture
5. WHEN a screenshot is successfully captured THEN the Screenshot Capture System SHALL update the last capture timestamp

### Requirement 4

**User Story:** As a developer, I want clear logging of the coaching flow state, so that I can debug issues and understand system behavior.

#### Acceptance Criteria

1. WHEN speech fragments are buffered THEN the Transcript Buffering System SHALL log the word count and time remaining until timeout
2. WHEN a buffered sentence is sent THEN the Transcript Buffering System SHALL log the trigger reason (sentence complete or timeout) and word count
3. WHEN the AI response buffer is cleared THEN the Message Buffer SHALL log the clearing event with the reason (new turn, complete, or interrupted)
4. WHEN a screenshot is throttled THEN the Screenshot Capture System SHALL log the seconds remaining until next allowed capture
5. WHEN context injection occurs THEN the Context Injection System SHALL log the trigger reason and buffer length

### Requirement 5

**User Story:** As a user, I want the coaching flow to work as originally intended, so that I can receive real-time coaching without constant interruptions.

#### Acceptance Criteria

1. WHEN the AI provides a suggestion THEN the Coaching Flow SHALL allow the user to speak their complete response without interruption
2. WHEN the user completes their thought THEN the Coaching Flow SHALL send the complete transcript to the AI for evaluation
3. WHEN the AI evaluates user adherence THEN the Coaching Flow SHALL compare the user's actual response against the suggestion
4. WHEN the user speaks THEN the Coaching Flow SHALL not trigger AI responses until sentence completion or timeout
5. WHEN the interviewer speaks THEN the Coaching Flow SHALL buffer their complete question before the AI generates a suggestion

### Requirement 6

**User Story:** As a user, I want context injection to be event-driven and efficient, so that the AI has relevant conversation history without excessive API calls.

#### Acceptance Criteria

1. WHEN a speaker turn boundary occurs (speaker changes) THEN the Context Injection System SHALL immediately send accumulated speaker-labeled context to the AI
2. WHEN 3 seconds elapse without a speaker turn THEN the Context Injection System SHALL send accumulated context as a fallback timeout trigger
3. WHEN context is sent to the AI THEN the Context Injection System SHALL include the last AI suggestion with turn ID and timestamp for coaching feedback
4. WHEN RAG context retrieval is triggered by an interviewer question THEN the Context Injection System SHALL send relevant past conversation chunks separately to avoid blocking
5. WHEN the sendRealtimeInput method returns undefined THEN the Context Injection System SHALL silently skip sending without logging excessive warnings

### Requirement 7

**User Story:** As a developer, I want proper error handling and defensive coding, so that the system remains stable during edge cases and API state transitions.

#### Acceptance Criteria

1. WHEN calling sendRealtimeInput on the Gemini session THEN the system SHALL check if the method exists before invocation
2. WHEN sendRealtimeInput returns undefined THEN the system SHALL handle it gracefully without throwing unhandled promise rejections
3. WHEN the Gemini session is in a transitional state THEN the system SHALL skip operations silently rather than logging warnings
4. WHEN promise-based operations are performed THEN the system SHALL use defensive checks before calling .catch() on return values
5. WHEN audio buffer grows beyond maximum size THEN the system SHALL remove oldest data to prevent memory leaks

### Requirement 8

**User Story:** As a user, I want accurate speaker attribution based on audio source correlation, so that the AI knows who is speaking at all times.

#### Acceptance Criteria

1. WHEN an audio chunk is sent to the Gemini API THEN the Speaker Attribution System SHALL track it in a FIFO queue with source type (system or mic) and timestamp
2. WHEN a transcription arrives from the API THEN the Speaker Attribution System SHALL match it to the oldest unresolved audio chunk in the queue
3. WHEN the audio chunk queue exceeds 50 entries THEN the Speaker Attribution System SHALL remove the oldest entry to prevent memory leaks
4. WHEN audio source is system (BlackHole or SystemAudioDump) THEN the Speaker Attribution System SHALL label the speaker as "Interviewer"
5. WHEN audio source is microphone THEN the Speaker Attribution System SHALL label the speaker as "You"

### Requirement 9

**User Story:** As a user, I want the system to handle different audio capture methods gracefully, so that I can use BlackHole, SystemAudioDump, or browser audio depending on my platform.

#### Acceptance Criteria

1. WHEN starting audio capture on macOS THEN the Audio Capture System SHALL first attempt to detect and use BlackHole virtual audio device
2. WHEN BlackHole is not available on macOS THEN the Audio Capture System SHALL fallback to SystemAudioDump with appropriate permission warnings
3. WHEN using SystemAudioDump THEN the Audio Capture System SHALL kill any existing SystemAudioDump processes before starting a new one
4. WHEN SystemAudioDump fails to start THEN the Audio Capture System SHALL provide clear error messages about Screen Recording permissions
5. WHEN audio capture fails THEN the Audio Capture System SHALL display recovery steps to the user with platform-specific instructions

### Requirement 10

**User Story:** As a user, I want the conversation state machine to accurately track coaching suggestions and my responses, so that I receive meaningful feedback on my performance.

#### Acceptance Criteria

1. WHEN the AI generates a complete response THEN the Conversation State Machine SHALL track it as a suggestion with turn ID and timestamp
2. WHEN the user speaks after a suggestion THEN the Conversation State Machine SHALL transition from SUGGESTING to MONITORING state
3. WHEN comparing user response to suggestion THEN the Conversation State Machine SHALL calculate adherence score using word overlap algorithm
4. WHEN adherence is calculated THEN the Conversation State Machine SHALL provide human-readable analysis (Excellent, Good, Moderate, Low, Minimal)
5. WHEN turn history exceeds 10 entries THEN the Conversation State Machine SHALL remove the oldest entry to prevent memory growth


### Requirement 11

**User Story:** As a developer, I want system prompts to safely include backticks in documentation strings, so that variable names don't cause ReferenceErrors when the module loads.

#### Acceptance Criteria

1. WHEN template literal strings contain backticks for code documentation THEN the System Prompt Module SHALL escape them with backslashes (\`)
2. WHEN the prompts module loads THEN the System Prompt Module SHALL not throw ReferenceError for variable names inside documentation strings
3. WHEN backticks appear in documentation for XML-style tags THEN the System Prompt Module SHALL escape them as \`<lastSuggestion>\` not `<lastSuggestion>`
4. WHEN the module is imported THEN the System Prompt Module SHALL ensure all template strings are syntactically valid JavaScript
5. WHEN code examples are included in prompts THEN the System Prompt Module SHALL consistently escape backticks throughout the file

### Requirement 12

**User Story:** As a user, I want the system to handle API state transitions gracefully without flooding logs, so that I can focus on relevant debugging information.

#### Acceptance Criteria

1. WHEN calling sendRealtimeInput on the Gemini session THEN the Context Injection System SHALL check if the function exists before invocation
2. WHEN sendRealtimeInput returns undefined during normal operation THEN the Context Injection System SHALL silently skip without logging warnings
3. WHEN the Gemini session is not ready THEN the Context Injection System SHALL skip context injection without excessive logging
4. WHEN promise-based operations return undefined THEN the Context Injection System SHALL NOT log warnings about missing promise chains
5. WHEN actual errors occur (network failures, API errors) THEN the Context Injection System SHALL log them with appropriate error level

### Requirement 13

**User Story:** As a user, I want the transcript buffering system to work despite unreliable word-level speaker attribution, so that I can speak complete sentences without interruption.

#### Acceptance Criteria

1. WHEN Gemini API provides speaker attribution that changes word-by-word THEN the Transcript Buffering System SHALL NOT flush the buffer on speaker changes
2. WHEN buffering speech fragments THEN the Transcript Buffering System SHALL ignore speaker change events as flush triggers
3. WHEN the speaker attribution oscillates between "You" and "Interviewer" on consecutive words THEN the Transcript Buffering System SHALL continue accumulating in the buffer
4. WHEN sending buffered speech THEN the Transcript Buffering System SHALL use ONLY punctuation detection or timeout as triggers, NOT speaker changes
5. WHEN speaker attribution is tracked THEN the Speaker Attribution System SHALL use it only for context tracking and coaching feedback, NOT for buffer flush decisions
