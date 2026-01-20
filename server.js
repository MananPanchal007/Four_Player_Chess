const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Game State on Server (Simple)
let players = {
  red: null,
  blue: null,
  yellow: null,
  green: null
};
const colors = ['red', 'blue', 'yellow', 'green'];
let currentTurnIndex = 0; // 0=Red, 1=Blue, 2=Yellow, 3=Green

io.on('connection', (socket) => {
  console.log('a user connected: ' + socket.id);

  // Join Event with Name
  socket.on('join', (name) => {
    let assignedColor = null;
    for (const color of colors) {
      if (!players[color]) {
        players[color] = { id: socket.id, name: name };
        assignedColor = color;
        break;
      }
    }

    if (assignedColor) {
      socket.emit('init', { color: assignedColor, turnIndex: currentTurnIndex, players });
      io.emit('playerUpdate', players);
      console.log(`Assigned ${assignedColor} to ${name} (${socket.id})`);
    } else {
      socket.emit('spectator', { turnIndex: currentTurnIndex, players });
      console.log(`User ${name} (${socket.id}) is spectator`);
    }
  });

  socket.on('disconnect', () => {
    console.log('user disconnected ' + socket.id);
    let disconnectedColor = null;
    for (const color of colors) {
      if (players[color] && players[color].id === socket.id) {
        players[color] = null;
        disconnectedColor = color;
        break;
      }
    }
    if (disconnectedColor) {
      io.emit('playerUpdate', players);
    }
  });

  // Relay moves to all clients
  socket.on('move', (msg) => {
    // Find player color
    let playerColor = null;
    for (const c of colors) {
      if (players[c] && players[c].id === socket.id) {
        playerColor = c;
        break;
      }
    }

    if (playerColor && playerColor === colors[currentTurnIndex] && msg.color === playerColor) {
      io.emit('move', msg);
      currentTurnIndex = (currentTurnIndex + 1) % 4;
      io.emit('turnChange', currentTurnIndex);
    }
  });

  socket.on('endGame', () => {
    // Reset game
    console.log("Game Ended by user");
    currentTurnIndex = 0;
    // Optionally reset connections? No, just reset board.
    io.emit('gameEnded');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
