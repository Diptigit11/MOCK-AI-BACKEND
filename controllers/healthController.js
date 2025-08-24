export const healthCheck = (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    gemini: process.env.GEMINI_API_KEY ? "configured" : "missing",
  });
};
