// Secure preload script with context isolation
const { contextBridge, ipcRenderer } = require('electron');

// Whitelist of valid IPC channels
const validChannels = {
    invoke: [
        'initialize-gemini',
        'send-audio-content',
        'send-mic-audio-content',
        'send-image-content',
        'send-text-message',
        'start-macos-audio',
        'stop-macos-audio',
        'close-session',
        'get-current-session',
        'start-new-session',
        'update-google-search-setting',
        'window-minimize',
        'toggle-window-visibility',
        'update-sizes',
        'quit-application',
        'open-external',
        'update-content-protection',
        'get-random-display-name',
        'set-onboarded',
        'set-stealth-level',
        'set-layout',
        'get-config'
    ],
    send: [
        'update-keybinds',
        'view-changed',
        'screenshot-captured'
    ],
    on: [
        'update-status',
        'update-response',
        'session-initializing',
        'click-through-toggled',
        'navigate-previous-response',
        'navigate-next-response',
        'scroll-response-up',
        'scroll-response-down',
        'clear-sensitive-data',
        'save-conversation-turn',
        'transcript-update',
        'screenshot-captured',
        'reconnection-status',
        'reconnection-success',
        'reconnection-failed'
    ]
};

// Exposed API for renderer process
const api = {
    // Platform information
    platform: process.platform,

    // IPC invoke (returns Promise)
    invoke: (channel, ...args) => {
        if (validChannels.invoke.includes(channel)) {
            return ipcRenderer.invoke(channel, ...args);
        }
        throw new Error(`Invalid IPC channel: ${channel}`);
    },

    // IPC send (one-way)
    send: (channel, ...args) => {
        if (validChannels.send.includes(channel)) {
            ipcRenderer.send(channel, ...args);
        } else {
            throw new Error(`Invalid IPC channel: ${channel}`);
        }
    },

    // IPC on (listen to events)
    on: (channel, callback) => {
        if (validChannels.on.includes(channel)) {
            const subscription = (event, ...args) => callback(...args);
            ipcRenderer.on(channel, subscription);
            return () => ipcRenderer.removeListener(channel, subscription);
        }
        throw new Error(`Invalid IPC channel: ${channel}`);
    },

    // IPC off (remove specific listener)
    off: (channel, callback) => {
        if (validChannels.on.includes(channel)) {
            ipcRenderer.off(channel, callback);
        } else {
            throw new Error(`Invalid IPC channel: ${channel}`);
        }
    },

    // Remove all listeners for a channel
    removeAllListeners: (channel) => {
        if (validChannels.on.includes(channel)) {
            ipcRenderer.removeAllListeners(channel);
        }
    }
};

// Expose protected API to renderer
contextBridge.exposeInMainWorld('electron', api);

// Expose safe require function for specific modules
contextBridge.exposeInMainWorld('secureRequire', {
    // Only expose what's absolutely necessary
    desktopCapturer: () => require('electron').desktopCapturer
});
