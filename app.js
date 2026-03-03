/* WeatherNow — Open-Meteo (no API key) */

const els = {
  navLinks: [...document.querySelectorAll(".nav-link")],
  views: {
    home: document.getElementById("view-home"),
    forecast: document.getElementById("view-forecast"),
    about: document.getElementById("view-about"),
  },

  searchInput: document.getElementById("searchInput"),
  results: document.getElementById("results"),
  geoBtn: document.getElementById("geoBtn"),

  unitToggle: document.getElementById("unitToggle"),
  unitLabel: document.getElementById("unitLabel"),
  tempUnit: document.getElementById("tempUnit"),

  cityName: document.getElementById("cityName"),
  mainIcon: document.getElementById("mainIcon"),
  currentTemp: document.getElementById("currentTemp"),
  currentDesc: document.getElementById("currentDesc"),
  hiTemp: document.getElementById("hiTemp"),
  loTemp: document.getElementById("loTemp"),

  feelsLike: document.getElementById("feelsLike"),
  humidity: document.getElementById("humidity"),
  wind: document.getElementById("wind"),
  pressure: document.getElementById("pressure"),
  visibility: document.getElementById("visibility"),

  hourly: document.getElementById("hourly"),
  daily: document.getElementById("daily"),

  toast: document.getElementById("toast"),
};

const state = {
  unit: localStorage.getItem("wn_unit") || "C", // C | F
  place: JSON.parse(localStorage.getItem("wn_place") || "null"), // { name, country, lat, lon, timezone? }
  lastSearchTimer: null,
};

const fmt = {
  clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  },
  round(n) {
    if (typeof n !== "number" || Number.isNaN(n)) return "—";
    return String(Math.round(n));
  },
  oneDec(n) {
    if (typeof n !== "number" || Number.isNaN(n)) return "—";
    return (Math.round(n * 10) / 10).toFixed(1);
  },
  km(nMeters) {
    if (typeof nMeters !== "number" || Number.isNaN(nMeters)) return "—";
    return `${this.round(nMeters / 1000)} km`;
  },
  hpa(n) {
    if (typeof n !== "number" || Number.isNaN(n)) return "—";
    return `${this.round(n)} hPa`;
  },
  pct(n) {
    if (typeof n !== "number" || Number.isNaN(n)) return "—";
    return `${this.round(n)}%`;
  },
  wind(nMs) {
    if (typeof nMs !== "number" || Number.isNaN(nMs)) return "—";
    return `${this.oneDec(nMs)} m/s`;
  },
};

init();

function init() {
  // nav
  els.navLinks.forEach((btn) => {
    btn.addEventListener("click", () => setView(btn.dataset.view));
  });

  // unit toggle
  syncUnitUI();
  els.unitToggle.addEventListener("click", () => {
    state.unit = state.unit === "C" ? "F" : "C";
    localStorage.setItem("wn_unit", state.unit);
    syncUnitUI();
    if (state.place) loadWeather(state.place);
  });

  // search
  els.searchInput.addEventListener("input", onSearchInput);
  els.searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeResults();
  });
  document.addEventListener("click", (e) => {
    if (!els.results.contains(e.target) && e.target !== els.searchInput) {
      closeResults();
    }
  });

  // geo
  els.geoBtn.addEventListener("click", useGeolocation);

  // default place
  if (state.place) {
    toast(`Loaded: ${state.place.name}`);
    loadWeather(state.place);
  } else {
    // nice default
    const defaultPlace = { name: "San Francisco", country: "US", lat: 37.7749, lon: -122.4194 };
    state.place = defaultPlace;
    localStorage.setItem("wn_place", JSON.stringify(defaultPlace));
    loadWeather(defaultPlace);
  }
}

function syncUnitUI() {
  els.unitLabel.textContent = `°${state.unit}`;
  els.tempUnit.textContent = state.unit;
}

function setView(viewName) {
  els.navLinks.forEach((b) => b.classList.toggle("is-active", b.dataset.view === viewName));
  Object.entries(els.views).forEach(([k, v]) => v.classList.toggle("is-visible", k === viewName));
}

function toast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.add("is-on");
  clearTimeout(els.toast._t);
  els.toast._t = setTimeout(() => els.toast.classList.remove("is-on"), 2400);
}

/* ---------- Search / Geocoding ---------- */

