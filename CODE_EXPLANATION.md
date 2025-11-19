# Cheating Daddy - Complete Code Explanation

This document provides a line-by-line explanation of every file in the Cheating Daddy codebase.

## Table of Contents

1. [Configuration Files](#configuration-files)
2. [Main Process](#main-process)
3. [Utilities](#utilities)
4. [Components](#components)
5. [Architecture Overview](#architecture-overview)

---

## Configuration Files

### 1. package.json - Project Configuration

**Line 2:** `"name": "cheating-daddy"` - Package name used internally by npm

**Line 3:** `"productName": "cheating-daddy"` - User-facing product name in app title bar

**Line 4:** `"version": "0.4.0"` - Semantic version (major.minor.patch), pre-1.0 indicates beta

**Line 6:** `"main": "src/index.js"` - Entry point - tells Electron which file to run first

**Scripts:**
- Line 8: `"start": "electron-forge start"` - Runs development version
- Line 9: `"package": "electron-forge package"` - Creates executable
- Line 10: `"make": "electron-forge make"` - Creates platform-specific installers
- Line 11: `"publish": "electron-forge publish"` - Publishes to distribution channels
- Line 13: `"test": "vitest run"` - Runs test suite

**Dependencies:**
- Line 28: `"@google/genai": "^1.2.0"` - Google Gemini AI SDK
- Line 29: `"electron-squirrel-startup": "^1.0.1"` - Handles Windows installer events

**Dev Dependencies:**
- Lines 32-37: Electron Forge makers for different platforms (deb, dmg, rpm, squirrel, zip)
- Line 42: `"vitest": "^1.6.1"` - Testing framework
- Line 44: `"electron": "^30.0.5"` - Electron framework itself

---

### 2. forge.config.js - Electron Build Configuration

**Line 6:** `asar: true` - Packages all files into single .asar archive for obfuscation and performance

**Line 7:** `extraResource: ['./src/assets/SystemAudioDump']` - Includes macOS audio capture utility outside ASAR

**Line 9:** `icon: 'src/assets/logo'` - App icon path (without extension)

**Lines 13-20:** Commented out macOS code signing configuration (requires Apple developer credentials)

**Lines 22-26:** Commented out macOS notarization (took 6+ hours, disabled)

**Windows Maker (Lines 30-39):**
- Line 31: Uses Squirrel for Windows installer
- Line 36: `createDesktopShortcut: true` - Adds icon to desktop
- Line 37: `createStartMenuShortcut: true` - Adds to start menu

**macOS Maker (Lines 40-43):**
- Line 41: Creates DMG disk image installer
- Line 42: `platforms: ['darwin']` - Only builds on/for macOS

**Linux Maker (Lines 44-57):**
- Line 45: Creates AppImage portable executable
- Line 53: `categories: ['Development', 'Education']` - Menu categories

**Fuses Plugin (Lines 66-74):**
- Line 68: `RunAsNode: false` - Disables Node execution (security)
- Line 69: `EnableCookieEncryption: true` - Encrypts stored cookies
- Line 70: `EnableNodeOptionsEnvironmentVariable: false` - Prevents NODE_OPTIONS injection
- Line 72: `EnableEmbeddedAsarIntegrityValidation: true` - Validates ASAR not tampered with
- Line 73: `OnlyLoadAppFromAsar: true` - Prevents loading code outside ASAR

---

### 3. vitest.config.js - Test Configuration

**Line 1:** Imports `defineConfig` helper for TypeScript-like intellisense

**Line 6:** `environment: 'node'` - Tests run in Node.js environment (not browser DOM)

**Line 7:** `include: ['src/__tests__/**/*.test.js']` - Glob pattern for test files

**Line 8:** `globals: true` - Injects test functions (describe, it, expect) globally

**Line 10:** `reporter: ['text']` - Coverage reports display in terminal

**Line 15:** `electron: path.resolve(__dirname, 'src/__mocks__/electron.js')` - Aliases Electron imports to mock file for testing

---

## Main Process

### 4. src/index.js - Electron Main Process Entry Point

**Lines 1-3:** Squirrel startup check - exits immediately if installer is running (prevents app opening during installation)

**Imports:**
- Line 5: Core Electron APIs (app, BrowserWindow, shell, ipcMain)
- Line 6: Window management utilities
- Line 7: Gemini AI integration
- Line 8: Process name randomization for stealth
- Line 9: Anti-detection features
- Line 10: Configuration management

**Line 12:** `geminiSessionRef = { current: null }` - Mutable object reference for AI session (passed by reference)

**Line 16:** `initializeRandomProcessNames()` - Generates random process names for stealth immediately on startup

**Lines 23-30:** App initialization on ready:
- Line 25: Applies anti-analysis measures (random delays, console clearing)
- Line 27: Creates main window
- Line 28: Sets up Gemini IPC handlers
- Line 29: Sets up general IPC handlers

**Lines 32-37:** Window close handler - quits on Windows/Linux, stays open on macOS (OS convention)

**Lines 51-61:** `set-onboarded` IPC handler - marks onboarding as completed

**Lines 63-78:** `set-stealth-level` handler - validates and saves stealth level ('visible', 'balanced', 'ultra')

**Lines 80-95:** `set-layout` handler - validates and saves layout mode ('normal', 'compact')

**Lines 107-116:** `quit-application` handler - stops audio capture and quits app

**Lines 118-126:** `open-external` handler - opens URLs in system default browser (security: not in-app)

**Lines 134-148:** `update-content-protection` handler - enables/disables screenshot protection

**Lines 150-157:** `get-random-display-name` handler - returns stealth display name

---

### 5. src/preload.js - Electron Preload Script

This file is essentially empty (just boilerplate comments). The app uses `nodeIntegration: true` instead of a traditional preload script, which is less secure but allows direct Node.js access in renderer.

---

### 6. src/config.js - Application Configuration Management

**Lines 6-10:** Default configuration with onboarding flag, stealth level, and layout mode

**Lines 13-29:** `getConfigDir()` - Returns platform-specific config directory:
- Windows: `%APPDATA%\cheating-daddy-config`
- macOS: `~/Library/Application Support/cheating-daddy-config`
- Linux: `~/.config/cheating-daddy-config`

**Lines 36-41:** `ensureConfigDir()` - Creates config directory if doesn't exist (recursive creation)

**Lines 44-57:** `readExistingConfig()` - Reads config.json, returns empty object on error (graceful degradation)

**Lines 60-70:** `writeConfig()` - Writes config to file, throws error on failure

**Lines 73-84:** `mergeWithDefaults()` - Merges existing config with defaults, adds missing keys

**Lines 87-112:** `getLocalConfig()` - Main function:
- Ensures directory exists
- Reads existing config
- Merges with defaults
- Updates file if new keys added
- Returns complete config or defaults on error

---

### 7. src/audioUtils.js - Audio Processing Utilities

**Lines 5-39:** `pcmToWav()` - Converts raw PCM to WAV format:
- Line 6: Calculates byte rate (samples/sec × channels × bytes/sample)
- Lines 11-30: Creates 44-byte WAV header with RIFF structure
- Line 33: Combines header with PCM data
- Returns playable WAV file path

**Lines 42-84:** `analyzeAudioBuffer()` - Analyzes audio for debugging:
- Line 43: Creates Int16Array view of buffer
- Lines 51-61: Calculates min, max, average, RMS, silent samples
- Lines 68-74: Logs statistics (samples, range, RMS, silence %, dynamic range in dB)
- Returns analysis object

**Lines 87-129:** `saveDebugAudio()` - Saves audio with metadata:
- Line 89: Creates `~/cheddar/debug` directory
- Lines 95-97: Creates paths for PCM, WAV, and JSON files
- Line 100: Saves raw PCM
- Line 103: Converts to WAV
- Lines 107-124: Saves metadata JSON with timestamp, analysis, and format info

---

## Utilities

### 8. src/utils/gemini.js - Gemini AI Integration

**State Variables:**
- Line 8: `currentSessionId` - Unique session ID (timestamp)
- Line 9: `currentTranscription` - Accumulates transcribed audio
- Line 10: `conversationHistory` - Array of Q&A pairs
- Line 27: `systemAudioProc` - Reference to audio capture process

**Lines 13-22:** `formatSpeakerResults()` - Formats speaker diarization:
- Maps speakerId 1 to "Interviewer", others to "Candidate"
- Returns formatted transcript with speaker labels

**Lines 44-49:** `initializeNewSession()` - Creates new conversation session with timestamp ID

**Lines 51-71:** `saveConversationTurn()` - Saves Q&A pair to history and IndexedDB

**Lines 80-109:** `sendReconnectionContext()` - Sends conversation history to reconnected session for context continuity

**Lines 111-126:** `getEnabledTools()` - Returns array of AI tools (Google Search if enabled)

**Lines 161-205:** `attemptReconnection()` - Automatic reconnection with exponential backoff (max 3 attempts, 2s delay)

**Lines 207-359:** `initializeGeminiSession()` - Main session initialization:
- Line 227: Creates GoogleGenAI client
- Line 233: Gets enabled tools
- Line 236: Gets system prompt for profile
- Lines 244-348: Connects to Gemini Live API with callbacks:
  - `onopen`: Connection established
  - `onmessage`: Handles transcription and AI responses (streaming)
  - `onerror`: Error handling with API key detection
  - `onclose`: Reconnection logic
- Line 334: `responseModalities: ['TEXT']` - Text-only responses
- Lines 337-341: Speaker diarization config (2 speakers: interviewer + candidate)

**Lines 392-484:** `startMacOSAudioCapture()` - Starts SystemAudioDump on macOS:
- Line 396: Kills existing instances first
- Lines 404-408: Determines path (packaged vs development)
- Line 429: Spawns SystemAudioDump process
- Lines 438-442: Audio chunk configuration (24kHz, 16-bit, 100ms chunks)
- Lines 446-467: Processes audio data:
  - Accumulates into buffer
  - Extracts chunks when enough data
  - Converts stereo to mono
  - Encodes base64
  - Sends to Gemini

**Lines 486-496:** `convertStereoToMono()` - Extracts left channel only

**Lines 522-687:** `setupGeminiIpcHandlers()` - Registers all IPC handlers:
- `initialize-gemini`: Starts AI session
- `send-audio-content`: System audio
- `send-mic-audio-content`: Microphone audio
- `send-image-content`: Screenshots
- `send-text-message`: Text messages
- `start-macos-audio`: Audio capture
- `close-session`: Cleanup

---

### 9. src/utils/prompts.js - AI System Prompt Templates

**Lines 1-202:** `profilePrompts` object with 6 profiles:

**Interview Profile (Lines 2-37):**
- Acts as discreet teleprompter
- Provides 1-3 sentence responses
- Uses markdown formatting
- Searches Google for recent information
- Examples show direct, ready-to-speak style

**Sales Profile (Lines 39-68):**
- Provides persuasive sales responses
- Focuses on value and objection handling
- Searches for competitor info and market data

**Meeting Profile (Lines 70-99):**
- Professional meeting responses
- Clear, action-oriented
- Project status, budgets, next steps

**Presentation Profile (Lines 101-130):**
- Confident presentation answers
- Data-backed claims
- Scaling and growth strategies

**Negotiation Profile (Lines 132-161):**
- Strategic negotiation responses
- Win-win focus
- Addresses price objections

**Exam Profile (Lines 163-201):**
- Direct exam answers
- Minimal explanation
- Format: Question → Answer → Brief justification

**Lines 204-215:** `buildSystemPrompt()` - Assembles complete prompt:
- Combines intro, format requirements, search usage (if enabled), content, custom prompt, and output instructions

**Lines 217-220:** `getSystemPrompt()` - Main public function, falls back to interview profile if invalid

---

### 10. src/utils/processNames.js - Random Process Name Generation

**Lines 4-36:** `prefixes` array - System/company names (System, Microsoft, Google, Chrome, etc.)

**Lines 38-68:** `suffixes` array - Process types (Manager, Service, Helper, Agent, etc.)

**Lines 70-87:** `extensions` array - Version suffixes (Pro, Plus, 2024, 365, etc.)

**Lines 90-107:** `companies` array - Major tech companies

**Lines 117-130:** `generateRandomProcessName()` - Combines random parts:
- Selects random prefix, suffix, and optionally extension
- Optionally prepends company name (50% chance if enabled)
- Examples: "SystemManager", "Microsoft AudioHelperPro"

**Lines 136-139:** `generateRandomExecutableName()` - Lowercase, hyphenated version for process name

**Lines 146-151:** `getCurrentRandomName()` - Singleton pattern, generates once and caches

**Lines 185-205:** `generateRandomWindowTitle()` - Random legitimate-sounding window title from predefined list

---

### 11. src/utils/processRandomizer.js - Apply Random Process Names

**Lines 9-28:** `initializeRandomProcessNames()` - Main initialization:
- Generates random names
- Logs names for verification
- Calls `setRandomProcessTitle()`
- Returns object with all names

**Lines 34-44:** `setRandomProcessTitle()` - Changes process name:
- Line 37: `process.title = randomProcessName` - **Critical line** that changes Task Manager name
- Effect: Process appears as "systemmanager" instead of "electron" or "cheating-daddy"

---

### 12. src/utils/renderer.js - Renderer Process Utilities

**Lines 4-17:** Random display name initialization from main process

**Lines 19-27:** Media capture state variables (mediaStream, audioContext, etc.)

**Lines 37-125:** `tokenTracker` object - Sophisticated rate limiting:
- Line 56: `calculateImageTokens()` - Gemini 2.0 pricing: 258 tokens per 768×768 tile
- Line 71: `trackAudioTokens()` - 32 tokens per second
- Line 102: `shouldThrottle()` - Checks if approaching rate limit (default 75% of max)

**Lines 132-140:** `convertFloat32ToInt16()` - Converts Web Audio API float32 to PCM int16

**Lines 152-162:** `initializeGemini()` - Initializes Gemini session with profile and language

**Lines 177-356:** `startCapture()` - Platform-specific media capture:
- **macOS (Lines 188-228):** SystemAudioDump for audio, getDisplayMedia for screen
- **Linux (Lines 229-291):** getDisplayMedia with audio fallback
- **Windows (Lines 292-333):** getDisplayMedia with loopback audio
- Line 347: Starts screenshot interval (or manual mode)

**Lines 451-550:** `captureScreenshot()` - Screenshot capture with rate limiting:
- Lines 456-459: Skips automated screenshots if throttled
- Lines 462-479: Lazy initialization of video and canvas
- Lines 515-549: Converts to JPEG, sends to main process, tracks tokens

**Lines 552-562:** `captureManualScreenshot()` - Manual screenshot with auto-prompt for help

**Lines 635-655:** `initConversationStorage()` - Creates IndexedDB for conversation history

**Lines 752-786:** `cheddar` object - Global API exposing all functions

---

### 13. src/utils/stealthFeatures.js - Stealth and Anti-Detection

**Lines 9-65:** `applyStealthMeasures()` - Multiple stealth techniques:
- Line 15: `setSkipTaskbar(true)` - Hides from Windows taskbar/Alt+Tab
- Line 25: `setHiddenInMissionControl(true)` - Hides from macOS Mission Control
- Line 37: `app.setName(randomName)` - Changes macOS menu bar name
- Line 46: `setContentProtection(true)` - Prevents screenshots
- Line 60: `setUserAgent(randomUA)` - Randomizes user agent

**Lines 71-109:** `startTitleRandomization()` - Changes window title every 30-60 seconds

**Lines 114-127:** `applyAntiAnalysisMeasures()` - Anti-debugging:
- Line 119: Clears console in production
- Line 123: Random startup delay (1-4 seconds) to avoid pattern detection

---

### 14. src/utils/window.js - Window Management

**Lines 28-140:** `createWindow()` - Window factory:
- Line 36: `frame: false` - Frameless window (custom UI)
- Line 37: `transparent: true` - Transparent background
- Line 39: `alwaysOnTop: true` - Always above other windows
- Line 43: `nodeIntegration: true` - Enables Node.js in renderer (security risk but needed)
- Line 44: `contextIsolation: false` - **TODO:** Should be true for security
- Line 64: `setContentProtection(true)` - Prevents screenshots
- Lines 68-72: Centers window at top of screen
- Lines 87-90: Applies stealth measures and starts title randomization

**Lines 142-158:** `getDefaultKeybinds()` - Platform-specific shortcuts:
- Movement: Ctrl/Alt + Arrow Keys
- Toggle visibility: Ctrl/Cmd + \
- Click-through: Ctrl/Cmd + M
- Emergency erase: Ctrl/Cmd + Shift + E

**Lines 160-345:** `updateGlobalShortcuts()` - Registers keyboard shortcuts:
- Lines 171-192: Window movement (10% of screen per press)
- Lines 208-221: Toggle visibility (hide/show window)
- Lines 224-241: Click-through mode (passes clicks to windows below)
- Lines 244-265: Next step (context-aware: start session or screenshot)
- Lines 320-344: Emergency erase (hides window, clears data, quits app)

**Lines 384-465:** `animateWindowResize()` - Smooth 60fps resize animation with ease-out

**Lines 467-535:** `update-sizes` IPC handler - Resizes window based on view and layout mode

---

### 15. src/utils/windowResize.js - Window Resize Utility

**Lines 1-15:** `resizeLayout()` - Simple wrapper that calls `update-sizes` IPC handler

---

## Components

### 16. src/components/index.js - Component Exports

Barrel export file that re-exports all components for easier imports.

---

### 17. src/components/app/CheatingDaddyApp.js - Main App Component

**Lines 12-97:** Styles with CSS custom properties for theming, animations, and scrollbar customization

**Lines 99-117:** Properties - currentView, statusText, responses, layout settings, etc.

**Lines 119-142:** Constructor - Initializes from localStorage, determines initial view (onboarding vs main)

**Lines 144-170:** Lifecycle - Sets up IPC listeners for responses, status, and click-through

**Lines 172-213:** State management:
- `setStatus()` - Updates status, marks response complete on certain messages
- `setResponse()` - Complex logic for streaming vs new responses, detects filler responses

**Lines 216-353:** Event handlers for all child component events (navigation, settings changes, etc.)

**Lines 267-286:** `handleStart()` - Validates API key, initializes Gemini, starts capture, switches to assistant view

**Lines 355-392:** `updated()` - Saves changed properties to localStorage, triggers view animations

**Lines 394-461:** `renderCurrentView()` - Switch statement rendering appropriate view component

**Lines 463-491:** `render()` - Main template with header and content area

**Lines 493-518:** Layout management - Applies/removes compact layout class

---

### 18. src/components/app/AppHeader.js - Header Component

**Lines 12-19:** Header styles with draggable region (`-webkit-app-region: drag`)

**Lines 28-33:** Actions area with `no-drag` to allow button clicks

**Lines 91-104:** Properties including currentView, statusText, event handlers

**Lines 123-153:** Timer management - Starts/stops elapsed time counter based on view

**Lines 155-173:** Timer methods - Updates every second when in assistant view

**Lines 175-194:** Helper methods - Gets view title, elapsed time, checks if navigation view

**Lines 201-412:** Render method with conditional buttons:
- Main view: History, Advanced (if enabled), Customize, Help buttons
- Assistant view: Elapsed time, status, Hide button, Close button
- Other views: Smart close button (back vs quit based on context)

---

### 19. src/components/views/OnboardingView.js - Welcome Wizard

**Lines 4-208:** Extensive styles for fullscreen experience with glass morphism

**Lines 217-281:** Constructor with color schemes for each slide (very dark, subtle variations)

**Lines 283-290:** `firstUpdated()` - Gets canvas, starts gradient animation

**Lines 300-306:** `resizeCanvas()` - Matches canvas to component size

**Lines 308-317:** `startGradientAnimation()` - RequestAnimationFrame loop

**Lines 319-385:** `drawGradient()` - Complex gradient rendering:
- Interpolates between color schemes during transitions
- Creates flowing linear gradient with sin/cos movement
- Overlays radial gradient for depth
- Very subtle, slow animation for ambient effect

**Lines 387-406:** Navigation methods with smooth color transitions

**Lines 409-423:** Helper methods - Color interpolation and easing function

**Lines 437-470:** `getSlideContent()` - Defines 5 slides with icons, titles, content

**Lines 472-548:** Render method:
- Canvas background
- Slide content (icon, title, text)
- Conditional textarea (slide 2) for user context
- Conditional feature list (slide 3)
- Navigation bar with prev/next buttons and progress dots

---

### 20. src/components/views/MainView.js - Main Configuration View

**Lines 5-144:** Styles including red blink animation for API key error

**Lines 146-152:** Properties - event handlers, initialization flag, error flag

**Lines 164-177:** `connectedCallback()` - Listens for session-initializing event, adds keyboard listener, loads layout, resizes window

**Lines 186-194:** `handleKeydown()` - Ctrl/Cmd+Enter shortcut to start session

**Lines 196-202:** `handleInput()` - Saves API key to localStorage as user types, clears error

**Lines 230-236:** `triggerApiKeyError()` - Shows red blink animation for 1 second

**Lines 238-282:** `getStartButtonText()` - Returns platform-appropriate text with keyboard shortcut icons

**Lines 284-305:** Render method:
- Welcome text
- Password input for API key with error class
- Start button with initializing state
- Help link to get API key

---

### 21. src/components/views/AssistantView.js - AI Response Display and Interaction

**Line 1:** Import Lit framework components (html, css, LitElement) from bundled assets

**Line 3:** Define AssistantView class extending LitElement

**Lines 4-292:** Component styles (CSS)

**Lines 5-9:** Host element styles - takes full height, flex column layout for vertical stacking

**Lines 11-14:** Global styles for all elements - Inter font, default cursor (non-selectable)

**Lines 16-27:** Response container:
- `height: calc(100% - 60px)` - Takes all space except 60px for text input
- `overflow-y: auto` - Allows vertical scrolling for long responses
- `font-size: var(--response-font-size, 18px)` - Uses CSS custom property with 18px fallback
- `user-select: text` - Allows selecting AI response text for copying
- `cursor: text` - Shows text cursor when hovering over responses

**Lines 29-33:** Override text selection for all children - ensures all content is selectable

**Lines 36-38:** Restore pointer cursor for links so they look clickable

**Lines 40-50:** Word-by-word reveal animation:
- `[data-word]` - Selects spans with data-word attribute (created during markdown parsing)
- Initial state: `opacity: 0; filter: blur(10px)` - Words start invisible and blurred
- `display: inline-block` - Required for transform/filter effects to work
- `transition: opacity 0.5s, filter 0.5s` - Smooth fade-in over half second
- `.visible` class removes opacity and blur for final state

**Lines 52-82:** Markdown heading styles:
- Common styles (lines 53-62): Top/bottom margins, consistent color, semi-bold weight
- Individual sizes (lines 64-81): h1=1.8em down to h6=0.9em

**Lines 83-86:** Paragraph spacing and color

**Lines 88-97:** List styling:
- `padding-left: 2em` - Indents bullets/numbers
- `margin: 0.4em 0` - Spacing between list items

**Lines 99-105:** Blockquote styling:
- `border-left: 4px solid` - Blue accent bar on left
- `background: rgba(0, 122, 255, 0.1)` - Semi-transparent blue tint
- `font-style: italic` - Italicized text

**Lines 107-113:** Inline code styling:
- `background: rgba(255, 255, 255, 0.1)` - Subtle highlight
- `font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace` - Monospace fonts
- `font-size: 0.85em` - Slightly smaller than body text

**Lines 115-128:** Code block styling:
- `overflow-x: auto` - Horizontal scroll for long code lines
- `pre code` nested selector removes background/padding from inline code inside blocks

**Lines 130-137:** Link styling - themed color, underline on hover

**Lines 139-148:** Bold and italic text styling

**Lines 150-154:** Horizontal rule - simple border line with spacing

**Lines 156-172:** Table styling:
- `border-collapse: collapse` - Removes gaps between cells
- Cell borders and padding
- Header row gets background color and bold text

**Lines 174-190:** Custom scrollbar styling (WebKit browsers):
- 8px wide scrollbar
- Themed track and thumb colors
- Hover effect on thumb

**Lines 192-197:** Text input container - horizontal flex layout with 10px gap

**Lines 199-218:** Text input field:
- `flex: 1` - Takes all available space
- Themed colors for background, border, text
- Focus styles with blue border and box shadow
- Placeholder text color

**Lines 220-230:** Send button styling - transparent with themed color, circular

**Lines 232-256:** Navigation button (previous/next):
- Circular 36x36px buttons
- Transparent background, white color
- Hover effect with semi-transparent background
- Disabled state with reduced opacity
- SVG icons always white

**Lines 258-264:** Response counter (e.g., "3/10"):
- Small 12px font
- 60px minimum width
- Centered text
- Non-wrapping text

**Lines 266-291:** Save button:
- Similar to nav button styling
- `.saved` class changes color to green (#4caf50)
- `color: currentColor` on SVG inherits parent color

**Lines 294-301:** Component properties:
- `responses` (Array) - All AI responses in current session
- `currentResponseIndex` (Number) - Which response is currently displayed
- `selectedProfile` (String) - Current AI profile (interview, sales, etc.)
- `onSendText` (Function) - Callback for sending text messages to AI
- `shouldAnimateResponse` (Boolean) - Whether to animate word reveal
- `savedResponses` (Array) - User-bookmarked responses

**Lines 303-316:** Constructor:
- Initialize properties with default values
- `currentResponseIndex: -1` - No response selected initially
- `_lastAnimatedWordCount: 0` - Tracks animation progress
- Load saved responses from localStorage
- Try/catch ensures corrupt data doesn't break app

**Lines 318-327:** `getProfileNames()` - Maps profile IDs to user-friendly names:
- 'interview' → 'Job Interview'
- 'sales' → 'Sales Call'
- etc.

**Lines 329-334:** `getCurrentResponse()`:
- Returns current response if valid index exists
- Otherwise returns default message like "Hey, I'm listening to your Job Interview?"
- Personalizes message based on selected profile

**Lines 336-356:** `renderMarkdown(content)`:
- Checks if `marked` library is available on window object
- Configures marked with `breaks: true` (newlines become <br>), `gfm: true` (GitHub Flavored Markdown)
- `sanitize: false` - Trusts AI responses (no XSS risk from trusted source)
- Calls `marked.parse()` to convert markdown to HTML
- Wraps words in spans via `wrapWordsInSpans()` for animation
- Fallback to plain text if marked unavailable or parsing fails

**Lines 358-384:** `wrapWordsInSpans(html)`:
- Takes HTML string and wraps each word in `<span data-word>` for animation
- Creates DOM parser to work with HTML structure
- `tagsToSkip = ['PRE']` - Doesn't wrap words in code blocks (would break formatting)
- `wrap()` nested function:
  - Checks if node is text node and parent isn't in skip list
  - Splits text on whitespace: `/(\s+)/` preserves spaces in array
  - Creates span for each non-whitespace word
  - Preserves whitespace as text nodes
  - Recursively processes element children
- Returns modified HTML as string

**Lines 386-388:** `getResponseCounter()` - Returns "currentIndex + 1 / total" string (e.g., "3/10")

**Lines 390-400:** `navigateToPreviousResponse()`:
- Decrements index if not at first response
- Dispatches custom event so parent component can react
- Calls `requestUpdate()` to re-render component

**Lines 402-412:** `navigateToNextResponse()`:
- Increments index if not at last response
- Dispatches custom event
- Re-renders component

**Lines 414-420:** `scrollResponseUp()`:
- Gets response container DOM element
- Calculates 30% of container height
- Scrolls up by that amount (with max at 0 to prevent negative scroll)

**Lines 422-428:** `scrollResponseDown()`:
- Scrolls down by 30% of container height
- Prevents scrolling past bottom (scrollHeight - clientHeight)

**Lines 430-437:** `loadFontSize()`:
- Retrieves fontSize from localStorage
- Parses as integer with fallback to 20px
- Sets CSS custom property on document root
- Allows global font size customization

**Lines 439-474:** `connectedCallback()` - Called when component added to DOM:
- Calls parent class method
- Loads and applies font size
- Sets up IPC listeners for keyboard shortcuts:
  - `navigate-previous-response` - Left arrow key
  - `navigate-next-response` - Right arrow key
  - `scroll-response-up` - Up arrow key
  - `scroll-response-down` - Down arrow key
- Stores handler references for cleanup later

**Lines 476-495:** `disconnectedCallback()` - Called when component removed from DOM:
- Calls parent class method
- Removes all IPC listeners to prevent memory leaks
- Checks if handlers exist before removing

**Lines 497-504:** `handleSendText()`:
- Gets text input element from shadow DOM
- Checks if input has non-empty value
- Trims whitespace
- Clears input field
- Calls `onSendText` callback with message
- Allows user to send additional questions/clarifications to AI

**Lines 506-511:** `handleTextKeydown(e)`:
- Checks if Enter key pressed without Shift
- Prevents default (new line)
- Calls `handleSendText()` to send message
- Allows Shift+Enter for multi-line input

**Lines 513-520:** `scrollToBottom()`:
- Uses setTimeout to defer until after render
- Gets response container
- Sets scrollTop to scrollHeight (scrolls to bottom)
- Ensures newest content is visible

**Lines 522-537:** `saveCurrentResponse()`:
- Gets current response text
- Checks if not already saved
- Adds to savedResponses array with:
  - Response text
  - ISO timestamp
  - Current profile
- Persists to localStorage
- Triggers re-render to update save button appearance

**Lines 539-542:** `isResponseSaved()`:
- Checks if current response exists in savedResponses array
- Uses `some()` to find matching response text
- Returns boolean for save button state

**Lines 544-547:** `firstUpdated()`:
- Called after first render
- Calls parent method
- Triggers initial response content update

**Lines 549-557:** `updated(changedProperties)`:
- Called after every re-render
- Checks if responses or currentResponseIndex changed
- Resets `_lastAnimatedWordCount` when index changes (start animation from beginning)
- Updates response content in DOM

**Lines 559-590:** `updateResponseContent()`:
- Core method for updating displayed response
- Gets response container element
- Gets current response text
- Renders markdown to HTML
- Sets container innerHTML
- Handles word-by-word animation:
  - If animating: Makes previously animated words visible immediately
  - Animates new words with staggered delays (100ms between words)
  - Dispatches event when animation complete
  - Stores word count for next update
- If not animating: Makes all words visible immediately

**Lines 592-659:** `render()` method:
- Gets current response and counter text
- Checks if response is saved
- Returns HTML template:
  - **Line 598:** Response container div with id for DOM access
  - **Lines 600-656:** Text input container with:
    - Previous button (disabled if at first response)
    - Response counter (only shown if responses exist)
    - Save button (green if saved, with tooltip)
    - Text input field with Enter key handler
    - Next button (disabled if at last response)
- Uses inline SVG icons for all buttons
- Conditional rendering with `${condition ? html : ''}`

**Lines 661-662:** Register custom element as `<assistant-view>`

---

This component is the core AI interaction interface. It displays AI responses with beautiful markdown formatting and word-by-word reveal animations. Users can navigate through response history, save important responses, send follow-up questions, and customize the display. The code demonstrates advanced Lit patterns: shadow DOM, custom events, lifecycle methods, and sophisticated animation timing.

---

### 22. src/components/views/CustomizeView.js - Settings and Configuration Interface

**Lines 1-2:** Import Lit framework and window resize utility

**Line 4:** Define CustomizeView class extending LitElement

**Lines 5-399:** Component styles (extensive CSS for forms, sliders, tables)

**Lines 6-14:** Global element styles - Inter font stack with fallbacks, default cursor, no text selection

**Lines 16-21:** Host element:
- `display: block` - Takes full width
- `padding: 12px` - Inner spacing
- `max-width: 700px` - Prevents overly wide layout on large screens
- `margin: 0 auto` - Centers content

**Lines 23-27:** Settings container - grid layout with 12px gaps, bottom padding

**Lines 29-35:** Settings section card:
- Semi-transparent background with backdrop blur (glassmorphism effect)
- `backdrop-filter: blur(10px)` - Creates frosted glass effect
- Border and padding for clear separation

**Lines 37-55:** Section title styling:
- Flex layout with gap
- `::before` pseudo-element creates 3px blue accent bar
- Uppercase text with letter spacing for visual hierarchy

**Lines 57-73:** Form grid and responsive 2-column row layout:
- `grid-template-columns: 1fr 1fr` - Equal columns
- Media query collapses to single column on screens < 600px

**Lines 75-83:** Form group - flex column with gap, `.full-width` class spans both columns

**Lines 85-99:** Form label and description styling - smaller fonts, themed colors

**Lines 101-123:** Form control (inputs, selects, textareas):
- Dark translucent background
- Border transitions on focus and hover
- Blue focus ring with box shadow
- `transition: all 0.15s ease` - Smooth state changes

**Lines 125-133:** Custom select dropdown styling:
- `appearance: none` - Removes default arrow
- SVG arrow as background image (data URI)
- `background-position: right 8px center` - Positions custom arrow

**Lines 135-144:** Textarea specific:
- `resize: vertical` - Prevents horizontal resize
- `min-height: 60px` - Ensures usable size
- Placeholder color

**Lines 146-168:** Profile option and current selection badge:
- Green success color scheme
- Checkmark prefix via `::before`
- Pill-shaped badge with border

**Lines 170-186:** Keybind input field:
- Monospace font for better readability of keyboard shortcuts
- Center-aligned text
- Focus changes cursor and background

**Lines 188-207:** Reset keybinds button:
- Hover effects
- `transform: translateY(1px)` on active - subtle press effect

**Lines 209-272:** Keybinds table:
- `border-collapse: collapse` - Seamless borders
- Header row with background
- Row hover effect
- Special styling for last row (reset button)

**Lines 274-284:** Settings note - info box at bottom with light background

**Lines 286-310:** Checkbox group - flex layout with custom checkbox styles

**Lines 312-324:** Focus-visible indicators for accessibility

**Lines 326-398:** Slider styles:
- Container with header (label + value display)
- Range input with custom thumb (circular handle)
- Separate styles for WebKit and Mozilla browsers
- Hover effects on thumb
- Min/max labels below slider

**Lines 401-418:** Component properties:
- Profile, language, screenshot settings
- Layout mode and keybinds
- Feature flags (googleSearchEnabled, advancedMode)
- Background transparency and font size
- Callback functions for parent component

**Lines 420-452:** Constructor:
- Initialize all properties with defaults
- `keybinds = getDefaultKeybinds()` - Platform-specific shortcuts
- `googleSearchEnabled: true` - Search enabled by default
- `advancedMode: false` - Advanced features hidden initially
- `backgroundTransparency: 0.8` - 80% opaque
- `fontSize: 20` - 20px default
- Load all settings from localStorage

**Lines 454-460:** `connectedCallback()`:
- Load layout mode for display
- Call `resizeLayout()` to adjust window size for this view

**Lines 462-495:** `getProfiles()` - Returns array of 6 AI profiles:
- interview, sales, meeting, presentation, negotiation, exam
- Each with value, name, and description

**Lines 497-530:** `getLanguages()` - Returns 29 language options:
- English variants (US, UK, Australia, India)
- European languages (German, French, Spanish, Italian, etc.)
- Asian languages (Hindi, Japanese, Korean, Mandarin, etc.)
- Each with locale code (e.g., 'en-US') and display name

**Lines 532-541:** `getProfileNames()` - Simple mapping of profile IDs to display names

**Lines 543-547:** `handleProfileSelect(e)`:
- Updates selectedProfile from dropdown
- Saves to localStorage
- Calls onProfileChange callback

**Lines 549-553:** `handleLanguageSelect(e)` - Similar pattern for language selection

**Lines 555-559:** `handleScreenshotIntervalSelect(e)` - Saves screenshot frequency

**Lines 561-564:** `handleImageQualitySelect(e)` - Updates image quality setting

**Lines 566-570:** `handleLayoutModeSelect(e)` - Switches between normal/compact layout

**Lines 572-574:** `handleCustomPromptInput(e)` - Saves custom AI instructions to localStorage

**Lines 576-591:** `getDefaultKeybinds()`:
- Detects Mac vs PC via `cheddar.isMacOS` or navigator.platform
- Returns platform-appropriate shortcuts:
  - Mac: Cmd/Alt keys
  - PC: Ctrl keys
- Examples: Move window (Alt+Arrow), Toggle visibility (Cmd/Ctrl+\\), Navigate responses (Cmd/Ctrl+[ and ])

**Lines 593-603:** `loadKeybinds()`:
- Loads custom keybinds from localStorage
- Merges with defaults using spread operator
- Try/catch protects against corrupted data

**Lines 605-612:** `saveKeybinds()`:
- Persists to localStorage
- Sends to main process via IPC to update global shortcuts
- Main process needs to re-register Electron globalShortcuts

**Lines 614-618:** `handleKeybindChange(action, value)`:
- Updates keybinds object immutably
- Saves and triggers re-render

**Lines 620-628:** `resetKeybinds()`:
- Restores defaults
- Removes custom settings from localStorage
- Notifies main process

**Lines 630-688:** `getKeybindActions()` - Returns metadata for all 11 keyboard shortcuts:
- Window movement (up, down, left, right)
- Visibility toggle
- Click-through mode
- Ask next step (screenshot + AI)
- Response navigation (previous, next)
- Response scrolling (up, down)

**Lines 690-693:** `handleKeybindFocus(e)`:
- Updates placeholder text when input focused
- Selects all text for easy replacement

**Lines 695-763:** `handleKeybindInput(e)` - Complex keyboard capture logic:
- Prevents default to capture all keys
- Detects modifiers (Ctrl, Cmd, Alt, Shift)
- Handles special keys (arrows, Enter, Space, backslash)
- Converts keycode to readable name (e.g., 'ArrowUp' → 'Up')
- Skips if only modifier pressed (e.g., just Ctrl)
- Constructs keybind string (e.g., 'Cmd+Shift+Up')
- Gets action from data attribute
- Updates keybind and blurs input

**Lines 765-770:** `loadGoogleSearchSettings()`:
- Loads boolean from localStorage
- String comparison ('true' === 'true')

**Lines 772-787:** `handleGoogleSearchChange(e)`:
- Updates from checkbox state
- Converts boolean to string for storage
- Sends IPC message to main process
- Async/await with error handling

**Lines 789-794:** `loadLayoutMode()` - Simple localStorage load

**Lines 796-801:** `loadAdvancedModeSettings()` - Loads boolean from localStorage

**Lines 803-808:** `handleAdvancedModeChange(e)`:
- Updates advancedMode flag
- Saves to localStorage
- Calls callback (likely shows/hides Advanced tab)

**Lines 810-816:** `loadBackgroundTransparency()`:
- Loads float value with fallback to 0.8
- Calls `updateBackgroundTransparency()` to apply

**Lines 818-823:** `handleBackgroundTransparencyChange(e)`:
- Parses float from slider
- Saves and applies immediately

**Lines 825-837:** `updateBackgroundTransparency()` - Sets CSS custom properties:
- `--header-background`: Direct opacity value
- `--main-content-background`: Same opacity
- `--card-background`: 5% of opacity (very subtle)
- `--input-background`: 37.5% of opacity
- Various other elements scaled proportionally
- This creates a cohesive theme where all elements adjust together

**Lines 839-845:** `loadFontSize()` - Loads integer with 20px fallback

**Lines 847-852:** `handleFontSizeChange(e)` - Parses int, saves, applies

**Lines 854-857:** `updateFontSize()` - Sets `--response-font-size` CSS variable

**Lines 859-1227:** Massive `render()` method (368 lines of template)

**Lines 860-864:** Get data for rendering (profiles list, current selections)

**Lines 866-910:** AI Profile & Behavior section:
- Profile type dropdown with current selection badge
- Custom AI instructions textarea
- Placeholder shows current profile name
- Description explains how custom instructions augment base prompts

**Lines 912-930:** Audio & Microphone section:
- Audio mode dropdown (speaker only, mic only, or both)
- Stored directly in localStorage (no property binding)
- Describes which audio sources AI listens to

**Lines 932-954:** Stealth Profile section:
- Three levels: Visible, Balanced, Ultra-Stealth
- Alert when changed (requires restart)
- Controls process hiding, window opacity, etc.

**Lines 957-983:** Language & Audio section:
- Speech language dropdown
- 29 language options
- Current selection badge
- Affects speech recognition and AI voice

**Lines 985-1064:** Interface Layout section:
- Layout mode dropdown (normal vs compact)
- Dynamic description based on selection
- Background transparency slider (0-100%)
- Font size slider (12-32px)
- Both sliders show current value in badge
- Labels show min/max values

**Lines 1066-1121:** Screen Capture Settings section:
- Screenshot interval dropdown (manual, 1s, 2s, 5s, 10s)
- Dynamic description explains manual vs automatic
- Image quality dropdown (high, medium, low)
- Quality descriptions mention token usage trade-offs

**Lines 1123-1169:** Keyboard Shortcuts section:
- Table layout with action name/description and shortcut input
- Maps over `getKeybindActions()` array
- Each input is readonly (only accepts keyboard events, not typing)
- `data-action` attribute identifies which shortcut
- Reset button in table footer

**Lines 1173-1195:** Google Search section:
- Checkbox to enable/disable
- Description explains it allows up-to-date information
- Note that changes take effect on next session

**Lines 1197-1199:** Settings note - Explains auto-save behavior

**Lines 1201-1224:** Advanced Mode section (danger zone):
- Red/danger color scheme
- Warning emoji in title
- Checkbox to enable
- Explains it unlocks experimental features
- Mentions it adds navigation icon

**Lines 1230:** Register custom element as `<customize-view>`

---

This is the most complex component in the app - a comprehensive settings interface with 10 major sections. It manages 15+ localStorage keys, sends IPC messages to main process, uses platform detection for defaults, implements custom keyboard capture, and provides real-time visual feedback through CSS variables. The component demonstrates advanced form handling, state management, and cross-process communication.

---

### 23. src/components/views/AdvancedView.js - Advanced Settings and Data Management

**Lines 1-2:** Import Lit framework and window resize utility

**Line 4:** Define AdvancedView class

**Lines 5-320:** Component styles - danger zones, warning boxes, action buttons

**Lines 37-40:** Danger section styling - red color scheme for destructive actions

**Lines 77-103:** Warning and danger boxes:
- Yellow warning box for cautions
- Red danger box for critical warnings
- Flex layout with icon on left

**Lines 112-146:** Action buttons:
- General action button with hover effects
- Danger button variant with red colors
- `transform: translateY(1px)` on active for press effect

**Lines 155-173:** Status messages - success (green) and error (red) variants

**Lines 322-330:** Component properties:
- `isClearing` - Prevents double-click on delete
- `statusMessage` and `statusType` - For user feedback
- Token throttling settings
- Content protection setting

**Lines 332-348:** Constructor:
- `maxTokensPerMin: 1000000` - Default to Gemini 2.0 rate limit
- `throttleAtPercent: 75` - Start throttling at 75% of limit
- `contentProtection: true` - Screenshot protection enabled by default
- Load settings from localStorage

**Lines 350-354:** `connectedCallback()` - Resizes window for this view

**Lines 356-416:** `clearLocalData()` - Comprehensive data deletion:
- **Line 357:** Guard against concurrent execution
- **Line 366:** `localStorage.clear()` - Removes all settings
- **Line 369:** `sessionStorage.clear()` - Clears session data
- **Lines 372-383:** Deletes all IndexedDB databases:
  - Gets list of databases
  - Creates promise for each deletion
  - Handles blocked deletions gracefully
- **Lines 388-391:** Clears all Cache API entries
- **Line 393:** Success message with count of cleared items
- **Lines 397-406:** Auto-close sequence:
  - Shows "Closing..." message after 2 seconds
  - Sends quit IPC after 3 seconds total
  - Forces app restart with clean state

**Lines 419-433:** `loadRateLimitSettings()`:
- Loads three settings from localStorage
- String to boolean conversion for throttleTokens
- parseInt with fallback for numbers

**Lines 435-439:** `handleThrottleTokensChange()` - Toggle throttling on/off

**Lines 441-447:** `handleMaxTokensChange(e)`:
- Validates input is positive number
- Only saves if valid

**Lines 449-455:** `handleThrottlePercentChange(e)`:
- Validates 0-100 range
- Percentage determines when throttling activates

**Lines 457-467:** `resetRateLimitSettings()`:
- Restores defaults (1M tokens/min, 75% threshold)
- Removes custom settings from localStorage

**Lines 470-473:** `loadContentProtectionSetting()`:
- Defaults to true if not set
- Protects against screen recording by default

**Lines 475-490:** `handleContentProtectionChange(e)` - Critical security feature:
- Updates localStorage
- Sends IPC to main process
- Main process calls Electron's `setContentProtection()`
- Makes window invisible to screen capture tools in real-time

**Lines 494-627:** `render()` method with 3 sections:

**Lines 497-526:** Content Protection section:
- Checkbox to enable/disable
- Dynamic description shows current state
- Explains privacy benefits and potential DisplayLink issues

**Lines 528-598:** Rate Limiting section:
- **Lines 534-540:** Warning box - don't change if you don't understand
- **Lines 543-552:** Master toggle checkbox
- **Lines 554-597:** Control panel (enabled when toggled on):
  - Max tokens per minute input (1K-10M range, 1K step)
  - Throttle percentage input (1-99 range)
  - Dynamic calculation: shows actual token threshold
  - Reset button
  - Controls disabled when master toggle off (opacity 0.7)

**Lines 602-625:** Data Management (danger zone):
- Red danger section styling
- Warning about permanent deletion
- Clear all data button:
  - Shows spinner when clearing
  - Emoji icons for visual clarity
  - Status message appears below button

---

This component provides advanced power-user features. The rate limiting system prevents hitting Gemini API limits by calculating token usage and slowing down requests when approaching thresholds. Content protection makes the app invisible to screen sharing software for privacy. The data clearing function provides a nuclear option to reset everything and requires confirmation via prominent danger styling.

---

### 24. src/components/views/HelpView.js - User Documentation and Keyboard Reference

**Lines 1-2:** Import Lit and resize utility

**Line 4:** Define HelpView class

**Lines 5-232:** Component styles - documentation layout, keyboard shortcuts, profile cards

**Lines 23-29:** Option group card - consistent with other views' glassmorphism style

**Lines 31-49:** Option label - section title with blue accent bar

**Lines 51-67:** Description styling - selectable text for copy/paste

**Lines 69-80:** Link styling - blue color with hover underline

**Lines 82-95:** Keyboard key badge:
- Dark background with border
- Monospace font (SF Mono, Monaco, etc.)
- Small rounded corners
- Looks like physical keyboard key

**Lines 97-137:** Keyboard shortcuts grid:
- Auto-fit columns (min 240px)
- Groups shortcuts by category
- Two-column layout per shortcut (description + keys)

**Lines 139-167:** Profile cards grid:
- Auto-fit cards (min 200px)
- Profile name and description
- Selectable text

**Lines 169-194:** Community links - clickable cards with hover effects

**Lines 196-231:** Usage steps with numbered list:
- CSS counter for automatic numbering
- Circular numbered badges
- Left padding for badge space

**Lines 234-237:** Component properties:
- `onExternalLinkClick` - Callback for opening URLs
- `keybinds` - Current keyboard shortcuts

**Lines 239-244:** Constructor:
- Initialize callback
- Load default and custom keybinds

**Lines 246-250:** `connectedCallback()` - Resize window

**Lines 252-267:** `getDefaultKeybinds()`:
- Identical to CustomizeView
- Platform-specific defaults
- Mac uses Cmd, PC uses Ctrl

**Lines 269-279:** `loadKeybinds()`:
- Loads from localStorage
- Merges with defaults
- Try/catch for safety

**Lines 281-283:** `formatKeybind(keybind)`:
- Splits "Cmd+Shift+Up" on '+'
- Returns array of `<span class="key">` elements
- Creates visual keyboard badges

**Lines 285-287:** `handleExternalLinkClick()` - Delegates to parent component

**Lines 289-457:** Massive `render()` method with 5 major sections:

**Lines 295-310:** Community & Support section:
- Official website link
- GitHub repository link
- Discord community link
- Each opens in external browser

**Lines 312-392:** Keyboard Shortcuts section:
- **Lines 317-335:** Window Movement (up/down/left/right)
- **Lines 337-347:** Window Control (click-through, visibility)
- **Lines 349-355:** AI Actions (next step screenshot)
- **Lines 357-375:** Response Navigation (previous/next/scroll)
- **Lines 377-387:** Text Input (Enter to send, Shift+Enter for newline)
- **Line 390:** Note about customization in Settings

**Lines 394-415:** How to Use section:
- 7 numbered steps
- Start session → Customize → Position → Click-through → Get help → Text messages → Navigate
- Uses `formatKeybind()` to show actual shortcuts

**Lines 417-447:** Supported Profiles section:
- Grid of 6 profile cards
- Each shows name and description
- Explains use case for each profile type

**Lines 449-455:** Audio Input section:
- Brief explanation that AI listens to conversations
- Provides contextual assistance based on audio

---

This component serves as in-app documentation. It eliminates the need for external help files by providing comprehensive usage instructions. The keyboard shortcuts section is particularly valuable as it shows the user's actual custom keybinds (if any), not just defaults. The community links integration encourages users to engage with support channels.

---

### 25. src/components/views/HistoryView.js - Conversation History and Saved Responses

**Lines 1-2:** Import Lit and resize utility

**Line 4:** Define HistoryView class

**Lines 5-305:** Component styles - tabs, session list, conversation view

**Lines 19-30:** History container and sessions list:
- Flex column layout fills height
- Scrollable list with bottom padding

**Lines 32-50:** Session item card:
- Clickable cards with hover effect
- `.selected` class for active state
- Transition for smooth state changes

**Lines 52-78:** Session header and preview:
- Date and time in header
- Preview limited to 2 lines via `-webkit-line-clamp`
- Truncated with ellipsis

**Lines 80-102:** Conversation view:
- Full-height scrollable area
- Text selectable for copying
- Individual messages with left border accent

**Lines 104-110:** Message type colors:
- User messages: Discord blue (#5865f2)
- AI messages: Discord red (#ed4245)
- 3px left border color codes

**Lines 112-164:** Back button and legend:
- Back button with arrow icon
- Legend explains color coding
- Dots show user vs AI colors

**Lines 166-185:** Empty states - for no sessions and loading

**Lines 187-222:** Custom scrollbars for both lists

**Lines 224-253:** Tab navigation:
- Two tabs: Conversation History and Saved Responses
- Active tab gets underline and highlight
- Transparent background when inactive

**Lines 255-304:** Saved response cards:
- Header with profile type and timestamp
- Delete button with X icon
- Full response content selectable

**Lines 307-313:** Component properties:
- `sessions` - All conversation sessions from IndexedDB
- `selectedSession` - Currently viewing conversation
- `loading` - Loading state
- `activeTab` - Which tab is selected
- `savedResponses` - User-bookmarked responses

**Lines 315-328:** Constructor:
- Initialize empty arrays
- Load saved responses from localStorage
- Call `loadSessions()` to fetch from IndexedDB

**Lines 330-334:** `connectedCallback()` - Resize window

**Lines 336-346:** `loadSessions()` async:
- Calls `cheddar.getAllConversationSessions()`
- Retrieves all sessions from IndexedDB
- Sets loading state properly
- Error handling with fallback to empty array

**Lines 348-373:** Date/time formatting functions:
- `formatDate()`: "Jan 15, 2025"
- `formatTime()`: "3:45 PM"
- `formatTimestamp()`: "Jan 15, 3:45 PM"
- Uses `toLocaleDateString()` and `toLocaleTimeString()`

**Lines 375-383:** `getSessionPreview()`:
- Gets first conversation turn
- Shows transcription or AI response
- Truncates to 100 characters
- Fallback to "No conversation yet"

**Lines 385-395:** Click handlers:
- `handleSessionClick()` - Opens conversation detail view
- `handleBackClick()` - Returns to session list
- `handleTabClick()` - Switches between tabs

**Lines 397-401:** `deleteSavedResponse(index)`:
- Filters out item at index
- Updates localStorage
- Triggers re-render

**Lines 403-412:** `getProfileNames()` - Maps profile IDs to display names

**Lines 414-443:** `renderSessionsList()`:
- Shows loading state
- Shows empty state if no sessions
- Maps sessions to clickable cards
- Each card shows date, time, and preview

**Lines 445-492:** `renderSavedResponses()`:
- Empty state if no saved items
- Maps saved responses to cards
- Each card shows profile, timestamp, content, and delete button
- Delete button shows X icon on hover

**Lines 494-553:** `renderConversationView()`:
- Back button with legend
- Flattens conversation history:
  - Each turn may have user transcription + AI response
  - Creates separate messages for each
  - Alternating user/AI pattern
- Messages get colored left border
- Empty state if no data

**Lines 555-573:** Main `render()`:
- If session selected: show conversation detail
- Otherwise: show tabs and list
- Tab content switches between sessions and saved responses
- Saved tab shows count in label

---

This component provides two key features: conversation history for reviewing past sessions, and saved responses for bookmarking important AI answers. The tab interface keeps related features organized. The conversation view flattens the turn-based structure into a linear chat-like interface. Integration with IndexedDB allows persistence across app restarts. The color-coded messages (blue for user, red for AI) provide visual clarity in conversation playback.
---

## Test Files

### 26. src/__mocks__/electron.js - Electron Mock for Testing

**Lines 1-3:** Mock browser window:
- `webContents.send` - Mocked IPC send function using Vitest's `vi.fn()`
- Allows testing without real Electron windows

**Lines 4-6:** Mock IPC renderer:
- Extends EventEmitter for event handling
- `invoke` returns resolved promise by default
- Allows simulating IPC communication in tests

**Lines 8-15:** Module exports:
- **BrowserWindow.getAllWindows** - Returns array with mock window
- **ipcMain.handle and ipcMain.on** - Mocked IPC main handlers
- **ipcRenderer** - Event emitter with invoke
- **shell.openExternal** - Mocked external link opener

This mock replaces real Electron in tests. It provides the same API surface but with spy functions that can be verified and controlled. Essential for testing Electron-specific code in a Node.js test environment without launching actual windows.

---

### 27. src/__tests__/audioUtils.test.js - Audio Utilities Unit Tests

**Lines 1-3:** Imports - file system module and audio utilities to test

**Lines 5-13:** Test setup:
- **beforeEach** - Mocks all file system operations before each test
- `vi.spyOn(fs, 'writeFileSync')` - Intercepts file writes
- `vi.spyOn(fs, 'mkdirSync')` - Intercepts directory creation
- `vi.spyOn(fs, 'existsSync')` - Returns false for non-existent files
- **afterEach** - Clears all mocks to prevent test pollution

**Lines 15-27:** `pcmToWav` test suite:
- **Line 17:** Creates 4-byte test buffer
- **Line 19:** Calls function with 16kHz, mono, 16-bit parameters
- **Lines 22-24:** Verifies WAV header structure:
  - First 4 bytes: 'RIFF' signature
  - Bytes 8-12: 'WAVE' format
  - Total size: 44-byte header + PCM data
- Ensures proper WAV file generation without actual disk I/O

**Lines 29-38:** `analyzeAudioBuffer` test suite:
- **Line 31:** Creates Int16Array with varied samples (0, 1000, -1000, 0)
- **Line 32:** Converts to Buffer for function input
- **Lines 34-36:** Validates analysis results:
  - minValue is negative (from -1000)
  - maxValue is positive (from 1000)
  - sampleCount matches input (4 samples)
- Tests audio analysis without side effects

**Lines 40-50:** `saveDebugAudio` test suite:
- **Line 42:** Creates 8-byte test buffer
- **Line 43:** Calls saveDebugAudio with 'unit' prefix
- **Lines 44-45:** Verifies directory creation and three file writes (PCM, WAV, metadata)
- **Lines 46-48:** Checks that returned paths contain prefix
- Tests complete debug save workflow without disk writes

---

### 28. src/__tests__/speakerFormat.test.js - Speaker Diarization Format Test

**Line 1:** Import formatSpeakerResults from gemini utils

**Lines 3-12:** Speaker formatting test:
- **Lines 5-8:** Creates mock diarization results:
  - Speaker 1: "hello"
  - Speaker 2: "hi"
- **Line 9:** Formats results to text
- **Line 10:** Expects formatted output:
  - `[Interviewer]: hello\n[Candidate]: hi\n`
  - Speaker 1 mapped to "Interviewer"
  - Speaker 2 mapped to "Candidate"
- Validates speaker label assignment and text formatting

Simple test ensuring speaker diarization results are properly formatted with appropriate labels for interview context.

---

### 29. src/__tests__/geminiConversation.test.js - Conversation Management Tests

**Lines 1-10:** Electron mock setup:
- Resolves electron module path
- Injects mock into require cache
- Necessary before importing gemini utils
- Prevents errors from missing Electron APIs

**Line 11:** Import conversation management functions

**Lines 13-27:** Conversation helper tests:
- **Lines 14-16:** beforeEach - Initializes new session before each test
- **Lines 18-26:** Conversation turn test:
  - **Lines 19-20:** Saves two conversation turns:
    - Turn 1: User says "hello", AI responds "hi"
    - Turn 2: User says "how are you", AI responds "i'm fine"
  - **Line 22:** Gets current session data
  - **Lines 23-25:** Validates:
    - History has 2 turns
    - First turn has correct transcription
    - Second turn has correct AI response

Tests the in-memory conversation history tracking. Ensures turns are saved in order with proper structure. Validates data retrieval via getCurrentSessionData(). Critical for conversation persistence before IndexedDB storage.

---

### 30. src/__tests__/audioUtils.e2e.test.js - Audio Utils End-to-End Tests

**Lines 1-4:** Imports - fs, os, path modules and audio utilities

**Lines 6-25:** End-to-end audio file creation test:
- **Line 8:** Creates temporary directory in OS temp folder
- **Line 9:** Mocks os.homedir() to return temp directory
- **Lines 11-13:** Creates test data:
  - 16,000 samples (1 second at 16kHz)
  - Filled with value 1000 (constant tone)
  - Converts to Buffer
- **Lines 15-16:** Tests pcmToWav:
  - Creates WAV file in temp directory
  - Verifies file exists on disk
- **Lines 18-21:** Tests saveDebugAudio:
  - Saves PCM, WAV, and metadata files
  - Verifies all three files exist on disk
  - Uses real file system (not mocked)
- **Line 23:** Restores original os.homedir()

Unlike unit tests, this performs actual file I/O. Validates the entire audio save pipeline works correctly with real disk operations. Catches file path issues, permission problems, and format errors that mocks might hide.

---

### 31. src/__tests__/syntaxHighlight.e2e.test.js - Syntax Highlighting Integration Test

**Lines 1-3:** Imports - fs, path, and JSDOM for DOM simulation

**Lines 5-30:** Syntax highlighting integration test:
- **Lines 7-8:** Loads actual index.html file
- **Lines 9-13:** Creates JSDOM instance:
  - `runScripts: 'dangerously'` - Executes <script> tags
  - `resources: 'usable'` - Loads external resources
  - `url: 'file://...'` - Sets base URL for relative paths
- **Lines 15-17:** Waits for window load event:
  - Uses Promise for async completion
  - Ensures all scripts and styles loaded
- **Lines 19-21:** Verifies highlight.js loaded:
  - Checks CSS link element exists
  - Confirms hljs global object defined
- **Lines 23-28:** Tests syntax highlighting:
  - Creates code element with JavaScript class
  - Sets code content: `const x = 1;`
  - Calls hljs.highlightElement()
  - Verifies HTML contains syntax highlighting spans

This end-to-end test validates the entire highlighting pipeline: HTML loads → Scripts execute → Highlight.js initializes → Code gets highlighted. Tests real browser-like environment without launching actual browser. Catches asset loading issues, initialization errors, and highlighting failures.

---

## Architecture Overview

The Cheating Daddy application demonstrates a sophisticated Electron architecture with several key patterns:

**Process Architecture:**
- Main process (src/index.js) manages window lifecycle, global shortcuts, and system integration
- Renderer process (src/utils/renderer.js) handles UI, audio capture, and AI communication
- IPC communication bridges the two processes for coordination

**Audio Pipeline:**
- Platform-specific capture (SystemAudioDump on macOS, loopback on Windows, getDisplayMedia on Linux)
- Real-time PCM to WAV conversion for Gemini compatibility
- Audio analysis for debugging and quality validation
- Chunk-based streaming for live transcription

**AI Integration:**
- Gemini Live API with bidirectional streaming
- Speaker diarization to distinguish multiple voices
- Token rate limiting to avoid API quota exhaustion
- Automatic reconnection with exponential backoff
- Google Search integration for up-to-date information

**Data Persistence:**
- localStorage for user preferences and settings
- IndexedDB for conversation history
- File system for debug audio files
- All data can be cleared via Advanced settings

**Stealth Features:**
- Random process names to avoid detection
- Window hiding from taskbar and alt-tab
- Content protection against screen capture
- Randomized window titles
- Anti-analysis delays

**UI Architecture:**
- Lit web components for reactive UI
- Shadow DOM for style encapsulation
- CSS custom properties for theming
- Word-by-word reveal animations
- Responsive layouts for different window sizes

**Testing Strategy:**
- Unit tests with file system mocking
- End-to-end tests with real file I/O
- JSDOM for browser environment simulation
- Electron mocking for testing without GUI

This codebase showcases modern JavaScript patterns, platform-specific optimizations, and sophisticated audio/AI integration while maintaining a stealth profile for privacy-sensitive use cases.
