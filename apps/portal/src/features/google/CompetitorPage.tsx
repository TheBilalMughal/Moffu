import { useEffect, useState } from 'react';
import { useLocationStore } from '@/features/location/location.store';
import { googleService } from './google.service';
import type { Competitor } from './google.service';

const RADII = [5, 10, 20] as const;
type Radius = typeof RADII[number];

function StarRating({ rating }: { rating: number | null }) {
  if (rating == null) return <span className="text-xs text-[#D1D5DB]">No rating</span>;
  const full  = Math.floor(rating);
  const half  = rating - full >= 0.5;
  return (
    <div className="flex items-center gap-1">
      <div className="flex gap-0.5">
        {[1,2,3,4,5].map(i => (
          <svg key={i} className={`w-3 h-3 ${i <= full ? 'text-amber-400' : half && i === full + 1 ? 'text-amber-300' : 'text-[#E5E7EB]'}`} viewBox="0 0 20 20" fill="currentColor">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
          </svg>
        ))}
      </div>
      <span className="text-xs font-semibold text-[#374151]">{rating.toFixed(1)}</span>
    </div>
  );
}

function NoCoordinatesState() {
  return (
    <div className="flex flex-col items-center justify-center py-28 text-center px-6">
      <div className="w-12 h-12 rounded-2xl bg-[#F3F4F6] flex items-center justify-center mb-4">
        <svg className="w-5 h-5 text-[#9CA3AF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>
      </div>
      <p className="text-sm font-semibold text-[#111827] mb-1">Location coordinates not found</p>
      <p className="text-xs text-[#9CA3AF] max-w-xs">Go to Settings and run a sync to fetch your business coordinates from Google.</p>
    </div>
  );
}

function NoMapsKeyState() {
  return (
    <div className="flex flex-col items-center justify-center py-28 text-center px-6">
      <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center mb-4">
        <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
        </svg>
      </div>
      <p className="text-sm font-semibold text-[#111827] mb-1">Google Maps API key not configured</p>
      <p className="text-xs text-[#9CA3AF] max-w-xs">Ask your admin to add a Google Maps API key in Admin Settings to enable competitor analysis.</p>
    </div>
  );
}

export function CompetitorPage() {
  const { selectedId: globalLocationId } = useLocationStore();
  const [radius,      setRadius]      = useState<Radius>(5);
  const [competitors, setCompetitors] = useState<Competitor[] | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [errorCode,   setErrorCode]   = useState<'NO_COORDINATES' | 'NO_MAPS_KEY' | 'OTHER' | null>(null);
  const [errorMsg,    setErrorMsg]    = useState('');

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true); setErrorCode(null); setErrorMsg('');
      const { competitors: data, error } = await googleService.getCompetitors(globalLocationId ?? null, radius);
      if (!alive) return;
      if (error) {
        if (error === 'NO_COORDINATES') setErrorCode('NO_COORDINATES');
        else if (error === 'NO_MAPS_KEY') setErrorCode('NO_MAPS_KEY');
        else { setErrorCode('OTHER'); setErrorMsg(error); }
      } else {
        setCompetitors(data ?? []);
      }
      setLoading(false);
    }
    load();
    return () => { alive = false; };
  }, [globalLocationId, radius]);

  const youRow = competitors?.find(c => c.is_you);
  const yourPosition = youRow?.position ?? null;

  return (
    <div className="w-full px-6 py-6 space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-[#111827]">Competitors Nearby</h1>
          <p className="text-xs text-[#9CA3AF] mt-0.5">Businesses ranking around your location on Google Maps</p>
        </div>

        {/* Radius toggle */}
        <div className="flex items-center gap-1 p-1 bg-[#F3F4F6] rounded-xl self-start sm:self-auto">
          {RADII.map(r => (
            <button
              key={r}
              onClick={() => setRadius(r)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                radius === r
                  ? 'bg-white text-[#111827] shadow-sm'
                  : 'text-[#9CA3AF] hover:text-[#374151]'
              }`}
            >
              {r}km
            </button>
          ))}
        </div>
      </div>

      {/* ── Your position summary (if found) ── */}
      {!loading && !errorCode && yourPosition != null && (
        <div className="flex items-center gap-4 bg-[#F5F3FF] border border-[#DDD6FE] rounded-2xl px-5 py-4">
          <div className="w-10 h-10 rounded-xl bg-[#6C55E8] flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">#{yourPosition}</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-[#4C1D95]">Your business is at position {yourPosition}</p>
            <p className="text-xs text-[#7C3AED]">Out of {competitors?.length} businesses within {radius}km</p>
          </div>
        </div>
      )}

      {/* ── States ── */}
      {loading && (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-14 bg-[#F9FAFB] rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {!loading && errorCode === 'NO_COORDINATES' && <NoCoordinatesState />}
      {!loading && errorCode === 'NO_MAPS_KEY'    && <NoMapsKeyState />}
      {!loading && errorCode === 'OTHER'          && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{errorMsg}</div>
      )}

      {/* ── Competitors table ── */}
      {!loading && !errorCode && competitors && (
        competitors.length === 0
          ? (
            <div className="text-center py-16 text-sm text-[#9CA3AF]">No competitors found within {radius}km.</div>
          ) : (
            <div className="border border-[#E5E7EB] rounded-2xl overflow-hidden bg-white">
              {/* Table header */}
              <div className="grid grid-cols-[2.5rem_1fr_7rem_5rem_4.5rem] gap-3 px-4 py-2.5 bg-[#F9FAFB] border-b border-[#F3F4F6]">
                <span className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-widest">#</span>
                <span className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-widest">Business</span>
                <span className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-widest">Rating</span>
                <span className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-widest text-right">Reviews</span>
                <span className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-widest text-right">Distance</span>
              </div>

              {/* Rows */}
              <div className="divide-y divide-[#F3F4F6]">
                {competitors.map(c => (
                  <div
                    key={c.place_id}
                    className={`grid grid-cols-[2.5rem_1fr_7rem_5rem_4.5rem] gap-3 px-4 py-3.5 items-center ${
                      c.is_you ? 'bg-[#FAFAF9]' : ''
                    }`}
                  >
                    {/* Position */}
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      c.position === 1 ? 'bg-amber-50 text-amber-600' :
                      c.position === 2 ? 'bg-[#F3F4F6] text-[#374151]' :
                      c.position === 3 ? 'bg-orange-50 text-orange-500' :
                      'bg-[#F9FAFB] text-[#9CA3AF]'
                    }`}>
                      {c.position}
                    </div>

                    {/* Name + address */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-semibold truncate ${c.is_you ? 'text-[#6C55E8]' : 'text-[#111827]'}`}>
                          {c.name}
                        </span>
                        {c.is_you && (
                          <span className="text-[10px] font-semibold text-[#6C55E8] bg-[#F5F3FF] px-1.5 py-0.5 rounded-md flex-shrink-0">You</span>
                        )}
                      </div>
                      {c.address && (
                        <p className="text-[11px] text-[#9CA3AF] truncate mt-0.5">{c.address}</p>
                      )}
                    </div>

                    {/* Rating */}
                    <div><StarRating rating={c.rating} /></div>

                    {/* Reviews */}
                    <div className="text-xs font-medium text-[#374151] text-right">
                      {c.review_count > 0 ? c.review_count.toLocaleString() : '—'}
                    </div>

                    {/* Distance */}
                    <div className="text-xs font-medium text-[#374151] text-right">
                      {c.is_you ? '—' : `${c.distance_km}km`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
      )}
    </div>
  );
}
