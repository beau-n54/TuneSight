import { constructSourceAuthorityRecord, type SourceAuthorityScopeBinding } from "./sourceAuthorityScope.ts";

export const S58_GOVERNED_EVIDENCE_AUTHORIZED_AT = "2026-08-30T00:00:00.000Z" as const;
export const S58_GOVERNED_EVIDENCE_FOUNDER_AUTHORITY_ID = "tunesight-founder:founder" as const;

export const S58_GOVERNED_EVIDENCE_SCOPE: readonly Readonly<SourceAuthorityScopeBinding & { romSoftwareIdentity: string }>[] = Object.freeze([
  ["00005C640A6405", "e5e0add9ecb8876a16fe5c4b93bc3714fc4b2d415565dc18d663f1ac4a70e46e", "28148933e7edc57b7a7391d0a4c4ddc423b38db5b092de9b87a6a203a8228dc3", "8043aef7d3b29acbdaca72744ae716aa22742d5cc9e1841588eb05d90cbf54df"],
  ["00005C640A8205", "d3d8abbb9d4827d91abb8b53cbdf988870027e90b1243d9be0daf731bc04751c", "2d41dc99cf0f3e3d62e529a885572008497472db748626252d15ae6f9f9e700d", "beadab977ba5e6e3698bc93b4efb1620e7c2bfed15907eafd55cbc935208674a"],
  ["00005C640A8C05", "5ffb4f98f61b238e6906ef7b163f247e75c4ba40c99a55b5ea36253152ac3b00", "4748e565cb6d7ac5cdc4c7629696a173b0473306a826f66c3b0381f3cada9e4f", "fef182a4425f73beed8e8948c1dfc5e199a0eec17c29c037dbdfa1aa253ee309"],
  ["00005C64143206", "8fff783f953aac628a7bb8927364f064d86debc53ee2704cc751f063035f45b9", "11a1ff48b60557a5080fdf1f0a9caad72a9ef31749e23a2a6ff54f2d5486c313", "3e7701f9fc24a2283ad10a26ff6b8b9d5cff4320e8fd5cdbf085b8fba9c45aa9"],
  ["00005C64143C05", "92d1689434c93caa3c9fae4c453c14a73ab2ad454b095301a2fff98904b8ac51", "5050da92e2b4489f6ee9cfa0304b2af23bd51bf83f7b044865b54a5cbb1c1a4e", "4001fc0f05e9d62a32a43d1019d2005ebbeea39062c6d29c57d69391127fbc03"],
  ["00005C64144606", "f69645eecb454625e3ba8f94703b007c12526bd166c063b758a7c808803871ac", "d70899931eee98a738fe19b8bb4bd8a8c7ca828df548a963d95bea326f169173", "27fe6b6ecde13b2af1658ba4246909d89ddf227d9e381330cc5b3a6722b9e418"],
  ["00005C64145007", "1cbf5cd986a1b2992d72242c9eb00f82dea7737de593f7ac07652f8b1085c448", "dc301326cf9787103f0ba63b3723c6eea8db5263dab652f49589d8c15b763c03", "e3f4fec2dbccb1074b43ed49e87d79efef9f82f94f50e6f12dbc0ba36a8e7f7e"],
  ["00005C64145A05", "686ce3a4bd27c88bd9d69db2e21e0fb5cb8a74d637de64d2637441f94d3a9b89", "d5a25a67976a341397a9f2b7422a939189125d1de65fb8c3a41aca45ee39ab66", "d0001207065f7266d9eb7dd69b84dde60b49ae22066aacef65f46644c78dc5b0"],
  ["00005C64146E06", "72ecf244b61ee31eab54d0bce3361f0d0a940bef088d46306b9fc4a86e5cb793", "6d7ab2629f882cd2fd095aa007ebbb5d8346418505ff0c035eac97e84f0bd64b", "522bf4cdc5e5d0f03f6ab9aec01ef938d4e9c6c9ed95658fe030eaa1341e00ef"],
  ["00005C64148205", "e509afcee348a35137862b18ad6c36fb866e70ee79f632abceb09781257ebe6c", "a9b30eb28f103fc489ef18ae3ebc5b264687b2cc8e60e259c7874ac77a12cedd", "225927e0c8313e4bbb936237e8df0f1efa60837d4e8ee52bbf83babc763a3ebf"],
].map(([romSoftwareIdentity, digest, setId, setRevision]) => Object.freeze({ romSoftwareIdentity, sourceArtifactId: `xdf-source:${digest}`, sourceArtifactDigest: `sha256:${digest}`, definitionSetId: `xdf-definition-set:${setId}`, definitionSetRevision: `xdf-definition-set-revision:${setRevision}`, family: "s58" })));

export const S58_GOVERNED_EVIDENCE_SOURCE_AUTHORITY = constructSourceAuthorityRecord({
  authorityClass: "governed_evidence_review",
  founderAuthorityId: S58_GOVERNED_EVIDENCE_FOUNDER_AUTHORITY_ID,
  authorizedAt: S58_GOVERNED_EVIDENCE_AUTHORIZED_AT,
  lineage: ["The ten exact sources and twenty candidate binaries were imported together in local commit 3c92a157cb62c313ae345e93a973d581434d04c1; upstream acquisition and authorship remain unknown."],
  scope: S58_GOVERNED_EVIDENCE_SCOPE,
  evidenceBasis: ["Exact Source Artifact and Definition Set identities", "Exact ROM/software marker correspondence", "Complete 25,112-instance extraction validation", "Complete 18,528 converted and 6,584 identity/no-op engineering conversion validation", "Zero technical, Stock Variant and representation conflicts", "Bounded distinct Original and MapSwitch candidate cohort", "Founder-authorized TuneSight governed engineering Evidence review"],
  provenance: ["Founder Founder and Bob accepted WP-004.3.20 and explicitly authorized governed engineering Evidence review for only the ten enumerated immutable S58 source revisions on 2026-08-30."],
  limitations: ["Upstream acquisition provenance is unknown.", "Original XDF author and source are unknown.", "Authority arises from TuneSight governed engineering Evidence review, not BMW or OEM endorsement.", "Original and MapSwitch Stock authenticity remains separate and candidate-grade.", "Semantic Calibration Knowledge remains separate and unavailable unless independently governed.", "Each exact applicability relationship still requires an independent Founder decision.", "Publication remains a separate explicitly authorized action."],
});
