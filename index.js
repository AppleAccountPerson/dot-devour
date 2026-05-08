const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { 
  cors: { origin: "*" }
});

// Serve frontend
app.use(express.static(__dirname));

let rooms = {};

io.on('connection', (socket) => {
  console.log('🔌 Player connected:', socket.id);

  socket.on('createRoom', ({ name, maxPlayers = 8 }) => {
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    rooms[roomCode] = {
      players: {},
      hostId: socket.id,
      status: 'lobby',
      maxPlayers
    };
    socket.join(roomCode);
    rooms[roomCode].players[socket.id] = { id: socket.id, name: name || `Player${Math.floor(Math.random()*999)}` };
    socket.emit('roomCreated', { roomCode, playerId: socket.id });
    io.to(roomCode).emit('roomUpdate', Object.values(rooms[roomCode].players));
  });

  socket.on('joinRoom', ({ roomCode, name }) => {
    const room = rooms[roomCode];
    if (!room) return socket.emit('joinError', 'Room not found');
    if (room.status === 'playing') return socket.emit('joinError', 'Game already started');
    if (Object.keys(room.players).length >= room.maxPlayers) return socket.emit('joinError', 'Room full');

    socket.join(roomCode);
    room.players[socket.id] = { 
      id: socket.id, 
      name: name || `Player${Math.floor(Math.random()*999)}` 
    };
    
    io.to(roomCode).emit('roomUpdate', Object.values(room.players));
    socket.emit('joinedRoom', { roomCode, playerId: socket.id });
  });

  socket.on('startGame', (roomCode) => {
    const room = rooms[roomCode];
    if (room && room.hostId === socket.id) {
      room.status = 'playing';
      io.to(roomCode).emit('gameStarted');
      // Game state will live here later
    }
  });

  // Movement & game events
  socket.on('playerMove', (data) => {
    const roomCode = Array.from(socket.rooms)[1];
    if (roomCode && rooms[roomCode]) {
      io.to(roomCode).emit('playerMoved', { id: socket.id, ...data });
    }
  });

  socket.on('disconnect', () => {
    Object.keys(rooms).forEach(code => {
      const room = rooms[code];
      if (room.players[socket.id]) {
        delete room.players[socket.id];
        io.to(code).emit('roomUpdate', Object.values(room.players));
        
        // Auto delete empty rooms
        if (Object.keys(room.players).length === 0) delete rooms[code];
      }
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
