// =========================================
// FUNCIONES DE UI (MENÚS, OVERLAYS)
// =========================================

function switchScreens(hideElement, showElement, duration = 300) {
    hideElement.style.opacity = "0";
    setTimeout(() => {
        hideElement.style.display = "none";
        showElement.style.display = "flex";
        showElement.style.opacity = "1";
    }, duration);
}

function showShare() {
    const shareContainer = document.getElementById("shareContainer");
    shareContainer.style.display = shareContainer.style.display === "flex" ? "none" : "flex";
}
function fullscreen() {
    const gameScreen = document.querySelector(".game-screen");
    if (!document.fullscreenElement) {
        gameScreen.requestFullscreen()
            .catch(err => console.log(`Error al entrar en fullscreen: ${err.message}`));
    } else {
        document.exitFullscreen();
    }
}

function activarCorazonToggle(selector) {
  const btn = document.querySelector(selector);

  btn.addEventListener('click', () => {
    btn.classList.toggle('liked');
    if (btn.classList.contains('liked')) {
      btn.classList.add('animate');
      setTimeout(() => btn.classList.remove('animate'), 400);
    }
  });
}

// =========================================
// INICIALIZACIÓN (DOM)
// =========================================

document.addEventListener("DOMContentLoaded", () => {
    activarCorazonToggle('#likeBtn');
    
    // --- Referencias a elementos del HTML principal ---
    const playButton = document.getElementById("playButton");
    const overlay = document.getElementById("gameOverlay"); 
    const playingScreen = document.getElementById("playingScreen"); 
    const previewImage = document.querySelector(".game-screen > img");
    const startMenu = document.getElementById("startMenu");
    const howToPlay = document.getElementById("howToPlay");
    
    // --- 1. INYECTAR EL NUEVO MENÚ DE SELECCIÓN DE PERSONAJE (SIMPLIFICADO) ---
    const characterSelectHTML = `
      <div class="start-menu" id="characterSelectMenu" style="display:none; z-index: 6;">
        <div class="menu-content">
          <h1>Elige tu Ficha</h1>
          <button class="peg-select-btn" data-peg="terrorista">Terrorista</button>
          <button class="peg-select-btn" data-peg="antiterrorista">Antiterrorista</button>
        </div>
      </div>
    `;
    const gameScreenContainer = document.querySelector(".game-screen");
    if (gameScreenContainer) {
        gameScreenContainer.insertAdjacentHTML('beforeend', characterSelectHTML);
    } else {
        document.body.insertAdjacentHTML('beforeend', characterSelectHTML); // Fallback
    }

    // --- 2. CONFIGURAR EL FLUJO DE MENÚS (SIMPLIFICADO) ---
    const characterSelectMenu = document.getElementById("characterSelectMenu");

    // Play (Overlay) -> Menú Inicio
    playButton.addEventListener("click", () => {
      if (previewImage) previewImage.style.display = "none";
      switchScreens(overlay, startMenu, 300);
    });

    // Menú Inicio (Jugar) -> Menú Selección de Ficha
    document.getElementById("startGameBtn").addEventListener("click", () => {
      switchScreens(startMenu, characterSelectMenu, 300);
    });
    
    // Un solo listener para AMBOS botones de selección
    characterSelectMenu.querySelectorAll('.peg-select-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            
            // 1. Obtenemos la ficha del atributo 'data-peg' del botón
            selectedPeg = event.target.dataset.peg; 
            
            // 2. (Opcional) Mostramos el aviso si es necesario
            if (selectedPeg === 'antiterrorista') {
                 console.log("Cargando 'antiterrorista'. Asegúrate de tener 'img/Videogame/antiterrorista.png'");
            }
            
            // 3. Iniciamos el juego
            startGame();
        });
    });

    // --- 3. BOTONES "CÓMO JUGAR" ---
    document.getElementById("howToPlayBtn").addEventListener("click", () => {
      howToPlay.style.display = "flex";
    });
    document.getElementById("closeHowToPlay").addEventListener("click", () => {
      howToPlay.style.display = "none";
    });

    // --- 4. BOTONES (COMPARTIR, FULLSCREEN) ---
    const shareBtn = document.getElementById("shareBtn");
    const closeShare = document.getElementById("closeShare");
    shareBtn.addEventListener("click", showShare);
    closeShare.addEventListener("click", () => {
        document.getElementById("shareContainer").style.display = "none";
    });

    const fullscreenBtn = document.getElementById("fullscreenBtn");
    fullscreenBtn.addEventListener("click", fullscreen);
    document.addEventListener("fullscreenchange", () => {
        if (!document.fullscreenElement) {
            const gameScreen = document.querySelector(".game-screen");
            gameScreen.style.width = "1080px";
            gameScreen.style.height = "607px";
            gameScreen.style.maxWidth = "1080px";
            gameScreen.style.maxHeight = "607px";
        }
    });

    // --- 5. INICIALIZAR EL JUEGO (PREPARAR CANVAS, ETC.) ---
    initGameSetup();
});


