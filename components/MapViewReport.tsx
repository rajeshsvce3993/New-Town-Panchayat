'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Globe, 
  Play, 
  Pause, 
  RotateCcw, 
  Zap, 
  MapPin, 
  Layers, 
  Eye, 
  Maximize2, 
  X, 
  ChevronRight, 
  ChevronLeft, 
  Calendar, 
  UserCheck, 
  Building, 
  FileText, 
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
  Sliders,
  Volume2,
  VolumeX,
  ExternalLink,
  Compass,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw
} from 'lucide-react';
import { Language, translations } from './translations';

export interface MapViewReportProps {
  works: any[];
  state: any;
  lang: Language;
  selectedZoneId: string;
  selectedDistrictId: string;
  selectedTpId: string;
  selectedWard: string;
  selectedStreetName: string;
  selectedSubjectId: string;
  selectedCategoryId: string;
  fromDate: string;
  toDate: string;
  searchQuery: string;
  googleMapsApiKey?: string;
  onOpenDetailsModal?: (work: any) => void;
}

// Default Fallback API Key provided by user
const DEFAULT_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';

// Play audio synthesizer click sound using native Web Audio API
function playSynthesizerClick(audioCtxRef: any, isMuted: boolean) {
  if (isMuted) return;
  try {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        audioCtxRef.current = new AudioCtx();
      }
    }
    if (audioCtxRef.current) {
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      const osc = audioCtxRef.current.createOscillator();
      const gain = audioCtxRef.current.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtxRef.current.currentTime);
      osc.frequency.exponentialRampToValueAtTime(220, audioCtxRef.current.currentTime + 0.05);
      
      gain.gain.setValueAtTime(0.15, audioCtxRef.current.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtxRef.current.currentTime + 0.05);
      
      osc.connect(gain);
      gain.connect(audioCtxRef.current.destination);
      
      osc.start();
      osc.stop(audioCtxRef.current.currentTime + 0.05);
    }
  } catch (_) {}
}

