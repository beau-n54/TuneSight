export const CHECKSUM_INTEGRITY_RESEARCH_EVIDENCE = Object.freeze({
  n54: Object.freeze({
    ecuFamilies: Object.freeze(["MSD80", "MSD81"]),
    conclusion: "CHECKSUM_UNKNOWN" as const,
    evidence: Object.freeze([
      Object.freeze({ kind: "inspectable_open_source_lead", url: "https://github.com/TheOneRokutis/8hp-cc-patch", finding: "MSD80/MSD81 program modifications require a separate MSD8x checksum-correction tool; this repository does not implement the checksum." }),
      Object.freeze({ kind: "inspectable_open_source_lead", url: "https://github.com/superwofy/E9X-M-CAN-Integration-Module", finding: "One MSD81 program workflow identifies a checksum-related location and invokes a closed external executable; it does not disclose a calibration checksum algorithm or vectors." }),
      Object.freeze({ kind: "tool_vendor_documentation", url: "https://www.bitsoftware.com/bitbox/catalog/69", finding: "A commercial tool documents automatic checksum support for 2 MiB TC1796 MSD80 and MSD81, establishing that checksum handling exists but not its algorithm or exact relationship applicability." }),
      Object.freeze({ kind: "flasher_vendor_documentation", url: "https://mhd-tuning.atlassian.net/wiki/spaces/MFS2/pages/10879010/Custom%2BTunes", finding: "MHD documents selecting BIN or MHD custom-tune files, but does not document checksum validation or repair behavior." }),
    ]),
    missing: Object.freeze(["inspectable algorithm", "checksum regions", "stored fields", "byte order and parameters", "known-valid vectors", "controlled corruption and repair vectors"]),
  }),
  b58Gen1: Object.freeze({
    ecuFamilies: Object.freeze(["MG1CS003"]),
    conclusion: "CHECKSUM_UNKNOWN" as const,
    evidence: Object.freeze([
      Object.freeze({ kind: "controlled_repository_bytes", url: null, finding: "Each of the five active B58 Gen1 relationship binaries independently contains an MG1CS003 marker and has a governed 7,864,320-byte layout; this establishes DME-family evidence, not checksum authority." }),
      Object.freeze({ kind: "flasher_vendor_documentation", url: "https://mhd-tuning.atlassian.net/wiki/spaces/MFS2/pages/10879010/Custom%2BTunes", finding: "MHD documents custom BIN/MHD file selection and map writes, but does not publish checksum regions, algorithms, repair behavior, or exact relationship compatibility." }),
      Object.freeze({ kind: "manufacturer_training", url: "https://bmwtechinfo.bmwgroup.com/tech_training_manual/ST1505%20B58%20Engine.pdf", finding: "BMW training material establishes B58 system context but does not disclose tune-image checksum/integrity algorithms." }),
    ]),
    missing: Object.freeze(["inspectable MG1CS003 integrity descriptor", "checksum/signature boundary", "checksum regions and fields", "known-valid vectors", "controlled corruption and repair vectors", "authoritative per-relationship external-flasher checksum contract"]),
  }),
});
