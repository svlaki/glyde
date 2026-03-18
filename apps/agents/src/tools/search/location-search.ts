import { tavily } from "@tavily/core";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const GOOGLE_MAPS_BASE = 'https://maps.googleapis.com/maps/api';

function getApiKey(): string {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error('GOOGLE_MAPS_API_KEY not configured');
  return key;
}

/**
 * Reverse geocode coordinates to a human-readable address.
 * Exported so ConversationAgent can use it for prompt context.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const params = new URLSearchParams({
    latlng: `${lat},${lng}`,
    key: getApiKey(),
  });

  const res = await fetch(`${GOOGLE_MAPS_BASE}/geocode/json?${params}`);
  const data = await res.json() as any;

  if (data.status !== 'OK' || !data.results?.length) {
    return `${lat}, ${lng}`;
  }

  // Return the most useful formatted address (first result is most specific)
  return data.results[0].formatted_address;
}

/**
 * Google Maps Directions API for accurate drive/walk time.
 * Returns both driving and walking for short distances.
 */
async function getDirections(origin: string, destination: string): Promise<string> {
  const apiKey = getApiKey();

  // Fetch driving and walking in parallel
  const [driveRes, walkRes] = await Promise.all([
    fetch(`${GOOGLE_MAPS_BASE}/directions/json?${new URLSearchParams({
      origin, destination, key: apiKey, departure_time: 'now', mode: 'driving',
    })}`),
    fetch(`${GOOGLE_MAPS_BASE}/directions/json?${new URLSearchParams({
      origin, destination, key: apiKey, mode: 'walking',
    })}`),
  ]);

  const [driveData, walkData] = await Promise.all([
    driveRes.json() as Promise<any>,
    walkRes.json() as Promise<any>,
  ]);

  const parts: string[] = [];

  if (driveData.status === 'OK' && driveData.routes?.length) {
    const leg = driveData.routes[0].legs[0];
    parts.push(`From: ${leg.start_address}`);
    parts.push(`To: ${leg.end_address}`);
    parts.push(`Driving: ${leg.distance.text}, ${leg.duration_in_traffic?.text || leg.duration.text}`);
  }

  if (walkData.status === 'OK' && walkData.routes?.length) {
    const leg = walkData.routes[0].legs[0];
    parts.push(`Walking: ${leg.distance.text}, ${leg.duration.text}`);
  }

  if (parts.length === 0) {
    const status = driveData.status || walkData.status || 'UNKNOWN';
    return `Could not calculate route (${status}). Try a more specific address.`;
  }

  return parts.join('\n');
}

/**
 * Google Places Text Search for finding places.
 */
async function searchPlaces(query: string, locationBias?: string): Promise<string> {
  const searchParams: Record<string, string> = {
    query,
    key: getApiKey(),
  };
  if (locationBias) {
    searchParams.location = locationBias;
    searchParams.radius = '20000'; // 20km radius bias
  }

  const params = new URLSearchParams(searchParams);
  const res = await fetch(`${GOOGLE_MAPS_BASE}/place/textsearch/json?${params}`);
  const data = await res.json() as any;

  if (data.status !== 'OK' || !data.results?.length) {
    return `No places found for "${query}".`;
  }

  // Get details for top results
  const results = data.results.slice(0, 3);
  const detailed = await Promise.all(results.map((place: any) => getPlaceDetails(place.place_id)));

  return detailed.join('\n---\n');
}

/**
 * Google Place Details for comprehensive venue info.
 */
