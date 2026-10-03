/** Map registry. Ids are stable (saved in profiles). */
import { CINDER_YARD } from './cinderYard.js';
import { OLD_QUARTER } from './oldQuarter.js';
import { SIGNAL_STATION } from './signalStation.js';

export const MAPS = {
  cinder_yard: CINDER_YARD,
  old_quarter: OLD_QUARTER,
  signal_station: SIGNAL_STATION,
};
export const MAP_IDS = Object.keys(MAPS);
