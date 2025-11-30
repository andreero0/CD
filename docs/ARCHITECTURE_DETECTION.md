# Architecture Detection and Binary Verification

This document explains how the Prism application detects system architecture, verifies binary compatibility, and troubleshoots common issues related to the SystemAudioDump binary on macOS.

## Table of Contents

- [Overview](#overview)
- [Architecture Detection](#architecture-detection)
- [Binary Verification](#binary-verification)
- [Troubleshooting Guide](#troubleshooting-guide)
- [API Reference](#api-reference)

## Overview

The SystemAudioDump binary is a native macOS executable that captures system audio. To work correctly across both Intel (x86_64) and Apple Silicon (arm64) Macs, the binary must be compiled as a **universal binary** containing code for both architectures.

The architecture detection and verification system ensures:
- The binary exists and has proper permissions
- The binary supports the current system architecture
- The binary is properly code-signed
- Clear error messages when issues are detected

## Architecture Detection

### How It Works

The architecture detection module (`src/utils/architectureDetection.js`) provides three key functions:

#### 1. System Architecture Detection

```javascript
const { getSystemArchitecture } = require('./utils/architectureDetection');

const arch = getSystemArchitecture();
// Returns: 'x86_64' on Intel Macs
// Returns: 'arm64' on Apple Silicon Macs
```

**Implementation Details:**
- Uses Node.js `process.arch` to detect the current architecture
- Maps Node.js architecture names to macOS architecture names:
  - `x64` → `x86_64` (Intel)
  - `arm64` → `arm64` (Apple Silicon)

#### 2. Binary Architecture Inspection

```javascript
const { getBinaryArchitectures } = require('./utils/architectureDetection');

const architectures = await getBinaryArchitectures('/path/to/binary');
// Returns: ['x86_64', 'arm64'] for universal binary
// Returns: ['arm64'] for single-architecture binary
```

**Implementation Details:**
- Executes the `lipo -info` command to inspect the binary
- Parses two types of output:
  - **Universal binary**: `"Architectures in the fat file: /path are: x86_64 arm64"`
  - **Single architecture**: `"Non-fat file: /path is architecture: arm64"`
- Returns an array of architecture strings
- Returns empty array if binary doesn't exist or isn't a valid Mach-O file

#### 3. Architecture Compatibility Check

```javascript
const { binarySupportsArchitecture } = require('./utils/architectureDetection');

const isCompatible = await binarySupportsArchitecture('/path/to/binary', 'x86_64');
// Returns: true if binary supports x86_64
// Returns: false otherwise
```

**Implementation Details:**
- Calls `getBinaryArchitectures()` to get the list of supported architectures
- Checks if the required architecture is in the list
- Returns a boolean result

### Example Usage

```javascript
const {
    getSystemArchitecture,
    getBinaryArchitectures,
    binarySupportsArchitecture
} = require('./utils/architectureDetection');

async function checkBinaryCompatibility(binaryPath) {
    // Detect current system architecture
    const systemArch = getSystemArchitecture();
    console.log(`System architecture: ${systemArch}`);
    
    // Get binary architectures
    const binaryArchs = await getBinaryArchitectures(binaryPath);
    console.log(`Binary supports: ${binaryArchs.join(', ')}`);
    
    // Check compatibility
    const isCompatible = await binarySupportsArchitecture(binaryPath, systemArch);
    
    if (isCompatible) {
        console.log('✅ Binary is compatible with this system');
    } else {
        console.log('❌ Binary is NOT compatible with this system');
        console.log(`   System needs: ${systemArch}`);
        console.log(`   Binary has: ${binaryArchs.join(', ')}`);
    }
    
    return isCompatible;
}
```

## Binary Verification

### Comprehensive Verification Process

The binary verification module (`src/utils/binaryVerification.js`) performs a comprehensive check of the SystemAudioDump binary:

```javascript
const { verifySystemAudioDump } = require('./utils/binaryVerification');

const result = await verifySystemAudioDump('/path/to/SystemAudioDump');
```

### Verification Steps

The verification process checks the following in order:

1. **File Existence**
   - Verifies the binary file exists at the specified path
   - If missing, returns immediately with error

2. **Execute Permissions**
   - Checks if the binary has execute permissions (`chmod +x`)
   - Uses `fs.accessSync()` with `fs.constants.X_OK`

3. **Architecture Support**
   - Calls `getBinaryArchitectures()` to get supported architectures
   - Calls `getSystemArchitecture()` to get current architecture
   - Verifies current architecture is in the supported list

4. **Code Signature**
   - Executes `codesign -dv` to check signature status
   - Identifies signature type: `adhoc`, `developer`, or `none`
   - Validates signature integrity

### Verification Result

The verification returns a `VerificationResult` object:

```typescript
interface VerificationResult {
    exists: boolean;              // Binary file exists
    executable: boolean;          // Has execute permissions
    architectures: string[];      // Supported architectures
    supportsCurrentArch: boolean; // Compatible with system
    signed: boolean;              // Has code signature
    signatureValid: boolean;      // Signature is valid
    signatureType: 'adhoc' | 'developer' | 'none';
    errors: string[];             // Error messages
    warnings: string[];           // Warning messages
}
```

### Code Signature Verification

The `checkCodeSignature()` function provides detailed signature information:

```javascript
const { checkCodeSignature } = require('./utils/binaryVerification');

const signatureInfo = await checkCodeSignature('/path/to/binary');
```

**Signature Types:**

1. **Developer Signature** (`developer`)
   - Signed with a valid Apple Developer certificate
   - Has a Team ID
   - Required for App Store distribution
   - Example: `TeamIdentifier=ABC123XYZ`

2. **Adhoc Signature** (`adhoc`)
   - Signed locally without a developer certificate
   - No Team ID
   - Sufficient for development and local testing
   - Created with: `codesign --force --deep --sign - /path/to/binary`

3. **No Signature** (`none`)
   - Binary is not signed
   - May be blocked by macOS Gatekeeper
   - Should be signed before use

### Example Verification Flow

```javascript
const { verifySystemAudioDump } = require('./utils/binaryVerification');
const { getSystemArchitecture } = require('./utils/architectureDetection');

async function verifyAndReport(binaryPath) {
    console.log('Verifying SystemAudioDump binary...\n');
    
    const result = await verifySystemAudioDump(binaryPath);
    const systemArch = getSystemArchitecture();
    
    // Report results
    console.log('Verification Results:');
    console.log(`  File exists: ${result.exists ? '✅' : '❌'}`);
    console.log(`  Executable: ${result.executable ? '✅' : '❌'}`);
    console.log(`  Architectures: ${result.architectures.join(', ') || 'none'}`);
    console.log(`  Supports ${systemArch}: ${result.supportsCurrentArch ? '✅' : '❌'}`);
    console.log(`  Signed: ${result.signed ? '✅' : '❌'}`);
    
    if (result.signed) {
        console.log(`  Signature type: ${result.signatureType}`);
        console.log(`  Signature valid: ${result.signatureValid ? '✅' : '❌'}`);
    }
    
    // Report errors
    if (result.errors.length > 0) {
        console.log('\n❌ Errors:');
        result.errors.forEach(err => console.log(`  - ${err}`));
    }
    
    // Report warnings
    if (result.warnings.length > 0) {
        console.log('\n⚠️  Warnings:');
        result.warnings.forEach(warn => console.log(`  - ${warn}`));
    }
    
    return result;
}
```

## Troubleshooting Guide

### Common Issues and Solutions

#### Issue 1: Architecture Mismatch (Error -86)

**Symptoms:**
- Application fails to start audio capture
- Error message: "spawn ENOEXEC" or error code -86
- Log shows: "Binary does not support current architecture"

**Diagnosis:**
```bash
# Check system architecture
node -e "console.log(process.arch)"

# Check binary architectures
lipo -info /path/to/SystemAudioDump
```

**Solution:**
The binary needs to be rebuilt as a universal binary. See [Building Universal Binary](./BUILD_UNIVERSAL_BINARY.md) for instructions.

**Quick Fix (if you have both architecture binaries):**
```bash
# Create universal binary from separate architecture binaries
lipo -create SystemAudioDump_x86_64 SystemAudioDump_arm64 \
     -output SystemAudioDump

# Verify
lipo -info SystemAudioDump
# Should show: "Architectures in the fat file: x86_64 arm64"
```

#### Issue 2: Missing Execute Permissions

**Symptoms:**
- Binary exists but won't execute
- Error: "Binary does not have execute permissions"

**Diagnosis:**
```bash
ls -l /path/to/SystemAudioDump
# Look for 'x' in permissions: -rwxr-xr-x
```

**Solution:**
```bash
chmod +x /path/to/SystemAudioDump
```

#### Issue 3: Code Signing Issues

**Symptoms:**
- Error -86 even with correct architecture
- macOS Gatekeeper blocks execution
- Error: "Binary is not properly signed"

**Diagnosis:**
```bash
codesign -dv /path/to/SystemAudioDump
```

**Solution (Development - Adhoc Signing):**
```bash
# Apply adhoc signature
codesign --force --deep --sign - /path/to/SystemAudioDump

# Verify
codesign -dv /path/to/SystemAudioDump
```

**Solution (Production - Developer Signing):**
```bash
# Sign with developer certificate
codesign --force --deep --sign "Developer ID Application: Your Name" \
         --entitlements entitlements.plist \
         /path/to/SystemAudioDump

# Verify
codesign -dv /path/to/SystemAudioDump
spctl -a -v /path/to/SystemAudioDump
```

#### Issue 4: Quarantine Attributes

**Symptoms:**
- Binary appears valid but still won't execute
- Downloaded binary blocked by Gatekeeper

**Diagnosis:**
```bash
xattr -l /path/to/SystemAudioDump
# Look for: com.apple.quarantine
```

**Solution:**
```bash
# Remove quarantine attribute
xattr -d com.apple.quarantine /path/to/SystemAudioDump

# Verify
xattr -l /path/to/SystemAudioDump
```

#### Issue 5: Binary Not Found

**Symptoms:**
- Error: "Binary file does not exist"
- Application can't locate SystemAudioDump

**Diagnosis:**
Check expected locations:
```bash
# Development mode
ls -l src/assets/SystemAudioDump

# Packaged mode
ls -l /Applications/Prism.app/Contents/Resources/SystemAudioDump
```

**Solution:**
1. Ensure binary is in correct location
2. Rebuild the application
3. Check `forge.config.js` includes binary in `extraResource`

### Diagnostic Commands

Use these commands to diagnose issues:

```bash
# 1. Check system architecture
uname -m
# x86_64 = Intel, arm64 = Apple Silicon

# 2. Check Node.js architecture
node -e "console.log(process.arch)"
# x64 = Intel, arm64 = Apple Silicon

# 3. Check binary architectures
lipo -info /path/to/SystemAudioDump

# 4. Check binary permissions
ls -l /path/to/SystemAudioDump

# 5. Check code signature
codesign -dv /path/to/SystemAudioDump

# 6. Check quarantine attributes
xattr -l /path/to/SystemAudioDump

# 7. Verify binary is executable
file /path/to/SystemAudioDump
# Should show: Mach-O universal binary

# 8. Test execution
/path/to/SystemAudioDump
# Should start capturing audio (Ctrl+C to stop)
```

### Automated Verification Script

Create a script to verify your binary:

```javascript
// verify-binary.js
const { verifySystemAudioDump } = require('./src/utils/binaryVerification');
const { getSystemArchitecture } = require('./src/utils/architectureDetection');
const path = require('path');

async function main() {
    const binaryPath = path.join(__dirname, 'src/assets/SystemAudioDump');
    const systemArch = getSystemArchitecture();
    
    console.log('=== SystemAudioDump Binary Verification ===\n');
    console.log(`System Architecture: ${systemArch}`);
    console.log(`Binary Path: ${binaryPath}\n`);
    
    const result = await verifySystemAudioDump(binaryPath);
    
    console.log('Results:');
    console.log(`  ✓ Exists: ${result.exists}`);
    console.log(`  ✓ Executable: ${result.executable}`);
    console.log(`  ✓ Architectures: ${result.architectures.join(', ')}`);
    console.log(`  ✓ Supports ${systemArch}: ${result.supportsCurrentArch}`);
    console.log(`  ✓ Signed: ${result.signed} (${result.signatureType})`);
    console.log(`  ✓ Valid: ${result.signatureValid}\n`);
    
    if (result.errors.length > 0) {
        console.log('❌ Errors:');
        result.errors.forEach(e => console.log(`  - ${e}`));
        process.exit(1);
    }
    
    if (result.warnings.length > 0) {
        console.log('⚠️  Warnings:');
        result.warnings.forEach(w => console.log(`  - ${w}`));
    }
    
    console.log('\n✅ Binary verification passed!');
}

main().catch(console.error);
```

Run with:
```bash
node verify-binary.js
```

## API Reference

### architectureDetection.js

#### `getSystemArchitecture()`

Returns the current system architecture in macOS format.

**Returns:** `'x86_64' | 'arm64'`

**Example:**
```javascript
const arch = getSystemArchitecture();
console.log(arch); // 'x86_64' or 'arm64'
```

#### `getBinaryArchitectures(binaryPath, execSyncFn?)`

Gets all architectures supported by a binary.

**Parameters:**
- `binaryPath` (string): Path to the binary file
- `execSyncFn` (Function, optional): Custom execSync function for testing

**Returns:** `Promise<string[]>` - Array of architecture strings

**Example:**
```javascript
const archs = await getBinaryArchitectures('/path/to/binary');
console.log(archs); // ['x86_64', 'arm64']
```

#### `binarySupportsArchitecture(binaryPath, requiredArch, execSyncFn?)`

Checks if a binary supports a specific architecture.

**Parameters:**
- `binaryPath` (string): Path to the binary file
- `requiredArch` (string): Required architecture ('x86_64' or 'arm64')
- `execSyncFn` (Function, optional): Custom execSync function for testing

**Returns:** `Promise<boolean>`

**Example:**
```javascript
const supported = await binarySupportsArchitecture('/path/to/binary', 'arm64');
console.log(supported); // true or false
```

### binaryVerification.js

#### `checkCodeSignature(binaryPath, execSyncFn?)`

Checks the code signature status of a binary.

**Parameters:**
- `binaryPath` (string): Path to the binary file
- `execSyncFn` (Function, optional): Custom execSync function for testing

**Returns:** `Promise<SignatureInfo>`

**SignatureInfo Type:**
```typescript
{
    signed: boolean;
    signatureType: 'adhoc' | 'developer' | 'none';
    identifier: string;
    teamId: string | null;
    valid: boolean;
    entitlements: string[];
}
```

**Example:**
```javascript
const sig = await checkCodeSignature('/path/to/binary');
console.log(`Signed: ${sig.signed}, Type: ${sig.signatureType}`);
```

#### `verifySystemAudioDump(binaryPath, options?)`

Performs comprehensive verification of the SystemAudioDump binary.

**Parameters:**
- `binaryPath` (string): Path to the binary file
- `options` (Object, optional): Testing options
  - `execSyncFn` (Function): Custom execSync function
  - `existsSyncFn` (Function): Custom fs.existsSync function
  - `accessSyncFn` (Function): Custom fs.accessSync function

**Returns:** `Promise<VerificationResult>`

**VerificationResult Type:**
```typescript
{
    exists: boolean;
    executable: boolean;
    architectures: string[];
    supportsCurrentArch: boolean;
    signed: boolean;
    signatureValid: boolean;
    signatureType: 'adhoc' | 'developer' | 'none';
    errors: string[];
    warnings: string[];
}
```

**Example:**
```javascript
const result = await verifySystemAudioDump('/path/to/SystemAudioDump');

if (result.errors.length > 0) {
    console.error('Verification failed:', result.errors);
} else {
    console.log('Verification passed!');
}
```

## See Also

- [Building Universal Binary](./BUILD_UNIVERSAL_BINARY.md) - Instructions for building the universal binary
- [Error Handling and Fallbacks](./ERROR_HANDLING.md) - Error diagnosis and fallback methods
- [Audio Capture Manager](../src/utils/audioCaptureManager.js) - Main audio capture coordinator
