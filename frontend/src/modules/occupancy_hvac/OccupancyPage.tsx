/**
 * Module 1 — Occupancy HVAC & Lighting
 * Includes facility-manager override panel (discretion controls).
 */
import React, { useEffect, useMemo, useState } from "react";
import { useBuilding } from "../../contexts/BuildingContext";
import { useAuth } from "../../contexts/AuthContext";
import {
  fetchOccupancyStatus,
  fetchSavingsHistory,
  overrideRoom,
} from "../../services/occupancyApi";
import { ExplanationTooltip } from "../../components/ExplanationTooltip";
import { BuildingMap } from "../../components/BuildingMap";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Thermometer, Lightbulb, Users, TrendingDown, Shield,
  Settings2, CheckCircle2, Loader2,
} from "lucide-react";
import clsx from "clsx";

interface Room {
  room_id: string;
  name: string;
  floor: string;
  zone?: string;
  occupied: boolean;
  temperature_c: number;
  light_level_pct: number;
  hvac_setpoint_c: number;
  lighting_state: string;
  energy_delta_kwh: number;
  co2_ppm?: number;
  last_occupied_at?: string;
  occupancy_confidence?: number;
}

type OverrideAction = "force_setback" | "force_restore" | "manual_setpoint";

export default function OccupancyPage() {
  const { activeBuilding } = useBuilding();
  const { user } = useAuth();
  const canOverride =
    user?.role === "facility_manager" ||
    user?.role === "super_admin" ||
    user?.role === "maintenance";

  const [status, setStatus] = useState<any>(null);
  const [savings, setSavings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [floorFilter, setFloorFilter] = useState<string>("all");

  // Override panel state
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [action, setAction] = useState<OverrideAction>("force_setback");
  const [setpoint, setSetpoint] = useState(24);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [overrideMsg, setOverrideMsg] = useState<string | null>(null);
  const [overrideErr, setOverrideErr] = useState<string | null>(null);

  const reload = () => {
    if (!activeBuilding) return;
    setLoading(true);
    Promise.all([
      fetchOccupancyStatus(activeBuilding),
      fetchSavingsHistory(activeBuilding),
    ])
      .then(([s, h]) => {
        setStatus(s);
        setSavings(h);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
  }, [activeBuilding]);

  const floors: string[] = useMemo(() => {
    if (!status?.rooms) return [];
    return Array.from(new Set<string>(status.rooms.map((r: Room) => r.floor))).sort();
  }, [status]);

  const filteredRooms: Room[] = useMemo(() => {
    if (!status?.rooms) return [];
    if (floorFilter === "all") return status.rooms;
    return status.rooms.filter((r: Room) => r.floor === floorFilter);
  }, [status, floorFilter]);

  const openOverride = (room: Room) => {
    setSelectedRoom(room);
    setAction(room.occupied ? "force_setback" : "force_restore");
    setSetpoint(room.hvac_setpoint_c || 24);
    setReason("");
    setOverrideMsg(null);
    setOverrideErr(null);
  };

  const submitOverride = async () => {
    if (!activeBuilding || !selectedRoom || !reason.trim()) {
      setOverrideErr("Reason is required for audit trail.");
      return;
    }
    setSubmitting(true);
    setOverrideErr(null);
    setOverrideMsg(null);
    try {
      const res = await overrideRoom(activeBuilding, {
        room_id: selectedRoom.room_id,
        action,
        setpoint_c: action === "manual_setpoint" ? setpoint : undefined,
        reason: reason.trim(),
      });
      setOverrideMsg(res.message || "Override accepted.");
      // Optimistic local update for demo feel
      setStatus((prev: any) => {
        if (!prev) return prev;
        const rooms = prev.rooms.map((r: Room) => {
          if (r.room_id !== selectedRoom.room_id) return r;
          if (action === "force_setback") {
            return {
              ...r,
              occupied: false,
              hvac_setpoint_c: 27,
              lighting_state: "dimmed",
              light_level_pct: 10,
              energy_delta_kwh: -1.5,
            };
          }
          if (action === "force_restore") {
            return {
              ...r,
              occupied: true,
              hvac_setpoint_c: 23,
              lighting_state: "on",
              light_level_pct: 80,
              energy_delta_kwh: 0,
            };
          }
          return { ...r, hvac_setpoint_c: setpoint };
        });
        return { ...prev, rooms };
      });
    } catch (e: any) {
      setOverrideErr(e.message || "Override failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="py-20 text-center text-slate-400">Loading occupancy data…</div>;
  }
  if (error) {
    return (
      <div className="rounded-xl bg-red-50 border border-red-100 p-4 text-red-700 text-sm">{error}</div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
            Occupancy HVAC & Lighting
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            Real-time room control driven by occupancy · Manager overrides with full audit
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg">
          <TrendingDown className="w-4 h-4" />
          <span className="font-medium">{status?.savings_kwh_today} kWh saved today</span>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi icon={<Users className="w-4 h-4" />} label="Occupied" value={`${status?.occupied_rooms}/${status?.total_rooms}`} />
        <Kpi icon={<Thermometer className="w-4 h-4" />} label="In setback" value={status?.setback_rooms} />
        <Kpi icon={<TrendingDown className="w-4 h-4" />} label="Today savings" value={`${status?.savings_kwh_today} kWh`} />
        <Kpi icon={<TrendingDown className="w-4 h-4" />} label="₹ saved" value={`₹${status?.savings_inr_today?.toLocaleString()}`} />
        <Kpi icon={<Shield className="w-4 h-4" />} label="Comfort score" value={`${status?.comfort_score ?? 92}%`} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Floor plan + rooms */}
        <div className="xl:col-span-2 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide mr-2">Floor</span>
            <FilterChip active={floorFilter === "all"} onClick={() => setFloorFilter("all")}>All</FilterChip>
            {floors.map((f) => (
              <FilterChip key={f} active={floorFilter === f} onClick={() => setFloorFilter(String(f))}>
                Floor {f}
              </FilterChip>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredRooms.map((room) => (
              <RoomCard
                key={room.room_id}
                room={room}
                canOverride={canOverride}
                onOverride={() => openOverride(room)}
                selected={selectedRoom?.room_id === room.room_id}
              />
            ))}
          </div>
        </div>

        {/* Manager override panel + map */}
        <div className="space-y-4">
          {canOverride ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Settings2 className="w-4 h-4 text-emerald-700" />
                <h2 className="text-sm font-semibold text-slate-800">Manager override</h2>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                Facility managers can force setback, restore comfort, or set a manual setpoint.
                Every action requires a reason (audit trail).
              </p>

              {!selectedRoom ? (
                <div className="rounded-xl bg-slate-50 border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                  Select a room card to override HVAC / lighting
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl bg-emerald-50/60 border border-emerald-100 px-3 py-2">
                    <p className="text-sm font-medium text-slate-800">{selectedRoom.name}</p>
                    <p className="text-xs text-slate-500">
                      Floor {selectedRoom.floor} · {selectedRoom.occupied ? "Occupied" : "Setback"} ·{" "}
                      {selectedRoom.hvac_setpoint_c}°C
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">Action</label>
                    <select
                      value={action}
                      onChange={(e) => setAction(e.target.value as OverrideAction)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    >
                      <option value="force_setback">Force setback (save energy)</option>
                      <option value="force_restore">Force restore comfort</option>
                      <option value="manual_setpoint">Manual setpoint (°C)</option>
                    </select>
                  </div>

                  {action === "manual_setpoint" && (
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1.5">
                        Setpoint (°C)
                      </label>
                      <input
                        type="number"
                        min={18}
                        max={30}
                        step={0.5}
                        value={setpoint}
                        onChange={(e) => setSetpoint(parseFloat(e.target.value) || 24)}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">
                      Reason (required)
                    </label>
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={3}
                      placeholder="e.g. Client meeting until 6 PM — keep comfort mode"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 resize-none"
                    />
                  </div>

                  {overrideErr && (
                    <div className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{overrideErr}</div>
                  )}
                  {overrideMsg && (
                    <div className="text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {overrideMsg}
                    </div>
                  )}

                  <button
                    onClick={submitOverride}
                    disabled={submitting || !reason.trim()}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium py-2.5 transition"
                  >
                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    {submitting ? "Applying…" : "Apply override"}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 text-sm text-slate-500">
              Override controls are visible only to Facility Managers and Maintenance roles.
            </div>
          )}

          <div>
            <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Site location</h3>
            <BuildingMap buildingId={activeBuilding} height="200px" />
          </div>
        </div>
      </div>

      {/* Charts */}
      {savings && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Daily savings vs fixed schedule
              </h2>
              <span className="text-xs text-emerald-700 font-medium">{savings.savings_pct}% this week</span>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={savings.daily}>
                  <defs>
                    <linearGradient id="savG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#059669" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#059669" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#64748b" }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                  <Area type="monotone" dataKey="baseline_kwh" stroke="#94a3b8" fill="transparent" strokeDasharray="4 4" name="Baseline" />
                  <Area type="monotone" dataKey="kwh" stroke="#059669" fill="url(#savG)" strokeWidth={2} name="Actual kWh" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {savings.by_floor && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-4">
                Savings by floor (kWh today)
              </h2>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={savings.by_floor}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="floor" tick={{ fontSize: 11, fill: "#64748b" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                    <Bar dataKey="kwh_saved" fill="#059669" radius={[6, 6, 0, 0]} name="kWh saved" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3.5">
      <div className="flex items-center gap-1.5 text-slate-500 text-[11px] mb-1">{icon}<span>{label}</span></div>
      <p className="text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "rounded-full px-3 py-1 text-xs font-medium transition",
        active ? "bg-emerald-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"
      )}
    >
      {children}
    </button>
  );
}

function RoomCard({
  room,
  canOverride,
  onOverride,
  selected,
}: {
  room: Room;
  canOverride: boolean;
  onOverride: () => void;
  selected: boolean;
}) {
  return (
    <div
      className={clsx(
        "rounded-xl border p-4 transition",
        selected ? "border-emerald-400 ring-2 ring-emerald-500/20" : room.occupied ? "bg-white border-slate-200" : "bg-emerald-50/40 border-emerald-100"
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="font-medium text-slate-800 text-sm">{room.name}</p>
          <p className="text-xs text-slate-500">
            Floor {room.floor}
            {room.zone ? ` · ${room.zone}` : ""}
          </p>
        </div>
        <span
          className={clsx(
            "text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full",
            room.occupied ? "bg-slate-100 text-slate-600" : "bg-emerald-100 text-emerald-700"
          )}
        >
          {room.occupied ? "Occupied" : "Setback"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 mt-3">
        <div className="flex items-center gap-1.5">
          <Thermometer className="w-3.5 h-3.5" />
          {room.temperature_c}°C → {room.hvac_setpoint_c}°C
        </div>
        <div className="flex items-center gap-1.5">
          <Lightbulb className="w-3.5 h-3.5" />
          {room.lighting_state} ({room.light_level_pct}%)
        </div>
        {room.co2_ppm != null && (
          <div className="col-span-2 text-slate-500">CO₂ {room.co2_ppm} ppm</div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        {!room.occupied && room.energy_delta_kwh < 0 ? (
          <span className="text-xs text-emerald-700 font-medium">
            {Math.abs(room.energy_delta_kwh).toFixed(1)} kWh saved
          </span>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          {!room.occupied && (
            <ExplanationTooltip
              plainEnglish="Setback applied because room has been empty and historical occupancy at this hour is low."
              topFeatures={[
                { feature: "minutes_empty", contribution: 0.61 },
                { feature: "historical_occupancy", contribution: 0.28 },
              ]}
            />
          )}
          {canOverride && (
            <button
              onClick={onOverride}
              className="text-xs font-medium text-emerald-700 hover:text-emerald-900 underline-offset-2 hover:underline"
            >
              Override
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
