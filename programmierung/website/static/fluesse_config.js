/**
 * fluesse_config.js
 * Contains all configuration and state data for the energy flow diagram.
 */

// Node details for modal
const nodeDetails = {
  coal: {
    subtitle: "Kraftwerk",
    description:
      "Das Kohlekraftwerk ist eine traditionelle Energieerzeugungsanlage, die Kohle zur Stromproduktion verwendet. Es verfügt über mehrere Relais zur Steuerung der Verbrennungsprozesse, Kühlung und Turbine.",
    states: {
      off: { label: "Aus", icon: "🏭" },
      idle: { label: "Bereit", icon: "🏭" },
      on: { label: "Betrieb", icon: "🏭🔥" },
      error: { label: "Störung", icon: "🏭⚠️" },
    },
    currentState: "off",
    scenarios: [
      { id: "kohlekraftwerk_startup", name: "Starten", desc: "Kraftwerk hochfahren" },
      { id: "kohlekraftwerk_shutdown", name: "Stoppen", desc: "Kraftwerk herunterfahren" },
      { id: "notaus", name: "Not-Aus", desc: "Sofortige Abschaltung" },
    ],
  },
  village: {
    subtitle: "Wohngebiet",
    description:
      "Das Dorf repräsentiert den lokalen Energieverbrauch. Hier werden Haushalte mit Strom und Wärme versorgt. Der Energiebedarf variiert je nach Tageszeit und Jahreszeit.",
    states: {
      off: { label: "Kein Bedarf", icon: "🏘️" },
      idle: { label: "Normal", icon: "🏘️" },
      on: { label: "Hochlast", icon: "🏘️⚡" },
      error: { label: "Störung", icon: "🏘️⚠️" },
    },
    currentState: "idle",
    scenarios: [
      { id: "village_day", name: "Tagmodus", desc: "Normaler Verbrauch" },
      { id: "village_night", name: "Nachtmodus", desc: "Reduzierter Verbrauch" },
      { id: "village_peak", name: "Spitzenlast", desc: "Maximaler Bedarf" },
    ],
  },
  solar: {
    subtitle: "Photovoltaik",
    description:
      "Die Solarenergieanlage wandelt Sonnenlicht direkt in elektrische Energie um. Die Leistung ist stark abhängig von der Sonneneinstrahlung und Wetterbedingungen.",
    states: {
      off: { label: "Inaktiv", icon: "☀️" },
      idle: { label: "Bereit", icon: "☀️" },
      on: { label: "Produktion", icon: "☀️⚡" },
      error: { label: "Störung", icon: "☀️⚠️" },
    },
    currentState: "idle",
    scenarios: [
      { id: "solar_an", name: "Einschalten", desc: "Produktion starten" },
      { id: "solar_aus", name: "Ausschalten", desc: "Produktion stoppen" },
    ],
  },
  wind: {
    subtitle: "Windkraft",
    description:
      "Die Windkraftanlage nutzt die Windenergie zur Stromerzeugung. Die Leistung ist abhängig von der Windgeschwindigkeit und kann stark schwanken.",
    states: {
      off: { label: "Still", icon: "🌬️" },
      idle: { label: "Leerlauf", icon: "🌬️" },
      on: { label: "Produktion", icon: "🌬️⚡" },
      error: { label: "Störung", icon: "🌬️⚠️" },
    },
    currentState: "idle",
    scenarios: [
      { id: "wind_an", name: "Starten", desc: "Turbine hochfahren" },
      { id: "wind_aus", name: "Stoppen", desc: "Bremse aktivieren" },
    ],
  },
  gridNode: {
    subtitle: "Verteilung",
    description:
      "Der Netzknoten ist das Herz der Energieverteilung. Hier werden alle Energieflüsse zusammengeführt und an die Verbraucher verteilt.",
    states: {
      off: { label: "Aus", icon: "⚡" },
      idle: { label: "Bereit", icon: "⚡" },
      on: { label: "Aktiv", icon: "⚡🔋" },
      error: { label: "Störung", icon: "⚡⚠️" },
    },
    currentState: "on",
    scenarios: [
      { id: "notaus", name: "Notaus (Global)", desc: "Systemweiter Notstopp" },
    ],
  },
  external: {
    subtitle: "Übertragung",
    description:
      "Der Stromnetzanschluss verbindet das lokale Energiesystem mit dem überregionalen Stromnetz. Überschüssige Energie kann eingespeist oder bezogen werden.",
    states: {
      off: { label: "Getrennt", icon: "🔌" },
      idle: { label: "Bereit", icon: "🔌" },
      on: { label: "Verbunden", icon: "🔌⚡" },
      error: { label: "Störung", icon: "🔌⚠️" },
    },
    currentState: "off",
    scenarios: [
      { id: "grid_import", name: "Beziehen", desc: "Energie aus Netz laden" },
      { id: "grid_export", name: "Einspeisen", desc: "Überschuss abgeben" },
      { id: "grid_off", name: "Inselbetrieb", desc: "Vom Netz trennen" },
    ],
  },
  gas: {
    subtitle: "Kraftwerk",
    description:
      "Das Gaskraftwerk nutzt Erdgas zur Stromerzeugung. Es ist flexibel und kann schnell hoch- und heruntergefahren werden.",
    states: {
      off: { label: "Aus", icon: "🔥" },
      idle: { label: "Bereit", icon: "🔥" },
      on: { label: "Betrieb", icon: "🔥⚡" },
      error: { label: "Störung", icon: "🔥⚠️" },
    },
    currentState: "off",
    scenarios: [
      { id: "gas_an", name: "Zünden", desc: "Kraftwerk starten" },
      { id: "gas_aus", name: "Abstellen", desc: "Kraftwerk stoppen" },
      { id: "notaus", name: "Not-Aus", desc: "Sofortige Abschaltung" },
    ],
  },
  elektro: {
    subtitle: "Wasserstoff",
    description:
      "Die Elektrolyseanlage erzeugt Wasserstoff durch Spaltung von Wasser mittels elektrischer Energie. Im Brennstoffzellen-Modus wird Wasserstoff zur Stromerzeugung genutzt.",
    states: {
      off: { label: "Aus", icon: "⚗️" },
      idle: { label: "Bereit", icon: "⚗️" },
      on: { label: "Elektrolyse", icon: "⚗️💧" },
      on_fuelcell: { label: "Brennstoffzelle", icon: "🔋⚡" },
      error: { label: "Störung", icon: "⚗️⚠️" },
    },
    currentState: "off",
    scenarios: [
      { id: "elektrolyseur_an", name: "Starten", desc: "H2 Produktion beginnen" },
      { id: "elektrolyseur_komplett_aus", name: "Stoppen", desc: "System abschalten" },
      { id: "elektrolyseur_in_tank", name: "Abfüllen", desc: "H2 in Tank speichern" },
      { id: "tank_in_brennstoffzelle", name: "H2 nutzen", desc: "Strom aus H2 gewinnen" },
    ],
  },
  heatpump: {
    subtitle: "Heizung",
    description:
      "Die Wärmepumpe nutzt Umweltwärme zur Erzeugung von Heizwärme. Sie ist eine effiziente Methode zur Gebäudeheizung.",
    states: {
      off: { label: "Aus", icon: "🌡️" },
      idle: { label: "Standby", icon: "🌡️" },
      on: { label: "Heizen", icon: "🌡️🔥" },
      error: { label: "Störung", icon: "🌡️⚠️" },
    },
    currentState: "idle",
    scenarios: [
      { id: "heatpump_an", name: "Heizen", desc: "Wärmepumpe starten" },
      { id: "heatpump_aus", name: "Stoppen", desc: "Wärmepumpe abschalten" },
    ],
  },
};

