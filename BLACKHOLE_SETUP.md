# BlackHole Setup Guide for Prism

## Why Use BlackHole?

BlackHole allows Prism to capture system audio in **true stealth/background mode** without the `-3821 error` that occurs with SystemAudioDump when the app loses focus.

**Benefits:**
- ✅ Works perfectly in background (no visibility required)
- ✅ No -3821 "Stream stopped by system" errors
- ✅ Uses standard microphone permission (no Screen Recording permission needed)
- ✅ Free and open source
- ✅ Compatible with all recent macOS versions

## Installation (5-10 minutes, one-time setup)

### Step 1: Download and Install BlackHole

1. Visit: https://github.com/ExistentialAudio/BlackHole/releases
2. Download **BlackHole 2ch.pkg** (stereo version - ~2MB)
3. Open the PKG file and follow the installer
4. **No restart required**

### Step 2: Create Multi-Output Device

This allows system audio to play through BOTH your speakers AND BlackHole simultaneously.

1. Open **Audio MIDI Setup** app
   - Location: `/Applications/Utilities/Audio MIDI Setup.app`
   - Or: Spotlight search for "Audio MIDI Setup"

2. Click the **"+"** button at the bottom-left corner

3. Select **"Create Multi-Output Device"**

4. In the new Multi-Output Device panel:
   - ✅ Check your actual speakers/headphones (e.g., "MacBook Air Speakers" or "External Headphones")
   - ✅ Check **"BlackHole 2ch"**
   - ⚠️ **IMPORTANT**: Your speakers MUST be listed FIRST (above BlackHole) for proper playback

5. **Optional but recommended**: Right-click the Multi-Output Device and select **"Use This Device For Sound Output"**
   - This sets it as your system default output
   - Alternatively, you can manually select it in System Settings → Sound

### Step 3: Set as System Default (Optional)

**Option A - Via Audio MIDI Setup:**
- Right-click the Multi-Output Device → "Use This Device For Sound Output"

**Option B - Via System Settings:**
1. Open **System Settings → Sound**
2. In the **Output** tab, select your "Multi-Output Device"

### Step 4: Verify Setup

1. Play any audio (e.g., YouTube video, music)
2. You should hear sound normally through your speakers
3. Start Prism in "speaker only" mode
4. Check Terminal logs for: `✅ BlackHole detected: BlackHole 2ch`

If you see this message, congratulations! Prism will now capture system audio in background mode.

## How It Works

```
System Audio → Multi-Output Device → ┬→ Your Speakers (you hear this)
                                     └→ BlackHole (Prism captures this)
```

- All system audio is duplicated
- Your speakers play normally (you hear everything)
- BlackHole acts as a "silent loopback" that Prism captures from
- Prism sees BlackHole as a microphone input device

## Troubleshooting

### "No audio captured" / "BlackHole not detected"

**Check if BlackHole is installed:**
```bash
ls -la /Library/Audio/Plug-Ins/HAL/BlackHole2ch.driver
```

If not found, reinstall BlackHole.

**Check if Multi-Output Device is active:**
1. Open System Settings → Sound
2. Verify "Multi-Output Device" is selected as output
3. Play audio and verify you can hear it

**Check device permissions:**
1. Restart Prism
2. When prompted for microphone access, click "Allow"
3. Prism needs microphone permission to access BlackHole

### "I hear audio, but Prism doesn't capture"

**Verify BlackHole is in Multi-Output:**
1. Open Audio MIDI Setup
2. Select your Multi-Output Device
3. Ensure BlackHole 2ch is checked

**Check audio mode:**
1. In Prism settings, verify audio mode is "Speaker Only" or "Both"
2. "Mic Only" mode will not use BlackHole

### "Prism still uses SystemAudioDump"

Check Terminal logs when starting session:
- If you see: `✅ BlackHole detected` → BlackHole is being used ✓
- If you see: `BlackHole not detected - using SystemAudioDump fallback` → BlackHole not found

**Fix:**
1. Restart Prism completely
2. Check that Multi-Output Device is set as system output
3. Verify microphone permission is granted to Prism

## Uninstalling BlackHole

If you want to remove BlackHole:

1. Open Audio MIDI Setup
2. Delete the Multi-Output Device (select it and press Delete)
3. Set your normal speakers as default output in System Settings → Sound
4. Remove the driver:
   ```bash
   sudo rm -rf /Library/Audio/Plug-Ins/HAL/BlackHole2ch.driver
   ```
5. Restart your Mac

Prism will automatically fall back to SystemAudioDump.

## Alternative: Soundflower

**Note:** Soundflower is deprecated (last updated 2020). Use BlackHole instead.

If you already have Soundflower installed, Prism will detect it the same way as BlackHole.

## Technical Details

**Audio Format:**
- Sample Rate: 24kHz (matches Gemini Live API)
- Channels: 1 (mono - converted from stereo)
- Bit Depth: 16-bit PCM
- Latency: ~100ms

**Permissions Required:**
- ✅ Microphone access (standard macOS permission)
- ❌ Screen Recording NOT required (unlike SystemAudioDump)

**Compatibility:**
- macOS 10.13 (High Sierra) and later
- Apple Silicon (M1/M2/M3) and Intel Macs
- Works with all Electron versions

## Support

For BlackHole issues: https://github.com/ExistentialAudio/BlackHole/issues
For Prism issues: Check Terminal logs and submit issue with full error output
