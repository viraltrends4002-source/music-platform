/**
 * Enhanced Music Player - Multi-Source Music Discovery
 * Integrates Audius, Jamendo, YouTube, and local uploads
 * Features: Search, Trending, Playlist, Smart Recommendations
 */

// ========================================
// GLOBAL STATE MANAGEMENT
// ========================================

const musicState = {
  allSongs: [],
  importedSongs: [],
  currentPlaylist: [],
  currentIndex: 0,
  isPlaying: false,
  repeatMode: 0,
  isShuffle: false,
  volume: 1.0,
  currentTab: 'discover',
  likedSongs: JSON.parse(localStorage.getItem('likedSongs')) || [],
  playlists: JSON.parse(localStorage.getItem('playlists')) || [],
  currentSource: 'all',
  songsPlayedCount: 0
};

// ========================================
// DOM ELEMENTS
// ========================================

// Main containers
const playerContainer = document.querySelector('[data-player]');
const songsGrid = document.getElementById('songsGrid');
const playlistContainer = document.getElementById('playlistContainer');

// Search & Filter
const searchInput = document.getElementById('searchInput');
const sourceFilter = document.getElementById('sourceFilter');
const sortSelect = document.getElementById('sortSelect');

// Player controls
const audioElement = document.getElementById('audioPlayer');
const playBtn = document.getElementById('playBtn');
const pauseBtn = document.getElementById('pauseBtn');
const nextBtn = document.getElementById('nextBtn');
const prevBtn = document.getElementById('prevBtn');
const progressBar = document.getElementById('progressBar');
const volumeControl = document.getElementById('volumeControl');

// Info display
const currentSongTitle = document.getElementById('currentSongTitle');
const currentArtist = document.getElementById('currentArtist');
const currentCover = document.getElementById('currentCover');
const songDuration = document.getElementById('songDuration');
const currentTime = document.getElementById('currentTime');

// ========================================
// INITIALIZATION
// ========================================

async function initializeApp() {
  console.log('Initializing Music Discovery App...');
  
  await loadAllSongs();
  setupEventListeners();
  displayDiscoverPage();
  
  console.log('App initialized successfully');
}

// ========================================
// LOAD SONGS FROM MULTIPLE SOURCES
// ========================================

async function loadAllSongs() {
  try {
    // Load imported songs from multiple APIs
    console.log('Loading songs from multiple sources...');
    
    const response = await fetch('/imported-songs?limit=200&offset=0');
    const data = await response.json();
    
    musicState.importedSongs = data.songs || [];
    musicState.allSongs = [...musicState.importedSongs];
    
    // Also load local uploads if any
    const localResponse = await fetch('/songs');
    const localSongs = await localResponse.json();
    
    // Combine with local songs
    musicState.allSongs = [...musicState.allSongs, ...localSongs];
    
    console.log(`Loaded ${musicState.allSongs.length} songs total`);
    console.log(`- Imported from APIs: ${musicState.importedSongs.length}`);
    console.log(`- Local uploads: ${localSongs.length}`);
    
  } catch (error) {
    console.error('Error loading songs:', error);
    showNotification('Error loading songs', 'error');
  }
}

// ========================================
// DISPLAY FUNCTIONS
// ========================================

function displayDiscoverPage() {
  musicState.currentTab = 'discover';
  
  // Build filter options dynamically
  updateSourceFilter();
  
  // Display initial songs
  displaySongs(musicState.allSongs);
}

function updateSourceFilter() {
  const sources = ['all', ...new Set(musicState.allSongs.map(s => s.source || 'local'))];
  
  sourceFilter.innerHTML = sources.map(source => `
    <option value="${source}" ${source === musicState.currentSource ? 'selected' : ''}>
      ${source === 'all' ? 'All Sources' : source.charAt(0).toUpperCase() + source.slice(1)}
    </option>
  `).join('');
}

function displaySongs(songs, layout = 'grid') {
  songsGrid.innerHTML = '';
  
  if (songs.length === 0) {
    songsGrid.innerHTML = `
      <div class="col-span-full text-center py-12 text-gray-400">
        <p class="text-lg">No songs found</p>
        <p class="text-sm">Try adjusting your filters or search</p>
      </div>
    `;
    return;
  }
  
  songs.forEach(song => {
    const card = createSongCard(song);
    songsGrid.appendChild(card);
  });
}

