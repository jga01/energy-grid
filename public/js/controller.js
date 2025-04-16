// Establish WebSocket connection to the server automatically
const socket = io();

// --- Get References to HTML Elements ---
const generateButton = document.getElementById("generate-button");
const stabilizeButton = document.getElementById("stabilize-button");
const stealGridButton = document.getElementById("steal-grid-button");
const emergencyButton = document.getElementById("emergency-button");
const statusText = document.getElementById("controller-status");
const stashAmountText = document.getElementById("stash-amount");
const stashTargetText = document.getElementById("stash-target");

// Array of ALL action buttons for easier iteration
const allActionButtons = [
  generateButton,
  stabilizeButton,
  stealGridButton,
  emergencyButton,
];
// Map action names to buttons for easier lookup
const actionButtonMap = {
  stabilize: stabilizeButton,
  stealGrid: stealGridButton,
  emergencyAdjust: emergencyButton,
};

// --- Cooldown Management State ---
// Variables to hold the interval timer ID for updating the cooldown display visually
let stabilizeCooldownInterval = null;
let stealGridCooldownInterval = null;
let emergencyAdjustCooldownInterval = null;

// Variables to hold the exact timestamp (milliseconds since epoch) when the cooldown ends
let stabilizeCooldownEndTime = 0;
let stealGridCooldownEndTime = 0;
let emergencyAdjustCooldownEndTime = 0;

// Map action names to their interval variables and end times for easier access
const cooldownState = {
  stabilize: { interval: null, endTime: 0, button: stabilizeButton },
  stealGrid: { interval: null, endTime: 0, button: stealGridButton },
  emergencyAdjust: { interval: null, endTime: 0, button: emergencyButton },
};

// --- Helper Functions ---

/**
 * Enables or disables all action buttons based on the game's running state.
 * Crucially, it respects existing cooldowns: a button will NOT be enabled
 * by this function if its specific cooldown is still active.
 * @param {boolean} isGameRunning - Indicates if the main game loop is active.
 */
function setButtonInteractability(isGameRunning) {
  // Handle the Generate button directly
  generateButton.disabled = !isGameRunning;

  // Handle Special Action Buttons
  for (const actionType in cooldownState) {
    const state = cooldownState[actionType];
    const button = state.button;
    const isOnCooldown = state.interval !== null || state.endTime > Date.now();

    if (!isGameRunning) {
      // If game is not running, disable unconditionally
      button.disabled = true;
    } else {
      // If game IS running, enable ONLY if NOT on cooldown
      button.disabled = isOnCooldown;
    }
  }

  // Update status text based on game state, but only if no cooldowns are active
  // and no temporary failure message is shown.
  const anyCooldownActive = Object.values(cooldownState).some(
    (s) => s.interval !== null
  );
  if (!isGameRunning && !anyCooldownActive) {
    statusText.textContent = "Game Over / Waiting";
  } else if (
    isGameRunning &&
    !anyCooldownActive &&
    !statusText.textContent.startsWith("Failed:") &&
    !statusText.textContent.startsWith("Misused!")
  ) {
    statusText.textContent = "Connected - Ready";
  }
}

/**
 * Updates the visual display of a cooldown timer on a specific button.
 * Disables the button while on cooldown and re-enables it when expired (if game is running).
 * Updates the button's text to show remaining seconds.
 * Updates the main controller status text with cooldown info.
 * @param {string} actionType - The type of action ('stabilize', 'stealGrid', 'emergencyAdjust').
 */
