#include <condition_variable>
#include <iostream>
#include <mutex>
#include <thread>

int main() {
  std::mutex mutex;
  std::condition_variable condition;
  bool finished = false;
  int value = 0;

  std::thread worker([&] {
    std::unique_lock<std::mutex> lock(mutex);
    value = 42;
    finished = true;
    std::notify_all_at_thread_exit(condition, std::move(lock));
  });

  {
    std::unique_lock<std::mutex> lock(mutex);
    condition.wait(lock, [&] { return finished; });
  }
  worker.join();

  std::cout << std::boolalpha;
  std::cout << "finished=" << finished << '\n';
  std::cout << "value=" << value << '\n';
}
