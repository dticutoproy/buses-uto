const map = L.map("map", {
  center: [-17.964, -67.1],
  zoom: 15,
  minZoom: 14,
  maxZoom: 18,
});

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap contributors",
}).addTo(map);

let currentRoutes = [];
let polylines = [];
let markers = [];
let allLoadedRoutes = [];
const routeCache = {};

const faculties = [
  {
    name: "Facultad Nacional de Ingeniería Sud",
    lat: -17.99007952745332,
    lng: -67.13522576093614,
    color: "#8b5cf6",
  },
  {
    name: "Facultad Nacional de Ingeniería Centro",
    lat: -17.974860148876175,
    lng: -67.1116825583938,
    color: "#8b5cf6",
  },
  {
    name: "Facultad Ciencias Económicas Financieras y Adminitrativas Centro",
    lat: -17.967532838264944,
    lng: -67.11128955546228,
    color: "#8b5cf6",
  },
  {
    name: "Facultad de Arquitectura y Urbanismo",
    lat: -17.96812110516869,
    lng: -67.11149611787678,
    color: "#8b5cf6",
  },
  {
    name: "Facultad de Derecho Ciencias Politicas y Sociales",
    lat: -17.965161039656483,
    lng: -67.10724403317757,
    color: "#8b5cf6",
  },
  {
    name: "Facultad Técnica",
    lat: -17.95393190433168,
    lng: -67.10719139049252,
    color: "#8b5cf6",
  },
  {
    name: "Facultad Ciencias Económicas Financieras y Adminitrativas Centro",
    lat: -17.955992039171235,
    lng: -67.112109936515,
    color: "#8b5cf6",
  },
  {
    name: "Facultad Ciencias de la Salud",
    lat: -17.957466419055937,
    lng: -67.12148593042657,
    color: "#8b5cf6",
  },
  {
    name: "Facultad de Ciencias Agrarias y Naturales",
    lat: -17.994066,
    lng: -67.135465,
    color: "#8b5cf6",
  },
];

// ── Detección móvil ──
const isMobile = () => window.innerWidth <= 640;

function initMobileUI() {
  if (isMobile()) {
    document.getElementById("mobileSearchBtn").style.display = "flex";
  }
}
window.addEventListener("resize", () => {
  const btn = document.getElementById("mobileSearchBtn");
  if (isMobile()) {
    btn.style.display = "flex";
  } else {
    btn.style.display = "none";
    document.getElementById("searchBox")?.classList.remove("mobile-open");
  }
});
initMobileUI();

// ── Búsqueda móvil ──
function toggleMobileSearch() {
  const box = document.getElementById("searchBox");
  box.classList.toggle("mobile-open");
  if (box.classList.contains("mobile-open")) {
    setTimeout(() => document.getElementById("searchStreet").focus(), 50);
  }
}

// ── Leyenda móvil (drawer) ──
function toggleMobileLegend() {
  document.getElementById("legendPanel").classList.toggle("visible");
}

// ── Sincronizar selección en barra móvil ──
function syncMobileRoute(routeType) {
  document.querySelectorAll(".mob-route-btn").forEach(b =>
    b.classList.toggle("selected", b.dataset.route === routeType)
  );
  document.getElementById("mobilePeriodRow").classList.add("visible");
  document.getElementById("map").classList.add("periods-visible");
}

function syncMobilePeriod(period) {
  document.querySelectorAll(".mob-period-btn").forEach(b =>
    b.classList.toggle("selected", b.dataset.period === period)
  );
}
let selectedRoute = null;
let selectedPeriod = null;

const routeColors = { route1: "#d97706", route2: "#7c3aed", route3: "#16a34a", both: "#033f86" };
const routeNames  = { route1: "Ruta 1", route2: "Ruta 2", route3: "Ruta 3", both: "Todas las rutas" };
const periodNames = { morning: "Mañana", midday: "Mediodía", evening: "Tarde", all: "Todo el día" };

