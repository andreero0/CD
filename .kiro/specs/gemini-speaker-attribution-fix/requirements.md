# Requirements Document

## Introduction

The Prism application uses Google's Gemini Live API for real-time speech transcription with speaker diarization enabled. The API is configured to distinguish between two speakers (system audio/interviewer and microphone/user), but it returns transcriptions in an incorrect format that lacks speaker identification data. This causes the speaker attribution system to fall back to unreliable FIFO audio chunk correlation, resulting in incorrect speaker labels, excessive context injection, interrupted AI suggestions, and unstable teleprompt content.

The core issue is that Gemini returns transcriptions as `{ text: "..." }` instead of the expected `{ results: [{ transcript: "...", speakerId: 1 }] }` format. This prevents the system from accurately determining who is speaking, breaking the coaching flow and user experience.

## Glossary

- **Gemini Live API**: Google's real-time multimodal AI API that provides speech transcription with speaker diarization capabilities
- **Speaker Diarization**: The process of identifying and labeling different speakers in an audio stream
- **Speaker Attribution**: The system component that determines which speaker (user or interviewer) produced each transcript fragment
- **FIFO Audio Chunk Correlation**: Fallback mechanism that matches transcriptions to audio chunks in first-in-first-out order
- **Context Injection**: The process of sending accumulated transcript context to the AI model for processing
- **System Audio**: Audio captured from the computer's output (interviewer's voice in video calls)
- **Microphone Audio**: Audio captured from the user's microphone (user's voice)
- **Speaker ID**: Numeric identifier assigned by Gemini to distinguish between speakers (1 for system audio, 2 for microphone)
- **Transcript Fragment**: A piece of transcribed text returned by the Gemini API
- **Response Modalities**: Configuration parameter that specifies how Gemini should respond (audio, text, etc.)
- **Input Audio Transcription**: Configuration object that controls how Gemini transcribes incoming audio
- **Voice Fingerprinting**: Alternative technique for identifying speakers based on audio characteristics
- **Audio Energy Levels**: Measurement of audio signal strength used for voice-based speaker detection

## Requirements

### Requirement 1

**User Story:** As a developer, I want to investigate why Gemini returns transcriptions without speaker IDs, so that I can determine if this is a configuration issue or API limitation.

#### Acceptance Criteria

1. WHEN reviewing the Gemini Live API configuration THEN the system SHALL verify that `enableSpeakerDiarization` is set to `true`
2. WHEN reviewing the Gemini Live API configuration THEN the system SHALL verify that `minSpeakerCount` is set to `2`
3. WHEN reviewing the Gemini Live API configuration THEN the system SHALL verify that `maxSpeakerCount` is set to `2`
4. WHEN examining API responses THEN the system SHALL log the complete structure of `serverContent.inputTranscription` objects
5. WHEN examining API responses THEN the system SHALL identify whether responses contain `.text`, `.results`, or both fields
6. WHEN researching the API THEN the system SHALL verify the correct API version and endpoint being used
7. WHEN researching the API THEN the system SHALL check if additional configuration parameters are required for `.results` format

### Requirement 2

**User Story:** As a developer, I want to verify that both audio streams are being sent correctly to Gemini, so that speaker diarization has the necessary input data.

#### Acceptance Criteria

1. WHEN system audio is captured THEN the system SHALL send it to Gemini via `sendRealtimeInput({ audio: { data, mimeType } })`
2. WHEN microphone audio is captured THEN the system SHALL send it to Gemini via the `send-mic-audio-content` IPC channel
3. WHEN audio is sent THEN the system SHALL log the audio source (system or microphone) and data size
4. WHEN both audio streams are active THEN the system SHALL verify that Gemini receives interleaved audio from both sources
5. WHEN audio format is specified THEN the system SHALL ensure both streams use compatible sample rates and encoding

### Requirement 3

**User Story:** As a developer, I want to determine if session configuration affects transcription format, so that I can adjust settings to enable speaker ID output.

#### Acceptance Criteria

1. WHEN initializing the Gemini session THEN the system SHALL review all configuration parameters including `responseModalities`
2. WHEN initializing the Gemini session THEN the system SHALL review tool configurations that might affect transcription behavior
3. WHEN testing configuration changes THEN the system SHALL document which parameters affect transcription format
4. WHEN testing configuration changes THEN the system SHALL verify if any combination produces `.results` array output
5. WHEN configuration is modified THEN the system SHALL log the complete session config for debugging

### Requirement 4

**User Story:** As a user, I want Gemini to return speaker IDs with each transcription fragment, so that the system can accurately attribute speech to the correct speaker.

#### Acceptance Criteria

1. WHEN Gemini transcribes audio THEN the system SHALL receive `serverContent.inputTranscription.results` as an array
2. WHEN transcription results are received THEN each result SHALL contain a `transcript` field with the transcribed text
3. WHEN transcription results are received THEN each result SHALL contain a `speakerId` field with a numeric identifier
4. WHEN system audio is transcribed THEN the `speakerId` SHALL consistently be `1`
5. WHEN microphone audio is transcribed THEN the `speakerId` SHALL consistently be `2`
6. WHEN an utterance spans multiple fragments THEN all fragments from the same speaker SHALL have the same `speakerId`