// =========================================
// LÓGICA DEL JUEGO (PEG SOLITAIRE)
// =========================================

// --- Variables Globales del Juego ---
let canvas, ctx; 
let board = []; 
let draggingPeg = null; 
let possibleMoves = []; 
let gameOver = false;
let timeRemaining; 
let timerInterval = null; 
let mousePos = { x: 0, y: 0 }; 
let animationFrameId = null; 

// --- Variables de Imágenes y Selección ---
let boardImage = null; 
let pegImage = null;   
let selectedPeg = 'terrorista'; // Valor por defecto

// --- Constantes del Juego ---
const CELL_SIZE = 70; 
const PEG_SIZE = 60;  
const GAME_TIME_LIMIT = 300; 

// --- Diseño del Tablero ---
const initialBoardLayout = [
  [-1, -1, 1, 1, 1, -1, -1],
  [-1, -1, 1, 1, 1, -1, -1],
  [ 1,  1, 1, 1, 1,  1,  1],
  [ 1,  1, 1, 0, 1,  1,  1], 
  [ 1,  1, 1, 1, 1,  1,  1],
  [-1, -1, 1, 1, 1, -1, -1],
  [-1, -1, 1, 1, 1, -1, -1]
];

// ==================== INICIALIZACIÓN ====================

/**
 * Bucle de animación para las pistas (hints).
 */
function animate() {
    redrawGame(); 
    animationFrameId = requestAnimationFrame(animate); 
}

/**
 * Función llamada para MOSTRAR la pantalla del juego y CARGAR/RECARGAR las imágenes.
 */
function startGame() {
    const playingScreen = document.getElementById("playingScreen");
    const characterSelectMenu = document.getElementById("characterSelectMenu");
    
    // Oculta el menú de selección y muestra la pantalla de juego
    switchScreens(characterSelectMenu, playingScreen, 300);
    
    // Carga las imágenes (tablero y ficha seleccionada) y luego llama a resetGame()
    loadImagesAndStart();
}

/**
 * Prepara el canvas y los menús del juego. Se llama UNA SOLA VEZ en DOMContentLoaded.
 */