// ── Panel colapsar ──
let panelCollapsed = false;
function togglePanel() {
  panelCollapsed = !panelCollapsed;
  document.getElementById("sidePanel").classList.toggle("collapsed", panelCollapsed);
  document.getElementById("collapseBtn").classList.toggle("collapsed", panelCollapsed);
  document.getElementById("resetBtn").classList.toggle("panel-collapsed", panelCollapsed);
  setTimeout(() => map.invalidateSize(), 310);
}

// ── Cerrar panel lateral al clic fuera (desktop) ──
document.addEventListener("click", (e) => {
  const panel = document.getElementById("sidePanel");
  if (!panel) return;
  if (panel.classList.contains("mobile-open") &&
      !panel.contains(e.target)) {
    panel.classList.remove("mobile-open");
  }
});

function selectRoute(routeType) {
  selectedRoute = routeType;
  document.querySelectorAll(".route-pill").forEach(b =>
    b.classList.toggle("selected", b.dataset.route === routeType)
  );
  document.getElementById("periodSection")?.classList.add("visible");
  syncMobileRoute(routeType);
  if (selectedPeriod) triggerShowRoutes();
  else updateSummary();
}

function selectPeriod(period) {
  selectedPeriod = period;
  document.querySelectorAll(".period-pill").forEach(b =>
    b.classList.toggle("selected", b.dataset.period === period)
  );
  syncMobilePeriod(period);
  if (selectedRoute) triggerShowRoutes();
}

// ── Disparar showRoutes con la selección actual ──
async function triggerShowRoutes() {
  if (!selectedRoute || !selectedPeriod) return;

  if (selectedPeriod === "all") {
    // Cargar los 3 turnos
    clearMap();
    const periods = ["morning", "midday", "evening"];
    let allRoutes = [];
    for (const p of periods) {
      try {
        const data = await fetchRouteData(p);
        const sources = selectedRoute === "both"
          ? [...(data.route1||[]), ...(data.route2||[]), ...(data.route3||[])]
          : (data[selectedRoute] || []);
        allRoutes.push(...sources);
      } catch(e) { console.error(e); }
    }
    if (allRoutes.length === 0) { showMessage("⚠️ No hay rutas para esta selección."); return; }
    currentRoutes = allRoutes;
    allRoutes.forEach(r => drawRoute(r));
    const pts = allRoutes.flatMap(r => normalizePoints(r.points));
    if (pts.length) map.fitBounds(L.latLngBounds(pts), { padding: [50, 50] });
    updateLegend(allRoutes);
  } else {
    await showRoutes(selectedPeriod, selectedRoute);
  }

  updateActiveChip();
  updateSummary();
}

function updateSummary() {
  const el = document.getElementById("selectionSummary");
  if (!el) return;
  if (selectedRoute && selectedPeriod) {
    el.textContent = `${routeNames[selectedRoute]} — ${periodNames[selectedPeriod]}`;
    el.classList.add("has-selection");
  } else if (selectedRoute) {
    el.textContent = `${routeNames[selectedRoute]} — elige el turno`;
    el.classList.remove("has-selection");
  } else {
    el.textContent = "Selecciona una ruta para comenzar";
    el.classList.remove("has-selection");
  }
}

function updateActiveChip() {
  const chip = document.getElementById("activeChip");
  const dot  = document.getElementById("activeChipDot");
  const text = document.getElementById("activeChipText");
  if (!chip) return;
  if (selectedRoute && selectedPeriod) {
    dot.style.background = routeColors[selectedRoute];
    text.textContent = `${routeNames[selectedRoute]} · ${periodNames[selectedPeriod]}`;
    chip.classList.add("visible");
  } else {
    chip.classList.remove("visible");
  }
}

document.getElementById("searchStreet")?.addEventListener("keypress", (e) => {
  if (e.key === "Enter") { closeAutocomplete(); searchStreet(); }
});

// ── Autocompletado ──
const searchInput = document.getElementById("searchStreet");
const autocompleteList = document.getElementById("autocompleteList");
let highlightedIndex = -1;

