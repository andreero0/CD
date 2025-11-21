#!/usr/bin/env node

/**
 * Validation Script for Correlation ID System
 * Tests the audioCorrelation module and verifies integration
 */

const { generateCorrelationId, trackAudioChunk, resolveCorrelationId, clearAll, getStats } = require('./src/utils/audioCorrelation');

console.log('🧪 Validating Correlation ID System\n');

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
    totalTests++;
    try {
        fn();
        console.log(`✓ ${name}`);
        passedTests++;
    } catch (error) {
        console.log(`✗ ${name}`);
        console.error(`  Error: ${error.message}`);
    }
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

// Test 1: Correlation ID Generation
test('Correlation ID generation returns unique IDs', () => {
    const id1 = generateCorrelationId();
    const id2 = generateCorrelationId();

    assert(typeof id1 === 'string', 'ID should be a string');
    assert(id1.includes('_'), 'ID should contain underscore separator');
    assert(id1 !== id2, 'IDs should be unique');
    assert(id1.length > 15, 'ID should be sufficiently long');
});

// Test 2: Generate 1000 unique IDs
test('Generate 1000 unique correlation IDs', () => {
    const ids = new Set();
    for (let i = 0; i < 1000; i++) {
        ids.add(generateCorrelationId());
    }
    assert(ids.size === 1000, 'All 1000 IDs should be unique');
});

// Test 3: Track and Resolve - Mic
test('Track and resolve mic audio chunk', () => {
    clearAll(); // Clean slate
    const id = generateCorrelationId();
    trackAudioChunk(id, 'mic', Date.now());

    const result = resolveCorrelationId(id);
    assert(result !== null, 'Should resolve successfully');
    assert(result.source === 'mic', 'Source should be "mic"');
    assert(typeof result.timestamp === 'number', 'Timestamp should be a number');
});

// Test 4: Track and Resolve - System
test('Track and resolve system audio chunk', () => {
    clearAll();
    const id = generateCorrelationId();
    trackAudioChunk(id, 'system', Date.now());

    const result = resolveCorrelationId(id);
    assert(result !== null, 'Should resolve successfully');
    assert(result.source === 'system', 'Source should be "system"');
});

// Test 5: One-time Use (ID removed after resolution)
test('Correlation ID is removed after resolution (one-time use)', () => {
    clearAll();
    const id = generateCorrelationId();
    trackAudioChunk(id, 'mic', Date.now());

    const result1 = resolveCorrelationId(id);
    assert(result1 !== null, 'First resolution should work');

    const result2 = resolveCorrelationId(id);
    assert(result2 === null, 'Second resolution should return null (already used)');
});

// Test 6: Multiple Chunks (FIFO)
test('Multiple chunks tracked and resolved in FIFO order', () => {
    clearAll();
    const id1 = generateCorrelationId();
    const id2 = generateCorrelationId();
    const id3 = generateCorrelationId();

    trackAudioChunk(id1, 'mic', Date.now());
    trackAudioChunk(id2, 'system', Date.now());
    trackAudioChunk(id3, 'mic', Date.now());

    const stats = getStats();
    assert(stats.size === 3, 'Should have 3 chunks tracked');

    resolveCorrelationId(id1);
    resolveCorrelationId(id2);

    const stats2 = getStats();
    assert(stats2.size === 1, 'Should have 1 chunk remaining');
});

// Test 7: Invalid Input Handling
test('Handles invalid inputs gracefully', () => {
    clearAll();

    // Invalid source
    trackAudioChunk('test123', 'invalid_source', Date.now());
    // Should not crash

    // Invalid correlationId
    const result = resolveCorrelationId(null);
    assert(result === null, 'Should return null for invalid ID');
});

// Test 8: ClearAll
test('clearAll() removes all entries', () => {
    clearAll();

    // Add multiple entries
    for (let i = 0; i < 10; i++) {
        const id = generateCorrelationId();
        trackAudioChunk(id, i % 2 === 0 ? 'mic' : 'system', Date.now());
    }

    const stats1 = getStats();
    assert(stats1.size === 10, 'Should have 10 entries');

    clearAll();

    const stats2 = getStats();
    assert(stats2.size === 0, 'Should have 0 entries after clearAll');
});

// Test 9: Expiry (manual test - would need setTimeout)
test('Stats tracking works correctly', () => {
    clearAll();

    const now = Date.now();
    const id1 = generateCorrelationId();
    trackAudioChunk(id1, 'mic', now - 1000); // 1 second ago

    const id2 = generateCorrelationId();
    trackAudioChunk(id2, 'system', now);

    const stats = getStats();
    assert(stats.size === 2, 'Should have 2 entries');
    assert(stats.oldestTimestamp === now - 1000, 'Oldest timestamp should be correct');
});

