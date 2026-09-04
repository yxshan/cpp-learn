#include <atomic>
#include <iostream>
#include <thread>

int main() {
  int payload = 0;
  int observed = 0;
  std::atomic<bool> ready{false};

  std::thread producer([&] {
    payload = 42;
    ready.store(true, std::memory_order_release);
    ready.notify_one();
  });

  std::thread consumer([&] {
    ready.wait(false, std::memory_order_acquire);
    observed = payload;
  });

  producer.join();
  consumer.join();

  std::cout << std::boolalpha;
  std::cout << "ready=" << ready.load(std::memory_order_relaxed) << '\n';
  std::cout << "observed=" << observed << '\n';
}
