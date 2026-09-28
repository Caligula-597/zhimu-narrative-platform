import { createDominionStudyGame, dominionScore, runDominionReferenceTurn } from "../shared/dominion-study-replica.js";

const games = [];
for (let gameIndex = 0; gameIndex < 12; gameIndex += 1) {
  let state = createDominionStudyGame({ playerCount: 4, seed: 20260927 + gameIndex });
  let turns = 0;
  const errors = [];
  while (!state.ended && turns < 240) {
    const activePlayer = state.activePlayerIndex;
    try {
      const result = runDominionReferenceTurn(state, activePlayer);
      state = result.state;
      if (result.guard >= 80) errors.push({ turn: turns, code: "REFERENCE_GUARD" });
    } catch (error) {
      errors.push({ turn: turns, code: error.message });
      break;
    }
    turns += 1;
  }
  games.push({ gameIndex, ended: state.ended, turns, errors, endReason: state.log.findLast((event) => event.type === "game-end")?.reason || null, scores: dominionScore(state), emptyPiles: Object.values(state.supply).filter((pile) => pile.count <= 0).map((pile) => pile.cardId), actionsPlayed: state.players.map((player) => player.stats.actionsPlayed), trashed: state.players.map((player) => player.stats.trashed), gained: state.players.map((player) => player.stats.gained) });
}

console.log(JSON.stringify({
  replica: "Dominion 2E local study replica",
  gameCount: games.length,
  endedGames: games.filter((game) => game.ended).length,
  errorGames: games.filter((game) => game.errors.length).length,
  meanTurns: games.reduce((sum, game) => sum + game.turns, 0) / games.length,
  games
}, null, 2));
