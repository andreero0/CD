# Code Signing Configuration for macOS

This document describes the code signing requirements and configuration for building and distributing Prism on macOS.

## Overview

Prism requires proper code signing to:
- Execute the SystemAudioDump binary for audio capture
- Access audio input devices (microphone and system audio)
- Pass macOS Gatekeeper security checks
- Distribute the application outside the Mac App Store

## Development Builds

For local development, the application can use **adhoc signing**:

```bash
# The SystemAudioDump binary should be adhoc signed
codesign --force --deep --sign - src/assets/SystemAudioDump

# Build the application (will use adhoc signing automatically)
npm run make
```

Adhoc signing allows the application to run locally but won't pass Gatekeeper on other machines.

## Distribution Builds

For distribution to other users, you need a **Developer ID certificate** from Apple.

### Prerequisites

1. **Apple Developer Account** - Enroll at https://developer.apple.com
2. **Developer ID Application certificate** - Download from Apple Developer portal
3. **Install certificate** - Double-click the certificate to install in Keychain

### Find Your Signing Identity

```bash
security find-identity -v -p codesigning
```

This will output something like:
```
1) ABCD1234EFGH5678 "Developer ID Application: Your Name (TEAM_ID)"
```

### Configure Environment Variables

Set these environment variables before building:

```bash
# Required for code signing
export APPLE_IDENTITY="Developer ID Application: Your Name (TEAM_ID)"

# Optional: for notarization (recommended for distribution)
export APPLE_ID="your-apple-id@example.com"
export APPLE_ID_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="YOUR_TEAM_ID"
```

### App-Specific Password

For notarization, you need an app-specific password:

1. Go to https://appleid.apple.com
2. Sign in with your Apple ID
3. Navigate to "Security" → "App-Specific Passwords"
4. Generate a new password for "Prism Notarization"
5. Use this password for `APPLE_ID_PASSWORD`

### Build for Distribution

```bash
# Set environment variables (see above)
export APPLE_IDENTITY="Developer ID Application: Your Name (TEAM_ID)"

# Build the application
npm run make

# The build will:
# 1. Verify SystemAudioDump is a universal binary
# 2. Sign the application with your Developer ID
# 3. Apply entitlements for audio capture
# 4. (Optional) Notarize with Apple if credentials are provided
```

## Entitlements

The application requires these entitlements (configured in `entitlements.plist`):

- `com.apple.security.device.audio-input` - Access to audio input devices
- `com.apple.security.device.microphone` - Access to microphone
- `com.apple.security.cs.allow-jit` - JIT compilation for Electron
- `com.apple.security.cs.allow-unsigned-executable-memory` - Required for V8
- `com.apple.security.network.client` - Network access for API calls
- `com.apple.security.network.server` - Local server capabilities

## SystemAudioDump Binary

The SystemAudioDump binary must be:

1. **Universal binary** - Contains both x86_64 and arm64 code
2. **Code signed** - Signed with the same certificate as the app
3. **Properly permissioned** - Executable permissions set

### Building the Universal Binary

```bash
# Compile for both architectures
clang -arch x86_64 -arch arm64 \
  -o src/assets/SystemAudioDump \
  SystemAudioDump.c \
  -framework CoreAudio \
  -framework AudioToolbox

# Verify it's universal
lipo -info src/assets/SystemAudioDump
# Should output: "Architectures in the fat file: x86_64 arm64"

# Sign the binary (adhoc for development)
codesign --force --deep --sign - src/assets/SystemAudioDump

# Or sign with Developer ID for distribution
codesign --force --deep --sign "Developer ID Application: Your Name (TEAM_ID)" \
  --options runtime \
  --entitlements entitlements.plist \
  src/assets/SystemAudioDump
```

## Build Verification

The build process automatically verifies:

1. SystemAudioDump binary exists
2. Binary is a universal binary (contains both x86_64 and arm64)
3. Binary architectures are logged during build

If verification fails, the build will stop with a clear error message.

## Troubleshooting

### "SystemAudioDump must be a universal binary"

The binary is missing one or both architectures. Rebuild it:

```bash
clang -arch x86_64 -arch arm64 -o src/assets/SystemAudioDump SystemAudioDump.c \
  -framework CoreAudio -framework AudioToolbox
```

### "Code signing failed"

- Verify your certificate is installed: `security find-identity -v -p codesigning`
- Check the certificate hasn't expired
- Ensure you're using the correct identity string

### "Notarization timed out"

Notarization can take 5-60 minutes. You can:
- Skip notarization for internal testing (unset `APPLE_ID`)
- Check status: `xcrun altool --notarization-history 0 -u "$APPLE_ID" -p "$APPLE_ID_PASSWORD"`

### "Binary not found at runtime"

- Verify the binary is in `src/assets/SystemAudioDump`
- Check it's included in `extraResource` in `forge.config.js`
- Ensure execute permissions: `chmod +x src/assets/SystemAudioDump`

## CI/CD Integration

For automated builds:

```yaml
# Example GitHub Actions workflow
- name: Setup code signing
  env:
    APPLE_IDENTITY: ${{ secrets.APPLE_IDENTITY }}
    APPLE_ID: ${{ secrets.APPLE_ID }}
    APPLE_ID_PASSWORD: ${{ secrets.APPLE_ID_PASSWORD }}
    APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
  run: |
    # Import certificate from secrets
    echo "${{ secrets.CERTIFICATE_P12 }}" | base64 --decode > certificate.p12
    security create-keychain -p actions build.keychain
    security import certificate.p12 -k build.keychain -P "${{ secrets.CERTIFICATE_PASSWORD }}" -T /usr/bin/codesign
    security set-key-partition-list -S apple-tool:,apple: -s -k actions build.keychain
    
- name: Build application
  run: npm run make
```

## References

- [Apple Code Signing Guide](https://developer.apple.com/support/code-signing/)
- [Electron Forge Code Signing](https://www.electronforge.io/guides/code-signing)
- [Notarization Guide](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
