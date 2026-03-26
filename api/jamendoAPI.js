/**
 * Jamendo API Integration Module
 * Fetches royalty-free music from Jamendo
 * Note: Requires free API key from https://developer.jamendo.com
 */

const { fetch: fetchWithTimeout } = require('./httpClient');

// Using a public Jamendo endpoint (you should register for your own API key)
const JAMENDO_API = 'https://api.jamendo.com/v3.0';
const JAMENDO_API_KEY = process.env.JAMENDO_API_KEY || 'public'; // Use env variable or public

class JamendoAPI {
  constructor() {
    this.cache = null;
    this.cacheExpiry = null;
  }

  /**
   * Check if cache is still valid (5 minutes)
   */
  isCacheValid() {
    if (!this.cache || !this.cacheExpiry) return false;
    return Date.now() < this.cacheExpiry;
  }

  /**
   * Fetch popular royalty-free tracks
   * @param {number} limit - Number of songs to fetch
   * @param {number} offset - Pagination offset
   */
  async getPopularTracks(limit = 50, offset = 0) {
    try {
      // Return cached data if valid
      if (offset === 0 && this.isCacheValid()) {
        console.log('Returning cached Jamendo data');
        return this.cache;
      }

      console.log(`Fetching ${limit} tracks from Jamendo (offset: ${offset})...`);

      const params = new URLSearchParams({
        client_id: JAMENDO_API_KEY,
        format: 'json',
        limit: Math.min(limit, 100),
        offset: offset,
        order: 'popularity_week',
        audioformat: 'mp31',
        imagesize: '400'
      });

      const url = `${JAMENDO_API}/tracks?${params}`;
      const response = await fetchWithTimeout(url);
      const data = await response.json();

      if (!data || !data.results) {
        console.log('No data returned from Jamendo API');
        return [];
      }

      const songs = data.results.map(track => this.normalizeSong(track));

      // Cache the results if it's the first request
      if (offset === 0) {
        this.cache = songs;
        this.cacheExpiry = Date.now() + (5 * 60 * 1000); // 5 minutes
      }

      console.log(`Fetched ${songs.length} tracks from Jamendo`);
      return songs;
    } catch (error) {
      console.error('Error fetching Jamendo tracks:', error.message);
      return [];
    }
  }

  /**
   * Search tracks by tag/genre
   * @param {string} tags - Comma-separated tags
   * @param {number} limit - Number of results
   */
  async getTracksByTags(tags, limit = 50) {
    try {
      console.log(`Fetching ${limit} tracks with tags: ${tags}...`);

      const params = new URLSearchParams({
        client_id: JAMENDO_API_KEY,
        format: 'json',
        limit: Math.min(limit, 100),
        offset: 0,
        tags: tags,
        audioformat: 'mp31',
        imagesize: '400'
      });

      const url = `${JAMENDO_API}/tracks?${params}`;
      const response = await fetchWithTimeout(url);
      const data = await response.json();

      if (!data || !data.results) {
        return [];
      }

      const songs = data.results.map(track => this.normalizeSong(track));
      console.log(`Fetched ${songs.length} tracks with tags: ${tags}`);
      return songs;
    } catch (error) {
      console.error(`Error fetching Jamendo tracks with tags ${tags}:`, error.message);
      return [];
    }
  }

  /**
   * Fetch newest tracks
   */
  async getNewestTracks(limit = 50) {
    try {
      console.log(`Fetching ${limit} newest tracks from Jamendo...`);

      const params = new URLSearchParams({
        client_id: JAMENDO_API_KEY,
        format: 'json',
        limit: Math.min(limit, 100),
        offset: 0,
        order: 'newestfirst',
        audioformat: 'mp31',
        imagesize: '400'
      });

      const url = `${JAMENDO_API}/tracks?${params}`;
      const response = await fetchWithTimeout(url);
      const data = await response.json();

      if (!data || !data.results) {
        return [];
      }

      const songs = data.results.map(track => this.normalizeSong(track));
      console.log(`Fetched ${songs.length} newest tracks from Jamendo`);
      return songs;
    } catch (error) {
      console.error('Error fetching newest Jamendo tracks:', error.message);
      return [];
    }
  }

  /**
   * Normalize Jamendo track to standard format
   */
  normalizeSong(track) {
    return {
      external_id: `jamendo_${track.id}`,
      source: 'jamendo',
      title: track.name || 'Unknown Title',
      artist: track.artist_name || 'Unknown Artist',
      artwork: track.image || null,
      stream_url: track.audio,
      duration: track.duration || 0,
      genre: this.extractGenre(track.tags),
      release_date: track.releasedate || null,
      play_count: 0,
      source_data: {
        track_id: track.id,
        album_id: track.album_id,
        album_name: track.album_name,
        tags: track.tags || [],
        license: 'royalty_free'
      }
    };
  }

  /**
   * Extract genre from tags
   */
  extractGenre(tags) {
    if (!tags || tags.length === 0) return 'Unknown';
    return tags[0];
  }
}

module.exports = new JamendoAPI();