### Requirement 5

**User Story:** As a user, I want speaker labels to remain consistent throughout entire utterances, so that I can read coherent transcripts without mid-sentence speaker changes.

#### Acceptance Criteria

1. WHEN a speaker begins an utterance THEN the system SHALL maintain the same speaker label for all fragments until the utterance completes
2. WHEN transcription fragments arrive THEN the system SHALL NOT change speaker labels mid-sentence
3. WHEN buffering transcript fragments THEN the system SHALL use speaker ID to determine speaker label, not FIFO correlation
4. WHEN speaker changes occur THEN the system SHALL only trigger context injection once per actual speaker turn
5. WHEN logging speaker attribution THEN the system SHALL include both the speaker ID from Gemini and the determined speaker label

### Requirement 6

**User Story:** As a user, I want AI suggestions to complete without interruption, so that I can read and follow coaching guidance effectively.

#### Acceptance Criteria

1. WHEN the AI is generating a suggestion THEN false speaker changes SHALL NOT trigger context injection
2. WHEN context injection is triggered THEN it SHALL only occur on actual speaker turn boundaries
3. WHEN the user is reading a suggestion THEN the teleprompt content SHALL remain stable
4. WHEN speaker attribution is accurate THEN context injection frequency SHALL decrease to appropriate levels
5. WHEN monitoring coaching sessions THEN the system SHALL log context injection triggers with speaker change details

### Requirement 7

**User Story:** As a developer, I want to implement a fallback speaker detection mechanism if Gemini cannot provide speaker IDs, so that the system remains functional.

#### Acceptance Criteria

1. IF the `.results` format is not available THEN the system SHALL document the API limitation with version and endpoint details
2. IF speaker IDs are unavailable THEN the system SHALL implement voice-based speaker detection using audio energy levels
3. IF speaker IDs are unavailable THEN the system SHALL consider voice fingerprinting as an alternative identification method
4. IF no reliable speaker detection is possible THEN the system SHALL disable speaker attribution and label all text as "User"
5. IF fallback mechanisms are used THEN the system SHALL log the detection method and confidence level

### Requirement 8

**User Story:** As a developer, I want to modify the transcription handling logic to process speaker IDs correctly, so that speaker attribution works as designed.

#### Acceptance Criteria

1. WHEN processing `serverContent.inputTranscription` THEN the system SHALL check for the `.results` array first
2. WHEN `.results` array exists THEN the system SHALL iterate through each result object
3. WHEN processing each result THEN the system SHALL extract both `transcript` and `speakerId` fields
4. WHEN `speakerId` is `1` THEN the system SHALL label the speaker as "Interviewer"
5. WHEN `speakerId` is `2` THEN the system SHALL label the speaker as "You"
6. WHEN `.results` array is missing THEN the system SHALL fall back to the existing FIFO correlation method
7. WHEN using fallback correlation THEN the system SHALL log a warning about unreliable speaker attribution

### Requirement 9

**User Story:** As a developer, I want comprehensive logging of speaker attribution decisions, so that I can verify correct operation and diagnose issues.

#### Acceptance Criteria

1. WHEN transcription arrives THEN the system SHALL log whether it contains `.text` or `.results` format
2. WHEN processing `.results` THEN the system SHALL log each transcript fragment with its speaker ID
3. WHEN speaker attribution changes THEN the system SHALL log the previous speaker, new speaker, and trigger reason
4. WHEN FIFO correlation is used THEN the system SHALL log the correlation queue state and matched audio chunk
5. WHEN speaker attribution fails THEN the system SHALL log the error with full transcription object details

### Requirement 10

**User Story:** As a user, I want the system to handle edge cases gracefully, so that speaker attribution remains stable during unusual conditions.

#### Acceptance Criteria

1. WHEN transcription contains empty text THEN the system SHALL skip processing and maintain the current speaker
2. WHEN speaker ID is missing from a result THEN the system SHALL default to the last known speaker
3. WHEN speaker ID is an unexpected value THEN the system SHALL log a warning and use fallback attribution
4. WHEN multiple results arrive simultaneously THEN the system SHALL process them in order while maintaining speaker consistency
5. WHEN the API returns malformed transcription data THEN the system SHALL log the error and continue operation

### Requirement 11

**User Story:** As a developer, I want to test speaker attribution with both audio streams active, so that I can verify correct operation in real coaching scenarios.

#### Acceptance Criteria

1. WHEN starting a coaching session THEN the system SHALL enable both system audio and microphone capture
2. WHEN the interviewer speaks THEN the system SHALL verify that transcriptions are labeled as "Interviewer"
3. WHEN the user speaks THEN the system SHALL verify that transcriptions are labeled as "You"
4. WHEN speakers alternate THEN the system SHALL verify that labels change only at actual speaker boundaries
5. WHEN reviewing session logs THEN the system SHALL confirm consistent speaker attribution throughout entire utterances

### Requirement 12

**User Story:** As a user, I want context injection to trigger only on actual speaker changes, so that AI responses are timely without being overwhelmed by false triggers.

