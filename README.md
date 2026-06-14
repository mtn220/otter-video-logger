# Otter Video Logger

A desktop app for logging River Otter Ecology Project video metadata. Built with [Tauri](https://tauri.app/) (Rust + Vite).

---

## For Users

### Finding the right installer

Installers are distributed per platform and CPU architecture. If you're unsure which architecture your machine uses:

- **Windows:** Open Settings > System > About and look at **System type**. It will say "x64-based PC" or "ARM-based PC".
- **macOS:** Click the Apple menu > About This Mac. Macs from 2020 and later with Apple Silicon are **arm64 (aarch64)**; older Intel Macs are **x86_64**.

### Installing on Windows

> Windows will block unsigned apps with a SmartScreen warning by default.

1. Download the installer (`.exe` or `.msi`) for your architecture (`x64` for most machines, `arm64` for ARM-based PCs).
2. Run the installer. If Windows shows a **"Windows protected your PC"** SmartScreen dialog:
   - Click **More info**
   - Click **Run anyway**
3. Complete the installation normally.

### Installing on macOS

> macOS will block unsigned apps with a Gatekeeper warning by default.

1. Download the `.dmg` for your chip (`aarch64` for Apple Silicon, `x86_64` for Intel).
2. Open the `.dmg` and drag **Otter Video Logger** to your Applications folder.
3. The first time you try to open the app, macOS will block it. To bypass this:
   - **Right-click** (or Control-click) the app in Finder and select **Open**.
   - In the dialog that appears, click **Open** to confirm.
   - Alternatively, go to **System Settings > Privacy & Security**, scroll down to the blocked app notice, and click **Open Anyway**.

---

## For Developers

### Prerequisites

Install the following before cloning:

- **Rust** — install via [rustup](https://rustup.rs/)
- **Node.js** — v18 or later, available at [nodejs.org](https://nodejs.org/)
- **Platform-specific dependencies:**
  - **Windows:** [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (select the "Desktop development with C++" workload) and [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (pre-installed on Windows 10 1803+)
  - **macOS:** Xcode Command Line Tools — run `xcode-select --install`

### Running in development

```bash
git clone <repo-url>
cd otter-video-logger
npm install
npm run tauri dev
```

`npm run tauri dev` starts the Vite dev server and the Tauri app together with hot-reloading.

### Building for release

```bash
npm run tauri build
```

Compiled installers and bundles are placed in:

```
src-tauri/target/release/bundle/
```

Subdirectories by format:

| Platform | Format | Path |
|----------|--------|------|
| Windows | NSIS installer (`.exe`) | `bundle/nsis/` |
| Windows | MSI installer (`.msi`) | `bundle/msi/` |
| macOS | Disk image (`.dmg`) | `bundle/dmg/` |
| macOS | App bundle (`.app`) | `bundle/macos/` |

The build targets your current machine's OS and architecture. To produce builds for other platforms or architectures, use a machine of that type or configure cross-compilation separately.

### CI/CD (GitHub Actions)

Releases are built automatically via GitHub Actions (`.github/workflows/build-macos.yml`).

**Trigger:** push a version tag (e.g. `git tag v1.0.0 && git push --tags`) or run the workflow manually from the Actions tab.

**What it does:**

| Job | Runner | Output |
|-----|--------|--------|
| `build-macos` | `macos-latest` | `.app` bundle zipped as `Otter Video Logger.zip` |
| `build-windows` | `windows-latest` | NSIS installer `.exe` |
| `release` | `ubuntu-latest` | Draft GitHub release with both artifacts attached |

The `release` job only runs on tag pushes. On manual runs, artifacts are available as workflow downloads but no release is created.

**App signing:** not yet configured. macOS builds are unsigned (users will see a Gatekeeper warning); Windows builds are unsigned (users will see a SmartScreen warning). Code signing support is planned — the workflow already includes commented-out placeholders for the required secrets.
