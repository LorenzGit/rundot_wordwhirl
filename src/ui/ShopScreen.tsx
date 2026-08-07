import { useEffect, useState } from "react";
import { audioManager } from "../audio/audioManager.ts";
import { HINT_ECONOMY } from "../config/platform.ts";
import { getRunCapabilities } from "../sdk/runSdk.ts";
import { formatNumber } from "../systems/localization.ts";
import {
    checkoutDeclineReason,
    productView,
    purchaseProduct,
    reconcilePendingPurchase,
    refreshCommerce,
    validateCatalogInDevelopment,
} from "../systems/monetization/commerce.ts";
import { DEV_PREVIEW_PRICES, type ProductId } from "../systems/monetization/config.ts";
import { recordHintPackSelected, recordPurchaseFunnel, recordScreenView } from "../systems/gameAnalytics.ts";
import { runtimeServices } from "../systems/runtimeServices.ts";
import { store, useStore } from "../state/store.ts";
import MenuScreenLayout from "./MenuScreenLayout.tsx";

/**
 * A decline the host explained is worth saying plainly — "PURCHASE FAILED" on
 * an empty wallet reads as a broken shop rather than a balance the player can
 * do something about.
 */
const DECLINE_TOASTS: Readonly<Record<"insufficient_funds" | "already_owned" | "rate_limited" | "generic", string>> = {
    insufficient_funds: "NOT ENOUGH RUN BITS",
    already_owned: "ALREADY OWNED",
    rate_limited: "TOO MANY ORDERS — TRY AGAIN SHORTLY",
    generic: "PURCHASE FAILED",
};

function PriceLine({
    productId,
    owned,
    livePrice,
    previewPrice,
}: {
    productId: ProductId;
    owned: boolean;
    livePrice: string | null;
    previewPrice: string | null;
}) {
    return (
        <div className="price-line">
            <strong>{owned ? "OWNED" : (livePrice ?? previewPrice ?? "PRICE SYNC NEEDED")}</strong>
            {previewPrice && !owned ? <span>LOCAL PREVIEW</span> : null}
            {productId === "hint_pack" ? <span>CONSUMABLE</span> : null}
        </div>
    );
}

