const socket = io(); // Connect to the server automatically

// --- Get Element References ---
const generateButton = document.getElementById("generate-button");
const stabilizeButton = document.getElementById("stabilize-button");
const stealGridButton = document.getElementById("steal-grid-button");
const emergencyButton = document.getElementById("emergency-button"); // Get emergency button
const statusText = document.getElementById("controller-status");
const stashAmountText = document.getElementById("stash-amount");
const stashTargetText = document.getElementById("stash-target"); // Get stash target element

// --- Cooldown Management State ---
// Variables to hold the interval timer ID for updating the cooldown display
let stabilizeCooldownInterval = null;
let stealGridCooldownInterval = null;
let emergencyAdjustCooldownInterval = null;
// Variables to hold the timestamp when the cooldown actually ends
let stabilizeCooldownEndTime = 0;
let stealGridCooldownEndTime = 0;
let emergencyAdjustCooldownEndTime = 0;

// --- Helper Functions ---

// Function to disable or enable all action buttons at once
function setAllButtonsDisabled(isDisabled) {
  generateButton.disabled = isDisabled;
  stabilizeButton.disabled = isDisabled;
  stealGridButton.disabled = isDisabled;
  emergencyButton.disabled = isDisabled; // Include emergency button

  // Check if any cooldown intervals are currently active
  const isStabilizeCD = stabilizeCooldownInterval !== null;
  const isStealCD = stealGridCooldownInterval !== null;
  const isEmergencyCD = emergencyAdjustCooldownInterval !== null;

  // Update the status text based on whether the game is over or ready,
  // but only if no cooldowns are currently being displayed.
  if (isDisabled && !isStabilizeCD && !isStealCD && !isEmergencyCD) {
    statusText.textContent = "Game Over / Waiting";
  } else if (!isDisabled && !isStabilizeCD && !isStealCD && !isEmergencyCD) {
    statusText.textContent = "Connected - Ready";
  } else if (!isDisabled && (isStabilizeCD || isStealCD || isEmergencyCD)) {
    // If buttons are enabled but a cooldown is active,
    // the updateCooldownDisplay function will handle the status text.
  }
}

// Function to update the visual display of a cooldown on a specific button
function updateCooldownDisplay(
  actionType,
  buttonElement,
  cooldownEndTime,
  intervalVariableSetter
) {
  const now = Date.now();
  const timeLeftMs = cooldownEndTime - now;
  const timerSpan = buttonElement.querySelector(".cooldown-timer"); // Find the span inside the button

  if (timeLeftMs <= 0) {
    // Cooldown finished
    buttonElement.disabled = false; // Re-enable the button
    if (timerSpan) timerSpan.textContent = ""; // Clear the timer text (e.g., "(5s)")
    clearInterval(intervalVariableSetter.interval); // Stop the interval timer
    intervalVariableSetter.set(null); // Set the interval variable (e.g., stabilizeCooldownInterval) to null

    // Check if the game is actually running (by checking if generate button is enabled)
    // before showing the "Ready" message.
    if (generateButton.disabled === false) {
      // Format the action name nicely for the status message
      const actionName =
        actionType.charAt(0).toUpperCase() +
        actionType.slice(1).replace("Grid", "").replace("Adjust", " Adjust");
      statusText.textContent = `${actionName} Ready`;
      // Set a timeout to clear the "Ready" message after a short period
      setTimeout(() => {
        // Only reset to "Connected - Ready" if the status hasn't been changed
        // by another message (e.g., another cooldown finishing).
        if (statusText.textContent === `${actionName} Ready`) {
          statusText.textContent = "Connected - Ready";
        }
      }, 1500); // Show ready message for 1.5 seconds
    }
  } else {
    // Cooldown is still active
    buttonElement.disabled = true; // Ensure button is disabled
    const secondsLeft = Math.ceil(timeLeftMs / 1000); // Calculate remaining seconds
    if (timerSpan) timerSpan.textContent = ` (${secondsLeft}s)`; // Update the timer text

    // Update the main status text ONLY if this specific interval is the one running
    // This prevents multiple cooldown messages overwriting each other rapidly.
    if (intervalVariableSetter.interval) {
      const actionName =
        actionType.charAt(0).toUpperCase() +
        actionType.slice(1).replace("Grid", "").replace("Adjust", " Adjust");
      // Avoid overwriting a "Failed" message immediately
      if (!statusText.textContent.startsWith("Failed:")) {
        statusText.textContent = `${actionName} Cooldown: ${secondsLeft}s`;
      }
    }
  }
}

