import { createOrder, getOrderStatus, getPaymentUrl, getUserOrders } from '../../src/controllers/order';
import { mockRequest, mockResponse, mockValidOrderRequest, mockProductResponse, mockOrder } from '../fixtures/mockData';
import * as kafkaUtils from '../../src/utils/kafka';
import prisma from '../../src/lib/prisma';

// Mock external dependencies
jest.mock('../../src/lib/prisma', () => ({
  order: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
}));

jest.mock('../../src/utils/kafka', () => ({
  publishEvent: jest.fn(),
}));

// Mock fetch để simulate API Gateway calls
global.fetch = jest.fn();

describe('Order Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset fetch mock
    (global.fetch as jest.Mock).mockClear();
  });

  describe('createOrder', () => {
    describe('Tạo order thành công với 1 sản phẩm', () => {
      it('nên tạo order thành công khi có 1 sản phẩm hợp lệ', async () => {
        // ARRANGE - Chuẩn bị dữ liệu test
        const req = mockRequest(mockValidOrderRequest);
        const res = mockResponse();

        // Mock Product Service response qua API Gateway
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => mockProductResponse,
        });

        // Mock Prisma order.create response
        const mockCreatedOrder = {
          ...mockOrder,
          items: [
            {
              id: "item-1",
              productId: mockValidOrderRequest.items[0].productId,
              productName: mockProductResponse.data.name,
              productPrice: mockProductResponse.data.price,
              quantity: mockValidOrderRequest.items[0].quantity,
            }
          ]
        };
        (prisma.order.create as jest.Mock).mockResolvedValue(mockCreatedOrder);

        // Mock Kafka publish
        (kafkaUtils.publishEvent as jest.Mock).mockResolvedValue(undefined);

        // ACT - Thực hiện hành động
        await createOrder(req, res);

        // ASSERT - Kiểm tra kết quả
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(global.fetch).toHaveBeenCalledWith(
          `http://api-gateway:3000/api/products/${mockValidOrderRequest.items[0].productId}`
        );

        expect(prisma.order.create).toHaveBeenCalledTimes(1);
        expect(prisma.order.create).toHaveBeenCalledWith({
          data: {
            userId: req.user.id,
            totalPrice: mockProductResponse.data.price * mockValidOrderRequest.items[0].quantity,
            deliveryAddress: mockValidOrderRequest.deliveryAddress,
            contactPhone: mockValidOrderRequest.contactPhone,
            note: mockValidOrderRequest.note,
            status: "pending",
            items: {
              create: [
                {
                  productId: mockValidOrderRequest.items[0].productId,
                  productName: mockProductResponse.data.name,
                  productPrice: mockProductResponse.data.price,
                  quantity: mockValidOrderRequest.items[0].quantity,
                }
              ]
            }
          },
          include: {
            items: true
          }
        });

        expect(kafkaUtils.publishEvent).toHaveBeenCalledTimes(1);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          message: "Đơn hàng đã được tạo và đang chờ kiểm tra tồn kho",
          data: {
            orderId: mockCreatedOrder.id,
            items: [
              {
                productId: mockValidOrderRequest.items[0].productId,
                productName: mockProductResponse.data.name,
                productPrice: mockProductResponse.data.price,
                quantity: mockValidOrderRequest.items[0].quantity,
                subtotal: mockProductResponse.data.price * mockValidOrderRequest.items[0].quantity,
              }
            ],
            totalPrice: mockProductResponse.data.price * mockValidOrderRequest.items[0].quantity,
            status: "pending",
            deliveryAddress: mockValidOrderRequest.deliveryAddress,
            contactPhone: mockValidOrderRequest.contactPhone,
            note: mockValidOrderRequest.note,
            createdAt: mockCreatedOrder.createdAt,
          }
        });
      });
    });

    describe('Validation errors', () => {
      it('nên trả lỗi 401 khi không có user ID', async () => {
        // ARRANGE
        const req = mockRequest(mockValidOrderRequest);
        req.user = undefined; // No user authentication
        const res = mockResponse();

        // ACT
        await createOrder(req, res);

        // ASSERT
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          message: "Unauthorized: No user ID found"
        });
        expect(global.fetch).not.toHaveBeenCalled();
        expect(prisma.order.create).not.toHaveBeenCalled();
      });

      it('nên trả lỗi 400 khi items array rỗng', async () => {
        // ARRANGE
        const invalidRequest = { ...mockValidOrderRequest, items: [] };
        const req = mockRequest(invalidRequest);
        const res = mockResponse();

        // ACT
        await createOrder(req, res);

        // ASSERT
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          message: "Đơn hàng phải có ít nhất 1 sản phẩm"
        });
        expect(global.fetch).not.toHaveBeenCalled();
        expect(prisma.order.create).not.toHaveBeenCalled();
      });
    });

    describe('Product Service errors', () => {
      it('nên trả lỗi khi sản phẩm không tồn tại', async () => {
        // ARRANGE
        const req = mockRequest(mockValidOrderRequest);
        const res = mockResponse();

        // Mock Product Service trả 404
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: false,
          status: 404,
        });

        // ACT
        await createOrder(req, res);

        // ASSERT
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          message: `Sản phẩm ${mockValidOrderRequest.items[0].productId} không tồn tại`
        });
        expect(prisma.order.create).not.toHaveBeenCalled();
      });

      it('nên trả lỗi khi sản phẩm không còn kinh doanh', async () => {
        // ARRANGE
        const req = mockRequest(mockValidOrderRequest);
        const res = mockResponse();

        const unavailableProduct = {
          ...mockProductResponse,
          data: {
            ...mockProductResponse.data,
            isAvailable: false
          }
        };

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => unavailableProduct,
        });

        // ACT
        await createOrder(req, res);

        // ASSERT
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          message: `Sản phẩm ${mockProductResponse.data.name} không còn kinh doanh`
        });
        expect(prisma.order.create).not.toHaveBeenCalled();
      });

      it('nên trả lỗi khi không đủ hàng trong kho', async () => {
        // ARRANGE
        const req = mockRequest({
          ...mockValidOrderRequest,
          items: [{
            productId: mockValidOrderRequest.items[0].productId,
            quantity: 15 // Yêu cầu nhiều hơn stock (10)
          }]
        });
        const res = mockResponse();

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => mockProductResponse,
        });

        // ACT
        await createOrder(req, res);

        // ASSERT
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          message: `Sản phẩm ${mockProductResponse.data.name} không đủ hàng. Còn lại: ${mockProductResponse.data.stockOnHand}, yêu cầu: 15`
        });
        expect(prisma.order.create).not.toHaveBeenCalled();
      });
    });
  });

  describe('getOrderStatus', () => {
    it('nên lấy thông tin order thành công', async () => {
      // ARRANGE
      const req = mockRequest({}, { orderId: mockOrder.id });
      const res = mockResponse();

      (prisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);

      // ACT
      await getOrderStatus(req, res);

      // ASSERT
      expect(prisma.order.findUnique).toHaveBeenCalledWith({
        where: {
          id: mockOrder.id,
          userId: req.user.id,
        },
        include: {
          items: true
        }
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          orderId: mockOrder.id,
          status: mockOrder.status,
          totalPrice: mockOrder.totalPrice,
          deliveryAddress: mockOrder.deliveryAddress,
          contactPhone: mockOrder.contactPhone,
          note: mockOrder.note,
          items: mockOrder.items.map(item => ({
            productId: item.productId,
            productName: item.productName,
            productPrice: item.productPrice,
            quantity: item.quantity,
            subtotal: item.productPrice * item.quantity
          })),
          createdAt: mockOrder.createdAt,
          updatedAt: mockOrder.updatedAt
        },
        message: "Lấy trạng thái đơn hàng thành công",
      });
    });

    it('nên trả lỗi 404 khi không tìm thấy order', async () => {
      // ARRANGE
      const req = mockRequest({}, { orderId: 'non-existent-id' });
      const res = mockResponse();

      (prisma.order.findUnique as jest.Mock).mockResolvedValue(null);

      // ACT
      await getOrderStatus(req, res);

      // ASSERT
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Không tìm thấy đơn hàng"
      });
    });
  });
});