export default function ShopScreen() {
    useStore(
        (state) =>
            `${state.ownedProductIds.join(",")}:${state.pendingPurchaseIntent?.idempotencyKey ?? ""}:${state.runtimeReady}:${state.level}:${state.hints}`,
    );
    const level = useStore((state) => state.level);
    const hints = useStore((state) => state.hints);
    const [busyId, setBusyId] = useState<ProductId | null>(null);
    const [, refreshView] = useState(0);
    useEffect(() => {
        recordScreenView("shop");
        let disposed = false;
        void (async () => {
            await reconcilePendingPurchase();
            await refreshCommerce();
            await validateCatalogInDevelopment();
            if (!disposed) refreshView((value) => value + 1);
        })();
        return () => {
            disposed = true;
        };
    }, []);

    const aurora = productView("aurora_compass");
    const hintPack = productView("hint_pack");
    const unlocked = level >= 3;
    const capabilities = getRunCapabilities();

    const priceLabel = (productId: ProductId, product: ReturnType<typeof productView>) => {
        const preview = import.meta.env.DEV && !capabilities.purchases ? DEV_PREVIEW_PRICES[productId] : null;
        const numericPrice = product.price === null ? Number.NaN : Number(product.price);
        const livePrice =
            product.price === null
                ? null
                : Number.isFinite(numericPrice)
                  ? `${formatNumber(numericPrice)} RB`
                  : product.price;
        return { livePrice, previewPrice: preview };
    };

    const buy = async (productId: ProductId) => {
        if (productId === "aurora_compass" && !unlocked) return;
        if (productId === "hint_pack") recordHintPackSelected();
        recordPurchaseFunnel(2, productId);
        recordPurchaseFunnel(3, productId);
        await audioManager.unlock();
        setBusyId(productId);
        const outcome = await purchaseProduct(productId);
        setBusyId(null);
        if (!outcome) store.patch({ toast: "RUN CHECKOUT IS NOT AVAILABLE HERE" });
        else if (outcome.status === "confirmed") {
            recordPurchaseFunnel(4, productId, { hints_stock: store.get().hints });
            store.patch({
                toast: productId === "hint_pack" ? `+${HINT_ECONOMY.packSize} HINTS` : "AURORA COMPASS OWNED",
            });
            audioManager.play("reward");
            void runtimeServices.haptic("success");
        } else if (outcome.status === "cancelled") store.patch({ toast: "CHECKOUT CANCELLED" });
        else if (outcome.status === "unknown") store.patch({ toast: "ORDER PENDING — SAFE TO RETRY LATER" });
        else store.patch({ toast: DECLINE_TOASTS[checkoutDeclineReason(outcome.error) ?? "generic"] });
    };

    const auroraPrices = priceLabel("aurora_compass", aurora);
    const packPrices = priceLabel("hint_pack", hintPack);

    return (
        <MenuScreenLayout title="COMPASS SHOP" kicker="HINTS + THEME">
            <p className="safety-note" role="status">
                HINT STOCK · {formatNumber(hints)}
            </p>

            <article className="shop-product">
                <p className="eyebrow">CONSUMABLE · {formatNumber(HINT_ECONOMY.packPriceRb)} RB</p>
                <h3>HINT PACK · {formatNumber(HINT_ECONOMY.packSize)}</h3>
                <p>
                    Adds {formatNumber(HINT_ECONOMY.packSize)} letter hints to your global stock. Each hint reveals one
                    unsolved cell. You start with {formatNumber(HINT_ECONOMY.startingStock)}; watching an ad can refill{" "}
                    {formatNumber(HINT_ECONOMY.adRefill)} when empty.
                </p>
                <PriceLine
                    productId="hint_pack"
                    owned={false}
                    livePrice={packPrices.livePrice}
                    previewPrice={packPrices.previewPrice}
                />
                {hintPack.pendingReconciliation ? <p className="pending-copy">LAST ORDER STILL SETTLING</p> : null}
                <button
                    type="button"
                    className="primary-button"
                    disabled={busyId !== null || !hintPack.purchasable}
                    onClick={() => void buy("hint_pack")}
                >
                    {busyId === "hint_pack"
                        ? "OPENING CHECKOUT…"
                        : hintPack.purchasable
                          ? `BUY ${formatNumber(HINT_ECONOMY.packSize)} HINTS`
                          : "RUN HOST REQUIRED"}
                </button>
            </article>

            <div className="aurora-preview" aria-hidden="true">
                <div className="aurora-ring">
                    <span>A</span>
                    <span>R</span>
                    <span>C</span>
                </div>
            </div>
            <article className="shop-product">
                <p className="eyebrow">PERMANENT · REFUNDABLE 24H</p>
                <h3>AURORA COMPASS</h3>
                <p>
                    Unlocks the aurora board and compass theme. Cosmetic only — puzzles stay fully playable without it.
                </p>
                <PriceLine
                    productId="aurora_compass"
                    owned={aurora.owned}
                    livePrice={auroraPrices.livePrice}
                    previewPrice={auroraPrices.previewPrice}
                />
                {aurora.pendingReconciliation && !aurora.owned ? (
                    <p className="pending-copy">LAST ORDER STILL SETTLING</p>
                ) : null}
                <button
                    type="button"
                    className="primary-button"
                    disabled={busyId !== null || aurora.owned || !unlocked || !aurora.purchasable}
                    onClick={() => void buy("aurora_compass")}
                >
                    {busyId === "aurora_compass"
                        ? "OPENING CHECKOUT…"
                        : aurora.owned
                          ? "OWNED"
                          : !unlocked
                            ? "CLEARS AFTER LEVEL 2"
                            : aurora.purchasable
                              ? "BUY AURORA COMPASS"
                              : "RUN HOST REQUIRED"}
                </button>
            </article>

            <article className="ad-policy-card">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M9 18h6M10 21h4M8.5 14.5C7.5 13.5 7 12 7 10.5a5 5 0 0 1 10 0c0 1.5-.5 3-1.5 4-.8.8-1 1.3-1 1.5h-5c0-.2-.2-.7-1-1.5Z" />
                </svg>
                <div>
                    <strong>OPTIONAL AD REFILL</strong>
                    <p>
                        When your hint stock hits zero, a rewarded video can add {formatNumber(HINT_ECONOMY.adRefill)}{" "}
                        hints. No forced ads — the puzzle stays open if fill fails.
                    </p>
                </div>
            </article>
            <p className="safety-note">
                Prices resolve from the RUN catalog. Grants only follow host-verified purchases or ads; local preview
                never invents ownership.
            </p>
        </MenuScreenLayout>
    );
}
