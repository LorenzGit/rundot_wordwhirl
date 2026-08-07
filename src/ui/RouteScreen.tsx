import { LEVELS } from "../game/words/levels.ts";
import { formatNumber } from "../systems/localization.ts";
import { useStore } from "../state/store.ts";
import MenuScreenLayout from "./MenuScreenLayout.tsx";

export default function RouteScreen() {
    const state = useStore((value) => value);
    const routes = [...new Set(LEVELS.map((level) => level.route))];
    return (
        <MenuScreenLayout title="SKY ROUTE" kicker="YOUR JOURNEY">
            <p className="screen-copy">
                Each cleared current opens the next. The whole route loops with harder word sets ready for future
                updates.
            </p>
            <div className="route-list">
                {routes.map((route, routeIndex) => {
                    const levels = LEVELS.filter((entry) => entry.route === route);
                    return (
                        <section className="route-card" key={route}>
                            <div className="route-medallion" aria-hidden="true">
                                {formatNumber(routeIndex + 1)}
                            </div>
                            <div>
                                <p className="eyebrow">CURRENT {formatNumber(routeIndex + 1)}</p>
                                <h3>{route}</h3>
                                <div className="route-dots" role="img" aria-label={`${route} progress`}>
                                    {levels.map((level) => {
                                        const absolute = LEVELS.indexOf(level) + 1;
                                        const reached = state.routeLoops > 0 || absolute <= state.level;
                                        const cleared = state.routeLoops > 0 || absolute < state.level;
                                        return (
                                            <span
                                                key={level.id}
                                                className={cleared ? "cleared" : reached ? "current" : ""}
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                        </section>
                    );
                })}
            </div>
            <div className="record-card">
                <span>ROUTES CLEARED</span>
                <strong>{formatNumber(state.routeLoops)}</strong>
            </div>
        </MenuScreenLayout>
    );
}
