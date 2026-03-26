/**
 * Music Import Manager
 * Coordinates importing songs from multiple sources
 * Handles deduplication, caching, and database operations
 */

const audiusAPI = require('./audiusAPI');
const jamendoAPI = require('./jamendoAPI');
const youtubeAPI = require('./youtubeAPI');
const spotifyAPI = require('./spotifyAPI');

class MusicImportManager {
  constructor(database) {
    this.db = database;
    this.importStats = {
      total: 0,
      added: 0,
      duplicates: 0,
      failed: 0
    };
  }

  /**
   * Import songs from all sources
   * @param {number} limit - Songs per source
   * @returns {Promise<Object>} Import statistics
   */
  async importFromAllSources(limit = 100) {
    console.log('=== Starting multi-source music import ===');
    this.resetStats();

    const auditLog = {
      timestamp: new Date(),
      sources: {}
    };

    try {
      // Import from Audius
      console.log('\n--- Importing from Audius ---');
      auditLog.sources.audius = await this.importFromAudius(limit);

      // Import from Jamendo
      console.log('\n--- Importing from Jamendo ---');
      auditLog.sources.jamendo = await this.importFromJamendo(limit);

      // Import from YouTube (if configured)
      if (youtubeAPI.isConfigured()) {
        console.log('\n--- Importing from YouTube ---');
        auditLog.sources.youtube = await this.importFromYouTube(limit);
      } else {
        console.log('\n--- Skipping YouTube (API key not configured) ---');
      }

      // Import from Spotify (if configured)
      if (spotifyAPI.isConfigured()) {
        console.log('\n--- Importing from Spotify ---');
        auditLog.sources.spotify = await this.importFromSpotify(limit);
      } else {
        console.log('\n--- Skipping Spotify (API credentials not configured) ---');
      }

      console.log('\n=== Import Summary ===');
      console.log(`Total songs processed: ${this.importStats.total}`);
      console.log(`New songs added: ${this.importStats.added}`);
      console.log(`Duplicates skipped: ${this.importStats.duplicates}`);
      console.log(`Failed imports: ${this.importStats.failed}`);

      auditLog.stats = this.importStats;

      return {
        success: true,
        stats: this.importStats,
        auditLog: auditLog
      };
    } catch (error) {
      console.error('Error during multi-source import:', error);
      return {
        success: false,
        error: error.message,
        stats: this.importStats
      };
    }
  }

  /**
   * Import from Audius
   */
  async importFromAudius(limit = 100) {
    const stats = {
      fetched: 0,
      added: 0,
      duplicates: 0,
      failed: 0
    };

    try {
      const songs = await audiusAPI.getTrendingSongs(limit);
      stats.fetched = songs.length;

      for (const song of songs) {
        const result = await this.addSongToDatabase(song);
        if (result === 'added') stats.added++;
        else if (result === 'duplicate') stats.duplicates++;
        else if (result === 'failed') stats.failed++;
      }

      console.log(`Audius: Fetched ${stats.fetched}, Added ${stats.added}, Duplicates ${stats.duplicates}`);
      return stats;
    } catch (error) {
      console.error('Audius import error:', error.message);
      return stats;
    }
  }

  /**
   * Import from Jamendo
   */
  async importFromJamendo(limit = 100) {
    const stats = {
      fetched: 0,
      added: 0,
      duplicates: 0,
      failed: 0
    };

    try {
      // Fetch in batches to cover more songs
      const batches = Math.ceil(limit / 50);
      let allSongs = [];

      for (let i = 0; i < batches; i++) {
        const offset = i * 50;
        const songs = await jamendoAPI.getPopularTracks(50, offset);
        allSongs = allSongs.concat(songs);
        if (allSongs.length >= limit) {
          allSongs = allSongs.slice(0, limit);
          break;
        }
      }

      stats.fetched = allSongs.length;

      for (const song of allSongs) {
        const result = await this.addSongToDatabase(song);
        if (result === 'added') stats.added++;
        else if (result === 'duplicate') stats.duplicates++;
        else if (result === 'failed') stats.failed++;
      }

      console.log(`Jamendo: Fetched ${stats.fetched}, Added ${stats.added}, Duplicates ${stats.duplicates}`);
      return stats;
    } catch (error) {
      console.error('Jamendo import error:', error.message);
      return stats;
    }
  }

