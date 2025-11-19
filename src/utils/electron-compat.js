// SECURITY FIX: Compatibility shim for components using window.require('electron')
// This provides a safer interface that works with context isolation

// Create a backwards-compatible API that wraps the exposed window.electron
if (!window.require) {
    window.require = function(moduleName) {
        if (moduleName === 'electron') {
            // Return a wrapper that provides the ipcRenderer interface
            return {
                ipcRenderer: window.electron
            };
        }
        throw new Error(`Module '${moduleName}' not available in sandboxed context`);
    };
}

// Also expose ipcRenderer directly for convenience
if (!window.ipcRenderer) {
    window.ipcRenderer = window.electron;
}
