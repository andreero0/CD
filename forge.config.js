const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const { getBinaryArchitectures } = require('./src/utils/architectureDetection');
const path = require('path');
const fs = require('fs');

module.exports = {
    packagerConfig: {
        asar: true,
        extraResource: ['./src/assets/SystemAudioDump'],
        name: 'Prism',
        icon: 'src/assets/logo',
        // Code signing configuration for macOS
        // Use `security find-identity -v -p codesigning` to find your identity
        // For development builds, adhoc signing will be used automatically
        // For distribution, uncomment and configure with your developer certificate
        osxSign: process.env.APPLE_IDENTITY ? {
            identity: process.env.APPLE_IDENTITY,
            optionsForFile: (filePath) => {
                return {
                    entitlements: 'entitlements.plist',
                    hardenedRuntime: true,
                };
            },
        } : undefined,
        // Notarization configuration (optional, for distribution)
        // Set environment variables: APPLE_ID, APPLE_ID_PASSWORD, APPLE_TEAM_ID
        osxNotarize: process.env.APPLE_ID ? {
            appleId: process.env.APPLE_ID,
            appleIdPassword: process.env.APPLE_ID_PASSWORD,
            teamId: process.env.APPLE_TEAM_ID,
        } : undefined,
        afterCopy: [
            async (buildPath, electronVersion, platform, arch, callback) => {
                // Only verify on macOS builds
                if (platform !== 'darwin') {
                    console.log(`[Build] Skipping SystemAudioDump verification for platform: ${platform}`);
                    callback();
                    return;
                }

                console.log('[Build] Verifying SystemAudioDump binary...');
                
                const binaryPath = path.join(__dirname, 'src', 'assets', 'SystemAudioDump');
                
                // Check if binary exists
                if (!fs.existsSync(binaryPath)) {
                    const error = new Error(
                        `SystemAudioDump binary not found at ${binaryPath}. ` +
                        'Please build the binary before packaging the application.'
                    );
                    callback(error);
                    return;
                }

                try {
                    // Get binary architectures
                    const architectures = await getBinaryArchitectures(binaryPath);
                    
                    console.log(`[Build] SystemAudioDump architectures: ${architectures.join(', ')}`);
                    
                    // Verify it's a universal binary with both x86_64 and arm64
                    const hasX86_64 = architectures.includes('x86_64');
                    const hasArm64 = architectures.includes('arm64');
                    
                    if (!hasX86_64 || !hasArm64) {
                        const error = new Error(
                            `SystemAudioDump must be a universal binary containing both x86_64 and arm64 architectures. ` +
                            `Found: ${architectures.join(', ')}. ` +
                            'Please rebuild the binary using: ' +
                            'clang -arch x86_64 -arch arm64 -o SystemAudioDump SystemAudioDump.c -framework CoreAudio -framework AudioToolbox'
                        );
                        callback(error);
                        return;
                    }
                    
                    console.log('[Build] ✓ SystemAudioDump is a valid universal binary');
                    callback();
                } catch (error) {
                    const buildError = new Error(
                        `Failed to verify SystemAudioDump binary: ${error.message}. ` +
                        'Ensure the binary is a valid Mach-O executable.'
                    );
                    callback(buildError);
                }
            }
        ],
    },
    rebuildConfig: {},
    makers: [
        {
            name: '@electron-forge/maker-squirrel',
            config: {
                name: 'prism',
                productName: 'Prism',
                shortcutName: 'Prism',
                createDesktopShortcut: true,
                createStartMenuShortcut: true,
            },
        },
        {
            name: '@electron-forge/maker-dmg',
            platforms: ['darwin'],
        },
        {
            name: '@reforged/maker-appimage',
            platforms: ['linux'],
            config: {
                options: {
                    name: 'Prism',
                    productName: 'Prism',
                    genericName: 'AI Assistant',
                    description: 'AI assistant for interviews and learning',
                    categories: ['Development', 'Education'],
                    icon: 'src/assets/logo.png'
                }
            },
        },
    ],
    plugins: [
        {
            name: '@electron-forge/plugin-auto-unpack-natives',
            config: {},
        },
        // Fuses are used to enable/disable various Electron functionality
        // at package time, before code signing the application
        new FusesPlugin({
            version: FuseVersion.V1,
            [FuseV1Options.RunAsNode]: false,
            [FuseV1Options.EnableCookieEncryption]: true,
            [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
            [FuseV1Options.EnableNodeCliInspectArguments]: false,
            [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
            [FuseV1Options.OnlyLoadAppFromAsar]: true,
        }),
    ],
};
