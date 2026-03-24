/**
 * fluesse_core.js
 * Core rendering logic and initialization of the flow system.
 */

const container = document.getElementById("system");
const svg = document.getElementById("grid");

// Current active system: 'power' or 'heat'
let activeSystem = 'power';

// Get current edge groups based on active system
function getEdgeGroups() {
  return activeSystem === 'heat' ? heatEdgeGroups : powerEdgeGroups;
}

// Draw all edges for a specific group - each color stripe has independent flow control
// Updated to handle corners correctly using bisector offsets
function drawEdgeGroup(groupId, W, H) {
  const groups = getEdgeGroups();
  const group = groups[groupId];
  if (!group) return;

  const numColors = group.colors.length;
  const perStripe = numColors === 1 ? 7 : 6;
  const baseOffset = group.groupOffset || 0;

  // 1. Build a map of nodes to their edges in this group
  const nodeEdgeMap = {}; // nodeId -> [edgeIndices]
  group.edges.forEach((e, idx) => {
    if (!nodeEdgeMap[e.from]) nodeEdgeMap[e.from] = [];
    if (!nodeEdgeMap[e.to]) nodeEdgeMap[e.to] = [];
    nodeEdgeMap[e.from].push(idx);
    nodeEdgeMap[e.to].push(idx);
  });

  // helper to get segment normal
  const getNormal = (p1, p2) => {
    const dx = p2.x - p1.x, dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    return { x: -dy / len, y: dx / len };
  };

  // 2. Pre-calculate offset points for each stripe for each node
  const nodeOffsetPoints = {}; // nodeId -> stripeIndex -> {x, y}

  for (const nodeId in nodeEdgeMap) {
    const n = nodes[nodeId];
    if (!n) continue;
    
    // Base node position
    const nPos = { x: n.x * W, y: n.y * H };
    nodeOffsetPoints[nodeId] = [];

    // Find connected vectors
    const connectedEdges = nodeEdgeMap[nodeId].map(idx => group.edges[idx]);
    const vectors = connectedEdges.map(e => {
        const otherId = (e.from === nodeId) ? e.to : e.from;
        const other = nodes[otherId];
        const dx = (other.x - n.x) * W, dy = (other.y - n.y) * H;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        return { x: dx / len, y: dy / len, edge: e, otherId };
    });

    for (let i = 0; i < numColors; i++) {
      const offsetVal = baseOffset + (i - (numColors - 1) / 2) * perStripe;

      if (vectors.length === 1) {
        // Tip of a path
        const v = vectors[0];
        const norm = { x: -v.y, y: v.x };
        // if the edge starts at this node, normal is fine. 
        // if it ends here, normal is reversed? No, the math works out if we treat normals consistently.
        // Actually, let's be careful about direction.
        const actualNorm = (v.edge.from === nodeId) ? norm : { x: v.y, y: -v.x };
        nodeOffsetPoints[nodeId][i] = { x: nPos.x + actualNorm.x * offsetVal, y: nPos.y + actualNorm.y * offsetVal };
      } else if (vectors.length === 2) {
        // Corner between two segments
        const v1 = vectors[0], v2 = vectors[1];
        
        // Normals for segments (relative to nodeId moving AWAY)
        // norm1 is to the "left" of v1
        const n1 = { x: -v1.y, y: v1.x }; 
        const n2 = { x: -v2.y, y: v2.x };
        
        // The business logic: we want are "left-hand" offset lines to meet.
        // For segment 1: we offset along n1 if nodeId is 'from', or -n1 if nodeId is 'to'
        const sn1 = (v1.edge.from === nodeId) ? n1 : { x: v1.y, y: -v1.x };
        const sn2 = (v2.edge.from === nodeId) ? n2 : { x: v2.y, y: -v2.x };
        
        // Bisector direction
        const bx = (sn1.x + sn2.x), by = (sn1.y + sn2.y);
        const blen = Math.sqrt(bx * bx + by * by) || 0.001;
        const b = { x: bx / blen, y: by / blen };
        
        // Miter length: offsetVal / cos(theta/2) where theta is angle between sn1 and sn2?
        // Simpler: offsetVal / dot(b, sn1)
        const dot = b.x * sn1.x + b.y * sn1.y;
        const miterRatio = Math.abs(dot) < 0.1 ? 1 : 1 / dot;
        
        nodeOffsetPoints[nodeId][i] = { x: nPos.x + b.x * offsetVal * miterRatio, y: nPos.y + b.y * offsetVal * miterRatio };
      } else {
        // Intersection or node with 3+ connections (rare)
        nodeOffsetPoints[nodeId][i] = { x: nPos.x, y: nPos.y };
      }
    }
  }

  // 3. Draw each edge using pre-calculated points
  group.edges.forEach((e, eIdx) => {
    const n1 = nodes[e.from], n2 = nodes[e.to];
    if (!n1 || !n2) return;

    for (let i = 0; i < numColors; i++) {
      let p1 = nodeOffsetPoints[e.from][i];
      let p2 = nodeOffsetPoints[e.to][i];

      // Clipping for visible nodes (actual components)
      if (n1.visible) {
        const cx1 = n1.x * W, cy1 = n1.y * H;
        const cx2 = n2.x * W, cy2 = n2.y * H;
        const clip = clipToNode(cx1, cy1, cx2, cy2);
        const norm = getNormal({x: cx1, y: cy1}, {x: cx2, y: cy2});
        const stripeOffset = baseOffset + (i - (numColors - 1) / 2) * perStripe;
        p1 = { x: clip.x + norm.x * stripeOffset, y: clip.y + norm.y * stripeOffset };
      }
      if (n2.visible) {
        const cx1 = n1.x * W, cy1 = n1.y * H;
        const cx2 = n2.x * W, cy2 = n2.y * H;
        const clip = clipToNode(cx2, cy2, cx1, cy1);
        const norm = getNormal({x: cx1, y: cy1}, {x: cx2, y: cy2});
        const stripeOffset = baseOffset + (i - (numColors - 1) / 2) * perStripe;
        p2 = { x: clip.x + norm.x * stripeOffset, y: clip.y + norm.y * stripeOffset };
      }

      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", p1.x);
      line.setAttribute("y1", p1.y);
      line.setAttribute("x2", p2.x);
      line.setAttribute("y2", p2.y);
      line.setAttribute("stroke-width", perStripe - (numColors > 1 ? 1.5 : 0));

      let cls = "line " + (group.flows[i] ? group.colors[i] : "black");
      if (group.flows[i]) {
        cls += group.revs[i] ? " flow-rev" : " flow";
      }
      line.setAttribute("class", cls);
      svg.appendChild(line);
    }
  });
}


