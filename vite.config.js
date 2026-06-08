import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
    root: 'src',
    clearScreen: false,
    server: { port: 5173, strictPort: true },
    build: {
        outDir: '../dist',
        rollupOptions: {
            input: {
                tools: resolve(__dirname, 'src/index.html'),
                video: resolve(__dirname, 'src/video.html'),
            },
        },
    },
})
