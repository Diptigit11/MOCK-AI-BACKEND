// routes/authRoutes.js
import express from "express";
import { registerUser, loginUser, getUser } from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";


const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/me", protect, getUser);

export default router;