// Legacy function for individual edges (kept for compatibility)
function drawEdge(e, W, H) {
  const n1 = nodes[e.from],
    n2 = nodes[e.to];
  if (!n1 || !n2) return;

  const colors = Array.isArray(e.color) ? e.color : [e.color];
  const flows = Array.isArray(e.flow)
    ? e.flow
    : colors.map(() => e.flow ?? false);
  const revs = Array.isArray(e.rev) ? e.rev : colors.map(() => false);
  const N = colors.length;
  const perStripe = N === 1 ? 7 : 6;

  const cx1 = n1.x * W,
    cy1 = n1.y * H;
  const cx2 = n2.x * W,
    cy2 = n2.y * H;

  const p1 = n1.visible ? clipToNode(cx1, cy1, cx2, cy2) : { x: cx1, y: cy1 };
  const p2 = n2.visible ? clipToNode(cx2, cy2, cx1, cy1) : { x: cx2, y: cy2 };

  const dx = p2.x - p1.x,
    dy = p2.y - p1.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const px = -dy / len,
    py = dx / len;

  for (let i = 0; i < N; i++) {
    const baseOffset = e.offset || 0;
    const offset = baseOffset + (i - (N - 1) / 2) * perStripe;
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", p1.x + px * offset);
    line.setAttribute("y1", p1.y + py * offset);
    line.setAttribute("x2", p2.x + px * offset);
    line.setAttribute("y2", p2.y + py * offset);
    line.setAttribute("stroke-width", perStripe - (N > 1 ? 1.5 : 0));
    let cls = "line " + (flows[i] ? colors[i] : "black");
    if (flows[i]) cls += revs[i] ? " flow-rev" : " flow";
    line.setAttribute("class", cls);
    svg.appendChild(line);
  }
}

