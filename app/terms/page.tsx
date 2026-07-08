import LegalLayout from "@/components/legal/LegalLayout";

export default function TermsPage() {
  return (
    <LegalLayout
      title="Terms & Conditions"
      intro="These terms outline how TuneSight may be accessed, used, tested, and reviewed during beta access and future subscription use."
      sections={[
        { title: "1. Platform use", body: "TuneSight is provided for diagnostic review, log analysis, tune comparison, vehicle setup review, and calibration decision support." },
        { title: "2. Account responsibility", body: "Users are responsible for maintaining secure account access and ensuring that uploaded files, vehicle details, and diagnostic information are accurate." },
        { title: "3. Beta access", body: "Beta access may include incomplete features, changing diagnostic logic, limited vehicle coverage, and experimental ranking systems." },
        { title: "4. Uploaded files", body: "Users must only upload files they are authorised to use, including logs, tune files, vehicle setup data, and supporting diagnostic material." },
        { title: "5. Subscription services", body: "Future paid plans may include Starter, Pro, Workshop, or other subscription tiers. Pricing, inclusions, and access may change before public launch." },
        { title: "6. Acceptable use", body: "Users must not misuse TuneSight, attempt to bypass security, upload malicious files, reverse engineer the platform, or use the service unlawfully." },
        { title: "7. No guaranteed outcome", body: "TuneSight does not guarantee diagnostic accuracy, vehicle reliability, calibration safety, performance gains, or mechanical fault prevention." },
        { title: "8. Changes to terms", body: "TuneSight may update these terms as the platform grows. Continued use may require accepting an updated version." },
      ]}
    />
  );
}