export const N54_PREVIEW_VOCABULARY = ["I8A0S", "IJE0S", "IKM0S", "INA0S"] as const;
export type N54PreviewRom = (typeof N54_PREVIEW_VOCABULARY)[number];
export const DEFAULT_N54_PREVIEW_ROM: N54PreviewRom = "IJE0S";

export type N54PreviewSelection = Readonly<{ status: "valid"; rom: N54PreviewRom }> | Readonly<{ status: "invalid"; requested: string }>;

export function selectN54PreviewRom(value?: string | null): N54PreviewSelection {
  if (value === undefined || value === null || value === "") return Object.freeze({ status: "valid", rom: DEFAULT_N54_PREVIEW_ROM });
  return (N54_PREVIEW_VOCABULARY as readonly string[]).includes(value)
    ? Object.freeze({ status: "valid", rom: value as N54PreviewRom })
    : Object.freeze({ status: "invalid", requested: value });
}
