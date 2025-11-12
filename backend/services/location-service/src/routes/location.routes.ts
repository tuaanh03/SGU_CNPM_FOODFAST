import { Router } from "express";
import {
  searchAddressSuggestions,
  geocodeAddressController,
  getProvincesController,
  getDistrictsController,
  getWardsController
} from "../controllers/location.controller";

const router = Router();

// Tìm kiếm gợi ý địa chỉ
router.get("/search", searchAddressSuggestions);

// Geocode địa chỉ
router.post("/geocode", geocodeAddressController);

// Lấy danh sách tỉnh/thành phố
router.get("/provinces", getProvincesController);

// Lấy danh sách quận/huyện theo tỉnh
router.get("/districts/:provinceCode", getDistrictsController);

// Lấy danh sách phường/xã theo quận/huyện
router.get("/wards/:districtCode", getWardsController);

export default router;

