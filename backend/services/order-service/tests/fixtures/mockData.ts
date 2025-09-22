// Mock data cho tests - dữ liệu giả để test
export const mockUser = {
  id: "123e4567-e89b-12d3-a456-426614174000"
};

export const mockOrderItems = [
  {
    productId: "550e8400-e29b-41d4-a716-446655440001",
    quantity: 1
  },
  {
    productId: "550e8400-e29b-41d4-a716-446655440002",
    quantity: 1
  }
];

// Mock response từ Product Service (qua API Gateway) - sửa để khớp với schema mới
export const mockProductResponse = {
  data: {
    id: "550e8400-e29b-41d4-a716-446655440001",
    name: "iPhone 15",
    sku: "IP15-128-BLK",
    price: 12000000,
    isAvailable: true, // Sửa từ isActive thành isAvailable
    stockOnHand: 10
  }
};

export const mockProductResponse2 = {
  data: {
    id: "550e8400-e29b-41d4-a716-446655440002",
    name: "Samsung Galaxy S24",
    sku: "SGS24-256-WHT",
    price: 15000000,
    isAvailable: true,
    stockOnHand: 5
  }
};

// Mock order record từ database - sửa theo schema mới
export const mockOrder = {
  id: "order-550e8400-e29b-41d4-a716-446655440000",
  userId: mockUser.id,
  totalPrice: 12000000,
  deliveryAddress: "123 Test Street",
  contactPhone: "0901234567",
  note: "Test order",
  status: "pending",
  items: [
    {
      id: "item-1",
      productId: "550e8400-e29b-41d4-a716-446655440001",
      productName: "iPhone 15",
      productPrice: 12000000,
      quantity: 1
    }
  ],
  createdAt: new Date("2024-01-15T10:00:00.000Z"),
  updatedAt: new Date("2024-01-15T10:00:00.000Z")
};

export const mockValidOrderRequest = {
  items: [
    {
      productId: "550e8400-e29b-41d4-a716-446655440001",
      quantity: 1
    }
  ],
  deliveryAddress: "123 Test Street",
  contactPhone: "0901234567",
  note: "Test order"
};

export const mockRequest = (body: any = {}, params: any = {}) => ({
  user: mockUser,
  body,
  params,
  // Thêm các properties cần thiết cho Express Request
  cookies: {},
  signedCookies: {},
  get: jest.fn(),
  header: jest.fn(),
  accepts: jest.fn(),
  acceptsCharsets: jest.fn(),
  acceptsEncodings: jest.fn(),
  acceptsLanguages: jest.fn(),
  range: jest.fn(),
  query: {},
  route: {},
  hostname: 'localhost',
  ip: '127.0.0.1',
  ips: [],
  originalUrl: '/test',
  baseUrl: '',
  path: '/test',
  protocol: 'http',
  secure: false,
  xhr: false,
  method: 'POST',
  url: '/test',
  headers: {},
  rawHeaders: [],
  httpVersion: '1.1',
  httpVersionMajor: 1,
  httpVersionMinor: 1,
  connection: {},
  socket: {},
  readable: true,
  readableHighWaterMark: 16384,
  readableBuffer: {},
  readableFlowing: null,
  readableLength: 0,
  readableObjectMode: false,
  destroyed: false,
  _events: {},
  _eventsCount: 0,
  _maxListeners: undefined,
  pipe: jest.fn(),
  read: jest.fn(),
  setEncoding: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  isPaused: jest.fn(),
  unpipe: jest.fn(),
  unshift: jest.fn(),
  wrap: jest.fn(),
  push: jest.fn(),
  _destroy: jest.fn(),
  destroy: jest.fn(),
  _undestroy: jest.fn(),
  _read: jest.fn(),
  addListener: jest.fn(),
  on: jest.fn(),
  once: jest.fn(),
  off: jest.fn(),
  removeListener: jest.fn(),
  removeAllListeners: jest.fn(),
  setMaxListeners: jest.fn(),
  getMaxListeners: jest.fn(),
  listeners: jest.fn(),
  rawListeners: jest.fn(),
  emit: jest.fn(),
  listenerCount: jest.fn(),
  prependListener: jest.fn(),
  prependOnceListener: jest.fn(),
  eventNames: jest.fn()
} as any);

export const mockResponse = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};
