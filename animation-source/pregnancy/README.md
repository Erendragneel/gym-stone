# Pregnancy animation sources

Fourteen full-body prenatal exercise illustrations generated with the built-in ImageGen tool. Each exercise has its final source grid (`.png`), exact generation prompt (`.txt`), and reviewed cell selection/timing (`.json`) in this folder. GIF and animated WebP outputs live in `dist/assets/prenatal-*`.

The encoder retains complete source cells with a 40px safety margin. It selects reviewed poses and encodes discrete opaque frames without blending bodies or clamping limbs. `encoding-audit.json` and `decoded-audit.json` record complete decoding, timings, dimensions and hashes. Run `audit-pregnancy.py` for the independent checks.

These are general demonstration options, not a prescribed routine or assurance of suitability for every pregnancy. The Pregnancy section asks users to obtain clinician guidance, gives comfort adjustments and stop signs, and leaves activity amounts blank for actual logging. Supported marching adds stable chair support and low steps to the source's marching advice; leg extension keeps both hands planted. The model's high leg-extension pose and uncertain final cycling pedal attachment were excluded during review.

Sources are linked in each catalog item: ACOG and NHS general pregnancy activity guidance, Mayo Clinic pregnancy exercises, Royal United Hospitals Bath prenatal strengthening/flexibility leaflets, James Paget Fit for Pregnancy, and Norfolk/Norwich pregnancy physiotherapy advice. No source photographs are incorporated into these illustrations.
