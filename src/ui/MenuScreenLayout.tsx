import type { ReactNode } from "react";
import { store, type MenuScreen } from "../state/store.ts";

export default function MenuScreenLayout({
    title,
    kicker,
    children,
    backScreen = "main",
}: {
    title: string;
    kicker: string;
    children: ReactNode;
    backScreen?: MenuScreen;
}) {
    return (
        <main className="subscreen safe-frame">
            <header className="subscreen-header">
                <button
                    type="button"
                    className="back-button"
                    onClick={() => store.patch({ menuScreen: backScreen })}
                    aria-label="Back"
                >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="m15 5-7 7 7 7" />
                    </svg>
                </button>
                <div>
                    <p className="eyebrow">{kicker}</p>
                    <h2>{title}</h2>
                </div>
            </header>
            <div className="subscreen-content" data-testid="screen-scroll-region">
                {children}
                <span data-testid="screen-end" />
            </div>
        </main>
    );
}