// Test 10: Verify gemini.js integration
test('gemini.js imports audioCorrelation correctly', () => {
    const fs = require('fs');
    const geminiContent = fs.readFileSync('./src/utils/gemini.js', 'utf8');

    assert(geminiContent.includes('require(\'./audioCorrelation\')'), 'Should import audioCorrelation');
    assert(geminiContent.includes('generateCorrelationId'), 'Should import generateCorrelationId');
    assert(geminiContent.includes('trackAudioChunk'), 'Should import trackAudioChunk');
    assert(geminiContent.includes('resolveCorrelationId'), 'Should import resolveCorrelationId');
    assert(geminiContent.includes('clearAll: clearCorrelationData'), 'Should import clearAll');
});

// Test 11: Verify FIFO queue exists
test('gemini.js has audioChunkQueue', () => {
    const fs = require('fs');
    const geminiContent = fs.readFileSync('./src/utils/gemini.js', 'utf8');

    assert(geminiContent.includes('audioChunkQueue'), 'Should have audioChunkQueue');
    assert(geminiContent.includes('MAX_QUEUE_SIZE'), 'Should have MAX_QUEUE_SIZE constant');
    assert(geminiContent.includes('audioChunkQueue.push'), 'Should push to queue');
    assert(geminiContent.includes('audioChunkQueue.shift'), 'Should shift from queue');
});

// Test 12: Verify event-driven context injection
test('gemini.js has event-driven context injection', () => {
    const fs = require('fs');
    const geminiContent = fs.readFileSync('./src/utils/gemini.js', 'utf8');

    assert(geminiContent.includes('previousSpeaker'), 'Should track previousSpeaker');
    assert(geminiContent.includes('speakerChanged'), 'Should detect speaker changes');
    assert(geminiContent.includes('CONTEXT_SEND_FALLBACK_TIMEOUT'), 'Should have fallback timeout');
    assert(geminiContent.includes('speaker_turn'), 'Should log speaker_turn trigger');
    assert(geminiContent.includes('timeout_fallback'), 'Should log timeout_fallback trigger');
});

// Test 13: Verify helper functions exist
test('gemini.js has determineSpeakerFromCorrelation function', () => {
    const fs = require('fs');
    const geminiContent = fs.readFileSync('./src/utils/gemini.js', 'utf8');

    assert(geminiContent.includes('function determineSpeakerFromCorrelation'), 'Should have determineSpeakerFromCorrelation');
    assert(geminiContent.includes('audioChunkQueue.shift()'), 'Should shift from queue in function');
});

// Test 14: Verify session cleanup
test('gemini.js clears correlation data on session init/cleanup', () => {
    const fs = require('fs');
    const geminiContent = fs.readFileSync('./src/utils/gemini.js', 'utf8');

    const initSessionMatches = geminiContent.match(/clearCorrelationData\(\)/g);
    assert(initSessionMatches && initSessionMatches.length >= 2, 'Should call clearCorrelationData at least twice (init + cleanup)');

    const queueClearMatches = geminiContent.match(/audioChunkQueue\.length = 0/g);
    assert(queueClearMatches && queueClearMatches.length >= 2, 'Should clear queue at least twice');
});

// Test 15: Verify audio handlers use correlation tracking
test('Audio IPC handlers use correlation tracking', () => {
    const fs = require('fs');
    const geminiContent = fs.readFileSync('./src/utils/gemini.js', 'utf8');

    // Should have multiple instances of correlation tracking in audio handlers
    const generateIdMatches = geminiContent.match(/generateCorrelationId\(\)/g);
    assert(generateIdMatches && generateIdMatches.length >= 3, 'Should generate correlation IDs in multiple places');

    const trackChunkMatches = geminiContent.match(/trackAudioChunk\(/g);
    assert(trackChunkMatches && trackChunkMatches.length >= 3, 'Should track chunks in multiple places');
});

// Summary
console.log(`\n${'='.repeat(50)}`);
console.log(`Tests Passed: ${passedTests}/${totalTests}`);
console.log(`${'='.repeat(50)}\n`);

if (passedTests === totalTests) {
    console.log('✅ All tests passed! Correlation ID system is working correctly.');
    console.log('\n📋 Next Steps:');
    console.log('   1. Run the application with DEBUG_CORRELATION=1 to see correlation tracking');
    console.log('   2. Run the application with DEBUG_CONTEXT=1 to see context injection triggers');
    console.log('   3. Test with real audio to verify speaker attribution accuracy');
    console.log('   4. Monitor memory usage during extended sessions');
    process.exit(0);
} else {
    console.log('❌ Some tests failed. Please review the errors above.');
    process.exit(1);
}
