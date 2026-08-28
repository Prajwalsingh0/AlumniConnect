const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const connectDB = require('./config/database');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const eventRoutes = require('./routes/events');
const alumniRoutes = require('./routes/alumni');
const jobRoutes = require('./routes/jobs');
const messageRoutes = require('./routes/messages');
const donationRoutes = require('./routes/donations');
const groupRoutes = require('./routes/groups');
const adminRoutes = require('./routes/admin');

const http = require('http');
const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const Message = require('./models/Message');
const Conversation = require('./models/Conversation');
const User = require('./models/User');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware - configure to allow CSS and other static assets
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: [
        "'self'", "'unsafe-inline'",
        "https://cdn.tailwindcss.com",
        "https://cdnjs.cloudflare.com",
        "https://fonts.googleapis.com"
      ],
      scriptSrc: [
        "'self'", "'unsafe-inline'", "'unsafe-eval'",
        "https://cdn.tailwindcss.com",
        "https://cdnjs.cloudflare.com",
        "https://cdn.jsdelivr.net"
      ],
      scriptSrcAttr: ["'unsafe-inline'"],   // allows onclick="..." handlers
      fontSrc: [
        "'self'",
        "https://cdnjs.cloudflare.com",
        "https://fonts.googleapis.com",
        "https://fonts.gstatic.com",
        "data:"
      ],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      connectSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// Rate limiting removed globally for development
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 5000 // limit each IP to 5000 requests per windowMs
// });
// app.use(limiter);

// CORS configuration - allow requests from frontend
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:8000', 'http://127.0.0.1:3000', 'http://127.0.0.1:8000'],
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API routes - must come before static files
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/alumni', alumniRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/admin', adminRoutes);

// Serve uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve static files (CSS, JS, images, etc.)
const publicPath = path.join(__dirname, 'public');
console.log(`📂 Static files directory: ${publicPath}`);

app.use(express.static(publicPath, {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0, // No cache in development
  etag: false,
  lastModified: false,
  setHeaders: (res, filePath) => {
    // Set proper MIME types for CSS files
    if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    }
    // Disable cache in development
    if (process.env.NODE_ENV !== 'production') {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
    }
  }
}));

// Error handling middleware - must come before catch-all route
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// Serve the main HTML file for all other routes (SPA fallback)
// But exclude static file requests (CSS, JS, images, etc.)
app.get('*', (req, res, next) => {
  // Don't serve HTML for API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API route not found' });
  }

  // Don't intercept static file requests - let express.static handle them
  // If express.static didn't find the file, it will call next() and we'll get here
  // In that case, if it's a static file extension, return 404 instead of serving HTML
  const staticExtensions = ['.css', '.js', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.json', '.webp'];
  const hasStaticExtension = staticExtensions.some(ext => req.path.toLowerCase().endsWith(ext));

  if (hasStaticExtension) {
    return res.status(404).json({ error: 'Static file not found' });
  }

  // Serve HTML for all other routes (SPA fallback)
  res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
    if (err) {
      console.error('Error serving index.html:', err);
      res.status(404).json({ error: 'Page not found' });
    }
  });
});

// Connect to MongoDB
connectDB();

const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:8000', 'http://127.0.0.1:3000', 'http://127.0.0.1:8000'],
    credentials: true
  }
});

// Socket.io authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication error'));
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-this-in-production');
    socket.userId = decoded.userId;
    next();
  } catch (error) {
    next(new Error('Authentication error'));
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.userId}`);
  socket.join(socket.userId);

  socket.on('send_message', async (data) => {
    try {
      const { conversationId, recipientId, content } = data;

      const message = new Message({
        conversationId,
        sender: socket.userId,
        recipient: recipientId,
        content
      });
      await message.save();

      // Update conversation last message
      await Conversation.findByIdAndUpdate(conversationId, {
        lastMessage: message._id,
        $inc: { [`unreadCount.${recipientId}`]: 1 }
      });

      io.to(recipientId).emit('new_message', message);
      socket.emit('message_sent', message);
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.userId}`);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Alumni Website Backend running on port ${PORT}`);
  console.log(`📁 Serving static files from: ${path.join(__dirname, 'public')}`);
  console.log(`🌐 Frontend: http://localhost:${PORT}`);
  console.log(`🔌 API: http://localhost:${PORT}/api`);
  console.log(`\n💡 Make sure MongoDB is running for full functionality`);
});

module.exports = app;