// Load environment variables
require('dotenv').config()

const express = require("express")
const sqlite3 = require("sqlite3").verbose()
const multer = require("multer")
const cors = require("cors")
const fs = require("fs")
const path = require("path")
const nodemailer = require("nodemailer")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")

// Import music API managers
const MusicImportManager = require("./api/importManager")
const MusicScheduler = require("./api/scheduler")

const app = express()

app.use(cors({
  origin: true,
  credentials: true
}))
app.use(express.json())
app.use(express.static("public"))
app.use("/uploads", express.static("uploads", {
  setHeaders: (res, path) => {
    res.set('Access-Control-Allow-Origin', '*')
    res.set('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
    res.set('Cache-Control', 'public, max-age=31536000')
  }
}))

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production"

/* EMAIL CONFIGURATION */
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "danielxam2004@gmail.com",
    pass: "ggiqztosrilugcjm" // App Password
  }
})

// Test email connection (don't crash if it fails)
let emailConfigured = false;
transporter.verify((error, success) => {
  if (error) {
    console.log("⚠️  Email configuration warning (OTP features disabled):", error.message)
    emailConfigured = false;
  } else {
    console.log("✅ Email service is ready to send messages")
    emailConfigured = true;
  }
})

/* ADMIN LOGIN */

const ADMIN_USER = "admin"
const ADMIN_PASS = "admin123"

/* DATABASE */

const db = new sqlite3.Database("music.db", err => {

if(err){
console.log(err)
}else{
console.log("Database connected")
}

})

