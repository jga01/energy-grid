const config = require("../config");
const gameState = require("./GameState");

let eventCheckIntervalId = null; // Stores the ID for the event trigger timer
let gameLoopIntervalId = null; // Stores the ID for the main game loop timer

// --- Event Handling ---

// Function to attempt triggering a random event
function triggerRandomEvent() {
  // Don't trigger if game is over or an event is already active
  if (!gameState.gameIsRunning || gameState.activeEvent.type !== null) {
    return null;
  }

  // Check if the random chance passes
  if (Math.random() * 100 <= config.EVENT_CHANCE_PERCENT) {
    // Trigger an event! Choose one randomly from the config list
    const chosenEventType =
      config.EVENT_TYPES[Math.floor(Math.random() * config.EVENT_TYPES.length)];
    const now = Date.now();
    // Update the game state with the active event details
    gameState.activeEvent = {
      type: chosenEventType,
      endTime: now + config.EVENT_DURATION_MS,
    };
    console.log(
      `--- EVENT TRIGGERED: ${gameState.activeEvent.type} until ${new Date(
        gameState.activeEvent.endTime
      ).toLocaleTimeString()} ---`
    );
    // Return the active event data so it can be broadcast
    return gameState.activeEvent;
  } else {
    // console.log("Event check: No event triggered."); // Optional debug log
    return null; // No event triggered this time
  }
}

// Function to clear the currently active event
function clearActiveEvent() {
  // Only clear if an event is actually active
  if (gameState.activeEvent.type !== null) {
    console.log(`--- EVENT ENDED: ${gameState.activeEvent.type} ---`);
    // Reset the active event state
    gameState.activeEvent = { type: null, endTime: 0 };
    return true; // Indicate that an event was cleared
  }
  return false; // Indicate that no event was active to clear
}

// Function to start the interval timer that periodically checks if an event should trigger
function startEventTimer() {
  // Clear any existing timer before starting a new one
  if (eventCheckIntervalId) {
    clearInterval(eventCheckIntervalId);
  }
  console.log(
    `Starting event check timer (Interval: ${
      config.EVENT_CHECK_INTERVAL_MS / 1000
    }s, Chance: ${config.EVENT_CHANCE_PERCENT}%)`
  );
  // Set the interval
  eventCheckIntervalId = setInterval(() => {
    // Call the function to potentially trigger an event
    const newEvent = triggerRandomEvent();
    // If an event was triggered AND the broadcast function has been provided, broadcast it
    if (newEvent && module.exports.broadcastEventUpdate) {
      module.exports.broadcastEventUpdate(newEvent); // Use the exported broadcast function
    }
  }, config.EVENT_CHECK_INTERVAL_MS); // Use interval from config
}

// Function to stop the event triggering interval timer
function stopEventTimer() {
  if (eventCheckIntervalId) {
    clearInterval(eventCheckIntervalId);
    eventCheckIntervalId = null;
    console.log("Stopped event check timer.");
  }
}

// --- Action Effects --- (These are called by websocketHandler when a client sends an action)

// Apply the effect of a "generate" action from a player
function applyGenerate(playerId) {
  // Ignore if game isn't running
  if (!gameState.gameIsRunning) return;

  let currentGain = config.BASE_ENERGY_GAIN_PER_CLICK; // Start with base gain
  const now = Date.now();

  // Check if Stabilize effect is active (takes priority over events)
  if (now < gameState.stabilizeEffectEndTime) {
    currentGain *= config.STABILIZE_GAIN_MULTIPLIER; // Reduce gain
  }
  // Check if Efficiency event is active (only if Stabilize is not)
  else if (
    gameState.activeEvent.type === "efficiency" &&
    now < gameState.activeEvent.endTime
  ) {
    currentGain *= config.EVENT_EFFICIENCY_GAIN_MULTIPLIER; // Increase gain
  }

  // Add the calculated energy gain to the grid, ensuring it doesn't exceed MAX
  gameState.energyLevel = Math.min(
    config.MAX_ENERGY,
    gameState.energyLevel + currentGain
  );
}