export default function MapViewReport({
  works,
  state,
  lang,
  selectedZoneId,
  selectedDistrictId,
  selectedTpId,
  selectedWard,
  selectedStreetName,
  selectedSubjectId,
  selectedCategoryId,
  fromDate,
  toDate,
  searchQuery,
  googleMapsApiKey,
  onOpenDetailsModal
}: MapViewReportProps) {
  const activeApiKey = googleMapsApiKey || state?.settings?.googleMapsApiKey || DEFAULT_MAPS_KEY;

  // Selected Map Model Mode: 'model1' | 'model2' | 'model3'
  const [activeModel, setActiveModel] = useState<'model1' | 'model2' | 'model3'>('model1');

  // Map Controls State
  const [mapType, setMapType] = useState<'roadmap' | 'satellite'>('roadmap');
  const [zoomLevel, setZoomLevel] = useState<number>(16);
  const [spiderfiedClusterId, setSpiderfiedClusterId] = useState<string | null>(null);

  // Selected work for rich small popup modal in Map
  const [selectedDotWork, setSelectedDotWork] = useState<any | null>(null);

  // Model 2: Route Replay State
  const [isPlayingRoute, setIsPlayingRoute] = useState<boolean>(false);
  const [currentRouteIndex, setCurrentRouteIndex] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);
  
  const audioCtxRef = useRef<AudioContext | null>(null);
  const replayIntervalRef = useRef<any>(null);

  // Google Maps DOM Container Ref & JS Objects Refs
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const googleMapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);
  const replayMarkerRef = useRef<any>(null);
  const infoWindowRef = useRef<any>(null);

  const [isMapsLoaded, setIsMapsLoaded] = useState<boolean>(false);
  const [mapsError, setMapsError] = useState<string | null>(null);

  // Extract geotagged works sorted chronologically for replay
  const geotaggedWorks = useMemo(() => {
    return works
      .filter((w) => {
        const lat = parseFloat(w.latitude);
        const lng = parseFloat(w.longitude);
        return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
      })
      .sort((a, b) => {
        const tA = new Date(a.submittedAt || a.createdAt || 0).getTime();
        const tB = new Date(b.submittedAt || b.createdAt || 0).getTime();
        return tA - tB;
      });
  }, [works]);

  // Center map calculation
  const mapCenter = useMemo(() => {
    if (geotaggedWorks.length === 0) {
      return { lat: 12.7244, lng: 80.1873 }; // Tamil Nadu Town Panchayat default
    }
    const sum = geotaggedWorks.reduce(
      (acc, w) => ({
        lat: acc.lat + parseFloat(w.latitude),
        lng: acc.lng + parseFloat(w.longitude)
      }),
      { lat: 0, lng: 0 }
    );
    return {
      lat: sum.lat / geotaggedWorks.length,
      lng: sum.lng / geotaggedWorks.length
    };
  }, [geotaggedWorks]);

  // Dynamically load Google Maps JS SDK with user's API Key
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if ((window as any).google && (window as any).google.maps) {
      setIsMapsLoaded(true);
      return;
    }

    const existingScript = document.getElementById('google-maps-js-sdk');
    if (existingScript) {
      existingScript.addEventListener('load', () => setIsMapsLoaded(true));
      existingScript.addEventListener('error', () => setMapsError('Failed to load Google Maps SDK'));
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-maps-js-sdk';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(activeApiKey)}&libraries=places,marker`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      setIsMapsLoaded(true);
    };
    script.onerror = () => {
      setMapsError('Could not load Google Maps JS SDK. Please verify API key.');
    };

    document.head.appendChild(script);
  }, [activeApiKey]);

  // Initialize Google Maps instance
  useEffect(() => {
    if (!isMapsLoaded || !mapContainerRef.current || googleMapRef.current) return;

    try {
      const g = (window as any).google;
      if (!g || !g.maps) return;

      const map = new g.maps.Map(mapContainerRef.current, {
        center: mapCenter,
        zoom: zoomLevel,
        mapTypeId: mapType,
        disableDefaultUI: false,
        zoomControl: true,
        streetViewControl: true,
        mapTypeControl: false,
        fullscreenControl: true,
        internalUsageAttributionIds: ['gmp_mcp_codeassist_v1_aistudio']
      });

      googleMapRef.current = map;
      infoWindowRef.current = new g.maps.InfoWindow();

      // Listen to map type / zoom changes
      map.addListener('zoom_changed', () => {
        setZoomLevel(map.getZoom());
      });
    } catch (err: any) {
      console.error('Error initializing Google Map:', err);
    }
  }, [isMapsLoaded, mapCenter]);

  // Update map type (roadmap vs satellite)
  useEffect(() => {
    if (googleMapRef.current && (window as any).google) {
      const g = (window as any).google;
      googleMapRef.current.setMapTypeId(
        mapType === 'satellite' ? g.maps.MapTypeId.SATELLITE : g.maps.MapTypeId.ROADMAP
      );
    }
  }, [mapType]);

  // Spatial clustering calculation for Model 1
  const spatialClusters = useMemo(() => {
    const clusters: {
      id: string;
      centerLat: number;
      centerLng: number;
      works: any[];
      statusCounts: { complete: number; actionRequired: number; pending: number };
    }[] = [];

    geotaggedWorks.forEach((work) => {
      const wLat = parseFloat(work.latitude);
      const wLng = parseFloat(work.longitude);

      let matchedCluster = clusters.find((c) => {
        const dLat = Math.abs(c.centerLat - wLat);
        const dLng = Math.abs(c.centerLng - wLng);
        return dLat < 0.0003 && dLng < 0.0003; // ~30 meters proximity
      });

      if (!matchedCluster) {
        matchedCluster = {
          id: `cluster_${clusters.length + 1}`,
          centerLat: wLat,
          centerLng: wLng,
          works: [],
          statusCounts: { complete: 0, actionRequired: 0, pending: 0 }
        };
        clusters.push(matchedCluster);
      }

      matchedCluster.works.push(work);
      const st = (work.status || '').toLowerCase();
      if (st.includes('complete') || st.includes('verified')) {
        matchedCluster.statusCounts.complete += 1;
      } else if (st.includes('action') || st.includes('require')) {
        matchedCluster.statusCounts.actionRequired += 1;
      } else {
        matchedCluster.statusCounts.pending += 1;
      }
    });

    return clusters;
  }, [geotaggedWorks]);

  // Clear existing markers and polylines from Google Map
  const clearMapOverlays = () => {
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }
    if (replayMarkerRef.current) {
      replayMarkerRef.current.setMap(null);
      replayMarkerRef.current = null;
    }
  };

  // Render Markers and Features on Google Map based on Active Model
  useEffect(() => {
    if (!googleMapRef.current || !(window as any).google) return;
    const g = (window as any).google;
    const map = googleMapRef.current;

    clearMapOverlays();

    if (geotaggedWorks.length === 0) return;

    // MODEL 1: Door-to-Door Clusters & Spiderfy
    if (activeModel === 'model1') {
      const bounds = new g.maps.LatLngBounds();

      spatialClusters.forEach((cluster) => {
        const position = { lat: cluster.centerLat, lng: cluster.centerLng };
        bounds.extend(position);

        const isSpiderfied = spiderfiedClusterId === cluster.id;

        if (!isSpiderfied) {
          // Render Cluster Badge Marker
          const count = cluster.works.length;
          let badgeColor = '#059669'; // Emerald
          if (cluster.statusCounts.actionRequired > 0 || cluster.statusCounts.pending > 0) {
            badgeColor = cluster.statusCounts.actionRequired > 0 ? '#d97706' : '#e11d48';
          }

          const marker = new g.maps.Marker({
            position,
            map,
            title: `${count} Inspection Works at Location`,
            icon: {
              path: g.maps.SymbolPath.CIRCLE,
              scale: Math.min(18 + count, 32),
              fillColor: badgeColor,
              fillOpacity: 0.9,
              strokeColor: '#ffffff',
              strokeWeight: 3
            },
            label: {
              text: String(count),
              color: '#ffffff',
              fontWeight: 'bold',
              fontSize: '12px'
            }
          });

          marker.addListener('click', () => {
            setSpiderfiedClusterId(cluster.id);
            map.panTo(position);
            map.setZoom(19);
          });

          markersRef.current.push(marker);
        } else {
          // Render Spiderfied fanned-out individual property markers along narrow lanes
          const total = cluster.works.length;
          const radius = 0.00015; // ~15 meters fan-out circle

          cluster.works.forEach((w, idx) => {
            const angle = (idx / total) * 2 * Math.PI;
            const fanLat = cluster.centerLat + radius * Math.cos(angle);
            const fanLng = cluster.centerLng + radius * Math.sin(angle);
            const fanPos = { lat: fanLat, lng: fanLng };

            // Draw line connecting center to fanned pin
            const line = new g.maps.Polyline({
              path: [position, fanPos],
              map,
              strokeColor: '#6366f1',
              strokeOpacity: 0.8,
              strokeWeight: 2,
              icons: [{
                icon: { path: g.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 2, color: '#6366f1' },
                offset: '100%'
              }]
            });

            let pinColor = '#10b981';
            const st = (w.status || '').toLowerCase();
            if (st.includes('action') || st.includes('require')) pinColor = '#f59e0b';
            else if (st.includes('pending')) pinColor = '#f43f5e';

            const pinMarker = new g.maps.Marker({
              position: fanPos,
              map,
              title: `Ward ${w.wardNumber} - ${w.streetName || 'Property'}`,
              icon: {
                path: g.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
                scale: 6,
                fillColor: pinColor,
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2
              }
            });

            pinMarker.addListener('click', () => {
              setSelectedDotWork(w);
              if (infoWindowRef.current) {
                infoWindowRef.current.setContent(`
                  <div style="font-family: system-ui, sans-serif; padding: 6px; color: #0f172a;">
                    <div style="font-weight: 800; font-size: 13px; color: #4f46e5;">Work #${w.workId || w.id}</div>
                    <div style="font-size: 11px; font-weight: 600; margin-top: 2px;">Ward ${w.wardNumber || '1'} • ${w.streetName || 'Street'}</div>
                    <div style="font-size: 10px; color: #64748b; margin-top: 2px;">Inspector: ${w.submittedByUserName || 'Cadre'}</div>
                    <div style="margin-top: 6px; font-size: 10px; font-weight: 700; color: ${pinColor}; uppercase">${w.status || 'Completed'}</div>
                  </div>
                `);
                infoWindowRef.current.open(map, pinMarker);
              }
            });

            markersRef.current.push(pinMarker);
          });
        }
      });

      if (spatialClusters.length > 0 && !spiderfiedClusterId) {
        map.fitBounds(bounds);
      }
    }

    // MODEL 2: Time-Machine Route Replay & Animated Polyline
    if (activeModel === 'model2') {
      const routePath = geotaggedWorks.map((w) => ({
        lat: parseFloat(w.latitude),
        lng: parseFloat(w.longitude)
      }));

      // Draw Animated Dashed Polyline
      polylineRef.current = new g.maps.Polyline({
        path: routePath,
        geodesic: true,
        strokeColor: '#6366f1',
        strokeOpacity: 0.9,
        strokeWeight: 4,
        map
      });

      // Place all waypoint pins
      geotaggedWorks.forEach((w, idx) => {
        const isCurrent = idx === currentRouteIndex;
        const pos = { lat: parseFloat(w.latitude), lng: parseFloat(w.longitude) };

        const wayMarker = new g.maps.Marker({
          position: pos,
          map,
          title: `Step ${idx + 1}: ${w.workId || w.id}`,
          icon: {
            path: g.maps.SymbolPath.CIRCLE,
            scale: isCurrent ? 10 : 5,
            fillColor: isCurrent ? '#10b981' : '#6366f1',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: isCurrent ? 3 : 1
          }
        });

        wayMarker.addListener('click', () => {
          setCurrentRouteIndex(idx);
          setSelectedDotWork(w);
        });

        markersRef.current.push(wayMarker);
      });

      // Active Radar Beacon Marker
      const activeWork = geotaggedWorks[currentRouteIndex];
      if (activeWork) {
        const activePos = { lat: parseFloat(activeWork.latitude), lng: parseFloat(activeWork.longitude) };

        replayMarkerRef.current = new g.maps.Marker({
          position: activePos,
          map,
          title: `Active Step ${currentRouteIndex + 1}`,
          icon: {
            path: g.maps.SymbolPath.CIRCLE,
            scale: 14,
            fillColor: '#ef4444',
            fillOpacity: 0.9,
            strokeColor: '#ffffff',
            strokeWeight: 3
          }
        });

        map.panTo(activePos);
      }
    }

    // MODEL 3: Small Blinking Dots for Reports
    if (activeModel === 'model3') {
      const bounds = new g.maps.LatLngBounds();

      geotaggedWorks.forEach((w) => {
        const pos = { lat: parseFloat(w.latitude), lng: parseFloat(w.longitude) };
        bounds.extend(pos);

        let dotColor = '#10b981';
        const st = (w.status || '').toLowerCase();
        if (st.includes('action') || st.includes('require')) dotColor = '#f59e0b';
        else if (st.includes('pending')) dotColor = '#f43f5e';

        const dotMarker = new g.maps.Marker({
          position: pos,
          map,
          title: `${w.workId || w.id} - Ward ${w.wardNumber}`,
          icon: {
            path: g.maps.SymbolPath.CIRCLE,
            scale: 7,
            fillColor: dotColor,
            fillOpacity: 0.9,
            strokeColor: '#ffffff',
            strokeWeight: 2
          }
        });

        dotMarker.addListener('click', () => {
          setSelectedDotWork(w);
          if (infoWindowRef.current) {
            infoWindowRef.current.setContent(`
              <div style="font-family: system-ui, sans-serif; padding: 6px; min-width: 180px; color: #0f172a;">
                <div style="font-weight: 800; font-size: 13px; color: #059669;">Work #${w.workId || w.id}</div>
                <div style="font-size: 11px; font-weight: 700; margin-top: 2px;">${w.subjectNameEn || ''} - ${w.categoryNameEn || ''}</div>
                <div style="font-size: 11px; color: #475569; margin-top: 2px;">Ward ${w.wardNumber} • ${w.streetName || '-'}</div>
                <div style="font-size: 10px; color: #64748b; margin-top: 2px;">Inspector: ${w.submittedByUserName || 'Cadre'}</div>
              </div>
            `);
            infoWindowRef.current.open(map, dotMarker);
          }
        });

        markersRef.current.push(dotMarker);
      });

      if (geotaggedWorks.length > 0) {
        map.fitBounds(bounds);
      }
    }
  }, [activeModel, geotaggedWorks, spatialClusters, spiderfiedClusterId, currentRouteIndex, isMapsLoaded]);

  // Handle Route Replay Timer
  useEffect(() => {
    if (isPlayingRoute && geotaggedWorks.length > 0) {
      const delay = Math.max(200, 1000 / playbackSpeed);
      replayIntervalRef.current = setInterval(() => {
        setCurrentRouteIndex((prev) => {
          if (prev >= geotaggedWorks.length - 1) {
            setIsPlayingRoute(false);
            return prev;
          }
          const nextIndex = prev + 1;
          playSynthesizerClick(audioCtxRef, isAudioMuted);
          return nextIndex;
        });
      }, delay);
    } else {
      if (replayIntervalRef.current) clearInterval(replayIntervalRef.current);
    }

    return () => {
      if (replayIntervalRef.current) clearInterval(replayIntervalRef.current);
    };
  }, [isPlayingRoute, geotaggedWorks, playbackSpeed, isAudioMuted]);

  // Current active work in Route Replay
  const currentReplayWork = geotaggedWorks[currentRouteIndex] || null;

  const handleFitBounds = () => {
    if (googleMapRef.current && (window as any).google && geotaggedWorks.length > 0) {
      const g = (window as any).google;
      const bounds = new g.maps.LatLngBounds();
      geotaggedWorks.forEach((w) => {
        bounds.extend({ lat: parseFloat(w.latitude), lng: parseFloat(w.longitude) });
      });
      googleMapRef.current.fitBounds(bounds);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl space-y-0 text-white">
      {/* MAP TOP BAR: MODEL SELECTOR & FILTERS HEADER */}
      <div className="p-4 bg-slate-900/95 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
        {/* Title and Geotagged Count */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm md:text-base text-white flex items-center gap-2">
              <span>{lang === 'ta' ? 'அசல் கூகிள் மேப் ஆய்வு அறிக்கை' : 'Real Google Maps Report & Spatial Analytics'}</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono font-bold border border-emerald-500/30">
                {geotaggedWorks.length} {lang === 'ta' ? 'இடங்கள்' : 'Geotagged Locations'}
              </span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {lang === 'ta'
                ? 'அடர்த்தி கொத்து, ஸ்பைடர்ஃபை விரிவு, நேர-மறுபதிவு பயணம் மற்றும் சிற்றலை புள்ளிகள்'
                : 'Dense Door-to-Door Clusters, Spiderfy Fan-out, Route Replay Scrubber & Interactive Report Dots'}
            </p>
          </div>
        </div>

        {/* THREE MODEL MODE SELECTOR BUTTONS */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 rounded-2xl border border-slate-800">
          {/* Model 1 */}
          <button
            onClick={() => {
              setActiveModel('model1');
              setIsPlayingRoute(false);
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeModel === 'model1'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{lang === 'ta' ? 'Model 1: அடர்த்தி & Spiderfy' : 'Model 1: Door Cluster & Spiderfy'}</span>
          </button>

          {/* Model 2 */}
          <button
            onClick={() => {
              setActiveModel('model2');
              setCurrentRouteIndex(0);
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeModel === 'model2'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{lang === 'ta' ? 'Model 2: நேர-பயணம் Replay' : 'Model 2: Route Replay'}</span>
          </button>

          {/* Model 3 */}
          <button
            onClick={() => {
              setActiveModel('model3');
              setIsPlayingRoute(false);
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeModel === 'model3'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span>{lang === 'ta' ? 'Model 3: ஒளிரும் புள்ளிகள்' : 'Model 3: Blinking Dots'}</span>
          </button>
        </div>

        {/* Map Type, Fit Bounds & External Link */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMapType((prev) => (prev === 'roadmap' ? 'satellite' : 'roadmap'))}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer border border-slate-700 flex items-center gap-1.5"
          >
            <Compass className="w-3.5 h-3.5 text-indigo-400" />
            <span>{mapType === 'roadmap' ? 'Satellite View' : 'Roadmap View'}</span>
          </button>

          <button
            onClick={handleFitBounds}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition cursor-pointer border border-slate-700"
            title="Recenter & Fit All Locations"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <a
            href={`https://www.google.com/maps/@${mapCenter.lat},${mapCenter.lng},17z`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition"
            title="Open in Google Maps Application"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* MODEL 2: ROUTE REPLAY TIMELINE SCRUBBER BAR */}
      {activeModel === 'model2' && (
        <div className="px-5 py-3 bg-indigo-950/60 border-b border-indigo-900/50 flex flex-wrap items-center justify-between gap-4">
          {/* Controls: Play/Pause, Reset, Speed, Audio Mute */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsPlayingRoute(!isPlayingRoute)}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs transition flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              {isPlayingRoute ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
              <span>{isPlayingRoute ? (lang === 'ta' ? 'நிறுத்து' : 'PAUSE') : (lang === 'ta' ? 'இயக்கு' : 'PLAY REPLAY')}</span>
            </button>

            <button
              onClick={() => {
                setIsPlayingRoute(false);
                setCurrentRouteIndex(0);
              }}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition cursor-pointer border border-slate-700"
              title="Reset Route"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Speed Toggles: 1x, 2x, 5x */}
            <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800 text-xs">
              {[1, 2, 5].map((spd) => (
                <button
                  key={spd}
                  onClick={() => setPlaybackSpeed(spd)}
                  className={`px-2.5 py-1 rounded-lg font-bold font-mono transition cursor-pointer ${
                    playbackSpeed === spd
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>

            {/* Audio Synth Click Sound Toggle */}
            <button
              onClick={() => setIsAudioMuted(!isAudioMuted)}
              className={`p-2 rounded-xl transition cursor-pointer border ${
                isAudioMuted
                  ? 'bg-rose-950/60 text-rose-400 border-rose-800'
                  : 'bg-emerald-950/60 text-emerald-400 border-emerald-800'
              }`}
              title={isAudioMuted ? 'Unmute Synthesizer Clicks' : 'Mute Synthesizer Clicks'}
            >
              {isAudioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>

          {/* Timeline Scrubber Slider */}
          <div className="flex-1 flex items-center gap-3 min-w-[240px]">
            <span className="text-xs font-mono font-bold text-indigo-400 whitespace-nowrap">
              Step {currentRouteIndex + 1} / {geotaggedWorks.length || 1}
            </span>
            <input
              type="range"
              min={0}
              max={Math.max(0, geotaggedWorks.length - 1)}
              value={currentRouteIndex}
              onChange={(e) => {
                setIsPlayingRoute(false);
                setCurrentRouteIndex(parseInt(e.target.value, 10));
              }}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          {/* Active Step Info Badge */}
          {currentReplayWork && (
            <div className="flex items-center gap-2 text-xs font-mono bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>{currentReplayWork.submittedAt ? new Date(currentReplayWork.submittedAt).toLocaleTimeString() : '-'}</span>
              <span className="text-slate-500">•</span>
              <span className="text-emerald-400 font-bold">{currentReplayWork.workId || currentReplayWork.id}</span>
            </div>
          )}
        </div>
      )}

      {/* MAIN MAP CANVAS AREA */}
      <div className="relative w-full h-[620px] bg-slate-950 overflow-hidden flex">
        {/* REAL GOOGLE MAPS JS SDK CONTAINER */}
        <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-0" />

        {/* Loading Indicator or API Error Message */}
        {!isMapsLoaded && !mapsError && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center gap-3 z-30">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-bold text-slate-300">
              {lang === 'ta' ? 'அசல் கூகிள் மேப் ஏற்றப்படுகிறது...' : 'Loading Real Interactive Google Map JS SDK...'}
            </p>
          </div>
        )}

        {mapsError && (
          <div className="absolute top-4 left-4 right-4 p-4 bg-rose-950/90 border border-rose-800 text-rose-200 text-xs rounded-2xl z-30">
            ❌ {mapsError}
          </div>
        )}

        {/* OVERLAY TELEMETRY CARD FOR MODEL 2 */}
        {activeModel === 'model2' && currentReplayWork && (
          <div className="absolute top-6 left-6 pointer-events-auto bg-slate-950/90 border border-indigo-500/60 rounded-3xl p-4 shadow-2xl backdrop-blur-md max-w-sm space-y-2 z-20">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span>Route Breadcrumb #{currentRouteIndex + 1}</span>
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-950 text-indigo-300 rounded-lg border border-indigo-800">
                {currentReplayWork.workId || currentReplayWork.id}
              </span>
            </div>

            <div className="text-xs space-y-1 pt-1">
              <div className="font-extrabold text-white text-sm">
                {lang === 'ta' ? currentReplayWork.subjectNameTa : currentReplayWork.subjectNameEn} - {lang === 'ta' ? currentReplayWork.categoryNameTa : currentReplayWork.categoryNameEn}
              </div>
              <div className="text-slate-300 text-[11px]">
                Ward {currentReplayWork.wardNumber} • {currentReplayWork.streetName}
              </div>
              <div className="text-slate-400 text-[11px] flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
                <span>{currentReplayWork.submittedByUserName || 'Inspector'}</span>
              </div>
            </div>
          </div>
        )}

        {/* RICH SMALL POPUP MODAL ON DOT / MARKER CLICK */}
        <AnimatePresence>
          {selectedDotWork && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="absolute bottom-6 right-6 pointer-events-auto bg-slate-950 border border-emerald-500/60 rounded-3xl p-5 shadow-2xl backdrop-blur-xl max-w-md w-full z-40 space-y-3"
            >
              {/* Popup Header */}
              <div className="flex items-start justify-between border-b border-slate-800 pb-3">
                <div>
                  <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-800">
                    {selectedDotWork.workId || selectedDotWork.id}
                  </span>
                  <h4 className="font-extrabold text-sm text-white mt-2">
                    {lang === 'ta' ? selectedDotWork.subjectNameTa : selectedDotWork.subjectNameEn} - {lang === 'ta' ? selectedDotWork.categoryNameTa : selectedDotWork.categoryNameEn}
                  </h4>
                </div>
                <button
                  onClick={() => setSelectedDotWork(null)}
                  className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body Details */}
              <div className="text-xs space-y-2 text-slate-300">
                <div className="flex items-center justify-between">
                  <span>{lang === 'ta' ? 'பேரூராட்சி' : 'Town Panchayat'}:</span>
                  <strong className="text-white">{selectedDotWork.tpNameEn || 'Town Panchayat'}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span>{lang === 'ta' ? 'வார்டு & தெரு' : 'Ward & Street'}:</span>
                  <strong className="text-white">Ward {selectedDotWork.wardNumber} ({selectedDotWork.streetName || '-'})</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span>{lang === 'ta' ? 'ஆய்வாளர்' : 'Inspector'}:</span>
                  <strong className="text-white">{selectedDotWork.submittedByUserName || 'Field Cadre'}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span>{lang === 'ta' ? 'ஜிபிஎஸ்' : 'GPS Coordinates'}:</span>
                  <strong className="text-emerald-400 font-mono">
                    {parseFloat(selectedDotWork.latitude).toFixed(5)}, {parseFloat(selectedDotWork.longitude).toFixed(5)}
                  </strong>
                </div>

                {/* Category Field Key-Values Preview */}
                {selectedDotWork.fieldsData && (
                  <div className="mt-3 p-3 bg-slate-900 rounded-2xl border border-slate-800 space-y-1.5 text-[11px]">
                    <span className="font-bold text-slate-400 uppercase text-[10px] block mb-1">
                      {lang === 'ta' ? 'வகைப் புலங்களின் விவரங்கள்' : 'Category Field Entries'}
                    </span>
                    {Object.entries(selectedDotWork.fieldsData).slice(0, 4).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between">
                        <span className="text-slate-400 truncate max-w-[150px]">{k}:</span>
                        <strong className="text-white truncate max-w-[150px]">{String(v)}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                {selectedDotWork.imageUrl && (
                  <a
                    href={selectedDotWork.imageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>{lang === 'ta' ? 'புகைப்படம் காண்க' : 'View S3 Photo'}</span>
                  </a>
                )}

                <button
                  onClick={() => {
                    if (onOpenDetailsModal) onOpenDetailsModal(selectedDotWork);
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition shadow-md cursor-pointer ml-auto"
                >
                  {lang === 'ta' ? 'முழு விவரங்கள்' : 'View Full Report'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
