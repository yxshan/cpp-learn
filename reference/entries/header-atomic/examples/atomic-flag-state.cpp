#include <atomic>
#include <iostream>

int main() {
  std::atomic_flag flag{};
  const bool first = flag.test_and_set(std::memory_order_relaxed);
  const bool second = flag.test_and_set(std::memory_order_relaxed);
  flag.clear(std::memory_order_relaxed);
  const bool after_clear = flag.test(std::memory_order_relaxed);

  std::cout << std::boolalpha;
  std::cout << "first=" << first << '\n';
  std::cout << "second=" << second << '\n';
  std::cout << "after_clear=" << after_clear << '\n';
}