// Apply the effect of a "stabilize" action from a player
function applyStabilize(playerId) {
  // Ignore if game isn't running
  if (!gameState.gameIsRunning) return null;

  const now = Date.now();
  const player = gameState.getPlayer(playerId); // Get player data from GameState

  // Check if player exists and is not on cooldown for this action
  if (player && now >= player.stabilizeCooldownEnd) {
    console.log(`Stabilize action processing for Player ${playerId}`);
    // Activate the server-wide stabilize effect
    gameState.stabilizeEffectEndTime = now + config.STABILIZE_DURATION_MS;
    // Put the player on cooldown
    player.stabilizeCooldownEnd = now + config.STABILIZE_COOLDOWN_MS;
    // Return data needed for websocketHandler to send back to clients
    return {
      cooldownEndTimestamp: player.stabilizeCooldownEnd, // Player's specific cooldown end
      effectEndTimestamp: gameState.stabilizeEffectEndTime, // Global effect end time
    };
  } else if (player) {
    // Player exists but is on cooldown
    console.log(`Stabilize blocked for ${playerId}, player on cooldown.`);
    // Still return cooldown info so client can be notified/sync
    return { cooldownEndTimestamp: player.stabilizeCooldownEnd };
  }
  // Player not found or other issue
  return null;
}

// Apply the effect of a "stealGrid" action from a player
function applyStealGrid(playerId) {
  // Ignore if game isn't running
  if (!gameState.gameIsRunning)
    return { success: false, reason: "Game not running" };

  const now = Date.now();
  const player = gameState.getPlayer(playerId);

  // Check if player exists
  if (!player) return { success: false, reason: "Player not found" };

  // Check if player is on cooldown for this action
  if (now < player.stealGridCooldownEnd) {
    console.log(`Steal Grid blocked for ${playerId}, player on cooldown.`);
    return {
      success: false,
      reason: "cooldown",
      cooldownEndTimestamp: player.stealGridCooldownEnd,
    };
  }

  // Check if there's enough energy in the grid to steal
  if (gameState.energyLevel < config.STEAL_GRID_COST) {
    console.log(`Steal Grid blocked for ${playerId}, not enough grid energy.`);
    return { success: false, reason: "Insufficient grid energy" };
  }

  // Action is valid, apply effects
  console.log(`Steal Grid action processing for Player ${playerId}`);
  // Decrease grid energy (ensure not below MIN)
  gameState.energyLevel = Math.max(
    config.MIN_ENERGY,
    gameState.energyLevel - config.STEAL_GRID_COST
  );
  // Increase player's personal stash
  player.personalStash += config.STEAL_STASH_GAIN;
  // Set the player's cooldown for this action
  player.stealGridCooldownEnd = now + config.STEAL_COOLDOWN_MS;

  // Check if this steal resulted in an individual win
  const won = player.personalStash >= config.STASH_WIN_TARGET;
  if (won) {
    console.log(`--- INDIVIDUAL WIN logic triggered by Player ${playerId} ---`);
  }

  // Return success and relevant data
  return {
    success: true,
    cooldownEndTimestamp: player.stealGridCooldownEnd,
    newStashAmount: player.personalStash,
    didWin: won, // Signal to websocketHandler if win occurred
  };
}

// Apply the effect of an "emergencyAdjust" action from a player
function applyEmergencyAdjust(playerId) {
  // Ignore if game isn't running
  if (!gameState.gameIsRunning)
    return { success: false, reason: "Game not running" };

  const now = Date.now();
  const player = gameState.getPlayer(playerId);

  // Check if player exists
  if (!player) return { success: false, reason: "Player not found" };

  // Check cooldown for this action
  if (now < player.emergencyAdjustCooldownEnd) {
    console.log(
      `Emergency Adjust blocked for ${playerId}, player on cooldown.`
    );
    return {
      success: false,
      reason: "cooldown",
      cooldownEndTimestamp: player.emergencyAdjustCooldownEnd,
    };
  }

  console.log(`Emergency Adjust action processing for Player ${playerId}`);
  let energyChange = 0; // Amount to change grid energy by
  let misuse = false; // Flag if used incorrectly

  // Determine effect based on current grid energy level compared to danger thresholds
  if (gameState.energyLevel < config.DANGER_LOW_THRESHOLD) {
    // Apply Boost effect
    energyChange = config.EMERGENCY_BOOST_AMOUNT;
    console.log(` > Applying Boost (+${energyChange})`);
  } else if (gameState.energyLevel > config.DANGER_HIGH_THRESHOLD) {
    // Apply Coolant effect
    energyChange = -config.EMERGENCY_COOLANT_AMOUNT; // Negative value
    console.log(` > Applying Coolant (${energyChange})`);
  } else {
    // Energy is NOT in a danger zone - apply penalty
    misuse = true;
    // Penalty pushes energy slightly towards the NEAREST danger zone
    if (gameState.energyLevel < (config.MAX_ENERGY + config.MIN_ENERGY) / 2) {
      // Closer to 0%
      energyChange = -config.EMERGENCY_PENALTY_WRONG_ZONE; // Subtract energy
      console.log(` > Misused! Applying penalty (${energyChange})`);
    } else {
      // Closer to 100%
      energyChange = config.EMERGENCY_PENALTY_WRONG_ZONE; // Add energy
      console.log(` > Misused! Applying penalty (+${energyChange})`);
    }
  }

  // Apply the calculated energy change to the grid level
  // Ensure the result stays within the MIN and MAX energy bounds
  gameState.energyLevel = Math.max(
    config.MIN_ENERGY,
    Math.min(config.MAX_ENERGY, gameState.energyLevel + energyChange)
  );

  // Set the player's cooldown for this action
  player.emergencyAdjustCooldownEnd = now + config.EMERGENCY_ADJUST_COOLDOWN_MS;

  // Return success and relevant data
  return {
    success: true,
    cooldownEndTimestamp: player.emergencyAdjustCooldownEnd,
    misused: misuse, // Let handler know if it was a penalty
  };
}