async function onSearchInput() {
  const q = els.searchInput.value.trim();
  if (state.lastSearchTimer) clearTimeout(state.lastSearchTimer);

  if (q.length < 2) {
    closeResults();
    return;
  }

  state.lastSearchTimer = setTimeout(async () => {
    try {
      const items = await geocode(q);
      renderResults(items);
    } catch (err) {
      console.error(err);
      toast("Search failed. Try again.");
      closeResults();
    }
  }, 250);
}

function openResults() {
  els.results.classList.add("is-open");
}
function closeResults() {
  els.results.classList.remove("is-open");
  els.results.innerHTML = "";
}

function renderResults(items) {
  if (!items.length) {
    els.results.innerHTML = `<div class="result-item"><div><div class="result-main">No matches</div><div class="result-sub">Try a different query</div></div></div>`;
    openResults();
    return;
  }

  els.results.innerHTML = items
    .slice(0, 8)
    .map((p, idx) => {
      const subtitle = [p.admin1, p.country, p.timezone].filter(Boolean).join(" • ");
      return `
        <div class="result-item" data-idx="${idx}">
          <div>
            <div class="result-main">${escapeHtml(p.name)}</div>
            <div class="result-sub">${escapeHtml(subtitle)}</div>
          </div>
          <div style="opacity:.7;font-weight:700">${fmt.round(p.latitude)}, ${fmt.round(p.longitude)}</div>
        </div>
      `;
    })
    .join("");

  // attach click
  [...els.results.querySelectorAll(".result-item")].forEach((row) => {
    row.addEventListener("click", () => {
      const idx = Number(row.dataset.idx);
      const picked = items[idx];
      const place = {
        name: picked.name,
        country: picked.country_code || picked.country || "",
        lat: picked.latitude,
        lon: picked.longitude,
        timezone: picked.timezone,
      };
      state.place = place;
      localStorage.setItem("wn_place", JSON.stringify(place));
      els.searchInput.value = `${place.name}${place.country ? ", " + place.country : ""}`;
      closeResults();
      loadWeather(place);
      setView("home");
    });
  });

  openResults();
}

async function geocode(name) {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", name);
  url.searchParams.set("count", "10");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const res = await fetch(url);
  if (!res.ok) throw new Error("Geocoding failed");
  const data = await res.json();
  return data.results || [];
}

async function useGeolocation() {
  if (!navigator.geolocation) {
    toast("Geolocation not supported in this browser.");
    return;
  }

  toast("Getting your location…");
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      try {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;

        // reverse geocode via open-meteo (same endpoint using lat/lon isn't provided)
        // We'll just label as "Your Location" and still load weather.
        const place = { name: "Your Location", country: "", lat, lon };
        state.place = place;
        localStorage.setItem("wn_place", JSON.stringify(place));
        closeResults();
        loadWeather(place);
        setView("home");
      } catch (e) {
        console.error(e);
        toast("Could not use your location.");
      }
    },
    () => toast("Location permission denied."),
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

/* ---------- Weather ---------- */

async function loadWeather(place) {
  toast("Loading weather…");

  const { lat, lon } = place;
  const isF = state.unit === "F";
  const temperature_unit = isF ? "fahrenheit" : "celsius";
  const windspeed_unit = "ms"; // m/s (matches your screenshot style)

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("temperature_unit", temperature_unit);
  url.searchParams.set("windspeed_unit", windspeed_unit);
  url.searchParams.set("timezone", "auto");

  // Current + hourly + daily
  url.searchParams.set(
    "current",
    [
      "temperature_2m",
      "relative_humidity_2m",
      "apparent_temperature",
      "weather_code",
      "wind_speed_10m",
      "pressure_msl",
      "visibility",
    ].join(",")
  );

  url.searchParams.set(
    "hourly",
    [
      "temperature_2m",
      "weather_code",
      "relative_humidity_2m",
      "visibility",
      "pressure_msl",
      "wind_speed_10m",
    ].join(",")
  );

  url.searchParams.set("forecast_days", "7");
  url.searchParams.set("daily", ["temperature_2m_max", "temperature_2m_min", "weather_code"].join(","));

  const res = await fetch(url);
  if (!res.ok) {
    toast("Failed to load weather.");
    return;
  }
  const data = await res.json();

  // Update headline city label (better formatting)
  const label = place.country ? `${place.name}, ${place.country}` : place.name;
  els.cityName.textContent = label.toUpperCase();

  renderCurrent(data);
  renderHourly(data);
  renderDaily(data);

  toast("Updated ✔️");
}

