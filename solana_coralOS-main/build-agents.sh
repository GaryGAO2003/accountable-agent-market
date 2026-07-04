#!/usr/bin/env bash
# Build the agent images coral-server launches for the CoralOS round (from repo root so they bundle
# packages/). Run once before `docker compose up` -- only needed if you change the agents; the demo ships
# against the pre-built images.
#
# Usage: bash build-agents.sh           (build all)
#        bash build-agents.sh seller    (seller-agent only)
#        bash build-agents.sh buyer     (buyer-agent only)
#        bash build-agents.sh arbiter   (arbiter-agent only)
#        bash build-agents.sh challenger (challenger-agent only)

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

build_seller() {
  echo "==> Building seller-agent:0.1.0"
  docker build -f "$ROOT/coral-agents/seller-agent/Dockerfile" -t seller-agent:0.1.0 "$ROOT"
  echo "    seller-agent:0.1.0 done (the seller-worldcup persona reuses this image)"
}

build_buyer() {
  echo "==> Building buyer-agent:0.1.0"
  docker build -f "$ROOT/coral-agents/buyer-agent/Dockerfile" -t buyer-agent:0.1.0 "$ROOT"
  echo "    buyer-agent:0.1.0 done"
}

build_arbiter() {
  echo "==> Building arbiter-agent:0.1.0"
  docker build -f "$ROOT/coral-agents/arbiter-agent/Dockerfile" -t arbiter-agent:0.1.0 "$ROOT"
  echo "    arbiter-agent:0.1.0 done"
}

build_challenger() {
  echo "==> Building challenger-agent:0.1.0"
  docker build -f "$ROOT/coral-agents/challenger-agent/Dockerfile" -t challenger-agent:0.1.0 "$ROOT"
  echo "    challenger-agent:0.1.0 done"
}

case "${1:-all}" in
  seller) build_seller ;;
  buyer)  build_buyer ;;
  arbiter) build_arbiter ;;
  challenger) build_challenger ;;
  all)
    build_seller
    build_buyer
    build_challenger
    build_arbiter
    echo ""
    echo "Agent images built. Run a CoralOS round:"
    echo "  docker compose up -d coral"
    echo "  cd examples/txodds && npm run coral"
    ;;
  *) echo "Usage: bash build-agents.sh [seller|buyer|challenger|arbiter|all]"; exit 1 ;;
esac