// --- Socket Event Handlers ---

// When connection to server is established
socket.on("connect", () => {
  console.log("Connected to server (Controller)");
  statusText.textContent = "Connected - Waiting for game state...";
  setAllButtonsDisabled(true); // Start with buttons disabled
  stashTargetText.textContent = "??"; // Reset stash target display
});

// When receiving a game state update from the server
socket.on("gameStateUpdate", (data) => {
  // Enable or disable buttons based on whether the game is running
  setAllButtonsDisabled(!data.gameIsRunning);
  // Crucially, re-disable buttons if they are supposed to be on cooldown,
  // even if the game is running (overrides the line above).
  if (stabilizeCooldownInterval && data.gameIsRunning)
    stabilizeButton.disabled = true;
  if (stealGridCooldownInterval && data.gameIsRunning)
    stealGridButton.disabled = true;
  if (emergencyAdjustCooldownInterval && data.gameIsRunning)
    emergencyButton.disabled = true;

  // Update status text if game is over or no cooldowns are active
  if (!data.gameIsRunning) {
    statusText.textContent = "Game Over - Waiting for Reset";
  } else if (
    !stabilizeCooldownInterval &&
    !stealGridCooldownInterval &&
    !emergencyAdjustCooldownInterval
  ) {
    statusText.textContent = "Connected - Ready";
  }

  // Update personal stash amount if provided in the update
  if (data.personalStash !== undefined) {
    stashAmountText.textContent = data.personalStash;
  }
  // Update the stash win target if provided (usually on initial connect)
  if (data.stashWinTarget !== undefined) {
    stashTargetText.textContent = data.stashWinTarget;
  }
});

// When receiving specific cooldown information from the server
socket.on("actionCooldown", (data) => {
  console.log("Cooldown update received:", data);
  let actionType,
    buttonElement,
    intervalVariable,
    intervalSetter,
    cooldownEndTimeRef;

  // Determine which action this cooldown applies to
  if (data.action === "stabilize") {
    actionType = "stabilize";
    buttonElement = stabilizeButton;
    intervalVariable = stabilizeCooldownInterval;
    intervalSetter = {
      interval: intervalVariable,
      set: (val) => (stabilizeCooldownInterval = val),
    }; // Object to allow setting the correct interval variable
    cooldownEndTimeRef = stabilizeCooldownEndTime = data.cooldownEndTimestamp; // Store end time
  } else if (data.action === "stealGrid") {
    actionType = "stealGrid";
    buttonElement = stealGridButton;
    intervalVariable = stealGridCooldownInterval;
    intervalSetter = {
      interval: intervalVariable,
      set: (val) => (stealGridCooldownInterval = val),
    };
    cooldownEndTimeRef = stealGridCooldownEndTime = data.cooldownEndTimestamp;
  } else if (data.action === "emergencyAdjust") {
    actionType = "emergencyAdjust";
    buttonElement = emergencyButton;
    intervalVariable = emergencyAdjustCooldownInterval;
    intervalSetter = {
      interval: intervalVariable,
      set: (val) => (emergencyAdjustCooldownInterval = val),
    };
    cooldownEndTimeRef = emergencyAdjustCooldownEndTime =
      data.cooldownEndTimestamp;
  } else {
    return; // Ignore unknown actions
  }

  // Clear any existing interval timer for this action
  if (intervalSetter.interval) clearInterval(intervalSetter.interval);

  // If the cooldown end time is in the future, start the visual timer
  if (cooldownEndTimeRef > Date.now()) {
    updateCooldownDisplay(
      actionType,
      buttonElement,
      cooldownEndTimeRef,
      intervalSetter
    ); // Update display immediately
    // Start a new interval timer to update the display periodically
    intervalVariable = setInterval(
      () =>
        updateCooldownDisplay(
          actionType,
          buttonElement,
          cooldownEndTimeRef,
          intervalSetter
        ),
      500
    ); // Update twice per second
    intervalSetter.set(intervalVariable); // Store the new interval ID using the setter
  } else {
    // Cooldown is already over (e.g., received timestamp 0 on reset)
    buttonElement.disabled = false; // Ensure button is enabled
    const timerSpan = buttonElement.querySelector(".cooldown-timer");
    if (timerSpan) timerSpan.textContent = ""; // Clear timer text
    intervalSetter.set(null); // Ensure the interval variable is null
  }
});

