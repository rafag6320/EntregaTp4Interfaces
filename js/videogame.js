
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
            .then(() => {
                gameScreen.style.width = "100vw";
                gameScreen.style.height = "100vh";
                gameScreen.style.maxWidth = "100vw";
                gameScreen.style.maxHeight = "100vh";
                gameScreen.style.margin = "0";
                gameScreen.style.overflow = "hidden";
            })
            .catch(err => console.log(`Error al entrar en fullscreen: ${err.message}`));
    } else {
        document.exitFullscreen()
            .then(() => {
                gameScreen.style.width = "1080px";
                gameScreen.style.height = "607px";
                gameScreen.style.maxWidth = "1080px";
                gameScreen.style.maxHeight = "607px";
            });
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

document.addEventListener("DOMContentLoaded", () => {
    activarCorazonToggle('#likeBtn');
    const playButton = document.getElementById("playButton");
    const overlay = document.getElementById("gameOverlay"); 
    const playingScreen = document.getElementById("playingScreen"); 

    const previewImage = document.querySelector(".game-screen > img");

    playButton.addEventListener("click", () => {
        if (previewImage) {
            previewImage.style.display = "none";
        }
        switchScreens(overlay, playingScreen, 300);
        initGame();
    });

    const shareBtn = document.getElementById("shareBtn");
    const closeShare = document.getElementById("closeShare");
    shareBtn.addEventListener("click", showShare);
    closeShare.addEventListener("click", () => {
        document.getElementById("shareContainer").style.display = "none";
    });

    const fullscreenBtn = document.getElementById("fullscreenBtn");
    fullscreenBtn.addEventListener("click", fullscreen);
    document.addEventListener("fullscreenchange", () => {
        const gameScreen = document.querySelector(".game-screen");
        if (!document.fullscreenElement) {
            gameScreen.style.width = "1080px";
            gameScreen.style.height = "607px";
            gameScreen.style.maxWidth = "1080px";
            gameScreen.style.maxHeight = "607px";
        }
    });
});


// =========================================
// LÓGICA DEL JUEGO (PEG SOLITAIRE)
// =========================================

// --- Variables Globales del Juego ---
let canvas, ctx; // Para el dibujo
let board = []; // Array 2D que representa el tablero
let draggingPeg = null; // Objeto {row, col} de la ficha que se arrastra
let possibleMoves = []; // Array de {row, col} para resaltar movimientos válidos
let gameOver = false;
let timeRemaining; // Segundos restantes
let timerInterval = null; // Referencia al intervalo del temporizador
let mousePos = { x: 0, y: 0 }; // Posición del ratón en el canvas

// --- Imágenes Globales ---
let boardImage = null; // Imagen de fondo del tablero
let pegImage = null;   // Imagen de la ficha (terrorista)

// --- Constantes del Juego ---
const CELL_SIZE = 70; // Tamaño de cada celda (en px)
const PEG_SIZE = 60;  // Tamaño de la ficha (en px)
const GAME_TIME_LIMIT = 300; // 5 minutos (en segundos)

// --- Diseño del Tablero ---
// 1 = Ficha, 0 = Hueco, -1 = Zona no válida (fuera del tablero)
const initialBoardLayout = [
  [-1, -1, 1, 1, 1, -1, -1],
  [-1, -1, 1, 1, 1, -1, -1],
  [ 1,  1, 1, 1, 1,  1,  1],
  [ 1,  1, 1, 0, 1,  1,  1], // El 0 es el hueco inicial
  [ 1,  1, 1, 1, 1,  1,  1],
  [-1, -1, 1, 1, 1, -1, -1],
  [-1, -1, 1, 1, 1, -1, -1]
];

// ==================== INICIALIZACIÓN ====================

/**
 * Prepara e inicia el juego.
 * Esta función es llamada cuando se pulsa "Jugar".
 */
function initGame() {
  const playingScreen = document.getElementById("playingScreen");
  
  // Inserta dinámicamente el canvas y la UI (tiempo, reiniciar)
  // en el div 'playingScreen'
  playingScreen.innerHTML = `
    <canvas id="gameCanvas" width="490" height="490"></canvas>
    <div class="hud" id="game-ui">
      <span id="timer">Tiempo: 05:00</span>
      <button id="restartBtn">Reiniciar</button>
    </div>
  `;

  // Obtiene las referencias al canvas y su contexto 2D
  canvas = document.getElementById("gameCanvas");
  ctx = canvas.getContext("2d");

  // ==================== EVENTOS (click / drag) ====================
  
  // Al presionar el ratón
  canvas.addEventListener("mousedown", (e) => {
    if (gameOver) return; // No hacer nada si el juego terminó
    const { row, col } = getCellFromMouse(e); // Convierte coords a celda
    
    // Si hay una ficha (1) en esa celda
    if (board[row] && board[row][col] === 1) {
        draggingPeg = { row, col }; // Marca esta ficha como "arrastrando"
        
        // Calcula y guarda los movimientos posibles desde esta celda
        possibleMoves = calculatePossibleMoves(row, col);

        // Guarda la posición inicial del ratón
        const rect = canvas.getBoundingClientRect();
        mousePos.x = e.clientX - rect.left;
        mousePos.y = e.clientY - rect.top;
        redrawGame(); // Redibuja para mostrar resaltados
    }
  });

  // Al mover el ratón
  canvas.addEventListener("mousemove", (e) => {
    if (!draggingPeg) return; // Solo si estamos arrastrando una ficha
    
    // Actualiza la posición del ratón
    const rect = canvas.getBoundingClientRect();
    mousePos.x = e.clientX - rect.left;
    mousePos.y = e.clientY - rect.top;
    
    redrawGame(); // Redibuja para que la ficha siga al ratón
  });


  // Al soltar el ratón
  canvas.addEventListener("mouseup", (e) => {
    if (gameOver || !draggingPeg) return; // Solo si estábamos arrastrando
    
    // Obtiene la celda donde se soltó
    const { row: dropRow, col: dropCol } = getCellFromMouse(e);

    // Comprueba si el movimiento a esta celda es válido
    if (isValidMove(draggingPeg.row, draggingPeg.col, dropRow, dropCol)) {
      // Si es válido, ejecuta el movimiento
      makeMove(draggingPeg.row, draggingPeg.col, dropRow, dropCol);
    }

    draggingPeg = null; // Deja de arrastrar
    possibleMoves = []; // Limpia los resaltados de movimientos
    redrawGame(); // Redibuja el estado final del tablero

    // Comprueba si quedan movimientos posibles en *todo* el tablero
    if (!hasMovesLeft()) {
      clearInterval(timerInterval); // Para el tiempo
      gameOver = true;
      alert("¡No hay más movimientos posibles!");
    }
  });

  // Si el ratón sale del canvas mientras arrastra
  canvas.addEventListener("mouseleave", (e) => {
    if (draggingPeg) {
        // Cancela el arrastre
        draggingPeg = null;
        possibleMoves = [];
        redrawGame(); 
    }
  });
  // =============================================================

  // Asigna la función de reinicio al botón
  document.getElementById("restartBtn").onclick = resetGame;
  
  // Carga las imágenes y, cuando estén listas, llama a resetGame()
  loadImagesAndStart({ rows: 7, cols: 7 });
}

// ==================== CARGA ASINCRÓNICA ====================

/**
 * Carga las imágenes del juego (tablero y ficha) de forma asíncrona.
 * Muestra un texto de "Cargando..." mientras tanto.
 */
function loadImagesAndStart(config) {
  if (!ctx) return;
  
  // Muestra "Cargando..." en el canvas
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fff";
  ctx.font = "24px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Cargando imágenes...", canvas.width / 2, canvas.height / 2);

  const boardUrl = "img/Videogame/chiquitapia.jpeg";
  const pegUrl = "img/Videogame/terrorista.png";

  const boardImg = new Image();
  const pegImg = new Image();

  let loadedCount = 0;
  const totalImages = 2; 

  // Esta función se llama CADA VEZ que una imagen termina de cargar
  const onImageLoad = () => {
    loadedCount++;
    // Si ya cargaron todas las imágenes
    if (loadedCount === totalImages) {
      // Asigna las imágenes a las variables globales
      boardImage = boardImg;
      pegImage = pegImg;
      
      // Inicia el juego reseteando el tablero
      resetGame();
    }
  };

  // Asigna el callback 'onload' a CADA imagen
  boardImg.onload = onImageLoad;
  pegImg.onload = onImageLoad;

  // Establece el 'src' para disparar la carga
  boardImg.src = boardUrl;
  pegImg.src = pegUrl; 
}

