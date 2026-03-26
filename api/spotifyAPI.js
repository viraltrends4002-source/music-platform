/**
 * Spotify API Module
 * Imports songs from Spotify
 * Requires Spotify API credentials
 */

class SpotifyAPI {
  constructor() {
    // Spotify credentials from environment or config
    this.clientId = process.env.SPOTIFY_CLIENT_ID || '';
    this.clientSecret = process.env.SPOTIFY_CLIENT_SECRET || '';
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  /**
   * Check if Spotify is configured
   */
  isConfigured() {
    return !!(this.clientId && this.clientSecret);
  }

  /**
   * Get or refresh access token using Client Credentials flow
   */
  async getAccessToken() {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
      });

      if (!response.ok) {
        throw new Error(`Spotify auth error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // Refresh 1 min before expiry
      
      console.log('[Spotify] Access token obtained');
      return this.accessToken;
    } catch (error) {
      console.error('[Spotify] Error getting access token:', error.message);
      throw error;
    }
  }

  /**
   * Make API request to Spotify
   */
  async makeRequest(endpoint, method = 'GET', body = null) {
    if (!this.isConfigured()) {
      throw new Error('Spotify is not configured');
    }

    const token = await this.getAccessToken();

    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(`https://api.spotify.com/${endpoint}`, options);

      if (!response.ok) {
        throw new Error(`Spotify API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`[Spotify] Request error (${endpoint}):`, error.message);
      throw error;
    }
  }

  /**
   * Get trending/popular tracks
   */
  async getTrendingTracks(limit = 50, offset = 0) {
    try {
      // Get new releases which are good for trending
      const response = await this.makeRequest(
        `v1/browse/new-releases?limit=${Math.min(limit, 50)}&offset=${offset}`
      );

      const tracks = [];
      if (response.albums && response.albums.items) {
        for (const album of response.albums.items.slice(0, limit)) {
          tracks.push(...this.formatAlbumTracks(album));
        }
      }

      return tracks.slice(0, limit);
    } catch (error) {
      console.error('[Spotify] Error getting trending tracks:', error.message);
      return [];
    }
  }

  /**
   * Search for tracks
   */
  async searchTracks(query, limit = 50) {
    try {
      const response = await this.makeRequest(
        `v1/search?q=${encodeURIComponent(query)}&type=track&limit=${Math.min(limit, 50)}`
      );

      return response.tracks?.items?.map(track => this.formatTrack(track)) || [];
    } catch (error) {
      console.error('[Spotify] Error searching tracks:', error.message);
      return [];
    }
  }

  /**
   * Get playlist tracks
   */
  async getPlaylistTracks(playlistId, limit = 50) {
    try {
      const response = await this.makeRequest(
        `v1/playlists/${playlistId}/tracks?limit=${Math.min(limit, 50)}`
      );

      return response.items?.map(item => this.formatTrack(item.track)).filter(t => t) || [];
    } catch (error) {
      console.error('[Spotify] Error getting playlist tracks:', error.message);
      return [];
    }
  }

  /**
   * Get featured playlists (for discovering songs)
   */
  async getFeaturedPlaylistsTracks(limit = 50) {
    try {
      const playlistsResponse = await this.makeRequest('v1/browse/featured-playlists?limit=5');
      const playlists = playlistsResponse.playlists?.items || [];

      const tracks = [];
      for (const playlist of playlists) {
        const playlistTracks = await this.getPlaylistTracks(playlist.id, Math.ceil(limit / 5));
        tracks.push(...playlistTracks);
      }

      return tracks.slice(0, limit);
    } catch (error) {
      console.error('[Spotify] Error getting featured playlists:', error.message);
      return [];
    }
  }

  /**
   * Format Spotify track to standard format
   */
  formatTrack(track) {
    if (!track) return null;

    try {
      // Get preview URL or use streaming info
      const previewUrl = track.preview_url;
      
      if (!previewUrl) {
        // Skip tracks without preview
        return null;
      }

      return {
        external_id: track.id,
        source: 'spotify',
        title: track.name,
        artist: track.artists?.map(a => a.name).join(', ') || 'Unknown Artist',
        artwork: track.album?.images?.[0]?.url || '',
        stream_url: previewUrl,
        embedded_url: null,
        duration: Math.floor((track.duration_ms || 0) / 1000),
        genre: track.genre || '',
        release_date: track.album?.release_date || new Date().toISOString(),
        source_data: JSON.stringify({
          spotify_id: track.id,
          album: track.album?.name,
          popularity: track.popularity,
          explicit: track.explicit,
          external_urls: track.external_urls
        })
      };
    } catch (error) {
      console.error('[Spotify] Error formatting track:', error.message);
      return null;
    }
  }

  /**
   * Format album tracks to standard format
   */
  formatAlbumTracks(album) {
    if (!album?.tracks?.items) return [];

    return album.tracks.items
      .filter(track => track.preview_url) // Only tracks with preview
      .map(track => ({
        external_id: track.id,
        source: 'spotify',
        title: track.name,
        artist: track.artists?.map(a => a.name).join(', ') || 'Unknown Artist',
        artwork: album.images?.[0]?.url || '',
        stream_url: track.preview_url,
        embedded_url: null,
        duration: Math.floor((track.duration_ms || 0) / 1000),
        genre: album.genres?.[0] || '',
        release_date: album.release_date || new Date().toISOString(),
        source_data: JSON.stringify({
          spotify_id: track.id,
          album: album.name,
          album_id: album.id,
          popularity: track.popularity,
          explicit: track.explicit,
          external_urls: track.external_urls
        })
      }))
      .filter(track => track.stream_url);
  }

  /**
   * Get categories and populate with songs
   */
  async getCategoryTracks(limit = 50) {
    try {
      const categoriesResponse = await this.makeRequest('v1/browse/categories?limit=10');
      const categories = categoriesResponse.categories?.items || [];

      const tracks = [];
      for (const category of categories.slice(0, 5)) {
        try {
          const playlistsResponse = await this.makeRequest(
            `v1/browse/categories/${category.id}/playlists?limit=2`
          );
          
          const playlists = playlistsResponse.playlists?.items || [];
          for (const playlist of playlists) {
            const playlistTracks = await this.getPlaylistTracks(playlist.id, Math.ceil(limit / 10));
            tracks.push(...playlistTracks);
          }
        } catch (e) {
          console.error(`[Spotify] Error getting category ${category.id} tracks:`, e.message);
        }
      }

      return tracks.slice(0, limit);
    } catch (error) {
      console.error('[Spotify] Error getting category tracks:', error.message);
      return [];
    }
  }
}

module.exports = new SpotifyAPI();
