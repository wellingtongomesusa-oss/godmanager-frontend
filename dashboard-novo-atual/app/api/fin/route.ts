import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * POST /api/fin
 * Envia um prompt para o Claude e retorna a resposta.
 * Body: { prompt: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt } = body;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: 'Campo "prompt" é obrigatório.' },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY não configurada." },
        { status: 500 }
      );
    }

    const response = await client.messages.create({
      model: "claude-3-sonnet-20240229",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error("[api/fin]", error);
    return NextResponse.json(
      { error: "Erro ao processar requisição com Claude." },
      { status: 500 }
    );
  }
}
