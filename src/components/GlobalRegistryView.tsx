import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Filter,
  Plus,
  ArrowUpRight,
  Sliders,
  X,
  RotateCcw,
  GitMerge,
  Bell,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { Sankey, Tooltip, ResponsiveContainer, Layer, Rectangle } from 'recharts';
import {
  type CarbonProject,
  type VerificationStatus,
  type RegistryStandard,
  type BlockchainTransaction,
  type BilateralLedgerEntry,
  type RegistryAnomalyAlert,
  type AnomalyCategory,
  evaluateSatelliteDmrv,
  calculateGeodesicAreaHa,
  reconcileRegistryTransactions,
} from '../utils/dmrvEngine';
import { InteractiveSatelliteMap } from './InteractiveSatelliteMap';

interface GlobalRegistryViewProps {
  projects: CarbonProject[];
  blocks?: BlockchainTransaction[];
  ndcLedger?: BilateralLedgerEntry[];
  onInspectProjectInDmrv: (projectId: string) => void;
  onInitiateSettlement: (projectId: string) => void;
  onRegisterNewProject: (project: CarbonProject) => Promise<void> | void;
}

interface SankeyNodeCustomProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  index?: number;
  payload?: {
    name: string;
    iso?: string;
    role?: 'host' | 'buyer';
    color?: string;
    value?: number;
  };
  containerWidth?: number;
}

const CustomSankeyNode: React.FC<SankeyNodeCustomProps> = ({
  x = 0,
  y = 0,
  width = 14,
  height = 24,
  index = 0,
  payload,
}) => {
  const isOut = x > 320;
  const fillColor = payload?.color || (isOut ? '#5486bd' : '#0f9d58');
  const formattedVal = payload?.value ? `${(payload.value / 1000).toFixed(0)}k tCO2e` : '';

  return (
    <Layer key={`CustomNode${index}`}>
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={Math.max(6, height)}
        fill={fillColor}
        fillOpacity={1}
        radius={[4, 4, 4, 4]}
      />
      <text
        textAnchor={isOut ? 'end' : 'start'}
        x={isOut ? x - 8 : x + width + 8}
        y={y + height / 2 - 2}
        fontSize="13"
        fontWeight={600}
        fill="#273239"
      >
        {payload?.name}
      </text>
      <text
        textAnchor={isOut ? 'end' : 'start'}
        x={isOut ? x - 8 : x + width + 8}
        y={y + height / 2 + 13}
        fontSize="11"
        fill="#4f738f"
        fontFamily="JetBrains Mono, monospace"
      >
        {formattedVal}
      </text>
    </Layer>
  );
};

