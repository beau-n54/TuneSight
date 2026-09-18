export type I8a0sReviewCandidate = Readonly<{
  priority: number;
  proposedStandardName: string;
  sourceTitle: string;
  definitionRevision: string;
  systems: readonly string[];
  role: string;
  axes: readonly string[];
  output: string;
  evidence: readonly string[];
  limitations: readonly string[];
  recommendedDecision: "founder_review";
}>;

export const I8A0S_SEMANTIC_EQUIVALENCE_PAIRS = Object.freeze([
  ["xdf-definition-revision:ccd197c4bcb7e287a63f6f469ba80921c21d963560652fa2c95cebb19137ee6a", "xdf-definition-revision:5b4963338364de4b26674037023ac0e79d0c28731abb97198a84b49fe40c90fa"],
  ["xdf-definition-revision:02270acfd9ad86ae485065d579e93072b54f34adb1762cc8c8839311f440fea4", "xdf-definition-revision:e102deaca5035e06fc326d68f52735b0a1eeceee3a062a9fd8a22750dde88f6d"],
  ["xdf-definition-revision:794a66f9eb5c8988a3f1e09000c0c8c00429eadb0b24c68fd103ad0c61f12ee4", "xdf-definition-revision:562706ea7e03b78d6af5139a90bd8292e833b6c5a345dec905a3d7c13d17770e"],
  ["xdf-definition-revision:cf52e241589602f64b53ba75277c9f10b577059ffbb16b230660f24a34f1054e", "xdf-definition-revision:c1c2c05ba6ae47773315bf59efbff83d13e5a1d4bfbf66a3392b5396d28432cd"],
  ["xdf-definition-revision:e6936f1542097f4e0bcfc4eb687ea5677149f1deaea39334f4577f1a6d8318cb", "xdf-definition-revision:32c413b786dc4389f9c6c1cba6ffe70411a896952cebcc71fdc8be45d7d2f7fe"],
  ["xdf-definition-revision:e2bb0500c09403d27ac471452a5932c4c6534397c6b7c2858112003840fb6fce", "xdf-definition-revision:8d3f77e689d62002931561dadec2c3d852fc8ad0d174d63596fc979245a784bc"],
  ["xdf-definition-revision:ffc956604f6e8eee88c678694a713a5f98b21d12e2aafbfc398f4093fb823596", "xdf-definition-revision:681778a9ff67d0bf605f2a9093ac8026725f7d2950df6bc808773f531f8f30b5"],
] as const);

export const I8A0S_FOUNDER_REVIEW_QUEUE: readonly I8a0sReviewCandidate[] = Object.freeze([
  { priority: 1, proposedStandardName: "Main Fuel Target — Load × RPM", sourceTitle: "Fuel (Main)", definitionRevision: "xdf-definition-revision:fc1b74196b040c4e79e40d66c7b59e348718127b58eae8cf756a5bc7ee8a682d", systems: ["Fueling / Lambda"], role: "Target candidate", axes: ["X: Load", "Y: Engine Speed [RPM]"], output: "AFR", evidence: ["17 × 18 address-backed table", "Source output conversion and AFR unit are present"], limitations: ["Lambda/AFR interpretation, operating selection and enrichment hierarchy require explicit acceptance"], recommendedDecision: "founder_review" },
  { priority: 2, proposedStandardName: "Main Ignition Timing — Load × RPM", sourceTitle: "Timing (Main)", definitionRevision: "xdf-definition-revision:38ca407bd398fbb4df621af53c372112c51817c259545c60f011d60f3304df3e", systems: ["Ignition / Timing"], role: "Base/target candidate", axes: ["X: Load", "Y: Engine Speed [RPM]"], output: "Ignition Advance [deg]", evidence: ["16 × 20 address-backed table", "Source output unit and X/2 conversion are present"], limitations: ["Selection hierarchy and whether the source means base or final target remain unresolved"], recommendedDecision: "founder_review" },
  { priority: 3, proposedStandardName: "Load Target by Gear and RPM", sourceTitle: "Load Target per Gear", definitionRevision: "xdf-definition-revision:0fab99a66439c71178d3d9a160e32d5ae0366c86189ed36932f36e2272e86a4b", systems: ["Load & Torque"], role: "Target candidate", axes: ["X: Engine Speed [RPM]", "Y: Gear"], output: "Actual-load representation", evidence: ["16 × 6 address-backed table", "Source axes, output unit and X/100 conversion are present"], limitations: ["Load normalization and request/limit precedence remain unresolved"], recommendedDecision: "founder_review" },
  { priority: 4, proposedStandardName: "Custom Wastegate Base Control", sourceTitle: "WGDC Base (Custom)", definitionRevision: "xdf-definition-revision:8a9ba100a851d145887bec693664659dc4af2f825c23c4e341b8653be0f1dead", systems: ["WGDC / Turbo Control"], role: "Base/feed-forward candidate", axes: ["X: Flow [l/min]", "Y: Pressure [psi]"], output: "Dimensionless source value", evidence: ["16 × 20 address-backed table", "Source axis conversions and output conversion are present"], limitations: ["Enable relationship and exact output interpretation remain unresolved"], recommendedDecision: "founder_review" },
  { priority: 5, proposedStandardName: "Charge-air-temperature Timing Correction", sourceTitle: "Timing Total Cor. (Charge Air Temp)", definitionRevision: "xdf-definition-revision:bff465e20fdf7772b85304dd852a47387cc135987b5b9c7c1a3dbac2ccce8638", systems: ["IAT / Temperature Compensation", "Ignition / Timing"], role: "Temperature correction candidate", axes: ["X: Actual Load", "Y: Engine Speed [RPM]"], output: "Source Factor", evidence: ["6 × 8 address-backed table", "Source title, units and conversions are present"], limitations: ["Temperature input is not an explicit table axis and factor operation/direction remain unresolved"], recommendedDecision: "founder_review" },
  { priority: 6, proposedStandardName: "Boost Ceiling", sourceTitle: "Boost Ceiling", definitionRevision: "xdf-definition-revision:034272543b7a2c39bf8bbe7afd390534351eab4c014f1efdd6e09a7ffe9c43de", systems: ["Boost & Air Control", "Protection / Safety / Limiters"], role: "Ceiling candidate", axes: [], output: "Pressure [bar]", evidence: ["Scalar address-backed Definition", "Source bar unit and conversion are present"], limitations: ["Absolute/relative basis and precedence among other ceilings remain unresolved"], recommendedDecision: "founder_review" },
  { priority: 7, proposedStandardName: "Critical Oil-pressure Alert Delay", sourceTitle: "Critical oil pressure alert delay time", definitionRevision: "xdf-definition-revision:7cd0a57a73b14eefc8a1af52c2ad53c24bf58ce1a3ffec2c5277c1d81e5c00e8", systems: ["Protection / Safety / Limiters"], role: "Protection delay candidate", axes: [], output: "Time [s]", evidence: ["Source description explicitly links persistent critical pressure to alerting and optional RPM limiting", "Source seconds unit is present"], limitations: ["Critical threshold and enable chain remain separately governed; this does not admit the held pressure threshold"], recommendedDecision: "founder_review" },
]);
