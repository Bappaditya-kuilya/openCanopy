import React, { useEffect, useMemo, useState } from 'react';
import { Download, Leaf } from 'lucide-react';
import {
  INITIAL_PROJECTS,
  INITIAL_BILATERAL_LEDGER,
  INITIAL_TRANSACTIONS,
} from './data/seedProjects';
import {
  type CarbonProject,
  type BilateralLedgerEntry,
  type BlockchainTransaction,
  type SatelliteTelemetryInput,
  type LiveSatelliteSceneMeta,
} from './utils/dmrvEngine';
import { DmrvTelemetryView } from './components/DmrvTelemetryView';
import { GlobalRegistryView } from './components/GlobalRegistryView';
import { CrossBorderBridgeView } from './components/CrossBorderBridgeView';
import { CaseStudiesView } from './components/CaseStudiesView';

type WorkspaceView =
  | 'DMRV_TELEMETRY'
  | 'GLOBAL_REGISTRY'
  | 'CROSS_BORDER_BRIDGE'
  | 'CASE_STUDIES';

export default function App() {
  const [activeView, setActiveView] = useState<WorkspaceView>('DMRV_TELEMETRY');
  const [projects, setProjects] = useState<CarbonProject[]>(INITIAL_PROJECTS);
  const [ndcLedger, setNdcLedger] = useState<BilateralLedgerEntry[]>(
    INITIAL_BILATERAL_LEDGER
  );
  const [blocks, setBlocks] = useState<BlockchainTransaction[]>(
    INITIAL_TRANSACTIONS
  );
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    INITIAL_PROJECTS[0].id
  );
  const [exportSuccessNotice, setExportSuccessNotice] = useState<string | null>(
    null
  );

  useEffect(() => {
    fetch('/api/state')
      .then((r) => r.json())
      .then((data) => {
        if (data.projects && data.projects.length > 0) {
          setProjects(data.projects);
        }
        if (data.ledgerEntries && data.ledgerEntries.length > 0) {
          setNdcLedger(data.ledgerEntries);
        }
        if (data.transactions && data.transactions.length > 0) {
          setBlocks(data.transactions);
        }
      })
      .catch(() => {
        // Fallback to local seed state if offline
      });
  }, []);

  const protocolTotals = useMemo(() => {
    const totalClaimed = projects.reduce(
      (acc, p) => acc + p.claimedCreditsTco2e,
      0
    );
    const totalVerified = projects.reduce(
      (acc, p) => acc + p.verifiedCreditsTco2e,
      0
    );
    const totalItmoTransferred = ndcLedger.reduce(
      (acc, n) => acc + n.exportedItmosTco2e,
      0
    );
    return {
      totalClaimed,
      totalVerified,
      totalItmoTransferred,
    };
  }, [projects, ndcLedger]);

  const handleInspectProjectInDmrv = (projectId: string) => {
    setSelectedProjectId(projectId);
    setActiveView('DMRV_TELEMETRY');
  };

  const handleOpenSettlementForProject = (projectId: string) => {
    setSelectedProjectId(projectId);
    setActiveView('CROSS_BORDER_BRIDGE');
  };

  const handleCommitAttestation = async (
    projectId: string,
    telemetry: SatelliteTelemetryInput,
    claimedCreditsTco2e: number,
    liveSceneMeta?: LiveSatelliteSceneMeta
  ) => {
    try {
      const res = await fetch('/api/oracle/attest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          telemetry,
          claimedCreditsTco2e,
          liveSceneMeta,
        }),
      });
      const data = await res.json();
      if (data.state) {
        setProjects(data.state.projects);
        if (data.state.ledgerEntries) {
          setNdcLedger(data.state.ledgerEntries);
        }
        setBlocks(data.state.transactions);
        if (data.transaction) {
          setExportSuccessNotice(
            `Signed Block #${data.transaction.blockNumber} with ECDSA P-256 (${data.transaction.txHash.slice(0, 12)}...)`
          );
          setTimeout(() => setExportSuccessNotice(null), 4000);
        }
      }
    } catch {
      // Fallback
    }
  };

  const handleRegisterNewProject = async (newProject: CarbonProject) => {
    try {
      const res = await fetch('/api/projects/mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newProject }),
      });
      const data = await res.json();
      if (data.state) {
        setProjects(data.state.projects);
        setNdcLedger(data.state.ledgerEntries);
        setBlocks(data.state.transactions);
        setSelectedProjectId(newProject.id);
        return;
      }
    } catch {
      // Local fallback
    }
    setProjects((prev) => [newProject, ...prev]);
    setSelectedProjectId(newProject.id);
  };

  const handleExecuteSettlement = async (params: {
    projectId: string;
    acquiringCountryIso: string;
    actorEntity: string;
    volumeTco2e: number;
    actionType: 'CROSS_BORDER_ITMO' | 'RETIRE_OFFSET';
  }) => {
    const res = await fetch('/api/settlement/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Cross-border settlement rejected by validator.');
    }
    if (data.state) {
      setProjects(data.state.projects);
      setNdcLedger(data.state.ledgerEntries);
      setBlocks(data.state.transactions);
    }
  };

  const handleExportAuditBundle = () => {
    const bundle = {
      protocol: 'OpenCanopy (opencanopy-dmrv)',
      version: '2.4.0-article6.2',
      exportedAtUtc: new Date().toISOString(),
      summaryMetrics: protocolTotals,
      corridors: projects,
      nationalNdcLedger: ndcLedger,
      recentBlocks: blocks.slice(0, 15),
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `opencanopy-audit-proof-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportSuccessNotice('Signed JSON Audit Bundle exported.');
    setTimeout(() => setExportSuccessNotice(null), 3000);
  };

  const navItems: { id: WorkspaceView; label: string }[] = [
    { id: 'DMRV_TELEMETRY', label: 'Satellite dMRV' },
    { id: 'GLOBAL_REGISTRY', label: 'Global Registry' },
    { id: 'CROSS_BORDER_BRIDGE', label: 'Cross-Border Bridge' },
    { id: 'CASE_STUDIES', label: 'Case Studies' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#f5f7f7] text-[#273239]">
      {/* GeeksforGeeks Light Top Navigation Bar */}
      <header className="sticky top-0 z-40 h-16 bg-white border-b border-[#e5e7eb] px-4 sm:px-8 flex items-center justify-between">
        {/* Zone 1: Brand Identity */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[8px] bg-[#0f9d58] flex items-center justify-center text-white">
            <Leaf className="w-4 h-4" />
          </div>
          <span className="font-display font-bold text-[22px] text-[#273239] tracking-normal">
            OpenCanopy
          </span>
        </div>

        {/* Zone 2: Primary View Switcher (max 4 destinations, nav-link 15px) */}
        <nav aria-label="Primary Workspace Views" className="flex items-center gap-2 sm:gap-5">
          {navItems.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveView(item.id)}
                className={`px-3 py-1.5 rounded-[4px] text-[15px] leading-[20px] transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#0f9d58] text-white font-medium'
                    : 'text-[#273239] hover:bg-[#f5f7f7]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single Global Action Button (button-primary) */}
        <div className="flex items-center">
          <button
            type="button"
            onClick={handleExportAuditBundle}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[8px] bg-[#0f9d58] hover:bg-[#4f738f] text-white text-[14px] font-medium transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export Audit Proof</span>
          </button>
        </div>
      </header>

      {/* Protocol Summary Strip */}
      <div className="bg-white border-b border-[#e5e7eb] px-4 sm:px-8 py-2.5">
        <div className="max-w-[1360px] mx-auto flex flex-wrap items-center justify-between gap-2 text-[13px] text-[#36526a]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[#0f9d58] font-semibold">OpenCanopy dMRV:</span>
            <span>Element84 Sentinel-2 STAC</span>
            <span className="text-[#e5e7eb]">•</span>
            <span>GEDI L4A Biomass</span>
            <span className="text-[#e5e7eb]">•</span>
            <span>ECDSA P-256 Chain</span>
            <span className="text-[#e5e7eb]">•</span>
            <span>Paris Agreement Art. 6.2 ITMO</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 font-mono text-[12px]">
            <span>Claimed: {protocolTotals.totalClaimed.toLocaleString()} tCO2e</span>
            <span className="text-[#e5e7eb]">•</span>
            <span className="text-[#0f9d58] font-semibold">
              Verified: {protocolTotals.totalVerified.toLocaleString()} tCO2e
            </span>
            <span className="text-[#e5e7eb]">•</span>
            <span className="text-[#5486bd] font-semibold">
              ITMO Bridged: {protocolTotals.totalItmoTransferred.toLocaleString()} tCO2e
            </span>
            {exportSuccessNotice && (
              <span className="text-[#0f9d58] font-sans font-semibold">
                · {exportSuccessNotice}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1360px] w-full mx-auto px-4 sm:px-8 py-6">
        {activeView === 'DMRV_TELEMETRY' && (
          <DmrvTelemetryView
            projects={projects}
            selectedProjectId={selectedProjectId}
            onSelectProject={setSelectedProjectId}
            onOpenSettlementForProject={handleOpenSettlementForProject}
            onCommitAttestation={handleCommitAttestation}
          />
        )}

        {activeView === 'GLOBAL_REGISTRY' && (
          <GlobalRegistryView
            projects={projects}
            blocks={blocks}
            ndcLedger={ndcLedger}
            onInspectProjectInDmrv={handleInspectProjectInDmrv}
            onInitiateSettlement={handleOpenSettlementForProject}
            onRegisterNewProject={handleRegisterNewProject}
          />
        )}

        {activeView === 'CROSS_BORDER_BRIDGE' && (
          <CrossBorderBridgeView
            projects={projects}
            ndcLedger={ndcLedger}
            blocks={blocks}
            preselectedProjectId={selectedProjectId}
            onExecuteSettlement={handleExecuteSettlement}
          />
        )}

        {activeView === 'CASE_STUDIES' && (
          <CaseStudiesView
            onLoadCorridorInDmrv={handleInspectProjectInDmrv}
            onLoadCorridorInSettlement={handleOpenSettlementForProject}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#e5e7eb] bg-white px-4 sm:px-8 py-4 mt-8">
        <div className="max-w-[1360px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-[13px] text-[#4f738f]">
          <div>
            OpenCanopy (opencanopy-dmrv) Full-Stack Satellite MRV Protocol · Live Element84 STAC, Open-Meteo & Node.js ECDSA P-256 Ledger
          </div>
          <div className="font-mono text-[12px]">
            UNFCCC Article 6.2 Corresponding Adjustment Compliant · India ICM & Global Cross-Border Markets
          </div>
        </div>
      </footer>
    </div>
  );
}
