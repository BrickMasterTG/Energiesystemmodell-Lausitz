// app.js — Frontend JavaScript for Central UI
// Wrapped in IIFE to avoid global namespace pollution

(function () {
  'use strict';

  // ============================================================================
  // NAMESPACE & STATE
  // ============================================================================

  const App = {
    metaCache: {},
    pendingRequests: new Set(),
    intervals: [],
    config: {
      FETCH_TIMEOUT: 12000,
      POLL_INTERVAL: 3000,
      MAX_FAILS: 3,
      BOOT_WINDOW_MS: 10000
    }
  };

  // State tracking
  let deviceStatus = {
    host: false,
    esp1: false,
    esp2: false,
    esp3: false,
    esp4: false,
    esp5: false
  };

  let deviceFailCount = {
    host: 0,
    esp1: 0,
    esp2: 0,
    esp3: 0,
    esp4: 0,
    esp5: 0
  };

  let showAllDevices = false;

  // Selective polling state
  const FIRST_BOOT_TIME = Date.now();
  const espConnectedHistory = { esp1: false, esp2: false, esp3: false, esp4: false, esp5: false };
  const espManualTry = { esp1: false, esp2: false, esp3: false, esp4: false, esp5: false };

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  // Null-safe DOM access
  function $(id) {
    return document.getElementById(id);
  }

  function safeSetDisplay(id, show) {
    const el = $(id);
    if (el) el.style.display = show ? 'block' : 'none';
  }

  function safeSetText(id, text) {
    const el = $(id);
    if (el) el.textContent = text;
  }

  function safeSetClass(el, className, isOnline) {
    if (el) {
      el.className = className + (isOnline ? ' online' : ' offline');
    }
  }

  // Fetch with timeout to prevent hanging requests
  function fetchWithTimeout(url, options = {}, timeout = App.config.FETCH_TIMEOUT) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    return fetch(url, { ...options, signal: controller.signal })
      .finally(() => clearTimeout(id));
  }

  // Atomic request deduplication
  function tryStartRequest(key) {
    if (App.pendingRequests.has(key)) return false;
    App.pendingRequests.add(key);
    return true;
  }

  function endRequest(key) {
    App.pendingRequests.delete(key);
  }

  // ============================================================================
  // POLLING LOGIC
  // ============================================================================

  function shouldPollEsp(device) {
    if (Date.now() - FIRST_BOOT_TIME < App.config.BOOT_WINDOW_MS) return true;
    if (espConnectedHistory[device]) return true;
    if (espManualTry[device]) return true;
    return false;
  }

  function connectEsp(device) {
    espManualTry[device] = true;
    updateConnectButtonVisibility(device);
    refreshDeviceState(device);
  }

  function updateConnectButtonVisibility(device) {
    const btn = $('connect-btn-' + device);
    if (!btn) return;
    const isSuspended = !shouldPollEsp(device);
    btn.style.display = isSuspended ? 'inline-block' : 'none';
  }

  // ============================================================================
  // VIEW CONTROL
  // ============================================================================

  function toggleViewMode() {
    const toggle = $('viewToggle');
    showAllDevices = toggle ? toggle.checked : false;
    updateVisibility();
  }

  function updateVisibility() {
    const cards = {
      esp1: ['card_esp1_relays', 'card_rs232'],
      esp2: ['card_esp2_relays'],
      esp3: ['card_esp3'],
      esp4: ['card_esp4_relays', 'card_esp4_sensors'],
      esp5: ['card_esp5']
    };

    const showEsp1 = showAllDevices || deviceStatus.esp1;
    const showEsp2 = showAllDevices || deviceStatus.esp2;
    const showEsp3 = showAllDevices || deviceStatus.esp3;
    const showEsp4 = showAllDevices || deviceStatus.esp4;
    const showEsp5 = showAllDevices || deviceStatus.esp5;
    const showTemp = showAllDevices || deviceStatus.esp1 || deviceStatus.esp2;

    cards.esp1.forEach(id => safeSetDisplay(id, showEsp1));
    cards.esp2.forEach(id => safeSetDisplay(id, showEsp2));
    cards.esp3.forEach(id => safeSetDisplay(id, showEsp3));
    cards.esp4.forEach(id => safeSetDisplay(id, showEsp4));
    cards.esp5.forEach(id => safeSetDisplay(id, showEsp5));
    safeSetDisplay('card_temp', showTemp);
  }

  // ============================================================================
  // API FETCHING
  // ============================================================================

  async function fetchMeta(device) {
    if (App.metaCache[device]) return App.metaCache[device];
    if (!tryStartRequest('meta-' + device)) return null;

    try {
      let r = await fetchWithTimeout('/api/device_meta/' + device);
      if (!r.ok) throw r;
      let j = await r.json();
      if (j.error) throw j.error;
      let body = j.body || j;
      if (!j.offline) App.metaCache[device] = body;
      return body;
    } catch (e) {
      if (e.name !== 'AbortError') console.error('meta err', device, e);
      return null;
    } finally {
      endRequest('meta-' + device);
    }
  }

  async function fetchState(device) {
    if (!tryStartRequest('state-' + device)) return null;

    try {
      let r = await fetchWithTimeout('/api/device_state/' + device);
      if (!r.ok) throw r;
      let j = await r.json();
      if (j.error) throw j.error;

      let isOffline = !!j.offline;

      if (isOffline) {
        deviceFailCount[device]++;
      } else {
        deviceFailCount[device] = 0;
        if (!espConnectedHistory[device]) {
          espConnectedHistory[device] = true;
          espManualTry[device] = false;
          updateConnectButtonVisibility(device);
        }
      }

      if (deviceFailCount[device] >= App.config.MAX_FAILS) {
        updateStatusDisplay(device, false);
        updateConnectButtonVisibility(device);
      } else if (deviceFailCount[device] === 0) {
        updateStatusDisplay(device, true);
      }

      let body = j.body || j;
      if (isOffline) body.offline = true;
      return body;
    } catch (e) {
      if (e.name !== 'AbortError') console.error('state err', device, e);

      deviceFailCount[device]++;
      if (deviceFailCount[device] >= App.config.MAX_FAILS) {
        updateStatusDisplay(device, false);
      }

      return null;
    } finally {
      endRequest('state-' + device);
    }
  }

  function updateStatusDisplay(device, isOnline) {
    if (deviceStatus[device] !== isOnline) {
      deviceStatus[device] = isOnline;
      updateVisibility();
    }

    const el = $('status-' + device);
    if (el) {
      el.className = 'status-indicator ' + (isOnline ? 'online' : 'offline');
      el.title = isOnline ? 'Verbunden' : 'Nicht erreichbar';
    }

    if (device === 'host') {
      updateWifiWarning();

      // #region agent log
      fetch('http://127.0.0.1:7898/ingest/b0609670-887b-4a4b-bba0-759c25d36794', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Debug-Session-Id': 'fbab11'
        },
        body: JSON.stringify({
          sessionId: 'fbab11',
          runId: 'pre-fix',
          hypothesisId: 'H1',
          location: 'static/app.js:updateStatusDisplay',
          message: 'Host status updated in frontend',
          data: { isOnline: isOnline },
          timestamp: Date.now()
        })
      }).catch(() => { });
      // #endregion
    }
  }

  function updateWifiWarning() {
    const bar = $('wifi-warning');
    if (!bar) return;
    const isOnline = !!deviceStatus.host;
    bar.style.display = isOnline ? 'none' : 'flex';
  }

  async function checkHostStatus() {
    try {
      let r = await fetchWithTimeout('/api/debug/host');
      if (r.ok) {
        let j = await r.json();
        if (j.host_reachable) {
          deviceFailCount.host = 0;
          updateStatusDisplay('host', true);
        } else {
          deviceFailCount.host++;
        }
      } else {
        deviceFailCount.host++;
      }

      if (deviceFailCount.host >= App.config.MAX_FAILS) {
        updateStatusDisplay('host', false);
      }
    } catch (e) {
      deviceFailCount.host++;
      if (deviceFailCount.host >= App.config.MAX_FAILS) {
        updateStatusDisplay('host', false);
      }
    }
  }

  // ============================================================================
  // RELAY CONTROLS
  // ============================================================================

  function mkRelayRow(globalIdx, name, state) {
    const row = document.createElement('div');
    row.className = 'relay-row';

    const label = document.createElement('div');
    label.className = 'label';
    label.innerHTML = '<strong>' + name + '</strong><div class="small">#' + globalIdx + '</div>';

    const sw = document.createElement('label');
    sw.className = 'switch';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = 'g' + globalIdx;
    input.checked = (state == 1);
    input.onchange = () => toggleRelay(globalIdx, input.checked ? 1 : 0, input);

    const span = document.createElement('span');
    span.className = 'slider';

    sw.appendChild(input);
    sw.appendChild(span);
    row.appendChild(label);
    row.appendChild(sw);

    return row;
  }

  async function initDeviceRelays(device, existingState = null) {
    const containerId = (device === 'esp3') ? 'esp3_relays' : device + '_relays';
    const container = $(containerId);
    if (!container) return;

    if (container.querySelector('.relay-row')) return;

    const state = existingState || await fetchState(device);
    const meta = await fetchMeta(device);

    if (!meta || !state || state.offline) {
      if (container.innerHTML === '' || container.innerHTML === 'lade...') {
        container.innerHTML = '<div class="error">Warte auf Verbindung...</div>';
      }
      return;
    }

    container.innerHTML = '';

    let startIdx;
    if (device === 'esp1') startIdx = 1;
    else if (device === 'esp2') startIdx = 9;
    else if (device === 'esp4') startIdx = 13;
    else startIdx = 19;

    const count = meta.count || meta.relayCount || 0;
    const names = meta.names || [];
    const globalIndices = meta.global_indices || [];

    for (let i = 0; i < count; i++) {
      const name = names[i] || ('Relay ' + (i + 1));
      const globalIdx = (globalIndices[i] !== undefined && globalIndices[i] !== -1) ? globalIndices[i] : (startIdx + i);

      let st = 0;
      if (device === 'esp4' || device === 'esp3') {
        st = (state.relays && state.relays[i] !== undefined) ? state.relays[i] : 0;
      } else {
        st = (state['r' + i] !== undefined) ? state['r' + i] : 0;
      }

      container.appendChild(mkRelayRow(globalIdx, name, st));
    }
  }

  async function buildRelays() {
    await Promise.all([
      initDeviceRelays('esp4'),
      initDeviceRelays('esp1'),
      initDeviceRelays('esp2'),
      initDeviceRelays('esp3')
    ]);
  }

  async function toggleRelay(globalIdx, val, inputElement) {
    const requestKey = 'relay-' + globalIdx;
    if (!tryStartRequest(requestKey)) {
      console.log('Relay request already pending for', globalIdx);
      inputElement.checked = !inputElement.checked;
      return;
    }

    inputElement.disabled = true;

    try {
      let r = await fetchWithTimeout('/api/relay/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ global_idx: globalIdx, val })
      });

      if (!r.ok) {
        let errMsg = 'ESP hat nicht geantwortet';
        try {
          const j = await r.json();
          if (j.error) errMsg = j.error;
        } catch (_) { /* ignore */ }
        inputElement.checked = !inputElement.checked;
        inputElement.disabled = false;
        alert('Fehler beim Schalten:\n' + errMsg);
        return;
      }

      setTimeout(async () => {
        inputElement.disabled = false;
        let device;
        if (globalIdx <= 8) device = 'esp1';
        else if (globalIdx <= 12) device = 'esp2';
        else if (globalIdx <= 18) device = 'esp4';
        else device = 'esp3';
        await refreshDeviceState(device);
      }, 100);
    } catch (e) {
      alert('Fehler beim Schalten: ' + e);
      inputElement.checked = !inputElement.checked;
      inputElement.disabled = false;
    } finally {
      endRequest(requestKey);
    }
  }

  async function refreshDeviceState(device) {
    const state = await fetchState(device);
    if (!state) return;
    refreshRelayCheckboxes(device, state);
    if (device === 'esp3') updateEsp3LegacyUI(state);
  }

  function refreshRelayCheckboxes(device, state) {
    const meta = App.metaCache[device];
    if (!meta || !state) return;

    let startIdx;
    if (device === 'esp1') startIdx = 1;
    else if (device === 'esp2') startIdx = 9;
    else if (device === 'esp4') startIdx = 13;
    else startIdx = 19;

    const count = meta.count || meta.relayCount || 0;
    const globalIndices = meta.global_indices || [];
    for (let i = 0; i < count; i++) {
      const globalIdx = (globalIndices[i] !== undefined && globalIndices[i] !== -1) ? globalIndices[i] : (startIdx + i);
      const checkbox = $('g' + globalIdx);
      if (checkbox) {
        const newState = (device === 'esp4' || device === 'esp3')
          ? (state.relays ? state.relays[i] === 1 : false)
          : state['r' + i] === 1;
        if (checkbox.checked !== newState) checkbox.checked = newState;
      }
    }
  }

  // ============================================================================
  // SCENARIOS
  // ============================================================================

  async function loadScenarios() {
    try {
      let r = await fetch('/api/scenarios');
      if (!r.ok) throw r;
      let j = await r.json();

      const container = $('scenarios');
      if (!container) return;
      container.innerHTML = '';

      if (j.scenarios && Object.keys(j.scenarios).length > 0) {
        for (const [scenarioKey, scenarioData] of Object.entries(j.scenarios)) {
          const group = document.createElement('div');
          group.className = 'scenario-group';

          const title = document.createElement('div');
          title.className = 'scenario-title';
          title.textContent = scenarioData.name;
          group.appendChild(title);

          const btnContainer = document.createElement('div');
          btnContainer.className = 'scenario-buttons';

          scenarioData.states.forEach(stateInfo => {
            const btn = document.createElement('button');
            btn.className = 'scenario-btn';
            btn.textContent = stateInfo.name;
            btn.title = stateInfo.description || '';
            btn.onclick = () => executeScenario(scenarioKey, stateInfo.id, stateInfo.name, btn);
            btnContainer.appendChild(btn);
          });

          group.appendChild(btnContainer);
          container.appendChild(group);
        }
      } else {
        container.innerHTML = '<div class="small">Keine Szenarien verfügbar</div>';
      }
    } catch (e) {
      console.error('scenarios err', e);
      const el = $('scenarios');
      if (el) el.innerHTML = '<div class="error">Fehler beim Laden</div>';
    }
  }

  async function executeScenario(scenarioName, state, stateName, buttonElement) {
    buttonElement.disabled = true;
    const originalText = buttonElement.textContent;
    buttonElement.textContent = stateName + ' ...';

    try {
      let r = await fetch('/api/scenario/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: scenarioName, state: state })
      });

      if (!r.ok) throw new Error('Request failed');
      let j = await r.json();

      if (j.success) {
        buttonElement.textContent = stateName + ' ✓';

        let refreshCount = 0;
        const maxRefresh = 20;
        const refreshInterval = setInterval(async () => {
          await Promise.all([
            refreshDeviceState('esp1'),
            refreshDeviceState('esp2')
          ]);
          refreshCount++;
          if (refreshCount >= maxRefresh) {
            clearInterval(refreshInterval);
          }
        }, 1000);

        setTimeout(() => {
          buttonElement.textContent = originalText;
          buttonElement.disabled = false;
        }, 2000);
      } else {
        buttonElement.textContent = stateName + ' ✗';
        console.error('Scenario error:', j);
        alert('Fehler beim Ausführen:\n' + (j.error || JSON.stringify(j)));
        setTimeout(() => {
          buttonElement.textContent = originalText;
          buttonElement.disabled = false;
        }, 2000);
      }
    } catch (e) {
      alert('Fehler: ' + e);
      buttonElement.textContent = originalText;
      buttonElement.disabled = false;
    }
  }

  // ============================================================================
  // ESP3 TRAIN/WIND CONTROLS
  // ============================================================================

  function updateEsp3LegacyUI(state3) {
    if (!state3) return;

    const elWind = $('windState');
    if (elWind) elWind.textContent = state3.running ? 'AN' : 'AUS';

    const elPwm = $('pwmVal');
    if (elPwm) elPwm.textContent = state3.pwm;

    const slider = $('pwmSlider');
    if (slider && document.activeElement !== slider) {
      slider.value = state3.pwm;
    }

    const dirBox = $('trainDir');
    if (dirBox) {
      dirBox.checked = !state3.forward;
    }
  }

  async function setWind(val) {
    await fetch('/api/esp3/set_wind', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ val })
    });
    setTimeout(() => refreshDeviceState('esp3'), 100);
  }

  async function setPwm(v) {
    const dirBox = $('trainDir');
    const isBackward = dirBox ? dirBox.checked : false;
    const pwm = parseInt(v);

    const pwmVal = $('pwmVal');
    if (pwmVal) pwmVal.textContent = v;

    await fetch('/api/esp3/set_pwm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pwm: pwm,
        dir: isBackward ? 0 : 1
      })
    });
  }

  async function stopTrain() {
    await fetch('/api/esp3/set_pwm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pwm: 0 })
    });

    const pwmVal = $('pwmVal');
    const slider = $('pwmSlider');
    if (pwmVal) pwmVal.textContent = '0';
    if (slider) slider.value = 0;
  }

  // ============================================================================
  // RS232
  // ============================================================================

  function updateRsCommand(percent) {
    const value = Math.round((percent / 100) * 32000);
    const hexValue = value.toString(16).toUpperCase().padStart(4, '0');

    const rsPercent = $('rs_percent');
    const rsHex = $('rs_hex_value');
    if (rsPercent) rsPercent.textContent = percent;
    if (rsHex) rsHex.textContent = hexValue;

    const cmd = ':0603010121' + hexValue;
    const rsCmd = $('rs_cmd');
    if (rsCmd) rsCmd.value = cmd;
  }

  async function sendRs() {
    const rsCmd = $('rs_cmd');
    const rsTimeout = $('rs_timeout');
    const rsReply = $('rs_reply');

    let cmd = rsCmd ? rsCmd.value.trim() : '';
    let timeout = rsTimeout ? parseInt(rsTimeout.value) || 500 : 500;

    if (!cmd) {
      alert('Bitte Befehl');
      return;
    }

    if (rsReply) rsReply.textContent = 'sende...';

    try {
      let r = await fetch('/api/rs232', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cmd, timeout })
      });
      let j = await r.json();
      let body = j.body || j;
      if (typeof body === 'object') body = JSON.stringify(body, null, 2);
      if (rsReply) rsReply.textContent = (body || JSON.stringify(j));
    } catch (e) {
      if (rsReply) rsReply.textContent = 'Fehler: ' + e;
    }
  }

  async function testLeds(mode, color = null) {
    try {
      const body = { mode };
      if (color) {
        body.r = color.r;
        body.g = color.g;
        body.b = color.b;
      }
      await fetch('/api/leds/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    } catch (e) {
      console.error('LED test failure:', e);
      alert('LED Test fehlgeschlagen: ' + e);
    }
  }

  function testLedsFromPicker() {
    const picker = $('ledPicker');
    if (!picker) return;
    const hex = picker.value;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    testLeds('custom', { r, g, b });
  }

  // ============================================================================
  // TEMPERATURE & SENSORS
  // ============================================================================

  function updateTemps(device, state) {
    if (!state) return;

    if (device === 'esp3') {
      if (state.sensors) {
        safeSetText('temp3_1', (state.sensors[0] !== undefined && state.sensors[0] !== null) ? Number(state.sensors[0]).toFixed(2) : '--');
        safeSetText('temp3_2', (state.sensors[1] !== undefined && state.sensors[1] !== null) ? Number(state.sensors[1]).toFixed(2) : '--');
      }
      return;
    }

    const suffix = device === 'esp1' ? '1' : '2';

    if (state.temp !== undefined) {
      const el = $('temp' + suffix);
      if (el) el.textContent = (state.temp === null ? '--' : Number(state.temp).toFixed(2));
    }
    if (state.rntc !== undefined) {
      const el = $('rntc' + suffix);
      if (el) el.textContent = (state.rntc === null ? '--' : Number(state.rntc).toFixed(0));
    }
  }

  function updateEsp4Sensors(state) {
    if (!state) return;

    if (state.sensors) {
      state.sensors.forEach((sensor, i) => {
        const pEl = $('esp4_p' + i);
        const iEl = $('esp4_i' + i);
        if (pEl) pEl.textContent = Number(sensor.pressure).toFixed(2);
        if (iEl) iEl.textContent = Number(sensor.current).toFixed(2);
      });
    }

    if (state.flow !== undefined) {
      const fEl = $('esp4_flow');
      if (fEl) fEl.textContent = Number(state.flow).toFixed(2);
    }
  }

  // ============================================================================
  // POLLING LOOP
  // ============================================================================

  async function refreshAll() {
    await checkHostStatus();

    ['esp1', 'esp2', 'esp3', 'esp4', 'esp5'].forEach(d => updateConnectButtonVisibility(d));

    if (shouldPollEsp('esp4')) {
      const state4 = await fetchState('esp4');
      if (state4) {
        await initDeviceRelays('esp4', state4);
        refreshRelayCheckboxes('esp4', state4);
        updateEsp4Sensors(state4);
      }
    }
    if (shouldPollEsp('esp1')) {
      const state1 = await fetchState('esp1');
      if (state1) {
        await initDeviceRelays('esp1', state1);
        refreshRelayCheckboxes('esp1', state1);
        updateTemps('esp1', state1);
      }
    }
    if (shouldPollEsp('esp2')) {
      const state2 = await fetchState('esp2');
      if (state2) {
        await initDeviceRelays('esp2', state2);
        refreshRelayCheckboxes('esp2', state2);
        updateTemps('esp2', state2);
      }
    }
    if (shouldPollEsp('esp3')) {
      const state3 = await fetchState('esp3');
      if (state3) {
        await initDeviceRelays('esp3', state3);
        refreshRelayCheckboxes('esp3', state3);
        updateEsp3LegacyUI(state3);
        updateTemps('esp3', state3);
      }
    }
    if (shouldPollEsp('esp5')) {
      const state5 = await fetchState('esp5');
      if (state5) {
        // No specific UI components to initialize for ESP5 yet beyond status
      }
    }
  }

  async function pollLoop() {
    try {
      await refreshAll();
    } catch (e) {
      console.error('Poll error:', e);
    }
    const timeoutId = setTimeout(pollLoop, App.config.POLL_INTERVAL);
    App.intervals.push(timeoutId);
  }

  // ============================================================================
  // CLEANUP (for page unload or SPA navigation)
  // ============================================================================

  function cleanup() {
    App.intervals.forEach(id => clearTimeout(id));
    App.intervals = [];
    App.metaCache = {};
    App.pendingRequests.clear();
  }

  // Cleanup on page unload
  window.addEventListener('beforeunload', cleanup);

  // ============================================================================
  // INIT
  // ============================================================================

  // Expose functions that need to be called from HTML
  window.toggleViewMode = toggleViewMode;
  window.connectEsp = connectEsp;
  window.loadScenarios = loadScenarios;
  window.setWind = setWind;
  window.setPwm = setPwm;
  window.stopTrain = stopTrain;
  window.updateRsCommand = updateRsCommand;
  window.sendRs = sendRs;
  window.testLeds = testLeds;
  window.testLedsFromPicker = testLedsFromPicker;
  window.cleanup = cleanup;

  // Start
  buildRelays();
  loadScenarios();
  updateVisibility();

  setTimeout(() => {
    pollLoop();
  }, App.config.POLL_INTERVAL);

  // ============================================================================
  // TOUCH SWIPE SCROLL (for touchscreen displays)
  // ============================================================================
  // Enables smooth swipe-up/down scrolling. touchmove is NON-passive so we
  // can call preventDefault() to block text-selection during a drag.
  (function initTouchScroll() {
    let touchStartY = 0;
    let touchStartScrollY = 0;
    let lastTouchY = 0;
    let velocity = 0;
    let animFrame = null;
    let isDragging = false;

    document.addEventListener('touchstart', function (e) {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'BUTTON' || tag === 'LABEL' || tag === 'SELECT') return;
      if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }

      isDragging = false;
      touchStartY = e.touches[0].clientY;
      touchStartScrollY = window.scrollY;
      lastTouchY = touchStartY;
      velocity = 0;
    }, { passive: true });

    document.addEventListener('touchmove', function (e) {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'BUTTON' || tag === 'LABEL' || tag === 'SELECT') return;

      const currentY = e.touches[0].clientY;
      const deltaY = touchStartY - currentY;

      // Only start dragging after a minimum movement to distinguish from taps
      if (!isDragging && Math.abs(deltaY) < 5) return;
      isDragging = true;

      // Prevent text selection and default browser scroll behaviour
      e.preventDefault();

      velocity = lastTouchY - currentY;
      lastTouchY = currentY;

      window.scrollTo(0, touchStartScrollY + deltaY);
    }, { passive: false }); // Must be false to allow preventDefault()

    document.addEventListener('touchend', function () {
      if (!isDragging) return;
      isDragging = false;
      // Momentum scrolling after finger lift
      let mom = velocity;
      function momentum() {
        if (Math.abs(mom) < 0.5) return;
        window.scrollBy(0, mom);
        mom *= 0.92; // friction factor
        animFrame = requestAnimationFrame(momentum);
      }
      animFrame = requestAnimationFrame(momentum);
    }, { passive: true });
  })();

})();
