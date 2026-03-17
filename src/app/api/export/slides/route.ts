import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { Report, Widget, ChartWidget, TextWidget, ImageWidget, StatWidget } from "@/lib/types";

// Google Slides export
// Requires GOOGLE_SERVICE_ACCOUNT_KEY env var (JSON string of service account credentials)
// OR user OAuth flow (GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + access_token in request)

export async function POST(req: NextRequest) {
  try {
    const { report, accessToken }: { report: Report; accessToken?: string } =
      await req.json();

    if (!report) {
      return NextResponse.json({ error: "Report data is required" }, { status: 400 });
    }

    // Set up auth
    let auth;
    if (accessToken) {
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: accessToken });
      auth = oauth2Client;
    } else if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
      auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ["https://www.googleapis.com/auth/presentations"],
      });
    } else {
      return NextResponse.json(
        {
          error:
            "No Google auth configured. Please connect your Google account or set GOOGLE_SERVICE_ACCOUNT_KEY.",
        },
        { status: 401 }
      );
    }

    const slides = google.slides({ version: "v1", auth });

    // 1. Create a new presentation
    const presentation = await slides.presentations.create({
      requestBody: {
        title: report.title,
      },
    });

    const presentationId = presentation.data.presentationId!;
    const requests: any[] = [];

    // 2. Delete default slide
    const defaultSlideId =
      presentation.data.slides?.[0]?.objectId;
    if (defaultSlideId) {
      requests.push({ deleteObject: { objectId: defaultSlideId } });
    }

    // 3. Add slides
    for (let si = 0; si < report.slides.length; si++) {
      const slide = report.slides[si];
      const slideObjectId = `slide_${si}`;

      requests.push({
        insertEmptySlide: {
          objectId: slideObjectId,
          insertionIndex: si,
          slideLayoutReference: { predefinedLayout: "BLANK" },
        },
      });

      // Background color
      if (slide.background && slide.background !== "#ffffff") {
        const hex = slide.background.replace("#", "");
        const r = parseInt(hex.substr(0, 2), 16) / 255;
        const g = parseInt(hex.substr(2, 2), 16) / 255;
        const b = parseInt(hex.substr(4, 2), 16) / 255;
        requests.push({
          updatePageProperties: {
            objectId: slideObjectId,
            pageProperties: {
              pageBackgroundFill: {
                solidFill: { color: { rgbColor: { red: r, green: g, blue: b } } },
              },
            },
            fields: "pageBackgroundFill",
          },
        });
      }

      // Add widgets as text boxes and notes
      for (let wi = 0; wi < slide.widgets.length; wi++) {
        const widget = slide.widgets[wi];
        const elementId = `elem_${si}_${wi}`;

        if (widget.type === "text") {
          const textWidget = widget as TextWidget;
          // Convert grid units to EMU (9144000 = 1 inch, slide is 9144000 x 5143500 EMU)
          const slideW = 9144000;
          const slideH = 5143500;
          const colW = slideW / 12;

          requests.push({
            createShape: {
              objectId: elementId,
              shapeType: "TEXT_BOX",
              elementProperties: {
                pageObjectId: slideObjectId,
                size: {
                  width: { magnitude: colW * widget.w, unit: "EMU" },
                  height: { magnitude: Math.max(widget.h * 9144, 500000), unit: "EMU" },
                },
                transform: {
                  scaleX: 1,
                  scaleY: 1,
                  translateX: colW * widget.x,
                  translateY: widget.y * 9144,
                  unit: "EMU",
                },
              },
            },
          });

          requests.push({
            insertText: {
              objectId: elementId,
              text: textWidget.content.replace(/<[^>]+>/g, ""),
            },
          });
        } else if (widget.type === "stat") {
          const statWidget = widget as StatWidget;
          const slideW = 9144000;
          const colW = slideW / 12;
          requests.push({
            createShape: {
              objectId: elementId,
              shapeType: "TEXT_BOX",
              elementProperties: {
                pageObjectId: slideObjectId,
                size: {
                  width: { magnitude: colW * widget.w, unit: "EMU" },
                  height: { magnitude: 900000, unit: "EMU" },
                },
                transform: {
                  scaleX: 1,
                  scaleY: 1,
                  translateX: colW * widget.x,
                  translateY: widget.y * 9144,
                  unit: "EMU",
                },
              },
            },
          });
          requests.push({
            insertText: {
              objectId: elementId,
              text: `${statWidget.label}\n${statWidget.value}${statWidget.change ? `\n${statWidget.change}` : ""}`,
            },
          });
        }
      }
    }

    // Execute all requests in batch
    if (requests.length > 0) {
      await slides.presentations.batchUpdate({
        presentationId,
        requestBody: { requests },
      });
    }

    const presentationUrl = `https://docs.google.com/presentation/d/${presentationId}/edit`;

    return NextResponse.json({
      presentationId,
      url: presentationUrl,
    });
  } catch (err: any) {
    console.error("Slides export error:", err);
    return NextResponse.json(
      { error: err.message ?? "Failed to export to Google Slides" },
      { status: 500 }
    );
  }
}
