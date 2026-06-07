const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    onChangeVideo: (callback) => ipcRenderer.on('change-video', callback),
    onClearVideoSrc: (callback) => ipcRenderer.on('clear-video-src', callback),
    onSetVideoCSS: (callback) => ipcRenderer.on('set-video-css', callback),
    onReplayVideo: (callback) => ipcRenderer.on('replay-video', callback),
});