// Icons for each node type
const nodeIcons = {
  coal: "🏭",
  village: "🏘️",
  solar: "☀️",
  wind: "🌬️",
  gridNode: "⚡",
  external: "🔌",
  gas: "🔥",
  elektro: "⚗️",
  heatpump: "🌡️",
};

// CSS class suffix for each node
const nodeClasses = {
  coal: "node-coal",
  village: "node-village",
  solar: "node-solar",
  wind: "node-wind",
  gridNode: "node-gridNode",
  external: "node-external",
  gas: "node-gas",
  elektro: "node-elektro",
  heatpump: "node-heatpump",
};

const nodes = {
  coal: { label: "Kohlekraftwerk", x: 0.1, y: 0.5, visible: true },
  village: { label: "Dorf", x: 0.38, y: 0.55, visible: true },
  solar: { label: "Solar", x: 0.52, y: 0.58, visible: true },
  wind: { label: "Windrad", x: 0.63, y: 0.64, visible: true },
  gridNode: { label: "Netzknoten", x: 0.68, y: 0.5, visible: true },
  external: { label: "Netzanschluss", x: 0.68, y: 0.18, visible: true },
  gas: { label: "Gaskraftwerk", x: 0.88, y: 0.3, visible: true },
  elektro: { label: "Elektrolyse", x: 0.42, y: 0.82, visible: true },
  heatpump: { label: "Wärmepumpe", x: 0.68, y: 0.88, visible: true },

  r_coal_bend: { x: 0.2, y: 0.5 },
  r_coal_bend2: { x: 0.28, y: 0.36 },
  r_coal_bend3: { x: 0.35, y: 0.36 },
  r_coal_bend4: { x: 0.42, y: 0.45 },
  r_coal_bend5: { x: 0.42, y: 0.72 },
  r_elctro_coal_bend: { x: 0.52, y: 0.72 },
  r_village1: { x: 0.38, y: 0.44 },
  r_village2: { x: 0.44, y: 0.38 },
  r_village3: { x: 0.64, y: 0.38 },
  r_solar1: { x: 0.58, y: 0.5 },
  r_gas_bend: { x: 0.88, y: 0.5 },
  r_elekt1: { x: 0.52, y: 0.82 },

  r_elekt2: { x: 0.55, y: 0.72 },
  r_elekt3: { x: 0.6, y: 0.55 },
};

