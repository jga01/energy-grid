const express = require("express");
const http = require("http");
const path = require("path");
const { setupWebSocket } = require("./server/websocketHandler"); // Import WebSocket handler setup

const app = express();
const server = http.createServer(app); // Create HTTP server

const PORT = process.env.PORT || 3000;

// --- Serve Static Files ---
// Serve files from the 'public' directory (no change here)
app.use(express.static(path.join(__dirname, "public")));

// --- Routes ---
// (Routes remain the same)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});
app.get("/controller", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "controller.html"));
});

// --- Setup WebSocket ---
// Pass the HTTP server to the handler setup function
setupWebSocket(server);

// --- Start Server ---
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Access Display: http://localhost:${PORT}`);
  console.log(`Access Controller: http://localhost:${PORT}/controller`);
  console.log(
    "--> To connect phones: Use http://<YOUR_COMPUTER_IP>:" +
      PORT +
      "/controller on the same WiFi network!"
  );
  // Note: Game loop and event timer are started within websocketHandler/gameLogic now
});
