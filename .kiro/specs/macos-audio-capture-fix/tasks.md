# Implementation Plan

- [x] 1. Build universal SystemAudioDump binary
  - Compile SystemAudioDump for both x86_64 and arm64 architectures
  - Use lipo to create universal binary containing both architectures
  - Verify binary contains both architectures using lipo -info
  - Apply adhoc code signing for development
  - Replace existing binary in src/assets/
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 2. Create architecture detection module
  - [x] 2.1 Implement getSystemArchitecture() function
    - Use process.arch to detect current architecture
    - Map Node.js arch names to macOS arch names (x64 → x86_64, arm64 → arm64)
    - _Requirements: 2.5, 7.2_

  - [x] 2.2 Implement getBinaryArchitectures() function
    - Execute 'lipo -info' command on binary path
    - Parse output to extract architecture list
    - Handle both universal and single-architecture binaries
    - Return array of architectures
    - _Requirements: 2.1, 8.3_

  - [x] 2.3 Implement binarySupportsArchitecture() function
    - Call getBinaryArchitectures()
    - Check if required architecture is in the list
    - Return boolean result
    - _Requirements: 2.2, 2.4_

  - [x] 2.4 Write property test for architecture detection
    - **Property 7: Architecture Detection Consistency**
    - **Validates: Requirements 2.5**

- [x] 3. Create binary verification module
  - [x] 3.1 Implement checkCodeSignature() function
    - Execute 'codesign -dv' command on binary path
    - Parse output to extract signature information
    - Identify signature type (adhoc, developer, none)
    - Return SignatureInfo object
    - _Requirements: 3.1, 3.3, 8.4_

  - [x] 3.2 Implement verifySystemAudioDump() function
    - Check if binary file exists
    - Check if binary has execute permissions
    - Call getBinaryArchitectures() to get supported architectures
    - Call getSystemArchitecture() to get current architecture
    - Check if current architecture is supported
    - Call checkCodeSignature() to verify signing
    - Return comprehensive VerificationResult object
    - _Requirements: 2.4, 3.1, 3.2, 3.3, 5.5, 8.1, 8.2_

  - [x] 3.3 Write property test for verification idempotence
    - **Property 2: Binary Verification Idempotence**
    - **Validates: Requirements 5.1**

- [x] 4. Create error diagnostics module
  - [x] 4.1 Implement diagnoseSpawnError86() function
    - Check if error code is -86
    - Call verifySystemAudioDump() to get binary status
    - Determine root cause (architecture mismatch, code signing, permissions, missing)
    - Generate user-friendly message with suggested fix
    - Return DiagnosticResult object
    - _Requirements: 4.1, 4.4, 5.1_

  - [x] 4.2 Implement formatErrorMessage() function
    - Take DiagnosticResult as input
    - Format user-friendly error message
    - Include specific steps to resolve the issue
    - Return formatted string
    - _Requirements: 4.2, 4.4_

  - [x] 4.3 Write property test for error diagnosis completeness
    - **Property 3: Error Diagnosis Completeness**
    - **Validates: Requirements 4.1, 5.1**

- [x] 5. Implement retry strategy with exponential backoff
  - [x] 5.1 Create RetryStrategy class
    - Track attempt count
    - Implement getNextDelay() with exponential backoff (1s, 2s, 4s, 8s, capped at 10s)
    - Implement shouldRetry() to check max attempts
    - Implement reset() to reset counter
    - _Requirements: 4.5_

  - [x] 5.2 Write property test for retry backoff
    - **Property 6: Retry Backoff**
    - **Validates: Requirements 4.5**

- [x] 6. Create Audio Capture Manager
  - [x] 6.1 Implement AudioCaptureManager class structure
    - Define constructor with initialization
    - Set up state tracking (currentMethod, systemAudioProc, retryCount)
    - Create RetryStrategy instance
    - _Requirements: 1.1, 5.2_

  - [x] 6.2 Implement verifyBinary() method
    - Get binary path (handle both packaged and development modes)
    - Call verifySystemAudioDump()
    - Log verification results
    - Return verification result
    - _Requirements: 2.4, 5.5, 8.1, 8.2, 8.4_

  - [x] 6.3 Implement diagnoseError() method
    - Check error code and type
    - Call diagnoseSpawnError86() for error -86
    - Call formatErrorMessage() to get user message
    - Log technical details
    - Return user-friendly message
    - _Requirements: 4.1, 4.2, 4.3, 5.1_

  - [x] 6.4 Implement initialize() method
    - Call verifyBinary() to check compatibility
    - If verification fails, log diagnostics and prepare fallback
    - If verification succeeds, mark as ready
    - _Requirements: 1.1, 1.2, 2.4_

  - [x] 6.5 Implement start() method with retry logic
    - Check if already running
    - Call verifyBinary() if not already verified
    - Attempt to spawn SystemAudioDump process
    - If spawn fails with error -86, call diagnoseError()
    - If should retry, wait for exponential backoff delay and retry
    - If max retries exceeded, attempt fallback methods
    - Set up process event handlers (stdout, stderr, close, error)
    - _Requirements: 1.1, 1.3, 4.5, 5.1, 5.2, 5.3, 5.4_

  - [x] 6.6 Implement stop() method with cleanup
    - Kill SystemAudioDump process if running
    - Remove all event listeners
    - Clear audio buffer
    - Reset state variables
    - _Requirements: 5.2_

  - [x] 6.7 Write property test for resource cleanup
    - **Property 5: Resource Cleanup**
    - **Validates: Requirements 5.2**

