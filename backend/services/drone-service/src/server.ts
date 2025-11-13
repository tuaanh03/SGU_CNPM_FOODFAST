import cors from "cors";
import env from "dotenv";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import droneRoutes from "./routes/drone.routes";
import deliveryRoutes from "./routes/delivery.routes";
import express, { NextFunction, Request, Response } from "express";

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
server.use("/drones", droneRoutes);
server.use("/deliveries", deliveryRoutes);

// Health Check Route
server.get("/", (req: Request, res: Response) => {
  res.status(200).json({ success: true, message: "Drone service is running" });
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

const PORT = process.env.PORT || 3008;

server.listen(PORT, () => {
  console.log(`Drone service is running on port ${PORT}`);
});

