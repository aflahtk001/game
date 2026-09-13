import './style.css';
import { Game } from './Game';

// Initialize the game
const container = document.getElementById('app');
if (container) {
  const game = new Game(container);
  game.start();
}
