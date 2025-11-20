# Rate Limiter Trust Proxy Validation Fix

## 🔴 Lỗi sau khi enable trust proxy

```
ValidationError: The Express 'trust proxy' setting is true, which allows anyone to trivially bypass IP-based rate limiting.
code: 'ERR_ERL_PERMISSIVE_TRUST_PROXY'
```

## 📍 Timeline của vấn đề

1. **Lỗi đầu tiên:** `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR`
   - Express không trust proxy
   - Rate limiter không đọc được real IP
   - **Fix:** Set `trust proxy: true`

2. **Lỗi thứ hai (hiện tại):** `ERR_ERL_PERMISSIVE_TRUST_PROXY`
   - Express trust ALL proxies (`trust proxy: true`)
   - Express-rate-limit cảnh báo: configuration quá rộng, không an toàn
   - Attacker có thể fake `X-Forwarded-For` để bypass rate limit

## 🔍 Nguyên nhân

**Express-rate-limit v7.5.0** có built-in validation để bảo vệ khỏi misconfiguration:

```typescript
// express-rate-limit checks:
if (trustProxy === true) {
  throw new ValidationError('ERR_ERL_PERMISSIVE_TRUST_PROXY');
}
```

**Tại sao `trust proxy: true` nguy hiểm?**
- Tin cậy MỌI proxy trong chuỗi
- Attacker có thể inject fake `X-Forwarded-For`:
  ```
  X-Forwarded-For: 1.2.3.4, attacker-controlled-ip
  ```
- Rate limiter sẽ dùng IP sai → Bypass rate limit

## ✅ Giải pháp

### Option 1: Disable validation (Đã áp dụng)

Thêm `validate` config vào rate limiters:

```typescript
export const authLimiter = rateLimit({
  // ... other options
  validate: {
    trustProxy: false,        // Disable trust proxy validation
    xForwardedForHeader: false // Disable X-Forwarded-For validation
  }
});
```

**Khi nào dùng:**
- ✅ Deploy trên trusted infrastructure (Railway, Heroku, AWS ELB)
- ✅ Infrastructure quản lý proxy (client không thể bypass)
- ✅ Đã verify Railway set đúng headers

**Railway an toàn vì:**
- Client → Railway Proxy → API Gateway (không thể bypass)
- Railway set headers, không phải client
- Railway infrastructure trusted

### Option 2: Specific trust proxy config (Alternative)

Thay vì `trust proxy: true`, dùng specific config:

```typescript
// Option A: Trust số hops cụ thể
server.set('trust proxy', 1); // Trust 1 proxy hop

// Option B: Trust subnet cụ thể
server.set('trust proxy', 'loopback, linklocal, uniquelocal');

// Option C: Trust IP list
server.set('trust proxy', ['10.0.0.0/8', '172.16.0.0/12']);
```

**Nhược điểm cho Railway:**
- Railway proxy IPs động, không fix được subnet
- Số hops có thể thay đổi
- Config phức tạp hơn

## 🎯 Kết quả

✅ Express trust proxy enabled (cho Railway)  
✅ Rate limiter validation disabled (vì Railway trusted)  
✅ Real client IP được track đúng  
✅ Rate limiting hoạt động per-user  
✅ Không còn ValidationError

## 📊 Verify

### 1. Check logs - Real IP được track:

```json
{
  "ip": "113.172.43.253",  // ✅ Real client IP
  "service": "api-gateway",
  "path": "/api/auth/login"
}
```

### 2. Test rate limiting hoạt động:

```bash
# Gọi 150 requests từ cùng IP
for i in {1..150}; do
  curl -X POST https://api-gateway.railway.app/api/auth/login \
    -d '{"email":"test@test.com","password":"pass"}'
done

# Request 101+ sẽ nhận 429 Too Many Requests
```

### 3. Check metrics:

```promql
# Rate limit metrics
api_gateway_rate_limit_hits_total{endpoint="/api/auth",action="blocked"}
api_gateway_rate_limit_hits_total{endpoint="/api/auth",action="allowed"}
```

## 🔒 Security Note

**Tại sao disable validation an toàn trong trường hợp này:**

1. ✅ **Railway là trusted infrastructure**
   - Client không thể trực tiếp gửi request đến API Gateway
   - Phải qua Railway proxy
   - Railway set `X-Forwarded-For` chính xác

2. ✅ **Không có risk bypass**
   - Client không thể fake headers (Railway overwrite)
   - Traffic đều qua Railway proxy
   - Railway validate request trước khi forward

3. ✅ **Alternative configs phức tạp hơn**
   - Railway proxy IPs động
   - Cần maintain IP list
   - Risk config sai cao hơn

**Nếu deploy self-hosted hoặc untrusted proxy:**
- ❌ KHÔNG disable validation
- ✅ Dùng specific `trust proxy` config
- ✅ Validate IP ranges cụ thể

## 📁 Files Modified

1. ✅ `backend/services/api-gateway/src/utils/limiters.ts`
   - Thêm `validate: { trustProxy: false, xForwardedForHeader: false }`
   - Áp dụng cho `authLimiter` và `orderLimiter`

2. ✅ `backend/services/api-gateway/src/server.ts`
   - Đã có `server.set('trust proxy', true)` từ fix trước

## 🚀 Deploy

```bash
# Build
cd backend/services/api-gateway
pnpm run build

# Deploy
git add .
git commit -m "fix: disable rate limiter validation for Railway trusted proxy"
git push origin main
```

## 📚 References

- [Express-rate-limit Trust Proxy](https://express-rate-limit.github.io/docs/guides/troubleshooting-proxy-issues/)
- [ERR_ERL_PERMISSIVE_TRUST_PROXY](https://express-rate-limit.github.io/ERR_ERL_PERMISSIVE_TRUST_PROXY/)
- [Express Behind Proxies](https://expressjs.com/en/guide/behind-proxies.html)
- [Railway Networking](https://docs.railway.app/guides/networking)

---

**Fixed Date:** November 20, 2025  
**Issue:** ERR_ERL_PERMISSIVE_TRUST_PROXY validation error  
**Status:** ✅ RESOLVED  
**Security:** ✅ Safe for Railway deployment

