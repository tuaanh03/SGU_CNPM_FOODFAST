export const config = {
    port: process.env.PORT || 3000,
    userServiceUrl: process.env.USER_SERVICE_URL || "http://user-service:1000",
    orderServiceUrl: process.env.ORDER_SERVICE_URL || "http://order-service:2000",
    paymentServiceUrl: process.env.PAYMENT_SERVICE_URL || "http://payment-service:4000",
    productServiceUrl: process.env.PRODUCT_SERVICE_URL || "http://product-service:3004",
    restaurantServiceUrl: process.env.RESTAURANT_SERVICE_URL || "http://restaurant-service:3005",
    cartServiceUrl: process.env.CART_SERVICE_URL || "http://cart-service:3006",
    locationServiceUrl: process.env.LOCATION_SERVICE_URL || "http://location-service:3007",
};
