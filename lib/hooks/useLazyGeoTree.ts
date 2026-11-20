'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchGeoMasters } from '@/lib/geoMastersClient';

export type LazyGeoLoading = Record<string, boolean>;

/** Expand-on-click geo tree: zones → districts → town panchayats → wards (one API call per level). */
export function useLazyGeoTree() {
  const [zones, setZones] = useState<any[]>([]);
  const [districtsByZone, setDistrictsByZone] = useState<Record<string, any[]>>({});
  const [tpsByDistrict, setTpsByDistrict] = useState<Record<string, any[]>>({});
  const [wardsByTp, setWardsByTp] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState<LazyGeoLoading>({});

  const districtsLoaded = useRef<Set<string>>(new Set());
  const tpsLoaded = useRef<Set<string>>(new Set());
  const wardsLoaded = useRef<Set<string>>(new Set());
  const inflightDistricts = useRef<Map<string, Promise<any[]>>>(new Map());
  const inflightTps = useRef<Map<string, Promise<any[]>>>(new Map());
  const inflightWards = useRef<Map<string, Promise<any[]>>>(new Map());

  const setBusy = useCallback((key: string, busy: boolean) => {
    setLoading((prev) => {
      if (busy) return { ...prev, [key]: true };
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const loadZones = useCallback(async () => {
    setBusy('zones', true);
    try {
      const res = await fetchGeoMasters({ level: 'zones' });
      if (res.success) setZones(res.items || []);
    } finally {
      setBusy('zones', false);
    }
  }, [setBusy]);

  const ensureDistricts = useCallback(
    async (zoneId: string) => {
      const zid = String(zoneId || '').trim();
      if (!zid) return [];

      if (districtsLoaded.current.has(zid)) {
        const map = districtsByZone && typeof districtsByZone === 'object' ? districtsByZone : {};
        return map[zid] ?? [];
      }

      const pending = inflightDistricts.current.get(zid);
      if (pending) return pending;

      const key = `districts:${zid}`;
      setBusy(key, true);

      const work = (async () => {
        try {
          const res = await fetchGeoMasters({ level: 'districts', zoneId: zid });
          const items = res.success ? res.items || [] : [];
          if (res.success) {
            districtsLoaded.current.add(zid);
            setDistrictsByZone((prev) => ({ ...(prev || {}), [zid]: items }));
          }
          return items;
        } finally {
          setBusy(key, false);
          inflightDistricts.current.delete(zid);
        }
      })();

      inflightDistricts.current.set(zid, work);
      return work;
    },
    [districtsByZone, setBusy],
  );

  const ensureTownPanchayats = useCallback(
    async (districtId: string) => {
      const did = String(districtId || '').trim();
      if (!did) return [];

      if (tpsLoaded.current.has(did)) {
        const map = tpsByDistrict && typeof tpsByDistrict === 'object' ? tpsByDistrict : {};
        return map[did] ?? [];
      }

      const pending = inflightTps.current.get(did);
      if (pending) return pending;

      const key = `tps:${did}`;
      setBusy(key, true);

      const work = (async () => {
        try {
          const res = await fetchGeoMasters({ level: 'townPanchayats', districtId: did });
          const items = res.success ? res.items || [] : [];
          if (res.success) {
            tpsLoaded.current.add(did);
            setTpsByDistrict((prev) => ({ ...(prev || {}), [did]: items }));
          }
          return items;
        } finally {
          setBusy(key, false);
          inflightTps.current.delete(did);
        }
      })();

      inflightTps.current.set(did, work);
      return work;
    },
    [tpsByDistrict, setBusy],
  );

  const ensureWards = useCallback(
    async (tpId: string) => {
      const tid = String(tpId || '').trim();
      if (!tid) return [];

      if (wardsLoaded.current.has(tid)) {
        const map = wardsByTp && typeof wardsByTp === 'object' ? wardsByTp : {};
        return map[tid] ?? [];
      }

      const pending = inflightWards.current.get(tid);
      if (pending) return pending;

      const key = `wards:${tid}`;
      setBusy(key, true);

      const work = (async () => {
        try {
          const res = await fetchGeoMasters({ level: 'wards', tpId: tid, page: 1, limit: 500 });
          const items = res.success ? res.items || [] : [];
          if (res.success) {
            wardsLoaded.current.add(tid);
            setWardsByTp((prev) => ({ ...(prev || {}), [tid]: items }));
          }
          return items;
        } finally {
          setBusy(key, false);
          inflightWards.current.delete(tid);
        }
      })();

      inflightWards.current.set(tid, work);
      return work;
    },
    [wardsByTp, setBusy],
  );

  const clearBranchCache = useCallback(() => {
    districtsLoaded.current.clear();
    tpsLoaded.current.clear();
    wardsLoaded.current.clear();
    inflightDistricts.current.clear();
    inflightTps.current.clear();
    inflightWards.current.clear();
    setDistrictsByZone({});
    setTpsByDistrict({});
    setWardsByTp({});
  }, []);

  useEffect(() => {
    void loadZones();
    const onMasters = () => {
      void loadZones();
      clearBranchCache();
    };
    window.addEventListener('portal:masters-updated', onMasters);
    return () => window.removeEventListener('portal:masters-updated', onMasters);
  }, [loadZones, clearBranchCache]);

  const districtsForZone = useCallback(
    (zoneId: string) => {
      const map = districtsByZone && typeof districtsByZone === 'object' ? districtsByZone : {};
      return map[String(zoneId || '').trim()] || [];
    },
    [districtsByZone],
  );
  const tpsForDistrict = useCallback(
    (districtId: string) => {
      const map = tpsByDistrict && typeof tpsByDistrict === 'object' ? tpsByDistrict : {};
      return map[String(districtId || '').trim()] || [];
    },
    [tpsByDistrict],
  );
  const wardsForTp = useCallback(
    (tpId: string) => {
      const map = wardsByTp && typeof wardsByTp === 'object' ? wardsByTp : {};
      return map[String(tpId || '').trim()] || [];
    },
    [wardsByTp],
  );

  const isLoading = useCallback((key: string) => Boolean(loading?.[key]), [loading]);

  const allDistricts = useCallback(() => {
    const map = districtsByZone && typeof districtsByZone === 'object' ? districtsByZone : {};
    return Object.values(map).flat();
  }, [districtsByZone]);
  const allTownPanchayats = useCallback(() => {
    const map = tpsByDistrict && typeof tpsByDistrict === 'object' ? tpsByDistrict : {};
    return Object.values(map).flat();
  }, [tpsByDistrict]);

  return {
    zones,
    districtsByZone,
    tpsByDistrict,
    wardsByTp,
    loading,
    isLoading,
    loadZones,
    ensureDistricts,
    ensureTownPanchayats,
    ensureWards,
    districtsForZone,
    tpsForDistrict,
    wardsForTp,
    allDistricts,
    allTownPanchayats,
    clearBranchCache,
  };
}