function updateCooldownDisplay(actionType) {
  const state = cooldownState[actionType];
  if (!state) return; // Should not happen

  const buttonElement = state.button;
  const cooldownEndTime = state.endTime;
  const now = Date.now();
  const timeLeftMilliseconds = cooldownEndTime - now;
  const timerSpan = buttonElement.querySelector(".cooldown-timer");

  if (timeLeftMilliseconds <= 0) {
    // --- Cooldown Finished ---
    // Stop the interval timer
    clearInterval(state.interval);
    state.interval = null; // Update state

    // Clear the timer text from the button
    if (timerSpan) timerSpan.textContent = "";

    // Re-enable the button *only if the game is still considered running*
    // Check generateButton state as a proxy (it's updated reliably by setButtonInteractability)
    const isGameRunning = !generateButton.disabled;
    buttonElement.disabled = !isGameRunning; // Enable if game is running

    // Check if any *other* cooldowns are still active
    const anyOtherCooldownActive = Object.entries(cooldownState).some(
      ([type, s]) => type !== actionType && s.interval !== null
    );

    // Update status text if applicable
    if (
      isGameRunning &&
      !anyOtherCooldownActive &&
      !statusText.textContent.startsWith("Failed:") &&
      !statusText.textContent.startsWith("Misused!")
    ) {
      statusText.textContent = "Connected - Ready";
    }
  } else {
    // --- Cooldown Still Active ---
    // Ensure button remains disabled
    buttonElement.disabled = true;

    // Calculate and display remaining seconds
    const secondsLeft = Math.ceil(timeLeftMilliseconds / 1000);
    if (timerSpan) timerSpan.textContent = ` (${secondsLeft}s)`;

    // Update the main controller status text
    const actionNameFriendly =
      actionType.charAt(0).toUpperCase() +
      actionType.slice(1).replace("Grid", "").replace("Adjust", " Adjust");
    const cooldownStatusText = `${actionNameFriendly} Cooldown: ${secondsLeft}s`;

    // Only update status if not showing a temporary failure message
    if (
      !statusText.textContent.startsWith("Failed:") &&
      !statusText.textContent.startsWith("Misused!")
    ) {
      statusText.textContent = cooldownStatusText;
    }
  }
}

// --- WebSocket Event Handlers ---

socket.on("connect", () => {
  console.log("Connected to server (Controller)");
  statusText.textContent = "Connected - Waiting for game state...";
  setButtonInteractability(false); // Start disabled
  stashTargetText.textContent = "??";
});

socket.on("gameStateUpdate", (data) => {
  // Set button interactability based on game running state, respecting current cooldowns
  setButtonInteractability(data.gameIsRunning);

  // Update stash display
  if (data.personalStash !== undefined) {
    stashAmountText.textContent = data.personalStash;
  }
  if (data.stashWinTarget !== undefined) {
    stashTargetText.textContent = data.stashWinTarget;
  }
});

socket.on("actionCooldown", (data) => {
  console.log("Cooldown update received:", data);
  const actionType = data.action;
  const state = cooldownState[actionType];

  if (!state) {
    console.warn("Received cooldown for unknown action:", actionType);
    return;
  }

  // Clear any previous interval timer for this action
  if (state.interval) {
    clearInterval(state.interval);
    state.interval = null;
  }

  // Update the cooldown end time in our state
  state.endTime = data.cooldownEndTimestamp;

  // Check if the cooldown is active (end time is in the future)
  if (state.endTime > Date.now()) {
    state.button.disabled = true; // Ensure button is disabled now
    updateCooldownDisplay(actionType); // Update display immediately (shows timer)

    // Start a new interval timer to update the display periodically
    state.interval = setInterval(() => {
      updateCooldownDisplay(actionType);
    }, 500); // Update twice per second
  } else {
    // Cooldown is already over (or timestamp was 0 for reset)
    state.endTime = 0; // Ensure endTime is 0 if it was in the past
    // Check if game is running to determine if button should be enabled
    const isGameRunning = !generateButton.disabled;
    state.button.disabled = !isGameRunning; // Enable if game is running, disable if not

    // Clear timer text
    const timerSpan = state.button.querySelector(".cooldown-timer");
    if (timerSpan) timerSpan.textContent = "";

    // Update status text if game is ready and no other cooldowns active
    const anyOtherCooldownActive = Object.entries(cooldownState).some(
      ([type, s]) => type !== actionType && s.interval !== null
    );
    if (
      isGameRunning &&
      !anyOtherCooldownActive &&
      !statusText.textContent.startsWith("Failed:") &&
      !statusText.textContent.startsWith("Misused!")
    ) {
      statusText.textContent = "Connected - Ready";
    }
  }
});

socket.on("personalStashUpdate", (data) => {
  console.log("Stash update received:", data);
  if (data.personalStash !== undefined) {
    stashAmountText.textContent = data.personalStash;
  }
});

