/**
 * Elo rating calculation utility.
 * K-factor: 32 for players with < 30 games, 16 for experienced players.
 */

function getKFactor(gamesPlayed) {
  return gamesPlayed < 30 ? 32 : 16;
}

function expectedScore(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Calculate new Elo ratings for both players after a game.
 * @param {number} whiteRating
 * @param {number} blackRating
 * @param {string} result - 'white_wins' | 'black_wins' | 'draw'
 * @param {number} whiteGamesPlayed
 * @param {number} blackGamesPlayed
 * @returns {{ white: { newRating, delta }, black: { newRating, delta } }}
 */
export function calculateElo(whiteRating, blackRating, result, whiteGamesPlayed, blackGamesPlayed) {
  const kWhite = getKFactor(whiteGamesPlayed);
  const kBlack = getKFactor(blackGamesPlayed);

  const expectedWhite = expectedScore(whiteRating, blackRating);
  const expectedBlack = 1 - expectedWhite;

  let actualWhite, actualBlack;
  if (result === 'white_wins') {
    actualWhite = 1;
    actualBlack = 0;
  } else if (result === 'black_wins') {
    actualWhite = 0;
    actualBlack = 1;
  } else {
    actualWhite = 0.5;
    actualBlack = 0.5;
  }

  const whiteNew = Math.max(100, Math.round(whiteRating + kWhite * (actualWhite - expectedWhite)));
  const blackNew = Math.max(100, Math.round(blackRating + kBlack * (actualBlack - expectedBlack)));

  return {
    white: { newRating: whiteNew, delta: whiteNew - whiteRating },
    black: { newRating: blackNew, delta: blackNew - blackRating }
  };
}