// ==================== DIBUJO ====================

/**
 * Redibuja todo el estado del juego en el canvas.
 * Limpia y luego dibuja el tablero, las fichas y la ficha arrastrada.
 */
function redrawGame() {
    if (!ctx) return;
    // Limpia el canvas completamente
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Dibuja el fondo
    drawBoard();
    
    // Dibuja las fichas, huecos y resaltados
    drawPegs(); 

    // Si estamos arrastrando una ficha
    if (draggingPeg) {
        // Dibuja la ficha directamente en la posición del ratón
        const x = mousePos.x - PEG_SIZE / 2;
        const y = mousePos.y - PEG_SIZE / 2;
        
        ctx.globalAlpha = 0.75; // La hace semitransparente
        ctx.drawImage(pegImage, x, y, PEG_SIZE, PEG_SIZE);
        ctx.globalAlpha = 1.0; // Restaura la opacidad
    }
}

/**
 * Dibuja la imagen de fondo del tablero.
 */
function drawBoard() {
  if (!ctx || !boardImage) return; // Seguridad
  ctx.drawImage(boardImage, 0, 0, canvas.width, canvas.height);
}

/**
 * Recorre el array 'board' y dibuja cada ficha, hueco o resaltado.
 */
function drawPegs() {
  if (!ctx || !pegImage) return; // Seguridad
  
  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      const value = board[row][col];
      
      // Calcula la posición (x, y) en el canvas
      const x = col * CELL_SIZE + (CELL_SIZE - PEG_SIZE) / 2;
      const y = row * CELL_SIZE + (CELL_SIZE - PEG_SIZE) / 2;
      const centerX = col * CELL_SIZE + CELL_SIZE / 2;
      const centerY = row * CELL_SIZE + CELL_SIZE / 2;

      if (value === 1) { // Si es una FICHA
        // No la dibuja si es la que estamos arrastrando (se dibuja en redrawGame)
        if (draggingPeg && draggingPeg.row === row && draggingPeg.col === col) {
            continue; 
        }
        ctx.drawImage(pegImage, x, y, PEG_SIZE, PEG_SIZE);

      } else if (value === 0) { // Si es un HUECO
        // Dibuja un círculo oscuro para el hueco
        ctx.beginPath();
        ctx.arc(centerX, centerY, PEG_SIZE / 3, 0, 2 * Math.PI, false); 
        ctx.fillStyle = '#202020';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(centerX, centerY, PEG_SIZE / 3.5, 0, 2 * Math.PI, false);
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Comprueba si este hueco es un movimiento posible
        const isPossible = possibleMoves.some(move => move.row === row && move.col === col);
        
        if (isPossible) { // Si SÍ es posible, dibuja un resaltado amarillo
            ctx.beginPath();
            ctx.arc(centerX, centerY, PEG_SIZE / 2.5, 0, 2 * Math.PI, false); 
            ctx.fillStyle = 'rgba(255, 230, 0, 0.45)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 230, 0, 0.8)';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
      }
      // Si es -1 (fuera de tablero), no dibuja nada.
    }
  }
}

