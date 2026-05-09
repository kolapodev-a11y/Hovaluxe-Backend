const mongoose = require('mongoose');
const { mongoUri } = require('./env');

let reconnecting = false;

async function connectDB() {
  if (!mongoUri) {
    throw new Error('MONGODB_URI is missing.');
  }

  await mongoose.connect(mongoUri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  });

  console.log('✅ MongoDB connected');
}

function registerMongoEvents() {
  mongoose.connection.on('error', (error) => {
    console.error('MongoDB runtime error:', error.message);
  });

  mongoose.connection.on('disconnected', async () => {
    if (reconnecting) return;
    reconnecting = true;
    console.warn('MongoDB disconnected. Retrying in 5 seconds...');
    setTimeout(async () => {
      try {
        await connectDB();
      } catch (error) {
        console.error('Reconnection failed:', error.message);
      } finally {
        reconnecting = false;
      }
    }, 5000);
  });
}

module.exports = { connectDB, registerMongoEvents };
