import { NextRequest, NextResponse } from "next/server";
import { getChain } from "../../../utils";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const query = body.query;
    const history = body.history;
    const fullHistory = history.map((h: any) => h.content).join(" ");

    const chain = await getChain();

    const response = await chain.invoke({
      question: query,
      chat_history: fullHistory,
    });

    const sources: any[] = response.sourceDocuments?.map(
      (document: { metadata: any }) => document.metadata
    ) || [];

    return NextResponse.json({
      role: "assistant",
      content: response.text,
      sources: sources,
    });
  } catch (error: any) {
    console.error("Error in /api/read:", error);
    return NextResponse.json(
      {
        role: "assistant",
        content: "An error occurred: " + (error.message || "Unknown error"),
        sources: [],
      },
      { status: 500 }
    );
  }
}