function createSongCard(song) {
  const isLiked = musicState.likedSongs.includes(song.id);
  const sourceIcon = getSourceIcon(song.source);
  
  const row = document.createElement('div');
  row.className = 'song-row';
  row.innerHTML = `
    <img class="song-row-cover" src="${song.artwork || song.cover || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 200 200%22%3E%3Crect fill=%22%23333%22 width=%22200%22 height=%22200%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22 font-size=%2230%22%3E🎵%3C/text%3E%3C/svg%3E'}" alt="${song.title} cover" loading="lazy" />
    
    <div class="song-row-info">
      <p class="song-row-title">${song.title}</p>
      <p class="song-row-artist">${song.artist}</p>
      <p class="song-row-plays">${formatPlayCount(song.play_count || 0)} plays ${sourceIcon}</p>
    </div>
    
    <div class="song-row-actions">
      <button class="like-btn song-row-btn" data-song-id="${song.id}" title="Like">
        <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none">
          <path class="like-icon" d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
      </button>
      
      <button class="download-btn song-row-btn" data-song-id="${song.id}" title="Download">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
      </button>
      
      <button class="play-btn song-row-btn" data-song-id="${song.id}" title="Play">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z"/>
        </svg>
      </button>
    </div>
  `;
  
  // Add event listeners
  row.addEventListener('click', () => {
    musicState.currentSongIndex = musicState.allSongs.findIndex(s => s.id === song.id);
    playSong(song);
  });
  
  const playBtn = row.querySelector('.play-btn');
  playBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    playSong(song);
  });
  
  const likeBtn = row.querySelector('.like-btn');
  if (isLiked) {
    likeBtn.querySelector('.like-icon').style.fill = 'rgb(239, 68, 68)';
    likeBtn.querySelector('.like-icon').style.stroke = 'rgb(239, 68, 68)';
  }
  likeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleLike(song.id, likeBtn);
  });
  
  const downloadBtn = row.querySelector('.download-btn');
  downloadBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    downloadSong(song);
  });
  
  return row;
}

function getSourceIcon(source) {
  const icons = {
    audius: '🎵',
    jamendo: '🎶',
    youtube: '▶️',
    local: '💾'
  };
  return icons[source] || '🎵';
}

function formatPlayCount(count) {
  if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
  if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
  return count.toString();
}

// ========================================
// PLAYER FUNCTIONS
// ========================================

function playSong(song) {
  // Handle different source types
  if (song.embedded_url && song.source === 'youtube') {
    // YouTube songs would need iframe embedding
    showNotification('YouTube songs display as embedded players', 'info');
    displayYouTubePlayer(song);
    return;
  }
  
  audioElement.src = song.stream_url || song.audio;
  currentSongTitle.textContent = song.title;
  currentArtist.textContent = song.artist;
  currentCover.src = song.artwork || song.cover;
  
  audioElement.play();
  musicState.isPlaying = true;
  updatePlayerUI();
  
  // Track play count
  fetch(`/imported-play/${song.id}`, { method: 'POST' }).catch(err => console.error(err));
  
  // Show advert after every 3 songs
  musicState.songsPlayedCount++;
  if (musicState.songsPlayedCount % 3 === 0) {
    showRandomAdvert();
  }
}

