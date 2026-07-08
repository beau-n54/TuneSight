import LegalLayout from "@/components/legal/LegalLayout";

export default function LegalDisclaimerPage() {
  return (
    <LegalLayout
      title="Legal Disclaimer"
      intro="TuneSight is an advanced BMW diagnostic platform designed to analyse uploaded logs, tune information, vehicle setup details, and calibration evidence to support smarter diagnostic decisions."
      sections={[
        {
          title: "1. Diagnostic guidance only",
          body: "TuneSight provides diagnostic information, pattern recognition, calibration comparison, and supporting evidence. It does not replace the judgment of a qualified tuner, mechanic, engineer, or workshop.",
        },
        {
          title: "2. Vehicle risk",
          body: "Motorsport, tuning, calibration changes, flashing, logging, and high-performance vehicle operation carry inherent risk. Engine, turbocharger, drivetrain, fuel system, electrical, and safety failures may occur even when diagnostic information appears reasonable.",
        },
        {
          title: "3. User responsibility",
          body: "Users remain fully responsible for all decisions made from TuneSight information, including tune changes, mechanical changes, boost targets, fuel setup, flashing decisions, workshop actions, and vehicle operation.",
        },
        {
          title: "4. No guarantee of outcome",
          body: "TuneSight does not guarantee vehicle safety, reliability, performance gains, emissions compliance, tune accuracy, mechanical condition, fault prevention, or successful calibration results.",
        },
        {
          title: "5. Off-road and motorsport use",
          body: "Users must ensure their vehicle, tune, emissions equipment, and road use comply with applicable laws in their location. TuneSight is not responsible for unlawful vehicle use or non-compliant modifications.",
        },
        {
          title: "6. Beta access acknowledgement",
          body: "During beta access, TuneSight may contain incomplete features, limited diagnostic coverage, experimental ranking logic, and evolving vehicle support. Beta users accept that results may change as the platform improves.",
        },
      ]}
    />
  );
}