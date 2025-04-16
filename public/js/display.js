const socket = io(); // Connect to the server automatically

// Get references to DOM elements
const energyBar = document.getElementById("energy-bar");
const energyLevelText = document.getElementById("energy-level-text");
const statusText = document.getElementById("status-text");
const gridContainer = document.querySelector(".grid-container");
const coopProgressText = document.createElement("div");
const resetButtonContainer = document.createElement("div");
const resetButton = document.createElement("button");
// +++ NEW: Event Alert Element +++
const eventAlert = document.createElement("div");

// --- Setup UI Elements ---
coopProgressText.id = "coop-progress";
resetButtonContainer.id = "reset-container";
resetButton.id = "reset-button";
resetButton.textContent = "Play Again?";
resetButton.style.display = "none";
resetButtonContainer.appendChild(resetButton);
eventAlert.id = "event-alert";
eventAlert.style.display = "none"; // Initially hidden

if (gridContainer) {
  gridContainer.parentNode.insertBefore(eventAlert, gridContainer);
  gridContainer.appendChild(coopProgressText);
  gridContainer.parentNode.insertBefore(
    resetButtonContainer,
    gridContainer.nextSibling
  );
} else {
  console.error("Could not find '.grid-container'. UI setup incomplete.");
  document.body.appendChild(eventAlert); // Fallback
  document.body.appendChild(resetButtonContainer);
}
// --- End UI Setup ---

// --- Define constants for thresholds ---
const DANGER_LOW_THRESHOLD = 20;
const SAFE_ZONE_MIN = 40;
const SAFE_ZONE_MAX = 70;
const DANGER_HIGH_THRESHOLD = 85;

// --- State for Event Alert Timer ---
let eventAlertTimeout = null;

socket.on("connect", () => {
  console.log("Connected to server (Display)");
  statusText.textContent = "Waiting for game state...";
});

// Listen for game state updates from the server
socket.on("gameStateUpdate", (data) => {
  // Update energy level display
  const level = data.energyLevel;
  energyLevelText.textContent = `${Math.round(level)}%`;
  energyBar.style.height = `${level}%`;

  // Update Status Text and Bar Color only if game is running
  if (data.gameIsRunning) {
    statusText.style.color = "#aaa";
    statusText.style.fontWeight = "normal";
    resetButton.style.display = "none";

    // Status text logic remains same...
    if (level < DANGER_LOW_THRESHOLD) {
      energyBar.style.backgroundColor = "blue";
      statusText.textContent = "Dangerously Low!";
    } else if (level < SAFE_ZONE_MIN) {
      energyBar.style.backgroundColor = "lightblue";
      statusText.textContent = "Low Power";
    } else if (level >= SAFE_ZONE_MIN && level <= SAFE_ZONE_MAX) {
      energyBar.style.backgroundColor = "lime";
      statusText.textContent = "Stable";
    } else if (level > SAFE_ZONE_MAX && level < DANGER_HIGH_THRESHOLD) {
      energyBar.style.backgroundColor = "orange";
      statusText.textContent = "High Power";
    } else if (level >= DANGER_HIGH_THRESHOLD) {
      energyBar.style.backgroundColor = "red";
      statusText.textContent = "Dangerously High!";
    } else {
      energyBar.style.backgroundColor = "grey";
      statusText.textContent = "Unknown State";
    }
  }

  // Update Coop Progress Display (logic remains same)
  if (
    data.coopWinTargetSeconds !== undefined &&
    data.coopWinProgressSeconds !== undefined
  ) {
    const target = data.coopWinTargetSeconds;
    const progress = data.coopWinProgressSeconds;
    const progressPercent =
      target > 0 ? Math.min(100, Math.floor((progress / target) * 100)) : 0;
    if (data.gameIsRunning || data.finalOutcomeReason === "coopWin") {
      coopProgressText.textContent = `Stability Goal: ${progress}s / ${target}s (${progressPercent}%)`;
    } else if (!data.gameIsRunning && data.finalOutcomeReason) {
      const outcomeText =
        data.finalOutcomeReason === "individualWin"
          ? `Individual Win: Player ${
              data.finalOutcomeWinner
                ? data.finalOutcomeWinner.substring(0, 6)
                : "???"
            }`
          : `Final Status: ${data.finalOutcomeReason}`;
      coopProgressText.textContent = outcomeText;
    } else {
      coopProgressText.textContent = "";
    }
  } else {
    coopProgressText.textContent = `Stability Goal: Waiting for data...`;
  }

  // +++ Update Event Alert based on Game State (in case we miss eventUpdate) +++
  updateEventAlert(data.activeEventType, data.activeEventEndTime);
});

