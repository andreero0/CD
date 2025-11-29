# Requirements Document

## Introduction

The Prism application uses Google's Gemini Live API for real-time speech transcription and AI coaching. The current implementation suffers from three critical issues that degrade user experience and AI response quality:

1. **Context injection spam**: Gemini's word-level speaker attribution changes trigger excessive context injections (multiple per second)
2. **Fragment transmission**: Single words and tiny fragments bypass buffering logic and reach the UI
3. **Text fragmentation**: Gemini outputs heavily spaced text that appears broken in the UI

This feature addresses these issues by implementing intelligent debouncing, stricter buffering thresholds, and text normalization to ensure smooth, coherent transcript delivery.

## Glossary

- **Gemini Live API**: Google's real-time multimodal AI API that provides speech transcription with speaker attribution
- **Context Injection**: The process of sending accumulated transcript context to the AI model for processing
- **Transcript Buffer**: A temporary storage mechanism that accumulates speech fragments before sending them to the UI
- **Speaker Attribution**: Gemini's identification of which speaker (user/system audio) produced each transcript fragment
- **Debouncing**: A technique to limit the rate at which a function executes by introducing a minimum time delay between invocations
- **Fragment**: A small piece of transcribed text, typically a single word or partial sentence
- **Session Logger**: The logging system that records transcript buffering and context injection events
- **Conversation State**: The current phase of the coaching interaction (IDLE, SUGGESTING, MONITORING, EVALUATING) that determines system behavior
- **Turn ID**: A unique identifier for each question-answer pair in the coaching session
- **Adherence Tracking**: The process of comparing user responses to AI suggestions and measuring how closely they match
- **Audio Correlation**: The FIFO matching process that maps transcribed text fragments to their originating audio source (system/microphone)
- **RAG (Retrieval-Augmented Generation)**: A system that retrieves relevant historical context from past sessions to inform current AI responses
- **Practice Mode Tags**: XML-like markers (suggestion, feedback) that Gemini uses to structure coaching responses

## Requirements

### Requirement 1

**User Story:** As a user, I want the transcript to display complete sentences rather than individual words, so that I can read coherent text without distraction.

#### Acceptance Criteria

1. WHEN the transcript buffer receives text fragments THEN the system SHALL accumulate them until a sentence-ending punctuation mark is detected
2. WHEN the accumulated buffer contains fewer than 5 words THEN the system SHALL NOT send the transcript to the UI
3. WHEN the buffer timeout is reached AND the buffer contains at least 5 words THEN the system SHALL send the accumulated transcript to the UI
4. WHEN text is sent to the UI THEN the system SHALL normalize spacing by removing excessive whitespace between characters
5. WHEN a sentence-ending punctuation mark is detected THEN the system SHALL send the buffered transcript regardless of word count
6. WHEN speaker changes AND the buffer contains at least 5 words THEN the system SHALL flush the previous speaker's buffer before starting a new buffer for the new speaker
7. WHEN speaker changes AND the buffer contains fewer than 5 words THEN the system SHALL discard the incomplete buffer and start fresh for the new speaker

### Requirement 2

**User Story:** As a user, I want the AI to receive context at appropriate intervals, so that responses are timely without being overwhelmed by excessive updates.

#### Acceptance Criteria

1. WHEN a speaker change is detected THEN the system SHALL wait at least 500 milliseconds before sending context to the AI
2. WHEN multiple speaker changes occur within 500 milliseconds THEN the system SHALL send context only once after the debounce period
3. WHEN the context buffer timeout is reached THEN the system SHALL send accumulated context as a fallback mechanism
4. WHEN context is sent to the AI THEN the system SHALL log the trigger reason and timestamp
5. WHEN the debounce period is active THEN the system SHALL continue accumulating context without sending
6. WHEN the context buffer exceeds 1000 characters THEN the system SHALL send context immediately regardless of debounce timers
7. WHEN the context buffer exceeds 2000 characters THEN the system SHALL truncate the oldest entries to maintain the limit and log a warning
8. WHEN context is sent THEN the system SHALL include the last 3 conversation turns with speaker labels

### Requirement 3

**User Story:** As a developer, I want configurable buffering parameters, so that I can tune the system for different speech patterns and use cases.

#### Acceptance Criteria

