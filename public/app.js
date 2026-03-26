// Global variables
let allSongs = []
let currentIndex = 0
let isPlaying = false
let repeatMode = 0
let isShuffle = false
let likedSongs = JSON.parse(localStorage.getItem('likedSongs')) || []
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
    
    displaySongs(allSongs)
    loadAdvertData()
  } catch (error) {
    console.error("Error loading songs:", error)
  }
}

// Display songs in grid with modern card styling
function displaySongs(songs){
  songsContainer.innerHTML = ""
  songCount.innerText = songs.length

  songs.forEach((song) => {
    const isLiked = likedSongs.includes(song.id)
    
    // Create song card
    const div = document.createElement("div")
    div.className = "song-card group overflow-hidden rounded-xl bg-gradient-to-b from-white/10 to-white/5 ring-1 ring-white/10 overflow-hidden shadow-lg"
    
    div.innerHTML = `
      <div class="relative overflow-hidden cursor-pointer bg-black">
        <img src="${song.artwork || song.cover || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 200 200%22%3E%3Crect fill=%22%23333%22 width=%22200%22 height=%22200%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22 font-size=%2230%22%3E🎵%3C/text%3E%3C/svg%3E'}" alt="${song.title} cover" class="h-40 w-full object-cover transition duration-300 group-hover:scale-110" />
        <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition duration-300 flex items-center justify-center">
          <button class="play-btn flex h-14 w-14 items-center justify-center rounded-full bg-indigo-500 text-white hover:bg-indigo-600 shadow-lg transition transform hover:scale-110" data-song-id="${song.id}">
            <svg class="h-6 w-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </button>
        </div>
        <div class="absolute top-2 right-2">
          <button class="like-btn flex items-center justify-center h-8 w-8 rounded-full bg-white/20 hover:bg-white/30 transition" data-song-id="${song.id}">
            <svg class="h-4 w-4 transition ${isLiked ? 'fill-red-500 text-red-500' : 'text-white'}" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </button>
        </div>
      </div>
      
      <div class="p-4">
        <h3 class="font-semibold text-white text-sm line-clamp-2">${song.title}</h3>
        <p class="text-xs text-white/60 mt-1 line-clamp-1">${song.artist}</p>
        
        <div class="flex items-center justify-between mt-3 text-xs text-white/60">
          <div class="flex items-center gap-1">
            <svg class="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M13 13H9v-2h4v2zm0 4H9v2h4v-2zM9 9h4V7H9v2z"/>
            </svg>
            ${song.plays || 0}
          </div>
          <button class="download-btn flex items-center gap-1 text-white/60 hover:text-indigo-400 transition" data-song-id="${song.id}">
            <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
            Download
          </button>
        </div>
      </div>
    `

    // Play button
    const playBtn = div.querySelector(".play-btn")
    playBtn.addEventListener("click", (e) => {
      e.stopPropagation()
      currentIndex = allSongs.findIndex(s => s.id === song.id)
      playSong(allSongs[currentIndex])
    })

    // Like button
    const likeBtn = div.querySelector(".like-btn")
    likeBtn.addEventListener("click", (e) => {
      e.stopPropagation()
      toggleLike(song.id, likeBtn)
    })

    // Download button
    const downloadBtn = div.querySelector(".download-btn")
    downloadBtn.addEventListener("click", (e) => {
      e.stopPropagation()
      downloadSong(song)
    })

    // Card click to play
    div.addEventListener("click", () => {
      currentIndex = allSongs.findIndex(s => s.id === song.id)
      playSong(allSongs[currentIndex])
    })

    songsContainer.appendChild(div)
  })
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
    
    // Show advert after every 3 songs
    if (songsPlayedCount % 3 === 0 && advertData) {
      showAdvert()
    }
    
    displaySongs(allSongs)
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
  const filtered = allSongs.filter(song =>
    song.title.toLowerCase().includes(value) ||
    song.artist.toLowerCase().includes(value)
  )
  displaySongs(filtered)
})

// Load trending
function loadTrending() {
  // Sort both imported and uploaded songs by play count
  const sorted = [...allSongs].sort((a, b) => {
    const aPlays = (a.plays || a.play_count || 0)
    const bPlays = (b.plays || b.play_count || 0)
    return bPlays - aPlays
  })
  displaySongs(sorted)
}

// Initialize
checkAuthStatus()
loadSongs()