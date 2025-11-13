import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Battery, Weight, Navigation, CheckCircle } from "lucide-react";
import type { Drone } from "@/services/mockData";

interface DroneSelectionDialogProps {
    open: boolean;
    onClose: () => void;
    drones: Drone[];
    onSelect: (drone: Drone) => void;
}

const DroneSelectionDialog = ({ open, onClose, drones, onSelect }: DroneSelectionDialogProps) => {
    const getBatteryColor = (battery: number) => {
        if (battery >= 70) return "text-green-600";
        if (battery >= 40) return "text-yellow-600";
        return "text-red-600";
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'AVAILABLE':
                return 'bg-green-100 text-green-800';
            case 'IN_USE':
                return 'bg-blue-100 text-blue-800';
            case 'CHARGING':
                return 'bg-yellow-100 text-yellow-800';
            case 'MAINTENANCE':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'AVAILABLE':
                return 'Sẵn Sàng';
            case 'IN_USE':
                return 'Đang Sử Dụng';
            case 'CHARGING':
                return 'Đang Sạc';
            case 'MAINTENANCE':
                return 'Bảo Trì';
            default:
                return status;
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Chọn Drone Phù Hợp</DialogTitle>
                    <DialogDescription>
                        Chọn drone tốt nhất cho đơn hàng này dựa trên pin, tải trọng và khoảng cách
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                    {drones.length === 0 ? (
                        <div className="text-center py-8">
                            <p className="text-gray-500">Không có drone phù hợp</p>
                        </div>
                    ) : (
                        drones.map((drone) => (
                            <Card
                                key={drone.id}
                                className="cursor-pointer transition-all hover:shadow-md hover:border-blue-300"
                                onClick={() => onSelect(drone)}
                            >
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between mb-4">
                                        <div>
                                            <h3 className="text-lg font-semibold">{drone.name}</h3>
                                            <p className="text-sm text-gray-600">{drone.model}</p>
                                        </div>
                                        <Badge className={getStatusColor(drone.status)}>
                                            {getStatusText(drone.status)}
                                        </Badge>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="flex items-center space-x-2">
                                            <Battery className={`h-5 w-5 ${getBatteryColor(drone.battery)}`} />
                                            <div>
                                                <p className="text-xs text-gray-500">Pin</p>
                                                <p className={`text-sm font-medium ${getBatteryColor(drone.battery)}`}>
                                                    {drone.battery}%
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <Weight className="h-5 w-5 text-blue-600" />
                                            <div>
                                                <p className="text-xs text-gray-500">Tải trọng</p>
                                                <p className="text-sm font-medium">{drone.maxPayload} kg</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <Navigation className="h-5 w-5 text-purple-600" />
                                            <div>
                                                <p className="text-xs text-gray-500">Khoảng cách</p>
                                                <p className="text-sm font-medium">
                                                    {drone.distanceFromRestaurant?.toFixed(1)} km
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center">
                                            <Button
                                                size="sm"
                                                className="w-full"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onSelect(drone);
                                                }}
                                            >
                                                <CheckCircle className="mr-1 h-4 w-4" />
                                                Chọn
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default DroneSelectionDialog;

