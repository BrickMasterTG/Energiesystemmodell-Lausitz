(function () {
    'use strict';

    // ============================================================================
    // STATE & CONFIG
    // ============================================================================
    let scrollInterval = null;
    const scrollSpeed = 10;

    // ============================================================================
    // UTILITIES
    // ============================================================================
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification-toast notification-${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            background: ${type === 'error' ? '#ff4d4d' : '#228b22'};
            color: white;
            padding: 12px 24px;
            border-radius: 12px;
            box-shadow: 0 10px 20px rgba(0,0,0,0.2);
            z-index: 10000;
            animation: slideInRight 0.3s ease;
            font-weight: 600;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.2);
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(50px)';
            notification.style.transition = 'all 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // ============================================================================
    // SCROLLING
    // ============================================================================
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

    // ============================================================================
    // GLOBAL ACTIONS
    // ============================================================================
    window.triggerNotaus = async function () {
        if (!confirm('NOT-AUS bestätigen? Alle Systeme werden abgeschaltet.')) return;

        try {
            // 1. Send Scenario Stop
            await fetch('/api/scenario/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scenario: 'notaus', state: 0 })
            });

            // 2. Turn off LEDs
            await fetch('/api/leds/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: 'off' })
            });

            showNotification('NOT-AUS AKTIVIERT!', 'error');
            
            // Reload page after a short delay to reflect relay states
            setTimeout(() => window.location.reload(), 2000);
        } catch (e) {
            console.error('Notaus failed', e);
            showNotification('Fehler bei NOT-AUS!', 'error');
        }
    };

    window.triggerFlashGreen = async function () {
        try {
            // Start Green
            await fetch('/api/leds/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: 'green' })
            });

            showNotification('LED-Test: GRÜN', 'info');

            // Reset after 3s
            setTimeout(async () => {
                await fetch('/api/leds/test', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ mode: 'off' })
                });
            }, 3000);
        } catch (e) {
            console.error('LED Flash failed', e);
        }
    };

    // ============================================================================
    // INITIALIZATION
    // ============================================================================
    function init() {
        // --- Add Safety & Test Buttons to top corners ---
        if (!document.getElementById('corner-flash')) {
            const leftBtn = document.createElement('div');
            leftBtn.id = 'corner-flash';
            leftBtn.className = 'corner-btn corner-btn-left';
            leftBtn.innerHTML = '💡';
            leftBtn.title = 'LED-Test (Grün blinken)';
            leftBtn.onclick = window.triggerFlashGreen;
            document.body.appendChild(leftBtn);
        }

        if (!document.getElementById('corner-notaus')) {
            const rightBtn = document.createElement('div');
            rightBtn.id = 'corner-notaus';
            rightBtn.className = 'corner-btn corner-btn-right';
            rightBtn.innerHTML = '🛑';
            rightBtn.title = 'NOT-AUS - Alle Systeme stoppen';
            rightBtn.onclick = window.triggerNotaus;
            document.body.appendChild(rightBtn);
        }

        // --- Add Scroll Buttons if not present ---
        if (!document.getElementById('scroll-up')) {
            const container = document.createElement('div');
            container.className = 'scroll-buttons';
            container.innerHTML = `
                <div class="scroll-btn" id="scroll-up" title="Nach oben">▲</div>
                <div class="scroll-btn" id="scroll-down" title="Nach unten">▼</div>
            `;
            document.body.appendChild(container);

            const upBtn = document.getElementById('scroll-up');
            const downBtn = document.getElementById('scroll-down');

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
                window.addEventListener(evt, stopScrolling);
            });
        }
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        init();
    } else {
        document.addEventListener('DOMContentLoaded', init);
    }
})();
