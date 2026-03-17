import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { prompt, context, type } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const systemPrompt = `You are an expert impact report writer for nonprofits, social enterprises, and mission-driven organizations.
You write clear, compelling, data-driven narrative copy that:
- Highlights impact metrics and outcomes
- Tells a human story behind the numbers
- Uses active voice and concise language
- Is appropriate for donors, board members, and stakeholders
- Avoids jargon while remaining professional

${context ? `Context about this report: ${context}` : ""}`;

    const userMessage =
      type === "slide_narrative"
        ? `Write compelling narrative copy for a report slide. ${prompt}. Keep it to 2-3 short paragraphs.`
        : type === "headline"
        ? `Write a punchy, impactful headline (max 10 words) for: ${prompt}`
        : type === "insight"
        ? `Write a 1-2 sentence data insight/callout for: ${prompt}`
        : type === "summary"
        ? `Write an executive summary paragraph for: ${prompt}`
        : prompt;

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content: userMessage }],
      system: systemPrompt,
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "";

    return NextResponse.json({ text });
  } catch (err) {
    console.error("AI draft error:", err);
    return NextResponse.json({ error: "Failed to generate text" }, { status: 500 });
  }
}