1. WHEN the system initializes THEN the system SHALL define a minimum word threshold constant for transcript buffering
2. WHEN the system initializes THEN the system SHALL define a debounce delay constant for context injection
3. WHEN the system initializes THEN the system SHALL define a buffer timeout constant for transcript accumulation
4. WHEN the system initializes THEN the system SHALL define a context timeout constant for fallback injection
5. WHERE configuration changes are needed THEN the system SHALL allow modification of constants without code restructuring

### Requirement 4

**User Story:** As a developer, I want detailed logging of buffering behavior, so that I can diagnose issues and verify correct operation.

#### Acceptance Criteria

1. WHEN a transcript is buffered THEN the system SHALL log the current word count and time remaining until timeout
2. WHEN a transcript is sent to the UI THEN the system SHALL log the reason, word count, and preview of the text
3. WHEN context is sent to the AI THEN the system SHALL log the trigger reason and whether debouncing occurred
4. WHEN the debounce timer is active THEN the system SHALL log that context injection is being delayed
5. WHEN fragments are rejected due to minimum word threshold THEN the system SHALL log the rejection reason

### Requirement 5

**User Story:** As a user, I want text to appear properly formatted without excessive spacing, so that transcripts are readable and professional.

#### Acceptance Criteria

1. WHEN text contains multiple consecutive spaces THEN the system SHALL replace them with a single space
2. WHEN text contains spaces before punctuation marks THEN the system SHALL remove those spaces
3. WHEN text is normalized THEN the system SHALL preserve sentence-ending punctuation
4. WHEN text is normalized THEN the system SHALL preserve speaker labels and formatting
5. WHEN normalized text is sent to the UI THEN the system SHALL maintain the original semantic meaning

### Requirement 6

**User Story:** As a user being coached during an interview, I want Gemini to suggest responses when the interviewer asks questions, so that I can repeat the suggestions verbatim.

#### Acceptance Criteria

1. WHEN the interviewer speaks THEN the system SHALL send context to Gemini for analysis
2. WHEN Gemini generates a suggestion THEN the system SHALL track it for adherence measurement
3. WHEN the user speaks THEN the system SHALL compare their response to Gemini's suggestion
4. WHEN the user deviates from the suggestion THEN Gemini SHALL provide corrective feedback
5. WHEN the user follows the suggestion well THEN Gemini SHALL acknowledge briefly

### Requirement 7

**User Story:** As a user, I want Gemini's responses to appear cleanly without duplication or corruption, so that I can read suggestions without confusion.

#### Acceptance Criteria

1. WHEN a new AI response starts THEN the system SHALL clear any previous response buffer
2. WHEN an AI response is interrupted THEN the system SHALL clear the buffer and mark it incomplete
3. WHEN an AI response completes THEN the system SHALL display the full message and mark it complete
4. WHEN multiple rapid responses occur THEN the system SHALL prevent concatenation artifacts
5. WHEN user speech is detected AND an AI response is currently being streamed THEN the system SHALL mark the AI response as interrupted
6. WHEN Gemini sends text wrapped in suggestion tags THEN the system SHALL extract the suggestion text and store it for adherence tracking
7. WHEN Gemini sends text wrapped in feedback tags THEN the system SHALL display it as coaching feedback
8. WHEN Gemini sends unrecognized XML-like tags THEN the system SHALL log them and display the content without the tags

### Requirement 8

**User Story:** As a user, I want transcript entries to clearly show who is speaking, so that I can follow the conversation flow.

#### Acceptance Criteria

1. WHEN a transcript is sent to the UI THEN the system SHALL format it with speaker label prefix
2. WHEN the speaker is the user THEN the system SHALL use an appropriate user label
3. WHEN the speaker is from system audio THEN the system SHALL use a profile-appropriate label
4. WHEN speaker attribution is unreliable THEN the system SHALL default to the last known speaker
5. WHEN transcript is displayed THEN the system SHALL use pre-formatted text to eliminate frontend re-buffering

### Requirement 9

**User Story:** As a user, I want responses to appear quickly without noticeable delay, so that coaching feels real-time.

#### Acceptance Criteria

1. WHEN context is debounced THEN the maximum delay SHALL NOT exceed 500 milliseconds
2. WHEN a sentence completes THEN the transcript SHALL appear in the UI within 100 milliseconds
3. WHEN Gemini generates a suggestion THEN it SHALL display within 200 milliseconds of completion
4. WHEN buffer timeout triggers THEN the system SHALL flush within 50 milliseconds
5. WHEN context injection occurs THEN the API call SHALL complete within 1000 milliseconds or log a warning

