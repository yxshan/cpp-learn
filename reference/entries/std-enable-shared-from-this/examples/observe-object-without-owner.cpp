#include <iostream>
#include <memory>

class Session : public std::enable_shared_from_this<Session> {};

int main() {
  Session session;
  const bool weak_expired = session.weak_from_this().expired();

  bool shared_failed = false;
  try {
    static_cast<void>(session.shared_from_this());
  } catch (const std::bad_weak_ptr&) {
    shared_failed = true;
  }

  std::cout << std::boolalpha;
  std::cout << "weak_expired=" << weak_expired << '\n';
  std::cout << "shared_failed=" << shared_failed << '\n';
}
