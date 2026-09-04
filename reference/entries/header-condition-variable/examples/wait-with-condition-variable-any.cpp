#include <condition_variable>
#include <iostream>
#include <mutex>
#include <thread>

int main() {
  std::recursive_mutex mutex;
  std::condition_variable_any condition;
  bool ready = false;
  int value = 0;

  std::thread worker([&] {
    std::unique_lock<std::recursive_mutex> lock(mutex);
    condition.wait(lock, [&] { return ready; });
    value = 42;
  });

  {
    std::lock_guard<std::recursive_mutex> lock(mutex);
    ready = true;
  }
  condition.notify_one();
  worker.join();

  std::cout << std::boolalpha;
  std::cout << "ready=" << ready << '\n';
  std::cout << "value=" << value << '\n';
}
