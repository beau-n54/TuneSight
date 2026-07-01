import { NextResponse } from "next/server";
import path from "path";

import { scanLibrary } from "@/lib/tunes/libraryScanner";
import { buildRuntimeRomLibrary } from "@/lib/tunes/buildRunTimeRomLibrary";

export async function GET() {
  try {
    const root = path.join(process.cwd(), "BMW-XDFs-master");

    const files = scanLibrary(root);
    const summary = buildRuntimeRomLibrary(root);

    return new NextResponse(
      JSON.stringify(
        {
          success: true,
          fileCount: files.length,
          summary,
        },
        null,
        2
      ),
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}