  /**
   * Import from YouTube Music
   */
  async importFromYouTube(limit = 100) {
    const stats = {
      fetched: 0,
      added: 0,
      duplicates: 0,
      failed: 0
    };

    try {
      if (!youtubeAPI.isConfigured()) {
        console.log('YouTube API not configured');
        return stats;
      }

      // Search for popular music keywords
      const queries = ['music', 'trending music', 'pop music', 'hip hop', 'rock music'];
      let allSongs = [];

      for (const query of queries) {
        const songs = await youtubeAPI.searchMusic(query, Math.ceil(limit / queries.length));
        allSongs = allSongs.concat(songs);
        if (allSongs.length >= limit) {
          allSongs = allSongs.slice(0, limit);
          break;
        }
      }

      stats.fetched = allSongs.length;

      for (const song of allSongs) {
        const result = await this.addSongToDatabase(song);
        if (result === 'added') stats.added++;
        else if (result === 'duplicate') stats.duplicates++;
        else if (result === 'failed') stats.failed++;
      }

      console.log(`YouTube: Fetched ${stats.fetched}, Added ${stats.added}, Duplicates ${stats.duplicates}`);
      return stats;
    } catch (error) {
      console.error('YouTube import error:', error.message);
      return stats;
    }
  }

  /**
   * Import from Spotify
   */
  async importFromSpotify(limit = 100) {
    const stats = {
      fetched: 0,
      added: 0,
      duplicates: 0,
      failed: 0
    };

    try {
      if (!spotifyAPI.isConfigured()) {
        console.log('Spotify API not configured');
        return stats;
      }

      let allSongs = [];

      // Get trending/new releases
      try {
        const trendingSongs = await spotifyAPI.getTrendingTracks(Math.floor(limit / 3));
        allSongs = allSongs.concat(trendingSongs);
      } catch (e) {
        console.error('Error getting Spotify trending:', e.message);
      }

      // Get featured playlists if we need more songs
      if (allSongs.length < limit) {
        try {
          const featuredSongs = await spotifyAPI.getFeaturedPlaylistsTracks(Math.floor(limit / 3));
          allSongs = allSongs.concat(featuredSongs);
        } catch (e) {
          console.error('Error getting Spotify featured playlists:', e.message);
        }
      }

      // Get category-based songs if we still need more
      if (allSongs.length < limit) {
        try {
          const categorySongs = await spotifyAPI.getCategoryTracks(Math.floor(limit / 3));
          allSongs = allSongs.concat(categorySongs);
        } catch (e) {
          console.error('Error getting Spotify category tracks:', e.message);
        }
      }

      allSongs = allSongs.slice(0, limit);
      stats.fetched = allSongs.length;

      for (const song of allSongs) {
        const result = await this.addSongToDatabase(song);
        if (result === 'added') stats.added++;
        else if (result === 'duplicate') stats.duplicates++;
        else if (result === 'failed') stats.failed++;
      }

      console.log(`Spotify: Fetched ${stats.fetched}, Added ${stats.added}, Duplicates ${stats.duplicates}`);
      return stats;
    } catch (error) {
      console.error('Spotify import error:', error.message);
      return stats;
    }
  }

