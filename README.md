# 🔗 Number Link - Logic Puzzle Game

A modern, responsive HTML5 and Native Android implementation of the classic Number Link / Flow logic puzzle. Connect the numbers in sequence to fill the grid without crossing lines!

## 🎮 Features

### Gameplay
* **Dynamic Grid System:** Loads levels dynamically from an obfuscated `levels.enc` file, utilizing Base64 encoding to prevent players from easily looking up solutions via browser developer tools.
* **Dual Input Support:**
    * **Mouse/Touch:** Drag to draw lines. Supports backtracking (scrubbing back) to correct mistakes.
    * **Keyboard:** Use **Arrow Keys** to draw lines precisely from your current position.
* **Smart Mechanics:**
    * Flexible connecting mechanism allowing players to link any number to any number, provided the path starts from 1 and fulfills the sequential win condition.
    * Tile "Snatch" scale animation when connecting nodes.
    * Dynamic line width animation while drawing.
    * Auto-detection of "1" as the starting point if no line exists.
* **Win Validation:** Ensures the grid is full AND numbers are connected in the correct numerical order (1 → 2 → 3...).

### ☁️ Accounts & Cloud Sync (Powered by Firebase)
* **Authentication:** Seamless modal using Firebase Email & Password authentication, accessible via a conveniently placed "Log in" button in the top right corner.
* **Cross-Platform Sync:** Player progress (current level, max unlocked level, daily login streaks, and hints) is saved simultaneously to `localStorage` and Firebase Firestore.
* **Smart Conflict Resolution:** If local and cloud saves differ, a custom UI prompts the player to choose which save file to keep.
* **Player Profile:** Dedicated dashboard displaying player stats, current level, and a secure Password Reset system.
* **Developer Mode:** Logging in with a designated admin email automatically unlocks all levels, grants infinite hints, and bypasses "Show Answer" restrictions.

### UI & UX
* **Themes:** Built-in Dark Mode 🌙 and Light Mode ☀️ toggle with custom-themed scrollbars. UI colors adapt dynamically, utilizing clear white accents in dark mode for optimal visibility.
* **Responsive Design:** Resizing canvas that adapts to any screen size, centered via dynamic viewport height (`dvh`).
* **Mobile Optimized:**
    * Touch event support with `touch-action: none` to prevent native browser bouncing and scrolling.
    * **Portrait Mode Lock:** Forces mobile users to rotate their device for the best experience.
    * Proportional CSS grid layout for UI controls to prevent crowding on small screens.
* **Dynamic Toast Notifications:** A custom flexbox container dynamically stacks multiple alerts (like streak increases or hint resets) without overlapping, adjusting its position perfectly for mobile layouts.
* **Dynamic Contact System:** A bottom-corner contact button that opens a `mailto:` link on desktop, but elegantly copies the email to the clipboard on mobile.
* **Visual Polish:**
    * Confetti celebration on level completion 🎉.
    * Smooth CSS transitions for UI elements and modals.
* **Review Mode:** "Show Answer" button appears for previously completed levels.

## 📱 Mobile App Version (Android)

This game is packaged as a native Android application using **Capacitor**. It features device-specific optimizations:
* True fullscreen immersive mode by interacting directly with the Android Status Bar API.
* Safe-area inset handling to dodge notches and OS gesture bars.
* Custom native app icon and splash screen generation.

*Note: The Android mobile version right now is just a test deployment. More development will be done on the web-version. Expect a possible separate branch for the mobile Android version.*

## 🚀 How to Run Locally

Because this game fetches level data from an external `levels.enc` file, modern browsers may block the request if you simply double-click `index.html` due to **CORS (Cross-Origin Resource Sharing)** policies.

To run the web version locally, you need a local web server.

### Option 1: VS Code (Recommended)
1.  Install the **Live Server** extension in VS Code.
2.  Right-click `index.html` and select **"Open with Live Server"**.

### Option 2: Python
If you have Python installed, open your terminal in the project folder and run:
```bash
# Python 3
python -m http.server 8000
