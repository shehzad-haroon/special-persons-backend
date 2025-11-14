const mongoose = require('mongoose');

const storySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  storyType: {
    type: String,
    enum: ['text', 'image'],
    default: 'text',
    required: true
  },
  text: {
    type: String,
    maxlength: 500,
    default: ''
  },
  image: {
    type: String,
    default: ''
  },
  backgroundColor: {
    type: String,
    default: '#1877f2'
  },
  views: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  reactions: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    reaction: {
      type: String,
      enum: ['❤️', '😂', '😮', '😢', '😡', '👍'],
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from creation
    index: { expireAfterSeconds: 0 } // MongoDB TTL index
  }
}, {
  timestamps: true
});

// Index for efficient queries
storySchema.index({ user: 1, createdAt: -1 });
storySchema.index({ expiresAt: 1 });
storySchema.index({ createdAt: -1 });

// Virtual for checking if story is expired
storySchema.virtual('isExpired').get(function() {
  return this.expiresAt < new Date();
});

// Virtual for time remaining
storySchema.virtual('timeRemaining').get(function() {
  const now = new Date();
  const remaining = this.expiresAt - now;
  return Math.max(0, remaining);
});

// Virtual for view count
storySchema.virtual('viewCount').get(function() {
  return this.views.length;
});

// Virtual for reaction count
storySchema.virtual('reactionCount').get(function() {
  return this.reactions.length;
});

// Virtual for reaction summary
storySchema.virtual('reactionSummary').get(function() {
  const summary = {};
  this.reactions.forEach(reaction => {
    summary[reaction.reaction] = (summary[reaction.reaction] || 0) + 1;
  });
  return summary;
});

// Method to check if user has viewed this story
storySchema.methods.hasUserViewed = function(userId) {
  return this.views.includes(userId);
};

// Method to get user's reaction to this story
storySchema.methods.getUserReaction = function(userId) {
  const reaction = this.reactions.find(r => r.user.toString() === userId.toString());
  return reaction ? reaction.reaction : null;
};

// Method to add view (if not already viewed)
storySchema.methods.addView = function(userId) {
  if (!this.hasUserViewed(userId)) {
    this.views.push(userId);
    return this.save();
  }
  return Promise.resolve(this);
};

// Static method to get active stories for users
storySchema.statics.getActiveStoriesForUsers = function(userIds) {
  return this.find({
    user: { $in: userIds },
    expiresAt: { $gt: new Date() }
  })
  .populate('user', 'name profilePicture')
  .sort({ createdAt: -1 });
};

// Static method to clean up expired stories
storySchema.statics.cleanupExpired = function() {
  return this.deleteMany({
    expiresAt: { $lt: new Date() }
  });
};

// Pre-save middleware to ensure expiration time
storySchema.pre('save', function(next) {
  if (this.isNew && !this.expiresAt) {
    this.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  }
  next();
});

// Ensure virtual fields are included in JSON output
storySchema.set('toJSON', { 
  virtuals: true,
  transform: function(doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

storySchema.set('toObject', { virtuals: true });

const Story = mongoose.model('Story', storySchema);

module.exports = Story;