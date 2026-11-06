/**
 * Mantiq machinery icon set: 24x24 stroke icons drawn for an industrial theme.
 * Parts with class "spin-part" rotate on hover of the nearest `.group`.
 */
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 20, children, ...rest }: P & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

const gearPath =
  "M12 2.8l1.3 2.1 2.4-.6.6 2.4 2.1 1.3-1 2.2 1 2.2-2.1 1.3-.6 2.4-2.4-.6L12 21.2l-1.3-2.1-2.4.6-.6-2.4-2.1-1.3 1-2.2-1-2.2 2.1-1.3.6-2.4 2.4.6z";

export const GearIcon = (p: P) => (
  <Svg {...p}>
    <g className="spin-part">
      <path d={gearPath} />
      <circle cx="12" cy="12" r="3.2" />
    </g>
  </Svg>
);

/** Settings: three sliders, so it never looks like the brand mark. */
export const SlidersIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" />
    <circle cx="15" cy="6" r="2" />
    <circle cx="9" cy="12" r="2" />
    <circle cx="17" cy="18" r="2" />
  </Svg>
);

/** Brand mark: five voice-waveform bars whose outline reads as an "M". */
export const MantiqMark = ({ size = 20, ...rest }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...rest}>
    <rect x="2.5" y="3.5" width="3" height="17" rx="1.5" />
    <rect x="6.75" y="7.5" width="3" height="13" rx="1.5" />
    <rect x="10.5" y="11.5" width="3" height="9" rx="1.5" />
    <rect x="14.25" y="7.5" width="3" height="13" rx="1.5" />
    <rect x="18.5" y="3.5" width="3" height="17" rx="1.5" />
  </svg>
);

export const GearsIcon = (p: P) => (
  <Svg {...p}>
    <g className="spin-part">
      <path d="M8.5 4.5l.8 1.4 1.6-.3.3 1.6 1.4.8-.6 1.5.6 1.5-1.4.8-.3 1.6-1.6-.3-.8 1.4-.8-1.4-1.6.3-.3-1.6-1.4-.8.6-1.5-.6-1.5 1.4-.8.3-1.6 1.6.3z" />
      <circle cx="8.5" cy="9.5" r="1.8" />
    </g>
    <path d="M16.5 12.5l.6 1 1.2-.2.2 1.2 1 .6-.4 1.1.4 1.1-1 .6-.2 1.2-1.2-.2-.6 1-.6-1-1.2.2-.2-1.2-1-.6.4-1.1-.4-1.1 1-.6.2-1.2 1.2.2z" />
    <circle cx="16.5" cy="16.2" r="1.3" />
  </Svg>
);

export const MotorIcon = (p: P) => (
  <Svg {...p}>
    <rect x="4" y="7" width="12" height="10" rx="2" />
    <path d="M7 7v10M10 7v10M13 7v10" opacity=".55" />
    <path d="M16 12h5" />
    <circle cx="21" cy="12" r=".6" fill="currentColor" />
    <path d="M5 17v2.5h10V17" />
    <path d="M8 4.5h4V7H8z" />
  </Svg>
);

export const PumpIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="10" cy="13" r="6" />
    <g className="spin-part">
      <path d="M10 13l3.5-2M10 13l-1 4M10 13l-3-2.5" />
    </g>
    <path d="M16 13h4v-3M10 7V3h4" />
    <path d="M5 20h10" />
  </Svg>
);

export const ConveyorIcon = (p: P) => (
  <Svg {...p}>
    <rect x="2.5" y="12" width="19" height="5" rx="2.5" />
    <circle cx="5" cy="14.5" r="1.2" />
    <circle cx="12" cy="14.5" r="1.2" />
    <circle cx="19" cy="14.5" r="1.2" />
    <rect x="5" y="7" width="5" height="5" rx=".6" />
    <rect x="12.5" y="8.5" width="4" height="3.5" rx=".6" />
    <path d="M5 17v3M19 17v3" />
  </Svg>
);

