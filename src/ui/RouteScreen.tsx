import { levelForNumber } from "../game/words/levels.ts";
import { formatNumber } from "../systems/localization.ts";
import { useStore } from "../state/store.ts";
import MenuScreenLayout from "./MenuScreenLayout.tsx";

/** Levels per named route segment. */
const ROUTE_SPAN = 3;
/** Route cards rendered around the player's position. Progression is unbounded. */
const VISIBLE_ROUTES = 4;

export default function RouteScreen() {
    const state = useStore((value) => value);

    // Window the list around the current level rather than materialising every route.
    const currentRoute = Math.floor((state.level - 1) / ROUTE_SPAN);
    const firstRoute = Math.max(0, currentRoute - 1);
    const routes = Array.from({ length: VISIBLE_ROUTES }, (_, offset) => {
        const routeIndex = firstRoute + offset;
        const firstLevel = routeIndex * ROUTE_SPAN + 1;
        return {
            routeIndex,
            firstLevel,
            name: levelForNumber(firstLevel).route,
        };
    });

    return (
        <MenuScreenLayout title="SKY ROUTE" kicker="YOUR JOURNEY">
            <p className="screen-copy">
                Each cleared current opens the next. The skies keep going — every route beyond the twelfth is drawn
                fresh from the wind atlas.
            </p>
            <div className="route-list">
                {routes.map((route) => (
                    <section className="route-card" key={route.routeIndex}>
                        <div className="route-medallion" aria-hidden="true">
                            {formatNumber(route.routeIndex + 1)}
                        </div>
                        <div>
                            <p className="eyebrow">CURRENT {formatNumber(route.routeIndex + 1)}</p>
                            <h3>{route.name}</h3>
                            <div className="route-dots" role="img" aria-label={`${route.name} progress`}>
                                {Array.from({ length: ROUTE_SPAN }, (_, step) => {
                                    const absolute = route.firstLevel + step;
                                    const reached = absolute <= state.level;
                                    const cleared = absolute < state.level;
                                    return (
                                        <span
                                            key={absolute}
                                            className={cleared ? "cleared" : reached ? "current" : ""}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    </section>
                ))}
            </div>
            <div className="record-card">
                <span>LEVEL</span>
                <strong>{formatNumber(state.level)}</strong>
            </div>
            <div className="record-card">
                <span>ARCS CLEARED</span>
                <strong>{formatNumber(state.routeLoops)}</strong>
            </div>
        </MenuScreenLayout>
    );
}
