# Deterministic Algorithm Testing Reference

1. Start with small public examples that explain the I/O contract.
2. State independent properties: for sorting, require nondecreasing order and preservation of the input multiset.
3. Generate cases from a recorded 32-bit seed; never replace the seed while debugging.
4. Re-run the recorded case index, minimize the counterexample, and retain it as an ordinary regression.
5. Separate functional correctness from cost. A fast wrong result is still wrong.
6. Measure growth on one machine by alternating baseline/scaled inputs and comparing medians.
7. Do not turn one machine's absolute milliseconds into a portable complexity claim.

Random generation expands explored input space; it is not a proof. Determinism turns an observed failure into durable engineering evidence.
