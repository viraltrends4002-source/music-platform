/**
 * Cross-compatible HTTP client
 * Uses native fetch if available, falls back to http/https modules
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

// Simple fetch wrapper with timeout - works on Node.js 18+
async function nativeFetch(url, options = {}, timeout = 10000) {
  if (typeof global.fetch !== 'undefined') {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }
  
  // Fallback for older Node.js versions
  return fallbackFetch(url, options, timeout);
}

// Fallback HTTP client for older Node.js versions
function fallbackFetch(urlString, options = {}, timeout = 10000) {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(urlString);
      const isHttps = url.protocol === 'https:';
      const client = isHttps ? https : http;

      const requestOptions = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: options.method || 'GET',
        headers: options.headers || {}
      };

      const timeoutId = setTimeout(() => {
        req.abort();
        reject(new Error('Request timeout'));
      }, timeout);

      const req = client.request(requestOptions, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          clearTimeout(timeoutId);
          
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`HTTP ${res.statusCode}`));
            return;
          }

          // Create a fetch-like response object
          const response = {
            ok: true,
            status: res.statusCode,
            headers: res.headers,
            text: () => Promise.resolve(data),
            json: () => {
              try {
                return Promise.resolve(JSON.parse(data));
              } catch (e) {
                return Promise.reject(e);
              }
            }
          };

          resolve(response);
        });
      });

      req.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });

      if (options.body) {
        req.write(options.body);
      }

      req.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  fetch: nativeFetch
};