  /**
   * Add song to database with duplicate check
   * @returns {string} 'added' | 'duplicate' | 'failed'
   */
  async addSongToDatabase(song) {
    const self = this;
    return new Promise((resolve) => {
      self.importStats.total++;

      try {
        // Check for duplicate using external_id or title+artist combination
        const checkQuery = `
          SELECT id FROM imported_songs 
          WHERE external_id = ? OR (LOWER(title) = LOWER(?) AND LOWER(artist) = LOWER(?))
          LIMIT 1
        `;

        self.db.get(checkQuery, [song.external_id, song.title, song.artist], (err, row) => {
          if (err) {
            console.error('Duplicate check error:', err);
            self.importStats.failed++;
            return resolve('failed');
          }

          if (row) {
            // Duplicate found
            self.importStats.duplicates++;
            return resolve('duplicate');
          }

          // Insert new song
          const insertQuery = `
            INSERT INTO imported_songs (
              external_id,
              source,
              title,
              artist,
              artwork,
              stream_url,
              embedded_url,
              duration,
              genre,
              release_date,
              play_count,
              source_data,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;

          const values = [
            song.external_id,
            song.source,
            song.title,
            song.artist,
            song.artwork,
            song.stream_url,
            song.embedded_url || null,
            song.duration || 0,
            song.genre || 'Unknown',
            song.release_date || null,
            song.play_count || 0,
            JSON.stringify(song.source_data || {}),
            new Date(),
            new Date()
          ];

          self.db.run(insertQuery, values, function(err) {
            if (err) {
              console.error(`Failed to insert song "${song.title}":`, err.message);
              self.importStats.failed++;
              resolve('failed');
            } else {
              console.log(`✓ Added: ${song.title} by ${song.artist} (${song.source})`);
              self.importStats.added++;
              resolve('added');
            }
          });
        });
      } catch (error) {
        console.error('Error adding song to database:', error.message);
        self.importStats.failed++;
        resolve('failed');
      }
    });
  }

  /**
   * Search imported songs
   */
  searchSongs(query, limit = 50) {
    return new Promise((resolve, reject) => {
      const searchQuery = `
        SELECT * FROM imported_songs
        WHERE LOWER(title) LIKE LOWER(?) 
           OR LOWER(artist) LIKE LOWER(?)
           OR LOWER(genre) LIKE LOWER(?)
        ORDER BY play_count DESC
        LIMIT ?
      `;

      const searchTerm = `%${query}%`;
      this.db.all(searchQuery, [searchTerm, searchTerm, searchTerm, limit], (err, rows) => {
        if (err) {
          console.error('Search error:', err);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }

  /**
   * Get trending songs (by play count)
   */
  getTrendingSongs(limit = 50, days = 7) {
    return new Promise((resolve, reject) => {
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const query = `
        SELECT * FROM imported_songs
        WHERE updated_at >= ?
        ORDER BY play_count DESC
        LIMIT ?
      `;

      this.db.all(query, [cutoffDate, limit], (err, rows) => {
        if (err) {
          console.error('Trending songs error:', err);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }

  /**
   * Get songs by source
   */
  getSongsBySource(source, limit = 50) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM imported_songs
        WHERE source = ?
        ORDER BY play_count DESC
        LIMIT ?
      `;

      this.db.all(query, [source, limit], (err, rows) => {
        if (err) {
          console.error('Get songs by source error:', err);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }

  /**
   * Update play count
   */
  updatePlayCount(songId) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE imported_songs 
        SET play_count = play_count + 1, updated_at = ?
        WHERE id = ?
      `;

      this.db.run(query, [new Date(), songId], function(err) {
        if (err) {
          console.error('Update play count error:', err);
          return reject(err);
        }
        resolve({ success: true, songId });
      });
    });
  }

  /**
   * Get database statistics
   */
  getStatistics() {
    return new Promise((resolve, reject) => {
      const queries = [
        'SELECT COUNT(*) as total FROM imported_songs',
        'SELECT source, COUNT(*) as count FROM imported_songs GROUP BY source',
        'SELECT SUM(play_count) as total_plays FROM imported_songs'
      ];

      Promise.all([
        new Promise((res) => this.db.get(queries[0], [], (err, row) => {
          res(row || { total: 0 });
        })),
        new Promise((res) => this.db.all(queries[1], [], (err, rows) => {
          res(rows || []);
        })),
        new Promise((res) => this.db.get(queries[2], [], (err, row) => {
          res(row || { total_plays: 0 });
        }))
      ]).then(([totalRow, sourceRows, playsRow]) => {
        resolve({
          total_songs: totalRow.total,
          by_source: sourceRows,
          total_plays: playsRow.total_plays
        });
      }).catch(reject);
    });
  }

  /**
   * Reset import statistics
   */
  resetStats() {
    this.importStats = {
      total: 0,
      added: 0,
      duplicates: 0,
      failed: 0
    };
  }
}

module.exports = MusicImportManager;
