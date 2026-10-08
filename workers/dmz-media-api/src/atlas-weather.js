const MET_ENDPOINT = "https://api.met.no/weatherapi/locationforecast/2.0/compact";
const MET_SOURCE_URL = "https://api.met.no/weatherapi/locationforecast/2.0/documentation";
const MET_LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/";
const USER_AGENT = "DMZScuba/1.0 (+https://www.dmzscuba.com; info@dmzscuba.com)";
const MAX_HOURS = 48;

const finite = value => Number.isFinite(Number(value)) ? Number(value) : null;
const rounded = value => Math.round(Number(value) * 1000) / 1000;

export function atlasWeatherCoordinates(url) {
  const latitude = finite(url.searchParams.get("lat"));
  const longitude = finite(url.searchParams.get("lon"));
  if (latitude == null || longitude == null || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude: rounded(latitude), longitude: rounded(longitude) };
}

export function normalizeAtlasWeather(payload, coordinates, fetchedAt = new Date().toISOString()) {
  const timeseries = Array.isArray(payload?.properties?.timeseries) ? payload.properties.timeseries : [];
  const hours = timeseries.slice(0, MAX_HOURS).map(item => {
    const details = item?.data?.instant?.details || {};
    const nextHour = item?.data?.next_1_hours || {};
    const time = typeof item?.time === "string" && Number.isFinite(Date.parse(item.time)) ? item.time : null;
    if (!time) return null;
    return {
      time,
      symbolCode: typeof nextHour?.summary?.symbol_code === "string" ? nextHour.summary.symbol_code.slice(0, 50) : null,
      airTemperatureC: finite(details.air_temperature),
      windSpeedMps: finite(details.wind_speed),
      windDirectionDeg: finite(details.wind_from_direction),
      pressureHpa: finite(details.air_pressure_at_sea_level),
      cloudPercent: finite(details.cloud_area_fraction),
      humidityPercent: finite(details.relative_humidity),
      precipitationMm: finite(nextHour?.details?.precipitation_amount),
    };
  }).filter(Boolean);
  if (!hours.length) throw new Error("Weather provider returned no hourly forecast.");
  return {
    ok: true,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    updatedAt: typeof payload?.properties?.meta?.updated_at === "string" ? payload.properties.meta.updated_at : null,
    fetchedAt,
    source: {
      name: "MET Norway",
      url: MET_SOURCE_URL,
      license: "CC BY 4.0",
      licenseUrl: MET_LICENSE_URL,
    },
    hours,
  };
}

function cacheSeconds(response, now = Date.now()) {
  const expires = Date.parse(response.headers.get("Expires") || "");
  if (!Number.isFinite(expires)) return 900;
  return Math.max(1, Math.min(3600, Math.floor((expires - now) / 1000)));
}

function weatherJson(data, status, cacheControl, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": cacheControl, ...extraHeaders },
  });
}

export async function handleAtlasWeather(request, context, dependencies = {}) {
  const url = new URL(request.url);
  const coordinates = atlasWeatherCoordinates(url);
  if (!coordinates) return weatherJson({ ok: false, error: "Valid lat and lon query parameters are required." }, 400, "no-store");

  const fetchImpl = dependencies.fetchImpl || fetch;
  const cache = dependencies.cache || (typeof caches !== "undefined" ? caches.default : null);
  const cacheUrl = new URL(request.url);
  cacheUrl.search = `?lat=${coordinates.latitude.toFixed(3)}&lon=${coordinates.longitude.toFixed(3)}`;
  const cacheRequest = new Request(cacheUrl.toString(), { method: "GET" });
  const cached = cache ? await cache.match(cacheRequest) : null;
  if (cached) {
    const headers = new Headers(cached.headers);
    headers.set("X-DMZ-Weather-Cache", "HIT");
    return new Response(cached.body, { status: cached.status, headers });
  }

  const providerUrl = `${MET_ENDPOINT}?lat=${coordinates.latitude.toFixed(3)}&lon=${coordinates.longitude.toFixed(3)}`;
  let upstream;
  try {
    upstream = await fetchImpl(providerUrl, { headers: { Accept: "application/json", "User-Agent": USER_AGENT } });
  } catch (_error) {
    return weatherJson({ ok: false, error: "Surface forecast is temporarily unavailable." }, 503, "no-store");
  }
  if (!upstream.ok) return weatherJson({ ok: false, error: "Surface forecast is temporarily unavailable." }, 502, "no-store");

  try {
    const payload = normalizeAtlasWeather(await upstream.json(), coordinates);
    const ttl = cacheSeconds(upstream);
    const response = weatherJson(payload, 200, `public, max-age=${Math.min(300, ttl)}, s-maxage=${ttl}`, { "X-DMZ-Weather-Cache": "MISS" });
    if (cache) {
      const write = cache.put(cacheRequest, response.clone());
      if (context?.waitUntil) context.waitUntil(write); else await write;
    }
    return response;
  } catch (_error) {
    return weatherJson({ ok: false, error: "Surface forecast could not be read." }, 502, "no-store");
  }
}
