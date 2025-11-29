# Design Document

## Overview

This design addresses the macOS audio capture failure caused by architecture mismatch between the SystemAudioDump binary (arm64) and the host system (x86_64). The solution involves creating a universal binary that supports both Intel and Apple Silicon Macs, implementing architecture detection, improving error diagnostics, and providing fallback mechanisms.

The design follows a layered approach:
1. **Build-time**: Create universal binary with both architectures
2. **Runtime**: Detect system architecture and verify binary compatibility
3. **Error handling**: Provide clear diagnostics for architecture and signing issues
4. **Fallback**: Implement alternative audio capture methods when native binary fails

## Architecture

### Current State

```
┌─────────────────────────────────────┐
│   Electron Main Process (x86_64)    │
│                                     │
│  ┌──────────────────────────────┐  │
│  │   startMacOSAudioCapture()   │  │
│  └──────────┬───────────────────┘  │
│             │ spawn()               │
│             ▼                       │
│  ┌──────────────────────────────┐  │
│  │  SystemAudioDump (arm64)     │  │ ❌ Architecture mismatch
│  │  ❌ Error -86                 │  │
│  └──────────────────────────────┘  │
└─────────────────────────────────────┘
```

### Proposed Architecture

```
┌──────────────────────────────────────────────────────────────┐
│              Electron Main Process (any arch)                 │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │         Audio Capture Manager                          │  │
│  │  - Architecture detection                              │  │
│  │  - Binary verification                                 │  │
│  │  - Error diagnostics                                   │  │
│  │  - Fallback coordination                               │  │
│  └────────┬──────────────────────────────────────────────┘  │
│           │                                                  │
│           ├─────────────┬──────────────┬──────────────────┐ │
│           ▼             ▼              ▼                  │ │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────┐  │ │
│  │  Native    │  │  Web Audio   │  │  desktopCapturer │  │ │
│  │  Binary    │  │  API         │  │  (Electron)      │  │ │
│  │  (Primary) │  │  (Fallback)  │  │  (Fallback)      │  │ │
│  └────────────┘  └──────────────┘  └──────────────────┘  │ │
│                                                            │ │
│  SystemAudioDump Universal Binary:                        │ │
│  ┌──────────────────────────────────────────────────────┐ │ │
│  │  x86_64 slice  │  arm64 slice                        │ │ │
│  │  (Intel Macs)  │  (Apple Silicon)                    │ │ │
│  └──────────────────────────────────────────────────────┘ │ │
└──────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Audio Capture Manager

Central coordinator for all audio capture operations.

```javascript
class AudioCaptureManager {
    constructor() {
        this.currentMethod = null;
        this.systemAudioProc = null;
        this.retryCount = 0;
        this.maxRetries = 3;
    }

    /**
     * Initialize audio capture with automatic method selection
     * @returns {Promise<boolean>} Success status
     */
    async initialize() {
        // Detect system architecture
        // Verify binary compatibility
        // Attempt primary method
        // Fall back if needed
    }

    /**
     * Verify SystemAudioDump binary is compatible
     * @returns {Promise<{compatible: boolean, reason: string}>}
     */
    async verifyBinary() {
        // Check file exists
        // Check architectures available
        // Check code signing
        // Check permissions
    }

    /**
     * Start audio capture using best available method
     * @returns {Promise<void>}
     */
    async start() {}

    /**
     * Stop audio capture and cleanup
     */
    stop() {}

    /**
     * Handle errors with intelligent diagnostics
     * @param {Error} error
     * @returns {string} User-friendly error message
     */
    diagnoseError(error) {}
}
```

### 2. Architecture Detection Module

```javascript
/**
 * Detect system architecture
 * @returns {'x64'|'arm64'} Architecture identifier
 */
function getSystemArchitecture() {
    return process.arch; // 'x64' for Intel, 'arm64' for Apple Silicon
}

/**
 * Check if binary supports required architecture
 * @param {string} binaryPath
 * @param {string} requiredArch
 * @returns {Promise<boolean>}
 */