### Requirement 10

**User Story:** As a user, I want the system to handle errors gracefully without crashing, so that my session continues uninterrupted.

#### Acceptance Criteria

1. WHEN Gemini sends malformed transcription data THEN the system SHALL log the error and skip the fragment
2. WHEN context injection fails THEN the system SHALL retry once after 1 second
3. WHEN the buffer contains corrupted text THEN the system SHALL sanitize it before displaying
4. WHEN session logging fails THEN the system SHALL continue operation and log to console
5. WHEN Gemini API disconnects THEN the system SHALL attempt reconnection with exponential backoff

### Requirement 11

**User Story:** As a developer, I want comprehensive session logs, so that I can diagnose issues after they occur.

#### Acceptance Criteria

1. WHEN a session starts THEN the system SHALL create a timestamped log file with platform metadata
2. WHEN transcript buffering occurs THEN logs SHALL include word count, timeout remaining, and preview
3. WHEN context injection occurs THEN logs SHALL include trigger reason and timestamp
4. WHEN AI responses occur THEN logs SHALL include start, interruption, and completion events
5. WHEN a session ends THEN logs SHALL be written to disk and the file closed properly

### Requirement 12

**User Story:** As a user answering complex interview questions, I want the system to give me time to think without cutting me off, so that I can formulate complete answers.

#### Acceptance Criteria

1. WHEN conversation state is IDLE THEN the system SHALL use a 2-second transcript buffer timeout
2. WHEN conversation state is MONITORING THEN the system SHALL use a 3-second transcript buffer timeout to allow thinking pauses
3. WHEN the user has spoken fewer than 3 words THEN the system SHALL extend the timeout to 3 seconds to prevent premature cutoff on slow starts
4. WHEN the user's last fragment does not end with punctuation THEN the system SHALL wait the full timeout period before flushing
5. WHEN timeout values are modified THEN they SHALL be defined as named constants at the top of the file

### Requirement 13

**User Story:** As a developer, I want clear tracking of conversation turns, so that the system knows when to suggest, when to listen, and when to evaluate.

#### Acceptance Criteria

1. WHEN the interviewer finishes speaking THEN the system SHALL transition conversation state to IDLE and prepare to send context for suggestion generation
2. WHEN Gemini generates a suggestion THEN the system SHALL transition conversation state to SUGGESTING and store the suggestion with a turn ID
3. WHEN the user starts speaking after a suggestion THEN the system SHALL transition conversation state to MONITORING and begin adherence tracking
4. WHEN the user finishes speaking AND state is MONITORING THEN the system SHALL send context with the last suggestion for evaluation and transition to EVALUATING
5. WHEN Gemini generates feedback THEN the system SHALL transition conversation state back to IDLE and increment the turn counter

### Requirement 14

**User Story:** As a user, I want the system to correctly identify who is speaking even when Gemini's speaker diarization is unreliable, so that transcripts are accurately labeled.

#### Acceptance Criteria

1. WHEN system audio is sent to Gemini THEN the system SHALL enqueue an audio chunk descriptor with source system and a correlation ID
2. WHEN microphone audio is sent to Gemini THEN the system SHALL enqueue an audio chunk descriptor with source microphone and a correlation ID
3. WHEN a transcript fragment arrives from Gemini THEN the system SHALL dequeue the oldest audio chunk descriptor and use its source to determine speaker
4. WHEN source is system THEN the speaker label SHALL be Interviewer
5. WHEN source is microphone THEN the speaker label SHALL be You
6. WHEN the audio chunk queue is empty THEN the system SHALL default to the last known speaker or You if unknown
7. WHEN the audio chunk queue exceeds 100 entries THEN the system SHALL log a warning about correlation drift

### Requirement 15

**User Story:** As a user, I want the AI to remember relevant past conversations, so that coaching improves over time and references previous feedback.

#### Acceptance Criteria

1. WHEN the interviewer asks a question with text length greater than 10 words THEN the system SHALL query the RAG system with the question text
2. WHEN RAG returns relevant context with score at least 0.6 THEN the system SHALL include it in the context injection wrapped in relevantHistory tags
3. WHEN RAG context exceeds 400 tokens THEN the system SHALL truncate it to the most relevant entries
4. WHEN RAG query fails THEN the system SHALL log the error and continue without historical context
5. WHEN RAG context is included THEN the system SHALL send it as a separate realtime input message immediately after the main context
