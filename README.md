# Special Persons Social Network - Backend

## Deployment Instructions for Render.com

### Prerequisites
1. MongoDB Atlas account with database setup
2. Render.com account
3. Environment variables configured

### Environment Variables Required:
- `MONGODB_URI`: MongoDB Atlas connection string
- `JWT_SECRET`: Strong random secret key for JWT tokens
- `PORT`: Port number (Render automatically sets this)
- `NODE_ENV`: Set to "production"
- `CORS_ORIGIN`: Frontend URL (Firebase hosting URL)

### Quick Deploy Steps:
1. Connect GitHub repository to Render
2. Select "Web Service" 
3. Set build command: `npm install`
4. Set start command: `npm start`
5. Add environment variables
6. Deploy!

### Features Included:
- User authentication with JWT
- Real-time chat with Socket.io
- File upload for profiles and stories
- Friend system
- Stories with auto-expire
- Accessibility features

### API Endpoints:
- `/api/auth` - Authentication routes
- `/api/users` - User management
- `/api/posts` - Posts and feed
- `/api/friends` - Friend system
- `/api/stories` - Stories feature
- `/api/chat` - Real-time messaging

### Production Optimizations:
- CORS configuration for security
- File upload limits
- Error handling
- Database connection pooling
- Environment-based configuration