// Listen for Game Over event
socket.on("gameOver", (data) => {
  console.log("Game Over received:", data);
  statusText.style.color = "red";
  statusText.style.fontWeight = "bold";
  let outcomeMessage = "Unknown";
  switch (data.reason) {
    case "coopWin":
      outcomeMessage = "Cooperative Win!";
      break;
    case "shutdown":
      outcomeMessage = "Grid Shutdown! (Low Energy)";
      break;
    case "meltdown":
      outcomeMessage = "Grid Meltdown! (High Energy)";
      break;
    case "individualWin":
      const winnerShortId = data.winnerId
        ? data.winnerId.substring(0, 6)
        : "???";
      outcomeMessage = `Individual Win by Player ${winnerShortId}!`;
      break;
    default:
      outcomeMessage = `Game Ended (${data.reason})`;
  }
  statusText.textContent = `!!! GAME OVER: ${outcomeMessage} !!!`;
  const finalStatusText =
    data.reason === "individualWin"
      ? `Individual Win: Player ${
          data.winnerId ? data.winnerId.substring(0, 6) : "???"
        }`
      : `Final Status: ${data.reason}`;
  coopProgressText.textContent = finalStatusText;
  resetButton.style.display = "block";
  // Clear event alert on game over
  updateEventAlert(null, 0);
});

// Listen for Game Reset event
socket.on("gameReset", () => {
  console.log("Game Reset received");
  statusText.textContent = "Game Resetting... Waiting for state...";
  statusText.style.color = "#aaa";
  statusText.style.fontWeight = "normal";
  coopProgressText.textContent = "Stability Goal: Waiting for data...";
  resetButton.style.display = "none";
  updateEventAlert(null, 0); // Clear event alert on reset
});

// --- Event Listener for Reset Button ---
resetButton.addEventListener("click", () => {
  socket.emit("requestReset");
});

// --- Listen for Event Updates ---
socket.on("eventUpdate", (eventData) => {
  console.log("Event Update:", eventData);
  updateEventAlert(eventData.type, eventData.endTime);
});

// --- Helper Function to Update Event Alert UI ---
function updateEventAlert(type, endTime) {
  if (eventAlertTimeout) {
    clearTimeout(eventAlertTimeout);
    eventAlertTimeout = null;
  } // Clear previous timer

  if (type) {
    let eventText = "Unknown Event";
    eventAlert.className = "event-active"; // Base class
    if (type === "surge") {
      eventText = "WARNING: Demand Surge!";
      eventAlert.classList.add("event-surge"); // Specific class for styling
    } else if (type === "efficiency") {
      eventText = "NOTICE: Efficiency Drive!";
      eventAlert.classList.add("event-efficiency"); // Specific class for styling
    }

    const now = Date.now();
    const durationMs = endTime - now;
    eventAlert.textContent = `${eventText} (${Math.ceil(
      durationMs / 1000
    )}s left)`;
    eventAlert.style.display = "block";

    // Set a timer to update/hide the alert when the event ends
    if (durationMs > 0) {
      eventAlertTimeout = setTimeout(() => {
        eventAlert.style.display = "none";
        eventAlert.className = ""; // Remove classes
        eventAlertTimeout = null;
      }, durationMs);
    } else {
      // Event already ended? Hide immediately
      eventAlert.style.display = "none";
      eventAlert.className = "";
    }
  } else {
    // No active event
    eventAlert.style.display = "none";
    eventAlert.className = "";
  }
}

socket.on("disconnect", () => {
  console.log("Disconnected from server (Display)");
  statusText.textContent = "Disconnected - Refresh Page";
  coopProgressText.textContent = "";
  resetButton.style.display = "none";
  updateEventAlert(null, 0); // Clear event alert
});
