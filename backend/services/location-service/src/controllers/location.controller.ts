import { Request, Response } from "express";

// Mapbox API Token
const MAPBOX_TOKEN = process.env.MAPBOX_ACCESS_TOKEN || "pk.eyJ1IjoibmdvdHVhbmFuaCIsImEiOiJjbWdtaTQ3dXYwdGh2Mm9wcWwxd3g3dGV1In0.7_DXCJmqmBNQQuXSF5w3Ow";

/**
 * Tìm kiếm gợi ý địa chỉ sử dụng Mapbox Geocoding API
 */
export const searchAddressSuggestions = async (req: Request, res: Response) => {
  try {
    const { query } = req.query;

    if (!query || typeof query !== "string") {
      return res.status(400).json({
        success: false,
        message: "Query parameter is required",
      });
    }

    // Gọi Mapbox Geocoding API
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&country=VN&language=vi&limit=5`
    );

    if (!response.ok) {
      throw new Error("Failed to fetch from Mapbox API");
    }

    const data = await response.json() as any;

    // Format kết quả
    const suggestions = data.features?.map((feature: any) => ({
      id: feature.id,
      place_name: feature.place_name,
      text: feature.text,
      center: feature.center, // [longitude, latitude]
      place_type: feature.place_type,
      relevance: feature.relevance,
    })) || [];

    return res.status(200).json({
      success: true,
      data: suggestions,
    });
  } catch (error) {
    console.error("Error in searchAddressSuggestions:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to search address suggestions",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Geocode địa chỉ thành tọa độ
 */
export const geocodeAddressController = async (req: Request, res: Response) => {
  try {
    const { address } = req.body;

    if (!address || typeof address !== "string") {
      return res.status(400).json({
        success: false,
        message: "Address is required",
      });
    }

    // Gọi Mapbox Geocoding API
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${MAPBOX_TOKEN}&country=VN&language=vi&limit=1`
    );

    if (!response.ok) {
      throw new Error("Failed to fetch from Mapbox API");
    }

    const data = await response.json() as any;

    if (!data.features || data.features.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    const feature = data.features[0];

    return res.status(200).json({
      success: true,
      data: {
        address: feature.place_name,
        longitude: feature.center[0],
        latitude: feature.center[1],
        place_type: feature.place_type,
      },
    });
  } catch (error) {
    console.error("Error in geocodeAddressController:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to geocode address",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Lấy danh sách tỉnh/thành phố
 * Note: Mapbox không cung cấp API danh sách tỉnh/thành,
 * nên endpoint này trả về thông báo hoặc có thể tích hợp API khác
 */
export const getProvincesController = async (req: Request, res: Response) => {
  try {
    // Có thể tích hợp với API khác hoặc dùng dữ liệu tĩnh
    return res.status(200).json({
      success: true,
      message: "Use search endpoint for address suggestions",
      data: [],
    });
  } catch (error) {
    console.error("Error in getProvincesController:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get provinces",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Lấy danh sách quận/huyện theo tỉnh
 */
export const getDistrictsController = async (req: Request, res: Response) => {
  try {
    const { provinceCode } = req.params;

    return res.status(200).json({
      success: true,
      message: "Use search endpoint for address suggestions",
      data: [],
    });
  } catch (error) {
    console.error("Error in getDistrictsController:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get districts",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Lấy danh sách phường/xã theo quận/huyện
 */
export const getWardsController = async (req: Request, res: Response) => {
  try {
    const { districtCode } = req.params;

    return res.status(200).json({
      success: true,
      message: "Use search endpoint for address suggestions",
      data: [],
    });
  } catch (error) {
    console.error("Error in getWardsController:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get wards",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