function renderCurrent(data) {
  const c = data.current || {};
  const dailyMax = data.daily?.temperature_2m_max?.[0];
  const dailyMin = data.daily?.temperature_2m_min?.[0];

  const temp = c.temperature_2m;
  const code = c.weather_code;

  els.currentTemp.textContent = fmt.round(temp);
  els.currentDesc.textContent = weatherLabel(code);
  els.mainIcon.innerHTML = bigIconSvg(code);

  els.hiTemp.textContent = `${fmt.round(dailyMax)}°${state.unit}`;
  els.loTemp.textContent = `${fmt.round(dailyMin)}°${state.unit}`;

  els.feelsLike.textContent = `${fmt.round(c.apparent_temperature)}°${state.unit}`;
  els.humidity.textContent = fmt.pct(c.relative_humidity_2m);
  els.wind.textContent = fmt.wind(c.wind_speed_10m);
  els.pressure.textContent = fmt.hpa(c.pressure_msl);
  els.visibility.textContent = fmt.km(c.visibility);
}

function renderHourly(data) {
  const tz = data.timezone || "auto";
  const times = data.hourly?.time || [];
  const temps = data.hourly?.temperature_2m || [];
  const codes = data.hourly?.weather_code || [];

  // find "now" index
  const nowISO = data.current?.time;
  let startIdx = times.findIndex((t) => t === nowISO);
  if (startIdx < 0) startIdx = 0;

  const count = 12;
  const slice = [];
  for (let i = startIdx; i < Math.min(times.length, startIdx + count); i++) {
    slice.push({ time: times[i], temp: temps[i], code: codes[i], tz });
  }

  els.hourly.innerHTML = slice
    .map((h) => {
      const label = hourLabel(h.time);
      return `
        <div class="hour">
          <div class="hour-time">${label}</div>
          <div class="hour-ico">${tinyIcon(h.code)}</div>
          <div class="hour-temp">${fmt.round(h.temp)}°${state.unit}</div>
        </div>
      `;
    })
    .join("");
}

function renderDaily(data) {
  const days = data.daily?.time || [];
  const min = data.daily?.temperature_2m_min || [];
  const max = data.daily?.temperature_2m_max || [];
  const codes = data.daily?.weather_code || [];

  // global min/max for range bars
  const globalMin = Math.min(...min.filter((x) => typeof x === "number"));
  const globalMax = Math.max(...max.filter((x) => typeof x === "number"));
  const span = Math.max(1, globalMax - globalMin);

  els.daily.innerHTML = days
    .map((d, i) => {
      const dayName = weekdayShort(d);
      const leftPct = ((min[i] - globalMin) / span) * 100;
      const widthPct = ((max[i] - min[i]) / span) * 100;

      return `
        <div class="day-row">
          <div class="day-name">${dayName}</div>
          <div class="day-ico">${tinyIcon(codes[i])}</div>
          <div class="range" aria-hidden="true">
            <span style="left:${fmt.clamp(leftPct, 0, 100)}%; width:${fmt.clamp(widthPct, 0, 100)}%"></span>
          </div>
          <div class="temp-min">${fmt.round(min[i])}°</div>
          <div></div>
          <div class="temp-max">${fmt.round(max[i])}°</div>
        </div>
      `;
    })
    .join("");
}

/* ---------- Helpers: icons + labels ---------- */

function weatherLabel(code) {
  // Open-Meteo weather codes: https://open-meteo.com/en/docs
  if (code === 0) return "Clear Sky";
  if ([1, 2].includes(code)) return "Partly Cloudy";
  if (code === 3) return "Cloudy";
  if ([45, 48].includes(code)) return "Fog";
  if ([51, 53, 55].includes(code)) return "Drizzle";
  if ([56, 57].includes(code)) return "Freezing Drizzle";
  if ([61, 63, 65].includes(code)) return "Rain";
  if ([66, 67].includes(code)) return "Freezing Rain";
  if ([71, 73, 75, 77].includes(code)) return "Snow";
  if ([80, 81, 82].includes(code)) return "Rain Showers";
  if ([85, 86].includes(code)) return "Snow Showers";
  if ([95].includes(code)) return "Thunderstorm";
  if ([96, 99].includes(code)) return "Thunderstorm (Hail)";
  return "Unknown";
}

function tinyIcon(code) {
  // emojis for tiny icons (simple + fast)
  if (code === 0) return "☀️";
  if ([1, 2].includes(code)) return "🌤️";
  if (code === 3) return "☁️";
  if ([45, 48].includes(code)) return "🌫️";
  if ([51, 53, 55, 56, 57].includes(code)) return "🌦️";
  if ([61, 63, 65, 80, 81, 82].includes(code)) return "🌧️";
  if ([66, 67].includes(code)) return "🌧️";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "🌨️";
  if ([95, 96, 99].includes(code)) return "⛈️";
  return "❓";
}

