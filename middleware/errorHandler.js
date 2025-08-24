import multer from "multer";

export function errorHandler(error, req, res, next) {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size too large. Maximum size is 5MB.' });
    }
  }
  console.error("Server error:", error);
  res.status(500).json({ error: "Internal server error", details: error.message });
}

export function notFoundHandler(req, res) {
  console.log("404 - Route not found:", req.originalUrl);
  res.status(404).json({ 
    error: "Route not found",
    path: req.originalUrl,
    method: req.method
  });
}