const { Server } = require("socket.io");
const config = require("./config"); // Import config
const gameState = require("./game/GameState");
const { createPlayer } = require("./game/Player");
const gameLogic = require("./game/gameLogic");

let io = null; // Will be set by setup function

// --- Broadcast Functions --- (These will be called by gameLogic)
function broadcastGameState(stateSnapshot = null) {
  if (!io) return;
  // Sends the current game state to ALL connected clients
  io.emit(
    "gameStateUpdate",
    stateSnapshot || gameState.getCurrentSnapshot(config)
  );
}

function broadcastEventUpdate(eventData) {
  if (!io) return;
  // Sends information about the currently active (or cleared) random event to ALL clients
  io.emit("eventUpdate", eventData);
}

function broadcastStabilizeUpdate(stabilizeData) {
  if (!io) return;
  // Sends information about the stabilize effect activation/deactivation to ALL clients
  io.emit("stabilizeEffectUpdate", stabilizeData);
}

function broadcastGameOver(outcome) {
  if (!io) return;
  // Sends the final game over reason and winner (if any) to ALL clients
  io.emit("gameOver", outcome);
}

// Function to set up WebSocket event handlers
function setupWebSocket(httpServer) {
  io = new Server(httpServer); // Attach Socket.IO to the provided HTTP server

  // Listen for new client connections
  io.on("connection", (socket) => {
    console.log(`WebSocket connected: ${socket.id}`);

    // Create a new player object for this connection
    const newPlayer = createPlayer(socket.id);
    // Add the player to the central game state
    gameState.addPlayer(newPlayer);

    // Prepare the initial game state to send to this specific client
    const initialState = gameState.getCurrentSnapshot(config);
    initialState.personalStash = newPlayer.personalStash; // Include their starting stash
    initialState.stashWinTarget = config.STASH_WIN_TARGET; // Include the win target
    socket.emit("gameStateUpdate", initialState); // Send the initial state

    // Also send the current event status to the new client
    socket.emit("eventUpdate", gameState.activeEvent);

    // If the game is already over when the client connects, inform them immediately
    if (!gameState.gameIsRunning && gameState.finalGameOutcome.reason) {
      socket.emit("gameOver", gameState.finalGameOutcome);
    } else {
      // If the game is running, check if this player has any active cooldowns
      // (relevant if they reconnected or joined mid-game somehow)
      const player = gameState.getPlayer(socket.id);
      if (player) {
        // Check and send stabilize cooldown if active
        if (player.stabilizeCooldownEnd > Date.now()) {
          socket.emit("actionCooldown", {
            action: "stabilize",
            cooldownEndTimestamp: player.stabilizeCooldownEnd,
          });
        }
        // Check and send steal cooldown if active
        if (player.stealGridCooldownEnd > Date.now()) {
          socket.emit("actionCooldown", {
            action: "stealGrid",
            cooldownEndTimestamp: player.stealGridCooldownEnd,
          });
        }
        // Check and send emergency adjust cooldown if active
        if (player.emergencyAdjustCooldownEnd > Date.now()) {
          socket.emit("actionCooldown", {
            action: "emergencyAdjust",
            cooldownEndTimestamp: player.emergencyAdjustCooldownEnd,
          });
        }
      }
    }

    // --- Handle Player Actions ---

    // Listen for 'generate' action from this client
    socket.on("generate", () => {
      // Call the game logic function to apply the effect
      gameLogic.applyGenerate(socket.id);
      // Note: The result (energy level change) is broadcast periodically by the game loop,
      // not necessarily immediately after every click for efficiency.
    });

    // Listen for 'stabilize' action from this client
    socket.on("stabilize", () => {
      // Call the game logic function to attempt the action
      const result = gameLogic.applyStabilize(socket.id);
      // Check if the action resulted in a cooldown (successful or not)
      if (result && result.cooldownEndTimestamp) {
        // Send the cooldown information back to THIS client only
        socket.emit("actionCooldown", {
          action: "stabilize",
          cooldownEndTimestamp: result.cooldownEndTimestamp,
        });
        // If the action was successful and activated the effect, broadcast it
        if (result.effectEndTimestamp) {
          broadcastStabilizeUpdate({
            active: true,
            endTimestamp: result.effectEndTimestamp,
          });
        }
      }
      // No specific feedback needed if the action just failed (e.g., game not running)
    });

    // Listen for 'stealGrid' action from this client
    socket.on("stealGrid", () => {
      // Call the game logic function to attempt the action
      const result = gameLogic.applyStealGrid(socket.id);
      if (result.success) {
        // Action was successful (enough energy, off cooldown)
        // Send the new cooldown time to THIS client
        socket.emit("actionCooldown", {
          action: "stealGrid",
          cooldownEndTimestamp: result.cooldownEndTimestamp,
        });
        // Send the updated personal stash amount to THIS client
        socket.emit("personalStashUpdate", {
          personalStash: result.newStashAmount,
        });

        // Check if this successful steal triggered an individual win
        if (result.didWin) {
          // Set the game state to over, providing reason and winner ID
          const outcome = gameState.setGameOver("individualWin", socket.id);
          if (outcome) {
            // Double-check game was actually ended by this
            gameLogic.stopEventTimer(); // Stop random events from triggering
            gameLogic.clearActiveEvent(); // Clear any currently active event
            broadcastGameOver(gameState.finalGameOutcome); // Broadcast the win
          }
        } else {
          // If no win, broadcast the general game state because energy level changed
          broadcastGameState();
        }
      } else {
        // Action failed
        // Send a failure message back to THIS client
        socket.emit("actionFailed", {
          action: "stealGrid",
          reason: result.reason, // e.g., 'cooldown', 'Insufficient grid energy'
        });
        // If the failure was due to cooldown, resend the cooldown info
        if (result.reason === "cooldown" && result.cooldownEndTimestamp) {
          socket.emit("actionCooldown", {
            action: "stealGrid",
            cooldownEndTimestamp: result.cooldownEndTimestamp,
          });
        }
      }
    });

    // Listen for 'emergencyAdjust' action from this client
    socket.on("emergencyAdjust", () => {
      // Call the game logic function to attempt the action
      const result = gameLogic.applyEmergencyAdjust(socket.id);
      if (result.success) {
        // Action was successful (off cooldown)
        // Send the new cooldown time to THIS client
        socket.emit("actionCooldown", {
          action: "emergencyAdjust",
          cooldownEndTimestamp: result.cooldownEndTimestamp,
        });
        // Optionally, provide feedback if the action was misused
        if (result.misused) {
          socket.emit("actionFailed", {
            action: "emergencyAdjust",
            reason: "Used in wrong zone!",
          });
        }
        // Broadcast the general game state because energy level changed
        broadcastGameState();
      } else {
        // Action failed
        // Send a failure message back to THIS client
        socket.emit("actionFailed", {
          action: "emergencyAdjust",
          reason: result.reason, // e.g., 'cooldown', 'Game not running'
        });
        // If the failure was due to cooldown, resend the cooldown info
        if (result.reason === "cooldown" && result.cooldownEndTimestamp) {
          socket.emit("actionCooldown", {
            action: "emergencyAdjust",
            cooldownEndTimestamp: result.cooldownEndTimestamp,
          });
        }
      }
    });

    // --- Handle Reset Request ---
    // Listen for a 'requestReset' event (likely triggered from the display client)
    socket.on("requestReset", () => {
      console.log(`Reset requested via WebSocket by ${socket.id}`);
      // Only allow reset if the game is actually over
      if (!gameState.gameIsRunning) {
        // Tell the game logic to reset state variables and timers
        gameLogic.resetGameLogic();

        // Restart the main game loop, passing the broadcast functions again
        gameLogic.startGameLoop(
          broadcastGameState,
          broadcastEventUpdate,
          broadcastStabilizeUpdate,
          broadcastGameOver
        );

        // Notify all clients that the game has reset
        io.emit("gameReset");
        // Send the fresh initial game state to all clients
        broadcastGameState();
        // Explicitly send reset messages for cooldowns and stash to ensure clients sync
        io.emit("actionCooldown", {
          action: "stabilize",
          cooldownEndTimestamp: 0,
        });
        io.emit("actionCooldown", {
          action: "stealGrid",
          cooldownEndTimestamp: 0,
        });
        io.emit("actionCooldown", {
          action: "emergencyAdjust",
          cooldownEndTimestamp: 0,
        });
        io.emit("personalStashUpdate", { personalStash: 0 });
      } else {
        // Ignore reset request if game is currently running
        console.log("Reset request ignored, game is still running.");
        // Optionally notify the requester: socket.emit('resetDenied', { reason: 'Game still in progress' });
      }
    });

    // --- Handle Disconnect ---
    // Listen for the built-in 'disconnect' event for this client
    socket.on("disconnect", () => {
      console.log(`WebSocket disconnected: ${socket.id}`);
      // Remove the player from the game state
      gameState.removePlayer(socket.id);
      // Broadcast the updated game state (e.g., player count changed)
      broadcastGameState();
    });
  });

  console.log("WebSocket handler set up.");

  // Start the game loop initially when the server starts
  console.log("Starting initial game loop.");
  gameLogic.startGameLoop(
    broadcastGameState,
    broadcastEventUpdate,
    broadcastStabilizeUpdate,
    broadcastGameOver
  );
}

// Export the setup function to be called by server.js
module.exports = { setupWebSocket };
