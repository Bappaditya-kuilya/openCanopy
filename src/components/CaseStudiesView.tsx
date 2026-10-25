import React from 'react';
import {
  Satellite,
  ArrowUpRight,
  GitBranch,
  Database,
  Scale,
  Cpu,
} from 'lucide-react';

interface CaseStudiesViewProps {
  onLoadCorridorInDmrv: (projectId: string) => void;
  onLoadCorridorInSettlement: (projectId: string) => void;
}

export const CaseStudiesView: React.FC<CaseStudiesViewProps> = ({
  onLoadCorridorInDmrv,
  onLoadCorridorInSettlement,
}) => {
  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-white border border-[#e5e7eb] rounded-[12px] p-6">
        <div className="text-[14px] text-[#5486bd] font-medium mb-1">
          Open-Source Satellite dMRV & Blockchain Settlement Architecture
        </div>
        <h1 className="font-display text-[32px] font-bold leading-[38px] text-[#273239]">
          Empirical Verification Case Studies & Methodology
        </h1>
        <p className="text-[16px] text-[#36526a] mt-1 max-w-3xl">
          How OpenCanopy extends multi-sensor remote sensing pipelines (GEDI L4A LiDAR, Sentinel-2 L2A reflectance, and OCO-2/3 XCO2 flux) with Paris Agreement Article 6.2 smart contract accounting across India (ICM) and East Africa.
        </p>
      </div>

      {/* Two-Column Case Study Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Case Study 1: Uganda CDM 4653 */}
        <div className="bg-white border border-[#e5e7eb] rounded-[8px] p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-[13px] mb-3 pb-3 border-b border-[#e5e7eb]">
              <span className="font-mono font-semibold text-[#5486bd]">
                CASE STUDY 01 · CDM-4653 (UGANDA)
              </span>
              <span className="font-semibold text-[#d95c5c]">
                ✖ Critical Over-Crediting (+150.1%)
              </span>
            </div>

            <h2 className="font-display text-[22px] font-bold leading-[28px] text-[#273239]">
              Kachung Central Forest Reserve Afforestation Audit
            </h2>
            <p className="text-[14px] text-[#36526a] mt-2 leading-[22px]">
              Inspired by the foundational open-source satellite verification analysis of Uganda&apos;s CDM Project 4653, OpenCanopy ingests spaceborne LiDAR waveforms and optical vegetation indices across the 2,479-hectare Lira District corridor to test whether paper registry issuances match physical forest biomass.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3 bg-[#f5f7f7] border border-[#e5e7eb] rounded-[8px] p-4 text-[13px]">
              <div>
                <div className="text-[#4f738f]">Paper Registry Claim</div>
                <div className="font-mono font-bold text-[#273239] text-[16px] mt-0.5">
                  298,000 tCO2e
                </div>
              </div>
              <div>
                <div className="text-[#4f738f]">GEDI + Sentinel-2 Verified</div>
                <div className="font-mono font-bold text-[#0f9d58] text-[16px] mt-0.5">
                  119,162 tCO2e
                </div>
              </div>
              <div>
                <div className="text-[#4f738f]">Mean Sentinel-2 NDVI</div>
                <div className="font-mono font-semibold text-[#273239] mt-0.5">
                  0.49 (Sparse / Stressed)
                </div>
              </div>
              <div>
                <div className="text-[#4f738f]">On-Chain Protocol Action</div>
                <div className="font-mono font-semibold text-[#d95c5c] mt-0.5">
                  Issuance Capped · Art. 6.2 Frozen
                </div>
              </div>
            </div>

            <ul className="mt-4 space-y-2 text-[14px] text-[#273239]">
              <li className="flex items-start gap-2">
                <span className="text-[#0f9d58] font-bold">01.</span>
                <span>
                  <strong>GEDI L4A Footprint Analysis:</strong> LiDAR shots show 94.5 Mg/ha aboveground biomass against a 48.0 Mg/ha baseline—insufficient to support 298k tCO2e.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#0f9d58] font-bold">02.</span>
                <span>
                  <strong>Automated Smart Contract Guardrail:</strong> OpenCanopy automatically caps mintable tokens at 119,162 tCO2e and blocks cross-border ITMO export until host-country baseline re-verification.
                </span>
              </li>
            </ul>
          </div>

          <div className="mt-6 pt-4 border-t border-[#e5e7eb] flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onLoadCorridorInDmrv('prj-uga-4653')}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-[8px] bg-[#0f9d58] hover:bg-[#4f738f] text-white text-[14px] font-medium transition-colors cursor-pointer"
            >
              <Satellite className="w-4 h-4" />
              Inspect CDM-4653 in dMRV Workbench
            </button>
          </div>
        </div>

        {/* Case Study 2: India ICM Sundarbans */}
        <div className="bg-white border border-[#e5e7eb] rounded-[8px] p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-[13px] mb-3 pb-3 border-b border-[#e5e7eb]">
              <span className="font-mono font-semibold text-[#0f9d58]">
                CASE STUDY 02 · ICM-IND-8821 (INDIA CCTS)
              </span>
              <span className="font-semibold text-[#0f9d58]">
                ● Nominal Surplus (-14.9% Conservative)
              </span>
            </div>

            <h2 className="font-display text-[22px] font-bold leading-[28px] text-[#273239]">
              Sundarbans Delta Mangrove Restoration & Article 6.2 Bridge
            </h2>
            <p className="text-[14px] text-[#36526a] mt-2 leading-[22px]">
              Demonstrates how high-integrity blue-carbon projects registered under India&apos;s Carbon Credit Trading Scheme (ICM / Bureau of Energy Efficiency) can prove net carbon surplus via spaceborne telemetry and export Article 6.2 ITMOs to international buyers without double counting.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3 bg-[#f5f7f7] border border-[#e5e7eb] rounded-[8px] p-4 text-[13px]">
              <div>
                <div className="text-[#4f738f]">ICM Registry Claim</div>
                <div className="font-mono font-bold text-[#273239] text-[16px] mt-0.5">
                  645,000 tCO2e
                </div>
              </div>
              <div>
                <div className="text-[#4f738f]">GEDI + Sentinel-2 Verified</div>
                <div className="font-mono font-bold text-[#0f9d58] text-[16px] mt-0.5">
                  758,014 tCO2e
                </div>
              </div>
              <div>
                <div className="text-[#4f738f]">Mean Sentinel-2 NDVI</div>
                <div className="font-mono font-semibold text-[#273239] mt-0.5">
                  0.78 (Dense Mangrove Canopy)
                </div>
              </div>
              <div>
                <div className="text-[#4f738f]">Cross-Border Settlement</div>
                <div className="font-mono font-semibold text-[#0f9d58] mt-0.5">
                  Art. 6.2 Authorized (IND → CHE/SGP)
                </div>
              </div>
            </div>

            <ul className="mt-4 space-y-2 text-[14px] text-[#273239]">
              <li className="flex items-start gap-2">
                <span className="text-[#0f9d58] font-bold">01.</span>
                <span>
                  <strong>Empirical Buffer Surplus:</strong> Satellite biomass (186.4 Mg/ha vs 98.0 Mg/ha baseline across 6,420 ha) confirms conservative registry issuance.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#0f9d58] font-bold">02.</span>
                <span>
                  <strong>Bilateral Corresponding Adjustment:</strong> Exporting credits automatically deducts volume from India&apos;s national NDC ledger while crediting the acquiring sovereign registry.
                </span>
              </li>
            </ul>
          </div>

          <div className="mt-6 pt-4 border-t border-[#e5e7eb] flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onLoadCorridorInDmrv('prj-ind-8821')}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-[8px] bg-[#0f9d58] hover:bg-[#4f738f] text-white text-[14px] font-medium transition-colors cursor-pointer"
            >
              <Satellite className="w-4 h-4" />
              Inspect Sundarbans Sensor Data
            </button>
            <button
              type="button"
              onClick={() => onLoadCorridorInSettlement('prj-ind-8821')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-[4px] border border-[#e5e7eb] bg-white hover:bg-[#f5f7f7] text-[#273239] text-[14px] font-medium transition-colors cursor-pointer"
            >
              Bridge IND ITMOs
              <ArrowUpRight className="w-4 h-4 text-[#5486bd]" />
            </button>
          </div>
        </div>
      </div>

      {/* 3 Category Feature Blocks (GeeksforGeeks Light card-feature palette) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#6a86c8] text-white rounded-[8px] p-5">
          <div className="flex items-center gap-2 font-display text-[20px] font-bold mb-2">
            <Cpu className="w-5 h-5" />
            1. Multi-Sensor dMRV Fusion
          </div>
          <p className="text-[14px] text-white/95 leading-[21px]">
            Combines NASA GEDI L4A waveform LiDAR (aboveground biomass density in Mg/ha), ESA Sentinel-2 L2A red-edge/NIR reflectance (NDVI & canopy closure), and OCO-2/3 atmospheric XCO2 anomalies using IPCC 0.47 carbon fraction and 44/12 stoichiometric conversion.
          </p>
        </div>

        <div className="bg-[#0f9d58] text-white rounded-[8px] p-5">
          <div className="flex items-center gap-2 font-display text-[20px] font-bold mb-2">
            <Database className="w-5 h-5" />
            2. Deterministic ZK-Oracle Proofs
          </div>
          <p className="text-[14px] text-white/95 leading-[21px]">
            Every satellite pass generates a deterministic cryptographic digest binding polygon area, GEDI AGBD, Sentinel-2 NDVI, OCO-2 flux, and reversal buffer parameters. Smart contracts verify the ECDSA P-256 signature before minting carbon tokens.
          </p>
        </div>

        <div className="bg-[#9c87c9] text-white rounded-[8px] p-5">
          <div className="flex items-center gap-2 font-display text-[20px] font-bold mb-2">
            <Scale className="w-5 h-5" />
            3. Article 6.2 Double-Entry Bridge
          </div>
          <p className="text-[14px] text-white/95 leading-[21px]">
            Prevents cross-border double counting between host nations (India ICM, Uganda, Brazil, Indonesia, Kenya) and buyer jurisdictions (Switzerland, Singapore, Japan) by executing atomic Corresponding Adjustments on both national NDC ledgers.
          </p>
        </div>
      </div>

      {/* Stoichiometric Verification Formula Strip */}
      <div className="bg-white border border-[#e5e7eb] rounded-[8px] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[14px] font-semibold text-[#5486bd]">
            <GitBranch className="w-4 h-4" />
            OpenCanopy Stoichiometric Verification Equation (v2.4.0-protocol)
          </div>
          <p className="text-[14px] text-[#36526a]">
            Used across the live simulator, registry table, and on-chain ECDSA validator:
          </p>
        </div>
        <div className="font-mono text-[13px] bg-[#f5f7f7] border border-[#e5e7eb] rounded-[8px] px-4 py-3 text-[#273239]">
          Net_tCO2e = Area_ha × max(0, AGBD_GEDI - AGBD_Base) × 0.47 × (44/12) × Mod_S2_OCO2 × (1 - Buffer%)
        </div>
      </div>
    </div>
  );
};
