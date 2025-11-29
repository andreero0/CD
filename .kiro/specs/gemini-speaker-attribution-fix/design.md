# Design Document

## Overview

This design addresses the critical speaker attribution failure in the Gemini Live API integration. The system is configured with speaker diarization enabled (`enableSpeakerDiarization: true`, `minSpeakerCount: 2`, `maxSpeakerCount: 2`), but Gemini returns transcriptions in a format that lacks speaker identification data. Instead of receiving structured results with `speakerId` fields, the API returns simple text strings, forcing the system to rely on unreliable FIFO audio chunk correlation.

The current fallback mechanism assumes a 1:1 mapping between audio chunks and transcription fragments, which breaks down when Gemini sends multiple fragments per utterance or batches transcriptions. This causes rapid speaker label oscillation, excessive context injection (multiple times per second), interrupted AI suggestions, and unstable teleprompt content.

This design implements a robust solution that:
1. Investigates why Gemini returns the wrong format and attempts to fix the configuration
2. Implements proper handling of speaker IDs when available in the `.results` array format
3. Enhances the fallback FIFO correlation mechanism to be more resilient
4. Adds comprehensive logging and validation to diagnose attribution accuracy
5. Provides a feature flag for safe deployment and rollback

## Architecture

### Current Architecture

```
┌─────────────────┐         ┌──────────────────┐
│  System Audio   │────────▶│  Gemini Live API │
│  (Interviewer)  │         │                  │
└─────────────────┘         │  Diarization:    │
                            │  - enabled: true │
┌─────────────────┐         │  - speakers: 2   │
│  Microphone     │────────▶│                  │
│  (User)         │         └──────────────────┘
└─────────────────┘                  │
                                     │ Returns: { text: "..." }
                                     │ (Missing speakerId!)
                                     ▼
                            ┌──────────────────┐
                            │ FIFO Correlation │
                            │ (Unreliable)     │
                            └──────────────────┘
                                     │
                                     ▼
                            ┌──────────────────┐
                            │ Speaker Labels   │
                            │ (Incorrect)      │
                            └──────────────────┘
```

### Target Architecture

```
┌─────────────────┐         ┌──────────────────┐
│  System Audio   │────────▶│  Gemini Live API │
│  (Interviewer)  │         │                  │
└─────────────────┘         │  Diarization:    │
                            │  - enabled: true │
┌─────────────────┐         │  - speakers: 2   │
│  Microphone     │────────▶│  - [config fix]  │
│  (User)         │         └──────────────────┘
└─────────────────┘                  │
                                     │ Returns: { results: [
                                     │   { transcript: "...", speakerId: 1 }
                                     │ ]}
                                     ▼
                            ┌──────────────────┐
                            │ Speaker ID       │
                            │ Processor        │
                            │ (Primary)        │
                            └──────────────────┘
                                     │
                                     ├─────────────────┐
                                     │                 │
                                     ▼                 ▼
                            ┌──────────────┐  ┌──────────────┐
                            │ Speaker      │  │ FIFO         │
                            │ Labels       │  │ Validation   │
                            │ (Accurate)   │  │ (Backup)     │
                            └──────────────┘  └──────────────┘
```

## Components and Interfaces

### 1. Speaker ID Processor (New)

**Purpose**: Extract and process speaker IDs from Gemini's `.results` array format

**Location**: `src/utils/gemini.js` (lines 716-731 modification)

**Interface**:
```javascript
/**
 * Processes transcription with speaker ID support
 * @param {Object} inputTranscription - The serverContent.inputTranscription object
 * @returns {Array<{transcript: string, speakerId: number, speaker: string}>}
 */
function processTranscriptionWithSpeakerID(inputTranscription) {
    const fragments = [];
    
    // Primary: Check for .results array (speaker diarization format)
    if (inputTranscription.results && Array.isArray(inputTranscription.results)) {
        for (const result of inputTranscription.results) {
            if (result.transcript && result.speakerId) {
                fragments.push({
                    transcript: result.transcript,
                    speakerId: result.speakerId,
                    speaker: mapSpeakerIdToLabel(result.speakerId)
                });
            }
        }
        return fragments;
    }
    
    // Fallback: Simple text format (no speaker ID)
    if (inputTranscription.text) {
        const speaker = determineSpeakerFromCorrelation();
        fragments.push({
            transcript: inputTranscription.text,
            speakerId: null,
            speaker: speaker
        });
    }
    
    return fragments;
}

/**
 * Maps Gemini speaker IDs to human-readable labels
 * @param {number} speakerId - Speaker ID from Gemini (1 or 2)
 * @returns {string} Speaker label ("Interviewer" or "You")
 */
function mapSpeakerIdToLabel(speakerId) {
    // speakerId: 1 = system audio (interviewer)
    // speakerId: 2 = microphone (user)
    return speakerId === 1 ? 'Interviewer' : 'You';
}
```

