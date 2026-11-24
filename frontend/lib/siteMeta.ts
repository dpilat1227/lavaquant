/**
 * The words that show when quant.drew.fun is pasted into a text, Slack, LinkedIn or X.
 * One place, so the page tags (app/layout.tsx) and the card picture (app/card.png/route.tsx) can't drift apart.
 *
 * iMessage shows the picture, then TITLE and the domain. Slack, LinkedIn and X also show DESCRIPTION.
 * Keep TITLE under about 60 characters and DESCRIPTION under about 155.
 */
export const TITLE = "LavaQuant: backtest an alpha in seconds";

export const DESCRIPTION =
  "A project I built. Type an alpha in a WorldQuant-style language, see Sharpe, IC and drawdown in about 10 seconds, then submit it to WorldQuant BRAIN.";

/** The picture itself. `code` draws the headline as a line of the app's own DSL, in the editor's colours. */
export const CARD = {
  headline: "rank(-ts_delta(close, 5))",
  code: true,
  subline: "Type an alpha. Get Sharpe, IC and drawdown.",
  byline: "A project by Drew Pilat",
};

export const CARD_ALT = `LavaQuant: ${CARD.headline.replace("\n", " ")}. ${CARD.subline}`;

/**
 * BUMP THIS whenever the card's words or look change (here or in lib/shareCard.tsx).
 * iMessage, Slack, LinkedIn and X remember a card per image URL, so a new number is what makes them fetch the new one.
 * (Next's own hash for an `opengraph-image` file only changes when that one file changes, so it is not used.)
 */
export const CARD_VERSION = 2;
export const CARD_PATH = `/card.png?v=${CARD_VERSION}`;
