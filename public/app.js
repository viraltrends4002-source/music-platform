// Global variables
let allSongs = []
let currentFilteredSongs = []
let currentPage = 1
const PAGE_SIZE = 50
let currentIndex = 0
let isPlaying = false
let repeatMode = 0
let isShuffle = false
let likedSongs = JSON.parse(localStorage.getItem('likedSongs')) || []
let userPlaylists = JSON.parse(localStorage.getItem('userPlaylists')) || []
let currentPlaylistIndex = 0
let recentlyPlayed = JSON.parse(localStorage.getItem('recentlyPlayed')) || []
let songsPlayedCount = 0
let advertData = null
let allAdverts = []
let currentUser = null

// DOM elements
const songsContainer = document.getElementById("songs")
const audio = document.getElementById("audio")
const songCount = document.getElementById("songCount")

// Authentication elements
const authButton = document.getElementById("authButton")
const userProfile = document.getElementById("userProfile")

// Check authentication status on page load
function checkAuthStatus() {
  const token = localStorage.getItem('token')
  const user = localStorage.getItem('user')
  
  if (token && user) {
    currentUser = JSON.parse(user)
    
    // Update UI to show logged in state
    userProfile.textContent = `Welcome, ${currentUser.username}!`
    userProfile.classList.remove('hidden')
    authButton.textContent = 'Logout'
    authButton.onclick = logout
    
    // If user is artist, show a redirect button instead
    if (currentUser.accountType === 'artist') {
      authButton.textContent = 'Go to Dashboard'
      authButton.onclick = () => window.location.href = 'artist-dashboard.html'
    }
  } else {
    authButton.textContent = 'Login'
    authButton.onclick = () => window.location.href = 'login.html'
  }
}

// Logout function
function logout() {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  currentUser = null
  location.reload()
}

function ensurePlaylists() {
  if (!Array.isArray(userPlaylists)) {
    userPlaylists = []
  }

  if (userPlaylists.length === 0) {
    userPlaylists.push({ id: Date.now(), name: 'Favorites', songs: [] })
  }

  const saved = localStorage.getItem('userPlaylists')
  if (!saved) {
    localStorage.setItem('userPlaylists', JSON.stringify(userPlaylists))
  }
}

function savePlaylists() {
  localStorage.setItem('userPlaylists', JSON.stringify(userPlaylists))
}

// Bottom player bar
const playerBar = document.getElementById("playerBar")
const playerBarCover = document.getElementById("playerBarCover")
const playerBarTitle = document.getElementById("playerBarTitle")
const playerBarArtist = document.getElementById("playerBarArtist")
const playerBarPlayBtn = document.getElementById("playerBarPlayBtn")
const playerBarProgress = document.getElementById("playerBarProgress")
const playerBarTime = document.getElementById("playerBarTime")
const playerBarDuration = document.getElementById("playerBarDuration")

// Advert modal
const advertModal = document.getElementById("advertModal")
const advertClose = document.getElementById("advertClose")
const advertImage = document.getElementById("advertImage")
const advertTitle = document.getElementById("advertTitle")
const advertDescription = document.getElementById("advertDescription")
const advertLink = document.getElementById("advertLink")

