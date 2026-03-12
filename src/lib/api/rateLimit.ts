import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const limiters = new Map<string, Ratelimit>();

function getLimiter(
  prefix: string,
  maxRequests: number,
  windowSec: number
): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;

  const key = `${prefix}:${maxRequests}:${windowSec}`;
  if (!limiters.has(key)) {
    limiters.set(
      key,
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(maxRequests, `${windowSec} s`),
        prefix: `rl:${prefix}`,
      })
    );
  }
  return limiters.get(key)!;
}

export interface RateLimitResult {
  limited: boolean;
  response?: NextResponse;
}

export async function checkRateLimit(
  identifier: string,
  prefix: string,
  maxRequests: number,
  windowSec: number
): Promise<RateLimitResult> {
  const limiter = getLimiter(prefix, maxRequests, windowSec);
  if (!limiter) return { limited: false };

  const { success, remaining, reset } = await limiter.limit(identifier);

  if (!success) {
    return {
      limited: true,
      response: NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "X-RateLimit-Remaining": String(remaining),
            "X-RateLimit-Reset": String(reset),
          },
        }
      ),
    };
  }

  return { limited: false };
}

export async function rateLimitAI(ip: string): Promise<RateLimitResult> {
  return checkRateLimit(ip, "ai", 10, 60);
}

export async function rateLimitBuild(ip: string): Promise<RateLimitResult> {
  return checkRateLimit(ip, "build", 3, 60);
}

export async function rateLimitExecute(ip: string): Promise<RateLimitResult> {
  return checkRateLimit(ip, "execute", 30, 60);
}