searchInput?.addEventListener("input", () => {
  const val = searchInput.value.trim().toLowerCase();
  highlightedIndex = -1;
  if (!val || allLoadedRoutes.length === 0) { closeAutocomplete(); return; }
  const allStreets = [...new Set(allLoadedRoutes.flatMap(r => r.streets || []))];
  const matches = allStreets.filter(s => s.toLowerCase().includes(val)).slice(0, 8);
  if (matches.length === 0) { closeAutocomplete(); return; }
  autocompleteList.innerHTML = "";
  matches.forEach(street => {
    const div = document.createElement("div");
    div.textContent = street;
    div.addEventListener("mousedown", () => {
      searchInput.value = street;
      closeAutocomplete();
      searchStreet();
    });
    autocompleteList.appendChild(div);
  });
  autocompleteList.style.display = "block";
});

searchInput?.addEventListener("keydown", (e) => {
  const items = autocompleteList.querySelectorAll("div");
  if (e.key === "ArrowDown") {
    highlightedIndex = Math.min(highlightedIndex + 1, items.length - 1);
    items.forEach((el, i) => el.classList.toggle("highlighted", i === highlightedIndex));
    e.preventDefault();
  } else if (e.key === "ArrowUp") {
    highlightedIndex = Math.max(highlightedIndex - 1, 0);
    items.forEach((el, i) => el.classList.toggle("highlighted", i === highlightedIndex));
    e.preventDefault();
  } else if (e.key === "Escape") { closeAutocomplete(); }
});

searchInput?.addEventListener("blur", () => setTimeout(closeAutocomplete, 150));

function closeAutocomplete() {
  if (autocompleteList) {
    autocompleteList.style.display = "none";
    autocompleteList.innerHTML = "";
  }
  highlightedIndex = -1;
}

function resetMap() {
  selectedRoute = null;
  selectedPeriod = null;
  document.querySelectorAll(".route-pill, .period-pill, .mob-route-btn, .mob-period-btn")
    .forEach(b => b.classList.remove("selected"));
  document.getElementById("periodSection")?.classList.remove("visible");
  document.getElementById("mobilePeriodRow")?.classList.remove("visible");
  document.getElementById("map")?.classList.remove("periods-visible");
  document.getElementById("activeChip")?.classList.remove("visible");
  document.getElementById("legendPanel")?.classList.remove("visible");
  updateSummary();
  clearMap();
  if (searchInput) searchInput.value = "";
  closeAutocomplete();
  const hour = new Date().getHours();
  const defaultPeriod = hour < 11 ? "morning" : hour < 15 ? "midday" : "evening";
  selectRoute("both");
  selectPeriod(defaultPeriod);
}

async function loadAllRoutes() {
  const periods = ["morning", "midday", "evening"];
  allLoadedRoutes = [];

  for (const period of periods) {
    try {
      const response = await fetch(`data/routes/${period}.json`);
      if (response.ok) {
        const routesData = await response.json();

        if (routesData.route1) {
          routesData.route1.forEach((r) => (r.period = period));
          allLoadedRoutes.push(...routesData.route1);
        }
        if (routesData.route2) {
          routesData.route2.forEach((r) => (r.period = period));
          allLoadedRoutes.push(...routesData.route2);
        }
        if (routesData.route3) {
          routesData.route3.forEach((r) => (r.period = period));
          allLoadedRoutes.push(...routesData.route3);
        }
      }
    } catch (err) {
      console.error(`Error al cargar rutas de ${period}:`, err);
    }
  }
}

loadAllRoutes().then(() => {
  const hour = new Date().getHours();
  const defaultPeriod = hour < 11 ? "morning" : hour < 15 ? "midday" : "evening";
  selectedPeriod = defaultPeriod;
  syncMobilePeriod(defaultPeriod);
  document.querySelectorAll(".period-pill").forEach(b =>
    b.classList.toggle("selected", b.dataset.period === defaultPeriod)
  );
  selectRoute("both");
});

async function fetchRouteData(period) {
  if (routeCache[period]) return routeCache[period];
  const response = await fetch(`data/routes/${period}.json`);
  if (!response.ok) throw new Error(`Archivo no encontrado: ${period}.json`);
  routeCache[period] = await response.json();
  return routeCache[period];
}

