import { useEffect } from "react";
import packageJson from "../../package.json";
import { startCurrentLevel } from "../game/gameController.ts";
import { levelForNumber } from "../game/words/levels.ts";
import { recordMenuReady, recordScreenView } from "../systems/gameAnalytics.ts";
import { formatNumber } from "../systems/localization.ts";
import { store, useStore } from "../state/store.ts";
import { dailyHints } from "../systems/retention/dailyHints.ts";

type IconName = "route" | "shop" | "how" | "settings";

function Icon({ name }: { name: IconName }) {
    if (name === "route") return <path d="M5 19c3-7 5-3 7-10 2 7 5 3 7-4M5 19h14M12 9l-2-3m2 3 3-2" />;
    if (name === "shop") return <path d="M5 9h14l-1 11H6L5 9Zm3 1V7a4 4 0 0 1 8 0v3" />;
    if (name === "how")
        return (
            <path d="M9.5 9a2.7 2.7 0 1 1 4.2 2.2c-1.2.8-1.7 1.3-1.7 2.8m0 4h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z" />
        );
    // Stroke-first gear (lucide-style). The old filled cog path looked broken under
    // fill:none + stroke menu icons.
    return (
        <>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.85 1 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
        </>
    );
}

export default function MainMenu() {
    const state = useStore((value) => value);
    const level = levelForNumber(state.level);
    const resume = state.currentFoundWords.length > 0 || state.revealedCells.length > 0;
    const daily = dailyHints.view();
    useEffect(() => {
        recordMenuReady();
        recordScreenView("main");
    }, []);
    const nav: Array<{ screen: "route" | "shop" | "how-to" | "settings"; icon: IconName; label: string }> = [
        { screen: "route", icon: "route", label: "SKY ROUTE" },
        { screen: "shop", icon: "shop", label: "COMPASS" },
        { screen: "how-to", icon: "how", label: "HOW TO" },
        { screen: "settings", icon: "settings", label: "SETTINGS" },
    ];
    return (
        <main className="menu-shell safe-frame">
            <div className="menu-wind" aria-hidden="true" />
            <header className="brand-block">
                <p className="eyebrow">A SKY ATLAS OF WORDS</p>
                <h1>WORDWHIRL</h1>
                <p>CHASE THE WORDS. CLEAR THE WEATHER.</p>
            </header>

            <section className="menu-summary" aria-label="Current route">
                <div>
                    <span>{level.route}</span>
                    <strong>{level.title}</strong>
                </div>
                <div className="menu-summary-actions">
                    <button
                        type="button"
                        className="daily-hint-button"
                        disabled={!daily.ready || daily.claimed}
                        onClick={async () => {
                            const result = await dailyHints.claim();
                            store.patch({
                                toast: result.ok
                                    ? `DAY ${daily.streak} · +${result.reward} HINT${result.reward === 1 ? "" : "S"}`
                                    : result.reason,
                            });
                        }}
                        aria-label={
                            daily.claimed
                                ? `Daily hint claimed, day ${daily.streak}`
                                : `Claim ${daily.reward} daily hints, day ${daily.streak}`
                        }
                    >
                        <span>DAY {formatNumber(daily.streak)}</span>
                        <strong>
                            {daily.claimed
                                ? "CLAIMED"
                                : `+${formatNumber(daily.reward)} HINT${daily.reward === 1 ? "" : "S"}`}
                        </strong>
                    </button>
                    <div className="spark-balance">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="m12 2 2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2L12 2Z" />
                        </svg>
                        {formatNumber(state.sparks)}
                    </div>
                </div>
            </section>

            <button type="button" className="play-button" onClick={startCurrentLevel}>
                <span className="play-kicker">LEVEL {formatNumber(state.level)}</span>
                <strong>{resume ? "RESUME THE WIND" : "CATCH THE WIND"}</strong>
                <span className="play-arrow" aria-hidden="true">
                    →
                </span>
            </button>

            <nav className="menu-grid" aria-label="Wordwhirl menus">
                {nav.map((item) => (
                    <button
                        type="button"
                        key={item.screen}
                        onClick={() => {
                            store.patch({ menuScreen: item.screen });
                            recordScreenView(item.screen);
                        }}
                    >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <Icon name={item.icon} />
                        </svg>
                        <span>{item.label}</span>
                    </button>
                ))}
            </nav>

            <div className="menu-records">
                <span>
                    <strong>{formatNumber(state.lifetimeWords)}</strong> WORDS
                </span>
                <span>
                    <strong>{formatNumber(state.perfectLevels)}</strong> PERFECT SKIES
                </span>
            </div>
            <p className="build-version">v{packageJson.version}</p>
        </main>
    );
}
