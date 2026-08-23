# Ownership and Lifetime Reference

- Prefer values when copying is the intended independent behavior.
- Use `const T&` for a non-owning, non-null, read-only borrow whose lifetime is guaranteed by the caller.
- Use `T&` for a non-owning, non-null borrow that may modify the caller's object.
- Use `T*` when null or reseating is part of the interface; check before dereferencing.
- Use `std::unique_ptr<T>` for transferable unique ownership.
- Use `std::shared_ptr<T>` only when shared lifetime ownership is genuinely required.
- Bind resources to object lifetime through constructors and destructors; avoid naked `new`/`delete` in application code.

Sanitizers detect representative violations, not proofs of lifetime correctness.
