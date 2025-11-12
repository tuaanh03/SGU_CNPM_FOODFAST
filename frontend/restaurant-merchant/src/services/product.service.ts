import API_BASE_URL from "@/config/api";
import { authService } from "./auth.service";

export interface Product {
  id: string;
  sku: string;
  name: string;
  price: number;
  description?: string;
  imageUrl?: string;
  isAvailable: boolean;
  soldOutUntil?: string;
  unavailableReason?: string;
  categoryId?: string;
  category?: Category;
  storeId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    products: number;
  };
}

export interface CreateProductRequest {
  sku: string;
  name: string;
  price: number;
  description?: string;
  imageUrl?: string;
  categoryId?: string;
  isAvailable?: boolean;
  storeId: string;
}

export interface UpdateProductRequest {
  sku?: string;
  name?: string;
  price?: number;
  description?: string;
  imageUrl?: string;
  categoryId?: string;
  isAvailable?: boolean;
  soldOutUntil?: string;
  unavailableReason?: string;
}

export interface ProductsResponse {
  success: boolean;
  data: Product[];
}

export interface ProductResponse {
  success: boolean;
  data: Product;
  message?: string;
}

export interface CategoriesResponse {
  success: boolean;
  data: Category[];
}

export interface CategoryResponse {
  success: boolean;
  data: Category;
  message?: string;
}

class ProductService {
  private getAuthHeaders() {
    const token = authService.getToken("STORE_ADMIN");
    if (!token) {
      throw new Error("Vui lòng đăng nhập");
    }
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }

  // ============== PRODUCTS ==============

  // Lấy danh sách products (có thể filter theo storeId, categoryId)
  async getProducts(params?: { storeId?: string; categoryId?: string; isAvailable?: boolean }): Promise<ProductsResponse> {
    const queryParams = new URLSearchParams();
    if (params?.storeId) queryParams.append("storeId", params.storeId);
    if (params?.categoryId) queryParams.append("categoryId", params.categoryId);
    if (params?.isAvailable !== undefined) queryParams.append("isAvailable", String(params.isAvailable));

    const url = `${API_BASE_URL}/products${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Lỗi khi lấy danh sách món ăn" }));
      throw new Error(error.message || "Lỗi khi lấy danh sách món ăn");
    }

    return response.json();
  }

  // Lấy thông tin product theo ID
  async getProductById(id: string): Promise<ProductResponse> {
    const response = await fetch(`${API_BASE_URL}/products/${id}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Lỗi khi lấy thông tin món ăn" }));
      throw new Error(error.message || "Lỗi khi lấy thông tin món ăn");
    }

    return response.json();
  }

  // Tạo product mới
  async createProduct(data: CreateProductRequest): Promise<ProductResponse> {
    const response = await fetch(`${API_BASE_URL}/products`, {
      method: "POST",
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Lỗi khi tạo món ăn" }));
      throw new Error(error.message || "Lỗi khi tạo món ăn");
    }

    return response.json();
  }

  // Cập nhật product
  async updateProduct(id: string, data: UpdateProductRequest): Promise<ProductResponse> {
    const response = await fetch(`${API_BASE_URL}/products/${id}`, {
      method: "PUT",
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Lỗi khi cập nhật món ăn" }));
      throw new Error(error.message || "Lỗi khi cập nhật món ăn");
    }

    return response.json();
  }

  // Xóa product
  async deleteProduct(id: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE_URL}/products/${id}`, {
      method: "DELETE",
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Lỗi khi xóa món ăn" }));
      throw new Error(error.message || "Lỗi khi xóa món ăn");
    }

    return response.json();
  }

  // Cập nhật trạng thái availability (bật/tắt bán)
  async updateProductAvailability(
    id: string,
    data: { isAvailable: boolean; soldOutUntil?: string; unavailableReason?: string }
  ): Promise<ProductResponse> {
    const response = await fetch(`${API_BASE_URL}/products/${id}/availability`, {
      method: "PATCH",
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Lỗi khi cập nhật trạng thái món ăn" }));
      throw new Error(error.message || "Lỗi khi cập nhật trạng thái món ăn");
    }

    return response.json();
  }

  // ============== CATEGORIES ==============

  // Lấy tất cả categories
  async getCategories(): Promise<CategoriesResponse> {
    const response = await fetch(`${API_BASE_URL}/categories`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Lỗi khi lấy danh sách danh mục" }));
      throw new Error(error.message || "Lỗi khi lấy danh sách danh mục");
    }

    return response.json();
  }

  // Tạo category mới
  async createCategory(name: string): Promise<CategoryResponse> {
    const response = await fetch(`${API_BASE_URL}/categories`, {
      method: "POST",
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Lỗi khi tạo danh mục" }));
      throw new Error(error.message || "Lỗi khi tạo danh mục");
    }

    return response.json();
  }

  // Cập nhật category
  async updateCategory(id: string, name: string): Promise<CategoryResponse> {
    const response = await fetch(`${API_BASE_URL}/categories/${id}`, {
      method: "PUT",
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Lỗi khi cập nhật danh mục" }));
      throw new Error(error.message || "Lỗi khi cập nhật danh mục");
    }

    return response.json();
  }

  // Xóa category
  async deleteCategory(id: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE_URL}/categories/${id}`, {
      method: "DELETE",
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Lỗi khi xóa danh mục" }));
      throw new Error(error.message || "Lỗi khi xóa danh mục");
    }

    return response.json();
  }
}

export const productService = new ProductService();

