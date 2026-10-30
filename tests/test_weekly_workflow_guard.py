"""Fail-closed regression checks for the scheduled House PTR weekly card workflow.

These tests run without GitHub credentials or external APIs; they simulate git/gh
commands so a failed push can never request a Pages deployment.
"""
import os
from pathlib import Path
import subprocess
import tempfile
import textwrap
import unittest


ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github/workflows/weekly-congress-card.yml"


def commit_script():
    source = WORKFLOW.read_text(encoding="utf-8")
    section = source.split("      - name: Commit and deploy\n", 1)[1]
    return textwrap.dedent(section.split("        run: |\n", 1)[1])


class WeeklyWorkflowGuardTests(unittest.TestCase):
    def test_collector_failures_are_not_ignored(self):
        source = WORKFLOW.read_text(encoding="utf-8")
        self.assertIn("run: python collector/us/trades.py", source)
        self.assertIn("run: python scripts/weekly/build_ticker_members.py", source)
        self.assertNotIn("continue-on-error: true", source)

    def run_commit_step(self, mode):
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            bin_dir = tmp / "bin"
            bin_dir.mkdir()
            git = bin_dir / "git"
            git.write_text(textwrap.dedent('''\
                #!/usr/bin/env bash
                printf 'git %s\\n' "$*" >> "$TEST_CALLS"
                case "$1" in
                  diff)
                    if [[ "$TEST_MODE" == "no_changes" ]]; then exit 0; fi
                    exit 1 ;;
                  push)
                    n=$(cat "$TEST_PUSH_COUNT" 2>/dev/null || echo 0)
                    n=$((n+1))
                    printf '%s' "$n" > "$TEST_PUSH_COUNT"
                    if [[ "$TEST_MODE" == "fail" ]] || \
                       { [[ "$TEST_MODE" == "retry" ]] && [[ "$n" -lt 3 ]]; }; then
                      exit 1
                    fi ;;
                esac
                exit 0
                '''), encoding="utf-8")
            gh = bin_dir / "gh"
            gh.write_text('#!/usr/bin/env bash\nprintf "gh %s\\n" "$*" >> "$TEST_CALLS"\n', encoding="utf-8")
            sleep = bin_dir / "sleep"
            sleep.write_text('#!/usr/bin/env bash\nexit 0\n', encoding="utf-8")
            for file in (git, gh, sleep):
                file.chmod(0o755)
            env = dict(os.environ, PATH=str(bin_dir) + os.pathsep + os.environ.get("PATH", ""),
                       TEST_MODE=mode, TEST_CALLS=str(tmp / "calls"),
                       TEST_PUSH_COUNT=str(tmp / "count"))
            result = subprocess.run(["bash", "-c", commit_script()], cwd=tmp, env=env,
                                    text=True, capture_output=True, timeout=10)
            calls = (tmp / "calls").read_text() if (tmp / "calls").exists() else ""
            count = int((tmp / "count").read_text()) if (tmp / "count").exists() else 0
            return result, calls, count

    def test_exhausted_push_never_dispatches_pages(self):
        result, calls, count = self.run_commit_step("fail")
        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(count, 3)
        self.assertNotIn("gh workflow run", calls)
        self.assertIn("deployment not requested", result.stdout)

    def test_successful_retry_dispatches_once(self):
        result, calls, count = self.run_commit_step("retry")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(count, 3)
        self.assertEqual(calls.count("gh workflow run deploy-pages.yml --ref main"), 1)

    def test_no_changes_does_not_dispatch(self):
        result, calls, count = self.run_commit_step("no_changes")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(count, 0)
        self.assertNotIn("gh workflow run", calls)


if __name__ == "__main__":
    unittest.main()
