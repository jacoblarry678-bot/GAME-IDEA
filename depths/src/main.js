import './ui/styles.css';
import { App } from './app.js';

const app = new App();
app.boot().catch((e) => {
  console.error(e);
  const b = document.querySelector('.boot-step');
  if (b) b.textContent = `Could not start: ${e.message}. This game needs WebGL 2.`;
});