async function showRoutes(period, routeType) {
  clearMap();

  let routesData;
  try {
    routesData = await fetchRouteData(period);
  } catch (err) {
    console.error("Error al cargar las rutas:", err);
    showMessage("❌ Error al cargar las rutas. Verifica los archivos JSON.");
    return;
  }

  let routesToShow = [];

  if (routeType === "route1") {
    routesToShow = routesData.route1 || [];
  } else if (routeType === "route2") {
    routesToShow = routesData.route2 || [];
  } else if (routeType === "route3") {
    routesToShow = routesData.route3 || [];
  } else if (routeType === "both") {
    routesToShow = [
      ...(routesData.route1 || []),
      ...(routesData.route2 || []),
      ...(routesData.route3 || []),
    ];
  }

  if (routesToShow.length === 0) {
    showMessage("⚠️ No hay rutas definidas para esta selección.");
    return;
  }

  currentRoutes = routesToShow;
  routesToShow.forEach((route) => drawRoute(route));

  if (routesToShow.length > 0) {
    const allPoints = routesToShow.flatMap(r => normalizePoints(r.points));
    if (allPoints.length > 0) map.fitBounds(L.latLngBounds(allPoints), { padding: [50, 50] });
  }

  updateLegend(routesToShow);

  const pNames = { morning: "Mañana", midday: "Mediodía", evening: "Tarde" };
  const rNames = { route1: "Ruta 1", route2: "Ruta 2", route3: "Ruta 3", both: "Todas" };
  showMessage(`✅ ${rNames[routeType] || routeType} — ${pNames[period] || period}`);
}

