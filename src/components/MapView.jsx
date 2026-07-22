import React, { useEffect, useRef, useState } from 'react';
import BirdAvatar, { getBirdSvgString } from './BirdAvatars';

const MapView = ({ 
  center = [31.2560, 75.7051], 
  zoom = 14, 
  draggable = false, 
  onDragEnd = null, 
  jobLocation = null, // { lat, lng }
  taskerLocation = null, // { lat, lng }
  taskerBirdName = 'falcon',
  taskers = null, // Array of { id, bird, location: { lat, lng } }
  height = '300px',
  resolvedAddressText = 'Location pinned on map',
  showAddressBanner = false,
  coverageRadius = null // new prop for coverage circle
}) => {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const draggableMarkerRef = useRef(null);
  const taskersMarkersRef = useRef({}); // maps taskerId -> Leaflet marker
  const routeLinesRef = useRef({}); // maps taskerId -> Leaflet polyline
  const coverageCircleRef = useRef(null);
  const isDraggingRef = useRef(false);
  const lastDraggedPosRef = useRef(null);
  const prevZoomPropRef = useRef(zoom);

  useEffect(() => {
    if (!window.L || !mapContainerRef.current) return;

    const L = window.L;

    // Custom pins using SVG divIcons to avoid Leaflet default icon path bugs
    const orangeIcon = L.divIcon({
      className: 'leaflet-custom-pin-orange',
      html: `<div class="w-full h-full bg-primary text-white rounded-full shadow-lg flex items-center justify-center scale-100 hover:scale-105 transition-transform"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></div>`,
      iconSize: [38, 38],
      iconAnchor: [19, 19]
    });


    // Initialize Map Instance
    const initialCenter = jobLocation ? [jobLocation.lat, jobLocation.lng] : center;
    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: zoom,
      zoomControl: false,
      attributionControl: false
    });

    mapInstanceRef.current = map;

    // Load OpenStreetMap Tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(map);

    // Zoom buttons in top-right
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Flow 1: Draggable Mode (Job Posting)
    if (draggable) {
      const marker = L.marker(initialCenter, {
        draggable: true,
        icon: orangeIcon
      }).addTo(map);

      draggableMarkerRef.current = marker;

      marker.on('dragstart', () => {
        isDraggingRef.current = true;
      });

      // Handle drag ends
      marker.on('dragend', () => {
        isDraggingRef.current = false;
        const position = marker.getLatLng();
        lastDraggedPosRef.current = { lat: parseFloat(position.lat.toFixed(5)), lng: parseFloat(position.lng.toFixed(5)) };
        if (coverageCircleRef.current) {
          coverageCircleRef.current.setLatLng(position);
        }
        if (typeof onDragEnd === 'function') {
          onDragEnd({ lat: parseFloat(position.lat.toFixed(5)), lng: parseFloat(position.lng.toFixed(5)) });
        }
      });
    }

    if (coverageRadius && L) {
      coverageCircleRef.current = L.circle(initialCenter, {
        color: '#FF6B35',
        weight: 1.5,
        opacity: 0.6,
        fillColor: '#FF6B35',
        fillOpacity: 0.08,
        radius: coverageRadius
      }).addTo(map);
      
      // Auto-fit bounds to circle if not draggable, else just show it
      if (!draggable) {
        map.fitBounds(coverageCircleRef.current.getBounds());
      }
    }

    // Flow 2: Live Tracking Mode (Job Destination Pin)
    if (jobLocation && !draggable) {
      // Add Job Destination Marker
      L.marker([jobLocation.lat, jobLocation.lng], { icon: orangeIcon }).addTo(map);
    }

    // Handle container resize issues for modals (e.g. animation delays)
    const resizeTimer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 250);

    // Clean up Leaflet on unmount to prevent container errors
    return () => {
      clearTimeout(resizeTimer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Pan the map dynamically when center/zoom props update from external sources (e.g., search/GPS button)
  useEffect(() => {
    if (mapInstanceRef.current && center) {
      const [newLat, newLng] = center;
      
      const zoomPropChanged = prevZoomPropRef.current !== zoom;
      prevZoomPropRef.current = zoom;

      // If this center update was caused by dragging the pin manually, skip map setView/zoom change completely!
      if (lastDraggedPosRef.current) {
        const dLat = Math.abs(lastDraggedPosRef.current.lat - newLat);
        const dLng = Math.abs(lastDraggedPosRef.current.lng - newLng);
        if (dLat < 0.005 && dLng < 0.005) {
          lastDraggedPosRef.current = null;
          return;
        }
        lastDraggedPosRef.current = null;
      }

      const currentCenter = mapInstanceRef.current.getCenter();
      if (Math.abs(currentCenter.lat - newLat) > 0.0001 || Math.abs(currentCenter.lng - newLng) > 0.0001 || zoomPropChanged) {
        // Only change zoom if zoom prop explicitly changed from parent (e.g. search result clicked or GPS button).
        // Otherwise, ALWAYS keep the user's current manual map zoom!
        const targetZoom = zoomPropChanged ? zoom : mapInstanceRef.current.getZoom();
        mapInstanceRef.current.setView(center, targetZoom);
        if (draggableMarkerRef.current) {
          draggableMarkerRef.current.setLatLng(center);
        }
        if (coverageCircleRef.current) {
          coverageCircleRef.current.setLatLng(center);
        }
      }
    }
  }, [center, zoom]);

  // Update coverage radius dynamically if it changes
  useEffect(() => {
    if (mapInstanceRef.current && window.L && coverageRadius !== null) {
      if (coverageCircleRef.current) {
        coverageCircleRef.current.setRadius(coverageRadius);
      } else {
        const center = draggableMarkerRef.current ? draggableMarkerRef.current.getLatLng() : mapInstanceRef.current.getCenter();
        coverageCircleRef.current = window.L.circle(center, {
          color: '#FF6B35',
          weight: 1.5,
          opacity: 0.6,
          fillColor: '#FF6B35',
          fillOpacity: 0.08,
          radius: coverageRadius
        }).addTo(mapInstanceRef.current);
      }
      
      // Optionally fit bounds when radius changes during draggable mode
      if (coverageCircleRef.current) {
         mapInstanceRef.current.fitBounds(coverageCircleRef.current.getBounds(), { animate: true, padding: [20, 20] });
      }
    } else if (coverageCircleRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(coverageCircleRef.current);
      coverageCircleRef.current = null;
    }
  }, [coverageRadius]);

  // Update Taskers Markers and Route Polylines dynamically when position props update
  useEffect(() => {
    if (!draggable && mapInstanceRef.current && jobLocation) {
      const L = window.L;
      if (!L) return;

      // 1. Resolve taskers list (convert legacy single tasker to list if no array is provided)
      let activeTaskers = [];
      if (taskers && Array.isArray(taskers) && taskers.length > 0) {
        activeTaskers = taskers;
      } else if (taskerLocation) {
        activeTaskers = [{
          id: 'legacy-tasker',
          bird: taskerBirdName,
          location: taskerLocation
        }];
      }

      const activeTaskerIds = new Set(activeTaskers.map(t => t.id).filter(Boolean));

      // 2. Remove markers and polylines of taskers that are no longer active
      Object.keys(taskersMarkersRef.current).forEach(id => {
        if (!activeTaskerIds.has(id)) {
          if (taskersMarkersRef.current[id]) {
            mapInstanceRef.current.removeLayer(taskersMarkersRef.current[id]);
            delete taskersMarkersRef.current[id];
          }
          if (routeLinesRef.current[id]) {
            mapInstanceRef.current.removeLayer(routeLinesRef.current[id]);
            delete routeLinesRef.current[id];
          }
        }
      });

      // 3. Render or update markers & polylines for active taskers
      activeTaskers.forEach(tasker => {
        if (!tasker.location) return;

        const birdSvgString = getBirdSvgString(tasker.bird || 'falcon', 30);
        const taskerIcon = L.divIcon({
          className: 'leaflet-custom-pin-tasker',
          html: `<div class="bg-white text-dark p-0.5 rounded-full shadow-lg border-2 border-primary flex items-center justify-center animate-pulse">${birdSvgString}</div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 18]
        });

        const latLng = [tasker.location.lat, tasker.location.lng];

        // Update or Create Marker
        if (taskersMarkersRef.current[tasker.id]) {
          taskersMarkersRef.current[tasker.id].setLatLng(latLng);
          taskersMarkersRef.current[tasker.id].setIcon(taskerIcon);
        } else {
          taskersMarkersRef.current[tasker.id] = L.marker(latLng, { icon: taskerIcon }).addTo(mapInstanceRef.current);
        }

        // Update or Create Polyline
        const routeCoords = [latLng, [jobLocation.lat, jobLocation.lng]];
        if (routeLinesRef.current[tasker.id]) {
          routeLinesRef.current[tasker.id].setLatLngs(routeCoords);
        } else {
          routeLinesRef.current[tasker.id] = L.polyline(
            routeCoords,
            { color: '#2D2D2D', weight: 4, dashArray: '8, 8', opacity: 0.8 }
          ).addTo(mapInstanceRef.current);
        }
      });

      // 4. Adjust bounds to fit all markers
      if (activeTaskers.length > 0) {
        const boundsPoints = [[jobLocation.lat, jobLocation.lng]];
        activeTaskers.forEach(t => {
          if (t.location) {
            boundsPoints.push([t.location.lat, t.location.lng]);
          }
        });
        const bounds = L.latLngBounds(boundsPoints);
        mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40] });
      }
    }
  }, [taskers, taskerLocation, jobLocation, draggable, taskerBirdName]);

  return (
    <div className={`w-full flex flex-col space-y-2 select-none ${height === '100%' ? 'h-full flex-1' : ''}`}>
      <div 
        style={{ height: height === '100%' ? 'auto' : height, width: '100%' }} 
        className={`relative w-full ${height === '100%' ? 'flex-1 min-h-0' : ''}`}
      >
        <div 
          ref={mapContainerRef} 
          className="rounded-2xl overflow-hidden shadow-inner border border-border z-10 w-full h-full"
        />

      </div>
      {draggable && showAddressBanner && (
        <div className="bg-orange-50 border border-primary/10 rounded-xl px-3.5 py-2 flex items-center space-x-2.5">
          <div className="p-1 bg-white rounded-md border border-primary/5 text-primary shrink-0 animate-pulse">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
          </div>
          <div className="text-[10px] font-bold text-dark truncate">
            <span className="text-gray-400 block font-black uppercase text-[8px] leading-none mb-0.5">Resolved Address</span>
            {resolvedAddressText}
          </div>
        </div>
      )}
    </div>
  );
};

export default MapView;