- [x] 7. Implement fallback audio capture methods
  - [x] 7.1 Implement tryDesktopCapturer() function
    - Use Electron's desktopCapturer.getSources()
    - Filter for audio sources
    - Set up MediaStream with audio constraints
    - Connect to audio processing pipeline
    - Return success status
    - _Requirements: 7.1, 7.2, 7.4_

  - [x] 7.2 Implement tryWebAudioCapture() function
    - Use navigator.mediaDevices.getDisplayMedia()
    - Configure audio constraints (echoCancellation, noiseSuppression)
    - Set up Web Audio API processing
    - Connect to Gemini session
    - Return success status
    - _Requirements: 7.1, 7.2, 7.4_

  - [x] 7.3 Integrate fallback methods into AudioCaptureManager
    - Add fallback method array to manager
    - Implement tryFallbackMethods() to iterate through fallbacks
    - Update start() method to call tryFallbackMethods() on native failure
    - Log which method is being used
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 7.4 Write property test for fallback activation
    - **Property 4: Fallback Activation**
    - **Validates: Requirements 7.1, 7.2**

- [x] 8. Integrate AudioCaptureManager into existing code
  - [x] 8.1 Refactor startMacOSAudioCapture() in gemini.js
    - Replace direct spawn logic with AudioCaptureManager
    - Create AudioCaptureManager instance
    - Call initialize() and start()
    - Handle errors with diagnoseError()
    - Maintain existing audio data processing logic
    - _Requirements: 1.1, 1.3, 1.4_

  - [x] 8.2 Update stopMacOSAudioCapture() in gemini.js
    - Use AudioCaptureManager.stop() instead of direct process.kill()
    - Ensure proper cleanup
    - _Requirements: 5.2_

  - [x] 8.3 Update killExistingSystemAudioDump() function
    - Add architecture-aware process detection
    - Handle both x86_64 and arm64 processes
    - _Requirements: 5.4_

- [x] 9. Add permission handling
  - [x] 9.1 Implement checkAudioPermissions() function
    - Check macOS audio capture permissions status
    - Return permission state
    - _Requirements: 6.1, 6.3_

  - [x] 9.2 Implement requestAudioPermissions() function
    - Prompt user for audio capture permissions
    - Wait for user response
    - Return granted status
    - _Requirements: 6.2_

  - [x] 9.3 Integrate permission checks into AudioCaptureManager
    - Call checkAudioPermissions() during initialize()
    - If permissions missing, call requestAudioPermissions()
    - If permissions denied, show instructions for manual granting
    - _Requirements: 6.1, 6.2, 6.4, 6.5_

  - [x] 9.4 Write property test for permission state consistency
    - **Property 8: Permission State Consistency**
    - **Validates: Requirements 6.3**

- [x] 10. Update build configuration
  - [x] 10.1 Add binary verification to build process
    - Update forge.config.js beforeCopy hook
    - Verify SystemAudioDump is universal binary
    - Fail build if binary is not universal
    - Log architecture information during build
    - _Requirements: 2.1, 3.4_

  - [x] 10.2 Update entitlements.plist
    - Add com.apple.security.device.audio-input entitlement
    - Add com.apple.security.device.microphone entitlement
    - _Requirements: 3.3, 6.1_

  - [x] 10.3 Add code signing configuration
    - Update forge.config.js with signing configuration
    - Configure entitlements for audio capture
    - Document signing requirements for distribution
    - _Requirements: 3.1, 3.2, 3.4_

- [x] 11. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Add comprehensive logging
  - [x] 12.1 Add structured logging for audio capture lifecycle
    - Log initialization with system info (architecture, OS version)
    - Log binary verification results
    - Log spawn attempts and results
    - Log fallback method attempts
    - Log cleanup operations
    - _Requirements: 4.3, 5.1_

  - [x] 12.2 Add diagnostic logging for errors
    - Log full error details (code, message, stack)
    - Log verification results on error
    - Log diagnostic results
    - Log suggested fixes
    - _Requirements: 4.3, 5.1, 5.3_

- [x] 13. Create user-facing error messages
  - [x] 13.1 Design error message UI component
    - Create modal or notification component for error messages
    - Include error description, cause, and suggested fix
    - Add "Try Again" and "Use Fallback" buttons
    - _Requirements: 4.2, 4.4_

  - [x] 13.2 Integrate error messages into renderer
    - Send error messages from main process to renderer via IPC
    - Display error messages in UI
    - Handle user actions (retry, fallback, dismiss)
    - _Requirements: 1.5, 4.2_

- [x] 14. Write documentation
  - [x] 14.1 Document architecture detection and verification
    - Explain how architecture detection works
    - Document binary verification process
    - Provide troubleshooting guide
    - _Requirements: 2.4, 2.5_

  - [x] 14.2 Document build process for universal binary
    - Provide step-by-step instructions for building universal binary
    - Document required tools (Xcode, command line tools)
    - Include verification steps
    - _Requirements: 2.1_

  - [x] 14.3 Document error handling and fallback methods
    - Explain error diagnosis process
    - Document fallback method priority
    - Provide user troubleshooting guide
    - _Requirements: 4.1, 4.2, 7.1_

- [x] 15. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