socket.on("actionFailed", (data) => {
  console.warn(`Action failed: ${data.action}, Reason: ${data.reason}`);

  // If the failure was due to cooldown, the 'actionCooldown' message
  // should arrive shortly after and handle the button state/timer correctly.
  // We just need to show the temporary status message.

  const failureText =
    data.reason === "Used in wrong zone!"
      ? "Misused!"
      : `Failed: ${data.reason}`;
  statusText.textContent = failureText;

  setTimeout(() => {
    if (statusText.textContent === failureText) {
      // Restore status based on current state
      const isGameRunning = !generateButton.disabled;
      const anyCooldownActive = Object.values(cooldownState).some(
        (s) => s.interval !== null
      );

      if (anyCooldownActive && isGameRunning) {
        // Let the next cooldown tick update the status
        // Find the active cooldown and trigger its update manually once for faster status recovery
        const activeCooldown = Object.entries(cooldownState).find(
          ([type, s]) => s.interval !== null
        );
        if (activeCooldown) {
          updateCooldownDisplay(activeCooldown[0]);
        }
      } else if (isGameRunning) {
        statusText.textContent = "Connected - Ready";
      } else {
        statusText.textContent = "Game Over / Waiting";
      }
    }
  }, 2000); // Show failure message for 2 seconds
});

socket.on("gameOver", (data) => {
  console.log("Game Over received on controller:", data);
  setButtonInteractability(false); // Disable all buttons

  // Clear all cooldown intervals and reset state
  for (const actionType in cooldownState) {
    const state = cooldownState[actionType];
    if (state.interval) {
      clearInterval(state.interval);
      state.interval = null;
    }
    state.endTime = 0;
    // Clear timer text
    const timerSpan = state.button.querySelector(".cooldown-timer");
    if (timerSpan) timerSpan.textContent = "";
  }

  statusText.textContent = `Game Over: ${data.reason}`; // Final status
});

socket.on("gameReset", () => {
  console.log("Game Reset received on controller");
  statusText.textContent = "Game Resetting...";
  stashAmountText.textContent = "0";
  stashTargetText.textContent = "??";

  // Clear all cooldown intervals and reset state
  for (const actionType in cooldownState) {
    const state = cooldownState[actionType];
    if (state.interval) {
      clearInterval(state.interval);
      state.interval = null;
    }
    state.endTime = 0;
    // Clear timer text
    const timerSpan = state.button.querySelector(".cooldown-timer");
    if (timerSpan) timerSpan.textContent = "";
  }

  setButtonInteractability(false); // Start disabled

  // The subsequent gameStateUpdate and actionCooldown(0) messages from the server
  // will correctly set the button states for the new game.
});

socket.on("disconnect", () => {
  console.log("Disconnected from server (Controller)");
  setButtonInteractability(false); // Disable buttons
  statusText.textContent = "Disconnected";

  // Clear all cooldown intervals and reset state
  for (const actionType in cooldownState) {
    const state = cooldownState[actionType];
    if (state.interval) {
      clearInterval(state.interval);
      state.interval = null;
    }
    state.endTime = 0;
    // Clear timer text
    const timerSpan = state.button.querySelector(".cooldown-timer");
    if (timerSpan) timerSpan.textContent = "";
  }
  stashTargetText.textContent = "??";
});

// --- Button Event Listeners ---
// Add listeners to all buttons

// Generate Power Button
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

// Special Action Buttons (using the map for consistency)
for (const actionType in actionButtonMap) {
  const button = actionButtonMap[actionType];
  button.addEventListener("click", () => {
    // Don't emit if already known to be disabled client-side (prevents race conditions)
    if (!button.disabled) {
      socket.emit(actionType);
      button.disabled = true; // Immediate visual feedback
    }
  });
  button.addEventListener(
    "touchstart",
    (e) => {
      if (!button.disabled) {
        e.preventDefault();
        socket.emit(actionType);
        button.classList.add("active");
        button.disabled = true; // Immediate visual feedback
      }
    },
    { passive: false }
  );
  button.addEventListener("touchend", () => {
    // The 'disabled' state will be managed by cooldown logic,
    // but remove the 'active' class for visual feedback.
    button.classList.remove("active");
  });
}