async function getPlaceDetails(placeId: string): Promise<string> {
  const params = new URLSearchParams({
    place_id: placeId,
    key: getApiKey(),
    fields: 'name,formatted_address,formatted_phone_number,opening_hours,rating,user_ratings_total,price_level,website,business_status',
  });

  const res = await fetch(`${GOOGLE_MAPS_BASE}/place/details/json?${params}`);
  const data = await res.json() as any;

  if (data.status !== 'OK' || !data.result) {
    return 'Could not fetch place details.';
  }

  const p = data.result;
  const parts: string[] = [`${p.name}`];

  if (p.formatted_address) parts.push(`Address: ${p.formatted_address}`);
  if (p.formatted_phone_number) parts.push(`Phone: ${p.formatted_phone_number}`);
  if (p.rating) parts.push(`Rating: ${p.rating}/5 (${p.user_ratings_total || 0} reviews)`);
  if (p.price_level !== undefined) parts.push(`Price: ${'$'.repeat(p.price_level)}`);
  if (p.website) parts.push(`Website: ${p.website}`);
  if (p.business_status && p.business_status !== 'OPERATIONAL') parts.push(`Status: ${p.business_status}`);

  if (p.opening_hours) {
    if (p.opening_hours.open_now !== undefined) {
      parts.push(`Currently: ${p.opening_hours.open_now ? 'Open' : 'Closed'}`);
    }
    if (p.opening_hours.weekday_text?.length) {
      parts.push(`Hours:\n  ${p.opening_hours.weekday_text.join('\n  ')}`);
    }
  }

  return parts.join('\n');
}

/**
 * Tavily fallback for queries Google Places can't handle.
 */
async function tavilyFallback(query: string): Promise<string> {
  try {
    const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });
    const searchResponse = await tvly.search(query, {
      searchDepth: "advanced",
      maxResults: 3,
      includeAnswer: true,
      includeImages: false,
    });

    let response = '';
    if (searchResponse.answer) response += `${searchResponse.answer}\n\n`;
    if (searchResponse.results?.length) {
      searchResponse.results.slice(0, 3).forEach((result: any, idx: number) => {
        response += `${idx + 1}. ${result.title || 'Result'}\n`;
        if (result.content) response += `   ${result.content.substring(0, 200)}\n`;
        response += `\n`;
      });
    }
    return response || `No results found for "${query}".`;
  } catch {
    return `No results found for "${query}".`;
  }
}

/**
 * Location Search Tool
 *
 * Google Maps-powered: Directions, Places, Geocoding.
 * Tavily as fallback for non-place queries only.
 */
export const locationSearchTool = tool(
  async ({ query, fromLocation, toLocation, infoType }) => {
    try {
      switch (infoType) {
        case 'drive_time':
        case 'directions': {
          const origin = fromLocation || query;
          const destination = toLocation || query;
          if (!origin || !destination || origin === destination) {
            return 'Need both fromLocation (origin) and toLocation (destination).';
          }
          return await getDirections(origin, destination);
        }

        case 'venue_info': {
          return await searchPlaces(query, fromLocation);
        }

        case 'reverse_geocode': {
          // Expect query to be "lat,lng"
          const [lat, lng] = query.split(',').map(s => parseFloat(s.trim()));
          if (!isNaN(lat!) && !isNaN(lng!)) {
            return await reverseGeocode(lat!, lng!);
          }
          return await tavilyFallback(`what is at location ${query}`);
        }

        case 'general':
        default: {
          // Try Google Places first, fall back to Tavily
          const placesResult = await searchPlaces(query, fromLocation);
          if (placesResult.startsWith('No places found')) {
            return await tavilyFallback(query);
          }
          return placesResult;
        }
      }
    } catch (error) {
      console.error('Location search error:', error);
      return `Location search error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "location_search",
    description: "Search locations via Google Maps (drive times, venues, directions).",
    schema: z.object({
      query: z.string().describe("Location query or 'lat,lng' for reverse geocode"),
      fromLocation: z.string().optional().describe("Origin coords or address"),
      toLocation: z.string().optional().describe("Destination for directions"),
      infoType: z.enum(['drive_time', 'venue_info', 'directions', 'reverse_geocode', 'general']).default('general').describe("Info type"),
    }),
  }
);
