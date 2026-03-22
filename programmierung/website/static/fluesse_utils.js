/**
 * fluesse_utils.js
 * Contains helper functions for coordinate calculations and state lookups.
 */

function clipToNode(cx, cy, ox, oy) {
    const dx = cx - ox,
      dy = cy - oy;
    const adx = Math.abs(dx),
      ady = Math.abs(dy);
    let t = adx >= ady ? (adx - NODE_HALF) / adx : (ady - NODE_HALF) / ady;
    t = Math.max(0, Math.min(1, t));
    return { x: ox + dx * t, y: oy + dy * t };
}

// Helper: Check if a node produces energy (on state or fuel cell mode)
function nodeProducesEnergy(nodeId) {
    const details = nodeDetails[nodeId];
    if (!details) return false;
    return details.currentState === "on" || details.currentState === "on_fuelcell";
}

// Get the edge group for a node (producer or routing node)
function getGroupForNode(nodeId) {
    if (producerNodeToGroup[nodeId]) return producerNodeToGroup[nodeId];
    if (routingNodeToGroup[nodeId]) return routingNodeToGroup[nodeId];
    return null;
}

// Update edge group state based on node states
// Each color stripe can be controlled independently
function updateEdgeGroupStates() {
    const groups = getEdgeGroups();
  
    // Coal group - single grey stripe, flows when coal is active
    const coalActive = nodeProducesEnergy("coal");
    groups.coal.flows = [coalActive];
    groups.coal.revs = [false];
  
    // Solar group - single stripe matching config.py
    const solarActive = nodeProducesEnergy("solar");
    groups.solar.flows = [solarActive];
    groups.solar.revs = [false]; // Producer: solar -> grid
  
    // Wind group - single stripe matching config.py
    const windActive = nodeProducesEnergy("wind");
    groups.wind.flows = [windActive];
    groups.wind.revs = [false]; // Producer: wind -> grid
  
    // Gas group - single stripe
    const gasActive = nodeProducesEnergy("gas");
    groups.gas.flows = [gasActive];
    groups.gas.revs = [false]; // Producer: gas -> grid
  
    // Village group - simple independent toggle
    const villageActive = nodeDetails.village && nodeDetails.village.currentState === "on";
    groups.village.flows = [villageActive];
    groups.village.revs = [true]; // Consumer direction
  
    // Grid to external - both stripes follow connection state
    const externalActive = nodeDetails.external && nodeDetails.external.currentState === "on";
    groups.gridToExternal.flows = [externalActive, externalActive];
    groups.gridToExternal.revs = [false, true];
  
    // Heatpump
    const heatpumpActive = nodeProducesEnergy("heatpump");
    groups.heatpump.flows = [heatpumpActive, heatpumpActive];
    groups.heatpump.revs = [false, true];
  
    // Elektro - single stripe
    const elektroState = nodeDetails.elektro.currentState;
    const elektroActive = elektroState === "on" || elektroState === "on_fuelcell";
    groups.elektro.flows = [elektroActive];
    groups.elektro.revs = [elektroState === "on"];
}
