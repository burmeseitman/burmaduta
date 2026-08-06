# backend/measure_forecast.py
"""
Operational probe for the Prophet forecasting run.

Answers the question "can this host afford FORECAST_SCHEDULER_ENABLED=true?"
by running the real forecast once and reporting peak memory and wall time.

Peak RSS is sampled for BOTH this process and its children, because Prophet
fits via cmdstanpy, which spawns a separate cmdstan subprocess per township.
Watching only the parent understates the true footprint.

Usage (inside the API container):
    python backend/measure_forecast.py            # dry run, writes nothing
    python backend/measure_forecast.py --commit   # also saves forecasts to the DB

Read the numbers against the container limit, not the host's total RAM:
    docker stats --no-stream burmaduta-api
"""
import argparse
import resource
import sys
import threading
import time

import db_manager
from db_manager import DBManager


def _rss_scale():
    """ru_maxrss is kilobytes on Linux and bytes on macOS."""
    return 1024.0 * 1024.0 if sys.platform == "darwin" else 1024.0


def peak_mb():
    """Highest RSS watermark reached by this process and any children, in MB."""
    scale = _rss_scale()
    me = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    kids = resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss
    return (me + kids) / scale


class Sampler(threading.Thread):
    """Polls the RSS watermark so we still get a reading if the run is killed."""

    def __init__(self, interval=0.5):
        super().__init__(daemon=True)
        self.interval = interval
        self.peak = 0.0
        self._stop = threading.Event()

    def run(self):
        while not self._stop.wait(self.interval):
            self.peak = max(self.peak, peak_mb())

    def stop(self):
        self._stop.set()
        self.peak = max(self.peak, peak_mb())
        return self.peak


def main():
    parser = argparse.ArgumentParser(description="Measure a Prophet forecast run.")
    parser.add_argument(
        "--commit",
        action="store_true",
        help="Persist forecasts. Omit to leave the database untouched.",
    )
    args = parser.parse_args()

    baseline = peak_mb()
    print(f"↪ Baseline RSS before import: {baseline:.1f} MB")

    probe_db = DBManager()
    if probe_db.mock_mode:
        print("❌ DBManager is in mock mode — no live database. Numbers would be meaningless.")
        return 1

    rows = probe_db.get_historical_daily_counts(days=90)
    townships = {r.get("township") for r in rows if r.get("township")}
    print(f"↪ {len(rows)} historical rows across {len(townships)} township(s).")
    print(f"↪ Mode: {'COMMIT (will write)' if args.commit else 'DRY RUN (no writes)'}")

    if not args.commit:
        # Neutralise the only write path without touching forecaster.py.
        saved = {"n": 0}

        def _no_write(self, forecast_list):
            saved["n"] = len(forecast_list)
            return len(forecast_list)

        DBManager.save_forecasts_batch = _no_write

    from forecaster import run_forecast

    sampler = Sampler()
    sampler.start()
    started = time.monotonic()
    try:
        result = run_forecast()
    finally:
        elapsed = time.monotonic() - started
        observed = sampler.stop()

    per_township = (elapsed / len(townships)) if townships else 0.0

    print("\n" + "=" * 52)
    print(f"  Wall time          : {elapsed:.1f}s ({per_township:.2f}s per township)")
    print(f"  Peak RSS           : {observed:.1f} MB  (self + cmdstan children)")
    print(f"  Growth over baseline: {observed - baseline:.1f} MB")
    print(f"  Forecast points    : {result}")
    print("=" * 52)
    print(
        "\nCompare peak RSS against the container limit while the API and scraper\n"
        "are also resident. If headroom is thin, keep FORECAST_SCHEDULER_ENABLED=false\n"
        "and run forecaster.py from host cron instead, so a fit that overruns memory\n"
        "cannot take the API process down with it."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
