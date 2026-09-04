#include <condition_variable>
#include <iostream>
#include <mutex>
#include <thread>

int main() {
  std::mutex mutex;
  std::condition_variable condition;
  bool ready = false;
  int value = 0;

  {
    std::lock_guard<std::mutex> lock(mutex);
    value = 42;
    ready = true;
  }
  condition.notify_one();

  int observed = 0;
  std::thread consumer([&] {
    std::unique_lock<std::mutex> lock(mutex);
    condition.wait(lock, [&] { return ready; });
    observed = value;
  });
  consumer.join();

  std::cout << "observed=" << observed << '\n';
  std::cout << std::boolalpha << "ready=" << ready << '\n';
}
