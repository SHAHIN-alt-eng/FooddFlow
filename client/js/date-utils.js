"use strict";

(() => {
    const BANGLADESH_OFFSET_MS = 6 * 60 * 60 * 1000;

    function dateKey(date = new Date()) {
        return new Date(date.getTime() + BANGLADESH_OFFSET_MS)
            .toISOString()
            .slice(0, 10);
    }

    function tomorrowDateKey(date = new Date()) {
        const tomorrow = new Date(date.getTime() + BANGLADESH_OFFSET_MS);
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
        return tomorrow.toISOString().slice(0, 10);
    }

    window.FoodFlowDate = Object.freeze({ dateKey, tomorrowDateKey });
})();
