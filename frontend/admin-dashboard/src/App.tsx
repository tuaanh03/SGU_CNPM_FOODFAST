import { Toaster } from "sonner";
import { BrowserRouter, Route, Routes } from "react-router";
import { AuthProvider } from "@/contexts/auth-context";
import { AdminSocketProvider } from "@/contexts/AdminSocketContext";
import ProtectedRoute from "@/components/ProtectedRoute";

import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import DispatchQueuePage from "./pages/DispatchQueuePage";
import DeliveryManagementPage from "./pages/DeliveryManagementPage";
import CompletedDeliveriesPage from "./pages/CompletedDeliveriesPage";
import CompletedDeliveryDetailPage from "./pages/CompletedDeliveryDetailPage";
import OrderDetailPage from "./pages/OrderDetailPage";
import RouteTrackingPage from "./pages/RouteTrackingPage";
import DroneManagementPage from "./pages/DroneManagementPage";
import NotFound from "./pages/NotFound";

function App() {
    return (
        <>
            <Toaster />
            <AuthProvider>
                <AdminSocketProvider>
                    <BrowserRouter>
                    <Routes>
                        {/* Auth Routes */}
                        <Route path="/login" element={<LoginPage />} />

                        {/* Protected Routes - System Admin Only */}
                        <Route
                            path="/"
                            element={
                                <ProtectedRoute requiredRole="SYSTEM_ADMIN">
                                    <DashboardPage />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/dispatch"
                            element={
                                <ProtectedRoute requiredRole="SYSTEM_ADMIN">
                                    <DispatchQueuePage />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/deliveries"
                            element={
                                <ProtectedRoute requiredRole="SYSTEM_ADMIN">
                                    <DeliveryManagementPage />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/order/:orderId"
                            element={
                                <ProtectedRoute requiredRole="SYSTEM_ADMIN">
                                    <OrderDetailPage />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/order/:orderId/tracking"
                            element={
                                <ProtectedRoute requiredRole="SYSTEM_ADMIN">
                                    <RouteTrackingPage />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/drones"
                            element={
                                <ProtectedRoute requiredRole="SYSTEM_ADMIN">
                                    <DroneManagementPage />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/completed-deliveries"
                            element={
                                <ProtectedRoute requiredRole="SYSTEM_ADMIN">
                                    <CompletedDeliveriesPage />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/completed-deliveries/:orderId"
                            element={
                                <ProtectedRoute requiredRole="SYSTEM_ADMIN">
                                    <CompletedDeliveryDetailPage />
                                </ProtectedRoute>
                            }
                        />

                        <Route path="*" element={<NotFound />} />
                    </Routes>
                </BrowserRouter>
                </AdminSocketProvider>
            </AuthProvider>
        </>
    );
}

export default App;

