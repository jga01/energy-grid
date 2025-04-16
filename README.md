      
# Power Grid Panic (Working Title)

## 🎮 Concept

Power Grid Panic is a cooperative (with a competitive twist!) local multiplayer game designed for 8-10 year old kids. Players work together using their smartphones as controllers to manage a central energy grid displayed on a shared screen. The goal is to keep the energy level within a stable "safe zone". If the energy drops too low, the grid risks a shutdown; if it surges too high, it risks a meltdown!

While the primary goal is cooperative stability, players also have the option to be selfish, diverting energy from the main grid to their personal stash for a riskier, individual victory.

## 🕹️ Gameplay Overview

*   **Objective:** Keep the energy level displayed on the main screen within the designated safe zone (e.g., 40%-70%) for a cumulative target duration to achieve a cooperative win.
*   **Failure:** If the energy stays too low (<20%) or too high (>85%) for too long (e.g., 10 seconds), the grid shuts down or melts down, resulting in a cooperative loss.
*   **Controllers:** Each player uses their smartphone (connected via local WiFi) which displays action buttons.
*   **Core Action:** Repeatedly tapping the "Generate Power" button adds energy to the central grid.
*   **Advanced Actions:** Players have access to special actions with cooldowns:
    *   **Stabilize Burst:** Temporarily slows down the rate of energy change (both decay and gain), helping to manage volatility.
    *   **Emergency Adjust:** Provides a significant energy boost if the grid is dangerously low, or a significant energy drain (coolant) if the grid is dangerously high. Using it in the wrong zone incurs a small penalty.
*   **Individual Play:**
    *   **Divert Power:** Players can choose to siphon energy from the main grid into their personal stash using a risky action. This makes the cooperative goal harder.
    *   **Personal Stash:** Each player's controller displays their accumulated personal energy.
    *   **Individual Win:** A player can win individually by filling their personal stash to a target amount before a cooperative win or grid failure occurs.
*   **Random Events:** To keep things exciting, random events occur periodically:
    *   **Demand Surge:** Energy drains much faster for a short period.
    *   **Efficiency Drive:** Each "Generate Power" press yields more energy temporarily.

## ✨ Features Implemented

*   Real-time energy grid simulation with natural decay and player-driven gain.
*   Central display screen showing energy level, status, event alerts, and safe zone indicators.
*   Smartphone controller interface via web browser (no app install needed).
*   "Generate Power" core action.
*   "Stabilize Burst" advanced action with cooldown and effects.
*   "Emergency Adjustment" advanced action (Boost/Coolant/Penalty) with cooldown and effects.
*   "Divert Power" (Steal from Grid) action with cooldown, stash gain, and grid cost.
*   Personal Stash tracking per player.
*   Individual Win condition based on Personal Stash target.
*   Cooperative Win condition based on cumulative time in the safe zone.
*   Time-based Loss Conditions (Shutdown/Meltdown) for staying in danger zones too long.
*   Random Events: Demand Surge & Efficiency Drive.
*   Game Over detection and Reset functionality ("Play Again?").
*   Visual Safe Zone indicator on the main display.
*   Personal Stash target visible on the controller display.
*   Refactored server-side code structure for better organization (config, state, logic, websockets separated).

## 💻 Technical Stack

*   **Backend:** Node.js with Express framework
*   **Real-time Communication:** Socket.IO (using WebSockets)
*   **Frontend:** Vanilla JavaScript, HTML5, CSS3
*   **Platform:** Runs in web browsers on a local network.

## ⚙️ Setup & Running

**Prerequisites:**
*   Node.js and npm installed on the machine that will act as the server.

**Instructions:**

1.  **Clone or Download:** Get the project files onto your server machine.
2.  **Navigate to Directory:** Open a terminal or command prompt and change into the project's root directory (`cd path/to/power-grid-game`).
3.  **Install Dependencies:** Run the command:
    ```bash
    npm install
    ```
4.  **Run the Server:** Start the game server using:
    ```bash
    node server.js
    ```
    The console will output messages indicating the server is running and provide access URLs.
5.  **Access the Game:**
    *   **Main Display:** Open a web browser on the server machine (or another computer/tablet on the same network) and navigate to `http://localhost:3000` (or `http://<SERVER_IP_ADDRESS>:3000`).
    *   **Controllers:** On each player's smartphone (or other device), open a web browser and navigate to `http://<SERVER_IP_ADDRESS>:3000/controller`.
        *   **Important:** Replace `<SERVER_IP_ADDRESS>` with the actual local IP address of the computer running the server. You can find this using `ipconfig` (Windows) or `ifconfig` / `ip addr` (macOS/Linux).
        *   All devices (server, display, controllers) **must be connected to the same local WiFi network**.

## 📁 Project Structure

power-grid-game/
├── node_modules/ # Dependencies
├── public/ # Client-side files (HTML, CSS, JS, assets)
│ ├── css/ # Stylesheets
│ ├── js/ # Client-side JavaScript (display.js, controller.js)
│ ├── index.html # Main Display page
│ └── controller.html # Controller page
├── server/ # Server-side code
│ ├── config.js # Game configuration constants
│ ├── game/ # Core game logic modules
│ │ ├── GameState.js # Manages central game state object
│ │ ├── Player.js # Defines player data structure
│ │ └── gameLogic.js # Game loop, action effects, event logic
│ └── websocketHandler.js # Handles Socket.IO connections and events
├── server.js # Main server entry point (Express setup, starts WS handler)
├── package.json # Project info and dependencies
└── README.md # This file

      
## 🗺️ Roadmap

### ✅ Completed

*   **[#1] Player Identification & Basic Management:** Server tracks connected players.
*   **[#2] Cooperative Win Condition Logic:** Implemented time-in-safe-zone win.
*   **[#3] Refined Loss Conditions (Time-based):** Implemented shutdown/meltdown after timeout in danger zones.
*   **[#4] Game Over State & Reset:** Clear game end states and "Play Again" functionality.
*   **[#5 - Part 1] Advanced Action: Stabilize Burst:** Implemented with cooldown & effects.
*   **[#5 - Part 2] Advanced Action: Emergency Adjustment:** Implemented (Boost/Coolant/Penalty) with cooldown & effects.
*   **[#6] Individual Win Mechanic (Stealing from Grid & Personal Stash):** Implemented divert power, stash tracking, and individual win.
*   **[#7 - Part 1] Random Events:** Implemented Demand Surge & Efficiency Drive.
*   **[#8] Server-Side Refactoring & Organization:** Code split into modules (config, state, logic, websockets).
*   **[#9] Configuration File/Object:** Implemented via `server/config.js`.
*   **[#10 - Part 1] UI/UX Improvements:** Added visual safe zone indicator & stash target display.

### ⏳ To Do / Future Work

*   **[#7 - Part 2] Remaining Random Events:** Implement "Line Fault" (disables a player's input temporarily). Consider other event ideas.
*   **[#11] Sound Effects:** Add audio feedback for actions, events, alerts, win/loss using Web Audio API.
*   **[#12] Player-to-Player Stealing ("Hack Link"):** Implement direct stealing between players (more complex).
*   **[#10 - Part 2] Further UI/UX Polish:**
    *   Improve visual feedback for actions (button animations, screen flashes?).
    *   More dynamic energy bar visuals?
    *   Consider adding player names or colours for identification.
*   **(Optional) Difficulty Scaling:** Adjust decay rates, event frequency, win conditions based on player count.
*   **(Optional) Persistent High Scores/Stats:** Track cooperative win times or individual stash records (would require more complex state/storage).

## 📄 License