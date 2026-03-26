/**
 * YouTube Music Integration Module
 * Fetches music videos from YouTube using the YouTube Data API
 * Requires API key from: https://console.developers.google.com/
 */

const { fetch: fetchWithTimeout } = require('./httpClient');

const YOUTUBE_API = 'https://www.googleapis.com/youtube/v3';
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || '';

class YouTubeMusic {
  constructor() {
    this.cache = {};
    this.cacheExpiry = {};
  }

  /**
   * Check if API key is configured
   */
  isConfigured() {
    return YOUTUBE_API_KEY && YOUTUBE_API_KEY.length > 0;
  }

  /**
   * Check if cache is valid
   */
  isCacheValid(key) {
    if (!this.cache[key] || !this.cacheExpiry[key]) return false;
    return Date.now() < this.cacheExpiry[key];
  }

  /**
   * Search for music videos
   * @param {string} query - Search query
   * @param {number} limit - Max results (1-50)
   */
  async searchMusic(query, limit = 30) {
    try {
      if (!this.isConfigured()) {
        console.log('YouTube API key not configured. Returning demo data.');
        return this.getDemoData();
      }

      // Check cache
      const cacheKey = `search_${query}`;
      if (this.isCacheValid(cacheKey)) {
        console.log(`Returning cached YouTube search for: ${query}`);
        return this.cache[cacheKey];
      }

      console.log(`Searching YouTube for: ${query}...`);

      const params = new URLSearchParams({
        key: YOUTUBE_API_KEY,
        q: query,
        part: 'snippet',
        type: 'video',
        maxResults: Math.min(limit, 50),
        order: 'relevance',
        videoCategoryId: '10', // Music category
        region: 'US',
        relevanceLanguage: 'en'
      });

      const url = `${YOUTUBE_API}/search?${params}`;
      const response = await fetchWithTimeout(url);
      const data = await response.json();

      if (!data || !data.items) {
        return [];
      }

      // Get video details (duration)
      const videoIds = data.items.map(item => item.id.videoId).join(',');
      const videos = await this.getVideoDetails(videoIds);

      const songs = data.items.map((item, index) => {
        const videoDetail = videos[index] || {};
        return this.normalizeSong(item, videoDetail);
      });

      // Cache results
      this.cache[cacheKey] = songs;
      this.cacheExpiry[cacheKey] = Date.now() + (10 * 60 * 1000); // 10 minutes

      console.log(`Found ${songs.length} music videos for: ${query}`);
      return songs;
    } catch (error) {
      console.error(`Error searching YouTube for "${query}":`, error.message);
      return [];
    }
  }

  /**
   * Get video details including duration
   */
  async getVideoDetails(videoIds) {
    try {
      if (!this.isConfigured()) {
        return {};
      }

      const params = new URLSearchParams({
        key: YOUTUBE_API_KEY,
        id: videoIds,
        part: 'contentDetails,statistics'
      });

      const url = `${YOUTUBE_API}/videos?${params}`;
      const response = await fetchWithTimeout(url);
      const data = await response.json();

      const details = {};
      if (data && data.items) {
        data.items.forEach((item, index) => {
          details[index] = {
            duration: this.parseDuration(item.contentDetails?.duration || 'PT0S'),
            viewCount: item.statistics?.viewCount || 0,
            likeCount: item.statistics?.likeCount || 0
          };
        });
      }
      return details;
    } catch (error) {
      console.error('Error getting YouTube video details:', error.message);
      return {};
    }
  }

  /**
   * Parse ISO 8601 duration to seconds
   */
  parseDuration(duration) {
    const regex = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
    const matches = duration.match(regex);
    return (
      (parseInt(matches[1] || 0) * 3600) +
      (parseInt(matches[2] || 0) * 60) +
      parseInt(matches[3] || 0)
    );
  }