function initGameSetup() {
  const playingScreen = document.getElementById("playingScreen");
  
  // Inserta dinámicamente el canvas y la UI (tiempo, reiniciar)
  // y el NUEVO MENÚ DE FIN DE JUEGO
  playingScreen.innerHTML = `
    <canvas id="gameCanvas" width="490" height="490"></canvas>
    
    <div class="hud" id="game-ui">
      <span id="timer">Tiempo: 05:00</span>
      <button id="restartBtn">Reiniciar</button>
    </div>

    <div class="game-modal" id="endMenu" style="display: none; z-index: 10;">
        <h2 id="endMessage"></h2>
        <p id="endPegCount"></p>
        <button id="restartGameBtn">Jugar de nuevo</button>
    </div>
  `;

  canvas = document.getElementById("gameCanvas");
  ctx = canvas.getContext("2d");

  // ==================== EVENTOS (click / drag) ====================
  
  canvas.addEventListener("mousedown", (e) => {
    if (gameOver) return; 
    const { row, col } = getCellFromMouse(e); 
    
    if (board[row] && board[row][col] === 1) {
        draggingPeg = { row, col }; 
        possibleMoves = calculatePossibleMoves(row, col);
        
        const rect = canvas.getBoundingClientRect();
        mousePos.x = e.clientX - rect.left;
        mousePos.y = e.clientY - rect.top;
        
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        animate(); // Inicia el bucle de animación de pistas
    }
  });

  canvas.addEventListener("mousemove", (e) => {
    if (!draggingPeg) return; 
    
    const rect = canvas.getBoundingClientRect();
    mousePos.x = e.clientX - rect.left;
    mousePos.y = e.clientY - rect.top;
  });


  canvas.addEventListener("mouseup", (e) => {
    if (gameOver || !draggingPeg) return; 
    
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    animationFrameId = null;

    const { row: dropRow, col: dropCol } = getCellFromMouse(e);

    if (isValidMove(draggingPeg.row, draggingPeg.col, dropRow, dropCol)) {
      makeMove(draggingPeg.row, draggingPeg.col, dropRow, dropCol);
    }

    draggingPeg = null; 
    possibleMoves = []; 
    redrawGame(); 

    // Comprueba si quedan movimientos
    if (!hasMovesLeft()) {
      checkWinAndShowMenu();
    }
  });

  canvas.addEventListener("mouseleave", (e) => {
    if (draggingPeg) {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        draggingPeg = null;
        possibleMoves = [];
        redrawGame(); 
    }
  });
  // =============================================================

  // Asigna la función de reinicio al botón (REINICIO RÁPIDO)
  document.getElementById("restartBtn").onclick = resetGame;
}

// ==================== CARGA ASINCRÓNICA ====================

/**
 * Carga las imágenes del juego (tablero y ficha seleccionada).
 * Al terminar, llama a resetGame().
 */
function loadImagesAndStart() {
  if (!ctx) return;
  
  const boardUrl = "img/Videogame/chiquitapia.jpeg";
  // --- Lógica de Selección de Ficha ---
  const pegUrl = selectedPeg === 'terrorista' 
                 ? "img/Videogame/terrorista.png" 
                 : "img/Videogame/antiterrorista.png"; // ¡Asegúrate que esta imagen exista!

  const boardImg = new Image();
  const pegImg = new Image();

  let loadedCount = 0;
  const totalImages = 2; 

  const onImageLoad = () => {
    loadedCount++;
    if (loadedCount === totalImages) {
      boardImage = boardImg;
      pegImage = pegImg;
      
      // Inicia el juego reseteando el tablero
      resetGame();
    }
  };

  boardImg.onload = onImageLoad;
  pegImg.onload = onImageLoad;

  boardImg.src = boardUrl;
  pegImg.src = pegUrl; 
}

// ==================== DIBUJO ====================

/**
 * Redibuja todo el estado del juego en el canvas.
 */
function redrawGame() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBoard();
    drawPegs(); 

    if (draggingPeg) {
        const x = mousePos.x - PEG_SIZE / 2;
        const y = mousePos.y - PEG_SIZE / 2;
        ctx.globalAlpha = 0.75; 
        ctx.drawImage(pegImage, x, y, PEG_SIZE, PEG_SIZE);
        ctx.globalAlpha = 1.0; 
    }
}

/**
 * Dibuja la imagen de fondo del tablero.
 */
function drawBoard() {
  if (!ctx || !boardImage) return; 
  ctx.drawImage(boardImage, 0, 0, canvas.width, canvas.height);
}

/**
 * Recorre el 'board' y dibuja cada ficha, hueco o pista animada.
 */
