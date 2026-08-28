require('dotenv').config();
const mongoose = require('mongoose');

const User = require('../models/User');
const Event = require('../models/Event');
const Job = require('../models/Job');
const News = require('../models/News');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Campaign = require('../models/Campaign');
const Donation = require('../models/Donation');
const Group = require('../models/Group');
const ForumPost = require('../models/ForumPost');
const Chapter = require('../models/Chapter');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/alumni-website';

async function init() {
  console.log('Connecting to MongoDB:', MONGODB_URI);
  await mongoose.connect(MONGODB_URI);

  try {
    // Only create collections if they don't already exist
    const existing = await mongoose.connection.db.listCollections().toArray();
    const existingNames = new Set(existing.map(c => c.name));

    const targets = [
      { name: User.collection.collectionName, model: User },
      { name: Event.collection.collectionName, model: Event },
      { name: Job.collection.collectionName, model: Job },
      { name: News.collection.collectionName, model: News },
      { name: Conversation.collection.collectionName, model: Conversation },
      { name: Message.collection.collectionName, model: Message },
      { name: Campaign.collection.collectionName, model: Campaign },
      { name: Donation.collection.collectionName, model: Donation },
      { name: Group.collection.collectionName, model: Group },
      { name: ForumPost.collection.collectionName, model: ForumPost },
      { name: Chapter.collection.collectionName, model: Chapter },
    ];

    for (const { name, model } of targets) {
      if (!existingNames.has(name)) {
        await model.createCollection();
        console.log(`Created collection: ${name}`);
      } else {
        console.log(`Collection already exists: ${name}`);
      }
    }

    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Collections in database:');
    collections.forEach(c => console.log(' -', c.name));
  } catch (err) {
    console.error('Initialization error:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

init();