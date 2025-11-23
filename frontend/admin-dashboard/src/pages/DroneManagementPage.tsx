import { useState, useEffect } from "react";
import { droneService, type Drone } from "@/services/drone.service";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Battery, MapPin } from "lucide-react";

const DroneManagementPage = () => {
  const [drones, setDrones] = useState<Drone[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingDrone, setEditingDrone] = useState<Drone | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    model: "",
    serialNumber: "",
    maxPayload: 5.0,
    maxRange: 20.0,
  });

  useEffect(() => {
    loadDrones();
  }, []);

  const loadDrones = async () => {
    try {
      setLoading(true);
      const response = await droneService.getAllDrones();
      if (response.success) {
        setDrones(response.data);
      }
    } catch (error) {
      console.error("Error loading drones:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const response = await droneService.createDrone(formData);
      if (response.success) {
        setIsCreateOpen(false);
        loadDrones();
        resetForm();
      }
    } catch (error) {
      console.error("Error creating drone:", error);
    }
  };

  const handleUpdate = async () => {
    if (!editingDrone) return;
    try {
      const response = await droneService.updateDrone(editingDrone.id, formData);
      if (response.success) {
        setEditingDrone(null);
        loadDrones();
        resetForm();
      }
    } catch (error) {
      console.error("Error updating drone:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bạn có chắc muốn xóa drone này?")) return;
    try {
      const response = await droneService.deleteDrone(id);
      if (response.success) {
        loadDrones();
      }
    } catch (error) {
      console.error("Error deleting drone:", error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      model: "",
      serialNumber: "",
      maxPayload: 5.0,
      maxRange: 20.0,
    });
  };

  const openEditDialog = (drone: Drone) => {
    setEditingDrone(drone);
    setFormData({
      name: drone.name,
      model: drone.model,
      serialNumber: drone.serialNumber,
      maxPayload: drone.maxPayload,
      maxRange: drone.maxRange,
    });
  };

  const getStatusColor = (status: Drone["status"]) => {
    const colors = {
      AVAILABLE: "bg-green-500",
      IN_USE: "bg-blue-500",
      CHARGING: "bg-yellow-500",
      MAINTENANCE: "bg-orange-500",
      OFFLINE: "bg-gray-500",
    };
    return colors[status];
  };

  const getStatusText = (status: Drone["status"]) => {
    const texts = {
      AVAILABLE: "Sẵn sàng",
      IN_USE: "Đang giao",
      CHARGING: "Đang sạc",
      MAINTENANCE: "Bảo trì",
      OFFLINE: "Offline",
    };
    return texts[status];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent"></div>
          <p className="mt-4 text-gray-600 font-medium">Đang tải dữ liệu drone...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Modern Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <div className="bg-blue-600 p-2 rounded-lg">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </div>
                Quản lý Drone
              </h1>
              <p className="text-gray-500 mt-1">Quản lý đội bay drone giao hàng của bạn</p>
            </div>

            {/* Stats Summary */}
            <div className="flex gap-4">
              <div className="bg-green-50 px-4 py-2 rounded-lg border border-green-200">
                <p className="text-sm text-green-600 font-medium">Sẵn sàng</p>
                <p className="text-2xl font-bold text-green-700">
                  {drones.filter(d => d.status === 'AVAILABLE').length}
                </p>
              </div>
              <div className="bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-600 font-medium">Đang bay</p>
                <p className="text-2xl font-bold text-blue-700">
                  {drones.filter(d => d.status === 'IN_USE').length}
                </p>
              </div>
              <div className="bg-yellow-50 px-4 py-2 rounded-lg border border-yellow-200">
                <p className="text-sm text-yellow-600 font-medium">Sạc/Bảo trì</p>
                <p className="text-2xl font-bold text-yellow-700">
                  {drones.filter(d => d.status === 'CHARGING' || d.status === 'MAINTENANCE').length}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              Tất cả ({drones.length})
            </Button>
            <Button variant="ghost" size="sm">
              Sẵn sàng ({drones.filter(d => d.status === 'AVAILABLE').length})
            </Button>
            <Button variant="ghost" size="sm">
              Đang bay ({drones.filter(d => d.status === 'IN_USE').length})
            </Button>
          </div>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/30">
                <Plus className="w-4 h-4 mr-2" />
                Thêm Drone Mới
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Thêm Drone Mới</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Tên Drone</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Drone Alpha"
                />
              </div>
              <div>
                <Label>Model</Label>
                <Input
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  placeholder="DJI Mavic 3"
                />
              </div>
              <div>
                <Label>Serial Number</Label>
                <Input
                  value={formData.serialNumber}
                  onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                  placeholder="DJI-001"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tải trọng tối đa (kg)</Label>
                  <Input
                    type="number"
                    value={formData.maxPayload}
                    onChange={(e) => setFormData({ ...formData, maxPayload: parseFloat(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Tầm bay tối đa (km)</Label>
                  <Input
                    type="number"
                    value={formData.maxRange}
                    onChange={(e) => setFormData({ ...formData, maxRange: parseFloat(e.target.value) })}
                  />
                </div>
              </div>
              <Button onClick={handleCreate} className="w-full">
                Tạo Drone
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {drones.length === 0 ? (
        <div className="col-span-full text-center py-16">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-blue-100 mb-4">
            <svg className="w-12 h-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Chưa có drone nào</h3>
          <p className="text-gray-500 mb-6">Thêm drone đầu tiên để bắt đầu quản lý đội bay của bạn</p>
          <Button onClick={() => setIsCreateOpen(true)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Thêm Drone Đầu Tiên
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {drones.map((drone) => (
          <Card key={drone.id} className="hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 border-0 shadow-lg overflow-hidden">
            {/* Card Header with Gradient */}
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 text-white">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-2xl font-bold">{drone.name}</h3>
                  <p className="text-blue-100 text-sm mt-1">{drone.model}</p>
                </div>
                <Badge className={`${getStatusColor(drone.status)} text-white border-0 px-3 py-1`}>
                  {getStatusText(drone.status)}
                </Badge>
              </div>

              {/* Battery Display - Prominent */}
              <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Battery className="w-5 h-5" />
                    <span className="font-semibold">Pin</span>
                  </div>
                  <span className="text-2xl font-bold">{drone.battery}%</span>
                </div>
                <div className="w-full bg-white/30 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-3 rounded-full transition-all duration-500 ${
                      drone.battery > 70 ? "bg-green-400" : 
                      drone.battery > 30 ? "bg-yellow-400" : "bg-red-400"
                    }`}
                    style={{ width: `${drone.battery}%` }}
                  />
                </div>
              </div>
            </div>

            <CardContent className="p-6">
              <div className="space-y-4">
                {/* Specs Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Tải trọng</p>
                    <p className="text-lg font-bold text-gray-900">{drone.maxPayload} kg</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Tầm bay</p>
                    <p className="text-lg font-bold text-gray-900">{drone.maxRange} km</p>
                  </div>
                </div>

                {/* Serial Number */}
                <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500">Serial Number</p>
                    <p className="text-sm font-mono font-semibold text-gray-900">{drone.serialNumber}</p>
                  </div>
                </div>

                {/* Location */}
                {drone.currentLat && drone.currentLng && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-100">
                    <MapPin className="w-5 h-5 text-green-600" />
                    <div className="flex-1">
                      <p className="text-xs text-gray-500">Vị trí hiện tại</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {drone.currentLat.toFixed(4)}, {drone.currentLng.toFixed(4)}
                      </p>
                    </div>
                  </div>
                )}
                {/* Action Buttons */}
                <div className="flex gap-2 pt-4 border-t">
                  <Dialog
                    open={editingDrone?.id === drone.id}
                    onOpenChange={(open) => {
                      if (!open) {
                        setEditingDrone(null);
                        resetForm();
                      }
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 transition-all"
                        onClick={() => openEditDialog(drone)}
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Chỉnh sửa
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Cập nhật Drone</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Tên Drone</Label>
                          <Input
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>Model</Label>
                          <Input
                            value={formData.model}
                            onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                          />
                        </div>
                        <Button onClick={handleUpdate} className="w-full">
                          Cập nhật
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-all"
                    onClick={() => handleDelete(drone.id)}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Xóa
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        </div>
      )}
      </div>
    </div>
  );
};

export default DroneManagementPage;