export const CompressorIcon = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="10" width="13" height="7" rx="3.5" />
    <path d="M6 10V7h5v3" />
    <circle cx="19" cy="9" r="2.6" />
    <path d="M19 9l1.2-1" />
    <path d="M16 13.5h1.5V11.5" />
    <path d="M4.5 17v2.5M14.5 17v2.5" />
  </Svg>
);

export const BearingIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="4" />
    <g className="spin-part">
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <circle
          key={a}
          cx={12 + 6.5 * Math.cos((a * Math.PI) / 180)}
          cy={12 + 6.5 * Math.sin((a * Math.PI) / 180)}
          r="1.3"
        />
      ))}
    </g>
  </Svg>
);

export const WrenchIcon = (p: P) => (
  <Svg {...p}>
    <path d="M14.7 6.3a4 4 0 0 0 5 5L12 19a2.1 2.1 0 0 1-3-3z" />
    <path d="M14.7 6.3a4 4 0 0 1 5-2.2l-2.5 2.5.4 2 2 .4 2.5-2.5a4 4 0 0 1-2.2 5" />
    <circle cx="10.5" cy="17.5" r=".6" fill="currentColor" />
  </Svg>
);

export const ValveIcon = (p: P) => (
  <Svg {...p}>
    <path d="M3 12h4l5-4v8l-5-4M21 12h-4l-5-4v8l5-4" />
    <path d="M12 8V4M9 4h6" />
  </Svg>
);

export const FactoryIcon = (p: P) => (
  <Svg {...p}>
    <path d="M3 20V10l5 3V10l5 3V10l5 3V4h3v16z" />
    <path d="M7 16.5h2M12 16.5h2M17 16.5h2" />
  </Svg>
);

export const GaugeIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4.5 17a8.5 8.5 0 1 1 15 0" />
    <path d="M12 13l4-4" />
    <circle cx="12" cy="13" r="1.4" />
    <path d="M7 10.5l1 .6M12 6.5V8M17 10.5l-1 .6" opacity=".6" />
    <path d="M8 19h8" />
  </Svg>
);

export const MicIcon = (p: P) => (
  <Svg {...p}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6" />
  </Svg>
);

export const WaveIcon = (p: P) => (
  <Svg {...p}>
    <path d="M3 12h2M7 8v8M11 5v14M15 9v6M19 7v10M21 12h0" />
  </Svg>
);

export const MemoryIcon = (p: P) => (
  <Svg {...p}>
    <ellipse cx="12" cy="5.5" rx="7" ry="2.5" />
    <path d="M5 5.5v6c0 1.4 3.1 2.5 7 2.5M19 5.5v4" />
    <path d="M5 11.5v6c0 1.4 3.1 2.5 7 2.5" />
    <g className="spin-part">
      <path d="M17.5 13.2l.5.9 1-.2.2 1 .9.5-.4.9.4.9-.9.5-.2 1-1-.2-.5.9-.5-.9-1 .2-.2-1-.9-.5.4-.9-.4-.9.9-.5.2-1 1 .2z" />
    </g>
    <circle cx="17.5" cy="16.5" r="1" />
  </Svg>
);

export const IncidentIcon = (p: P) => (
  <Svg {...p}>
    <path d="M10.3 3.9L2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    <path d="M12 9v4.5M12 17h0" />
  </Svg>
);

export const SearchBoltIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="M15.5 15.5L21 21" />
    <path d="M11 6.8l-2 4h3l-2 4" />
  </Svg>
);

export const ShieldIcon = (p: P) => (
  <Svg {...p}>
    <path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.3-7.5 9.5-4.3-1.2-7.5-4.9-7.5-9.5V6z" />
    <path d="M9 12l2 2 4-4" />
  </Svg>
);

