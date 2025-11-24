import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || "";

interface Drone {
  id: string;
  name: string;
  model: string;
  battery: number;
  maxPayload: number;
  currentLat: number;
  currentLng: number;
  distance: number;
  status: string;
}

interface OrderMapSectionProps {
  pickupLocation: {
    lat: number;
    lng: number;
    restaurantName: string;
    address: string;
  };
  deliveryDestination?: {
    lat: number;
    lng: number;
    address: string;
  };
  drones: Drone[];
}

const OrderMapSection = ({
  pickupLocation,
  deliveryDestination,
  drones,
}: OrderMapSectionProps) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!mapContainerRef.current || !pickupLocation?.lat || !pickupLocation?.lng) {
      setIsLoading(false);
      return;
    }

    // Initialize map
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [pickupLocation.lng, pickupLocation.lat],
      zoom: 12,
    });

    mapRef.current = map;

    map.on("load", () => {
      setIsLoading(false);

      // Add restaurant marker (pickup location)
      const restaurantEl = document.createElement("div");
      restaurantEl.className = "restaurant-marker";
      restaurantEl.style.backgroundImage =
        "url(https://docs.mapbox.com/mapbox-gl-js/assets/custom_marker.png)";
      restaurantEl.style.width = "32px";
      restaurantEl.style.height = "40px";
      restaurantEl.style.backgroundSize = "100%";

      const restaurantMarker = new mapboxgl.Marker(restaurantEl)
        .setLngLat([pickupLocation.lng, pickupLocation.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(
            `<div class="p-2">
              <h3 class="font-bold">${pickupLocation.restaurantName}</h3>
              <p class="text-sm text-gray-600">${pickupLocation.address}</p>
            </div>`
          )
        )
        .addTo(map);

      markersRef.current.push(restaurantMarker);

      // Add delivery destination marker (if available)
      if (deliveryDestination?.lat && deliveryDestination?.lng) {
        const customerEl = document.createElement("div");
        customerEl.className = "customer-marker";
        customerEl.style.backgroundColor = "#ef4444";
        customerEl.style.width = "24px";
        customerEl.style.height = "24px";
        customerEl.style.borderRadius = "50%";
        customerEl.style.border = "2px solid white";

        const customerMarker = new mapboxgl.Marker(customerEl)
          .setLngLat([deliveryDestination.lng, deliveryDestination.lat])
          .setPopup(
            new mapboxgl.Popup({ offset: 25 }).setHTML(
              `<div class="p-2">
                <h3 class="font-bold">Khách hàng</h3>
                <p class="text-sm text-gray-600">${deliveryDestination.address}</p>
              </div>`
            )
          )
          .addTo(map);

        markersRef.current.push(customerMarker);
      }

      // Add drone markers with circles
      drones.forEach((drone) => {
        // Drone marker
        const droneEl = document.createElement("div");
        droneEl.className = "drone-marker";
        droneEl.style.backgroundColor = "#3b82f6";
        droneEl.style.width = "20px";
        droneEl.style.height = "20px";
        droneEl.style.borderRadius = "50%";
        droneEl.style.border = "2px solid white";
        droneEl.style.boxShadow = "0 2px 4px rgba(0,0,0,0.3)";

        const droneMarker = new mapboxgl.Marker(droneEl)
          .setLngLat([drone.currentLng, drone.currentLat])
          .setPopup(
            new mapboxgl.Popup({ offset: 25 }).setHTML(
              `<div class="p-2">
                <h3 class="font-bold">${drone.name}</h3>
                <p class="text-sm text-gray-600">${drone.model}</p>
                <p class="text-sm">Pin: ${drone.battery}%</p>
                <p class="text-sm">Khoảng cách: ${drone.distance} km</p>
              </div>`
            )
          )
          .addTo(map);

        markersRef.current.push(droneMarker);

        // Add radius circle for each drone (if not exists)
        const sourceId = `drone-radius-${drone.id}`;
        if (!map.getSource(sourceId)) {
          map.addSource(sourceId, {
            type: "geojson",
            data: {
              type: "Feature",
              geometry: {
                type: "Point",
                coordinates: [drone.currentLng, drone.currentLat],
              },
              properties: {},
            },
          });

          map.addLayer({
            id: `${sourceId}-layer`,
            type: "circle",
            source: sourceId,
            paint: {
              "circle-radius": {
                stops: [
                  [0, 0],
                  [20, metersToPixelsAtMaxZoom(drone.distance * 1000, drone.currentLat)],
                ],
                base: 2,
              },
              "circle-color": "#3b82f6",
              "circle-opacity": 0.1,
              "circle-stroke-width": 2,
              "circle-stroke-color": "#3b82f6",
              "circle-stroke-opacity": 0.3,
            },
          });
        }
      });

      // Fit bounds to show all markers
      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend([pickupLocation.lng, pickupLocation.lat]);

      if (deliveryDestination?.lat && deliveryDestination?.lng) {
        bounds.extend([deliveryDestination.lng, deliveryDestination.lat]);
      }

      drones.forEach((drone) => {
        bounds.extend([drone.currentLng, drone.currentLat]);
      });

      map.fitBounds(bounds, { padding: 80, maxZoom: 14 });
    });

    // Cleanup
    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [pickupLocation, deliveryDestination, drones]);

  // Helper function to convert meters to pixels at max zoom
  const metersToPixelsAtMaxZoom = (meters: number, latitude: number) => {
    return meters / 0.075 / Math.cos((latitude * Math.PI) / 180);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Bản đồ vị trí</span>
          {drones.length > 0 && (
            <Badge variant="secondary">{drones.length} drone khả dụng</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!mapboxgl.accessToken && (
          <div className="text-center text-red-500 p-4">
            Chưa cấu hình VITE_MAPBOX_TOKEN
          </div>
        )}
        {isLoading && (
          <div className="flex items-center justify-center h-96">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        )}
        <div
          ref={mapContainerRef}
          className="w-full h-96 rounded-lg overflow-hidden"
          style={{ display: isLoading ? "none" : "block" }}
        />
      </CardContent>
    </Card>
  );
};

export default OrderMapSection;

