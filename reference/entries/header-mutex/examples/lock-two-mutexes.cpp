#include <iostream>
#include <mutex>
#include <thread>

int main() {
  std::mutex left_mutex;
  std::mutex right_mutex;
  int left = 0;
  int right = 0;

  const auto forward = [&] {
    for (int index = 0; index < 100; ++index) {
      std::scoped_lock lock(left_mutex, right_mutex);
      ++left;
      ++right;
    }
  };

  const auto reverse = [&] {
    for (int index = 0; index < 100; ++index) {
      std::scoped_lock lock(right_mutex, left_mutex);
      ++left;
      ++right;
    }
  };

  std::thread first(forward);
  std::thread second(reverse);
  first.join();
  second.join();

  std::cout << "left=" << left << '\n';
  std::cout << "right=" << right << '\n';
}
