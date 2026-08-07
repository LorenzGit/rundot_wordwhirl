import RundotGameAPI from "@series-inc/rundot-game-sdk/api";

export function formatNumber(value: number, options: Intl.NumberFormatOptions = {}): string {
    const groupedOptions = { useGrouping: true, ...options } satisfies Intl.NumberFormatOptions;
    try {
        return RundotGameAPI.formatNumber(value, groupedOptions);
    } catch {
        return new Intl.NumberFormat("en", groupedOptions).format(value);
    }
}
