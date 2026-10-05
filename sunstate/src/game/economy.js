/** Money and a short ledger of where it came from (shown on the phone/HUD). */
export class Economy {
  constructor(game, money = 350) {
    this.game = game;
    this.money = money;
    this.ledger = [];
  }
  add(amount, reason) {
    this.money += amount;
    this.ledger.unshift({ t: this.game.time, amount, reason });
    this.ledger.length = Math.min(this.ledger.length, 20);
    this.game.events.emit('money', { amount, reason, total: this.money });
  }
  /** Lose up to `amount` (never below zero). Returns what was actually taken. */
  take(amount, reason) {
    const a = Math.min(this.money, Math.max(0, Math.round(amount)));
    if (a > 0) this.add(-a, reason);
    return a;
  }
  canAfford(n) { return this.money >= n; }
}