// Utility functions
function formatTime(seconds) {
  if (isNaN(seconds)) return "0:00"
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

// Load all songs from server
async function loadSongs(){
  try {
    // Load imported songs from APIs
    const res = await fetch("/imported-songs?limit=200")
    const data = await res.json()
    allSongs = data.songs || []
    
    // Also load user-uploaded songs
    try {
      const userRes = await fetch("/songs")
      const userSongs = await userRes.json()
      allSongs = [...allSongs, ...(userSongs || [])]
    } catch (e) {
      console.log('No user songs to load')
    }
    
    currentFilteredSongs = allSongs
    currentPage = 1
    ensurePlaylists()
    renderCurrentPage()
    updateRecentlyPlayed()
    loadAdvertData()
  } catch (error) {
    console.error("Error loading songs:", error)
  }
}

// Display songs in horizontal list with modern row styling (YouTube Music style)
function displaySongs(songs){
  songsContainer.innerHTML = ""
  songCount.innerText = songs.length

  songs.forEach((song) => {
    const isLiked = likedSongs.includes(song.id)
    
    // Create song row
    const row = document.createElement("div")
    row.className = "song-row"
    
    row.innerHTML = `
      <img class="song-row-cover" src="${song.artwork || song.cover || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 200 200%22%3E%3Crect fill=%22%23333%22 width=%22200%22 height=%22200%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22 font-size=%2230%22%3E🎵%3C/text%3E%3C/svg%3E'}" alt="${song.title} cover" />
      
      <div class="song-row-info">
        <p class="song-row-title">${song.title}</p>
        <p class="song-row-artist artist-link" data-artist="${song.artist}">${song.artist}</p>
        <p class="song-row-plays">${song.plays || 0} plays</p>
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

        <button class="add-to-playlist-btn song-row-btn" data-song-id="${song.id}" title="Add to Playlist">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" fill="none"/>
          </svg>
        </button>
        
        <button class="play-btn song-row-btn" data-song-id="${song.id}" title="Play">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </button>
      </div>
    `

    // Play button
    const playBtn = row.querySelector(".play-btn")
    playBtn.addEventListener("click", (e) => {
      e.stopPropagation()
      currentIndex = allSongs.findIndex(s => s.id === song.id)
      playSong(allSongs[currentIndex])
    })

    // Like button
    const likeBtn = row.querySelector(".like-btn")
    if (isLiked) {
      likeBtn.querySelector('.like-icon').style.fill = 'rgb(239, 68, 68)'
      likeBtn.querySelector('.like-icon').style.stroke = 'rgb(239, 68, 68)'
    }
    likeBtn.addEventListener("click", (e) => {
      e.stopPropagation()
      toggleLike(song.id, likeBtn)
    })

    // Download button
    const downloadBtn = row.querySelector(".download-btn")
    downloadBtn.addEventListener("click", (e) => {
      e.stopPropagation()
      downloadSong(song)
    })

    // Add to playlist button
    const addToPlaylistBtn = row.querySelector(".add-to-playlist-btn")
    addToPlaylistBtn.addEventListener("click", (e) => {
      e.stopPropagation()
      addToPlaylist(song)
    })

    // Artist name click opens profile
    const artistLink = row.querySelector('.artist-link')
    if (artistLink) {
      artistLink.addEventListener('click', (e) => {
        e.stopPropagation()
        showArtistProfile(artistLink.getAttribute('data-artist') || song.artist)
      })
    }

    // Row click to play
    row.addEventListener("click", () => {
      currentIndex = allSongs.findIndex(s => s.id === song.id)
      playSong(allSongs[currentIndex])
    })

    songsContainer.appendChild(row)
  })
}

function renderCurrentPage() {
  const start = (currentPage - 1) * PAGE_SIZE
  const end = start + PAGE_SIZE
  const pageSongs = currentFilteredSongs.slice(start, end)
  displaySongs(pageSongs)
  document.getElementById('pageNumber').innerText = currentPage

  document.getElementById('prevPage').disabled = currentPage === 1
  document.getElementById('nextPage').disabled = end >= currentFilteredSongs.length
}

function updateRecentlyPlayed() {
  const container = document.getElementById('recentlyPlayed')
  container.innerHTML = ''

  const unique = [...new Map(recentlyPlayed.map(song => [song.id, song])).values()].slice(0, 5)
  unique.forEach(song => {
    const row = document.createElement('div')
    row.className = 'song-row'
    row.innerHTML = `<div class="song-row-info"><p class="song-row-title">${song.title}</p><p class="song-row-artist">${song.artist}</p></div>`
    container.appendChild(row)
  })
}

function getActivePlaylist() {
  if (userPlaylists.length === 0) {
    userPlaylists.push({ id: Date.now(), name: 'Favorites', songs: [] })
  }
  if (currentPlaylistIndex >= userPlaylists.length) {
    currentPlaylistIndex = 0
  }
  return userPlaylists[currentPlaylistIndex]
}

function addToPlaylist(song) {
  const activePlaylist = getActivePlaylist()
  if (!activePlaylist.songs.find(item => item.id === song.id)) {
    activePlaylist.songs.push(song)
    savePlaylists()
    showToast(`Added "${song.title}" to ${activePlaylist.name}`)
  } else {
    showToast(`Song is already in ${activePlaylist.name}`)
  }
}

function removeFromPlaylist(songId, playlistId) {
  const playlist = userPlaylists.find(p => p.id === playlistId)
  if (!playlist) return
  playlist.songs = playlist.songs.filter(song => song.id !== songId)
  savePlaylists()
  renderPlaylistModal()
}

function createPlaylist(name) {
  if (!name || !name.trim()) {
    showToast('Enter a valid playlist name')
    return
  }

  const trimmedName = name.trim()
  if (userPlaylists.find(p => p.name.toLowerCase() === trimmedName.toLowerCase())) {
    showToast('Playlist name already exists')
    return
  }

  userPlaylists.push({ id: Date.now(), name: trimmedName, songs: [] })
  currentPlaylistIndex = userPlaylists.length - 1
  savePlaylists()
  renderPlaylistModal()
  showToast(`Created playlist ${trimmedName}`)
}

function selectPlaylist(index) {
  if (index < 0 || index >= userPlaylists.length) return
  currentPlaylistIndex = index
  savePlaylists()
  renderPlaylistModal()
}

function renderPlaylistModal() {
  const playlistModal = document.getElementById('playlistModal')
  const playlistList = document.getElementById('playlistList')
  const playlistSongs = document.getElementById('playlistSongs')
  const playlistTitle = document.getElementById('playlistTitle')

  if (!playlistModal || !playlistList || !playlistSongs || !playlistTitle) return

  playlistList.innerHTML = ''
  userPlaylists.forEach((playlist, index) => {
    const button = document.createElement('button')
    button.className = `px-3 py-2 rounded-lg text-left w-full ${index === currentPlaylistIndex ? 'bg-indigo-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`
    button.textContent = playlist.name
    button.onclick = () => selectPlaylist(index)
    playlistList.appendChild(button)
  })

  const activePlaylist = getActivePlaylist()
  playlistTitle.textContent = `${activePlaylist.name} (${activePlaylist.songs.length})`

  playlistSongs.innerHTML = ''
  if (activePlaylist.songs.length === 0) {
    playlistSongs.innerHTML = '<p class="text-white/60">No songs in this playlist yet.</p>'
  } else {
    activePlaylist.songs.forEach(song => {
      const item = document.createElement('div')
      item.className = 'song-row'
      item.innerHTML = `<div class="song-row-info"><p class="song-row-title">${song.title}</p><p class="song-row-artist">${song.artist}</p></div><button class="song-row-btn" title="Remove">✕</button>`
      item.querySelector('button').addEventListener('click', (e) => {
        e.stopPropagation()
        removeFromPlaylist(song.id, activePlaylist.id)
      })
      item.addEventListener('click', () => playSong(song))
      playlistSongs.appendChild(item)
    })
  }
}

function openPlaylistModal() {
  ensurePlaylists()
  renderPlaylistModal()
  const playlistModal = document.getElementById('playlistModal')
  if (playlistModal) {
    playlistModal.classList.remove('hidden')
    playlistModal.classList.add('flex')
  }
}

function closePlaylistModal() {
  const playlistModal = document.getElementById('playlistModal')
  if (playlistModal) {
    playlistModal.classList.add('hidden')
    playlistModal.classList.remove('flex')
  }
}

function showToast(message) {
  const toast = document.createElement('div')
  toast.textContent = message
  toast.className = 'fixed bottom-24 right-6 z-50 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-lg'
  document.body.appendChild(toast)
  setTimeout(() => toast.remove(), 1800)
}

// Play song
async function playSong(song) {
  // Handle both imported songs (stream_url) and uploaded songs (audio)
  const audioUrl = song.audio || song.stream_url || song.embedded_url
  
  if (!audioUrl) {
    console.error("No audio URL found for song:", song)
    showErrorNotification("Unable to play this song - no audio source available")
    return
  }
  
  // Show loading state
  playerBarTitle.innerText = song.title
  playerBarArtist.innerText = song.artist
  playerBarTitle.innerHTML += ' <span class="text-xs text-indigo-400">🔄 Loading...</span>'
  
  audio.src = audioUrl
  
  playerBarCover.src = song.cover || song.artwork || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 200 200%22%3E%3Crect fill=%22%23333%22 width=%22200%22 height=%22200%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22 font-size=%2230%22%3E🎵%3C/text%3E%3C/svg%3E'
  document.getElementById('playerBarDescription').innerText = `Description: ${song.description || 'N/A'}`
  document.getElementById('playerBarLyrics').innerText = `Lyrics: ${song.lyrics ? song.lyrics.slice(0, 120) + (song.lyrics.length > 120 ? '...' : '') : 'N/A'}`
  playerBarTime.innerText = "0:00"
  playerBarDuration.innerText = "0:00"

  try {
    await audio.play()
    isPlaying = true
    playerBarTitle.innerText = song.title // Remove loading text
    updatePlayButtons()
    
    // Log play - try both endpoints for imported and uploaded songs
    const playEndpoint = song.external_id ? "/imported-play/" + song.id : "/play/" + song.id
    try {
      await fetch(playEndpoint, { method: "POST" })
    } catch (e) {
      console.log("Could not log play count")
    }
    
    song.plays = (song.plays || 0) + 1
    song.play_count = (song.play_count || 0) + 1
    songsPlayedCount++

    // update recently played
    recentlyPlayed.unshift(song)
    if (recentlyPlayed.length > 20) recentlyPlayed.pop()
    localStorage.setItem('recentlyPlayed', JSON.stringify(recentlyPlayed))
    updateRecentlyPlayed()
    
    // Show advert after every 3 songs
    if (songsPlayedCount % 3 === 0 && advertData) {
      showAdvert()
    }
    
    renderCurrentPage()
  } catch (error) {
    console.error("Error playing song:", error)
    playerBarTitle.innerText = song.title
    showErrorNotification(`Error playing song: ${error.message}. Retrying in 3 seconds...`)
    
    // Retry once after 3 seconds
    setTimeout(() => {
      audio.play().catch(err => {
        console.error("Retry failed:", err)
        showErrorNotification("Failed to play song. Please try again.")
        isPlaying = false
        updatePlayButtons()
      })
    }, 3000)
  }
}

// Show error notification
function showErrorNotification(message) {
  console.error("Notification:", message)
  // You could create a toast notification here instead of alert
  // For now, we'll just log it
}

// Update play buttons
function updatePlayButtons() {
  const icon = isPlaying 
    ? '<svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>'
    : '<svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>'
  playerBarPlayBtn.innerHTML = icon
}

// Download song
function downloadSong(song) {
  // Handle both imported songs (stream_url) and uploaded songs (audio)
  const audioUrl = song.audio || song.stream_url || song.embedded_url
  
  if (!audioUrl) {
    alert("This song cannot be downloaded - no audio source available")
    return
  }
  
  const link = document.createElement('a')
  link.href = audioUrl
  link.download = `${song.artist} - ${song.title}.mp3`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// Toggle like
function toggleLike(songId, button) {
  const index = likedSongs.indexOf(songId)
  
  if (index > -1) {
    likedSongs.splice(index, 1)
    button.querySelector('svg').classList.remove('fill-red-500', 'text-red-500')
    button.querySelector('svg').classList.add('text-white')
  } else {
    likedSongs.push(songId)
    button.querySelector('svg').classList.remove('text-white')
    button.querySelector('svg').classList.add('fill-red-500', 'text-red-500')
  }
  
  localStorage.setItem('likedSongs', JSON.stringify(likedSongs))
}

// Load advert data
async function loadAdvertData() {
  try {
    const res = await fetch("/adverts")
    if (res.ok) {
      allAdverts = await res.json()
      if (allAdverts.length > 0) {
        // Get the next advert in rotation
        advertData = allAdverts[currentAdvertIndex % allAdverts.length]
        currentAdvertIndex++
      }
    }
  } catch (error) {
    console.error("Error loading adverts:", error)
  }
}

// Show advert modal
function showAdvert() {
  if (!advertData || !advertData.enabled) return
  
  advertTitle.innerText = advertData.title
  advertDescription.innerText = advertData.description || ""
  advertLink.href = advertData.link || "#"
  
  // Check if it's a video or image advert
  if (advertData.type === 'video' && advertData.video) {
    advertImage.style.display = 'none'
    // Create video element if it doesn't exist
    let videoElement = document.getElementById('advertVideo')
    if (!videoElement) {
      videoElement = document.createElement('video')
      videoElement.id = 'advertVideo'
      videoElement.className = 'mb-4 h-48 w-full rounded-xl object-cover'
      videoElement.controls = false
      videoElement.style.display = 'block'
      advertImage.parentNode.insertBefore(videoElement, advertImage.nextSibling)
    }
    videoElement.src = advertData.video
    videoElement.style.display = 'block'
    videoElement.play()
  } else if (advertData.image) {
    // Image advert
    advertImage.src = advertData.image
    advertImage.style.display = 'block'
    let videoElement = document.getElementById('advertVideo')
    if (videoElement) {
      videoElement.style.display = 'none'
      videoElement.pause()
    }
  }
  
  advertModal.classList.remove("hidden")
  advertModal.classList.add("flex")
  
  // Auto-close after duration
  setTimeout(() => {
    advertModal.classList.add("hidden")
    advertModal.classList.remove("flex")
    let videoElement = document.getElementById('advertVideo')
    if (videoElement) {
      videoElement.pause()
    }
  }, (advertData.duration || 5) * 1000)
}

// Close advert
advertClose.addEventListener("click", () => {
  advertModal.classList.add("hidden")
  advertModal.classList.remove("flex")
})

// Audio events
audio.addEventListener("timeupdate", () => {
  const percent = (audio.currentTime / audio.duration) * 100 || 0
  playerBarProgress.style.width = percent + "%"
  playerBarTime.innerText = formatTime(audio.currentTime)
})

audio.addEventListener("loadedmetadata", () => {
  playerBarDuration.innerText = formatTime(audio.duration)
})

audio.addEventListener("ended", () => {
  currentIndex = (currentIndex + 1) % allSongs.length
  if (currentIndex > 0) {
    playSong(allSongs[currentIndex])
  } else {
    isPlaying = false
    updatePlayButtons()
  }
})

// Audio error handling
audio.addEventListener("error", (e) => {
  console.error("Audio error:", e)
  const errorMessage = audio.error ? `Error: ${audio.error.message}` : "Unknown audio error"
  console.error("Audio error details:", audio.error)
  
  if (audio.error && audio.error.code === 4) {
    console.error("CORS or network error - audio source may not be accessible from this domain")
  }
})

// Player bar controls
playerBarPlayBtn.addEventListener("click", (e) => {
  e.stopPropagation()
  if (audio.src) {
    if (isPlaying) {
      audio.pause()
      isPlaying = false
    } else {
      audio.play()
      isPlaying = true
    }
    updatePlayButtons()
  }
})

// Previous/Next controls
document.getElementById('playerBarPrevBtn').addEventListener('click', () => {
  if (currentIndex > 0) {
    currentIndex--
    playSong(allSongs[currentIndex])
  }
})

document.getElementById('playerBarNextBtn').addEventListener('click', () => {
  if (currentIndex < allSongs.length - 1) {
    currentIndex++
    playSong(allSongs[currentIndex])
  }
})

// Volume controls
const volumeSlider = document.getElementById('volumeSlider')
const volumeBtn = document.getElementById('volumeBtn')

volumeSlider.addEventListener('input', (e) => {
  audio.volume = e.target.value
  updateVolumeIcon()
})

volumeBtn.addEventListener('click', () => {
  if (audio.volume > 0) {
    audio.volume = 0
    volumeSlider.value = 0
  } else {
    audio.volume = 0.7
    volumeSlider.value = 0.7
  }
  updateVolumeIcon()
})

function updateVolumeIcon() {
  const icon = audio.volume === 0
    ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zM17 7l2 2m0 0l2 2m-2-2l-2 2m2-2l2-2"/>'
    : audio.volume < 0.5
    ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zM15.657 8.343a1 1 0 010 1.414A7.994 7.994 0 0017 11a7.994 7.994 0 00-.343 2.657 1 1 0 01-1.414.707 6 6 0 010-8.485 1 1 0 011.414.707z"/>'
    : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>'
  volumeBtn.innerHTML = `<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">${icon}</svg>`
}

// Initialize volume
audio.volume = 0.7
volumeSlider.value = 0.7
updateVolumeIcon()

// Contact Modal Functions
const contactModal = document.getElementById("contactModal")
const contactClose = document.getElementById("contactClose")
const contactOptions = document.getElementById("contactOptions")
const contactForm = document.getElementById("contactForm")
const whatsappOptions = document.getElementById("whatsappOptions")

// Open Contact Modal
function openContactModal() {
  contactModal.classList.remove("hidden")
  contactModal.classList.add("flex")
  showContactOptions()
}

// Close Contact Modal
contactClose.addEventListener("click", () => {
  contactModal.classList.add("hidden")
  contactModal.classList.remove("flex")
})

// Show Contact Options
function showContactOptions() {
  contactOptions.classList.remove("hidden")
  contactForm.classList.add("hidden")
  whatsappOptions.classList.add("hidden")
}

// Open Contact Form
function openContactForm() {
  contactOptions.classList.add("hidden")
  contactForm.classList.remove("hidden")
  whatsappOptions.classList.add("hidden")
}

// Show WhatsApp Options
function openWhatsAppOptions() {
  contactOptions.classList.add("hidden")
  contactForm.classList.add("hidden")
  whatsappOptions.classList.remove("hidden")
}

// Back to Contact Options
function backToContactOptions() {
  showContactOptions()
}

// Submit Contact Form
async function submitContactForm() {
  const name = document.getElementById("contactName").value.trim()
  const email = document.getElementById("contactEmail").value.trim()
  const subject = document.getElementById("contactSubject").value
  const message = document.getElementById("contactMessage").value.trim()
  
  if (!name || !email || !message) {
    alert("Please fill in all fields")
    return
  }
  
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    alert("Please enter a valid email address")
    return
  }
  
  try {
    const response = await fetch("/contact-message", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name,
        email,
        subject,
        message
      })
    })
    
    const result = await response.json()
    
    if (response.ok) {
      alert(result.message)
      // Clear form
      document.getElementById("contactName").value = ""
      document.getElementById("contactEmail").value = ""
      document.getElementById("contactSubject").value = "promote_song"
      document.getElementById("contactMessage").value = ""
      // Close modal
      contactModal.classList.add("hidden")
      contactModal.classList.remove("flex")
    } else {
      alert(result.message || "Error sending message")
    }
  } catch (error) {
    console.error("Error:", error)
    alert("Error sending message. Please try again.")
  }
}

