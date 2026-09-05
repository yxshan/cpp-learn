#include <atomic>
#include <iostream>
#include <stop_token>
#include <thread>

int main() {
  std::atomic<bool> started{false};
  std::atomic<bool> stop_observed{false};

  {
    std::jthread worker([&](std::stop_token token) {
      started.store(true, std::memory_order_release);
      started.notify_one();

      while (!token.stop_requested()) {
        std::this_thread::yield();
      }

      stop_observed.store(true, std::memory_order_release);
    });

    started.wait(false, std::memory_order_acquire);
  }

  std::cout << std::boolalpha;
  std::cout << "stop_observed="
            << stop_observed.load(std::memory_order_acquire) << '\n';
}
