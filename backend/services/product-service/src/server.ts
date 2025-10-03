import cors from "cors";
import env from "dotenv";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { initKafka } from "./utils/kafka";
import productRoutes from "./routes/product.routes";
import categoryRoutes from "./routes/category.routes";
import express, { NextFunction, Request, Response } from "express";

env.config();

const server = express();

// Run kafka consumer
initKafka();

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
server.use("/products", productRoutes);
server.use("/categories", categoryRoutes);

// Health Check Route
server.get("/", (req: Request, res: Response) => {
  res.status(200).json({ success: true, message: "Product service is running" });
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

const PORT = process.env.PORT || 3004;

server.listen(PORT, () => {
  console.log(`Product service is running on port ${PORT}`);
});
