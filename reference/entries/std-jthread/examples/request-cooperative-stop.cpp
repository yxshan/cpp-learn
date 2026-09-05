#include <atomic>
#include <iostream>
#include <stop_token>
#include <thread>

int main() {
  std::atomic<bool> ready{false};
  std::atomic<int> checkpoints{0};

  std::jthread worker([&](std::stop_token token) {
    checkpoints.fetch_add(1, std::memory_order_relaxed);
    ready.store(true, std::memory_order_release);
    ready.notify_one();

    while (!token.stop_requested()) {
      std::this_thread::yield();
    }

    checkpoints.fetch_add(1, std::memory_order_relaxed);
  });

  ready.wait(false, std::memory_order_acquire);
  const bool first_request = worker.request_stop();
  const bool second_request = worker.request_stop();
  worker.join();

  std::cout << std::boolalpha;
  std::cout << "first_request=" << first_request << '\n';
  std::cout << "second_request=" << second_request << '\n';
  std::cout << "checkpoints="
            << checkpoints.load(std::memory_order_relaxed) << '\n';
  std::cout << "joinable=" << worker.joinable() << '\n';
}
