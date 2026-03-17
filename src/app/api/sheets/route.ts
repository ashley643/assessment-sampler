import { NextRequest, NextResponse } from "next/server";

function extractSheetId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

function extractGid(url: string): string | null {
  const match = url.match(/[#&?]gid=(\d+)/);
  return match ? match[1] : null;
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const sheetId = extractSheetId(url);
    if (!sheetId) {
      return NextResponse.json({ error: "Invalid Google Sheets URL" }, { status: 400 });
    }

    const gid = extractGid(url) ?? "0";

    // Fetch CSV export from Google Sheets (public sheets work without auth)
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;

    const response = await fetch(csvUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; ReportBuilder/1.0)",
      },
    });

    if (!response.ok) {
      // Try the published CSV URL as fallback
      const altUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`;
      const altResponse = await fetch(altUrl);
      if (!altResponse.ok) {
        return NextResponse.json(
          {
            error:
              "Could not fetch sheet. Make sure it's set to 'Anyone with link can view'.",
          },
          { status: 403 }
        );
      }
      const csv = await altResponse.text();
      return NextResponse.json({ csv, sheetId });
    }

    const csv = await response.text();
    return NextResponse.json({ csv, sheetId });
  } catch (err) {
    console.error("Sheets API error:", err);
    return NextResponse.json({ error: "Failed to fetch sheet" }, { status: 500 });
  }
}