function renderNodes() {
  document.querySelectorAll(".node").forEach((n) => n.remove());
  for (const id in nodes) {
    const n = nodes[id];
    if (!n.visible) continue;
    const wrap = document.createElement("div");
    wrap.className = "node " + (nodeClasses[id] || "");
    wrap.style.left = n.x * 100 + "%";
    wrap.style.top = n.y * 100 + "%";
    wrap.dataset.nodeId = id;
    const vis = document.createElement("div");
    vis.className = "node-visual";
    vis.innerHTML =
      '<span class="node-icon">' + (nodeIcons[id] || "⬡") + "</span>";
    const lbl = document.createElement("div");
    lbl.className = "node-label";
    lbl.textContent = n.label || "";
    wrap.appendChild(vis);
    wrap.appendChild(lbl);

    // Click handler for modal
    wrap.addEventListener("click", () => openModal(id));

    container.appendChild(wrap);
  }
}

function draw() {
  if (!svg || !container) return;
  svg.innerHTML = "";
  const W = container.clientWidth,
    H = container.clientHeight;

  // Update group states based on node conditions
  updateEdgeGroupStates();

  // Draw all edge groups
  for (const groupId in getEdgeGroups()) {
    drawEdgeGroup(groupId, W, H);
  }

  // Sync with physical LEDs on ESP5
  syncLeds();
}

let lastSyncTime = 0;
let lastFlowState = "";

async function syncLeds() {
    const now = Date.now();
    if (now - lastSyncTime < 1000) return; // Throttle to 1Hz
    
    const groups = getEdgeGroups();
    const flows = {};
    for (const id in groups) {
      const group = groups[id];
      let flowId = id;
      
      if (id === "village") {
          flowId = (activeSystem === "heat") ? "village_heat" : "village_power";
      } else if (id === "heatpump") {
          flowId = (activeSystem === "heat") ? "heatpump_heat" : "heatpump_power";
      } else if (id === "gas") {
          flowId = (activeSystem === "heat") ? "gas_heat" : "gas_power";
      } else if (id === "gridToExternal") {
          if (activeSystem === "heat") {
              flowId = "gridToExternal_heat";
          } else {
              // Direction-aware power mapping
              flowId = group.revs[0] ? "gridToExternal_export" : "gridToExternal_import";
          }
      } else if (id === "elektro") {
          const state = nodeDetails.elektro?.currentState;
          flowId = (state === "on_fuelcell") ? "elektro_fuelcell" : "elektro_consume";
      }
      
      flows[flowId] = group.flows;
    }
    
    // Explicitly disable 'other' hardware modes for split components
    // to prevent ghosting when switching systems/modes.
    if (activeSystem === "power") {
        flows["village_heat"] = [false];
        flows["heatpump_heat"] = [false];
        flows["gridToExternal_heat"] = [false];
        flows["gas_heat"] = [false, false];
    } else {
        flows["village_power"] = [false];
        flows["heatpump_power"] = [false];
        flows["gridToExternal_import"] = [false];
        flows["gridToExternal_export"] = [false];
        flows["gas_power"] = [false];
    }
    
    // Elektrolyzer mutual exclusivity
    const eState = nodeDetails.elektro?.currentState;
    if (eState === "on_fuelcell") {
        flows["elektro_consume"] = [false];
    } else if (eState === "on") {
        // Clear BOTH segments of fuelcell mapping
        flows["elektro_fuelcell"] = [false, false];
    } else {
        flows["elektro_consume"] = [false];
        flows["elektro_fuelcell"] = [false, false];
    }
    
    // Physical house lighting (independent of flow views)
    if (typeof nodeDetails !== 'undefined' && nodeDetails.village) {
        flows["houses"] = (nodeDetails.village.currentState === "on_houses");
    }

    const stateStr = JSON.stringify(flows);
    if (stateStr === lastFlowState) return; // Only sync on change
    
    lastSyncTime = now;
    lastFlowState = stateStr;

    try {
        await fetch("/api/leds/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ flows })
        });
    } catch (e) {
        console.error("LED Sync Error:", e);
    }
}