### 2. Configuration Investigator (New)

**Purpose**: Diagnose and fix API configuration to enable `.results` format

**Location**: `src/utils/gemini.js` (lines 974-978 modification)

**Interface**:
```javascript
/**
 * Enhanced configuration with additional parameters for speaker diarization
 * @returns {Object} Gemini session configuration
 */
function buildGeminiConfig() {
    return {
        responseModalities: ['TEXT'],
        tools: enabledTools,
        inputAudioTranscription: {
            enableSpeakerDiarization: true,
            minSpeakerCount: 2,
            maxSpeakerCount: 2,
            // Potential additional parameters to investigate:
            // model: 'gemini-live-2.5-flash-preview',
            // language: 'en-US',
            // enableAutomaticPunctuation: true,
            // enableWordTimeOffsets: false
        },
        contextWindowCompression: { slidingWindow: {} },
        speechConfig: { languageCode: language },
        systemInstruction: {
            parts: [{ text: systemPrompt }],
        },
    };
}
```

### 3. Enhanced FIFO Correlation (Modified)

**Purpose**: Improve fallback speaker attribution when speaker IDs are unavailable

**Location**: `src/utils/gemini.js` (existing `determineSpeakerFromCorrelation` function)

**Interface**:
```javascript
/**
 * Enhanced speaker correlation with better resilience
 * @param {string} transcript - The transcript text for context
 * @returns {string} Speaker label ("Interviewer" or "You")
 */
function determineSpeakerFromCorrelation(transcript = '') {
    // Try to match with oldest untracked chunk in queue
    if (audioChunkQueue.length > 0) {
        const oldestChunk = audioChunkQueue.shift();
        const speaker = oldestChunk.source === 'system' ? 'Interviewer' : 'You';

        sessionLogger.log('SpeakerAttribution', {
            method: 'FIFO_correlation',
            source: oldestChunk.source,
            speaker: speaker,
            queueRemaining: audioChunkQueue.length,
            transcriptPreview: transcript.substring(0, 50)
        });

        return speaker;
    }

    // Enhanced fallback: use last known speaker if available
    if (previousSpeaker) {
        sessionLogger.log('SpeakerAttribution', {
            method: 'previous_speaker_fallback',
            speaker: previousSpeaker,
            reason: 'queue_empty'
        });
        return previousSpeaker;
    }

    // Final fallback: default to 'You'
    sessionLogger.log('SpeakerAttribution', {
        method: 'default_fallback',
        speaker: 'You',
        reason: 'no_history'
    });
    return 'You';
}
```

### 4. Speaker Attribution Validator (New)

**Purpose**: Compare speaker ID results with FIFO correlation for accuracy validation

**Location**: `src/utils/gemini.js` (new function)

**Interface**:
```javascript
/**
 * Validates speaker ID against FIFO correlation
 * @param {number} speakerId - Speaker ID from Gemini
 * @param {string} transcript - Transcript text
 * @returns {Object} Validation result with agreement status
 */
function validateSpeakerAttribution(speakerId, transcript) {
    const speakerIdLabel = mapSpeakerIdToLabel(speakerId);
    const correlationLabel = determineSpeakerFromCorrelation(transcript);
    
    const agreement = speakerIdLabel === correlationLabel;
    
    if (!agreement) {
        sessionLogger.log('SpeakerValidation', {
            speakerId: speakerId,
            speakerIdLabel: speakerIdLabel,
            correlationLabel: correlationLabel,
            agreement: false,
            transcriptPreview: transcript.substring(0, 50)
        });
    }
    
    // Update attribution accuracy statistics
    attributionStats.total++;
    if (agreement) {
        attributionStats.agreements++;
    } else {
        attributionStats.disagreements++;
    }
    
    return {
        agreement,
        speakerIdLabel,
        correlationLabel,
        accuracy: (attributionStats.agreements / attributionStats.total) * 100
    };
}
```

### 5. Feature Flag Manager (New)

**Purpose**: Enable safe deployment and rollback of speaker ID processing

**Location**: `src/utils/gemini.js` (new configuration)

