#!/usr/bin/env node
/**
 * Diagnostic script to test session logger
 */

const { sessionLogger } = require('./src/utils/sessionLogger');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('=== Session Logger Diagnostic ===\n');

// 1. Check logs directory
const logsDir = path.join(os.homedir(), 'Library', 'Application Support', 'prism-config', 'logs');
console.log('1. Logs Directory:', logsDir);
console.log('   Exists:', fs.existsSync(logsDir));

if (fs.existsSync(logsDir)) {
    const files = fs.readdirSync(logsDir).filter(f => f.endsWith('.log'));
    console.log('   Log files found:', files.length);

    if (files.length > 0) {
        console.log('\n   Recent logs:');
        files.slice(0, 5).forEach(f => {
            const stats = fs.statSync(path.join(logsDir, f));
            console.log(`   - ${f} (modified: ${stats.mtime.toISOString()})`);
        });
    }
}

// 2. Test session logger
console.log('\n2. Testing sessionLogger.startSession()...');
try {
    sessionLogger.startSession();
    console.log('   ✓ startSession() called successfully');
    console.log('   Current log file:', sessionLogger.getCurrentLogFile());
} catch (error) {
    console.error('   ✗ Error calling startSession():', error.message);
    console.error('   Stack:', error.stack);
}

// 3. Test writing to log
console.log('\n3. Testing log write...');
try {
    sessionLogger.log('Test', 'This is a test log entry');
    console.log('   ✓ Log write successful');
} catch (error) {
    console.error('   ✗ Error writing log:', error.message);
}

// 4. Check if new log file was created
console.log('\n4. Checking if new log file exists...');
const currentLogFile = sessionLogger.getCurrentLogFile();
if (currentLogFile) {
    console.log('   Current log file:', currentLogFile);
    console.log('   Exists:', fs.existsSync(currentLogFile));

    if (fs.existsSync(currentLogFile)) {
        const contents = fs.readFileSync(currentLogFile, 'utf8');
        console.log('   Contents:');
        console.log('   ---');
        console.log(contents);
        console.log('   ---');
    }
} else {
    console.error('   ✗ No current log file set');
}

// 5. Check permissions
console.log('\n5. Checking permissions...');
try {
    const testFile = path.join(logsDir, 'test-write.txt');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    console.log('   ✓ Write permissions OK');
} catch (error) {
    console.error('   ✗ Permission error:', error.message);
}

console.log('\n=== Diagnostic Complete ===\n');
