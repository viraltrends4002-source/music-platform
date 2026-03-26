/**
 * Music Import Scheduler
 * Automatically imports songs from music APIs on a schedule
 * Uses node-schedule or manual interval-based scheduling
 */

class MusicScheduler {
  constructor(importManager) {
    this.importManager = importManager;
    this.isRunning = false;
    this.lastImportTime = null;
    this.importInterval = null;
    this.importFrequency = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  }

  /**
   * Start the scheduler
   * @param {number} intervalMs - Interval in milliseconds (default: 24 hours)
   * @param {boolean} runNow - Run import immediately
   */
  start(intervalMs = null, runNow = true) {
    if (this.isRunning) {
      console.log('Scheduler is already running');
      return;
    }

    if (intervalMs) {
      this.importFrequency = intervalMs;
    }

    this.isRunning = true;
    console.log(`[Scheduler] Starting music import scheduler (every ${this.importFrequency / 1000 / 60 / 60} hours)`);

    // Run immediately if requested
    if (runNow) {
      console.log('[Scheduler] Running initial import...');
      this.performImport();
    }

    // Schedule periodic imports
    this.importInterval = setInterval(() => {
      this.performImport();
    }, this.importFrequency);

    console.log('[Scheduler] Music scheduler started successfully');
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (!this.isRunning) {
      console.log('Scheduler is not running');
      return;
    }

    if (this.importInterval) {
      clearInterval(this.importInterval);
      this.importInterval = null;
    }

    this.isRunning = false;
    console.log('[Scheduler] Music scheduler stopped');
  }

  /**
   * Perform the actual import
   */
  async performImport() {
    if (!this.importManager) {
      console.error('[Scheduler] Import manager not initialized');
      return;
    }

    const startTime = Date.now();
    console.log(`\n[Scheduler] Starting scheduled import at ${new Date().toISOString()}`);

    try {
      const result = await this.importManager.importFromAllSources(100);

      const duration = (Date.now() - startTime) / 1000;
      this.lastImportTime = new Date();

      if (result.success) {
        console.log(`[Scheduler] ✓ Import completed successfully in ${duration.toFixed(2)}s`);
        console.log(`[Scheduler] Added: ${result.stats.added} songs, Duplicates: ${result.stats.duplicates}, Failed: ${result.stats.failed}`);
      } else {
        console.error(`[Scheduler] ✗ Import failed:`, result.error);
      }

      return result;
    } catch (error) {
      console.error('[Scheduler] Error during scheduled import:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastImportTime: this.lastImportTime,
      importFrequencyHours: this.importFrequency / (60 * 60 * 1000),
      nextImportTime: this.isRunning && this.lastImportTime 
        ? new Date(this.lastImportTime.getTime() + this.importFrequency)
        : null
    };
  }

  /**
   * Get statistics from import manager
   */
  async getStatistics() {
    try {
      return await this.importManager.getStatistics();
    } catch (error) {
      console.error('Error getting statistics:', error);
      return null;
    }
  }

  /**
   * Manually trigger an import
   */
  async triggerManualImport(limit = 100) {
    console.log('[Scheduler] Manual import triggered');
    return this.importManager.importFromAllSources(limit);
  }

  /**
   * Change import frequency
   */
  changeFrequency(intervalMs) {
    const previousFrequency = this.importFrequency;
    this.importFrequency = intervalMs;

    if (this.isRunning) {
      // Restart with new frequency
      this.stop();
      this.start(intervalMs, false);
    }

    console.log(`[Scheduler] Import frequency changed from ${previousFrequency / (60 * 60 * 1000)}h to ${intervalMs / (60 * 60 * 1000)}h`);
  }
}

module.exports = MusicScheduler;
