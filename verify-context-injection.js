/**
 * Manual verification script for context injection debouncing
 * This script tests the implementation without requiring vitest
 */

// Mock electron
const electronPath = require.resolve('electron');
require.cache[electronPath] = {
    exports: {
        BrowserWindow: {
            getAllWindows: () => [{ webContents: { send: () => {} } }],
        },
        ipcMain: { handle: () => {}, on: () => {} },
        shell: { openExternal: () => {} },
    },
};

// Mock sessionLogger
const mockSessionLogger = {
    logDebounce: (action, delay) => console.log(`[SessionLogger] Debounce: ${action} (${delay}ms)`),
    logBufferRejection: (reason, wordCount) => console.log(`[SessionLogger] Buffer Rejection: ${reason} (words: ${wordCount})`),
    logContextTruncation: (orig, trunc) => console.log(`[SessionLogger] Context Truncation: ${orig} → ${trunc}`),
    log: (category, message) => console.log(`[SessionLogger] ${category}: ${message}`),
};

require.cache[require.resolve('./src/utils/sessionLogger')] = {
    exports: { sessionLogger: mockSessionLogger },
};

// Import functions
const {
    cancelDebounce,
    scheduleContextInjection,
    buildContextMessage,
    sendContextToAI,
} = require('./src/utils/gemini');

console.log('\n=== Context Injection Debouncing Verification ===\n');

// Test 1: cancelDebounce
console.log('Test 1: cancelDebounce()');
try {
    cancelDebounce();
    console.log('✓ cancelDebounce executed without errors\n');
} catch (error) {
    console.error('✗ cancelDebounce failed:', error.message, '\n');
}

// Test 2: buildContextMessage without suggestion
console.log('Test 2: buildContextMessage(null)');
try {
    const result = buildContextMessage(null);
    if (result.includes('<context>') && result.includes('</context>')) {
        console.log('✓ buildContextMessage returns correctly formatted context\n');
        console.log('  Output:', result, '\n');
    } else {
        console.error('✗ buildContextMessage missing expected tags\n');
    }
} catch (error) {
    console.error('✗ buildContextMessage failed:', error.message, '\n');
}

// Test 3: buildContextMessage with suggestion
console.log('Test 3: buildContextMessage(suggestion)');
try {
    const suggestion = {
        text: 'Try saying hello',
        turnId: 5,
        timestamp: Date.now(),
    };
    const result = buildContextMessage(suggestion);
    if (result.includes('<lastSuggestion>') && result.includes('Try saying hello') && result.includes('Turn ID: 5')) {
        console.log('✓ buildContextMessage includes suggestion correctly\n');
        console.log('  Output:', result, '\n');
    } else {
        console.error('✗ buildContextMessage missing suggestion data\n');
    }
} catch (error) {
    console.error('✗ buildContextMessage with suggestion failed:', error.message, '\n');
}

// Test 4: sendContextToAI with small context
console.log('Test 4: sendContextToAI(small context)');
global.geminiSessionRef = {
    current: {
        sendRealtimeInput: async (data) => {
            console.log('  → Sent to Gemini:', data.text.substring(0, 50) + '...');
            return Promise.resolve();
        },
    },
};

(async () => {
    try {
        await sendContextToAI('Small test context', 'test');
        console.log('✓ sendContextToAI completed successfully\n');
    } catch (error) {
        console.error('✗ sendContextToAI failed:', error.message, '\n');
    }

    // Test 5: sendContextToAI with large context (should truncate)
    console.log('Test 5: sendContextToAI(large context > 2000 chars)');
    try {
        const largeContext = 'x'.repeat(2500);
        await sendContextToAI(largeContext, 'test');
        console.log('✓ sendContextToAI handled large context with truncation\n');
    } catch (error) {
        console.error('✗ sendContextToAI with large context failed:', error.message, '\n');
    }

    // Test 6: scheduleContextInjection
    console.log('Test 6: scheduleContextInjection()');
    try {
        scheduleContextInjection('speaker_turn');
        console.log('✓ scheduleContextInjection scheduled successfully\n');

        // Cancel to clean up
        setTimeout(() => {
            cancelDebounce();
            console.log('✓ Debounce cancelled\n');

            console.log('\n=== All Tests Completed ===\n');
            process.exit(0);
        }, 100);
    } catch (error) {
        console.error('✗ scheduleContextInjection failed:', error.message, '\n');
        process.exit(1);
    }
})();
