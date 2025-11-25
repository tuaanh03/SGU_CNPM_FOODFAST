import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || "";

interface DroneTrackingMapProps {
  droneLocation: { lat: number; lng: number };
  restaurantLocation: { lat: number; lng: number; name: string };
  customerLocation: { lat: number; lng: number; address: string };
  homeBaseLocation: { lat: number; lng: number }; // Trạm kiểm soát drone (vị trí ban đầu)
  deliveryStatus: string;
}

// Helper: Fetch route from Mapbox Directions API
async function fetchRoute(start: [number, number], end: [number, number]) {
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${start[0]},${start[1]};${end[0]},${end[1]}?geometries=geojson&access_token=${mapboxgl.accessToken}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.routes && data.routes.length > 0) {
      return data.routes[0].geometry.coordinates;
    }
  } catch (error) {
    console.error('Error fetching route:', error);
  }

  // Fallback to straight line
  return [start, end];
}

const DroneTrackingMap = ({
  droneLocation,
  restaurantLocation,
  customerLocation,
  homeBaseLocation,
  deliveryStatus,
}: DroneTrackingMapProps) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const droneMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // LERP state
  const [currentDronePos, setCurrentDronePos] = useState(droneLocation);
  const [targetDronePos, setTargetDronePos] = useState(droneLocation);
  const animationFrameRef = useRef<number | null>(null);

  // Initialize position from props
  useEffect(() => {
    setCurrentDronePos(droneLocation);
    setTargetDronePos(droneLocation);
  }, []); // Run once on mount

  useEffect(() => {
    if (!mapContainerRef.current || !droneLocation) {
      setIsLoading(false);
      return;
    }

    // Initialize map
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [droneLocation.lng, droneLocation.lat],
      zoom: 13,
    });

    mapRef.current = map;

    map.on("load", () => {
      setIsLoading(false);

      // Add home base marker (trạm kiểm soát)
      const homeBaseEl = document.createElement("div");
      homeBaseEl.innerHTML = "🏠";
      homeBaseEl.style.fontSize = "32px";
      new mapboxgl.Marker(homeBaseEl)
        .setLngLat([homeBaseLocation.lng, homeBaseLocation.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(
            `<div class="p-2"><h3 class="font-bold">Trạm kiểm soát drone</h3></div>`
          )
        )
        .addTo(map);

      // Add restaurant marker
      const restaurantEl = document.createElement("div");
      restaurantEl.innerHTML = "🏪";
      restaurantEl.style.fontSize = "32px";
      new mapboxgl.Marker(restaurantEl)
        .setLngLat([restaurantLocation.lng, restaurantLocation.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(
            `<div class="p-2">
              <h3 class="font-bold">${restaurantLocation.name}</h3>
            </div>`
          )
        )
        .addTo(map);

      // Add customer marker
      const customerEl = document.createElement("div");
      customerEl.innerHTML = "📍";
      customerEl.style.fontSize = "32px";
      new mapboxgl.Marker(customerEl)
        .setLngLat([customerLocation.lng, customerLocation.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(
            `<div class="p-2">
              <h3 class="font-bold">Khách hàng</h3>
              <p class="text-sm">${customerLocation.address}</p>
            </div>`
          )
        )
        .addTo(map);

      // Add drone marker (animated)
      const droneEl = document.createElement("div");
      droneEl.innerHTML = "🚁";
      droneEl.style.fontSize = "32px";
      droneEl.style.transition = "transform 1s ease-in-out";

      droneMarkerRef.current = new mapboxgl.Marker(droneEl)
        .setLngLat([droneLocation.lng, droneLocation.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(
            `<div class="p-2">
              <h3 class="font-bold">Drone</h3>
              <p class="text-sm">Status: ${deliveryStatus}</p>
            </div>`
          )
        )
        .addTo(map);

      // Draw route based on status
      drawRoute(map, deliveryStatus);

      // Fit bounds to show all markers
      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend([homeBaseLocation.lng, homeBaseLocation.lat]);
      bounds.extend([restaurantLocation.lng, restaurantLocation.lat]);
      bounds.extend([customerLocation.lng, customerLocation.lat]);
      bounds.extend([droneLocation.lng, droneLocation.lat]);

      map.fitBounds(bounds, { padding: 80, maxZoom: 14 });
    });

    // Cleanup
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // LERP interpolation animation
  useEffect(() => {
    const animate = () => {
      setCurrentDronePos((current) => {
        const dx = targetDronePos.lng - current.lng;
        const dy = targetDronePos.lat - current.lat;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // If very close, snap to target
        if (distance < 0.00001) {
          return targetDronePos;
        }

        // Smooth interpolation (20% per frame ≈ 60fps)
        const speed = 0.2;
        return {
          lat: current.lat + dy * speed,
          lng: current.lng + dx * speed,
        };
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [targetDronePos]);

  // Update drone marker with smooth position
  useEffect(() => {
    if (droneMarkerRef.current) {
      droneMarkerRef.current.setLngLat([currentDronePos.lng, currentDronePos.lat]);
    }
  }, [currentDronePos]);

  // Update target position when new location received
  useEffect(() => {
    console.log(`🗺️ DroneTrackingMap: New target position [${droneLocation.lat}, ${droneLocation.lng}]`);
    setTargetDronePos(droneLocation);
  }, [droneLocation]);

  // Update route ONLY when status changes (not every position update)
  useEffect(() => {
    if (mapRef.current) {
      drawRoute(mapRef.current, deliveryStatus);
    }
  }, [deliveryStatus]); // Only depend on status, not droneLocation

  const drawRoute = async (map: mapboxgl.Map, status: string) => {
    // Remove old routes - Ensure complete cleanup
    try {
      if (map.getLayer('route')) {
        map.removeLayer('route');
      }
    } catch (e) {
      console.warn('Layer removal failed:', e);
    }

    try {
      if (map.getSource('route')) {
        map.removeSource('route');
      }
    } catch (e) {
      console.warn('Source removal failed:', e);
    }

    let routeCoordinates: [number, number][];

    // Define route based on delivery status - fetch real route from Mapbox
    switch (status) {
      case 'ASSIGNED':
      case 'PICKING_UP':
        // Home Base → Restaurant
        routeCoordinates = await fetchRoute(
          [homeBaseLocation.lng, homeBaseLocation.lat],
          [restaurantLocation.lng, restaurantLocation.lat]
        );
        break;
      case 'IN_TRANSIT':
        // Restaurant → Customer
        routeCoordinates = await fetchRoute(
          [restaurantLocation.lng, restaurantLocation.lat],
          [customerLocation.lng, customerLocation.lat]
        );
        break;
      case 'DELIVERED':
        // Customer → Home Base
        routeCoordinates = await fetchRoute(
          [customerLocation.lng, customerLocation.lat],
          [homeBaseLocation.lng, homeBaseLocation.lat]
        );
        break;
      default:
        routeCoordinates = [[droneLocation.lng, droneLocation.lat]];
    }

    // Add route line with fetched coordinates
    map.addSource('route', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: routeCoordinates,
        },
      },
    });

    map.addLayer({
      id: 'route',
      type: 'line',
      source: 'route',
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': '#3b82f6',
        'line-width': 4,
        'line-opacity': 0.8,
      },
    });
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Theo dõi lộ trình Drone Real-time</CardTitle>
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

export default DroneTrackingMap;