// When receiving an update for the personal stash amount
socket.on("personalStashUpdate", (data) => {
  console.log("Stash update received:", data);
  if (data.personalStash !== undefined) {
    stashAmountText.textContent = data.personalStash;
  }
});

// When receiving a message that an action failed
socket.on("actionFailed", (data) => {
  console.warn(`Action failed: ${data.action}, Reason: ${data.reason}`);
  const originalStatus = statusText.textContent; // Store current status
  // Display the failure message
  const failureText =
    data.reason === "Used in wrong zone!"
      ? "Misused!"
      : `Failed: ${data.reason}`;
  statusText.textContent = failureText;
  // Set a timeout to clear the failure message after a couple of seconds
  setTimeout(() => {
    // Only restore the status if it hasn't been changed again in the meantime
    // (e.g., by a cooldown timer starting or another failure)
    if (statusText.textContent === failureText) {
      // Restore to appropriate status based on current game/cooldown state
      if (
        stabilizeCooldownInterval ||
        stealGridCooldownInterval ||
        emergencyAdjustCooldownInterval
      ) {
        // If any cooldown is active, let the interval update the status text
        // It's complex to immediately restore the correct cooldown text here,
        // so we let the next interval tick handle it.
      } else if (generateButton.disabled === false) {
        // Check if game running
        statusText.textContent = "Connected - Ready";
      } else {
        statusText.textContent = "Game Over / Waiting"; // Default if game not running
      }
    }
  }, 2000); // Show failure message for 2 seconds
});

// When receiving the game over message
socket.on("gameOver", (data) => {
  console.log("Game Over received on controller:", data);
  setAllButtonsDisabled(true); // Disable all buttons
  // Clear all active cooldown intervals
  if (stabilizeCooldownInterval) clearInterval(stabilizeCooldownInterval);
  if (stealGridCooldownInterval) clearInterval(stealGridCooldownInterval);
  if (emergencyAdjustCooldownInterval)
    clearInterval(emergencyAdjustCooldownInterval);
  stabilizeCooldownInterval = null;
  stealGridCooldownInterval = null;
  emergencyAdjustCooldownInterval = null;
  // Clear timer text from buttons
  stabilizeButton.querySelector(".cooldown-timer").textContent = "";
  stealGridButton.querySelector(".cooldown-timer").textContent = "";
  emergencyButton.querySelector(".cooldown-timer").textContent = "";
  // Display game over reason
  statusText.textContent = `Game Over: ${data.reason}`;
});

