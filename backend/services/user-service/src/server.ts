import cors from "cors";
import env from "dotenv";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import express, { NextFunction, Request, Response } from "express";

// Import routes
import authRoutes from "./routes/auth.routes";
import addressRoutes from "./routes/address.routes";
import paymentMethodRoutes from "./routes/payment-methods.routes";

env.config();

const server = express();

// Middleware's
server.use(express.json());
server.use(cookieParser());
server.use(
  cors({
    origin: "http://localhost:3000",
  })
);
server.use(morgan("dev"));

// Routes
server.use("/auth", authRoutes);
server.use("/addresses", addressRoutes);
server.use("/payment-methods", paymentMethodRoutes);

// Health Check Route
server.get("/", (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "User service is running",
    service: "user-service",
    version: "1.0.0"
  });
});

// Error handling middleware
server.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

// 404 handler
server.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

const PORT = process.env.PORT || 3003;

server.listen(PORT, () => {
  console.log(`User service is running on port ${PORT}`);
});