// Node relationship configuration
const powerEdgeGroups = {
  coal: {
    colors: ["grey"],
    groupOffset: -7,
    edges: [
      { from: "coal", to: "r_coal_bend" },
      { from: "r_coal_bend", to: "r_coal_bend2" },
      { from: "r_coal_bend2", to: "r_coal_bend3" },
      { from: "r_coal_bend3", to: "r_village2" },
      { from: "r_village2", to: "r_village3" },
      { from: "r_village3", to: "gridNode" },
    ],
    flows: [false],
    revs: [false],
  },
  solar: {
    colors: ["green"],
    edges: [
      { from: "solar", to: "r_solar1" },
      { from: "r_solar1", to: "gridNode" }
    ],
    flows: [false],
    revs: [false],
  },
  wind: {
    colors: ["grey"],
    edges: [{ from: "wind", to: "gridNode" }],
    flows: [false],
    revs: [false],
  },
  gas: {
    colors: ["green"],
    edges: [
      { from: "gas", to: "r_gas_bend" },
      { from: "r_gas_bend", to: "gridNode" },
    ],
    flows: [false],
    revs: [false],
  },
  village: {
    colors: ["grey"],
    edges: [
      { from: "village", to: "r_village1" },
      { from: "r_village1", to: "r_village2" },
      { from: "r_village2", to: "r_village3" },
      { from: "r_village3", to: "gridNode" },
    ],
    flows: [false],
    revs: [false],
  },
  gridToExternal: {
    colors: ["green"],
    edges: [{ from: "gridNode", to: "external" }],
    flows: [false],
    revs: [false],
  },
  heatpump: {
    colors: ["yellow"],
    edges: [{ from: "gridNode", to: "heatpump" }],
    flows: [false],
    revs: [false],
  },
  elektro: {
    colors: ["yellow"],
    edges: [
      { from: "elektro", to: "r_elekt1" },
      { from: "r_elekt1", to: "r_elekt3" },
      { from: "r_elekt3", to: "gridNode" },
    ],
    flows: [false],
    revs: [false],
  },
};

const heatEdgeGroups = {
  coal: {
    colors: ["grey"],
    edges: [
      { from: "coal", to: "r_coal_bend" },
      { from: "r_coal_bend", to: "r_coal_bend2" },
      { from: "r_coal_bend2", to: "r_coal_bend3" },
      { from: "r_coal_bend3", to: "r_coal_bend4" },
      { from: "r_coal_bend4", to: "r_coal_bend5" },
      { from: "r_coal_bend5", to: "r_elctro_coal_bend" },
      { from: "r_elctro_coal_bend", to: "r_elekt2" },
      { from: "r_elekt2", to: "r_elekt3" },
      { from: "r_elekt3", to: "gridNode" },
    ],
    flows: [false],
    revs: [false],
  },
  solar: {
    colors: ["blue"],
    edges: [],
    flows: [false],
    revs: [false],
  },
  wind: {
    colors: ["grey"],
    edges: [],
    flows: [false],
    revs: [false],
  },
  gas: {
    colors: ["blue", "red"],
    edges: powerEdgeGroups.gas.edges,
    flows: [false],
    revs: [false],
  },
  village: {
    colors: ["grey"],
    edges: powerEdgeGroups.village.edges,
    flows: [false],
    revs: [false],
  },
  gridToExternal: {
    colors: ["blue", "red"],
    edges: powerEdgeGroups.gridToExternal.edges,
    flows: [false, false],
    revs: [false, false],
  },
  heatpump: {
    colors: ["red", "blue"],
    edges: powerEdgeGroups.heatpump.edges,
    flows: [false, false],
    revs: [false, false],
  },
  elektro: {
    colors: ["red"],
    edges: [],
    flows: [false],
    revs: [false],
  },
};

const routingNodeToGroup = {
  r_coal_bend: "coal",
  r_coal_bend2: "coal",
  r_coal_bend3: "coal",
  r_coal_bend4: "coal",
  r_coal_bend5: "coal",
  r_solar1: "solar",
  r_solar2: "solar",
  r_gas_bend: "gas",
  r_village1: "village",
  r_village2: "solar",
  r_village3: "solar",
  r_elekt1: "elektro",
  r_elekt3: "elektro",
};

const producerNodeToGroup = {
  coal: "coal",
  solar: "solar",
  wind: "wind",
  gas: "gas",
  elektro: "elektro",
};

const NODE_HALF = 40;