  /**
   * Fetch trending music videos
   */
  async getTrendingMusic(limit = 30) {
    try {
      if (!this.isConfigured()) {
        return this.getDemoData();
      }

      const cacheKey = 'trending_music';
      if (this.isCacheValid(cacheKey)) {
        return this.cache[cacheKey];
      }

      console.log('Fetching trending music from YouTube...');

      const params = new URLSearchParams({
        key: YOUTUBE_API_KEY,
        part: 'snippet,contentDetails,statistics',
        chart: 'mostPopular',
        maxResults: Math.min(limit, 50),
        videoCategoryId: '10' // Music category
      });

      const url = `${YOUTUBE_API}/videos?${params}`;
      const response = await fetchWithTimeout(url);
      const data = await response.json();

      if (!data || !data.items) {
        return [];
      }

      const songs = data.items.map(item => {
        return this.normalizeSongFromDetail(item);
      });

      this.cache[cacheKey] = songs;
      this.cacheExpiry[cacheKey] = Date.now() + (10 * 60 * 1000);

      console.log(`Fetched ${songs.length} trending music videos`);
      return songs;
    } catch (error) {
      console.error('Error fetching trending YouTube music:', error.message);
      return [];
    }
  }

  /**
   * Normalize YouTube search result
   */
  normalizeSong(searchItem, videoDetail = {}) {
    const snippet = searchItem.snippet;
    const videoId = searchItem.id.videoId;

    return {
      external_id: `youtube_${videoId}`,
      source: 'youtube',
      title: snippet.title || 'Unknown Title',
      artist: snippet.channelTitle || 'Unknown Channel',
      artwork: this.getThumbnailUrl(snippet.thumbnails),
      stream_url: `https://www.youtube-nocookie.com/embed/${videoId}`,
      embedded_url: `https://www.youtube.com/watch?v=${videoId}`,
      duration: videoDetail.duration || 0,
      genre: 'Music',
      release_date: snippet.publishedAt || null,
      play_count: videoDetail.viewCount || 0,
      source_data: {
        video_id: videoId,
        channel_id: snippet.channelId,
        channel_name: snippet.channelTitle,
        views: videoDetail.viewCount || 0,
        likes: videoDetail.likeCount || 0
      }
    };
  }

  /**
   * Normalize YouTube detail result
   */
  normalizeSongFromDetail(item) {
    const snippet = item.snippet;
    const videoId = item.id;
    const duration = this.parseDuration(item.contentDetails?.duration || 'PT0S');
    const views = parseInt(item.statistics?.viewCount || 0);
    const likes = parseInt(item.statistics?.likeCount || 0);

    return {
      external_id: `youtube_${videoId}`,
      source: 'youtube',
      title: snippet.title || 'Unknown Title',
      artist: snippet.channelTitle || 'Unknown Channel',
      artwork: this.getThumbnailUrl(snippet.thumbnails),
      stream_url: `https://www.youtube-nocookie.com/embed/${videoId}`,
      embedded_url: `https://www.youtube.com/watch?v=${videoId}`,
      duration: duration,
      genre: 'Music',
      release_date: snippet.publishedAt || null,
      play_count: views,
      source_data: {
        video_id: videoId,
        channel_id: snippet.channelId,
        channel_name: snippet.channelTitle,
        views: views,
        likes: likes
      }
    };
  }

  /**
   * Get best quality thumbnail
   */
  getThumbnailUrl(thumbnails) {
    if (thumbnails?.maxres) return thumbnails.maxres.url;
    if (thumbnails?.high) return thumbnails.high.url;
    if (thumbnails?.medium) return thumbnails.medium.url;
    if (thumbnails?.default) return thumbnails.default.url;
    return null;
  }

  /**
   * Get demo data for when API key is not configured
   */
  getDemoData() {
    return [
      {
        external_id: 'youtube_demo_1',
        source: 'youtube',
        title: 'Demo Music Video 1',
        artist: 'Demo Artist',
        artwork: null,
        stream_url: null,
        duration: 180,
        genre: 'Music',
        play_count: 1000,
        source_data: { video_id: 'demo_1' }
      }
    ];
  }
}

module.exports = new YouTubeMusic();