// Switch between power and heat systems
function setActiveSystem(system) {
  if (system !== 'power' && system !== 'heat') return;
  activeSystem = system;

  // Update button active states
  const btnPower = document.getElementById('btn-power');
  const btnHeat = document.getElementById('btn-heat');
  if (btnPower && btnHeat) {
    btnPower.classList.toggle('active', system === 'power');
    btnHeat.classList.toggle('active', system === 'heat');
  }

  // Update subtitle
  const subtitle = document.querySelector('.title-bar p');
  if (subtitle) {
    subtitle.textContent = system === 'power' ? 'Stromfluss-Diagramm' : 'Wärmefluss-Diagramm';
  }

  // Update legend
  const line1 = document.getElementById('legend-line-1');
  const text1 = document.getElementById('legend-text-1');
  const line2 = document.getElementById('legend-line-2');
  const text2 = document.getElementById('legend-text-2');

  if (line1 && text1 && line2 && text2) {
    if (system === 'power') {
      line1.className = 'legend-line green';
      text1.textContent = 'Erzeugung';
      line2.className = 'legend-line yellow';
      text2.textContent = 'Verteilung';
    } else {
      line1.className = 'legend-line blue';
      text1.textContent = 'Erzeuger';
      line2.className = 'legend-line red';
      text2.textContent = 'Netz';
    }
  }

  draw();
}

function getActiveSystem() {
  return activeSystem;
}

// Utility functions to control edge groups externally

// Set all color stripes in a group to the same state
function setEdgeGroupActive(groupId, active, rev = false) {
  const groups = getEdgeGroups();
  if (!groups[groupId]) return;
  const group = groups[groupId];
  group.flows = group.colors.map(() => active);
  group.revs = group.colors.map(() => rev);
  draw();
}

// Control a specific color stripe within a group
function setEdgeGroupColorState(groupId, colorIndex, active, rev = false) {
  const groups = getEdgeGroups();
  if (!groups[groupId]) return;
  const group = groups[groupId];
  if (colorIndex < 0 || colorIndex >= group.colors.length) return;
  group.flows[colorIndex] = active;
  group.revs[colorIndex] = rev;
  draw();
}

// Set all edges inactive
function setAllEdgesInactive() {
  const groups = getEdgeGroups();
  for (const groupId in groups) {
    const group = groups[groupId];
    group.flows = group.colors.map(() => false);
    group.revs = group.colors.map(() => false);
  }
  draw();
}

// Get current state of a group (for debugging)
function getEdgeGroupState(groupId) {
  const groups = getEdgeGroups();
  if (!groups[groupId]) return null;
  const group = groups[groupId];
  return {
    colors: group.colors,
    flows: group.flows,
    revs: group.revs,
  };
}

// Initialize
if (container && svg) {
    renderNodes();
    draw();
    window.addEventListener("resize", draw);
}

/**
 * Turns off all nodes, stops animations and sends shutdown commands to hardware.
 */
async function allOff() {
    console.log("[SYSTEM] All-Off triggered");

    // 1. Update internal state for all nodes
    if (typeof nodeDetails !== 'undefined') {
        for (const id in nodeDetails) {
            nodeDetails[id].currentState = "off";
        }
    }

    // 2. Refresh UI and animations
    if (typeof updateModalState === 'function' && typeof currentNodeId !== 'undefined' && currentNodeId) {
        updateModalState(currentNodeId);
    }
    
    if (typeof draw === 'function') {
        draw();
    }

    // 3. Command Hardware
    try {
        // Execute Notaus scenario (relays off)
        fetch("/api/scenario/execute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scenario: "notaus" })
        }).catch(e => console.error("Scenario Notaus failed:", e));

        // Clear all LEDs physically
        fetch("/api/leds/test", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: "off" })
        }).catch(e => console.error("LED Off failed:", e));
        
    } catch (e) {
        console.error("Fatal All-Off hardware error:", e);
    }
}
