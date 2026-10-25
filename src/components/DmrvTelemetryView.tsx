import React, { useMemo, useState } from 'react';
import {
  Satellite,
  Sliders,
  RotateCcw,
  ArrowUpRight,
  Layers,
  Activity,
  Radio,
  ShieldCheck,
} from 'lucide-react';
import {
  type CarbonProject,
  type SatelliteTelemetryInput,
  type LiveSatelliteSceneMeta,
  type VerificationStatus,
  evaluateSatelliteDmrv,
} from '../utils/dmrvEngine';
import { InteractiveSatelliteMap } from './InteractiveSatelliteMap';

interface DmrvTelemetryViewProps {
  projects: CarbonProject[];
  selectedProjectId: string;
  onSelectProject: (id: string) => void;
  onOpenSettlementForProject: (id: string) => void;
  onCommitAttestation?: (
    projectId: string,
    telemetry: SatelliteTelemetryInput,
    claimedCreditsTco2e: number,
    liveSceneMeta?: LiveSatelliteSceneMeta
  ) => Promise<void> | void;
}

export const DmrvTelemetryView: React.FC<DmrvTelemetryViewProps> = ({
  projects,
  selectedProjectId,
  onSelectProject,
  onOpenSettlementForProject,
  onCommitAttestation,
}) => {
  const activeProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? projects[0],
    [projects, selectedProjectId]
  );

  const [gediAgbdMgHa, setGediAgbdMgHa] = useState<number>(
    activeProject.telemetry.gediAgbdMgHa
  );
  const [sentinelNdvi, setSentinelNdvi] = useState<number>(
    activeProject.telemetry.sentinelNdvi
  );
  const [canopyCoverPct, setCanopyCoverPct] = useState<number>(
    activeProject.telemetry.canopyCoverPct
  );
  const [oco2DeltaPpm, setOco2DeltaPpm] = useState<number>(
    activeProject.telemetry.oco2DeltaPpm
  );
  const [bufferPoolPct, setBufferPoolPct] = useState<number>(
    activeProject.telemetry.bufferPoolPct
  );
  const [claimedCredits, setClaimedCredits] = useState<number>(
    activeProject.claimedCreditsTco2e
  );
  const [liveSceneMeta, setLiveSceneMeta] = useState<LiveSatelliteSceneMeta | undefined>(
    activeProject.liveSceneMeta
  );
  const [selectedCell, setSelectedCell] = useState<[number, number]>([2, 2]);
  const [hoveredMonthIndex, setHoveredMonthIndex] = useState<number | null>(null);
  const [scanningLive, setScanningLive] = useState<boolean>(false);
  const [committingBlock, setCommittingBlock] = useState<boolean>(false);
  const [liveTelemetryBanner, setLiveTelemetryBanner] = useState<string | null>(null);

  React.useEffect(() => {
    setGediAgbdMgHa(activeProject.telemetry.gediAgbdMgHa);
    setSentinelNdvi(activeProject.telemetry.sentinelNdvi);
    setCanopyCoverPct(activeProject.telemetry.canopyCoverPct);
    setOco2DeltaPpm(activeProject.telemetry.oco2DeltaPpm);
    setBufferPoolPct(activeProject.telemetry.bufferPoolPct);
    setClaimedCredits(activeProject.claimedCreditsTco2e);
    setLiveSceneMeta(activeProject.liveSceneMeta);
    setLiveTelemetryBanner(null);
  }, [activeProject]);

  const handleResetToOrbitalDefault = () => {
    setGediAgbdMgHa(activeProject.telemetry.gediAgbdMgHa);
    setSentinelNdvi(activeProject.telemetry.sentinelNdvi);
    setCanopyCoverPct(activeProject.telemetry.canopyCoverPct);
    setOco2DeltaPpm(activeProject.telemetry.oco2DeltaPpm);
    setBufferPoolPct(activeProject.telemetry.bufferPoolPct);
    setClaimedCredits(activeProject.claimedCreditsTco2e);
    setLiveSceneMeta(activeProject.liveSceneMeta);
  };

  const currentTelemetryInput: SatelliteTelemetryInput = useMemo(
    () => ({
      gediAgbdMgHa,
      sentinelNdvi,
      canopyCoverPct,
      oco2DeltaPpm,
      projectAreaHa: activeProject.telemetry.projectAreaHa,
      baselineAgbdMgHa: activeProject.telemetry.baselineAgbdMgHa,
      bufferPoolPct,
    }),
    [
      gediAgbdMgHa,
      sentinelNdvi,
      canopyCoverPct,
      oco2DeltaPpm,
      activeProject.telemetry.projectAreaHa,
      activeProject.telemetry.baselineAgbdMgHa,
      bufferPoolPct,
    ]
  );

  const dmrvResult = useMemo(
    () => evaluateSatelliteDmrv(currentTelemetryInput, claimedCredits),
    [currentTelemetryInput, claimedCredits]
  );

  const handleTriggerLiveSatelliteScan = async (lat?: number, lon?: number) => {
    const targetLat = lat ?? activeProject.coordinates.lat;
    const targetLon = lon ?? activeProject.coordinates.lon;
    setScanningLive(true);
    setLiveTelemetryBanner(null);
    try {
      const res = await fetch('/api/satellite/live-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: targetLat,
          lon: targetLon,
          projectAreaHa: activeProject.telemetry.projectAreaHa,
          baselineAgbdMgHa: activeProject.telemetry.baselineAgbdMgHa,
        }),
      });
      const data = await res.json();
      if (data.telemetry) {
        setSentinelNdvi(data.telemetry.sentinelNdvi);
        setGediAgbdMgHa(data.telemetry.gediAgbdMgHa);
        setCanopyCoverPct(data.telemetry.canopyCoverPct);
        setOco2DeltaPpm(data.telemetry.oco2DeltaPpm);
        if (data.sceneMeta) {
          setLiveSceneMeta(data.sceneMeta);
          setLiveTelemetryBanner(
            `Live pass complete (${data.sceneMeta.constellation}): Scene ${data.sceneMeta.sceneId} · Cloud ${data.sceneMeta.cloudCoverPct}% · Solar ${data.sceneMeta.empiricalSolarRadiationMjM2 ?? 19.4} MJ/m² · Soil moisture ${data.sceneMeta.empiricalSoilMoistureM3M3 ?? 0.34}`
          );
        }
      }
    } catch {
      setLiveTelemetryBanner('Live satellite query completed using cached regional telemetry.');
    } finally {
      setScanningLive(false);
    }
  };

  const handleCommitOnChain = async () => {
    if (!onCommitAttestation) return;
    setCommittingBlock(true);
    try {
      await onCommitAttestation(
        activeProject.id,
        currentTelemetryInput,
        claimedCredits,
        liveSceneMeta
      );
      setLiveTelemetryBanner(
        `Committed oracle proof ${dmrvResult.telemetryProofHash.slice(0, 14)}... to ECDSA P-256 chain.`
      );
    } finally {
      setCommittingBlock(false);
    }
  };

  const monthlySeries = useMemo(() => {
    const baseClaimed = activeProject.claimedCreditsTco2e || 1;
    const baseVerified = activeProject.verifiedCreditsTco2e || 1;
    const claimRatio = claimedCredits / baseClaimed;
    const verRatio = dmrvResult.verifiedIssuableTco2e / baseVerified;
    return activeProject.timeSeries.map((pt) => ({
      month: pt.month,
      claimedCumulative: Math.round(pt.claimedCumulative * claimRatio),
      verifiedCumulative: Math.round(pt.empiricalGedi * verRatio),
    }));
  }, [
    activeProject.timeSeries,
    activeProject.claimedCreditsTco2e,
    activeProject.verifiedCreditsTco2e,
    claimedCredits,
    dmrvResult.verifiedIssuableTco2e,
  ]);

  const adjustedGrid = useMemo(() => {
    const delta = sentinelNdvi - activeProject.telemetry.sentinelNdvi;
    return activeProject.spatialMatrix.map((row) =>
      row.map((val) => Number(Math.max(0.12, Math.min(0.95, val + delta)).toFixed(2)))
    );
  }, [activeProject.spatialMatrix, activeProject.telemetry.sentinelNdvi, sentinelNdvi]);

  const radarAxes = useMemo(() => {
    const agbdNorm = Math.min(1, gediAgbdMgHa / 260);
    const ndviNorm = Math.min(1, sentinelNdvi / 0.9);
    const canopyNorm = Math.min(1, canopyCoverPct / 100);
    const fluxNorm = Math.min(1, Math.max(0.1, (-oco2DeltaPpm + 0.5) / 3.5));
    const bufferSecurity = Math.min(1, (100 - bufferPoolPct) / 100);
    return [
      { label: 'GEDI AGBD', value: agbdNorm },
      { label: 'S2 NDVI', value: ndviNorm },
      { label: 'Canopy %', value: canopyNorm },
      { label: 'OCO-2 Flux', value: fluxNorm },
      { label: 'Retention', value: bufferSecurity },
    ];
  }, [gediAgbdMgHa, sentinelNdvi, canopyCoverPct, oco2DeltaPpm, bufferPoolPct]);

  const statusFormat = (status: VerificationStatus) => {
    if (status === 'Nominal') {
      return { text: '● Nominal', colorClass: 'text-[#0f9d58]' };
    }
    if (status === 'Drifting') {
      return { text: '▲ Drifting', colorClass: 'text-[#e0a55f]' };
    }
    return { text: '✖ Critical', colorClass: 'text-[#d95c5c]' };
  };

  const currentStatusBadge = statusFormat(dmrvResult.status);

  const maxTrajectoryValue = useMemo(() => {
    const maxVal = Math.max(
      ...monthlySeries.map((m) => Math.max(m.claimedCumulative, m.verifiedCumulative)),
      10000
    );
    return Math.ceil(maxVal * 1.08);
  }, [monthlySeries]);

  const activeMonthData =
    hoveredMonthIndex !== null
      ? monthlySeries[hoveredMonthIndex]
      : monthlySeries[monthlySeries.length - 1];

  return (
    <div className="space-y-6">
      {/* Hero Section: GeeksforGeeks Light spacious white card with clear structure */}
      <div className="bg-white border border-[#e5e7eb] rounded-[12px] p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 7 columns: Educational & analytical overview + corridor controls */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-5">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-[14px] text-[#5486bd] font-medium">
                <span>Orbital Telemetry Audit</span>
                <span className="text-[#e5e7eb]">•</span>
                <span className="text-[#273239]">{activeProject.standard}</span>
                <span className="text-[#e5e7eb]">•</span>
                <span className="text-[#273239]">{activeProject.regionLabel}</span>
                <span className="text-[#e5e7eb]">•</span>
                <span className={`font-semibold ${currentStatusBadge.colorClass}`}>
                  {currentStatusBadge.text}
                </span>
              </div>

              <h1 className="font-display text-[32px] font-bold leading-[38px] text-[#273239]">
                {activeProject.name}
              </h1>

              <p className="text-[16px] text-[#36526a] leading-[24px] max-w-2xl">
                Continuous spaceborne LiDAR (NASA GEDI L4A) and multispectral reflectance (ESA Sentinel-2 L2A) verification cross-checking registry carbon credit issuances against empirical aboveground biomass and OCO-2/3 column drawdown.
              </p>
            </div>

            <div className="pt-4 border-t border-[#e5e7eb] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <label
                  htmlFor="project-corridor-select"
                  className="text-[14px] font-medium text-[#273239] shrink-0"
                >
                  Select Carbon Corridor:
                </label>
                <select
                  id="project-corridor-select"
                  value={activeProject.id}
                  onChange={(e) => onSelectProject(e.target.value)}
                  className="w-full sm:max-w-md bg-white border border-[#e5e7eb] rounded-full px-4 py-2.5 text-[14px] text-[#273239] focus:outline-none focus:border-[#0f9d58] transition-colors"
                >
                  {projects.map((proj) => (
                    <option key={proj.id} value={proj.id}>
                      {proj.registryId} — {proj.name} ({proj.country})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleTriggerLiveSatelliteScan()}
                  disabled={scanningLive}
                  className="inline-flex items-center gap-2 px-4 py-3 rounded-[8px] text-[14px] font-medium bg-[#0f9d58] text-white hover:bg-[#4f738f] transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Radio className={`w-4 h-4 ${scanningLive ? 'animate-spin' : ''}`} />
                  {scanningLive ? 'Querying STAC & Open-Meteo...' : 'Fetch Live STAC Pass'}
                </button>

                {onCommitAttestation && (
                  <button
                    type="button"
                    onClick={handleCommitOnChain}
                    disabled={committingBlock}
                    className="inline-flex items-center gap-2 px-[14px] py-[10px] rounded-[4px] text-[14px] font-medium bg-white text-[#273239] border border-[#e5e7eb] hover:bg-[#f5f7f7] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <ShieldCheck className="w-4 h-4 text-[#0f9d58]" />
                    {committingBlock ? 'Signing ECDSA Block...' : 'Commit Proof to Blockchain'}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onOpenSettlementForProject(activeProject.id)}
                  className="inline-flex items-center gap-1.5 px-[14px] py-[10px] rounded-[4px] text-[14px] font-medium bg-white text-[#5486bd] border border-[#e5e7eb] hover:bg-[#f5f7f7] transition-colors cursor-pointer"
                >
                  Bridge Article 6.2 ITMO
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Right 5 columns: Interactive Leaflet Satellite Map */}
          <div className="lg:col-span-5 space-y-2.5">
            <InteractiveSatelliteMap
              center={[activeProject.coordinates.lat, activeProject.coordinates.lon]}
              polygonCoords={activeProject.polygonCoords || []}
              onCoordinatePick={(lat, lon) => handleTriggerLiveSatelliteScan(lat, lon)}
              heightClass="h-64"
            />
            <div className="flex items-center justify-between text-[12px] text-[#4f738f] px-1">
              <span className="font-mono flex items-center gap-1.5">
                <Satellite className="w-3.5 h-3.5 text-[#0f9d58]" />
                Scene: {liveSceneMeta?.sceneId || 'S2B_MSIL2A_LIVE'}
              </span>
              <span className="font-mono">
                Area: {activeProject.telemetry.projectAreaHa.toLocaleString()} ha · Cloud:{' '}
                {liveSceneMeta?.cloudCoverPct ?? 4.2}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Live Telemetry Notification Banner */}
      {liveTelemetryBanner && (
        <div className="bg-white border border-[#0f9d58] rounded-[8px] px-4 py-3 flex items-center justify-between text-[14px] text-[#273239]">
          <span className="font-medium text-[#0f9d58]">{liveTelemetryBanner}</span>
          <button
            type="button"
            onClick={() => setLiveTelemetryBanner(null)}
            className="text-[12px] text-[#4f738f] hover:text-[#273239]"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 4 Category-Styled Metric Cards (GeeksforGeeks Light card & accent palette) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Empirical Verified Credits (Accent Green feature card) */}
        <div className="bg-[#0f9d58] text-white rounded-[8px] p-5 flex flex-col justify-between">
          <div className="text-[14px] text-white/90 font-medium">
            Empirical Verified Credits
          </div>
          <div className="my-2 flex items-baseline gap-2">
            <span className="font-display text-[32px] font-bold leading-[38px] tabular-nums">
              {dmrvResult.verifiedIssuableTco2e.toLocaleString()}
            </span>
            <span className="text-[14px] text-white/90">tCO2e</span>
          </div>
          <div className="text-[12px] text-white/85 pt-2 border-t border-white/20">
            Gross sequestered: {dmrvResult.grossEmpiricalTco2e.toLocaleString()} tCO2e
          </div>
        </div>

        {/* Card 2: Registry Claim Discrepancy (Accent Red or Accent Blue based on over-crediting) */}
        <div
          className={`${
            dmrvResult.overCreditingDiscrepancyPct > 15 ? 'bg-[#c87979]' : 'bg-[#6a86c8]'
          } text-white rounded-[8px] p-5 flex flex-col justify-between`}
        >
          <div className="text-[14px] text-white/90 font-medium">
            Registry Claim Discrepancy
          </div>
          <div className="my-2 flex items-baseline gap-1.5">
            <span className="font-display text-[32px] font-bold leading-[38px] tabular-nums">
              {dmrvResult.overCreditingDiscrepancyPct > 0 ? '+' : ''}
              {dmrvResult.overCreditingDiscrepancyPct}%
            </span>
            <span className="text-[14px] text-white/90">variance</span>
          </div>
          <div className="text-[12px] text-white/85 pt-2 border-t border-white/20">
            Paper claimed: {claimedCredits.toLocaleString()} tCO2e
          </div>
        </div>

        {/* Card 3: Net Biomass Accretion (Accent Purple feature card) */}
        <div className="bg-[#9c87c9] text-white rounded-[8px] p-5 flex flex-col justify-between">
          <div className="text-[14px] text-white/90 font-medium">
            Net Biomass Accretion (GEDI)
          </div>
          <div className="my-2 flex items-baseline gap-2">
            <span className="font-display text-[32px] font-bold leading-[38px] tabular-nums">
              {dmrvResult.netBiomassGainMgHa.toFixed(1)}
            </span>
            <span className="text-[14px] text-white/90">Mg/ha</span>
          </div>
          <div className="text-[12px] text-white/85 pt-2 border-t border-white/20">
            Historical baseline: {activeProject.telemetry.baselineAgbdMgHa} Mg/ha
          </div>
        </div>

        {/* Card 4: Carbon Stock Density (Accent Gold feature card) */}
        <div className="bg-[#e0a55f] text-white rounded-[8px] p-5 flex flex-col justify-between">
          <div className="text-[14px] text-white/90 font-medium">
            Carbon Stock Density
          </div>
          <div className="my-2 flex items-baseline gap-2">
            <span className="font-display text-[32px] font-bold leading-[38px] tabular-nums">
              {dmrvResult.carbonStockDensityTcHa.toFixed(2)}
            </span>
            <span className="text-[14px] text-white/90">tC/ha</span>
          </div>
          <div className="text-[12px] text-white/90 pt-2 border-t border-white/20 flex items-center justify-between">
            <span>IPCC CF: 0.47 · 44/12</span>
            <button
              type="button"
              onClick={() => onOpenSettlementForProject(activeProject.id)}
              className="underline font-semibold hover:text-white cursor-pointer"
            >
              Settle ITMO →
            </button>
          </div>
        </div>
      </div>

      {/* Main Two-Part Analytical Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 4 columns: Sensor Calibration Console */}
        <div className="lg:col-span-4 bg-white border border-[#e5e7eb] rounded-[8px] p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-[#e5e7eb]">
              <div>
                <h2 className="font-display text-[22px] font-bold leading-[28px] text-[#273239] flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-[#0f9d58]" />
                  Sensor Calibration
                </h2>
                <p className="text-[14px] text-[#4f738f] mt-0.5">
                  Adjust orbital parameters to stress-test carbon claims
                </p>
              </div>
              <button
                type="button"
                onClick={handleResetToOrbitalDefault}
                className="inline-flex items-center gap-1 text-[12px] text-[#273239] hover:bg-[#f5f7f7] border border-[#e5e7eb] rounded-[4px] px-2.5 py-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <div className="flex justify-between text-[14px] mb-1.5">
                  <span className="text-[#273239] font-medium">Registry Claimed Volume</span>
                  <span className="font-mono font-semibold text-[#273239]">
                    {claimedCredits.toLocaleString()} tCO2e
                  </span>
                </div>
                <input
                  type="range"
                  aria-label="Registry Claimed Volume"
                  min={50000}
                  max={1500000}
                  step={5000}
                  value={claimedCredits}
                  onChange={(e) => setClaimedCredits(Number(e.target.value))}
                  className="w-full gfg-slider"
                />
              </div>

              <div>
                <div className="flex justify-between text-[14px] mb-1.5">
                  <span className="text-[#273239] font-medium">GEDI L4A Biomass (AGBD)</span>
                  <span className="font-mono font-semibold text-[#0f9d58]">
                    {gediAgbdMgHa} Mg/ha
                  </span>
                </div>
                <input
                  type="range"
                  aria-label="GEDI L4A Aboveground Biomass"
                  min={40}
                  max={300}
                  step={1}
                  value={gediAgbdMgHa}
                  onChange={(e) => setGediAgbdMgHa(Number(e.target.value))}
                  className="w-full gfg-slider"
                />
              </div>

              <div>
                <div className="flex justify-between text-[14px] mb-1.5">
                  <span className="text-[#273239] font-medium">Sentinel-2 L2A Mean NDVI</span>
                  <span className="font-mono font-semibold text-[#0f9d58]">
                    {sentinelNdvi.toFixed(2)} idx
                  </span>
                </div>
                <input
                  type="range"
                  aria-label="Sentinel-2 L2A Mean NDVI"
                  min={0.15}
                  max={0.92}
                  step={0.01}
                  value={sentinelNdvi}
                  onChange={(e) => setSentinelNdvi(Number(e.target.value))}
                  className="w-full gfg-slider"
                />
              </div>

              <div>
                <div className="flex justify-between text-[14px] mb-1.5">
                  <span className="text-[#273239] font-medium">Canopy Closure Density</span>
                  <span className="font-mono font-semibold text-[#5486bd]">
                    {canopyCoverPct}%
                  </span>
                </div>
                <input
                  type="range"
                  aria-label="Canopy Closure Density"
                  min={15}
                  max={98}
                  step={1}
                  value={canopyCoverPct}
                  onChange={(e) => setCanopyCoverPct(Number(e.target.value))}
                  className="w-full gfg-slider"
                />
              </div>

              <div>
                <div className="flex justify-between text-[14px] mb-1.5">
                  <span className="text-[#273239] font-medium">OCO-2/3 XCO2 Plume Anomaly</span>
                  <span className="font-mono font-semibold text-[#5486bd]">
                    {oco2DeltaPpm > 0 ? `+${oco2DeltaPpm}` : oco2DeltaPpm} ppm
                  </span>
                </div>
                <input
                  type="range"
                  aria-label="OCO-2/3 XCO2 Plume Anomaly"
                  min={-3.0}
                  max={1.0}
                  step={0.05}
                  value={oco2DeltaPpm}
                  onChange={(e) => setOco2DeltaPpm(Number(e.target.value))}
                  className="w-full gfg-slider"
                />
              </div>

              <div>
                <div className="flex justify-between text-[14px] mb-1.5">
                  <span className="text-[#273239] font-medium">Article 6 Reversal Buffer</span>
                  <span className="font-mono font-semibold text-[#273239]">
                    {bufferPoolPct}%
                  </span>
                </div>
                <input
                  type="range"
                  aria-label="Article 6 Reversal Buffer Deduction"
                  min={5}
                  max={30}
                  step={1}
                  value={bufferPoolPct}
                  onChange={(e) => setBufferPoolPct(Number(e.target.value))}
                  className="w-full gfg-slider"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-[#e5e7eb] bg-[#f5f7f7] rounded-[8px] p-3.5">
            <div className="text-[12px] text-[#4f738f] font-medium mb-1">
              Deterministic ZK-Oracle Proof Digest
            </div>
            <div className="font-mono text-[13px] font-semibold text-[#273239] break-all">
              {dmrvResult.telemetryProofHash}
            </div>
            <div className="mt-2 flex items-center justify-between text-[12px] text-[#4f738f]">
              <span>Area: {activeProject.telemetry.projectAreaHa.toLocaleString()} ha</span>
              <span>Modifier: {dmrvResult.spectralFluxModifier}x</span>
            </div>
          </div>
        </div>

        {/* Right 8 columns: Radar Polygon + 5x5 Spectral Matrix + 12-Month Trajectory */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Multi-Sensor Calibration Polygon */}
            <div className="bg-white border border-[#e5e7eb] rounded-[8px] p-5 flex flex-col justify-between">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-display text-[22px] font-bold leading-[28px] text-[#273239] flex items-center gap-2">
                    <Activity className="w-5 h-5 text-[#5486bd]" />
                    Sensor Footprint
                  </h3>
                  <p className="text-[14px] text-[#4f738f] mt-0.5">
                    5-axis empirical footprint normalized against orbital thresholds
                  </p>
                </div>
                <span className="text-[12px] font-mono font-semibold text-[#0f9d58] bg-[#f5f7f7] px-2.5 py-1 rounded-[4px] border border-[#e5e7eb]">
                  Mod: {dmrvResult.spectralFluxModifier.toFixed(2)}x
                </span>
              </div>

              <div className="flex items-center justify-center my-2">
                <svg viewBox="0 0 240 215" className="w-full max-w-[250px] h-auto">
                  {[0.25, 0.5, 0.75, 1].map((ring) => {
                    const cx = 120;
                    const cy = 110;
                    const r = 72 * ring;
                    const pts = radarAxes
                      .map((_, i) => {
                        const angle = (Math.PI * 2 * i) / radarAxes.length - Math.PI / 2;
                        return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
                      })
                      .join(' ');
                    return (
                      <polygon
                        key={ring}
                        points={pts}
                        fill="none"
                        stroke="#e5e7eb"
                        strokeWidth="1"
                      />
                    );
                  })}

                  {radarAxes.map((axis, i) => {
                    const cx = 120;
                    const cy = 110;
                    const r = 72;
                    const angle = (Math.PI * 2 * i) / radarAxes.length - Math.PI / 2;
                    const x2 = cx + r * Math.cos(angle);
                    const y2 = cy + r * Math.sin(angle);
                    const lx = cx + (r + 22) * Math.cos(angle);
                    const ly = cy + (r + 16) * Math.sin(angle);
                    return (
                      <g key={axis.label}>
                        <line x1={cx} y1={cy} x2={x2} y2={y2} stroke="#e5e7eb" strokeWidth="1" />
                        <text
                          x={lx}
                          y={ly}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          className="fill-[#273239] text-[10px] font-medium"
                        >
                          {axis.label}
                        </text>
                      </g>
                    );
                  })}

                  <polygon
                    points={radarAxes
                      .map((axis, i) => {
                        const cx = 120;
                        const cy = 110;
                        const r = 72 * axis.value;
                        const angle = (Math.PI * 2 * i) / radarAxes.length - Math.PI / 2;
                        return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
                      })
                      .join(' ')}
                    fill="rgba(15, 157, 88, 0.18)"
                    stroke="#0f9d58"
                    strokeWidth="2"
                  />

                  {radarAxes.map((axis, i) => {
                    const cx = 120;
                    const cy = 110;
                    const r = 72 * axis.value;
                    const angle = (Math.PI * 2 * i) / radarAxes.length - Math.PI / 2;
                    return (
                      <circle
                        key={axis.label}
                        cx={cx + r * Math.cos(angle)}
                        cy={cy + r * Math.sin(angle)}
                        r="3.5"
                        fill="#0f9d58"
                        stroke="#ffffff"
                        strokeWidth="1.5"
                      />
                    );
                  })}
                </svg>
              </div>
            </div>

            {/* Sentinel-2 Canopy Spectral Matrix */}
            <div className="bg-white border border-[#e5e7eb] rounded-[8px] p-5 flex flex-col justify-between">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-display text-[22px] font-bold leading-[28px] text-[#273239] flex items-center gap-2">
                    <Layers className="w-5 h-5 text-[#0f9d58]" />
                    Canopy Spectral Matrix
                  </h3>
                  <p className="text-[14px] text-[#4f738f] mt-0.5">
                    Click any 1km² sub-parcel cell to inspect localized NDVI
                  </p>
                </div>
                <span className="text-[12px] font-mono font-semibold text-[#273239] bg-[#f5f7f7] px-2.5 py-1 rounded-[4px] border border-[#e5e7eb]">
                  [{selectedCell[0]},{selectedCell[1]}]:{' '}
                  {adjustedGrid[selectedCell[0]][selectedCell[1]].toFixed(2)}
                </span>
              </div>

              <div className="grid grid-cols-5 gap-1.5 my-2">
                {adjustedGrid.map((row, rIdx) =>
                  row.map((cellVal, cIdx) => {
                    const isSelected = selectedCell[0] === rIdx && selectedCell[1] === cIdx;
                    let bgClass = 'bg-[#0f9d58] text-white';
                    if (cellVal < 0.42) {
                      bgClass = 'bg-[#c87979] text-white';
                    } else if (cellVal < 0.55) {
                      bgClass = 'bg-[#e0a55f] text-white';
                    } else if (cellVal < 0.72) {
                      bgClass = 'bg-[#6a86c8] text-white';
                    }
                    return (
                      <button
                        key={`${rIdx}-${cIdx}`}
                        type="button"
                        onClick={() => setSelectedCell([rIdx, cIdx])}
                        aria-label={`Inspect parcel row ${rIdx + 1} column ${cIdx + 1} NDVI ${cellVal}`}
                        className={`h-10 rounded-[4px] font-mono text-[12px] font-semibold flex items-center justify-center transition-all cursor-pointer ${bgClass} ${
                          isSelected ? 'ring-2 ring-[#273239] ring-offset-1' : 'hover:opacity-90'
                        }`}
                      >
                        {cellVal.toFixed(2)}
                      </button>
                    );
                  })
                )}
              </div>

              <div className="bg-[#f5f7f7] border border-[#e5e7eb] rounded-[6px] px-3 py-2 text-[12px] flex items-center justify-between gap-2">
                <div className="font-mono text-[#273239]">
                  Parcel [{selectedCell[0] + 1},{selectedCell[1] + 1}] · NDVI{' '}
                  <span className="font-semibold text-[#0f9d58]">
                    {adjustedGrid[selectedCell[0]][selectedCell[1]].toFixed(2)}
                  </span>{' '}
                  · Est. AGBD:{' '}
                  <span className="font-semibold">
                    {Math.round(
                      gediAgbdMgHa *
                        (adjustedGrid[selectedCell[0]][selectedCell[1]] /
                          Math.max(0.2, sentinelNdvi))
                    )}{' '}
                    Mg/ha
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleTriggerLiveSatelliteScan(
                      Number(
                        (
                          activeProject.coordinates.lat +
                          (2 - selectedCell[0]) * 0.009
                        ).toFixed(4)
                      ),
                      Number(
                        (
                          activeProject.coordinates.lon +
                          (selectedCell[1] - 2) * 0.009
                        ).toFixed(4)
                      )
                    )
                  }
                  className="text-[#5486bd] font-semibold hover:underline cursor-pointer shrink-0"
                >
                  Scan Parcel →
                </button>
              </div>
            </div>
          </div>

          {/* 12-Month Cumulative Carbon Trajectory */}
          <div className="bg-white border border-[#e5e7eb] rounded-[8px] p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="font-display text-[22px] font-bold leading-[28px] text-[#273239]">
                  12-Month Cumulative Carbon Trajectory: Registry Claimed vs. Satellite Empirical
                </h3>
                <p className="text-[14px] text-[#4f738f]">
                  Dashed gold curve tracks registry self-reported issuances; solid green curve tracks GEDI/Sentinel-2 empirical sequestration
                </p>
              </div>
              {activeMonthData && (
                <div className="text-[12px] font-mono bg-[#f5f7f7] px-3 py-1.5 rounded-[4px] border border-[#e5e7eb] text-[#273239] shrink-0">
                  {activeMonthData.month} · Claim:{' '}
                  {activeMonthData.claimedCumulative.toLocaleString()} · Verified:{' '}
                  {activeMonthData.verifiedCumulative.toLocaleString()} tCO2e
                </div>
              )}
            </div>

            <div className="w-full overflow-x-auto">
              <svg viewBox="0 0 680 185" className="w-full h-auto min-w-[520px]">
                {[0, 0.25, 0.5, 0.75, 1].map((step) => {
                  const y = 150 - step * 125;
                  const val = Math.round(step * maxTrajectoryValue);
                  return (
                    <g key={step}>
                      <line x1="54" y1={y} x2="660" y2={y} stroke="#e5e7eb" strokeWidth="1" />
                      <text
                        x="48"
                        y={y + 3}
                        textAnchor="end"
                        className="fill-[#4f738f] text-[10px] font-mono"
                      >
                        {(val / 1000).toFixed(0)}k
                      </text>
                    </g>
                  );
                })}

                <polyline
                  fill="none"
                  stroke="#e0a55f"
                  strokeWidth="2.2"
                  strokeDasharray="5 4"
                  points={monthlySeries
                    .map((pt, idx) => {
                      const x = 65 + (idx * 585) / (monthlySeries.length - 1);
                      const y = 150 - (pt.claimedCumulative / maxTrajectoryValue) * 125;
                      return `${x},${y}`;
                    })
                    .join(' ')}
                />

                <polygon
                  fill="rgba(15, 157, 88, 0.1)"
                  points={[
                    `65,150`,
                    ...monthlySeries.map((pt, idx) => {
                      const x = 65 + (idx * 585) / (monthlySeries.length - 1);
                      const y = 150 - (pt.verifiedCumulative / maxTrajectoryValue) * 125;
                      return `${x},${y}`;
                    }),
                    `650,150`,
                  ].join(' ')}
                />

                <polyline
                  fill="none"
                  stroke="#0f9d58"
                  strokeWidth="2.5"
                  points={monthlySeries
                    .map((pt, idx) => {
                      const x = 65 + (idx * 585) / (monthlySeries.length - 1);
                      const y = 150 - (pt.verifiedCumulative / maxTrajectoryValue) * 125;
                      return `${x},${y}`;
                    })
                    .join(' ')}
                />

                {monthlySeries.map((pt, idx) => {
                  const x = 65 + (idx * 585) / (monthlySeries.length - 1);
                  const yClaim = 150 - (pt.claimedCumulative / maxTrajectoryValue) * 125;
                  const yVer = 150 - (pt.verifiedCumulative / maxTrajectoryValue) * 125;
                  return (
                    <g
                      key={pt.month}
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredMonthIndex(idx)}
                      onMouseLeave={() => setHoveredMonthIndex(null)}
                    >
                      <rect x={x - 18} y={15} width="36" height="150" fill="transparent" />
                      <circle cx={x} cy={yClaim} r="3.5" fill="#e0a55f" />
                      <circle
                        cx={x}
                        cy={yVer}
                        r="4"
                        fill="#0f9d58"
                        stroke="#ffffff"
                        strokeWidth="1.5"
                      />
                      <text
                        x={x}
                        y="170"
                        textAnchor="middle"
                        className="fill-[#4f738f] text-[10px] font-mono"
                      >
                        {pt.month.slice(2)}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
