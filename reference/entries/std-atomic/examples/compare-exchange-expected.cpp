#include <atomic>
#include <iostream>

int main() {
  std::atomic<int> state{7};
  int expected = 3;
  const bool first = state.compare_exchange_strong(
      expected, 9, std::memory_order_relaxed, std::memory_order_relaxed);
  const int expected_after_failure = expected;
  const bool second = state.compare_exchange_strong(
      expected, 9, std::memory_order_relaxed, std::memory_order_relaxed);

  std::cout << std::boolalpha;
  std::cout << "first=" << first << '\n';
  std::cout << "expected_after_failure=" << expected_after_failure << '\n';
  std::cout << "second=" << second << '\n';
  std::cout << "state=" << state.load(std::memory_order_relaxed) << '\n';
}
