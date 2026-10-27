import dotenv from 'dotenv';
import app from './app.js';
import { connectDB } from './config/db.js';

dotenv.config();

const PORT = process.env.PORT || 5000;

// Connect to Database and start listening
const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log('====================================================');
      console.log(` JWT User Authentication Backend Server Running`);
      console.log(` Local URL:        http://localhost:${PORT}`);
      console.log(` Health Check:     http://localhost:${PORT}/api/health`);
      console.log(` Interactive UI:   http://localhost:${PORT}`);
      console.log(` Environment:      ${process.env.NODE_ENV || 'development'}`);
      console.log('====================================================');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