export const GlobalRegistryView: React.FC<GlobalRegistryViewProps> = ({
  projects,
  blocks = [],
  ndcLedger = [],
  onInspectProjectInDmrv,
  onInitiateSettlement,
  onRegisterNewProject,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [ecosystemFilter, setEcosystemFilter] = useState<
    'ALL' | 'INDIA_ICM' | 'EAST_AFRICA' | 'LATAM_ASEAN'
  >('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | VerificationStatus>('ALL');
  const [selectedCorridorIso, setSelectedCorridorIso] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Real-time Reconciliation & Anomaly Notification State
  const baselineAlerts = useMemo(
    () => reconcileRegistryTransactions(projects, ndcLedger, blocks),
    [projects, ndcLedger, blocks]
  );
  const [customAlerts, setCustomAlerts] = useState<RegistryAnomalyAlert[]>([]);
  const [dismissedAlertIds, setDismissedAlertIds] = useState<string[]>([]);
  const [alertCategoryFilter, setAlertCategoryFilter] = useState<'ALL' | AnomalyCategory>('ALL');
  const [reconcilingLive, setReconcilingLive] = useState<boolean>(false);
  const [lastReconciledTime, setLastReconciledTime] = useState<string>('Just now');
  const [liveToastAlert, setLiveToastAlert] = useState<RegistryAnomalyAlert | null>(null);

  const activeAlerts = useMemo(() => {
    const merged = [...customAlerts, ...baselineAlerts];
    return merged.filter((a) => {
      if (dismissedAlertIds.includes(a.id)) return false;
      if (alertCategoryFilter !== 'ALL' && a.category !== alertCategoryFilter) return false;
      return true;
    });
  }, [customAlerts, baselineAlerts, dismissedAlertIds, alertCategoryFilter]);

  const alertCounts = useMemo(() => {
    const allActive = [...customAlerts, ...baselineAlerts].filter(
      (a) => !dismissedAlertIds.includes(a.id)
    );
    return {
      total: allActive.length,
      critical: allActive.filter((a) => a.severity === 'critical').length,
      warning: allActive.filter((a) => a.severity === 'warning').length,
      verified: allActive.filter((a) => a.severity === 'verified').length,
    };
  }, [customAlerts, baselineAlerts, dismissedAlertIds]);

  // Trigger initial visual toast when entering view if critical anomaly exists
  useEffect(() => {
    const firstCritical = baselineAlerts.find((a) => a.severity === 'critical');
    if (firstCritical) {
      setLiveToastAlert(firstCritical);
      const timer = setTimeout(() => setLiveToastAlert(null), 7000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleRunLiveReconciliation = async (simulateDoubleClaim = false) => {
    setReconcilingLive(true);
    try {
      const res = await fetch('/api/reconcile/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          simulateDoubleClaim,
          targetProjectId: projects[0]?.id,
        }),
      });
      const data = await res.json();
      if (data.alerts && data.alerts.length > 0) {
        setDismissedAlertIds([]);
        setLastReconciledTime(
          new Date(data.scannedAt || Date.now()).toISOString().slice(11, 19) + ' UTC'
        );
        if (simulateDoubleClaim) {
          const intercepted = data.alerts[0] as RegistryAnomalyAlert;
          setCustomAlerts((prev) => [intercepted, ...prev.slice(0, 3)]);
          setLiveToastAlert(intercepted);
        } else {
          const topAlert = data.alerts[0] as RegistryAnomalyAlert;
          setLiveToastAlert(topAlert);
        }
      }
    } catch {
      // Local fallback simulation
      if (simulateDoubleClaim && projects[0]) {
        const fallbackAlert: RegistryAnomalyAlert = {
          id: `alert-sim-${Date.now()}`,
          category: 'DOUBLE_COUNTING_RISK',
          severity: 'critical',
          projectId: projects[0].id,
          registryId: projects[0].registryId,
          projectName: projects[0].name,
          countryIso: projects[0].isoCode,
          title: `INTERCEPTED: Duplicate Cross-Registry Serial Claim on ${projects[0].registryId}`,
          description: `Real-time reconciliation detected a concurrent attempt to claim 35,000 tCO2e across both domestic NDC accounting and an external voluntary batch without Corresponding Adjustment.`,
          discrepancyOrVolumeLabel: '35,000 tCO2e Blocked',
          timestamp: new Date().toISOString(),
          remediationAction: 'Smart contract rolled back duplicate serial claim.',
        };
        setCustomAlerts((prev) => [fallbackAlert, ...prev]);
        setLiveToastAlert(fallbackAlert);
      }
    } finally {
      setReconcilingLive(false);
    }
  };

  const [newName, setNewName] = useState('');
  const [newCountry, setNewCountry] = useState('India');
  const [newIsoCode, setNewIsoCode] = useState('IND');
  const [newRegion, setNewRegion] = useState('Odisha Coastal Mangrove Zone');
  const [newStandard, setNewStandard] = useState<RegistryStandard>('ICM (India)');
  const [newLat, setNewLat] = useState<number>(20.715);
  const [newLon, setNewLon] = useState<number>(86.865);
  const [polygonVertices, setPolygonVertices] = useState<[number, number][]>([
    [20.735, 86.84],
    [20.735, 86.89],
    [20.695, 86.89],
    [20.695, 86.84],
  ]);
  const [newBaselineAgbd] = useState<number>(92);
  const [newGediAgbd, setNewGediAgbd] = useState<number>(176);
  const [newNdvi, setNewNdvi] = useState<number>(0.76);
  const [newCanopy] = useState<number>(83);
  const [newClaimedCredits, setNewClaimedCredits] = useState<number>(360000);
  const [newArticle6, setNewArticle6] = useState<boolean>(true);
  const [submittingNew, setSubmittingNew] = useState<boolean>(false);

  // Build Recharts Sankey data showing cross-border ITMO movements between country registries
  const sankeyFlowData = useMemo(() => {
    const hostLabels: Record<string, { label: string; color: string }> = {
      IND: { label: 'India (ICM / CCTS)', color: '#0f9d58' },
      BRA: { label: 'Brazil (SBCE REDD+)', color: '#6a86c8' },
      IDN: { label: 'Indonesia (SRN PPI)', color: '#9c87c9' },
      KEN: { label: 'Kenya (National Registry)', color: '#e0a55f' },
    };

    const buyerLabels: Record<string, { label: string; color: string }> = {
      CHE: { label: 'Switzerland (FOEN / KliK)', color: '#5486bd' },
      SGP: { label: 'Singapore (NEA Registry)', color: '#36526a' },
      JPN: { label: 'Japan (JCM Bilateral)', color: '#4f738f' },
    };

    const pairVolumes = new Map<string, number>([
      ['IND->SGP', 65000],
      ['IND->CHE', 80000],
      ['BRA->CHE', 145000],
      ['BRA->SGP', 65000],
      ['IDN->JPN', 165000],
      ['KEN->SGP', 80000],
    ]);

    blocks
      .filter((b) => b.actionType === 'CROSS_BORDER_ITMO' && b.blockNumber > 19402104)
      .forEach((b) => {
        const key = `${b.hostCountryIso}->${b.acquiringCountryIso}`;
        pairVolumes.set(key, (pairVolumes.get(key) || 0) + b.volumeTco2e);
      });

    const hostOrder = ['IND', 'BRA', 'IDN', 'KEN'];
    const buyerOrder = ['CHE', 'SGP', 'JPN'];

    const nodes = [
      ...hostOrder.map((iso) => ({
        name: hostLabels[iso].label,
        iso,
        role: 'host' as const,
        color: hostLabels[iso].color,
      })),
      ...buyerOrder.map((iso) => ({
        name: buyerLabels[iso].label,
        iso,
        role: 'buyer' as const,
        color: buyerLabels[iso].color,
      })),
    ];

    const links: Array<{
      source: number;
      target: number;
      value: number;
      sourceIso: string;
      targetIso: string;
      sourceName: string;
      targetName: string;
    }> = [];

    pairVolumes.forEach((vol, key) => {
      const [srcIso, dstIso] = key.split('->');
      const srcIdx = hostOrder.indexOf(srcIso);
      const dstIdx = buyerOrder.indexOf(dstIso);
      if (srcIdx !== -1 && dstIdx !== -1 && vol > 0) {
        links.push({
          source: srcIdx,
          target: hostOrder.length + dstIdx,
          value: vol,
          sourceIso: srcIso,
          targetIso: dstIso,
          sourceName: hostLabels[srcIso].label,
          targetName: buyerLabels[dstIso].label,
        });
      }
    });

    const totalVolume = links.reduce((sum, l) => sum + l.value, 0);

    return { nodes, links, totalVolume };
  }, [blocks]);

  const computedPolygonAreaHa = useMemo(() => {
    const geodesic = calculateGeodesicAreaHa(polygonVertices);
    return geodesic > 50 ? geodesic : 4800;
  }, [polygonVertices]);

  const filteredProjects = useMemo(() => {
    return projects.filter((proj) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        proj.name.toLowerCase().includes(q) ||
        proj.registryId.toLowerCase().includes(q) ||
        proj.country.toLowerCase().includes(q) ||
        proj.methodology.toLowerCase().includes(q);

      const matchesEcosystem =
        ecosystemFilter === 'ALL' ||
        (ecosystemFilter === 'INDIA_ICM' && proj.isoCode === 'IND') ||
        (ecosystemFilter === 'EAST_AFRICA' &&
          (proj.isoCode === 'UGA' || proj.isoCode === 'KEN')) ||
        (ecosystemFilter === 'LATAM_ASEAN' &&
          (proj.isoCode === 'BRA' || proj.isoCode === 'IDN'));

      const matchesStatus = statusFilter === 'ALL' || proj.status === statusFilter;

      const matchesCorridorIso =
        !selectedCorridorIso || proj.isoCode === selectedCorridorIso;

      return (
        matchesSearch && matchesEcosystem && matchesStatus && matchesCorridorIso
      );
    });
  }, [
    projects,
    searchQuery,
    ecosystemFilter,
    statusFilter,
    selectedCorridorIso,
  ]);

  const statusBadge = (status: VerificationStatus) => {
    if (status === 'Nominal') {
      return <span className="font-semibold text-[#0f9d58]">● Nominal</span>;
    }
    if (status === 'Drifting') {
      return <span className="font-semibold text-[#e0a55f]">▲ Drifting</span>;
    }
    return <span className="font-semibold text-[#d95c5c]">✖ Critical</span>;
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSubmittingNew(true);

    try {
      const telemetry = {
        gediAgbdMgHa: newGediAgbd,
        sentinelNdvi: newNdvi,
        canopyCoverPct: newCanopy,
        oco2DeltaPpm: -1.65,
        projectAreaHa: computedPolygonAreaHa,
        baselineAgbdMgHa: newBaselineAgbd,
        bufferPoolPct: 12,
      };
      const dmrv = evaluateSatelliteDmrv(telemetry, newClaimedCredits);

      const idSuffix = Math.floor(1000 + Math.random() * 9000);
      const prefix = newStandard === 'ICM (India)' ? 'ICM-IND' : 'VCS';
      const registryId = `${prefix}-${idSuffix}`;

      const grid: number[][] = Array.from({ length: 5 }, (_, r) =>
        Array.from({ length: 5 }, (_, c) =>
          Number(
            Math.min(
              0.92,
              Math.max(0.25, newNdvi + (r - 2) * 0.02 + (c - 2) * 0.015)
            ).toFixed(2)
          )
        )
      );

      const months = [
        '2025-11',
        '2025-12',
        '2026-01',
        '2026-02',
        '2026-03',
        '2026-04',
        '2026-05',
        '2026-06',
        '2026-07',
        '2026-08',
        '2026-09',
        '2026-10',
      ];
      const timeSeries = months.map((m, idx) => {
        const progress = (idx + 1) / 12;
        return {
          month: m,
          claimedCumulative: Math.round(newClaimedCredits * progress),
          empiricalGedi: Math.round(dmrv.verifiedIssuableTco2e * progress),
          ndviScore: newNdvi,
        };
      });

      const newProj: CarbonProject = {
        id: `prj-${newIsoCode.toLowerCase()}-${idSuffix}`,
        registryId,
        name: newName.trim(),
        country: newCountry,
        isoCode: newIsoCode,
        regionLabel: newRegion,
        coordinates: { lat: newLat, lon: newLon },
        polygonCoords: polygonVertices,
        standard: newStandard,
        methodology:
          newStandard === 'ICM (India)'
            ? 'CCTS-BM-01 Mangrove & Agroforestry'
            : 'VM0047 Afforestation',
        vintageYear: 2026,
        claimedCreditsTco2e: newClaimedCredits,
        verifiedCreditsTco2e: dmrv.verifiedIssuableTco2e,
        retiredCreditsTco2e: 0,
        unitPriceUsd: 16.5,
        article6Authorized: newArticle6,
        telemetry,
        liveSceneMeta: {
          sceneId: `S2B_${newIsoCode}_20261025_L2A`,
          datetime: new Date().toISOString(),
          cloudCoverPct: 3.1,
          platform: 'Sentinel-2B + ISS GEDI L4A',
          constellation: 'Sentinel-2 / Copernicus STAC',
          stacEndpoint: 'https://earth-search.aws.element84.com/v1/search',
        },
        status: dmrv.status,
        lastAuditTimestamp: new Date().toISOString(),
        onChainTokenId: `OCANOPY-${idSuffix}-${newIsoCode}`,
        timeSeries,
        spatialMatrix: grid,
      };

      await onRegisterNewProject(newProj);
      setShowModal(false);
      setNewName('');
    } finally {
      setSubmittingNew(false);
    }
  };

  return (
    <div className="space-y-6 relative">
      {/* Real-Time Visual Alert Toast Notification */}
      {liveToastAlert && (
        <div
          role="alert"
          className={`fixed bottom-5 right-5 z-50 max-w-md w-full bg-white rounded-[12px] p-4 shadow-lg border-2 transition-all ${
            liveToastAlert.severity === 'critical'
              ? 'border-[#d95c5c]'
              : liveToastAlert.severity === 'warning'
              ? 'border-[#e0a55f]'
              : 'border-[#0f9d58]'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <ShieldAlert
                className={`w-5 h-5 shrink-0 mt-0.5 ${
                  liveToastAlert.severity === 'critical'
                    ? 'text-[#d95c5c]'
                    : liveToastAlert.severity === 'warning'
                    ? 'text-[#e0a55f]'
                    : 'text-[#0f9d58]'
                }`}
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono font-semibold text-[#d95c5c]">
                    LIVE RECONCILIATION ALERT
                  </span>
                  <span className="text-[11px] font-mono text-[#4f738f]">
                    {liveToastAlert.discrepancyOrVolumeLabel}
                  </span>
                </div>
                <div className="font-display font-bold text-[15px] text-[#273239] mt-0.5">
                  {liveToastAlert.title}
                </div>
                <p className="text-[12px] text-[#36526a] mt-1 leading-[18px]">
                  {liveToastAlert.description}
                </p>
                <div className="mt-2.5 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      onInspectProjectInDmrv(liveToastAlert.projectId);
                      setLiveToastAlert(null);
                    }}
                    className="text-[12px] font-semibold text-[#0f9d58] hover:underline cursor-pointer"
                  >
                    Inspect Corridor Sensor →
                  </button>
                  <button
                    type="button"
                    onClick={() => setLiveToastAlert(null)}
                    className="text-[12px] text-[#4f738f] hover:text-[#273239] cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setLiveToastAlert(null)}
              aria-label="Close live notification"
              className="text-[#4f738f] hover:text-[#273239] p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header Card */}
      <div className="bg-white border border-[#e5e7eb] rounded-[12px] p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-[14px] text-[#5486bd] font-medium mb-1">
            Sovereign & Voluntary Carbon Ledger
          </div>
          <h1 className="font-display text-[32px] font-bold leading-[38px] text-[#273239]">
            Global Satellite-Audited Carbon Corridors
          </h1>
          <p className="text-[16px] text-[#36526a] mt-1 max-w-2xl">
            Cross-border registry spanning India&apos;s Carbon Credit Trading Scheme (ICM / CCTS), East African CDM/VCS reserves, and Amazon/ASEAN REDD+ jurisdictions.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-3 rounded-[8px] bg-[#0f9d58] text-white text-[14px] font-medium hover:bg-[#4f738f] transition-colors shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Register Geospatial Polygon & Mint
        </button>
      </div>

      {/* Real-Time Transaction Reconciliation & Double-Counting Notification Center */}
      <div className="bg-white border border-[#e5e7eb] rounded-[12px] p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 mb-4 border-b border-[#e5e7eb]">
          <div>
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-[#d95c5c]" />
              <h2 className="font-display text-[22px] font-bold leading-[28px] text-[#273239]">
                Real-Time Transaction Reconciliation & Anomaly Alerts
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[12px] font-mono font-semibold bg-[#d95c5c] text-white">
                {alertCounts.critical} Critical · {alertCounts.warning} Drift
              </span>
            </div>
            <p className="text-[14px] text-[#4f738f] mt-0.5">
              Continuous cross-registry reconciliation flagging double-counting risks, missing Article 6.2 authorizations, and GEDI/Sentinel-2 over-crediting discrepancies · Last scan: {lastReconciledTime}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => handleRunLiveReconciliation(false)}
              disabled={reconcilingLive}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[4px] border border-[#e5e7eb] bg-white hover:bg-[#f5f7f7] text-[#273239] text-[13px] font-medium transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#5486bd] ${reconcilingLive ? 'animate-spin' : ''}`} />
              Reconcile Ledger Now
            </button>
            <button
              type="button"
              onClick={() => handleRunLiveReconciliation(true)}
              disabled={reconcilingLive}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[8px] bg-[#0f9d58] hover:bg-[#4f738f] text-white text-[13px] font-medium transition-colors cursor-pointer disabled:opacity-50"
            >
              <Zap className="w-3.5 h-3.5" />
              Simulate Double-Claim Attempt
            </button>
          </div>
        </div>

        {/* Category Filter Chips */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'ALL', label: `All Reconciliation Alerts (${alertCounts.total})` },
                { id: 'DOUBLE_COUNTING_RISK', label: 'Double-Counting Risks' },
                { id: 'OVER_CREDITING_ANOMALY', label: 'Satellite Over-Crediting Anomalies' },
                { id: 'NDC_RECONCILIATION_GUARD', label: 'Verified Art. 6.2 Adjustments' },
              ] as const
            ).map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setAlertCategoryFilter(chip.id)}
                className={`px-3 py-1.5 text-[13px] rounded-[4px] transition-colors cursor-pointer ${
                  alertCategoryFilter === chip.id
                    ? 'bg-[#0f9d58] text-white font-medium'
                    : 'bg-[#f5f7f7] text-[#273239] border border-[#e5e7eb] hover:bg-white'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {dismissedAlertIds.length > 0 && (
            <button
              type="button"
              onClick={() => setDismissedAlertIds([])}
              className="text-[12px] text-[#5486bd] hover:underline cursor-pointer"
            >
              Restore {dismissedAlertIds.length} dismissed alert(s)
            </button>
          )}
        </div>

        {/* Active Alerts List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeAlerts.map((alert) => {
            const isCritical = alert.severity === 'critical';
            const isWarning = alert.severity === 'warning';
            return (
              <div
                key={alert.id}
                className={`rounded-[8px] border p-4 flex flex-col justify-between bg-[#f5f7f7]/70 ${
                  isCritical
                    ? 'border-[#d95c5c]'
                    : isWarning
                    ? 'border-[#e0a55f]'
                    : 'border-[#0f9d58]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span
                      className={`text-[12px] font-semibold flex items-center gap-1.5 ${
                        isCritical
                          ? 'text-[#d95c5c]'
                          : isWarning
                          ? 'text-[#e0a55f]'
                          : 'text-[#0f9d58]'
                      }`}
                    >
                      {isCritical ? (
                        <ShieldAlert className="w-4 h-4" />
                      ) : isWarning ? (
                        <AlertTriangle className="w-4 h-4" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      {alert.category === 'DOUBLE_COUNTING_RISK'
                        ? '✖ Double-Counting Risk'
                        : alert.category === 'OVER_CREDITING_ANOMALY'
                        ? isCritical
                          ? '✖ Critical Over-Crediting Anomaly'
                          : '▲ Spectral Drift Anomaly'
                        : '● Bilateral NDC Reconciled'}
                    </span>

                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-semibold bg-white border border-[#e5e7eb] rounded-[4px] px-2 py-0.5 text-[#273239]">
                        {alert.discrepancyOrVolumeLabel}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setDismissedAlertIds((prev) => [...prev, alert.id])
                        }
                        aria-label={`Dismiss alert ${alert.title}`}
                        className="text-[#4f738f] hover:text-[#273239]"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h3 className="font-display font-bold text-[16px] text-[#273239]">
                    {alert.title}
                  </h3>
                  <p className="text-[13px] text-[#36526a] mt-1 leading-[19px]">
                    {alert.description}
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-[#e5e7eb] flex flex-wrap items-center justify-between gap-2 text-[12px]">
                  <span className="text-[#4f738f] font-medium">
                    Guardrail: {alert.remediationAction}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onInspectProjectInDmrv(alert.projectId)}
                      className="text-[#0f9d58] font-semibold hover:underline cursor-pointer"
                    >
                      Inspect Sensor →
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Interactive Recharts Sankey Diagram: Cross-Border Carbon Flow */}
      <div className="bg-white border border-[#e5e7eb] rounded-[12px] p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 mb-4 border-b border-[#e5e7eb]">
          <div>
            <h2 className="font-display text-[22px] font-bold leading-[28px] text-[#273239] flex items-center gap-2">
              <GitMerge className="w-5 h-5 text-[#0f9d58]" />
              Cross-Border Carbon Flow (Article 6.2 ITMO Sankey Network)
            </h2>
            <p className="text-[14px] text-[#4f738f] mt-0.5">
              Interactive bilateral movement of satellite-verified carbon credits from Host Country Registries (left) to Acquiring Sovereign Registries (right)
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            <span className="font-mono bg-[#f5f7f7] border border-[#e5e7eb] rounded-[4px] px-3 py-1.5 text-[#273239] font-semibold">
              Total ITMO Flow: {sankeyFlowData.totalVolume.toLocaleString()} tCO2e
            </span>
            {selectedCorridorIso && (
              <button
                type="button"
                onClick={() => setSelectedCorridorIso(null)}
                className="px-3 py-1.5 rounded-[4px] bg-[#0f9d58] text-white font-medium cursor-pointer"
              >
                Filtering Host: {selectedCorridorIso} (Clear ×)
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Left 8 columns: Recharts Sankey Graph */}
          <div className="lg:col-span-8 h-[280px] w-full bg-[#f5f7f7]/60 border border-[#e5e7eb] rounded-[8px] p-3">
            <ResponsiveContainer width="100%" height="100%">
              <Sankey
                data={sankeyFlowData}
                nodePadding={26}
                nodeWidth={14}
                margin={{ top: 16, right: 175, bottom: 16, left: 165 }}
                node={<CustomSankeyNode />}
                link={{ stroke: '#5486bd', strokeOpacity: 0.32 }}
              >
                <Tooltip
                  formatter={(value: any) => [
                    `${Number(value).toLocaleString()} tCO2e`,
                    'Transferred ITMO Volume',
                  ]}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#e5e7eb',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#273239',
                  }}
                />
              </Sankey>
            </ResponsiveContainer>
          </div>

          {/* Right 4 columns: Interactive Corridor Route Selector */}
          <div className="lg:col-span-4 space-y-2.5">
            <div className="text-[13px] font-semibold text-[#36526a] mb-1">
              Bilateral Registry Routes (Click to Filter Host)
            </div>
            {sankeyFlowData.links.map((link) => {
              const isSelected = selectedCorridorIso === link.sourceIso;
              return (
                <button
                  key={`${link.sourceIso}-${link.targetIso}`}
                  type="button"
                  onClick={() =>
                    setSelectedCorridorIso(
                      isSelected ? null : link.sourceIso
                    )
                  }
                  className={`w-full text-left px-3.5 py-2.5 rounded-[8px] border transition-colors flex items-center justify-between text-[13px] cursor-pointer ${
                    isSelected
                      ? 'bg-[#0f9d58] text-white border-[#0f9d58]'
                      : 'bg-white text-[#273239] border-[#e5e7eb] hover:bg-[#f5f7f7]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold">
                      {link.sourceIso} → {link.targetIso}
                    </span>
                    <span
                      className={`text-[12px] truncate max-w-[145px] ${
                        isSelected ? 'text-white/90' : 'text-[#4f738f]'
                      }`}
                    >
                      {link.sourceName.split(' ')[0]} to {link.targetName.split(' ')[0]}
                    </span>
                  </div>
                  <span className="font-mono font-semibold tabular-nums">
                    {link.value.toLocaleString()} tCO2e
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Filter & Search Bar (GeeksforGeeks Light pill input & rounded chips) */}
      <div className="bg-white border border-[#e5e7eb] rounded-[8px] p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#4f738f] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by registry ID (CDM-4653, ICM-IND), country, or methodology..."
            className="w-full pl-10 pr-4 py-[10px] text-[14px] bg-white border border-[#e5e7eb] rounded-full text-[#273239] placeholder:text-[#4f738f] focus:outline-none focus:border-[#0f9d58]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            {(
              [
                { id: 'ALL', label: 'All Jurisdictions' },
                { id: 'INDIA_ICM', label: 'India Ecosystem (ICM)' },
                { id: 'EAST_AFRICA', label: 'East Africa (CDM/VCS)' },
                { id: 'LATAM_ASEAN', label: 'LatAm & ASEAN' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setEcosystemFilter(tab.id)}
                className={`px-3 py-2 text-[14px] rounded-[4px] transition-colors cursor-pointer ${
                  ecosystemFilter === tab.id
                    ? 'bg-[#0f9d58] text-white font-medium'
                    : 'bg-white text-[#273239] border border-[#e5e7eb] hover:bg-[#f5f7f7]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 pl-2">
            <Filter className="w-4 h-4 text-[#4f738f]" />
            <select
              aria-label="Filter by Audit Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'ALL' | VerificationStatus)}
              className="text-[14px] bg-white border border-[#e5e7eb] rounded-[4px] px-3 py-2 text-[#273239] focus:outline-none focus:border-[#0f9d58]"
            >
              <option value="ALL">All Audit States</option>
              <option value="Nominal">● Nominal</option>
              <option value="Drifting">▲ Drifting</option>
              <option value="Critical">✖ Critical</option>
            </select>
          </div>
        </div>
      </div>

      {/* Registry Data Table */}
      <div className="bg-white border border-[#e5e7eb] rounded-[8px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#e5e7eb] bg-[#f5f7f7] text-[12px] font-semibold text-[#36526a]">
                <th className="py-3.5 px-4">Registry ID & Project</th>
                <th className="py-3.5 px-4">Jurisdiction & Standard</th>
                <th className="py-3.5 px-4 text-right">Claimed (tCO2e)</th>
                <th className="py-3.5 px-4 text-right">GEDI Verified (tCO2e)</th>
                <th className="py-3.5 px-4 text-right">Delta %</th>
                <th className="py-3.5 px-4 text-right">NDVI / AGBD</th>
                <th className="py-3.5 px-4">dMRV State</th>
                <th className="py-3.5 px-4 text-right">Protocol Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e7eb] text-[14px]">
              {filteredProjects.map((proj) => {
                const availCredits = proj.verifiedCreditsTco2e - proj.retiredCreditsTco2e;
                const audit = evaluateSatelliteDmrv(
                  proj.telemetry,
                  proj.claimedCreditsTco2e
                );
                return (
                  <tr key={proj.id} className="hover:bg-[#f5f7f7]/70 transition-colors">
                    <td className="py-4 px-4">
                      <div className="font-display font-bold text-[#273239] text-[16px]">
                        {proj.name}
                      </div>
                      <div className="text-[12px] text-[#4f738f] font-mono mt-0.5">
                        {proj.registryId} · {proj.onChainTokenId} · Vintage {proj.vintageYear}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-[#273239] font-medium">{proj.country}</div>
                      <div className="text-[12px] text-[#4f738f] mt-0.5">
                        {proj.standard} ·{' '}
                        {proj.article6Authorized ? 'Art. 6.2 Authorized' : 'Domestic Only'}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right font-mono tabular-nums text-[#36526a]">
                      {proj.claimedCreditsTco2e.toLocaleString()}
                    </td>
                    <td className="py-4 px-4 text-right font-mono tabular-nums font-semibold text-[#273239]">
                      {proj.verifiedCreditsTco2e.toLocaleString()}
                      <div className="text-[11px] font-normal text-[#4f738f]">
                        Avail: {availCredits.toLocaleString()}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right font-mono tabular-nums">
                      <span
                        className={
                          audit.overCreditingDiscrepancyPct > 15
                            ? 'text-[#d95c5c] font-semibold'
                            : audit.overCreditingDiscrepancyPct > 5
                            ? 'text-[#e0a55f] font-semibold'
                            : 'text-[#0f9d58] font-semibold'
                        }
                      >
                        {audit.overCreditingDiscrepancyPct > 0
                          ? `+${audit.overCreditingDiscrepancyPct}%`
                          : `${audit.overCreditingDiscrepancyPct}%`}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right font-mono tabular-nums text-[#273239]">
                      {proj.telemetry.sentinelNdvi.toFixed(2)} ·{' '}
                      {proj.telemetry.gediAgbdMgHa} Mg/ha
                    </td>
                    <td className="py-4 px-4 text-[13px]">{statusBadge(proj.status)}</td>
                    <td className="py-4 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onInspectProjectInDmrv(proj.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[4px] border border-[#e5e7eb] bg-white hover:bg-[#f5f7f7] text-[#273239] text-[12px] font-medium transition-colors cursor-pointer"
                        >
                          <Sliders className="w-3.5 h-3.5 text-[#5486bd]" />
                          Inspect Sensor
                        </button>
                        <button
                          type="button"
                          onClick={() => onInitiateSettlement(proj.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[8px] bg-[#0f9d58] hover:bg-[#4f738f] text-white text-[12px] font-medium transition-colors cursor-pointer"
                        >
                          Settle ITMO
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Geodesic Polygon Submission Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-[#273239]/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-[#e5e7eb] rounded-[12px] max-w-3xl w-full p-6 my-8 shadow-lg">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#e5e7eb]">
              <div>
                <h2 className="font-display text-[24px] font-semibold leading-[36px] text-[#273239]">
                  Submit New Geospatial Polygon & Mint dMRV Token
                </h2>
                <p className="text-[14px] text-[#4f738f]">
                  Click on the satellite map to plot polygon boundary vertices and sign an ECDSA block
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 text-[#4f738f] hover:text-[#273239] rounded-[4px]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-medium text-[#273239]">
                    Interactive Geodesic Boundary ({polygonVertices.length} vertices · Computed Area:{' '}
                    <span className="font-mono text-[#0f9d58] font-semibold">
                      {computedPolygonAreaHa.toLocaleString()} ha
                    </span>
                    )
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setPolygonVertices([
                        [newLat + 0.02, newLon - 0.025],
                        [newLat + 0.02, newLon + 0.025],
                        [newLat - 0.02, newLon + 0.025],
                        [newLat - 0.02, newLon - 0.025],
                      ])
                    }
                    className="inline-flex items-center gap-1 text-[12px] text-[#5486bd] hover:underline"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset Polygon
                  </button>
                </div>
                <InteractiveSatelliteMap
                  center={[newLat, newLon]}
                  polygonCoords={polygonVertices}
                  editable={true}
                  onPolygonChange={(coords) => setPolygonVertices(coords)}
                  heightClass="h-52"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-[14px] font-medium text-[#273239] mb-1">
                    Project Corridor Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g., Bhitarkanika Mangrove Blue Carbon Sanctuary"
                    className="w-full px-4 py-2.5 text-[14px] bg-white border border-[#e5e7eb] rounded-full text-[#273239] focus:outline-none focus:border-[#0f9d58]"
                  />
                </div>

                <div>
                  <label className="block text-[14px] font-medium text-[#273239] mb-1">
                    Host Jurisdiction
                  </label>
                  <select
                    value={newIsoCode}
                    onChange={(e) => {
                      const code = e.target.value;
                      setNewIsoCode(code);
                      const map: Record<string, { name: string; lat: number; lon: number }> = {
                        IND: { name: 'India', lat: 20.715, lon: 86.865 },
                        UGA: { name: 'Uganda', lat: 1.9833, lon: 32.9833 },
                        BRA: { name: 'Brazil', lat: -3.4653, lon: -55.2104 },
                        IDN: { name: 'Indonesia', lat: -2.5489, lon: 113.214 },
                        KEN: { name: 'Kenya', lat: -3.8167, lon: 38.6667 },
                      };
                      const target = map[code] || map.IND;
                      setNewCountry(target.name);
                      setNewLat(target.lat);
                      setNewLon(target.lon);
                      setPolygonVertices([
                        [target.lat + 0.02, target.lon - 0.025],
                        [target.lat + 0.02, target.lon + 0.025],
                        [target.lat - 0.02, target.lon + 0.025],
                        [target.lat - 0.02, target.lon - 0.025],
                      ]);
                    }}
                    className="w-full px-4 py-2.5 text-[14px] bg-white border border-[#e5e7eb] rounded-full text-[#273239]"
                  >
                    <option value="IND">India (IND - CCTS / ICM)</option>
                    <option value="UGA">Uganda (UGA - NEMA / CDM)</option>
                    <option value="BRA">Brazil (BRA - SBCE / REDD+)</option>
                    <option value="IDN">Indonesia (IDN - SRN PPI)</option>
                    <option value="KEN">Kenya (KEN - National Registry)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[14px] font-medium text-[#273239] mb-1">
                    Registry Standard
                  </label>
                  <select
                    value={newStandard}
                    onChange={(e) => setNewStandard(e.target.value as RegistryStandard)}
                    className="w-full px-4 py-2.5 text-[14px] bg-white border border-[#e5e7eb] rounded-full text-[#273239]"
                  >
                    <option value="ICM (India)">ICM (India Bureau of Energy Efficiency)</option>
                    <option value="Verra VCS">Verra VCS</option>
                    <option value="Gold Standard">Gold Standard</option>
                    <option value="CDM">UNFCCC CDM</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[14px] font-medium text-[#273239] mb-1">
                    Registry Claimed Credits (tCO2e)
                  </label>
                  <input
                    type="number"
                    min={1000}
                    value={newClaimedCredits}
                    onChange={(e) => setNewClaimedCredits(Number(e.target.value))}
                    className="w-full px-4 py-2.5 text-[14px] font-mono bg-white border border-[#e5e7eb] rounded-full text-[#273239]"
                  />
                </div>

                <div>
                  <label className="block text-[14px] font-medium text-[#273239] mb-1">
                    GEDI L4A Biomass ({newGediAgbd} Mg/ha vs {newBaselineAgbd} baseline)
                  </label>
                  <input
                    type="number"
                    min={40}
                    max={350}
                    value={newGediAgbd}
                    onChange={(e) => setNewGediAgbd(Number(e.target.value))}
                    className="w-full px-4 py-2.5 text-[14px] font-mono bg-white border border-[#e5e7eb] rounded-full text-[#273239]"
                  />
                </div>

                <div>
                  <label className="block text-[14px] font-medium text-[#273239] mb-1">
                    Sentinel-2 Mean NDVI (0.15 – 0.92)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={0.15}
                    max={0.92}
                    value={newNdvi}
                    onChange={(e) => setNewNdvi(Number(e.target.value))}
                    className="w-full px-4 py-2.5 text-[14px] font-mono bg-white border border-[#e5e7eb] rounded-full text-[#273239]"
                  />
                </div>

                <div>
                  <label className="block text-[14px] font-medium text-[#273239] mb-1">
                    Sub-National Region / Basin
                  </label>
                  <input
                    type="text"
                    value={newRegion}
                    onChange={(e) => setNewRegion(e.target.value)}
                    className="w-full px-4 py-2.5 text-[14px] bg-white border border-[#e5e7eb] rounded-full text-[#273239]"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  id="art6-checkbox"
                  type="checkbox"
                  checked={newArticle6}
                  onChange={(e) => setNewArticle6(e.target.checked)}
                  className="rounded border-[#e5e7eb] accent-[#0f9d58]"
                />
                <label htmlFor="art6-checkbox" className="text-[14px] text-[#273239]">
                  Authorize for Paris Agreement Article 6.2 Cross-Border ITMO Corresponding Adjustments
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#e5e7eb]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 text-[14px] rounded-[4px] border border-[#e5e7eb] bg-white text-[#273239] hover:bg-[#f5f7f7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingNew}
                  className="px-4 py-3 text-[14px] font-medium rounded-[8px] bg-[#0f9d58] text-white hover:bg-[#4f738f] transition-colors cursor-pointer disabled:opacity-50"
                >
                  {submittingNew ? 'Signing ECDSA Block...' : 'Verify Polygon & Mint On-Chain'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
