# Frontend

Thư mục này sẽ chứa ứng dụng frontend cho hệ thống Payment Processing Microservices.

## Cấu trúc dự kiến

```
frontend/
├── public/
├── src/
│   ├── components/
│   ├── pages/
│   ├── services/
│   ├── utils/
│   └── App.jsx
├── package.json
└── README.md
```

## Công nghệ có thể sử dụng

- **React.js** hoặc **Next.js** cho framework frontend
- **Tailwind CSS** hoặc **Material-UI** cho styling
- **Axios** hoặc **Fetch API** để gọi API
- **React Router** cho routing

## Kết nối với Backend

Frontend sẽ kết nối với backend thông qua API Gateway tại:
- **URL**: `http://localhost:3000`
- **Services**:
  - User Service: Authentication, User Management
  - Product Service: Product Catalog
  - Order Service: Order Management
  - Payment Service: Payment Processing

## Ghi chú

Thư mục này hiện tại chỉ là placeholder. Sẽ được phát triển sau khi hoàn thiện backend.