function displayYouTubePlayer(song) {
  // Create modal for YouTube player
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/80';
  modal.innerHTML = `
    <div class="relative max-w-2xl w-full mx-4">
      <button class="absolute -top-10 right-0 text-white text-2xl" onclick="this.parentElement.parentElement.remove()">×</button>
      <div class="aspect-video">
        <iframe 
          width="100%" 
          height="100%" 
          src="${song.embedded_url}" 
          frameborder="0" 
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
          allowfullscreen>
        </iframe>
      </div>
      <div class="bg-white/10 p-4 mt-4 rounded-lg">
        <h3 class="font-semibold text-white">${song.title}</h3>
        <p class="text-white/60 text-sm">${song.artist}</p>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function updatePlayerUI() {
  playBtn.classList.toggle('hidden', musicState.isPlaying);
  pauseBtn.classList.toggle('hidden', !musicState.isPlaying);
}

// ========================================
// SEARCH & FILTER
// ========================================

async function performSearch(query) {
  if (!query || query.length < 2) {
    displaySongs(musicState.allSongs);
    return;
  }
  
  try {
    const response = await fetch(`/search-imported?q=${encodeURIComponent(query)}&limit=100`);
    const data = await response.json();
    
    let results = data.results || [];
    
    // Filter by source if needed
    if (musicState.currentSource !== 'all') {
      results = results.filter(s => s.source === musicState.currentSource);
    }
    
    displaySongs(results);
  } catch (error) {
    console.error('Search error:', error);
    showNotification('Search error', 'error');
  }
}

function filterBySource(source) {
  musicState.currentSource = source;
  
  let filtered = musicState.allSongs;
  
  if (source !== 'all') {
    filtered = filtered.filter(s => s.source === source);
  }
  
  displaySongs(filtered);
}

async function loadTrendingSongs() {
  try {
    const response = await fetch('/trending-imported?days=7&limit=100');
    const data = await response.json();
    
    displaySongs(data.songs || []);
  } catch (error) {
    console.error('Trending error:', error);
    showNotification('Error loading trending songs', 'error');
  }
}

// ========================================
// EVENT LISTENERS
// ========================================

function setupEventListeners() {
  // Player Controls
  playBtn.addEventListener('click', () => {
    if (audioElement.src) {
      audioElement.play();
      musicState.isPlaying = true;
      updatePlayerUI();
    }
  });
  
  pauseBtn.addEventListener('click', () => {
    audioElement.pause();
    musicState.isPlaying = false;
    updatePlayerUI();
  });
  
  nextBtn.addEventListener('click', playNextSong);
  prevBtn.addEventListener('click', playPreviousSong);
  
  // Audio events
  audioElement.addEventListener('ended', playNextSong);
  audioElement.addEventListener('timeupdate', updateProgress);
  
  // Volume control
  volumeControl.addEventListener('input', (e) => {
    audioElement.volume = e.target.value / 100;
    musicState.volume = audioElement.volume;
  });
  
  // Search & Filter
  searchInput.addEventListener('debounce', (e) => {
    performSearch(e.target.value);
  });
  
  sourceFilter.addEventListener('change', (e) => {
    filterBySource(e.target.value);
  });
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      if (musicState.isPlaying) pauseBtn.click();
      else playBtn.click();
    }
  });
  
  // Delegation for dynamic elements
  document.addEventListener('click', handleCardInteraction);
}

function handleCardInteraction(e) {
  const playBtn = e.target.closest('.play-btn');
  const likeBtn = e.target.closest('.like-btn');
  const downloadBtn = e.target.closest('.download-btn');
  const addPlaylistBtn = e.target.closest('.add-playlist-btn');
  
  if (playBtn) {
    const songId = playBtn.dataset.songId;
    const song = musicState.allSongs.find(s => s.id == songId);
    if (song) playSong(song);
  }
  
  if (likeBtn) {
    const songId = likeBtn.dataset.songId;
    toggleLike(songId);
  }
  
  if (downloadBtn) {
    const songId = downloadBtn.dataset.songId;
    const song = musicState.allSongs.find(s => s.id == songId);
    if (song) downloadSong(song);
  }
  
  if (addPlaylistBtn) {
    const songId = addPlaylistBtn.dataset.songId;
    const song = musicState.allSongs.find(s => s.id == songId);
    if (song) showPlaylistSelector(song);
  }
}

function playNextSong() {
  musicState.currentIndex = (musicState.currentIndex + 1) % musicState.allSongs.length;
  playSong(musicState.allSongs[musicState.currentIndex]);
}

function playPreviousSong() {
  musicState.currentIndex = (musicState.currentIndex - 1 + musicState.allSongs.length) % musicState.allSongs.length;
  playSong(musicState.allSongs[musicState.currentIndex]);
}

function updateProgress() {
  if (audioElement.duration) {
    const percent = (audioElement.currentTime / audioElement.duration) * 100;
    progressBar.style.width = percent + '%';
    currentTime.textContent = formatTime(audioElement.currentTime);
    songDuration.textContent = formatTime(audioElement.duration);
  }
}

function formatTime(seconds) {
  if (isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function toggleLike(songId) {
  const index = musicState.likedSongs.indexOf(songId);
  if (index > -1) {
    musicState.likedSongs.splice(index, 1);
  } else {
    musicState.likedSongs.push(songId);
  }
  localStorage.setItem('likedSongs', JSON.stringify(musicState.likedSongs));
  
  // Refresh display
  displaySongs(musicState.allSongs);
  showNotification('Like updated', 'success');
}

function downloadSong(song) {
  const link = document.createElement('a');
  link.href = song.stream_url || song.audio;
  link.download = `${song.artist} - ${song.title}.mp3`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showNotification('Download started', 'success');
}

function showPlaylistSelector(song) {
  showNotification(`Added "${song.title}" to favorites`, 'success');
  // Could expand this to create actual playlists
}

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `
    fixed bottom-4 right-4 px-6 py-3 rounded-lg text-white 
    ${type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500'}
    animation-fade-out
  `;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

function showRandomAdvert() {
  showNotification('Enjoy your music! 🎵', 'info');
}

// ========================================
// INITIALIZATION
// ========================================

// Initialize with debounce for search
let searchTimeout;
searchInput?.addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    performSearch(e.target.value);
  }, 300);
});

// Start app
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