**Interface**:
```javascript
// Feature flags for speaker attribution
const FEATURE_FLAGS = {
    USE_SPEAKER_ID: process.env.ENABLE_SPEAKER_ID !== 'false', // Default: enabled
    VALIDATE_WITH_CORRELATION: true, // Run both methods for comparison
    LOG_ATTRIBUTION_DETAILS: true, // Detailed logging
    FALLBACK_ON_DISAGREEMENT: false // Use correlation if methods disagree
};

/**
 * Determines speaker using configured attribution method
 * @param {Object} transcriptionData - Full transcription object
 * @returns {string} Speaker label
 */
function determineSpeaker(transcriptionData) {
    if (FEATURE_FLAGS.USE_SPEAKER_ID && transcriptionData.speakerId) {
        const speakerIdLabel = mapSpeakerIdToLabel(transcriptionData.speakerId);
        
        if (FEATURE_FLAGS.VALIDATE_WITH_CORRELATION) {
            const validation = validateSpeakerAttribution(
                transcriptionData.speakerId,
                transcriptionData.transcript
            );
            
            if (!validation.agreement && FEATURE_FLAGS.FALLBACK_ON_DISAGREEMENT) {
                return validation.correlationLabel;
            }
        }
        
        return speakerIdLabel;
    }
    
    // Fallback to FIFO correlation
    return determineSpeakerFromCorrelation(transcriptionData.transcript);
}
```

### 6. Session Logger Integration (Modified)

**Purpose**: Comprehensive logging of speaker attribution decisions

**Location**: `src/utils/sessionLogger.js` (existing, enhanced usage)

**Interface**:
```javascript
// Enhanced logging categories
sessionLogger.log('SpeakerAttribution', {
    timestamp: Date.now(),
    method: 'speaker_id' | 'FIFO_correlation' | 'fallback',
    speakerId: number | null,
    speaker: string,
    transcriptPreview: string,
    queueSize: number,
    confidence: 'high' | 'medium' | 'low'
});

sessionLogger.log('SpeakerValidation', {
    timestamp: Date.now(),
    speakerId: number,
    speakerIdLabel: string,
    correlationLabel: string,
    agreement: boolean,
    accuracy: number
});

sessionLogger.log('ContextInjection', {
    timestamp: Date.now(),
    trigger: 'speaker_change' | 'timeout',
    previousSpeaker: string,
    currentSpeaker: string,
    bufferLength: number
});
```

## Data Models

### Transcription Fragment

```javascript
{
    transcript: string,      // The transcribed text
    speakerId: number | null, // Speaker ID from Gemini (1 or 2), null if unavailable
    speaker: string,         // Human-readable label ("Interviewer" or "You")
    timestamp: number,       // When this fragment was received
    method: string          // Attribution method used ("speaker_id", "correlation", "fallback")
}
```

### Audio Chunk Descriptor

```javascript
{
    source: 'system' | 'mic', // Audio source type
    timestamp: number,        // When chunk was sent to Gemini
    correlationId: string     // Unique identifier for tracking
}
```

### Attribution Statistics

```javascript
{
    total: number,           // Total attributions performed
    agreements: number,      // Times speaker ID and correlation agreed
    disagreements: number,   // Times they disagreed
    speakerIdUsed: number,   // Times speaker ID was available
    correlationUsed: number, // Times fallback was used
    accuracy: number         // Percentage agreement
}
```

### Speaker Change Event

