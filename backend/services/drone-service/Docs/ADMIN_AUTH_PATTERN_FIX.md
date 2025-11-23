# ✅ ADMIN AUTH - ĐÃ SỬA THEO PATTERN CHUẨN CỦA PROJECT

## 🔧 Những gì đã sửa:

### **Pattern chuẩn của project (theo cnpm-fooddelivery & restaurant-merchant):**

```typescript
// ✅ ĐÚNG - Theo pattern của project
localStorage.setItem("system_admin_token", token);
localStorage.setItem("system_admin_user", JSON.stringify(user));

// Pattern naming convention:
// - customer_token, customer_user (cnpm-fooddelivery)
// - admin_token, admin_user (restaurant-merchant cho STORE_ADMIN)
// - system_admin_token, system_admin_user (admin-dashboard cho SYSTEM_ADMIN)
```

---

## 📁 Files đã sửa:

### **1. frontend/admin-dashboard/src/services/auth.service.ts**

**Trước (SAI):**
```typescript
localStorage.setItem("admin_token", token);  // ❌ Không follow pattern
localStorage.setItem("admin_user", user);
```

**Sau (ĐÚNG):**
```typescript
// Theo pattern của project
saveAuthData(token: string, user: User) {
  localStorage.setItem("system_admin_token", token);  // ✅ Đúng pattern
  localStorage.setItem("system_admin_user", JSON.stringify(user));
}

getToken(): string | null {
  return localStorage.getItem("system_admin_token");
}

getUser(): User | null {
  const userStr = localStorage.getItem("system_admin_user");
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

logout() {
  localStorage.removeItem("system_admin_token");
  localStorage.removeItem("system_admin_user");
}

// Helper function (giống cnpm-fooddelivery)
export const getAuthToken = (): string | null => {
  return localStorage.getItem("system_admin_token");
};
```

---

### **2. frontend/admin-dashboard/src/services/drone.service.ts**

**Trước (SAI):**
```typescript
private getAuthHeader() {
  const token = localStorage.getItem('token');  // ❌ Sai key
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}
```

**Sau (ĐÚNG):**
```typescript
private getAuthHeader() {
  const token = localStorage.getItem('system_admin_token');  // ✅ Đúng key
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}
```

---

## 🎯 Pattern của toàn bộ project:

### **cnpm-fooddelivery (Customer):**
```typescript
localStorage.setItem("customer_token", token);
localStorage.setItem("customer_user", JSON.stringify(user));
```

### **restaurant-merchant (Store Admin):**
```typescript
localStorage.setItem("admin_token", token);
localStorage.setItem("admin_user", JSON.stringify(user));
```

### **admin-dashboard (System Admin):**
```typescript
localStorage.setItem("system_admin_token", token);
localStorage.setItem("system_admin_user", JSON.stringify(user));
```

**👉 Mỗi app dùng prefix riêng để phân biệt role**

---

## ✅ Test lại:

### **1. Clear localStorage:**
```javascript
// Browser Console
localStorage.clear();
```

### **2. Login lại:**
```
http://localhost:8081/login
```

### **3. Check localStorage:**
```javascript
// Browser Console
console.log('Token:', localStorage.getItem('system_admin_token'));
console.log('User:', localStorage.getItem('system_admin_user'));

// ✅ Phải thấy data với key system_admin_*
```

### **4. Test drone API:**
```
Navigate to /drones
Check Network tab: Authorization header phải có Bearer token
```

---

## 📝 Lý do pattern này:

### **1. Consistency (Nhất quán):**
- Tất cả frontends đều dùng localStorage với pattern giống nhau
- Dễ maintain và debug

### **2. Multiple Role Support:**
- User có thể login nhiều role khác nhau (customer + admin)
- Mỗi role có token riêng, không conflict

### **3. Clear Separation:**
- `customer_*` - Customer của fooddelivery
- `admin_*` - Store Admin của restaurant
- `system_admin_*` - System Admin của dashboard

### **4. Simple & Straightforward:**
- Không cần complex logic
- Dễ implement và test

---

## ⚠️ Note về Security:

**localStorage vs httpOnly cookies:**

- ✅ Project hiện tại dùng **localStorage** cho tất cả frontends
- ❌ Không dùng httpOnly cookies (vì SPA architecture)
- ⚠️ Để improve security, cần:
  - Token expiration (JWT exp claim)
  - Refresh token mechanism
  - XSS protection (sanitize inputs)
  - HTTPS only trong production

**Nhưng hiện tại follow pattern của project là đúng!** ✅

---

## ✅ Checklist:

- [x] Sửa key localStorage: `system_admin_token`, `system_admin_user`
- [x] Update auth.service methods
- [x] Update drone.service getAuthHeader
- [x] Thêm helper function getAuthToken
- [x] Follow exact pattern của cnpm-fooddelivery
- [x] Maintain consistency với toàn bộ project

**✅ ĐÃ SỬA XONG - THEO ĐÚNG PATTERN CHUẨN CỦA PROJECT!**

