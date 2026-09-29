const fallbackCities = [
  'Paris, France',
  'Lyon, France',
  'Marseille, France',
  'Nice, France',
  'Lisbonne, Portugal',
  'Rome, Italie',
  'Londres, Royaume-Uni',
  'New York, États-Unis'
];

const responseHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store'
};

function normalize(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr');
}

function fallbackSuggestions(query) {
  const normalizedQuery = normalize(query);
  return fallbackCities
    .filter((city) => normalize(city).includes(normalizedQuery))
    .slice(0, 5)
    .map((text) => ({ text, provider: 'fallback' }));
}

async function travelpayoutsSuggestions(query) {
  const params = new URLSearchParams({ term: query, locale: 'fr' });
  params.append('types[]', 'city');
  params.append('types[]', 'airport');
  const response = await fetch(`https://autocomplete.travelpayouts.com/places2?${params}`, {
    headers: { 'User-Agent': 'Voyageo/1.0 (travel search autocomplete)' },
    signal: AbortSignal.timeout(4000)
  });
  if (!response.ok) return [];

  const locations = await response.json();
  if (!Array.isArray(locations)) return [];

  const suggestions = locations
    .map((location) => {
      const cityName = location.city_name || (location.type === 'city' ? location.name : '');
      const countryName = location.country_name || '';
      const text = cityName ? `${cityName}${countryName ? `, ${countryName}` : ''}` : location.name;
      return {
        text,
        placeId: location.city_code || location.code,
        iataCode: location.city_code || location.code,
        type: location.type,
        provider: 'travelpayouts'
      };
    })
    .filter((location) => typeof location.text === 'string' && location.text.length > 0 && location.iataCode);

  const cities = suggestions.filter((location) => location.type === 'city');
  const airports = suggestions.filter((location) => location.type === 'airport');
  const seen = new Set();
  return [...cities, ...airports]
    .filter((suggestion) => {
      const key = `${suggestion.type}:${suggestion.iataCode}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 6);
}

async function geoapifySuggestions(query, apiKey) {
  const params = new URLSearchParams({ text: query, type: 'city', lang: 'fr', limit: '5', format: 'json', apiKey });
  const response = await fetch(`https://api.geoapify.com/v1/geocode/autocomplete?${params}`, {
    signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) return null;
  const result = await response.json();
  return (result.results ?? [])
    .map((place) => ({
      text: place.formatted,
      placeId: place.place_id,
      provider: 'geoapify'
    }))
    .filter((suggestion) => typeof suggestion.text === 'string' && suggestion.text.length > 0)
    .slice(0, 5);
}

export default async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: responseHeaders });
  }

  if (request.method !== 'GET') {
    return Response.json({ error: 'Méthode non autorisée.' }, { status: 405, headers: responseHeaders });
  }

  const query = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  if (query.length < 2 || query.length > 100) {
    return Response.json({ suggestions: [] }, { headers: responseHeaders });
  }

  const geoapifyKey = process.env.GEOAPIFY_API_KEY;
  if (geoapifyKey) {
    try {
      const suggestions = await geoapifySuggestions(query, geoapifyKey);
      if (suggestions?.length) {
        return Response.json({ suggestions, provider: 'geoapify' }, { headers: responseHeaders });
      }
    } catch {
      // Continue with the keyless city/airport provider.
    }
  }

  try {
    const suggestions = await travelpayoutsSuggestions(query);
    if (suggestions.length) {
      return Response.json({ suggestions, provider: 'travelpayouts' }, { headers: responseHeaders });
    }
  } catch {
    // Public autocomplete is best-effort; the local list remains available.
  }

  const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (googleApiKey) {
  try {
    const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': googleApiKey,
        'X-Goog-FieldMask': 'suggestions.placePrediction.text.text,suggestions.placePrediction.placeId'
      },
      body: JSON.stringify({
        input: query,
        includedPrimaryTypes: ['(cities)'],
        languageCode: 'fr',
        regionCode: 'fr'
      }),
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      return Response.json({ suggestions: fallbackSuggestions(query), provider: 'fallback' }, { headers: responseHeaders });
    }

    const result = await response.json();
    const suggestions = (result.suggestions ?? [])
      .map(({ placePrediction }) => ({
        text: placePrediction?.text?.text,
        placeId: placePrediction?.placeId,
        provider: 'google'
      }))
      .filter((suggestion) => typeof suggestion.text === 'string' && suggestion.text.length > 0)
      .slice(0, 5);

    return Response.json({ suggestions, provider: 'google' }, { headers: responseHeaders });
  } catch {
      // Last-resort suggestions are generated locally.
    }
  }

  return Response.json({ suggestions: fallbackSuggestions(query), provider: 'fallback' }, { headers: responseHeaders });
};