function bigIconSvg(code) {
  // a bigger “3D-ish” style via gradients + blur
  // returns an inline SVG string
  const type =
    code === 0
      ? "sun"
      : [1, 2].includes(code)
        ? "partly"
        : code === 3
          ? "cloud"
          : [61, 63, 65, 80, 81, 82].includes(code)
            ? "rain"
            : [71, 73, 75, 77, 85, 86].includes(code)
              ? "snow"
              : [95, 96, 99].includes(code)
                ? "storm"
                : "cloud";

  const base = `
  <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="gSun" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(52 44) rotate(90) scale(36)">
        <stop stop-color="#FFE17A"/>
        <stop offset="1" stop-color="#FFB100"/>
      </radialGradient>
      <radialGradient id="gCloud" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(62 70) rotate(90) scale(40)">
        <stop stop-color="#F4F0FF"/>
        <stop offset="1" stop-color="#C7C4FF"/>
      </radialGradient>
      <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="1.2" />
      </filter>
      <linearGradient id="gRain" x1="0" y1="0" x2="1" y2="1">
        <stop stop-color="#63D0FF"/>
        <stop offset="1" stop-color="#4A6BFF"/>
      </linearGradient>
    </defs>
  `;

  const sun = `
    <g filter="url(#soft)">
      <circle cx="64" cy="46" r="22" fill="url(#gSun)"/>
      <circle cx="64" cy="46" r="30" fill="#FF7A00" opacity="0.18"/>
    </g>
  `;

  const cloud = `
    <g filter="url(#soft)">
      <path d="M36 78c-9 0-16-6-16-14 0-7 5-12 12-13 3-10 12-17 23-17 13 0 24 10 24 23v1c8 1 14 7 14 15 0 9-7 15-16 15H36Z" fill="url(#gCloud)"/>
    </g>
  `;

  const rain = `
    <g filter="url(#soft)">
      <path d="M44 92c3 0 6-7 6-10 0-2-2-4-4-4s-4 2-4 4c0 3 3 10 2 10Z" fill="url(#gRain)"/>
      <path d="M62 92c3 0 6-7 6-10 0-2-2-4-4-4s-4 2-4 4c0 3 3 10 2 10Z" fill="url(#gRain)"/>
      <path d="M80 92c3 0 6-7 6-10 0-2-2-4-4-4s-4 2-4 4c0 3 3 10 2 10Z" fill="url(#gRain)"/>
    </g>
  `;

  const snow = `
    <g opacity="0.95">
      ${snowflake(50, 92)}
      ${snowflake(68, 92)}
      ${snowflake(86, 92)}
    </g>
  `;

  const storm = `
    <g filter="url(#soft)">
      <path d="M66 84h-9l8-14h-9l-10 18h10l-6 14 16-18Z" fill="#FFD35A"/>
    </g>
  `;

  function wrap(...parts) {
    return base + parts.join("") + "</svg>";
  }

  if (type === "sun") return wrap(sun);
  if (type === "cloud") return wrap(cloud);
  if (type === "partly") return wrap(sun, `<g transform="translate(-8,8)">${cloud}</g>`);
  if (type === "rain") return wrap(`<g transform="translate(-8,6)">${cloud}</g>`, rain);
  if (type === "snow") return wrap(`<g transform="translate(-8,6)">${cloud}</g>`, snow);
  if (type === "storm") return wrap(`<g transform="translate(-8,6)">${cloud}</g>`, storm, rain);

  return wrap(cloud);
}

function snowflake(x, y) {
  return `
    <svg x="${x - 7}" y="${y - 7}" width="14" height="14" viewBox="0 0 14 14">
      <g stroke="rgba(255,255,255,.92)" stroke-width="1.2" stroke-linecap="round">
        <path d="M7 1v12"/>
        <path d="M1 7h12"/>
        <path d="M2.2 2.2l9.6 9.6"/>
        <path d="M11.8 2.2L2.2 11.8"/>
      </g>
    </svg>
  `;
}

/* ---------- Date formatting ---------- */

function hourLabel(iso) {
  // iso "2026-02-16T07:00"
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, "0");
  return `${h}:00`;
}

function weekdayShort(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: "short" });
}

/* ---------- Misc ---------- */

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
