# Building Universal Binary for SystemAudioDump

This document provides step-by-step instructions for building the SystemAudioDump binary as a universal binary that supports both Intel (x86_64) and Apple Silicon (arm64) Macs.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Detailed Build Process](#detailed-build-process)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)
- [Integration with Electron](#integration-with-electron)

## Prerequisites

### Required Tools

1. **Xcode Command Line Tools**
   ```bash
   xcode-select --install
   ```
   
   Verify installation:
   ```bash
   xcode-select -p
   # Should output: /Library/Developer/CommandLineTools
   ```

2. **Xcode** (recommended but not required)
   - Download from Mac App Store
   - Provides additional debugging tools
   - Required for App Store distribution

3. **macOS SDK**
   - Included with Xcode Command Line Tools
   - Verify:
     ```bash
     xcrun --show-sdk-path
     # Should output: /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk
     ```

### System Requirements

- macOS 10.15 (Catalina) or later
- At least 2GB free disk space
- Administrator access (for code signing)

## Quick Start

For those familiar with the process, here's the quick version:

```bash
# Navigate to project root
cd /path/to/prism

# Compile for both architectures
clang -arch x86_64 -o SystemAudioDump_x86_64 SystemAudioDump.c \
      -framework CoreAudio -framework AudioToolbox

clang -arch arm64 -o SystemAudioDump_arm64 SystemAudioDump.c \
      -framework CoreAudio -framework AudioToolbox

# Create universal binary
lipo -create SystemAudioDump_x86_64 SystemAudioDump_arm64 \
     -output SystemAudioDump

# Apply adhoc code signing
codesign --force --deep --sign - SystemAudioDump

# Verify
lipo -info SystemAudioDump
codesign -dv SystemAudioDump

# Move to assets directory
mv SystemAudioDump src/assets/

# Clean up intermediate files
rm SystemAudioDump_x86_64 SystemAudioDump_arm64
```

## Detailed Build Process

### Step 1: Prepare the Source Code

The SystemAudioDump source code (`SystemAudioDump.c`) is a C program that captures system audio using macOS Core Audio APIs.

**What it does:**
- Captures system audio at 24kHz, 16-bit, stereo
- Outputs raw PCM audio data to stdout
- Runs continuously until terminated

**Key features:**
- Uses `AudioQueueNewInput` for audio capture
- Buffers audio in 0.1-second chunks
- Writes directly to stdout for piping to Node.js

### Step 2: Compile for x86_64 (Intel)

Compile the binary for Intel Macs:

```bash
clang -arch x86_64 \
      -o SystemAudioDump_x86_64 \
      SystemAudioDump.c \
      -framework CoreAudio \
      -framework AudioToolbox
```

**Explanation of flags:**
- `-arch x86_64`: Target Intel architecture
- `-o SystemAudioDump_x86_64`: Output filename
- `-framework CoreAudio`: Link Core Audio framework
- `-framework AudioToolbox`: Link Audio Toolbox framework

**Expected output:**
- Creates `SystemAudioDump_x86_64` binary
- No warnings or errors
- File size: ~50KB

**Verify:**
```bash
file SystemAudioDump_x86_64
# Output: SystemAudioDump_x86_64: Mach-O 64-bit executable x86_64

lipo -info SystemAudioDump_x86_64
# Output: Non-fat file: SystemAudioDump_x86_64 is architecture: x86_64
```

### Step 3: Compile for arm64 (Apple Silicon)

Compile the binary for Apple Silicon Macs:

```bash
clang -arch arm64 \
      -o SystemAudioDump_arm64 \
      SystemAudioDump.c \
      -framework CoreAudio \
      -framework AudioToolbox
```

**Explanation of flags:**
- `-arch arm64`: Target Apple Silicon architecture
- `-o SystemAudioDump_arm64`: Output filename
- Other flags same as x86_64 build

**Expected output:**
- Creates `SystemAudioDump_arm64` binary
- No warnings or errors
- File size: ~50KB

**Verify:**
```bash
file SystemAudioDump_arm64
# Output: SystemAudioDump_arm64: Mach-O 64-bit executable arm64

lipo -info SystemAudioDump_arm64
# Output: Non-fat file: SystemAudioDump_arm64 is architecture: arm64
```

### Step 4: Create Universal Binary

Combine both architecture binaries into a single universal binary:

```bash
lipo -create \
     SystemAudioDump_x86_64 \
     SystemAudioDump_arm64 \
     -output SystemAudioDump
```

**Explanation:**
- `lipo -create`: Create a new universal binary
- Lists both input binaries
- `-output SystemAudioDump`: Final universal binary name

**Expected output:**
- Creates `SystemAudioDump` universal binary
- File size: ~100KB (sum of both architectures)

**Verify:**
```bash
file SystemAudioDump
# Output: SystemAudioDump: Mach-O universal binary with 2 architectures:
#         [x86_64:Mach-O 64-bit executable x86_64] [arm64:Mach-O 64-bit executable arm64]

lipo -info SystemAudioDump
# Output: Architectures in the fat file: SystemAudioDump are: x86_64 arm64
```

### Step 5: Apply Code Signing

#### Development (Adhoc Signing)

For development and testing, apply adhoc signing:

```bash
codesign --force --deep --sign - SystemAudioDump
```

**Explanation:**
- `--force`: Replace existing signature if present
- `--deep`: Sign nested code (not applicable here, but good practice)
- `--sign -`: Use adhoc signature (no certificate)

**Verify:**
```bash
codesign -dv SystemAudioDump
# Output:
# Executable=/path/to/SystemAudioDump
# Identifier=SystemAudioDump
# Format=Mach-O universal (x86_64 arm64)
# CodeDirectory v=20500 size=... flags=0x2(adhoc) hashes=...
# Signature=adhoc
# Info.plist=not bound
# TeamIdentifier=not set
# Sealed Resources=none
# Internal requirements count=0 size=12
```

#### Production (Developer Signing)

For distribution, sign with your Apple Developer certificate:

```bash
# List available signing identities
security find-identity -v -p codesigning

# Sign with developer certificate
codesign --force --deep \
         --sign "Developer ID Application: Your Name (TEAM_ID)" \
         --entitlements entitlements.plist \
         --options runtime \
         SystemAudioDump
```

**Required entitlements** (`entitlements.plist`):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.device.audio-input</key>
    <true/>
    <key>com.apple.security.device.microphone</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
</dict>
</plist>
```

**Verify production signature:**
```bash
codesign -dv SystemAudioDump
# Should show: Authority=Developer ID Application: Your Name
#              TeamIdentifier=YOUR_TEAM_ID

spctl -a -v SystemAudioDump
# Should show: accepted
```

### Step 6: Move to Assets Directory

Move the signed universal binary to the Electron assets directory:

```bash
# Backup existing binary (if any)
mv src/assets/SystemAudioDump src/assets/SystemAudioDump.backup

# Move new binary
mv SystemAudioDump src/assets/

# Set execute permissions
chmod +x src/assets/SystemAudioDump
```

**Verify:**
```bash
ls -l src/assets/SystemAudioDump
# Should show: -rwxr-xr-x ... SystemAudioDump

lipo -info src/assets/SystemAudioDump
# Should show: Architectures in the fat file: ... are: x86_64 arm64
```

### Step 7: Clean Up

Remove intermediate build artifacts:

```bash
rm SystemAudioDump_x86_64
rm SystemAudioDump_arm64
```

## Verification

### Automated Verification Script

Create a verification script (`scripts/verify-binary.sh`):

```bash
#!/bin/bash

BINARY_PATH="src/assets/SystemAudioDump"

echo "=== SystemAudioDump Binary Verification ==="
echo ""

# Check if binary exists
if [ ! -f "$BINARY_PATH" ]; then
    echo "❌ Binary not found at: $BINARY_PATH"
    exit 1
fi
echo "✅ Binary exists"

# Check if executable
if [ ! -x "$BINARY_PATH" ]; then
    echo "❌ Binary is not executable"
    exit 1
fi
echo "✅ Binary is executable"

# Check architectures
echo ""
echo "Architecture check:"
lipo -info "$BINARY_PATH"

ARCHS=$(lipo -info "$BINARY_PATH" | grep -o "x86_64\|arm64" | sort | uniq)
if echo "$ARCHS" | grep -q "x86_64" && echo "$ARCHS" | grep -q "arm64"; then
    echo "✅ Universal binary (x86_64 + arm64)"
else
    echo "❌ Not a universal binary"
    exit 1
fi

# Check code signature
echo ""
echo "Code signature check:"
codesign -dv "$BINARY_PATH" 2>&1 | head -5

if codesign -v "$BINARY_PATH" 2>&1 | grep -q "valid on disk"; then
    echo "✅ Code signature is valid"
else
    echo "⚠️  Code signature may have issues"
fi

echo ""
echo "=== Verification Complete ==="
```

Make it executable and run:
```bash
chmod +x scripts/verify-binary.sh
./scripts/verify-binary.sh
```

### Manual Verification Steps

1. **Check file type:**
   ```bash
   file src/assets/SystemAudioDump
   ```
   Expected: `Mach-O universal binary with 2 architectures`

2. **Check architectures:**
   ```bash
   lipo -info src/assets/SystemAudioDump
   ```
   Expected: `Architectures in the fat file: ... are: x86_64 arm64`

3. **Check permissions:**
   ```bash
   ls -l src/assets/SystemAudioDump
   ```
   Expected: `-rwxr-xr-x` (executable)

4. **Check code signature:**
   ```bash
   codesign -dv src/assets/SystemAudioDump
   ```
   Expected: Shows signature information

5. **Test execution:**
   ```bash
   src/assets/SystemAudioDump > /dev/null &
   PID=$!
   sleep 2
   kill $PID
   ```
   Expected: No errors, process starts and stops cleanly

### Using Node.js Verification

Use the built-in verification module:

```javascript
// verify.js
const { verifySystemAudioDump } = require('./src/utils/binaryVerification');
const path = require('path');

async function verify() {
    const binaryPath = path.join(__dirname, 'src/assets/SystemAudioDump');
    const result = await verifySystemAudioDump(binaryPath);
    
    console.log('Verification Result:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.errors.length > 0) {
        console.error('\n❌ Verification failed');
        process.exit(1);
    }
    
    console.log('\n✅ Verification passed');
}

verify();
```

Run with:
```bash
node verify.js
```

## Troubleshooting

### Issue: "xcrun: error: invalid active developer path"

**Problem:** Xcode Command Line Tools not installed

**Solution:**
```bash
xcode-select --install
```

### Issue: "clang: error: linker command failed"

**Problem:** Missing frameworks or incorrect paths

**Solution:**
```bash
# Verify SDK path
xcrun --show-sdk-path

# Use explicit SDK path
clang -arch x86_64 \
      -isysroot $(xcrun --show-sdk-path) \
      -o SystemAudioDump_x86_64 \
      SystemAudioDump.c \
      -framework CoreAudio \
      -framework AudioToolbox
```

### Issue: "lipo: can't open input file"

**Problem:** Architecture-specific binaries not found

**Solution:**
```bash
# Verify both binaries exist
ls -l SystemAudioDump_x86_64 SystemAudioDump_arm64

# If missing, rebuild them
```

### Issue: "codesign: code object is not signed at all"

**Problem:** Binary not signed

**Solution:**
```bash
# Apply adhoc signature
codesign --force --deep --sign - SystemAudioDump

# Verify
codesign -dv SystemAudioDump
```

### Issue: Binary works on one architecture but not the other

**Problem:** One architecture slice may be corrupted

**Solution:**
```bash
# Extract and test individual slices
lipo SystemAudioDump -thin x86_64 -output test_x86_64
lipo SystemAudioDump -thin arm64 -output test_arm64

# Test each
./test_x86_64  # On Intel Mac
./test_arm64   # On Apple Silicon Mac

# If one fails, rebuild that architecture
```

### Issue: "Operation not permitted" when running binary

**Problem:** macOS Gatekeeper or quarantine attributes

**Solution:**
```bash
# Remove quarantine attribute
xattr -d com.apple.quarantine src/assets/SystemAudioDump

# Re-sign
codesign --force --deep --sign - src/assets/SystemAudioDump
```

## Integration with Electron

### Build Configuration

Update `forge.config.js` to include the binary:

```javascript
module.exports = {
    packagerConfig: {
        // ... other config
        extraResource: [
            './src/assets/SystemAudioDump'
        ],
        beforeCopy: [
            (buildPath, electronVersion, platform, arch, callback) => {
                // Verify binary before packaging
                const { verifySystemAudioDump } = require('./src/utils/binaryVerification');
                const path = require('path');
                
                const binaryPath = path.join(__dirname, 'src/assets/SystemAudioDump');
                
                verifySystemAudioDump(binaryPath).then(result => {
                    if (result.errors.length > 0) {
                        console.error('❌ Binary verification failed:');
                        result.errors.forEach(e => console.error(`  - ${e}`));
                        callback(new Error('Binary verification failed'));
                    } else {
                        console.log('✅ Binary verification passed');
                        callback();
                    }
                }).catch(callback);
            }
        ]
    }
};
```

### Runtime Binary Path

The application automatically detects the correct binary path:

```javascript
// In packaged app
const binaryPath = path.join(process.resourcesPath, 'SystemAudioDump');

// In development
const binaryPath = path.join(__dirname, '../assets/SystemAudioDump');
```

This is handled automatically by `AudioCaptureManager._getBinaryPath()`.

### Testing in Development

Test the binary in development mode:

```bash
# Start the app
npm start

# Check logs for binary verification
# Should see: "Binary verification passed successfully"
```

### Testing in Production

Test the packaged application:

```bash
# Build the app
npm run make

# Run the packaged app
open out/Prism-darwin-x64/Prism.app  # Intel
open out/Prism-darwin-arm64/Prism.app  # Apple Silicon

# Check that audio capture works
```

## Automated Build Script

Create a build script (`scripts/build-binary.sh`):

```bash
#!/bin/bash

set -e  # Exit on error

echo "=== Building SystemAudioDump Universal Binary ==="
echo ""

# Clean previous builds
echo "Cleaning previous builds..."
rm -f SystemAudioDump_x86_64 SystemAudioDump_arm64 SystemAudioDump

# Compile for x86_64
echo "Compiling for x86_64..."
clang -arch x86_64 -o SystemAudioDump_x86_64 SystemAudioDump.c \
      -framework CoreAudio -framework AudioToolbox

# Compile for arm64
echo "Compiling for arm64..."
clang -arch arm64 -o SystemAudioDump_arm64 SystemAudioDump.c \
      -framework CoreAudio -framework AudioToolbox

# Create universal binary
echo "Creating universal binary..."
lipo -create SystemAudioDump_x86_64 SystemAudioDump_arm64 \
     -output SystemAudioDump

# Apply code signing
echo "Applying code signature..."
codesign --force --deep --sign - SystemAudioDump

# Verify
echo ""
echo "Verification:"
lipo -info SystemAudioDump
codesign -dv SystemAudioDump 2>&1 | head -3

# Move to assets
echo ""
echo "Moving to assets directory..."
if [ -f src/assets/SystemAudioDump ]; then
    mv src/assets/SystemAudioDump src/assets/SystemAudioDump.backup
    echo "  (backed up existing binary)"
fi
mv SystemAudioDump src/assets/
chmod +x src/assets/SystemAudioDump

# Clean up
echo "Cleaning up intermediate files..."
rm SystemAudioDump_x86_64 SystemAudioDump_arm64

echo ""
echo "✅ Build complete!"
echo "Binary location: src/assets/SystemAudioDump"
```

Make it executable:
```bash
chmod +x scripts/build-binary.sh
```

Run it:
```bash
./scripts/build-binary.sh
```

Add to `package.json`:
```json
{
    "scripts": {
        "build:binary": "./scripts/build-binary.sh",
        "verify:binary": "./scripts/verify-binary.sh"
    }
}
```

Use with npm:
```bash
npm run build:binary
npm run verify:binary
```

## See Also

- [Architecture Detection and Verification](./ARCHITECTURE_DETECTION.md) - Understanding architecture detection
- [Error Handling and Fallbacks](./ERROR_HANDLING.md) - Error diagnosis and fallback methods
- [SystemAudioDump.c](../SystemAudioDump.c) - Source code for the audio capture binary
