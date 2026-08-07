import { useEffect, useState } from "react";
import { advanceLevel } from "../game/gameController.ts";
import { recordResultsCardOpened, recordResultsCelebrateShown } from "../systems/gameAnalytics.ts";
import { formatNumber } from "../systems/localization.ts";
import { useStore } from "../state/store.ts";

/**
 * After the final word lands, keep the board fully visible so the player can
 * read it. A bottom celebration runs with a tappable continue; the dim scrim +
 * results card follow (or open immediately on tap).
 */
const RESULT_REVEAL_MS = 1_400;
const RESULT_REVEAL_REDUCED_MS = 60;

export default function ResultsOverlay() {
    const result = useStore((state) => state.result);
    const reducedMotion = useStore((state) => state.reducedMotion);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (!result) {
            setOpen(false);
            return;
        }
        setOpen(false);
        recordResultsCelebrateShown();
        const delay = reducedMotion ? RESULT_REVEAL_REDUCED_MS : RESULT_REVEAL_MS;
        const timeout = window.setTimeout(() => setOpen(true), delay);
        return () => window.clearTimeout(timeout);
    }, [result, reducedMotion]);

    useEffect(() => {
        if (result && open) recordResultsCardOpened();
    }, [result, open]);

    if (!result) return null;

    // Pending beat: no full-screen dim — last word stays readable. Tappable so
    // players never feel stuck if the auto-advance timer is interrupted.
    if (!open) {
        return (
            <button
                type="button"
                className="clear-celebrate"
                aria-live="polite"
                aria-atomic="true"
                onClick={() => setOpen(true)}
            >
                <div className="clear-celebrate-glow" aria-hidden="true" />
                <div className="clear-celebrate-ribbons" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                </div>
                <div className="clear-celebrate-medallion" aria-hidden="true">
                    <span>W</span>
                </div>
                <p className="clear-celebrate-kicker">SKY CLEARED</p>
                <strong className="clear-celebrate-title">{result.title}</strong>
                <p className="clear-celebrate-sub">GATHERING THE WIND</p>
                <div className="clear-celebrate-meter" aria-hidden="true">
                    <span />
                </div>
                <span className="clear-celebrate-cta">TAP TO CONTINUE</span>
            </button>
        );
    }

    return (
        <div className="result-scrim is-open" role="dialog" aria-modal="true" aria-labelledby="result-title">
            <section className="result-card">
                <div className="result-burst" aria-hidden="true" />
                <div className="result-gale" aria-hidden="true">
                    <span>W</span>
                </div>
                <p className="eyebrow result-stagger-1">SKY CLEARED</p>
                <h2 id="result-title" className="result-stagger-2">
                    {result.title}
                </h2>
                <div className="result-stats result-stagger-3">
                    <span>
                        <strong>{formatNumber(result.words)}</strong> WORDS
                    </span>
                    <span>
                        <strong>+{formatNumber(result.reward)}</strong> SPARKS
                    </span>
                </div>
                {result.perfect ? <p className="perfect-ribbon result-stagger-4">PERFECT CURRENT · NO HINTS</p> : null}
                <button type="button" className="primary-button result-stagger-5" onClick={advanceLevel}>
                    {result.routeComplete ? "BEGIN A NEW ROUTE" : "RIDE THE NEXT WIND"}
                </button>
            </section>
        </div>
    );
}