```javascript
{
    previousSpeaker: string,  // Previous speaker label
    currentSpeaker: string,   // New speaker label
    timestamp: number,        // When change occurred
    trigger: string,          // What triggered detection ("speaker_id", "correlation")
    confidence: string        // Confidence level ("high", "medium", "low")
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Configuration Validation Completeness
*For any* Gemini session initialization, all required diarization parameters (`enableSpeakerDiarization`, `minSpeakerCount`, `maxSpeakerCount`) must be present and correctly set in the configuration object.
**Validates: Requirements 1.1, 1.2, 1.3**

### Property 2: Audio Stream Delivery Consistency
*For any* captured audio chunk (system or microphone), the audio data must be successfully sent to Gemini with correct source identification and format metadata.
**Validates: Requirements 2.1, 2.2, 2.3, 2.5**

### Property 3: Speaker ID Extraction Accuracy
*For any* transcription response containing a `.results` array, all result objects with both `transcript` and `speakerId` fields must be successfully extracted and processed.
**Validates: Requirements 4.1, 4.2, 4.3, 8.2, 8.3**

### Property 4: Speaker ID Mapping Consistency
*For any* speaker ID value from Gemini, the mapping to speaker labels must be deterministic: `speakerId === 1` always maps to "Interviewer" and `speakerId === 2` always maps to "You".
**Validates: Requirements 4.4, 4.5, 8.4, 8.5**

### Property 5: Utterance Speaker Stability
*For any* sequence of transcript fragments belonging to the same utterance (same speaker ID), the speaker label must remain constant throughout the entire sequence.
**Validates: Requirements 4.6, 5.1, 5.2, 5.3**

### Property 6: Context Injection Trigger Precision
*For any* sequence of transcription fragments, context injection should trigger exactly once per actual speaker ID change, not on every fragment.
**Validates: Requirements 5.4, 6.1, 6.2, 12.1, 12.2, 12.3**

### Property 7: Fallback Mechanism Activation
*For any* transcription response lacking the `.results` array format, the system must automatically activate FIFO correlation as the fallback attribution method.
**Validates: Requirements 7.1, 8.6, 8.7**

### Property 8: Attribution Method Priority
*For any* transcription with available speaker IDs, the speaker ID method must be used as the primary attribution source, with FIFO correlation serving only as validation.
**Validates: Requirements 13.1, 13.2, 13.4**

### Property 9: Edge Case Graceful Handling
*For any* malformed or incomplete transcription data (empty text, missing speaker ID, unexpected values), the system must continue operation without crashing and log appropriate warnings.
**Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5**

### Property 10: Attribution Performance Bounds
*For any* transcription fragment, speaker attribution processing must complete within defined latency thresholds (10ms for speaker ID, 50ms for correlation).
**Validates: Requirements 15.1, 15.2, 15.3**

### Property 11: Logging Completeness
*For any* speaker attribution decision, the system must write a log entry containing timestamp, method used, speaker ID (if available), speaker label, and transcript preview.
**Validates: Requirements 9.1, 9.2, 9.3, 9.4, 16.1, 16.3**

### Property 12: Feature Flag Rollback Safety
*For any* feature flag state change, disabling speaker ID processing must immediately restore FIFO correlation behavior without requiring application restart.
**Validates: Requirements 18.1, 18.2, 18.3**

## Error Handling

### Configuration Errors

**Scenario**: Gemini API configuration is incomplete or incorrect
- **Detection**: Validate configuration object before session initialization
- **Response**: Log detailed error with missing parameters, attempt to apply defaults, notify user if session cannot start
- **Recovery**: Fall back to minimal configuration or previous working configuration
- **Logging**: Log complete configuration object and validation errors to sessionLogger

**Scenario**: API version or endpoint is incorrect
- **Detection**: Monitor API response format and error codes during session initialization
- **Response**: Log API version mismatch, document the endpoint being used
- **Recovery**: Attempt connection with documented endpoint, provide user guidance for manual configuration
- **Logging**: Log API endpoint, version, and response format details

### Transcription Processing Errors

**Scenario**: Transcription response is malformed or missing expected fields
- **Detection**: Check for presence of `.results` or `.text` fields before processing
- **Response**: Log the complete transcription object structure, skip processing of invalid fragments
- **Recovery**: Continue with next transcription, maintain current speaker label
- **Logging**: Log full transcription object with error category "malformed_transcription"

**Scenario**: Speaker ID has unexpected value (not 1 or 2)
- **Detection**: Validate speaker ID range during mapping
- **Response**: Log warning with actual speaker ID value, fall back to correlation method
- **Recovery**: Use FIFO correlation for this fragment, continue monitoring for valid IDs
- **Logging**: Log unexpected speaker ID value and fallback decision

**Scenario**: Empty or whitespace-only transcript text
- **Detection**: Check transcript length and content before processing
- **Response**: Skip processing, do not update speaker state
- **Recovery**: Wait for next valid transcript fragment
- **Logging**: Log skipped fragment with reason "empty_transcript"

### Audio Correlation Errors

**Scenario**: Audio chunk queue is empty when correlation is needed
- **Detection**: Check queue length before attempting to dequeue
- **Response**: Use previous speaker as fallback, log queue state
- **Recovery**: Continue with last known speaker, resume normal correlation when queue repopulates
- **Logging**: Log queue empty condition and fallback speaker used

**Scenario**: Audio chunk source is unrecognized
- **Detection**: Validate source field is 'system' or 'mic'
- **Response**: Log warning with actual source value, default to 'You'
- **Recovery**: Continue processing, investigate source tracking logic
- **Logging**: Log unrecognized source value and default assignment

### Validation Errors

**Scenario**: Speaker ID and correlation methods disagree
- **Detection**: Compare results from both attribution methods
- **Response**: Log disagreement with both values, use speaker ID as primary (unless flag overrides)
- **Recovery**: Continue with configured priority method, track disagreement statistics
- **Logging**: Log both attribution results, agreement status, and accuracy percentage

**Scenario**: Attribution accuracy drops below threshold
- **Detection**: Monitor attribution statistics for accuracy percentage
- **Response**: Log performance warning, consider switching to correlation-only mode
- **Recovery**: Continue operation, alert developers to investigate configuration
- **Logging**: Log accuracy statistics and threshold breach

### Performance Errors

**Scenario**: Attribution latency exceeds threshold
- **Detection**: Measure processing time for each attribution
- **Response**: Log performance warning with actual latency and threshold
- **Recovery**: Continue processing, identify bottleneck component
- **Logging**: Log latency measurement, method used, and performance category

**Scenario**: Log file size exceeds limit
- **Detection**: Check log file size before writing
- **Response**: Rotate logs to new file with timestamp
- **Recovery**: Continue logging to new file, archive old logs
- **Logging**: Log rotation event with old and new file paths

### Feature Flag Errors

**Scenario**: Feature flag state is invalid or corrupted
- **Detection**: Validate flag values on initialization
- **Response**: Reset to default values, log corruption event
- **Recovery**: Use safe defaults (speaker ID enabled, validation enabled)
- **Logging**: Log flag state before and after reset

## Testing Strategy

### Unit Testing

**Framework**: Jest (existing test infrastructure in `src/__tests__/`)

**Test Coverage**:

1. **Speaker ID Mapping Tests**
   - Test `mapSpeakerIdToLabel(1)` returns "Interviewer"
   - Test `mapSpeakerIdToLabel(2)` returns "You"
   - Test invalid speaker IDs (0, 3, null, undefined) trigger fallback
   - Test edge cases: negative numbers, non-integers, strings

2. **Transcription Processing Tests**
   - Test processing `.results` array format with valid speaker IDs
   - Test processing `.text` format triggers fallback
   - Test empty transcription objects
   - Test malformed results (missing transcript or speakerId)
   - Test multiple fragments in single response

3. **FIFO Correlation Tests**
   - Test correlation with populated queue returns correct speaker
   - Test correlation with empty queue uses previous speaker
   - Test correlation with no history defaults to "You"
   - Test queue management (enqueue, dequeue, size tracking)

4. **Feature Flag Tests**
   - Test speaker ID processing enabled/disabled states
   - Test validation mode enabled/disabled
   - Test fallback on disagreement behavior
   - Test flag state changes during runtime

5. **Edge Case Tests**
   - Test empty transcript handling
   - Test missing speaker ID in result
   - Test unexpected speaker ID values
   - Test simultaneous multiple results
   - Test rapid speaker changes

**Test File Location**: `src/__tests__/speakerAttribution.test.js`

### Property-Based Testing

**Framework**: fast-check (to be added to project dependencies)

**Configuration**: Each property test should run a minimum of 100 iterations to ensure comprehensive coverage across random inputs.

**Property Tests**:

1. **Property Test: Configuration Validation Completeness**
   - **Feature: gemini-speaker-attribution-fix, Property 1**
   - Generate random configuration objects with varying completeness
   - Verify all required diarization parameters are validated
   - Ensure incomplete configs are detected and logged

2. **Property Test: Speaker ID Mapping Consistency**
   - **Feature: gemini-speaker-attribution-fix, Property 4**
   - Generate random speaker ID values (valid and invalid)
   - Verify mapping is deterministic: same input always produces same output
   - Verify only IDs 1 and 2 map to valid labels

3. **Property Test: Utterance Speaker Stability**
   - **Feature: gemini-speaker-attribution-fix, Property 5**
   - Generate random sequences of fragments with same speaker ID
   - Verify speaker label remains constant throughout sequence
   - Verify no mid-utterance speaker changes occur

4. **Property Test: Context Injection Trigger Precision**
   - **Feature: gemini-speaker-attribution-fix, Property 6**
   - Generate random sequences of fragments with varying speaker IDs
   - Count context injection triggers
   - Verify triggers equal actual speaker ID changes (not fragment count)

5. **Property Test: Fallback Mechanism Activation**
   - **Feature: gemini-speaker-attribution-fix, Property 7**
   - Generate random transcription responses with and without `.results`
   - Verify fallback activates only when `.results` is absent
   - Verify primary method used when `.results` is present

6. **Property Test: Edge Case Graceful Handling**
   - **Feature: gemini-speaker-attribution-fix, Property 9**
   - Generate random malformed transcription data
   - Verify system continues operation (no crashes)
   - Verify appropriate warnings are logged

7. **Property Test: Logging Completeness**
   - **Feature: gemini-speaker-attribution-fix, Property 11**
   - Generate random attribution scenarios
   - Verify every attribution produces a log entry
   - Verify log entries contain all required fields

**Test File Location**: `src/__tests__/speakerAttribution.property.test.js`

### Integration Testing

**Test Scenarios**:

1. **End-to-End Speaker Attribution Flow**
   - Start coaching session with both audio streams active
   - Simulate interviewer speaking (system audio)
   - Verify transcription labeled as "Interviewer"
   - Simulate user speaking (microphone)
   - Verify transcription labeled as "You"
   - Verify context injection triggers only on speaker changes

2. **Configuration Investigation**
   - Test various configuration parameter combinations
   - Monitor API response format for each configuration
   - Document which configurations produce `.results` format
   - Verify logging captures configuration details

3. **Fallback Mechanism Validation**
   - Force API to return `.text` format (disable diarization)
   - Verify FIFO correlation activates automatically
   - Verify speaker attribution continues functioning
   - Verify appropriate fallback logging occurs

4. **Feature Flag Behavior**
   - Test enabling/disabling speaker ID processing mid-session
   - Verify immediate behavior change without restart
   - Verify rollback to FIFO correlation when disabled
   - Verify validation mode captures disagreements

**Test File Location**: `src/__tests__/speakerAttribution.integration.test.js`

### Manual Testing Checklist

1. **Real Coaching Session Test**
   - Start coaching session with video call
   - Speak as user, verify "You" label
   - Let interviewer speak, verify "Interviewer" label
   - Alternate speakers rapidly, verify labels change correctly
   - Monitor context injection frequency (should be low)
   - Verify AI suggestions complete without interruption
   - Check teleprompt stability (content should not flicker)

2. **Log Review**
   - Complete a 5-minute coaching session
   - Review session logs in `~/Library/Application Support/prism-config/logs`
   - Verify speaker attribution entries are present
   - Check attribution method used (speaker_id vs correlation)
   - Calculate attribution accuracy from logs
   - Verify no error or warning spikes

3. **Performance Validation**
   - Monitor attribution latency during session
   - Verify latency stays within thresholds (10ms/50ms)
   - Check for performance warnings in logs
   - Verify no UI lag or transcript delays

4. **Edge Case Validation**
   - Test with only microphone (no system audio)
   - Test with only system audio (no microphone)
   - Test with rapid speaker changes
   - Test with long monologues (single speaker)
   - Test with overlapping speech
   - Verify graceful handling in all cases

### Success Criteria

The implementation is considered successful when:

1. **Attribution Accuracy**: ≥95% correct speaker labels in test sessions (measured via log analysis)
2. **Context Injection Reduction**: ≥80% decrease in injection frequency compared to baseline
3. **AI Suggestion Stability**: ≥90% reduction in interrupted suggestions
4. **Teleprompt Stability**: Suggestion content remains stable for ≥2 seconds
5. **Performance**: Attribution latency stays within defined thresholds (10ms/50ms)
6. **Reliability**: Zero crashes or unhandled errors during 10+ test sessions
7. **Logging**: 100% of attribution decisions captured in session logs

## 
## Alter
native Approaches (If Speaker IDs Unavailable)

### Voice-Based Speaker Detection

If the Gemini API cannot provide speaker IDs through configuration changes, the following alternative approaches should be considered:

**Approach 1: Audio Energy Level Analysis**
- **Concept**: Analyze audio energy levels from system and microphone streams to determine which source is active
- **Implementation**: Track RMS (Root Mean Square) energy levels for each audio stream, attribute transcription to the stream with higher energy during that time window
- **Pros**: Simple to implement, no external dependencies, works with existing audio capture
- **Cons**: Fails with overlapping speech, requires calibration, unreliable with similar volume levels
- **Requirements Addressed**: 7.2

**Approach 2: Voice Fingerprinting**
- **Concept**: Create acoustic fingerprints for each speaker and match transcriptions to fingerprints
- **Implementation**: Extract MFCC (Mel-Frequency Cepstral Coefficients) or other acoustic features, train simple classifier to distinguish speakers
- **Pros**: More robust than energy levels, can handle overlapping speech better
- **Cons**: Requires training period, computationally expensive, may need external library
- **Requirements Addressed**: 7.3

**Approach 3: Disable Speaker Attribution**
- **Concept**: If no reliable method is available, disable speaker attribution entirely
- **Implementation**: Label all transcriptions as "User" or use a neutral label, focus on transcript accuracy over speaker identification
- **Pros**: Eliminates false attributions, simplifies system
- **Cons**: Loses coaching context, reduces AI suggestion quality
- **Requirements Addressed**: 7.4

**Decision Criteria**:
1. First, exhaust all configuration options to enable Gemini speaker IDs (Requirements 1, 3)
2. If speaker IDs remain unavailable, document the API limitation with version details (Requirement 7.1)
3. Implement enhanced FIFO correlation as interim solution (already designed)
4. If accuracy remains below 80%, implement audio energy level analysis
5. If accuracy remains below 90%, consider voice fingerprinting
6. If no method achieves 90% accuracy, disable speaker attribution and notify user

## Implementation Notes

### File Modifications

**Primary File: `src/utils/gemini.js`**

1. **Lines 716-731: Transcription Handling Logic**
   - Current: Processes `serverContent.inputTranscription.text` directly
   - Change: Add check for `.results` array first, then fall back to `.text`
   - Add: `processTranscriptionWithSpeakerID()` function
   - Add: `mapSpeakerIdToLabel()` function
   - Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6

2. **Lines 974-978: API Configuration**
   - Current: Basic `inputAudioTranscription` configuration
   - Change: Investigate and add additional parameters that might enable `.results` format
   - Test: Different model versions, language codes, additional flags
   - Requirements: 1.1, 1.2, 1.3, 3.1, 3.2, 3.3, 3.4

3. **Existing `determineSpeakerFromCorrelation()` function**
   - Current: Basic FIFO correlation with default fallback
   - Change: Add previous speaker fallback, enhanced logging
   - Add: Transcript context parameter for better logging
   - Requirements: 8.7, 9.4, 10.2

4. **New Functions to Add**:
   - `validateSpeakerAttribution()`: Compare speaker ID with correlation
   - `determineSpeaker()`: Main entry point with feature flag support
   - `initializeAttributionStats()`: Set up statistics tracking
   - Requirements: 13.2, 13.3, 13.4, 13.5, 18.4

**Secondary File: `src/utils/renderer.js`**

1. **Lines 654-658: Microphone Audio Submission**
   - Current: Sends microphone audio via IPC
   - Verify: Audio format and metadata are correct
   - Add: Logging for audio source and data size
   - Requirements: 2.2, 2.3

**Logging File: `src/utils/sessionLogger.js`**

1. **Enhanced Usage (No Code Changes)**
   - Add: New log categories for speaker attribution
   - Add: Structured logging with consistent fields
   - Verify: Logs written to correct directory
   - Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 16.1, 16.2, 16.3, 16.4

### Configuration Investigation Steps

**Step 1: Verify Current Configuration**
- Log complete configuration object on session initialization
- Verify `enableSpeakerDiarization: true`
- Verify `minSpeakerCount: 2` and `maxSpeakerCount: 2`
- Requirements: 1.1, 1.2, 1.3, 3.5

**Step 2: Test Additional Parameters**
- Try adding `model: 'gemini-live-2.5-flash-preview'`
- Try adding `language: 'en-US'`
- Try adding `enableAutomaticPunctuation: true`
- Try adding `enableWordTimeOffsets: false`
- Requirements: 1.7, 3.3, 3.4

**Step 3: Monitor API Responses**
- Log complete structure of every `serverContent.inputTranscription`
- Identify if responses contain `.text`, `.results`, or both
- Document which configuration produces which format
- Requirements: 1.4, 1.5, 9.1

**Step 4: Verify API Version**
- Check Gemini API version being used
- Verify endpoint URL is correct
- Review API documentation for diarization format
- Requirements: 1.6, 3.1

**Step 5: Verify Audio Streams**
- Log when system audio is sent to Gemini
- Log when microphone audio is sent to Gemini
- Verify both streams are active and interleaved
- Verify sample rates and encoding match
- Requirements: 2.1, 2.2, 2.3, 2.4, 2.5

### Feature Flag Configuration

**Environment Variables**:
- `ENABLE_SPEAKER_ID`: Set to 'false' to disable speaker ID processing (default: enabled)
- `VALIDATE_WITH_CORRELATION`: Set to 'false' to skip validation (default: enabled)
- `LOG_ATTRIBUTION_DETAILS`: Set to 'false' to reduce logging (default: enabled)
- `FALLBACK_ON_DISAGREEMENT`: Set to 'true' to use correlation when methods disagree (default: disabled)

**Rollback Procedure**:
1. Set `ENABLE_SPEAKER_ID=false` in environment
2. Restart application
3. System reverts to FIFO correlation only
4. No code changes required
- Requirements: 18.1, 18.2, 18.3

### Performance Considerations

**Latency Targets**:
- Speaker ID processing: ≤10ms per fragment
- FIFO correlation: ≤50ms per fragment
- Total attribution pipeline: ≤100ms
- Requirements: 15.1, 15.2, 15.3

**Optimization Strategies**:
- Cache speaker ID mappings (avoid repeated lookups)
- Use efficient queue data structure for audio chunks
- Minimize logging overhead in hot path
- Defer statistics calculation to background
- Requirements: 15.4, 15.5

**Performance Monitoring**:
- Measure attribution time for each fragment
- Log warnings when thresholds exceeded
- Track average, min, max latencies
- Identify bottleneck components
- Requirements: 15.4, 15.5

### Logging Configuration

**Log Directory**: `~/Library/Application Support/prism-config/logs`
- Requirements: 16.2

**Log Rotation**:
- Maximum file size: 10 MB
- Rotation strategy: Create new file with timestamp suffix
- Archive old logs (keep last 10 files)
- Requirements: 16.5

**Log Entry Format**:
```javascript
{
    timestamp: ISO8601 string,
    category: 'SpeakerAttribution' | 'SpeakerValidation' | 'ContextInjection',
    data: {
        // Category-specific fields
    }
}
```
- Requirements: 16.3

### Documentation Requirements

**Inline Comments**:
- Explain `.results` array format and structure
- Document speaker ID mapping (1=Interviewer, 2=You)
- Describe fallback behavior when speaker IDs unavailable
- Include examples of expected API response formats
- Requirements: 14.1, 14.2, 14.3, 14.5

**Documentation Files**:
- Update relevant docs with new speaker attribution behavior
- Document configuration investigation findings
- Provide troubleshooting guide for attribution issues
- Requirements: 14.4

### Backward Compatibility

**Existing Functionality**:
- All changes must maintain backward compatibility
- FIFO correlation must continue working as fallback
- No breaking changes to public APIs
- Existing tests must continue passing
- Requirements: 17.4

**Migration Path**:
- Feature flag allows gradual rollout
- Both methods can run in parallel for validation
- Easy rollback if issues discovered
- No data migration required
- Requirements: 18.1, 18.3, 18.4

## Design Decisions and Rationales

### Decision 1: Speaker ID as Primary Method

**Rationale**: Speaker IDs from Gemini are the authoritative source since they come directly from the diarization model. FIFO correlation is inherently unreliable due to timing assumptions and batching behavior.

**Trade-offs**: Requires API configuration investigation, but provides significantly higher accuracy and eliminates false speaker changes.

**Requirements Addressed**: 4.1-4.6, 8.1-8.5, 13.1, 13.4

### Decision 2: Feature Flag for Safe Deployment

**Rationale**: Allows testing in production without risk, enables immediate rollback if issues arise, supports A/B testing and gradual rollout.

**Trade-offs**: Adds configuration complexity, but essential for production safety and user trust.

**Requirements Addressed**: 18.1, 18.2, 18.3, 18.4, 18.5

### Decision 3: Dual Method Validation

**Rationale**: Running both speaker ID and correlation methods in parallel provides validation data, helps identify configuration issues, and builds confidence in the new approach.

**Trade-offs**: Slight performance overhead, but invaluable for debugging and accuracy measurement.

**Requirements Addressed**: 13.2, 13.3, 13.5, 19.1

### Decision 4: Enhanced FIFO Correlation Fallback

**Rationale**: Even with speaker IDs, need robust fallback for edge cases, API failures, or if configuration cannot be fixed. Enhanced version with previous speaker memory is more stable than current implementation.

**Trade-offs**: Still not perfect, but significantly better than current behavior and provides safety net.

**Requirements Addressed**: 7.1, 8.6, 8.7, 10.2

### Decision 5: Comprehensive Logging

**Rationale**: Speaker attribution is critical to user experience. Detailed logging enables post-session analysis, accuracy measurement, debugging, and continuous improvement.

**Trade-offs**: Increased log volume, but essential for diagnosing issues and measuring success.

**Requirements Addressed**: 9.1-9.5, 16.1-16.4, 19.1

### Decision 6: Performance Thresholds

**Rationale**: Attribution must be real-time to avoid transcript delays. Thresholds ensure performance monitoring and prevent degradation.

**Trade-offs**: Requires performance measurement overhead, but prevents user-visible latency.

**Requirements Addressed**: 15.1-15.5

### Decision 7: Utterance-Level Speaker Stability

**Rationale**: Mid-utterance speaker changes are always wrong and cause poor user experience. Maintaining speaker consistency across fragments is essential for readability.

**Trade-offs**: May delay speaker change detection slightly, but dramatically improves transcript quality.

**Requirements Addressed**: 4.6, 5.1, 5.2, 5.3

### Decision 8: Context Injection Trigger Reduction

**Rationale**: Current excessive context injection (multiple times per second) interrupts AI suggestions and wastes API calls. Triggering only on actual speaker changes is the root cause fix.

**Trade-offs**: None - this is purely beneficial and addresses core user pain point.

**Requirements Addressed**: 5.4, 6.1, 6.2, 12.1-12.5, 19.2, 19.3

### Decision 9: Graceful Edge Case Handling

**Rationale**: Real-world data is messy. System must handle malformed responses, missing fields, and unexpected values without crashing or degrading user experience.

**Trade-offs**: Adds defensive code, but essential for production reliability.

**Requirements Addressed**: 10.1-10.5

### Decision 10: Measurable Success Criteria

**Rationale**: Need objective metrics to determine if fix achieves goals. Quantitative targets enable data-driven decisions and validate the solution.

**Trade-offs**: Requires measurement infrastructure, but essential for accountability and continuous improvement.

**Requirements Addressed**: 19.1-19.5
