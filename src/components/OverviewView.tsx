import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowRight, FileSpreadsheet, Plus } from 'lucide-react';
import type {
  ActiveNavSection,
  AircraftHoursSummary,
  AircraftRecord,
  BroughtForwardBaseline,
  ConnectedSheetConfig,
  FlightEntry,
  LogbookTotals,
  YearlyHoursSummary,
} from '../types/logbook';
import {
  formatDisplayDate,
  formatHHMM,
  formatShortSheetDate,
} from '../utils/flightMath';

import type { ThemeMode } from '../utils/theme';

interface OverviewViewProps {
  pilotName: string;
  totals: LogbookTotals;
  aircraftList: AircraftRecord[];
  aircraftBreakdown: AircraftHoursSummary[];
  yearlyBreakdown: YearlyHoursSummary[];
  recentFlights: FlightEntry[];
  baseline: BroughtForwardBaseline | null;
  connectedSheet: ConnectedSheetConfig | null;
  theme?: ThemeMode;
  onNavigate: (section: ActiveNavSection) => void;
  onOpenNewFlight: () => void;
  onSelectFlight: (flight: FlightEntry) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  pilotName,
  totals,
  aircraftList,
  aircraftBreakdown,
  yearlyBreakdown,
  recentFlights,
  baseline,
  connectedSheet,
  theme = 'light',
  onNavigate,
  onOpenNewFlight,
  onSelectFlight,
}) => {
  const isDark = theme === 'dark';
  const maxAircraftMinutes = Math.max(1, ...aircraftBreakdown.map((a) => a.totalMinutes));

  const getCombinedMarks = (ac: AircraftHoursSummary): string[] => {
    const rec = aircraftList.find(
      (item) => item.type.toUpperCase() === ac.aircraftType.toUpperCase()
    );
    return Array.from(new Set([...(rec?.marks ?? []), ...ac.marks])).sort();
  };

  return (
    <div className="space-y-6">
      {/* Pilot Identity Strip mirroring Pilot_Logbook_AppSheet header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4 dark:border-slate-800">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Pilot Flight Logbook — {pilotName}
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            First flight {totals.firstFlightDate ? formatDisplayDate(totals.firstFlightDate) : '—'}
            <span className="mx-1.5 text-slate-300 dark:text-slate-600">·</span>
            Last flight {totals.lastFlightDate ? formatDisplayDate(totals.lastFlightDate) : '—'}
            <span className="mx-1.5 text-slate-300 dark:text-slate-600">·</span>
            {connectedSheet
              ? `Synced with ${connectedSheet.spreadsheetTitle} (${connectedSheet.sheetName})`
              : baseline
                ? `Real sheet totals loaded (${totals.flightCountInclSim} total incl. sim)`
                : `${totals.flightCountInclSim} logged entries`}
          </p>
        </div>

        {!connectedSheet && (
          <button
            type="button"
            onClick={() => onNavigate('import')}
            className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-blue-700 dark:text-blue-400" aria-hidden="true" />
            Connect Full Flights Sheet
            <ArrowRight className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Primary KPI Grid — Row 1: Flight Hours (HH:MM) */}
      <section aria-label="Flight hours summary">
        <div className="grid grid-cols-2 gap-px bg-slate-200 border border-slate-200 sm:grid-cols-3 lg:grid-cols-6 rounded-xl overflow-hidden dark:bg-slate-800 dark:border-slate-800">
          <div className="bg-white p-4 dark:bg-slate-900">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Total Flight Hours</p>
            <p
              className="mt-1.5 font-mono text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums"
              data-testid="kpi-total-hours"
            >
              {formatHHMM(totals.totalMinutes)}
            </p>
            <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
              {formatHHMM(totals.totalMinutesInclSim)} incl. sim
            </p>
          </div>

          <div className="bg-white p-4 dark:bg-slate-900">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Dual Received</p>
            <p
              className="mt-1.5 font-mono text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums"
              data-testid="kpi-dual-hours"
            >
              {formatHHMM(totals.dualMinutes)}
            </p>
            <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
              {totals.totalMinutes > 0
                ? `${Math.round((totals.dualMinutes / totals.totalMinutes) * 100)}% of flight time`
                : '—'}
            </p>
          </div>

          <div className="bg-white p-4 dark:bg-slate-900">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">PIC / Solo</p>
            <p
              className="mt-1.5 font-mono text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums"
              data-testid="kpi-solo-hours"
            >
              {formatHHMM(totals.soloMinutes)}
            </p>
            <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
              {totals.totalMinutes > 0
                ? `${Math.round((totals.soloMinutes / totals.totalMinutes) * 100)}% of flight time`
                : '—'}
            </p>
          </div>

          <div className="bg-white p-4 dark:bg-slate-900">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Jet Hours</p>
            <p
              className="mt-1.5 font-mono text-2xl font-semibold tracking-tight text-blue-700 dark:text-blue-400 tabular-nums"
              data-testid="kpi-jet-hours"
            >
              {formatHHMM(totals.jetMinutes)}
            </p>
            <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
              K8-E · L-39ZA · A-JET
            </p>
          </div>

          <div className="bg-white p-4 dark:bg-slate-900">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Night</p>
            <p className="mt-1.5 font-mono text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">
              {formatHHMM(totals.nightMinutes)}
            </p>
            <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
              Logged night hours
            </p>
          </div>

          <div className="bg-white p-4 dark:bg-slate-900">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Simulator</p>
            <p className="mt-1.5 font-mono text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">
              {formatHHMM(totals.simulatorMinutes)}
            </p>
            <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
              DA-40 FSTD
            </p>
          </div>
        </div>
      </section>

      {/* Operational Counters — Row 2 */}
      <section aria-label="Operational counters">
        <div className="grid grid-cols-2 gap-px bg-slate-200 border border-slate-200 sm:grid-cols-3 lg:grid-cols-6 rounded-xl overflow-hidden dark:bg-slate-800 dark:border-slate-800">
          <div className="bg-white px-4 py-3.5 dark:bg-slate-900">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Flights</p>
            <p className="mt-1 font-mono text-xl font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
              {totals.flightCount}
            </p>
          </div>

          <div className="bg-white px-4 py-3.5 dark:bg-slate-900">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Take-offs</p>
            <p className="mt-1 font-mono text-xl font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
              {totals.takeoffs}
            </p>
          </div>

          <div className="bg-white px-4 py-3.5 dark:bg-slate-900">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Landings</p>
            <p className="mt-1 font-mono text-xl font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
              {totals.landings}
            </p>
          </div>

          <div className="bg-white px-4 py-3.5 dark:bg-slate-900">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Instrument</p>
            <p className="mt-1 font-mono text-xl font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
              {formatHHMM(totals.instrumentMinutes)}
            </p>
          </div>

          <div className="bg-white px-4 py-3.5 dark:bg-slate-900">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Inst. Approaches</p>
            <p className="mt-1 font-mono text-xl font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
              {totals.approaches}
            </p>
          </div>

          <div className="bg-white px-4 py-3.5 dark:bg-slate-900">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Days Since Last Flight</p>
            <p className="mt-1 font-mono text-xl font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
              {totals.daysSinceLastFlight ?? '—'}
            </p>
          </div>
        </div>
      </section>

      {/* Charts & Breakdown Split: Hours by Year + Hours by Aircraft Type */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Hours by Year (Chart + Table matching sheet) */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-6 space-y-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Hours by Year</h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Dual received vs PIC / Solo hours across flying years
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-300">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-xs bg-blue-600 dark:bg-blue-500" aria-hidden="true" />
                Dual
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-xs bg-slate-900 dark:bg-slate-300" aria-hidden="true" />
                Solo / PIC
              </span>
            </div>
          </div>

          <div className="h-52 w-full" data-testid="yearly-hours-chart">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart
                data={yearlyBreakdown}
                margin={{ top: 6, right: 8, left: -16, bottom: 0 }}
                barCategoryGap="24%"
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke={isDark ? '#1e293b' : '#e2e8f0'}
                />
                <XAxis
                  dataKey="year"
                  tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b', fontFamily: 'IBM Plex Mono' }}
                  axisLine={{ stroke: isDark ? '#334155' : '#e2e8f0' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b', fontFamily: 'IBM Plex Mono' }}
                  axisLine={false}
                  tickLine={false}
                  unit="h"
                />
                <Tooltip
                  cursor={{ fill: isDark ? 'rgba(51, 65, 85, 0.35)' : '#f1f5f9' }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    return (
                      <div
                        className={`rounded-lg border px-3 py-2 font-mono text-xs shadow-md ${
                          isDark
                            ? 'border-slate-700 bg-slate-900 text-slate-100'
                            : 'border-slate-200 bg-white text-slate-900'
                        }`}
                      >
                        <p
                          className={`mb-1.5 font-semibold ${
                            isDark ? 'text-white' : 'text-slate-900'
                          }`}
                        >
                          {label}
                        </p>
                        <div className="space-y-1">
                          {payload.map((entry) => {
                            const isDual = entry.dataKey === 'dualHoursChart';
                            const swatchClass = isDual
                              ? isDark
                                ? 'bg-blue-500'
                                : 'bg-blue-600'
                              : isDark
                                ? 'bg-slate-300'
                                : 'bg-slate-900';
                            const seriesLabel = isDual ? 'Dual' : 'Solo / PIC';
                            return (
                              <div
                                key={String(entry.dataKey)}
                                className="flex items-center justify-between gap-4 tabular-nums"
                              >
                                <span
                                  className={`inline-flex items-center gap-1.5 ${
                                    isDark ? 'text-slate-300' : 'text-slate-600'
                                  }`}
                                >
                                  <span
                                    className={`h-2.5 w-2.5 shrink-0 rounded-xs ${swatchClass}`}
                                    aria-hidden="true"
                                  />
                                  {seriesLabel}
                                </span>
                                <span
                                  className={`font-semibold ${
                                    isDark ? 'text-white' : 'text-slate-900'
                                  }`}
                                >
                                  {Number(entry.value ?? 0).toFixed(1)} hrs
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="dualHoursChart"
                  name="Dual"
                  stackId="yr"
                  fill={isDark ? '#3b82f6' : '#2563eb'}
                  radius={[0, 0, 2, 2]}
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="soloHoursChart"
                  name="Solo / PIC"
                  stackId="yr"
                  fill={isDark ? '#cbd5e1' : '#0f172a'}
                  radius={[3, 3, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="overflow-x-auto border-t border-slate-100 pt-3 dark:border-slate-800">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="py-2 pr-3">Year</th>
                  <th className="py-2 px-2 text-right">Flights</th>
                  <th className="py-2 px-2 text-right">Landings</th>
                  <th className="py-2 px-2 text-right">Dual</th>
                  <th className="py-2 px-2 text-right">Solo</th>
                  <th className="py-2 pl-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono tabular-nums dark:divide-slate-800/80">
                {yearlyBreakdown.map((yr) => (
                  <tr key={yr.year} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/60">
                    <td className="py-2 pr-3 font-semibold text-slate-900 dark:text-slate-100">{yr.year}</td>
                    <td className="py-2 px-2 text-right text-slate-600 dark:text-slate-400">{yr.flights}</td>
                    <td className="py-2 px-2 text-right text-slate-600 dark:text-slate-400">{yr.landings}</td>
                    <td className="py-2 px-2 text-right text-slate-700 dark:text-slate-300">
                      {formatHHMM(yr.dualMinutes)}
                    </td>
                    <td className="py-2 px-2 text-right text-slate-700 dark:text-slate-300">
                      {formatHHMM(yr.soloMinutes)}
                    </td>
                    <td className="py-2 pl-2 text-right font-semibold text-slate-900 dark:text-slate-100">
                      {formatHHMM(yr.totalMinutes)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Hours by Aircraft Type (Matching Sheet Table + Bars) */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-6 space-y-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Hours by Aircraft Type</h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Single engine, jet engine, and simulator totals in HH:MM
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('fleet')}
              className="text-xs font-medium text-blue-700 hover:underline whitespace-nowrap shrink-0 dark:text-blue-400"
            >
              Fleet details
            </button>
          </div>

          <div className="space-y-3">
            {aircraftBreakdown.map((ac) => {
              const widthPct = Math.max(4, Math.round((ac.totalMinutes / maxAircraftMinutes) * 100));
              const marks = getCombinedMarks(ac);
              const barColor =
                ac.engineCategory === 'JET ENGINE'
                  ? 'bg-blue-600 dark:bg-blue-500'
                  : ac.engineCategory === 'SIMULATOR'
                    ? 'bg-slate-400 dark:bg-slate-500'
                    : 'bg-slate-800 dark:bg-slate-300';
              return (
                <div key={ac.aircraftType} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2 text-xs">
                    <div className="truncate">
                      <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                        {ac.aircraftType}
                      </span>
                      <span className="mx-1.5 text-slate-300 dark:text-slate-600">·</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">{ac.engineCategory}</span>
                      {marks.length > 0 && (
                        <>
                          <span className="mx-1.5 text-slate-300 dark:text-slate-600">·</span>
                          <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300">
                            {marks.join(', ')}
                          </span>
                        </>
                      )}
                    </div>
                    <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums shrink-0">
                      {formatHHMM(ac.totalMinutes)}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className={`h-full rounded-full ${barColor}`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="overflow-x-auto border-t border-slate-100 pt-3 dark:border-slate-800">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="py-2 pr-3">Aircraft</th>
                  <th className="py-2 px-2">Engine</th>
                  <th className="py-2 px-2 text-right">Flts</th>
                  <th className="py-2 px-2 text-right">T/O</th>
                  <th className="py-2 px-2 text-right">Ldg</th>
                  <th className="py-2 pl-2 text-right">Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {aircraftBreakdown.map((ac) => {
                  const marks = getCombinedMarks(ac);
                  return (
                    <tr key={ac.aircraftType} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/60">
                      <td className="py-2 pr-3 whitespace-nowrap">
                        <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                          {ac.aircraftType}
                        </span>
                        {marks.length > 0 && (
                          <div className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                            {marks.join(', ')}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-2 text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {ac.engineCategory}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-slate-600 dark:text-slate-400 tabular-nums">
                        {ac.flights}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-slate-600 dark:text-slate-400 tabular-nums">
                        {ac.takeoffs}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-slate-600 dark:text-slate-400 tabular-nums">
                        {ac.landings}
                      </td>
                      <td className="py-2 pl-2 text-right font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                        {formatHHMM(ac.totalMinutes)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 font-mono text-xs font-semibold text-slate-900 dark:border-slate-700 dark:text-slate-100">
                  <td colSpan={2} className="py-2.5 pr-3 font-sans text-xs text-slate-700 dark:text-slate-300">
                    Total (incl. simulator)
                  </td>
                  <td className="py-2.5 px-2 text-right tabular-nums">
                    {totals.flightCountInclSim}
                  </td>
                  <td className="py-2.5 px-2 text-right tabular-nums">
                    {totals.takeoffsInclSim}
                  </td>
                  <td className="py-2.5 px-2 text-right tabular-nums">
                    {totals.landingsInclSim}
                  </td>
                  <td className="py-2.5 pl-2 text-right tabular-nums">
                    {formatHHMM(totals.totalMinutesInclSim)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      </div>

      {/* Recent Flights Table (Exact Columns from Pilot AJI's Sheet) */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-2 border-b border-slate-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Recent Flights</h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Latest sorties logged — click any flight to inspect or edit details
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => onNavigate('logbook')}
              className="text-xs font-medium text-blue-700 hover:underline whitespace-nowrap shrink-0 dark:text-blue-400"
            >
              Open full ledger ({recentFlights.length} rows)
            </button>
          </div>
        </div>

        {recentFlights.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">No individual flights loaded yet</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Log a flight or import your Flights tab from Google Sheets.
            </p>
            <button
              type="button"
              onClick={onOpenNewFlight}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800"
            >
              <Plus className="h-3.5 w-3.5" />
              Log Flight
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[740px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
                  <th className="px-6 py-2.5">Date</th>
                  <th className="px-4 py-2.5">Aircraft</th>
                  <th className="px-4 py-2.5">Mark</th>
                  <th className="px-4 py-2.5">Instructor</th>
                  <th className="px-4 py-2.5">Exercise</th>
                  <th className="px-4 py-2.5">Type</th>
                  <th className="px-4 py-2.5 text-right">Landings</th>
                  <th className="px-6 py-2.5 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {recentFlights.slice(0, 10).map((f) => (
                  <tr
                    key={f.id}
                    onClick={() => onSelectFlight(f)}
                    className="cursor-pointer transition-colors hover:bg-blue-50/40 dark:hover:bg-blue-950/30"
                  >
                    <td className="px-6 py-3 font-mono text-slate-700 dark:text-slate-300 tabular-nums whitespace-nowrap">
                      {formatShortSheetDate(f.date)}
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {f.aircraftType}
                    </td>
                    <td
                      className={`px-4 py-3 font-mono whitespace-nowrap ${
                        f.aircraftMark ? 'font-medium text-slate-800 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      {f.aircraftMark || '—'}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {f.instructor || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-800 dark:text-slate-200">{f.exercise}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {f.flightType}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700 dark:text-slate-300 tabular-nums">
                      {f.landings}
                    </td>
                    <td className="px-6 py-3 text-right font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                      {formatHHMM(f.totalMinutes)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