// --- Game Loop Update Function ---
// This function is called repeatedly by setInterval
function updateGame() {
  // Don't do anything if the game isn't running
  if (!gameState.gameIsRunning) return { updated: false };

  const now = Date.now();
  let stateChanged = false; // Flag to track if anything changed that requires broadcasting state

  // --- 1. Apply Passive Energy Changes and Check Effect Durations ---
  let currentDecayRate = config.BASE_ENERGY_DECAY_RATE; // Start with base decay
  let stabilizeEffectEnded = false; // Flag if stabilize effect ends this tick
  let eventEnded = false; // Flag if a random event ends this tick

  // Check if Stabilize effect is active
  if (now < gameState.stabilizeEffectEndTime) {
    currentDecayRate *= config.STABILIZE_DECAY_MULTIPLIER; // Apply decay reduction
  } else if (gameState.stabilizeEffectEndTime > 0) {
    // Stabilize effect just ended this tick
    gameState.stabilizeEffectEndTime = 0; // Reset the end time
    stabilizeEffectEnded = true; // Mark that it ended
    stateChanged = true; // State changed, need to broadcast
  }

  // Check if Surge event is active (only affects decay)
  if (
    gameState.activeEvent.type === "surge" &&
    now < gameState.activeEvent.endTime
  ) {
    currentDecayRate *= config.EVENT_SURGE_DECAY_MULTIPLIER; // Increase decay rate
  }

  // Check if any active event's duration has passed
  if (
    gameState.activeEvent.type !== null &&
    now >= gameState.activeEvent.endTime
  ) {
    eventEnded = clearActiveEvent(); // Clear the event state
    if (eventEnded) stateChanged = true; // State changed, need to broadcast
  }

  // Calculate and apply energy decay for this tick
  const decayAmount = currentDecayRate * (config.GAME_LOOP_INTERVAL_MS / 1000); // Scale decay by interval time
  if (decayAmount > 0) {
    const oldEnergy = gameState.energyLevel;
    gameState.energyLevel = Math.max(
      config.MIN_ENERGY,
      gameState.energyLevel - decayAmount
    ); // Apply decay, ensure not below MIN
    gameState.energyLevel = Math.min(config.MAX_ENERGY, gameState.energyLevel); // Ensure not above MAX (safety clamp)
    // Mark state changed only if energy actually changed value
    if (gameState.energyLevel !== oldEnergy) stateChanged = true;
  }

  // --- 2. Check Win/Loss Conditions ---
  let gameOverReason = null; // Store reason if game ends this tick
  let winnerId = null; // Store winner ID if applicable

  // Cooperative Win Check: Is energy in safe zone?
  if (
    gameState.energyLevel >= config.SAFE_ZONE_MIN &&
    gameState.energyLevel <= config.SAFE_ZONE_MAX
  ) {
    gameState.cumulativeStableTimeMs += config.GAME_LOOP_INTERVAL_MS; // Add time spent in zone
    // Check if cumulative time meets the win requirement
    if (
      gameState.cumulativeStableTimeMs >=
      config.COOP_WIN_DURATION_SECONDS * 1000
    ) {
      gameOverReason = "coopWin";
    }
  }

  // Loss Condition Check: Low Energy Timeout
  if (gameState.energyLevel < config.DANGER_LOW_THRESHOLD) {
    gameState.continuousTimeInDangerLowMs += config.GAME_LOOP_INTERVAL_MS; // Add time spent in danger
    // Check if time limit exceeded
    if (
      gameState.continuousTimeInDangerLowMs >=
      config.DANGER_TIME_LIMIT_SECONDS * 1000
    ) {
      gameOverReason = "shutdown";
    }
  } else {
    // Energy is out of low danger zone, reset the timer
    if (gameState.continuousTimeInDangerLowMs > 0) stateChanged = true; // Mark changed if timer was reset
    gameState.continuousTimeInDangerLowMs = 0;
  }

  // Loss Condition Check: High Energy Timeout
  if (gameState.energyLevel > config.DANGER_HIGH_THRESHOLD) {
    gameState.continuousTimeInDangerHighMs += config.GAME_LOOP_INTERVAL_MS; // Add time spent in danger
    // Check if time limit exceeded
    if (
      gameState.continuousTimeInDangerHighMs >=
      config.DANGER_TIME_LIMIT_SECONDS * 1000
    ) {
      gameOverReason = "meltdown";
    }
  } else {
    // Energy is out of high danger zone, reset the timer
    if (gameState.continuousTimeInDangerHighMs > 0) stateChanged = true; // Mark changed if timer was reset
    gameState.continuousTimeInDangerHighMs = 0;
  }

  // If a win/loss condition was met this tick...
  if (gameOverReason) {
    gameState.setGameOver(gameOverReason, winnerId); // Update the central game state
    stopEventTimer(); // Stop trying to trigger new random events
    clearActiveEvent(); // Ensure any active event is cleared
    stateChanged = true; // Game ending is definitely a state change
    // Return specific object indicating game over
    return {
      updated: true,
      gameOver: true,
      reason: gameOverReason,
      winnerId: winnerId,
    };
  }

  // If game didn't end, return general update status
  return {
    updated: stateChanged,
    stabilizeEnded: stabilizeEffectEnded,
    eventEnded: eventEnded,
  };
}