function makeEndpointIcon(emoji, color) {
  return L.divIcon({
    className: "",
    html: `<div style="background:${color};width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35);">${emoji}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function normalizePoints(raw) {
  const flat = (raw || []).flat(Infinity);
  const pairs = [];
  for (let i = 0; i + 1 < flat.length; i += 2) {
    if (flat[i] != null && flat[i + 1] != null && !isNaN(flat[i]) && !isNaN(flat[i + 1]))
      pairs.push([flat[i], flat[i + 1]]);
  }
  return pairs;
}

function drawRoute(route) {
  let points = normalizePoints(route.points);
  if (points.length < 2) return;
  const polyline = L.polyline(points, {
    color: route.color || "#3b82f6",
    weight: 6,
    opacity: 0.8,
  }).addTo(map);

  polyline.bindPopup(`
        <div style="font-family: 'Segoe UI', sans-serif;">
            <strong style="font-size: 15px;">${
              route.name || "Ruta"
            }</strong><br>
            <span style="font-size: 12px; color: #64748b;">
                ${route.direction || "Sin dirección"}<br>
                ${route.schedule || "Sin horario"}<br>
                <strong>Salida:</strong> ${route.start || "N/A"}<br>
                <strong>Llegada:</strong> ${route.end || "N/A"}
            </span>
        </div>
    `);

  polylines.push(polyline);

  // Marcador de inicio (🚏) y fin (🏁)
  const color = route.color || "#3b82f6";
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];

  const startMarker = L.marker(firstPoint, { icon: makeEndpointIcon("🚏", color) })
    .addTo(map)
    .bindPopup(`<b>${route.name}</b><br>🚏 Salida: ${route.start || "N/A"}`);
  const endMarker = L.marker(lastPoint, { icon: makeEndpointIcon("🏁", color) })
    .addTo(map)
    .bindPopup(`<b>${route.name}</b><br>🏁 Llegada: ${route.end || "N/A"}`);

  markers.push(startMarker, endMarker);

  const arrowInterval = Math.max(1, Math.floor(points.length / 8)); // Aproximadamente 8 flechas por ruta

  for (let i = arrowInterval; i < points.length; i += arrowInterval) {
    const point1 = points[i - 1];
    const point2 = points[i];

    const angle =
      (Math.atan2(point2[0] - point1[0], point2[1] - point1[1]) * 180) /
      Math.PI;
    const arrowIcon = L.divIcon({
      className: "arrow-icon",
      html: `
                <div style="
                    transform: rotate(${angle}deg);
                    color: ${route.color || "#3b82f6"};
                    filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
                ">
                    <svg width="20" height="20" viewBox="0 0 20 20">
                        <path d="M10 2 L16 10 L10 9 L4 10 Z" fill="currentColor" stroke="white" stroke-width="1"/>
                    </svg>
                </div>
            `,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    const arrowMarker = L.marker([point2[0], point2[1]], {
      icon: arrowIcon,
      interactive: false,
    }).addTo(map);

    markers.push(arrowMarker);
  }
}

function updateLegend(routes) {
  const legendContent = document.getElementById("legendContent");
  legendContent.innerHTML = "";

  routes.forEach((route) => {
    const item = document.createElement("div");
    item.className = "legend-item";
    item.style.borderLeftColor = route.color || "#3b82f6";

    item.innerHTML = `
      <div class="legend-item-header">
        <div class="legend-color" style="background-color:${route.color || "#3b82f6"};"></div>
        <div class="legend-name">${route.name || "Ruta"}</div>
      </div>
      <div class="legend-details">
        <div class="legend-row">🚏 <strong>Salida:</strong> ${route.start || "N/A"}</div>
        <div class="legend-row">🏁 <strong>Llegada:</strong> ${route.end || "N/A"}</div>
        <div class="legend-row">${route.direction === "Ida" ? "➡️" : route.direction === "Vuelta" ? "⬅️" : "🔄"} <strong>Dirección:</strong> ${route.direction || "N/A"}</div>
        <div class="legend-row">⏰ <strong>Horario:</strong> ${route.schedule || "N/A"}</div>
      </div>
    `;
    legendContent.appendChild(item);
  });

  document.getElementById("legendPanel").classList.add("visible");
}

function searchStreet() {
  const searchTerm = document
    .getElementById("searchStreet")
    .value.trim()
    .toLowerCase();
  if (!searchTerm) {
    showMessage("⚠️ Por favor ingresa una calle para buscar.");
    return;
  }
  let foundRoutes = [];
  allLoadedRoutes.forEach((route) => {
    if (
      route.streets?.some((street) => street.toLowerCase().includes(searchTerm))
    ) {
      foundRoutes.push(route);
    }
  });

  if (foundRoutes.length === 0) {
    showMessage(`❌ La calle "${searchTerm}" no se encontró en ninguna ruta.`);
    return;
  }
  clearMap();
  currentRoutes = foundRoutes;
  foundRoutes.forEach((route) => drawRoute(route));
  const allPoints = foundRoutes.flatMap(r => normalizePoints(r.points));
  if (allPoints.length > 0) map.fitBounds(L.latLngBounds(allPoints), { padding: [50, 50] });

  updateLegend(foundRoutes);

  const foundNames = foundRoutes.map((r) => r.name).join(", ");
  showMessage(`✅ "${searchTerm}" encontrada en ${foundRoutes.length} ruta(s): ${foundNames}`);
}

function closeWelcome(e) {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById("welcomeOverlay").style.display = "none";
}

function showMessage(text) {
  const el = document.getElementById("searchMessage");
  el.textContent = text;
  el.style.display = "block";
  setTimeout(() => (el.style.display = "none"), 5000);
}

function clearMap() {
  polylines.forEach((p) => map.removeLayer(p));
  markers.forEach((m) => map.removeLayer(m));
  polylines = [];
  markers = [];
  document.getElementById("legendPanel").classList.remove("visible");
}
faculties.forEach((fac) => {
  const marker = L.marker([fac.lat, fac.lng], {
    icon: L.divIcon({
      className: "custom-marker facultad-marker",
      html: `<div style="background:#033f86;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 8px rgba(3,63,134,0.45);">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <path d="M12 3L2 9l10 6 10-6-10-6z" fill="white"/>
          <path d="M2 9v6M22 9v6M6 11v5c0 1.1 2.7 3 6 3s6-1.9 6-3v-5" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    }),
  }).addTo(map);
  marker.bindPopup(`<b style="color:#033f86">🎓 ${fac.name}</b>`);
});
