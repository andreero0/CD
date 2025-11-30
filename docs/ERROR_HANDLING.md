# Error Handling and Fallback Methods

This document explains the error diagnosis process, fallback audio capture methods, and provides a comprehensive troubleshooting guide for users and developers.

## Table of Contents

- [Overview](#overview)
- [Error Diagnosis Process](#error-diagnosis-process)
- [Fallback Methods](#fallback-methods)
- [Retry Strategy](#retry-strategy)
- [User Troubleshooting Guide](#user-troubleshooting-guide)
- [Developer Guide](#developer-guide)
- [API Reference](#api-reference)

## Overview

The Prism application implements a robust error handling system for audio capture that:

1. **Detects and diagnoses** specific error conditions
2. **Provides clear, actionable** error messages to users
3. **Automatically retries** with exponential backoff
4. **Falls back** to alternative capture methods when native binary fails
5. **Logs detailed information** for debugging

### Error Handling Flow

```
┌─────────────────────────┐
│  Start Audio Capture    │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  Spawn Native Binary    │
└───────────┬─────────────┘
            │
            ├─── ✅ Success → Monitor Process
            │
            └─── ❌ Error
                     │
                     ▼
            ┌─────────────────────┐
            │  Diagnose Error     │
            │  - Architecture?    │
            │  - Code Signing?    │
            │  - Permissions?     │
            └──────────┬──────────┘
                       │
                       ▼
            ┌─────────────────────┐
            │  Should Retry?      │
            └──────────┬──────────┘
                       │
                       ├─── Yes → Wait (Exponential Backoff) → Retry
                       │
                       └─── No
                                │
                                ▼
                       ┌─────────────────────┐
                       │  Try Fallback #1    │
                       │  (desktopCapturer)  │
                       └──────────┬──────────┘
                                  │
                                  ├─── ✅ Success → Continue
                                  │
                                  └─── ❌ Failed
                                           │
                                           ▼
                                  ┌─────────────────────┐
                                  │  Try Fallback #2    │
                                  │  (Web Audio API)    │
                                  └──────────┬──────────┘
                                             │
                                             ├─── ✅ Success → Continue
                                             │
                                             └─── ❌ Failed → Disable Feature
```

## Error Diagnosis Process

### Error Categories

The system identifies five main error categories:

#### 1. Architecture Mismatch

**Cause:** Binary doesn't support the current system architecture

**Detection:**
- Error code: `ENOEXEC` or errno `-86`
- Binary verification shows `supportsCurrentArch: false`
- System architecture not in binary's architecture list

**User Message:**
```
❌ Audio Capture Error

The audio capture component is not compatible with your system 
architecture (x86_64).

💡 Suggested Fix:
The binary supports: arm64. Please rebuild as a universal binary 
with both x86_64 and arm64 support.

ℹ️  The application will attempt to use alternative audio capture methods.
```

**Technical Details:**
```
Error: spawn ENOEXEC
Error code: ENOEXEC
Error errno: -86
Binary path: /path/to/SystemAudioDump
Current architecture: x86_64
Binary architectures: arm64
Supports current arch: false
```

#### 2. Code Signing Issues

**Cause:** Binary is not signed or has invalid signature

**Detection:**
- Error code: `ENOEXEC` or errno `-86`
- Binary verification shows `signed: false` or `signatureValid: false`
- Architecture is correct but still fails to spawn

**User Message:**
```
❌ Audio Capture Error

The audio capture component has code signing issues.

💡 Suggested Fix:
The binary is not signed. Run: 
codesign --force --deep --sign - "/path/to/SystemAudioDump" 
to apply adhoc signing.

🔄 You can try restarting audio capture after applying the fix.
```

**Technical Details:**
```
Error: spawn ENOEXEC
Signed: false
Signature type: none
Signature valid: false
```

#### 3. Permission Issues

**Cause:** Binary doesn't have execute permissions

**Detection:**
- Binary verification shows `executable: false`
- File exists but can't be executed

**User Message:**
```
❌ Audio Capture Error

The audio capture component does not have execute permissions.

💡 Suggested Fix:
Run: chmod +x "/path/to/SystemAudioDump" to grant execute permissions.

🔄 You can try restarting audio capture after applying the fix.
```

**Technical Details:**
```
Binary exists: true
Binary executable: false
```

#### 4. Missing Binary

**Cause:** Binary file doesn't exist at expected location

**Detection:**
- Binary verification shows `exists: false`

**User Message:**
```
❌ Audio Capture Error

The audio capture component is missing.

💡 Suggested Fix:
Please reinstall the application or rebuild the SystemAudioDump binary.
```

**Technical Details:**
```
Binary exists: false
Binary path: /path/to/SystemAudioDump
```

#### 5. Unknown Errors

**Cause:** Other unexpected errors

**Detection:**
- Binary appears valid but still fails
- May be Gatekeeper or quarantine issues

**User Message:**
```
❌ Audio Capture Error

Audio capture failed for an unknown reason.

💡 Suggested Fix:
The binary appears to be correctly configured. This may be a macOS 
Gatekeeper issue. Try removing quarantine attributes: 
xattr -d com.apple.quarantine "/path/to/SystemAudioDump"

🔄 You can try restarting audio capture after applying the fix.
```

### Diagnosis API

The error diagnostics module (`src/utils/errorDiagnostics.js`) provides two main functions:

#### `diagnoseSpawnError86(error, binaryPath)`

Diagnoses spawn error -86 and determines the root cause.

**Parameters:**
- `error` (Error): The spawn error
- `binaryPath` (string): Path to the binary that failed

**Returns:** `Promise<DiagnosticResult>`

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

**Example:**
```javascript
const { diagnoseSpawnError86 } = require('./utils/errorDiagnostics');

try {
    // Attempt to spawn binary
    spawn('/path/to/SystemAudioDump');
} catch (error) {
    if (error.errno === -86) {
        const diagnosis = await diagnoseSpawnError86(error, '/path/to/SystemAudioDump');
        console.log(diagnosis.userMessage);
        console.log(diagnosis.suggestedFix);
    }
}
```

#### `formatErrorMessage(diagnosis)`

Formats a user-friendly error message from diagnostic result.

**Parameters:**
- `diagnosis` (DiagnosticResult): The diagnostic result

**Returns:** `string` - Formatted error message

**Example:**
```javascript
const { formatErrorMessage } = require('./utils/errorDiagnostics');

const diagnosis = await diagnoseSpawnError86(error, binaryPath);
const message = formatErrorMessage(diagnosis);

// Display to user
console.log(message);
// or send to renderer process
mainWindow.webContents.send('audio-error', message);
```

## Fallback Methods

When the native SystemAudioDump binary fails, the application automatically tries alternative audio capture methods in priority order.

### Fallback Priority

1. **Native Binary** (Primary) - Best quality, lowest latency
2. **Electron desktopCapturer** (Fallback #1) - Good quality, moderate latency
3. **Web Audio API** (Fallback #2) - Acceptable quality, higher latency
4. **Graceful Degradation** (Fallback #3) - Disable audio features

### Method 1: Electron desktopCapturer

**Module:** `src/utils/fallbackAudioCapture.js`

**Function:** `tryDesktopCapturer(onAudioData)`

**How it works:**
1. Uses Electron's `desktopCapturer.getSources()` to get available sources
2. Filters for screen sources (which include system audio)
3. Creates MediaStream with audio constraints
4. Sets up Web Audio API processing pipeline
5. Converts audio to PCM format and calls callback

**Advantages:**
- Built into Electron, no external dependencies
- Good audio quality
- Moderate latency

**Disadvantages:**
- Requires screen capture permission
- May not work on all systems
- Slightly higher CPU usage than native binary

**Example:**
```javascript
const { tryDesktopCapturer } = require('./utils/fallbackAudioCapture');

const result = await tryDesktopCapturer((audioData) => {
    // Process audio data
    console.log(`Received ${audioData.length} bytes of audio`);
});

if (result.success) {
    console.log('✅ desktopCapturer audio capture started');
    // Store resources for cleanup
    const { stream, audioContext, processor } = result;
} else {
    console.error('❌ desktopCapturer failed:', result.error);
}
```

**Cleanup:**
```javascript
// Stop the stream
if (result.stream) {
    result.stream.getTracks().forEach(track => track.stop());
}

// Close audio context
if (result.audioContext) {
    await result.audioContext.close();
}

// Disconnect processor
if (result.processor) {
    result.processor.disconnect();
}
```

### Method 2: Web Audio API

**Module:** `src/utils/fallbackAudioCapture.js`

**Function:** `tryWebAudioCapture(geminiSessionRef, onAudioData)`

**How it works:**
1. Uses `navigator.mediaDevices.getDisplayMedia()` to capture audio
2. Requires user interaction and permission
3. Sets up Web Audio API processing pipeline
4. Converts audio to PCM format
5. Sends to both callback and Gemini session (if available)

**Advantages:**
- Standard Web API, widely supported
- Can connect directly to Gemini session
- Works when Electron APIs fail

**Disadvantages:**
- Requires user permission prompt
- Higher latency than native methods
- May have quality limitations

**Example:**
```javascript
const { tryWebAudioCapture } = require('./utils/fallbackAudioCapture');

const geminiSessionRef = { current: geminiSession };

const result = await tryWebAudioCapture(geminiSessionRef, (audioData) => {
    // Process audio data
    console.log(`Received ${audioData.length} bytes of audio`);
});

if (result.success) {
    console.log('✅ Web Audio API capture started');
    // Store resources for cleanup
    const { stream, audioContext, processor } = result;
} else {
    console.error('❌ Web Audio API failed:', result.error);
}
```

**Cleanup:**
```javascript
// Same as desktopCapturer cleanup
if (result.stream) {
    result.stream.getTracks().forEach(track => track.stop());
}
if (result.audioContext) {
    await result.audioContext.close();
}
if (result.processor) {
    result.processor.disconnect();
}
```

### Fallback Integration

The `AudioCaptureManager` automatically handles fallback methods:

```javascript
const AudioCaptureManager = require('./utils/audioCaptureManager');

const manager = new AudioCaptureManager();

try {
    // Automatically tries native binary first, then fallbacks
    await manager.start(geminiSessionRef, onAudioData);
    
    // Check which method is being used
    const status = manager.getStatus();
    console.log(`Using method: ${status.method}`);
    // Possible values: 'native_binary', 'desktop_capturer', 'web_audio', 'none'
    
} catch (error) {
    console.error('All audio capture methods failed:', error);
}
```

## Retry Strategy

The retry strategy implements exponential backoff to avoid rapid retry loops.

### Configuration

**Module:** `src/utils/retryStrategy.js`

**Default Settings:**
- Max attempts: 3
- Base delay: 1000ms (1 second)
- Max delay: 10000ms (10 seconds)

**Delay Sequence:**
- Attempt 1: 1 second
- Attempt 2: 2 seconds
- Attempt 3: 4 seconds
- Attempt 4: 8 seconds
- Attempt 5+: 10 seconds (capped)

### Usage

```javascript
const RetryStrategy = require('./utils/retryStrategy');

const retry = new RetryStrategy({
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000
});

async function attemptOperation() {
    while (retry.shouldRetry()) {
        try {
            // Attempt operation
            await doSomething();
            
            // Success - reset retry counter
            retry.reset();
            return;
            
        } catch (error) {
            console.error(`Attempt ${retry.getAttemptCount() + 1} failed:`, error);
            
            if (retry.shouldRetry()) {
                const delay = retry.getNextDelay();
                console.log(`Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                console.error('Max retries exceeded');
                throw error;
            }
        }
    }
}
```

### API

#### `constructor(options)`

Creates a new RetryStrategy instance.

**Options:**
- `maxAttempts` (number): Maximum retry attempts (default: 3)
- `baseDelay` (number): Base delay in milliseconds (default: 1000)
- `maxDelay` (number): Maximum delay in milliseconds (default: 10000)

#### `getNextDelay()`

Returns the next delay duration and increments attempt counter.

**Returns:** `number` - Delay in milliseconds

**Formula:** `min(baseDelay * 2^attempts, maxDelay)`

#### `shouldRetry()`

Checks if another retry attempt should be made.

**Returns:** `boolean` - True if more attempts available

#### `reset()`

Resets the retry counter to start fresh.

#### `getAttemptCount()`

Gets the current attempt count.

**Returns:** `number` - Current number of attempts

## User Troubleshooting Guide

### Quick Fixes

#### Problem: Audio capture not working

**Step 1: Check system requirements**
- macOS 10.15 (Catalina) or later
- Audio input permissions granted

**Step 2: Restart the application**
```bash
# Quit the app completely
# Relaunch from Applications folder
```

**Step 3: Check permissions**
```bash
# Open System Settings
# Go to Privacy & Security → Microphone
# Ensure Prism is enabled
```

**Step 4: Check logs**
```bash
# View application logs
# Look for error messages starting with "❌"
```

### Common Error Messages

#### "Audio capture component is not compatible with your system architecture"

**What it means:** The binary doesn't support your Mac's processor type

**Solution:**
1. Check if you're using the latest version of Prism
2. If building from source, rebuild the binary as universal:
   ```bash
   npm run build:binary
   ```
3. Contact support if the issue persists

#### "Audio capture component has code signing issues"

**What it means:** macOS is blocking the binary due to security settings

**Solution:**
1. Open Terminal
2. Run:
   ```bash
   codesign --force --deep --sign - "/Applications/Prism.app/Contents/Resources/SystemAudioDump"
   ```
3. Restart Prism

#### "Audio capture component does not have execute permissions"

**What it means:** The binary file can't be executed

**Solution:**
1. Open Terminal
2. Run:
   ```bash
   chmod +x "/Applications/Prism.app/Contents/Resources/SystemAudioDump"
   ```
3. Restart Prism

#### "Audio capture component is missing"

**What it means:** The binary file is not found

**Solution:**
1. Reinstall Prism from the official download
2. If building from source, ensure the binary is built:
   ```bash
   npm run build:binary
   ```

### Fallback Mode

If you see a message like "Using alternative audio capture method", the application is running in fallback mode.

**What this means:**
- Native binary failed but alternative method succeeded
- Audio capture is working but may have slightly different quality/latency
- No action needed unless you want to fix the native binary

**To return to native mode:**
1. Fix the underlying issue (see error message)
2. Restart the application
3. Native binary will be tried first

### Getting Help

If you continue to experience issues:

1. **Check logs:**
   - macOS: `~/Library/Logs/Prism/`
   - Look for files with recent timestamps

2. **Run diagnostics:**
   ```bash
   # From project directory
   node verify-binary.js
   ```

3. **Report issue:**
   - Include error messages from logs
   - Include output from diagnostic script
   - Specify your macOS version and Mac model

## Developer Guide

### Implementing Custom Error Handling

```javascript
const AudioCaptureManager = require('./utils/audioCaptureManager');

const manager = new AudioCaptureManager({
    maxRetries: 5  // Custom retry limit
});

// Initialize with error handling
try {
    const initialized = await manager.initialize();
    
    if (!initialized) {
        console.error('Initialization failed');
        // Handle initialization failure
        return;
    }
    
    // Start capture
    await manager.start(geminiSessionRef, (audioData) => {
        // Process audio data
    });
    
} catch (error) {
    // Get user-friendly error message
    const userMessage = await manager.diagnoseError(error);
    
    // Display to user
    showErrorDialog(userMessage);
    
    // Log technical details
    console.error('Audio capture error:', error);
    console.error('Stack:', error.stack);
}
```

### Custom Fallback Methods

Add custom fallback methods to the manager:

```javascript
const manager = new AudioCaptureManager();

// Add custom fallback method
manager.fallbackMethods.push({
    name: 'custom_method',
    description: 'My custom audio capture',
    method: async (onAudioData) => {
        try {
            // Implement custom capture logic
            const stream = await myCustomCapture();
            
            // Set up audio processing
            // ...
            
            return {
                success: true,
                stream: stream,
                error: null
            };
        } catch (error) {
            return {
                success: false,
                stream: null,
                error: error
            };
        }
    }
});
```

### Monitoring Audio Capture

```javascript
const manager = new AudioCaptureManager();

// Start capture
await manager.start(geminiSessionRef, onAudioData);

// Monitor status
setInterval(() => {
    const status = manager.getStatus();
    
    console.log('Audio Capture Status:');
    console.log(`  Active: ${status.active}`);
    console.log(`  Method: ${status.method}`);
    console.log(`  Uptime: ${Date.now() - status.startTime}ms`);
    console.log(`  Errors: ${status.errors.length}`);
}, 5000);

// Check permissions
const permissions = await manager.checkPermissions();
console.log('Permission status:', permissions.state);
```

### Testing Error Scenarios

```javascript
// Test architecture mismatch
const mockError = new Error('spawn ENOEXEC');
mockError.code = 'ENOEXEC';
mockError.errno = -86;

const diagnosis = await diagnoseSpawnError86(mockError, '/path/to/binary');
console.log('Diagnosis:', diagnosis);

// Test retry strategy
const retry = new RetryStrategy({ maxAttempts: 3 });

for (let i = 0; i < 5; i++) {
    if (retry.shouldRetry()) {
        const delay = retry.getNextDelay();
        console.log(`Attempt ${i + 1}, delay: ${delay}ms`);
    } else {
        console.log('Max retries reached');
        break;
    }
}
```

## API Reference

### errorDiagnostics.js

#### `diagnoseSpawnError86(error, binaryPath, options?)`

Diagnoses spawn error -86 and determines root cause.

**Parameters:**
- `error` (Error): The spawn error
- `binaryPath` (string): Path to the binary
- `options` (Object, optional): Testing options

**Returns:** `Promise<DiagnosticResult>`

#### `formatErrorMessage(diagnosis)`

Formats user-friendly error message.

**Parameters:**
- `diagnosis` (DiagnosticResult): Diagnostic result

**Returns:** `string` - Formatted message

### fallbackAudioCapture.js

#### `tryDesktopCapturer(onAudioData)`

Attempts audio capture using Electron's desktopCapturer.

**Parameters:**
- `onAudioData` (Function): Callback for audio data

**Returns:** `Promise<{success, stream, audioContext, processor, error}>`

#### `tryWebAudioCapture(geminiSessionRef, onAudioData)`

Attempts audio capture using Web Audio API.

**Parameters:**
- `geminiSessionRef` (Object): Reference to Gemini session
- `onAudioData` (Function): Callback for audio data

**Returns:** `Promise<{success, stream, audioContext, processor, error}>`

### retryStrategy.js

#### `constructor(options)`

Creates new RetryStrategy instance.

**Options:**
- `maxAttempts` (number): Max retry attempts
- `baseDelay` (number): Base delay in ms
- `maxDelay` (number): Max delay in ms

#### `getNextDelay()`

Returns next delay duration.

**Returns:** `number` - Delay in milliseconds

#### `shouldRetry()`

Checks if more retries available.

**Returns:** `boolean`

#### `reset()`

Resets retry counter.

#### `getAttemptCount()`

Gets current attempt count.

**Returns:** `number`

## See Also

- [Architecture Detection and Verification](./ARCHITECTURE_DETECTION.md) - Understanding architecture detection
- [Building Universal Binary](./BUILD_UNIVERSAL_BINARY.md) - Instructions for building the binary
- [Audio Capture Manager](../src/utils/audioCaptureManager.js) - Main audio capture coordinator
