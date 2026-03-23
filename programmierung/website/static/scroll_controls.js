(function() {
    'use strict';

    let scrollInterval = null;
    const scrollSpeed = 10; // Speed in pixels per 16ms

    function startScrolling(direction) {
        if (scrollInterval) return;
        
        scrollInterval = setInterval(() => {
            window.scrollBy({
                top: direction === 'down' ? scrollSpeed : -scrollSpeed,
                behavior: 'auto'
            });
        }, 16);
    }

    function stopScrolling() {
        if (scrollInterval) {
            clearInterval(scrollInterval);
            scrollInterval = null;
        }
    }

    function init() {
        // Create the container
        const container = document.createElement('div');
        container.className = 'scroll-buttons';
        container.innerHTML = `
            <div class="scroll-btn" id="scroll-up" title="Nach oben">▲</div>
            <div class="scroll-btn" id="scroll-down" title="Nach unten">▼</div>
        `;
        document.body.appendChild(container);

        const upBtn = document.getElementById('scroll-up');
        const downBtn = document.getElementById('scroll-down');

        if (!upBtn || !downBtn) return;

        // Long press logic
        const startEvents = ['mousedown', 'touchstart'];
        const stopEvents = ['mouseup', 'mouseleave', 'touchend', 'touchcancel'];

        startEvents.forEach(evt => {
            upBtn.addEventListener(evt, (e) => {
                if (e.type === 'touchstart') e.preventDefault();
                startScrolling('up');
            });
            downBtn.addEventListener(evt, (e) => {
                if (e.type === 'touchstart') e.preventDefault();
                startScrolling('down');
            });
        });

        stopEvents.forEach(evt => {
            // Register stop on specific buttons AND window for safety
            upBtn.addEventListener(evt, stopScrolling);
            downBtn.addEventListener(evt, stopScrolling);
            window.addEventListener(evt, stopScrolling);
        });
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        init();
    } else {
        document.addEventListener('DOMContentLoaded', init);
    }
})();
