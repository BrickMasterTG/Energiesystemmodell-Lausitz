// Landing Page JavaScript - Interactive Effects
// Wrapped in IIFE to avoid global namespace pollution

(function () {
  'use strict';

  // ============================================================================
  // NAMESPACE & STATE
  // ============================================================================

  const Landing = {
    metaCache: {},
    pendingRequests: new Set(),
    intervals: [],
    sensorConfig: {}
  };

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  // Null-safe DOM access
  function $(id) {
    return document.getElementById(id);
  }

  // Atomic request deduplication
  function tryStartRequest(key) {
    if (Landing.pendingRequests.has(key)) return false;
    Landing.pendingRequests.add(key);
    return true;
  }

  function endRequest(key) {
    Landing.pendingRequests.delete(key);
  }

  // Notification System
  function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification-toast notification-${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideInRight 0.3s ease reverse';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  // ============================================================================
  // PARTICLE BACKGROUND
  // ============================================================================

  function createParticles() {
    const particlesContainer = $('particles');
    if (!particlesContainer) return;

    const particleCount = 50;

    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';

      const x = Math.random() * 100;
      const y = Math.random() * 100;
      const size = Math.random() * 3 + 1;
      const duration = Math.random() * 20 + 10;
      const delay = Math.random() * 5;

      particle.style.cssText = `
        position: absolute;
        left: ${x}%;
        top: ${y}%;
        width: ${size}px;
        height: ${size}px;
        background: radial-gradient(circle, rgba(102, 126, 234, 0.8) 0%, transparent 70%);
        border-radius: 50%;
        animation: float ${duration}s ease-in-out ${delay}s infinite;
        pointer-events: none;
      `;

      particlesContainer.appendChild(particle);
    }

    const style = document.createElement('style');
    style.textContent = `
      @keyframes float {
        0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.3; }
        25% { transform: translate(10px, -20px) scale(1.1); opacity: 0.6; }
        50% { transform: translate(-10px, -40px) scale(0.9); opacity: 0.4; }
        75% { transform: translate(15px, -20px) scale(1.05); opacity: 0.5; }
      }
    `;
    document.head.appendChild(style);
  }

  // ============================================================================
  // SMOOTH SCROLLING
  // ============================================================================

  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (href === '#') return;

        e.preventDefault();
        const target = document.querySelector(href);

        if (target) {
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
        }
      });
    });
  }

  // ============================================================================
  // SCROLL ANIMATIONS
  // ============================================================================

  function initScrollAnimations() {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -100px 0px',
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
        }
      });
    }, observerOptions);

    document.querySelectorAll('.feature-card').forEach((card, index) => {
      card.style.opacity = '0';
      card.style.transform = 'translateY(30px)';
      card.style.transition = `all 0.6s ease ${index * 0.1}s`;
      observer.observe(card);
    });

    const archElements = document.querySelectorAll('.architecture-text, .architecture-visual');
    archElements.forEach((el, index) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(30px)';
      el.style.transition = `all 0.8s ease ${index * 0.2}s`;
      observer.observe(el);
    });
  }

  // ============================================================================
  // NAVBAR SCROLL EFFECT
  // ============================================================================

  function initNavbarScroll() {
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;

    let lastScroll = 0;

    window.addEventListener('scroll', () => {
      const currentScroll = window.pageYOffset;

      if (currentScroll > 100) {
        navbar.style.background = 'rgba(10, 14, 39, 0.9)';
        navbar.style.backdropFilter = 'blur(10px)';
        navbar.style.borderBottom = '1px solid rgba(255, 255, 255, 0.1)';
      } else {
        navbar.style.background = 'transparent';
        navbar.style.backdropFilter = 'none';
        navbar.style.borderBottom = 'none';
      }

      lastScroll = currentScroll;
    });
  }

  // ============================================================================
  // INTERACTIVE DIAGRAM
  // ============================================================================

  function initDiagram() {
    const nodes = document.querySelectorAll('.diagram-node');

    nodes.forEach((node) => {
      node.addEventListener('mouseenter', () => {
        node.style.boxShadow = '0 0 30px rgba(102, 126, 234, 0.6)';
      });

      node.addEventListener('mouseleave', () => {
        node.style.boxShadow = 'none';
      });
    });
  }

  // ============================================================================
  // STATS COUNTER ANIMATION
  // ============================================================================

  function animateStats() {
    const stats = document.querySelectorAll('.stat-value');

    const observerOptions = {
      threshold: 0.5,
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !entry.target.classList.contains('counted')) {
          entry.target.classList.add('counted');

          const text = entry.target.textContent;
          if (text === 'Live') return;

          const target = parseInt(text.replace('+', ''));
          const hasPlus = text.includes('+');
          let current = 0;
          const increment = target / 30;
          const duration = 1000;
          const stepTime = duration / 30;

          const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
              entry.target.textContent = target + (hasPlus ? '+' : '');
              clearInterval(timer);
            } else {
              entry.target.textContent = Math.floor(current) + (hasPlus ? '+' : '');
            }
          }, stepTime);
        }
      });
    }, observerOptions);

    stats.forEach((stat) => observer.observe(stat));
  }

  // ============================================================================
  // MOUSE PARALLAX EFFECT
  // ============================================================================

  function initParallax() {
    const hero = document.querySelector('.hero');
    if (!hero) return;

    hero.addEventListener('mousemove', (e) => {
      const { clientX, clientY } = e;
      const { innerWidth, innerHeight } = window;

      const xPos = (clientX / innerWidth - 0.5) * 20;
      const yPos = (clientY / innerHeight - 0.5) * 20;

      const particles = $('particles');
      if (particles) {
        particles.style.transform = `translate(${xPos}px, ${yPos}px)`;
      }
    });
  }

  // ============================================================================
  // SENSOR CONFIG & POLLING
  // ============================================================================

  async function loadSensors() {
    try {
      const response = await fetch('/api/sensors/meta');
      if (response.ok) {
        Landing.sensorConfig = await response.json();
        for (const [id, sensor] of Object.entries(Landing.sensorConfig)) {
          if (sensor.target_card) {
            const container = $(`sensors-${sensor.target_card}`);
            if (container) {
              const el = document.createElement('div');
              el.className = 'card-status';
              el.id = `sensor-display-${id}`;
              el.innerHTML = `<span class="status-label">${sensor.name}:</span> <span class="status-value highlight" style="font-weight: bold;">-- ${sensor.unit}</span>`;
              container.appendChild(el);
            }
          }
        }
      }
    } catch (e) {
      console.error('Failed to load sensors meta', e);
    }
  }

  async function refreshSensors() {
    const devices = [...new Set(Object.values(Landing.sensorConfig).map((s) => s.device))];
    for (const device of devices) {
      try {
        const response = await fetch(`/api/device_state/${device}`);
        if (response.ok) {
          const data = await response.json();
          const state = data.body || data;

          for (const [id, sensor] of Object.entries(Landing.sensorConfig)) {
            if (sensor.device === device) {
              const el = $(`sensor-display-${id}`);
              if (el) {
                let val = state;
                const parts = sensor.state_path.split('.');
                for (const p of parts) {
                  if (val === undefined || val === null) break;
                  val = val[p];
                }
                const valueSpan = el.querySelector('.status-value');
                if (valueSpan) {
                  valueSpan.textContent = val !== undefined && val !== null
                    ? `${Number(val).toFixed(1)} ${sensor.unit}`
                    : `-- ${sensor.unit}`;
                }
              }
            }
          }
        }
      } catch (e) {
        // Silent fail for sensor refresh
      }
    }
  }

  // ============================================================================
  // SCENARIO CONTROLS
  // ============================================================================

  async function loadScenarios() {
    const mainContainer = $('scenarios-container');
    const allContainers = document.querySelectorAll('.card-scenarios');

    if (mainContainer) mainContainer.innerHTML = '';
    allContainers.forEach((c) => {
      if (c) c.innerHTML = '';
    });

    try {
      const response = await fetch('/api/scenarios');
      if (!response.ok) throw new Error('Failed to load scenarios');

      const data = await response.json();

      if (data.scenarios && Object.keys(data.scenarios).length > 0) {
        for (const [key, scenario] of Object.entries(data.scenarios)) {
          const cardBlock = createScenarioCard(key, scenario);
          let targetEl = mainContainer;

          if (scenario.target_card) {
            const cardEl = $(`scenarios-${scenario.target_card}`);
            if (cardEl) targetEl = cardEl;
          }

          if (targetEl) targetEl.appendChild(cardBlock);
        }
      } else {
        if (mainContainer) {
          mainContainer.innerHTML = '<div class="loading-spinner">Keine Szenarien verfügbar</div>';
        }
      }
    } catch (error) {
      console.error('Error loading scenarios:', error);
      if (mainContainer) {
        mainContainer.innerHTML = '<div class="loading-spinner">Fehler beim Laden</div>';
      }
    }
  }

  function createScenarioCard(key, scenario) {
    const card = document.createElement('div');
    card.className = 'scenario-card';

    const header = document.createElement('div');
    header.className = 'scenario-card-header';

    const name = document.createElement('div');
    name.className = 'scenario-name';
    name.textContent = scenario.name;
    header.appendChild(name);

    const buttons = document.createElement('div');
    buttons.className = 'scenario-buttons';

    if (scenario.states && scenario.states.length > 0) {
      scenario.states.forEach((state) => {
        const btn = document.createElement('button');
        btn.className = 'scenario-state-btn';
        btn.textContent = state.name;
        btn.title = state.description || '';
        btn.onclick = () => executeScenario(key, state.id, state.name, btn);
        buttons.appendChild(btn);
      });
    } else {
      const btn = document.createElement('button');
      btn.className = 'scenario-state-btn';
      btn.textContent = 'Ausführen';
      btn.title = scenario.description || '';
      btn.onclick = () => executeScenario(key, 0, scenario.name, btn);
      buttons.appendChild(btn);
    }

    card.appendChild(header);
    card.appendChild(buttons);
    return card;
  }

  async function executeScenario(scenarioName, state, stateName, buttonElement) {
    const statusBadge = $('scenario-status');
    buttonElement.disabled = true;
    const originalText = buttonElement.textContent;
    buttonElement.textContent = stateName + ' ...';

    if (statusBadge) statusBadge.textContent = 'Ausführung...';

    try {
      const response = await fetch('/api/scenario/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: scenarioName, state: state }),
      });

      let result;
      try {
        result = await response.json();
      } catch (e) {
        result = {};
      }

      if (!response.ok) {
        throw new Error(result.error || 'Request failed');
      }

      if (result.success || result.host_response) {
        buttonElement.textContent = stateName + ' ✓';
        if (statusBadge) statusBadge.textContent = 'Erfolgreich';
        showNotification(`Szenario "${stateName}" erfolgreich ausgeführt`, 'success');

        setTimeout(() => {
          refreshAllStatus();
          buttonElement.textContent = originalText;
          buttonElement.disabled = false;
          if (statusBadge) statusBadge.textContent = 'Bereit';
        }, 2000);
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Scenario execution error:', error);
      buttonElement.textContent = stateName + ' ✗';
      if (statusBadge) statusBadge.textContent = 'Fehler';
      showNotification(`Fehler: ${error.message}`, 'error');

      setTimeout(() => {
        buttonElement.textContent = originalText;
        buttonElement.disabled = false;
        if (statusBadge) statusBadge.textContent = 'Bereit';
      }, 2000);
    }
  }

  // ============================================================================
  // RELAY CONTROLS
  // ============================================================================

  const RELAY_MAPPING = {
    esp1: {
      0: 'gas-controls',
      1: 'gas-controls',
      2: 'gas-controls',
      3: 'gas-controls',
      4: 'gas-controls',
      5: 'gas-controls',
      6: 'gas-controls',
      7: 'reserve-controls',
    },
    esp2: {
      0: 'coal-controls',
      1: 'coal-controls',
      2: 'coal-controls',
      3: 'coal-controls',
    },
    esp4: {
      0: 'electro-controls',
      1: 'electro-controls',
      2: 'electro-controls',
      3: 'electro-controls',
      4: 'electro-controls',
      5: 'electro-controls',
      6: 'wind-controls',
      7: 'wind-controls',
    },
    esp3: {
      0: 'lake-controls',
      1: 'lake-controls',
      2: 'lake-controls',
      3: 'lake-controls',
    },
  };

  async function loadRelays() {
    const containers = [
      'coal-controls',
      'gas-controls',
      'electro-controls',
      'lake-controls',
      'wind-controls',
      'train-controls',
      'reserve-controls',
    ];

    containers.forEach((id) => {
      const el = $(id);
      if (el) el.innerHTML = '<div class="loading-spinner">Lade...</div>';
    });

    await Promise.all([
      loadAndDistributeESP1(),
      loadAndDistributeESP2(),
      loadAndDistributeESP3(),
      loadAndDistributeESP4(),
    ]);

    containers.forEach((id) => {
      const el = $(id);
      if (el) {
        const spinner = el.querySelector('.loading-spinner');
        if (spinner) spinner.remove();
      }
    });
  }

  async function loadAndDistributeESP1() {
    try {
      const [metaResp, stateResp] = await Promise.all([
        fetch('/api/device_meta/esp1'),
        fetch('/api/device_state/esp1'),
      ]);

      if (!metaResp.ok || !stateResp.ok) return;

      const metaData = await metaResp.json();
      const stateData = await stateResp.json();

      const meta = metaData.body || metaData;
      const state = stateData.body || stateData;

      if (meta && meta.names) {
        for (let i = 0; i < meta.count; i++) {
          const name = meta.names[i] || `Relay ${i}`;
          const val = state[`r${i}`] || 0;

          const item = createRelayItem('esp1', i, name, val);

          const targetId = RELAY_MAPPING.esp1[i] || 'reserve-controls';
          const targetContainer = $(targetId);
          if (targetContainer) {
            const spinner = targetContainer.querySelector('.loading-spinner');
            if (spinner) spinner.remove();
            targetContainer.appendChild(item);
          }
        }
      }
    } catch (e) {
      console.error('Error loading ESP1:', e);
    }
  }

  async function loadAndDistributeESP2() {
    try {
      const [metaResp, stateResp] = await Promise.all([
        fetch('/api/device_meta/esp2'),
        fetch('/api/device_state/esp2'),
      ]);

      if (!metaResp.ok || !stateResp.ok) return;

      const metaData = await metaResp.json();
      const stateData = await stateResp.json();

      const meta = metaData.body || metaData;
      const state = stateData.body || stateData;

      if (meta && meta.names) {
        for (let i = 0; i < meta.count; i++) {
          const name = meta.names[i] || `Relay ${i}`;
          const val = state[`r${i}`] || 0;

          const item = createRelayItem('esp2', i, name, val);

          const targetId = RELAY_MAPPING.esp2[i] || 'reserve-controls';
          const targetContainer = $(targetId);
          if (targetContainer) {
            const spinner = targetContainer.querySelector('.loading-spinner');
            if (spinner) spinner.remove();
            targetContainer.appendChild(item);
          }
        }
      }
    } catch (e) {
      console.error('Error loading ESP2:', e);
    }
  }

  async function loadAndDistributeESP3() {
    try {
      const [metaResp, stateResp] = await Promise.all([
        fetch('/api/device_meta/esp3'),
        fetch('/api/device_state/esp3'),
      ]);

      if (!metaResp.ok || !stateResp.ok) return;

      const metaData = await metaResp.json();
      const stateData = await stateResp.json();

      const meta = metaData.body || metaData;
      const state = stateData.body || stateData;

      if (meta && meta.names) {
        for (let i = 0; i < meta.count; i++) {
          const name = meta.names[i] || `Relay ${i}`;
          const val = state.relays && state.relays[i] ? state.relays[i] : 0;

          const item = createRelayItem('esp3', i, name, val);

          const targetId = RELAY_MAPPING.esp3 && RELAY_MAPPING.esp3[i] ? RELAY_MAPPING.esp3[i] : 'reserve-controls';
          const targetContainer = $(targetId);
          if (targetContainer) {
            const spinner = targetContainer.querySelector('.loading-spinner');
            if (spinner) spinner.remove();
            targetContainer.appendChild(item);
          }
        }
      }
    } catch (e) {
      console.error('Error loading ESP3:', e);
    }
  }

  async function loadAndDistributeESP4() {
    try {
      const [metaResp, stateResp] = await Promise.all([
        fetch('/api/device_meta/esp4'),
        fetch('/api/device_state/esp4'),
      ]);

      if (!metaResp.ok || !stateResp.ok) return;

      const metaData = await metaResp.json();
      const stateData = await stateResp.json();

      const meta = metaData.body || metaData;
      const state = stateData.body || stateData;

      if (meta && meta.names) {
        for (let i = 0; i < meta.count; i++) {
          const name = meta.names[i] || `Relay ${i}`;
          const val = state.relays && state.relays[i] ? state.relays[i] : 0;

          const item = createRelayItem('esp4', i, name, val);

          const targetId = RELAY_MAPPING.esp4 && RELAY_MAPPING.esp4[i] ? RELAY_MAPPING.esp4[i] : 'reserve-controls';
          const targetContainer = $(targetId);
          if (targetContainer) {
            const spinner = targetContainer.querySelector('.loading-spinner');
            if (spinner) spinner.remove();
            targetContainer.appendChild(item);
          }
        }
      }
    } catch (e) {
      console.error('Error loading ESP4:', e);
    }
  }

  function createRelayItem(device, idx, name, state) {
    const item = document.createElement('div');
    item.className = 'relay-item';

    const info = document.createElement('div');
    info.className = 'relay-info';

    const nameEl = document.createElement('div');
    nameEl.className = 'relay-name';
    nameEl.textContent = name;

    info.appendChild(nameEl);

    const toggle = document.createElement('label');
    toggle.className = 'toggle-switch';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = `${device}-${idx}`;
    input.checked = state === 1;
    input.onchange = () => toggleRelay(device, idx, input.checked ? 1 : 0, input);

    const slider = document.createElement('span');
    slider.className = 'toggle-slider';

    toggle.appendChild(input);
    toggle.appendChild(slider);

    item.appendChild(info);
    item.appendChild(toggle);

    return item;
  }

  async function toggleRelay(device, idx, val, inputElement) {
    const requestKey = 'relay-' + device + '-' + idx;
    if (!tryStartRequest(requestKey)) {
      inputElement.checked = !inputElement.checked;
      return;
    }

    inputElement.disabled = true;

    try {
      const response = await fetch('/api/relay/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device, idx, val: val }),
      });

      if (!response.ok) throw new Error('Request failed');

      showNotification('Schalten erfolgreich', 'success');

      setTimeout(() => {
        inputElement.disabled = false;
      }, 200);
    } catch (error) {
      console.error('Relay toggle error:', error);
      inputElement.checked = !inputElement.checked;
      inputElement.disabled = false;
      showNotification('Fehler beim Schalten', 'error');
    } finally {
      endRequest(requestKey);
    }
  }

  function toggleReserveSection() {
    const container = $('reserve-controls-container');
    const icon = $('reserve-toggle-icon');

    if (container) {
      if (container.style.display === 'none') {
        container.style.display = 'block';
        if (icon) icon.textContent = '▲';
      } else {
        container.style.display = 'none';
        if (icon) icon.textContent = '▼';
      }
    }
  }

  // ============================================================================
  // WIND & TRAIN CONTROLS
  // ============================================================================

  function initWindTrainControls() {
    refreshWindTrainStatus();
  }

  async function setWind(val) {
    try {
      const response = await fetch('/api/esp3/set_wind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ val: val }),
      });

      if (!response.ok) throw new Error('Request failed');

      showNotification(`Wind ${val ? 'eingeschaltet' : 'ausgeschaltet'}`, 'success');
      setTimeout(refreshWindTrainStatus, 200);
    } catch (error) {
      console.error('Wind control error:', error);
      showNotification('Fehler bei Wind-Steuerung', 'error');
    }
  }

  async function updateTrainPWM(value) {
    const display = $('pwm-display');
    if (display) display.textContent = value;

    try {
      await fetch('/api/esp3/set_pwm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pwm: parseInt(value) }),
      });
    } catch (error) {
      console.error('Train PWM error:', error);
    }
  }

  async function stopTrain() {
    const slider = $('train-slider');
    const display = $('pwm-display');

    try {
      await fetch('/api/esp3/set_pwm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pwm: 0 }),
      });

      if (slider) slider.value = 0;
      if (display) display.textContent = '0';
      showNotification('Zug gestoppt', 'success');
    } catch (error) {
      console.error('Train stop error:', error);
      showNotification('Fehler beim Stoppen', 'error');
    }
  }

  // ============================================================================
  // STATUS UPDATES
  // ============================================================================

  async function refreshWindTrainStatus() {
    try {
      const response = await fetch('/api/esp3/state');
      if (!response.ok) return;

      const data = await response.json();
      const state = data.body || data;

      const windDisplay = $('wind-display');
      const windStatus = $('wind-status');
      const pwmDisplay = $('pwm-display');
      const trainPwm = $('train-pwm');
      const slider = $('train-slider');

      if (state.running !== undefined) {
        const windText = state.running ? 'AN' : 'AUS';
        if (windDisplay) windDisplay.textContent = windText;
        if (windStatus) windStatus.textContent = windText;
      }

      if (state.pwm !== undefined) {
        if (pwmDisplay) pwmDisplay.textContent = state.pwm;
        if (trainPwm) trainPwm.textContent = state.pwm;
        if (slider) slider.value = state.pwm;
      }
    } catch (error) {
      console.error('Wind/Train status error:', error);
    }
  }

  async function refreshTemperatures() {
    // ESP1
    try {
      const response = await fetch('/api/device_state/esp1');
      if (response.ok) {
        const data = await response.json();
        const state = data.body || data;

        const tempEl = $('temp-esp1');
        if (tempEl && state.temp !== undefined) {
          tempEl.textContent = state.temp === null ? '--°C' : `${Number(state.temp).toFixed(1)}°C`;
        }
      }
    } catch (error) {
      console.error('ESP1 temp error:', error);
    }

    // ESP2
    try {
      const response = await fetch('/api/device_state/esp2');
      if (response.ok) {
        const data = await response.json();
        const state = data.body || data;

        const tempEl = $('temp-esp2');
        if (tempEl && state.temp !== undefined) {
          tempEl.textContent = state.temp === null ? '--°C' : `${Number(state.temp).toFixed(1)}°C`;
        }
      }
    } catch (error) {
      console.error('ESP2 temp error:', error);
    }
  }

  async function refreshAllStatus() {
    await Promise.all([
      refreshWindTrainStatus(),
      refreshTemperatures(),
      refreshSensors(),
    ]);
  }

  function startStatusPolling() {
    refreshAllStatus();

    const intervalId = setInterval(refreshAllStatus, 5000);
    Landing.intervals.push(intervalId);
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  function cleanup() {
    Landing.intervals.forEach(id => clearInterval(id));
    Landing.intervals = [];
    Landing.metaCache = {};
    Landing.pendingRequests.clear();
  }

  window.addEventListener('beforeunload', cleanup);

  // ============================================================================
  // INIT
  // ============================================================================

  // Expose functions to window
  window.loadScenarios = loadScenarios;
  window.setWind = setWind;
  window.updateTrainPWM = updateTrainPWM;
  window.stopTrain = stopTrain;
  window.toggleReserveSection = toggleReserveSection;
  window.refreshAllStatus = refreshAllStatus;
  window.cleanup = cleanup;

  document.addEventListener('DOMContentLoaded', () => {
    createParticles();
    initSmoothScroll();
    initScrollAnimations();
    initNavbarScroll();
    initDiagram();
    animateStats();
    initParallax();

    loadSensors().then(() => {
      loadScenarios();
      loadRelays();
      startStatusPolling();
    });

    console.log('Energiesystem Lausitz - Landing Page loaded');
  });

  // ============================================================================
  // PERFORMANCE OPTIMIZATION
  // ============================================================================

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.querySelectorAll('*').forEach((el) => {
      el.style.animation = 'none';
      el.style.transition = 'none';
    });
  }

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
      let mom = velocity;
      function momentum() {
        if (Math.abs(mom) < 0.5) return;
        window.scrollBy(0, mom);
        mom *= 0.92;
        animFrame = requestAnimationFrame(momentum);
      }
      animFrame = requestAnimationFrame(momentum);
    }, { passive: true });
  })();

})();