async function binarySupportsArchitecture(binaryPath, requiredArch) {
    // Use 'lipo -info' to check architectures
    // Parse output to verify required arch is present
}

/**
 * Get all architectures in a binary
 * @param {string} binaryPath
 * @returns {Promise<string[]>} Array of architectures
 */
async function getBinaryArchitectures(binaryPath) {
    // Execute: lipo -info <binaryPath>
    // Parse: "Architectures in the fat file: x86_64 arm64"
    // Or: "Non-fat file: ... is architecture: arm64"
}
```

### 3. Binary Verification Module

```javascript
/**
 * Comprehensive binary verification
 * @param {string} binaryPath
 * @returns {Promise<VerificationResult>}
 */
async function verifySystemAudioDump(binaryPath) {
    const result = {
        exists: false,
        executable: false,
        architectures: [],
        supportsCurrentArch: false,
        signed: false,
        signatureValid: false,
        errors: [],
    };

    // Check existence
    // Check permissions
    // Check architectures
    // Check code signature
    // Return comprehensive result
}

/**
 * Check code signature status
 * @param {string} binaryPath
 * @returns {Promise<SignatureInfo>}
 */
async function checkCodeSignature(binaryPath) {
    // Execute: codesign -dv <binaryPath>
    // Parse signature information
    // Return signing status
}
```

### 4. Error Diagnostics Module

```javascript
/**
 * Diagnose spawn error -86
 * @param {Error} error
 * @param {string} binaryPath
 * @returns {Promise<DiagnosticResult>}
 */
async function diagnoseSpawnError86(error, binaryPath) {
    const diagnosis = {
        cause: 'unknown',
        userMessage: '',
        technicalDetails: '',
        suggestedFix: '',
    };

    // Check architecture mismatch
    // Check code signing
    // Check permissions
    // Check quarantine attributes
    // Generate user-friendly message
}

/**
 * Generate user-friendly error message
 * @param {DiagnosticResult} diagnosis
 * @returns {string}
 */
function formatErrorMessage(diagnosis) {
    // Create clear, actionable error message
    // Include steps to resolve
}
```

### 5. Fallback Audio Capture

```javascript
/**
 * Attempt Web Audio API capture
 * @returns {Promise<boolean>}
 */
async function tryWebAudioCapture() {
    // Use navigator.mediaDevices.getDisplayMedia
    // Configure audio constraints
    // Set up audio processing pipeline
}

/**
 * Attempt Electron desktopCapturer
 * @returns {Promise<boolean>}
 */
async function tryDesktopCapturer() {
    // Use Electron's desktopCapturer API
    // Request audio sources
    // Set up capture stream
}
```

## Data Models

### VerificationResult

```typescript
interface VerificationResult {
    exists: boolean;
    executable: boolean;
    architectures: string[]; // ['x86_64', 'arm64']
    supportsCurrentArch: boolean;
    signed: boolean;
    signatureValid: boolean;
    signatureType: 'adhoc' | 'developer' | 'none';
    errors: string[];
    warnings: string[];
}
```

### DiagnosticResult

```typescript
interface DiagnosticResult {
    cause: 'architecture_mismatch' | 'code_signing' | 'permissions' | 'missing_binary' | 'unknown';
    userMessage: string;
    technicalDetails: string;
    suggestedFix: string;
    canRetry: boolean;
    fallbackAvailable: boolean;
}
```

### SignatureInfo

```typescript
interface SignatureInfo {
    signed: boolean;
    signatureType: 'adhoc' | 'developer' | 'none';
    identifier: string;
    teamId: string | null;
    valid: boolean;
    entitlements: string[];
}
```

### AudioCaptureMethod

```typescript
type AudioCaptureMethod = 'native_binary' | 'web_audio' | 'desktop_capturer' | 'none';

