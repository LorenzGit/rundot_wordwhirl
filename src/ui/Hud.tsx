import { useEffect, useRef } from "react";
import { hintLabel, leaveLevel, requestHint, shuffleLetters } from "../game/gameController.ts";
import { levelForNumber } from "../game/words/levels.ts";
import { recordTutorialShown } from "../systems/gameAnalytics.ts";
import { formatNumber } from "../systems/localization.ts";
import { resumeFromHostPause } from "../systems/hostPause.ts";
import { useStore } from "../state/store.ts";

export default function Hud() {
    const state = useStore((value) => value);
    const level = levelForNumber(state.level);
    const tutorial = state.level === 1 && state.currentFoundWords.length === 0;
    const blocked = Boolean(state.result) || state.paused;
    const tutorialLogged = useRef(false);
    useEffect(() => {
        if (tutorial && !tutorialLogged.current) {
            tutorialLogged.current = true;
            recordTutorialShown();
        }
    }, [tutorial]);
    return (
        <div className="hud-shell safe-frame">
            <header className="game-hud">
                <button type="button" className="hud-icon" onClick={leaveLevel} aria-label="Back to menu">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="m15 5-7 7 7 7" />
                    </svg>
                </button>
                <div className="level-title">
                    <span>{level.route}</span>
                    <strong>LEVEL {formatNumber(state.level)}</strong>
                </div>
                <div className="hud-sparks" role="status" aria-label={`${formatNumber(state.sparks)} Sparks`}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="m12 2 2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2L12 2Z" />
                    </svg>
                    <strong>{formatNumber(state.sparks)}</strong>
                </div>
            </header>

            {tutorial ? (
                <div className="tutorial-bubble">
                    SWIPE THROUGH <strong>S · U · N</strong>
                </div>
            ) : null}

            <div className="game-actions">
                <button
                    type="button"
                    className="action-orb"
                    onClick={shuffleLetters}
                    disabled={blocked}
                    aria-label="Shuffle letters"
                >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M4 7h3c5 0 5 10 10 10h3m-3-3 3 3-3 3M4 17h3c2 0 3-1.5 4-3.2M14 7.8C15 7.3 16 7 17 7h3m-3-3 3 3-3 3" />
                    </svg>
                    <span>SHUFFLE</span>
                </button>
                <button
                    type="button"
                    className="action-orb action-orb-hint"
                    onClick={() => void requestHint()}
                    disabled={blocked || state.hintBusy}
                    aria-label={hintLabel()}
                >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M9 18h6M10 21h4M8.5 14.5C7.5 13.5 7 12 7 10.5a5 5 0 0 1 10 0c0 1.5-.5 3-1.5 4-.8.8-1 1.3-1 1.5h-5c0-.2-.2-.7-1-1.5Z" />
                    </svg>
                    <span>{state.hintBusy ? "…" : hintLabel()}</span>
                </button>
            </div>

            <p className="canvas-access-copy" id="canvas-instructions">
                Swipe letters to form a word. Keyboard: type letters, Backspace to clear, Enter to submit.
            </p>

            {state.paused ? (
                <button type="button" className="pause-overlay" onClick={resumeFromHostPause}>
                    <span className="eyebrow">WIND HELD</span>
                    <strong>PAUSED</strong>
                    <small>TAP TO RESUME</small>
                </button>
            ) : null}
        </div>
    );
}
