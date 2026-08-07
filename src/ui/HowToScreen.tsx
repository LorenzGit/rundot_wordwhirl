import MenuScreenLayout from "./MenuScreenLayout.tsx";

export default function HowToScreen() {
    return (
        <MenuScreenLayout title="HOW TO PLAY" kicker="THREE EASY WINDS">
            <div className="how-list">
                <article>
                    <span>1</span>
                    <div>
                        <h3>SWIPE A WORD</h3>
                        <p>
                            Drag through the compass letters without lifting. Keyboard players can type and press Enter.
                        </p>
                    </div>
                </article>
                <article>
                    <span>2</span>
                    <div>
                        <h3>FILL THE SKY GRID</h3>
                        <p>Every answer settles into the crossword. Extra valid words become bonus Sparks.</p>
                    </div>
                </article>
                <article>
                    <span>3</span>
                    <div>
                        <h3>CLEAR THE WEATHER</h3>
                        <p>
                            Find every answer to open the next current. Shuffle is free. You start with three hints;
                            optional ads or a shop pack can refill stock.
                        </p>
                    </div>
                </article>
            </div>
            <div className="fair-play-card">
                <strong>NO LIVES. NO TIMERS.</strong>
                <p>Play every route without buying anything or watching an ad.</p>
            </div>
        </MenuScreenLayout>
    );
}