export const FlameIcon = (p: P) => (
  <Svg {...p}>
    <path d="M12 21c-3.9 0-6.5-2.6-6.5-6 0-3.5 3-5.5 3.5-9 2 1.3 3 3 3.2 4.6 1-.6 1.8-1.9 1.8-3.6 2.4 1.8 4.5 4.8 4.5 8 0 3.4-2.6 6-6.5 6z" />
  </Svg>
);

export const DropIcon = (p: P) => (
  <Svg {...p}>
    <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />
    <path d="M9.5 15a2.5 2.5 0 0 0 2.5 2.5" opacity=".6" />
  </Svg>
);

export const VibrationIcon = (p: P) => (
  <Svg {...p}>
    <rect x="8" y="5" width="8" height="14" rx="1.5" />
    <path d="M4 8l-2 2 2 2-2 2 2 2M20 8l2 2-2 2 2 2-2 2" />
  </Svg>
);

export const NoiseIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 10v4h3l4 3.5v-11L7 10z" />
    <path d="M15 9.5a3.5 3.5 0 0 1 0 5M17.5 7a7 7 0 0 1 0 10" />
  </Svg>
);

export const BoltIcon = (p: P) => (
  <Svg {...p}>
    <path d="M13 2.5L4.5 13.5H11l-1 8 8.5-11H12z" />
  </Svg>
);

export const SmokeIcon = (p: P) => (
  <Svg {...p}>
    <path d="M7 18c-2.2 0-3.5-1.4-3.5-3.2 0-1.7 1.3-3 3-3.1.3-2.6 2.4-4.4 5-4.4 2.3 0 4.3 1.5 4.9 3.6 2 .1 3.6 1.6 3.6 3.6S18.4 18 16.4 18z" />
    <path d="M9 21h6M8 4.5c1-.8 2-.8 3 0s2 .8 3 0" opacity=".6" />
  </Svg>
);

export const StopIcon = (p: P) => (
  <Svg {...p}>
    <path d="M8.2 3h7.6L21 8.2v7.6L15.8 21H8.2L3 15.8V8.2z" />
    <path d="M9 9h6v6H9z" />
  </Svg>
);

export const CrackIcon = (p: P) => (
  <Svg {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="2" />
    <path d="M9 3.5l2 5-3 3 4 3-1 6M14 8.5l3 1.5" />
  </Svg>
);

export const SpeedIcon = (p: P) => (
  <Svg {...p}>
    <path d="M3 13a9 9 0 0 1 18 0" />
    <path d="M12 13l-3.5-4" />
    <path d="M3 17h4M17 17h4M9 20h6" opacity=".6" />
  </Svg>
);

export const OilIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 10h9l3-2 4 1-6 7H4z" />
    <path d="M7 10V8h3v2M20 13.5c0 1-.6 1.8-1.3 1.8s-1.2-.8-1.2-1.8.8-2 1.3-2.5c.4.5 1.2 1.5 1.2 2.5z" />
  </Svg>
);

export const SirenIcon = (p: P) => (
  <Svg {...p}>
    <path d="M6 18v-5a6 6 0 0 1 12 0v5" />
    <path d="M4 18h16v2.5H4zM12 3v2M4.6 5.6l1.4 1.4M19.4 5.6L18 7" />
    <path d="M10 13a2 2 0 0 1 2-2" opacity=".6" />
  </Svg>
);

export const UsersIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
    <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14a6.5 6.5 0 0 1 3 6" />
  </Svg>
);

