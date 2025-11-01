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
        gameScreen.requestFullscreen() // Se pide la fullscreen
            .then(() => {
                // Se ajusta el div para ocupar la pantalla completa
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
                // Al salir de la fullscreen vuelve a su tamaño original
                gameScreen.style.width = "1080px";
                gameScreen.style.height = "607px";
                gameScreen.style.maxWidth = "1080px";
                gameScreen.style.maxHeight = "657px";
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



// Inicialización principal
document.addEventListener("DOMContentLoaded", () => {
    // Like Button
    activarCorazonToggle('#likeBtn');

    // Switch screens
    const playButton = document.getElementById("playButton");
    const overlay = document.getElementById("gameOverlay");
    const playingScreen = document.getElementById("playingScreen");

    playButton.addEventListener("click", () => {
        switchScreens(overlay, playingScreen, 300);
    });

    // Share button
    const shareBtn = document.getElementById("shareBtn");
    const closeShare = document.getElementById("closeShare");
    shareBtn.addEventListener("click", showShare);
    closeShare.addEventListener("click", () => {
        document.getElementById("shareContainer").style.display = "none";
    });

    // Fullscreen button
    const fullscreenBtn = document.getElementById("fullscreenBtn");
    fullscreenBtn.addEventListener("click", fullscreen);

    // Detectamos si el usuario sale de fullscreen manualmente
    document.addEventListener("fullscreenchange", () => {
        const gameScreen = document.querySelector(".game-screen");
        if (!document.fullscreenElement) {
            gameScreen.style.width = "1080px";
            gameScreen.style.height = "607px";
            gameScreen.style.maxWidth = "1080px";
            gameScreen.style.maxHeight = "657px";
        }
    });
});
