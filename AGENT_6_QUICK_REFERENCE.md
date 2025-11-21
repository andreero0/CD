# AGENT 6: Quick Reference Guide

## 📦 What Was Implemented

### Components
1. **CoachingControls** (`src/components/controls/CoachingControls.js`)
   - Pause/Resume button
   - Intensity slider (Supportive/Balanced/Aggressive)
   - Alternative answer button
   - Freeform mode toggle
   - Built-in keyboard shortcuts (Cmd/Ctrl + P/A/F)

2. **AnalyticsDashboard** (`src/components/views/AnalyticsDashboard.js`)
   - Real-time metrics display
   - Adherence score visualization
   - Filler word breakdown
   - Suggestion history
   - JSON/PDF export

3. **SessionAnalytics** (`src/utils/sessionAnalytics.js`)
   - Turn tracking
   - Adherence calculation
   - Filler word detection
   - Response time measurement
   - Session reporting

---

## 🔌 IPC Channels Added

### Invoke Channels (Request/Response):
```javascript
'set-coaching-paused'          // Toggle pause
'set-coaching-intensity'       // Set 0-2
'request-alternative-answer'   // Regenerate
'set-freeform-mode'           // Toggle freeform
'save-file'                   // Export dialog
```

### Listen Channels (Events):
```javascript
'analytics-update'            // Real-time metrics
'coaching-state-changed'      // Control changes
```

---

## 🎯 How to Use Components

### Use CoachingControls
```html
<coaching-controls></coaching-controls>
```

### Use AnalyticsDashboard
```html
<analytics-dashboard></analytics-dashboard>
```

### Use SessionAnalytics (JavaScript)
```javascript
import { sessionAnalytics } from './utils/sessionAnalytics.js';

// Or access from window
window.sessionAnalytics.getRealTimeMetrics();
```

---

## 🛠️ Final Integration Steps

### 1. Complete gemini.js Integration

Add to top of file (line ~15):
```javascript
let coachingPaused = false;
let coachingIntensity = 1;
let freeformMode = false;
let sessionAnalytics = null;
```

Add to `initializeNewSession()`:
```javascript
const { SessionAnalytics } = require('./sessionAnalytics');
sessionAnalytics = new SessionAnalytics();
sessionAnalytics.startSession();
```

Add to transcript handler (when user speaks):
```javascript
if (sessionAnalytics && !freeformMode) {
  sessionAnalytics.trackTurn(speaker, newTranscript);
}
```

Add to suggestion tracker (when AI responds):
```javascript
if (sessionAnalytics && !coachingPaused && !freeformMode) {
  sessionAnalytics.trackSuggestion(messageBuffer);
}
```

### 2. Add Analytics View to PrismApp

Import in `PrismApp.js`:
```javascript
import { AnalyticsDashboard } from '../views/AnalyticsDashboard.js';
import { CoachingControls } from '../controls/CoachingControls.js';
```

Add case in `renderCurrentView()`:
```javascript
case 'analytics':
  return html`<analytics-dashboard></analytics-dashboard>`;
```

Add handler:
```javascript
handleAnalyticsClick() {
  this.currentView = 'analytics';
}
```

### 3. Integrate CoachingControls

In `AssistantView.js` render method:
```javascript
<div class="assistant-layout">
  <!-- existing content -->

  <div class="controls-panel">
    <coaching-controls></coaching-controls>
  </div>
</div>
```

---

## 📊 Key Metrics Explained

### Adherence Score
- **Formula**: Jaccard similarity (70%) + Sequential matching (30%)
- **Range**: 0-100%
- **Good**: ≥70% (green)
- **Fair**: 40-69% (yellow)
- **Poor**: <40% (red)

### Filler Words Detected
- um, uh, like
- you know, I mean
- basically, actually, literally
- sort of, kind of, well

### Response Time
- Time from last interviewer question to first word of answer
- Measured in milliseconds
- Averaged across all responses

---

## 🧪 Quick Test Checklist

- [ ] Pause button stops AI suggestions
- [ ] Intensity slider changes from 0-2
- [ ] Alternative button regenerates answer
- [ ] Freeform mode disables tracking
- [ ] Keyboard shortcuts work (Cmd/Ctrl + P/A/F)
- [ ] Analytics show real-time updates
- [ ] Adherence scores calculate correctly
- [ ] Filler words detected in speech
- [ ] Turn counts accurate
- [ ] JSON export works
- [ ] PDF export works (if jsPDF loaded)

---

## 🎨 Styling Integration

All components use CSS variables for theming:
```css
--text-color
--background
--border-color
--card-background
--description-color
```

Match your existing theme by setting these variables.

---

## 📁 File Locations

```
/home/user/CD/
├── src/
│   ├── components/
│   │   ├── controls/
│   │   │   └── CoachingControls.js         ✅ NEW
│   │   ├── views/
│   │   │   └── AnalyticsDashboard.js       ✅ NEW
│   │   └── index.js                        ✅ MODIFIED
│   ├── utils/
│   │   ├── sessionAnalytics.js             ✅ NEW
│   │   └── gemini.js                       ⚠️  TODO
│   ├── preload.js                          ✅ MODIFIED
│   └── index.js                            ✅ MODIFIED
└── AGENT_6_IMPLEMENTATION_GUIDE.md         ✅ NEW
```

---

## 🚨 Important Notes

1. **sessionAnalytics must be initialized** before tracking turns
2. **Coaching controls work only when session active**
3. **Alternative answer requires active Gemini session**
4. **Freeform mode automatically pauses coaching**
5. **Export requires Electron save-file handler**
6. **PDF export needs jsPDF loaded**

---

## 💡 Usage Examples

### Track a Turn
```javascript
sessionAnalytics.trackTurn('You', 'I have 5 years of experience', Date.now());
```

### Track a Suggestion
```javascript
sessionAnalytics.trackSuggestion('Mention your React expertise', Date.now(), 0.85);
```

### Match Response
```javascript
sessionAnalytics.matchSuggestionToResponse('I specialize in React development');
// Returns: { suggestion, actual, adherenceScore: 72 }
```

### Get Metrics
```javascript
const metrics = sessionAnalytics.getRealTimeMetrics();
console.log(`Adherence: ${metrics.adherenceScore}%`);
console.log(`Filler Words: ${metrics.fillerWordCount}`);
```

### Export Report
```javascript
const json = sessionAnalytics.exportAsJSON(true);
// Save to file or download
```

---

## 🐛 Troubleshooting

**Analytics not updating?**
- Check if sessionAnalytics.startSession() was called
- Verify IPC channel 'analytics-update' is whitelisted
- Check console for errors

**Controls not responding?**
- Verify session is active (sessionActive = true)
- Check IPC handlers in index.js
- Test keyboard shortcuts work

**Adherence always 0?**
- Ensure trackSuggestion() called before user responds
- Check matchSuggestionToResponse() called after response
- Verify text isn't empty

**Export failing?**
- Check save-file IPC handler exists
- Verify file permissions
- Test with small session first

---

## 📞 Support

See full implementation guide: `AGENT_6_IMPLEMENTATION_GUIDE.md`

For algorithm details, check sessionAnalytics.js source code comments.
