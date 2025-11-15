export interface Order {
    id: string;
    orderCode: string;
    customerName: string;
    customerPhone: string;
    customerAddress: string;
    restaurantName: string;
    restaurantAddress: string;
    status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'IN_TRANSIT' | 'DELIVERED';
    totalAmount: number;
    createdAt: string;
    items: OrderItem[];
    route?: RouteInfo;
}

export interface OrderItem {
    id: string;
    productName: string;
    quantity: number;
    price: number;
}

export interface RouteInfo {
    distance: number; // in km
    estimatedTime: number; // in minutes
    waypoints: Waypoint[];
}

export interface Waypoint {
    lat: number;
    lng: number;
    address: string;
    type: 'restaurant' | 'customer';
}

export interface Drone {
    id: string;
    name: string;
    model: string;
    battery: number; // percentage
    maxPayload: number; // in kg
    currentLocation: {
        lat: number;
        lng: number;
    };
    status: 'AVAILABLE' | 'IN_USE' | 'CHARGING' | 'MAINTENANCE';
    distanceFromRestaurant?: number; // in km
}

// Mock Orders Data
export const mockOrders: Order[] = [
    {
        id: '1',
        orderCode: 'ORD-2024-001',
        customerName: 'Nguyễn Văn A',
        customerPhone: '0901234567',
        customerAddress: '123 Đường Lê Lợi, Quận 1, TP.HCM',
        restaurantName: 'Nhà hàng Phở Việt',
        restaurantAddress: '45 Đường Nguyễn Huệ, Quận 1, TP.HCM',
        status: 'PENDING_APPROVAL',
        totalAmount: 250000,
        createdAt: '2024-11-13T10:30:00',
        items: [
            { id: '1', productName: 'Phở Bò Đặc Biệt', quantity: 2, price: 85000 },
            { id: '2', productName: 'Gỏi Cuốn', quantity: 1, price: 40000 },
            { id: '3', productName: 'Trà Đá', quantity: 2, price: 20000 },
        ],
        route: {
            distance: 2.5,
            estimatedTime: 15,
            waypoints: [
                {
                    lat: 10.7769,
                    lng: 106.7009,
                    address: '45 Đường Nguyễn Huệ, Quận 1, TP.HCM',
                    type: 'restaurant'
                },
                {
                    lat: 10.7756,
                    lng: 106.7019,
                    address: '123 Đường Lê Lợi, Quận 1, TP.HCM',
                    type: 'customer'
                }
            ]
        }
    },
    {
        id: '2',
        orderCode: 'ORD-2024-002',
        customerName: 'Trần Thị B',
        customerPhone: '0912345678',
        customerAddress: '789 Đường Võ Văn Tần, Quận 3, TP.HCM',
        restaurantName: 'Quán Cơm Tấm Sườn',
        restaurantAddress: '12 Đường Pasteur, Quận 1, TP.HCM',
        status: 'PENDING_APPROVAL',
        totalAmount: 180000,
        createdAt: '2024-11-13T11:00:00',
        items: [
            { id: '1', productName: 'Cơm Tấm Sườn Bì Chả', quantity: 1, price: 65000 },
            { id: '2', productName: 'Cơm Tấm Sườn Nướng', quantity: 1, price: 60000 },
            { id: '3', productName: 'Trà Sữa', quantity: 1, price: 35000 },
        ],
        route: {
            distance: 3.2,
            estimatedTime: 20,
            waypoints: [
                {
                    lat: 10.7795,
                    lng: 106.6946,
                    address: '12 Đường Pasteur, Quận 1, TP.HCM',
                    type: 'restaurant'
                },
                {
                    lat: 10.7823,
                    lng: 106.6899,
                    address: '789 Đường Võ Văn Tần, Quận 3, TP.HCM',
                    type: 'customer'
                }
            ]
        }
    },
    {
        id: '3',
        orderCode: 'ORD-2024-003',
        customerName: 'Lê Văn C',
        customerPhone: '0923456789',
        customerAddress: '456 Đường Hai Bà Trưng, Quận 1, TP.HCM',
        restaurantName: 'Bánh Mì Huỳnh Hoa',
        restaurantAddress: '26 Đường Lê Thị Riêng, Quận 1, TP.HCM',
        status: 'PENDING_APPROVAL',
        totalAmount: 95000,
        createdAt: '2024-11-13T11:15:00',
        items: [
            { id: '1', productName: 'Bánh Mì Đặc Biệt', quantity: 3, price: 25000 },
            { id: '2', productName: 'Cafe Sữa Đá', quantity: 2, price: 20000 },
        ],
        route: {
            distance: 1.8,
            estimatedTime: 12,
            waypoints: [
                {
                    lat: 10.7689,
                    lng: 106.6917,
                    address: '26 Đường Lê Thị Riêng, Quận 1, TP.HCM',
                    type: 'restaurant'
                },
                {
                    lat: 10.7734,
                    lng: 106.6978,
                    address: '456 Đường Hai Bà Trưng, Quận 1, TP.HCM',
                    type: 'customer'
                }
            ]
        }
    },
    {
        id: '4',
        orderCode: 'ORD-2024-004',
        customerName: 'Phạm Thị D',
        customerPhone: '0934567890',
        customerAddress: '321 Đường Cách Mạng Tháng 8, Quận 10, TP.HCM',
        restaurantName: 'Lẩu Thái Tom Yum',
        restaurantAddress: '88 Đường Sư Vạn Hạnh, Quận 10, TP.HCM',
        status: 'PENDING_APPROVAL',
        totalAmount: 450000,
        createdAt: '2024-11-13T11:30:00',
        items: [
            { id: '1', productName: 'Lẩu Thái Hải Sản', quantity: 1, price: 350000 },
            { id: '2', productName: 'Mì Thái', quantity: 2, price: 40000 },
            { id: '3', productName: 'Nước Chanh Dây', quantity: 2, price: 30000 },
        ],
        route: {
            distance: 4.5,
            estimatedTime: 25,
            waypoints: [
                {
                    lat: 10.7712,
                    lng: 106.6645,
                    address: '88 Đường Sư Vạn Hạnh, Quận 10, TP.HCM',
                    type: 'restaurant'
                },
                {
                    lat: 10.7745,
                    lng: 106.6689,
                    address: '321 Đường Cách Mạng Tháng 8, Quận 10, TP.HCM',
                    type: 'customer'
                }
            ]
        }
    },
    {
        id: '5',
        orderCode: 'ORD-2024-005',
        customerName: 'Hoàng Văn E',
        customerPhone: '0945678901',
        customerAddress: '555 Đường Điện Biên Phủ, Quận Bình Thạnh, TP.HCM',
        restaurantName: 'Bún Bò Huế An Nam',
        restaurantAddress: '22 Đường Phan Đăng Lưu, Quận Bình Thạnh, TP.HCM',
        status: 'PENDING_APPROVAL',
        totalAmount: 165000,
        createdAt: '2024-11-13T11:45:00',
        items: [
            { id: '1', productName: 'Bún Bò Huế Đặc Biệt', quantity: 2, price: 60000 },
            { id: '2', productName: 'Nem Chua Rán', quantity: 1, price: 45000 },
        ],
        route: {
            distance: 2.1,
            estimatedTime: 14,
            waypoints: [
                {
                    lat: 10.7995,
                    lng: 106.6765,
                    address: '22 Đường Phan Đăng Lưu, Quận Bình Thạnh, TP.HCM',
                    type: 'restaurant'
                },
                {
                    lat: 10.8012,
                    lng: 106.6834,
                    address: '555 Đường Điện Biên Phủ, Quận Bình Thạnh, TP.HCM',
                    type: 'customer'
                }
            ]
        }
    }
];

