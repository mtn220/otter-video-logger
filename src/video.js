import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap'
import './styles.css'
import { listen } from '@tauri-apps/api/event'
import { convertFileSrc } from '@tauri-apps/api/core'

async function init() {
    const videoEl = document.querySelector('video')

    await listen('change-video', ({ payload }) => {
        videoEl.src = convertFileSrc(payload.videoPath)
    })
    await listen('clear-video-src', () => {
        videoEl.src = ''
    })
    await listen('set-video-css', ({ payload }) => {
        videoEl.style[payload.name] = payload.value
    })
    await listen('replay-video', () => {
        videoEl.currentTime = 0
        videoEl.play()
    })
}
init()

document.addEventListener('keydown', (e) => {
    if (e.key === 'F12') window.__TAURI__.core.invoke('open_devtools');
});
