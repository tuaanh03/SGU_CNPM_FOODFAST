#!/bin/bash

# Script để start ngrok cho VNPay IPN testing
# Sử dụng: ./start-ngrok.sh

echo "🚀 Starting ngrok tunnel for API Gateway (port 3000)..."
echo ""
echo "⚠️  Lưu ý:"
echo "   - Sau khi ngrok start, copy URL ngrok (ví dụ: https://abc123.ngrok.io)"
echo "   - Cập nhật vào file backend/services/payment-service/.env:"
echo "     VNPAY_RETURN_URL=https://abc123.ngrok.io/vnpay_return"
echo "     VNPAY_IPN_URL=https://abc123.ngrok.io/vnpay_ipn"
echo "   - Restart Payment Service để áp dụng thay đổi"
echo ""

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null
then
    echo "❌ ngrok chưa được cài đặt!"
    echo ""
    echo "Cài đặt ngrok:"
    echo "  brew install ngrok"
    echo ""
    echo "Hoặc tải từ: https://ngrok.com/download"
    exit 1
fi

# Check if ngrok is authenticated
if [ ! -f "$HOME/.ngrok2/ngrok.yml" ]; then
    echo "❌ ngrok chưa được xác thực!"
    echo ""
    echo "1. Đăng ký tài khoản miễn phí tại: https://dashboard.ngrok.com/signup"
    echo "2. Lấy authtoken tại: https://dashboard.ngrok.com/get-started/your-authtoken"
    echo "3. Chạy: ngrok config add-authtoken YOUR_AUTH_TOKEN"
    echo ""
    exit 1
fi

echo "✅ Starting ngrok..."
echo ""

# Start ngrok
ngrok http 3000

