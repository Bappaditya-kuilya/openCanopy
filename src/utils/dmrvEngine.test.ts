import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateSatelliteDmrv,
  executeCrossBorderSettlement,
  computeTelemetryHash,
  calculateGeodesicAreaHa,
  reconcileRegistryTransactions,
  type SatelliteTelemetryInput,
  type CarbonProject,
  type BilateralLedgerEntry,
} from './dmrvEngine';

const kachungTelemetry: SatelliteTelemetryInput = {
  gediAgbdMgHa: 94.5,
  sentinelNdvi: 0.49,
  canopyCoverPct: 52.0,
  oco2DeltaPpm: -0.45,
  projectAreaHa: 2479,
  baselineAgbdMgHa: 48.0,
  bufferPoolPct: 15,
};

test('evaluateSatelliteDmrv detects over-crediting discrepancy on Kachung CDM-4653 style baseline', () => {
  const claimedCredits = 298000;
  const result = evaluateSatelliteDmrv(kachungTelemetry, claimedCredits);

  assert.equal(result.netBiomassGainMgHa, 46.5);
  assert.ok(result.verifiedIssuableTco2e < claimedCredits, 'Verified credits should be less than inflated claim');
  assert.ok(result.overCreditingDiscrepancyPct > 25, 'Should flag high over-crediting percentage');
  assert.equal(result.status, 'Critical');
  assert.ok(result.telemetryProofHash.startsWith('0x'));
});

test('evaluateSatelliteDmrv marks high-biomass Sundarbans mangrove corridor as Nominal', () => {
  const sundarbansTelemetry: SatelliteTelemetryInput = {
    gediAgbdMgHa: 186.0,
    sentinelNdvi: 0.78,
    canopyCoverPct: 84.0,
    oco2DeltaPpm: -1.65,
    projectAreaHa: 4120,
    baselineAgbdMgHa: 72.0,
    bufferPoolPct: 12,
  };

  const result = evaluateSatelliteDmrv(sundarbansTelemetry, 725000);
  assert.equal(result.status, 'Nominal');
  assert.ok(result.overCreditingDiscrepancyPct <= 8);
});

test('computeTelemetryHash is deterministic and changes when sensor parameters change', () => {
  const hashA = computeTelemetryHash(kachungTelemetry, 100000);
  const hashB = computeTelemetryHash(kachungTelemetry, 100000);
  const hashC = computeTelemetryHash({ ...kachungTelemetry, sentinelNdvi: 0.81 }, 100000);

  assert.equal(hashA, hashB);
  assert.notEqual(hashA, hashC);
});