export const PlusIcon = (p: P) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
export const CheckIcon = (p: P) => (
  <Svg {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Svg>
);
export const XIcon = (p: P) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);
export const ChevronRight = (p: P) => (
  <Svg {...p}>
    <path d="M9 5l7 7-7 7" />
  </Svg>
);
export const ArrowLeft = (p: P) => (
  <Svg {...p}>
    <path d="M19 12H5M11 18l-6-6 6-6" />
  </Svg>
);
export const UploadIcon = (p: P) => (
  <Svg {...p}>
    <path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
  </Svg>
);
export const DownloadIcon = (p: P) => (
  <Svg {...p}>
    <path d="M12 4v12M7 11l5 5 5-5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
  </Svg>
);
export const PlayIcon = (p: P) => (
  <Svg {...p}>
    <path d="M7 4.5v15l12-7.5z" />
  </Svg>
);
export const SpeakerIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 10v4h3l5 4V6l-5 4z" />
    <path d="M16 9a4.5 4.5 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" />
  </Svg>
);
export const TrashIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />
  </Svg>
);
export const EditIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 20h4L19 9l-4-4L4 16z" />
    <path d="M13.5 6.5l4 4" />
  </Svg>
);
export const RefreshIcon = (p: P) => (
  <Svg {...p}>
    <path d="M20 11a8 8 0 0 0-14.6-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.6 4.5L20 16M20 20v-4h-4" />
  </Svg>
);
export const ClockIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
);
export const LogoutIcon = (p: P) => (
  <Svg {...p}>
    <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10" />
  </Svg>
);
export const LinkIcon = (p: P) => (
  <Svg {...p}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </Svg>
);
export const GlobeIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
  </Svg>
);
export const ChatIcon = (p: P) => (
  <Svg {...p}>
    <path d="M5 5h14a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 17h-7l-4.5 3.5V17H5a1.5 1.5 0 0 1-1.5-1.5v-9A1.5 1.5 0 0 1 5 5z" />
    <path d="M8 10h8M8 13h5" />
  </Svg>
);
export const SendIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 12l16-7-6 16-3-6.5z" />
    <path d="M11 14.5l3.5-3.5" />
  </Svg>
);
export const CameraIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.2l1.5-2h5.6l1.5 2h2.2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" />
    <circle cx="12" cy="13" r="3.5" />
  </Svg>
);
export const KeyboardIcon = (p: P) => (
  <Svg {...p}>
    <rect x="2.5" y="6" width="19" height="12" rx="2" />
    <path d="M6 10h0M9.5 10h0M13 10h0M16.5 10h0M7 14h10" />
  </Svg>
);
export const CubeIcon = (p: P) => (
  <Svg {...p}>
    <path d="M12 2.5l8.5 4.8v9.4L12 21.5l-8.5-4.8V7.3z" />
    <path d="M3.5 7.3L12 12l8.5-4.7M12 12v9.5" />
  </Svg>
);
export const MenuIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Svg>
);

const SYMPTOM_ICONS: Record<string, (p: P) => React.JSX.Element> = {
  vibration: VibrationIcon,
  overheating: FlameIcon,
  abnormal_noise: NoiseIcon,
  leak: DropIcon,
  smoke_or_burning: SmokeIcon,
  electrical_fault: BoltIcon,
  pressure_abnormal: GaugeIcon,
  stoppage: StopIcon,
  wear_or_damage: CrackIcon,
  speed_abnormal: SpeedIcon,
  lubrication: OilIcon,
  alarm_or_fault_code: SirenIcon,
};

export function SymptomIcon({ tag, ...p }: P & { tag: string }) {
  const Icon = SYMPTOM_ICONS[tag] ?? IncidentIcon;
  return <Icon {...p} />;
}

export type MachineKindName =
  | "motor" | "pump" | "conveyor" | "compressor" | "gearbox" | "fan" | "generator" | "press" | "lathe" | "boiler"
  | "vmc" | "mill" | "drill" | "grinder" | "saw" | "moulder" | "extruder" | "robot" | "forklift" | "crane"
  | "tower" | "chiller" | "transformer" | "panel" | "mixer" | "elevator" | "screwcomp" | "dust" | "exchanger" | "packer";

