import 'express-async-errors'; // Essential for catching async thrown errors in Express 4
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import apiRoutes from './routes';
import { errorHandler } from './middleware/error.middleware';
import { config } from './config';

const app = express();

// Security and core middleware
app.use(helmet());
app.use(
  cors({
    origin: config.FRONTEND_URL,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging
const logFormat = config.NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(morgan(logFormat));

// Mount main routing sub-routes
app.use('/api', apiRoutes);

// Mount global error handler (must be last)
app.use(errorHandler);

export default app;
