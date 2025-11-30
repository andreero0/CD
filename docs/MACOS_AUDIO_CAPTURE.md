# macOS Audio Capture System Documentation

This is the main documentation hub for the macOS audio capture system in Prism. The system provides robust, cross-architecture audio capture with automatic error handling and fallback mechanisms.

## Documentation Index

### 📖 Core Documentation

1. **[Architecture Detection and Verification](./ARCHITECTURE_DETECTION.md)**
   - How architecture detection works
   - Binary verification process
   - Comprehensive troubleshooting guide
   - API reference for detection modules

2. **[Building Universal Binary](./BUILD_UNIVERSAL_BINARY.md)**
   - Step-by-step build instructions
   - Required tools and prerequisites
   - Verification procedures
   - Integration with Electron

3. **[Error Handling and Fallback Methods](./ERROR_HANDLING.md)**
   - Error diagnosis process
   - Fallback method priority and usage
   - Retry strategy with exponential backoff
   - User and developer troubleshooting guides

## Quick Links

### For Users

- **Having issues?** → [User Troubleshooting Guide](./ERROR_HANDLING.md#user-troubleshooting-guide)
- **Common errors** → [Common Error Messages](./ERROR_HANDLING.md#common-error-messages)
- **Permission issues** → [Permission Troubleshooting](./ARCHITECTURE_DETECTION.md#issue-4-quarantine-attributes)

### For Developers

- **Building the binary** → [Quick Start](./BUILD_UNIVERSAL_BINARY.md#quick-start)
- **API Reference** → [Architecture Detection API](./ARCHITECTURE_DETECTION.md#api-reference)
- **Custom error handling** → [Developer Guide](./ERROR_HANDLING.md#developer-guide)
- **Testing** → [Verification Scripts](./BUILD_UNIVERSAL_BINARY.md#verification)

## System Overview

### Architecture

The audio capture system consists of several layers:

```
┌─────────────────────────────────────────────────────────┐
│                  Application Layer                       │
│                  (Electron Main Process)                 │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              Audio Capture Manager                       │
│  - Coordinates all capture methods                       │
│  - Handles errors and retries                            │
│  - Manages fallback logic                                │
└────────────────────────┬────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│   Native    │  │  Electron   │  │  Web Audio  │
│   Binary    │  │  Desktop    │  │     API     │
│  (Primary)  │  │  Capturer   │  │ (Fallback)  │
└─────────────┘  └─────────────┘  └─────────────┘
```

### Key Components

1. **Architecture Detection** (`src/utils/architectureDetection.js`)
   - Detects system architecture (x86_64 or arm64)
   - Inspects binary architectures using `lipo`
   - Verifies compatibility

2. **Binary Verification** (`src/utils/binaryVerification.js`)
   - Checks file existence and permissions
   - Verifies architecture support
   - Validates code signatures
   - Returns comprehensive verification results

3. **Error Diagnostics** (`src/utils/errorDiagnostics.js`)
   - Diagnoses spawn error -86
   - Identifies root causes
   - Generates user-friendly messages
   - Provides suggested fixes

4. **Audio Capture Manager** (`src/utils/audioCaptureManager.js`)
   - Central coordinator for all audio capture
   - Implements retry logic with exponential backoff
   - Manages fallback methods
   - Handles cleanup and resource management

5. **Fallback Methods** (`src/utils/fallbackAudioCapture.js`)
   - Electron desktopCapturer API
   - Web Audio API with getDisplayMedia
   - Automatic fallback on native failure

6. **Retry Strategy** (`src/utils/retryStrategy.js`)
   - Exponential backoff implementation
   - Configurable retry limits
   - Prevents rapid retry loops

## Quick Start Guide

### For Users

1. **Install Prism** from the official download
2. **Grant permissions** when prompted for audio access
3. **Start audio capture** - the system will automatically:
   - Verify the binary
   - Attempt native capture
   - Fall back to alternatives if needed
   - Show clear error messages if issues occur

### For Developers

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd prism
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the universal binary**
   ```bash
   npm run build:binary
   ```

4. **Verify the binary**
   ```bash
   npm run verify:binary
   ```

5. **Run the application**
   ```bash
   npm start
   ```

## Common Scenarios

### Scenario 1: First-time Setup

**Goal:** Get audio capture working on a new Mac

**Steps:**
1. Install Xcode Command Line Tools (if building from source)
2. Build the universal binary
3. Verify the binary
4. Run the application
5. Grant audio permissions when prompted

**Documentation:**
- [Building Universal Binary](./BUILD_UNIVERSAL_BINARY.md)
- [Verification](./BUILD_UNIVERSAL_BINARY.md#verification)

### Scenario 2: Troubleshooting Error -86

**Goal:** Fix spawn error -86

**Steps:**
1. Check the error message for specific cause
2. Follow the suggested fix in the error message
3. Verify the binary using diagnostic tools
4. Restart the application

**Documentation:**
- [Architecture Mismatch](./ARCHITECTURE_DETECTION.md#issue-1-architecture-mismatch-error--86)
- [Error Diagnosis](./ERROR_HANDLING.md#error-diagnosis-process)

### Scenario 3: Using Fallback Methods

**Goal:** Understand and use fallback audio capture

**Steps:**
1. Native binary fails (automatically detected)
2. System tries Electron desktopCapturer
3. If that fails, tries Web Audio API
4. User sees which method is active

**Documentation:**
- [Fallback Methods](./ERROR_HANDLING.md#fallback-methods)
- [Fallback Priority](./ERROR_HANDLING.md#fallback-priority)

### Scenario 4: Building for Distribution

**Goal:** Prepare binary for App Store or direct distribution

**Steps:**
1. Build universal binary
2. Sign with Developer ID certificate
3. Include proper entitlements
4. Verify signature
5. Test on both Intel and Apple Silicon Macs

**Documentation:**
- [Production Signing](./BUILD_UNIVERSAL_BINARY.md#production-developer-signing)
- [Entitlements](./BUILD_UNIVERSAL_BINARY.md#required-entitlements-entitlementsplist)

## Troubleshooting Decision Tree

```
Audio capture not working?
│
├─ Error -86?
│  │
│  ├─ "Architecture mismatch"
│  │  └─ → Rebuild as universal binary
│  │
│  ├─ "Code signing issues"
│  │  └─ → Apply adhoc or developer signature
│  │
│  ├─ "Permission issues"
│  │  └─ → Run chmod +x on binary
│  │
│  └─ "Unknown cause"
│     └─ → Remove quarantine attributes
│
├─ Binary missing?
│  └─ → Rebuild or reinstall application
│
├─ Permissions denied?
│  └─ → Grant in System Settings → Privacy & Security
│
└─ Other error?
   └─ → Check logs and contact support
```

## Best Practices

### For Users

1. **Keep the app updated** - New versions may include fixes
2. **Grant permissions** - Audio capture requires microphone access
3. **Check logs** - Logs contain detailed error information
4. **Report issues** - Include error messages and system info

### For Developers

1. **Always build universal binaries** - Support both architectures
2. **Verify before packaging** - Use automated verification scripts
3. **Test on both architectures** - Intel and Apple Silicon
4. **Handle errors gracefully** - Use the built-in error handling
5. **Log comprehensively** - Use structured logging for debugging
6. **Implement fallbacks** - Don't rely solely on native binary
7. **Test permission flows** - Ensure permission requests work correctly

## Testing Checklist

### Pre-Release Testing

- [ ] Binary is universal (contains x86_64 and arm64)
- [ ] Binary has execute permissions
- [ ] Binary is properly signed
- [ ] Verification script passes
- [ ] Audio capture works on Intel Mac
- [ ] Audio capture works on Apple Silicon Mac
- [ ] Error messages are clear and actionable
- [ ] Fallback methods work when native fails
- [ ] Retry logic works correctly
- [ ] Cleanup happens on stop
- [ ] Permissions are requested correctly
- [ ] Logs contain useful information

### User Acceptance Testing

- [ ] First-time setup is smooth
- [ ] Permission prompts are clear
- [ ] Audio capture starts quickly
- [ ] Error messages are helpful
- [ ] Fallback mode works transparently
- [ ] Application recovers from errors
- [ ] Performance is acceptable

## Support and Resources

### Getting Help

1. **Check documentation** - Start with this guide
2. **Run diagnostics** - Use built-in verification tools
3. **Check logs** - Look for error messages
4. **Search issues** - Check if others have reported similar problems
5. **Report new issues** - Include logs and system information

### Useful Commands

```bash
# Verify binary
npm run verify:binary

# Build binary
npm run build:binary

# Check architecture
lipo -info src/assets/SystemAudioDump

# Check signature
codesign -dv src/assets/SystemAudioDump

# Check permissions
ls -l src/assets/SystemAudioDump

# Remove quarantine
xattr -d com.apple.quarantine src/assets/SystemAudioDump

# Test execution
src/assets/SystemAudioDump > /dev/null &
```

### Related Documentation

- [Prism README](../README.md) - Main project documentation
- [AGENTS.md](../AGENTS.md) - Development guidelines
- [Requirements](../.kiro/specs/macos-audio-capture-fix/requirements.md) - Feature requirements
- [Design](../.kiro/specs/macos-audio-capture-fix/design.md) - Technical design
- [Tasks](../.kiro/specs/macos-audio-capture-fix/tasks.md) - Implementation tasks

## Contributing

When contributing to the audio capture system:

1. **Read the design document** - Understand the architecture
2. **Follow coding standards** - See AGENTS.md
3. **Write tests** - Cover new functionality
4. **Update documentation** - Keep docs in sync with code
5. **Test on both architectures** - Ensure compatibility
6. **Use structured logging** - Follow existing patterns

## License

See [LICENSE](../LICENSE) file in the project root.

---

**Last Updated:** 2024
**Version:** 1.0
**Maintainers:** Prism Development Team
