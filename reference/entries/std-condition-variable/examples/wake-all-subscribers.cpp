#include <algorithm>
#include <condition_variable>
#include <iostream>
#include <mutex>
#include <thread>
#include <vector>

int main() {
  std::mutex mutex;
  std::condition_variable condition;
  bool ready = false;
  std::vector<int> observed;

  auto subscriber = [&](int offset) {
    std::unique_lock<std::mutex> lock(mutex);
    condition.wait(lock, [&] { return ready; });
    observed.push_back(42 + offset);
  };

  std::thread first(subscriber, 0);
  std::thread second(subscriber, 1);

  {
    std::lock_guard<std::mutex> lock(mutex);
    ready = true;
  }
  condition.notify_all();

  first.join();
  second.join();
  std::sort(observed.begin(), observed.end());

  std::cout << "first=" << observed[0] << '\n';
  std::cout << "second=" << observed[1] << '\n';
  std::cout << "count=" << observed.size() << '\n';
}
