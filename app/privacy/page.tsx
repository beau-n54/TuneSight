import LegalLayout from "@/components/legal/LegalLayout";

export default function PrivacyPolicyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      intro="This policy explains how TuneSight collects, stores, protects and uses information provided through the platform."
      sections={[
        { title: "1. Information we collect", body: "TuneSight may collect account details, vehicle information, uploaded logs, tune files, diagnostic results and subscription information required to operate the platform." },
        { title: "2. How information is used", body: "Your information is used to provide diagnostics, improve platform reliability, troubleshoot issues and develop future TuneSight features." },
        { title: "3. Uploaded vehicle data", body: "Uploaded files may include logs, tune files, ROM identifiers, calibration information, vehicle setup details and diagnostic results." },
        { title: "4. Data protection", body: "TuneSight uses reasonable security measures to protect stored information, however no internet-based service can guarantee absolute security." },
        { title: "5. User rights", body: "Users may request access to or removal of their personal information where permitted by applicable law." },
      ]}
    />
  );
}