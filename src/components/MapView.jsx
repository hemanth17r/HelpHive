import React, { useEffect, useRef, useState } from 'react';
import { renderToString } from 'react-dom/server';
import BirdAvatar from './BirdAvatars';

const MapView = ({ 
  center = [31.2560, 75.7051], 
  zoom = 14, 
  draggable = false, 
  onDragEnd = null, 
  jobLocation = null, // { lat, lng }
  taskerLocation = null, // { lat, lng }
  taskerBirdName = 'falcon',
  height = '300px',
  resolvedAddressText = 'Location pinned on map',
  showAddressBanner = false,
  coverageRadius = null // new prop for coverage circle
}) => {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const draggableMarkerRef = useRef(null);
  const taskerMarkerRef = useRef(null);
  const routeLineRef = useRef(null);
  const coverageCircleRef = useRef(null);
  useEffect(() => {
    if (!window.L || !mapContainerRef.current) return;

    const L = window.L;

    // Custom pins using SVG divIcons to avoid Leaflet default icon path bugs
    const orangeIcon = L.divIcon({
      className: 'leaflet-custom-pin-orange',
      html: `<div class="bg-primary text-white p-2 rounded-full shadow-lg border-2 border-white flex items-center justify-center scale-100 hover:scale-105 transition-transform"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 36]
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

      // Handle drag ends
      marker.on('dragend', () => {
        const position = marker.getLatLng();
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
        color: '#ff8a00',
        fillColor: '#ff8a00',
        fillOpacity: 0.15,
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
    setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 250);

    // Clean up Leaflet on unmount to prevent container errors
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update coverage radius dynamically if it changes
  useEffect(() => {
    if (mapInstanceRef.current && window.L && coverageRadius !== null) {
      if (coverageCircleRef.current) {
        coverageCircleRef.current.setRadius(coverageRadius);
      } else {
        const center = draggableMarkerRef.current ? draggableMarkerRef.current.getLatLng() : mapInstanceRef.current.getCenter();
        coverageCircleRef.current = window.L.circle(center, {
          color: '#ff8a00',
          fillColor: '#ff8a00',
          fillOpacity: 0.15,
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

  // Update Tasker Marker and Route Polyline dynamically when position prop updates
  useEffect(() => {
    if (!draggable && mapInstanceRef.current && jobLocation && taskerLocation) {
      const L = window.L;
      if (!L) return;

      const birdSvgString = renderToString(<BirdAvatar birdName={taskerBirdName} size={30} />);
      const taskerIcon = L.divIcon({
        className: 'leaflet-custom-pin-tasker',
        html: `<div class="bg-white text-dark p-0.5 rounded-full shadow-lg border-2 border-primary flex items-center justify-center animate-pulse">${birdSvgString}</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });

      // Update or Create Marker
      if (taskerMarkerRef.current) {
        taskerMarkerRef.current.setLatLng([taskerLocation.lat, taskerLocation.lng]);
        taskerMarkerRef.current.setIcon(taskerIcon);
      } else {
        taskerMarkerRef.current = L.marker([taskerLocation.lat, taskerLocation.lng], { icon: taskerIcon }).addTo(mapInstanceRef.current);
      }

      // Update or Create Polyline
      if (routeLineRef.current) {
        routeLineRef.current.setLatLngs([
          [taskerLocation.lat, taskerLocation.lng], 
          [jobLocation.lat, jobLocation.lng]
        ]);
      } else {
        routeLineRef.current = L.polyline(
          [[taskerLocation.lat, taskerLocation.lng], [jobLocation.lat, jobLocation.lng]], 
          { color: '#2D2D2D', weight: 4, dashArray: '8, 8', opacity: 0.8 }
        ).addTo(mapInstanceRef.current);
        
        // Fit Bounds to fit both pins comfortably when first created
        const bounds = L.latLngBounds([[taskerLocation.lat, taskerLocation.lng], [jobLocation.lat, jobLocation.lng]]);
        mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40] });
      }
    }
  }, [taskerLocation, jobLocation, draggable, taskerBirdName]);

  return (
    <div className={`w-full flex flex-col space-y-2 select-none ${height === '100%' ? 'h-full flex-1' : ''}`}>
      <div 
        ref={mapContainerRef} 
        style={{ height: height === '100%' ? 'auto' : height, width: '100%' }} 
        className={`rounded-2xl overflow-hidden shadow-inner border border-border z-10 ${height === '100%' ? 'flex-1 min-h-0' : ''}`}
      />
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
