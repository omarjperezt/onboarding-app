import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { processIdentityFlip } from "@/lib/journey-engine/process-identity-flip";

const provisioningPayloadSchema = z.object({
  userId: z.string().uuid(),
  corporateEmail: z.string().email(),
});

function validateBearerToken(request: NextRequest): boolean {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) {
    console.error(
      "[Webhook] WEBHOOK_SECRET is not configured in environment variables"
    );
    return false;
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader) return false;

  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) return false;

  return token === secret;
}

export async function POST(request: NextRequest) {
  // 1. Validate Bearer token
  if (!validateBearerToken(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  // 2. Parse and validate request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const parsed = provisioningPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { userId, corporateEmail } = parsed.data;

  // 3. Process the identity flip
  try {
    const result = await processIdentityFlip(userId, corporateEmail);

    console.log(
      `[Webhook] Identity flip processed for user ${userId}: ${corporateEmail}, progress=${result.newProgress}%`
    );

    return NextResponse.json({
      success: true,
      journeyId: result.journeyId,
      newProgress: result.newProgress,
      unlockedSteps: result.unlockedStepCount,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    console.error(`[Webhook] Error processing identity flip: ${message}`);

    return NextResponse.json(
      { error: "Processing failed", message },
      { status: 500 }
    );
  }
}
