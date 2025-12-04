import { tavily } from "@tavily/core";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

/**
 * Web Search Tool - Powered by Tavily
 *
 * Searches the web for real-time information about restaurants, locations,
 * events, businesses, and general queries. Returns concise, LLM-optimized
 * results with an AI-generated answer summary.
 *
 * Use cases:
 * - Restaurant information (address, hours, phone, menu)
 * - Location details and directions
 * - Business information
 * - Current events and news
 * - General factual queries
 */
export const webSearchTool = tool(
  async ({ query, maxResults = 5 }) => {
    try {
      // Initialize Tavily client with API key
      const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });

      // Perform search with optimized settings
      const searchResponse = await tvly.search(query, {
        searchDepth: "basic",
        maxResults: maxResults ?? 5,
        includeAnswer: true,
        includeImages: false,
      });

      // Format results for LLM consumption
      let response = '';

      // If Tavily provided an AI-generated answer, lead with that
      if (searchResponse.answer) {
        response += `📍 ${searchResponse.answer}\n\n`;
      }

      // Add search results
      if (searchResponse.results && searchResponse.results.length > 0) {
        if (!searchResponse.answer) {
          response += `🔍 Found ${searchResponse.results.length} results for "${query}":\n\n`;
        } else {
          response += `Sources:\n`;
        }

        searchResponse.results.slice(0, 3).forEach((result: any, idx: number) => {
          response += `${idx + 1}. ${result.title || 'Result'}\n`;
          if (result.content) {
            response += `   ${result.content.substring(0, 200)}${result.content.length > 200 ? '...' : ''}\n`;
          }
          if (result.url) {
            response += `   Source: ${result.url}\n`;
          }
          response += `\n`;
        });

        return response;
      } else {
        return `🔍 No results found for "${query}". Try rephrasing or using different search terms.`;
      }
    } catch (error) {
      console.error('Tavily web search error:', error);
      return `🔍 Web search temporarily unavailable. Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "web_search",
    description: `Search the web for real-time information about restaurants, locations, businesses, events, and general queries.

Use this tool when:
- User mentions a restaurant, cafe, or venue (get address, hours, phone, menu info)
- Creating events at specific locations (enrich with venue details)
- User asks about current events, news, or factual information
- User needs directions, business hours, or contact information
- User wants recommendations or information about places/things

Returns: AI-generated answer summary (when available) with supporting search results including titles, content snippets, and source URLs.`,
    schema: z.object({
      query: z.string().describe("The search query. Be specific. Examples: 'Flour + Water restaurant San Francisco address hours', 'Stanford vs Cal football game 2025 date', 'Coupa Cafe Palo Alto location menu'"),
      maxResults: z.number().default(5).optional().nullable().describe("Maximum number of results to return (default: 5)"),
    }),
  }
);
