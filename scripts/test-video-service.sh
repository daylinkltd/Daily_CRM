#!/usr/bin/env bash

# AI Video & Marketing Generation Test Script
set -e

echo "=================================================="
echo "🎬 Running AI Video & Image Service Test Suite"
echo "=================================================="

# 1. Run Unit & Integration Tests
echo ""
echo "▶ 1. Running Video & Image Generation Tests (Vitest)..."
npx vitest run src/lib/marketing/video-service.test.ts src/lib/marketing/image-service.test.ts

# 2. Run CLI Diagnostics Execution
echo ""
echo "▶ 2. Running Live Service Diagnostics & Guardrails Test..."
npx tsx scripts/run-video-service.ts

echo ""
echo "=================================================="
echo "🎉 ALL TESTS & SCRIPTS COMPLETED SUCCESSFULLY!"
echo "=================================================="
