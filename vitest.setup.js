// vitest.setup.js - Setup file for vitest tests
import 'fake-indexeddb/auto';

// Configure fake-indexeddb for testing
global.indexedDB = indexedDB;
global.IDBKeyRange = IDBKeyRange;
