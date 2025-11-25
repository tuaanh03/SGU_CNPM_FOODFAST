import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Store, User, Navigation, Clock } from "lucide-react";
import type { Order, Drone } from "@/services/drone.service";

interface RouteMapDialogProps {
    open: boolean;
    onClose: () => void;
    order: Order;
    drone: Drone | null;
}

const RouteMapDialog = ({ open, onClose, order, drone }: RouteMapDialogProps) => {
    const restaurantWaypoint = order.route?.waypoints.find(w => w.type === 'restaurant');
    const customerWaypoint = order.route?.waypoints.find(w => w.type === 'customer');

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Bản Đồ Lộ Trình Giao Hàng</DialogTitle>
                    <DialogDescription>
                        Xem lộ trình chi tiết từ nhà hàng đến khách hàng
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 mt-4">
                    {/* Map Container - Using Google Maps Embed or Leaflet */}
                    <div className="relative w-full h-96 bg-gray-200 rounded-lg overflow-hidden">
                        {/* Simple map visualization with markers */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="relative w-full h-full p-8">
                                {/* Mock Map Background */}
                                <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-green-50">
                                    {/* Grid lines for map effect */}
                                    <svg className="w-full h-full opacity-20">
                                        <defs>
                                            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                                                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="gray" strokeWidth="1"/>
                                            </pattern>
                                        </defs>
                                        <rect width="100%" height="100%" fill="url(#grid)" />
                                    </svg>
                                </div>

                                {/* Route Line */}
                                <svg className="absolute inset-0 w-full h-full">
                                    <defs>
                                        <marker
                                            id="arrowhead"
                                            markerWidth="10"
                                            markerHeight="10"
                                            refX="5"
                                            refY="3"
                                            orient="auto"
                                        >
                                            <polygon points="0 0, 10 3, 0 6" fill="#3B82F6" />
                                        </marker>
                                    </defs>
                                    <line
                                        x1="20%"
                                        y1="30%"
                                        x2="80%"
                                        y2="70%"
                                        stroke="#3B82F6"
                                        strokeWidth="3"
                                        strokeDasharray="10,5"
                                        markerEnd="url(#arrowhead)"
                                    />
                                </svg>

                                {/* Restaurant Marker */}
                                <div className="absolute left-[20%] top-[30%] transform -translate-x-1/2 -translate-y-1/2">
                                    <div className="relative">
                                        <div className="bg-orange-500 rounded-full p-3 shadow-lg border-4 border-white">
                                            <Store className="h-6 w-6 text-white" />
                                        </div>
                                        <div className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                                            <Badge className="bg-orange-500">Điểm đi</Badge>
                                        </div>
                                    </div>
                                </div>

                                {/* Customer Marker */}
                                <div className="absolute left-[80%] top-[70%] transform -translate-x-1/2 -translate-y-1/2">
                                    <div className="relative">
                                        <div className="bg-green-500 rounded-full p-3 shadow-lg border-4 border-white">
                                            <User className="h-6 w-6 text-white" />
                                        </div>
                                        <div className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                                            <Badge className="bg-green-500">Điểm đến</Badge>
                                        </div>
                                    </div>
                                </div>

                                {/* Drone Position (if available) */}
                                {drone && (
                                    <div className="absolute left-[50%] top-[50%] transform -translate-x-1/2 -translate-y-1/2">
                                        <div className="relative animate-pulse">
                                            <div className="bg-blue-500 rounded-full p-3 shadow-lg border-4 border-white">
                                                <Navigation className="h-6 w-6 text-white" />
                                            </div>
                                            <div className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                                                <Badge className="bg-blue-500">{drone.name}</Badge>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Route Information Cards */}
                    <div className="grid gap-4 md:grid-cols-2">
                        {/* From - Restaurant */}
                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-start space-x-3">
                                    <div className="bg-orange-100 rounded-full p-2">
                                        <Store className="h-5 w-5 text-orange-600" />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-semibold text-sm mb-1">Điểm Đi (Nhà Hàng)</h4>
                                        <p className="text-sm font-medium text-gray-900">{order.restaurantName}</p>
                                        <p className="text-xs text-gray-600 mt-1">{restaurantWaypoint?.address}</p>
                                        {restaurantWaypoint && (
                                            <div className="mt-2 text-xs text-gray-500">
                                                <span>Lat: {restaurantWaypoint.lat.toFixed(6)}</span>
                                                <span className="mx-2">|</span>
                                                <span>Lng: {restaurantWaypoint.lng.toFixed(6)}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* To - Customer */}
                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-start space-x-3">
                                    <div className="bg-green-100 rounded-full p-2">
                                        <User className="h-5 w-5 text-green-600" />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-semibold text-sm mb-1">Điểm Đến (Khách Hàng)</h4>
                                        <p className="text-sm font-medium text-gray-900">{order.customerName}</p>
                                        <p className="text-xs text-gray-600 mt-1">{customerWaypoint?.address}</p>
                                        {customerWaypoint && (
                                            <div className="mt-2 text-xs text-gray-500">
                                                <span>Lat: {customerWaypoint.lat.toFixed(6)}</span>
                                                <span className="mx-2">|</span>
                                                <span>Lng: {customerWaypoint.lng.toFixed(6)}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Route Stats */}
                    {order.route && (
                        <Card className="bg-blue-50 border-blue-200">
                            <CardContent className="pt-6">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="flex items-center space-x-2">
                                        <MapPin className="h-5 w-5 text-blue-600" />
                                        <div>
                                            <p className="text-xs text-gray-600">Khoảng cách</p>
                                            <p className="text-lg font-bold text-blue-600">
                                                {order.route.distance} km
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Clock className="h-5 w-5 text-green-600" />
                                        <div>
                                            <p className="text-xs text-gray-600">Thời gian</p>
                                            <p className="text-lg font-bold text-green-600">
                                                ~{order.route.estimatedTime} phút
                                            </p>
                                        </div>
                                    </div>
                                    {drone && (
                                        <>
                                            <div className="flex items-center space-x-2">
                                                <Navigation className="h-5 w-5 text-purple-600" />
                                                <div>
                                                    <p className="text-xs text-gray-600">Drone</p>
                                                    <p className="text-sm font-bold text-purple-600">
                                                        {drone.name}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <div className="h-5 w-5 flex items-center justify-center">
                                                    ⚡
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-600">Pin</p>
                                                    <p className="text-sm font-bold text-gray-900">
                                                        {drone.battery}%
                                                    </p>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Note */}
                    <div className="text-center text-sm text-gray-500 p-4 bg-gray-50 rounded-lg">
                        <p className="font-medium">📍 Lưu ý: Đây là bản đồ mô phỏng (Mock)</p>
                        <p className="text-xs mt-1">
                            Trong phiên bản production, sẽ tích hợp Google Maps hoặc Leaflet để hiển thị bản đồ thực tế
                        </p>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default RouteMapDialog;

