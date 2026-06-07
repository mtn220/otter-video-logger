const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    openVideoFolder: () => ipcRenderer.send('open-video-folder'),
    onVideoFolderOpened: (callback) =>
        ipcRenderer.on('video-folder-opened', callback),
    changeVideo: (args) => ipcRenderer.send('change-video', args),
    replayVideo: (args) => ipcRenderer.send('replay-video', args),
    onVideoChanged: (callback) => ipcRenderer.on('video-changed', callback),
    dataToClipboard: (args) => ipcRenderer.invoke('data-to-clipboard', args),
    getPlatform: () => ipcRenderer.invoke('get-platform'),
    renameFile: (args) => ipcRenderer.send('rename-file', args),
    setVideoCSS: (args) => ipcRenderer.send('set-video-css', args),
    onFileRenamed: (callback) => ipcRenderer.on('file-renamed', callback),
});