function drawPegs() {
  if (!ctx || !pegImage) return; 
  
  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      const value = board[row][col];
      
      const x = col * CELL_SIZE + (CELL_SIZE - PEG_SIZE) / 2;
      const y = row * CELL_SIZE + (CELL_SIZE - PEG_SIZE) / 2;
      const centerX = col * CELL_SIZE + CELL_SIZE / 2;
      const centerY = row * CELL_SIZE + CELL_SIZE / 2;

      if (value === 1) { // FICHA
        if (draggingPeg && draggingPeg.row === row && draggingPeg.col === col) {
            continue; 
        }
        ctx.drawImage(pegImage, x, y, PEG_SIZE, PEG_SIZE);

      } else if (value === 0) { // HUECO
        ctx.beginPath();
        ctx.arc(centerX, centerY, PEG_SIZE / 3, 0, 2 * Math.PI, false); 
        ctx.fillStyle = '#202020';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(centerX, centerY, PEG_SIZE / 3.5, 0, 2 * Math.PI, false);
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        const isPossible = possibleMoves.some(move => move.row === row && move.col === col);
        
        // --- PISTA ANIMADA (HINT) ---
        if (isPossible) { 
            const pulse = (Math.sin(Date.now() / 200) + 1) / 2; 

            const minRadius = PEG_SIZE / 2.8;
            const maxRadius = PEG_SIZE / 2.2;
            const currentRadius = minRadius + (pulse * (maxRadius - minRadius));

            const minOpacity = 0.4;
            const maxOpacity = 0.8;
            const currentOpacity = minOpacity + (pulse * (maxOpacity - minOpacity));

            ctx.beginPath();
            ctx.arc(centerX, centerY, currentRadius, 0, 2 * Math.PI, false); 
            ctx.fillStyle = `rgba(255, 230, 0, ${currentOpacity})`;
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 230, 0, 0.9)';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
      }
    }
  }
}

// ==================== LÓGICA DEL JUEGO ====================

/**
 * Reinicia el juego a su estado inicial.
 */
function resetGame() {
  board = initialBoardLayout.map(row => [...row]);
  draggingPeg = null;
  possibleMoves = [];
  gameOver = false;
  timeRemaining = GAME_TIME_LIMIT;

  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  animationFrameId = null;
  clearInterval(timerInterval); 

  updateTimerDisplay(); 
  redrawGame(); 
  startTimer(); 
}

/**
 * Inicia el temporizador de cuenta atrás.
 */
function startTimer() {
    clearInterval(timerInterval); 
    timerInterval = setInterval(() => {
        if (timeRemaining <= 0) {
          clearInterval(timerInterval);
          gameOver = true;
          // --- DERROTA POR TIEMPO ---
          showEndMenu(false, countPegs());
          return;
        }

        timeRemaining--; 
        updateTimerDisplay(); 
    }, 1000);
}

/**
 * Actualiza el texto del temporizador en la UI.
 */
function updateTimerDisplay() {
    const timerDisplay = document.getElementById("timer");
    if (!timerDisplay) return;
    
    const minutes = Math.floor(timeRemaining / 60).toString().padStart(2, "0");
    const seconds = (timeRemaining % 60).toString().padStart(2, "0");
    timerDisplay.textContent = `Tiempo: ${minutes}:${seconds}`;
}

// ==================== MOVIMIENTOS Y REGLAS ====================

/**
 * Calcula todos los movimientos válidos desde una ficha específica.
 */
function calculatePossibleMoves(r, c) {
    const moves = [];
    const directions = [ [-2, 0], [2, 0], [0, -2], [0, 2] ];
    
    for (const [dr, dc] of directions) {
        const destRow = r + dr;
        const destCol = c + dc;
        if (isValidMove(r, c, destRow, destCol)) {
            moves.push({ row: destRow, col: destCol });
        }
    }
    return moves;
}

/**
 * Convierte las coordenadas (x, y) del clic a la celda (fila, columna).
 */
