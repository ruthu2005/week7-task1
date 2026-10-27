import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

let isConnected = false;
let useMemoryStore = false;

/**
 * Connect to MongoDB or activate resilient in-memory store if MongoDB server is offline
 */
export const connectDB = async () => {
  if (isConnected) return;

  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/jwt_auth_db';

  try {
    mongoose.set('strictQuery', false);
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 2000,
      connectTimeoutMS: 2000
    });
    isConnected = true;
    useMemoryStore = false;
    console.log(`[Database] MongoDB connected successfully to ${mongoUri}`);
  } catch (error) {
    console.warn(`[Database] Notice: Local MongoDB not reachable (${error.message}).`);
    console.log('[Database] Activating zero-config resilient in-memory store for seamless execution and testing.');
    isConnected = true;
    useMemoryStore = true;
  }
};

export const disconnectDB = async () => {
  if (mongoose.connection && mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  isConnected = false;
};

export const isUsingMemoryStore = () => useMemoryStore;
