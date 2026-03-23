/* fluesse_modal.js — Logic for node modals with real scenario execution */

const modalOverlay = document.getElementById("modal-overlay");
const modalClose = document.getElementById("modal-close");

let currentNodeId = null;
let allScenarios = {}; // Global cache for real scenarios

// Fetch scenarios once on initialization
async function initScenarios() {
  try {
    const response = await fetch('/api/scenarios');
    const data = await response.json();
    allScenarios = data.scenarios || {};
  } catch (e) {
    console.error("Failed to load real scenarios for modal", e);
  }
}
initScenarios();

function openModal(nodeId) {
  const details = nodeDetails[nodeId];
  if (!details) return;

  currentNodeId = nodeId;
  updateModalState(nodeId);

  // Show modal
  modalOverlay.classList.add("active");
  document.body.style.overflow = "hidden";
}

function updateModalState(nodeId) {
  if (currentNodeId !== nodeId) return;
  const details = nodeDetails[nodeId];
  if (!details) return;

  const currentState = details.currentState || "off";
  const stateInfo = details.states?.[currentState] || { label: "Unbekannt", icon: "⬡" };

  // Fill modal content
  document.getElementById("modal-icon").textContent = stateInfo.icon;
  document.getElementById("modal-title").textContent = nodes[nodeId]?.label || nodeId;
  document.getElementById("modal-subtitle").textContent = details.subtitle;
  document.getElementById("modal-visual-icon").textContent = stateInfo.icon;
  document.getElementById("modal-visual-label").textContent = nodes[nodeId]?.label || nodeId;
  document.getElementById("modal-description").textContent = details.description;

  // Update state indicator
  const stateDot = document.getElementById("state-dot");
  const stateLabel = document.getElementById("state-label");
  stateDot.className = "state-dot " + currentState;
  stateLabel.textContent = stateInfo.label;

  // Update visual glow
  const visualIcon = document.getElementById("modal-visual-icon");
  visualIcon.classList.remove("active-glow", "warning-glow", "error-glow");
  if (currentState === "on" || currentState === "on_fuelcell") visualIcon.classList.add("active-glow");
  else if (currentState === "idle") visualIcon.classList.add("warning-glow");
  else if (currentState === "error") visualIcon.classList.add("error-glow");

  // Filter real scenarios for this component
  const scenarioContainer = document.getElementById("scenario-buttons");
  scenarioContainer.innerHTML = "";

  // Mapping from fluesse nodeId to scenarios target_card
  const mapping = { 'elektro': 'electro', 'heatpump': 'lake' };
  const targetCard = mapping[nodeId] || nodeId;

  // Find scenarios matching this card
  const cardScenarios = Object.entries(allScenarios).filter(([key, sc]) => sc.target_card === targetCard);
  
  // Also include "notaus" for specific nodes if relevant
  if (["gridNode", "coal", "gas", "elektro"].includes(nodeId)) {
     if (allScenarios["notaus"]) cardScenarios.push(["notaus", allScenarios["notaus"]]);
  }

  if (cardScenarios.length > 0) {
    cardScenarios.forEach(([key, scenario]) => {
      const btn = document.createElement("button");
      btn.className = "scenario-btn";
      const desc = scenario.description || "Systemaktion ausführen";
      btn.innerHTML = `<span class="scenario-name">${scenario.name}</span><span class="scenario-desc">${desc}</span>`;
      btn.onclick = () => runScenario(key);
      scenarioContainer.appendChild(btn);
    });
  } else {
    scenarioContainer.innerHTML = '<p style="color: rgba(255,255,255,0.4); text-align: center; font-size: 0.9rem;">Keine spezifischen Szenarien für diese Komponente.</p>';
  }

  // State buttons (usually manual logic)
  const stateButtonsContainer = document.getElementById("state-buttons");
  stateButtonsContainer.innerHTML = "";
  if (details.states) {
    Object.keys(details.states).forEach((stateKey) => {
      const btn = document.createElement("button");
      btn.className = "state-btn" + (stateKey === currentState ? " active" : "");
      btn.textContent = details.states[stateKey].label;
      btn.onclick = () => setNodeState(nodeId, stateKey);
      stateButtonsContainer.appendChild(btn);
    });
  }
}

async function runScenario(scenarioKey) {
  if (!currentNodeId) return;
  const scenarioName = allScenarios[scenarioKey]?.name || scenarioKey;

  // Visual feedback on the button? For now just execute.
  console.log(`Executing real scenario: ${scenarioKey} for node ${currentNodeId}`);

  try {
    const response = await fetch('/api/scenario/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario: scenarioKey, state: 0 }),
    });

    if (response.ok) {
       // Visual state update based on naming conventions
       const sid = scenarioKey.toLowerCase();
       if (sid === "tank_in_brennstoffzelle") {
           nodeDetails[currentNodeId].currentState = "on_fuelcell";
       } else if (sid.includes("import")) {
           nodeDetails[currentNodeId].currentState = "on_import";
       } else if (sid.includes("export")) {
           nodeDetails[currentNodeId].currentState = "on_export";
       } else if (sid.includes("startup") || sid.includes("_an") || sid.includes("on") || sid.includes("start")) {
           nodeDetails[currentNodeId].currentState = "on";
       } else if (sid.includes("shutdown") || sid.includes("_aus") || sid.includes("off") || sid.includes("stop") || sid.includes("notaus")) {
           nodeDetails[currentNodeId].currentState = "off";
       }

       updateModalState(currentNodeId);
       if (window.draw) window.draw(); // Redraw flow diagram

       if (window.showNotification) window.showNotification(`Szenario "${scenarioName}" erfolgreich`, 'success');
    }
  } catch (e) {
    console.error("Scenario execution failed", e);
  }
}

function setNodeState(nodeId, newState) {
  const details = nodeDetails[nodeId];
  if (!details || !details.states) return;
  details.currentState = newState;
  updateModalState(nodeId);
  if (window.draw) window.draw();
}

function closeModal() {
  modalOverlay.classList.remove("active");
  document.body.style.overflow = "";
  currentNodeId = null;
}

if (modalClose) modalClose.addEventListener("click", closeModal);
if (modalOverlay) modalOverlay.addEventListener("click", (e) => { if (e.target === modalOverlay) closeModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

