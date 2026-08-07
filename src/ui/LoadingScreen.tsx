import { useStore } from "../state/store.ts";
import { formatNumber } from "../systems/localization.ts";

export default function LoadingScreen() {
    const progress = useStore((state) => state.loadProgress);
    const percent = Math.round(progress * 100);
    return (
        <main className="loading-screen safe-frame">
            <div className="loading-compass" aria-hidden="true">
                <span>W</span>
                <span>O</span>
                <span>W</span>
            </div>
            <h1>WORDWHIRL</h1>
            <p>CHARTING THE SKY</p>
            <div
                className="loading-track"
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
            >
                <div className="loading-fill" style={{ width: `${percent}%` }} />
            </div>
            <span>{formatNumber(percent)}%</span>
        </main>
    );
}
