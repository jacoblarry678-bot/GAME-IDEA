import ch1 from './ch1.js';
import ch2 from './ch2.js';
import ch3 from './ch3.js';
import ch4 from './ch4.js';

export const CHAPTERS = { 1: ch1, 2: ch2, 3: ch3, 4: ch4 };
export const CHAPTER_IDS = Object.keys(CHAPTERS).map(Number);
