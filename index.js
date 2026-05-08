const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let rooms = {}; // roomCode -> { players: {}, hostId, status: 'lobby'|'playing', settings }

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  // Create room
  socket.on('createRoom', (data) => {
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    rooms[roomCode] = {
      players: {},
      hostId: socket.id,
      status: 'lobby',
      maxPlayers: data.max || 8
    };
    socket.join(roomCode);
    rooms[roomCode].players[socket.id] = { id: socket.id, name: data.name || 'Player' };
    socket.emit('roomCreated', { roomCode });
  });

  // Join room
  socket.on('joinRoom', ({ roomCode, name }) => {
    const room = rooms[roomCode];
    if (!room || room.status === 'playing' || Object.keys(room.players).length >= room.maxPlayers) {
      socket.emit('joinError', 'Cannot join');
      return;
    }
    socket.join(roomCode);
    room.players[socket.id] = { id: socket.id, name: name || 'Player' };
    io.to(roomCode).emit('roomUpdate', room.players);
  });

  // Host starts game
  socket.on('startGame', (roomCode) => {
    const room = rooms[roomCode];
    if (room && room.hostId === socket.id) {
      room.status = 'playing';
      io.to(roomCode).emit('gameStarted');
      // Initialize game state here later
    }
  });

  // Player movement, eating, etc. (we'll expand)
  socket.on('playerMove', (data) => {
    const roomsList = Array.from(socket.rooms);
    const roomCode = roomsList[1]; // first is socket id
    if (roomCode && rooms[roomCode]) {
      io.to(roomCode).emit('playerMoved', { id: socket.id, ...data });
    }
  });

  socket.on('disconnect', () => {
    // Cleanup logic
    Object.keys(rooms).forEach(code => {
      if (rooms[code].players[socket.id]) {
        delete rooms[code].players[socket.id];
        io.to(code).emit('roomUpdate', rooms[code].players);
      }
    });
  });
});

server.listen(3000, () => console.log('🚀 Server running on http://localhost:3000'));