test('executeCrossBorderSettlement enforces Article 6.2 Corresponding Adjustments between India and Switzerland', () => {
  const project: CarbonProject = {
    id: 'prj-ind-01',
    registryId: 'ICM-IND-8821',
    name: 'Sundarbans Blue Carbon & Mangrove Restoration',
    country: 'India',
    isoCode: 'IND',
    regionLabel: 'South Asia · West Bengal',
    coordinates: { lat: 21.9497, lon: 89.1833 },
    standard: 'ICM (India)',
    methodology: 'VM0033 Tidal Wetland & Seagrass Restoration',
    vintageYear: 2026,
    claimedCreditsTco2e: 725000,
    verifiedCreditsTco2e: 718400,
    retiredCreditsTco2e: 118400,
    unitPriceUsd: 28.5,
    article6Authorized: true,
    telemetry: kachungTelemetry,
    status: 'Nominal',
    lastAuditTimestamp: '2026-10-24T14:20:00Z',
    onChainTokenId: 'ORBIT-718-IND',
    timeSeries: [],
    spatialMatrix: [[1]],
  };

  const initialLedger: BilateralLedgerEntry[] = [
    {
      countryIso: 'IND',
      countryName: 'India (CCTS / ICM)',
      ndcTargetMtCo2e: 1250,
      domesticVerifiedPoolTco2e: 1500000,
      exportedItmosTco2e: 100000,
      importedItmosTco2e: 0,
      netAdjustedBalanceTco2e: 1400000,
    },
    {
      countryIso: 'CHE',
      countryName: 'Switzerland (FOEN / KliK)',
      ndcTargetMtCo2e: 380,
      domesticVerifiedPoolTco2e: 420000,
      exportedItmosTco2e: 0,
      importedItmosTco2e: 85000,
      netAdjustedBalanceTco2e: 505000,
    },
  ];

  const { updatedProject, updatedLedger, transaction } = executeCrossBorderSettlement({
    project,
    ledgerEntries: initialLedger,
    acquiringCountryIso: 'CHE',
    volumeTco2e: 50000,
    actionType: 'CROSS_BORDER_ITMO',
    actorEntity: 'Swiss Climate Foundation (KliK)',
    currentBlockHeight: 19402100,
  });

  assert.equal(updatedProject.retiredCreditsTco2e, 168400);
  assert.equal(transaction.correspondingAdjustmentApplied, true);

  const indiaEntry = updatedLedger.find((e) => e.countryIso === 'IND')!;
  const swissEntry = updatedLedger.find((e) => e.countryIso === 'CHE')!;

  assert.equal(indiaEntry.exportedItmosTco2e, 150000);
  assert.equal(indiaEntry.netAdjustedBalanceTco2e, 1350000);
  assert.equal(swissEntry.importedItmosTco2e, 135000);
  assert.equal(swissEntry.netAdjustedBalanceTco2e, 555000);

  // Also verify unauthorized Article 6.2 export is rejected
  assert.throws(() => {
    executeCrossBorderSettlement({
      project: { ...project, article6Authorized: false },
      ledgerEntries: initialLedger,
      acquiringCountryIso: 'CHE',
      volumeTco2e: 10000,
      actionType: 'CROSS_BORDER_ITMO',
      actorEntity: 'Swiss Climate Foundation (KliK)',
      currentBlockHeight: 19402101,
    });
  }, /lacks Host Country Article 6\.2 ITMO Authorization/);
});

test('calculateGeodesicAreaHa computes spherical polygon area in hectares accurately', () => {
  const polygon: Array<[number, number]> = [
    [20.735, 86.84],
    [20.735, 86.89],
    [20.695, 86.89],
    [20.695, 86.84],
  ];
  const areaHa = calculateGeodesicAreaHa(polygon);
  assert.ok(areaHa > 2000 && areaHa < 2600, `Expected ~2300 ha, got ${areaHa}`);
});

test('reconcileRegistryTransactions detects over-crediting and unauthorized cross-border double-counting risks', () => {
  const kachungProject: CarbonProject = {
    id: 'prj-uga-4653',
    registryId: 'CDM-4653',
    name: 'Kachung Central Forest Reserve Afforestation',
    country: 'Uganda',
    isoCode: 'UGA',
    regionLabel: 'East Africa · Lira District',
    coordinates: { lat: 1.9833, lon: 32.9833 },
    standard: 'CDM',
    methodology: 'AR-AM0004',
    vintageYear: 2024,
    claimedCreditsTco2e: 298000,
    verifiedCreditsTco2e: 119162,
    retiredCreditsTco2e: 42000,
    unitPriceUsd: 11.4,
    article6Authorized: false,
    telemetry: kachungTelemetry,
    status: 'Critical',
    lastAuditTimestamp: '2026-10-25T08:42:10Z',
    onChainTokenId: 'OCANOPY-4653-UGA',
    timeSeries: [],
    spatialMatrix: [[0.49]],
  };

  const alerts = reconcileRegistryTransactions([kachungProject], [], []);
  assert.ok(alerts.some((a) => a.category === 'OVER_CREDITING_ANOMALY' && a.severity === 'critical'));
  assert.ok(alerts.some((a) => a.category === 'DOUBLE_COUNTING_RISK' && a.severity === 'critical'));
});

