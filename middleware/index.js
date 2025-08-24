import bodyParser from "body-parser";
import cors from "cors";

export function setupMiddleware(app) {
  // Enhanced CORS configuration for Vite (port 5173)
  app.use(cors({
    origin: [
      "http://localhost:5173", // Vite default port
      "http://127.0.0.1:5173",
      "http://localhost:3000", // Create React App fallback
      "http://127.0.0.1:3000"
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    credentials: true
  }));
  app.options('*', cors()); // Handle preflight requests

  // Handle preflight requests
  app.options('*', cors());

  app.use(bodyParser.json({ limit: '10mb' }));
  app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
}