// Checked in order: specific names before general ones ("screw compressor" before "compressor").
const KIND_RULES: [RegExp, MachineKindName][] = [
  [/cooling tower/, "tower"],
  [/chiller/, "chiller"],
  [/transformer/, "transformer"],
  [/\bmcc\b|control panel|motor control|switchboard|\bpanel\b/, "panel"],
  [/\bdust\b|bag ?house|cyclone/, "dust"], // word match: "industrial" contains "dust"
  [/heat exchanger|exchanger|condenser/, "exchanger"],
  [/bucket elevator|elevator/, "elevator"],
  [/screw compressor|rotary screw/, "screwcomp"],
  [/injection|moulding|molding/, "moulder"],
  [/extruder/, "extruder"],
  [/robot/, "robot"],
  [/forklift|fork lift|reach truck/, "forklift"],
  [/crane|hoist/, "crane"],
  [/mixer|agitator|vessel|reactor/, "mixer"],
  [/packing|packer|packaging|form.?fill|ffs|bagging/, "packer"],
  [/machining cent|\bvmc\b|\bhmc\b|\bcnc\b/, "vmc"],
  [/milling|\bmill\b/, "mill"],
  [/drill/, "drill"],
  [/grinder|grinding/, "grinder"],
  [/saw/, "saw"],
  [/pump/, "pump"],
  [/conveyor|belt/, "conveyor"],
  [/compressor/, "compressor"],
  [/fan|blower/, "fan"],
  [/generator|genset|dg set|alternator/, "generator"],
  [/press/, "press"],
  [/lathe|turning/, "lathe"],
  [/boiler|steam/, "boiler"],
  [/gearbox|reducer|\bgear/, "gearbox"],
  [/motor|drive/, "motor"],
];

/** Which 3D model and icon a machine gets, from its free-text type. */
export function machineKind(type: string): MachineKindName {
  const t = type.toLowerCase();
  return KIND_RULES.find(([re]) => re.test(t))?.[1] ?? "gearbox";
}

export const FanIcon = (p: P) => (
  <Svg {...p}>
    <path d="M5 19V8.5a6 6 0 0 1 12 0V10h3v4h-4.5" />
    <circle cx="11" cy="9" r="2.5" />
    <path d="M4 20h14" />
  </Svg>
);
export const GeneratorIcon = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="7" width="18" height="11" rx="1.5" />
    <path d="M7 18v2M17 18v2M15 4v3M12.5 9.5l-2 3h3l-2 3" />
  </Svg>
);
export const PressIcon = (p: P) => (
  <Svg {...p}>
    <path d="M5 21V4h14v17M3 21h18M8 4v4h8V4M9 8v4h6V8M7 17h10" />
  </Svg>
);
export const LatheIcon = (p: P) => (
  <Svg {...p}>
    <path d="M2 17h20M4 17v3M20 17v3M4 9h5v8H4zM9 12h8M17 10h3v5h-3z" />
    <circle cx="6.5" cy="13" r="1.2" />
  </Svg>
);
export const BoilerIcon = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="9" width="15" height="9" rx="4.5" />
    <path d="M18 11h2V3M6 18v2M15 18v2M7 13.5h5" />
  </Svg>
);

export function MachineTypeIcon({ type, ...p }: P & { type: string }) {
  const Icon = {
    motor: MotorIcon,
    pump: PumpIcon,
    conveyor: ConveyorIcon,
    compressor: CompressorIcon,
    gearbox: GearIcon,
    fan: FanIcon,
    generator: GeneratorIcon,
    press: PressIcon,
    lathe: LatheIcon,
    boiler: BoilerIcon,
    vmc: LatheIcon,
    mill: LatheIcon,
    drill: PressIcon,
    grinder: LatheIcon,
    saw: LatheIcon,
    moulder: PressIcon,
    extruder: LatheIcon,
    robot: GearIcon,
    forklift: ConveyorIcon,
    crane: PressIcon,
    tower: FanIcon,
    chiller: CompressorIcon,
    transformer: GeneratorIcon,
    panel: GeneratorIcon,
    mixer: BoilerIcon,
    elevator: ConveyorIcon,
    screwcomp: CompressorIcon,
    dust: FanIcon,
    exchanger: BoilerIcon,
    packer: ConveyorIcon,
  }[machineKind(type)];
  return <Icon {...p} />;
}
