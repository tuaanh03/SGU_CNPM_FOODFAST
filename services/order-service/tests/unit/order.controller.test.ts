// Test thực tế cho Order Controller - BẠN SẼ VIẾT NỘI DUNG CHO FILE NÀY
import { createOrder, getOrderStatus, getPaymentUrl } from '../../src/controllers/order';
import { mockRequest, mockResponse, mockOrderItems, mockOrder, mockUser, mockProductResponse } from '../fixtures/mockData';
import { resetAllMocks, setupFetchMock } from '../mocks';
import prisma from '../../src/lib/prisma';
import { publishEvent } from '../../src/utils/kafka';

// Mock các module (setup đã làm rồi)
jest.mock('../../src/lib/prisma');
jest.mock('../../src/utils/kafka');

describe('Order Controller - LOGIC THỰC TẾ', () => {
  beforeEach(() => {
    resetAllMocks(); // Reset mock trước mỗi test
  });

  describe('createOrder', () => {
      it('SUCCESS: Tạo order thành công với 1 sản phẩm', async () => {
          // ARRANGE
          const oneProductItem = [
              {
                  productId: mockOrderItems[0].productId,
                  quantity: mockOrderItems[0].quantity, // ở mockData là 2
              },
          ];
          const req = mockRequest({ items: oneProductItem });
          const res = mockResponse();

          // Product service trả về sản phẩm hợp lệ
          setupFetchMock(true, mockProductResponse);

          // Tính expected theo qty thực tế
          const qty = oneProductItem[0].quantity;
          const price = mockProductResponse.data.price;
          const expectedSubtotal = price * qty;
          const expectedItems = [
              {
                  productId: mockProductResponse.data.id,
                  quantity: qty,
                  price,
                  name: mockProductResponse.data.name,
                  sku: mockProductResponse.data.sku,
                  subtotal: expectedSubtotal,
              },
          ];
          const expectedAmount = expectedSubtotal;

          // DB create order trả về bản ghi KHỚP amount & item
          (prisma.order.create as jest.Mock).mockResolvedValue({
              ...mockOrder,
              amount: expectedAmount,
              item: JSON.stringify(expectedItems),
          });

          // Kafka publish ok
          (publishEvent as jest.Mock).mockResolvedValue(true);

          // ACT
          await createOrder(req, res);

          // ASSERT: HTTP response
          expect(res.status).toHaveBeenCalledWith(201);
          expect(res.json).toHaveBeenCalledWith({
              success: true,
              message: 'Đơn hàng đã được tạo và đang chờ kiểm tra tồn kho',
              data: {
                  orderId: mockOrder.orderId,
                  items: expectedItems,
                  amount: expectedAmount,
                  status: mockOrder.status,
                  createdAt: mockOrder.created_at,
              },
          });

          // gọi Product Service để validate
          expect(global.fetch).toHaveBeenCalledWith(
              `http://api-gateway:3000/api/products/${oneProductItem[0].productId}`
          );

          // lưu order DB
          expect(prisma.order.create).toHaveBeenCalledWith({
              data: {
                  userId: mockUser.id,
                  amount: expectedAmount,
                  item: JSON.stringify(expectedItems),
                  status: 'pending',
              },
          });

          // publish event Kafka: chỉ 1 tham số là JSON string
          expect(publishEvent).toHaveBeenCalledTimes(1);
          const sentArg = (publishEvent as jest.Mock).mock.calls[0][0];
          expect(typeof sentArg).toBe('string');

          const parsedPayload = JSON.parse(sentArg);
          expect(parsedPayload).toEqual(
              expect.objectContaining({
                  orderId: mockOrder.orderId,
                  userId: mockUser.id,
                  items: oneProductItem, // thường publish input thô (productId, quantity)
                  amount: expectedAmount,
                  timestamp: expect.any(String),
              })
          );
      });


      it('SUCCESS: Tạo order thành công với nhiều sản phẩm', async () => {
          // ARRANGE
          const multiItems = [
              { productId: mockOrderItems[0].productId, quantity: mockOrderItems[0].quantity },
              { productId: mockOrderItems[1].productId, quantity: mockOrderItems[1].quantity },
          ];

          const req = mockRequest({ items: multiItems });
          const res = mockResponse();

          // Tạo 2 mock product response tương ứng 2 productId khác nhau
          const product1 = {
              data: {
                  id: mockOrderItems[0].productId,
                  name: 'iPhone 15',
                  sku: 'IP15-128-BLK',
                  price: 12000000,
                  isActive: true,
              },
          };
          const product2 = {
              data: {
                  id: mockOrderItems[1].productId,
                  name: 'AirPods Pro',
                  sku: 'APP-2NDGEN',
                  price: 5000000,
                  isActive: true,
              },
          };

          // Mock fetch theo thứ tự controller gọi cho từng sản phẩm
          // Nếu bạn đang dùng helper setupFetchMock(...) cho 1 lần gọi,
          // ở case nhiều sản phẩm nên mock thủ công theo "once" như dưới:
          (global.fetch as jest.Mock)
              .mockResolvedValueOnce({
                  ok: true,
                  json: async () => product1,
              } as any)
              .mockResolvedValueOnce({
                  ok: true,
                  json: async () => product2,
              } as any);

          // Tính item đã enrich + tổng tiền kỳ vọng
          const expectedItems = [
              {
                  productId: product1.data.id,
                  quantity: multiItems[0].quantity,
                  price: product1.data.price,
                  name: product1.data.name,
                  sku: product1.data.sku,
                  subtotal: product1.data.price * multiItems[0].quantity,
              },
              {
                  productId: product2.data.id,
                  quantity: multiItems[1].quantity,
                  price: product2.data.price,
                  name: product2.data.name,
                  sku: product2.data.sku,
                  subtotal: product2.data.price * multiItems[1].quantity,
              },
          ];
          const expectedAmount =
              expectedItems[0].subtotal + expectedItems[1].subtotal;

          // Mock DB create trả về order record tương ứng
          (prisma.order.create as jest.Mock).mockResolvedValue({
              ...mockOrder,
              amount: expectedAmount,
              item: JSON.stringify(expectedItems),
              // orderId/status/created_at giữ nguyên từ mockOrder
          });

          // Kafka publish ok
          (publishEvent as jest.Mock).mockResolvedValue(true);

          // ACT: gọi hàm muốn test
          await createOrder(req, res);

          // ASSERT: HTTP response
          expect(res.status).toHaveBeenCalledWith(201);
          expect(res.json).toHaveBeenCalledWith({
              success: true,
              message: 'Đơn hàng đã được tạo và đang chờ kiểm tra tồn kho',
              data: {
                  orderId: mockOrder.orderId,
                  items: expectedItems,
                  amount: expectedAmount,
                  status: mockOrder.status,
                  createdAt: mockOrder.created_at,
              },
          });

          // ASSERT: gọi Product Service đúng 2 lần, đúng productId
          expect(global.fetch).toHaveBeenNthCalledWith(
              1,
              `http://api-gateway:3000/api/products/${multiItems[0].productId}`
          );
          expect(global.fetch).toHaveBeenNthCalledWith(
              2,
              `http://api-gateway:3000/api/products/${multiItems[1].productId}`
          );

          // ASSERT: lưu DB đúng dữ liệu
          expect(prisma.order.create).toHaveBeenCalledWith({
              data: {
                  userId: mockUser.id,
                  amount: expectedAmount,
                  item: JSON.stringify(expectedItems),
                  status: 'pending',
              },
          });

          // ASSERT: publishEvent chỉ 1 tham số là JSON string; parse ra để assert nội dung
          expect(publishEvent).toHaveBeenCalledTimes(1);
          const sentArg = (publishEvent as jest.Mock).mock.calls[0][0];
          expect(typeof sentArg).toBe('string');

          const parsedPayload = JSON.parse(sentArg);
          expect(parsedPayload).toEqual(
              expect.objectContaining({
                  orderId: mockOrder.orderId,
                  userId: mockUser.id,
                  items: multiItems, // lưu ý: controller thường publish "items" ở dạng input (productId, quantity)
                  amount: expectedAmount,
                  timestamp: expect.any(String),
              })
          );
      });

      it('ERROR: Validation thất bại - items rỗng', async () => {
          // ARRANGE
            const req = mockRequest({ items: [] });
            const res = mockResponse();
            // ACT
            await createOrder(req, res); // Sửa thứ tự từ (res, req) thành (req, res)
            // ASSERT
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: 'Đơn hàng phải có ít nhất 1 sản phẩm',
            });
      });


      it('ERROR: Lỗi khi tạo đơn hàng', async () => {
          // ARRANGE
          const oneProductItem = [
              {
                  productId: mockOrderItems[0].productId,
                  quantity: mockOrderItems[0].quantity,
              },
          ];
          const req = mockRequest({ items: oneProductItem });
          const res = mockResponse();

          // Product service trả về sản phẩm hợp lệ
          setupFetchMock(true, mockProductResponse);

          // Database create lỗi
          (prisma.order.create as jest.Mock).mockRejectedValue(new Error('Database connection failed'));

          // ACT
          await createOrder(req, res);

          // ASSERT: Database error nằm trong inner try-catch nên trả về 400
          expect(res.status).toHaveBeenCalledWith(400);
          expect(res.json).toHaveBeenCalledWith({
              success: false,
              message: 'Database connection failed', // Lỗi database trả về message của error
          });
      });


      it('ERROR: Validation thất bại - quantity <= 0', async () => {
          // ARRANGE
          const invalidItems = [
              {
                  productId: mockOrderItems[0].productId,
                  quantity: 0, // Quantity không hợp lệ
              },
          ];
          const req = mockRequest({ items: invalidItems });
          const res = mockResponse();

          // ACT
          await createOrder(req, res);

          // ASSERT
          expect(res.status).toHaveBeenCalledWith(400);
          expect(res.json).toHaveBeenCalledWith({
              success: false,
              message: 'Số lượng phải >= 1',
          });
      });


      it('ERROR: Tạo order lỗi khi product service trả về 404 (sản phẩm không tồn tại)', async () => {
          // ARRANGE
          const oneProductItem = [
              {
                  productId: mockOrderItems[0].productId,
                  quantity: mockOrderItems[0].quantity,
              },
          ];
          const req = mockRequest({ items: oneProductItem });
          const res = mockResponse();

          // Product service trả về 404 (sản phẩm không tồn tại)
          setupFetchMock(false);

          // ACT
          await createOrder(req, res);

          // ASSERT
          expect(res.status).toHaveBeenCalledWith(400);
          expect(res.json).toHaveBeenCalledWith({
              success: false,
              message: `Sản phẩm ${oneProductItem[0].productId} không tồn tại`,
          });

          // Không được gọi đến database hoặc kafka
          expect(prisma.order.create).not.toHaveBeenCalled();
          expect(publishEvent).not.toHaveBeenCalled();
      });

      it('ERROR: Product không active', async () => {
          // ARRANGE
          const oneProductItem = [
              {
                  productId: mockOrderItems[0].productId,
                  quantity: mockOrderItems[0].quantity,
              },
          ];
          const req = mockRequest({ items: oneProductItem });
          const res = mockResponse();

          // Product service trả về sản phẩm không active
          const inactiveProduct = {
              data: {
                  ...mockProductResponse.data,
                  isActive: false,
              },
          };
          setupFetchMock(true, inactiveProduct);

          // ACT
          await createOrder(req, res);

          // ASSERT
          expect(res.status).toHaveBeenCalledWith(400);
          expect(res.json).toHaveBeenCalledWith({
              success: false,
              message: `Sản phẩm ${inactiveProduct.data.name} không còn kinh doanh`,
          });

          // Không được gọi đến database hoặc kafka
          expect(prisma.order.create).not.toHaveBeenCalled();
          expect(publishEvent).not.toHaveBeenCalled();
      });

      it('ERROR: Database lỗi khi create order', async () => {
          // ARRANGE
          const oneProductItem = [
              {
                  productId: mockOrderItems[0].productId,
                  quantity: mockOrderItems[0].quantity,
              },
          ];
          const req = mockRequest({ items: oneProductItem });
          const res = mockResponse();

          // Product service trả về sản phẩm hợp lệ
          setupFetchMock(true, mockProductResponse);

          // Database create lỗi
          (prisma.order.create as jest.Mock).mockRejectedValue(new Error('Database connection timeout'));

          // ACT
          await createOrder(req, res);

          // ASSERT: Database error nằm trong inner try-catch nên trả về 400
          expect(res.status).toHaveBeenCalledWith(400);
          expect(res.json).toHaveBeenCalledWith({
              success: false,
              message: 'Database connection timeout', // Lỗi database trả về message của error
          });

          // Kafka không được gọi do lỗi database
          expect(publishEvent).not.toHaveBeenCalled();
      });

      it('ERROR: Kafka publish thất bại', async () => {
          // ARRANGE
          const oneProductItem = [
              {
                  productId: mockOrderItems[0].productId,
                  quantity: mockOrderItems[0].quantity,
              },
          ];
          const req = mockRequest({ items: oneProductItem });
          const res = mockResponse();

          // Product service trả về sản phẩm hợp lệ
          setupFetchMock(true, mockProductResponse);

          // Database create thành công
          const qty = oneProductItem[0].quantity;
          const price = mockProductResponse.data.price;
          const expectedSubtotal = price * qty;
          const expectedItems = [
              {
                  productId: mockProductResponse.data.id,
                  quantity: qty,
                  price,
                  name: mockProductResponse.data.name,
                  sku: mockProductResponse.data.sku,
                  subtotal: expectedSubtotal,
              },
          ];
          const expectedAmount = expectedSubtotal;

          (prisma.order.create as jest.Mock).mockResolvedValue({
              ...mockOrder,
              amount: expectedAmount,
              item: JSON.stringify(expectedItems),
          });

          // Kafka publish lỗi
          (publishEvent as jest.Mock).mockRejectedValue(new Error('Kafka connection failed'));

          // ACT
          await createOrder(req, res);

          // ASSERT: Kafka error nằm trong inner try-catch nên trả về 400
          expect(res.status).toHaveBeenCalledWith(400);
          expect(res.json).toHaveBeenCalledWith({
              success: false,
              message: 'Kafka connection failed', // Lỗi kafka trả về message của error
          });

          // Order vẫn được tạo trước khi kafka failed
          expect(prisma.order.create).toHaveBeenCalledWith({
              data: {
                  userId: mockUser.id,
                  amount: expectedAmount,
                  item: JSON.stringify(expectedItems),
                  status: 'pending',
              },
          });

          // Kafka được gọi nhưng failed
          expect(publishEvent).toHaveBeenCalledTimes(1);
      });

      it('ERROR: Validation thất bại - productId không phải UUID', async () => {
          // ARRANGE
          const invalidItems = [
              {
                  productId: 'invalid-uuid', // ProductId không hợp lệ
                  quantity: 1,
              },
          ];
          const req = mockRequest({ items: invalidItems });
          const res = mockResponse();

          // ACT
          await createOrder(req, res);

          // ASSERT
          expect(res.status).toHaveBeenCalledWith(400);
          expect(res.json).toHaveBeenCalledWith({
              success: false,
              message: 'Product ID phải là UUID hợp lệ',
          });
      });

      it('ERROR: Validation thất bại - missing userId', async () => {
          // ARRANGE
          const oneProductItem = [
              {
                  productId: mockOrderItems[0].productId,
                  quantity: mockOrderItems[0].quantity,
              },
          ];
          // Request không có user (unauthorized)
          const req = mockRequest({ items: oneProductItem });
          req.user = undefined; // Remove user
          const res = mockResponse();

          // ACT
          await createOrder(req, res);

          // ASSERT
          expect(res.status).toHaveBeenCalledWith(401);
          expect(res.json).toHaveBeenCalledWith({
              message: 'Unauthorized: No user ID found',
          });
      });
  });
});
