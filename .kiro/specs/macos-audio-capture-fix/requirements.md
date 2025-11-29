# Requirements Document

## Introduction

The Prism application currently fails to capture system audio on macOS due to spawn error -86 when attempting to execute the SystemAudioDump binary. Investigation reveals the root cause is an architecture mismatch: the binary is compiled for arm64 (Apple Silicon) but the current system is running on x86_64 (Intel). This causes the spawn to fail with error -86 ("bad CPU type in executable"). This feature will implement a robust solution that provides universal binary support for macOS system audio capture, working reliably across both Intel and Apple Silicon Macs, as well as different macOS versions and security configurations.

## Glossary

- **SystemAudioDump**: A native macOS binary executable that captures system audio output
- **Gatekeeper**: macOS security feature that enforces code signing requirements
- **Code Signing**: Process of digitally signing executables to verify their authenticity
- **Adhoc Signing**: Temporary local signing that doesn't use a developer certificate
- **Spawn Error -86**: macOS error code indicating the system blocked execution due to architecture mismatch, signing issues, or permission problems
- **Universal Binary**: A macOS executable containing code for multiple architectures (x86_64 and arm64)
- **Architecture**: The CPU instruction set (x86_64 for Intel, arm64 for Apple Silicon)
- **Electron Main Process**: The Node.js process that manages application lifecycle and native operations
- **Audio Capture Session**: An active instance of system audio recording
- **Entitlements**: Permissions that allow an app to access specific system resources

## Requirements

### Requirement 1

**User Story:** As a user, I want the application to successfully capture system audio on macOS, so that I can receive real-time coaching based on what I'm hearing.

#### Acceptance Criteria

1. WHEN the application starts audio capture THEN the SystemAudioDump binary SHALL execute without spawn errors
2. WHEN the SystemAudioDump binary is executed THEN macOS Gatekeeper SHALL permit the execution
3. WHEN audio capture is active THEN the system SHALL stream audio data to the Gemini session
4. WHEN the binary fails to execute THEN the system SHALL provide clear error messages indicating the specific failure reason
5. WHEN the user lacks required permissions THEN the system SHALL guide the user to grant necessary audio capture permissions

### Requirement 2

**User Story:** As a user, I want the application to work on both Intel and Apple Silicon Macs, so that I can use it regardless of my hardware.

#### Acceptance Criteria

1. WHEN the application is built THEN the SystemAudioDump binary SHALL be a universal binary containing both x86_64 and arm64 code
2. WHEN the application runs on an Intel Mac THEN the system SHALL execute the x86_64 slice of the binary
3. WHEN the application runs on an Apple Silicon Mac THEN the system SHALL execute the arm64 slice of the binary
4. WHEN the binary is missing the required architecture THEN the system SHALL provide a clear error message indicating the architecture mismatch
5. WHEN detecting system architecture THEN the system SHALL use Node.js process.arch to determine the correct binary to use

### Requirement 3

**User Story:** As a developer, I want the SystemAudioDump binary to be properly code-signed, so that it can be executed reliably across different macOS security configurations.

#### Acceptance Criteria

1. WHEN the application is built THEN the SystemAudioDump binary SHALL be code-signed with a valid developer certificate
2. WHEN a developer certificate is unavailable THEN the build process SHALL apply proper adhoc signing with required entitlements
3. WHEN the binary is signed THEN the signature SHALL include audio capture entitlements
4. WHEN the signing process fails THEN the build SHALL fail with a clear error message
5. WHERE the application runs in development mode THEN the system SHALL handle unsigned binaries gracefully with appropriate warnings

### Requirement 4

**User Story:** As a user, I want the application to handle audio capture failures gracefully, so that I can understand what went wrong and how to fix it.

#### Acceptance Criteria

1. WHEN spawn error -86 occurs THEN the system SHALL detect it and determine if the cause is architecture mismatch or code signing
2. WHEN a code signing issue is detected THEN the system SHALL display user-friendly guidance
3. WHEN audio capture fails THEN the system SHALL log detailed diagnostic information for debugging
4. WHEN the binary is missing THEN the system SHALL provide instructions for rebuilding or reinstalling
5. WHEN retrying audio capture THEN the system SHALL implement exponential backoff to avoid rapid retry loops

### Requirement 5

**User Story:** As a developer, I want comprehensive error handling for the audio capture process, so that I can diagnose and fix issues quickly.

#### Acceptance Criteria

1. WHEN the spawn process fails THEN the system SHALL capture the error code, message, and stack trace
2. WHEN audio capture initialization fails THEN the system SHALL clean up any partial resources
3. WHEN the SystemAudioDump process crashes THEN the system SHALL detect the crash and log the exit code
4. WHEN checking for existing processes THEN the system SHALL handle process enumeration errors gracefully
5. WHEN the binary path is invalid THEN the system SHALL validate the path before attempting to spawn

### Requirement 6

**User Story:** As a user, I want the application to request necessary permissions automatically, so that I don't have to manually configure system settings.

#### Acceptance Criteria

1. WHEN the application first launches THEN the system SHALL check for audio capture permissions
2. WHEN permissions are missing THEN the system SHALL prompt the user to grant them
3. WHEN the user grants permissions THEN the system SHALL verify the permissions are active
4. WHEN permissions are denied THEN the system SHALL provide instructions for manual permission granting
5. WHEN permissions change THEN the system SHALL detect the change and update audio capture availability

### Requirement 7

**User Story:** As a developer, I want alternative audio capture methods as fallbacks, so that the application can work even if SystemAudioDump fails.

#### Acceptance Criteria

1. WHEN SystemAudioDump fails to spawn THEN the system SHALL attempt alternative capture methods
2. WHERE alternative methods are available THEN the system SHALL use Web Audio API or Electron's desktopCapturer
3. WHEN all capture methods fail THEN the system SHALL disable audio-dependent features gracefully
4. WHEN a fallback method succeeds THEN the system SHALL log which method is being used
5. WHEN the primary method becomes available THEN the system SHALL switch back to the preferred method

### Requirement 8

**User Story:** As a developer, I want automated tests for audio capture initialization, so that I can prevent regressions.

#### Acceptance Criteria

1. WHEN tests run THEN the system SHALL verify the SystemAudioDump binary exists
2. WHEN tests run THEN the system SHALL verify the binary has execute permissions
3. WHEN tests run THEN the system SHALL verify the binary contains both x86_64 and arm64 architectures
4. WHEN tests run THEN the system SHALL verify the binary is properly signed
5. WHEN tests run THEN the system SHALL mock spawn failures and verify error handling
6. WHEN tests run THEN the system SHALL verify cleanup of audio capture resources
