const socket = io();
let currentScreen = 'main';
let roomCode = null;
let isHost = false;
let myId = null;

// UI Elements
const ui = document.getElementById('ui');
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

canvas.width = 800;
canvas.height = 600;

// Game State
let players = {};
let foods = [];
let myPlayer = { x: 400, y: 300, size: 15, color: '#22d3ee' };

// ====================== UI RENDERING ======================
function renderUI() {
  let html = '';

  if (currentScreen === 'main') {
    html = `
      <div class="menu-screen bg-zinc-900 p-8 rounded-2xl shadow-2xl text-center">
        <h1 class="text-5xl font-bold mb-2 bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
          DOT DEVOUR
        </h1>
        <p class="text-zinc-400 mb-8">Eat. Grow. Dominate.</p>
        
        <div class="space-y-4">
          <button onclick="hostGame()" class="w-full bg-cyan-500 hover:bg-cyan-600 py-4 rounded-xl text-xl font-semibold transition">
            Host New Game
          </button>
          <button onclick="showJoinPublic()" class="w-full bg-zinc-800 hover:bg-zinc-700 py-4 rounded-xl text-xl font-semibold transition">
            Join Public
          </button>
          <button onclick="showPrivateJoin()" class="w-full bg-zinc-800 hover:bg-zinc-700 py-4 rounded-xl text-xl font-semibold transition">
            Join Private
          </button>
        </div>
      </div>`;
  } 
  else if (currentScreen === 'lobby') {
    html = `
      <div class="menu-screen bg-zinc-900 p-8 rounded-2xl">
        <div class="flex justify-between mb-6">
          <h2 class="text-2xl font-bold">Lobby • ${roomCode}</h2>
          <span class="text-green-400">${Object.keys(players).length}/8</span>
        </div>
        
        <div id="playerList" class="bg-zinc-800 rounded-xl p-4 mb-6 min-h-[200px]"></div>
        
        ${isHost ? `<button onclick="startGame()" class="w-full bg-emerald-500 hover:bg-emerald-600 py-4 rounded-xl text-xl font-bold">START GAME</button>` : ''}
        <button onclick="leaveRoom()" class="w-full mt-3 bg-red-500/80 hover:bg-red-600 py-3 rounded-xl">Leave</button>
      </div>`;
  }

  ui.innerHTML = html;
  updatePlayerList();
}

function updatePlayerList() {
  const list = document.getElementById('playerList');
  if (!list) return;
  
  let str = '';
  Object.values(players).forEach(p => {
    str += `<div class="flex justify-between py-2 px-3 bg-zinc-900 rounded-lg mb-1">
              <span>${p.name}</span>
              <span class="text-cyan-400">${p.id === myId ? '(You)' : ''}</span>
            </div>`;
  });
  list.innerHTML = str || '<p class="text-zinc-500 text-center py-8">Waiting for players...</p>';
}

// ====================== SOCKET HANDLERS ======================
socket.on('roomCreated', (data) => {
  roomCode = data.roomCode;
  myId = data.playerId;
  isHost = true;
  currentScreen = 'lobby';
  renderUI();
});

socket.on('joinedRoom', (data) => {
  roomCode = data.roomCode;
  myId = data.playerId;
  isHost = false;
  currentScreen = 'lobby';
  renderUI();
});

socket.on('roomUpdate', (playerList) => {
  players = {};
  playerList.forEach(p => players[p.id] = p);
  renderUI();
});

socket.on('gameStarted', () => {
  currentScreen = 'game';
  ui.classList.add('hidden');
  canvas.classList.remove('hidden');
  initGame();
});

socket.on('playerMoved', (data) => {
  if (players[data.id]) {
    players[data.id].x = data.x;
    players[data.id].y = data.y;
  }
});

// ====================== GAME LOGIC ======================
function initGame() {
  // Spawn some food
  foods = [];
  for (let i = 0; i < 50; i++) {
    foods.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: 6
    });
  }
  gameLoop();
}

function gameLoop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw food
  ctx.fillStyle = '#eab308';
  foods.forEach(f => {
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
    ctx.fill();
  });

  // Draw players
  Object.values(players).forEach(p => {
    const size = (p.size || 15);
    ctx.fillStyle = p.id === myId ? myPlayer.color : '#a5b4fc';
    ctx.beginPath();
    ctx.arc(p.x || 400, p.y || 300, size, 0, Math.PI * 2);
    ctx.fill();
    
    // Name
    ctx.fillStyle = 'white';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(p.name || 'Player', p.x || 400, (p.y || 300) - size - 8);
  });

  requestAnimationFrame(gameLoop);
}

// ====================== INPUT ======================
let keys = {};
window.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

setInterval(() => {
  if (currentScreen !== 'game' || !myId) return;

  const speed = 5;
  if (keys['w'] || keys['arrowup']) myPlayer.y -= speed;
  if (keys['s'] || keys['arrowdown']) myPlayer.y += speed;
  if (keys['a'] || keys['arrowleft']) myPlayer.x -= speed;
  if (keys['d'] || keys['arrowright']) myPlayer.x += speed;

  // Keep in bounds
  myPlayer.x = Math.max(20, Math.min(canvas.width - 20, myPlayer.x));
  myPlayer.y = Math.max(20, Math.min(canvas.height - 20, myPlayer.y));

  socket.emit('playerMove', { x: myPlayer.x, y: myPlayer.y });
}, 1000 / 60);

// ====================== MENU ACTIONS ======================
function hostGame() {
  const name = prompt("Your name?", "ChadCube") || "Player";
  socket.emit('createRoom', { name, maxPlayers: 8 });
}

function showJoinPublic() {
  alert("Public rooms coming soon — use private code for now 🔥");
}

function showPrivateJoin() {
  const code = prompt("Enter Room Code:").toUpperCase().trim();
  if (!code) return;
  const name = prompt("Your name?", "ChadCube") || "Player";
  socket.emit('joinRoom', { roomCode: code, name });
}

function startGame() {
  if (isHost && roomCode) socket.emit('startGame', roomCode);
}

function leaveRoom() {
  window.location.reload();
}

// Initial render
renderUI();