// Send WhatsApp Message
function sendWhatsAppMessage(type) {
  const phoneNumber = "2348167721599" // WhatsApp number (Nigeria)
  let message = ""
  
  // Map types to WhatsApp messages
  const messages = {
    promote_song: "I want to promote my song on your website. Can you provide me more details about the promotion process?",
    advertise_service: "I want to advertise my service on your website. Can you tell me about your advertising options and pricing?",
    advertise_products: "I want to advertise my products on your website. Can you provide information about your advertising packages?"
  }
  
  message = messages[type] || "Hi, I'm interested in advertising on your platform."
  
  // Encode message for URL
  const encodedMessage = encodeURIComponent(message)
  
  // WhatsApp URL format (use web.whatsapp.com for web)
  const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`
  
  // Open WhatsApp
  window.open(whatsappUrl, "_blank")
  
  // Close modal
  contactModal.classList.add("hidden")
  contactModal.classList.remove("flex")
}

function toggleArtistModal(show = true) {
  const modal = document.getElementById('artistModal')
  if (show) {
    modal.classList.remove('hidden')
    modal.classList.add('flex')
  } else {
    modal.classList.add('hidden')
    modal.classList.remove('flex')
  }
}

let currentArtistProfile = null

async function showArtistProfile(artist) {
  const artistNameEl = document.getElementById('artistName')
  const artistBioEl = document.getElementById('artistBio')
  const artistSongsContainer = document.getElementById('artistSongs')
  const editBioButton = document.getElementById('editArtistBioButton')

  artistNameEl.innerText = artist
  artistSongsContainer.innerHTML = '<p class="text-white/70">Loading songs...</p>'

  const response = await fetch(`/artist/${encodeURIComponent(artist)}`)
  if (!response.ok) {
    artistBioEl.innerText = 'Bio: Not available'
    artistSongsContainer.innerHTML = ''
    showToast('Could not load artist profile.')
    return
  }

  const data = await response.json()
  if (!data.success) {
    artistBioEl.innerText = 'Bio: Not available'
    artistSongsContainer.innerHTML = ''
    return
  }

  currentArtistProfile = data.artist

  artistNameEl.innerText = currentArtistProfile.name
  artistBioEl.innerText = `Bio: ${currentArtistProfile.bio || 'No bio available yet'}`

  artistSongsContainer.innerHTML = ''
  if (!data.songs || data.songs.length === 0) {
    artistSongsContainer.innerHTML = '<p class="text-white/70">No songs available for this artist</p>'
  } else {
    data.songs.forEach(song => {
      const item = document.createElement('div')
      item.className = 'song-row'
      item.innerHTML = `<div class="song-row-info"><p class="song-row-title">${song.title}</p><p class="song-row-artist">${song.artist}</p></div>`
      item.addEventListener('click', () => {
        playSong(song)
        toggleArtistModal(false)
      })
      artistSongsContainer.appendChild(item)
    })
  }

  if (currentUser && currentUser.accountType === 'artist' && currentUser.username.toLowerCase() === artist.toLowerCase()) {
    editBioButton.classList.remove('hidden')
    editBioButton.onclick = async () => {
      const newBio = prompt('Set your artist bio', currentArtistProfile.bio || '')
      if (!newBio) return
      const token = localStorage.getItem('token')
      const editResponse = await fetch(`/artist/${encodeURIComponent(artist)}/bio`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({ bio: newBio })
      })
      const editData = await editResponse.json()
      if (editData.success) {
        currentArtistProfile.bio = newBio
        artistBioEl.innerText = `Bio: ${newBio}`
        showToast('Artist bio updated')
      } else {
        showToast(editData.message || 'Could not update bio')
      }
    }
  } else {
    editBioButton.classList.add('hidden')
  }

  toggleArtistModal(true)
}

// Update progress on click
playerBarProgress.parentElement.addEventListener("click", (e) => {
  if (!audio.duration) return
  const rect = e.currentTarget.getBoundingClientRect()
  const percent = (e.clientX - rect.left) / rect.width
  audio.currentTime = percent * audio.duration
})

// Search functionality
document.getElementById("search").addEventListener("input", function() {
  const value = this.value.toLowerCase()
  currentFilteredSongs = allSongs.filter(song =>
    song.title.toLowerCase().includes(value) ||
    song.artist.toLowerCase().includes(value)
  )
  currentPage = 1
  renderCurrentPage()
})

// Pagination controls
const prevPageButton = document.getElementById('prevPage')
const nextPageButton = document.getElementById('nextPage')
prevPageButton.addEventListener('click', () => {
  if (currentPage > 1) {
    currentPage--
    renderCurrentPage()
  }
})
nextPageButton.addEventListener('click', () => {
  if (currentPage * PAGE_SIZE < currentFilteredSongs.length) {
    currentPage++
    renderCurrentPage()
  }
})

// Load trending
function loadTrending() {
  // Sort both imported and uploaded songs by play count
  currentFilteredSongs = [...allSongs].sort((a, b) => {
    const aPlays = (a.plays || a.play_count || 0)
    const bPlays = (b.plays || b.play_count || 0)
    return bPlays - aPlays
  })
  currentPage = 1
  renderCurrentPage()
}

// Initialize
checkAuthStatus()
loadSongs()