interface AudioCaptureStatus {
    active: boolean;
    method: AudioCaptureMethod;
    startTime: number | null;
    errors: Error[];
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Architecture Compatibility

*For any* system architecture (x86_64 or arm64), when the SystemAudioDump binary is verified, it should contain code for that architecture.

**Validates: Requirements 2.1, 2.3**

### Property 2: Binary Verification Idempotence

*For any* binary path, calling verifySystemAudioDump multiple times should return the same result (assuming the binary hasn't changed).

**Validates: Requirements 5.1**

### Property 3: Error Diagnosis Completeness

*For any* spawn error -86, the diagnosis should identify exactly one root cause (architecture mismatch, code signing, permissions, or missing binary).

**Validates: Requirements 4.1, 5.1**

### Property 4: Fallback Activation

*For any* failed native binary spawn attempt, if fallback methods are available, at least one fallback method should be attempted before giving up.

**Validates: Requirements 7.1, 7.2**

### Property 5: Resource Cleanup

*For any* audio capture session that is started, when it is stopped, all associated resources (processes, file handles, event listeners) should be cleaned up.

**Validates: Requirements 5.2**

### Property 6: Retry Backoff

*For any* sequence of failed capture attempts, the delay between retries should increase exponentially (not constant or random).

**Validates: Requirements 4.5**

### Property 7: Architecture Detection Consistency

*For any* system, the detected architecture from process.arch should match the architecture reported by the operating system.

**Validates: Requirements 2.5**

### Property 8: Permission State Consistency

*For any* permission check, if permissions are granted, subsequent audio capture attempts should not fail due to permission errors.

**Validates: Requirements 6.3**

## Error Handling

### Error Categories

1. **Architecture Mismatch** (Error -86 with incompatible binary)
   - Detect via `lipo -info` check
   - User message: "Audio capture requires a universal binary. Please rebuild the application."
   - Technical: Log detected arch vs available archs
   - Recovery: Attempt fallback methods

2. **Code Signing Issues** (Error -86 with correct architecture)
   - Detect via `codesign -dv` check
   - User message: "Audio capture binary is not properly signed. This may require developer tools."
   - Technical: Log signature status
   - Recovery: Provide instructions for adhoc signing

3. **Missing Binary**
   - Detect via file existence check
   - User message: "Audio capture component is missing. Please reinstall the application."
   - Technical: Log expected path
   - Recovery: Disable audio features gracefully

4. **Permission Denied**
   - Detect via stderr output or specific error codes
   - User message: "Prism needs permission to capture audio. Please grant access in System Settings."
   - Technical: Log permission status
   - Recovery: Provide deep link to system settings

5. **Process Spawn Failure**
   - Detect via spawn error event
   - User message: "Failed to start audio capture. Please try restarting the application."
   - Technical: Log full error details
   - Recovery: Retry with exponential backoff

### Error Handling Flow

```
┌─────────────────────────┐
│  Start Audio Capture    │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  Verify Binary          │
│  - Exists?              │
│  - Executable?          │
│  - Correct arch?        │
│  - Signed?              │
└───────────┬─────────────┘
            │
            ├─── ❌ Failed
            │              │
            │              ▼
            │    ┌──────────────────┐
            │    │  Diagnose Error  │
            │    │  - Architecture? │
            │    │  - Signing?      │
            │    │  - Permissions?  │
            │    └────────┬─────────┘
            │             │
            │             ▼
            │    ┌──────────────────┐
            │    │  Log Diagnostics │
            │    │  Show User Msg   │
            │    └────────┬─────────┘
            │             │
            │             ▼
            │    ┌──────────────────┐
            │    │  Try Fallback    │
            │    │  Methods         │
            │    └────────┬─────────┘
            │             │
            │             ├─── ✅ Success → Continue
            │             │
            │             └─── ❌ Failed → Disable Feature
            │
            ▼
┌─────────────────────────┐
│  Spawn Process          │
└───────────┬─────────────┘
            │
            ├─── ❌ Spawn Error
            │              │
            │              ▼
            │    ┌──────────────────┐
            │    │  Retry Logic     │
            │    │  (Exponential    │
            │    │   Backoff)       │
            │    └────────┬─────────┘
            │             │
            │             ├─── Retry → Back to Spawn
            │             │
            │             └─── Max Retries → Try Fallback
            │
            ▼
┌─────────────────────────┐
│  Monitor Process        │
│  - Audio data received? │
│  - Errors on stderr?    │
│  - Process alive?       │
└─────────────────────────┘
```

### Retry Strategy

```javascript
class RetryStrategy {
    constructor() {
        this.attempts = 0;
        this.maxAttempts = 3;
        this.baseDelay = 1000; // 1 second
        this.maxDelay = 10000; // 10 seconds
    }

    getNextDelay() {
        // Exponential backoff: 1s, 2s, 4s, 8s (capped at 10s)
        const delay = Math.min(this.baseDelay * Math.pow(2, this.attempts), this.maxDelay);
        this.attempts++;
        return delay;
    }

    shouldRetry() {
        return this.attempts < this.maxAttempts;
    }

    reset() {
        this.attempts = 0;
    }
}
```

## Testing Strategy

### Unit Tests

Unit tests will cover specific scenarios and edge cases:

1. **Architecture Detection**
   - Test on Intel Mac (x86_64)
   - Test on Apple Silicon Mac (arm64)
   - Mock process.arch for both architectures

2. **Binary Verification**
   - Test with missing binary
   - Test with non-executable binary
   - Test with single-architecture binary
   - Test with universal binary
   - Test with unsigned binary
   - Test with adhoc-signed binary

3. **Error Diagnosis**
   - Test error -86 with architecture mismatch
   - Test error -86 with signing issue
   - Test permission errors
   - Test missing binary errors

4. **Fallback Logic**
   - Test fallback activation when native fails
   - Test fallback method selection
   - Test graceful degradation when all methods fail

5. **Resource Cleanup**
   - Test process cleanup on stop
   - Test cleanup on error
   - Test cleanup on crash

### Property-Based Tests

Property-based tests will use **fast-check** (JavaScript PBT library) to verify universal properties across many random inputs. Each test will run a minimum of 100 iterations.

1. **Property Test: Architecture Compatibility**
   - Generate random binary metadata
   - Verify compatibility check is consistent
   - **Feature: macos-audio-capture-fix, Property 1: Architecture Compatibility**

2. **Property Test: Verification Idempotence**
   - Generate random binary paths
   - Call verification multiple times
   - Verify results are identical
   - **Feature: macos-audio-capture-fix, Property 2: Binary Verification Idempotence**

3. **Property Test: Error Diagnosis Completeness**
   - Generate random error scenarios
   - Verify exactly one cause is identified
   - **Feature: macos-audio-capture-fix, Property 3: Error Diagnosis Completeness**

4. **Property Test: Fallback Activation**
   - Generate random failure scenarios
   - Verify fallback is attempted
   - **Feature: macos-audio-capture-fix, Property 4: Fallback Activation**

5. **Property Test: Resource Cleanup**
   - Generate random capture sessions
   - Start and stop sessions
   - Verify no resource leaks
   - **Feature: macos-audio-capture-fix, Property 5: Resource Cleanup**

6. **Property Test: Retry Backoff**
   - Generate random retry sequences
   - Verify delays increase exponentially
   - **Feature: macos-audio-capture-fix, Property 6: Retry Backoff**

7. **Property Test: Architecture Detection Consistency**
   - Mock different system architectures
   - Verify detection matches OS reports
   - **Feature: macos-audio-capture-fix, Property 7: Architecture Detection Consistency**

8. **Property Test: Permission State Consistency**
   - Generate random permission states
   - Verify capture behavior matches permissions
   - **Feature: macos-audio-capture-fix, Property 8: Permission State Consistency**

### Integration Tests

1. **End-to-End Audio Capture**
   - Start application
   - Initiate audio capture
   - Verify audio data flows to Gemini session
   - Stop capture
   - Verify cleanup

2. **Cross-Architecture Testing**
   - Test on Intel Mac
   - Test on Apple Silicon Mac
   - Verify same behavior on both

3. **Error Recovery Testing**
   - Simulate various failure modes
   - Verify appropriate fallbacks
   - Verify user receives clear messages

### Test Configuration

```javascript
// vitest.config.js additions
export default {
    test: {
        // ... existing config
        testTimeout: 30000, // Audio tests may take longer
        setupFiles: ['./vitest.setup.js'],
    },
};
```

```javascript
// Property-based test configuration
import fc from 'fast-check';

// Configure for 100+ iterations
const pbConfig = {
    numRuns: 100,
    verbose: true,
};
```

## Implementation Notes

### Building Universal Binary

The SystemAudioDump binary needs to be rebuilt as a universal binary. This requires:

1. **Compile for both architectures:**
   ```bash
   # Compile for x86_64
   clang -arch x86_64 -o SystemAudioDump_x86_64 SystemAudioDump.c -framework CoreAudio -framework AudioToolbox
   
   # Compile for arm64
   clang -arch arm64 -o SystemAudioDump_arm64 SystemAudioDump.c -framework CoreAudio -framework AudioToolbox
   ```

2. **Create universal binary:**
   ```bash
   lipo -create SystemAudioDump_x86_64 SystemAudioDump_arm64 -output SystemAudioDump
   ```

3. **Verify:**
   ```bash
   lipo -info SystemAudioDump
   # Should output: "Architectures in the fat file: x86_64 arm64"
   ```

4. **Sign (adhoc for development):**
   ```bash
   codesign --force --deep --sign - SystemAudioDump
   ```

### Build Process Integration

Update `forge.config.js` to include build script:

```javascript
packagerConfig: {
    // ... existing config
    extraResource: ['./src/assets/SystemAudioDump'],
    beforeCopy: [
        (buildPath, electronVersion, platform, arch, callback) => {
            // Verify SystemAudioDump is universal binary
            // Fail build if not
            callback();
        },
    ],
}
```

### Electron Packaging Considerations

- Universal binary must be included in `extraResource`
- Binary must maintain execute permissions in packaged app
- Code signing must be applied during packaging for distribution
- Entitlements must include audio capture permissions

### macOS Permissions

The app requires the following entitlements (in `entitlements.plist`):

```xml
<key>com.apple.security.device.audio-input</key>
<true/>
<key>com.apple.security.device.microphone</key>
<true/>
```

### Fallback Method Priority

1. **Primary**: Native SystemAudioDump binary (best quality, lowest latency)
2. **Fallback 1**: Electron desktopCapturer (good quality, moderate latency)
3. **Fallback 2**: Web Audio API (acceptable quality, higher latency)
4. **Fallback 3**: Graceful degradation (disable audio features, continue with other functionality)

### Performance Considerations

- Binary verification should be cached after first successful check
- Architecture detection is cheap (process.arch) and can be called frequently
- Spawn retries should use exponential backoff to avoid CPU thrashing
- Fallback methods may have higher CPU usage than native binary
- Monitor memory usage when using Web Audio API fallback

### Security Considerations

- Validate binary path before spawning to prevent path traversal
- Verify binary signature before execution in production
- Log all spawn attempts for security auditing
- Sanitize error messages to avoid leaking system information
- Implement rate limiting on spawn attempts to prevent DoS

## Future Enhancements

1. **Automatic Binary Rebuilding**: Script to detect architecture and rebuild binary if needed
2. **Remote Binary Distribution**: Download correct architecture binary on first run
3. **Hybrid Capture**: Use both native and Web Audio simultaneously for redundancy
4. **Quality Metrics**: Monitor audio quality and automatically switch methods if degraded
5. **User Preferences**: Allow users to choose preferred capture method
6. **Diagnostic Tool**: Built-in tool to test audio capture and diagnose issues
