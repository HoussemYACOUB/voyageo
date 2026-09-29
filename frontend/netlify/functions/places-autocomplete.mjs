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

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return Response.json({ suggestions: fallbackSuggestions(query), provider: 'fallback' }, { headers: responseHeaders });
  }

  try {
    const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
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
    return Response.json({ suggestions: fallbackSuggestions(query), provider: 'fallback' }, { headers: responseHeaders });
  }
};