function getCellFromMouse(e) {
  const rect = canvas.getBoundingClientRect(); 
  const x = e.clientX - rect.left; 
  const y = e.clientY - rect.top; 
  const col = Math.floor(x / CELL_SIZE);
  const row = Math.floor(y / CELL_SIZE);
  return { row, col };
}

/**
 * Comprueba si un movimiento es válido.
 */
function isValidMove(r1, c1, r2, c2) {
  if (!board[r2] || board[r2][c2] !== 0) return false;

  const dr = r2 - r1;
  const dc = c2 - c1;

  if (Math.abs(dr) === 2 && dc === 0) {
    const midRow = r1 + dr / 2; 
    return board[midRow][c1] === 1; 
  }
  else if (Math.abs(dc) === 2 && dr === 0) {
    const midCol = c1 + dc / 2; 
    return board[r1][midCol] === 1; 
  }
  
  return false;
}

/**
 * Ejecuta el movimiento en el array 'board'.
 */
function makeMove(r1, c1, r2, c2) {
  const midRow = (r1 + r2) / 2;
  const midCol = (c1 + c2) / 2;
  
  board[r1][c1] = 0; 
  board[midRow][midCol] = 0; 
  board[r2][c2] = 1; 
}

/**
 * Comprueba si queda algún movimiento válido en *todo* el tablero.
 */
function hasMovesLeft() {
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < board[r].length; c++) {
      if (board[r][c] === 1) { 
        if (calculatePossibleMoves(r, c).length > 0) {
            return true;
        }
      }
    }
  }
  return false;
}

// ==================== LÓGICA DE VICTORIA/DERROTA ====================

/**
 * Cuenta cuántas fichas (1) quedan en el tablero.
 */
function countPegs() {
    let count = 0;
    for (let r = 0; r < board.length; r++) {
        for (let c = 0; c < board[r].length; c++) {
            if (board[r][c] === 1) count++;
        }
    }
    return count;
}

/**
 * Se llama cuando no quedan más movimientos.
 * Decide si es victoria (1 ficha) o derrota (>1 ficha).
 */
function checkWinAndShowMenu() {
    if (gameOver) return; // Evita que se llame múltiples veces

    clearInterval(timerInterval);
    gameOver = true;
    
    const pegCount = countPegs();
    if (pegCount === 1) {
        // --- VICTORIA ---
        showEndMenu(true, pegCount);
    } else {
        // --- DERROTA (SIN MOVIMIENTOS) ---
        showEndMenu(false, pegCount);
    }
}

/**
 * Muestra el menú final de Victoria o Derrota.
 */
function showEndMenu(win, pegCount) {
    const endMenu = document.getElementById("endMenu");
    const endMessage = document.getElementById("endMessage");
    const endPegCount = document.getElementById("endPegCount");
    const playingScreen = document.getElementById("playingScreen"); 

    if (win) {
        endMessage.textContent = "🏆 ¡Felicidades, has ganado! 🏆";
        endPegCount.textContent = "Has dejado solo 1 ficha en el tablero.";
    } else {
        endMessage.textContent = "💀 ¡Has perdido! 💀";
        if (timeRemaining <= 0) {
            endPegCount.textContent = `Se acabó el tiempo. Te quedaron ${pegCount} fichas.`;
        } else {
            endPegCount.textContent = `No quedan más movimientos. Te quedaron ${pegCount} fichas.`;
        }
    }
    
    endMenu.style.display = "flex";

    // Configura el botón para volver al menú de selección de personaje
    document.getElementById("restartGameBtn").onclick = () => {
        endMenu.style.display = "none";
        const characterSelectMenu = document.getElementById("characterSelectMenu");
        
        // Oculta la pantalla de juego y muestra la de selección
        switchScreens(playingScreen, characterSelectMenu, 300);
        
        // Resetea el tablero para la próxima vez que jueguen
        resetGame(); 
    };
}