// When receiving the game reset message
socket.on("gameReset", () => {
  console.log("Game Reset received on controller");
  statusText.textContent = "Game Resetting...";
  stashAmountText.textContent = "0";
  stashTargetText.textContent = "??";

  // Explicitly clear intervals and reset visual state
  if (stabilizeCooldownInterval) clearInterval(stabilizeCooldownInterval);
  if (stealGridCooldownInterval) clearInterval(stealGridCooldownInterval);
  if (emergencyAdjustCooldownInterval)
    clearInterval(emergencyAdjustCooldownInterval);
  stabilizeCooldownInterval = null;
  stealGridCooldownInterval = null;
  emergencyAdjustCooldownInterval = null;

  stabilizeButton.disabled = true; // Disable initially
  stealGridButton.disabled = true;
  emergencyButton.disabled = true;
  generateButton.disabled = true; // Disable initially

  stabilizeButton.querySelector(".cooldown-timer").textContent = "";
  stealGridButton.querySelector(".cooldown-timer").textContent = "";
  emergencyButton.querySelector(".cooldown-timer").textContent = "";

  // The subsequent gameStateUpdate will correctly re-enable buttons if gameIsRunning=true
});

// When disconnected from the server
socket.on("disconnect", () => {
  console.log("Disconnected from server (Controller)");
  statusText.textContent = "Disconnected";
  setAllButtonsDisabled(true); // Disable buttons
  // Clear any running cooldown intervals
  if (stabilizeCooldownInterval) clearInterval(stabilizeCooldownInterval);
  if (stealGridCooldownInterval) clearInterval(stealGridCooldownInterval);
  if (emergencyAdjustCooldownInterval)
    clearInterval(emergencyAdjustCooldownInterval);
  stabilizeCooldownInterval = null;
  stealGridCooldownInterval = null;
  emergencyAdjustCooldownInterval = null;
  stashTargetText.textContent = "??"; // Reset stash target display
});

// --- Button Event Listeners ---

// Generate Button
generateButton.addEventListener("click", () => {
  socket.emit("generate");
});
generateButton.addEventListener(
  "touchstart",
  (e) => {
    e.preventDefault();
    socket.emit("generate");
    generateButton.classList.add("active");
  },
  { passive: false }
);
generateButton.addEventListener("touchend", () => {
  generateButton.classList.remove("active");
});

// Stabilize Button
stabilizeButton.addEventListener("click", () => {
  socket.emit("stabilize");
  stabilizeButton.disabled = true;
  statusText.textContent = "Activating Stabilize...";
});
stabilizeButton.addEventListener(
  "touchstart",
  (e) => {
    e.preventDefault();
    socket.emit("stabilize");
    stabilizeButton.classList.add("active");
    stabilizeButton.disabled = true;
    statusText.textContent = "Activating Stabilize...";
  },
  { passive: false }
);
stabilizeButton.addEventListener("touchend", () => {
  stabilizeButton.classList.remove("active");
});

// Steal Grid Button
stealGridButton.addEventListener("click", () => {
  socket.emit("stealGrid");
  stealGridButton.disabled = true;
  statusText.textContent = "Attempting Diversion...";
});
stealGridButton.addEventListener(
  "touchstart",
  (e) => {
    e.preventDefault();
    socket.emit("stealGrid");
    stealGridButton.classList.add("active");
    stealGridButton.disabled = true;
    statusText.textContent = "Attempting Diversion...";
  },
  { passive: false }
);
stealGridButton.addEventListener("touchend", () => {
  stealGridButton.classList.remove("active");
});

// Emergency Adjust Button
emergencyButton.addEventListener("click", () => {
  console.log("Emergency Adjust button clicked");
  socket.emit("emergencyAdjust");
  emergencyButton.disabled = true; // Disable visually immediately
  statusText.textContent = "Adjusting..."; // Provide immediate feedback
});
emergencyButton.addEventListener(
  "touchstart",
  (e) => {
    e.preventDefault();
    socket.emit("emergencyAdjust");
    emergencyButton.classList.add("active");
    emergencyButton.disabled = true;
    statusText.textContent = "Adjusting...";
  },
  { passive: false }
);
emergencyButton.addEventListener("touchend", () => {
  emergencyButton.classList.remove("active");
});