// ==================== LÓGICA DEL JUEGO ====================

/**
 * Reinicia el juego a su estado inicial.
 */
function resetGame() {
  // Copia el layout inicial para no modificar el original
  board = initialBoardLayout.map(row => [...row]);
  draggingPeg = null;
  possibleMoves = [];
  gameOver = false;
  timeRemaining = GAME_TIME_LIMIT;

  clearInterval(timerInterval); // Limpia cualquier temporizador anterior
  updateTimerDisplay(); // Muestra el tiempo inicial
  redrawGame(); // Dibuja el tablero inicial
  startTimer(); // Inicia el nuevo temporizador
}

/**
 * Inicia el temporizador de cuenta atrás.
 */
function startTimer() {
    clearInterval(timerInterval); // Asegura que no haya dos temporizadores
    timerInterval = setInterval(() => {
        if (timeRemaining <= 0) {
          clearInterval(timerInterval);
          gameOver = true;
          alert("¡Tiempo agotado!");
          return;
        }

        timeRemaining--; // Resta un segundo
        updateTimerDisplay(); // Actualiza la UI
    }, 1000); // Se ejecuta cada segundo
}

/**
 * Actualiza el texto del temporizador en la UI.
 */
function updateTimerDisplay() {
    const timerDisplay = document.getElementById("timer");
    if (!timerDisplay) return;
    
    // Calcula minutos y segundos
    const minutes = Math.floor(timeRemaining / 60)
      .toString()
      .padStart(2, "0"); // Añade un 0 a la izquierda si es necesario (ej. "05")
    const seconds = (timeRemaining % 60).toString().padStart(2, "0");
    timerDisplay.textContent = `Tiempo: ${minutes}:${seconds}`;
}

