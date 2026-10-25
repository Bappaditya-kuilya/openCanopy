import React, { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  ShieldCheck,
  Terminal,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  KeyRound,
} from 'lucide-react';
import {
  type CarbonProject,
  type BilateralLedgerEntry,
  type BlockchainTransaction,
} from '../utils/dmrvEngine';

interface CrossBorderBridgeViewProps {
  projects: CarbonProject[];
  ndcLedger: BilateralLedgerEntry[];
  blocks: BlockchainTransaction[];
  preselectedProjectId: string;
  onExecuteSettlement: (params: {
    projectId: string;
    acquiringCountryIso: string;
    actorEntity: string;
    volumeTco2e: number;
    actionType: 'CROSS_BORDER_ITMO' | 'RETIRE_OFFSET';
  }) => Promise<void> | void;
}

export const CrossBorderBridgeView: React.FC<CrossBorderBridgeViewProps> = ({
  projects,
  ndcLedger,
  blocks,
  preselectedProjectId,
  onExecuteSettlement,
}) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    preselectedProjectId || projects[0]?.id || ''
  );
  const [acquiringCountryIso, setAcquiringCountryIso] = useState<string>('CHE');
  const [actorEntity, setActorEntity] = useState<string>(
    'Swiss Climate Foundation (KliK)'
  );
  const [volumeTco2e, setVolumeTco2e] = useState<number>(25000);
  const [settlementMode, setSettlementMode] = useState<
    'CROSS_BORDER_ITMO' | 'RETIRE_OFFSET'
  >('CROSS_BORDER_ITMO');
  const [proofInput, setProofInput] = useState<string>('');
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [settlementBanner, setSettlementBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [executingTx, setExecutingTx] = useState<boolean>(false);
  const [cryptoVerifyResult, setCryptoVerifyResult] = useState<{
    verified: boolean;
    message: string;
    transaction?: BlockchainTransaction;
    validatorPublicKey?: string;
  } | null>(null);

  React.useEffect(() => {
    if (preselectedProjectId) {
      setSelectedProjectId(preselectedProjectId);
    }
  }, [preselectedProjectId]);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? projects[0],
    [projects, selectedProjectId]
  );

  const availablePool = useMemo(() => {
    if (!selectedProject) return 0;
    return Math.max(
      0,
      selectedProject.verifiedCreditsTco2e - selectedProject.retiredCreditsTco2e
    );
  }, [selectedProject]);

  const buyerDestinations = useMemo(
    () =>
      ndcLedger.filter(
        (acc) => !selectedProject || acc.countryIso !== selectedProject.isoCode
      ),
    [ndcLedger, selectedProject]
  );

  React.useEffect(() => {
    if (
      selectedProject &&
      acquiringCountryIso === selectedProject.isoCode &&
      buyerDestinations.length > 0
    ) {
      setAcquiringCountryIso(buyerDestinations[0].countryIso);
    }
  }, [selectedProject, acquiringCountryIso, buyerDestinations]);

  const handleSettlementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;

    if (volumeTco2e <= 0 || volumeTco2e > availablePool) {
      setSettlementBanner({
        type: 'error',
        message: `Requested volume (${volumeTco2e.toLocaleString()} tCO2e) exceeds available satellite-verified pool (${availablePool.toLocaleString()} tCO2e).`,
      });
      return;
    }

    if (settlementMode === 'CROSS_BORDER_ITMO' && !selectedProject.article6Authorized) {
      setSettlementBanner({
        type: 'error',
        message: `Corridor ${selectedProject.registryId} lacks Host Country Article 6.2 Authorization for cross-border ITMO export. Switch to Domestic Retirement or select an Article 6.2 authorized project.`,
      });
      return;
    }

    setExecutingTx(true);
    try {
      await onExecuteSettlement({
        projectId: selectedProject.id,
        acquiringCountryIso:
          settlementMode === 'CROSS_BORDER_ITMO'
            ? acquiringCountryIso
            : selectedProject.isoCode,
        actorEntity,
        volumeTco2e,
        actionType: settlementMode,
      });

      setSettlementBanner({
        type: 'success',
        message:
          settlementMode === 'CROSS_BORDER_ITMO'
            ? `Atomic Article 6.2 ITMO Settlement executed & signed via ECDSA P-256: -${volumeTco2e.toLocaleString()} tCO2e debited from ${selectedProject.isoCode} NDC and +${volumeTco2e.toLocaleString()} tCO2e credited to ${acquiringCountryIso}.`
            : `Permanent on-chain retirement executed: ${volumeTco2e.toLocaleString()} tCO2e burned for ${actorEntity}.`,
      });
    } catch (err) {
      setSettlementBanner({
        type: 'error',
        message:
          err instanceof Error
            ? err.message
            : 'Settlement transaction failed validation.',
      });
    } finally {
      setExecutingTx(false);
    }
  };

  const handleVerifyCryptographicProof = async (hashOrTxToVerify: string) => {
    const q = hashOrTxToVerify.trim();
    if (!q) return;
    try {
      const res = await fetch('/api/chain/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      setCryptoVerifyResult(data);
    } catch {
      setCryptoVerifyResult({
        verified: false,
        message: 'Failed to contact cryptographic verification endpoint.',
      });
    }
  };

  const handleCopy = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 1800);
  };

  const actionLabel = (action: BlockchainTransaction['actionType']) => {
    switch (action) {
      case 'MINT_VERIFIED':
        return { text: '● Mint dMRV', colorClass: 'text-[#0f9d58]' };
      case 'CROSS_BORDER_ITMO':
        return { text: '⇄ Art. 6.2 ITMO', colorClass: 'text-[#5486bd]' };
      case 'ORACLE_ATTESTATION':
        return { text: '▲ Oracle Audit', colorClass: 'text-[#e0a55f]' };
      case 'RETIRE_OFFSET':
        return { text: '■ Retired Burn', colorClass: 'text-[#4f738f]' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-white border border-[#e5e7eb] rounded-[12px] p-6">
        <div className="text-[14px] text-[#5486bd] font-medium mb-1">
          Paris Agreement Article 6.2 & Cryptographic Settlement
        </div>
        <h1 className="font-display text-[32px] font-bold leading-[38px] text-[#273239]">
          Cross-Border ITMO Bridge & Smart Contract Explorer
        </h1>
        <p className="text-[16px] text-[#36526a] mt-1 max-w-2xl">
          Execute bilateral Internationally Transferred Mitigation Outcomes (ITMOs) with automated double-entry Corresponding Adjustments and ECDSA P-256 block verification.
        </p>
      </div>

      {/* Top Row: Settlement Desk + National NDC Accounting */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 5 columns: Cross-Border ITMO Settlement Desk */}
        <div className="lg:col-span-5 bg-white border border-[#e5e7eb] rounded-[8px] p-5 flex flex-col justify-between">
          <div>
            <div className="pb-4 mb-4 border-b border-[#e5e7eb]">
              <h2 className="font-display text-[22px] font-bold leading-[28px] text-[#273239] flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-[#0f9d58]" />
                Article 6.2 ITMO Settlement Desk
              </h2>
              <p className="text-[14px] text-[#4f738f] mt-0.5">
                Atomic double-entry settlement between sovereign registries
              </p>
            </div>

            <form onSubmit={handleSettlementSubmit} className="space-y-4">
              <div>
                <span className="block text-[14px] font-medium text-[#273239] mb-1.5">
                  Settlement Mechanism
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSettlementMode('CROSS_BORDER_ITMO')}
                    className={`py-2 px-3 text-[13px] rounded-[4px] transition-colors cursor-pointer ${
                      settlementMode === 'CROSS_BORDER_ITMO'
                        ? 'bg-[#0f9d58] text-white font-semibold'
                        : 'bg-white text-[#273239] border border-[#e5e7eb] hover:bg-[#f5f7f7]'
                    }`}
                  >
                    Cross-Border ITMO (Art. 6.2)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettlementMode('RETIRE_OFFSET')}
                    className={`py-2 px-3 text-[13px] rounded-[4px] transition-colors cursor-pointer ${
                      settlementMode === 'RETIRE_OFFSET'
                        ? 'bg-[#0f9d58] text-white font-semibold'
                        : 'bg-white text-[#273239] border border-[#e5e7eb] hover:bg-[#f5f7f7]'
                    }`}
                  >
                    Domestic Offset Retirement
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[14px] font-medium text-[#273239] mb-1.5">
                  Source Satellite-Verified Asset
                </label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => {
                    setSelectedProjectId(e.target.value);
                    setSettlementBanner(null);
                  }}
                  className="w-full px-4 py-2.5 text-[14px] bg-white border border-[#e5e7eb] rounded-full text-[#273239] focus:outline-none focus:border-[#0f9d58]"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.registryId} · {p.name} ({p.isoCode}) —{' '}
                      {p.article6Authorized ? 'Art. 6.2 Auth' : 'Domestic Only'}
                    </option>
                  ))}
                </select>
                {selectedProject && (
                  <div className="mt-1.5 flex items-center justify-between text-[12px] text-[#4f738f] px-1">
                    <span>
                      Host: {selectedProject.country} ({selectedProject.isoCode})
                    </span>
                    <span className="font-mono text-[#0f9d58] font-semibold">
                      Available verified: {availablePool.toLocaleString()} tCO2e
                    </span>
                  </div>
                )}
              </div>

              {settlementMode === 'CROSS_BORDER_ITMO' && (
                <div>
                  <label className="block text-[14px] font-medium text-[#273239] mb-1.5">
                    Acquiring Country National Registry
                  </label>
                  <select
                    value={acquiringCountryIso}
                    onChange={(e) => {
                      const code = e.target.value;
                      setAcquiringCountryIso(code);
                      const defaultBuyers: Record<string, string> = {
                        CHE: 'Swiss Climate Foundation (KliK)',
                        SGP: 'Singapore National Environment Agency',
                        JPN: 'Japan JCM Sovereign Carbon Fund',
                        IND: 'NTPC / Indian Oil Compliance Desk',
                      };
                      if (defaultBuyers[code]) setActorEntity(defaultBuyers[code]);
                    }}
                    className="w-full px-4 py-2.5 text-[14px] bg-white border border-[#e5e7eb] rounded-full text-[#273239] focus:outline-none focus:border-[#0f9d58]"
                  >
                    {buyerDestinations.map((dest) => (
                      <option key={dest.countryIso} value={dest.countryIso}>
                        {dest.countryIso} — {dest.countryName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[14px] font-medium text-[#273239] mb-1.5">
                    Transfer Volume (tCO2e)
                  </label>
                  <input
                    type="number"
                    min={1000}
                    max={Math.max(1000, availablePool)}
                    step={1000}
                    value={volumeTco2e}
                    onChange={(e) => setVolumeTco2e(Number(e.target.value))}
                    className="w-full px-4 py-2 text-[14px] font-mono bg-white border border-[#e5e7eb] rounded-full text-[#273239] focus:outline-none focus:border-[#0f9d58]"
                  />
                </div>
                <div>
                  <label className="block text-[14px] font-medium text-[#273239] mb-1.5">
                    Authorized Counterparty
                  </label>
                  <input
                    type="text"
                    value={actorEntity}
                    onChange={(e) => setActorEntity(e.target.value)}
                    className="w-full px-4 py-2 text-[14px] bg-white border border-[#e5e7eb] rounded-full text-[#273239] focus:outline-none focus:border-[#0f9d58]"
                  />
                </div>
              </div>

              {selectedProject && (
                <div className="bg-[#f5f7f7] border border-[#e5e7eb] rounded-[8px] p-3.5 text-[13px] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[#36526a]">
                      Host Adjustment ({selectedProject.isoCode}):
                    </span>
                    <span className="font-mono font-semibold text-[#e0a55f]">
                      -{volumeTco2e.toLocaleString()} tCO2e (Export Deducted)
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#36526a]">
                      Acquiring Adjustment (
                      {settlementMode === 'CROSS_BORDER_ITMO'
                        ? acquiringCountryIso
                        : selectedProject.isoCode}
                      ):
                    </span>
                    <span className="font-mono font-semibold text-[#0f9d58]">
                      +{volumeTco2e.toLocaleString()} tCO2e (NDC Credited)
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1.5 border-t border-[#e5e7eb]">
                    <span className="text-[#36526a]">Estimated Settlement Value:</span>
                    <span className="font-mono font-bold text-[#273239]">
                      ${(volumeTco2e * selectedProject.unitPriceUsd).toLocaleString()} USD
                    </span>
                  </div>
                </div>
              )}

              {settlementBanner && (
                <div
                  className={`p-3 rounded-[8px] border text-[13px] flex items-start gap-2 ${
                    settlementBanner.type === 'success'
                      ? 'bg-[#f5f7f7] border-[#0f9d58] text-[#0f9d58]'
                      : 'bg-[#f5f7f7] border-[#d95c5c] text-[#d95c5c]'
                  }`}
                >
                  {settlementBanner.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  )}
                  <span>{settlementBanner.message}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={executingTx}
                className="w-full py-3 px-4 rounded-[8px] bg-[#0f9d58] hover:bg-[#4f738f] text-white text-[14px] font-medium transition-colors cursor-pointer disabled:opacity-50"
              >
                {executingTx
                  ? 'Signing ECDSA P-256 Transaction...'
                  : 'Execute Atomic Settlement & Mint Proof'}
              </button>
            </form>
          </div>
        </div>

        {/* Right 7 columns: National Registry NDC Accounting & Corresponding Adjustments */}
        <div className="lg:col-span-7 bg-white border border-[#e5e7eb] rounded-[8px] overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-5 border-b border-[#e5e7eb]">
              <h2 className="font-display text-[22px] font-bold leading-[28px] text-[#273239] flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#0f9d58]" />
                National Registry NDC Accounting & Article 6.2 Balances
              </h2>
              <p className="text-[14px] text-[#4f738f] mt-0.5">
                Real-time sovereign carbon pools preventing cross-border double-claiming across India (ICM) and global registries
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#e5e7eb] bg-[#f5f7f7] text-[12px] font-semibold text-[#36526a]">
                    <th className="py-3 px-4">Jurisdiction Registry</th>
                    <th className="py-3 px-4 text-right">Domestic Pool (tCO2e)</th>
                    <th className="py-3 px-4 text-right">ITMO Exported (-)</th>
                    <th className="py-3 px-4 text-right">ITMO Imported (+)</th>
                    <th className="py-3 px-4 text-right">Net NDC Balance (tCO2e)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e5e7eb] text-[13px]">
                  {ndcLedger.map((acc) => (
                    <tr key={acc.countryIso} className="hover:bg-[#f5f7f7]/70">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-[#273239]">
                          {acc.countryIso} · {acc.countryName}
                        </div>
                        <div className="text-[12px] text-[#4f738f] font-mono">
                          NDC Target: {acc.ndcTargetMtCo2e.toLocaleString()} MtCO2e
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#36526a]">
                        {acc.domesticVerifiedPoolTco2e.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#e0a55f] font-medium">
                        {acc.exportedItmosTco2e > 0
                          ? `-${acc.exportedItmosTco2e.toLocaleString()}`
                          : '0'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#0f9d58] font-medium">
                        {acc.importedItmosTco2e > 0
                          ? `+${acc.importedItmosTco2e.toLocaleString()}`
                          : '0'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-[#273239]">
                        {acc.netAdjustedBalanceTco2e.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row: On-Chain Smart Contract Explorer & ECDSA P-256 Proof Verifier */}
      <div className="bg-white border border-[#e5e7eb] rounded-[8px] overflow-hidden">
        <div className="p-5 border-b border-[#e5e7eb] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-[22px] font-bold leading-[28px] text-[#273239] flex items-center gap-2">
              <Terminal className="w-5 h-5 text-[#5486bd]" />
              On-Chain Smart Contract Explorer & ECDSA P-256 Verifier
            </h2>
            <p className="text-[14px] text-[#4f738f] mt-0.5">
              Click any block or paste a Proof Hash / Tx ID to verify its NIST P-256 cryptographic signature against the validator public key
            </p>
          </div>

          <div className="flex items-center gap-2 w-full lg:w-[440px]">
            <input
              type="text"
              value={proofInput}
              onChange={(e) => setProofInput(e.target.value)}
              placeholder="Paste ZK Proof Hash or Tx ID (e.g., 0x4b12...)"
              className="flex-1 px-4 py-2 text-[13px] font-mono bg-white border border-[#e5e7eb] rounded-full text-[#273239] placeholder:text-[#4f738f] focus:outline-none focus:border-[#0f9d58]"
            />
            <button
              type="button"
              onClick={() => handleVerifyCryptographicProof(proofInput)}
              className="px-4 py-2 rounded-[8px] bg-[#0f9d58] hover:bg-[#4f738f] text-white text-[13px] font-medium transition-colors shrink-0 cursor-pointer"
            >
              Verify ECDSA
            </button>
          </div>
        </div>

        {cryptoVerifyResult && (
          <div
            className={`px-5 py-3.5 border-b border-[#e5e7eb] text-[13px] ${
              cryptoVerifyResult.verified
                ? 'bg-[#f5f7f7] text-[#273239]'
                : 'bg-[#f5f7f7] text-[#d95c5c]'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="font-semibold flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#0f9d58]" />
                <span className={cryptoVerifyResult.verified ? 'text-[#0f9d58]' : 'text-[#d95c5c]'}>
                  {cryptoVerifyResult.message}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setCryptoVerifyResult(null)}
                className="text-[12px] text-[#4f738f] hover:text-[#273239]"
              >
                Close
              </button>
            </div>
            {cryptoVerifyResult.transaction && (
              <div className="mt-1.5 font-mono text-[12px] text-[#4f738f] grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  Block #{cryptoVerifyResult.transaction.blockNumber} · Prev:{' '}
                  {cryptoVerifyResult.transaction.parentBlockHash || 'GENESIS'}
                </div>
                <div className="truncate">
                  ECDSA Sig: {cryptoVerifyResult.transaction.ecdsaSignature}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#e5e7eb] bg-[#f5f7f7] text-[12px] font-semibold text-[#36526a]">
                <th className="py-3 px-4">Block & Timestamp</th>
                <th className="py-3 px-4">Contract Action</th>
                <th className="py-3 px-4">Corridor Asset</th>
                <th className="py-3 px-4">Jurisdiction Route</th>
                <th className="py-3 px-4 text-right">Volume (tCO2e)</th>
                <th className="py-3 px-4">ZK-Oracle Proof & ECDSA Sig</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e7eb] text-[13px]">
              {blocks.map((blk) => {
                const act = actionLabel(blk.actionType);
                return (
                  <tr key={blk.txHash} className="hover:bg-[#f5f7f7]/70">
                    <td className="py-3.5 px-4 font-mono">
                      <div className="font-semibold text-[#273239]">#{blk.blockNumber}</div>
                      <div className="text-[11px] text-[#4f738f]">
                        {blk.timestamp.replace('T', ' ').slice(0, 19)} UTC
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`font-semibold text-[12px] ${act.colorClass}`}>
                        {act.text}
                      </span>
                      <div className="text-[11px] text-[#4f738f] mt-0.5">
                        {blk.correspondingAdjustmentApplied
                          ? 'Art. 6.2 Adjusted'
                          : 'Domestic Ledger'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-[#273239]">{blk.projectName}</div>
                      <div className="text-[11px] font-mono text-[#4f738f]">{blk.projectId}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-mono text-[12px] text-[#273239]">
                        {blk.hostCountryIso} → {blk.acquiringCountryIso}
                      </div>
                      <div className="text-[11px] text-[#4f738f]">{blk.actorEntity}</div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-[#273239]">
                      {blk.volumeTco2e.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[12px]">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setProofInput(blk.proofDigest);
                            handleVerifyCryptographicProof(blk.proofDigest);
                          }}
                          className="text-[#5486bd] hover:underline truncate max-w-[140px] cursor-pointer"
                          title="Click to verify ECDSA signature"
                        >
                          {blk.proofDigest}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopy(blk.proofDigest)}
                          aria-label={`Copy proof hash ${blk.proofDigest}`}
                          className="p-1 text-[#4f738f] hover:text-[#273239] rounded-[4px]"
                        >
                          {copiedHash === blk.proofDigest ? (
                            <Check className="w-3.5 h-3.5 text-[#0f9d58]" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setProofInput(blk.txHash);
                            handleVerifyCryptographicProof(blk.txHash);
                          }}
                          className="px-2 py-0.5 rounded-[4px] bg-[#f5f7f7] border border-[#e5e7eb] text-[11px] font-sans font-medium text-[#0f9d58] hover:bg-[#0f9d58] hover:text-white transition-colors cursor-pointer"
                        >
                          Verify Sig
                        </button>
                      </div>
                      {blk.ecdsaSignature && (
                        <div className="text-[10px] text-[#4f738f] truncate max-w-[220px] mt-0.5">
                          Sig: {blk.ecdsaSignature.slice(0, 28)}...
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
