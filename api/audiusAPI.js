/**
 * Audius API Integration Module
 * Fetches trending and popular tracks from Audius
 */

const { fetch: fetchWithTimeout } = require('./httpClient');

const AUDIUS_API = 'https://discoveryprovider.audius.co/v1';

class AudiusAPI {
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
   * Fetch trending songs from Audius
   * @param {number} limit - Number of songs to fetch (max 100)
   * @returns {Promise<Array>} Array of song objects
   */
  async getTrendingSongs(limit = 100) {
    try {
      // Return cached data if valid
      if (this.isCacheValid()) {
        console.log('Returning cached Audius data');
        return this.cache;
      }

      console.log(`Fetching ${limit} trending songs from Audius...`);
      
      const url = `${AUDIUS_API}/tracks/trending?limit=${Math.min(limit, 100)}&offset=0`;
      const response = await fetchWithTimeout(url);
      const data = await response.json();

      if (!data || !data.data) {
        console.log('No data returned from Audius API');
        return [];
      }

      const songs = data.data.map(track => this.normalizeSong(track));
      
      // Cache the results
      this.cache = songs;
      this.cacheExpiry = Date.now() + (5 * 60 * 1000); // 5 minutes

      console.log(`Fetched ${songs.length} songs from Audius`);
      return songs;
    } catch (error) {
      console.error('Error fetching Audius trending songs:', error.message);
      return [];
    }
  }

  /**
   * Fetch songs by genre
   * @param {string} genre - Genre name
   * @param {number} limit - Number of songs
   */
  async getSongsByGenre(genre, limit = 50) {
    try {
      console.log(`Fetching ${limit} ${genre} songs from Audius...`);
      
      const url = `${AUDIUS_API}/feeds/explore?limit=${Math.min(limit, 50)}&offset=0`;
      const response = await fetchWithTimeout(url);
      const data = await response.json();

      if (!data || !data.data) {
        return [];
      }

      const songs = data.data.map(track => this.normalizeSong(track));
      console.log(`Fetched ${songs.length} ${genre} songs from Audius`);
      return songs;
    } catch (error) {
      console.error(`Error fetching ${genre} songs from Audius:`, error.message);
      return [];
    }
  }

  /**
   * Normalize Audius track to standard format
   */
  normalizeSong(track) {
    let artwork = null;
    
    // Handle different Audius artwork formats
    if (track.artwork) {
      if (typeof track.artwork === 'string') {
        artwork = this.getImageUrl(track.artwork);
      } else if (typeof track.artwork === 'object') {
        artwork = this.getImageUrl(
          track.artwork['480x480'] || 
          track.artwork['1000x1000'] || 
          track.artwork['150x150'] ||
          track.artwork.url
        );
      }
    }
    
    return {
      external_id: `audius_${track.id}`,
      source: 'audius',
      title: track.title || 'Unknown Title',
      artist: track.user?.name || 'Unknown Artist',
      artwork: artwork,
      stream_url: `${AUDIUS_API}/tracks/${track.id}/stream`,
      duration: track.duration || 0,
      genre: track.genre || 'Unknown',
      release_date: track.release_date || null,
      play_count: track.play_count || 0,
      source_data: {
        track_id: track.id,
        user_id: track.user?.id,
        favorited: track.favorited_by_count || 0
      }
    };
  }

  /**
   * Convert Audius image URL to proper format
   */
  getImageUrl(url) {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return `https://audius.co${url}`;
  }

  /**
   * Get stream URL for a track
   */
  getStreamUrl(trackId) {
    return `${AUDIUS_API}/tracks/${trackId}/stream`;
  }

  /**
   * Verify track is still available
   */
  async verifyTrack(trackId) {
    try {
      const url = `${AUDIUS_API}/tracks/${trackId}`;
      const response = await fetchWithTimeout(url);
      const data = await response.json();
      return data && data.data;
    } catch (error) {
      console.error(`Track ${trackId} verification failed:`, error.message);
      return null;
    }
  }
}

module.exports = new AudiusAPI();
