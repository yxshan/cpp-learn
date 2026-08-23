# Modern C++ Mental Model Reference

Use this page when translating JavaScript/TypeScript instincts into C++.

| JS/TS instinct | C++ question |
|---|---|
| A variable can receive another type later | What static type and conversions does this interface permit? |
| Objects are reached through managed references | Who owns this object, who only borrows it, and how long does it live? |
| Importing loads a module at runtime/build time | Which declaration is visible to this translation unit, and where is the single definition linked? |
| Exceptions and GC clean up most resources | Which RAII object releases the resource during every exit path? |

Before coding, name the value type, owner, borrower, lifetime, mutation boundary, and observable contract.