// Create all tables serially to ensure they exist before scheduler starts
db.serialize(() => {
  db.run(`
  CREATE TABLE IF NOT EXISTS songs(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  artist TEXT,
  title TEXT,
  description TEXT,
  lyrics TEXT,
  cover TEXT,
  audio TEXT,
  plays INTEGER DEFAULT 0
  )
  `)

  // Add missing columns if database upgrades from old schema
  db.run("ALTER TABLE songs ADD COLUMN description TEXT", (err) => {
    if (err && !err.message.includes('duplicate column name')) console.log('Could not add description column to songs:', err.message)
  })
  db.run("ALTER TABLE songs ADD COLUMN lyrics TEXT", (err) => {
    if (err && !err.message.includes('duplicate column name')) console.log('Could not add lyrics column to songs:', err.message)
  })

  // Create adverts table
  db.run(`
  CREATE TABLE IF NOT EXISTS adverts(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  image TEXT,
  video TEXT,
  type TEXT DEFAULT 'image',
  link TEXT NOT NULL,
  duration INTEGER DEFAULT 5,
  enabled INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
  `)

  // Create contact messages table
  db.run(`
  CREATE TABLE IF NOT EXISTS contact_messages(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
  `)

  // Create imported_songs table for multi-source music
  db.run(`
  CREATE TABLE IF NOT EXISTS imported_songs(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  external_id TEXT UNIQUE,
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  artwork TEXT,
  stream_url TEXT,
  embedded_url TEXT,
  duration INTEGER DEFAULT 0,
  genre TEXT,
  release_date TEXT,
  play_count INTEGER DEFAULT 0,
  source_data TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
  `)

  // Create index for faster searches
  db.run(`CREATE INDEX IF NOT EXISTS idx_imported_songs_title_artist ON imported_songs(title, artist)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_imported_songs_source ON imported_songs(source)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_imported_songs_play_count ON imported_songs(play_count DESC)`)

  /* ===== AUTHENTICATION TABLES ===== */

  // Create users table for authentication
  db.run(`
  CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT,
  accountType TEXT NOT NULL DEFAULT 'streamer',
  authProvider TEXT NOT NULL DEFAULT 'local',
  providerId TEXT,
  profilePicture TEXT,
  bio TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )
  `)

  db.run("ALTER TABLE users ADD COLUMN bio TEXT", (err) => {
    if (err && !err.message.includes('duplicate column name')) console.log('Could not add bio column to users:', err.message)
  })

  // Create OTP table for password recovery
  db.run(`
  CREATE TABLE IF NOT EXISTS otps(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  otp TEXT NOT NULL,
  expiresAt DATETIME NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )
  `)

  // Create user songs table (for uploaded songs by artists)
  db.run(`
  CREATE TABLE IF NOT EXISTS user_songs(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  lyrics TEXT,
  fileUrl TEXT NOT NULL,
  coverUrl TEXT,
  playCount INTEGER DEFAULT 0,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id)
  )
  `)

  // Create index for user songs
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_songs_userId ON user_songs(userId)`)
})

/* ===== MUSIC IMPORT SYSTEM ===== */

// Initialize import manager and scheduler
const importManager = new MusicImportManager(db)
const musicScheduler = new MusicScheduler(importManager)

// Start scheduler on server startup (with initial import disabled to avoid slow startup)
// Wait longer to ensure database tables are created
setTimeout(() => {
  console.log("Starting music import scheduler...")
  musicScheduler.start(24 * 60 * 60 * 1000, false) // Every 24 hours, don't run immediately
  
  // Note: Auto-import disabled on startup to avoid database timing issues
  // Users can trigger imports via /admin/import/trigger endpoint
}, 5000)

/* FILE UPLOAD */

const storage = multer.diskStorage({

destination:(req,file,cb)=>{

if(file.mimetype.startsWith("image")){
cb(null,"uploads/covers")
}else{
cb(null,"uploads/audio")
}

},

filename:(req,file,cb)=>{
cb(null,Date.now()+"-"+file.originalname)
}

})

// FIX: Add MIME type validation for audio and image files
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    // Allow audio files: mp3, m4a, wav, ogg, flac
    const allowedAudioMimes = ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/flac', 'audio/x-m4a'];
    // Allow image files
    const allowedImageMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    
    if (file.mimetype.startsWith('image')) {
      if (allowedImageMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid image format. Allowed: JPEG, PNG, GIF, WebP'), false);
      }
    } else {
      if (allowedAudioMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid audio format. Allowed: MP3, M4A, WAV, OGG, FLAC'), false);
      }
    }
  },
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB max file size
  }
})

/* ===== AUTHENTICATION MIDDLEWARE ===== */

// Middleware to verify JWT token
function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ success: false, message: "No token provided" });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ success: false, message: "Invalid or expired token" });
  }
}

/* ===== AUTHENTICATION ROUTES ===== */

// Register route
app.post("/auth/register", async (req, res) => {
  try {
    const { username, email, password, accountType } = req.body;

    // Validate inputs
    if (!username || !email || !password || !accountType) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    if (!['artist', 'streamer'].includes(accountType)) {
      return res.status(400).json({ success: false, message: "Invalid account type" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    db.run(
      "INSERT INTO users (username, email, password, accountType) VALUES (?, ?, ?, ?)",
      [username, email, hashedPassword, accountType],
      function(err) {
        if (err) {
          if (err.message.includes("UNIQUE constraint failed")) {
            return res.status(400).json({ success: false, message: "Username or email already exists" });
          }
          console.log("Registration error:", err);
          return res.status(500).json({ success: false, message: "Registration failed" });
        }

        // Generate JWT token
        const token = jwt.sign(
          { id: this.lastID, username, email, accountType },
          JWT_SECRET,
          { expiresIn: "7d" }
        );

        res.json({
          success: true,
          message: "Registration successful",
          token,
          user: { id: this.lastID, username, email, accountType }
        });
      }
    );
  } catch (error) {
    console.log("Registration error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Login route
app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password required" });
    }

    db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
      if (err) {
        console.log("Login error:", err);
        return res.status(500).json({ success: false, message: "Server error" });
      }

      if (!user) {
        return res.status(401).json({ success: false, message: "Invalid email or password" });
      }

      // For social login users without password
      if (!user.password) {
        return res.status(401).json({ success: false, message: "Please use social login for this account" });
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ success: false, message: "Invalid email or password" });
      }

      // Generate JWT token
      const token = jwt.sign(
        { id: user.id, username: user.username, email: user.email, accountType: user.accountType },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      res.json({
        success: true,
        message: "Login successful",
        token,
        user: { id: user.id, username: user.username, email: user.email, accountType: user.accountType }
      });
    });
  } catch (error) {
    console.log("Login error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Request OTP for password recovery
app.post("/auth/request-otp", (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email required" });
    }

    // Check if user exists
    db.get("SELECT id FROM users WHERE email = ?", [email], (err, user) => {
      if (err || !user) {
        // Don't reveal if email exists (for security)
        return res.json({ success: true, message: "If email exists, OTP will be sent" });
      }

      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      db.run(
        "INSERT INTO otps (email, otp, expiresAt) VALUES (?, ?, ?)",
        [email, otp, expiresAt],
        (err) => {
          if (err) {
            console.log("OTP insertion error:", err);
            return res.status(500).json({ success: false, message: "Failed to generate OTP" });
          }

          // Send OTP via email
          const mailOptions = {
            from: "danielxam2004@gmail.com",
            to: email,
            subject: "Password Reset OTP - Music Platform",
            html: `
              <h2>Password Reset Request</h2>
              <p>Your OTP for password reset is:</p>
              <h1 style="font-size: 32px; letter-spacing: 5px; font-weight: bold;">${otp}</h1>
              <p>This OTP will expire in 10 minutes.</p>
              <p>If you didn't request this, please ignore this email.</p>
            `
          };

          transporter.sendMail(mailOptions, (error) => {
            if (error) {
              console.log("Email error:", error);
            }
            res.json({ success: true, message: "OTP sent to email" });
          });
        }
      );
    });
  } catch (error) {
    console.log("OTP request error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Verify OTP
app.post("/auth/verify-otp", (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: "Email and OTP required" });
    }

    db.get(
      "SELECT * FROM otps WHERE email = ? AND otp = ? AND expiresAt > ?",
      [email, otp, new Date()],
      (err, otpRecord) => {
        if (err || !otpRecord) {
          return res.status(401).json({ success: false, message: "Invalid or expired OTP" });
        }

        // Delete used OTP
        db.run("DELETE FROM otps WHERE id = ?", [otpRecord.id]);

        res.json({ success: true, message: "OTP verified" });
      }
    );
  } catch (error) {
    console.log("OTP verification error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Reset password
app.post("/auth/reset-password", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // Verify OTP
    db.get(
      "SELECT * FROM otps WHERE email = ? AND otp = ? AND expiresAt > ?",
      [email, otp, new Date()],
      async (err, otpRecord) => {
        if (err || !otpRecord) {
          return res.status(401).json({ success: false, message: "Invalid or expired OTP" });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update user password
        db.run(
          "UPDATE users SET password = ? WHERE email = ?",
          [hashedPassword, email],
          function(err) {
            if (err) {
              return res.status(500).json({ success: false, message: "Password reset failed" });
            }

            // Delete used OTP
            db.run("DELETE FROM otps WHERE id = ?", [otpRecord.id]);

            res.json({ success: true, message: "Password reset successful" });
          }
        );
      }
    );
  } catch (error) {
    console.log("Password reset error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Get current user
app.get("/auth/user", verifyToken, (req, res) => {
  db.get("SELECT * FROM users WHERE id = ?", [req.user.id], (err, user) => {
    if (err || !user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        accountType: user.accountType,
        profilePicture: user.profilePicture,
        bio: user.bio || ''
      }
    });
  });
});

// Update account type (for social login first-time users)
app.post("/auth/set-account-type", verifyToken, (req, res) => {
  try {
    const { accountType } = req.body;

    if (!['artist', 'streamer'].includes(accountType)) {
      return res.status(400).json({ success: false, message: "Invalid account type" });
    }

    db.run(
      "UPDATE users SET accountType = ? WHERE id = ?",
      [accountType, req.user.id],
      function(err) {
        if (err) {
          return res.status(500).json({ success: false, message: "Update failed" });
        }

        res.json({ success: true, message: "Account type updated" });
      }
    );
  } catch (error) {
    console.log("Account type update error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ===== GOOGLE OAUTH ===== */

// Google Register
app.post("/auth/google-register", async (req, res) => {
  try {
    const { email, username, accountType, googleId, name, picture } = req.body;

    if (!email || !googleId) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // Check if user already exists
    db.get("SELECT * FROM users WHERE email = ?", [email], (err, existingUser) => {
      if (existingUser) {
        // User exists, just log them in
        const token = jwt.sign(
          { 
            id: existingUser.id, 
            username: existingUser.username, 
            email: existingUser.email, 
            accountType: existingUser.accountType
          },
          JWT_SECRET,
          { expiresIn: "7d" }
        );

        return res.json({
          success: true,
          message: "Login successful",
          token,
          user: {
            id: existingUser.id,
            username: existingUser.username,
            email: existingUser.email,
            accountType: existingUser.accountType
          }
        });
      }

      // Create new user
      const finalUsername = username || email.split('@')[0];
      
      db.run(
        "INSERT INTO users (username, email, accountType, authProvider, providerId, profilePicture) VALUES (?, ?, ?, ?, ?, ?)",
        [finalUsername, email, accountType || 'pending', 'google', googleId, picture],
        function(err) {
          if (err) {
            console.log("Google registration error:", err);
            return res.status(500).json({ success: false, message: "Registration failed" });
          }

          const token = jwt.sign(
            { id: this.lastID, username: finalUsername, email, accountType: accountType || 'pending' },
            JWT_SECRET,
            { expiresIn: "7d" }
          );

          res.json({
            success: true,
            message: "Registration successful",
            token,
            user: {
              id: this.lastID,
              username: finalUsername,
              email,
              accountType: accountType || 'pending'
            }
          });
        }
      );
    });
  } catch (error) {
    console.log("Google registration error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Google Login
app.post("/auth/google-login", async (req, res) => {
  try {
    const { email, googleId } = req.body;

    if (!email || !googleId) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    db.get("SELECT * FROM users WHERE email = ? AND authProvider = 'google'", [email], (err, user) => {
      if (err) {
        return res.status(500).json({ success: false, message: "Server error" });
      }

      if (!user) {
        // User doesn't exist, they need to register first
        return res.status(401).json({ 
          success: false, 
          message: "User not found. Please register first.",
          newUser: true 
        });
      }

      const token = jwt.sign(
        { 
          id: user.id, 
          username: user.username, 
          email: user.email, 
          accountType: user.accountType 
        },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      res.json({
        success: true,
        message: "Login successful",
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          accountType: user.accountType
        }
      });
    });
  } catch (error) {
    console.log("Google login error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ===== APPLE SIGN IN (PLACEHOLDER) ===== */

// Apple Register/Login
app.post("/auth/apple-register", async (req, res) => {
  try {
    // This is a placeholder for Apple Sign In
    // In production, you would verify the Apple JWT token
    // For now, we'll require the client to implement the verification
    
    const { email, appleId, accountType } = req.body;

    if (!email || !appleId) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    db.get("SELECT * FROM users WHERE email = ?", [email], (err, existingUser) => {
      if (existingUser) {
        const token = jwt.sign(
          { 
            id: existingUser.id, 
            username: existingUser.username, 
            email: existingUser.email, 
            accountType: existingUser.accountType
          },
          JWT_SECRET,
          { expiresIn: "7d" }
        );

        return res.json({
          success: true,
          message: "Login successful",
          token,
          user: {
            id: existingUser.id,
            username: existingUser.username,
            email: existingUser.email,
            accountType: existingUser.accountType
          }
        });
      }

      const username = email.split('@')[0];
      
      db.run(
        "INSERT INTO users (username, email, accountType, authProvider, providerId) VALUES (?, ?, ?, ?, ?)",
        [username, email, accountType || 'pending', 'apple', appleId],
        function(err) {
          if (err) {
            console.log("Apple registration error:", err);
            return res.status(500).json({ success: false, message: "Registration failed" });
          }

          const token = jwt.sign(
            { id: this.lastID, username, email, accountType: accountType || 'pending' },
            JWT_SECRET,
            { expiresIn: "7d" }
          );

          res.json({
            success: true,
            message: "Registration successful",
            token,
            user: {
              id: this.lastID,
              username,
              email,
              accountType: accountType || 'pending'
            }
          });
        }
      );
    });
  } catch (error) {
    console.log("Apple registration error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});



app.post("/login",(req,res)=>{

const {username,password} = req.body

if(username === ADMIN_USER && password === ADMIN_PASS){

res.json({success:true})

}else{

res.json({success:false})

}

})

/* UPLOAD SONG */

app.post("/upload", upload.fields([
{name:"cover"},
{name:"audio"}
]), (req,res)=>{

try{

const artist = req.body.artist
const title = req.body.title

if(!artist || !title){
return res.json({success: false, message:"Missing song info"})
}

if(!req.files || !req.files.cover || !req.files.audio){
return res.json({success: false, message:"Files missing"})
}

const cover = `uploads/covers/${Date.now()}-${file.originalname}`
const audio = `uploads/audio/${Date.now()}-${file.originalname}`
const description = req.body.description || ''
const lyrics = req.body.lyrics || ''

// Validate files exist before inserting to database
if (!fs.existsSync(cover) || !fs.existsSync(audio)) {
  return res.json({success: false, message:"Files could not be saved properly"})
}

db.run(
"INSERT INTO songs (artist,title,description,lyrics,cover,audio) VALUES (?,?,?,?,?,?)",
[artist,title,description,lyrics,cover,audio],
function(err){

if(err){
console.log(err)
return res.json({success: false, message:"Database error"})
}

res.json({success: true, message:"Song uploaded successfully"})

})

}catch(error){

console.log(error)
res.json({success: false, message:"Upload failed: " + error.message})

}

})

/* GET SONGS */
// FIX: Normalize paths to absolute URLs so uploaded songs play correctly
app.get("/songs",(req,res)=>{

db.all("SELECT * FROM songs",[],(err,rows)=>{

if(err){
return res.json([])
}

// Normalize file paths to absolute URLs (e.g., "uploads/audio/file.mp3" -> "/uploads/audio/file.mp3")
const normalizedRows = rows.map(song => ({
  ...song,
  audio: song.audio ? (song.audio.startsWith('/') ? song.audio : '/' + song.audio) : null,
  cover: song.cover ? (song.cover.startsWith('/') ? song.cover : '/' + song.cover) : null,
  description: song.description || '',
  lyrics: song.lyrics || ''
}))

res.json(normalizedRows)

})

})

/* ARTIST PROFILE */

app.get('/artist/:name', (req, res) => {
  const artistName = req.params.name;

  db.all("SELECT * FROM songs WHERE LOWER(artist) = LOWER(?)", [artistName], (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Error fetching artist songs' });
    }

    db.get("SELECT id, username, email, accountType, profilePicture, bio FROM users WHERE LOWER(username) = LOWER(?)", [artistName], (err2, user) => {
      if (err2) {
        return res.status(500).json({ success: false, message: 'Error fetching artist profile' });
      }

      res.json({
        success: true,
        artist: {
          name: artistName,
          bio: user ? (user.bio || '') : '',
          profilePicture: user ? user.profilePicture : '',
          accountType: user ? user.accountType : 'streamer'
        },
        songs: rows
      });
    });
  });
});

app.put('/artist/:name/bio', verifyToken, (req, res) => {
  const artistName = req.params.name;
  const { bio } = req.body;

  if (!bio) {
    return res.status(400).json({ success: false, message: 'Bio is required' });
  }

  if (!req.user || req.user.username.toLowerCase() !== artistName.toLowerCase()) {
    return res.status(403).json({ success: false, message: 'You can only edit your own bio' });
  }

  db.run("UPDATE users SET bio = ? WHERE id = ?", [bio, req.user.id], function(err) {
    if (err) {
      return res.status(500).json({ success: false, message: 'Update bio failed' });
    }

    res.json({ success: true, message: 'Bio updated' });
  });
});

/* PLAY COUNT */

app.post("/play/:id",(req,res)=>{

db.run(
"UPDATE songs SET plays = plays + 1 WHERE id=?",
[req.params.id]
)

res.json({message:"counted"})

})

/* DELETE SONG */

app.delete("/delete/:id",(req,res)=>{

const id = req.params.id
console.log("Delete request received for song id:", id)

db.get("SELECT * FROM songs WHERE id=?", [id], (err, row) => {

if(err){
console.log("Database query error:", err)
return res.status(500).json({message:"Database error"})
}

if(!row){
console.log("Song not found with id:", id)
return res.status(404).json({message:"Song not found"})
}

console.log("Found song:", row.title)

// Delete files from disk
try{
if(row.cover && fs.existsSync(row.cover)) {
fs.unlinkSync(row.cover)
console.log("Deleted cover file:", row.cover)
}
if(row.audio && fs.existsSync(row.audio)) {
fs.unlinkSync(row.audio)
console.log("Deleted audio file:", row.audio)
}
}catch(error){
console.log("File deletion error:", error)
}

// Delete from database
db.run("DELETE FROM songs WHERE id=?", [id], function(err){

if(err){
console.log("Delete query error:", err)
return res.status(500).json({message:"Database error"})
}

console.log("Song deleted successfully from database")
res.json({message:"Song deleted successfully"})

})

})

})

/* ===== ADVERT MANAGEMENT ===== */

/* CREATE ADVERT */
app.post("/advert/create", upload.fields([
  { name: "image" },
  { name: "video" }
]), (req, res) => {
  try {
    const { title, link, description, duration, enabled, type } = req.body;

    if (!title || !link) {
      return res.status(400).json({ message: "Title and link are required" });
    }

    if (!type) {
      return res.status(400).json({ message: "Advert type is required" });
    }

    // Check if the required file is provided
    if (type === "image" && (!req.files || !req.files.image)) {
      return res.status(400).json({ message: "Image file is required for image adverts" });
    }
    if (type === "video" && (!req.files || !req.files.video)) {
      return res.status(400).json({ message: "Video file is required for video adverts" });
    }

    const image = req.files && req.files.image ? req.files.image[0].path : null;
    const video = req.files && req.files.video ? req.files.video[0].path : null;
    const isEnabled = enabled === "true" ? 1 : 0;
    const durationValue = parseInt(duration) || 5;

    db.run(
      "INSERT INTO adverts (title, description, image, video, type, link, duration, enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [title, description || "", image, video, type, link, durationValue, isEnabled],
      function(err) {
        if (err) {
          console.log(err);
          return res.status(500).json({ message: "Database error" });
        }
        res.json({ message: "Advert created successfully", id: this.lastID });
      }
    );
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to create advert" });
  }
});

/* GET ALL ADVERTS */
app.get("/adverts", (req, res) => {
  db.all("SELECT * FROM adverts WHERE enabled = 1 ORDER BY created_at DESC", [], (err, rows) => {
    if (err) {
      console.log(err);
      return res.json([]);
    }
    res.json(rows || []);
  });
});

/* GET ALL ADVERTS (ADMIN) */
app.get("/adverts/admin/all", (req, res) => {
  db.all("SELECT * FROM adverts ORDER BY created_at DESC", [], (err, rows) => {
    if (err) {
      console.log(err);
      return res.json([]);
    }
    res.json(rows || []);
  });
});

/* TOGGLE ADVERT */
app.post("/advert/toggle/:id", (req, res) => {
  const id = req.params.id;

  db.get("SELECT enabled FROM adverts WHERE id = ?", [id], (err, row) => {
    if (err) {
      return res.status(500).json({ message: "Database error" });
    }

    if (!row) {
      return res.status(404).json({ message: "Advert not found" });
    }

    const newEnabled = row.enabled === 1 ? 0 : 1;

    db.run("UPDATE adverts SET enabled = ? WHERE id = ?", [newEnabled, id], function(err) {
      if (err) {
        return res.status(500).json({ message: "Database error" });
      }
      res.json({ message: "Advert toggled successfully", enabled: newEnabled });
    });
  });
});

/* DELETE ADVERT */
app.delete("/advert/delete/:id", (req, res) => {
  const id = req.params.id;

  db.get("SELECT * FROM adverts WHERE id = ?", [id], (err, row) => {
    if (err) {
      return res.status(500).json({ message: "Database error" });
    }

    if (!row) {
      return res.status(404).json({ message: "Advert not found" });
    }

    // Delete image file
    try {
      if (row.image && fs.existsSync(row.image)) {
        fs.unlinkSync(row.image);
      }
    } catch (error) {
      console.log("File deletion error:", error);
    }

    // Delete from database
    db.run("DELETE FROM adverts WHERE id = ?", [id], function(err) {
      if (err) {
        return res.status(500).json({ message: "Database error" });
      }
      res.json({ message: "Advert deleted successfully" });
    });
  });
});

/* CONTACT MESSAGE */
app.post("/contact-message", (req, res) => {
  const { name, email, subject, message } = req.body;

  if (!name || !email || !subject || !message) {
    return res.status(400).json({ message: "All fields are required" });
  }

  db.run(
    "INSERT INTO contact_messages (name, email, subject, message) VALUES (?, ?, ?, ?)",
    [name, email, subject, message],
    function(err) {
      if (err) {
        console.log(err);
        return res.status(500).json({ message: "Database error" });
      }

      // Map subject values to readable text
      const subjectMap = {
        promote_song: "Song Promotion Request",
        advertise_service: "Service Advertisement Request",
        advertise_products: "Product Advertisement Request",
        other: "General Inquiry"
      };

      const subjectText = subjectMap[subject] || subject;

      // Send email to admin
      const mailOptions = {
        from: email,
        to: "danielxam2004@gmail.com",
        subject: `New Contact: ${subjectText}`,
        html: `
          <h2>New Contact Message</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Subject:</strong> ${subjectText}</p>
          <p><strong>Message:</strong></p>
          <p>${message.replace(/\n/g, '<br>')}</p>
          <hr>
          <p><em>This message was sent from your music platform contact form.</em></p>
        `
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.log("Email error:", error);
          // Still respond with success since the message was saved to database
          res.json({ 
            success: true, 
            message: "Your message has been saved! We will contact you soon at " + email 
          });
        } else {
          console.log("Email sent:", info.response);
          res.json({ 
            success: true, 
            message: "Your message has been sent successfully! We will contact you soon at " + email 
          });
        }
      });
    }
  );
});

/* ===== IMPORTED MUSIC ENDPOINTS ===== */

/* GET IMPORTED SONGS WITH PAGINATION */
app.get("/imported-songs", (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = parseInt(req.query.offset) || 0;
  const source = req.query.source || null;

  let query = "SELECT * FROM imported_songs";
  let params = [];

  if (source && source !== "all") {
    query += " WHERE source = ?";
    params.push(source);
  }

  query += " ORDER BY play_count DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error(err);
      return res.json({ songs: [], total: 0 });
    }

    // Get total count for pagination
    let countQuery = "SELECT COUNT(*) as count FROM imported_songs";
    let countParams = [];
    if (source && source !== "all") {
      countQuery += " WHERE source = ?";
      countParams.push(source);
    }

    db.get(countQuery, countParams, (err, countRow) => {
      res.json({
        songs: rows || [],
        total: countRow?.count || 0,
        limit,
        offset
      });
    });
  });
});

/* SEARCH IMPORTED SONGS */
app.get("/search-imported", (req, res) => {
  const query = req.query.q || "";
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);

  if (!query || query.length < 2) {
    return res.json({ results: [] });
  }

  const searchTerm = `%${query}%`;
  const searchQuery = `
    SELECT * FROM imported_songs
    WHERE LOWER(title) LIKE LOWER(?)
       OR LOWER(artist) LIKE LOWER(?)
       OR LOWER(genre) LIKE LOWER(?)
    ORDER BY play_count DESC
    LIMIT ?
  `;

  db.all(searchQuery, [searchTerm, searchTerm, searchTerm, limit], (err, rows) => {
    if (err) {
      console.error(err);
      return res.json({ results: [] });
    }
    res.json({ results: rows || [] });
  });
});

/* GET TRENDING IMPORTED SONGS */
app.get("/trending-imported", (req, res) => {
  const days = parseInt(req.query.days) || 7;
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);

  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const query = `
    SELECT * FROM imported_songs
    WHERE updated_at >= ?
    ORDER BY play_count DESC
    LIMIT ?
  `;

  db.all(query, [cutoffDate.toISOString(), limit], (err, rows) => {
    if (err) {
      console.error(err);
      return res.json({ songs: [] });
    }
    res.json({ songs: rows || [] });
  });
});

/* GET SONGS BY SOURCE */
app.get("/songs-by-source/:source", (req, res) => {
  const source = req.params.source;
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = parseInt(req.query.offset) || 0;

  const query = `
    SELECT * FROM imported_songs
    WHERE source = ?
    ORDER BY play_count DESC
    LIMIT ? OFFSET ?
  `;

  db.all(query, [source, limit, offset], (err, rows) => {
    if (err) {
      console.error(err);
      return res.json({ songs: [] });
    }
    res.json({ songs: rows || [] });
  });
});

/* UPDATE IMPORTED SONG PLAY COUNT */
app.post("/imported-play/:id", (req, res) => {
  const songId = req.params.id;

  const query = `
    UPDATE imported_songs
    SET play_count = play_count + 1, updated_at = ?
    WHERE id = ?
  `;

  db.run(query, [new Date().toISOString(), songId], function(err) {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Error updating play count" });
    }
    res.json({ message: "Play count updated" });
  });
});

/* GET IMPORTED SONG BY ID */
app.get("/imported-song/:id", (req, res) => {
  const songId = req.params.id;

  const query = "SELECT * FROM imported_songs WHERE id = ?";

  db.get(query, [songId], (err, row) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Error fetching song" });
    }
    if (!row) {
      return res.status(404).json({ message: "Song not found" });
    }

    // Update view count
    db.run(
      "UPDATE imported_songs SET play_count = play_count + 1 WHERE id = ?",
      [songId]
    );

    res.json(row);
  });
});

/* IMPORT MANAGEMENT ENDPOINTS */

/* TRIGGER MANUAL IMPORT */
app.post("/admin/import/trigger", (req, res) => {
  const limit = parseInt(req.body?.limit) || 100;

  console.log(`Manual import triggered with limit: ${limit}`);
  res.setHeader('Content-Type', 'application/json');
  
  // Run import asynchronously
  musicScheduler.triggerManualImport(limit).then((result) => {
    if (!res.headersSent) {
      res.json({
        success: result.success !== false,
        stats: result.stats || result,
        message: result.error || 'Import completed',
        ...result
      });
    }
  }).catch((error) => {
    console.error('Manual import error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: error.message,
        message: `Import error: ${error.message}`
      });
    }
  });
});

/* GET IMPORT SCHEDULER STATUS */
app.get("/admin/import/status", (req, res) => {
  const status = musicScheduler.getStatus();
  res.json(status);
});

/* GET MUSIC DATABASE STATISTICS */
app.get("/admin/import/stats", (req, res) => {
  musicScheduler.getStatistics().then((stats) => {
    res.json(stats);
  }).catch((error) => {
    console.error(error);
    res.status(500).json({ error: error.message });
  });
});

/* START SERVER */

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});