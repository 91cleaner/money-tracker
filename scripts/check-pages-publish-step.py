#!/usr/bin/env python3
"""Determine whether the exact GitHub Pages publish step succeeded; fail closed."""
import json
import sys

DEPLOY_STEP = "Run actions/deploy-pages@v4"
FINISHED = {"success", "failure", "cancelled", "skipped", "timed_out", "neutral"}


def was_pages_published(payload):
    if not isinstance(payload, dict) or not isinstance(payload.get("jobs"), list):
        raise ValueError("GitHub jobs response is missing a jobs array")
    jobs = [job for job in payload["jobs"]
            if isinstance(job, dict) and job.get("name") == "deploy"]
    if len(jobs) != 1:
        raise ValueError(f"expected exactly one deploy job; found {len(jobs)}")
    steps = jobs[0].get("steps")
    if not isinstance(steps, list):
        raise ValueError("deploy job is missing its steps array")
    matches = [step for step in steps
               if isinstance(step, dict) and step.get("name") == DEPLOY_STEP]
    if len(matches) != 1:
        raise ValueError(f"expected exactly one {DEPLOY_STEP} step; found {len(matches)}")
    conclusion = matches[0].get("conclusion")
    if conclusion not in FINISHED:
        raise ValueError(f"unrecognized or incomplete Pages step conclusion: {conclusion!r}")
    return conclusion == "success"


def main():
    try:
        payload = json.load(sys.stdin)
        print("true" if was_pages_published(payload) else "false")
        return 0
    except (ValueError, TypeError) as exc:
        print(f"Cannot establish Pages publication status: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
