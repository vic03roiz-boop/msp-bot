// Mélange un tableau de façon vraiment équitable (algorithme de Fisher-Yates).
// À ne jamais remplacer par `array.sort(() => Math.random() - 0.5)`, qui est
// une méthode connue pour être statistiquement biaisée (certains éléments ont
// plus de chances de se retrouver à certaines positions que d'autres).
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

module.exports = { shuffleArray };