// Mock Drones Data
export const mockDrones: Drone[] = [
    {
        id: '1',
        name: 'Drone Alpha 01',
        model: 'DJI Matrice 300',
        battery: 95,
        maxPayload: 5.5,
        currentLocation: {
            lat: 10.7769,
            lng: 106.7009
        },
        status: 'AVAILABLE'
    },
    {
        id: '2',
        name: 'Drone Beta 02',
        model: 'DJI Matrice 300',
        battery: 87,
        maxPayload: 5.5,
        currentLocation: {
            lat: 10.7823,
            lng: 106.6899
        },
        status: 'AVAILABLE'
    },
    {
        id: '3',
        name: 'Drone Gamma 03',
        model: 'Autel EVO Max 4T',
        battery: 72,
        maxPayload: 4.0,
        currentLocation: {
            lat: 10.7712,
            lng: 106.6645
        },
        status: 'AVAILABLE'
    },
    {
        id: '4',
        name: 'Drone Delta 04',
        model: 'DJI Matrice 30T',
        battery: 65,
        maxPayload: 4.5,
        currentLocation: {
            lat: 10.7995,
            lng: 106.6765
        },
        status: 'CHARGING'
    },
    {
        id: '5',
        name: 'Drone Epsilon 05',
        model: 'DJI Mavic 3',
        battery: 42,
        maxPayload: 2.0,
        currentLocation: {
            lat: 10.7689,
            lng: 106.6917
        },
        status: 'AVAILABLE'
    },
    {
        id: '6',
        name: 'Drone Zeta 06',
        model: 'Autel EVO Max 4T',
        battery: 35,
        maxPayload: 4.0,
        currentLocation: {
            lat: 10.7745,
            lng: 106.6689
        },
        status: 'IN_USE'
    },
    {
        id: '7',
        name: 'Drone Eta 07',
        model: 'DJI Matrice 300',
        battery: 20,
        maxPayload: 5.5,
        currentLocation: {
            lat: 10.8012,
            lng: 106.6834
        },
        status: 'CHARGING'
    }
];

// Helper function to calculate distance between two coordinates (Haversine formula)
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    return Math.round(distance * 10) / 10; // Round to 1 decimal place
}

// Get suitable drones for an order
export function getSuitableDrones(order: Order): Drone[] {
    const restaurantLocation = order.route?.waypoints.find(w => w.type === 'restaurant');
    if (!restaurantLocation) return [];

    // Calculate total weight of order (mock calculation)
    const orderWeight = order.items.reduce((total, item) => total + (item.quantity * 0.5), 0);

    return mockDrones
        .filter(drone =>
            drone.status === 'AVAILABLE' &&
            drone.battery > 30 &&
            drone.maxPayload >= orderWeight
        )
        .map(drone => ({
            ...drone,
            distanceFromRestaurant: calculateDistance(
                drone.currentLocation.lat,
                drone.currentLocation.lng,
                restaurantLocation.lat,
                restaurantLocation.lng
            )
        }))
        .sort((a, b) => (a.distanceFromRestaurant || 0) - (b.distanceFromRestaurant || 0));
}