// --- Game Loop Control ---

// Function to start the main game loop interval
function startGameLoop(
  broadcastGameStateFunc,
  broadcastEventUpdateFunc,
  broadcastStabilizeUpdateFunc,
  broadcastGameOverFunc
) {
  // Clear any existing game loop interval first
  if (gameLoopIntervalId) clearInterval(gameLoopIntervalId);

  // Store the broadcast functions provided by websocketHandler so `updateGame` can use them
  // We store them on module.exports so other functions in this file can access them too
  module.exports.broadcastGameState = broadcastGameStateFunc;
  module.exports.broadcastEventUpdate = broadcastEventUpdateFunc;
  module.exports.broadcastStabilizeUpdate = broadcastStabilizeUpdateFunc;
  module.exports.broadcastGameOver = broadcastGameOverFunc;

  // Set the interval to run the updateGame function repeatedly
  gameLoopIntervalId = setInterval(() => {
    const updateResult = updateGame(); // Run the game logic update

    // Check the result of the update
    if (updateResult.gameOver && module.exports.broadcastGameOver) {
      // If game ended, broadcast the final outcome
      module.exports.broadcastGameOver({
        reason: updateResult.reason,
        winnerId: updateResult.winnerId,
      });
      // Note: state was already set by gameState.setGameOver inside updateGame
    } else if (updateResult.updated && module.exports.broadcastGameState) {
      // If state changed (or effects ended) and game didn't end, broadcast the current state
      module.exports.broadcastGameState(gameState.getCurrentSnapshot(config));
      // If stabilize effect ended this tick, broadcast that update
      if (
        updateResult.stabilizeEnded &&
        module.exports.broadcastStabilizeUpdate
      ) {
        module.exports.broadcastStabilizeUpdate({
          active: false,
          endTimestamp: 0,
        });
      }
      // If a random event ended this tick, broadcast that update
      if (updateResult.eventEnded && module.exports.broadcastEventUpdate) {
        module.exports.broadcastEventUpdate({ type: null, endTime: 0 });
      }
    }
    // If !updateResult.updated, nothing significant changed, so no broadcast is needed this tick
  }, config.GAME_LOOP_INTERVAL_MS); // Use interval from config

  console.log("Game loop started.");
}

// Function to stop the main game loop interval
function stopGameLoop() {
  if (gameLoopIntervalId) {
    clearInterval(gameLoopIntervalId);
    gameLoopIntervalId = null;
    console.log("Game loop stopped.");
  }
}

// --- Reset Logic ---

// Function to reset the game logic state, called by websocketHandler
function resetGameLogic() {
  console.log("Resetting game logic...");
  stopGameLoop(); // Stop current loop
  stopEventTimer(); // Stop event timer

  // Call the reset method on the central gameState object
  // This now handles resetting player stats internally as well
  gameState.reset();

  // Restart the event timer for the new game
  startEventTimer();

  // Note: The game loop is restarted by websocketHandler after the reset is fully processed
  console.log("Game logic reset complete.");
}

module.exports = {
  startGameLoop,
  stopGameLoop,
  resetGameLogic,
  applyGenerate,
  applyStabilize,
  applyStealGrid,
  applyEmergencyAdjust,
  broadcastGameState: null,
  broadcastEventUpdate: null,
  broadcastStabilizeUpdate: null,
  broadcastGameOver: null,
};
