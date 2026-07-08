import LegalLayout from "@/components/legal/LegalLayout";

export default function SupportPage() {
  return (
    <LegalLayout
      title="Support"
      intro="This page outlines how TuneSight support works during beta access and future subscription use."
      sections={[
        {
          title: "1. Beta support",
          body: "During beta access, TuneSight support may focus on account access, upload issues, diagnostic review problems, platform bugs, and feedback related to vehicle analysis.",
        },
        {
          title: "2. Response times",
          body: "TuneSight will aim to respond to support requests as soon as practical, but response times may vary during beta testing and early platform development.",
        },
        {
          title: "3. Diagnostic support limits",
          body: "Support may help explain TuneSight results, but it does not replace a qualified tuner, mechanic, workshop, engineer, or vehicle inspection.",
        },
        {
          title: "4. Contact",
          body: "Support requests can be sent to the official TuneSight support contact once beta access is opened.",
        },
      ]}
    />
  );
}