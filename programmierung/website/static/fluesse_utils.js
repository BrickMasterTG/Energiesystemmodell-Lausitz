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
    const system = typeof getActiveSystem === 'function' ? getActiveSystem() : 'power';

    if (system === 'power') {
        // Coal group - single grey stripe, flows when coal is active
        const coalActive = nodeProducesEnergy("coal");
        groups.coal.flows = [coalActive];
        groups.coal.revs = [false];

        // Solar group - single stripe matching config.py
        const solarActive = nodeProducesEnergy("solar");
        if (groups.solar) {
            groups.solar.flows = [solarActive];
            groups.solar.revs = [false];
        }

        // Wind group
        const windActive = nodeProducesEnergy("wind");
        if (groups.wind) {
            groups.wind.flows = [windActive];
            groups.wind.revs = [false];
        }

        // Gas group
        const gasActive = nodeProducesEnergy("gas");
        if (groups.gas) {
            groups.gas.flows = [gasActive];
            groups.gas.revs = [false];
        }

        // Village group
        const villageActive = nodeDetails.village && nodeDetails.village.currentState === "on";
        groups.village.flows = [villageActive];
        groups.village.revs = [true]; // Consumer direction

        // Grid to external
        if (groups.gridToExternal) {
            const extState = nodeDetails.external?.currentState || "off";
            const isImport = extState === "on_import";
            const isExport = extState === "on_export";
            const active = extState === "on" || isImport || isExport;
            groups.gridToExternal.flows = [active, active];
            groups.gridToExternal.revs = (isImport || extState === "on") ? [true, false] : [false, true];
        }

        // Heatpump
        const heatpumpActive = nodeProducesEnergy("heatpump");
        if (groups.heatpump) {
            groups.heatpump.flows = [heatpumpActive];
            groups.heatpump.revs = [false];
        }

        // Elektro
        const elektroState = nodeDetails.elektro.currentState;
        const elektroActive = elektroState === "on" || elektroState === "on_fuelcell";
        if (groups.elektro) {
            groups.elektro.flows = [elektroActive];
            groups.elektro.revs = [elektroState === "on"];
        }
    } else {
        // HEAT SYSTEM LOGIC
        const coalHeat = nodeProducesEnergy("coal");
        const villageHeat = nodeDetails.village && nodeDetails.village.currentState === "on";
        const heatpumpHeat = nodeProducesEnergy("heatpump");

        // Coal -> Loop (Red: flow out, Blue: return in)
        groups.coal.flows = [coalHeat, coalHeat];
        groups.coal.revs = [false, true];

        // Loop -> Village (Supply in, Return out)
        groups.village.flows = [villageHeat, villageHeat];
        groups.village.revs = [true, false];

        // Heatpump connection (if configured in heat view)
        if (groups.heatpump) {
            groups.heatpump.flows = [heatpumpHeat];
            groups.heatpump.revs = [false];
        }

        // Grid to external connection
        if (groups.gridToExternal) {
            const extState = nodeDetails.external?.currentState || "off";
            const isImport = extState === "on_import";
            const isExport = extState === "on_export";
            const active = extState === "on" || isImport || isExport;
            groups.gridToExternal.flows = [active, active];
            groups.gridToExternal.revs = (isImport || extState === "on") ? [true, false] : [false, true];
        }

        // The Heat Loop itself
        if (groups.heatBus) {
            const gridActive = nodeDetails.gridNode && nodeDetails.gridNode.currentState === "on";
            groups.heatBus.flows = [gridActive, gridActive];
        }
    }
}
