import './ui/styles.css';
import { App } from './app.js';

const bar = document.querySelector('.boot-bar > div');
const step = document.querySelector('.boot-step');
const progress = (p, label) => {
  if (bar) bar.style.width = `${Math.round(p * 100)}%`;
  if (step) step.textContent = label;
};

const app = new App();
window.__ashline = app;
app.boot(progress).then(() => {
  document.getElementById('boot')?.classList.add('hide');
  setTimeout(() => document.getElementById('boot')?.remove(), 800);
}).catch((err) => {
  console.error(err);
  if (step) step.textContent = 'Failed to start: ' + (err && err.message ? err.message : String(err));
  const hint = document.createElement('div');
  hint.className = 'boot-step';
  hint.textContent = 'WebGL may be disabled or unsupported in this browser.';
  step?.after(hint);
});
