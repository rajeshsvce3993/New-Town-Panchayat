'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchGeoMasters } from '@/lib/geoMastersClient';

export function useGeoCascade() {
  const [zones, setZones] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [townPanchayats, setTownPanchayats] = useState<any[]>([]);
  const [wardsAndStreets, setWardsAndStreets] = useState<any[]>([]);

  const [selectedZoneId, setSelectedZoneId] = useState('');
  const [selectedDistrictId, setSelectedDistrictId] = useState('');
  const [selectedTpId, setSelectedTpId] = useState('');

  const [wardPage, setWardPage] = useState(1);
  const [wardTotal, setWardTotal] = useState(0);
  const [wardHasMore, setWardHasMore] = useState(false);
  const [loading, setLoading] = useState({ zones: false, districts: false, tps: false, wards: false });

  const refreshZones = useCallback(async () => {
    setLoading((l) => ({ ...l, zones: true }));
    try {
      const res = await fetchGeoMasters({ level: 'zones' });
      if (res.success) setZones(res.items || []);
    } finally {
      setLoading((l) => ({ ...l, zones: false }));
    }
  }, []);

  const refreshDistricts = useCallback(
    async (zoneId: string) => {
      if (!zoneId) {
        setDistricts([]);
        return;
      }
      setLoading((l) => ({ ...l, districts: true }));
      try {
        const res = await fetchGeoMasters({ level: 'districts', zoneId });
        if (res.success) setDistricts(res.items || []);
      } finally {
        setLoading((l) => ({ ...l, districts: false }));
      }
    },
    [],
  );

  const refreshTownPanchayats = useCallback(async (districtId: string) => {
    if (!districtId) {
      setTownPanchayats([]);
      return;
    }
    setLoading((l) => ({ ...l, tps: true }));
    try {
      const res = await fetchGeoMasters({ level: 'townPanchayats', districtId });
      if (res.success) setTownPanchayats(res.items || []);
    } finally {
      setLoading((l) => ({ ...l, tps: false }));
    }
  }, []);

  const refreshWards = useCallback(async (tpId: string, page = 1, append = false) => {
    if (!tpId) {
      setWardsAndStreets([]);
      setWardTotal(0);
      setWardHasMore(false);
      return;
    }
    setLoading((l) => ({ ...l, wards: true }));
    try {
      const res = await fetchGeoMasters({ level: 'wards', tpId, page, limit: 150 });
      if (res.success) {
        const items = res.items || [];
        setWardsAndStreets((prev) => (append ? [...prev, ...items] : items));
        setWardPage(res.page || page);
        setWardTotal(res.total || items.length);
        setWardHasMore(!!res.hasMore);
      }
    } finally {
      setLoading((l) => ({ ...l, wards: false }));
    }
  }, []);

  useEffect(() => {
    void refreshZones();
    const onMasters = () => void refreshZones();
    window.addEventListener('portal:masters-updated', onMasters);
    return () => window.removeEventListener('portal:masters-updated', onMasters);
  }, [refreshZones]);

  useEffect(() => {
    if (!selectedZoneId) {
      setDistricts([]);
      return;
    }
    setSelectedDistrictId('');
    setSelectedTpId('');
    setWardsAndStreets([]);
    void refreshDistricts(selectedZoneId);
  }, [selectedZoneId, refreshDistricts]);

  useEffect(() => {
    if (!selectedDistrictId) {
      setTownPanchayats([]);
      return;
    }
    setSelectedTpId('');
    setWardsAndStreets([]);
    void refreshTownPanchayats(selectedDistrictId);
  }, [selectedDistrictId, refreshTownPanchayats]);

  useEffect(() => {
    if (!selectedTpId) {
      setWardsAndStreets([]);
      return;
    }
    void refreshWards(selectedTpId, 1, false);
  }, [selectedTpId, refreshWards]);

  const selectZone = (zoneId: string) => setSelectedZoneId(zoneId);
  const selectDistrict = (districtId: string) => setSelectedDistrictId(districtId);
  const selectTp = (tpId: string) => setSelectedTpId(tpId);

  const loadMoreWards = () => {
    if (selectedTpId && wardHasMore && !loading.wards) {
      void refreshWards(selectedTpId, wardPage + 1, true);
    }
  };

  const refreshAllVisible = useCallback(async () => {
    await refreshZones();
    if (selectedZoneId) await refreshDistricts(selectedZoneId);
    if (selectedDistrictId) await refreshTownPanchayats(selectedDistrictId);
    if (selectedTpId) await refreshWards(selectedTpId, 1, false);
  }, [refreshZones, refreshDistricts, refreshTownPanchayats, refreshWards, selectedZoneId, selectedDistrictId, selectedTpId]);

  return {
    zones,
    districts,
    townPanchayats,
    wardsAndStreets,
    selectedZoneId,
    selectedDistrictId,
    selectedTpId,
    selectZone,
    selectDistrict,
    selectTp,
    wardTotal,
    wardHasMore,
    loadMoreWards,
    loading,
    refreshAllVisible,
    refreshDistricts,
    refreshTownPanchayats,
    refreshWards,
    refreshZones,
  };
}