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
let userPlaylist = JSON.parse(localStorage.getItem('userPlaylist')) || []
let recentlyPlayed = JSON.parse(localStorage.getItem('recentlyPlayed')) || []
let songsPlayedCount = 0
let advertData = null
let allAdverts = []
let currentAdvertIndex = 0
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
        <p class="song-row-artist">${song.artist}</p>
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

function savePlaylists() {
  localStorage.setItem('userPlaylist', JSON.stringify(userPlaylist))
}

function addToPlaylist(song) {
  if (!userPlaylist.find(item => item.id === song.id)) {
    userPlaylist.push(song)
    savePlaylists()
    showToast('Added to playlist')
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

// Theme toggle
const themeToggleBtn = document.getElementById('themeToggle')
themeToggleBtn.addEventListener('click', () => {
  document.body.classList.toggle('light-mode')
  const active = document.body.classList.contains('light-mode')
  themeToggleBtn.textContent = active ? '🌞 Light' : '🌙 Dark'
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