#### Acceptance Criteria

1. WHEN speaker ID changes from `1` to `2` THEN the system SHALL trigger context injection once
2. WHEN speaker ID changes from `2` to `1` THEN the system SHALL trigger context injection once
3. WHEN speaker ID remains constant across multiple fragments THEN the system SHALL NOT trigger context injection
4. WHEN false speaker changes are eliminated THEN context injection frequency SHALL decrease to appropriate levels
5. WHEN context is injected THEN the system SHALL log the speaker change that triggered it with speaker IDs

### Requirement 13

**User Story:** As a developer, I want to update the audio correlation system to work alongside speaker IDs, so that both mechanisms can validate each other.

#### Acceptance Criteria

1. WHEN speaker IDs are available THEN the system SHALL use them as the primary attribution method
2. WHEN audio correlation is available THEN the system SHALL use it to validate speaker ID accuracy
3. WHEN speaker ID and audio correlation disagree THEN the system SHALL log a warning with both values
4. WHEN speaker ID and audio correlation disagree THEN the system SHALL prefer the speaker ID from Gemini
5. WHEN tracking attribution accuracy THEN the system SHALL maintain statistics on agreement between methods

### Requirement 14

**User Story:** As a developer, I want clear documentation of the speaker attribution fix, so that future maintainers understand the implementation.

#### Acceptance Criteria

1. WHEN the fix is implemented THEN the system SHALL include inline comments explaining the `.results` format
2. WHEN the fix is implemented THEN the system SHALL document the speaker ID mapping (1=Interviewer, 2=You)
3. WHEN the fix is implemented THEN the system SHALL document the fallback behavior when speaker IDs are unavailable
4. WHEN the fix is implemented THEN the system SHALL update relevant documentation files with the new behavior
5. WHEN the fix is implemented THEN the system SHALL include examples of expected API response formats

### Requirement 15

**User Story:** As a user, I want speaker attribution to happen in real-time without noticeable delay, so that transcripts appear immediately.

#### Acceptance Criteria

1. WHEN transcription arrives with speaker ID THEN speaker attribution SHALL complete within 10 milliseconds
2. WHEN using fallback correlation THEN attribution SHALL complete within 50 milliseconds
3. WHEN processing multiple fragments THEN the system SHALL maintain less than 100 milliseconds total latency
4. WHEN attribution is delayed THEN the system SHALL log performance warnings
5. WHEN performance degrades THEN the system SHALL identify and log the bottleneck component

### Requirement 16

**User Story:** As a developer, I want speaker attribution logs written to session files, so that I can review them after sessions complete.

#### Acceptance Criteria

1. WHEN speaker attribution occurs THEN the system SHALL write logs to sessionLogger
2. WHEN session ends THEN logs SHALL be saved to the application support directory at `~/Library/Application Support/prism-config/logs`
3. WHEN reviewing logs THEN each entry SHALL include timestamp, speaker ID, speaker label, and transcript preview
4. WHEN errors occur THEN the system SHALL log to both sessionLogger and console
5. WHEN log files exceed 10 megabytes THEN the system SHALL rotate logs to prevent disk space issues

### Requirement 17

**User Story:** As a developer, I want clear guidance on which files to modify, so that implementation is focused and efficient.

#### Acceptance Criteria

1. WHEN implementing the fix THEN the primary modification SHALL be `src/utils/gemini.js` lines 716-731 for transcription handling logic
2. WHEN implementing the fix THEN the configuration modification SHALL be `src/utils/gemini.js` lines 974-978 for API configuration
3. WHEN implementing the fix THEN potential modification SHALL be `src/utils/renderer.js` lines 654-658 for microphone audio submission
4. WHEN modifying files THEN changes SHALL maintain backward compatibility with existing functionality
5. WHEN modifying files THEN changes SHALL be documented with inline comments explaining the speaker ID processing

### Requirement 18

**User Story:** As a developer, I want a safe rollback mechanism if the fix causes issues, so that users are not impacted by bugs.

#### Acceptance Criteria

1. WHEN deploying the fix THEN the system SHALL include a feature flag to enable or disable speaker ID processing
2. WHEN speaker ID processing fails THEN the system SHALL automatically fall back to FIFO correlation
3. WHEN rollback is needed THEN disabling the feature flag SHALL restore previous behavior
4. WHEN testing the fix THEN the system SHALL run both old and new methods in parallel for validation
5. WHEN comparing methods THEN the system SHALL log discrepancies for analysis

### Requirement 19

**User Story:** As a product owner, I want measurable success criteria, so that I can determine if the fix achieves its goals.

#### Acceptance Criteria

1. WHEN measuring speaker attribution accuracy THEN it SHALL exceed 95 percent correctness in test sessions
2. WHEN measuring context injection frequency THEN it SHALL decrease by at least 80 percent compared to current behavior
3. WHEN measuring AI suggestion interruptions THEN they SHALL decrease by at least 90 percent
4. WHEN measuring teleprompt stability THEN suggestion content SHALL remain stable for at least 2 seconds
5. WHEN reviewing user feedback THEN coaching experience satisfaction SHALL increase measurably
