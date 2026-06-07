const videoEl = document.querySelector('video');

electronAPI.onChangeVideo((event, { videoPath }) => {
    videoEl.src = videoPath;
});

electronAPI.onClearVideoSrc((event) => {
    videoEl.src = '';
});

electronAPI.onSetVideoCSS((event, { name, value }) => {
    videoEl.style[name] = value;
});

electronAPI.onReplayVideo((event) => {
    // videoEl.style[name] = value;
    console.log('Replaying video');
});