// ==================== MOVIMIENTOS ====================
/**
 * Calcula todos los movimientos válidos desde una ficha específica.
 */
function calculatePossibleMoves(r, c) {
    const moves = [];
    // Direcciones de salto (2 celdas de distancia)
    const directions = [
        [-2, 0], // Arriba
        [2, 0],  // Abajo
        [0, -2], // Izquierda
        [0, 2]   // Derecha
    ];
    
    for (const [dr, dc] of directions) {
        const destRow = r + dr;
        const destCol = c + dc;
        // Reutiliza la lógica de validación
        if (isValidMove(r, c, destRow, destCol)) {
            moves.push({ row: destRow, col: destCol });
        }
    }
    return moves;
}


/**
 * Convierte las coordenadas (x, y) del clic del ratón en la celda (fila, columna) del tablero.
 */
function getCellFromMouse(e) {
  const rect = canvas.getBoundingClientRect(); // Obtiene la posición del canvas
  const x = e.clientX - rect.left; // Posición X relativa al canvas
  const y = e.clientY - rect.top; // Posición Y relativa al canvas
  const col = Math.floor(x / CELL_SIZE);
  const row = Math.floor(y / CELL_SIZE);
  return { row, col };
}

/**
 * Comprueba si un movimiento de (r1, c1) a (r2, c2) es válido.
 */
function isValidMove(r1, c1, r2, c2) {
  // 1. El destino debe ser un hueco (0) y estar dentro del tablero
  if (!board[r2] || board[r2][c2] !== 0) return false;

  const dr = r2 - r1;
  const dc = c2 - c1;

  // 2. Comprueba salto vertical (2 celdas)
  if (Math.abs(dr) === 2 && dc === 0) {
    const midRow = r1 + dr / 2; // Fila de la ficha que saltamos
    return board[midRow][c1] === 1; // Debe haber una ficha (1) para saltar
  }
  // 3. Comprobueba salto horizontal (2 celdas)
  else if (Math.abs(dc) === 2 && dr === 0) {
    const midCol = c1 + dc / 2; // Columna de la ficha que saltamos
    return board[r1][midCol] === 1; // Debe haber una ficha (1) para saltar
  }
  
  // Si no es ninguno de los anteriores, no es válido
  return false;
}

/**
 * Ejecuta el movimiento en el array 'board'.
 * Actualiza 3 celdas: origen, medio y destino.
 */
function makeMove(r1, c1, r2, c2) {
  // Calcula la celda de en medio (la que es "comida")
  const midRow = (r1 + r2) / 2;
  const midCol = (c1 + c2) / 2;
  
  board[r1][c1] = 0; // Origen se vuelve hueco
  board[midRow][midCol] = 0; // Ficha saltada se vuelve hueco
  board[r2][c2] = 1; // Destino se vuelve ficha
}

/**
 * Comprueba si queda algún movimiento válido en *todo* el tablero.
 */
function hasMovesLeft() {
  // Recorre cada celda del tablero
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < board[r].length; c++) {
      // Si hay una ficha (1)
      if (board[r][c] === 1) { 
        // Calcula sus movimientos. Si tiene al menos 1, el juego no ha terminado.
        if (calculatePossibleMoves(r, c).length > 0) {
            return true;
        }
      }
    }
  }
  // Si termina el bucle sin encontrar movimientos, devuelve false.
  return false;
}