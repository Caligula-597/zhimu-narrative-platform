import { COMMERCIAL_MECHANISM_BENCHMARKS, runAllCommercialMechanismBenchmarks } from "../shared/commercial-mechanism-benchmarks.js";

const reports = runAllCommercialMechanismBenchmarks({ gamesPerBenchmark: 3, seats: 4 });
console.log(JSON.stringify({
  generatedAt: new Date().toISOString(),
  basis: "official commercial mechanism structures with original names, content and numbers",
  benchmarkCount: COMMERCIAL_MECHANISM_BENCHMARKS.length,
  gameCount: reports.reduce((sum, report) => sum + report.games.length, 0),
  reports
}, null, 2));
