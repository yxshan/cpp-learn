#include <atomic>
#include <iostream>
#include <thread>

int main() {
  std::atomic<int> counter{0};
  auto increment = [&] {
    for (int i = 0; i < 1'000; ++i) {
      counter.fetch_add(1, std::memory_order_relaxed);
    }
  };

  std::thread first(increment);
  std::thread second(increment);
  first.join();
  second.join();

  std::cout << "counter=" << counter.load(std::memory_order_relaxed) << '\n';
}
